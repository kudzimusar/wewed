/**
 * QRO05-PIQR01 — Planner Invitations & QR native READ parity, proven against a DISPOSABLE local
 * PostgreSQL migrated with this repository's prisma/migrations, driving the REAL route handlers.
 *
 * Proves the native GETs (`/api/native/wedding/invitations`, `/…/physical`):
 *  - require a valid server-issued native session and a fresh wedding-scoped grant with guests.view;
 *  - refuse another wedding, a revoked grant (including revocation mid-session) and a missing permission;
 *  - are private/no-store;
 *  - return EXACTLY the desktop Planner projection (style, RSVP state, physical QR configuration,
 *    invitation-link authority) — any divergence fails the convergence tests;
 *  - perform no database mutation (no token backfill/rotation, no QR creation, no audit row).
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
  process.env.WEWED_SESSION_SECRET = 'qro05-native-invitations-integration-only'
}

mock.module('server-only', () => ({}))

type Db = typeof import('@/lib/db')['db']
let db: Db
let createNativeAccountSessionToken: typeof import('@/lib/native-account-session')['createNativeAccountSessionToken']
let createAppSessionToken: typeof import('@/lib/app-session')['createAppSessionToken']
let APP_SESSION_COOKIE: typeof import('@/lib/app-session')['APP_SESSION_COOKIE']
let physicalInvitationDestinationId: typeof import('@/lib/physical-invitation-code')['physicalInvitationDestinationId']
let NextRequest: typeof import('next/server')['NextRequest']

const run = randomUUID().slice(0, 8)
const id = (name: string) => `q5-${run}-${name}`
// Per-run printed code so the suite can be re-run against the same disposable database.
const PRINTED_CODE = `QR${run.toUpperCase()}`
const ORIGIN = 'http://localhost'
const exec = (sql: string, ...params: unknown[]) => db.$executeRawUnsafe(sql, ...params)

async function user(name: string, role: string) {
  await exec(`INSERT INTO public."User" (id, email, name, role, "isActive", "updatedAt") VALUES ($1, $2, $3, $4, true, now())`,
    id(name), `${id(name)}@example.test`, name, role)
  return id(name)
}
async function wedding(name: string, style: string, message: string | null) {
  await exec(`INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ($1, $1, 'A', 'B', now())`, id(`couple-${name}`))
  await exec(
    `INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "invitationCardStyle", "invitationCardMessage", "rsvpDeadline", "updatedAt")
     VALUES ($1, $1, $2, now() + interval '90 days', 'Venue', 'City', 'Country', $3, $4, $5, now() + interval '30 days', now())`,
    id(name), `Wedding ${name}`, id(`couple-${name}`), style, message)
  return id(name)
}
async function membership(name: string, userId: string, weddingId: string, role: string, status = 'active', permissions?: string[]) {
  await exec(`INSERT INTO public."WeddingMembership" (id, "userId", "weddingId", role, status, permissions, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, now())`,
    id(name), userId, weddingId, role, status, permissions ? JSON.stringify(permissions) : null)
  return id(name)
}
async function guest(name: string, weddingId: string, attending: boolean | null | 'no-rsvp', table: number | null = null) {
  await exec(`INSERT INTO public."Guest" (id, name, "weddingId", "tableNumber", "updatedAt") VALUES ($1, $2, $3, $4, now())`, id(name), `Guest ${name}`, weddingId, table)
  if (attending !== 'no-rsvp') {
    await db.rSVP.create({ data: { token: `${id(name)}-token`, guestId: id(name), attending } })
  }
  return id(name)
}

async function bearer(path: string, accessUserId: string) {
  const token = createNativeAccountSessionToken({ accessUserId, authUserId: `auth-${accessUserId}`, email: `${accessUserId}@example.test` })
  return new NextRequest(`${ORIGIN}${path}`, { headers: { authorization: `Bearer ${token}` } })
}
function cookie(path: string, userId: string, weddingId: string) {
  const token = createAppSessionToken({ userId, authUserId: `auth-${userId}`, email: `${userId}@example.test`, role: 'planner', coupleId: null, activeWeddingId: weddingId })
  return new NextRequest(`${ORIGIN}${path}`, { headers: { cookie: `${APP_SESSION_COOKIE}=${token}` } })
}

async function mutationFingerprint(weddingIds: string[]) {
  const rows = await db.$queryRawUnsafe<Array<{ k: string; v: string }>>(
    `SELECT 'rsvp' k, coalesce(string_agg(r.id || ':' || r.token || ':' || r."updatedAt"::text, ',' ORDER BY r.id), '') v
       FROM public."RSVP" r JOIN public."Guest" g ON g.id = r."guestId" WHERE g."weddingId" = ANY($1)
     UNION ALL SELECT 'guest', coalesce(string_agg(id || ':' || "updatedAt"::text, ',' ORDER BY id), '') FROM public."Guest" WHERE "weddingId" = ANY($1)
     UNION ALL SELECT 'wedding', coalesce(string_agg(id || ':' || "updatedAt"::text || ':' || coalesce("invitationCardStyle", ''), ',' ORDER BY id), '') FROM public."Wedding" WHERE id = ANY($1)
     UNION ALL SELECT 'qr', coalesce(string_agg(id || ':' || "scanCount" || ':' || "updatedAt"::text, ',' ORDER BY id), '') FROM public."QRDestination" WHERE "weddingId" = ANY($1)
     UNION ALL SELECT 'content', coalesce(string_agg(id || ':' || value, ',' ORDER BY id), '') FROM public."WeddingContent" WHERE "weddingId" = ANY($1)
     UNION ALL SELECT 'audit', count(*)::text FROM public."AuditEvent" WHERE "weddingId" = ANY($1)`,
    weddingIds,
  )
  return Object.fromEntries(rows.map((r) => [r.k, r.v]))
}

const describeLocal = isLocal ? describe : describe.skip

describeLocal('QRO05-PIQR01 native Invitations & QR read parity', () => {
  let GET_NATIVE: typeof import('@/app/api/native/wedding/invitations/route')['GET']
  let GET_NATIVE_PHYSICAL: typeof import('@/app/api/native/wedding/invitations/physical/route')['GET']
  let GET_DESKTOP: typeof import('@/app/api/planner/guests/invitations/route')['GET']
  let GET_DESKTOP_PHYSICAL: typeof import('@/app/api/planner/guests/invitations/physical/route')['GET']
  const ids: Record<string, string> = {}
  const actors: Record<string, string> = {}
  const gid = (weddingId: string) => `planner:wedding:${weddingId}`

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({ createNativeAccountSessionToken } = await import('@/lib/native-account-session'))
    ;({ createAppSessionToken, APP_SESSION_COOKIE } = await import('@/lib/app-session'))
    ;({ physicalInvitationDestinationId } = await import('@/lib/physical-invitation-code'))
    ;({ NextRequest } = await import('next/server'))
    ;({ GET: GET_NATIVE } = await import('@/app/api/native/wedding/invitations/route'))
    ;({ GET: GET_NATIVE_PHYSICAL } = await import('@/app/api/native/wedding/invitations/physical/route'))
    ;({ GET: GET_DESKTOP } = await import('@/app/api/planner/guests/invitations/route'))
    ;({ GET: GET_DESKTOP_PHYSICAL } = await import('@/app/api/planner/guests/invitations/physical/route'))

    ids.A = await wedding('A', 'ivory-floral-gold', 'With love from us')
    ids.B = await wedding('B', 'botanical', null)
    ids.C = await wedding('C', 'botanical', null)
    await exec(`INSERT INTO public."WeddingContent" (id, "weddingId", section, field, value, "updatedAt") VALUES ($1, $2, 'rsvp', 'childrenPolicy', 'adults_only', now())`, id('children-A'), ids.A)
    ids.pending = await guest('pending', ids.A, null, 3)
    ids.attending = await guest('attending', ids.A, true, 4)
    ids.declined = await guest('declined', ids.A, false)
    ids.noToken = await guest('no-token', ids.A, 'no-rsvp')
    await guest('b-guest', ids.B, null)
    await exec(`INSERT INTO public."QRDestination" (id, label, url, type, "scanCount", "isActive", "weddingId", "updatedAt")
                VALUES ($1, 'Printed invitation', $3, 'physical_invitation', 7, true, $2, now())`,
      physicalInvitationDestinationId(PRINTED_CODE), ids.A, `https://wewed.pro/i/${PRINTED_CODE}`)

    actors.planner = await user('planner', 'planner')
    await membership('planner-A', actors.planner, ids.A, 'planner')
    await membership('planner-C', actors.planner, ids.C, 'planner')
    actors.plannerB = await user('planner-b', 'planner')
    await membership('planner-B', actors.plannerB, ids.B, 'planner')
    actors.revoked = await user('revoked', 'planner')
    await membership('revoked-A', actors.revoked, ids.A, 'planner', 'revoked')
    actors.noGuestView = await user('no-guest-view', 'planner')
    await membership('no-guest-view-A', actors.noGuestView, ids.A, 'coordinator', 'active', ['planner.view'])
    actors.later = await user('later-revoked', 'planner')
    await membership('later-A', actors.later, ids.A, 'planner')
  })
  afterAll(async () => { await db?.$disconnect() })

  test('native and desktop return the identical canonical invitation projection', async () => {
    const native = await GET_NATIVE(await bearer(`/api/native/wedding/invitations?grantId=${gid(ids.A)}`, actors.planner))
    const desktop = await GET_DESKTOP(cookie('/api/planner/guests/invitations', actors.planner, ids.A))
    expect(native.status).toBe(200)
    expect(desktop.status).toBe(200)
    const n = await native.json(), d = await desktop.json()
    expect(n).toEqual(d)
    // Style, RSVP state and invitation-link authority — the fields a divergence would corrupt.
    expect(n.wedding.invitationCardStyle).toBe('ivory-floral-gold')
    expect(n.wedding.invitationCardMessage).toBe('With love from us')
    expect(n.wedding.childrenPolicy).toBe('adults_only')
    const byId = Object.fromEntries(n.data.map((row: { id: string }) => [row.id, row]))
    expect(byId[ids.pending].status).toBe('pending')
    expect(byId[ids.attending].status).toBe('attending')
    expect(byId[ids.declined].status).toBe('declined')
    expect(byId[ids.pending].tableNumber).toBe(3)
    expect(n.missingTokens).toBe(1)
    expect(byId[ids.noToken].invitationUrl).toBeNull()
    expect(byId[ids.noToken].qrValue).toBeNull()
    expect(byId[ids.noToken].shareMessage).toBeNull()
    for (const key of ['pending', 'attending', 'declined']) {
      const row = byId[ids[key]]
      expect(row.invitationUrl.startsWith(`${ORIGIN}/`)).toBe(true)
      expect(row.invitationUrl).toContain(encodeURIComponent(`${id(key)}-token`))
      expect(row.qrValue).toBe(row.invitationUrl)
      expect(row.shareMessage).toContain(row.invitationUrl)
    }
    expect(n.data.map((row: { id: string }) => row.id)).not.toContain(id('b-guest'))
  })

  test('native and desktop return the identical Printed Invitation Access projection', async () => {
    const native = await GET_NATIVE_PHYSICAL(await bearer(`/api/native/wedding/invitations/physical?grantId=${gid(ids.A)}`, actors.planner))
    const desktop = await GET_DESKTOP_PHYSICAL(cookie('/api/planner/guests/invitations/physical', actors.planner, ids.A))
    const n = await native.json(), d = await desktop.json()
    expect(n).toEqual(d)
    expect(n.configured).toBe(true)
    expect(n.accessUrl).toBe(`https://wewed.pro/i/${PRINTED_CODE}`)
    expect(n.scanCount).toBe(7)
    expect(n.invitedCount).toBe(4)
    // A wedding with no active physical destination is reported unconfigured, identically.
    const nc = await (await GET_NATIVE_PHYSICAL(await bearer(`/api/native/wedding/invitations/physical?grantId=${gid(ids.C)}`, actors.planner))).json()
    const dc = await (await GET_DESKTOP_PHYSICAL(cookie('/api/planner/guests/invitations/physical', actors.planner, ids.C))).json()
    expect(nc).toEqual(dc)
    expect(nc.configured).toBe(false)
    expect(nc.accessUrl).toBeNull()
  })

  test('native responses are private and never cacheable', async () => {
    for (const res of [
      await GET_NATIVE(await bearer(`/api/native/wedding/invitations?grantId=${gid(ids.A)}`, actors.planner)),
      await GET_NATIVE_PHYSICAL(await bearer(`/api/native/wedding/invitations/physical?grantId=${gid(ids.A)}`, actors.planner)),
    ]) {
      expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0')
      expect(res.headers.get('vary')).toBe('Authorization')
    }
  })

  test('authority: no session, another wedding, revoked grant and missing guests.view are refused', async () => {
    const anonymous = await GET_NATIVE(new NextRequest(`${ORIGIN}/api/native/wedding/invitations?grantId=${gid(ids.A)}`))
    expect(anonymous.status).toBe(401)
    const foreign = await GET_NATIVE(await bearer(`/api/native/wedding/invitations?grantId=${gid(ids.B)}`, actors.planner))
    expect(foreign.status).toBe(403)
    expect((await foreign.json()).code).toBe('GRANT_REVOKED')
    const revoked = await GET_NATIVE_PHYSICAL(await bearer(`/api/native/wedding/invitations/physical?grantId=${gid(ids.A)}`, actors.revoked))
    expect(revoked.status).toBe(403)
    const noPermission = await GET_NATIVE(await bearer(`/api/native/wedding/invitations?grantId=coordinator:wedding:${ids.A}`, actors.noGuestView))
    expect([403]).toContain(noPermission.status)
    const noPermissionBody = await noPermission.json()
    expect(['PERMISSION_DENIED', 'GRANT_REVOKED']).toContain(noPermissionBody.code)
    expect(JSON.stringify(noPermissionBody)).not.toContain('-token')
    const missingGrant = await GET_NATIVE(await bearer('/api/native/wedding/invitations', actors.planner))
    expect(missingGrant.status).toBeGreaterThanOrEqual(400)
  })

  test('a grant revoked mid-session loses access on the very next request', async () => {
    const path = `/api/native/wedding/invitations?grantId=${gid(ids.A)}`
    expect((await GET_NATIVE(await bearer(path, actors.later))).status).toBe(200)
    await exec(`UPDATE public."WeddingMembership" SET status = 'revoked', "updatedAt" = now() WHERE id = $1`, id('later-A'))
    const after = await GET_NATIVE(await bearer(path, actors.later))
    expect(after.status).toBe(403)
    expect(JSON.stringify(await after.json())).not.toContain('-token')
  })

  test('native invitation reads perform no database mutation', async () => {
    const before = await mutationFingerprint([ids.A, ids.B, ids.C])
    for (let i = 0; i < 3; i += 1) {
      await GET_NATIVE(await bearer(`/api/native/wedding/invitations?grantId=${gid(ids.A)}`, actors.planner))
      await GET_NATIVE_PHYSICAL(await bearer(`/api/native/wedding/invitations/physical?grantId=${gid(ids.A)}`, actors.planner))
      await GET_NATIVE_PHYSICAL(await bearer(`/api/native/wedding/invitations/physical?grantId=${gid(ids.C)}`, actors.planner))
    }
    expect(await mutationFingerprint([ids.A, ids.B, ids.C])).toEqual(before)
    const stillMissing = await db.rSVP.count({ where: { guestId: ids.noToken } })
    expect(stillMissing).toBe(0)
  })

  test('native invitation writes are exactly the QRO08 twins; printed access stays read-only', async () => {
    const writes = (mod: Record<string, unknown>) =>
      Object.keys(mod).filter((key) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(key)).sort()
    const native = await import('@/app/api/native/wedding/invitations/route')
    const physical = await import('@/app/api/native/wedding/invitations/physical/route')
    const delivery = await import('@/app/api/native/wedding/invitations/delivery/route')
    // QRO08: repair missing links (POST) and rotate one link (PATCH) — the desktop twins; no PUT
    // (card settings stay a desktop/Couple Studio action).
    expect(writes(native as Record<string, unknown>)).toEqual(['PATCH', 'POST'])
    expect(writes(delivery as Record<string, unknown>)).toEqual(['DELETE', 'POST'])
    // The shared printed-invitation QR is never created or changed from native.
    expect(writes(physical as Record<string, unknown>)).toEqual([])
  })
})
