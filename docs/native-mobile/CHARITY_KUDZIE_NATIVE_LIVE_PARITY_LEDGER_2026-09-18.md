# Charity & Kudzie Native ↔ Live Parity Ledger

**Document ID:** `WW-NATIVE-PARITY-LEDGER-2026-09-18-01`  
**Parent Directive:** `WW-NATIVE-CHARITY-KUDZIE-REAL-SHADOW-2026-09-18-01`  
**Reference Wedding ID:** `cmqos70cb0004q6vxe9g9aiu5`  
**Reference Wedding Slug:** `charity-and-kudzie`  
**Status:** AUTHORITATIVE AUDIT & AUTHENTIC ROW-LEVEL EXTRACTION COMPLETE  
**Security Classification:** RESTRICTED / PSEUDONYMIZED REFERENCE SAFE  

---

## 1. Executive Summary & Purpose

This ledger documents the exact parity status between the **current synthetic Shadow mobile implementation** and the **authentic production-extracted Charity & Kudzie wedding graph**. 

Prior to this audit, native Shadow mode relied on synthetic scaffolding (e.g., 92 guests, 38/47 tasks, $18.4k / $20k budget, 9 vendors, 24 timeline events). This document records the real production graph, verifies the complete row-level extraction, and defines the migration targets before native repository wiring begins.

---

## 2. Core Identity & Operational Context

| Dimension | Current Synthetic Shadow | Production-Derived Reality (`cmqos70cb0004q6vxe9g9aiu5`) | Action / Parity Target |
|---|---|---|---|
| **Wedding Title** | Charity & Kudzie | Charity & Kudzie | **Preserve** |
| **Wedding Slug** | `charity-and-kudzie` | `charity-and-kudzie` | **Preserve** |
| **Wedding Date** | `pending-production-discovery` / `Upcoming wedding` | `2026-12-23 14:00:00` (Raw DB timestamp without TZ) | **Replace** placeholder with actual date |
| **Timezone** | `Africa/Harare` (inferred) | `UNVERIFIED` (Raw timestamp preserved; timezone pending explicit DB field/config) | **Preserve raw timestamp; do not infer TZ** |
| **Lifecycle** | `before` | `before` | **Preserve** |
| **Venue** | `Reference Venue` | `Imba Manor` | **Replace** with actual venue |
| **Venue City / Country** | `Reference City` / `Zimbabwe` | `Harare, Zimbabwe` | **Replace** with actual city |
| **Duplicate Quarantine** | N/A | `cmsgqh26w0002js04nh627i20` [QUARANTINED DUPLICATE] | **Quarantine / Exclude** |

---

## 3. Governance & Planner Relationship

| Dimension | Current Synthetic Shadow | Production-Derived Reality | Production Integrity Notes & Action |
|---|---|---|---|
| **Planner Context** | Eleven Eleven Testing (Synthetic label) | `Eleven Eleven Testing` (Profile Slug: `tony-the-planner`) | **Verified relationship** |
| **Enquiry Status** | N/A | `accepted_interest` (Responded `2026-08-09 07:13:53.456`, withdrawn `NULL`) | **Record as Enquiry/Profile link** |
| **WeddingMembership** | Assumed Membership | `0 rows` | **Do not invent membership record** |
| **PlannerEngagement** | Assumed Engagement | `0 rows` (public & admin views) | **Do not invent engagement record** |
| **BusinessAccount Integrity** | Assumed direct account | `PlannerEnquiry.plannerBusinessAccountId` populated, but direct `BusinessAccount` lookup returned `0 rows`. | **Document integrity discrepancy; do not mutate production data.** |

---

## 4. Operational Domain Parity Comparison

