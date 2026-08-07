# Admin Command Centre — Phase 7 Review Closure

Date: 2026-08-07

Authoritative plan: `docs/product/admin-command-center-taxonomy-responsive-plan-2026-08-07.md`

## Purpose

This document records the final Phase 7 review work required before PR #84 may be considered merge-ready. It supplements the implementation report and does not replace the original plan.

The merge rule remains unchanged: the branch must be current with `main`, all repository release workflows must pass on the exact merge candidate, Vercel must be healthy, database migrations must remain reproducible and non-destructive, and valid review findings must be addressed before merge.

## Review finding 1 — refresh both vendors when an offering moves

### Finding

The initial `refresh_system_vendor_classification()` trigger recalculated only `NEW."businessAccountId"` for a non-delete operation. If a `ProviderServiceOffering` moved from one vendor account to another, the destination classification refreshed but the source account could retain a stale system-derived subtype.

Example: a source vendor with photography + catering could remain `multi_service` after catering moved to another account.

### Resolution

The already-applied migration `20260807150000_admin_command_center_taxonomy` is intentionally immutable.

A new additive follow-up migration was created:

`prisma/migrations/20260807151500_fix_vendor_classification_move_refresh/migration.sql`

The replacement trigger function now resolves the affected account set as follows:

- `DELETE`: refresh the old account.
- `UPDATE` where `businessAccountId` changes: refresh both old and new accounts.
- Other inserts/updates: refresh the new account.

The refresh still applies only to vendor classifications whose `source='system'`. Manual classifications remain authoritative and are never overwritten by service-offering changes.

### Executable regression

`scripts/admin-command-center-postgres-integration.sql` now creates source and destination vendor accounts, proves the source becomes `multi_service`, moves one offering, and then proves:

- source recalculates to `photography`;
- destination recalculates to `catering`;
- existing manual-classification stability coverage continues to pass.

## Review finding 2 — duplicate saved-view names

### Finding

`AdminSavedView` has a case-insensitive uniqueness rule for administrator + screen + name, while the command-centre API previously handled only `ON CONFLICT (id)`. Saving another view with the same name on the same screen could therefore surface as a generic HTTP 500.

### Resolution

Before saving a view, the API now checks for an existing case-insensitive name owned by the same administrator on the same screen, excluding the requested record when updating an existing view.

A duplicate returns controlled `409 Conflict` with:

`A saved view with this name already exists on this screen.`

The uniqueness index remains the database integrity backstop; no constraint was weakened or removed.

## Review finding 3 — responsive labels on the nested operations table

### Finding

The responsive card transform applied one set of pseudo-labels to both Admin account tables. The nested operations table has nine columns, so its Activity, Signals, and Inspect values could be displayed under the governed registry's Risk / Action labels.

### Resolution

`src/app/admin/admin-responsive.css` now distinguishes the two table schemas while retaining the common responsive transformation:

- eight-column governed registry: Account, Lifecycle, Owner, Team, Weddings, Onboarding, Risk, Action;
- nine-column operations registry: Account, Lifecycle, Owner, Team, Weddings, Onboarding, Activity, Signals, Inspect.

The browser release gate remains responsible for verifying the card transformation at phone, tablet, Windows-laptop, and desktop widths.

## Repository-wide browser blocker — Timeline chronology lookup race

### Finding

After the three Admin findings were fixed, repository-wide CI correctly remained red because `--fail-on-flaky-tests` detected one retry in the existing Timeline chronology test. The chronology helper first asserted that an item existed and was visible, then performed a second DOM snapshot to calculate its index. A Timeline React refresh between those separate operations could make the second snapshot return `-1` even though the item had just been observed.

The retry passing did not satisfy the plan because Phase 7 explicitly treats flaky browser behavior as a release blocker.

### Resolution

`tests/e2e/planner-timeline-chronology.spec.ts` now polls a single browser-side snapshot of all timeline cards and resolves the expected event's index atomically. The original chronology assertions remain unchanged:

- reverse-created items must render in clock-time order;
- changing the middle item to `05:55` must move it before the earlier event;
- same-time manual move controls remain disabled;
- impossible clock values remain rejected by the API.

