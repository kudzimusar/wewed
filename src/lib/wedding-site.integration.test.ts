/**
 * QRO07-SHIP01 — wedding-website authority, proven against a DISPOSABLE local PostgreSQL migrated
 * with this repository's prisma/migrations, driving the REAL route handlers.
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
  process.env.WEWED_SESSION_SECRET = 'qro07-wedding-site-integration-only'
}

mock.module('server-only', () => ({}))

type Db = typeof import('@/lib/db')['db']
let db: Db
let NextRequest: typeof import('next/server')['NextRequest']
let createAppSessionToken: typeof import('@/lib/app-session')['createAppSessionToken']
let APP_SESSION_COOKIE: string
let loadWeddingDataBySlug: typeof import('@/lib/wedding-data-server')['loadWeddingDataBySlug']
let site: typeof import('@/lib/wedding-site/server')

const run = randomUUID().slice(0, 8)
const id = (name: string) => `q7-${run}-${name}`
const ORIGIN = 'http://localhost'
const exec = (sql: string, ...params: unknown[]) => db.$executeRawUnsafe(sql, ...params)

async function wedding(name: string) {
  await exec(`INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ($1, $1, 'Ada', 'Ben', now())`, id(`couple-${name}`))
  await exec(
    `INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", tagline, "updatedAt")
     VALUES ($1, $1, 'Ada & Ben', '2027-03-06T14:00:00Z', 'Real Venue', 'Harare', 'Zimbabwe', $2, 'Real tagline', now())`,
    id(name), id(`couple-${name}`))
  return id(name)
}
async function member(name: string, weddingId: string, role: string, permissions?: string[]) {
  await exec(`INSERT INTO public."User" (id, email, name, role, "isActive", "updatedAt") VALUES ($1, $2, $1, 'planner', true, now())`, id(name), `${id(name)}@example.test`)
  await exec(`INSERT INTO public."WeddingMembership" (id, "userId", "weddingId", role, status, permissions, "updatedAt") VALUES ($1, $2, $3, $4, 'active', $5, now())`,
    id(`m-${name}`), id(name), weddingId, role, permissions ? JSON.stringify(permissions) : null)
  return id(name)
}
function req(method: string, path: string, userId: string | null, weddingId: string | null, body?: unknown) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (userId && weddingId) {
    const token = createAppSessionToken({ userId, authUserId: `auth-${userId}`, email: `${userId}@example.test`, role: 'planner', coupleId: null, activeWeddingId: weddingId })
    headers.cookie = `${APP_SESSION_COOKIE}=${token}`
  }
  return new NextRequest(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
}
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) })

const describeLocal = isLocal ? describe : describe.skip

describeLocal('QRO07 wedding-website authority', () => {
  const w: Record<string, string> = {}
  const u: Record<string, string> = {}

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({ NextRequest } = await import('next/server'))
    const appSession = await import('@/lib/app-session')
    createAppSessionToken = appSession.createAppSessionToken
    APP_SESSION_COOKIE = appSession.APP_SESSION_COOKIE
    ;({ loadWeddingDataBySlug } = await import('@/lib/wedding-data-server'))
    site = await import('@/lib/wedding-site/server')

    w.A = await wedding('A')
    w.B = await wedding('B')
    u.planner = await member('planner', w.A, 'planner')
    u.coordinator = await member('coordinator', w.A, 'coordinator')
    u.plannerB = await member('planner-b', w.B, 'planner')

    // Private and legacy rows that must never reach Guests.
    for (const [section, field, value] of [
      ['team_invite', 'deadbeef', 'invitee@example.test'],
      ['ai_document', 'doc-1', 'private planner notes'],
      ['planner_worksheet_order', 'guests', '["x"]'],
      ['rsvp', 'childrenPolicy', 'adults_only'],
      ['hero', 'brideName', 'Stale Seeded Name'],
      ['hero', 'venue', 'Stale Seeded Venue'],
      ['theday', 'venueName', 'Stale Day Venue'],
      ['story', 'milestone-0', 'Example: we met'],
      ['faq', 'item-0', 'Example question?'],
      ['story', 'heading', 'Our Story'],
    ] as const) {
      await exec(`INSERT INTO public."WeddingContent" (id, "weddingId", section, field, value, metadata, "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, now())`,
        id(`c-${section}-${field}`), w.A, section, field, value, field.startsWith('item-') ? JSON.stringify({ answer: 'Example answer' }) : null)
    }
  })
  afterAll(async () => { await db?.$disconnect() })

  test('the public projection is an allowlist: no private sections, no core-fact duplicates, no legacy ordered rows', async () => {
    const data = (await loadWeddingDataBySlug(w.A))!
    const serialized = JSON.stringify(data)
    for (const leaked of ['invitee@example.test', 'private planner notes', 'adults_only', 'Stale Seeded Name', 'Stale Seeded Venue', 'Stale Day Venue', 'Example: we met', 'Example question?']) {
      expect(serialized).not.toContain(leaked)
    }
    expect(Object.keys(data.content).sort()).toEqual(['story'])
    expect(data.content.story).toEqual({ heading: 'Our Story' })
    expect(data.ordered).toEqual({})
    // Core facts come from Couple/Wedding.
    expect(data.wedding.couple.partner1).toBe('Ada')
    expect(data.wedding.venue).toBe('Real Venue')
    expect(data.site.items).toEqual({})
    expect(data.announcements).toEqual([])
  })

  test('legacy ordered content is backfilled as UNPUBLISHED items, idempotently', async () => {
    expect((await site.backfillLegacySiteItems(w.A)).created).toBe(2)
    expect((await site.backfillLegacySiteItems(w.A)).created).toBe(0)
    const items = await db.weddingSiteItem.findMany({ where: { weddingId: w.A } })
    expect(items.map((item) => [item.kind, item.enabled]).sort()).toEqual([['faq_item', false], ['story_milestone', false]])
    expect(items.find((item) => item.kind === 'faq_item')?.body).toBe('Example answer')
    expect((await loadWeddingDataBySlug(w.A))!.site.items).toEqual({})
  })

  test('legacy import route: editor-only, idempotent, and never publishes', async () => {
    const { POST } = await import('@/app/api/weddings/[slug]/site/import-legacy/route')
    const call = (userId: string | null, weddingId: string | null) =>
      POST(req('POST', `/api/weddings/${w.A}/site/import-legacy`, userId, weddingId), params({ slug: w.A }))
    expect((await call(null, null)).status).toBe(401)
    expect((await call(u.coordinator, w.A)).status).toBe(403)
    expect((await call(u.plannerB, w.B)).status).toBe(403)
    const ok = await call(u.planner, w.A)
    expect(ok.status).toBe(200)
    expect((await ok.json()).data.created).toBe(0) // already imported above
    expect((await loadWeddingDataBySlug(w.A))!.site.items).toEqual({})
  })

  test('editor routes: content.edit on THIS wedding only; coordinator and other weddings refused', async () => {
    const { GET } = await import('@/app/api/weddings/[slug]/site/route')
    expect((await GET(req('GET', `/api/weddings/${w.A}/site`, null, null), params({ slug: w.A }))).status).toBe(401)
    expect((await GET(req('GET', `/api/weddings/${w.A}/site`, u.coordinator, w.A), params({ slug: w.A }))).status).toBe(403)
    expect((await GET(req('GET', `/api/weddings/${w.A}/site`, u.plannerB, w.B), params({ slug: w.A }))).status).toBe(403)
    const ok = await GET(req('GET', `/api/weddings/${w.A}/site`, u.planner, w.A), params({ slug: w.A }))
    expect(ok.status).toBe(200)
    const body = await ok.json()
    expect(body.data.items.length).toBe(2)
    expect(body.data.core.partner1).toBe('Ada')
    expect(JSON.stringify(body.data.scalars)).not.toContain('invitee@example.test')
  })

  test('items: create unpublished, publish, media must belong to the wedding, reorder validated, conflicts detected', async () => {
    const { POST } = await import('@/app/api/weddings/[slug]/site/items/route')
    const { PATCH, DELETE } = await import('@/app/api/weddings/[slug]/site/items/[itemId]/route')
    const { POST: REORDER } = await import('@/app/api/weddings/[slug]/site/items/reorder/route')
    await exec(`INSERT INTO public."MediaItem" (id, type, url, "weddingId", "updatedAt") VALUES ($1, 'photo', 'https://img.example/b.jpg', $2, now())`, id('media-b'), w.B)
    await exec(`INSERT INTO public."MediaItem" (id, type, url, "weddingId", "updatedAt") VALUES ($1, 'photo', 'https://img.example/a.jpg', $2, now())`, id('media-a'), w.A)

    const foreignMedia = await POST(req('POST', `/api/weddings/${w.A}/site/items`, u.planner, w.A, { kind: 'faq_item', title: 'Q', mediaId: id('media-b') }), params({ slug: w.A }))
    expect(foreignMedia.status).toBe(400)
    const created = await (await POST(req('POST', `/api/weddings/${w.A}/site/items`, u.planner, w.A, { kind: 'faq_item', title: 'Is there parking?', body: 'Yes, on site.' }), params({ slug: w.A }))).json()
    expect(created.data.enabled).toBe(false)
    expect((await loadWeddingDataBySlug(w.A))!.site.items.faq ?? []).toHaveLength(0)

    const published = await (await PATCH(req('PATCH', '/x', u.planner, w.A, { enabled: true, mediaId: id('media-a'), expectedUpdatedAt: created.data.updatedAt }), params({ slug: w.A, itemId: created.data.id }))).json()
    expect(published.data.enabled).toBe(true)
    const faq = (await loadWeddingDataBySlug(w.A))!.site.items.faq!
    expect(faq.map((item) => item.title)).toEqual(['Is there parking?'])
    expect(faq[0].media?.url).toBe('https://img.example/a.jpg')

    const stale = await PATCH(req('PATCH', '/x', u.planner, w.A, { title: 'Stale', expectedUpdatedAt: created.data.updatedAt }), params({ slug: w.A, itemId: created.data.id }))
    expect(stale.status).toBe(409)
    // Another wedding's planner cannot touch it even by id.
    expect((await PATCH(req('PATCH', '/x', u.plannerB, w.B, { title: 'x' }), params({ slug: w.B, itemId: created.data.id }))).status).toBe(400)

    const all = await db.weddingSiteItem.findMany({ where: { weddingId: w.A, kind: 'faq_item' }, orderBy: { order: 'asc' } })
    expect((await REORDER(req('POST', '/x', u.planner, w.A, { section: 'faq', ids: [all[0].id] }), params({ slug: w.A }))).status).toBe(400)
    expect((await REORDER(req('POST', '/x', u.planner, w.A, { section: 'faq', ids: all.map((i) => i.id).reverse() }), params({ slug: w.A }))).status).toBe(200)

    expect((await DELETE(req('DELETE', '/x', u.planner, w.A), params({ slug: w.A, itemId: created.data.id }))).status).toBe(200)
    expect((await loadWeddingDataBySlug(w.A))!.site.items.faq ?? []).toHaveLength(0)
  })

  test('disabling a section hides its published items from Guests', async () => {
    const item = await site.createItem(w.A, { kind: 'story_milestone', title: 'We met', enabled: true })
    expect((await loadWeddingDataBySlug(w.A))!.site.items.story?.map((i) => i.id)).toContain(item.id)
    await site.updateSections(w.A, [{ key: 'story', enabled: false }])
    expect((await loadWeddingDataBySlug(w.A))!.site.items.story).toBeUndefined()
    expect((await loadWeddingDataBySlug(w.A))!.site.sections.find((s) => s.key === 'story')?.enabled).toBe(false)
    await site.updateSections(w.A, [{ key: 'story', enabled: true }])
  })

  test('site copy: draft is private, publish materializes, stale publish conflicts, unpublish keeps a draft', async () => {
    const { POST } = await import('@/app/api/weddings/[slug]/site/copy/route')
    const call = (body: unknown) => POST(req('POST', '/x', u.planner, w.A, body), params({ slug: w.A }))
    expect((await call({ action: 'publish', section: 'team_invite', field: 'x', value: 'y' })).status).toBe(400)
    expect((await call({ action: 'publish', section: 'hero', field: 'brideName', value: 'y' })).status).toBe(400)

    expect((await call({ action: 'draft', section: 'venue', field: 'description', value: 'Draft only' })).status).toBe(200)
    expect((await loadWeddingDataBySlug(w.A))!.content.venue).toBeUndefined()

    const first = await (await call({ action: 'publish', section: 'venue', field: 'description', value: 'A garden venue.', expectedUpdatedAt: null })).json()
    expect((await loadWeddingDataBySlug(w.A))!.content.venue?.description).toBe('A garden venue.')
    expect((await call({ action: 'publish', section: 'venue', field: 'description', value: 'Other tab', expectedUpdatedAt: null })).status).toBe(409)
    await call({ action: 'publish', section: 'venue', field: 'description', value: 'A walled garden venue.', expectedUpdatedAt: first.data.updatedAt })
    expect((await loadWeddingDataBySlug(w.A))!.content.venue?.description).toBe('A walled garden venue.')

    await call({ action: 'unpublish', section: 'venue', field: 'description' })
    expect((await loadWeddingDataBySlug(w.A))!.content.venue).toBeUndefined()
    const drafts = await db.contentRevision.findMany({ where: { weddingId: w.A, section: 'venue', fieldKey: 'description', status: 'draft' } })
    expect(drafts.map((d) => d.value)).toContain('A walled garden venue.')
  })

  test('/api/content revisions: wedding-scoped content.edit; publish and restore change the same projection', async () => {
    const { POST } = await import('@/app/api/content/route')
    const { PATCH } = await import('@/app/api/content/[id]/route')
    const { POST: RESTORE } = await import('@/app/api/content/[id]/restore/route')
    const draft = await (await POST(req('POST', '/api/content', u.planner, w.A, { section: 'faq', fieldKey: 'heading', value: 'Questions', status: 'draft', weddingId: w.A }))).json()
    expect((await loadWeddingDataBySlug(w.A))!.content.faq).toBeUndefined()

    // Another wedding's planner, and a coordinator without content.edit, cannot publish it.
    expect((await PATCH(req('PATCH', '/x', u.plannerB, w.B, { status: 'published' }), params({ id: draft.data.id }))).status).toBe(404)
    expect((await PATCH(req('PATCH', '/x', u.coordinator, w.A, { status: 'published' }), params({ id: draft.data.id }))).status).toBe(403)

    expect((await PATCH(req('PATCH', '/x', u.planner, w.A, { status: 'published' }), params({ id: draft.data.id }))).status).toBe(200)
    expect((await loadWeddingDataBySlug(w.A))!.content.faq?.heading).toBe('Questions')

    await POST(req('POST', '/api/content', u.planner, w.A, { section: 'faq', fieldKey: 'heading', value: 'Your Questions', status: 'published', weddingId: w.A }))
    expect((await loadWeddingDataBySlug(w.A))!.content.faq?.heading).toBe('Your Questions')

    expect((await RESTORE(req('POST', '/x', u.planner, w.A, { status: 'published' }), params({ id: draft.data.id }))).status).toBe(201)
    expect((await loadWeddingDataBySlug(w.A))!.content.faq?.heading).toBe('Questions')
  })

  test('announcements: only published, unexpired, guest-audience ones reach the public site', async () => {
    const { POST } = await import('@/app/api/weddings/[slug]/announcements/route')
    const { PATCH } = await import('@/app/api/weddings/[slug]/announcements/[announcementId]/route')
    const draft = await (await POST(req('POST', '/x', u.planner, w.A, { title: 'Parking', body: 'Use gate 2.' }), params({ slug: w.A }))).json()
    expect((await loadWeddingDataBySlug(w.A))!.announcements).toEqual([])
    await PATCH(req('PATCH', '/x', u.planner, w.A, { status: 'published' }), params({ slug: w.A, announcementId: draft.data.id }))
    expect((await loadWeddingDataBySlug(w.A))!.announcements.map((a) => a.title)).toEqual(['Parking'])
    await POST(req('POST', '/x', u.planner, w.A, { title: 'Attending only', body: 'Shuttle times.', audience: 'attending', status: 'published' }), params({ slug: w.A }))
    await POST(req('POST', '/x', u.planner, w.A, { title: 'Expired', body: 'Old.', status: 'published', expiresAt: '2020-01-01T00:00:00Z' }), params({ slug: w.A }))
    expect((await loadWeddingDataBySlug(w.A))!.announcements.map((a) => a.title)).toEqual(['Parking'])
    const attending = await site.loadPublishedAnnouncements(w.A, { includeAttendingOnly: true })
    expect(attending.map((a) => a.title).sort()).toEqual(['Attending only', 'Parking'])
    expect(await site.loadPublishedAnnouncements(w.B, { includeAttendingOnly: true })).toEqual([])
  })

  test('core facts are edited at Couple/Wedding and render identically; stale edits conflict', async () => {
    const { PATCH } = await import('@/app/api/weddings/[slug]/site/core/route')
    const before = await site.loadEditorSite(w.A)
    const res = await PATCH(req('PATCH', '/x', u.planner, w.A, { partner1: 'Adaeze', venue: 'Walled Garden', expectedWeddingUpdatedAt: before.core.weddingUpdatedAt, expectedCoupleUpdatedAt: before.core.coupleUpdatedAt }), params({ slug: w.A }))
    expect(res.status).toBe(200)
    const data = (await loadWeddingDataBySlug(w.A))!
    expect(data.wedding.couple.partner1).toBe('Adaeze')
    expect(data.wedding.venue).toBe('Walled Garden')
    expect((await PATCH(req('PATCH', '/x', u.planner, w.A, { venue: 'x', expectedWeddingUpdatedAt: before.core.weddingUpdatedAt }), params({ slug: w.A }))).status).toBe(409)
  })

  test('POST /api/wedding-content accepts only public site copy and publishes it', async () => {
    const { POST } = await import('@/app/api/wedding-content/route')
    expect((await POST(req('POST', '/api/wedding-content', u.planner, w.A, { slug: w.A, section: 'team_invite', field: 'x', value: 'y' }))).status).toBe(400)
    expect((await POST(req('POST', '/api/wedding-content', u.planner, w.A, { slug: w.A, section: 'travel', field: 'heading', value: 'Getting Here' }))).status).toBe(200)
    expect((await loadWeddingDataBySlug(w.A))!.content.travel?.heading).toBe('Getting Here')
  })
})
