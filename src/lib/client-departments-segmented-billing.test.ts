import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BILLING_OFFER_BY_CODE,
  billingOfferAllowsAccountType,
  billingOffersForAccountType,
  defaultBillingOfferCode,
  resolveBillingOfferCode,
} from './wewed-plans'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path), 'utf8')

describe('client departments and segmented billing contract', () => {
  test('each customer category has an isolated offer catalog', () => {
    expect(billingOffersForAccountType('couple').map((offer) => offer.code)).toEqual([
      'couple_free',
      'couple_canon',
    ])
    expect(
      billingOffersForAccountType('planning_company').map((offer) => offer.code),
    ).toEqual(['planner_free', 'planner_professional'])
    expect(billingOffersForAccountType('vendor').map((offer) => offer.code)).toEqual([
      'vendor_profile',
      'vendor_growth',
    ])
    expect(billingOffersForAccountType('venue').map((offer) => offer.code)).toEqual([
      'venue_profile',
      'venue_portfolio',
    ])
    expect(billingOffersForAccountType('client').map((offer) => offer.code)).toEqual([
      'client_custom',
    ])

    expect(billingOfferAllowsAccountType('couple_canon', 'couple')).toBe(true)
    expect(billingOfferAllowsAccountType('couple_canon', 'planning_company')).toBe(false)
    expect(billingOfferAllowsAccountType('planner_professional', 'couple')).toBe(false)
    expect(BILLING_OFFER_BY_CODE.vendor_growth.selfService).toBe(false)
    expect(BILLING_OFFER_BY_CODE.venue_portfolio.selfService).toBe(false)
    expect(BILLING_OFFER_BY_CODE.client_custom.selfService).toBe(false)
  })

  test('legacy plan compatibility is deterministic within the resolved account type', () => {
    expect(
      resolveBillingOfferCode({ accountType: 'couple', legacyPlan: 'starter' }),
    ).toBe('couple_canon')
    expect(
      resolveBillingOfferCode({
        accountType: 'planning_company',
        legacyPlan: 'professional',
      }),
    ).toBe('planner_professional')
    expect(
      resolveBillingOfferCode({
        accountType: 'planning_company',
        offerCode: 'couple_canon',
      }),
    ).toBeNull()
    expect(defaultBillingOfferCode('vendor')).toBe('vendor_profile')
    expect(defaultBillingOfferCode('venue')).toBe('venue_profile')
    expect(defaultBillingOfferCode('client')).toBe('client_custom')
  })

  test('migration is additive, private, idempotent, and preserves legacy rows', () => {
    const migration = source(
      'prisma/migrations/20260806190000_client_departments_segmented_billing/migration.sql',
    )

    expect(migration).toContain('wewed_admin."ClientDepartmentDefinition"')
    expect(migration).toContain('wewed_admin."BusinessAccountDepartment"')
    expect(migration).toContain('wewed_admin."BillingOffer"')
    expect(migration).toContain('wewed_admin."BusinessAccountBillingProfile"')
    expect(migration).toContain('ON CONFLICT ("businessAccountId") DO NOTHING')
    expect(migration).toContain('ALTER TABLE wewed_admin."BillingOffer" ENABLE ROW LEVEL SECURITY')
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE')
    expect(migration).toContain("ARRAY['anon', 'authenticated']")
    expect(migration).not.toContain('DELETE FROM wewed_admin."BusinessAccount"')
    expect(migration).not.toContain('DELETE FROM wewed_admin."PaymentRecord"')
    expect(migration).not.toContain('DROP TABLE')
    expect(migration).not.toContain('CREATE VIEW public."BillingOffer"')
  })

  test('checkout binds audience, offer, and account before Stripe customer creation', () => {
    const route = source('src/app/api/billing/account/route.ts')
    const stripe = source('src/lib/stripe-billing.ts')

    expect(route).toContain('resolveBillingOfferCode')
    expect(route).toContain('isWewedBillableAccountType')
    expect(route).toContain('stripePriceIdForOffer(offerCode, intervalValue)')
    expect(route).toContain('accountType: resolved.account.type')
    expect(route).toContain('offerCode,')
    expect(route).toContain('requires contract or internal onboarding')
    expect(stripe).toContain("'metadata[accountType]': input.accountType")
    expect(stripe).toContain("'metadata[offerCode]': input.offerCode")
    expect(stripe).toContain("'subscription_data[metadata][accountType]': input.accountType")
    expect(stripe).toContain("'subscription_data[metadata][offerCode]': input.offerCode")
    expect(stripe).toContain('offer.accountType !== input.accountType')
    expect(stripe).toContain('STRIPE_PRICE_VENDOR_GROWTH_MONTHLY')
    expect(stripe).toContain('STRIPE_PRICE_VENUE_PORTFOLIO_MONTHLY')
  })

  test('Stripe synchronization and webhook preserve sandbox/live separation', () => {
    const sync = source('src/app/api/billing/sync/route.ts')
    const webhook = source('src/app/api/stripe/webhook/route.ts')

    expect(sync).toContain('subscriptionMetadata.accountType')
    expect(sync).toContain('subscriptionMetadata.offerCode')
    expect(sync).toContain('BusinessAccountBillingProfile')
    expect(sync).toContain('liveBillingProfileWriteSkipped: stripeUsesTestMode()')
    expect(sync).toContain('if (stripeUsesTestMode())')
    expect(webhook).toContain('resolveEventOffer')
    expect(webhook).toContain('Stripe event account category does not match Wewed')
    expect(webhook).toContain('BusinessAccountBillingProfile')
    expect(webhook).toContain('sandboxBillingProfileWriteSkipped: stripeUsesTestMode()')
    expect(webhook).toContain('if (stripeUsesTestMode()) return')
  })

  test('Admin client systems remain scope-checked, reasoned, and audited', () => {
    const api = source('src/app/api/admin/client-operations/route.ts')
    const consoleSource = source(
      'src/components/admin/client-operations-console.tsx',
    )
    const nav = source('src/components/admin/admin-utility-nav.tsx')

    expect(api).toContain("requireWewedAdmin(\n      request,\n      'admin.departments.read'")
    expect(api).toContain("assertWewedAdminPermission(context, 'admin.departments.manage')")
    expect(api).toContain("action !== 'replace_account_departments'")
    expect(api).toContain('buildBusinessAccountScopeSql')
    expect(api).toContain('accountScopeAllows')
    expect(api).toContain('FOR UPDATE')
    expect(api).toContain("action: 'account.departments_replaced'")
    expect(api).toContain('previousDepartmentKeys')
    expect(api).toContain('nextDepartmentKeys')
    expect(api).toContain('category billing/support department must remain enabled')
    expect(consoleSource).toContain('Departments, systems, and billing')
    expect(consoleSource).toContain('Required reason for changing enabled departments')
    expect(consoleSource).toContain('Segmented offer catalog')
    expect(consoleSource).toContain('definition.dataPoints')
    expect(consoleSource).toContain('definition.resourceTools')
    expect(nav).toContain("'/admin/client-operations'")
    expect(nav).toContain('Client systems')
  })
})
