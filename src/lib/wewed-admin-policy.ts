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
  'admin.members.read',
  'admin.members.manage',
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

const ROLE_PERMISSIONS: Record<WewedAdminRole, readonly (WewedAdminPermission | '*')[]> = {
  wewed_super_admin: ['*'],
  wewed_operations_admin: [
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
    'admin.members.read',
    'admin.members.manage',
    'admin.support.read',
    'admin.support.manage',
    'admin.incidents.read',
    'admin.incidents.manage',
    'admin.audit.read',
  ],
  wewed_billing_admin: [
    'admin.overview.read',
    'admin.analytics.read',
    'admin.accounts.read',
    'admin.members.read',
    'admin.billing.read',
    'admin.billing.manage',
    'admin.audit.read',
  ],
  wewed_support_admin: [
    'admin.overview.read',
    'admin.accounts.read',
    'admin.members.read',
    'admin.support.read',
    'admin.support.manage',
    'admin.incidents.read',
    'admin.audit.read',
  ],
  wewed_analyst: [
    'admin.overview.read',
    'admin.analytics.read',
    'admin.accounts.read',
    'admin.members.read',
    'admin.billing.read',
    'admin.support.read',
    'admin.incidents.read',
    'admin.audit.read',
  ],
}

export function isWewedAdminRole(value: unknown): value is WewedAdminRole {
  return typeof value === 'string' && (WEWED_ADMIN_ROLES as readonly string[]).includes(value)
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

export function resolveWewedAdminPermissions(
  role: string,
  explicitPermissions?: unknown,
): string[] {
  const defaults = isWewedAdminRole(role) ? ROLE_PERMISSIONS[role] : []
  if (defaults.includes('*')) return ['*']

  return Array.from(new Set([...defaults, ...parseExplicitPermissions(explicitPermissions)]))
}

export function hasWewedAdminPermission(
  permissions: readonly string[],
  permission: WewedAdminPermission,
): boolean {
  return permissions.includes('*') || permissions.includes(permission)
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

export type AccountLifecycleStatus = (typeof ACCOUNT_LIFECYCLE_STATUSES)[number]

const ACCOUNT_TRANSITIONS: Record<AccountLifecycleStatus, readonly AccountLifecycleStatus[]> = {
  pending_review: ['active', 'rejected'],
  active: ['suspended', 'blocked', 'cancelled', 'archived'],
  rejected: ['pending_review', 'archived'],
  suspended: ['active', 'blocked', 'cancelled', 'archived'],
  blocked: ['active', 'cancelled', 'archived'],
  cancelled: ['active', 'archived'],
  archived: ['pending_review', 'active'],
}

export function isAccountLifecycleStatus(value: unknown): value is AccountLifecycleStatus {
  return typeof value === 'string' && (ACCOUNT_LIFECYCLE_STATUSES as readonly string[]).includes(value)
}

export function normalizeAccountLifecycleStatus(value: unknown): AccountLifecycleStatus {
  if (isAccountLifecycleStatus(value)) return value
  if (value === 'trial') return 'active'
  return 'pending_review'
}

export function canTransitionAccount(
  current: AccountLifecycleStatus,
  next: AccountLifecycleStatus,
): boolean {
  return current !== next && ACCOUNT_TRANSITIONS[current].includes(next)
}

export function permissionForAccountTransition(
  current: AccountLifecycleStatus,
  next: AccountLifecycleStatus,
): WewedAdminPermission {
  if (current === 'pending_review' && next === 'active') return 'admin.accounts.approve'
  if (next === 'rejected') return 'admin.accounts.reject'
  if (next === 'suspended') return 'admin.accounts.suspend'
  if (next === 'blocked') return 'admin.accounts.block'
  if (next === 'cancelled') return 'admin.accounts.cancel'
  if (next === 'archived') return 'admin.accounts.archive'
  return 'admin.accounts.restore'
}

export function isRestrictiveAccountStatus(status: AccountLifecycleStatus): boolean {
  return ['rejected', 'suspended', 'blocked', 'cancelled', 'archived'].includes(status)
}

export function accountStatusAllowsWorkspace(status: string): boolean {
  return normalizeAccountLifecycleStatus(status) === 'active'
}
