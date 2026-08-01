import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function file(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

const [
  registration,
  registrationForm,
  roles,
  webhook,
  billing,
  globalTools,
  adminLayout,
  adminApprovalsRoute,
  landingPage,
  pricingCatalog,
] = await Promise.all([
  file('src/app/api/auth/register/route.ts'),
  file('src/components/public/public-registration-form.tsx'),
  file('src/app/api/admin/roles/route.ts'),
  file('src/app/api/stripe/webhook/route.ts'),
  file('src/app/api/billing/account/route.ts'),
  file('src/components/wedding/global-wedding-tools.tsx'),
  file('src/app/admin/layout.tsx'),
  file('src/app/admin/approvals/page.tsx'),
  file('src/app/page.tsx'),
  file('src/components/public/wewed-pricing-catalog.tsx'),
])

assert.match(registration, /status.*pending_review/s)
assert.match(registration, /INSERT INTO public\."User"/)
assert.match(registration, /'viewer', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP/)
assert.doesNotMatch(registration, /db\.user\.create\(/)
assert.match(registration, /internalOnboardingRequired: true/)
assert.doesNotMatch(registration, /wewed_super_admin/)

assert.match(registrationForm, /searchParams\.get\('confirmed'\) === '1'/)
assert.match(registrationForm, /Application pending review/)
assert.match(registrationForm, /Do not submit another application/)
assert.match(registrationForm, /autoComplete="new-password"/)

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
assert.match(adminApprovalsRoute, /redirect\('\/admin'\)/)
assert.match(landingPage, /WewedPricingCatalog/)
assert.match(pricingCatalog, /\/register\?plan=/)
assert.match(pricingCatalog, /WEWED_PLANS/)
assert.match(pricingCatalog, /Annual · 2 months free/)

console.log('Public registration, RBAC provisioning and Stripe contracts passed.')
