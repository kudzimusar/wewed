/**
 * Derives WewedProductionAuthorityV1 from read-only evidence. Pure: no database, no side effects.
 *
 * Every rule here restates an existing Wewed access rule rather than inventing one; each is named
 * next to the PWA code it mirrors, and the comparison tests in production-authority.integration.test.ts
 * hold the two together. Where this contract is deliberately stricter than a PWA convenience, the
 * difference is stated and documented in WEWED_PRODUCTION_AUTHORITY_CONTRACT_V1.md.
 *
 * The flat dashboard class is never sufficient for a grant. Unknown or unsupported evidence grants
 * nothing (master plan Rule 4).
 */

import {
  PRODUCTION_AUTHORITY_CONTRACT,
  PRODUCTION_AUTHORITY_VERSION,
  WORKSPACE_KINDS,
  type BusinessMembershipEvidence,
  type ContextSelection,
  type NonGrantingRelationship,
  type ProductionAuthorityEvidence,
  type UnsupportedAuthority,
  type WewedProductionAuthorityV1,
  type WorkspaceGrant,
} from './contract'

/** Mirrors `isDashboardRole` in app-session.ts. */
const DASHBOARD_CLASSES = new Set(['admin', 'couple', 'planner', 'vendor'])

/** Mirrors `WEWED_INTERNAL_ADMIN_ROLES` / `isWewedPlatformAdministrator` in business-access.ts. */
export const INTERNAL_ADMIN_ROLES = [
  'wewed_super_admin',
  'wewed_operations_admin',
  'wewed_billing_admin',
  'wewed_support_admin',
  'wewed_analyst',
] as const

/** Business roles that carry planner portfolio authority in a planning company. */
const PLANNER_PORTFOLIO_BUSINESS_ROLES = new Set(['business_owner', 'planner'])

/** Mirrors `activeVendorIdentity` in /api/auth/me: the roles that may operate a vendor business. */
const VENDOR_BUSINESS_ROLES = new Set(['business_owner', 'vendor_manager'])

/** Mirrors `activeVendorIdentity`: a vendor must be a claimed/verified, published, unclaimable listing. */
const VENDOR_LISTING_STATUSES = new Set(['claimed', 'verified'])

/**
 * `BusinessAccountLink.relationship` values that mean "this business IS the Vendor on that
 * wedding", for `entityType = 'vendor'`. Derived from every repository path that writes a vendor
 * entity link — there is exactly one, the canonical backfill in
 * prisma/migrations/20260730173000_wewed_business_admin_console (`'vendor', v.id, 'represents'`).
 *
 * The schema default `owns` is NOT here: no repository path writes it for a vendor link. The
 * companion `entityType = 'wedding'` / `serves` link is not a substitute for the Vendor entity
 * link and grants nothing on its own. Anything unrecognised fails closed and is reported
 * (production values are a Phase 3 question).
 */
export const RECOGNISED_VENDOR_LINK_RELATIONSHIPS: ReadonlySet<string> = new Set(['represents'])

const UNSUPPORTED: UnsupportedAuthority[] = [
  {
    authority: 'guest',
    reason:
      'Guest identity is invitation-bound and carried by Guest Session v2; it is never an account workspace grant.',
  },
  {
    authority: 'usher_gate',
    reason:
      'No production Usher/Gate authority exists (master plan Phase 10). Nothing is inferred from coordinator, planner or admin relationships.',
  },
]

function isActiveCompleteBusiness(m: BusinessMembershipEvidence): boolean {
  return m.businessStatus === 'active' && m.onboardingStatus === 'complete'
}

function membershipSource(id: string) {
  return { kind: 'business_membership' as const, id }
}

/**
 * The membership the PWA admin gate would use. Mirrors `requireWewedAdmin` in wewed-admin.ts:
 * an active registry row wins; an inactive registry row denies outright; with no registry row the
 * highest-ranked active legacy internal membership is used.
 */
function effectiveAdmin(evidence: ProductionAuthorityEvidence): {
  role: string | null
  source: 'platform_registry' | 'legacy_membership' | null
} {
  const registry = evidence.platformRegistry
  if (registry.state === 'active') return { role: registry.role, source: 'platform_registry' }
  if (registry.state === 'inactive') return { role: null, source: null }

  const legacy = evidence.businessMemberships
    .filter((m) => m.businessType === 'wewed_internal' && m.status === 'active' && m.businessStatus === 'active')
    .sort((a, b) => rank(a.role) - rank(b.role))[0]
  return legacy ? { role: legacy.role, source: 'legacy_membership' } : { role: null, source: null }
}

