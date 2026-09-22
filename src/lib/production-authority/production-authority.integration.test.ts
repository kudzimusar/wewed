/**
 * WewedProductionAuthorityV1 — multi-axis matrix and PWA comparison, against a DISPOSABLE local
 * PostgreSQL migrated with this repository's own prisma/migrations.
 *
 * Master plan Phase 2 (Part G, Part H). Never production: the suite refuses to run unless
 * AUTHORITY_TEST_DATABASE_URL points at localhost / 127.0.0.1.
 *
 *   AUTHORITY_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/wewed_authority_test \
 *     bun test src/lib/production-authority/production-authority.integration.test.ts
 */
import { afterAll, beforeAll, describe, expect, mock, test } from 'bun:test'
import { randomUUID } from 'node:crypto'

const url = process.env.AUTHORITY_TEST_DATABASE_URL ?? ''
const isLocal = /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)
if (isLocal) {
  process.env.DATABASE_URL = url
  process.env.DIRECT_URL = url
  process.env.WEWED_SESSION_SECRET = 'phase2-authority-integration-only'
}
mock.module('server-only', () => ({}))

type Db = typeof import('@/lib/db')['db']
let db: Db
let resolveProductionAuthority: typeof import('./resolver')['resolveProductionAuthority']
let listAccessibleWeddings: typeof import('@/lib/wedding-access')['listAccessibleWeddings']
let isWewedPlatformAdministrator: typeof import('@/lib/business-access')['isWewedPlatformAdministrator']

const run = randomUUID().slice(0, 8)
const id = (name: string) => `p2-${run}-${name}`

async function exec(sql: string, ...params: unknown[]) {
  await db.$executeRawUnsafe(sql, ...params)
}

async function user(name: string, role: string, opts: { coupleId?: string; isActive?: boolean } = {}) {
  await exec(
    `INSERT INTO public."User" (id, email, name, role, "coupleId", "isActive", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    id(name), `${id(name)}@example.test`, name, role, opts.coupleId ?? null, opts.isActive ?? true,
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

/**
 * A business and its owner's membership, in one transaction: the governed-owner constraint
 * (wewed_admin.validate_business_owner_membership) is checked at commit.
 */
async function business(
  name: string,
  type: string,
  owner: { userId: string; role: string; status?: string; permissions?: string[] },
  opts: { status?: string; onboardingStatus?: string } = {},
) {
  await db.$transaction([
    db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."BusinessAccount" (id, name, slug, type, status, "ownerUserId", "onboardingStatus", "subscriptionStatus")
       VALUES ($1, $2, $1, $3, $4, $5, $6, 'free')`,
      id(name), `Business ${name}`, type, opts.status ?? 'active', owner.userId, opts.onboardingStatus ?? 'complete',
    ),
    db.$executeRawUnsafe(
      `INSERT INTO wewed_admin."BusinessAccountMember" (id, "businessAccountId", "userId", role, status, permissions)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      id(`${name}-owner`), id(name), owner.userId, owner.role, owner.status ?? 'active', JSON.stringify(owner.permissions ?? []),
    ),
  ])
  return id(name)
}

async function member(name: string, businessAccountId: string, userId: string, role: string, status = 'active', permissions: string[] = []) {
  await exec(
    `INSERT INTO wewed_admin."BusinessAccountMember" (id, "businessAccountId", "userId", role, status, permissions)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    id(name), businessAccountId, userId, role, status, JSON.stringify(permissions),
  )
  return id(name)
}

async function link(name: string, businessAccountId: string, entityType: string, entityId: string, relationship = 'owns') {
  await exec(
    `INSERT INTO wewed_admin."BusinessAccountLink" (id, "businessAccountId", "entityType", "entityId", relationship)
     VALUES ($1, $2, $3, $4, $5)`,
    id(name), businessAccountId, entityType, entityId, relationship,
  )
  return id(name)
}

async function providerProfile(name: string, businessAccountId: string, listingStatus = 'verified', visibility = 'published') {
  await exec(
    `INSERT INTO wewed_admin."ProviderProfile" (id, "businessAccountId", slug, "displayName", "listingStatus", visibility, "isClaimable")
     VALUES ($1, $2, $1, $3, $4, $5, false)`,
    id(name), businessAccountId, `Profile ${name}`, listingStatus, visibility,
  )
}

