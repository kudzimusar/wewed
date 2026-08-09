# Database Integrity Live Audit — 2026-08-09

**Authoritative plan:** `docs/product/database-integrity-vendor-admin-hardening-plan-2026-08-09.md`  
**Branch:** `feat/database-integrity-vendor-admin-hardening-20260809`  
**Purpose:** Fresh production evidence for the vendor-growth + Admin-expansion hardening plan. This report does not replace the plan; it classifies current findings using the plan's Valid state / Historical compatibility / Repairable relational drift / Ambiguous data model.

## 1. Current scale is moving during the audit

Marketplace population is still active, so raw provider totals are a moving snapshot rather than a release invariant. During this audit the live database grew from 3,109 to 3,196 vendor BusinessAccounts.

Latest sampled snapshot:

- BusinessAccounts: 3,246
- vendor BusinessAccounts: 3,196
- venue BusinessAccounts: 40
- ProviderProfiles: 3,232
- ProviderServiceOfferings: 3,785
- ProviderDiscoveryCandidates: 2,142
- imported ProviderDiscoveryCandidates: 2,141
- published + unclaimed + claimable ProviderProfiles: 3,232

Release gates must therefore assert relationships and mismatch counts, not freeze total provider counts.

## 2. Admin provisioning loop — clean

The database-level BusinessAccount provisioning guard introduced with the Admin Command Centre remains effective under the expanded marketplace population:

- missing BusinessAccountClassification: 0
- supported external accounts missing billing profile: 0
- supported external accounts missing enabled departments: 0
- classification/account-type mismatches: 0
- billing/account-type mismatches: 0
- department/account-type mismatches: 0
- ProviderProfile orphans: 0
- ProviderServiceOffering orphans: 0
- BusinessAccountMember orphans: 0
- duplicate BusinessAccount slugs: 0
- duplicate ProviderProfile slugs: 0

Classification, departments and segmented billing are therefore still connected automatically after rapid provider growth.

## 3. Ownership semantics — valid state

Unclaimed imported provider accounts intentionally do not have owners or BusinessAccountMember rows. The initial broad audit incorrectly treated this as suspicious; the role-aware follow-up confirmed the model is coherent.

For actual owned accounts:

- BusinessAccount.ownerUserId without a matching active owner-like membership: 0
- active owner-like membership conflicting with BusinessAccount.ownerUserId: 0
- accounts with multiple active owner-like memberships: 0

Current couple/planner ownership uses role values such as `couple_owner` and `business_owner`; integrity checks must use the product's role vocabulary rather than a literal `owner` role.

Provider claim state is also coherent:

- claim/profile/business-account state mismatches: 0
- current ProviderClaimRequest rows: 0

**Classification:** Valid state.

## 4. Discovery provenance — deterministic repair required

Current candidate-backed provenance audit:

- candidate-backed BusinessAccounts sampled: 2,132
- candidate-backed inconsistent rows before repair: 132
- imported candidates missing importedBusinessAccountId: 129
- imported candidates with invalid non-null BusinessAccount backlinks: 0
- duplicate non-null importedBusinessAccountId groups: 0

The planned migration's repair preview proves the following deterministic repair set:

- BusinessAccounts with `sourceType='provider_discovery_candidate'` and a unique imported candidate backlink but missing sourceId: 4
- imported candidates repairable directly from a unique BusinessAccount.sourceId: 128
- imported candidates repairable by the strict historical name + website + phone match: 5
- overlap between those candidate repair sets: 4
- total distinct imported candidates repaired: 129

No ambiguous one-to-many candidate/account mapping is required for this repair.

**Classification:** Repairable relational drift.

## 5. Historical venue-name accounts — preserve

Four venue BusinessAccounts do not have ProviderProfile rows:

- Beachside Pavilion
- Garden Pavilion
- Imba Manor
- Victoria Falls Hotel

