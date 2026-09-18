# Charity & Kudzie Native ↔ Live Parity Ledger

**Document ID:** `WW-NATIVE-PARITY-LEDGER-2026-09-18-01`  
**Parent Directive:** `WW-NATIVE-CHARITY-KUDZIE-REAL-SHADOW-2026-09-18-01`  
**Reference Wedding ID:** `cmqos70cb0004q6vxe9g9aiu5`  
**Reference Wedding Slug:** `charity-and-kudzie`  
**Status:** AUTHORITATIVE AUDIT BASELINE  
**Security Classification:** RESTRICTED / PSEUDONYMIZED REFERENCE SAFE  

---

## 1. Executive Summary & Purpose

This ledger documents the exact parity status between the **current synthetic Shadow mobile implementation** and the **verified production-derived Charity & Kudzie wedding graph**. 

Prior to this audit, native Shadow mode relied on synthetic scaffolding (e.g., 92 guests, 38/47 tasks, $18.4k / $20k budget, 9 vendors, 24 timeline events). This document records the real production graph and provides the concrete migration targets required before native repository wiring begins.

---

## 2. Core Identity & Operational Context

| Dimension | Current Synthetic Shadow | Production-Derived Reality (`cmqos70cb0004q6vxe9g9aiu5`) | Action / Parity Target |
|---|---|---|---|
| **Wedding Title** | Charity & Kudzie | Charity & Kudzie | **Preserve** |
| **Wedding Slug** | `charity-and-kudzie` | `charity-and-kudzie` | **Preserve** |
| **Wedding Date** | `pending-production-discovery` / `Upcoming wedding` | `2026-12-23 14:00:00` (Raw DB timestamp without TZ) | **Replace** placeholder with actual date |
| **Timezone** | `Africa/Harare` (implied) | `Africa/Harare` | **Preserve & verify** |
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

| Operational Domain | Current Synthetic Shadow (`FixturePlannerDashboardRepository`) | Actual Production-Derived Graph | Delta / Transformation Required |
|---|---|---|---|
| **Planner Tasks** | Total: 47<br>Completed: 38<br>In Progress: 5<br>To Do: 4 | **Total: 42**<br>• Done: 7 (High: 4, Med: 2, Low: 1)<br>• In Progress: 3 (High: 1, Low: 2)<br>• To Do: 32 (High: 8, Med: 15, Low: 9) | **Replace** task list with 42 real tasks, real status/priority distributions, and categories. |
| **Task Completion & Health** | Hardcoded Readiness Score `78%` | **Task Completion Ratio:** 7 done / 42 tasks = `16.7%`<br>**Planning Health Score:** `TBD` until documented algorithm is defined. | **Replace** hardcoded 78% with documented algorithmic health calculation. |
| **Budget Items** | Total: 4 categories / $20k budget ($18.4k allocated, $13.5k paid in repo; $18.4k in dashboard) | **Total: 22 items**<br>• Estimated Total: `$30,380`<br>• Actual Total: `$8,690`<br>• Paid Total: `$3,875` | **Replace** with 22 production budget line items and actual cost allocations. |
| **Guest Contributions** | Synthetic Honeyfund ($3,200) | **0 rows** in `GuestContribution` (monetary/memory) | **Align** to 0 monetary contributions / memory-first schema. |
| **Vendors** | 9 Synthetic Vendors (dashboard) / 4 in repo | **7 Vendors** | **Replace** with 7 production vendor records. |
| **Service Engagements** | 9 Synthetic Engagements | **8 Service Engagements** | **Replace** with 8 real service engagements. |
| **Contracts** | Synthetic templates | **0 Active Contracts** in `Contract` (governed via ServiceEngagements) | **Align** contract state to draft/unbound. |
| **Guests Roster** | Total: 92 (dashboard) / 4 synthetic in repo<br>Attending: 68<br>Pending: 18<br>Declined: 6 | **Total: 174**<br>• Attending: 2<br>• Pending: 172<br>• Declined: 0<br>• Checked In: 1 | **Replace** with 174 guests (2 attending, 172 pending). |
| **Seating Tables** | 10 Tables (84 / 92 assigned in dashboard; Jacaranda/Baobab in repo) | **8 Tables (Capacity: 64)**<br>• Table 1 (Family): 7/8<br>• Table 2 (Family): 4/8<br>• Table 3 (Bridal Party): 5/8<br>• Table 4 (Bridal Party): 0/8<br>• Table 5 (Friends): 2/8<br>• Table 6 (Friends): 1/8<br>• Table 7 (Colleagues): 2/8<br>• Table 8 (VIPs): 1/8<br>**Total Assigned: 22 / 64** | **Replace** with 8 tables, 64 total capacity, 22 assigned guest records. |
| **Programme / Timeline** | 24 Synthetic Events (dashboard) / 4 in repo | **13 Programme Items** | **Replace** with 13 chronological timeline milestones. |
| **Vault Objects** | Synthetic media items | **0 rows** | **Align** to 0 media archive objects. |
| **Notifications** | Synthetic feed | **0 rows** | **Align** to 0 notification events. |

---

## 5. Security, Secrets & Privacy Boundary

1. **Database Access Method:**
   - Dedicated Read-Only User Role: `wewed_shadow_reader` (`transaction_read_only = on`, `any table write privilege = false`).
   - Read Replica: `NO / NOT USED` (Direct read-only role on database).
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
   - `NOT YET CREATED` — Pending explicit review and approval of this ledger and private snapshot before native repository transformation.

---

## 6. Implementation Prerequisites Checklist

- [x] Production read-only role proven (`wewed_shadow_reader`, `transaction_read_only = on`).
- [x] Reference wedding uniquely identified (`cmqos70cb0004q6vxe9g9aiu5`).
- [x] Quarantined duplicate identified (`cmsgqh26w0002js04nh627i20`).
- [x] Planner relationship documented (via `PlannerEnquiry` / `PlannerProfile`).
- [x] Domain count audit completed (`GuestContribution` = 0, `Contract` = 0).
- [x] Parity Ledger corrected and established.
- [x] Private row-level snapshot generated (`charity-kudzie-production-derived-snapshot.json`).
- [x] Manifest validated against schema (`validate_shadow_material.py`).
- [x] Deep value-level secret and PII scan clean (0 findings).
- [ ] Review before native repository rewiring.
