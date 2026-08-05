# Budget data incident and recovery — 2026-08-04

## Scope

Wedding: `cmqos70cb0004q6vxe9g9aiu5` — Charity & Kudzie.

This report records the investigation into the apparent Budget regression observed while planner worksheet and Seating previews were being tested against the shared live database. It separates confirmed database evidence from conclusions that cannot be established because comprehensive Budget mutation auditing was not active before the incident.

## Confirmed findings

### Current surviving rows

The current database contains:

- the 14 Budget rows originally created on 2026-06-22; and
- three rows created on 2026-08-03:
  - Candles, holders, lights
  - Wedding Planner
  - Rings and Jewellary

The separate `UAT-BUDGET-001` row is identifiable in Budget import preview, execution, and rollback snapshot records and is not present in the current Budget. It was test data, not one of the three user-created rows above. The surviving ImportJob status and audit records do not, by themselves, establish the exact cleanup operation that removed it.

### 2026-08-03 edits

The 14 older rows have individual `updatedAt` timestamps spanning the 2026-08-03 Budget editing session. Their currently stored actual and paid values were written row by row and must not be replaced with older seed values without user confirmation.

The current database totals are:

- 17 items
- USD 31,820 estimated
- USD 6,940 actual
- USD 1,850 paid
- USD 5,090 outstanding

These figures describe the current database state. They are not proof that no additional user row or earlier value was lost, and they must not be represented as the user-approved final Budget until the user confirms them.

### One confirmed agent-caused overwrite

At 2026-08-04 01:53:37 UTC, an engineering restoration linked the Imba Manor vendor to Budget item `cmqpub1ef002dnysp86zt265b` and also set:

- `paidAmount` to `0`; and
- `notes` to `Linked to the restored Imba Manor venue record. No payment recorded as of 2026-08-04.`

The available business-account and payment evidence did not support that no-payment assertion. The operation therefore overwrote a known USD 1,500 venue deposit and inserted a synthetic note.

### Confirmed recovery

At 2026-08-04 13:42:45 UTC, a wedding-scoped transaction restored only the confirmed damaged fields:

- `paidAmount`: `0` → `1500`
- `notes`: synthetic no-payment note → `NULL`

The transaction preserved:

- the currently stored USD 2,400 actual venue cost;
- the USD 4,500 estimate;
- the valid Imba Manor vendor ID and name; and
- all other surviving Budget rows and stored values.

AuditEvent `audit-budget-venue-reconcile-20260804` contains the exact before and after snapshots.

A later idempotent agent-side write advanced the venue row's `updatedAt` timestamp without changing its stored financial value or note. It was not a user edit.

## Evidence limitations

Before this incident, `BudgetItem` did not have a database-level insert, update, and delete audit trigger. The available ImportJob and AuditEvent records therefore cannot prove either of the following:

- that no other real Budget row was deleted before the current snapshot; or
- that every current value exactly matches the user's last intended value.

PostgreSQL statistics show dead Budget tuples, but the database role cannot use `pageinspect` to recover their contents safely. No speculative restoration is authorized. Any additional recovery requires user-supplied source evidence such as a prior export, screenshot, invoice list, or a confirmed row-by-row comparison.

## Verified current state

At the close of this investigation, the read-only database check returned:

- item count: `17`
- estimated total: `31820`
- actual total: `6940`
- paid total: `1850`
- outstanding total: `5090`

This is a verified current snapshot, not a declaration that recovery is complete.

## Permanent safeguards in PR #71

1. Migration `20260804144500_budget_item_audit_trigger` records every Budget insert, update, and delete at the PostgreSQL layer, including direct SQL operations.
2. The audit trigger has a clean-PostgreSQL integration test and a dedicated `Budget Data Integrity` workflow.
3. Preview deployments that share live data are read-only at the centralized wedding-permission boundary.
4. Preview mutations return HTTP `423`, code `PREVIEW_WRITE_BLOCKED`, and header `x-wewed-preview-write-blocked: true`.
5. A preview can write only when `WEWED_PREVIEW_WRITABLE_WEDDING_ID` exactly matches an explicitly configured non-production UAT wedding.
6. Both PR #71's preview and the older PR #56 preview used during UAT contain the read-only guard.

## Release boundary

The Budget audit-trigger migration is tested but is not active in production until the authorized release is merged and its migrations are deployed. PR #71 remains unmerged. The release, production migration, Seating replacement, and 230-seat production data operation remain unauthorized by this incident investigation.