function rank(role: string): number {
  const index = (INTERNAL_ADMIN_ROLES as readonly string[]).indexOf(role)
  return index === -1 ? INTERNAL_ADMIN_ROLES.length : index
}

/** Mirrors `isWewedPlatformAdministrator`: the entry gate `/api/auth/me` uses for the platform workspace. */
function passesPlatformEntryGate(evidence: ProductionAuthorityEvidence): boolean {
  return evidence.businessMemberships.some(
    (m) =>
      m.businessType === 'wewed_internal' &&
      m.status === 'active' &&
      m.businessStatus === 'active' &&
      (INTERNAL_ADMIN_ROLES as readonly string[]).includes(m.role),
  )
}

export function buildProductionAuthority(
  evidence: ProductionAuthorityEvidence,
): WewedProductionAuthorityV1 {
  const identity = evidence.identity
  const banned = evidence.profile?.isBanned ?? false
  // Mirrors /api/auth/me: a verified Supabase identity is required, and a banned UserProfile is
  // refused. A missing UserProfile row does not block an otherwise valid account.
  const verifiedAuthIdentity = Boolean(identity?.authUserId?.trim())
  const accountStatus: WewedProductionAuthorityV1['accountStatus'] = !identity
    ? 'unknown_identity'
    : !identity.isActive
      ? 'inactive_identity'
      : !verifiedAuthIdentity
        ? 'unverified_auth_identity'
        : banned
          ? 'banned_identity'
          : 'authorized'

  const admin = effectiveAdmin(evidence)
  const internalMemberships = evidence.businessMemberships
    .filter((m) => m.businessType === 'wewed_internal')
    .map((m) => ({
      membershipId: m.membershipId,
      businessAccountId: m.businessAccountId,
      role: m.role,
      status: m.status,
      businessStatus: m.businessStatus,
    }))

  const grants: WorkspaceGrant[] = []
  const nonGranting: NonGrantingRelationship[] = []

  if (accountStatus === 'authorized' && identity) {
    deriveWeddingGrants(evidence, grants, nonGranting)
    deriveBusinessGrants(evidence, grants, nonGranting)
    deriveVendorWeddingGrants(evidence, grants, nonGranting)

    // System Admin. `User.role = admin` is required (requireWewedAdmin) but never sufficient: the
    // platform entry gate and an effective internal membership must both hold, and the effective
    // role must be one of the sanctioned Wewed-internal roles. The database constrains
    // PlatformAdministrator.role to that set today; checking it here as well keeps the contract
    // fail-closed if Phase 3 finds schema drift.
    const entryGate = passesPlatformEntryGate(evidence)
    const sanctionedRole = admin.role !== null && (INTERNAL_ADMIN_ROLES as readonly string[]).includes(admin.role)
    if (identity.userRole === 'admin' && entryGate && sanctionedRole) {
      grants.push({
        grantId: 'admin:system',
        workspaceKind: 'admin',
        scopeKind: 'system',
        weddingId: null,
        weddingTitle: null,
        coupleId: null,
        businessAccountId: null,
        vendorId: null,
        serviceEngagementIds: [],
        permissions: [],
        platformRoles: [admin.role!],
        sources: [
          admin.source === 'platform_registry'
            ? { kind: 'platform_registry', id: identity.accessUserId }
            : membershipSource(
                internalMemberships.find((m) => m.role === admin.role && m.status === 'active')?.membershipId ??
                  identity.accessUserId,
              ),
        ],
      })
    } else {
      for (const m of internalMemberships) {
        nonGranting.push({ source: membershipSource(m.membershipId), reason: 'platform_membership_not_effective' })
      }
    }

    // The PWA opens every wedding, as a synthesized `admin` membership, to a `User.role = admin`
    // who fails the platform gate (listAccessibleWeddings). That is a legacy convenience, not a
    // relationship; it produces no grant here (master plan §8.15).
    if (identity.userRole === 'admin' && !entryGate) {
      nonGranting.push({
        source: { kind: 'account_class', id: identity.accessUserId },
        reason: 'legacy_global_admin_wedding_access',
      })
    }
  }

  grants.sort(compareGrants)

  const contextSelection: ContextSelection[] = WORKSPACE_KINDS.map((workspaceKind) => {
    const grantIds = grants.filter((g) => g.workspaceKind === workspaceKind).map((g) => g.grantId)
    return { workspaceKind, grantIds, selectionRequired: grantIds.length > 1 }
  }).filter((selection) => selection.grantIds.length > 0)

  // A denied/unverified account must not receive its relationship graph merely because no
  // workspace grant was issued. Phase 5 will put this contract behind verified auth transport,
  // but the contract itself remains fail-closed: non-authorized responses expose status only,
  // not identity PII, memberships, weddings, businesses, engagements or platform evidence.
  const exposeEvidence = accountStatus === 'authorized'

  return {
    contract: PRODUCTION_AUTHORITY_CONTRACT,
    version: PRODUCTION_AUTHORITY_VERSION,
    accountStatus,
    identity: exposeEvidence && identity
      ? {
          accessUserId: identity.accessUserId,
          authUserId: identity.authUserId,
          email: identity.email,
          displayName: evidence.profile?.displayName ?? identity.name,
          dashboardClass: identity.userRole,
          isDashboardClass: DASHBOARD_CLASSES.has(identity.userRole),
          coupleId: identity.coupleId,
          isActive: identity.isActive,
        }
      : null,
    businessMemberships: exposeEvidence ? evidence.businessMemberships : [],
    businessLinks: exposeEvidence ? evidence.businessLinks : [],
    weddingMemberships: exposeEvidence ? evidence.weddingMemberships : [],
    vendorEngagements: exposeEvidence ? evidence.vendorEngagements : [],
    platform: exposeEvidence
      ? {
          internalMemberships,
          registry: evidence.platformRegistry,
          effectiveRole: admin.role,
          effectiveSource: admin.source,
        }
      : {
          internalMemberships: [],
          registry: { state: 'missing', role: null, status: null, scopes: [] },
          effectiveRole: null,
          effectiveSource: null,
        },
    onboarding: exposeEvidence
      ? {
          userActive: identity?.isActive ?? false,
          profileBanned: banned,
          businesses: evidence.businessMemberships.map((m) => ({
            businessAccountId: m.businessAccountId,
            businessType: m.businessType,
            businessStatus: m.businessStatus,
            onboardingStatus: m.onboardingStatus,
            subscriptionStatus: m.subscriptionStatus,
            membershipStatus: m.status,
          })),
          invitedWeddingMembershipIds: evidence.weddingMemberships
            .filter((m) => m.status === 'invited')
            .map((m) => m.membershipId),
        }
      : {
          userActive: false,
          profileBanned: accountStatus === 'banned_identity',
          businesses: [],
          invitedWeddingMembershipIds: [],
        },
    workspaceGrants: grants,
    contextSelection,
    nonGrantingRelationships: nonGranting,
    unsupported: UNSUPPORTED,
  }
}

