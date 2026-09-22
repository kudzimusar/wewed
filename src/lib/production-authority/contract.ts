/**
 * WewedProductionAuthorityV1 — the shared, versioned account-authority contract.
 *
 * Master plan WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01, Phase 2. Specification:
 * docs/native-mobile/WEWED_PRODUCTION_AUTHORITY_CONTRACT_V1.md
 *
 * Authority is multi-axis (master plan Rule 3, D-003). This contract keeps every axis as its own
 * evidence and derives explicit workspace grants on top of it. The flat dashboard class
 * (`User.role` / `AppSession.role`) is ONE axis, never the whole answer and never a grant by itself.
 *
 * Deliberately excluded:
 *  - Guest identity: invitation-bound, carried by Guest Session v2, not an account (D-002).
 *  - Usher/Gate: no production authority exists until Phase 10; nothing is inferred.
 *
 * This file is pure (no database, no server-only imports) so the same types and builder can be
 * exercised by tests and serialised identically for Android and iOS.
 */

export const PRODUCTION_AUTHORITY_CONTRACT = 'WewedProductionAuthorityV1' as const
export const PRODUCTION_AUTHORITY_VERSION = 1 as const

/** The only workspace kinds this contract can currently prove. Not guest, not usher. */
export const WORKSPACE_KINDS = ['couple', 'planner', 'coordinator', 'vendor', 'admin'] as const
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number]

/**
 * How a grant is scoped. `portfolio` and `business` are real authority with no wedding selected;
 * they are never expressed as a placeholder wedding id.
 */
export const GRANT_SCOPE_KINDS = ['wedding', 'portfolio', 'business', 'system'] as const
export type GrantScopeKind = (typeof GRANT_SCOPE_KINDS)[number]

// ---------------------------------------------------------------------------------------------
// Evidence — what the database says, per axis. Loaded read-only by the resolver.
// ---------------------------------------------------------------------------------------------

export interface IdentityEvidence {
  accessUserId: string
  /** Supabase auth user id, when the caller's transport has verified one. */
  authUserId: string | null
  email: string
  name: string | null
  /** Raw `User.role`. The dashboard/account class axis — free text in the database. */
  userRole: string
  coupleId: string | null
  isActive: boolean
}

export interface ProfileEvidence {
  displayName: string | null
  /** Raw `UserProfile.role`, free text. Evidence only. */
  profileRole: string | null
  isBanned: boolean
}

export interface BusinessMembershipEvidence {
  membershipId: string
  businessAccountId: string
  businessName: string
  businessType: string
  businessStatus: string
  onboardingStatus: string
  subscriptionStatus: string
  ownerUserId: string | null
  role: string
  status: string
  permissions: string[]
}

export interface BusinessLinkEvidence {
  linkId: string
  businessAccountId: string
  entityType: string
  entityId: string
  relationship: string
}

export interface ProviderProfileEvidence {
  businessAccountId: string
  listingStatus: string
  visibility: string
  isClaimable: boolean
}

export interface WeddingMembershipEvidence {
  membershipId: string
  weddingId: string
  slug: string
  title: string
  date: string
  coupleId: string
  role: string
  status: string
  /**
   * Whether the membership passes the PWA's governed-access rule (`GOVERNED_WEDDING_ACCESS` in
   * wedding-access.ts), evaluated by the same SQL. A membership that fails it is not accessible
   * in the PWA and grants nothing here.
   */
  governedAccess: boolean
  /** Permissions exactly as `resolveWeddingPermissions` resolves them for the PWA. */
  permissions: string[]
}

export interface VendorEngagementEvidence {
  businessAccountId: string
  linkId: string
  linkRelationship: string
  vendorId: string
  vendorName: string
  weddingId: string
  serviceEngagements: Array<{
    serviceEngagementId: string
    lifecycleStatus: string
    origin: string
    recordMode: string
  }>
}

export interface PlatformRegistryEvidence {
  /** `wewed_admin."PlatformAdministrator"`: missing, active or some other stored status. */
  state: 'missing' | 'active' | 'inactive'
  role: string | null
  status: string | null
  scopes: Array<{ scopeType: string; scopeValue: string }>
}

