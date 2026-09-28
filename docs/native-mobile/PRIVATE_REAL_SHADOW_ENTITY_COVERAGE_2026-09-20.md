# Private Real Shadow — Entity Coverage Inventory

**Document ID:** WW-NATIVE-PRS-COVERAGE-2026-09-20-01
**Status:** EVIDENCE RECORD — analysis only, no production integration
**Snapshot inspected:** `charity-kudzie-private-real-shadow.json`
**Location:** operator-protected local storage (outside Git)
**Manifest sha256:** `ca62cb7709120530934ed9a119dd5e7856e530cd3aece6623f63b78c8a833612`
**Manifest generatedAt:** 2026-09-18T09:50:58Z
**Snapshot mode:** `PRIVATE_REAL_SHADOW`

No snapshot content is reproduced here beyond entity names, counts and non-personal
status enumerations. No guest, couple, planner or vendor personal data is recorded in Git.

---

## 1. Wedding identity spaces (confirmed)

The same real-world wedding has a **different canonical id per environment**. A development
persona therefore denotes an authorized *scenario and actor*, never a wedding id.

| Environment | Canonical `wedding.id` |
|---|---|
| `FIXTURE` | `wed_tariro_shadreck_2026` (offline demo couple — not Charity & Kudzie) |
| `SHADOW` / `SANITIZED_SHADOW` | `shadow_ref_charity_kudzie` |
| `PRIVATE_REAL_SHADOW` | `cmqos70cb0004q6vxe9g9aiu5` |
| `PRODUCTION_READ_VERIFY` / `PRODUCTION` | `cmqos70cb0004q6vxe9g9aiu5` |

**Confirmed from the snapshot:** `wedding.id = cmqos70cb0004q6vxe9g9aiu5`,
`wedding.slug = charity-and-kudzie`.

The development persona's hard-coded id matches **Private Real Shadow and production only**.
It does not match sanitized Shadow or fixture, which is why binding the runtime to the persona
id produced a context no sanitized source could answer for.

---

## 2. PRIVATE_REAL_SHADOW ENTITY COVERAGE

| Entity | Status | Count | Notes |
|---|---|---:|---|
| **Wedding** | PRESENT IN SNAPSHOT | 1 | 12 fields: id, slug, title, venue, venueCity, venueCountry, dateRaw, lifecycle, coupleId, colours, invitationCardStyle |
| **Tasks** | PRESENT IN SNAPSHOT | 42 | status: 32 todo / 3 in_progress / 7 done. **Only 4 of 42 carry a `dueDate`.** |
| **BudgetItems** | PRESENT IN SNAPSHOT | 22 | estimatedCost, actualCost, paidAmount, currency, vendorId, serviceEngagementId |
| **Guests** | PRESENT IN SNAPSHOT | 174 | rsvp: 172 pending / 2 attending / 0 declined. 22 seated, 1 checked in. invited capacity 177 |
| **SeatingTables** | PRESENT IN SNAPSHOT | 8 | capacity 64 total; 22 guest records assigned |
| **ProgrammeItems** | PRESENT IN SNAPSHOT | 13 | time, location, duration, order, icon |
| **Vendors** | PRESENT IN SNAPSHOT | 7 | contractStatus: 4 pending / 2 signed / 1 negotiating; paymentStatus: 4 unpaid / 2 deposit / 1 paid |
| **ServiceEngagements** | PRESENT IN SNAPSHOT | 8 | **7 are `historical_capture` / `record_only` / `historical`; only 1 is `current` + `managed_contract` (`draft`)** |
| **Contributions** | PRESENT — **but not financial** | 4 | type: blessing, wish, funny_story, memory. Fields: guestId, status, privacy, wordCount, charCount, submittedAt. **These are guest-written messages, not money.** |
| **PlannerEngagements** | **ABSENT** | 0 | No engagement entity. `planner.status = accepted_interest`, `planner.profileStatus = suspended`. Provenance: `PlannerEnquiry+PlannerProfile` |
| **WeddingMemberships** | **ABSENT** | 0 | No membership collection of any kind |
| **Vendor memberships / ownership** | **ABSENT** | 0 | Vendors carry no owning user/account; engagement is linked only by `vendorId` |
| **Gate assignments** | **ABSENT** | 0 | No gate entity; gate identity must come from a documented Shadow-only overlay |
| **Coordinator assignments** | **ABSENT** | 0 | Tasks carry `assignee` / `assigneeUserId` only |
| **Messages** | **ABSENT** | 0 | No message or thread collection |
| **Contracts** | PARTIAL | 0 | Key present and provenance-tracked (`production-read-only:Contract`) but **zero records** |
| **Payments** | **ABSENT** | 0 | Only budget `paidAmount` totals; no payment records or queue |
| **Approval queues** | **ABSENT** | 0 | |
| **Support cases** | **ABSENT** | 0 | |
| **Admin accounts** | **ABSENT** | 0 | Only `user` (id, name, role) and `userProfile` for the couple actor |
| **Audit events** | **ABSENT** | 0 | `auditSummary` is a count digest, not an event stream |
| **Documents / Vault** | **ABSENT** | 0 | |
| **Invitations / Pass credentials** | **ABSENT** | 0 | Guests carry **no token, passSerial or email**. Guest credentials are a Shadow-only overlay |
| **Check-in / admission events** | PARTIAL | 1 | Only the `checkedIn` / `checkedInCount` flags on guest records; no admission event log |
| **Couple / User / UserProfile** | PRESENT IN SNAPSHOT | 1 each | Couple actor identity |

---

## 3. Consequences for native implementation

1. **Planner engagement must not be presented as active.** The snapshot has no
   `PlannerEngagement`; the relationship is an *accepted enquiry* against a planner profile whose
   status is `suspended`. Any "Active planner engagement" claim is a fabrication.
2. **Contributions are not money.** The native planner Contributions worksheet models a monetary
   `value`; the production-derived records are guest blessings/wishes/stories/memories. Rendering
   them as financial contributions misrepresents the graph in `PRIVATE_REAL_SHADOW`.
3. **Most service engagements are historical records**, not live managed contracts. Vendor
   workspaces must distinguish `record_only` / `historical_capture` from `managed_contract`.
4. **Due-date driven views are nearly empty by definition.** Only 4 of 42 tasks have a due date,
   so an honest "Overdue" / "Upcoming Deadlines" projection shows very little — which is correct.
5. **Guest credentials do not exist in the snapshot.** Identity binding for the Guest role is a
   documented Shadow-only overlay, and must use the stable id-addressed form
   (`real-pass-<guestId>`) rather than predicate tokens such as "first attending guest".
6. **Gate, coordinator, messaging, payments, approvals, cases, audit streams, documents and
   memberships have no Shadow data at all.** Native surfaces for these must render explicit
   unsupported states, never placeholder content.

---

## 4. Safety

- Production remains read-only; this is an inspection record only.
- No snapshot rows, names, contacts or financial values are reproduced in Git.
- No native client writes to production, and no production integration is authorized by this
  document.
