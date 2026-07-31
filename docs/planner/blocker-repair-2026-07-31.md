# Planner blocker repair — 2026-07-31

Branch: `fix/planner-production-blockers`
Baseline: `aeea2dba76f59a1a087e49bada39d3d1d227ab0e`

## Scope

- `DEF-PLN-VENDOR-001`: align Vendor database, Prisma and API fields.
- `DEF-PLN-TIMELINE-001`: align ProgrammeItem database, Prisma and API fields.
- `DEF-PLN-TIMELINE-002`: make the presented edit workflow persist reliably.
- `DEF-PLN-WS-GUEST-001`: persist every supported Guest worksheet field.
- `DEF-PLN-WS-GUEST-002`: implement wedding-scoped Guest ID matching and safe fallbacks.
- `DEF-PLN-WS-GUEST-003`: make Guests export a complete master guest list.

Template appearance is deferred until the backend contract is lossless.

## Non-regression rules

1. Work stays on the repair branch until all gates pass.
2. Schema changes are additive; no production data is removed.
3. Existing Guest names are not destructively split.
4. Blank import cells do not erase existing values.
5. Guest, RSVP and seating writes are atomic per row.
6. IDs, emails and table references are scoped to the active wedding.
7. Reimporting unchanged data creates no duplicates.
8. Rollback restores Guest, RSVP and seating state.
9. Production promotion is blocked by any failing migration, unit, integration, browser, isolation or rollback test.

## Data contract

Vendor adds `contact`, `contractStatus`, `paymentStatus`, `planningRating`, `notes`.

ProgrammeItem adds `duration`, `location`, `displayIcon`.

Guest adds durable worksheet fields for first/last/display name, group, invitation status, accessibility, transport, accommodation, seat assignment, public notes and private notes. Existing `name` remains compatible.

RSVP adds an explicit response status and party size while preserving `attending` compatibility.

Guest worksheet matching order:

1. Guest ID within the active wedding.
2. Email within the active wedding.
3. Unique normalized name and phone.
4. Unique normalized display name.
5. Ambiguous matches are errors, never guesses.

## Required gates

- Migration applies to representative legacy data.
- Prisma/client and database drift check passes.
- Vendor full CRUD, persistence and isolation pass.
- Timeline full CRUD, persistence, print and isolation pass.
- Guest worksheet full-field import/database/export round trip passes.
- Guest ID, email and no-email idempotency tests pass.
- RSVP and seating assignment/capacity tests pass.
- Cross-wedding references are rejected.
- Blank-cell preservation passes.
- Create/update rollback restores the exact prior state.
- Existing planner regression suites remain green.

## Release sequence

1. Capture database backup and integrity baseline.
2. Apply additive migration in a non-production environment.
3. Run automated gates and controlled UAT.
4. Review code and migration diff.
5. Apply the verified migration and tested build to production.
6. Run controlled production smoke tests and monitor logs.

## Stop conditions

Stop promotion on unknown Prisma fields, partial import success, erased existing values, duplicate creation, cross-wedding access, failed rollback or any existing planner regression.
