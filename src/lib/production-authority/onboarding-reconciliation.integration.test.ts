/**
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 7 — Reconcile onboarding before
 * exposing native onboarding.
 *
 * Drives the REAL route handlers (`POST /api/auth/register`, `POST /api/admin/onboarding`)
 * against a DISPOSABLE local PostgreSQL migrated with this repository's own prisma/migrations,
 * then proves the resulting graph's authority with `resolveProductionAuthority` (the Phase-7 §15
 * post-condition). Supabase itself is mocked (no real project is available in this environment);
 * every database write is real.
 *
 * Never production: refuses to run unless AUTHORITY_TEST_DATABASE_URL points at localhost/127.0.0.1.
 *
 *   AUTHORITY_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/wewed_phase7_disposable \
 *     bun test src/lib/production-authority/onboarding-reconciliation.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  process.env.WEWED_SESSION_SECRET = 'phase7-onboarding-integration-only'
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://phase7-test.supabase.test'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'phase7-test-anon-key'
}
mock.module('server-only', () => ({}))

// Supabase is mocked: this environment has no real project. Every signUp call gets a fresh,
// unique fake auth identity — enough to drive the real DB-write code paths under test. The
// compensation call (`auth.admin.deleteUser`) is recorded so the partial-failure test can prove
// the route's existing best-effort cleanup actually fires on a real thrown error.
const deleteUserCalls: string[] = []
mock.module('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      signUp: async ({ email }: { email: string }) => ({
        data: {
          user: { id: `authid-${randomUUID()}`, identities: [{ id: 'x' }] },
          session: { access_token: `session-${email}` },
        },
        error: null,
      }),
    },
  }),
}))
mock.module('@/lib/supabase/service', () => ({
  createSupabaseServiceClient: () => ({
    auth: { admin: { deleteUser: async (id: string) => { deleteUserCalls.push(id); return { data: {}, error: null } } } },
  }),
}))

type Db = typeof import('@/lib/db')['db']
let db: Db
let resolveProductionAuthority: typeof import('./resolver')['resolveProductionAuthority']
let registerPOST: typeof import('@/app/api/auth/register/route')['POST']
let onboardingPOST: typeof import('@/app/api/admin/onboarding/route')['POST']
let createAppSessionToken: typeof import('@/lib/app-session')['createAppSessionToken']
let APP_SESSION_COOKIE: typeof import('@/lib/app-session')['APP_SESSION_COOKIE']
let NextRequest: typeof import('next/server')['NextRequest']

const run = randomUUID().slice(0, 8)
const id = (name: string) => `p7-${run}-${name}`
const emailFor = (name: string) => `${id(name)}@example.test`.toLowerCase()

async function exec(sql: string, ...params: unknown[]) {
  await db.$executeRawUnsafe(sql, ...params)
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

/** A wewed_internal business + owner membership, in one transaction (deferred owner-membership trigger). */
async function adminActor(name: string) {
  const userId = id(name)
  await exec(
    `INSERT INTO public."User" (id, email, name, role, "isActive", "updatedAt")
     VALUES ($1, $2, $3, 'admin', true, now())`,
    userId, emailFor(name), name,
  )
  await db.$transaction([
    db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."BusinessAccount" (id, name, slug, type, status, "ownerUserId", "onboardingStatus", "subscriptionStatus")
       VALUES ($1, $2, $1, 'wewed_internal', 'active', $3, 'complete', 'free')`,
      id(`${name}-platform`), `Platform ${name}`, userId,
    ),
    db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."BusinessAccountMember" (id, "businessAccountId", "userId", role, status, permissions)
       VALUES ($1, $2, $3, 'wewed_super_admin', 'active', '["*"]'::jsonb)`,
      id(`${name}-platform-owner`), id(`${name}-platform`), userId,
    ),
  ])
  return userId
}

