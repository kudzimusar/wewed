/**
 * Pure rules of WewedProductionAuthorityV1 (no database) and the shared cross-platform fixture.
 *
 * The fixture at mobile/fixtures/production-authority-v1/multi-axis-actor.json is produced by
 * buildProductionAuthority from the evidence below and decoded by the Android and iOS contract
 * tests, so all three platforms hold one byte-identical contract. Regenerate deliberately with
 * UPDATE_AUTHORITY_FIXTURE=1.
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { BusinessMembershipEvidence, ProductionAuthorityEvidence, WeddingMembershipEvidence } from './contract'
import { INTERNAL_ADMIN_ROLES, buildProductionAuthority } from './grants'

const FIXTURE = 'mobile/fixtures/production-authority-v1/multi-axis-actor.json'

function wedding(id: string, role: string, extra: Partial<WeddingMembershipEvidence> = {}): WeddingMembershipEvidence {
  return {
    membershipId: `wm-${id}-${role}`, weddingId: id, slug: id, title: `Wedding ${id}`,
    date: '2027-06-12T12:00:00.000Z', coupleId: `couple-${id}`, role, status: 'active',
    governedAccess: true, permissions: role === 'owner' ? ['*'] : ['planner.view'], ...extra,
  }
}

function business(id: string, type: string, role: string, extra: Partial<BusinessMembershipEvidence> = {}): BusinessMembershipEvidence {
  return {
    membershipId: `bam-${id}`, businessAccountId: id, businessName: `Business ${id}`, businessType: type,
    businessStatus: 'active', onboardingStatus: 'complete', subscriptionStatus: 'free', ownerUserId: 'user-1',
    role, status: 'active', permissions: [], ...extra,
  }
}

function evidence(overrides: Partial<ProductionAuthorityEvidence> = {}): ProductionAuthorityEvidence {
  return {
    identity: {
      accessUserId: 'user-1', authUserId: 'auth-1', email: 'actor@example.test', name: 'Synthetic Actor',
      userRole: 'admin', coupleId: 'couple-A', isActive: true,
    },
    profile: { displayName: 'Synthetic Actor', profileRole: 'viewer', isBanned: false },
    businessMemberships: [],
    businessLinks: [],
    providerProfiles: [],
    weddingMemberships: [],
    vendorEngagements: [],
    platformRegistry: { state: 'missing', role: null, status: null, scopes: [] },
    ...overrides,
  }
}

/** One synthetic identity legitimately holding every grant kind the contract can prove. */
const multiAxis = evidence({
  weddingMemberships: [
    wedding('A', 'owner'),
    wedding('B', 'planner'),
    wedding('C', 'coordinator'),
    wedding('D', 'viewer'),
    wedding('E', 'planner', { status: 'invited' }),
  ],
  businessMemberships: [
    business('planning-1', 'planning_company', 'business_owner', { permissions: ['weddings.manage'] }),
    business('vendor-1', 'vendor', 'business_owner'),
    business('venue-1', 'venue', 'venue_manager'),
    business('wewed', 'wewed_internal', 'wewed_operations_admin'),
  ],
  businessLinks: [
    { linkId: 'bal-1', businessAccountId: 'planning-1', entityType: 'wedding', entityId: 'B', relationship: 'manages' },
    { linkId: 'bal-2', businessAccountId: 'vendor-1', entityType: 'vendor', entityId: 'vendor-row-F', relationship: 'owns' },
  ],
  providerProfiles: [{ businessAccountId: 'vendor-1', listingStatus: 'verified', visibility: 'published', isClaimable: false }],
  vendorEngagements: [{
    businessAccountId: 'vendor-1', linkId: 'bal-2', linkRelationship: 'owns', vendorId: 'vendor-row-F',
    vendorName: 'Vendor F', weddingId: 'F',
    serviceEngagements: [{ serviceEngagementId: 'se-1', lifecycleStatus: 'active', origin: 'booking', recordMode: 'live' }],
  }],
  platformRegistry: { state: 'active', role: 'wewed_operations_admin', status: 'active', scopes: [{ scopeType: 'global', scopeValue: '*' }] },
})

