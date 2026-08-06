import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  accountScopeAllows,
  hasWewedAdminPermission,
  resolveWewedAdminPermissions,
  rolePermissionMatrix,
  type PlatformAdminScope,
} from './wewed-admin-policy'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Admin RBAC and account segmentation contract', () => {
  test('only Super Admin receives global operations and administrator management', () => {
    const superPermissions = resolveWewedAdminPermissions('wewed_super_admin')
    const operationsPermissions = resolveWewedAdminPermissions('wewed_operations_admin')
    const billingPermissions = resolveWewedAdminPermissions('wewed_billing_admin')

    expect(superPermissions).toEqual(['*'])
    expect(hasWewedAdminPermission(superPermissions, 'admin.overview.read')).toBe(true)
    expect(hasWewedAdminPermission(superPermissions, 'admin.platform_admins.manage')).toBe(true)
    expect(operationsPermissions).not.toContain('admin.overview.read')
    expect(operationsPermissions).not.toContain('admin.platform_admins.manage')
    expect(operationsPermissions).not.toContain('admin.members.manage')
    expect(billingPermissions).not.toContain('admin.platform_admins.manage')
  })

  test('database permission JSON cannot escalate beyond the role ceiling', () => {
    const operationsPermissions = resolveWewedAdminPermissions(
      'wewed_operations_admin',
      ['*', 'admin.platform_admins.manage', 'admin.billing.manage', 'admin.accounts.read'],
    )

    expect(operationsPermissions).toContain('admin.accounts.read')
    expect(operationsPermissions).not.toContain('*')
    expect(operationsPermissions).not.toContain('admin.platform_admins.manage')
    expect(operationsPermissions).not.toContain('admin.billing.manage')
  })

  test('scope resolution never exposes internal accounts to scoped roles', () => {
    const scoped: PlatformAdminScope = {
      global: false,
      accountTypes: ['planning_company', 'couple'],
      businessAccountIds: ['explicit-client'],
    }
    const global: PlatformAdminScope = {
      global: true,
      accountTypes: [],
      businessAccountIds: [],
    }

    expect(accountScopeAllows(scoped, { id: 'planner-1', type: 'planning_company' })).toBe(true)
    expect(accountScopeAllows(scoped, { id: 'explicit-client', type: 'client' })).toBe(true)
    expect(accountScopeAllows(scoped, { id: 'venue-1', type: 'venue' })).toBe(false)
    expect(accountScopeAllows(scoped, { id: 'wewed-platform', type: 'wewed_internal' })).toBe(false)
    expect(accountScopeAllows(global, { id: 'wewed-platform', type: 'wewed_internal' })).toBe(true)
  })

  test('permission matrix exposes a complete reviewable role contract', () => {
    const matrix = rolePermissionMatrix()
    expect(matrix.wewed_super_admin).toContain('admin.platform_admins.manage')
    expect(matrix.wewed_super_admin).toContain('admin.scopes.manage')
    expect(matrix.wewed_operations_admin).toContain('admin.accounts.approve')
    expect(matrix.wewed_billing_admin).toContain('admin.billing.manage')
    expect(matrix.wewed_support_admin).toContain('admin.support.manage')
    expect(matrix.wewed_analyst).not.toContain('admin.accounts.create')
  })

  test('database migration creates a private named-admin registry and scope grants', () => {
    const migration = source(
      'prisma/migrations/20260806173000_platform_administrator_registry/migration.sql',
    )

    expect(migration).toContain('wewed_admin."PlatformAdministrator"')
    expect(migration).toContain('wewed_admin."PlatformAdministratorScope"')
    expect(migration).toContain("CHECK (status IN ('invited', 'active', 'suspended', 'revoked'))")
    expect(migration).toContain("CHECK (\"scopeType\" IN ('global', 'account_type', 'business_account'))")
    expect(migration).toContain('ensure_platform_admin_default_scopes')
    expect(migration).toContain('sync_platform_admin_from_membership')
    expect(migration).toContain('AFTER INSERT OR UPDATE OR DELETE')
    expect(migration).not.toContain('UPDATE OF role, status OR DELETE')
    expect(migration).toContain('REVOKE ALL PRIVILEGES')
    expect(migration).not.toContain('CREATE VIEW public."PlatformAdministrator"')
  })

  test('governance API applies scope predicates and protects privileged lifecycle changes', () => {
    const api = source('src/app/api/admin/governance/route.ts')
    const access = source('src/lib/wewed-admin.ts')

    expect(access).toContain('buildBusinessAccountScopeSql')
    expect(access).toContain("account.type === 'wewed_internal'")
    expect(api).toContain('buildBusinessAccountScopeSql(context')
    expect(api).toContain("assertWewedAdminPermission(context, 'admin.platform_admins.manage')")
    expect(api).toContain("assertWewedAdminPermission(context, 'admin.scopes.manage')")
    expect(api).toContain('The last active Super Admin cannot be demoted.')
    expect(api).toContain('The last active Super Admin cannot be suspended or revoked.')
    expect(api).toContain('cannot suspend or revoke their own account')
    expect(api).toContain('become active only by accepting their secure invitation')
    expect(api).toContain("action: 'platform_administrator.status_changed'")
    expect(api).toContain("action: 'platform_administrator.scopes_replaced'")
  })

  test('primary Admin UI separates account categories and surfaces secure role management', () => {
    const consoleSource = source('src/components/admin/governed-wewed-admin.tsx')
    const gate = source('src/components/admin/secure-wewed-admin.tsx')

    expect(gate).toContain('GovernedWewedAdminConsole')
    expect(consoleSource).toContain('Business accounts by category')
    expect(consoleSource).toContain('Customer & partner')
    expect(consoleSource).toContain('Couples')
    expect(consoleSource).toContain('Planners')
    expect(consoleSource).toContain('Venues')
    expect(consoleSource).toContain('Vendors')
    expect(consoleSource).toContain('Wewed internal')
    expect(consoleSource).toContain('Platform administrators')
    expect(consoleSource).toContain('Invite administrator')
    expect(consoleSource).toContain('Effective:')
    expect(consoleSource).toContain('Active / reinstate')
    expect(consoleSource).toContain('Required reason for any change')
    expect(consoleSource).toContain('Role permission matrix')
    expect(consoleSource).toContain('Full cross-account operations are available only to Super Admin')
  })
})
