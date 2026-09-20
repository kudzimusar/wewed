# Private Real UAT Coverage V2

**Document ID:** WW-NATIVE-PRIVATE-REAL-UAT-COVERAGE-V2-2026-09-20-01
**Status:** EVIDENCE RECORD — read-only discovery, no production writes
**Supersedes the narrow reading of:** `PRIVATE_REAL_SHADOW_ENTITY_COVERAGE_2026-09-20.md`
**Discovery credential:** `wewed_shadow_reader` — `default_transaction_read_only=on`, `CREATE TABLE` refused
**Wedding:** `cmqos70cb0004q6vxe9g9aiu5` (Charity & Kudzie)

No private values appear in this document. Counts, domain names and statuses only.

---

## 1. Correction to the previous interpretation

The September-18 snapshot was treated as a statement of what production contains. It is not — it
is a partial export. Production holds real rows for several domains previously recorded as absent
or unsupported:

| Domain | Previously recorded | Production truth |
|---|---|---|
| AuditEvent | "zero complete audit stream" | **275 rows** for this wedding (359 platform-wide) |
| Message | "no message contract" | **3 rows** (type `wall`, all public) |
| WeddingContent | not inventoried | **107 rows** across 12 sections |
| Song | not inventoried | **27 rows** |
| ImportJob | "no import history" | **40 rows** |
| QRDestination | not inventoried | **1 row** |
| EngagementParty | not inventoried | **3 rows** |
| ContentRevision | not inventoried | **7 rows** |
| RSVP | folded into Guest | **175 rows** (guest-scoped) |
| Guest | 174 | **175** — the snapshot was one short |

`ABSENT_FROM_CURRENT_SNAPSHOT` and `GENUINELY_UNSUPPORTED` are therefore not equivalent, and this
document keeps them apart.

---

## 2. Domain reconciliation

`P` = production rows · `S` = rows in the refreshed protected UAT snapshot · `N` = native repository support

| Domain | P | S | N | Android UI | iOS UI | Classification |
|---|--:|--:|---|---|---|---|
| Wedding | 1 | 1 | yes | yes | yes | PRODUCTION_DATA_EXISTS |
| Guest | 175 | 175 | yes | yes | yes | PRODUCTION_DATA_EXISTS |
| RSVP | 175 | 175 | partial (status only) | partial | partial | NATIVE_ADAPTER_GAP — dietary notes, meal choice, plus-one, song requests unused |
| PlannerTask | 42 | 42 | yes | yes | yes | PRODUCTION_DATA_EXISTS |
| BudgetItem | 22 | 22 | yes | yes | yes | PRODUCTION_DATA_EXISTS |
| GuestContribution | 4 | 4 | yes | yes | yes | PRODUCTION_DATA_EXISTS — non-monetary, contributor identity resolves |
| SeatingTable | 8 | 8 | yes | yes | yes | PRODUCTION_DATA_EXISTS — 22 seated, 0 orphans |
| ProgrammeItem | 13 | 13 | yes | yes | yes | PRODUCTION_DATA_EXISTS |
| Vendor | 7 | 7 | yes | yes | yes | PRODUCTION_DATA_EXISTS |
| ServiceEngagement | 8 | 8 | yes | yes | yes | PRODUCTION_DATA_EXISTS — 7 historical, 1 current |
| EngagementParty | 3 | 3 | no | no | no | NATIVE_ADAPTER_GAP |
| Song | 27 | 27 | no | no | no | NATIVE_ADAPTER_GAP — songbook |
| WeddingContent | 107 | 107 | no | no | no | NATIVE_ADAPTER_GAP — Our Story, Gallery, Venue, FAQ, Travel, The Day |
| ContentRevision | 7 | 7 | no | no | no | NATIVE_ADAPTER_GAP |
| Message | 3 | 3 | no | no | no | NATIVE_ADAPTER_GAP — Live Wall messages |
| ImportJob | 40 | 40 | no | no | no | NATIVE_ADAPTER_GAP — Recent Imports |
| QRDestination | 1 | 1 | no | no | no | NATIVE_ADAPTER_GAP — Invitations & QR |
| AuditEvent | 275 | 275 | no | no | no | NATIVE_ADAPTER_GAP — Admin Audit |
| PlannerEnquiry | 1 | 1 | partial | partial | partial | PRODUCTION_DATA_EXISTS |
| PlannerProfile | 1 | 1 | partial | partial | partial | PRODUCTION_DATA_EXISTS |
| MediaItem | 0 | 0 | no | honest empty | honest empty | PRODUCTION_ZERO_ROWS |
| Contract / ContractVersion | 0 | 0 | no | honest empty | honest empty | PRODUCTION_ZERO_ROWS |
| Comment | 0 | 0 | no | — | — | PRODUCTION_ZERO_ROWS |
| Notification | 0 | 0 | no | — | — | PRODUCTION_ZERO_ROWS |
| VaultObject / VaultLink | 0 | 0 | no | honest empty | honest empty | PRODUCTION_ZERO_ROWS |
| Reminder | 0 | 0 | no | — | — | PRODUCTION_ZERO_ROWS |
| PlannerEngagement | **0** | 0 | n/a | stated explicitly | stated explicitly | PRODUCTION_ZERO_ROWS — relationship is `accepted_interest` |
| WeddingMembership | **0** | 0 | n/a | — | — | PRODUCTION_ZERO_ROWS |
| SupportCase | ? | — | no | unsupported | unsupported | **NOT_AUTHORIZED** for this reader |
| BusinessAuditLog | ? | — | no | — | — | **NOT_AUTHORIZED** |
| PlannerShortlist | ? | — | no | — | — | **NOT_AUTHORIZED** |
| ProviderEnquiry | ? | — | no | — | — | **NOT_AUTHORIZED** |
| BusinessAccount | 0 visible | — | no | — | — | NOT_AUTHORIZED / row-filtered |

