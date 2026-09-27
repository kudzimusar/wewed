/**
 * QRO06-GUEST-LAUNCH01 — native → browser Guest handoff, proven against a DISPOSABLE local
 * PostgreSQL migrated with this repository's prisma/migrations, driving the REAL route handlers.
 *
 * Proves:
 *  - only an already valid native Guest session for THIS wedding may issue, for an allowlisted
 *    destination key, and only from the native client;
 *  - the exchange URL carries neither the RSVP token nor the Guest session cookie;
 *  - redemption establishes the normal browser Guest session for the SAME Guest and redirects only
 *    to the server-derived Couple Site / Registry path;
 *  - tampered, expired, cross-wedding, rotated-invitation and now-private exchanges fail closed to
 *    the gateway without issuing any session;
 *  - no database mutation.
 *
 * Never production: refuses to run unless AUTHORITY_TEST_DATABASE_URL points at localhost/127.0.0.1.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  process.env.WEWED_SESSION_SECRET = 'qro06-guest-browser-handoff-integration-only'
}

mock.module('server-only', () => ({}))

type Db = typeof import('@/lib/db')['db']
let db: Db
let NextRequest: typeof import('next/server')['NextRequest']
let createWeddingGuestSessionToken: typeof import('@/lib/wedding-guest-session')['createWeddingGuestSessionToken']
let verifyWeddingGuestSessionToken: typeof import('@/lib/wedding-guest-session')['verifyWeddingGuestSessionToken']
let invitationVersionFingerprint: typeof import('@/lib/wedding-guest-session')['invitationVersionFingerprint']
let createGuestBrowserHandoffToken: typeof import('@/lib/guest-browser-handoff')['createGuestBrowserHandoffToken']
let ISSUE: typeof import('@/app/api/weddings/[slug]/guest-browser-handoff/route')['POST']
let REDEEM: typeof import('@/app/api/weddings/[slug]/guest-browser-handoff/redeem/route')['POST']

const run = randomUUID().slice(0, 8)
const id = (name: string) => `q6-${run}-${name}`
const ORIGIN = 'http://localhost'
const exec = (sql: string, ...params: unknown[]) => db.$executeRawUnsafe(sql, ...params)

async function wedding(name: string, privacy: string) {
  await exec(`INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ($1, $1, 'A', 'B', now())`, id(`couple-${name}`))
  await exec(
    `INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "invitationCardStyle", privacy, "updatedAt")
     VALUES ($1, $1, $2, now() + interval '90 days', 'Venue', 'City', 'Country', $3, 'ivory-floral-gold', $4, now())`,
    id(name), `Wedding ${name}`, id(`couple-${name}`), privacy)
  return id(name)
}
async function guest(name: string, weddingId: string) {
  await exec(`INSERT INTO public."Guest" (id, name, "weddingId", "updatedAt") VALUES ($1, $2, $3, now())`, id(name), `Guest ${name}`, weddingId)
  await db.rSVP.create({ data: { token: `${id(name)}-rsvp-token`, guestId: id(name), attending: null } })
  return id(name)
}
function nativeCookie(weddingId: string, guestId: string, rsvpToken: string) {
  return `wewed_wedding_guest=${createWeddingGuestSessionToken({ weddingId, guestId, rsvpToken })}`
}
function issueRequest(slug: string, body: unknown, headers: Record<string, string>) {
  return new NextRequest(`${ORIGIN}/api/weddings/${slug}/guest-browser-handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}
async function issue(slug: string, guestId: string, weddingId: string, destination: string) {
  const res = await ISSUE(
    issueRequest(slug, { destination }, { 'x-wewed-client': 'native', cookie: nativeCookie(weddingId, guestId, `${guestId}-rsvp-token`) }),
    { params: Promise.resolve({ slug }) },
  )
  return res
}
/** The exchange from an issue response's entry path (it lives in the URL fragment). */
function exchangeFrom(path: string): string {
  return new URLSearchParams(path.split('#')[1] ?? '').get('h') ?? ''
}
async function redeem(slug: string, h: string) {
  const res = await REDEEM(
    new NextRequest(`${ORIGIN}/api/weddings/${slug}/guest-browser-handoff/redeem`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ h }),
    }),
    { params: Promise.resolve({ slug }) },
  )
  return res
}
async function landing(res: Response): Promise<string> {
  return (await res.clone().json()).path
}
function setCookies(res: Response): string[] {
  return res.headers.getSetCookie?.() ?? []
}
function guestCookieFrom(res: Response): string | null {
  const row = setCookies(res).find((c) => c.startsWith('wewed_wedding_guest='))
  return row ? decodeURIComponent(row.split(';')[0].slice('wewed_wedding_guest='.length)) : null
}

