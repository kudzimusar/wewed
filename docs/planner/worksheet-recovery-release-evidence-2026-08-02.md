# Worksheet recovery release evidence — 2026-08-02

Status: Engineering gate passed; exact preview deployment pending  
PR: #56 — `Align planner worksheet recovery contracts`  
Branch: `fix/worksheet-recovery-contracts`  
Production baseline: `934b1ba5294c554229220ff5a6925cab47e22686`

## Scope

This evidence applies only to the worksheet recovery programme for:

1. Checklist / Tasks
2. Vendors
3. Budget
4. Timeline
5. Seating

The general planner modules were tested separately. Guest worksheet recovery is the accepted reference flow.

## Exact green engineering head

Commit: `d0f77453414a954df86a597213f3c796e44a7e84`

GitHub Actions:

- workflow run: `30712405386`
- job: `91402066788`
- conclusion: success
- review threads: none

The exact head passed:

- Prisma validation and client generation;
- clean PostgreSQL migration deployment and status;
- migration drift detection;
- all existing planner parity and permission gates;
- production-blocker regression and PostgreSQL integration suites;
- worksheet v1.1 schema/template contracts;
- Tasks, Vendors, Budget, Timeline and Seating create/update/export/idempotency/rollback/isolation PostgreSQL round trips;
- complete Seating relational export, unseating, empty-table, capacity and rollback tests;
- application build;
- strict Playwright release gate using `--fail-on-flaky-tests`.

The browser gate completed successfully with no accepted retry or flaky result.

## Defects closed before the green gate

- transient `_importMeta` worksheet fields replaced with normalized, durable v1.1 contracts;
- formula metadata preserved from upload through execution after mapping changes;
- active-wedding internal-ID matching and ambiguity failures;
- duplicate rows targeting one existing record rejected;
- blank optional update cells preserve stored values;
- transaction-aware worksheet writes;
- exact pre-import snapshots and reverse-order rollback;
- explicit wedding-scoped delete/restore operations;
- Vendor pipeline synchronization in the worksheet transaction;
- Seating imports cannot create Guests or use cross-wedding Guest/Table IDs;
- Seating exports include assigned and unassigned Guests plus occupied and empty tables;
- blank table cells on a Guest row support deliberate unseating;
- whole-file Seating occupancy/capacity validation;
- responsive route state and scroll restoration race repaired;
- browser tests measure the current visible portal element and fail on any flake;
- browser navigation verifies canonical route settlement and safely recovers from a pre-hydration click.

## Live production data baseline

Wedding: `cmqos70cb0004q6vxe9g9aiu5` (`Charity & Kudzie`)

Counts reverified before this evidence refresh:

- PlannerTask: 47
- Vendor: 0
- BudgetItem: 14
- ProgrammeItem: 12
- SeatingTable: 8
- Guest: 17
- ImportJob: 10

Deterministic hashes reverified before this evidence refresh:

- PlannerTask: `2d8368df5b473de62a45c3b45714561c`
- Vendor: `d41d8cd98f00b204e9800998ecf8427e`
- BudgetItem: `c2975725f3c122f7795b470014b1caab`
- ProgrammeItem: `850bbb4827a507cbeb13c19a6797ea24`
- SeatingTable: `babc32747b33f562c1581dad285621dd`
- Guest: `3299ce07c2ecf95f2cc3544a21076005`

No production worksheet UAT records were introduced by engineering tests or deployment-gate verification.

## Deployment boundary

The latest available worksheet preview before this evidence refresh remains:

- deployment: `dpl_6gqWcnUzDKpg4YQCRBt7X7RRjKGV`
- commit: `7c388aaf7e272aeeb166a99c708735bac578463a`
- state: READY

That deployment is behind the exact green engineering head and is not approved for controlled UAT.

This documentation-only evidence refresh intentionally requests a fresh preview deployment without changing application behavior. Controlled UAT remains blocked until one exact commit containing `d0f77453414a954df86a597213f3c796e44a7e84` has:

1. a successful exact GitHub Actions release gate;
2. a READY Vercel preview;
3. `/planner` responding successfully;
4. no relevant preview runtime errors.

## Controlled UAT order after deployment qualification

1. Checklist / Tasks
2. Vendors
3. Budget
4. Timeline
5. Seating

For each module: blank template, create, database verification, UI persistence, update, idempotency, invalid/formula input, export round trip, wedding isolation, rollback, and cleanup.
