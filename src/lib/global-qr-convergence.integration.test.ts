/**
 * LQR01 — Global Wedding Pass / QR convergence contract.
 *
 * One canonical admission authority: `WeddingPassCredential.token` (signed WW2). Every display or
 * consumer of the Wedding Pass must converge on that exact token, and every other QR trust domain
 * (Open Invitation, Printed Invitation Access, Wedding Website, Vendor / Booking Page) stays out.
 *
 * Runs the real route handlers against a disposable local PostgreSQL database
 * (AUTHORITY_TEST_DATABASE_URL, localhost only). Bearer tokens are compared in memory only; the
 * only printed evidence is a SHA-256 digest of each token.
 *
 * Only the Couple/Planner app-session permission lookup is substituted (`requireWeddingPermission`)
 * because it depends on the full account/membership graph; every Guest-session, Gate-grant, Pass,
 * RSVP and database path is real. iOS/Android client equality is proven by their own unit harnesses
 * against the same response contract; simulator/device runtime proof remains OPEN.
 */

import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'

mock.module('server-only', () => ({}))

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  process.env.WEWED_SESSION_SECRET = 'lqr01-global-qr-test-secret'
}

let plannerContext: null | { weddingId: string; userId: string; permissions: string[] } = null
if (isLocal) {
  const realWeddingAccess = { ...(await import('@/lib/wedding-access')) }
  // Capture before mock.module live-patches the namespace.
  const realRequire = realWeddingAccess.requireWeddingPermission
  mock.module('@/lib/wedding-access', () => ({
    ...realWeddingAccess,
    requireWeddingPermission: async (request: NextRequest, permission: string) => {
      if (!plannerContext) return realRequire(request, permission)
      if (!plannerContext.permissions.includes(permission)) {
        const { NextResponse } = await import('next/server')
        return { context: null, error: NextResponse.json({ success: false }, { status: 403 }) }
      }
      return {
        error: null,
        context: {
          weddingId: plannerContext.weddingId,
          role: 'planner',
          permissions: plannerContext.permissions,
          session: { userId: plannerContext.userId },
        },
      }
    },
  }))
}

const describeDb = isLocal ? describe : describe.skip

const digest = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex')

