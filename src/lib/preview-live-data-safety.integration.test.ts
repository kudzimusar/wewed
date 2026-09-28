/**
 * P13-LIVE-1 — Preview live-data safety (QRO 01).
 *
 * Preview deployments share the live database. This suite proves, against a throwaway local
 * PostgreSQL, that every Wedding Day / Wedding Pass / Gate / RSVP mutation path refuses to write
 * unless Preview is scoped to the exact wedding by ID, including the GET that issues a Pass:
 *
 *   - non-UAT wedding on Preview: check-in, revoke and Pass issuance are refused (423) and write
 *     nothing; an existing Pass stays readable; a pre-window wedding still reports its real
 *     `not_yet_issuable` state rather than a Preview error;
 *   - exact UAT wedding ID configured: the same operations succeed for that wedding only;
 *   - no configuration: Preview is read-only;
 *   - production / local: the Preview mechanism never blocks a legitimate write;
 *   - the domain-layer backstop refuses direct calls, independent of the route;
 *   - the key is the wedding ID, never the display name;
 *   - Preview sign-in never accepts invitations outside the writable wedding.
 */

import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'

mock.module('server-only', () => ({}))

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  process.env.WEWED_SESSION_SECRET = 'p13-live-preview-safety-secret'
}

const describeDb = isLocal ? describe : describe.skip

