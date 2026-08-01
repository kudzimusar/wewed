# Worksheet recovery release evidence — 2026-08-02

Status: Task Test 11 and strict browser stabilization passed; exact preview deployment pending  
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

Commit: `a260fa0e9748d34e95c30173ce701da678d4b1d3`

GitHub Actions:

- workflow run: `30714886926`
- job: `91408701760`
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
- production build;
- strict Playwright release gate using `--fail-on-flaky-tests`;
- executable Task Test 11 priority-filter contract;
- visible worksheet file-chooser interaction for populated, blank and formula workbooks;
- keyboard dialog-close synchronization after the active focus trap is ready.

The browser gate completed successfully with no accepted retry or flaky result.

## Task Test 11 gap and repair

The controlled UAT instruction required `Any priority → High`, but the Tasks UI exposed only category and status filters. The missing priority control was a real functionality gap.

Repair:

- added a persisted priority filter with `Any priority`, `High`, `Medium` and `Low` options;
- applied the filter client-side without task mutations;
- retained Reset behavior and responsive layout;
- added an executable browser scenario using `UAT-TASK-001 Confirm florist arrival` plus medium- and low-priority controls;
- verified the UAT task remains visible exactly once;
- verified medium and low tasks are hidden;
- verified the UAT task remains `In progress`;
- verified before/after API task payloads are identical;
- verified no browser, console, API 5xx or runtime error appears.

## Other defects closed before the green gate

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
- sticky worksheet review headers are verified against their real overlap-and-pin contract;
- worksheet import tests use the visible file chooser instead of racing a hidden input before hydration;
- dialog Escape tests wait until the mounted dialog owns keyboard focus.

## Live production data baseline

Wedding: `cmqos70cb0004q6vxe9g9aiu5` (`Charity & Kudzie`)

Counts reverified after the Task Test 11 engineering run:

- PlannerTask: 47
- Vendor: 0
- BudgetItem: 14
- ProgrammeItem: 12
- SeatingTable: 8
- Guest: 17
- ImportJob: 10

Deterministic hashes reverified after the Task Test 11 engineering run:

- PlannerTask: `2d8368df5b473de62a45c3b45714561c`
- Vendor: `d41d8cd98f00b204e9800998ecf8427e`
- BudgetItem: `c2975725f3c122f7795b470014b1caab`
- ProgrammeItem: `850bbb4827a507cbeb13c19a6797ea24`
- SeatingTable: `babc32747b33f562c1581dad285621dd`
- Guest: `3299ce07c2ecf95f2cc3544a21076005`

No production worksheet UAT records were introduced by engineering tests or deployment-gate verification.

## Deployment boundary

The latest available preview containing the priority-filter application change before this trigger is:

- deployment: `dpl_GTrvfueeUBsxtB6h424io8HjL8fA`
- commit: `04f3d75040570b107c45e9ae5b17d791121e1707`
- state: READY

That deployment predates the final strict-browser synchronization commits and is not approved for controlled UAT.

This documentation-only release trigger requests a fresh preview without changing application behavior. The trigger commit itself must pass the same exact GitHub Actions gate. Controlled UAT is approved only when the exact trigger commit has:

1. a successful exact GitHub Actions release gate;
2. a READY Vercel preview;
3. `/planner` responding successfully;
4. no relevant preview runtime errors.

Controlled live-data UAT remains separate from the executable browser contract and requires an authenticated tester session.

## Controlled UAT order

1. Checklist / Tasks
2. Vendors
3. Budget
4. Timeline
5. Seating

For each module: blank template, create, database verification, UI persistence, update, idempotency, invalid/formula input, export round trip, wedding isolation, rollback, and cleanup.