describe('WewedProductionAuthorityV1 — pure rules', () => {
  test('one identity keeps every grant kind independently', () => {
    const authority = buildProductionAuthority(multiAxis)
    expect(authority.workspaceGrants.map((g) => g.grantId)).toEqual([
      'couple:wedding:A',
      'planner:portfolio:planning-1',
      'planner:wedding:B',
      'coordinator:wedding:C',
      'vendor:business:vendor-1',
      'vendor:wedding:vendor-1:vendor-row-F',
      'admin:system',
    ])
    expect(authority.workspaceGrants.find((g) => g.grantId === 'admin:system')?.platformRoles).toEqual(['wewed_operations_admin'])
  })

  test('viewer, invited and venue relationships are evidence without workspaces', () => {
    const reasons = buildProductionAuthority(multiAxis).nonGrantingRelationships.map((r) => `${r.source.id}:${r.reason}`)
    expect(reasons).toContain('wm-D-viewer:viewer_relationship')
    expect(reasons).toContain('wm-E-planner:membership_not_active')
    expect(reasons).toContain('bam-venue-1:business_type_not_workspace')
  })

  test('an unrecognised wedding role never becomes a workspace', () => {
    const authority = buildProductionAuthority(evidence({ weddingMemberships: [wedding('A', 'usher'), wedding('B', 'admin')] }))
    expect(authority.workspaceGrants).toEqual([])
  })

  test('ungoverned wedding access grants nothing, as in the PWA', () => {
    const authority = buildProductionAuthority(evidence({ weddingMemberships: [wedding('A', 'planner', { governedAccess: false })] }))
    expect(authority.workspaceGrants).toEqual([])
    expect(authority.nonGrantingRelationships[0].reason).toBe('wedding_access_not_governed')
  })

  test('the dashboard class alone grants nothing — not Couple, not Admin', () => {
    for (const userRole of ['couple', 'planner', 'vendor', 'admin', 'viewer']) {
      const authority = buildProductionAuthority(evidence({ identity: { ...evidence().identity!, userRole } }))
      expect(authority.workspaceGrants).toEqual([])
    }
  })

  test('admin: an inactive registry row denies even with an active internal membership', () => {
    const authority = buildProductionAuthority(evidence({
      businessMemberships: [business('wewed', 'wewed_internal', 'wewed_super_admin')],
      platformRegistry: { state: 'inactive', role: 'wewed_super_admin', status: 'suspended', scopes: [] },
    }))
    expect(authority.workspaceGrants).toEqual([])
    expect(authority.platform.internalMemberships.map((m) => m.role)).toEqual(['wewed_super_admin'])
  })

  test('admin: with no registry row the highest legacy internal role is effective', () => {
    const authority = buildProductionAuthority(evidence({
      businessMemberships: [business('w1', 'wewed_internal', 'wewed_analyst'), business('w2', 'wewed_internal', 'wewed_billing_admin')],
    }))
    expect(authority.platform.effectiveSource).toBe('legacy_membership')
    expect(authority.workspaceGrants[0].platformRoles).toEqual(['wewed_billing_admin'])
    // Every internal role is preserved as evidence, not reduced to a boolean.
    expect(authority.platform.internalMemberships.map((m) => m.role)).toEqual(['wewed_analyst', 'wewed_billing_admin'])
  })

  test('admin: an internal membership without the admin class grants no system workspace', () => {
    const authority = buildProductionAuthority(evidence({
      identity: { ...evidence().identity!, userRole: 'planner' },
      businessMemberships: [business('wewed', 'wewed_internal', 'wewed_super_admin')],
    }))
    expect(authority.workspaceGrants).toEqual([])
  })

  test('vendor: unpublished listing, non-operator role and unknown link relationship all fail closed', () => {
    const authority = buildProductionAuthority(evidence({
      businessMemberships: [
        business('v-draft', 'vendor', 'business_owner'),
        business('v-viewer', 'vendor', 'viewer'),
        business('v-ok', 'vendor', 'vendor_manager'),
      ],
      providerProfiles: [
        { businessAccountId: 'v-draft', listingStatus: 'verified', visibility: 'draft', isClaimable: false },
        { businessAccountId: 'v-viewer', listingStatus: 'verified', visibility: 'published', isClaimable: false },
        { businessAccountId: 'v-ok', listingStatus: 'claimed', visibility: 'published', isClaimable: false },
      ],
      vendorEngagements: [{
        businessAccountId: 'v-ok', linkId: 'bal-x', linkRelationship: 'represents', vendorId: 'vr', vendorName: 'V',
        weddingId: 'W', serviceEngagements: [],
      }],
    }))
    expect(authority.workspaceGrants.map((g) => g.grantId)).toEqual(['vendor:business:v-ok'])
    expect(authority.nonGrantingRelationships.map((r) => r.reason)).toEqual(
      expect.arrayContaining(['provider_profile_not_published', 'business_role_not_workspace', 'vendor_link_relationship_not_recognised']),
    )
  })

  test('planner portfolio needs an active, complete planning company and a planner business role', () => {
    const authority = buildProductionAuthority(evidence({
      businessMemberships: [
        business('p-incomplete', 'planning_company', 'business_owner', { onboardingStatus: 'in_progress' }),
        business('p-coordinator', 'planning_company', 'coordinator'),
        business('p-ok', 'planning_company', 'planner'),
      ],
    }))
    expect(authority.workspaceGrants.map((g) => [g.grantId, g.weddingId])).toEqual([['planner:portfolio:p-ok', null]])
  })

  test('banned, inactive and unknown identities carry no grants', () => {
    expect(buildProductionAuthority({ ...multiAxis, profile: { ...multiAxis.profile!, isBanned: true } }).workspaceGrants).toEqual([])
    expect(buildProductionAuthority({ ...multiAxis, identity: { ...multiAxis.identity!, isActive: false } }).workspaceGrants).toEqual([])
    expect(buildProductionAuthority({ ...multiAxis, identity: null }).accountStatus).toBe('unknown_identity')
  })

  test('context selection is required whenever a kind has more than one grant; none is pre-selected', () => {
    const selection = buildProductionAuthority(multiAxis).contextSelection
    expect(selection.find((s) => s.workspaceKind === 'planner')).toEqual({
      workspaceKind: 'planner', grantIds: ['planner:portfolio:planning-1', 'planner:wedding:B'], selectionRequired: true,
    })
    expect(selection.find((s) => s.workspaceKind === 'couple')?.selectionRequired).toBe(false)
  })

  test('Guest and Usher/Gate are declared unsupported and never granted', () => {
    const authority = buildProductionAuthority(multiAxis)
    expect(authority.unsupported.map((u) => u.authority)).toEqual(['guest', 'usher_gate'])
    expect(authority.workspaceGrants.some((g) => (g.workspaceKind as string) === 'guest' || (g.workspaceKind as string) === 'usher')).toBe(false)
  })

  test('the internal admin role list matches the PWA platform gate exactly', async () => {
    const source = await Bun.file('src/lib/business-access.ts').text()
    for (const role of INTERNAL_ADMIN_ROLES) expect(source).toContain(`'${role}'`)
    const exported = source.slice(source.indexOf('WEWED_INTERNAL_ADMIN_ROLES'), source.indexOf('] as const'))
    expect([...(exported.match(/'wewed_[a-z_]+'/g) ?? [])]).toEqual(INTERNAL_ADMIN_ROLES.map((r) => `'${r}'`))
  })

  test('the resolver is read-only: it issues SELECT statements and nothing else', async () => {
    const resolver = (await Bun.file('src/lib/production-authority/resolver.ts').text())
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(resolver).not.toMatch(/\b(INSERT|UPDATE|DELETE|UPSERT|ALTER|TRUNCATE)\b/)
    expect(resolver).not.toMatch(/\$executeRaw|setAppSessionCookie|acceptPendingMemberships|currentWeddingId/)
  })

  test('shared fixture: the Android/iOS contract fixture is exactly what the builder produces', () => {
    const serialised = `${JSON.stringify(buildProductionAuthority(multiAxis), null, 2)}\n`
    if (process.env.UPDATE_AUTHORITY_FIXTURE === '1' || !existsSync(FIXTURE)) {
      mkdirSync(dirname(FIXTURE), { recursive: true })
      writeFileSync(FIXTURE, serialised)
    }
    expect(readFileSync(FIXTURE, 'utf8')).toBe(serialised)
  })
})
