# Wewed Production Database Authority

Status: **authoritative production database governance contract**

## Decision

Wewed Production DDL is managed through the **Supabase migration ledger** (`supabase_migrations.schema_migrations`).

The SQL files under `prisma/migrations` remain the reviewed repository migration chain used by clean-database CI and schema regression tests. They are **not replayed against the existing Wewed Production database**.

`public._prisma_migrations` is a historical ledger from an earlier production deployment path. It is read-only and is not repaired by inventing successful rows, mass-marking migrations applied, or replaying historical DDL.

## Why this is necessary

Production was historically advanced through Supabase migrations while the repository also accumulated Prisma migration directories. A later `prisma migrate deploy` attempt therefore encountered schema that already contained historical DDL and stopped at:

`20260729131000_normalize_planner_metadata`

with PostgreSQL error `42701` because `Vendor.contact` already existed. The Prisma row has zero applied steps and remains unfinished. That row is evidence of the retired deployment path; it is not permission to replay the migration.

The normalized Vendor and ProgrammeItem columns are present in Production in the shape expected by the current application. The old migration also contained transitional legacy-sync triggers that Production never installed and that current application code no longer requires.

## Reconciliation migration

`20260810100000_production_schema_reconciliation` establishes the shared final state for Production and clean-database migration replay:

1. `GuestContribution.guestId` remains `ON DELETE RESTRICT`, matching Prisma.
2. `wewed_delete_guest_contribution_before_guest` removes the owned one-to-one contribution immediately before a Guest is deleted, restoring the planner Guest lifecycle without Prisma schema drift.
3. obsolete `sync_vendor_planner_metadata` and `sync_programme_item_metadata` triggers/functions are absent from the final schema.

The same reviewed SQL is applied to Production through the Supabase migration API with migration name `production_schema_reconciliation`.

## Rules for every future production schema change

1. Write the migration SQL in the repository first.
2. Qualify the migration against a clean test database through Wewed CI.
3. Review the SQL for data-loss, lock, privilege, RLS, trigger and dependency effects.
4. Apply that exact reviewed SQL through the Supabase migration authority.
5. Verify the Supabase migration ledger contains one successful record for the production migration.
6. Verify the expected physical tables/columns/constraints/functions/triggers and browser-role privileges.
7. Only then merge/promote application code that depends on the schema.

Do not run `prisma migrate deploy` or `prisma migrate resolve` against Wewed Production. A future decision to make Prisma the Production migration authority requires a separately approved baseline project, complete schema/procedure/trigger/privilege comparison, and a planned ledger cutover. It must not be performed incrementally by editing `_prisma_migrations`.

## Repository workflow

`.github/workflows/deploy-database.yml` is retained only as a **read-only Production database authority verifier** for compatibility with existing GitHub configuration. It validates the target, application Prisma schema, Supabase reconciliation marker, known historical Prisma state, guest lifecycle trigger and absence of obsolete legacy-sync functions.

It contains no production DDL execution step.

## Release invariant

At a Wewed release boundary:

- Git contains the reviewed SQL that defines the intended final state;
- clean-database CI can replay the repository migration chain;
- Supabase records the Production application of the reviewed reconciliation/current migration;
- Production physical objects match the intended final state;
- the historical Prisma Production ledger is never treated as an executable queue.
