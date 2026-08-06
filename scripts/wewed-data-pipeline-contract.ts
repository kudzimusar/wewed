import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

async function file(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8')
}

const [
  migration,
  weddingAccess,
  signin,
  sessionRefresh,
  onboarding,
  billing,
  webhook,
  navigation,
] = await Promise.all([
  file('prisma/migrations/20260730224000_harden_wewed_data_pipeline/migration.sql'),
  file('src/lib/wedding-access.ts'),
  file('src/app/api/auth/signin/route.ts'),
  file('src/app/api/auth/me/route.ts'),
  file('src/app/api/admin/onboarding/route.ts'),
  file('src/app/api/billing/account/route.ts'),
  file('src/app/api/stripe/webhook/route.ts'),
  file('src/components/admin/admin-utility-nav.tsx'),
])

assert.match(migration, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon/)
assert.match(migration, /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated/)
assert.match(migration, /BusinessAccount_source_unique/)
assert.match(migration, /PaymentRecord_provider_reference_unique/)
assert.match(migration, /BusinessAuditLog_stripe_event_unique/)
assert.match(migration, /validate_business_account_link/)
assert.match(migration, /validate_business_owner_membership/)
assert.match(migration, /validate_business_lifecycle/)
assert.match(migration, /validate_public_onboarding_completion/)
assert.match(migration, /protect_final_super_admin/)

assert.match(weddingAccess, /isWewedPlatformAdministrator/)
assert.match(weddingAccess, /return \[\]/)
assert.match(weddingAccess, /any_bam/)
assert.match(weddingAccess, /ba\."onboardingStatus" = 'complete'/)
assert.match(weddingAccess, /NOT EXISTS \([\s\S]*any_bam/)
assert.match(weddingAccess, /OR EXISTS \([\s\S]*bam\.status = 'active'/)

assert.match(signin, /WEWED_PLATFORM_SESSION_ID/)
assert.match(signin, /activeWedding: null/)
assert.match(signin, /weddings: \[\]/)
assert.match(sessionRefresh, /workspace: 'wewed_platform'/)
assert.match(sessionRefresh, /isWewedPlatformAdministrator/)

assert.match(onboarding, /db\.\$transaction/)
assert.match(onboarding, /business_account\.onboarding_completed/)
assert.match(onboarding, /weddingMembership\.upsert/)
assert.match(onboarding, /BusinessAccountLink/)
assert.match(onboarding, /login activation is blocked until its dedicated stakeholder portal/)
assert.match(onboarding, /"onboardingStatus" = 'complete'/)

assert.match(billing, /businessMemberCanManageBilling/)
assert.match(billing, /onboardingStatus !== 'complete'/)
assert.match(
  billing,
  /COALESCE\(metadata,\s*'\{\}'::jsonb\)\s*\|\|\s*jsonb_build_object/,
)
assert.match(billing, /keys\.customerId/)
assert.match(billing, /Only a business owner or billing manager/)
assert.match(billing, /resolveBillingOfferCode/)
assert.match(billing, /isWewedBillableAccountType/)

assert.match(webhook, /pg_advisory_xact_lock/)
assert.match(webhook, /stripe\.webhook_processed/)
assert.match(webhook, /UPDATE wewed_admin\."PaymentRecord"/)
assert.match(webhook, /could not be matched to a Wewed account/)
assert.match(webhook, /event\.livemode !== expectedLivemode/)
assert.match(webhook, /if \(stripeUsesTestMode\(\)\) return/)
assert.match(webhook, /resolveEventOffer/)
assert.doesNotMatch(webhook, /text\(object\.status\) === 'complete' \? 'active'/)

assert.match(navigation, /\/admin\/onboarding/)
assert.match(navigation, /\/admin\/client-operations/)

console.log('Wewed stakeholder data-pipeline contracts passed.')
