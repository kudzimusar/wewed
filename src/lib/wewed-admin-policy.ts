export const WEWED_ADMIN_ROLES = [
  'wewed_super_admin',
  'wewed_operations_admin',
  'wewed_billing_admin',
  'wewed_support_admin',
  'wewed_analyst',
] as const

export type WewedAdminRole = (typeof WEWED_ADMIN_ROLES)[number]

export const WEWED_ADMIN_PERMISSIONS = [
  'admin.overview.read',
  'admin.analytics.read',
  'admin.accounts.read',
  'admin.accounts.create',
  'admin.accounts.approve',
  'admin.accounts.reject',
  'admin.accounts.suspend',
  'admin.accounts.block',
  'admin.accounts.cancel',
  'admin.accounts.archive',
  'admin.accounts.restore',
  'admin.departments.read',
  'admin.departments.manage',
  'admin.members.read',
  'admin.members.manage',
  'admin.platform_admins.read',
  'admin.platform_admins.manage',
  'admin.scopes.manage',
  'admin.billing.read',
  'admin.billing.manage',
  'admin.support.read',
  'admin.support.manage',
  'admin.incidents.read',
  'admin.incidents.manage',
  'admin.audit.read',
] as const

export type WewedAdminPermission = (typeof WEWED_ADMIN_PERMISSIONS)[number]

export const WEWED_ADMIN_ROLE_LABELS: Record<WewedAdminRole, string> = {
  wewed_super_admin: 'Super Admin',
  wewed_operations_admin: 'Operations Admin',
  wewed_billing_admin: 'Billing Admin',
  wewed_support_admin: 'Support Admin',
  wewed_analyst: 'Analyst / Viewer',
}

/** The legacy operations console is global, so only Super Admin receives it. */
const ROLE_PERMISSIONS: Record<
  WewedAdminRole,
  readonly (WewedAdminPermission | '*')[]
> = {
  wewed_super_admin: ['*'],
  wewed_operations_admin: [
    'admin.analytics.read',
    'admin.accounts.read',
    'admin.accounts.create',
    'admin.accounts.approve',
    'admin.accounts.reject',
    'admin.accounts.suspend',
    'admin.accounts.block',
    'admin.accounts.cancel',
    'admin.accounts.archive',
    'admin.accounts.restore',
    'admin.departments.read',
    'admin.departments.manage',
    'admin.support.read',
    'admin.support.manage',
    'admin.incidents.read',
    'admin.incidents.manage',
    'admin.audit.read',
  ],
  wewed_billing_admin: [
    'admin.analytics.read',
    'admin.accounts.read',
    'admin.departments.read',
    'admin.billing.read',
    'admin.billing.manage',
    'admin.audit.read',
  ],
  wewed_support_admin: [
    'admin.accounts.read',
    'admin.departments.read',
    'admin.support.read',
    'admin.support.manage',
    'admin.incidents.read',
    'admin.audit.read',
  ],
  wewed_analyst: [
    'admin.analytics.read',
    'admin.accounts.read',
    'admin.departments.read',
    'admin.billing.read',
    'admin.support.read',
    'admin.incidents.read',
    'admin.audit.read',
  ],
}

export const PLATFORM_ACCOUNT_TYPES = [
  'wewed_internal',
  'planning_company',
  'couple',
  'venue',
  'vendor',
  'client',
] as const

export type PlatformAccountType = (typeof PLATFORM_ACCOUNT_TYPES)[number]

export const CUSTOMER_PARTNER_ACCOUNT_TYPES = [
  'planning_company',
  'couple',
  'venue',
  'vendor',
  'client',
] as const satisfies readonly PlatformAccountType[]

export type PlatformAdminScope = {
  global: boolean
  accountTypes: PlatformAccountType[]
  businessAccountIds: string[]
}

export function isWewedAdminRole(value: unknown): value is WewedAdminRole {
  return (
    typeof value === 'string' &&
    (WEWED_ADMIN_ROLES as readonly string[]).includes(value)
  )
}

export function isPlatformAccountType(
  value: unknown,
): value is PlatformAccountType {
  return (
    typeof value === 'string' &&
    (PLATFORM_ACCOUNT_TYPES as readonly string[]).includes(value)
  )
}