describeDb('LQR01 global Wedding Pass / QR convergence', () => {
  let db: typeof import('@/lib/db')['db']
  let wd: typeof import('@/lib/wedding-day')
  let getPass: typeof import('@/app/api/wedding-day/pass/route')['GET']
  let postCheckIn: typeof import('@/app/api/native/gate/wedding-day/check-in/route')['POST']
  let postRevoke: typeof import('@/app/api/native/gate/wedding-day/pass/revoke/route')['POST']
  let getManifest: typeof import('@/app/api/native/gate/wedding-day/manifest/route')['GET']
  let guestSessionRoute: typeof import('@/app/api/weddings/[slug]/guest-session/route')
  let listPasses: typeof import('@/app/api/planner/wedding-passes/route')['GET']
  let viewPass: typeof import('@/app/api/planner/wedding-passes/view/route')['POST']
  let createGuestSession: typeof import('@/lib/wedding-guest-session')['createWeddingGuestSessionToken']
  let operatorBearer: string

  const run = randomUUID().slice(0, 8)
  const id = (name: string) => `lqr01-${run}-${name}`
  const W = id('wedding')
  const W_FAR = id('wedding-far')
  const W_PAST = id('wedding-past')
  const GATE = id('gate')
  const OPERATOR = id('operator')
  const PLANNER = id('planner')
  const GRANT = `gate_operator:${W}:${GATE}`

  // Guest G carries the global X → revoke → Y contract (household of two).
  const G = id('guest-g')
  // Guest H carries the RSVP ↔ Pass lifecycle contract.
  const H = id('guest-h')
  const P = id('guest-pending')
  const D = id('guest-declined')
  const FAR = id('guest-far')
  const PAST = id('guest-past')
  const rsvpToken = (guestId: string) => `${guestId}-rsvp`

  const insertWedding = (weddingId: string, offset: string) =>
    db.$executeRawUnsafe(
      `INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "updatedAt")
       VALUES ($1, $1, 'LQR01 Wedding', now() + $3::interval, 'Venue', 'City', 'Country', $2, now())`,
      weddingId, id('couple'), offset,
    )
  const insertGuest = async (
    weddingId: string,
    guestId: string,
    attending: boolean | null,
    plusOne = false,
  ) => {
    await db.$executeRawUnsafe(
      `INSERT INTO public."Guest" (id, "weddingId", name, "updatedAt") VALUES ($1, $2, $3, now())`,
      guestId, weddingId, `Guest ${guestId.slice(-8)}`,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."RSVP" (id, "guestId", token, attending, "plusOne", "plusOneName", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      `${guestId}-rsvp-row`, guestId, rsvpToken(guestId), attending, plusOne, plusOne ? 'Plus One' : null,
    )
  }

  const guestCookie = (weddingId: string, guestId: string) =>
    `wewed_wedding_guest=${createGuestSession({ weddingId, guestId, rsvpToken: rsvpToken(guestId) })}`

  async function guestPass(weddingId: string, guestId: string) {
    const response = await getPass(
      new NextRequest('http://localhost/api/wedding-day/pass', {
        headers: { Cookie: guestCookie(weddingId, guestId) },
      }),
    )
    return { status: response.status, body: await response.json() }
  }

  async function guestRsvp(guestId: string, fields: Record<string, unknown>) {
    const response = await guestSessionRoute.PUT(
      new NextRequest(`http://localhost/api/weddings/${W}/guest-session`, {
        method: 'PUT',
        headers: { Cookie: guestCookie(W, guestId), 'Content-Type': 'application/json' },
        body: JSON.stringify({ originGuestId: guestId, ...fields }),
      }),
      { params: Promise.resolve({ slug: W }) },
    )
    return { status: response.status, body: await response.json() }
  }

  async function gateCheckIn(body: Record<string, unknown>) {
    const request = new NextRequest(`http://localhost/api/native/gate/wedding-day/check-in?grantId=${GRANT}`, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    request.headers.set('Authorization', `Bearer ${operatorBearer}`)
    const response = await postCheckIn(request)
    return { status: response.status, body: await response.json() }
  }

  async function asPlanner<T>(weddingId: string, fn: () => Promise<T>, permissions = ['guests.view', 'guests.edit']): Promise<T> {
    plannerContext = { weddingId, userId: PLANNER, permissions }
    try {
      return await fn()
    } finally {
      plannerContext = null
    }
  }

  async function plannerList(weddingId: string) {
    return asPlanner(weddingId, async () => {
      const response = await listPasses(new NextRequest('http://localhost/api/planner/wedding-passes'))
      const text = await response.text()
      return { status: response.status, text, body: JSON.parse(text) }
    })
  }

  async function plannerRow(weddingId: string, guestId: string) {
    const list = await plannerList(weddingId)
    return list.body.data.guests.find((row: { guestId: string }) => row.guestId === guestId)
  }

  async function plannerView(weddingId: string, guestId: string) {
    return asPlanner(weddingId, async () => {
      const response = await viewPass(
        new NextRequest('http://localhost/api/planner/wedding-passes/view', {
          method: 'POST',
          body: JSON.stringify({ guestId }),
        }),
      )
      return { status: response.status, body: await response.json() }
    })
  }

  async function freshManifestEntry(serial: string) {
    const request = new NextRequest(`http://localhost/api/native/gate/wedding-day/manifest?grantId=${GRANT}`)
    request.headers.set('Authorization', `Bearer ${operatorBearer}`)
    const response = await getManifest(request)
    expect(response.status).toBe(200)
    const body = await response.json()
    const payload = JSON.parse(body.data.canonicalPayload)
    return payload.credentials.find((entry: { passSerial: string }) => entry.passSerial === serial)
  }

  const credentialCount = async (weddingId: string, guestId?: string) => {
    const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM public."WeddingPassCredential"
        WHERE "weddingId" = $1 AND ($2::text IS NULL OR "guestId" = $2)`,
      weddingId, guestId ?? null,
    )
    return Number(rows[0].count)
  }
  const liveCredentialCount = async (guestId: string) => {
    const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM public."WeddingPassCredential"
        WHERE "guestId" = $1 AND "revokedAt" IS NULL AND "supersededAt" IS NULL`,
      guestId,
    )
    return Number(rows[0].count)
  }
  const checkInCount = async (guestId: string) => {
    const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*)::bigint AS count FROM public."WeddingCheckIn" WHERE "guestId" = $1`,
      guestId,
    )
    return Number(rows[0].count)
  }

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    wd = await import('@/lib/wedding-day')
    ;({ GET: getPass } = await import('@/app/api/wedding-day/pass/route'))
    ;({ POST: postCheckIn } = await import('@/app/api/native/gate/wedding-day/check-in/route'))
    ;({ POST: postRevoke } = await import('@/app/api/native/gate/wedding-day/pass/revoke/route'))
    ;({ GET: getManifest } = await import('@/app/api/native/gate/wedding-day/manifest/route'))
    guestSessionRoute = await import('@/app/api/weddings/[slug]/guest-session/route')
    ;({ GET: listPasses } = await import('@/app/api/planner/wedding-passes/route'))
    ;({ POST: viewPass } = await import('@/app/api/planner/wedding-passes/view/route'))
    ;({ createWeddingGuestSessionToken: createGuestSession } = await import('@/lib/wedding-guest-session'))
    const { createNativeAccountSessionToken } = await import('@/lib/native-account-session')

    const ww2 = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const root = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    process.env.WEDDING_DAY_WW2_PRIVATE_KEY_PEM = ww2.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.WEDDING_DAY_WW2_KEY_ID = `ww2-lqr01-${run}`
    process.env.WEDDING_DAY_ROOT_PRIVATE_KEY_PEM = root.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
    process.env.WEDDING_DAY_ROOT_KEY_ID = `root-lqr01-${run}`
    process.env.WEWED_WEDDING_DAY_WW2_ENABLED = 'true'

    await db.$executeRawUnsafe(
      `INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ($1, $1, 'A', 'B', now())`,
      id('couple'),
    )
    await insertWedding(W, '5 days')
    await insertWedding(W_FAR, '120 days')
    await insertWedding(W_PAST, '-3 days')
    for (const [userId, role] of [[OPERATOR, 'usher'], [PLANNER, 'planner']] as const) {
      await db.$executeRawUnsafe(
        `INSERT INTO public."User" (id, email, name, role, "updatedAt") VALUES ($1, $2, $1, $3, now())`,
        userId, `${userId}@example.test`, role,
      )
    }
    await db.$executeRawUnsafe(
      `INSERT INTO public."WeddingGate" (id, "weddingId", name, status, "updatedAt") VALUES ($1, $2, 'Main Gate', 'active', now())`,
      GATE, W,
    )
    await db.$executeRawUnsafe(
      `INSERT INTO public."WeddingGateAssignment"
        (id, "weddingId", "gateId", "userId", "operatorRole", capabilities, "activeFrom", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'usher', $5, now() - interval '1 hour', now(), now())`,
      id('assignment'), W, GATE, OPERATOR,
      JSON.stringify(['gate.manifest.read', 'gate.checkin.write', 'gate.pass.revoke']),
    )
    await insertGuest(W, G, true, true)
    await insertGuest(W, H, true)
    await insertGuest(W, P, null)
    await insertGuest(W, D, false)
    await insertGuest(W_FAR, FAR, true)
    await insertGuest(W_PAST, PAST, true)

    operatorBearer = createNativeAccountSessionToken({
      accessUserId: OPERATOR,
      authUserId: `auth-${OPERATOR}`,
      email: `${OPERATOR}@example.test`,
    })
  })

  afterAll(async () => {
    delete process.env.WEWED_WEDDING_DAY_WW2_ENABLED
    if (db) await db.$disconnect()
  })

  // ---------------------------------------------------------------------------
  // QR-P0-01 on the convergence line
  // ---------------------------------------------------------------------------
  test('a valid Guest Session cannot check in or create a WeddingCheckIn', async () => {
    const valid = await guestSessionRoute.GET(
      new NextRequest(`http://localhost/api/weddings/${W}/guest-session`, { headers: { Cookie: guestCookie(W, G) } }),
      { params: Promise.resolve({ slug: W }) },
    )
    expect((await valid.json()).authorized).toBe(true)

    const patch = await guestSessionRoute.PATCH()
    expect(patch.status).toBe(405)
    expect((await patch.json()).code).toBe('GUEST_SESSION_NOT_ADMISSION_AUTHORITY')

    const smuggle = await guestRsvp(G, { attending: true, checkedIn: true, checkedInAt: new Date().toISOString() })
    expect(smuggle.status).toBe(200)
    expect(smuggle.body.rsvp.checkedIn).toBe(false)

    // A Guest Session cookie is not a Gate grant.
    const gateAttempt = await postCheckIn(
      new NextRequest(`http://localhost/api/native/gate/wedding-day/check-in?grantId=${GRANT}`, {
        method: 'POST',
        headers: { Cookie: guestCookie(W, G) },
        body: JSON.stringify({ token: 'WW2.x', attendeeKeys: ['primary'] }),
      }),
    )
    expect(gateAttempt.status).toBe(401)

    const rsvp = await db.rSVP.findUniqueOrThrow({ where: { guestId: G }, select: { checkedIn: true, checkedInAt: true } })
    expect(rsvp).toEqual({ checkedIn: false, checkedInAt: null })
    expect(await checkInCount(G)).toBe(0)
  })

  // ---------------------------------------------------------------------------
  // Couple/Planner metadata never mints
  // ---------------------------------------------------------------------------
  test('opening the Planner/Couple Wedding Pass list issues nothing and exposes no token', async () => {
    const list = await plannerList(W)
    expect(list.status).toBe(200)
    expect(await credentialCount(W)).toBe(0)
    const states = Object.fromEntries(list.body.data.guests.map((row: { guestId: string; state: string }) => [row.guestId, row.state]))
    expect(states[G]).toBe('not_yet_issued')
    expect(states[P]).toBe('pending_rsvp')
    expect(states[D]).toBe('declined')
    expect(list.text).not.toContain('"token"')
    expect(list.text).not.toContain('WW2.')

    const view = await plannerView(W, G)
    expect(view.status).toBe(409)
    expect(view.body.code).toBe('NO_ACTIVE_WEDDING_PASS')
    expect(await credentialCount(W)).toBe(0)

    const viewerOnly = await asPlanner(W, () => viewPass(new NextRequest('http://localhost/api/planner/wedding-passes/view', {
      method: 'POST', body: JSON.stringify({ guestId: G }),
    })), ['guests.view'])
    expect(viewerOnly.status).toBe(403)
  })

  // ---------------------------------------------------------------------------
  // Global contract: X → revoke X → Y
  // ---------------------------------------------------------------------------
  test('every Wedding Pass surface converges on X, rejects X after revocation, and converges on Y', async () => {
    // Issue through the Guest's own authorized retrieval.
    const web = await guestPass(W, G)
    expect(web.status).toBe(200)
    expect(web.body.availability.state).toBe('active')
    const X: string = web.body.data.token
    const credentialX = await db.weddingPassCredential.findFirstOrThrow({ where: { weddingId: W, guestId: G } })
    expect(credentialX.token === X).toBe(true)
    expect(credentialX.issueSeq).toBe(1)
    console.info(`[lqr01] X credentialId=${credentialX.id} passSerial=${credentialX.passSerial} issueSeq=${credentialX.issueSeq} sha256=${digest(X)}`)

    // Web Guest Pass payload == X (re-retrieval reuses, never re-mints).
    const webAgain = await guestPass(W, G)
    expect(webAgain.body.data.token === X).toBe(true)
    expect(await credentialCount(W, G)).toBe(1)

    // Planner/Couple "View Wedding Pass" payload == X byte-for-byte; metadata agrees; view audited without token.
    const adminX = await plannerView(W, G)
    expect(adminX.status).toBe(200)
    expect(adminX.body.data.token === X).toBe(true)
    expect(Buffer.compare(Buffer.from(adminX.body.data.token, 'utf8'), Buffer.from(X, 'utf8'))).toBe(0)
    const rowX = await plannerRow(W, G)
    expect(rowX.state).toBe('active')
    expect(rowX.credential).toMatchObject({ passSerial: credentialX.passSerial, tokenVersion: 'WW2', issueSeq: 1, revokedAt: null })
    const viewAudit = await db.auditEvent.findFirstOrThrow({ where: { weddingId: W, action: 'wedding_pass.viewed', resourceId: credentialX.id } })
    expect(viewAudit.actorId).toBe(PLANNER)
    expect(viewAudit.afterValue ?? '').not.toContain(X)

    // Fresh manifest carries X as admissible.
    expect((await freshManifestEntry(credentialX.passSerial)).revokedAt).toBeNull()

    // Online Gate accepts X (partial household), duplicate sync is idempotent.
    const admitPrimary = await gateCheckIn({ token: X, attendeeKeys: ['primary'], clientEventId: `${run}-evt-1`, deviceId: 'gate-1' })
    expect(admitPrimary.status).toBe(200)
    expect(admitPrimary.body.admittedCount).toBe(1)
    const duplicate = await gateCheckIn({ token: X, attendeeKeys: ['primary'], clientEventId: `${run}-evt-1`, deviceId: 'gate-1' })
    expect(duplicate.status).toBe(200)
    expect(await checkInCount(G)).toBe(1)
    const offlineRow = await db.weddingCheckIn.findFirstOrThrow({ where: { guestId: G, attendeeKey: 'primary' } })
    expect(offlineRow).toMatchObject({ credentialId: credentialX.id, gateId: GATE, admittedByUserId: OPERATOR, source: 'offline-sync' })
    expect((await plannerRow(W, G)).state).toBe('partially_checked_in')

    // Serial-only (legacy queue shape) is never admission proof — single and batch forms.
    const serialOnly = await gateCheckIn({ passSerial: credentialX.passSerial, attendeeKeys: ['plus-one'], clientEventId: `${run}-legacy` })
    expect(serialOnly.status).toBe(400)
    expect(serialOnly.body.code).toBe('SERIAL_ONLY_ADMISSION_UNSUPPORTED')
    const batch = await gateCheckIn({ items: [{ passSerial: credentialX.passSerial, attendeeKeys: ['plus-one'], clientEventId: `${run}-legacy-batch` }] })
    expect(batch.body.blockedLegacyIds).toEqual([`${run}-legacy-batch`])
    expect(await checkInCount(G)).toBe(1)

    // Cross-wedding rejection.
    await expect(wd.checkInWeddingGuest({
      weddingId: W_FAR, gateId: GATE, operatorUserId: OPERATOR, token: X, attendeeKeys: ['primary'],
    })).rejects.toThrow('PASS_WEDDING_MISMATCH')

    // Revoke X through the Gate operator authority.
    const revokeRequest = new NextRequest(`http://localhost/api/native/gate/wedding-day/pass/revoke?grantId=${GRANT}`, {
      method: 'POST',
      body: JSON.stringify({ passSerial: credentialX.passSerial, reason: 'LQR01 contract revocation' }),
    })
    revokeRequest.headers.set('Authorization', `Bearer ${operatorBearer}`)
    expect((await postRevoke(revokeRequest)).status).toBe(200)

    // Planner reports revoked and refuses to show X; nothing is re-minted by looking.
    const rowRevoked = await plannerRow(W, G)
    expect(rowRevoked.state).toBe('partially_checked_in')
    expect(rowRevoked.credential.revokedAt).not.toBeNull()
    expect((await plannerView(W, G)).status).toBe(409)
    expect(await credentialCount(W, G)).toBe(1)

    // Online Gate rejects X; a fresh manifest marks X revoked; a queued offline replay of X is terminally rejected.
    const rejectX = await gateCheckIn({ token: X, attendeeKeys: ['plus-one'] })
    expect(rejectX.status).toBe(400)
    expect(rejectX.body.code).toBe('PASS_REVOKED_OR_EXPIRED')
    const replay = await gateCheckIn({ items: [{ token: X, attendeeKeys: ['plus-one'], clientEventId: `${run}-evt-2` }] })
    expect(replay.body.rejectedIds).toEqual([`${run}-evt-2`])
    expect((await freshManifestEntry(credentialX.passSerial)).revokedAt).not.toBeNull()
    await expect(wd.verifyWeddingPassToken({ weddingId: W, token: X })).rejects.toThrow('PASS_REVOKED_OR_EXPIRED')

    // Reissue: the Guest's next authorized retrieval yields a fresh credential Y, never X.
    const webY = await guestPass(W, G)
    expect(webY.status).toBe(200)
    const Y: string = webY.body.data.token
    expect(Y === X).toBe(false)
    const credentialY = await db.weddingPassCredential.findFirstOrThrow({ where: { weddingId: W, guestId: G, issueSeq: 2 } })
    expect(credentialY.token === Y).toBe(true)
    expect(credentialY.passSerial).not.toBe(credentialX.passSerial)
    expect(credentialY.nonce).not.toBe(credentialX.nonce)
    console.info(`[lqr01] Y credentialId=${credentialY.id} passSerial=${credentialY.passSerial} issueSeq=${credentialY.issueSeq} sha256=${digest(Y)}`)

    // Every surface converges on Y.
    const adminY = await plannerView(W, G)
    expect(adminY.body.data.token === Y).toBe(true)
    expect((await plannerRow(W, G)).credential).toMatchObject({ passSerial: credentialY.passSerial, issueSeq: 2, revokedAt: null })
    expect((await freshManifestEntry(credentialY.passSerial)).revokedAt).toBeNull()
    const admitPlusOne = await gateCheckIn({ token: Y, attendeeKeys: ['plus-one'] })
    expect(admitPlusOne.status).toBe(200)
    expect((await plannerRow(W, G)).state).toBe('checked_in')
    const rsvp = await db.rSVP.findUniqueOrThrow({ where: { guestId: G }, select: { checkedIn: true } })
    expect(rsvp.checkedIn).toBe(true)
  })

  // ---------------------------------------------------------------------------
  // RSVP ↔ Pass lifecycle
  // ---------------------------------------------------------------------------
  test('attendance withdrawal supersedes the Pass; re-acceptance never revives it; other edits never rotate', async () => {
    const first = await guestPass(W, H)
    const X: string = first.body.data.token
    const credentialX = await db.weddingPassCredential.findFirstOrThrow({ where: { guestId: H, issueSeq: 1 } })

    // Non-attendance edits never rotate or revoke.
    for (const edit of [{ mealChoice: 'Fish' }, { message: 'So happy for you' }, { dietaryNotes: 'None' }]) {
      expect((await guestRsvp(H, edit)).status).toBe(200)
    }
    expect((await guestPass(W, H)).body.data.token === X).toBe(true)
    expect(await credentialCount(W, H)).toBe(1)

    // true → false revokes/supersedes X transactionally.
    expect((await guestRsvp(H, { attending: false })).status).toBe(200)
    const withdrawn = await db.weddingPassCredential.findUniqueOrThrow({ where: { id: credentialX.id } })
    expect(withdrawn.revokedAt).not.toBeNull()
    expect(withdrawn.supersededAt).not.toBeNull()
    expect(withdrawn.revocationReason).toBe(wd.ATTENDANCE_WITHDRAWN_REASON)
    expect((await gateCheckIn({ token: X, attendeeKeys: ['primary'] })).body.code).toBe('PASS_REVOKED_OR_EXPIRED')
    const declinedPass = await guestPass(W, H)
    expect(declinedPass.status).toBe(403)
    expect(declinedPass.body.availability.state).toBe('declined')
    expect((await plannerRow(W, H)).state).toBe('declined')
    expect((await plannerView(W, H)).status).toBe(409)

    // false → true issues nothing by itself.
    expect((await guestRsvp(H, { attending: true })).status).toBe(200)
    expect(await liveCredentialCount(H)).toBe(0)
    expect((await plannerRow(W, H)).state).toBe('superseded')
    expect((await gateCheckIn({ token: X, attendeeKeys: ['primary'] })).body.code).toBe('PASS_REVOKED_OR_EXPIRED')

    // The next authorized retrieval issues a fresh Y.
    const second = await guestPass(W, H)
    const Y: string = second.body.data.token
    expect(Y === X).toBe(false)
    const credentialY = await db.weddingPassCredential.findFirstOrThrow({ where: { guestId: H, revokedAt: null } })
    expect(credentialY.issueSeq).toBe(2)
    expect(credentialY.passSerial).not.toBe(credentialX.passSerial)
    expect(credentialY.nonce).not.toBe(credentialX.nonce)

    // Pending → declined with no credential creates nothing synthetic.
    expect((await guestRsvp(P, { attending: false })).status).toBe(200)
    expect(await credentialCount(W, P)).toBe(0)
  })

  test('concurrent attendance withdrawal and Pass retrieval serialize to a single safe outcome', async () => {
    // Withdraw while Pass retrievals race: afterwards no live credential may survive.
    await Promise.allSettled([
      guestPass(W, H), guestPass(W, H), guestPass(W, H),
      guestRsvp(H, { attending: false }),
      guestPass(W, H), guestPass(W, H),
    ])
    expect((await db.rSVP.findUniqueOrThrow({ where: { guestId: H } })).attending).toBe(false)
    expect(await liveCredentialCount(H)).toBe(0)

    // Re-accept, then race retrievals: exactly one fresh live credential.
    expect((await guestRsvp(H, { attending: true })).status).toBe(200)
    const results = await Promise.all(Array.from({ length: 6 }, () => guestPass(W, H)))
    const tokens = new Set(results.filter((r) => r.status === 200).map((r) => r.body.data.token as string))
    expect(tokens.size).toBe(1)
    expect(await liveCredentialCount(H)).toBe(1)
  })

  // ---------------------------------------------------------------------------
  // Issuance-window state parity
  // ---------------------------------------------------------------------------
  test('Pass availability states are structured and identical for Guest and Planner surfaces', async () => {
    const pending = await guestPass(W, id('guest-missing-rsvp'))
    expect(pending.status).toBe(401)

    const declined = await guestPass(W, D)
    expect([declined.status, declined.body.code, declined.body.availability.state]).toEqual([403, 'ATTENDANCE_DECLINED', 'declined'])

    await db.$executeRawUnsafe(`UPDATE public."RSVP" SET attending = NULL WHERE "guestId" = $1`, P)
    const rsvpRequired = await guestPass(W, P)
    expect([rsvpRequired.status, rsvpRequired.body.code, rsvpRequired.body.availability.state]).toEqual([403, 'ATTENDANCE_REQUIRED', 'rsvp_required'])

    // Attending months ahead: a distinct "available closer to the wedding" state, nothing minted.
    const far = await guestPass(W_FAR, FAR)
    expect([far.status, far.body.code, far.body.availability.state]).toEqual([409, 'PASS_NOT_YET_ISSUABLE', 'not_yet_issuable'])
    expect(Date.parse(far.body.availability.opensAt)).toBeGreaterThan(Date.now())
    expect(await credentialCount(W_FAR)).toBe(0)
    expect((await plannerRow(W_FAR, FAR)).state).toBe('not_yet_issuable')

    // After cutoff with nothing issued: closed.
    const past = await guestPass(W_PAST, PAST)
    expect([past.status, past.body.code, past.body.availability.state]).toEqual([410, 'PASS_ISSUANCE_CLOSED', 'issuance_closed'])
    expect((await plannerRow(W_PAST, PAST)).state).toBe('issuance_closed')

    // Operator revocation that can no longer be replaced: revoked, not a generic closure.
    await db.$executeRawUnsafe(`UPDATE public."Wedding" SET date = now() + interval '2 days' WHERE id = $1`, W_PAST)
    const issued = await guestPass(W_PAST, PAST)
    expect(issued.status).toBe(200)
    const credential = await db.weddingPassCredential.findFirstOrThrow({ where: { guestId: PAST } })
    await wd.revokeWeddingPassCredential({ weddingId: W_PAST, credentialId: credential.id, reason: 'Lost phone' })
    await db.$executeRawUnsafe(`UPDATE public."Wedding" SET date = now() - interval '3 days' WHERE id = $1`, W_PAST)
    const revoked = await guestPass(W_PAST, PAST)
    expect([revoked.status, revoked.body.code, revoked.body.availability.state]).toEqual([410, 'PASS_REVOKED', 'revoked'])
    expect(JSON.stringify(revoked.body)).not.toContain('WW2.')
    expect((await plannerRow(W_PAST, PAST)).state).toBe('revoked')
  })
})
