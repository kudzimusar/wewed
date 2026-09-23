/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 9 — Digital Invitation + RSVP
 * convergence.
 *
 * Proves, against a disposable local PostgreSQL migrated with this repository's own
 * prisma/migrations, driving the REAL route handlers end to end:
 *  - the shared `applyGuestRsvpUpdate` operation's full field/policy matrix (§16 of the Phase 9
 *    brief), including that a partial edit never erases an unrelated already-saved answer;
 *  - `PUT /api/weddings/[slug]/guest-session`'s `originGuestId` stale-context matrix (§15);
 *  - that `/api/rsvp` POST (the second, legacy guest self-service transport) now shares the exact
 *    same mutation semantics — including the adults-only enforcement it previously lacked
 *    entirely, and no longer erases unrelated fields on a partial edit;
 *  - that both transports read and write the SAME `RSVP` row for the same guest (the PWA ↔ native
 *    "same record" proof — native calls this exact same `guest-session` route, never a second one).
 *
 * Never production: refuses to run unless AUTHORITY_TEST_DATABASE_URL points at localhost/127.0.0.1.
 *
 *   AUTHORITY_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/wewed_phase8_disposable \
 *     bun test src/lib/guest-rsvp-convergence.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  process.env.WEWED_SESSION_SECRET = 'phase9-guest-rsvp-convergence-integration-only'
}
mock.module('server-only', () => ({}))

type Db = typeof import('@/lib/db')['db']
let db: Db
let applyGuestRsvpUpdate: typeof import('@/lib/guest-rsvp-mutation')['applyGuestRsvpUpdate']
let createWeddingGuestSessionToken: typeof import('@/lib/wedding-guest-session')['createWeddingGuestSessionToken']
let WEDDING_GUEST_SESSION_COOKIE: typeof import('@/lib/wedding-guest-session')['WEDDING_GUEST_SESSION_COOKIE']
let GET_GUEST_SESSION: typeof import('@/app/api/weddings/[slug]/guest-session/route')['GET']
let PUT_GUEST_SESSION: typeof import('@/app/api/weddings/[slug]/guest-session/route')['PUT']
let POST_RSVP: typeof import('@/app/api/rsvp/route')['POST']
let NextRequest: typeof import('next/server')['NextRequest']

const run = randomUUID().slice(0, 8)
const weddingIds: string[] = []

async function wedding(
  name: string,
  opts: { childrenPolicy?: 'welcome' | 'adults_only'; privacy?: 'public' | 'link_only' | 'private' } = {},
) {
  const couple = await db.couple.create({
    data: { slug: `p9-couple-${run}-${name}`, partner1: 'P9', partner2: 'Guest' },
  })
  const w = await db.wedding.create({
    data: {
      slug: `p9-wedding-${run}-${name}`,
      title: 'Phase 9 Test Wedding',
      date: new Date('2031-05-10T10:00:00.000Z'),
      venue: 'Test Venue',
      venueCity: 'Harare',
      venueCountry: 'Zimbabwe',
      coupleId: couple.id,
      // guest-session route grants a guest their OWN RSVP access regardless of site privacy;
      // /api/rsvp's broader `resolveWeddingAccessForRequest` only grants guest access for
      // public/link_only weddings (a real, pre-existing, out-of-Phase-9-scope distinction) — tests
      // exercising /api/rsvp specifically pass `privacy: 'public'`.
      privacy: opts.privacy ?? 'private',
    },
  })
  weddingIds.push(w.id)
  if (opts.childrenPolicy) {
    await db.weddingContent.create({
      data: { weddingId: w.id, section: 'rsvp', field: 'childrenPolicy', value: opts.childrenPolicy },
    })
  }
  return w
}

async function guestWithRsvp(weddingId: string, name: string) {
  const suffix = randomUUID().replaceAll('-', '')
  const guest = await db.guest.create({ data: { name, weddingId } })
  const rsvp = await db.rSVP.create({ data: { token: `p9-${run}-${suffix}`, guestId: guest.id } })
  return { guestId: guest.id, rsvpToken: rsvp.token }
}