function parseExplicitPermissions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : []
    } catch {
      return []
    }
  }
  return []
}

/** Database permissions can never expand a role beyond its code-defined ceiling. */
export function resolveWewedAdminPermissions(
  role: string,
  explicitPermissions?: unknown,
): string[] {
  if (!isWewedAdminRole(role)) return []
  const defaults = ROLE_PERMISSIONS[role]
  if (defaults.includes('*')) return ['*']

  const allowed = new Set(defaults)
  const boundedExplicit = parseExplicitPermissions(explicitPermissions).filter(
    (permission) => allowed.has(permission as WewedAdminPermission),
  )
  return Array.from(new Set([...defaults, ...boundedExplicit]))
}

export function rolePermissionMatrix(): Record<WewedAdminRole, string[]> {
  return Object.fromEntries(
    WEWED_ADMIN_ROLES.map((role) => [
      role,
      ROLE_PERMISSIONS[role].includes('*')
        ? [...WEWED_ADMIN_PERMISSIONS]
        : [...ROLE_PERMISSIONS[role]],
    ]),
  ) as Record<WewedAdminRole, string[]>
}

export function hasWewedAdminPermission(
  permissions: readonly string[],
  permission: WewedAdminPermission,
): boolean {
  return permissions.includes('*') || permissions.includes(permission)
}

export function accountScopeAllows(
  scope: PlatformAdminScope,
  account: { id: string; type: string },
): boolean {
  if (scope.global) return true
  if (account.type === 'wewed_internal') return false
  return (
    scope.businessAccountIds.includes(account.id) ||
    scope.accountTypes.includes(account.type as PlatformAccountType)
  )
}

export const ACCOUNT_LIFECYCLE_STATUSES = [
  'pending_review',
  'active',
  'rejected',
  'suspended',
  'blocked',
  'cancelled',
  'archived',
] as const

export type AccountLifecycleStatus =
  (typeof ACCOUNT_LIFECYCLE_STATUSES)[number]

const ACCOUNT_TRANSITIONS: Record<
  AccountLifecycleStatus,
  readonly AccountLifecycleStatus[]
> = {
  pending_review: ['active', 'rejected'],
  active: ['suspended', 'blocked', 'cancelled', 'archived'],
  rejected: ['pending_review', 'archived'],
  suspended: ['active', 'blocked', 'cancelled', 'archived'],
  blocked: ['active', 'cancelled', 'archived'],
  cancelled: ['active', 'archived'],
  archived: ['pending_review', 'active'],
}

export function isAccountLifecycleStatus(
  value: unknown,
): value is AccountLifecycleStatus {
  return (
    typeof value === 'string' &&
    (ACCOUNT_LIFECYCLE_STATUSES as readonly string[]).includes(value)
  )
}

export function normalizeAccountLifecycleStatus(
  value: unknown,
): AccountLifecycleStatus {
  if (isAccountLifecycleStatus(value)) return value
  if (value === 'trial') return 'active'
  return 'pending_review'
}

export function canTransitionAccount(
  from: AccountLifecycleStatus,
  to: AccountLifecycleStatus,
): boolean {
  return from !== to && ACCOUNT_TRANSITIONS[from].includes(to)
}

export function permissionForAccountTransition(
  from: AccountLifecycleStatus,
  to: AccountLifecycleStatus,
): WewedAdminPermission {
  if (to === 'active') {
    return from === 'pending_review'
      ? 'admin.accounts.approve'
      : 'admin.accounts.restore'
  }
  if (to === 'rejected') return 'admin.accounts.reject'
  if (to === 'suspended') return 'admin.accounts.suspend'
  if (to === 'blocked') return 'admin.accounts.block'
  if (to === 'cancelled') return 'admin.accounts.cancel'
  if (to === 'archived') return 'admin.accounts.archive'
  return 'admin.accounts.restore'
}

export function isRestrictiveAccountStatus(
  status: AccountLifecycleStatus,
): boolean {
  return ['rejected', 'suspended', 'blocked', 'cancelled', 'archived'].includes(
    status,
  )
}

export function accountStatusAllowsWorkspace(status: string): boolean {
  return normalizeAccountLifecycleStatus(status) === 'active'
}
