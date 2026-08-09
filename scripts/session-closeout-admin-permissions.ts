import assert from 'node:assert/strict'
import {
  hasWewedAdminPermission,
  resolveWewedAdminPermissions,
} from '../src/lib/wewed-admin-policy'

const superAdmin = resolveWewedAdminPermissions('wewed_super_admin', [])
const operations = resolveWewedAdminPermissions('wewed_operations_admin', ['admin.billing.manage'])
const billing = resolveWewedAdminPermissions('wewed_billing_admin', ['admin.support.manage'])
const support = resolveWewedAdminPermissions('wewed_support_admin', ['admin.billing.manage'])
const viewer = resolveWewedAdminPermissions('wewed_analyst', ['admin.billing.manage'])

assert.equal(hasWewedAdminPermission(superAdmin, 'admin.billing.manage'), true)
assert.equal(hasWewedAdminPermission(superAdmin, 'admin.support.manage'), true)
assert.equal(hasWewedAdminPermission(superAdmin, 'admin.accounts.read'), true)

assert.equal(hasWewedAdminPermission(operations, 'admin.accounts.read'), true)
assert.equal(hasWewedAdminPermission(operations, 'admin.support.manage'), true)
assert.equal(
  hasWewedAdminPermission(operations, 'admin.billing.manage'),
  false,
  'Explicit database permissions must not expand Operations Admin beyond its code ceiling.',
)

assert.equal(hasWewedAdminPermission(billing, 'admin.billing.read'), true)
assert.equal(hasWewedAdminPermission(billing, 'admin.billing.manage'), true)
assert.equal(
  hasWewedAdminPermission(billing, 'admin.support.manage'),
  false,
  'Billing Admin must not inherit support mutation authority.',
)

assert.equal(hasWewedAdminPermission(support, 'admin.support.read'), true)
assert.equal(hasWewedAdminPermission(support, 'admin.support.manage'), true)
assert.equal(
  hasWewedAdminPermission(support, 'admin.billing.manage'),
  false,
  'Support Admin must not inherit pricing mutation authority.',
)

assert.equal(hasWewedAdminPermission(viewer, 'admin.billing.read'), true)
assert.equal(hasWewedAdminPermission(viewer, 'admin.support.read'), true)
assert.equal(hasWewedAdminPermission(viewer, 'admin.billing.manage'), false)
assert.equal(hasWewedAdminPermission(viewer, 'admin.support.manage'), false)

console.log('Session closeout Admin permission matrix: PASS')
