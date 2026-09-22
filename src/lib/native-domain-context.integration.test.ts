/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 8 §22 — native domain adapters
 * (Planner/Couple/Coordinator wedding-scoped domains, Vendor business-scoped domains, Admin
 * system overview) proven against a DISPOSABLE local PostgreSQL migrated with this repository's
 * own prisma/migrations, driving the REAL route handlers end to end.
 *
 * Never production: refuses to run unless AUTHORITY_TEST_DATABASE_URL points at localhost/127.0.0.1.
 *
 *   AUTHORITY_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/wewed_phase8_disposable \
 *     bun test src/lib/native-domain-context.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  process.env.WEWED_SESSION_SECRET = 'phase8-native-domain-integration-only'
}
mock.module('server-only', () => ({}))

type Db = typeof import('@/lib/db')['db']
let db: Db
let createNativeAccountSessionToken: typeof import('@/lib/native-account-session')['createNativeAccountSessionToken']
let createAppSessionToken: typeof import('@/lib/app-session')['createAppSessionToken']
let APP_SESSION_COOKIE: typeof import('@/lib/app-session')['APP_SESSION_COOKIE']
let NextRequest: typeof import('next/server')['NextRequest']

const run = randomUUID().slice(0, 8)
const id = (name: string) => `p8-${run}-${name}`

async function exec(sql: string, ...params: unknown[]) {
  await db.$executeRawUnsafe(sql, ...params)
}

async function user(name: string, role: string) {
  await exec(
    `INSERT INTO public."User" (id, email, name, role, "isActive", "updatedAt") VALUES ($1, $2, $3, $4, true, now())`,
    id(name), `${id(name)}@example.test`, name, role,
  )
  return id(name)
}

async function couple(name: string) {
  await exec(
    `INSERT INTO public."Couple" (id, slug, partner1, partner2, "updatedAt") VALUES ($1, $1, 'A', 'B', now())`,
    id(name),
  )
  return id(name)
}

async function wedding(name: string, coupleId: string) {
  await exec(
    `INSERT INTO public."Wedding" (id, slug, title, date, venue, "venueCity", "venueCountry", "coupleId", "updatedAt")
     VALUES ($1, $1, $2, now() + interval '90 days', 'Venue', 'City', 'Country', $3, now())`,
    id(name), `Wedding ${name}`, coupleId,
  )
  return id(name)
}

async function membership(name: string, userId: string, weddingId: string, role: string, status = 'active') {
  await exec(
    `INSERT INTO public."WeddingMembership" (id, "userId", "weddingId", role, status, "updatedAt")
     VALUES ($1, $2, $3, $4, $5, now())`,
    id(name), userId, weddingId, role, status,
  )
  return id(name)
}

async function business(name: string, type: string, owner: { userId: string; role: string; status?: string }, opts: { status?: string; onboardingStatus?: string } = {}) {
  await db.$transaction([
    db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."BusinessAccount" (id, name, slug, type, status, "ownerUserId", "onboardingStatus", "subscriptionStatus")
       VALUES ($1, $2, $1, $3, $4, $5, $6, 'free')`,
      id(name), `Business ${name}`, type, opts.status ?? 'active', owner.userId, opts.onboardingStatus ?? 'complete',
    ),
    db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."BusinessAccountMember" (id, "businessAccountId", "userId", role, status, permissions)
       VALUES ($1, $2, $3, $4, $5, '[]'::jsonb)`,
      id(`${name}-owner`), id(name), owner.userId, owner.role, owner.status ?? 'active',
    ),
  ])
  return id(name)
}

async function task(name: string, weddingId: string, status = 'todo') {
  await exec(
    `INSERT INTO public."PlannerTask" (id, title, category, status, priority, "order", "weddingId", "updatedAt")
     VALUES ($1, $2, 'other', $3, 'medium', 0, $4, now())`,
    id(name), `Task ${name}`, status, weddingId,
  )
  return id(name)
}