function sessionCookie(input: { weddingId: string; guestId: string; rsvpToken: string; weddingDate: Date }) {
  const token = createWeddingGuestSessionToken(input)
  return `${WEDDING_GUEST_SESSION_COOKIE}=${token}`
}

function guestSessionRequest(slug: string, cookie: string | null, init: RequestInit = {}) {
  const headers = { ...(init.headers as Record<string, string> ?? {}) }
  if (cookie) headers.cookie = cookie
  return new NextRequest(`http://localhost/api/weddings/${slug}/guest-session`, { ...init, headers })
}

function rsvpRequest(cookie: string | null, body: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (cookie) headers.cookie = cookie
  return new NextRequest('http://localhost/api/rsvp', { method: 'POST', headers, body: JSON.stringify(body) })
}

describe.skipIf(!isLocal)('Phase 9 — guest RSVP mutation convergence against a disposable migrated database', () => {
  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({ applyGuestRsvpUpdate } = await import('@/lib/guest-rsvp-mutation'))
    ;({ createWeddingGuestSessionToken, WEDDING_GUEST_SESSION_COOKIE } = await import('@/lib/wedding-guest-session'))
    ;({ GET: GET_GUEST_SESSION, PUT: PUT_GUEST_SESSION } = await import('@/app/api/weddings/[slug]/guest-session/route'))
    ;({ POST: POST_RSVP } = await import('@/app/api/rsvp/route'))
    ;({ NextRequest } = await import('next/server'))
  })

  afterAll(async () => {
    for (const weddingId of weddingIds) {
      await db.rSVP.deleteMany({ where: { guest: { weddingId } } })
      await db.guest.deleteMany({ where: { weddingId } })
      await db.weddingContent.deleteMany({ where: { weddingId } })
      const w = await db.wedding.findUnique({ where: { id: weddingId }, select: { coupleId: true } })
      await db.wedding.delete({ where: { id: weddingId } })
      if (w) await db.couple.delete({ where: { id: w.coupleId } })
    }
  })

  // -----------------------------------------------------------------------------------
  // §16 RSVP policy matrix — direct applyGuestRsvpUpdate coverage
  // -----------------------------------------------------------------------------------

  test('full field matrix: attending, meal, plus-one, kids, dietary, message all persist exactly as given', async () => {
    const w = await wedding('fields')
    const { rsvpToken } = await guestWithRsvp(w.id, 'Guest Fields')

    const result = await applyGuestRsvpUpdate({
      weddingId: w.id,
      rsvpToken,
      requestedFields: {
        attending: true,
        mealChoice: 'Vegetarian',
        plusOne: true,
        plusOneName: 'Plus One',
        plusOneMeal: 'Chicken',
        kidsAttending: true,
        kidsCount: 2,
        dietaryNotes: 'No nuts',
        message: 'Congratulations!',
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rsvp).toMatchObject({
      attending: true,
      mealChoice: 'Vegetarian',
      plusOne: true,
      plusOneName: 'Plus One',
      plusOneMeal: 'Chicken',
      kidsAttending: true,
      kidsCount: 2,
      dietaryNotes: 'No nuts',
      message: 'Congratulations!',
    })
  })

  test('attending false, plusOne false: no plus-one detail fields are required, and both persist as given', async () => {
    const w = await wedding('decline')
    const { rsvpToken } = await guestWithRsvp(w.id, 'Guest Decline')

    const result = await applyGuestRsvpUpdate({
      weddingId: w.id,
      rsvpToken,
      requestedFields: { attending: false, plusOne: false },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rsvp.attending).toBe(false)
    expect(result.rsvp.plusOne).toBe(false)
  })

  test('a partial edit never overwrites unrelated already-stored fields', async () => {
    const w = await wedding('partial')
    const { rsvpToken } = await guestWithRsvp(w.id, 'Guest Partial')

    const first = await applyGuestRsvpUpdate({
      weddingId: w.id,
      rsvpToken,
      requestedFields: {
        attending: true,
        mealChoice: 'Vegetarian',
        plusOneName: 'Original Plus One',
        dietaryNotes: 'Original notes',
        message: 'Original message',
      },
    })
    expect(first.ok).toBe(true)

    // Only mealChoice changes; every other previously-saved field must survive untouched.
    const second = await applyGuestRsvpUpdate({
      weddingId: w.id,
      rsvpToken,
      requestedFields: { mealChoice: 'Vegan' },
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.rsvp.mealChoice).toBe('Vegan')
    expect(second.rsvp.attending).toBe(true)
    expect(second.rsvp.plusOneName).toBe('Original Plus One')
    expect(second.rsvp.dietaryNotes).toBe('Original notes')
    expect(second.rsvp.message).toBe('Original message')
  })

  test('adults-only: kidsAttending true is refused with CHILDREN_NOT_ALLOWED and no write occurs', async () => {
    const w = await wedding('adults-only-refuse', { childrenPolicy: 'adults_only' })
    const { rsvpToken } = await guestWithRsvp(w.id, 'Guest Adults Only')

    const result = await applyGuestRsvpUpdate({
      weddingId: w.id,
      rsvpToken,
      requestedFields: { attending: true, kidsAttending: true, kidsCount: 2 },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('CHILDREN_NOT_ALLOWED')
    expect(result.status).toBe(400)

    const row = await db.rSVP.findUnique({ where: { token: rsvpToken } })
    expect(row?.attending).toBeNull()
    expect(row?.kidsAttending).toBe(false)
  })

  test('adults-only: an older client submitting only the historical kidsCount (no kidsAttending) succeeds, forces kidsAttending false, and never erases that history', async () => {
    const w = await wedding('adults-only-history', { childrenPolicy: 'adults_only' })
    const { rsvpToken } = await guestWithRsvp(w.id, 'Guest Adults Only History')
    await db.rSVP.update({ where: { token: rsvpToken }, data: { kidsCount: 3 } })

    const result = await applyGuestRsvpUpdate({
      weddingId: w.id,
      rsvpToken,
      requestedFields: { attending: true, kidsCount: 5 },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rsvp.kidsAttending).toBe(false)
    // The stale client's kidsCount write is dropped (not applied), but the field itself is never
    // deleted from the row — the pre-existing value of 3 survives untouched.
    expect(result.rsvp.kidsCount).toBe(3)
  })

  // -----------------------------------------------------------------------------------
  // §15 stale-context matrix — PUT /api/weddings/[slug]/guest-session
  // -----------------------------------------------------------------------------------

  test('missing originGuestId fails closed with 409 STALE_GUEST_CONTEXT, no write occurs', async () => {
    const w = await wedding('stale-missing')
    const { guestId, rsvpToken } = await guestWithRsvp(w.id, 'Guest Stale Missing')
    const cookie = sessionCookie({ weddingId: w.id, guestId, rsvpToken, weddingDate: w.date })

    const res = await PUT_GUEST_SESSION(
      guestSessionRequest(w.slug, cookie, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attending: true }),
      }),
      { params: Promise.resolve({ slug: w.slug }) },
    )
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('STALE_GUEST_CONTEXT')
    const row = await db.rSVP.findUnique({ where: { token: rsvpToken } })
    expect(row?.attending).toBeNull()
  })

  test('originGuestId naming a different (real) guest fails closed with 409, neither guest is mutated', async () => {
    const w = await wedding('stale-mismatch')
    const guestA = await guestWithRsvp(w.id, 'Guest A')
    const guestB = await guestWithRsvp(w.id, 'Guest B')
    const cookieForB = sessionCookie({ weddingId: w.id, guestId: guestB.guestId, rsvpToken: guestB.rsvpToken, weddingDate: w.date })

    // The session cookie resolves to Guest B, but the submitted form was opened against Guest A.
    const res = await PUT_GUEST_SESSION(
      guestSessionRequest(w.slug, cookieForB, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ originGuestId: guestA.guestId, attending: true }),
      }),
      { params: Promise.resolve({ slug: w.slug }) },
    )
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('STALE_GUEST_CONTEXT')

    const rowA = await db.rSVP.findUnique({ where: { token: guestA.rsvpToken } })
    const rowB = await db.rSVP.findUnique({ where: { token: guestB.rsvpToken } })
    expect(rowA?.attending).toBeNull()
    expect(rowB?.attending).toBeNull()
  })

  test('a correct originGuestId succeeds and GET immediately reflects the persisted write', async () => {
    const w = await wedding('stale-correct')
    const { guestId, rsvpToken } = await guestWithRsvp(w.id, 'Guest Correct')
    const cookie = sessionCookie({ weddingId: w.id, guestId, rsvpToken, weddingDate: w.date })

    const putRes = await PUT_GUEST_SESSION(
      guestSessionRequest(w.slug, cookie, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ originGuestId: guestId, attending: true, mealChoice: 'Vegetarian' }),
      }),
      { params: Promise.resolve({ slug: w.slug }) },
    )
    expect(putRes.status).toBe(200)

    const getRes = await GET_GUEST_SESSION(guestSessionRequest(w.slug, cookie), { params: Promise.resolve({ slug: w.slug }) })
    const getBody = await getRes.json()
    expect(getBody.rsvp.attending).toBe(true)
    expect(getBody.rsvp.mealChoice).toBe('Vegetarian')
  })

  test('an invalid/garbage session cookie is treated as unauthenticated: 401, no write', async () => {
    const w = await wedding('invalid-session')
    const { rsvpToken } = await guestWithRsvp(w.id, 'Guest Invalid Session')
    const res = await PUT_GUEST_SESSION(
      guestSessionRequest(w.slug, `${WEDDING_GUEST_SESSION_COOKIE}=not-a-real-token`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ attending: true }),
      }),
      { params: Promise.resolve({ slug: w.slug }) },
    )
    expect(res.status).toBe(401)
    const row = await db.rSVP.findUnique({ where: { token: rsvpToken } })
    expect(row?.attending).toBeNull()
  })

  test('an expired session token is refused: 401, no write', async () => {
    const w = await wedding('expired-session')
    const { guestId, rsvpToken } = await guestWithRsvp(w.id, 'Guest Expired')
    const token = createWeddingGuestSessionToken({
      weddingId: w.id, guestId, rsvpToken, effectiveExpiresAt: Date.now() - 1000,
    })
    const res = await PUT_GUEST_SESSION(
      guestSessionRequest(w.slug, `${WEDDING_GUEST_SESSION_COOKIE}=${token}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ originGuestId: guestId, attending: true }),
      }),
      { params: Promise.resolve({ slug: w.slug }) },
    )
    expect(res.status).toBe(401)
    const row = await db.rSVP.findUnique({ where: { token: rsvpToken } })
    expect(row?.attending).toBeNull()
  })

  // -----------------------------------------------------------------------------------
  // /api/rsvp POST — now sharing the exact same semantics (the reconciliation itself)
  // -----------------------------------------------------------------------------------

  test('POST /api/rsvp now enforces adults-only exactly like guest-session PUT (it previously had no such check at all)', async () => {
    const w = await wedding('legacy-adults-only', { childrenPolicy: 'adults_only', privacy: 'public' })
    const { guestId, rsvpToken } = await guestWithRsvp(w.id, 'Guest Legacy Adults Only')
    const cookie = sessionCookie({ weddingId: w.id, guestId, rsvpToken, weddingDate: w.date })

    const res = await POST_RSVP(rsvpRequest(cookie, { slug: w.slug, attending: 'accept', childrenAttending: true }))
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('CHILDREN_NOT_ALLOWED')
    const row = await db.rSVP.findUnique({ where: { token: rsvpToken } })
    expect(row?.attending).toBeNull()
  })

  test('POST /api/rsvp no longer erases unrelated fields on a partial edit (the fixed destructive-partial-update bug)', async () => {
    const w = await wedding('legacy-partial', { privacy: 'public' })
    const { guestId, rsvpToken } = await guestWithRsvp(w.id, 'Guest Legacy Partial')
    const cookie = sessionCookie({ weddingId: w.id, guestId, rsvpToken, weddingDate: w.date })

    const first = await POST_RSVP(
      rsvpRequest(cookie, {
        slug: w.slug,
        attending: true,
        plusOneName: 'Original Plus One',
        dietaryNotes: 'Original notes',
      }),
    )
    expect(first.status).toBe(200)

    // Only the meal preference changes via its legacy alias; plusOneName/dietaryNotes must survive.
    const second = await POST_RSVP(rsvpRequest(cookie, { slug: w.slug, mealPreference: 'Vegan' }))
    expect(second.status).toBe(200)
    const secondBody = await second.json()
    expect(secondBody.rsvp.mealChoice).toBe('Vegan')
    expect(secondBody.rsvp.plusOneName).toBe('Original Plus One')
    expect(secondBody.rsvp.dietaryNotes).toBe('Original notes')
  })

  test('legacy attendance/mealPreference/childrenAttending/numberOfChildren/messageToCouple aliases still map to the canonical fields', async () => {
    const w = await wedding('legacy-aliases', { privacy: 'public' })
    const { guestId, rsvpToken } = await guestWithRsvp(w.id, 'Guest Legacy Aliases')
    const cookie = sessionCookie({ weddingId: w.id, guestId, rsvpToken, weddingDate: w.date })

    const res = await POST_RSVP(
      rsvpRequest(cookie, {
        slug: w.slug,
        attendance: 'accept',
        mealPreference: 'Vegetarian',
        childrenAttending: true,
        numberOfChildren: 2,
        messageToCouple: 'So excited!',
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rsvp).toMatchObject({
      attending: true,
      mealChoice: 'Vegetarian',
      kidsAttending: true,
      kidsCount: 2,
      message: 'So excited!',
    })
  })

  // -----------------------------------------------------------------------------------
  // §14 PWA ↔ native same-record proof — both transports read/write the SAME row
  // -----------------------------------------------------------------------------------

  test('a write via the legacy /api/rsvp transport is immediately visible via the guest-session GET transport native uses, and vice versa', async () => {
    const w = await wedding('cross-transport', { privacy: 'public' })
    const { guestId, rsvpToken } = await guestWithRsvp(w.id, 'Guest Cross Transport')
    const cookie = sessionCookie({ weddingId: w.id, guestId, rsvpToken, weddingDate: w.date })

    // "PWA legacy transport" writes.
    const legacyWrite = await POST_RSVP(rsvpRequest(cookie, { slug: w.slug, attending: true, mealChoice: 'Vegetarian' }))
    expect(legacyWrite.status).toBe(200)

    // Native's exact transport (guest-session GET) reads the SAME row.
    const nativeRead = await GET_GUEST_SESSION(guestSessionRequest(w.slug, cookie), { params: Promise.resolve({ slug: w.slug }) })
    const nativeBody = await nativeRead.json()
    expect(nativeBody.rsvp.attending).toBe(true)
    expect(nativeBody.rsvp.mealChoice).toBe('Vegetarian')

    // Native's exact transport (guest-session PUT) now writes.
    const nativeWrite = await PUT_GUEST_SESSION(
      guestSessionRequest(w.slug, cookie, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ originGuestId: guestId, dietaryNotes: 'No shellfish' }),
      }),
      { params: Promise.resolve({ slug: w.slug }) },
    )
    expect(nativeWrite.status).toBe(200)

    // A direct DB read (what the PWA's own next reload would see) reflects native's write, and the
    // earlier legacy-transport fields are still intact — one row, one truth, no replication.
    const row = await db.rSVP.findUnique({ where: { token: rsvpToken } })
    expect(row?.attending).toBe(true)
    expect(row?.mealChoice).toBe('Vegetarian')
    expect(row?.dietaryNotes).toBe('No shellfish')
  })
})
