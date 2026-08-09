import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function requireAll(path: string, values: string[]): string {
  const contents = source(path)
  for (const value of values) {
    assert.ok(contents.includes(value), `${path} must include ${JSON.stringify(value)}`)
  }
  return contents
}

function requireAllCombined(paths: string[], values: string[]): string {
  const contents = paths.map((path) => source(path)).join('\n')
  for (const value of values) {
    assert.ok(
      contents.includes(value),
      `${paths.join(' + ')} must include ${JSON.stringify(value)}`,
    )
  }
  return contents
}

const plan = requireAll('docs/product/admin-command-center-taxonomy-responsive-plan-2026-08-07.md', [
  'Taxonomy clarity',
  'Responsive productivity',
  'Data-loop integrity',
  'InternalStaffProfile',
  'AdminWorkItem',
  'AdminSavedView',
  'Windows and horizontal scrolling remediation',
  'Command Centre',
  'Account 360',
  'Database non-regression gate',
  '360x800',
  '1366x768',
])
assert.ok(
  plan.indexOf('Phase 0 — plan and live database audit') < plan.indexOf('Phase 1 — additive taxonomy and productivity schema'),
  'The implementation plan must require the live database audit before schema implementation.',
)

requireAll('docs/product/admin-command-center-phase0-live-database-audit-2026-08-07.md', [
  'external accounts without department assignments: **132**',
  'external accounts without billing profiles: **132**',
  'department/account-type mismatches: **0**',
  'billing-profile/account-type mismatches: **0**',
  'central, additive provisioning function/trigger',
  'ON CONFLICT DO NOTHING',
])

const migration = requireAll('prisma/migrations/20260807150000_admin_command_center_taxonomy/migration.sql', [
  'CREATE TABLE IF NOT EXISTS wewed_admin."AccountSubtypeDefinition"',
  'CREATE TABLE IF NOT EXISTS wewed_admin."BusinessAccountClassification"',
  'CREATE TABLE IF NOT EXISTS wewed_admin."InternalDepartmentDefinition"',
  'CREATE TABLE IF NOT EXISTS wewed_admin."InternalStaffProfile"',
  'CREATE TABLE IF NOT EXISTS wewed_admin."AdminWorkItem"',
  'CREATE TABLE IF NOT EXISTS wewed_admin."AdminSavedView"',
  'CREATE OR REPLACE FUNCTION wewed_admin.provision_business_account_defaults(',
  'CREATE TRIGGER provision_business_account_defaults_after_insert',
  'CREATE OR REPLACE FUNCTION wewed_admin.refresh_system_vendor_classification()',
  'ON CONFLICT ("businessAccountId", "departmentKey") DO NOTHING',
  'ON CONFLICT ("businessAccountId") DO NOTHING',
  'REVOKE ALL ON TABLE',
  'FROM PUBLIC;',
  "IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')",
  "IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated')",
  "classification.source='system'",
])
assert.ok(
  !migration.includes('UPDATE wewed_admin."BusinessAccount"'),
  'The additive taxonomy migration must never rewrite canonical BusinessAccount rows.',
)
assert.ok(
  !migration.includes('DELETE FROM wewed_admin."BusinessAccount"'),
  'The additive taxonomy migration must never delete canonical BusinessAccount rows.',
)
assert.ok(
  !migration.includes('UPDATE wewed_admin."BusinessAccountDepartment"'),
  'The provisioning repair must insert missing department assignments without overwriting existing assignments.',
)
assert.ok(
  !migration.includes('UPDATE wewed_admin."BusinessAccountBillingProfile"'),
  'The provisioning repair must insert missing billing profiles without overwriting existing profiles.',
)

requireAll(
  'prisma/migrations/20260807151500_fix_vendor_classification_move_refresh/migration.sql',
  [
    'target_business_account_ids',
    'OLD."businessAccountId" IS DISTINCT FROM NEW."businessAccountId"',
    'FOREACH target_business_account_id IN ARRAY target_business_account_ids',
    "classification.source='system'",
    'wewed_admin.default_business_account_subtype(',
  ],
)

