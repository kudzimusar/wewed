# Planner blocker repair — 2026-07-31

Status: Automated gates passed; production database repaired additively; controlled application UAT pending  
Branch: `fix/planner-production-blockers`  
Pull request: `#50` (draft)  
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

1. Code stays on the repair branch until application UAT passes.
2. Schema changes are additive; no production data is removed.
3. Existing Guest names are not destructively split.
4. Blank import cells do not erase existing values.
5. Guest, RSVP and seating writes are atomic per row.
6. IDs, emails and table references are scoped to the active wedding.
7. Reimporting unchanged data creates no duplicates.
8. Rollback restores Guest, RSVP and seating state.
9. Promotion is blocked by any failing migration, unit, integration, browser, isolation or rollback test.

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

Green CI commit before live database documentation: `bfb300b79b87a23bbf84094303277550126e6dfa`

Passed on 2026-07-31:

- Prisma schema validation and client generation.
- Additive migration deployment to clean PostgreSQL.
- Migration status and Prisma drift detection.
- Original planner parity and integrity contracts.
- Stages 2 through 10 planner suites.
- Phases 2 through 6 workflow suites.
- New blocker source-contract suite.
- Real PostgreSQL integration covering normalized Vendor and Timeline writes, all-field Guest worksheet round trip, idempotent reimport, cross-wedding rejection and rollback.
- Production Next.js build.
- Executable Playwright planner browser release gate.
- Admin Console CI.

## Live free-tier database intervention

User direction: do not create a paid Supabase branch or project; repair the existing free-tier Wewed database directly.

Supabase project: `Wewed` (`kjigkhjdeymukwradoqu`).

Pre-change counts captured on 2026-07-31:

- Wedding: 4
- Vendor: 0
- ProgrammeItem: 45
- Guest: 17
- RSVP: 17
- SeatingTable: 32
- Prisma ledger rows: 1

A private recovery schema was created before the repair:

`wewed_recovery_20260731`

It contains row-for-row copies of Wedding, Vendor, ProgrammeItem, Guest, RSVP, SeatingTable and `_prisma_migrations`, plus a timestamped count manifest. All snapshot counts matched the live pre-change counts. The schema and its tables are revoked from `PUBLIC`, `anon` and `authenticated`.

The additive production migration `repair_planner_production_blockers_20260731` then added the Vendor and Timeline columns and created `wewed_planner."GuestWorksheetData"`. Verification confirmed:

- every required column is present;
- all Guest worksheet constraints are valid;
- `anon` and `authenticated` have no `USAGE` privilege on `wewed_planner`;
- all original live row counts remained unchanged.

A rollback-only transaction successfully wrote and validated normalized Vendor data, normalized Timeline data and a complete Guest worksheet extension row. The transaction was rolled back and zero probe rows remained.

Supabase advisors reported no new critical repair issue. Existing informational indexing advisories and pre-existing admin-function search-path warnings remain separate maintenance work.

## Required gates

- [x] Migration applies to clean PostgreSQL.
- [x] Prisma/client and database drift check passes in CI.
- [x] Vendor normalized persistence passes against PostgreSQL.
- [x] Timeline normalized persistence passes against PostgreSQL.
- [x] Guest worksheet full-field import/database/readback round trip passes.
- [x] Guest ID and no-email idempotency tests pass.
- [x] RSVP and seating assignment persistence passes.
- [x] Cross-wedding references are rejected.
- [x] Blank-cell and partial-name preservation contracts pass.
- [x] Create/update rollback restores the prior state.
- [x] Existing planner regression and browser suites remain green.
- [x] Production recovery snapshot and integrity baseline are verified.
- [x] Additive blocker migration is applied to the existing free-tier database.
- [ ] Controlled application-level Vendor and Timeline smoke UAT passes.
- [ ] Controlled application-level Guest worksheet import/export/rollback UAT passes after deploying the repair build.
- [ ] Production runtime logs remain clear during the smoke window.

## Remaining release sequence

1. Run Vendor and Timeline smoke tests against the current application now that the database contract is repaired.
2. Deploy or merge the tested repair build only after code review.
3. Run controlled Guest worksheet import/export/rollback UAT with reversible test records.
4. Verify wedding isolation and monitor production runtime logs.
5. Remove controlled UAT records and retain the recovery schema until the release is accepted.

## Stop conditions

Stop promotion on unknown Prisma fields, partial import success, erased existing values, duplicate creation, cross-wedding access, failed rollback or any existing planner regression.
