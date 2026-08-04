# Worksheet recovery and live Seating release evidence — 2026-08-04

Status: application code and exact release gates passed; free-tier Vercel preview retry pending  
PR: #71 — `Release worksheet recovery and live Seating operations`  
Branch: `release/worksheet-seating-20260804`  
Application-qualified commit: `243d79170a1e5255adbb9229de4305ae49b5e600`

## Qualified application scope

- Checklist, Vendors, Budget, Timeline, and Seating worksheet template, preview, execution, export, idempotency, rollback, and wedding-isolation contracts.
- Compact planner workspace and persisted worksheet actions.
- Task priority filtering.
- Chronological Timeline presentation.
- Live Seating operations for a 230-seat venue plan: table classes, zones, notes, green available and red full/over states, individual and bulk Guest moves, capacity enforcement, safe deletion, audit records, and printable documentation.

## Exact application gate

GitHub Actions run `30907886929` completed successfully for commit `243d79170a1e5255adbb9229de4305ae49b5e600`.

The exact head passed:

- Prisma validation and client generation;
- clean PostgreSQL migration deployment, status, and drift detection;
- registration and production-blocker PostgreSQL integration;
- all retained planner parity, permissions, metadata, migration, extraction, workflow, collaboration, portal, real-data, and event-operations contracts;
- worksheet v1.1 schema and template contracts;
- Tasks, Vendors, Budget, Timeline, and Seating PostgreSQL round trips;
- Seating relational export, unseating, empty-table, capacity, isolation, and rollback tests;
- final Seating and Timeline release-blocker regressions;
- production application build;
- strict Playwright/Chromium release gate using `--fail-on-flaky-tests`.

Marketplace CI run `30907886867` also completed successfully for the same commit, including marketplace, privacy, invitation, isolation, PostgreSQL, build, and Chromium gates.

## Final review blockers closed

1. Generated Seating print HTML escapes table names, type labels, zones, notes, and Guest names.
2. Guest creation into a selected table checks occupancy and writes inside a retrying SERIALIZABLE transaction; a full table returns 409 without creating a Guest.
3. Individual Guest moves and table-capacity reductions re-read occupancy and write inside the same retrying SERIALIZABLE transaction.
4. Seating worksheet execution rejects a selected-row subset that omits any validated create or update row, preserving whole-batch capacity validation.
5. Timeline worksheet preview applies the same clock-time contract as Timeline API create/edit; values such as `25:90` and `TBD` are invalid.

All five review threads are resolved with permanent CI coverage.

## Production data safety baseline

Wedding: `cmqos70cb0004q6vxe9g9aiu5` (`Charity & Kudzie`)

Pre-release snapshot:

- Seating tables: 8
- Total capacity: 64
- Seating snapshot hash: `57d37898c7d4c5eb67cc8e6dd52194c8`
- Guests: 17
- Assigned Guests: 0
- Guest assignment hash: `305e3ee6cf4533030511c512af995828`

No production Seating or Guest data was changed during engineering or release-gate verification.

## Promotion boundary

Vercel rejected automatic deployment of the qualified application head because the Free-plan Git deployment quota was exhausted. No paid tier or paid generation service will be used.

This documentation-only commit retries the free preview deployment without changing the qualified application tree. Promotion remains blocked until this commit has:

1. successful CI and Marketplace CI;
2. a READY Vercel preview containing the qualified application tree;
3. `/planner/seating` responding successfully;
4. no relevant preview runtime errors.

After that immutable preview is verified, PR #71 can be merged, the exact production deployment verified, and the transactional Imba Manor plan applied:

- 1 High Table × 10 seats;
- 2 VIP Parents tables × 10 seats;
- 2 VIP Friends tables × 10 seats;
- 18 Ordinary tables × 10 seats;
- 23 tables and exactly 230 seats;
- all 17 existing Guests preserved;
- no unintended Guest assignments.