async function fingerprint(weddingIds: string[]) {
  const rows = await db.$queryRawUnsafe<Array<{ k: string; v: string }>>(
    `SELECT 'rsvp' k, coalesce(string_agg(r.id || ':' || r.token || ':' || coalesce(r.attending::text,'-') || ':' || r."updatedAt"::text, ',' ORDER BY r.id), '') v
       FROM public."RSVP" r JOIN public."Guest" g ON g.id = r."guestId" WHERE g."weddingId" = ANY($1)
     UNION ALL SELECT 'guest', coalesce(string_agg(id || ':' || "updatedAt"::text, ',' ORDER BY id), '') FROM public."Guest" WHERE "weddingId" = ANY($1)
     UNION ALL SELECT 'wedding', coalesce(string_agg(id || ':' || "updatedAt"::text || ':' || privacy, ',' ORDER BY id), '') FROM public."Wedding" WHERE id = ANY($1)
     UNION ALL SELECT 'audit', count(*)::text FROM public."AuditEvent" WHERE "weddingId" = ANY($1)`,
    weddingIds,
  )
  return Object.fromEntries(rows.map((r) => [r.k, r.v]))
}

const describeLocal = isLocal ? describe : describe.skip

describeLocal('QRO06 native → browser Guest handoff', () => {
  const w: Record<string, string> = {}
  const g: Record<string, string> = {}

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({ NextRequest } = await import('next/server'))
    ;({ createWeddingGuestSessionToken, verifyWeddingGuestSessionToken, invitationVersionFingerprint } = await import('@/lib/wedding-guest-session'))
    ;({ createGuestBrowserHandoffToken } = await import('@/lib/guest-browser-handoff'))
    ;({ POST: ISSUE } = await import('@/app/api/weddings/[slug]/guest-browser-handoff/route'))
    ;({ POST: REDEEM } = await import('@/app/api/weddings/[slug]/guest-browser-handoff/redeem/route'))

    w.A = await wedding('A', 'link_only')
    w.B = await wedding('B', 'link_only')
    w.P = await wedding('P', 'private')
    g.a = await guest('a', w.A)
    g.rotated = await guest('rotated', w.A)
    g.b = await guest('b', w.B)
    g.p = await guest('p', w.P)
  })
  afterAll(async () => { await db?.$disconnect() })

  test('issue: only a valid native Guest session for this wedding, allowlisted destination keys only', async () => {
    const valid = { 'x-wewed-client': 'native', cookie: nativeCookie(w.A, g.a, `${g.a}-rsvp-token`) }
    const params = { params: Promise.resolve({ slug: w.A }) }
    expect((await ISSUE(issueRequest(w.A, { destination: 'site' }, { cookie: valid.cookie }), params)).status).toBe(400)
    for (const destination of ['https://evil.example', '/w/other', '//evil.example', 'site#x', null, 42]) {
      expect((await ISSUE(issueRequest(w.A, { destination }, valid), { params: Promise.resolve({ slug: w.A }) })).status).toBe(400)
    }
    const anonymous = await ISSUE(issueRequest(w.A, { destination: 'site' }, { 'x-wewed-client': 'native' }), { params: Promise.resolve({ slug: w.A }) })
    expect(anonymous.status).toBe(401)
    // Guest B's valid session cannot mint a handoff for wedding A.
    const foreign = await ISSUE(issueRequest(w.A, { destination: 'site' }, { 'x-wewed-client': 'native', cookie: nativeCookie(w.B, g.b, `${g.b}-rsvp-token`) }), { params: Promise.resolve({ slug: w.A }) })
    expect(foreign.status).toBe(401)
    // A body-supplied guest identity is ignored: the server-resolved Guest is always used.
    const spoof = await ISSUE(issueRequest(w.A, { destination: 'site', guestId: g.rotated }, valid), { params: Promise.resolve({ slug: w.A }) })
    const spoofBody = await spoof.json()
    const redeemed = await redeem(w.A, exchangeFrom(spoofBody.path))
    expect(verifyWeddingGuestSessionToken(guestCookieFrom(redeemed)!)?.guestId).toBe(g.a)
    const privateWedding = await issue(w.P, g.p, w.P, 'site')
    expect(privateWedding.status).toBe(403)
  })

  test('issue: the entry path carries the exchange only in its fragment, no token or cookie, short-lived', async () => {
    const res = await issue(w.A, g.a, w.A, 'registry')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0')
    const body = await res.json()
    expect(body.url).toBeUndefined()
    const entry = new URL(body.path, ORIGIN)
    expect(body.path.startsWith(`/guest-handoff/${w.A}#`)).toBe(true)
    expect(entry.pathname).toBe(`/guest-handoff/${w.A}`)
    // Nothing a server, proxy or log would ever see: no query at all.
    expect(entry.search).toBe('')
    const h = exchangeFrom(body.path)
    const decoded = Buffer.from(h.split('.')[0], 'base64url').toString('utf8')
    for (const text of [body.path, decoded]) {
      expect(text).not.toContain(`${g.a}-rsvp-token`)
      expect(text).not.toContain('wewed_wedding_guest')
    }
    const lifetime = new Date(body.expiresAt).getTime() - Date.now()
    expect(lifetime).toBeGreaterThan(0)
    expect(lifetime).toBeLessThanOrEqual(90_000)
  })

  test('redeem: establishes the same Guest browser session and lands only on the allowlisted path', async () => {
    for (const [destination, path] of [['site', `/w/${w.A}?view=site`], ['registry', `/w/${w.A}?view=site#registry`]] as const) {
      const res = await redeem(w.A, exchangeFrom((await (await issue(w.A, g.a, w.A, destination)).json()).path))
      expect(res.status).toBe(200)
      expect(await landing(res)).toBe(path)
      expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0')
      const session = verifyWeddingGuestSessionToken(guestCookieFrom(res)!)
      expect(session?.weddingId).toBe(w.A)
      expect(session?.guestId).toBe(g.a)
      const cookieRow = setCookies(res).find((c) => c.startsWith('wewed_wedding_guest='))!
      expect(cookieRow.toLowerCase()).toContain('httponly')
      expect(setCookies(res).join(';')).not.toContain(`${g.a}-rsvp-token`)
    }
  })

  test('redeem: tampered, expired, cross-wedding, rotated and now-private exchanges fail closed', async () => {
    const gateway = (slug: string) => `/w/${slug}?accessError=handoff`
    const h = exchangeFrom((await (await issue(w.A, g.a, w.A, 'site')).json()).path)

    // Tampered guest inside the signed payload.
    const [payload, signature] = h.split('.')
    const forged = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    forged.g = g.rotated
    const tampered = `${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${signature}`
    const expired = createGuestBrowserHandoffToken({
      weddingId: w.A, guestId: g.a, destination: 'site',
      invitationVersion: invitationVersionFingerprint({ weddingId: w.A, guestId: g.a, rsvpToken: `${g.a}-rsvp-token` }),
    }, Date.now() - 5 * 60_000).token
    const cases: Array<[string, string]> = [
      [w.A, tampered],
      [w.A, 'garbage'],
      [w.A, ''],
      [w.A, expired],
      // A valid exchange for wedding A presented under wedding B's slug.
      [w.B, h],
    ]
    for (const [slug, exchange] of cases) {
      const res = await redeem(slug, exchange)
      expect(res.status).toBe(401)
      expect(await landing(res)).toBe(gateway(slug))
      expect(guestCookieFrom(res)).toBeNull()
    }

    // The invitation is rotated after issue: the outstanding exchange dies with the old link.
    const rotated = exchangeFrom((await (await issue(w.A, g.rotated, w.A, 'site')).json()).path)
    await exec(`UPDATE public."RSVP" SET token = $1 WHERE "guestId" = $2`, `${g.rotated}-rotated`, g.rotated)
    const afterRotation = await redeem(w.A, rotated)
    expect(await landing(afterRotation)).toBe(gateway(w.A))
    expect(guestCookieFrom(afterRotation)).toBeNull()
    await exec(`UPDATE public."RSVP" SET token = $1 WHERE "guestId" = $2`, `${g.rotated}-rsvp-token`, g.rotated)

    // The wedding is made private after issue.
    const beforePrivate = exchangeFrom((await (await issue(w.B, g.b, w.B, 'site')).json()).path)
    await exec(`UPDATE public."Wedding" SET privacy = 'private' WHERE id = $1`, w.B)
    const afterPrivate = await redeem(w.B, beforePrivate)
    expect(await landing(afterPrivate)).toBe(gateway(w.B))
    expect(guestCookieFrom(afterPrivate)).toBeNull()
    await exec(`UPDATE public."Wedding" SET privacy = 'link_only' WHERE id = $1`, w.B)
  })

  test('issue + redeem never mutate RSVP, Guest, Wedding or audit state', async () => {
    const before = await fingerprint([w.A])
    for (const destination of ['site', 'registry']) {
      await redeem(w.A, exchangeFrom((await (await issue(w.A, g.a, w.A, destination)).json()).path))
    }
    expect(await fingerprint([w.A])).toEqual(before)
  })

  test('routes export only the intended methods', async () => {
    const issueModule = await import('@/app/api/weddings/[slug]/guest-browser-handoff/route')
    const redeemModule = await import('@/app/api/weddings/[slug]/guest-browser-handoff/redeem/route')
    expect(Object.keys(issueModule).filter((k) => /^[A-Z]+$/.test(k))).toEqual(['POST'])
    expect(Object.keys(redeemModule).filter((k) => /^[A-Z]+$/.test(k))).toEqual(['POST'])
  })
})
