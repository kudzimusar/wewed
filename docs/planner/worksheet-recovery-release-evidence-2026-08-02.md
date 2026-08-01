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

## Latest qualified engineering head

Commit: `6106c41a0fc17204e476dd5af7a6cc1b879b2097`

GitHub Actions:

- workflow run: `30713857873`
- job: `91405959228`
- conclusion: success
- browser failure evidence: skipped because the strict browser gate passed

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
- browser navigation verifies canonical route settlement and safely recovers from a pre-hydration click;
- responsive overlay tests wait for the loaded wedding and the actual compact-or-desktop navigation surface;
- portal geometry tests measure stable visible elements after entrance animation;
- sticky worksheet review headers are verified against their real overlap-and-pin contract.

## Live production data baseline

Wedding: `cmqos70cb0004q6vxe9g9aiu5` (`Charity & Kudzie`)

Counts reverified before deployment qualification:

- PlannerTask: 47
- Vendor: 0
- BudgetItem: 14
- ProgrammeItem: 12
- SeatingTable: 8
- Guest: 17
- ImportJob: 10

Deterministic hashes reverified before deployment qualification:

- PlannerTask: `2d8368df5b473de62a45c3b45714561c`
- Vendor: `d41d8cd98f00b204e9800998ecf8427e`
- BudgetItem: `c2975725f3c122f7795b470014b1caab`
- ProgrammeItem: `850bbb4827a507cbeb13c19a6797ea24`
- SeatingTable: `babc32747b33f562c1581dad285621dd`
- Guest: `3299ce07c2ecf95f2cc3544a21076005`

No production worksheet UAT records were introduced by engineering tests or deployment-gate verification.

## Deployment boundary

The latest available worksheet preview before this release trigger remains:

- deployment: `dpl_74E1ZC6NpvzFti8CAZLAwRCf53g5`
- commit: `19643bcb197e15071ff548c47e12f8bbc27fca30`
- state: READY

That deployment contains the original worksheet engineering changes but predates the final strict-browser stabilization commits and is not approved for controlled UAT.

This documentation-only release trigger requests a fresh preview without changing application behavior. The trigger commit itself must pass the same exact GitHub Actions gate. Controlled UAT remains blocked until that exact commit has:

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