export interface ProductionAuthorityEvidence {
  identity: IdentityEvidence | null
  profile: ProfileEvidence | null
  businessMemberships: BusinessMembershipEvidence[]
  businessLinks: BusinessLinkEvidence[]
  providerProfiles: ProviderProfileEvidence[]
  weddingMemberships: WeddingMembershipEvidence[]
  vendorEngagements: VendorEngagementEvidence[]
  platformRegistry: PlatformRegistryEvidence
}

// ---------------------------------------------------------------------------------------------
// Grants — normalised, explicit, server-authoritative. Clients map these; they never interpret
// raw role strings.
// ---------------------------------------------------------------------------------------------

export interface GrantSource {
  /** Which axis produced the evidence. */
  kind: 'account_class' | 'wedding_membership' | 'business_membership' | 'business_link' | 'service_engagement' | 'platform_registry'
  id: string
}

export interface WorkspaceGrant {
  grantId: string
  workspaceKind: WorkspaceKind
  scopeKind: GrantScopeKind
  weddingId: string | null
  weddingTitle: string | null
  coupleId: string | null
  businessAccountId: string | null
  vendorId: string | null
  /** Real ServiceEngagement ids only. Empty means none exist; nothing is ever invented. */
  serviceEngagementIds: string[]
  /** Permission evidence as the owning axis resolves it. */
  permissions: string[]
  /** Exact Wewed-internal role evidence for system grants; empty otherwise. */
  platformRoles: string[]
  sources: GrantSource[]
}

/** A relationship that exists but deliberately produces no workspace grant, and why. */
export interface NonGrantingRelationship {
  source: GrantSource
  reason:
    | 'viewer_relationship'
    | 'membership_not_active'
    | 'wedding_access_not_governed'
    | 'business_not_active_or_incomplete'
    | 'business_role_not_workspace'
    | 'business_type_not_workspace'
    | 'provider_profile_not_published'
    | 'vendor_link_relationship_not_recognised'
    | 'platform_membership_not_effective'
    | 'legacy_global_admin_wedding_access'
}

/** Authority the account contract refuses to express, by design. */
export interface UnsupportedAuthority {
  authority: 'guest' | 'usher_gate'
  reason: string
}

export interface ContextSelection {
  workspaceKind: WorkspaceKind
  grantIds: string[]
  /** True when more than one grant of this kind exists: the person must choose; none is picked. */
  selectionRequired: boolean
}

export interface WewedProductionAuthorityV1 {
  contract: typeof PRODUCTION_AUTHORITY_CONTRACT
  version: typeof PRODUCTION_AUTHORITY_VERSION
  /**
   * `authorized` when an active, unbanned identity exists. Anything else carries no grants at
   * all, whatever relationships the database still holds.
   */
  accountStatus: 'authorized' | 'unknown_identity' | 'inactive_identity' | 'banned_identity'
  identity: {
    accessUserId: string
    authUserId: string | null
    email: string
    displayName: string | null
    /** The dashboard/account class axis, exactly as stored. It is not a workspace grant. */
    dashboardClass: string
    isDashboardClass: boolean
    coupleId: string | null
    isActive: boolean
  } | null
  businessMemberships: BusinessMembershipEvidence[]
  businessLinks: BusinessLinkEvidence[]
  weddingMemberships: WeddingMembershipEvidence[]
  vendorEngagements: VendorEngagementEvidence[]
  platform: {
    /** Every Wewed-internal business membership, with its exact role — not a boolean. */
    internalMemberships: Array<{ membershipId: string; businessAccountId: string; role: string; status: string; businessStatus: string }>
    registry: PlatformRegistryEvidence
    /** The membership the PWA admin gate would use, or null. */
    effectiveRole: string | null
    effectiveSource: 'platform_registry' | 'legacy_membership' | null
  }
  /** Raw authoritative onboarding/account dimensions. No invented aggregate state. */
  onboarding: {
    userActive: boolean
    profileBanned: boolean
    businesses: Array<{ businessAccountId: string; businessType: string; businessStatus: string; onboardingStatus: string; subscriptionStatus: string; membershipStatus: string }>
    invitedWeddingMembershipIds: string[]
  }
  workspaceGrants: WorkspaceGrant[]
  contextSelection: ContextSelection[]
  nonGrantingRelationships: NonGrantingRelationship[]
  unsupported: UnsupportedAuthority[]
}
