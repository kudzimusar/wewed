# Budget data incident and recovery — 2026-08-04

## Scope

Wedding: `cmqos70cb0004q6vxe9g9aiu5` — Charity & Kudzie.

This report records the investigation into the apparent Budget regression observed while planner worksheet and Seating previews were being tested against the shared live database.

## Findings

### No real Budget rows were deleted

- The original 14 Budget rows remain present.
- Three real rows created by the user on 2026-08-03 remain present:
  - Candles, holders, lights
  - Wedding Planner
  - Rings and Jewellary
- The separate Budget worksheet UAT row was temporary test data and was removed through its controlled cleanup.

### The 2026-08-03 row edits were intentional user edits

The 14 original rows have individual `updatedAt` timestamps spanning the user's Budget editing session on 2026-08-03. The saved actual and paid values were written one row at a time through the planner interface. They must not be replaced by the older seed values.

The intended post-edit totals are:

- 17 items
- USD 31,820 estimated
- USD 6,940 actual
- USD 1,850 paid
- USD 5,090 outstanding

### One confirmed agent-caused overwrite occurred

At 2026-08-04 01:53:37 UTC, an engineering restoration linked the Imba Manor vendor to Budget item `cmqpub1ef002dnysp86zt265b` and also set:

- `paidAmount` to `0`
- `notes` to `Linked to the restored Imba Manor venue record. No payment recorded as of 2026-08-04.`

The business-account and payment tables did not contain evidence supporting that no-payment assertion. The operation therefore overwrote a known USD 1,500 venue deposit and inserted a synthetic note.

### Recovery performed

At 2026-08-04 13:42:45 UTC, a wedding-scoped transaction restored only the confirmed damaged fields:

- `paidAmount`: `0` → `1500`
- `notes`: synthetic no-payment note → `NULL`

The transaction preserved:

- the user's USD 2,400 actual venue cost;
- the USD 4,500 estimate;
- the valid Imba Manor vendor ID and name;
- all other Budget rows and user-entered values.

AuditEvent `audit-budget-venue-reconcile-20260804` contains the exact before and after snapshots.

A later idempotent agent-side write advanced the venue row's `updatedAt` timestamp without changing any stored financial value, note, row count, or normalized Budget hash. It was not a user edit.

## Verified final state

At the close of the investigation:

- item count: `17`
- estimated total: `31820`
- actual total: `6940`
- paid total: `1850`
- outstanding total: `5090`
- normalized Budget hash: `b863c8f4b52a4da64860e44182b626e6`

## Permanent safeguards in PR #71

1. Migration `20260804144500_budget_item_audit_trigger` records every Budget insert, update, and delete at the PostgreSQL layer, including direct SQL operations.
2. The audit trigger has a clean-PostgreSQL integration test and a dedicated `Budget Data Integrity` workflow.
3. Preview deployments that share live data are read-only at the centralized wedding-permission boundary.
4. Preview mutations return HTTP `423`, code `PREVIEW_WRITE_BLOCKED`, and header `x-wewed-preview-write-blocked: true`.
5. A preview can write only when `WEWED_PREVIEW_WRITABLE_WEDDING_ID` exactly matches an explicitly configured non-production UAT wedding.
6. Both PR #71's preview and the older PR #56 preview used during UAT contain the read-only guard.

## Release boundary

The Budget audit-trigger migration is tested but is not active in production until the authorized release is merged and its migrations are deployed. PR #71 remains unmerged. No Seating replacement or 230-seat production data operation is authorized by this incident recovery.
