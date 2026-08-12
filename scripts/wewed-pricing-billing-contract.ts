import { readFileSync } from 'node:fs'
import {
  BILLING_OFFER_BY_CODE,
  WEWED_PLAN_BY_ID,
  WEWED_PLANS,
  annualMonthlyEquivalent,
  billingOfferAllowsAccountType,
  billingOffersForAccountType,
  resolveBillingOfferCode,
} from '../src/lib/wewed-plans'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[wewed-pricing-contract] ${message}`)
}

const publicPricing = readFileSync(
  'src/components/public/wewed-pricing-catalog.tsx',
  'utf8',
)
const billingPortal = readFileSync(
  'src/components/billing/account-billing-portal.tsx',
  'utf8',
)
const billingRoute = readFileSync(
  'src/app/api/billing/account/route.ts',
  'utf8',
)
const billingSyncRoute = readFileSync(
  'src/app/api/billing/sync/route.ts',
  'utf8',
)
const webhookRoute = readFileSync(
  'src/app/api/stripe/webhook/route.ts',
  'utf8',
)
const stripeBilling = readFileSync('src/lib/stripe-billing.ts', 'utf8')
const registration = readFileSync(
  'src/components/public/public-registration-form.tsx',
  'utf8',
)
const rootLayout = readFileSync('src/app/layout.tsx', 'utf8')
const weddingHome = readFileSync(
  'src/components/wedding/wedding-home.tsx',
  'utf8',
)
const pricingPage = readFileSync('src/app/pricing/page.tsx', 'utf8')

assert(
  WEWED_PLANS.length === 4,
  'The compatibility Free, Canon, Forever, and Enterprise catalog must remain available.',
)
assert(WEWED_PLAN_BY_ID.free.monthlyCents === 0, 'Free must remain free.')
assert(
  WEWED_PLAN_BY_ID.starter.monthlyCents === 1500,
  'Canon monthly must remain $15.',
)
assert(
  WEWED_PLAN_BY_ID.starter.annualCents === 15000,
  'Canon annual must remain $150.',
)
assert(
  WEWED_PLAN_BY_ID.professional.monthlyCents === 3900,
  'Planner Professional monthly must remain $39.',
)
assert(
  WEWED_PLAN_BY_ID.professional.annualCents === 39000,
  'Planner Professional annual must remain $390.',
)
assert(
  WEWED_PLAN_BY_ID.enterprise.selfService === false,
  'Contract/Enterprise must remain sales-assisted.',
)
assert(
  annualMonthlyEquivalent(WEWED_PLAN_BY_ID.starter) === 1250,
  'Canon annual equivalent must be $12.50/month.',
)
assert(
  annualMonthlyEquivalent(WEWED_PLAN_BY_ID.professional) === 3250,
  'Planner Professional annual equivalent must be $32.50/month.',
)

assert(
  billingOffersForAccountType('couple')
    .map((offer) => offer.code)
    .join(',') === 'couple_free,couple_canon',
  'Couples must receive only couple offers.',
)
assert(
  billingOffersForAccountType('planning_company')
    .map((offer) => offer.code)
    .join(',') === 'planner_free,planner_professional',
  'Planning companies must receive only planner offers.',
)
assert(
  billingOfferAllowsAccountType('couple_canon', 'planning_company') === false,
  'A planner account must never purchase a couple offer.',
)
assert(
  billingOfferAllowsAccountType('planner_professional', 'couple') === false,
  'A couple account must never purchase a planner offer.',
)
assert(
  resolveBillingOfferCode({
    accountType: 'couple',
    legacyPlan: 'starter',
  }) === 'couple_canon',
  'Legacy Canon must map deterministically for a couple.',
)
assert(
  resolveBillingOfferCode({
    accountType: 'planning_company',
    legacyPlan: 'professional',
  }) === 'planner_professional',
  'Legacy Professional must map deterministically for a planner.',
)
assert(
  BILLING_OFFER_BY_CODE.vendor_growth.selfService === false &&
    BILLING_OFFER_BY_CODE.venue_portfolio.selfService === false,
  'Vendor and venue paid offers must remain contract-only until dedicated prices are approved.',
)

assert(
  publicPricing.includes("setInterval('year')"),
  'Public pricing must expose annual billing.',
)
assert(
  publicPricing.includes('Annual · 2 months free'),
  'Public pricing must explain the annual discount.',
)
assert(
  pricingPage.includes('WewedPricingCatalog'),
  'The public pricing route must render the compatibility catalog.',
)
assert(
  billingPortal.includes('type WewedBillingInterval'),
  'Billing UI must use the canonical billing interval type.',
)
assert(
  billingPortal.includes('body: JSON.stringify({ action, offerCode, interval })'),
  'Billing Checkout must submit an account-specific offer and interval.',
)
assert(
  billingPortal.includes('Stripe Sandbox:'),
  'Preview billing must clearly identify sandbox mode.',
)
assert(
  billingPortal.includes("fetch('/api/billing/sync'"),
  'Billing UI must support authenticated Stripe reconciliation.',
)
assert(
  billingPortal.includes('Your departments, systems, and resources'),
  'Billing must show category-specific operational areas.',
)
assert(
  billingPortal.includes('Only category-compatible offers are available.'),
  'Billing must state its audience boundary.',
)
assert(
  billingPortal.includes('aria-label="Subscription overview"'),
  'Billing must expose one semantic subscription overview.',
)
assert(
  billingPortal.includes('grid grid-cols-2 lg:grid-cols-4'),
  'Subscription metrics must stay compact on mobile and wide screens.',
)
assert(
  billingPortal.includes("cancellationScheduled ? 'Access until' : 'Next renewal'"),
  'Billing must distinguish cancellation access from renewal dates.',
)
assert(
  billingPortal.includes('will not renew'),
  'Billing must warn that a scheduled cancellation stops renewal.',
)
assert(
  billingPortal.includes("timeZone: 'UTC'"),
  'Billing dates must not shift by browser timezone.',
)

assert(
  billingRoute.includes('isWewedBillingInterval'),
  'Billing API must validate the interval.',
)
assert(
  billingRoute.includes('resolveBillingOfferCode'),
  'Billing API must resolve the offer inside the account category.',
)
assert(
  billingRoute.includes('stripePriceIdForOffer(offerCode, intervalValue)'),
  'Billing API must resolve an offer-specific Stripe price.',
)
assert(
  billingRoute.includes('accountType: resolved.account.type'),
  'Checkout must receive the resolved account category.',
)
assert(
  billingRoute.includes('stripeAccountMetadataKeys()'),
  'Billing API must resolve environment-specific account metadata keys.',
)
assert(
  billingRoute.includes('metadataText(metadata, keys.customerId)'),
  'Billing must read the environment-specific Stripe customer.',
)
assert(
  billingRoute.includes('cancelAtPeriodEnd: metadataBoolean'),
  'Billing account API must expose scheduled cancellation state.',
)

assert(
  billingSyncRoute.includes("status: 'all'"),
  'Reconciliation must search all Stripe subscription states.',
)
assert(
  billingSyncRoute.includes(
    'subscriptionMetadata.businessAccountId === account.id',
  ),
  'Reconciliation must match the governed account.',
)
assert(
  billingSyncRoute.includes(
    'subscriptionMetadata.environment === environment',
  ),
  'Reconciliation must enforce Stripe environment isolation.',
)
assert(
  billingSyncRoute.includes('subscriptionMetadata.accountType'),
  'Reconciliation must verify the Stripe audience.',
)
assert(
  billingSyncRoute.includes('subscriptionMetadata.offerCode'),
  'Reconciliation must verify the Stripe offer.',
)
assert(
  billingSyncRoute.includes('BusinessAccountBillingProfile'),
  'Live reconciliation must update the account-aware billing profile.',
)
assert(
  billingSyncRoute.includes('liveBillingProfileWriteSkipped'),
  'Sandbox profile isolation must be auditable.',
)
assert(
  billingSyncRoute.includes('if (stripeUsesTestMode())'),
  'Sandbox reconciliation must avoid live billing state.',
)

assert(
  stripeBilling.includes("process.env.VERCEL_ENV !== 'production'"),
  'Only explicit Vercel Production may read live Stripe variables.',
)
assert(
  stripeBilling.includes('STRIPE_SECRET_KEY'),
  'Production Stripe secret mapping is required.',
)
assert(
  stripeBilling.includes('STRIPE_WEBHOOK_SECRET'),
  'Production webhook secret mapping is required.',
)
assert(
  stripeBilling.includes('STRIPE_PRICE_CANON_MONTHLY'),
  'Production Couple Canon monthly mapping is required.',
)
assert(
  stripeBilling.includes('STRIPE_PRICE_CANON_ANNUAL'),
  'Production Couple Canon annual mapping is required.',
)
assert(
  stripeBilling.includes('STRIPE_PRICE_FOREVER_MONTHLY'),
  'Production Planner Professional monthly mapping is required.',
)
assert(
  stripeBilling.includes('STRIPE_PRICE_FOREVER_ANNUAL'),
  'Production Planner Professional annual mapping is required.',
)
assert(
  stripeBilling.includes('STRIPE_PRICE_VENDOR_GROWTH_MONTHLY'),
  'Future vendor pricing must use a dedicated variable.',
)
assert(
  stripeBilling.includes('STRIPE_PRICE_VENUE_PORTFOLIO_MONTHLY'),
  'Future venue pricing must use a dedicated variable.',
)
assert(
  stripeBilling.includes('STRIPE_TEST_SECRET_KEY'),
  'Preview test Stripe secret mapping is required.',
)
assert(
  !stripeBilling.includes("? optional('STRIPE_TEST_SECRET_KEY', 'STRIPE_SECRET_KEY')"),
  'Preview must never fall back to the live secret key.',
)
assert(
  stripeBilling.includes(
    "const prefix = stripeUsesTestMode() ? 'stripeTest' : 'stripe'",
  ),
  'Sandbox and live account metadata must use separate namespaces.',
)
assert(
  stripeBilling.includes("'metadata[accountType]': input.accountType"),
  'Stripe customer and Checkout metadata must record the account category.',
)
assert(
  stripeBilling.includes("'metadata[offerCode]': input.offerCode"),
  'Checkout metadata must preserve the offer code.',
)
assert(
  stripeBilling.includes("'metadata[interval]': input.interval"),
  'Checkout metadata must preserve billing interval.',
)

assert(
  webhookRoute.includes('event.livemode !== expectedLivemode'),
  'Webhooks must reject test/live environment mismatches.',
)
assert(
  webhookRoute.includes('stripeEventResourceId(event.id)'),
  'Webhook idempotency must be namespaced by environment.',
)
assert(
  webhookRoute.includes('resolveEventOffer'),
  'Webhook processing must validate account category and offer.',
)
assert(
  webhookRoute.includes('BusinessAccountBillingProfile'),
  'Live webhooks must update the account-aware billing profile.',
)
assert(
  webhookRoute.includes('if (stripeUsesTestMode()) return'),
  'Sandbox invoices must never enter the live PaymentRecord ledger.',
)
assert(
  webhookRoute.includes('sandboxLedgerWriteSkipped: stripeUsesTestMode()'),
  'Sandbox ledger isolation must be auditable.',
)
assert(
  webhookRoute.includes(
    'sandboxBillingProfileWriteSkipped: stripeUsesTestMode()',
  ),
  'Sandbox billing-profile isolation must be auditable.',
)
assert(
  registration.includes('WEWED_PLANS.map((plan)'),
  'Registration compatibility choices must remain catalog-driven.',
)
assert(
  !rootLayout.includes('GlobalWeddingTools'),
  'Billing and public routes must remain isolated from wedding-only utilities.',
)
assert(
  weddingHome.includes(
    '<GlobalWeddingTools accessKind={accessKind} viewerRole={viewerRole} />',
  ),
  'Role-aware wedding-only utilities must remain available inside authorized wedding homes.',
)

console.log(
  '[wewed-pricing-contract] Account-specific offers, Stripe billing, and environment-isolation contracts passed.',
)