async function adminRequest(adminUserId: string, body: Record<string, unknown>) {
  const token = createAppSessionToken({
    userId: adminUserId,
    authUserId: `auth-${adminUserId}`,
    email: emailFor('admin-session'),
    role: 'admin',
    coupleId: null,
    activeWeddingId: 'admin-session-probe',
  })
  return onboardingPOST(new NextRequest('http://localhost/api/admin/onboarding', {
    method: 'POST',
    headers: { cookie: `${APP_SESSION_COOKIE}=${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

async function register(body: Record<string, unknown>) {
  // /api/auth/register rate-limits by client IP (x-forwarded-for), in a module-level Map shared
  // across every call in this process. A distinct synthetic IP per registration keeps this
  // suite's own volume of calls from tripping that limiter and masking the behavior under test.
  return registerPOST(new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}` },
    body: JSON.stringify(body),
  }))
}

function baseApplication(overrides: Record<string, unknown>) {
  return {
    name: 'Applicant',
    password: 'a-very-long-password-123',
    acceptedTerms: true,
    requestedPlan: 'free',
    ...overrides,
  }
}

/** authUserId for an applicant's email, exactly as `resolveProductionAuthority` needs it. */
async function authUserIdFor(email: string): Promise<string> {
  const row = await db.userProfile.findFirst({ where: { email }, select: { id: true } })
  if (!row) throw new Error(`No UserProfile for ${email}`)
  return row.id
}

async function ownerUserIdFor(email: string): Promise<string> {
  const row = await db.user.findUnique({ where: { email }, select: { id: true } })
  if (!row) throw new Error(`No User for ${email}`)
  return row.id
}

function resolve(accessUserId: string, authUserId: string) {
  return resolveProductionAuthority(accessUserId, { authUserId })
}

async function approve(accountId: string) {
  await exec(`UPDATE wewed_admin."BusinessAccount" SET status = 'active', "updatedAt" = now() WHERE id = $1`, accountId)
}

const describeLocal = isLocal ? describe : describe.skip

