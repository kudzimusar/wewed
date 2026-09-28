# QRO07 Production Prisma Ledger Repair Plan

**Status:** STAGED — LOCAL DRY-RUN REQUIRED BEFORE ANY PRODUCTION LEDGER WRITE  
**Date:** 2026-09-29  
**Release line:** `release/qro07-guest-pwa-play-ship-20260928`  
**Evidence baseline:** production logical dump captured immediately before the QRO07 migration gate.

## Objective

Repair production's historical Prisma migration ledger so normal `prisma migrate deploy`
can resume without replaying migrations whose effects already exist, while preserving:

- current production business data;
- the printed Charity & Kudzie invitation authority `JXVAA-X6DRL`;
- established production integrity protections;
- the two main-branch guard migrations that are genuinely absent and therefore must execute;
- QRO07's additive release migrations.

No production ledger command is authorised by this document alone.

## Proven state

- Production is Prisma-datamodel equivalent to current main before QRO07.
- Historical raw-schema drift consists of:
  - two main guard functions/triggers missing from production;
  - production-only WeddingMembership CHECK constraints;
  - three production-only normalized provider-identity unique indexes;
  - the established GuestContribution-before-Guest-delete compatibility trigger;
  - semantically equivalent textual/order differences that do not change behavior.
- Historical migration effects are materially present except for explicitly documented
  legacy data gaps. Those gaps are not required to ship the Guest release and are not to
  be silently repaired as part of ledger normalization.

## Migrations that MUST ACTUALLY RUN

Do not mark these applied before deployment:

- `20260825024000_notification_state_race_guard`
- `20260825030000_provider_listing_visibility_guard`

The provider-visibility repair predicate was proven to match zero production rows at the
captured baseline, so this migration is expected to install the guard without rewriting
provider business rows.

## Historical migrations that must never be replayed

These migrations are candidates for ledger-baseline-only treatment because replaying them
would be incorrect or harmful to the current production state:

### `20260909092500_seed_charity_kudzie_physical_invitation`

The canonical printed artifact is already:

- code: `JXVAA-X6DRL`
- raw route code: `JXVAAX6DRL`
- destination: `print_JXVAAX6DRL`

The historical seed targets a superseded `CHRTYKDZ23` artifact and must never be
executed against production.

### `20260807195000_ai_wedding_architect_provider_commercial`

Its one-time initialization is superseded by later production state; replay would regress
thousands of provider offerings. Treat as historical effect already superseded.

### `20260812030000_canonical_wedding_social_template`

Do not replay the old stock/demo Charity & Kudzie wedding-content seed. Missing template
rows are intentional under the current no-fabricated-guest-content policy.

### `20260812050000_scope_wedding_social_channels`

Do not replay the old Charity & Kudzie Telegram/template content. Missing rows are
intentional.

## Historical data gaps accepted for this Guest shipping unit

These are recorded as follow-up data-quality work, not blockers for QRO07 Guest shipping.

### `20260730173000_wewed_business_admin_console`

The schema end-state is present, but deterministic historical backfill rows are incomplete.
Do not replay the migration: its original public-schema assumptions no longer match the
moved `wewed_admin` schema.

For this release:

- baseline the historical migration only after the local repair simulation proves the
  exact Prisma command sequence;
- do not insert UAT/test/quarantined accounts as a side effect of Guest shipping;
- open a later targeted BusinessAccount remediation using current production eligibility
  rules rather than blindly replaying the 2026-07 seed.

### `20260809100000_communication_channel_readiness`

Historical DELIVERED rows with a null `deliveredAt` remain historical metadata debt.
Current delivery processing records delivery timestamps for new provider events. Do not
rewrite old communications merely to normalize the Prisma ledger.

### `20260819190000_contributions_legacy_funding_backfill`

Two Charity & Kudzie EngagementPayment facts post-date the old backfill and do not have
durable `LEGACY_UNATTRIBUTED` allocation rows. Current funding APIs still calculate
unattributed payment value from the payment amount minus classified allocations.

Do not mutate C&K finance/funding rows in this Guest shipping unit. A dedicated Planner
financial-integrity follow-up must decide whether to create those historical allocation
records.

## Production-only integrity objects now captured in repository history

Migration:

`20260929013000_production_schema_reconciliation_v2`

It converges clean databases toward the established production protections:

- `WeddingMembership_role_check`;
- `WeddingMembership_status_check`;
- `BusinessAccount_vendor_normalized_name_unique`;
- `ProviderDiscoveryCandidate_active_normalized_identity_unique`;
- `ProviderProfile_normalized_identity_unique`;
- `wewed_delete_guest_contribution_before_guest()` and its Guest trigger.

It does not seed Charity & Kudzie data, replace the printed QR, rewrite payment history,
or drop live objects.

The GuestContribution delete behavior is preserved as compatibility for this release. The
future Living Wedding Site retention policy may explicitly supersede it.

## Required local simulation before production

Create a disposable clone from the verified production dump and simulate the exact
production repair.

The simulation must:

1. generate an explicit baseline manifest from the repository migration list and the
   restored production ledger;
2. exclude the two guard migrations above;
3. exclude QRO07 migrations that genuinely need to run;
4. handle the unresolved `20260730173000_wewed_business_admin_console` row using the
   exact Prisma-supported failed-migration resolution sequence;
5. mark only the approved historical baseline set applied;
6. run `prisma migrate deploy` from the exact release candidate;
7. prove that only the two historical guards plus QRO07/reconciliation migrations execute;
8. prove pre-existing business-row digests remain unchanged;
9. prove `JXVAA-X6DRL` remains active and unchanged;
10. prove the resulting ledger has no unresolved rows and `prisma migrate status` is clean;
11. prove raw PostgreSQL schema convergence after ignoring only already-accepted semantic
    formatting/order differences.

If the local simulation attempts to replay the physical invitation seed, AI provider
initialization, old social template, or any other historical baseline migration, the plan
is invalid and production execution must not proceed.

## Production execution boundary

After a successful local simulation, production execution still requires a separate
explicit go-ahead.

The production run must use the verified pre-migration backup and a committed/printed
baseline manifest. No hand-typed ad-hoc list is permitted.

Expected high-level sequence:

1. live read-only recheck of ledger/object invariants;
2. temporarily allow the release branch in the protected production environment;
3. run the dedicated baseline operation using the exact reviewed manifest;
4. run normal `prisma migrate deploy`;
5. remove temporary branch allowance;
6. verify schema, ledger, C&K immutable QR and zero unintended business-row changes;
7. only then continue with `WEWED_SESSION_SECRET`, PR #222 merge and production AT01.

## Safety invariants

Until the production execution step is explicitly authorised:

- production migration ledger writes: **0**
- production schema writes: **0**
- C&K RSVP writes: **0**
- C&K contribution/funding writes: **0**
- C&K check-in writes: **0**
- C&K token rotations: **0**
- C&K Guest edits: **0**
- C&K Pass issuance: **0**
- C&K wedding-content writes: **0**

Preserve the verified backup until production closure is complete.