/**
 * Wedding-scoped grants from WeddingMembership. Mirrors listAccessibleWeddings: only memberships
 * that pass GOVERNED_WEDDING_ACCESS count, and only `active` ones are grants (the PWA accepts
 * `invited` ones as a side effect of /api/auth/me; this resolver never does).
 */
function deriveWeddingGrants(
  evidence: ProductionAuthorityEvidence,
  grants: WorkspaceGrant[],
  nonGranting: NonGrantingRelationship[],
) {
  for (const m of evidence.weddingMemberships) {
    const source = { kind: 'wedding_membership' as const, id: m.membershipId }
    if (m.status !== 'active') {
      nonGranting.push({ source, reason: 'membership_not_active' })
      continue
    }
    if (!m.governedAccess) {
      nonGranting.push({ source, reason: 'wedding_access_not_governed' })
      continue
    }
    const kind =
      m.role === 'owner' ? 'couple' : m.role === 'planner' ? 'planner' : m.role === 'coordinator' ? 'coordinator' : null
    if (!kind) {
      // `viewer`, and anything unrecognised, is evidence without a native workspace.
      nonGranting.push({ source, reason: 'viewer_relationship' })
      continue
    }
    grants.push({
      grantId: `${kind}:wedding:${m.weddingId}`,
      workspaceKind: kind,
      scopeKind: 'wedding',
      weddingId: m.weddingId,
      weddingTitle: m.title,
      coupleId: m.coupleId,
      businessAccountId: null,
      vendorId: null,
      serviceEngagementIds: [],
      permissions: m.permissions,
      platformRoles: [],
      sources: [source],
    })
  }
}

