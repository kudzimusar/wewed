# Wewed staging operations

## Isolation model

Wewed preview/testing uses the `staging` PostgreSQL schema in the existing Supabase project. Production remains in `public`.

The staging schema:

- contains synthetic data only;
- has no copied production rows;
- denies `anon` and `authenticated` direct access;
- includes `staging._wewed_environment` with `environment='staging'` and `reset_allowed=true`;
- is addressed through a connection URL ending in `?schema=staging`;
- is protected by scripts that refuse `schema=public`.

A separate Supabase branch/project is preferred when the account plan permits it. Supabase branching was unavailable and the organization had reached its active-project limit, so schema isolation is the safe Phase 0 fallback.

## Required secret

Create a GitHub Environment named `staging` and add:

- `WEWED_STAGING_DATABASE_URL`: Supabase session-pooler URL on port 5432, with `?schema=staging`.

Never reuse `WEWED_DATABASE_URL` for staging workflows.

## Reset and reseed

```bash
export WEWED_STAGING_DATABASE_URL='postgresql://...:5432/postgres?schema=staging'
bash scripts/staging-reset.sh
```

The command truncates all staging application tables, preserves migration metadata and the safety marker, then inserts deterministic fictional data from `scripts/staging-seed.sql`.

Expected test tenant:

- wedding slug: `alex-and-jordan-test`
- synthetic couple: Alex & Jordan Example
- fictional guests, vendors, tasks, budget items, seating tables, RSVPs, and programme entries
- `.example.test` email and website domains only

## Backup

```bash
bash scripts/staging-backup.sh
# or
bash scripts/staging-backup.sh backups/before-test-cycle.dump
```

Backups are PostgreSQL custom-format dumps limited to the `staging` schema. Do not commit backup files.

## Restore

```bash
bash scripts/staging-restore.sh backups/before-test-cycle.dump
```

Restore first verifies the staging URL and marker, restores only the staging schema, then verifies the marker again.

## Migration verification

```bash
bash scripts/verify-migration-state.sh
```

This runs:

1. staging target assertion;
2. `prisma migrate status`;
3. Prisma schema drift detection with `prisma migrate diff --exit-code`;
4. a report of applied staging migrations.

The `.github/workflows/staging-database.yml` workflow applies pending migrations before verification and optionally resets/reseeds via manual dispatch.

## Feature flags

Unverified or externally dependent controls default to hidden. Enable only after their API contract and end-to-end test pass:

```env
NEXT_PUBLIC_FEATURE_PLANNER_CORE=true
NEXT_PUBLIC_FEATURE_GUEST_IMPORT_EXPORT=false
NEXT_PUBLIC_FEATURE_GOOGLE_SHEETS_SYNC=false
NEXT_PUBLIC_FEATURE_GUEST_CONTRIBUTIONS=false
NEXT_PUBLIC_FEATURE_AI_PLANNER=false
NEXT_PUBLIC_FEATURE_PUBLIC_PUBLISHING=false
NEXT_PUBLIC_FEATURE_PAYMENTS=false
```

The registry is `src/lib/feature-flags.ts`. UI work must use `isPlannerFeatureEnabled()` rather than reading environment variables directly.

## Phase 0 acceptance test

1. Back up staging.
2. Run reset/reseed twice; both runs must complete without duplicate-key errors.
3. Confirm production counts are unchanged.
4. Edit a synthetic task and guest through the preview app.
5. Refresh and confirm persistence.
6. Restore the backup.
7. Confirm the original synthetic records return.
8. Run migration verification and confirm no drift.
9. Confirm disabled controls are not rendered.