describeDb('P13-LIVE-1 Preview live-data safety', () => {
  let db: typeof import('@/lib/db')['db']
  let getPassRoute: typeof import('@/app/api/wedding-day/pass/route')['GET']
  let postCheckInRoute: typeof import('@/app/api/native/gate/wedding-day/check-in/route')['POST']
  let postRevokeRoute: typeof import('@/app/api/native/gate/wedding-day/pass/revoke/route')['POST']
  let createNativeAccountSessionToken: typeof import('@/lib/native-account-session')['createNativeAccountSessionToken']
  let createWeddingGuestSessionToken: typeof import('@/lib/wedding-guest-session')['createWeddingGuestSessionToken']
  let wd: typeof import('@/lib/wedding-day')
  let gates: typeof import('@/lib/gate-authority')
  let rsvp: typeof import('@/lib/guest-rsvp-mutation')
  let access: typeof import('@/lib/wedding-access')
  let safety: typeof import('@/lib/preview-write-safety')

  const run = randomUUID().slice(0, 8)
  const id = (name: string) => `p13-live-${run}-${name}`

  // LIVE and UAT are both inside the T-14 issuance window. EARLY is well before it. UAT is given
  // the display title that LIVE's ID would need to match if the guard wrongly keyed on names.
  const LIVE = { wedding: id('live'), guest: id('live-guest'), gate: id('live-gate'), rsvpToken: id('live-rsvp') }
  const UAT = { wedding: id('uat'), guest: id('uat-guest'), gate: id('uat-gate'), rsvpToken: id('uat-rsvp') }
  const EARLY = { wedding: id('early'), guest: id('early-guest'), rsvpToken: id('early-rsvp') }
  const OPERATOR = id('operator')
  const MEMBER = id('member')
  const ALL_WEDDINGS = [LIVE.wedding, UAT.wedding, EARLY.wedding]
  let bearer: string

  const saved = {
    VERCEL_ENV: process.env.VERCEL_ENV,
    WEWED_PREVIEW_WRITABLE_WEDDING_ID: process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID,
  }
  function setEnv(vercelEnv: string | undefined, writable: string | undefined) {
    if (vercelEnv === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = vercelEnv
    if (writable === undefined) delete process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID
    else process.env.WEWED_PREVIEW_WRITABLE_WEDDING_ID = writable
  }

  const count = async (table: string, weddingId: string) => {
    const rows = await db.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS n FROM public."${table}" WHERE "weddingId" = $1`,
      weddingId,
    )
    return Number(rows[0]?.n ?? 0)
  }

  const guestCookie = (w: { wedding: string; guest: string; rsvpToken: string }) =>
    `wewed_wedding_guest=${createWeddingGuestSessionToken({ weddingId: w.wedding, guestId: w.guest, rsvpToken: w.rsvpToken })}`

  const passRequest = (w: { wedding: string; guest: string; rsvpToken: string }) =>
    new NextRequest('http://localhost/api/wedding-day/pass', { headers: { Cookie: guestCookie(w) } })

  const gateRequest = (path: string, weddingId: string, gateId: string, body: unknown) => {
    const request = new NextRequest(
      `http://localhost/api/native/gate/wedding-day/${path}?grantId=${`gate_operator:${weddingId}:${gateId}`}`,
      { method: 'POST', body: JSON.stringify(body) },
    )
    request.headers.set('Authorization', `Bearer ${bearer}`)
    request.headers.set('Content-Type', 'application/json')
    return request
  }

  async function cleanup() {
    for (const w of ALL_WEDDINGS) {
      for (const t of ['WeddingCheckIn', 'WeddingPassCredential', 'WeddingPassKey', 'WeddingGateAssignment', 'WeddingGate', 'WeddingMembership', 'AuditEvent']) {
        await db.$executeRawUnsafe(`DELETE FROM public."${t}" WHERE "weddingId" = $1`, w)
      }
    }
    await db.$executeRawUnsafe(`DELETE FROM public."RSVP" WHERE "guestId" = ANY($1::text[])`, [LIVE.guest, UAT.guest, EARLY.guest])
    await db.$executeRawUnsafe(`DELETE FROM public."Guest" WHERE "weddingId" = ANY($1::text[])`, ALL_WEDDINGS)
    await db.$executeRawUnsafe(`DELETE FROM public."Wedding" WHERE id = ANY($1::text[])`, ALL_WEDDINGS)
    await db.$executeRawUnsafe(`DELETE FROM public."Couple" WHERE id = ANY($1::text[])`, ALL_WEDDINGS.map((w) => `${w}-couple`))
    await db.$executeRawUnsafe(`DELETE FROM public."User" WHERE id = ANY($1::text[])`, [OPERATOR, MEMBER])
  }

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({ GET: getPassRoute } = await import('@/app/api/wedding-day/pass/route'))
    ;({ POST: postCheckInRoute } = await import('@/app/api/native/gate/wedding-day/check-in/route'))
    ;({ POST: postRevokeRoute } = await import('@/app/api/native/gate/wedding-day/pass/revoke/route'))
    ;({ createNativeAccountSessionToken } = await import('@/lib/native-account-session'))
    ;({ createWeddingGuestSessionToken } = await import('@/lib/wedding-guest-session'))
    wd = await import('@/lib/wedding-day')
    gates = await import('@/lib/gate-authority')
    rsvp = await import('@/lib/guest-rsvp-mutation')
    access = await import('@/lib/wedding-access')
    safety = await import('@/lib/preview-write-safety')

    const ww2 = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const root = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM = ww2.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.WEDDING_DAY_WW2_KEY_ID = `ww2-p13-live-${run}`
    process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM = root.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.WEDDING_DAY_ROOT_KEY_ID = `root-p13-live-${run}`
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'

    await cleanup()

    const weddings: Array<[string, string, string]> = [
      [LIVE.wedding, 'Live Client Wedding', "now() + interval '5 days'"],
      // The UAT wedding's *title* equals the LIVE wedding's *ID*: a name-keyed guard would unlock LIVE.
      [UAT.wedding, LIVE.wedding, "now() + interval '5 days'"],
      [EARLY.wedding, 'Early Wedding', "now() + interval '120 days'"],
    ]
    for (const [weddingId, title, date] of weddings) {
      await db.$executeRawUnsafe(
        `INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ($1, $1, 'A', 'B', now())`,
        `${weddingId}-couple`,
      )
      await db.$executeRawUnsafe(
        `INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "updatedAt")
         VALUES ($1, $1, $2, ${date}, 'Venue', 'City', 'Country', $3, now())`,
        weddingId, title, `${weddingId}-couple`,
      )
    }
    for (const g of [LIVE, UAT, EARLY]) {
      await db.$executeRawUnsafe(
        `INSERT INTO public."Guest" (id, "weddingId", name, "updatedAt") VALUES ($1, $2, 'Guest', now())`,
        g.guest, g.wedding,
      )
      await db.$executeRawUnsafe(
        `INSERT INTO public."RSVP" (id, "guestId", token, attending, "updatedAt") VALUES ($1, $2, $3, TRUE, now())`,
        `${g.guest}-rsvp`, g.guest, g.rsvpToken,
      )
    }
    await db.$executeRawUnsafe(
      `INSERT INTO public."User" (id, email, name, role, "updatedAt") VALUES ($1, $2, 'Operator', 'usher', now())`,
      OPERATOR, `${OPERATOR}@example.test`,
    )
    for (const g of [LIVE, UAT]) {
      await db.$executeRawUnsafe(
        `INSERT INTO public."WeddingGate" (id, "weddingId", name, status, "updatedAt") VALUES ($1, $2, 'Main Gate', 'active', now())`,
        g.gate, g.wedding,
      )
      await db.$executeRawUnsafe(
        `INSERT INTO public."WeddingGateAssignment"
          (id, "weddingId", "gateId", "userId", "operatorRole", capabilities, "activeFrom", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'usher', $5, now() - interval '1 hour', now(), now())`,
        `${g.gate}-assign`, g.wedding, g.gate, OPERATOR,
        JSON.stringify(['gate.manifest.read', 'gate.checkin.write', 'gate.pass.revoke']),
      )
    }
    bearer = createNativeAccountSessionToken({
      accessUserId: OPERATOR,
      authUserId: `auth-${OPERATOR}`,
      email: `${OPERATOR}@example.test`,
    })
  })

  afterEach(() => setEnv(saved.VERCEL_ENV, saved.WEWED_PREVIEW_WRITABLE_WEDDING_ID))

  afterAll(async () => {
    setEnv(saved.VERCEL_ENV, saved.WEWED_PREVIEW_WRITABLE_WEDDING_ID)
    delete process.env.WEWED_WEDDING_DAY_WW2_ENABLED
    if (db) {
      await cleanup()
      await db.$disconnect()
    }
  })

  test('P0-LIVE-03: Preview GET /api/wedding-day/pass never issues for a non-UAT wedding', async () => {
    for (const writable of [undefined, UAT.wedding]) {
      setEnv('preview', writable)
      const response = await getPassRoute(passRequest(LIVE))
      expect(response.status).toBe(423)
      expect(response.headers.get('x-wewed-preview-write-blocked')).toBe('true')
      expect((await response.json()).code).toBe('PREVIEW_WRITE_BLOCKED')
      expect(await count('WeddingPassCredential', LIVE.wedding)).toBe(0)
      expect(await count('WeddingPassKey', LIVE.wedding)).toBe(0)
    }
  })

  test('pre-window wedding on Preview reports its real not_yet_issuable state, not a Preview error', async () => {
    setEnv('preview', undefined)
    const response = await getPassRoute(passRequest(EARLY))
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.code).not.toBe('PREVIEW_WRITE_BLOCKED')
    expect(body.availability.state).toBe('not_yet_issuable')
    expect(await count('WeddingPassCredential', EARLY.wedding)).toBe(0)
  })

  test('exact UAT wedding ID unlocks issuance for that wedding only', async () => {
    setEnv('preview', UAT.wedding)
    const response = await getPassRoute(passRequest(UAT))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.data.weddingId).toBe(UAT.wedding)
    expect(await count('WeddingPassCredential', UAT.wedding)).toBe(1)
    // The display title of UAT equals LIVE's ID; LIVE is still refused.
    expect((await getPassRoute(passRequest(LIVE))).status).toBe(423)
  })

  test('P0-LIVE-01 / 02: Preview Gate check-in and revoke refuse a non-UAT wedding and write nothing', async () => {
    // Seed a legitimate LIVE credential outside Preview (production-equivalent issuance).
    setEnv(undefined, undefined)
    const credential = await wd.ensureWeddingPassCredential({ weddingId: LIVE.wedding, guestId: LIVE.guest })

    for (const writable of [undefined, UAT.wedding]) {
      setEnv('preview', writable)
      const checkIn = await postCheckInRoute(
        gateRequest('check-in', LIVE.wedding, LIVE.gate, { token: credential.token, attendeeKeys: ['primary'] }),
      )
      expect(checkIn.status).toBe(423)
      expect((await checkIn.json()).code).toBe('PREVIEW_WRITE_BLOCKED')
      const batch = await postCheckInRoute(
        gateRequest('check-in', LIVE.wedding, LIVE.gate, {
          items: [{ token: credential.token, attendeeKeys: ['primary'], clientEventId: 'evt-1' }],
        }),
      )
      expect(batch.status).toBe(423)
      expect(await count('WeddingCheckIn', LIVE.wedding)).toBe(0)

      const revoke = await postRevokeRoute(
        gateRequest('pass/revoke', LIVE.wedding, LIVE.gate, { credentialId: credential.id, reason: 'preview probe' }),
      )
      expect(revoke.status).toBe(423)
      const rows = await db.$queryRawUnsafe<Array<{ revokedAt: Date | null; supersededAt: Date | null }>>(
        `SELECT "revokedAt", "supersededAt" FROM public."WeddingPassCredential" WHERE id = $1`,
        credential.id,
      )
      expect(rows[0]).toEqual({ revokedAt: null, supersededAt: null })
    }

    // An existing credential stays readable from Preview: reading is not issuing.
    setEnv('preview', undefined)
    const read = await getPassRoute(passRequest(LIVE))
    expect(read.status).toBe(200)
    expect((await read.json()).data.passSerial).toBe(credential.passSerial)
    expect(await count('WeddingPassCredential', LIVE.wedding)).toBe(1)
  })

  test('exact UAT wedding ID permits Gate check-in and revoke for that wedding', async () => {
    setEnv('preview', UAT.wedding)
    const credential = await wd.ensureWeddingPassCredential({ weddingId: UAT.wedding, guestId: UAT.guest })
    const checkIn = await postCheckInRoute(
      gateRequest('check-in', UAT.wedding, UAT.gate, { token: credential.token, attendeeKeys: ['primary'] }),
    )
    expect(checkIn.status).toBe(200)
    expect(await count('WeddingCheckIn', UAT.wedding)).toBe(1)
    const revoke = await postRevokeRoute(
      gateRequest('pass/revoke', UAT.wedding, UAT.gate, { credentialId: credential.id, reason: 'uat lifecycle' }),
    )
    expect(revoke.status).toBe(200)
  })

  test('domain backstop refuses every direct writer on Preview, independent of the route', async () => {
    setEnv('preview', undefined)
    const blocked = (promise: Promise<unknown>) =>
      promise.then(
        () => { throw new Error('expected PreviewWriteBlockedError') },
        (error) => expect(safety.isPreviewWriteBlockedError(error)).toBe(true),
      )
    const live = await db.$queryRawUnsafe<Array<{ id: string; token: string }>>(
      `SELECT id, token FROM public."WeddingPassCredential" WHERE "weddingId" = $1 LIMIT 1`,
      LIVE.wedding,
    )
    await blocked(wd.revokeWeddingPassCredential({ weddingId: LIVE.wedding, credentialId: live[0].id, reason: 'x' }))
    await blocked(
      wd.checkInWeddingGuest({
        weddingId: LIVE.wedding, gateId: LIVE.gate, operatorUserId: OPERATOR, token: live[0].token, attendeeKeys: ['primary'],
      }),
    )
    await blocked(wd.ensurePassKey(EARLY.wedding))
    await blocked(db.$transaction((tx) => wd.withdrawWeddingPassesForAttendance(tx, { weddingId: LIVE.wedding, guestId: LIVE.guest })))
    await blocked(gates.createWeddingGate({ weddingId: LIVE.wedding, name: 'Side Gate', actorUserId: OPERATOR }))
    await blocked(gates.disableWeddingGate({ weddingId: LIVE.wedding, gateId: LIVE.gate, actorUserId: OPERATOR }))
    await blocked(
      gates.assignGateOperator({
        weddingId: LIVE.wedding, gateId: LIVE.gate, userId: OPERATOR, capabilities: ['gate.checkin.write'], actorUserId: OPERATOR,
      }),
    )
    await blocked(
      gates.revokeGateOperator({ weddingId: LIVE.wedding, assignmentId: `${LIVE.gate}-assign`, actorUserId: OPERATOR }),
    )

    const rsvpResult = await rsvp.applyGuestRsvpUpdate({
      weddingId: LIVE.wedding, rsvpToken: LIVE.rsvpToken, requestedFields: { attending: false },
    })
    expect(rsvpResult).toMatchObject({ ok: false, code: 'PREVIEW_WRITE_BLOCKED', status: 423 })
    const attendance = await db.$queryRawUnsafe<Array<{ attending: boolean | null }>>(
      `SELECT attending FROM public."RSVP" WHERE token = $1`, LIVE.rsvpToken,
    )
    expect(attendance[0]?.attending).toBe(true)
    expect(await count('WeddingPassKey', EARLY.wedding)).toBe(0)
  })

  test('production and local environments are never blocked by the Preview mechanism', async () => {
    for (const env of ['production', 'development', undefined]) {
      setEnv(env, undefined)
      expect(safety.previewWeddingMutationBlocked(LIVE.wedding)).toBe(false)
      expect(() => safety.assertPreviewWeddingMutationAllowed(LIVE.wedding)).not.toThrow()
      expect(safety.previewAccountBookkeepingSuppressed()).toBe(false)
      expect(safety.pendingMembershipAcceptanceScope()).toEqual({ mode: 'all' })
    }
  })

  test('Preview sign-in accepts pending invitations only for the writable UAT wedding', async () => {
    await db.$executeRawUnsafe(
      `INSERT INTO public."User" (id, email, name, role, "updatedAt") VALUES ($1, $2, 'Member', 'planner', now())`,
      MEMBER, `${MEMBER}@example.test`,
    )
    for (const w of [LIVE.wedding, UAT.wedding]) {
      await db.$executeRawUnsafe(
        `INSERT INTO public."WeddingMembership" (id, "userId", "weddingId", role, status, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'coordinator', 'invited', now(), now())`,
        `${w}-member`, MEMBER, w,
      )
    }
    const statuses = async () =>
      Object.fromEntries(
        (await db.$queryRawUnsafe<Array<{ weddingId: string; status: string }>>(
          `SELECT "weddingId", status FROM public."WeddingMembership" WHERE "userId" = $1`, MEMBER,
        )).map((r) => [r.weddingId, r.status]),
      )

    setEnv('preview', undefined)
    await access.acceptPendingMemberships(MEMBER)
    expect(await statuses()).toEqual({ [LIVE.wedding]: 'invited', [UAT.wedding]: 'invited' })

    setEnv('preview', UAT.wedding)
    expect(safety.previewAccountBookkeepingSuppressed()).toBe(true)
    await access.acceptPendingMemberships(MEMBER)
    expect(await statuses()).toEqual({ [LIVE.wedding]: 'invited', [UAT.wedding]: 'active' })

    setEnv(undefined, undefined)
    await access.acceptPendingMemberships(MEMBER)
    expect(await statuses()).toEqual({ [LIVE.wedding]: 'active', [UAT.wedding]: 'active' })
  })
})
