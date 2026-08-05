# Planner worksheet recovery execution plan — 2026-08-02

Status: In execution  
Branch: `fix/worksheet-recovery-contracts`  
Baseline main commit: `934b1ba5294c554229220ff5a6925cab47e22686`  
Production wedding used for controlled UAT: `cmqos70cb0004q6vxe9g9aiu5` (`Charity & Kudzie`)

## Scope

This programme is limited to the worksheet recovery tools. General planner module UI testing from Overview through Seating has already been completed separately.

The remaining worksheet modules are executed in dependency order:

1. Checklist / Tasks
2. Vendors
3. Budget
4. Timeline
5. Seating

The completed Guest worksheet flow is the reference implementation and acceptance standard.

## Objective

For every worksheet module, prove that all layers describe and preserve the same data contract:

`Template ↔ parser/mapping/validation ↔ preview/confirmation ↔ executor/rollback ↔ API ↔ database ↔ planner UI ↔ export`

A worksheet is not complete merely because it downloads, previews, imports, or builds. Completion requires evidence across all layers, wedding isolation, idempotency, rollback, and cleanup.

## Non-regression and safety rules

1. Use the existing free-tier Supabase project; do not create paid branches or projects.
2. Schema changes must be additive unless an explicitly reviewed data migration proves otherwise.
3. Every import and rollback must be scoped to the active wedding.
4. Blank update cells must not erase existing values unless the field contract explicitly defines blank as clear.
5. Ambiguous record matching must fail; the importer must never guess.
6. Re-importing an unchanged export must create no duplicates and should produce skips/no-ops.
7. Formula cells are rejected during preview and may not become valid during execution.
8. Create/update writes that span related models must be atomic per row.
9. Rollback must delete created records, restore updated records to their pre-import state, and leave unrelated records unchanged.
10. UAT records are reversible and removed after acceptance.
11. A module remains incomplete while any critical/high defect or unexplained data mismatch exists.
12. Production deployment, preview deployment, CI, and user UAT are separate evidence levels and must not be conflated.

## Phase 1 — Baseline and inventory

Record before repair or UAT:

- exact repository commit and branch;
- Vercel production deployment and aliases;
- Supabase project and migration state;
- active planner account and wedding;
- live row counts and deterministic hashes for each affected model;
- current worksheet template versions;
- current API, schema, exporter, executor, rollback and UI implementations.

## Phase 2 — Field-alignment contract

For each worksheet field, document:

- worksheet label and internal key;
- type and required/optional status;
- allowed values and validation rule;
- UI field and editability;
- API payload property;
- database model/table/column;
- create default;
- blank-on-update semantics;
- match/update identity;
- duplicate and ambiguity behavior;
- export representation;
- rollback snapshot and restoration behavior;
- wedding-scoping rule.

Any field present in only one layer is a defect or an explicitly documented exclusion.

## Module-specific audit focus

### Checklist / Tasks

Fields: task ID, title, category, description, assignee, due date, priority, status, dependency, completion percentage, notes and order where supported.

Critical cases: non-string titles, invalid dates/status/priority, unknown assignees, blank required title, assignment identity, dependency persistence, completion bounds and stable ordering.

### Vendors

Fields: vendor ID, name, category, contact person, phone, email, website, social media, quoted price, deposit, balance, deadline, contract status, service/payment status, responsible person and notes where supported.

Critical cases: phone/formula preservation, email/URL validation, numeric precision, rating/status ranges, matching identity and duplicate vendors.

### Budget

Fields: item ID, category, item/service, description, estimate, quote, final/actual cost, deposit/paid amount, balance, currency, payment status, deadline, vendor, responsible person and notes where supported.

Critical cases: decimal precision, negative values, blank versus zero, derived balance consistency, vendor references, formula rejection and aggregate totals after rollback.

### Timeline

Fields: item ID, date, start/end time, activity/title, description, location, responsible person, participants, vendor, status, guest visibility and notes where supported.

Critical cases: date/time parsing, midnight/noon, invalid ranges, ordering, duplicate times, vendor references, visibility, and chronological export.

### Seating

Fields: seating record ID, table name, capacity, guest ID/name, group, seat number, relationship, dietary/accessibility notes, restrictions and internal notes where supported.

Critical cases: guest matching, cross-wedding IDs, duplicate assignments, capacity, reassignment, unseating, table upsert/rename, relational rollback and orphan prevention.

## Phase 3 — Repair before UAT

Classify and repair defects as:

- data-contract defects;
- template defects;
- parser/validation defects;
- create/update/matching defects;
- export defects;
- rollback defects;
- UX/confirmation/history defects;
- wedding-isolation and security defects.

Each repair must add or strengthen automated coverage.

## Phase 4 — Automated release gate

For each module, require:

- Prisma validation/client generation and migration checks;
- schema/API/template parity tests;
- blank template preview;
- create, update, skip/idempotency and duplicate tests;
- invalid row and formula tests;
- export round trip;
- rollback create and update restoration;
- wedding isolation;
- desktop, tablet and mobile import/review/history UX;
- production build and executable browser suite.

## Phase 5 — Controlled UAT sequence

Execute one module completely before starting the next:

1. Download and inspect blank template.
2. Upload untouched template; expect zero actionable rows and no error.
3. Populate one controlled create row.
4. Verify preview counts and every confirmation field.
5. Capture database pre-import count/hash.
6. Execute import and verify every persisted field/default/relation.
7. Verify planner UI and refresh persistence.
8. Modify the same record and verify update, not create.
9. Re-import unchanged data and verify skip/no duplicate.
10. Exercise module-specific invalid data and formula rejection.
11. Export and verify headers, values, types, no formulas/corruption and safe re-import.
12. Verify wedding isolation.
13. Capture pre-rollback count/hash, execute rollback, verify created deletion and updated restoration.
14. Refresh UI, verify removal/restoration, audit record and unrelated-record integrity.
15. Remove all UAT data and confirm original baseline restored.

## Completion gate

A module is complete only when:

- field-alignment matrix is complete;
- defects are repaired;
- exact-head automated gates are green;
- deployment target is identified;
- controlled user UAT passes;
- live database evidence passes;
- export, idempotency, isolation and rollback pass;
- cleanup restores baseline;
- no unresolved critical/high issue remains.

## Status matrix

| Module | Alignment | Repairs | Automated gate | UAT | Export | Rollback | Isolation | Cleanup | Status |
|---|---|---|---|---|---|---|---|---|---|
| Guests | Complete | Complete | Passed | Passed | Passed | Passed | Verified | Complete | Reference complete |
| Checklist / Tasks | In progress | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Audit started |
| Vendors | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Not started |
| Budget | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Not started |
| Timeline | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Not started |
| Seating | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Not started |

## Evidence log conventions

For each checkpoint record:

- commit SHA;
- deployment ID/URL and environment;
- Supabase project and SQL evidence;
- template filename/version/hash;
- expected versus actual counts;
- exact defects and repairs;
- automated test command/result;
- UAT PASS/FAIL and screenshots where relevant;
- cleanup result.

Stop promotion on partial execution, unexplained count/hash changes, formula bypass, duplicate creation, cross-wedding access, failed rollback or a regression in an already accepted planner flow.
