# Wedding Day production migration review — NO GO

Migration safe as-is: **NO**. No migration or signing-key change has been executed.
The original feature migration is preserved as a review proposal under `migration-review/`,
not an active Prisma migration. Moving it into deployment migrations requires explicit approval.

Source audit against main ba4b08f8: Wedding, Guest and SeatingTable relationships exist;
Vendor and ServiceEngagement have the composite id/weddingId uniqueness required by the proposal.
The five new tables are absent from main's Prisma model. Existing issuer uses parameterized raw SQL.
The original migration lacks RLS/client privilege restrictions. Proposed SQL adds RLS and revokes
anon/authenticated access; guest APIs use server-side authorization and never expose a roster.

Actual production catalog comparison: NOT VERIFIED. The connected Supabase account exposes only
an unrelated project; no query was sent to it. Production identity and schema access must be
established read-only before approval. Verify table collisions, existing constraints, default
privileges, migration history, application database role and backups. Do not infer production
schema from repository schema.

Required review changes: composite wedding consistency for Guest/credential/key/check-in foreign
keys, check-in revocation behavior, migration transaction/lock budget, operator and manifest
endpoint promotion, key rotation runbook, production RLS/privilege verification. The proposal's
new deny-client policy requires a tested server database role; it is not an authorization bypass.

Activation is independently controlled by WEDDING_DAY_GUEST_API_ENABLED=true; default is off.
Signing requirements: existing WEDDING_DAY_WW2_PRIVATE_KEY_PEM and WEDDING_DAY_WW2_KEY_ID,
WEDDING_DAY_ROOT_PRIVATE_KEY_PEM and WEDDING_DAY_ROOT_KEY_ID, separately managed P-256 keys,
server-only secret storage, explicit production identifiers, approved rotation/revocation plan.
Never publish keys or reuse synthetic/isolated keys. Native receives only public verification data.
WW2 remains ECDSA P-256/SHA-256 with IEEE-P1363 signatures. No new credential format.

Rollback: disable guest endpoints first; revert application deployment without downgrading issued
v2 sessions to token-bearing v1. Preserve any issued credential/check-in audit rows. Take an approved
backup before migration; do not automatically drop domain tables or erase admissions history.
If no rows were ever issued and a reviewed rollback is approved, reverse FKs/tables in dependency
order. Restoring database/key state is an explicit operation, not a CI convenience.

Distance to Shadreck UAT: production schema and migration review, signing/key approval, operator
verification readiness, deployment and signed device distribution remain mandatory gates.
