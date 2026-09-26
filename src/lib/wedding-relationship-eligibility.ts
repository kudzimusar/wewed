/**
 * One place for the wedding-relationship eligibility rules that desktop and native must share
 * (QRO 01 §23, P13-LIVE-8 foundation).
 *
 * Authority is multi-axis: an account identity, wedding memberships, business memberships and
 * operational grants. A Coordinator is a *wedding membership* (`WeddingMembership.role =
 * 'coordinator'`), never a global account class. Both transports already share the governed-access
 * SQL (`GOVERNED_WEDDING_ACCESS`) and the permission resolver (`resolveWeddingPermissions`); this
 * module makes the remaining rules — which membership grants which wedding workspace, and which
 * account classes the desktop dashboard admits — single functions consumed by both:
 *
 *   - native: `production-authority/grants.ts` `deriveWeddingGrants`
 *   - desktop: `/api/auth/signin` dashboard admission
 *
 * The two open policy choices (see `WEDDING_RELATIONSHIP_POLICY_DECISIONS`) are recorded here,
 * not decided here: this module deliberately reproduces current behavior on both transports so the
 * divergence is explicit and test-pinned until the owner decides.
 *
 * Pure: no database, Next or server-only import.
 */

export type WeddingWorkspaceKind = 'couple' | 'planner' | 'coordinator'

/** WeddingMembership.role → native wedding workspace kind. `viewer` (and unknown) grant none. */
export function workspaceKindForMembershipRole(role: string): WeddingWorkspaceKind | null {
  switch (role) {
    case 'owner':
      return 'couple'
    case 'planner':
      return 'planner'
    case 'coordinator':
      return 'coordinator'
    default:
      return null
  }
}

/** The inverse: the WeddingMembership.role a native wedding workspace grant was derived from. */
export function membershipRoleForWorkspaceKind(kind: string): 'owner' | 'planner' | 'coordinator' | null {
  switch (kind) {
    case 'couple':
      return 'owner'
    case 'planner':
      return 'planner'
    case 'coordinator':
      return 'coordinator'
    default:
      return null
  }
}

export type MembershipGrantRefusal = 'membership_not_active' | 'wedding_access_not_governed' | 'viewer_relationship'

export type MembershipGrantDecision =
  | { grants: true; kind: WeddingWorkspaceKind }
  | { grants: false; reason: MembershipGrantRefusal }

/**
 * Whether one WeddingMembership is a wedding workspace grant. Only an `active`, governed
 * owner/planner/coordinator membership grants; invitation acceptance is never a side effect of
 * reading authority.
 */
export function membershipWorkspaceGrant(membership: {
  role: string
  status: string
  governedAccess: boolean
}): MembershipGrantDecision {
  if (membership.status !== 'active') return { grants: false, reason: 'membership_not_active' }
  if (!membership.governedAccess) return { grants: false, reason: 'wedding_access_not_governed' }
  const kind = workspaceKindForMembershipRole(membership.role)
  return kind ? { grants: true, kind } : { grants: false, reason: 'viewer_relationship' }
}

/** The account classes (`User.role`) the desktop dashboard session can represent. */
export const DESKTOP_DASHBOARD_ACCOUNT_CLASSES = ['admin', 'couple', 'planner', 'vendor'] as const
export type DesktopDashboardAccountClass = (typeof DESKTOP_DASHBOARD_ACCOUNT_CLASSES)[number]

export type DesktopDashboardAdmission =
  | { admitted: true; accountClass: DesktopDashboardAccountClass }
  | { admitted: false; reason: 'inactive_account' | 'account_class_not_dashboard' }

/**
 * Desktop dashboard admission by account class. Current production behavior, unchanged: the
 * signed session carries a `DashboardRole`, so an account whose class is not one of them is
 * refused even when it holds an active Coordinator membership — see POLICY D-COORD-ACCOUNT-CLASS.
 */
export function desktopDashboardAdmission(account: { role: string; isActive: boolean }): DesktopDashboardAdmission {
  if (!account.isActive) return { admitted: false, reason: 'inactive_account' }
  if (!(DESKTOP_DASHBOARD_ACCOUNT_CLASSES as readonly string[]).includes(account.role)) {
    return { admitted: false, reason: 'account_class_not_dashboard' }
  }
  return { admitted: true, accountClass: account.role as DesktopDashboardAccountClass }
}

/**
 * Whether a membership resolves a desktop wedding workspace for an admitted account, given whether
 * sign-in accepts pending invitations (production: yes; Preview: only for the writable wedding).
 * A `vendor` account class is routed to the vendor portal before any wedding lookup.
 */
export function desktopMembershipResolves(input: {
  accountClass: DesktopDashboardAccountClass
  membership: { role: string; status: string; governedAccess: boolean }
  signInAcceptsInvitation: boolean
}): boolean {
  if (input.accountClass === 'vendor') return false
  const { membership } = input
  if (!membership.governedAccess) return false
  if (membership.status === 'active') return true
  return membership.status === 'invited' && input.signInAcceptsInvitation
}

/**
 * Open owner/product decisions (returned to the moderator; NOT decided by this module).
 */
export const WEDDING_RELATIONSHIP_POLICY_DECISIONS = {
  'D-COORD-ACCOUNT-CLASS':
    'An account whose User.role is not a dashboard class (e.g. viewer) or is vendor, holding an active governed ' +
    'Coordinator/Planner/Owner membership, receives a native wedding grant but is refused (or routed to the vendor ' +
    'portal) on desktop. Closing it needs a desktop session representation for membership-only accounts without ' +
    'inventing a global Coordinator role or upgrading the account class.',
  'D-COORD-INVITATION-LIFECYCLE':
    'Desktop sign-in accepts pending invitations (invited -> active); native authority counts only active ' +
    'memberships and never accepts as a side effect. One explicit acceptance transition must be chosen: ' +
    '(a) authenticated sign-in on either transport accepts (native sign-in gains the side effect), or ' +
    '(b) an explicit Accept action on both, with desktop sign-in no longer accepting.',
  'D-VIEWER-WORKSPACE':
    'A viewer membership opens a read-only desktop workspace but grants no native workspace.',
} as const
