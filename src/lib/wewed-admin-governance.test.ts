import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  canTransitionAccount,
  hasWewedAdminPermission,
  permissionForAccountTransition,
  resolveWewedAdminPermissions,
} from './wewed-admin-policy'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Wewed platform RBAC', () => {
  test('super admin receives wildcard access', () => {
    expect(resolveWewedAdminPermissions('wewed_super_admin')).toEqual(['*'])
    expect(hasWewedAdminPermission(['*'], 'admin.accounts.block')).toBe(true)
  })

  test('operations and analyst roles remain distinct', () => {
    const operations = resolveWewedAdminPermissions('wewed_operations_admin')
    const analyst = resolveWewedAdminPermissions('wewed_analyst')

    expect(hasWewedAdminPermission(operations, 'admin.accounts.approve')).toBe(true)
    expect(hasWewedAdminPermission(operations, 'admin.billing.manage')).toBe(false)
    expect(hasWewedAdminPermission(analyst, 'admin.analytics.read')).toBe(true)
    expect(hasWewedAdminPermission(analyst, 'admin.accounts.suspend')).toBe(false)
  })

  test('explicit permissions extend a known role without weakening defaults', () => {
    const permissions = resolveWewedAdminPermissions(
      'wewed_support_admin',
      ['admin.incidents.manage'],
    )

    expect(permissions).toContain('admin.support.manage')
    expect(permissions).toContain('admin.incidents.manage')
    expect(permissions).not.toContain('admin.billing.manage')
  })
})

describe('business account lifecycle', () => {
  test('valid transitions and permissions are deterministic', () => {
    expect(canTransitionAccount('pending_review', 'active')).toBe(true)
    expect(permissionForAccountTransition('pending_review', 'active')).toBe(
      'admin.accounts.approve',
    )
    expect(canTransitionAccount('active', 'blocked')).toBe(true)
    expect(permissionForAccountTransition('active', 'blocked')).toBe(
      'admin.accounts.block',
    )
    expect(canTransitionAccount('blocked', 'active')).toBe(true)
    expect(permissionForAccountTransition('blocked', 'active')).toBe(
      'admin.accounts.restore',
    )
  })

  test('invalid shortcuts and no-op transitions are rejected', () => {
    expect(canTransitionAccount('pending_review', 'blocked')).toBe(false)
    expect(canTransitionAccount('active', 'active')).toBe(false)
    expect(canTransitionAccount('rejected', 'active')).toBe(false)
  })
})

describe('admin route isolation and governance source contracts', () => {
  test('root layout mounts route-aware wedding tools instead of global wedding controls', () => {
    const layout = source('src/app/layout.tsx')
    const tools = source('src/components/wedding/global-wedding-tools.tsx')

    expect(layout).toContain('<GlobalWeddingTools />')
    expect(layout).not.toContain('<WhatsAppRSVP />')
    expect(layout).not.toContain('<CoupleLogin />')
    expect(layout).not.toContain('<AmbientMusicPlayer />')
    expect(tools).toContain("pathname === '/admin'")
    expect(tools).toContain("pathname.startsWith('/admin/')")
    expect(tools).toContain('if (isAdminRoute) return null')
    expect(tools).toContain('<WhatsAppRSVP />')
    expect(tools).toContain('<CoupleLogin />')
    expect(tools).toContain('<AmbientMusicPlayer />')
  })

  test('admin API requires governed lifecycle reasons and permission checks', () => {
    const route = source('src/app/api/admin/overview/route.ts')

    expect(route).toContain("action === 'transition_account'")
    expect(route).toContain('permissionForAccountTransition')
    expect(route).toContain('canTransitionAccount')
    expect(route).toContain("!reason")
    expect(route).toContain('business_account.lifecycle_transitioned')
    expect(route).toContain("assertWewedAdminPermission(context, 'admin.members.manage')")
    expect(route).not.toContain('status = COALESCE($2, status)')
  })

  test('mapped wedding access requires an active business account', () => {
    const weddingAccess = source('src/lib/wedding-access.ts')

    expect(weddingAccess).toContain('public."BusinessAccountMember"')
    expect(weddingAccess).toContain('public."BusinessAccountLink"')
    expect(weddingAccess).toContain("ba.status = 'active'")
    expect(weddingAccess).toContain('NOT EXISTS')
    expect(weddingAccess).toContain('OR EXISTS')
  })

  test('admin workspace exposes operational navigation rather than couple tools', () => {
    const consoleSource = source('src/components/admin/wewed-admin-console.tsx')

    expect(consoleSource).toContain("label: 'Approvals'")
    expect(consoleSource).toContain("label: 'Users & Roles'")
    expect(consoleSource).toContain("label: 'Audit Log'")
    expect(consoleSource).toContain('transition_account')
    expect(consoleSource).toContain('update_admin_role')
    expect(consoleSource).not.toContain('WhatsAppRSVP')
    expect(consoleSource).not.toContain('CoupleLogin')
    expect(consoleSource).not.toContain('AmbientMusicPlayer')
  })
})
