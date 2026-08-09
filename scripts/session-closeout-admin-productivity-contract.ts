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

const plan = requireAll('docs/product/session-closeout-admin-productivity-plan-2026-08-09.md', [
  'Stage 1 — production completion',
  'Stage 2A — durable Admin work items',
  'Stage 2B — governed pricing offer management',
  'Stage 2C — global Admin command palette',
  'Stage 2D — scoped exports',
  'Stage 2E — keyboard productivity',
  'Stage 3 — final qualification',
  'Existing Admin permission and scope checks remain authoritative',
  'Already-applied migrations are immutable',
  '360x800',
  '1366x768',
  'exact-head SHA guard',
])
assert.ok(
  plan.indexOf('Stage 1 — production completion') < plan.indexOf('Stage 2A — durable Admin work items'),
  'Production alignment must remain the first closeout stage.',
)

const migration = requireAll(
  'prisma/migrations/20260809143000_session_closeout_admin_productivity/migration.sql',
  [
    'ADD COLUMN IF NOT EXISTS "offerFamilyCode"',
    'ADD COLUMN IF NOT EXISTS "supersedesOfferCode"',
    'BillingOffer_family_type_version_unique',
    'protect_billing_offer_commercial_history',
    'sync_admin_operational_work_items',
    'AdminWorkItem',
    "ba.\"ownerUserId\" IS NOT NULL",
    "claim.status IN ('pending','under_review','verification_required')",
    'ProviderVerification',
    'PlannerEngagement',
    "item.source <> 'manual'",
    "item.status <> 'dismissed'",
    'REVOKE ALL ON FUNCTION wewed_admin.sync_admin_operational_work_items() FROM PUBLIC',
  ],
)
assert.ok(
  !migration.includes('UPDATE wewed_admin."BusinessAccountBillingProfile"'),
  'Pricing versioning must never rewrite existing account offer assignments in the migration.',
)
assert.ok(
  !migration.includes('DELETE FROM wewed_admin."BillingOffer"'),
  'Historical BillingOffer rows must never be deleted.',
)
assert.ok(
  migration.includes("OLD.status = 'retired'"),
  'Retired pricing history must not be reactivated in place.',
)

const api = requireAll('src/app/api/admin/productivity/route.ts', [
  "requireWewedAdmin(request, 'admin.accounts.read')",
  'buildBusinessAccountScopeSql',
  'writeBusinessAudit',
  "mode === 'search'",
  "mode === 'export'",
  "mode === 'offers'",
  "action === 'sync_work_items'",
  "action === 'create_offer'",
  "action === 'version_offer'",
  "action === 'retire_offer'",
  "hasPermission(context, 'admin.billing.manage')",
  "People exports are restricted to Super Admin.",
  'admin.export.generated',
  'profile."offerCode"=offer."offerCode"',
  "SET status='retired'",
  'supersedesOfferCode',
])
assert.ok(
  api.includes("buildBusinessAccountScopeSql(context, 'ba'"),
  'Command search and exports must remain backed by server-side account scope SQL.',
)
assert.ok(
  !api.includes('SELECT * FROM public."User"'),
  'Productivity search must never expose the generic User population.',
)
assert.ok(
  api.includes("if (!canManageBilling(context))"),
  'Pricing mutation must remain behind billing management authority.',
)
assert.ok(
  api.includes('canReadQueueCategory(context, row.category)'),
  'Queue exports must be category-authorized server-side.',
)

const commandWrapper = requireAll('src/app/api/admin/command-center/route.ts', [
  'readCommandCentreCore',
  'mutateCommandCentreCore',
  'persistedKeys.has(workKey(item))',
  "item.category === 'onboarding'",
  'Boolean(account?.ownerEmail)',
  'account.onboardingStatus !== \'complete\'',
])
assert.ok(
  commandWrapper.indexOf('persistedKeys.has(workKey(item))') <
    commandWrapper.indexOf("item.category === 'onboarding'"),
  'Durable work must suppress matching projections before onboarding projection filtering.',
)

const commandCore = requireAll('src/lib/admin-command-center-route-core.ts', [
  'async function readPersistedWorkItems',
  'const projectedWork = [',
  "action === 'set_account_classification'",
  "action === 'set_staff_profile'",
  "action === 'save_view'",
  "action === 'update_work_item'",
  'canManageQueueCategory',
  'writeBusinessAudit',
])
assert.ok(
  !commandWrapper.includes('UPDATE wewed_admin."AdminWorkItem"'),
  'The compatibility wrapper must not duplicate governed mutation logic from the Command Centre core.',
)
assert.ok(
  commandCore.includes("requireWewedAdmin(request, 'admin.accounts.read')"),
  'Extracting the route core must preserve the existing Admin authorization boundary.',
)

const ui = requireAll('src/components/admin/admin-productivity-console.tsx', [
  'data-admin-productivity-console="true"',
  'Open Admin command palette',
  'Ctrl/⌘ K',
  'Sync work',
  'Pricing governance',
  'Accounts CSV',
  'Work queue CSV',
  'Workforce CSV',
  'Pricing CSV',
  "event.key === '/'",
  "key === 'g'",
  "if (key === 'a')",
  "if (key === 'p')",
  "if (key === 'c')",
  'isEditableTarget(event.target)',
  '/api/admin/productivity?mode=search',
  'Results are server-scoped to your Platform Administrator role.',
  'Existing account assignments always retain their historical offer row.',
])
assert.ok(
  !ui.includes('data.accounts.filter('),
  'The command palette must not depend on a client-side global account index.',
)

const secure = requireAll('src/components/admin/secure-wewed-admin.tsx', [
  'AdminProductivityConsole',
  '<AdminCommandCentre />',
  '<GovernedWewedAdminConsole />',
])
assert.ok(
  secure.indexOf('<AdminProductivityConsole>') < secure.indexOf('<AdminCommandCentre />'),
  'Productivity synchronization must wrap the existing Command Centre rather than replace it.',
)

const policy = requireAll('src/lib/wewed-admin-policy.ts', [
  'wewed_super_admin',
  'wewed_operations_admin',
  'wewed_billing_admin',
  'wewed_support_admin',
  'wewed_analyst',
  'admin.billing.manage',
  'admin.support.manage',
  'Database permissions can never expand a role beyond its code-defined ceiling.',
])
assert.ok(policy.includes('wewed_billing_admin: ['))
assert.ok(policy.includes('wewed_support_admin: ['))

console.log('Session closeout Admin productivity contract: PASS')