async function vendor(name: string, weddingId: string) {
  await exec(
    `INSERT INTO public."Vendor" (id, name, category, "weddingId", "updatedAt") VALUES ($1, $2, 'photography', $3, now())`,
    id(name), `Vendor ${name}`, weddingId,
  )
  return id(name)
}

async function engagement(name: string, vendorId: string, weddingId: string) {
  await exec(
    `INSERT INTO public."ServiceEngagement" (id, "serviceCategory", "vendorId", "weddingId", "updatedAt")
     VALUES ($1, 'photography', $2, $3, now())`,
    id(name), vendorId, weddingId,
  )
  return id(name)
}

async function platformRegistry(userId: string, role: string, status: string) {
  await exec(
    // A trigger already syncs the registry from Wewed-internal memberships; override it explicitly.
    `INSERT INTO wewed_admin."PlatformAdministrator" ("userId", role, status) VALUES ($1, $2, $3)
     ON CONFLICT ("userId") DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status`,
    userId, role, status,
  )
}

/**
 * Resolves as a verified caller would: `authUserId` is the Supabase identity the caller verified.
 * In this fixture it follows the same `auth-<accessUserId>` convention the PWA tests use.
 */
function resolve(accessUserId: string, authUserId: string | null = `auth-${accessUserId}`) {
  return resolveProductionAuthority(accessUserId, { authUserId })
}

async function userProfile(authUserId: string, isBanned: boolean) {
  await exec(
    `INSERT INTO public."UserProfile" (id, email, "isBanned", "updatedAt") VALUES ($1, $2, $3, now())`,
    authUserId, `${authUserId}@example.test`, isBanned,
  )
}

const actors: Record<string, string> = {}
const ids: Record<string, string> = {}

const describeLocal = isLocal ? describe : describe.skip

