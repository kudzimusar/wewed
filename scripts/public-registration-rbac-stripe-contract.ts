import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function file(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

const [
  registration,
  roles,
  webhook,
  billing,
  globalTools,
  adminLayout,
  landingPage,
  pricingLinks,
] = await Promise.all([
  file('src/app/api/auth/register/route.ts'),
  file('src/app/api/admin/roles/route.ts'),
  file('src/app/api/stripe/webhook/route.ts'),
  file('src/app/api/billing/account/route.ts'),
  file('src/components/wedding/global-wedding-tools.tsx'),
  file('src/app/admin/layout.tsx'),
  file('src/app/page.tsx'),
  file('src/components/public/pricing-registration-links.tsx'),
])

assert.match(registration, /status.*pending_review/s)
assert.match(registration, /role: 'viewer'/)
assert.match(registration, /isActive: false/)
assert.match(registration, /internalOnboardingRequired: true/)
assert.doesNotMatch(registration, /wewed_super_admin/)

assert.match(roles, /inviteUserByEmail/)
assert.match(roles, /Only a Super Admin may assign the Super Admin role/)
assert.match(roles, /At least one active Wewed Super Admin must remain/)
assert.match(roles, /separate Wewed administrator email/)

assert.match(webhook, /verifyStripeWebhookSignature/)
assert.match(webhook, /eventAlreadyProcessed/)
assert.match(webhook, /stripe\.webhook_processed/)
assert.match(webhook, /PaymentRecord/)

assert.match(billing, /createStripeCheckoutSession/)
assert.match(billing, /createStripePortalSession/)
assert.match(billing, /account\.status !== 'active'/)
assert.match(billing, /stripePriceIdForPlan/)

assert.match(globalTools, /PublicRegistrationTrigger/)
assert.match(adminLayout, /AdminUtilityNav/)
assert.match(landingPage, /PricingRegistrationLinks/)
assert.match(pricingLinks, /\/register\?plan=free/)
assert.match(pricingLinks, /\/register\?plan=starter/)
assert.match(pricingLinks, /\/register\?plan=professional/)

console.log('Public registration, RBAC provisioning and Stripe contracts passed.')
