import { readFileSync } from 'node:fs'

function read(path: string) {
  return readFileSync(path, 'utf8')
}

function requireText(source: string, needle: string, message: string) {
  if (!source.includes(needle)) throw new Error(message)
}

function forbidText(source: string, needle: string, message: string) {
  if (source.includes(needle)) throw new Error(message)
}

const plan = read('docs/product/database-integrity-vendor-admin-hardening-plan-2026-08-09.md')
const migration = read('prisma/migrations/20260809023000_harden_vendor_admin_database_integrity/migration.sql')
const claimRoute = read('src/app/api/admin/providers/claims/route.ts')
const importRoute = read('src/app/api/admin/providers/discovery/import/route.ts')
const postgres = read('scripts/database-integrity-vendor-admin-postgres.sql')

requireText(plan, 'BusinessAccount.type', 'Hardening plan must preserve BusinessAccount.type as canonical population key.')
requireText(plan, 'Do not create fake ownership', 'Hardening plan must explicitly protect unclaimed marketplace ownership semantics.')
requireText(plan, 'Repair only deterministic rows', 'Hardening plan must forbid ambiguous automated repairs.')
requireText(plan, 'Preserve migration immutability', 'Hardening plan must preserve applied migration history.')

requireText(migration, 'ProviderDiscoveryCandidate_importedBusinessAccountId_unique', 'Migration must enforce one imported candidate backlink per BusinessAccount.')
requireText(migration, 'ProviderClaimRequest_open_profile_email_unique', 'Migration must enforce one open claim per profile/email.')
requireText(migration, 'validate_provider_business_account_link', 'Migration must validate provider child account populations.')
requireText(migration, 'protect_provider_business_account_type', 'Migration must protect the BusinessAccount parent from incompatible type changes.')
requireText(migration, 'validate_candidate_backed_business_account_link', 'Migration must validate BusinessAccount -> discovery candidate provenance.')
requireText(migration, 'validate_discovery_candidate_import_link', 'Migration must validate discovery candidate -> BusinessAccount provenance.')
requireText(migration, 'validate_provider_claim_approval', 'Migration must validate authority when claims become approved.')
requireText(migration, "b.type IN ('vendor', 'venue')", 'Repair logic must support both vendor and venue provider populations.')
requireText(migration, "b.\"sourceType\" = 'provider_discovery_candidate'", 'Migration must repair candidate-backed sourceIds deterministically.')

forbidText(
  claimRoute,
  '"sourceType" = \'claimed_marketplace_listing\'',
  'Claim approval must not overwrite discovery provenance in BusinessAccount.sourceType.',
)
requireText(
  claimRoute,
  'SET status = \'approved\', "claimantUserId" = $4',
  'Claim approval must persist the resolved claimant user identity.',
)
requireText(
  claimRoute,
  'claimant.id,',
  'Claim approval must bind the persisted claimantUserId to the resolved active User.',
)

requireText(importRoute, "'marketplace_discovery'", 'Governed discovery importer must retain canonical marketplace discovery provenance.')
requireText(importRoute, '"importedBusinessAccountId" = $1', 'Governed discovery importer must write the candidate BusinessAccount backlink.')
requireText(importRoute, 'await db.$transaction', 'Governed discovery import must keep account/profile/offering/backlink writes transactional.')

requireText(postgres, 'reject_provider_profile_on_couple', 'PostgreSQL contract must test provider/account population rejection.')
requireText(postgres, 'reject_parent_type_change', 'PostgreSQL contract must test parent BusinessAccount type protection.')
requireText(postgres, 'reject_candidate_source_mismatch', 'PostgreSQL contract must test bidirectional discovery provenance.')
requireText(postgres, 'reject_claim_profile_account_mismatch', 'PostgreSQL contract must test claim/profile BusinessAccount consistency.')
requireText(postgres, 'reject_duplicate_open_claim', 'PostgreSQL contract must test duplicate open-claim prevention.')

console.log('Database integrity vendor/Admin source contract: PASS')