async function budgetItem(name: string, weddingId: string) {
  await exec(
    `INSERT INTO public."BudgetItem" (id, category, description, "estimatedCost", "paidAmount", currency, "weddingId", "updatedAt")
     VALUES ($1, 'venue', $2, 1000, 200, 'USD', $3, now())`,
    id(name), `Budget ${name}`, weddingId,
  )
  return id(name)
}

async function guest(name: string, weddingId: string) {
  await exec(
    `INSERT INTO public."Guest" (id, name, "weddingId", "updatedAt") VALUES ($1, $2, $3, now())`,
    id(name), `Guest ${name}`, weddingId,
  )
  return id(name)
}

async function seatingTable(name: string, weddingId: string) {
  await exec(
    `INSERT INTO public."SeatingTable" (id, name, "weddingId", "updatedAt") VALUES ($1, $2, $3, now())`,
    id(name), `Table ${name}`, weddingId,
  )
  return id(name)
}

async function programmeItem(name: string, weddingId: string) {
  await exec(
    `INSERT INTO public."ProgrammeItem" (id, time, title, "order", "weddingId", "updatedAt")
     VALUES ($1, '14:00', $2, 0, $3, now())`,
    id(name), `Programme ${name}`, weddingId,
  )
  return id(name)
}

async function vendorRow(name: string, weddingId: string) {
  await exec(
    `INSERT INTO public."Vendor" (id, name, category, "weddingId", "updatedAt") VALUES ($1, $2, 'photography', $3, now())`,
    id(name), `Vendor ${name}`, weddingId,
  )
  return id(name)
}

async function providerProfile(name: string, businessAccountId: string) {
  await exec(
    `INSERT INTO wewed_admin."ProviderProfile" (id, "businessAccountId", slug, "displayName", "listingStatus", visibility, "isClaimable")
     VALUES ($1, $2, $1, $3, 'verified', 'published', false)`,
    id(name), businessAccountId, `Profile ${name}`,
  )
}

async function contributor(name: string, weddingId: string) {
  await exec(
    `INSERT INTO wewed_contributions.contributors (id, wedding_id, display_name, kind) VALUES ($1, $2, $3, 'individual')`,
    id(name), weddingId, `Contributor ${name}`,
  )
  return id(name)
}

async function contribution(name: string, weddingId: string, contributorId: string) {
  await exec(
    `INSERT INTO wewed_contributions.wedding_contributions
       (id, wedding_id, contributor_id, type, title, amount, currency, route, commitment_state, fulfillment_state)
     VALUES ($1, $2, $3, 'CASH_TO_COUPLE', $4, 500, 'USD', 'PUBLIC', 'CONFIRMED', 'RECEIVED')`,
    id(name), weddingId, contributorId, `Contribution ${name}`,
  )
  return id(name)
}

