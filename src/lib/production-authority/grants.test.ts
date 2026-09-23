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
import type {
  BusinessMembershipEvidence,
  GateAssignmentEvidence,
  ProductionAuthorityEvidence,
  WeddingMembershipEvidence,
} from './contract'
import { INTERNAL_ADMIN_ROLES, RECOGNISED_VENDOR_LINK_RELATIONSHIPS, buildProductionAuthority } from './grants'

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

function gateAssignment(id: string, weddingId: string, gateId: string, role = 'usher', extra: Partial<GateAssignmentEvidence> = {}): GateAssignmentEvidence {
  return {
    assignmentId: `ga-${id}`,
    weddingId,
    weddingTitle: `Wedding ${weddingId}`,
    gateId,
    gateName: `Gate ${gateId}`,
    gateStatus: 'active',
    userId: 'user-1',
    operatorRole: role,
    capabilities: ['gate.manifest.read', 'gate.checkin.write', 'gate.guest_search.read', 'gate.audit.read'],
    activeFrom: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    revokedAt: null,
    revokedByUserId: null,
    createdByUserId: 'admin-user',
    ...extra,
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
    gateAssignments: [],
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
    { linkId: 'bal-2', businessAccountId: 'vendor-1', entityType: 'vendor', entityId: 'vendor-row-F', relationship: 'represents' },
    { linkId: 'bal-3', businessAccountId: 'vendor-1', entityType: 'wedding', entityId: 'F', relationship: 'serves' },
  ],
  providerProfiles: [{ businessAccountId: 'vendor-1', listingStatus: 'verified', visibility: 'published', isClaimable: false }],
  vendorEngagements: [{
    businessAccountId: 'vendor-1', linkId: 'bal-2', linkRelationship: 'represents', vendorId: 'vendor-row-F',
    vendorName: 'Vendor F', weddingId: 'F',
    serviceEngagements: [{ serviceEngagementId: 'se-1', lifecycleStatus: 'active', origin: 'booking', recordMode: 'live' }],
  }],
  platformRegistry: { state: 'active', role: 'wewed_operations_admin', status: 'active', scopes: [{ scopeType: 'global', scopeValue: '*' }] },
  gateAssignments: [
    gateAssignment('1', 'B', 'gate-1'),
  ],
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
    expect(authority.operationalGrants.map((g) => g.grantId)).toEqual(['gate_operator:B:gate-1'])
    expect(authority.gateContextSelection).toEqual({
      kind: 'gate_operator',
      grantIds: ['gate_operator:B:gate-1'],
      selectionRequired: false,
    })
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
        businessAccountId: 'v-ok', linkId: 'bal-x', linkRelationship: 'partner_of', vendorId: 'vr', vendorName: 'V',
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

  test('Guest is declared unsupported; usher_gate is supported via operationalGrants', () => {
    const authority = buildProductionAuthority(multiAxis)
    expect(authority.unsupported.map((u) => u.authority)).toEqual(['guest'])
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

  // ------------------------------------------------------------------------------------------
  // Phase 2 review closure
  // ------------------------------------------------------------------------------------------

  const vendorBusinessA = business('vendor-A', 'vendor', 'business_owner')
  const vendorBusinessB = business('vendor-B', 'vendor', 'business_owner')
  const published = (id: string) => ({ businessAccountId: id, listingStatus: 'verified', visibility: 'published', isClaimable: false })
  const vendorLink = (businessAccountId: string, linkRelationship: string, vendorId = 'vendor-row') => ({
    businessAccountId, linkId: `bal-${businessAccountId}-${linkRelationship}`, linkRelationship, vendorId,
    vendorName: 'Vendor', weddingId: 'W', serviceEngagements: [],
  })

  test('vendor: the canonical `represents` entity link grants the wedding', () => {
    const authority = buildProductionAuthority(evidence({
      businessMemberships: [vendorBusinessA], providerProfiles: [published('vendor-A')],
      vendorEngagements: [vendorLink('vendor-A', 'represents')],
    }))
    expect(authority.workspaceGrants.map((g) => g.grantId)).toEqual(['vendor:business:vendor-A', 'vendor:wedding:vendor-A:vendor-row'])
  })

  test('vendor: every repository-sanctioned vendor entity relationship is accepted', () => {
    expect([...RECOGNISED_VENDOR_LINK_RELATIONSHIPS]).toEqual(['represents'])
    for (const relationship of RECOGNISED_VENDOR_LINK_RELATIONSHIPS) {
      const authority = buildProductionAuthority(evidence({
        businessMemberships: [vendorBusinessA], providerProfiles: [published('vendor-A')],
        vendorEngagements: [vendorLink('vendor-A', relationship)],
      }))
      expect(authority.workspaceGrants.some((g) => g.scopeKind === 'wedding')).toBe(true)
    }
  })

  test('vendor: the schema default `owns`, the wedding `serves` value and unknown values are denied', () => {
    for (const relationship of ['owns', 'serves', 'hosts', 'manages', 'partner_of', '']) {
      const authority = buildProductionAuthority(evidence({
        businessMemberships: [vendorBusinessA], providerProfiles: [published('vendor-A')],
        vendorEngagements: [vendorLink('vendor-A', relationship)],
      }))
      expect(authority.workspaceGrants.map((g) => g.grantId)).toEqual(['vendor:business:vendor-A'])
      expect(authority.nonGrantingRelationships.map((r) => r.reason)).toContain('vendor_link_relationship_not_recognised')
    }
  })

  test('vendor: a link held by Business A never grants Business B', () => {
    const authority = buildProductionAuthority(evidence({
      // The actor operates B only; A's canonical link must not surface as B's work.
      businessMemberships: [vendorBusinessB], providerProfiles: [published('vendor-A'), published('vendor-B')],
      vendorEngagements: [vendorLink('vendor-A', 'represents', 'row-of-A')],
    }))
    expect(authority.workspaceGrants.map((g) => g.grantId)).toEqual(['vendor:business:vendor-B'])
    expect(authority.workspaceGrants.some((g) => g.vendorId === 'row-of-A')).toBe(false)
  })

  test('identity: an active user without a verified auth identity gets no grants', () => {
    for (const authUserId of [null, '', '   ']) {
      const authority = buildProductionAuthority({ ...multiAxis, identity: { ...multiAxis.identity!, authUserId } })
      expect(authority.accountStatus).toBe('unverified_auth_identity')
      expect(authority.workspaceGrants).toEqual([])
    }
  })

  test('identity: a verified auth identity with no UserProfile row is authorized', () => {
    const authority = buildProductionAuthority({ ...multiAxis, profile: null })
    expect(authority.accountStatus).toBe('authorized')
    expect(authority.workspaceGrants.length).toBeGreaterThan(0)
  })

  test('identity: a banned profile, an inactive user and an unknown user get no grants', () => {
    const banned = buildProductionAuthority({ ...multiAxis, profile: { ...multiAxis.profile!, isBanned: true } })
    expect([banned.accountStatus, banned.workspaceGrants]).toEqual(['banned_identity', []])
    const inactive = buildProductionAuthority({ ...multiAxis, identity: { ...multiAxis.identity!, isActive: false } })
    expect([inactive.accountStatus, inactive.workspaceGrants]).toEqual(['inactive_identity', []])
    const unknown = buildProductionAuthority({ ...multiAxis, identity: null })
    expect([unknown.accountStatus, unknown.workspaceGrants]).toEqual(['unknown_identity', []])
  })

  test('identity: non-authorized results redact relationship evidence as well as grants', () => {
    for (const authority of [
      buildProductionAuthority({ ...multiAxis, identity: { ...multiAxis.identity!, authUserId: null } }),
      buildProductionAuthority({ ...multiAxis, profile: { ...multiAxis.profile!, isBanned: true } }),
      buildProductionAuthority({ ...multiAxis, identity: { ...multiAxis.identity!, isActive: false } }),
    ]) {
      expect(authority.identity).toBeNull()
      expect(authority.businessMemberships).toEqual([])
      expect(authority.businessLinks).toEqual([])
      expect(authority.weddingMemberships).toEqual([])
      expect(authority.vendorEngagements).toEqual([])
      expect(authority.platform.internalMemberships).toEqual([])
      expect(authority.platform.effectiveRole).toBeNull()
      expect(authority.onboarding.businesses).toEqual([])
      expect(authority.onboarding.invitedWeddingMembershipIds).toEqual([])
      expect(authority.workspaceGrants).toEqual([])
    }
  })

  test('admin: an unknown effective platform role never produces an Admin grant', () => {
    for (const role of ['wewed_root', 'admin', 'super_admin', '']) {
      const authority = buildProductionAuthority(evidence({
        businessMemberships: [business('wewed', 'wewed_internal', 'wewed_support_admin')],
        platformRegistry: { state: 'active', role, status: 'active', scopes: [] },
      }))
      expect(authority.workspaceGrants).toEqual([])
      expect(authority.platform.effectiveRole).toBe(role)
    }
  })

  // ------------------------------------------------------------------------------------------
  // Phase 10 — Usher / Gate operational authority
  // ------------------------------------------------------------------------------------------

  test('gate operator: an active, unexpired, unrevoked assignment on an active gate produces an operational grant', () => {
    const e = evidence({
      gateAssignments: [
        gateAssignment('1', 'wed-1', 'gate-1', 'usher', {
          capabilities: ['gate.manifest.read', 'gate.checkin.write'],
        }),
      ],
    })
    const auth = buildProductionAuthority(e)
    expect(auth.operationalGrants).toEqual([
      {
        grantId: 'gate_operator:wed-1:gate-1',
        kind: 'gate_operator',
        assignmentId: 'ga-1',
        weddingId: 'wed-1',
        weddingTitle: 'Wedding wed-1',
        gateId: 'gate-1',
        gateName: 'Gate gate-1',
        operatorUserId: 'user-1',
        capabilities: ['gate.manifest.read', 'gate.checkin.write'],
        sources: [{ kind: 'gate_assignment', id: 'ga-1' }],
      },
    ])
    expect(auth.gateContextSelection).toEqual({
      kind: 'gate_operator',
      grantIds: ['gate_operator:wed-1:gate-1'],
      selectionRequired: false,
    })
  })

  test('gate operator: revoked assignment produces assignment_revoked and no grant', () => {
    const e = evidence({
      gateAssignments: [
        gateAssignment('1', 'wed-1', 'gate-1', 'usher', {
          revokedAt: '2026-05-01T00:00:00.000Z',
          revokedByUserId: 'revoker-1',
        }),
      ],
    })
    const auth = buildProductionAuthority(e)
    expect(auth.operationalGrants).toEqual([])
    expect(auth.gateContextSelection).toBeNull()
    expect(auth.nonGrantingRelationships).toContainEqual({
      source: { kind: 'gate_assignment', id: 'ga-1' },
      reason: 'assignment_revoked',
    })
  })

  test('gate operator: future activeFrom produces assignment_not_yet_active and no grant', () => {
    const e = evidence({
      gateAssignments: [
        gateAssignment('1', 'wed-1', 'gate-1', 'usher', {
          activeFrom: '2099-01-01T00:00:00.000Z',
        }),
      ],
    })
    const auth = buildProductionAuthority(e)
    expect(auth.operationalGrants).toEqual([])
    expect(auth.gateContextSelection).toBeNull()
    expect(auth.nonGrantingRelationships).toContainEqual({
      source: { kind: 'gate_assignment', id: 'ga-1' },
      reason: 'assignment_not_yet_active',
    })
  })

  test('gate operator: past expiresAt produces assignment_expired and no grant', () => {
    const e = evidence({
      gateAssignments: [
        gateAssignment('1', 'wed-1', 'gate-1', 'usher', {
          expiresAt: '2020-01-01T00:00:00.000Z',
        }),
      ],
    })
    const auth = buildProductionAuthority(e)
    expect(auth.operationalGrants).toEqual([])
    expect(auth.gateContextSelection).toBeNull()
    expect(auth.nonGrantingRelationships).toContainEqual({
      source: { kind: 'gate_assignment', id: 'ga-1' },
      reason: 'assignment_expired',
    })
  })

  test('gate operator: disabled gate produces gate_disabled and no grant', () => {
    const e = evidence({
      gateAssignments: [
        gateAssignment('1', 'wed-1', 'gate-1', 'usher', {
          gateStatus: 'disabled',
        }),
      ],
    })
    const auth = buildProductionAuthority(e)
    expect(auth.operationalGrants).toEqual([])
    expect(auth.gateContextSelection).toBeNull()
    expect(auth.nonGrantingRelationships).toContainEqual({
      source: { kind: 'gate_assignment', id: 'ga-1' },
      reason: 'gate_disabled',
    })
  })

  test('gate operator: unsupported role produces operator_role_not_supported', () => {
    const e = evidence({
      gateAssignments: [
        gateAssignment('1', 'wed-1', 'gate-1', 'coordinator_operator'),
      ],
    })
    const auth = buildProductionAuthority(e)
    expect(auth.operationalGrants).toEqual([])
    expect(auth.nonGrantingRelationships).toContainEqual({
      source: { kind: 'gate_assignment', id: 'ga-1' },
      reason: 'operator_role_not_supported',
    })
  })

  test('gate operator: unrecognized capabilities are stripped; empty valid capabilities fails closed', () => {
    const e = evidence({
      gateAssignments: [
        gateAssignment('1', 'wed-1', 'gate-1', 'usher', {
          capabilities: ['gate.manifest.read', 'gate.invented_cap', 'admin.all'],
        }),
        gateAssignment('2', 'wed-1', 'gate-2', 'usher', {
          capabilities: ['gate.fake_cap'],
        }),
      ],
    })
    const auth = buildProductionAuthority(e)
    expect(auth.operationalGrants).toHaveLength(1)
    expect(auth.operationalGrants[0].gateId).toBe('gate-1')
    expect(auth.operationalGrants[0].capabilities).toEqual(['gate.manifest.read'])
    expect(auth.nonGrantingRelationships).toContainEqual({
      source: { kind: 'gate_assignment', id: 'ga-2' },
      reason: 'no_recognized_capabilities',
    })
  })

  test('gate operator: multiple active assignments require explicit gate context selection', () => {
    const e = evidence({
      gateAssignments: [
        gateAssignment('1', 'wed-1', 'gate-1'),
        gateAssignment('2', 'wed-1', 'gate-2'),
      ],
    })
    const auth = buildProductionAuthority(e)
    expect(auth.operationalGrants).toHaveLength(2)
    expect(auth.gateContextSelection).toEqual({
      kind: 'gate_operator',
      grantIds: ['gate_operator:wed-1:gate-1', 'gate_operator:wed-1:gate-2'],
      selectionRequired: true,
    })
  })

  test('gate operator: usher A at Gate A cannot operate Gate B', () => {
    const e = evidence({
      gateAssignments: [
        gateAssignment('1', 'wed-1', 'gate-A'),
      ],
    })
    const auth = buildProductionAuthority(e)
    expect(auth.operationalGrants.map((g) => g.gateId)).toEqual(['gate-A'])
    expect(auth.operationalGrants.some((g) => g.gateId === 'gate-B')).toBe(false)
  })

  test('operational grants are strictly separate from workspace grants', () => {
    const e = evidence({
      gateAssignments: [
        gateAssignment('1', 'wed-1', 'gate-1'),
      ],
    })
    const auth = buildProductionAuthority(e)
    expect(auth.workspaceGrants).toEqual([])
    expect(auth.operationalGrants).toHaveLength(1)
    expect(auth.contextSelection).toEqual([])
    expect(auth.gateContextSelection).not.toBeNull()
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