All four use `sourceType='venue_name'`, `onboardingStatus='complete'`, and predate/represent the wedding venue-name relationship path rather than a marketplace provider import.

They must not be auto-converted into marketplace ProviderProfiles merely to make provider-account counts match.

**Classification:** Historical compatibility.

## 6. Shared websites — valid multi-property brands

Six normalized website domains are shared by more than one ProviderProfile. Manual inspection shows they represent distinct properties under shared hospitality/safari brand sites, including African Bush Camps, African Sun Hotels, Imvelo Safari Lodges, Regency Hotels, RTG Africa and Singita.

Therefore website alone is not a safe global uniqueness key. The existing normalized business identity and slug constraints remain the stronger canonical protections.

**Classification:** Valid state.

## 7. Wedding / planner / Guest graph — clean

The integrity audit was expanded beyond marketplace/Admin tables because this hardening must not destabilize the existing planner workspace.

Live snapshot:

- Weddings: 8
- Guests: 111
- PlannerTasks: 341
- WeddingMemberships: 14
- PlannerEngagements: 0

Relational checks:

- Guest -> missing Wedding: 0
- GuestContribution -> missing Guest/Wedding or cross-wedding mismatch: 0
- PlannerTask -> missing Wedding: 0
- WeddingMembership -> missing User/Wedding: 0
- PlannerEngagement -> missing Wedding: 0
- PlannerEnquiry -> missing Wedding: 0
- duplicate non-empty guest email within the same wedding groups: 0

This does not by itself prove every UI save path is healthy, but it proves the persisted wedding/guest/planner graph currently contains no relational orphan or cross-wedding corruption.

**Classification:** Valid state.

## 8. Constraint/index audit notes

Existing protections already include:

- unique ProviderProfile.businessAccountId
- unique ProviderProfile slug
- normalized provider identity uniqueness
- unique BusinessAccount slug
- normalized vendor BusinessAccount identity uniqueness
- unique BusinessAccount `(sourceType, sourceId)` when both are non-null
- unique BusinessAccountMember `(businessAccountId, userId)`
- canonical open provider-claim uniqueness index by `(providerProfileId, lower(claimantEmail))` for open statuses

The hardening migration must not duplicate these structures. A follow-up migration removes the temporary redundant claim index and asserts that the existing canonical index remains present.

## 9. Approved implementation scope from the plan

Proceed with the plan's additive hardening only:

1. repair the 4 deterministic missing BusinessAccount sourceIds;
2. repair the 129 deterministic discovery candidate backlinks;
3. enforce one non-null imported candidate backlink per BusinessAccount;
4. enforce ProviderProfile / ProviderServiceOffering / ProviderVerification / ProviderClaimRequest account-type and account-link consistency;
5. prevent provider-backed BusinessAccounts from being changed to incompatible populations;
6. enforce bidirectional candidate-backed provenance at transaction end;
7. validate the full authority graph when a provider claim becomes approved;
8. keep trigger helper functions private from PUBLIC/anon/authenticated;
9. preserve unclaimed marketplace ownership semantics;
10. do not manufacture ProviderProfiles for the four historical venue-name accounts;
11. do not add a global website uniqueness constraint.

## 10. Production migration gate

Before applying the migration to production:

- branch must be current with `main`;
- dedicated Database Integrity CI must pass clean PostgreSQL migration deploy, migration status, zero Prisma drift, PostgreSQL relational contract, lint and production build;
- full repository cross-product PR matrix must pass;
- protected production rows must be fingerprinted immediately before migration;
- the repair preview must still equal the deterministic rows present at migration time, because provider ingestion is active.

After migration:

- missing imported-candidate backlinks must be 0 for all deterministically candidate-backed rows;
- no Admin provisioning mismatch may increase from 0;
- no provider/profile/offering orphan may appear;
- no wedding/guest/planner orphan may appear;
- all new triggers must be enabled;
- helper functions must remain non-executable by PUBLIC/anon/authenticated;
- only explicitly approved provenance rows may change.