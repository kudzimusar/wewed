# Database Integrity Hardening Plan — Vendor Growth + Admin Expansion

**Date:** 2026-08-09  
**Branch:** `feat/database-integrity-vendor-admin-hardening-20260809`  
**Base:** `main` at `1eb084bae24800c86b3f6d7cd671657559c995ec`  
**Status:** Authoritative implementation and release plan. Database/application changes must map back to this document.

## 1. Objective

Tighten the Wewed production database after rapid marketplace population growth and the Admin Command Centre expansion so canonical records remain connected automatically rather than depending on every importer or Admin route to remember every downstream write.

The target is one coherent data loop:

`Discovery / registration / Admin action -> BusinessAccount -> classification -> departments -> billing -> provider/planner profile -> offerings -> ownership/membership -> claims/verification -> Admin projections`

The hardening must preserve all valid customer, wedding, planner, provider, guest, billing, membership, marketplace and audit data. Existing good rows must not be rewritten merely to make counts look cleaner.

This plan extends, and does not replace, `docs/product/admin-command-center-taxonomy-responsive-plan-2026-08-07.md`. Its core rules remain authoritative:

- `BusinessAccount.type` is the canonical account population key;
- subtype/classification does not grant permissions;
- workforce metadata does not grant PlatformAdministrator authority;
- client departments and billing are account-type specific;
- new Admin structures remain server-side/private;
- changes must be additive and non-regressive.

## 2. Preliminary live findings

The first production snapshot after the latest vendor growth shows:

- 2,859 BusinessAccounts;
- 2,809 vendor accounts;
- 40 venue accounts;
- 2,845 ProviderProfiles;
- 3,398 ProviderServiceOfferings;
- approximately 2,806 BusinessAccounts created within the previous 48 hours.

The Admin provisioning guard is working despite this growth:

- accounts missing classification: 0;
- supported accounts missing billing profile: 0;
- supported accounts missing enabled departments: 0;
- classification/account type mismatches: 0;
- billing/account type mismatches: 0;
- department/account type mismatches: 0;
- ProviderProfiles orphaned from BusinessAccount: 0;
- ProviderServiceOfferings orphaned from BusinessAccount: 0;
- duplicate BusinessAccount slugs: 0;
- duplicate ProviderProfile slugs: 0.

The marketplace population is intentionally mostly unclaimed:

- all 2,845 ProviderProfiles are currently `published` + `unclaimed` + claimable;
- the lack of BusinessAccountMember/owner rows on those imported businesses is therefore not itself a regression and must not be “fixed” by creating fake users or owners.

The first real consistency concern is provenance/backlink drift across multiple historical population paths:

- newer governed imports use `BusinessAccount.sourceType='marketplace_discovery'` with `sourceId=ProviderDiscoveryCandidate.id` and update `ProviderDiscoveryCandidate.importedBusinessAccountId` in the same transaction;
- older/direct population waves use several sourceType/sourceId conventions;
- some BusinessAccounts reference a discovery candidate whose `importedBusinessAccountId` does not point back to that account;
- some source types carry identifiers that are not candidate IDs at all.

The audit must distinguish legitimate source-type semantics from broken bidirectional discovery links before any repair.

## 3. Canonical database relationships

### 3.1 Business account backbone

Every provider-facing marketplace record must resolve to exactly one canonical BusinessAccount.

- ProviderProfile.businessAccountId -> BusinessAccount.id
- ProviderServiceOffering.businessAccountId -> BusinessAccount.id
- ProviderVerification.businessAccountId -> BusinessAccount.id
- ProviderClaimRequest.businessAccountId -> BusinessAccount.id
- BusinessAccountClassification.businessAccountId -> BusinessAccount.id
- BusinessAccountDepartment.businessAccountId -> BusinessAccount.id
- BusinessAccountBillingProfile.businessAccountId -> BusinessAccount.id
- BusinessAccountMember.businessAccountId -> BusinessAccount.id

### 3.2 Provider profile cardinality

For marketplace providers, a BusinessAccount may have at most one ProviderProfile. ProviderProfile.businessAccountId must remain unique.

A ProviderProfile account type must be one of the provider populations intentionally supported by the marketplace model. Existing venue-backed ProviderProfiles are valid and must remain valid.

### 3.3 Offerings

ProviderServiceOffering belongs to the canonical BusinessAccount, not to a copied provider payload.

Offerings may belong to vendor or venue BusinessAccounts where current product behavior supports venue offerings. Integrity checks must therefore not assume `vendor` only.

At least one published offering is expected for every published discovery-built ProviderProfile unless an explicitly supported profile-only state exists.

### 3.4 Discovery provenance

Discovery provenance has two levels:

1. **Human/audit provenance:** ProviderProfile.dataProvenance / ProviderDiscoverySource.
2. **Relational provenance:** ProviderDiscoveryCandidate.importedBusinessAccountId and, for source types whose sourceId is defined as a candidate ID, BusinessAccount.sourceId.

The database must not invent a candidate relationship for source types whose sourceId has another meaning.

For source types defined as candidate-backed, the relationship must be bidirectionally consistent:

`BusinessAccount.sourceId = ProviderDiscoveryCandidate.id`

and

`ProviderDiscoveryCandidate.importedBusinessAccountId = BusinessAccount.id`.

### 3.5 Claim/ownership transition

Unclaimed marketplace accounts intentionally have no owner/membership. When a claim is approved:

- the ProviderProfile becomes non-claimable/claimed according to the product contract;
- exactly one authoritative active owner relationship must be created;
- claim review must not produce dual owners through concurrency;
- claimed authority must reference the same BusinessAccount as the ProviderProfile and claim request.