/** Business-level grants: planner portfolio and vendor business, one per legitimate business. */
function deriveBusinessGrants(
  evidence: ProductionAuthorityEvidence,
  grants: WorkspaceGrant[],
  nonGranting: NonGrantingRelationship[],
) {
  for (const m of evidence.businessMemberships) {
    if (m.businessType === 'wewed_internal') continue // platform axis, handled separately
    const source = membershipSource(m.membershipId)
    if (m.status !== 'active') {
      nonGranting.push({ source, reason: 'membership_not_active' })
      continue
    }
    if (!isActiveCompleteBusiness(m)) {
      nonGranting.push({ source, reason: 'business_not_active_or_incomplete' })
      continue
    }

    if (m.businessType === 'planning_company') {
      if (!PLANNER_PORTFOLIO_BUSINESS_ROLES.has(m.role)) {
        nonGranting.push({ source, reason: 'business_role_not_workspace' })
        continue
      }
      grants.push({
        grantId: `planner:portfolio:${m.businessAccountId}`,
        workspaceKind: 'planner',
        scopeKind: 'portfolio',
        weddingId: null,
        weddingTitle: null,
        coupleId: null,
        businessAccountId: m.businessAccountId,
        vendorId: null,
        serviceEngagementIds: [],
        permissions: m.permissions,
        platformRoles: [],
        sources: [source],
      })
      continue
    }

    if (m.businessType === 'vendor') {
      if (!VENDOR_BUSINESS_ROLES.has(m.role)) {
        nonGranting.push({ source, reason: 'business_role_not_workspace' })
        continue
      }
      if (!hasPublishedVendorListing(evidence, m.businessAccountId)) {
        nonGranting.push({ source, reason: 'provider_profile_not_published' })
        continue
      }
      grants.push({
        grantId: `vendor:business:${m.businessAccountId}`,
        workspaceKind: 'vendor',
        scopeKind: 'business',
        weddingId: null,
        weddingTitle: null,
        coupleId: null,
        businessAccountId: m.businessAccountId,
        vendorId: null,
        serviceEngagementIds: [],
        permissions: m.permissions,
        platformRoles: [],
        sources: [source],
      })
      continue
    }

    // couple, client, venue and unknown types: evidence without a native workspace. A Couple
    // workspace comes from the wedding owner membership, never from a business row.
    nonGranting.push({ source, reason: 'business_type_not_workspace' })
  }
}

function hasPublishedVendorListing(evidence: ProductionAuthorityEvidence, businessAccountId: string): boolean {
  return evidence.providerProfiles.some(
    (p) =>
      p.businessAccountId === businessAccountId &&
      VENDOR_LISTING_STATUSES.has(p.listingStatus) &&
      p.visibility === 'published' &&
      !p.isClaimable,
  )
}

/**
 * Wedding-scoped Vendor grants: BusinessAccount → BusinessAccountLink(vendor) → Vendor → Wedding,
 * with the real ServiceEngagements for that Vendor on that wedding. Only for a business that
 * already holds a Vendor business grant. No engagement id is ever invented or auto-selected.
 */
function deriveVendorWeddingGrants(
  evidence: ProductionAuthorityEvidence,
  grants: WorkspaceGrant[],
  nonGranting: NonGrantingRelationship[],
) {
  const eligibleBusinesses = new Set(
    grants.filter((g) => g.workspaceKind === 'vendor' && g.scopeKind === 'business').map((g) => g.businessAccountId),
  )
  for (const link of evidence.vendorEngagements) {
    if (!eligibleBusinesses.has(link.businessAccountId)) continue
    const source = { kind: 'business_link' as const, id: link.linkId }
    if (!RECOGNISED_VENDOR_LINK_RELATIONSHIPS.has(link.linkRelationship)) {
      nonGranting.push({ source, reason: 'vendor_link_relationship_not_recognised' })
      continue
    }
    const businessGrant = grants.find((g) => g.grantId === `vendor:business:${link.businessAccountId}`)
    grants.push({
      grantId: `vendor:wedding:${link.businessAccountId}:${link.vendorId}`,
      workspaceKind: 'vendor',
      scopeKind: 'wedding',
      weddingId: link.weddingId,
      weddingTitle: null,
      coupleId: null,
      businessAccountId: link.businessAccountId,
      vendorId: link.vendorId,
      serviceEngagementIds: link.serviceEngagements.map((e) => e.serviceEngagementId),
      permissions: businessGrant?.permissions ?? [],
      platformRoles: [],
      sources: [
        source,
        ...link.serviceEngagements.map((e) => ({ kind: 'service_engagement' as const, id: e.serviceEngagementId })),
      ],
    })
  }
}

const KIND_ORDER = new Map(WORKSPACE_KINDS.map((kind, index) => [kind, index]))
const SCOPE_ORDER = new Map(['system', 'portfolio', 'business', 'wedding'].map((s, i) => [s, i]))

function compareGrants(a: WorkspaceGrant, b: WorkspaceGrant): number {
  return (
    (KIND_ORDER.get(a.workspaceKind)! - KIND_ORDER.get(b.workspaceKind)!) ||
    (SCOPE_ORDER.get(a.scopeKind)! - SCOPE_ORDER.get(b.scopeKind)!) ||
    a.grantId.localeCompare(b.grantId)
  )
}