This change stabilizes observation of the existing behavior; it does not relax, skip, retry around, or alter the product chronology contract.

## Phase 7 executable contract

`scripts/admin-command-center-contract.ts` now requires all three review closures:

- the follow-up trigger migration must contain the old/new account refresh branch;
- PostgreSQL integration must cover a cross-account offering move;
- the command-centre API must contain the case-insensitive duplicate-view conflict path and controlled conflict message;
- responsive CSS must contain distinct 8-column and 9-column label rules including Activity, Signals, and Inspect;
- Account 360 browser navigation remains scoped to the Command Centre before opening an account card.

A future change that removes these protections must therefore fail the dedicated Admin Command Centre release gate.

## Database promotion rule

The follow-up trigger migration must not be applied to the live Supabase project until the exact final branch head passes the complete clean PostgreSQL migration chain and the updated PostgreSQL integration test.

Before applying the follow-up migration, production must be checked for any existing stale `source='system'` vendor classifications by comparing stored subtype against `wewed_admin.default_business_account_subtype(...)`.

- If the stale count is zero, only the function replacement is required.
- If stale system-derived rows already exist, reconciliation must be added as a targeted migration and requalified in CI before production application.
- Manual classifications must never be reconciled automatically.

After production application, verify the trigger function definition, trigger enabled state, and zero stale system-derived vendor classifications without creating disposable production provider records.

## Final production verification

After the exact candidate passed all nine repository workflows, the live pre-migration stale-system-classification count was confirmed as `0` and the function-only migration was applied to the Wewed Supabase project as `fix_vendor_classification_move_refresh`.

Post-migration verification confirmed:

- the registered live migration is `fix_vendor_classification_move_refresh`;
- `wewed_admin.refresh_system_vendor_classification()` contains the `OLD."businessAccountId" IS DISTINCT FROM NEW."businessAccountId"` branch and refreshes both affected accounts;
- trigger `refresh_system_vendor_classification_after_offering` remains enabled (`tgenabled='O'`) on `wewed_admin."ProviderServiceOffering"` for INSERT, DELETE, and updates of category / `businessAccountId`;
- stale system-derived vendor classifications remain `0`;
- no disposable production provider/offering records were created for verification.

The first trigger-state verification query used a longer assumed trigger name and returned no row. Inspection of the original migration confirmed the actual trigger name is `refresh_system_vendor_classification_after_offering`; querying the live trigger set by table then confirmed it is present and enabled. This was a verification-name mismatch, not a database defect.

## Final exact-head qualification

Exact head `834180b49f575939ab23f13bd04426cc76d05374` passed all nine repository workflows:

1. Preview Data Safety
2. Budget Data Integrity
3. Admin and Couple Consistency
4. Provider Security CI
5. Admin Console CI
6. Admin Command Centre CI
7. Planner Marketplace CI
8. Provider Forms CI
9. repository-wide CI

The repository-wide CI passed the final executable planner browser release gate with flaky tests treated as failures. The dedicated Admin gate passed the documented-plan contract, complete clean migration chain, migration status, zero Prisma drift, PostgreSQL provisioning/classification integration, lint, production build, and responsive Windows/mobile browser gate.

At qualification time the branch was 36 commits ahead and 0 behind `main`; all three P2 review threads were formally resolved; the exact-head Vercel preview was READY and the Vercel commit status was success.

## Merge readiness criteria

Phase 7 is cleared only when all of the following are simultaneously true on the final candidate:

1. Branch is zero commits behind current `main`.
2. Dedicated Admin Command Centre CI passes its plan contract, complete migration chain, zero Prisma drift, PostgreSQL integration, lint, build, and responsive browser gate.
3. Repository-wide CI passes the final executable browser release gate with flaky tests treated as failures.
4. All cross-product workflows are green.
5. Vercel deployment is READY / successful.
6. The three P2 review findings above have been answered and verified against the final code.
7. The follow-up production migration has passed its pre/post database verification gate.

All seven criteria were satisfied on 2026-08-07. PR #84 remains unmerged pending the user's explicit merge instruction.
