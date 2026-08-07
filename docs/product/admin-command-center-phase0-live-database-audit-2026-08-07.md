# Admin Command Centre Phase 0 — Live Database Audit

**Date:** 2026-08-07  
**Plan:** `docs/product/admin-command-center-taxonomy-responsive-plan-2026-08-07.md`  
**Plan phase:** Phase 0 — plan and live database audit

## Purpose

Record the live production database state before any taxonomy, workforce, queue, saved-view, or responsive Admin implementation is applied. This document is evidence for the non-regression gate defined in the plan.

## Proposed-table collision check

The following planned tables do not currently exist in either `wewed_admin` or `public`:

- `AccountSubtypeDefinition`
- `BusinessAccountClassification`
- `InternalDepartmentDefinition`
- `InternalStaffProfile`
- `AdminWorkItem`
- `AdminSavedView`

There is therefore no naming collision with live production structures.

## Business account distribution

Live `wewed_admin."BusinessAccount"` distribution at audit time:

| Account type | Lifecycle | Count |
| --- | --- | ---: |
| couple | active | 6 |
| couple | archived | 1 |
| planning_company | active | 2 |
| vendor | active | 102 |
| vendor | pending_review | 14 |
| venue | active | 20 |
| wewed_internal | active | 1 |

Total accounts: **146**.

This confirms that vendors are now the dominant operational population and validates the plan's requirement for account subtype and compact filtered registry views.

## Platform administrator boundary

Live `PlatformAdministrator` records:

| Role | Status | Count |
| --- | --- | ---: |
| `wewed_super_admin` | active | 1 |
| `wewed_operations_admin` | active | 1 |
| `wewed_operations_admin` | revoked | 1 |

The Wewed internal business account currently has three membership records across active/revoked Super Admin and Operations Admin states. This reinforces the plan requirement that workforce membership and platform administrator authority remain separate concepts.

## Client-department and billing integrity

Account-type mirror validation is currently clean:

- department/account-type mismatches: **0**;
- billing-profile/account-type mismatches: **0**.

However, a material provisioning gap exists for accounts created after the segmented-billing migration:

- external accounts without department assignments: **132**;
- external accounts without billing profiles: **132**.

Breakdown of missing defaults:

| Account type | Source | Accounts missing departments | Accounts missing billing profile |
| --- | --- | ---: | ---: |
| vendor | provider_discovery_candidate | 78 | 78 |
| vendor | marketplace_discovery | 33 | 33 |
| vendor | public_discovery | 4 | 4 |
| vendor | provider_discovery | 1 | 1 |
| venue | provider_discovery | 8 | 8 |
| venue | marketplace_discovery | 6 | 6 |
| venue | provider_discovery_candidate | 2 | 2 |

Existing couple, planning-company, and legacy venue accounts are fully provisioned.

### Remediation decision

Per the plan's data-loop integrity requirement, this release must not patch each account-creation route independently. Instead, the database will receive one central, additive provisioning function/trigger on `wewed_admin."BusinessAccount"` that:

1. validates/classifies the account type;
2. creates a `BusinessAccountClassification` row if missing;
3. assigns current default departments for supported external account types;
4. creates the correct account-type billing profile if missing;
5. never overwrites an existing department assignment or billing profile.

A one-time `INSERT ... ON CONFLICT DO NOTHING` backfill will call the same default rules for the 132 missing accounts. Existing good rows will remain byte-for-byte unchanged.

## Private-schema access boundary

All existing `wewed_admin` base tables checked during this audit report:

- no direct `anon` SELECT privilege;
- no direct `authenticated` SELECT privilege;
- no direct `anon` INSERT/UPDATE/DELETE privilege;
- no direct `authenticated` INSERT/UPDATE/DELETE privilege.

The six new tables must preserve this exact server-only posture.

## Current operational queue sources

At audit time there are no live rows in:

- `ProviderClaimRequest`;
- `SupportCase`;
- `ProviderVerification`.

The Command Centre must therefore support zero-state rendering and must not assume these sources contain data. Account lifecycle/onboarding/risk projections provide the initial non-empty operational signals.

## Migration safety rules derived from the audit

1. No existing `BusinessAccount.type`, status, owner, subscription, payment, provider, planner, wedding, membership, support, or audit row will be updated by the schema migration.
2. Backfill writes are limited to **new rows** in new classification tables and currently missing rows in the existing department/billing tables.
3. Existing department assignments and billing profiles are protected by unique keys plus `ON CONFLICT DO NOTHING`.
4. Default provisioning must be centralized at the database boundary so newly discovered marketplace vendors and venues cannot fall outside the department/billing data loop again.
5. New private tables receive explicit revocation of `PUBLIC`, `anon`, and `authenticated` direct access.
6. Pre/post fingerprints over all pre-existing protected tables must match except for the two explicitly approved repair targets: `BusinessAccountDepartment` and `BusinessAccountBillingProfile`, where only previously missing rows may increase.
7. The remediation is considered successful only if the post-migration missing-default counts become zero while account-type mismatch counts remain zero.

## Phase 0 conclusion

The planned taxonomy and responsive/Admin productivity work is compatible with the live schema and does not require rewriting canonical customer data. The database audit did uncover a real provisioning gap created by newer marketplace account creation paths. Phase 1 will therefore include both the new additive taxonomy/productivity schema and a central future-proof default provisioning mechanism, exactly as permitted by the main plan's data-loop integrity and additive-migration requirements.