describeLocal('WewedProductionAuthorityV1 against a disposable migrated database', () => {
  beforeAll(async () => {
    ;({ db } = await import('@/lib/db'))
    ;({ resolveProductionAuthority } = await import('./resolver'))
    ;({ listAccessibleWeddings } = await import('@/lib/wedding-access'))
    ;({ isWewedPlatformAdministrator } = await import('@/lib/business-access'))

    // Weddings
    const c = await couple('couple-a')
    ids.A = await wedding('A', c)
    ids.B = await wedding('B', await couple('couple-b'))
    ids.C = await wedding('C', await couple('couple-c'))
    ids.D = await wedding('D', await couple('couple-d'))

    // Couple owner of A.
    actors.couple = await user('couple', 'couple', { coupleId: c })
    await membership('couple-owner-A', actors.couple, ids.A, 'owner')

    // Planner with ONE wedding (A) through a planning company that manages A.
    actors.planner1 = await user('planner1', 'planner')
    ids.P1 = await business('planning-1', 'planning_company', { userId: actors.planner1, role: 'business_owner', permissions: ['weddings.manage'] })
    await link('P1-A', ids.P1, 'wedding', ids.A, 'manages')
    await membership('planner1-A', actors.planner1, ids.A, 'planner')

    // Planner with THREE weddings.
    actors.plannerMany = await user('plannerMany', 'planner')
    ids.PM = await business('planning-many', 'planning_company', { userId: actors.plannerMany, role: 'business_owner' })
    for (const w of ['A', 'B', 'C']) {
      await link(`PM-${w}`, ids.PM, 'wedding', ids[w], 'manages')
      await membership(`plannerMany-${w}`, actors.plannerMany, ids[w], 'planner')
    }

    // Planner with ZERO weddings: a legitimate planning business, nothing else.
    actors.plannerZero = await user('plannerZero', 'planner')
    ids.PZ = await business('planning-zero', 'planning_company', { userId: actors.plannerZero, role: 'business_owner' })

    // Coordinator: dashboard class planner, WeddingMembership coordinator on B via a governed business.
    actors.coordinator = await user('coordinator', 'planner')
    const coordinatorBusinessOwner = await user('coordinator-business-owner', 'planner')
    ids.PC = await business('planning-coord', 'planning_company', { userId: coordinatorBusinessOwner, role: 'business_owner' })
    await member('coordinator-bam', ids.PC, actors.coordinator, 'coordinator')
    await link('PC-B', ids.PC, 'wedding', ids.B, 'manages')
    await membership('coordinator-B', actors.coordinator, ids.B, 'coordinator')

    // Multi-axis: couple class; owns D; plans C through a planning company; operates a vendor business.
    actors.multi = await user('multi', 'couple')
    await membership('multi-owner-D', actors.multi, ids.D, 'owner')
    ids.PX = await business('planning-multi', 'planning_company', { userId: actors.multi, role: 'business_owner' })
    await link('PX-C', ids.PX, 'wedding', ids.C, 'manages')
    await membership('multi-planner-C', actors.multi, ids.C, 'planner')
    ids.VX = await business('vendor-multi', 'vendor', { userId: actors.multi, role: 'business_owner' })
    await providerProfile('vendor-multi-profile', ids.VX)

    // Viewer: a viewer membership on A only.
    actors.viewer = await user('viewer', 'couple')
    await membership('viewer-A', actors.viewer, ids.A, 'viewer')

    // Vendor with TWO businesses; business 1 operates a Vendor row on A with two engagements,
    // business 2 operates a Vendor row on B with none.
    actors.vendor = await user('vendor', 'vendor')
    ids.V1 = await business('vendor-1', 'vendor', { userId: actors.vendor, role: 'business_owner' })
    const vendor2Owner = await user('vendor-2-owner', 'vendor')
    ids.V2 = await business('vendor-2', 'vendor', { userId: vendor2Owner, role: 'business_owner' })
    await member('vendor-2-bam', ids.V2, actors.vendor, 'vendor_manager')
    await providerProfile('vendor-1-profile', ids.V1)
    await providerProfile('vendor-2-profile', ids.V2, 'claimed')
    ids.vendorRowA = await vendor('vendor-row-A', ids.A)
    ids.vendorRowB = await vendor('vendor-row-B', ids.B)
    ids.seA1 = await engagement('se-A1', ids.vendorRowA, ids.A)
    ids.seA2 = await engagement('se-A2', ids.vendorRowA, ids.A)
    // Canonical vendor entity links (20260730173000_wewed_business_admin_console): `represents`.
    await link('V1-vendorA', ids.V1, 'vendor', ids.vendorRowA, 'represents')
    await link('V2-vendorB', ids.V2, 'vendor', ids.vendorRowB, 'represents')

    // Suspended business membership and an invited (pending) wedding membership.
    actors.pending = await user('pending', 'planner')
    ids.PS = await business('planning-suspended', 'planning_company', { userId: actors.pending, role: 'business_owner', status: 'suspended' })
    await membership('pending-A', actors.pending, ids.A, 'planner', 'invited')

    // Admin class without Wewed-internal membership; with one; with an inactive registry row.
    actors.adminClassOnly = await user('admin-class-only', 'admin')
    actors.platformAdmin = await user('platform-admin', 'admin')
    ids.W = await business('wewed-internal', 'wewed_internal', { userId: actors.platformAdmin, role: 'wewed_support_admin' })
    actors.suspendedRegistryAdmin = await user('suspended-registry-admin', 'admin')
    await member('suspended-registry-bam', ids.W, actors.suspendedRegistryAdmin, 'wewed_super_admin')
    await platformRegistry(actors.suspendedRegistryAdmin, 'wewed_super_admin', 'suspended')

    // Canonical migrated Vendor: the backfill shape exactly — business `vendor-<Vendor.id>`
    // (vendor, active, complete, sourceType vendor), `represents` link to the Vendor row and a
    // `serves` link to its wedding — plus the eligibility the backfill does not create (an
    // operating member and a published listing).
    ids.canonicalVendorRow = await vendor('canonical-row', ids.C)
    ids.canonicalSe = await engagement('canonical-se', ids.canonicalVendorRow, ids.C)
    actors.canonicalVendor = await user('canonical-vendor', 'vendor')
    ids.canonicalBusiness = `vendor-${ids.canonicalVendorRow}`
    await db.$transaction([
      db.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BusinessAccount" (id, name, slug, type, status, "sourceType", "sourceId", "onboardingStatus", "subscriptionPlan", "subscriptionStatus", "ownerUserId")
         VALUES ($1, 'Canonical Vendor', $1, 'vendor', 'active', 'vendor', $2, 'complete', 'free', 'free', $3)`,
        ids.canonicalBusiness, ids.canonicalVendorRow, actors.canonicalVendor,
      ),
      db.$executeRawUnsafe(
        `INSERT INTO wewed_admin."BusinessAccountMember" (id, "businessAccountId", "userId", role, status)
         VALUES ($1, $2, $3, 'business_owner', 'active')`,
        id('canonical-owner'), ids.canonicalBusiness, actors.canonicalVendor,
      ),
    ])
    await link('canonical-represents', ids.canonicalBusiness, 'vendor', ids.canonicalVendorRow, 'represents')
    await link('canonical-serves', ids.canonicalBusiness, 'wedding', ids.C, 'serves')
    await providerProfile('canonical-profile', ids.canonicalBusiness)

    // A vendor business whose Vendor link carries an unrecognised relationship.
    actors.unknownLinkVendor = await user('unknown-link-vendor', 'vendor')
    ids.VU = await business('vendor-unknown-link', 'vendor', { userId: actors.unknownLinkVendor, role: 'business_owner' })
    await providerProfile('vendor-unknown-link-profile', ids.VU)
    ids.unknownLinkRow = await vendor('unknown-link-row', ids.D)
    await link('VU-vendor', ids.VU, 'vendor', ids.unknownLinkRow, 'partner_of')

    // Identity: a verified identity with a banned profile, and one with no profile row at all.
    actors.bannedCouple = await user('banned-couple', 'couple')
    await membership('banned-owner-C', actors.bannedCouple, ids.C, 'owner')
    await userProfile(`auth-${actors.bannedCouple}`, true)
    actors.noProfileCouple = await user('no-profile-couple', 'couple')
    await membership('no-profile-owner-D', actors.noProfileCouple, ids.D, 'owner')

    actors.inactive = await user('inactive', 'couple', { isActive: false })
    await membership('inactive-owner-B', actors.inactive, ids.B, 'owner')
  })

  afterAll(async () => {
    await db?.$disconnect()
  })

  const grantIds = async (actor: string) =>
    (await resolve(actors[actor])).workspaceGrants.map((g) => g.grantId)

  test('Couple: an active owner membership grants a Couple workspace on that wedding', async () => {
    expect(await grantIds('couple')).toEqual([`couple:wedding:${ids.A}`])
  })

  test('Planner with one wedding: portfolio plus that one wedding', async () => {
    expect(await grantIds('planner1')).toEqual([`planner:portfolio:${ids.P1}`, `planner:wedding:${ids.A}`])
  })

  test('Planner with multiple weddings: every real wedding survives, none is chosen for them', async () => {
    const authority = await resolve(actors.plannerMany)
    const weddings = authority.workspaceGrants.filter((g) => g.scopeKind === 'wedding').map((g) => g.weddingId)
    expect(weddings.sort()).toEqual([ids.A, ids.B, ids.C].sort())
    expect(authority.contextSelection.find((s) => s.workspaceKind === 'planner')?.selectionRequired).toBe(true)
  })

  test('Planner with zero weddings: a portfolio grant and no wedding at all, real or fake', async () => {
    const authority = await resolve(actors.plannerZero)
    expect(authority.workspaceGrants).toHaveLength(1)
    const [portfolio] = authority.workspaceGrants
    expect(portfolio).toMatchObject({ workspaceKind: 'planner', scopeKind: 'portfolio', weddingId: null, businessAccountId: ids.PZ })
  })

  test('Coordinator: derived from WeddingMembership, not from a planner grant or the dashboard class', async () => {
    const authority = await resolve(actors.coordinator)
    expect(authority.identity?.dashboardClass).toBe('planner')
    expect(authority.workspaceGrants.map((g) => g.grantId)).toEqual([`coordinator:wedding:${ids.B}`])
    expect(authority.nonGrantingRelationships).toContainEqual({
      source: { kind: 'business_membership', id: id('coordinator-bam') },
      reason: 'business_role_not_workspace',
    })
  })

  test('Multi-axis actor: every legitimate relationship survives independently', async () => {
    expect(await grantIds('multi')).toEqual([
      `couple:wedding:${ids.D}`,
      `planner:portfolio:${ids.PX}`,
      `planner:wedding:${ids.C}`,
      `vendor:business:${ids.VX}`,
    ])
  })

  test('Viewer: visible as evidence, no native workspace', async () => {
    const authority = await resolve(actors.viewer)
    expect(authority.workspaceGrants).toEqual([])
    expect(authority.weddingMemberships.map((m) => m.role)).toEqual(['viewer'])
    expect(authority.nonGrantingRelationships.map((r) => r.reason)).toEqual(['viewer_relationship'])
  })

  test('Vendor: two businesses both survive; wedding work maps only through real links and engagements', async () => {
    const authority = await resolve(actors.vendor)
    expect(authority.workspaceGrants.map((g) => g.grantId)).toEqual([
      `vendor:business:${ids.V1}`,
      `vendor:business:${ids.V2}`,
      `vendor:wedding:${ids.V1}:${ids.vendorRowA}`,
      `vendor:wedding:${ids.V2}:${ids.vendorRowB}`,
    ])
    const onA = authority.workspaceGrants.find((g) => g.vendorId === ids.vendorRowA)!
    expect(onA.weddingId).toBe(ids.A)
    expect(onA.serviceEngagementIds.sort()).toEqual([ids.seA1, ids.seA2].sort())
    const onB = authority.workspaceGrants.find((g) => g.vendorId === ids.vendorRowB)!
    expect(onB.serviceEngagementIds).toEqual([]) // none exist, none invented
  })

  test('Suspended business membership and invited wedding membership grant nothing, and stay unchanged', async () => {
    const authority = await resolve(actors.pending)
    expect(authority.workspaceGrants).toEqual([])
    expect(authority.onboarding.invitedWeddingMembershipIds).toEqual([id('pending-A')])
    // Read-only: the resolver never accepts a pending membership (unlike /api/auth/me).
    const rows = await db.$queryRawUnsafe<Array<{ status: string }>>(
      `SELECT status FROM public."WeddingMembership" WHERE id = $1`, id('pending-A'),
    )
    expect(rows[0].status).toBe('invited')
  })

  test('Platform Admin: the admin class alone is not enough; exact internal role is preserved', async () => {
    const classOnly = await resolve(actors.adminClassOnly)
    expect(classOnly.workspaceGrants).toEqual([])
    expect(classOnly.nonGrantingRelationships.map((r) => r.reason)).toContain('legacy_global_admin_wedding_access')

    const admin = await resolve(actors.platformAdmin)
    expect(admin.workspaceGrants).toEqual([
      expect.objectContaining({ grantId: 'admin:system', scopeKind: 'system', weddingId: null, platformRoles: ['wewed_support_admin'] }),
    ])
    expect(admin.platform.internalMemberships.map((m) => m.role)).toEqual(['wewed_support_admin'])
    // The registry is trigger-synced from the internal membership, so it is the effective source.
    expect(admin.platform.registry.state).toBe('active')
    expect(admin.platform.effectiveSource).toBe('platform_registry')
    expect(admin.platform.effectiveRole).toBe('wewed_support_admin')

    const suspended = await resolve(actors.suspendedRegistryAdmin)
    expect(suspended.workspaceGrants).toEqual([])
    expect(suspended.platform.registry.state).toBe('inactive')
  })

  test('Inactive and unknown identities carry no grants', async () => {
    expect((await resolve(actors.inactive)).accountStatus).toBe('inactive_identity')
    expect(await grantIds('inactive')).toEqual([])
    const unknown = await resolve(id('nobody'))
    expect(unknown.accountStatus).toBe('unknown_identity')
    expect(unknown.workspaceGrants).toEqual([])
  })

  test('Guest and Usher/Gate never appear as account grants, and are declared unsupported', async () => {
    for (const actor of Object.keys(actors)) {
      const authority = await resolve(actors[actor])
      for (const grant of authority.workspaceGrants) {
        expect(['couple', 'planner', 'coordinator', 'vendor', 'admin']).toContain(grant.workspaceKind)
      }
      expect(authority.unsupported.map((u) => u.authority)).toEqual(['guest', 'usher_gate'])
    }
  })

  test('The contract is JSON-serialisable without loss', async () => {
    const authority = await resolve(actors.multi)
    expect(JSON.parse(JSON.stringify(authority))).toEqual(authority)
  })

  // ---------------------------------------------------------------------------------------------
  // Phase 2 review closure
  // ---------------------------------------------------------------------------------------------

  test('Vendor: the canonical migrated Vendor (represents) receives its business and wedding grants', async () => {
    const authority = await resolve(actors.canonicalVendor)
    expect(authority.workspaceGrants.map((g) => g.grantId)).toEqual([
      `vendor:business:${ids.canonicalBusiness}`,
      `vendor:wedding:${ids.canonicalBusiness}:${ids.canonicalVendorRow}`,
    ])
    const onWedding = authority.workspaceGrants[1]
    expect(onWedding.weddingId).toBe(ids.C)
    expect(onWedding.serviceEngagementIds).toEqual([ids.canonicalSe])
    // The companion wedding `serves` link is evidence, not a substitute grant.
    expect(authority.businessLinks.map((l) => `${l.entityType}:${l.relationship}`).sort()).toEqual(['vendor:represents', 'wedding:serves'])
  })

  test('Vendor: an unrecognised vendor-link relationship is denied', async () => {
    const authority = await resolve(actors.unknownLinkVendor)
    expect(authority.workspaceGrants.map((g) => g.grantId)).toEqual([`vendor:business:${ids.VU}`])
    expect(authority.nonGrantingRelationships).toContainEqual({
      source: { kind: 'business_link', id: id('VU-vendor') },
      reason: 'vendor_link_relationship_not_recognised',
    })
  })

  test('Vendor: a Vendor link held by Business A never grants Business B', async () => {
    // actors.vendor operates V1 and V2; the canonical business belongs to someone else entirely.
    const authority = await resolve(actors.vendor)
    expect(authority.workspaceGrants.some((g) => g.businessAccountId === ids.canonicalBusiness)).toBe(false)
    expect(authority.workspaceGrants.some((g) => g.vendorId === ids.canonicalVendorRow)).toBe(false)
    const v2 = authority.workspaceGrants.filter((g) => g.businessAccountId === ids.V2 && g.scopeKind === 'wedding')
    expect(v2.map((g) => g.vendorId)).toEqual([ids.vendorRowB]) // only V2's own link, never V1's
  })

  test('Identity: an active user without a verified auth identity gets no grants', async () => {
    for (const authUserId of [null, '', '  ']) {
      const authority = await resolve(actors.couple, authUserId)
      expect(authority.accountStatus).toBe('unverified_auth_identity')
      expect(authority.workspaceGrants).toEqual([])
    }
  })

  test('Identity: a verified auth identity with no UserProfile row is authorized normally', async () => {
    const authority = await resolve(actors.noProfileCouple)
    expect(authority.accountStatus).toBe('authorized')
    expect(authority.workspaceGrants.map((g) => g.grantId)).toEqual([`couple:wedding:${ids.D}`])
  })

  test('Identity: a verified auth identity whose UserProfile is banned gets no grants', async () => {
    const authority = await resolve(actors.bannedCouple)
    expect(authority.accountStatus).toBe('banned_identity')
    expect(authority.workspaceGrants).toEqual([])
  })

  // ---------------------------------------------------------------------------------------------
  // Part H — agreement with existing PWA authority
  // ---------------------------------------------------------------------------------------------

  test('PWA agreement: accessible weddings, membership roles and permissions match listAccessibleWeddings', async () => {
    for (const actor of ['couple', 'planner1', 'plannerMany', 'plannerZero', 'coordinator', 'multi', 'viewer', 'pending']) {
      const authority = await resolve(actors[actor])
      const dashboardClass = authority.identity!.dashboardClass as 'couple' | 'planner' | 'vendor'
      const pwa = await listAccessibleWeddings(actors[actor], dashboardClass)
      const contract = authority.weddingMemberships
        .filter((m) => m.governedAccess && (m.status === 'active' || m.status === 'invited'))
      const key = (w: { id?: string; weddingId?: string; membershipRole?: string; role?: string; membershipStatus?: string; status?: string; permissions: string[] }) =>
        `${w.id ?? w.weddingId}|${w.membershipRole ?? w.role}|${w.membershipStatus ?? w.status}|${[...w.permissions].sort().join(',')}`
      expect(contract.map(key).sort()).toEqual(pwa.map(key).sort())
    }
  })

  test('PWA agreement: platform-admin eligibility matches isWewedPlatformAdministrator', async () => {
    for (const actor of ['adminClassOnly', 'platformAdmin', 'suspendedRegistryAdmin', 'couple', 'planner1']) {
      const authority = await resolve(actors[actor])
      const gate = await isWewedPlatformAdministrator(actors[actor])
      const hasSystemGrant = authority.workspaceGrants.some((g) => g.workspaceKind === 'admin')
      // A system grant requires the PWA entry gate; the gate can pass while the effective
      // membership is denied by an inactive registry row (requireWewedAdmin), which is stricter.
      if (hasSystemGrant) expect(gate).toBe(true)
      if (!gate) expect(hasSystemGrant).toBe(false)
    }
    expect(await isWewedPlatformAdministrator(actors.suspendedRegistryAdmin)).toBe(true)
  })

  test('PWA agreement: /api/auth/me selects ONE workspace; the contract enumerates every legitimate one', async () => {
    process.env.WEWED_E2E_MODE = '1'
    process.env.CI = 'true'
    delete process.env.VERCEL
    const { GET } = await import('@/app/api/auth/me/route')
    const { APP_SESSION_COOKIE, createAppSessionToken } = await import('@/lib/app-session')
    const { NextRequest } = await import('next/server')

    async function authMe(actor: string, role: 'couple' | 'planner' | 'vendor' | 'admin', coupleId: string | null = null) {
      const token = createAppSessionToken({
        userId: actors[actor], authUserId: `auth-${actors[actor]}`, email: `${actors[actor]}@example.test`,
        // The PWA session requires a non-empty value; /auth/me re-selects the workspace itself.
        role, coupleId, activeWeddingId: 'session-probe',
      })
      const response = await GET(new NextRequest('http://localhost/api/auth/me', {
        headers: { cookie: `${APP_SESSION_COOKIE}=${token}` },
      }))
      return response.json() as Promise<Record<string, unknown>>
    }

    // Vendor: /auth/me picks one business (LIMIT 1); it must be one the contract also grants.
    const vendorMe = await authMe('vendor', 'vendor')
    expect(vendorMe.workspace).toBe('vendor_portfolio')
    const vendorGrants = (await resolve(actors.vendor)).workspaceGrants
      .filter((g) => g.scopeKind === 'business').map((g) => g.businessAccountId)
    expect(vendorGrants).toContain(vendorMe.businessAccountId as string)
    expect(vendorGrants).toHaveLength(2)

    // Planner with zero weddings: both agree on portfolio authority.
    expect((await authMe('plannerZero', 'planner')).workspace).toBe('planner_portfolio')

    // Coordinator: /auth/me lists the coordinator membership; the contract grants Coordinator on it.
    const coordinatorMe = await authMe('coordinator', 'planner')
    const weddings = coordinatorMe.weddings as Array<{ id: string; membershipRole: string }>
    expect(weddings.map((w) => [w.id, w.membershipRole])).toEqual([[ids.B, 'coordinator']])

    // Platform admin: both agree on the platform workspace.
    expect((await authMe('platformAdmin', 'admin')).workspace).toBe('wewed_platform')
  })
})
