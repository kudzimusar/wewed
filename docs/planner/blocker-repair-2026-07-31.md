# Planner blocker repair — 2026-07-31

Status: Automated gates passed; isolated preview UAT pending  
Branch: `fix/planner-production-blockers`  
Pull request: `#15` (draft)  
Baseline production commit: `aeea2dba76f59a1a087e49bada39d3d1d227ab0e`

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

## Implemented data contract

### Vendor

The additive migration supplies the fields already expected by the planner API:

- `contact`
- `contractStatus`
- `paymentStatus`
- `planningRating`
- `notes`

### Timeline

The additive migration supplies the fields already expected by the planner API:

- `duration`
- `location`
- `displayIcon`

### Guest worksheet

Native fields remain on their existing source-of-truth models:

- `Guest`: canonical name, email, phone, role, side and seating relation.
- `RSVP`: attending compatibility, plus-one, children and dietary data.
- `SeatingTable`: selected-wedding table relation and capacity enforcement.

Worksheet-only fields are durably stored in the server-only table:

`wewed_planner."GuestWorksheetData"`

This contains first/last/display name metadata, group, invitation status, exact response status, party size, accessibility, transport, accommodation, seat assignment, and public/private notes. The schema is not exposed to direct Supabase client roles.

Existing `Guest.name` remains compatible. Legacy names are not automatically split. Partial name updates preserve the existing complete display name unless a complete replacement can be formed.

Guest worksheet matching order:

1. Guest ID within the active wedding.
2. Email within the active wedding.
3. Unique normalized name and phone.
4. Unique normalized display name.
5. Ambiguous matches are errors, never guesses.

Blank update cells preserve existing values. Missing or full table assignments fail the row transaction rather than partially saving Guest or RSVP data.

## Automated-gate checkpoint

Green commit: `bfb300b79b87a23bbf84094303277550126e6dfa`

Passed on 2026-07-31:

- Prisma schema validation and client generation.
- Additive migration deployment to clean PostgreSQL.
- Migration status and Prisma drift detection.
- Original planner parity and integrity contracts.
- Stages 2 through 10 planner suites.
- Phases 2 through 6 workflow suites.
- New blocker source-contract suite.
- Real PostgreSQL integration covering:
  - normalized Vendor write/read;
  - normalized Timeline write/read;
  - all-field Guest worksheet update;
  - Guest, RSVP and seating readback;
  - update rollback;
  - no-email create and idempotent reimport;
  - create rollback;
  - cross-wedding Guest ID rejection.
- Production Next.js build.
- Executable Playwright planner browser release gate.
- Admin Console CI.

Passing automation does not authorize production migration or deployment. Isolated preview UAT, backup verification and production smoke controls remain mandatory.

## Required gates

- [x] Migration applies to clean PostgreSQL.
- [x] Prisma/client and database drift check passes.
- [x] Vendor normalized persistence passes against PostgreSQL.
- [x] Timeline normalized persistence passes against PostgreSQL.
- [x] Guest worksheet full-field import/database/readback round trip passes.
- [x] Guest ID and no-email idempotency tests pass.
- [x] RSVP and seating assignment persistence passes.
- [x] Cross-wedding references are rejected.
- [x] Blank-cell and partial-name preservation contracts pass.
- [x] Create/update rollback restores the prior state.
- [x] Existing planner regression and browser suites remain green.
- [ ] Isolated preview browser UAT passes.
- [ ] Production backup and integrity baseline are verified.
- [ ] Controlled production smoke UAT passes after release.

## Release sequence

1. Capture database backup and integrity baseline.
2. Apply additive migration in a non-production environment.
3. Run automated gates and controlled preview UAT.
4. Review code and migration diff.
5. Apply the verified migration and tested build to production.
6. Run controlled production smoke tests and monitor logs.

## Stop conditions

Stop promotion on unknown Prisma fields, partial import success, erased existing values, duplicate creation, cross-wedding access, failed rollback or any existing planner regression.
