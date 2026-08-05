# Worksheet recovery alignment audit — 2026-08-02

Status: Repair required before controlled UAT  
Branch: `fix/worksheet-recovery-contracts`  
Audit baseline: `934b1ba5294c554229220ff5a6925cab47e22686`  
Active-wedding baseline: `cmqos70cb0004q6vxe9g9aiu5`

## Evidence reviewed

- Five downloaded v1.0.0 workbooks: Checklist, Vendors, Budget, Timeline and Seating.
- Shared workbook generator, parser, mapper, validator, preview, executor, exporter and rollback routes.
- Planner APIs and UI contracts for Tasks, Vendors, Budget, Timeline and Seating.
- Prisma schema and live Supabase columns/counts/hashes.
- Current Vercel production deployment and repository baseline.

## Workbook structure result

All five v1.0.0 files have a sound structural shell:

- Template, Instructions and About worksheets;
- Template first;
- header-only data area with 100 blank rows;
- frozen header row;
- Excel table and filters;
- protected structure with unlocked data-entry cells;
- field validations;
- no executable sample row;
- no formulas in the blank templates;
- workbook contract 2.0 metadata.

The blocker is not the workbook shell. The blocker is the field and persistence contract.

## Systemic blocker

The generic schemas put unsupported worksheet values in `_importMeta`, then every generic upsert explicitly removes `_importMeta` before writing. Consequently those values disappear after execution. Export attempts to read `_importMeta` from ordinary Prisma rows, where it does not exist, so the advertised columns cannot round-trip.

This affects Checklist, Vendors, Budget, Timeline and Seating. A preview can therefore look complete while the database and subsequent export are incomplete.

## Additional engine blockers

1. Empty `mappingOverrides` causes the execution route to rebuild a preview with `formulaCells: []`; a formula rejected during upload can become executable during confirmation.
2. Generic rollback snapshots use exported worksheet rows instead of exact pre-import database state.
3. Blank update cells are described as preserve, but generic row conversion frequently turns them into defaults/nulls and full-record upserts can overwrite existing values.
4. Multiple rows can target one existing record through different identities without a deterministic collision error.
5. Rollback restores update snapshots in forward order, which is unsafe for sequential relational changes.
6. The five-error cutoff leaves later rows uncounted while the job can still be marked executed.
7. Generic delete/restore helpers are ID-based without an explicit active-wedding guard.
8. Existing matching is usually name/title-only despite the workbooks exposing internal IDs.
9. Seating can resolve a Guest ID outside the active wedding, create unexpected Guest records, overfill tables and roll back by merely unassigning rather than restoring the original relation.
10. Vendor worksheet writes bypass the normalized vendor pipeline synchronization used by the planner UI/API.

## Module mismatch findings

### Checklist / Tasks v1.0.0

Advertised but not persisted by `PlannerTask` or the planner task UI/API:

- Dependency
- Completion %
- Notes

Other mismatches:

- Template categories omit supported timeline/spiritual categories.
- Worksheet order is discarded and every imported row is assigned order 0.
- Task ID is exported but not used for active-wedding matching.
- Blank optional values can erase existing task fields during an update.

### Vendors v1.0.0

Advertised but not persisted by the normalized Vendor/UI contract:

- Email
- Social Media
- Quoted Price
- Deposit Paid
- Balance
- Payment Deadline
- Service Status
- Responsible Person

Other mismatches:

- Template categories differ from planner API categories.
- Template contract statuses differ from planner API contract statuses.
- Worksheet service status is incorrectly separate from the planner payment status contract.
- Contact Person is not mapped to normalized `contact`.
- Contract/payment fields are stored only in transient metadata.
- Import does not synchronize the vendor pipeline ContentRevision.
- Vendor ID is not used for matching.

### Budget v1.0.0

Advertised but not persisted as independent normalized fields:

- separate Item/Service and Description values;
- Quoted Amount;
- Balance Remaining;
- Payment Status;
- Responsible Person.

Other mismatches:

- worksheet Vendor is not deterministically linked through active-wedding Vendor ID;
- negative amounts and malformed currencies are not comprehensively rejected;
- Budget Item ID is not used for matching;
- blank values can overwrite existing values;
- derived balance/payment values can diverge from actualCost/paidAmount.

### Timeline v1.0.0

