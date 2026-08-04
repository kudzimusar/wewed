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
  publicShell,
  adminLayout,
  adminApprovalsRoute,
  dashboardAuthGate,
  forgotPasswordPage,
  resetPasswordPage,
  confirmSignupTemplate,
  resetPasswordTemplate,
  landingPage,
  pricingPage,
  pricingCatalog,
] = await Promise.all([
  file('src/app/api/auth/register/route.ts'),
  file('src/components/public/public-registration-form.tsx'),
  file('src/app/api/admin/roles/route.ts'),
  file('src/app/api/stripe/webhook/route.ts'),
  file('src/app/api/billing/account/route.ts'),
  file('src/components/wedding/global-wedding-tools.tsx'),
  file('src/components/public/public-platform-shell.tsx'),
  file('src/app/admin/layout.tsx'),
  file('src/app/admin/approvals/page.tsx'),
  file('src/components/wedding/dashboard-auth-gate.tsx'),
  file('src/app/forgot-password/page.tsx'),
  file('src/app/reset-password/page.tsx'),
  file('supabase/email-templates/confirm-signup.html'),
  file('supabase/email-templates/reset-password.html'),
  file('src/app/page.tsx'),
  file('src/app/pricing/page.tsx'),
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

assert.doesNotMatch(globalTools, /PublicRegistrationTrigger/)
assert.match(publicShell, /href="\/register"/)
assert.match(publicShell, /Create a Wewed account/)
assert.match(publicShell, /href="\/sign-in"/)
assert.match(adminLayout, /AdminUtilityNav/)
assert.match(adminApprovalsRoute, /redirect\('\/admin'\)/)

assert.match(dashboardAuthGate, /Forgot password\?/)
assert.match(dashboardAuthGate, /\/forgot-password/)
assert.match(forgotPasswordPage, /resetPasswordForEmail/)
assert.match(forgotPasswordPage, /\/reset-password/)
assert.match(forgotPasswordPage, /without revealing whether the address is registered/)
assert.match(resetPasswordPage, /setSession/)
assert.match(resetPasswordPage, /updateUser\(\{ password \}\)/)
assert.match(resetPasswordPage, /signOut\(\{ scope: 'global' \}\)/)
assert.match(resetPasswordPage, /history\.replaceState/)
assert.match(resetPasswordPage, /at least 12 characters/)

for (const template of [confirmSignupTemplate, resetPasswordTemplate]) {
  assert.match(template, /WEWED · SECURE ACCESS/)
  assert.match(template, /\{\{ \.ConfirmationURL \}\}/)
  assert.match(template, /single-use and time-limited/)
  assert.match(template, /never ask you to send a password, access token, or recovery code/)
}
assert.match(confirmSignupTemplate, /does not activate dashboard access/)
assert.match(confirmSignupTemplate, /pending until a Wewed administrator reviews/)
assert.match(resetPasswordTemplate, /Choose a new password/)
assert.match(resetPasswordTemplate, /never forward it to another person/)

assert.match(landingPage, /PublicPlatformHome/)
assert.match(pricingPage, /WewedPricingCatalog/)
assert.match(pricingCatalog, /\/register\?plan=/)
assert.match(pricingCatalog, /WEWED_PLANS/)
assert.match(pricingCatalog, /Annual · 2 months free/)

console.log('Public registration, RBAC provisioning, auth recovery, branded email and Stripe contracts passed.')