const api = requireAllCombined(
  [
    'src/lib/admin-command-center-route-core.ts',
    'src/app/api/admin/command-center/route.ts',
  ],
  [
    "requireWewedAdmin(request, 'admin.accounts.read')",
    'buildBusinessAccountScopeSql',
    'writeBusinessAudit',
    "action === 'set_account_classification'",
    "action === 'set_staff_profile'",
    "action === 'save_view'",
    "action === 'update_work_item'",
    'wewed_admin."PlatformAdministrator"',
    'wewed_admin."InternalStaffProfile"',
    'wewed_admin."BillingOffer"',
    'plannerRelationshipMismatches',
    'missingProvisioning',
    'function canReadBilling',
    'function isOperationsAdmin',
    'function canReadQueueCategory',
    'function canManageQueueCategory',
    'billingOfferCode: billingVisible ? account.billingOfferCode : null',
    "subscriptionStatus: billingVisible ? account.subscriptionStatus : 'restricted'",
    "if (!isOperationsAdmin(context)) return []",
    'if (!canManageQueueCategory(context, item.category))',
    "This administrator cannot manage this work-item category.",
    "Work items may only be assigned to an active platform administrator.",
    'lower(name)=lower($3)',
    'A saved view with this name already exists on this screen.',
    '409,',
    'persistedKeys.has(workKey(item))',
    "item.category === 'onboarding'",
    'Boolean(account?.ownerEmail)',
  ],
)
assert.ok(
  api.indexOf("if (!isSuperAdmin(context))") < api.indexOf("action === 'save_view'"),
  'Workforce-profile mutations must remain guarded by the Super Admin boundary.',
)
assert.ok(
  !api.includes('SELECT * FROM public."User"'),
  'The command centre must not expose the unclassified generic User population.',
)
assert.ok(
  api.includes("hasPermission(context, 'admin.billing.read')") &&
    api.includes("hasPermission(context, 'admin.billing.manage')"),
  'Billing fields and queue projections must remain subordinate to existing billing permissions.',
)
assert.ok(
  api.includes("context.adminRole === 'wewed_operations_admin'"),
  'Provider claims, verification, and operational relationship diagnostics must remain Operations/Super-Admin work.',
)

const commandCentre = requireAll('src/components/admin/admin-command-centre.tsx', [
  'Operational command centre',
  'Accounts by category',
  'My work queue',
  'Account 360',
  'People & Organisation',
  'No platform admin access',
  'Pricing remains segmented by account type',
  'Billing details are restricted by your platform role.',
  "? account.billingOfferName || 'Missing'",
  ": 'Restricted'",
  'canManageClassification={data.admin.canManageClassification}',
  'canReadBilling={data.admin.canReadBilling}',
  'grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6',
  'data-admin-command-centre="true"',
])
assert.ok(
  commandCentre.includes("['wewed_internal', 'Wewed']"),
  'Internal Wewed records must remain their own account population.',
)

const secureAdmin = requireAll('src/components/admin/secure-wewed-admin.tsx', [
  '<AdminCommandCentre />',
  '<GovernedWewedAdminConsole />',
  'wewed-admin-responsive',
  'admin-governance-responsive',
])
assert.ok(
  secureAdmin.indexOf('<AdminCommandCentre />') < secureAdmin.indexOf('<GovernedWewedAdminConsole />'),
  'The command centre must augment rather than replace the governed lifecycle and RBAC console.',
)

const nav = requireAll('src/components/admin/admin-utility-nav.tsx', [
  'Wewed administrator mobile navigation',
  'grid grid-cols-5',
  'More Admin navigation',
  'Planner profiles',
  'Roles & access',
])
assert.ok(
  !nav.includes('overflow-x-auto'),
  'Primary Admin navigation must not rely on horizontal scrolling.',
)

requireAll('src/app/admin/admin-responsive.css', [
  'overflow-x: clip',
  'scrollbar-gutter: stable both-edges',
  'table[class*="min-w-[1050px]"]',
  'grid-template-columns: repeat(2, minmax(0, 1fr))',
  '[data-admin-identity-review-trigger="true"]',
  ':not(:has(tbody td:nth-child(9)))',
  ':has(tbody td:nth-child(9))',
  'content: "Activity"',
  'content: "Signals"',
  'content: "Inspect"',
])

const postgresIntegration = requireAll(
  'scripts/admin-command-center-postgres-integration.sql',
  [
    'e2e-command-centre-move-source',
    'e2e-command-centre-move-target',
    'Offering move left stale source classification',
    'Offering move did not refresh destination classification',
  ],
)
assert.ok(
  postgresIntegration.includes("classification_source IS DISTINCT FROM 'manual'"),
  'Vendor-offering refresh coverage must continue proving that manual classifications are never overwritten.',
)

const browser = requireAll('tests/e2e/admin-command-centre-responsive.spec.ts', [
  "name: 'small phone', width: 360, height: 800",
  "name: 'phone', width: 390, height: 844",
  "name: 'tablet portrait', width: 768, height: 1024",
  "name: 'tablet landscape', width: 1024, height: 768",
  "name: 'windows compact laptop', width: 1280, height: 720",
  "name: 'windows standard laptop', width: 1366, height: 768",
  'expectNoDocumentOverflow(page)',
  'identity control stays above mobile navigation',
  'mandatory horizontal scrolling',
  "name: 'Command centre sections'",
  "getByRole('button', { name: 'Accounts', exact: true })",
])
assert.ok(browser.includes("getByRole('button', { name: 'More' })"))

requireAll('tests/e2e/support/admin-browser.ts', [
  'WEWED_E2E_MODE',
  'local PostgreSQL database',
  "'wewed-platform'",
  "'wewed_super_admin'",
  'PlatformAdministrator',
  "role: 'admin'",
  'The shared planner reset truncates public tables with CASCADE',
  'ON CONFLICT ("businessAccountId", "userId") DO UPDATE SET',
])

console.log('Admin command centre plan contract: PASS')