Advertised but not persisted by `ProgrammeItem` or editable in the planner UI:

- Date
- separate Start Time and End Time
- Responsible Person
- Participants
- Vendor Involved
- Status
- Guest-Facing Visibility
- Internal Notes

Other mismatches:

- Location exists in the database but is stored only in transient metadata by the worksheet schema.
- Timeline Item ID is not used for matching.
- Imported order is always 0.
- Activity-only matching is ambiguous.

### Seating v1.0.0

Advertised but not represented by the current seating UI/database contract:

- Seating Record ID as a separate entity
- Guest Group
- Seat Number
- Relationship
- Dietary Notes
- Accessibility Notes
- Seating Restrictions
- Internal Notes

Critical relational defects:

- Guest ID lookup is not active-wedding scoped.
- A missing Guest can be silently created.
- Table capacity is not reliably enforced.
- Table changes and Guest assignments are not snapshotted/restored losslessly.
- A created table can be orphaned after rollback.
- Guest name alone is an unsafe identity when duplicate names exist.

## Accepted v1.1.0 contracts

The repair narrows each workbook to fields that are visible/useful in the planner and durably supported by the current database. No hidden extension metadata is introduced for these modules.

### Checklist / Tasks

1. Task ID
2. Task
3. Category
4. Description
5. Assigned Person
6. Due Date
7. Priority
8. Status
9. Order

### Vendors

1. Vendor ID
2. Vendor Name
3. Category
4. Description
5. Contact
6. Phone
7. Website
8. Contract Status
9. Payment Status
10. Rating
11. Notes
12. Featured

### Budget

1. Budget Item ID
2. Category
3. Description
4. Estimated Cost
5. Actual Cost
6. Paid Amount
7. Currency
8. Vendor ID
9. Vendor
10. Notes
11. Due Date

### Timeline

1. Timeline Item ID
2. Time
3. Activity
4. Description
5. Duration
6. Location
7. Icon
8. Order

### Seating

1. Guest ID
2. Guest Name
3. Table ID
4. Table Name
5. Table Capacity

Seating imports assign existing active-wedding Guests only. They may create a named table, but never create a Guest. Table position remains visible system state and is not worksheet-editable because the planner UI does not expose a position editor.

## Matching rules

For all modules:

1. Active-wedding internal ID, when supplied.
2. Module-specific normalized fallback only when it resolves exactly one active-wedding record.
3. Unknown supplied IDs fail; they never fall back to create.
4. Ambiguous fallback matches fail.
5. Two rows targeting the same existing record fail deterministically.

Fallbacks:

- Tasks: normalized title.
- Vendors: normalized vendor name.
- Budget: normalized description.
- Timeline: normalized time plus activity.
- Seating: normalized Guest name; target table by table ID or unique normalized table name.

## Update and rollback rules

- Blank optional cells preserve existing values.
- Create defaults are applied only to new records.
- Exact pre-import database values are snapshotted.
- Created records are deleted only within the active wedding.
- Updated records are restored in reverse execution order.
- Seating restores the Guest's prior table, restores a pre-existing target table's fields, and removes a newly created target table only when it is empty.
- Vendor import/rollback keeps planner pipeline metadata synchronized.
- Aborted rows after the runtime error limit are explicitly counted and reported.

## Live baseline

Counts before repairs/UAT:

- PlannerTask: 47
- Vendor: 0
- BudgetItem: 14
- ProgrammeItem: 12
- SeatingTable: 8
- Guest: 17
- ImportJob: 10

Deterministic row hashes:

- PlannerTask: `2d8368df5b473de62a45c3b45714561c`
- Vendor: `d41d8cd98f00b204e9800998ecf8427e`
- BudgetItem: `c2975725f3c122f7795b470014b1caab`
- ProgrammeItem: `850bbb4827a507cbeb13c19a6797ea24`
- SeatingTable: `babc32747b33f562c1581dad285621dd`
- Guest: `3299ce07c2ecf95f2cc3544a21076005`

## Promotion gate

Controlled worksheet UAT is blocked until:

- aligned v1.1.0 schemas generate the accepted templates;
- formula metadata survives preview-to-execution;
- matching, preservation, exact snapshots, active-wedding delete/restore and seating relational rollback are automated;
- build and browser gates pass on one exact commit;
- a preview deployment for that exact commit is READY.