### 3.6 Admin foundation

Every supported external BusinessAccount must continue to have:

- exactly one BusinessAccountClassification;
- its expected account-type department set;
- exactly one BusinessAccountBillingProfile.

The database-level provisioning trigger is the primary boundary. Application importers are supplementary, not authoritative.

## 4. Audit phases

### Phase A — schema/constraint audit

Inspect all relevant tables for:

- foreign keys and whether they are validated;
- uniqueness constraints/indexes;
- nullable relationship columns;
- missing indexes on foreign-key columns;
- triggers and trigger enablement;
- SECURITY DEFINER/search_path configuration;
- direct grants to PUBLIC/anon/authenticated;
- RLS posture where relevant;
- duplicate or overlapping constraints.

No changes in this phase.

### Phase B — live relational integrity audit

Measure at minimum:

- BusinessAccount -> classification/departments/billing completeness;
- ProviderProfile -> BusinessAccount cardinality/type;
- ProviderServiceOffering -> BusinessAccount cardinality/type;
- ProviderVerification -> BusinessAccount;
- ProviderClaimRequest -> ProviderProfile/BusinessAccount/user consistency;
- BusinessAccountMember -> BusinessAccount/User consistency;
- ownerUserId -> membership consistency for real owned accounts;
- DiscoveryCandidate -> imported BusinessAccount backlinks;
- candidate-backed BusinessAccount -> source candidate links;
- ProviderDiscoverySource -> candidate links;
- discovery job -> candidate links;
- public profile listing/claimability/ownership state combinations;
- duplicates by slug and other strong canonical keys where a constraint exists or is safe to introduce.

### Phase C — classify findings

Every finding must be put into one of four buckets:

1. **Valid state** — e.g. unclaimed discovery account with no member.
2. **Historical compatibility** — older sourceType semantics that should be preserved and documented.
3. **Repairable relational drift** — a relationship that can be reconstructed unambiguously from canonical IDs/provenance.
4. **Ambiguous data** — do not auto-repair; surface for Admin review.

## 5. Hardening strategy

### 5.1 Prefer constraints over cleanup scripts

Where the current model already implies an invariant, add/validate the database constraint so future imports cannot reintroduce the defect.

Possible hardening candidates, only if the live audit proves they are compatible:

- unique ProviderProfile.businessAccountId;
- candidate backlink validation for candidate-backed source types;
- claim/profile/business-account consistency trigger;
- provider/venue account-type validation on ProviderProfile and ProviderServiceOffering;
- one active owner authority invariant where the current claim model supports it;
- validated foreign keys for new/legacy Admin/provider relations;
- supporting indexes for the validated foreign keys.

### 5.2 Do not create fake ownership

Unclaimed marketplace providers must stay unclaimed. No repair may create User, BusinessAccountMember, ownerUserId or PlatformAdministrator data merely to satisfy an ownership-count check.

### 5.3 Repair only deterministic rows

Backfills may update only rows whose correct target is provable from existing canonical relationships.

Examples:

- candidate importedBusinessAccountId is null/wrong but exactly one BusinessAccount points to that candidate and exactly one ProviderProfile belongs to that BusinessAccount;
- a supported BusinessAccount is missing a classification/department/billing row and the canonical default can be computed by the already-approved provisioning function.

Ambiguous one-to-many candidate/account mappings must be reported, not guessed.

### 5.4 Preserve migration immutability

Already-applied production migrations must never be edited. All hardening uses new additive migrations.

## 6. Non-regression gate

Before any live migration:

1. fingerprint protected tables excluding only explicitly approved repair targets;
2. record row counts and deterministic digests for target tables;
3. run the complete migration chain on clean PostgreSQL;
4. require zero Prisma drift;
5. run dedicated PostgreSQL integrity tests;
6. run Admin, Provider Security, Provider Forms, Planner Marketplace, Budget, Preview Data Safety and core CI gates;
7. require a READY Vercel preview of the exact application head if application code changes.

After live migration:

- protected fingerprints must remain unchanged except for unrelated concurrent production activity that is independently isolated;
- every approved repair count must match the precomputed expected count;
- no orphan/mismatch count may increase;
- all new constraints/triggers must be validated/enabled;
- no new direct anon/authenticated CRUD or function execution may be introduced.

## 7. Application changes

Application code changes should be minimal and only close proven gaps found in Phase B.

Likely candidates:

- centralize discovery source semantics rather than allowing arbitrary sourceType/sourceId conventions;
- make all provider population methods call the same canonical import transaction/helper;
- ensure Admin diagnostics report relational-integrity exceptions rather than silently accepting them;
- expose ambiguous discovery-link records as Admin review work instead of automatically mutating them.

No UI expansion is required merely to complete the database hardening unless an ambiguous data class needs human review.

## 8. Definition of done

This hardening is complete only when:

- current vendor/venue/provider growth can occur without missing Admin classification, departments or billing;
- ProviderProfile and offerings remain connected to valid canonical BusinessAccounts;
- all candidate-backed discovery imports are bidirectionally consistent;
- historical source conventions are documented and do not masquerade as broken candidate links;
- unclaimed marketplace records remain safely unowned until a legitimate claim is approved;
- claim approval cannot create inconsistent BusinessAccount/Profile/member authority;
- no valid existing rows are lost or overwritten;
- dedicated integrity SQL and CI make the above invariants executable for future releases;
- the implementation report records pre/post production evidence against this plan.