### WeddingContent sections (107 rows)

`venue` 25 · `theday` 18 · `faq` 10 · `guests` 10 · `story` 9 · `hero` 6 · `vendors` 6 ·
`gallery` 6 · `songbook` 5 · `travel` 5 · `memory` 4 · `after` 3

This is the couple's real Our Story / Gallery / Venue / FAQ content. It is the single largest
native adapter gap.

---

## 3. Actor contexts

| Actor | Status | Evidence |
|---|---|---|
| **Couple — Charity & Kudzie** | VERIFIED | wedding id and couple graph resolve; real identities render in both runtimes |
| **Planner — Eleven Eleven Testing** | PARTIALLY VERIFIED | real `PlannerProfile` (`uat-planner-profile-eleven-eleven`, status `suspended`, teamSize 300, completedWeddings 40) and real `PlannerEnquiry` (`accepted_interest`) resolve. The referenced `BusinessAccount` is **not visible** to this reader, so business-account fields, team records and planner messages could not be discovered. |
| **Admin — real corporate administrator** | NOT VERIFIED | 4 users with `role='admin'` exist and are discoverable, but `SupportCase`, `BusinessAuditLog` and `BusinessAccount` are not readable by this credential. The Admin UAT graph cannot be assembled without a broader authorized read-only grant. |

---

## 4. Identity fidelity (measured, not asserted)

Checked without printing any value:

| Check | Result |
|---|---|
| Snapshot guests matching `Guest G###` | **0** |
| Snapshot distinct guest names | 173 of 174 |
| Snapshot vendors with generic names | **0** |
| Contributions resolving a real `guestId` | **4 of 4** |
| Android runtime (`PRIVATE_REAL_SHADOW`) pseudonyms visible | **0** |
| iOS runtime (`PRIVATE_REAL_SHADOW`) pseudonyms visible | **0** |

The `Guest G###` values seen in earlier evidence came from **Sanitized Shadow**, which is the
committed-CI lane and is expected to use pseudonyms.

---

## 5. Refresh procedure

`mobile/shadow/tools/extract_private_real_uat_snapshot.py` makes the export repeatable:

```
READ-ONLY PRODUCTION
  -> extract authorized UAT graph   (every statement inside BEGIN TRANSACTION READ ONLY)
  -> schema validation              (absence vs not-authorized distinguished per domain)
  -> secret scan                    (refuses to write if secret-like material is found)
  -> relationship integrity audit   (orphan contributions / orphan seating)
  -> protected local snapshot + manifest (mode 600, outside the repository)
```

The script refuses to write anywhere inside the repository. Provisioning to devices uses
`mobile/shadow/tools/provision_private_real_shadow.sh`.