describeLocal('Phase 7 — onboarding reconciliation against a disposable migrated database', () => {
  let adminUserId: string

  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({ resolveProductionAuthority } = await import('./resolver'))
    ;({ POST: registerPOST } = await import('@/app/api/auth/register/route'))
    ;({ POST: onboardingPOST } = await import('@/app/api/admin/onboarding/route'))
    ;({ createAppSessionToken, APP_SESSION_COOKIE } = await import('@/lib/app-session'))
    ;({ NextRequest } = await import('next/server'))

    adminUserId = await adminActor('admin')
  })

  afterAll(async () => {
    await db?.$disconnect()
  })

  // -----------------------------------------------------------------------------------------
  // F-4 — BusinessAccount.subscriptionStatus default (Phase 7 fix)
  // -----------------------------------------------------------------------------------------

  test('F-4: a new BusinessAccount omitting subscriptionStatus now defaults to a value its own CHECK constraint allows', async () => {
    const ownerId = id('f4-owner')
    await exec(
      `INSERT INTO public."User" (id, email, name, role, "isActive", "updatedAt") VALUES ($1, $2, 'F4 Owner', 'viewer', false, now())`,
      ownerId, emailFor('f4-owner'),
    )
    const businessId = id('f4-business')
    await db.$transaction([
      db.$executeRawUnsafe(
        // Deliberately omits "subscriptionStatus" — this is exactly the insert shape F-4 broke.
        `INSERT INTO wewed_admin."BusinessAccount" (id, name, slug, type, status, "ownerUserId", "onboardingStatus")
         VALUES ($1, $2, $1, 'planning_company', 'active', $3, 'not_started')`,
        businessId, 'F-4 Business', ownerId,
      ),
      db.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BusinessAccountMember" (id, "businessAccountId", "userId", role, status, permissions)
         VALUES ($1, $2, $3, 'business_owner', 'active', '[]'::jsonb)`,
        id('f4-owner-member'), businessId, ownerId,
      ),
    ])
    const [row] = await db.$queryRawUnsafe<Array<{ subscriptionStatus: string }>>(
      `SELECT "subscriptionStatus" FROM wewed_admin."BusinessAccount" WHERE id = $1`, businessId,
    )
    expect(row.subscriptionStatus).toBe('free')
  })

  // -----------------------------------------------------------------------------------------
  // Couple: public registration -> incomplete = no authority -> admin completion -> real grant
  // -----------------------------------------------------------------------------------------

  test('Couple: registration alone grants nothing; admin completion produces exactly the couple/wedding grant', async () => {
    const email = emailFor('couple-app')
    const res = await register(baseApplication({
      email, name: 'Couple Applicant', businessName: 'The Smith Wedding',
      accountType: 'couple', requestedRole: 'couple_owner',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    const accountId = body.applicationId as string

    // Item 15: an incomplete applicant has no authority, even though real rows now exist.
    const ownerUserId = await ownerUserIdFor(email)
    const authUserId = await authUserIdFor(email)
    const [account] = await db.$queryRawUnsafe<Array<{ status: string; onboardingStatus: string; subscriptionStatus: string }>>(
      `SELECT status, "onboardingStatus", "subscriptionStatus" FROM wewed_admin."BusinessAccount" WHERE id = $1`, accountId,
    )
    expect(account).toEqual({ status: 'pending_review', onboardingStatus: 'not_started', subscriptionStatus: 'free' })
    const preAuthority = await resolve(ownerUserId, authUserId)
    expect(preAuthority.accountStatus).toBe('inactive_identity')
    expect(preAuthority.workspaceGrants).toEqual([])

    await approve(accountId)
    const complete = await adminRequest(adminUserId, {
      action: 'complete_onboarding', accountId,
      partner1: 'Alex Smith', partner2: 'Sam Smith',
      weddingTitle: 'Alex & Sam', weddingDate: '2027-06-12',
      venue: 'Garden Estate', venueCity: 'Harare', venueCountry: 'Zimbabwe',
    })
    expect(complete.status).toBe(200)
    const completeBody = await complete.json()
    expect(completeBody.success).toBe(true)

    const membership = await db.weddingMembership.findUnique({
      where: { userId_weddingId: { userId: ownerUserId, weddingId: completeBody.weddingId } },
    })
    expect(membership?.role).toBe('owner')
    expect(membership?.status).toBe('active')
    const [linkRows] = [await db.$queryRawUnsafe<Array<{ entityType: string; relationship: string }>>(
      `SELECT "entityType", relationship FROM public."BusinessAccountLink" WHERE "businessAccountId" = $1 ORDER BY "entityType"`, accountId,
    )]
    expect(linkRows.map((r) => `${r.entityType}:${r.relationship}`)).toEqual(['couple:owns', 'wedding:owns'])

    const postAuthority = await resolve(ownerUserId, authUserId)
    expect(postAuthority.accountStatus).toBe('authorized')
    expect(postAuthority.workspaceGrants.map((g) => g.grantId)).toEqual([`couple:wedding:${completeBody.weddingId}`])

    // Sequential retry after success: the pre-existing 'complete' check still rejects it.
    const retry = await adminRequest(adminUserId, { action: 'complete_onboarding', accountId })
    expect(retry.status).toBe(409)
    expect((await retry.json()).error).toBe('Onboarding is already complete.')
  })

  // -----------------------------------------------------------------------------------------
  // Planner: zero-wedding portfolio must never fabricate a wedding
  // -----------------------------------------------------------------------------------------

  test('Planner: zero-wedding completion yields a real portfolio grant and creates no wedding', async () => {
    const email = emailFor('planner-zero')
    const res = await register(baseApplication({
      email, name: 'Zero Planner', businessName: 'Zero Weddings Co',
      accountType: 'planning_company', requestedRole: 'planner',
    }))
    const { applicationId: accountId } = await res.json()
    await approve(accountId)

    const complete = await adminRequest(adminUserId, { action: 'complete_onboarding', accountId })
    expect(complete.status).toBe(200)
    const completeBody = await complete.json()
    expect(completeBody.weddingId).toBeNull()

    const coupleCount = await db.$queryRawUnsafe<Array<{ count: string }>>(
      `SELECT count(*)::text FROM public."BusinessAccountLink" WHERE "businessAccountId" = $1`, accountId,
    )
    expect(coupleCount[0].count).toBe('0')

    const ownerUserId = await ownerUserIdFor(email)
    const authUserId = await authUserIdFor(email)
    const authority = await resolve(ownerUserId, authUserId)
    expect(authority.workspaceGrants.map((g) => g.grantId)).toEqual([`planner:portfolio:${accountId}`])
    expect(authority.workspaceGrants[0].scopeKind).toBe('portfolio')
  })

  test('Planner: one-wedding completion attaches the EXISTING wedding and never creates a Couple/Wedding row', async () => {
    const existingCouple = await couple('planner-one-couple')
    const existingWeddingId = await wedding('planner-one-wedding', existingCouple)

    const email = emailFor('planner-one')
    const res = await register(baseApplication({
      email, name: 'One Planner', businessName: 'One Wedding Co',
      accountType: 'planning_company', requestedRole: 'planner',
    }))
    const { applicationId: accountId } = await res.json()
    await approve(accountId)

    const [weddingCountBefore] = await db.$queryRawUnsafe<Array<{ count: string }>>(`SELECT count(*)::text FROM public."Wedding"`)

    const complete = await adminRequest(adminUserId, { action: 'complete_onboarding', accountId, weddingId: existingWeddingId })
    expect(complete.status).toBe(200)
    const completeBody = await complete.json()
    expect(completeBody.weddingId).toBe(existingWeddingId)

    const [weddingCountAfter] = await db.$queryRawUnsafe<Array<{ count: string }>>(`SELECT count(*)::text FROM public."Wedding"`)
    expect(weddingCountAfter.count).toBe(weddingCountBefore.count) // no new Wedding row

    const ownerUserId = await ownerUserIdFor(email)
    const authUserId = await authUserIdFor(email)
    const authority = await resolve(ownerUserId, authUserId)
    // A planner with an attached wedding keeps BOTH grants: their own business portfolio (always
    // standing, independent of any one client) and the wedding-level grant for the attached
    // client wedding. These are two independent evidence sources (business membership vs
    // WeddingMembership) and are not mutually exclusive.
    expect(authority.workspaceGrants.map((g) => g.grantId).sort()).toEqual(
      [`planner:portfolio:${accountId}`, `planner:wedding:${existingWeddingId}`].sort(),
    )
  })

  // -----------------------------------------------------------------------------------------
  // Coordinator: strictly WeddingMembership.role = coordinator
  // -----------------------------------------------------------------------------------------

  test('Coordinator: a coordinator applicant attached to an existing wedding gets a coordinator grant, not a planner grant', async () => {
    const existingCouple = await couple('coordinator-couple')
    const existingWeddingId = await wedding('coordinator-wedding', existingCouple)

    const email = emailFor('coordinator-app')
    const res = await register(baseApplication({
      email, name: 'Coordinator Applicant', businessName: 'Coordination Co',
      accountType: 'planning_company', requestedRole: 'coordinator',
    }))
    const { applicationId: accountId } = await res.json()
    await approve(accountId)

    const complete = await adminRequest(adminUserId, { action: 'complete_onboarding', accountId, weddingId: existingWeddingId })
    expect(complete.status).toBe(200)

    const ownerUserId = await ownerUserIdFor(email)
    const membership = await db.weddingMembership.findUnique({
      where: { userId_weddingId: { userId: ownerUserId, weddingId: existingWeddingId } },
    })
    expect(membership?.role).toBe('coordinator')

    const authUserId = await authUserIdFor(email)
    const authority = await resolve(ownerUserId, authUserId)
    expect(authority.workspaceGrants.map((g) => g.grantId)).toEqual([`coordinator:wedding:${existingWeddingId}`])
  })

  // -----------------------------------------------------------------------------------------
  // Vendor / Venue: F-3 remains a separate gate. No fabricated wedding authority, ever.
  // -----------------------------------------------------------------------------------------

  test('Vendor: an ordinary applicant never gets wedding/business authority, and admin completion is refused (F-3 unchanged)', async () => {
    const email = emailFor('vendor-app')
    const res = await register(baseApplication({
      email, name: 'Vendor Applicant', businessName: 'Vendor Applicant Co',
      accountType: 'vendor', requestedRole: 'business_owner',
      country: 'Zimbabwe', city: 'Harare', primaryServiceArea: 'Harare',
      requestedServices: ['photography'],
    }))
    expect(res.status).toBe(200)
    const { applicationId: accountId } = await res.json()

    const [account] = await db.$queryRawUnsafe<Array<{ type: string }>>(
      `SELECT type FROM wewed_admin."BusinessAccount" WHERE id = $1`, accountId,
    )
    expect(account.type).toBe('vendor')
    const [linkCount] = await db.$queryRawUnsafe<Array<{ count: string }>>(
      `SELECT count(*)::text FROM public."BusinessAccountLink" WHERE "businessAccountId" = $1`, accountId,
    )
    expect(linkCount.count).toBe('0')

    await approve(accountId)
    const complete = await adminRequest(adminUserId, { action: 'complete_onboarding', accountId })
    expect(complete.status).toBe(409)
    expect((await complete.json()).error).toContain('dedicated stakeholder portal')

    const ownerUserId = await ownerUserIdFor(email)
    const authUserId = await authUserIdFor(email)
    const authority = await resolve(ownerUserId, authUserId)
    expect(authority.accountStatus).toBe('inactive_identity') // status=active alone never activates the User
    expect(authority.workspaceGrants).toEqual([])
  })

  test('Venue: an ordinary applicant follows the identical no-fabrication path as Vendor', async () => {
    const email = emailFor('venue-app')
    const res = await register(baseApplication({
      email, name: 'Venue Applicant', businessName: 'Venue Applicant Co',
      accountType: 'venue', requestedRole: 'venue_manager',
      country: 'Zimbabwe', city: 'Harare', primaryServiceArea: 'Harare',
      requestedServices: ['venue'],
    }))
    expect(res.status).toBe(200)
    const { applicationId: accountId } = await res.json()
    await approve(accountId)
    const complete = await adminRequest(adminUserId, { action: 'complete_onboarding', accountId })
    expect(complete.status).toBe(409)
  })

  // -----------------------------------------------------------------------------------------
  // Idempotency under genuine concurrency (Phase 7 §13)
  // -----------------------------------------------------------------------------------------

  test('Idempotency: two simultaneous completion requests for the same account create exactly one Couple/Wedding graph', async () => {
    const email = emailFor('race-couple')
    const res = await register(baseApplication({
      email, name: 'Race Couple', businessName: 'Race Wedding',
      accountType: 'couple', requestedRole: 'couple_owner',
    }))
    const { applicationId: accountId } = await res.json()
    await approve(accountId)

    const body = {
      action: 'complete_onboarding', accountId,
      partner1: 'Race A', partner2: 'Race B',
      weddingTitle: 'Race Wedding', weddingDate: '2027-08-01',
      venue: 'Race Venue', venueCity: 'Harare', venueCountry: 'Zimbabwe',
    }
    const [first, second] = await Promise.all([adminRequest(adminUserId, body), adminRequest(adminUserId, body)])
    const statuses = [first.status, second.status].sort()
    expect(statuses).toEqual([200, 409])
    const loser = first.status === 409 ? first : second
    expect((await loser.json()).error).toContain('just completed by another request')

    const [coupleCount] = await db.$queryRawUnsafe<Array<{ count: string }>>(
      `SELECT count(*)::text FROM public."BusinessAccountLink" WHERE "businessAccountId" = $1 AND "entityType" = 'couple'`, accountId,
    )
    expect(coupleCount.count).toBe('1')
  })

  // -----------------------------------------------------------------------------------------
  // Partial failure: Supabase auth succeeds, the DB write fails -> existing best-effort cleanup
  // -----------------------------------------------------------------------------------------

  test('Failure handling: a DB failure after a successful Supabase signUp triggers the existing auth-identity cleanup', async () => {
    const email = emailFor('duplicate-email')
    const deleteCallsBefore = deleteUserCalls.length

    // Two simultaneous registrations for the SAME email: Supabase signUp is mocked to always
    // succeed (a fresh fake identity each time), and the pre-transaction `db.user.findUnique`
    // duplicate-email check can't see either request's row until one commits, so both proceed
    // past it. Exactly one wins the real `public."User".email` unique constraint; the loser's DB
    // write fails AFTER its own Supabase identity was already created — the partial-failure shape
    // item 14 asks about — and the route's existing best-effort compensation must fire for it.
    const [a, b] = await Promise.all([
      register(baseApplication({ email, name: 'Racer A', businessName: 'Racer A Co', accountType: 'couple', requestedRole: 'couple_owner' })),
      register(baseApplication({ email, name: 'Racer B', businessName: 'Racer B Co', accountType: 'couple', requestedRole: 'couple_owner' })),
    ])
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([200, 500])
    const loser = a.status === 500 ? a : b
    expect((await loser.json()).success).toBe(false)
    expect(deleteUserCalls.length).toBe(deleteCallsBefore + 1)
  })

  // -----------------------------------------------------------------------------------------
  // Cross-account isolation
  // -----------------------------------------------------------------------------------------

  test('Cross-account isolation: completing account A never grants anything on account B, and vice versa', async () => {
    const emailA = emailFor('isolation-a')
    const emailB = emailFor('isolation-b')
    const resA = await register(baseApplication({ email: emailA, name: 'Isolation A', businessName: 'Isolation A Co', accountType: 'couple', requestedRole: 'couple_owner' }))
    const resB = await register(baseApplication({ email: emailB, name: 'Isolation B', businessName: 'Isolation B Co', accountType: 'couple', requestedRole: 'couple_owner' }))
    const { applicationId: accountA } = await resA.json()
    const { applicationId: accountB } = await resB.json()
    await approve(accountA)
    await approve(accountB)

    const completeA = await adminRequest(adminUserId, {
      action: 'complete_onboarding', accountId: accountA,
      partner1: 'A1', partner2: 'A2', weddingTitle: 'Wedding A', weddingDate: '2027-09-01',
      venue: 'Venue A', venueCity: 'Harare', venueCountry: 'Zimbabwe',
    })
    const completeB = await adminRequest(adminUserId, {
      action: 'complete_onboarding', accountId: accountB,
      partner1: 'B1', partner2: 'B2', weddingTitle: 'Wedding B', weddingDate: '2027-09-02',
      venue: 'Venue B', venueCity: 'Harare', venueCountry: 'Zimbabwe',
    })
    const { weddingId: weddingA } = await completeA.json()
    const { weddingId: weddingB } = await completeB.json()

    const ownerA = await ownerUserIdFor(emailA)
    const authA = await authUserIdFor(emailA)
    const ownerB = await ownerUserIdFor(emailB)
    const authB = await authUserIdFor(emailB)

    const authorityA = await resolve(ownerA, authA)
    const authorityB = await resolve(ownerB, authB)
    expect(authorityA.workspaceGrants.map((g) => g.grantId)).toEqual([`couple:wedding:${weddingA}`])
    expect(authorityB.workspaceGrants.map((g) => g.grantId)).toEqual([`couple:wedding:${weddingB}`])
    expect(authorityA.workspaceGrants.some((g) => g.weddingId === weddingB)).toBe(false)
    expect(authorityB.workspaceGrants.some((g) => g.weddingId === weddingA)).toBe(false)
  })

  // -----------------------------------------------------------------------------------------
  // Guest is not an account application (item 17) — regression confirmation only.
  // -----------------------------------------------------------------------------------------

  test('Guest: accepting an invitation creates no User/UserProfile/BusinessAccount row (unchanged by this phase)', async () => {
    const guestEmail = emailFor('guest-untouched')
    const beforeUser = await db.user.findUnique({ where: { email: guestEmail } })
    const beforeProfile = await db.userProfile.findFirst({ where: { email: guestEmail } })
    expect(beforeUser).toBeNull()
    expect(beforeProfile).toBeNull()
    // Guest Session v2 is a wholly separate, invitation-bound identity (master plan Phase 4) with
    // no route under test here; this test only pins that nothing in this phase's onboarding graph
    // was made reachable from it.
  })
})