async function bearerRequest(url: string, accessUserId: string, authUserId: string, init: RequestInit = {}) {
  const token = createNativeAccountSessionToken({ accessUserId, authUserId, email: `${accessUserId}@example.test` })
  return new NextRequest(url, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` },
  })
}

async function cookieRequest(
  url: string,
  userId: string,
  weddingId: string,
  role: 'couple' | 'planner' | 'vendor' | 'admin',
  init: RequestInit = {},
) {
  const token = createAppSessionToken({
    userId, authUserId: `auth-${userId}`, email: `${userId}@example.test`, role, coupleId: null, activeWeddingId: weddingId,
  })
  return new NextRequest(url, {
    ...init,
    headers: { ...(init.headers ?? {}), cookie: `${APP_SESSION_COOKIE}=${token}` },
  })
}

const describeLocal = isLocal ? describe : describe.skip

describeLocal('Phase 8 — native domain adapters against a disposable migrated database', () => {
  let GET_TASKS: typeof import('@/app/api/native/wedding/tasks/route')['GET']
  let POST_TASKS: typeof import('@/app/api/native/wedding/tasks/route')['POST']
  let PATCH_TASK: typeof import('@/app/api/native/wedding/tasks/[id]/route')['PATCH']
  let GET_BUDGET: typeof import('@/app/api/native/wedding/budget/route')['GET']
  let GET_GUESTS: typeof import('@/app/api/native/wedding/guests/route')['GET']
  let GET_SEATING: typeof import('@/app/api/native/wedding/seating/route')['GET']
  let GET_TIMELINE: typeof import('@/app/api/native/wedding/timeline/route')['GET']
  let GET_VENDORS: typeof import('@/app/api/native/wedding/vendors/route')['GET']
  let GET_OVERVIEW: typeof import('@/app/api/native/wedding/overview/route')['GET']
  let GET_VENDOR_BUSINESS: typeof import('@/app/api/native/vendor/business/route')['GET']
  let GET_VENDOR_CATALOG: typeof import('@/app/api/native/vendor/catalog/route')['GET']
  let GET_ADMIN_OVERVIEW: typeof import('@/app/api/native/admin/overview/route')['GET']
  let GET_CONTRIBUTIONS: typeof import('@/app/api/native/wedding/contributions/route')['GET']
  let PWA_GET_TASKS: typeof import('@/app/api/planner/tasks/route')['GET']
  let PWA_POST_TASKS: typeof import('@/app/api/planner/tasks/route')['POST']
  let PWA_PATCH_TASK: typeof import('@/app/api/planner/tasks/[id]/route')['PATCH']

  const ids: Record<string, string> = {}
  const actors: Record<string, string> = {}

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({ createNativeAccountSessionToken } = await import('@/lib/native-account-session'))
    ;({ createAppSessionToken, APP_SESSION_COOKIE } = await import('@/lib/app-session'))
    ;({ NextRequest } = await import('next/server'))
    ;({ GET: GET_TASKS, POST: POST_TASKS } = await import('@/app/api/native/wedding/tasks/route'))
    ;({ PATCH: PATCH_TASK } = await import('@/app/api/native/wedding/tasks/[id]/route'))
    ;({ GET: GET_BUDGET } = await import('@/app/api/native/wedding/budget/route'))
    ;({ GET: GET_GUESTS } = await import('@/app/api/native/wedding/guests/route'))
    ;({ GET: GET_SEATING } = await import('@/app/api/native/wedding/seating/route'))
    ;({ GET: GET_TIMELINE } = await import('@/app/api/native/wedding/timeline/route'))
    ;({ GET: GET_VENDORS } = await import('@/app/api/native/wedding/vendors/route'))
    ;({ GET: GET_OVERVIEW } = await import('@/app/api/native/wedding/overview/route'))
    ;({ GET: GET_VENDOR_BUSINESS } = await import('@/app/api/native/vendor/business/route'))
    ;({ GET: GET_VENDOR_CATALOG } = await import('@/app/api/native/vendor/catalog/route'))
    ;({ GET: GET_ADMIN_OVERVIEW } = await import('@/app/api/native/admin/overview/route'))
    ;({ GET: GET_CONTRIBUTIONS } = await import('@/app/api/native/wedding/contributions/route'))
    ;({ GET: PWA_GET_TASKS, POST: PWA_POST_TASKS } = await import('@/app/api/planner/tasks/route'))
    ;({ PATCH: PWA_PATCH_TASK } = await import('@/app/api/planner/tasks/[id]/route'))

    // Wedding A: owner (Couple), planner, coordinator.
    const coupleA = await couple('couple-a')
    ids.A = await wedding('A', coupleA)
    actors.owner = await user('owner', 'couple')
    await membership('owner-A', actors.owner, ids.A, 'owner')

    actors.planner = await user('planner', 'planner')
    await membership('planner-A', actors.planner, ids.A, 'planner')

    actors.coordinator = await user('coordinator', 'planner')
    await membership('coordinator-A', actors.coordinator, ids.A, 'coordinator')

    actors.viewerOnly = await user('viewer-only', 'couple')
    await membership('viewer-A', actors.viewerOnly, ids.A, 'viewer')

    actors.revoked = await user('revoked', 'planner')
    await membership('revoked-A', actors.revoked, ids.A, 'planner', 'revoked')

    // Wedding B: a completely separate graph, for foreign-scope tests.
    const coupleB = await couple('couple-b')
    ids.B = await wedding('B', coupleB)
    actors.ownerB = await user('owner-b', 'couple')
    await membership('owner-B', actors.ownerB, ids.B, 'owner')

    // Domain rows for A.
    ids.taskA = await task('task-a', ids.A)
    ids.budgetA = await budgetItem('budget-a', ids.A)
    ids.guestA = await guest('guest-a', ids.A)
    ids.tableA = await seatingTable('table-a', ids.A)
    ids.programmeA = await programmeItem('programme-a', ids.A)
    ids.vendorA = await vendorRow('vendor-a', ids.A)
    const contributorA = await contributor('contributor-a', ids.A)
    ids.contributionA = await contribution('contribution-a', ids.A, contributorA)

    // Domain rows for B (to prove A never reads them).
    await task('task-b', ids.B)
    await budgetItem('budget-b', ids.B)
    await guest('guest-b', ids.B)
    await seatingTable('table-b', ids.B)
    await programmeItem('programme-b', ids.B)
    await vendorRow('vendor-b', ids.B)
    const contributorB = await contributor('contributor-b', ids.B)
    await contribution('contribution-b', ids.B, contributorB)

    // Vendor business V1, with a published listing so it qualifies for a vendor/business grant.
    actors.vendorOwner = await user('vendor-owner', 'vendor')
    ids.V1 = await business('vendor-1', 'vendor', { userId: actors.vendorOwner, role: 'business_owner' })
    await providerProfile('vendor-1-profile', ids.V1)

    // Admin: a wewed_internal business + owner membership (legacy admin path).
    actors.admin = await user('admin', 'admin')
    ids.platform = await business('platform', 'wewed_internal', { userId: actors.admin, role: 'wewed_super_admin' })
  })

  afterAll(async () => {
    await db?.$disconnect()
  })

  function grantId(kind: string, scope: string, entityId: string) {
    return `${kind}:${scope}:${entityId}`
  }

  test('Tasks: owner reads and writes; a foreign wedding grant id is rejected', async () => {
    const gid = grantId('couple', 'wedding', ids.A)
    const getRes = await GET_TASKS(await bearerRequest(`http://localhost/api/native/wedding/tasks?grantId=${gid}`, actors.owner, `auth-${actors.owner}`))
    expect(getRes.status).toBe(200)
    const body = await getRes.json()
    expect(body.data.map((t: { id: string }) => t.id)).toEqual([ids.taskA])

    // Create.
    const postRes = await POST_TASKS(await bearerRequest(`http://localhost/api/native/wedding/tasks?grantId=${gid}`, actors.owner, `auth-${actors.owner}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'New real task' }),
    }))
    expect(postRes.status).toBe(201)
    const created = (await postRes.json()).data
    expect(created.weddingId).toBe(ids.A)

    // Toggle/update via PATCH.
    const patchRes = await PATCH_TASK(
      await bearerRequest(`http://localhost/api/native/wedding/tasks/${created.id}?grantId=${gid}`, actors.owner, `auth-${actors.owner}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'done' }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    )
    expect(patchRes.status).toBe(200)
    expect((await patchRes.json()).data.status).toBe('done')

    // A well-formed but foreign grant id (wedding B's owner grant) is simply not among actors.owner's
    // fresh grants — 403, never wedding B's tasks.
    const foreignGid = grantId('couple', 'wedding', ids.B)
    const foreignRes = await GET_TASKS(await bearerRequest(`http://localhost/api/native/wedding/tasks?grantId=${foreignGid}`, actors.owner, `auth-${actors.owner}`))
    expect(foreignRes.status).toBe(403)
    expect((await foreignRes.json()).code).toBe('GRANT_REVOKED')
  })

  test('Tasks: a revoked membership grant id is denied entirely', async () => {
    const gid = grantId('planner', 'wedding', ids.A)
    const res = await GET_TASKS(await bearerRequest(`http://localhost/api/native/wedding/tasks?grantId=${gid}`, actors.revoked, `auth-${actors.revoked}`))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('GRANT_REVOKED')
  })

  test('Tasks: a viewer-only membership never grants a workspace at all', async () => {
    const gid = grantId('couple', 'wedding', ids.A)
    const res = await GET_TASKS(await bearerRequest(`http://localhost/api/native/wedding/tasks?grantId=${gid}`, actors.viewerOnly, `auth-${actors.viewerOnly}`))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('GRANT_REVOKED')
  })

  test('Budget/Guests/Seating/Timeline/Vendors: planner reads exactly wedding A, never wedding B', async () => {
    const gid = grantId('planner', 'wedding', ids.A)
    const req = (path: string) => bearerRequest(`http://localhost${path}?grantId=${gid}`, actors.planner, `auth-${actors.planner}`)

    const budgetRes = await GET_BUDGET(await req('/api/native/wedding/budget'))
    expect(budgetRes.status).toBe(200)
    const budgetBody = await budgetRes.json()
    expect(budgetBody.data.map((b: { id: string }) => b.id)).toEqual([ids.budgetA])
    expect(budgetBody.totals.totalEstimated).toBe(1000)

    const guestsRes = await GET_GUESTS(await req('/api/native/wedding/guests'))
    expect((await guestsRes.json()).data.map((g: { id: string }) => g.id)).toEqual([ids.guestA])

    const seatingRes = await GET_SEATING(await req('/api/native/wedding/seating'))
    expect((await seatingRes.json()).data.map((t: { id: string }) => t.id)).toEqual([ids.tableA])

    const timelineRes = await GET_TIMELINE(await req('/api/native/wedding/timeline'))
    expect((await timelineRes.json()).data.map((t: { id: string }) => t.id)).toEqual([ids.programmeA])

    const vendorsRes = await GET_VENDORS(await req('/api/native/wedding/vendors'))
    expect((await vendorsRes.json()).data.map((v: { id: string }) => v.id)).toEqual([ids.vendorA])
  })

  test('Overview: wedding-scoped grant returns real counts; portfolio-scoped grant never fabricates a wedding', async () => {
    const gid = grantId('couple', 'wedding', ids.A)
    const res = await GET_OVERVIEW(await bearerRequest(`http://localhost/api/native/wedding/overview?grantId=${gid}`, actors.owner, `auth-${actors.owner}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scopeKind).toBe('wedding')
    expect(body.counts.tasksTotal).toBeGreaterThanOrEqual(1)
    expect(body.wedding.id).toBe(ids.A)

    // Zero-wedding planner portfolio.
    const portfolioOwner = await user('portfolio-owner', 'planner')
    const portfolioBusiness = await business('portfolio-biz', 'planning_company', { userId: portfolioOwner, role: 'business_owner' })
    const portfolioGid = grantId('planner', 'portfolio', portfolioBusiness)
    const portfolioRes = await GET_OVERVIEW(await bearerRequest(`http://localhost/api/native/wedding/overview?grantId=${portfolioGid}`, portfolioOwner, `auth-${portfolioOwner}`))
    expect(portfolioRes.status).toBe(200)
    const portfolioBody = await portfolioRes.json()
    expect(portfolioBody.scopeKind).toBe('portfolio')
    expect(portfolioBody.wedding).toBeNull()
    expect(portfolioBody.counts).toBeNull()
  })

  test('Admin/system grant cannot be used to read a wedding-scoped domain', async () => {
    const adminGid = grantId('admin', 'system', '')
    const res = await GET_TASKS(await bearerRequest(`http://localhost/api/native/wedding/tasks?grantId=admin:system`, actors.admin, `auth-${actors.admin}`))
    expect(res.status).toBe(403)
    expect((await res.json()).code).toBe('GRANT_SCOPE_INVALID')
    void adminGid
  })

  test('Vendor: business identity and catalog are scoped to the grant\'s own businessAccountId', async () => {
    const gid = grantId('vendor', 'business', ids.V1)
    const businessRes = await GET_VENDOR_BUSINESS(await bearerRequest(`http://localhost/api/native/vendor/business?grantId=${gid}`, actors.vendorOwner, `auth-${actors.vendorOwner}`))
    expect(businessRes.status).toBe(200)
    const businessBody = await businessRes.json()
    expect(businessBody.business.businessAccountId).toBe(ids.V1)

    const catalogRes = await GET_VENDOR_CATALOG(await bearerRequest(`http://localhost/api/native/vendor/catalog?grantId=${gid}`, actors.vendorOwner, `auth-${actors.vendorOwner}`))
    expect(catalogRes.status).toBe(200)
    expect((await catalogRes.json()).data.businessAccountId).toBe(ids.V1)

    // A couple/planner grant id can never be used against the Vendor routes.
    const wrongKindRes = await GET_VENDOR_BUSINESS(await bearerRequest(`http://localhost/api/native/vendor/business?grantId=${grantId('couple', 'wedding', ids.A)}`, actors.owner, `auth-${actors.owner}`))
    expect(wrongKindRes.status).toBe(403)
    expect((await wrongKindRes.json()).code).toBe('GRANT_SCOPE_INVALID')
  })

  test('Admin: a real admin gets a real pending-onboarding count; a non-admin grant is refused', async () => {
    const res = await GET_ADMIN_OVERVIEW(await bearerRequest('http://localhost/api/native/admin/overview?grantId=admin:system', actors.admin, `auth-${actors.admin}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.scopeKind).toBe('system')
    expect(typeof body.counts.pendingOnboarding).toBe('number')

    const nonAdminRes = await GET_ADMIN_OVERVIEW(await bearerRequest(`http://localhost/api/native/admin/overview?grantId=${grantId('couple', 'wedding', ids.A)}`, actors.owner, `auth-${actors.owner}`))
    expect(nonAdminRes.status).toBe(403)
    expect((await nonAdminRes.json()).code).toBe('GRANT_SCOPE_INVALID')
  })

  test('Cross-context isolation: a coordinator on wedding A can never read wedding B by any grant id, real or guessed', async () => {
    const gid = grantId('coordinator', 'wedding', ids.A)
    const req = (path: string) => bearerRequest(`http://localhost${path}?grantId=${gid}`, actors.coordinator, `auth-${actors.coordinator}`)
    const tasksRes = await GET_TASKS(await req('/api/native/wedding/tasks'))
    expect(tasksRes.status).toBe(200)
    expect((await tasksRes.json()).data.every((t: { weddingId: string }) => t.weddingId === ids.A)).toBe(true)

    const guessedGid = grantId('coordinator', 'wedding', ids.B)
    const guessedRes = await GET_TASKS(await bearerRequest(`http://localhost/api/native/wedding/tasks?grantId=${guessedGid}`, actors.coordinator, `auth-${actors.coordinator}`))
    expect(guessedRes.status).toBe(403)
    expect((await guessedRes.json()).code).toBe('GRANT_REVOKED')
  })

  test('Contributions: reuses the mature engine, reads exactly wedding A, preserves funding-state distinctions', async () => {
    const gid = grantId('couple', 'wedding', ids.A)
    const res = await GET_CONTRIBUTIONS(await bearerRequest(`http://localhost/api/native/wedding/contributions?grantId=${gid}`, actors.owner, `auth-${actors.owner}`))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.map((c: { id: string }) => c.id)).toEqual([ids.contributionA])
    // The exact fields loadContributionWorkspace derives — proof this route did not recompute a
    // second, simplified funding truth of its own.
    expect(body.data[0].type).toBe('CASH_TO_COUPLE')
    expect(body.data[0].commitmentState).toBe('CONFIRMED')
    expect(body.data[0].fulfillmentState).toBe('RECEIVED')
    expect(typeof body.data[0].allocatedAmount).toBe('number')
    expect(body.summaryByCurrency).toBeDefined()
    expect(body.counts).toBeDefined()

    // Never wedding B's contributor/contribution rows, and a foreign grant is refused outright.
    expect(body.data.every((c: { weddingId: string }) => c.weddingId === ids.A)).toBe(true)
    const foreignRes = await GET_CONTRIBUTIONS(await bearerRequest(`http://localhost/api/native/wedding/contributions?grantId=${grantId('couple', 'wedding', ids.B)}`, actors.owner, `auth-${actors.owner}`))
    expect(foreignRes.status).toBe(403)
    expect((await foreignRes.json()).code).toBe('GRANT_REVOKED')
  })

  test('Contributions: a coordinator (budget.view, not budget.edit) can read the same authoritative state as a planner', async () => {
    const gid = grantId('coordinator', 'wedding', ids.A)
    const res = await GET_CONTRIBUTIONS(await bearerRequest(`http://localhost/api/native/wedding/contributions?grantId=${gid}`, actors.coordinator, `auth-${actors.coordinator}`))
    expect(res.status).toBe(200)
    expect((await res.json()).data.map((c: { id: string }) => c.id)).toEqual([ids.contributionA])
  })

  test('Shared task mutation domain: a task created via the native route is visible and editable via the PWA route, and vice versa', async () => {
    const gid = grantId('couple', 'wedding', ids.A)

    // Native creates it...
    const createRes = await POST_TASKS(await bearerRequest(`http://localhost/api/native/wedding/tasks?grantId=${gid}`, actors.owner, `auth-${actors.owner}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Cross-transport task' }),
    }))
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()).data

    // ...the PWA's own cookie-session route reads the exact same row, formatted identically.
    const pwaGetRes = await PWA_GET_TASKS(await cookieRequest('http://localhost/api/planner/tasks', actors.owner, ids.A, 'couple'))
    const pwaTask = (await pwaGetRes.json()).data.find((t: { id: string }) => t.id === created.id)
    expect(pwaTask).toEqual(created)

    // The PWA updates it...
    const pwaPatchRes = await PWA_PATCH_TASK(
      await cookieRequest(`http://localhost/api/planner/tasks/${created.id}`, actors.owner, ids.A, 'couple', {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'in_progress' }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    )
    expect(pwaPatchRes.status).toBe(200)

    // ...native's own bearer-session route sees the SAME update, proving one shared operation
    // rather than two independent implementations that could silently drift.
    const nativeGetRes = await GET_TASKS(await bearerRequest(`http://localhost/api/native/wedding/tasks?grantId=${gid}`, actors.owner, `auth-${actors.owner}`))
    const nativeTask = (await nativeGetRes.json()).data.find((t: { id: string }) => t.id === created.id)
    expect(nativeTask.status).toBe('in_progress')

    // Native's toggle shortcut flips it again, and the PWA sees that too.
    const toggleRes = await PATCH_TASK(
      await bearerRequest(`http://localhost/api/native/wedding/tasks/${created.id}?grantId=${gid}`, actors.owner, `auth-${actors.owner}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ toggle: true }),
      }),
      { params: Promise.resolve({ id: created.id }) },
    )
    expect(toggleRes.status).toBe(200)
    expect((await toggleRes.json()).data.status).toBe('done')
    const pwaGetAfterToggle = await PWA_GET_TASKS(await cookieRequest('http://localhost/api/planner/tasks', actors.owner, ids.A, 'couple'))
    const pwaTaskAfterToggle = (await pwaGetAfterToggle.json()).data.find((t: { id: string }) => t.id === created.id)
    expect(pwaTaskAfterToggle.status).toBe('done')
  })
})
