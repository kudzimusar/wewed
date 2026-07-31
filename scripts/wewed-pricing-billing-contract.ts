import { readFileSync } from 'node:fs'
import {
  WEWED_PLAN_BY_ID,
  WEWED_PLANS,
  annualMonthlyEquivalent,
} from '../src/lib/wewed-plans'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`[wewed-pricing-contract] ${message}`)
}

const publicPricing = readFileSync('src/components/public/wewed-pricing-catalog.tsx', 'utf8')
const billingPortal = readFileSync('src/components/billing/account-billing-portal.tsx', 'utf8')
const billingRoute = readFileSync('src/app/api/billing/account/route.ts', 'utf8')
const stripeBilling = readFileSync('src/lib/stripe-billing.ts', 'utf8')
const registration = readFileSync('src/components/public/public-registration-form.tsx', 'utf8')

assert(WEWED_PLANS.length === 4, 'Free, Canon, Forever and Enterprise must all exist.')
assert(WEWED_PLAN_BY_ID.free.monthlyCents === 0, 'Free must remain free.')
assert(WEWED_PLAN_BY_ID.starter.monthlyCents === 1500, 'Canon monthly must remain $15.')
assert(WEWED_PLAN_BY_ID.starter.annualCents === 15000, 'Canon annual must remain $150.')
assert(WEWED_PLAN_BY_ID.professional.monthlyCents === 3900, 'Forever monthly must remain $39.')
assert(WEWED_PLAN_BY_ID.professional.annualCents === 39000, 'Forever annual must remain $390.')
assert(WEWED_PLAN_BY_ID.enterprise.selfService === false, 'Enterprise must remain sales-assisted.')
assert(annualMonthlyEquivalent(WEWED_PLAN_BY_ID.starter) === 1250, 'Canon annual equivalent must be $12.50/month.')
assert(annualMonthlyEquivalent(WEWED_PLAN_BY_ID.professional) === 3250, 'Forever annual equivalent must be $32.50/month.')

assert(publicPricing.includes("setInterval('year')"), 'Public pricing must expose annual billing.')
assert(publicPricing.includes('Annual · 2 months free'), 'Public pricing must explain the annual discount.')
assert(billingPortal.includes("interval: WewedBillingInterval"), 'Billing UI must submit the selected interval.')
assert(billingPortal.includes("openBilling('checkout', plan.id, interval)"), 'Billing Checkout must include plan and interval.')
assert(billingRoute.includes('isWewedBillingInterval'), 'Billing API must validate the interval.')
assert(billingRoute.includes('stripePriceIdForPlan(plan, interval)'), 'Billing API must resolve interval-specific prices.')
assert(stripeBilling.includes('STRIPE_PRICE_CANON_MONTHLY'), 'Canon monthly environment mapping is required.')
assert(stripeBilling.includes('STRIPE_PRICE_CANON_ANNUAL'), 'Canon annual environment mapping is required.')
assert(stripeBilling.includes('STRIPE_PRICE_FOREVER_MONTHLY'), 'Forever monthly environment mapping is required.')
assert(stripeBilling.includes('STRIPE_PRICE_FOREVER_ANNUAL'), 'Forever annual environment mapping is required.')
assert(stripeBilling.includes("'metadata[interval]': input.interval"), 'Checkout metadata must preserve billing interval.')
assert(registration.includes("WEWED_PLANS.map((plan)"), 'Registration choices must come from the canonical pricing catalog.')

console.log('[wewed-pricing-contract] Pricing and Stripe billing contracts passed.')