| Operational Domain | Current Synthetic Shadow (`FixturePlannerDashboardRepository`) | Actual Production-Derived Graph (Authentic Rows) | Delta / Transformation Required |
|---|---|---|---|
| **Planner Tasks** | Total: 47<br>Completed: 38<br>In Progress: 5<br>To Do: 4 | **Total: 42 actual rows**<br>• Done: 7 (High: 4, Med: 2, Low: 1)<br>• In Progress: 3 (High: 1, Low: 2)<br>• To Do: 32 (High: 8, Med: 15, Low: 9) | **Replace** task list with 42 real tasks, real titles, status/priority distributions, and categories from DB. |
| **Task Completion & Health** | Hardcoded Readiness Score `78%` | **Task Completion Ratio:** 7 done / 42 tasks = `16.7%`<br>**Planning Health Score:** `TBD` until documented algorithm is defined. | **Replace** hardcoded 78% with documented algorithmic health calculation. |
| **Budget Items** | Total: 4 categories / $20k budget ($18.4k allocated, $13.5k paid in repo; $18.4k in dashboard) | **Total: 22 actual rows**<br>• Estimated Total: `$30,380`<br>• Actual Total: `$8,690`<br>• Paid Total: `$3,875` | **Replace** with 22 real production budget line items and actual cost allocations. |
| **Guest Contributions** | Synthetic Honeyfund ($3,200) | **4 actual rows** in `GuestContribution` (blessing, wish, funny_story, memory; 0 monetary) | **Align** to 4 memory/story contributions. |
| **Vendors** | 9 Synthetic Vendors (dashboard) / 4 in repo | **7 actual rows** | **Replace** with 7 real production vendor records. |
| **Service Engagements** | 9 Synthetic Engagements | **8 actual rows** | **Replace** with 8 real service engagements. |
| **Contracts** | Synthetic templates | **0 actual rows** in `Contract` (governed via ServiceEngagements) | **Align** contract state to draft/unbound. |
| **Guest / RSVP Invitation-Party Topology** | Total: 92 (dashboard) / 4 synthetic in repo<br>Attending: 68<br>Pending: 18<br>Declined: 6 | **Total: 174 Guest rows (177 Invited Capacity)**<br>• Production Model: `Guest` + 1:1 `RSVP` (`plusOne`, `kidsAttending`, `kidsCount`)<br>• Household Model in Production: `NONE`<br>• Party Size Distribution: `partySize=1`: 173, `partySize=4`: 1<br>• Attending: 2 (1 single guest + 1 party of 4)<br>• Pending: 172<br>• Declined: 0<br>• Checked In: 1 | **Replace** with authentic 174-guest / RSVP invitation-party topology. |
| **Seating Tables** | 10 Tables (84 / 92 assigned in dashboard; Jacaranda/Baobab in repo) | **8 actual rows (Capacity: 64)**<br>• Table 1 (Family): 7/8<br>• Table 2 (Family): 4/8<br>• Table 3 (Bridal Party): 5/8<br>• Table 4 (Bridal Party): 0/8<br>• Table 5 (Friends): 2/8<br>• Table 6 (Friends): 1/8<br>• Table 7 (Colleagues): 2/8<br>• Table 8 (VIPs): 1/8<br>**Total Assigned: 22 / 64** | **Replace** with 8 real tables, 64 total capacity, and 22 real guest seating assignments. |
| **Programme / Timeline** | 24 Synthetic Events (dashboard) / 4 in repo | **13 actual rows** | **Replace** with 13 real chronological timeline milestones. |
| **Vault Objects** | Synthetic media items | **0 rows** | **Align** to 0 media archive objects. |
| **Notifications** | Synthetic feed | **0 rows** | **Align** to 0 notification events. |

---

## 5. Security, Secrets & Privacy Boundary

1. **Database Access Method:**
   - Dedicated Read-Only User Role: `wewed_shadow_reader` (`transaction_read_only = on`, `any table write privilege = false`).
   - Read Replica: `NO / NOT USED` (Direct read-only PostgreSQL role).
2. **Private Snapshot Storage:**
   - Row-level operational structure and values reside strictly at `$HOME/.wewed-shadow/charity-kudzie/` (Permissions `0700`).
   - Zero private raw data or credentials exist in `/Users/shadreckmusarurwa/Project AI/wewed-native-mobile`.
3. **Excluded Elements:**
   - Password hashes, session tokens, cookies, auth grants.
   - Real asymmetric pass signing private keys (WW2).
   - Invitation secret tokens (shadow-only tokens generated for local flows).
   - Contributor/guest phone numbers and emails.
   - Payment secrets, Stripe tokens, webhook signatures.
4. **Git-Safe Derivative:**
   - Generated at `mobile/fixtures/shadow-reference/reference-wedding-sanitized.json`.
   - Verified 100% compliant with sanitization, non-PII, and row-level production truth.

---

## 6. Implementation Checklist

- [x] Production read-only role proven (`wewed_shadow_reader`, `transaction_read_only = on`).
- [x] Reference wedding uniquely identified (`cmqos70cb0004q6vxe9g9aiu5`).
- [x] Quarantined duplicate identified (`cmsgqh26w0002js04nh627i20`).
- [x] Planner relationship documented (via `PlannerEnquiry` / `PlannerProfile`).
- [x] Direct production row-level graph extracted (`Tasks: 42`, `Budget: 22`, `Vendors: 7`, `Engagements: 8`, `Guests: 174`, `Tables: 8`, `Programme: 13`, `Contributions: 4`, `Contracts: 0`).
- [x] Guest / RSVP invitation-party topology calculated (174 guests, partySize=1: 173, partySize=4: 1, total invited capacity: 177).
- [x] Household model in production documented as `NONE`.
- [x] Domain count audit completed (`GuestContribution` = 4, `Contract` = 0).
- [x] Parity Ledger updated with authentic production metadata.
- [x] Row-level vs aggregate reconciliation verified (100% match across all dimensions).
- [x] Private snapshot generated from actual DB query results with provenance (`charity-kudzie-production-derived-snapshot.json`).
- [x] JSON Schema validation passed against `snapshot-manifest.schema.json`.
- [x] Key-name safety scan passed (`validate_shadow_material.py`).
- [x] Value-level secret and PII scan passed (0 findings).
- [x] Git-safe reference fixture generated at `mobile/fixtures/shadow-reference/reference-wedding-sanitized.json`.
- [x] Native iOS Shadow repositories (`ShadowReferenceWeddingRepository.swift`, `ShadowReferencePlannerRepository.swift`) wired with authentic production-derived data.
- [x] Native Android Shadow repositories (`ShadowReferenceWeddingRepository.kt`, `ShadowReferencePlannerRepository.kt`) wired with authentic production-derived data.
- [x] Native unit tests updated and verified (iOS Swift tests 41/41 PASS, Android JUnit tests PASS).
- [x] Maestro E2E flows updated with authentic Charity & Kudzie assertions.

