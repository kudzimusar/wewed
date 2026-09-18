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

Prior to this audit, native Shadow mode relied on synthetic scaffolding (e.g., 92 guests, 38/47 tasks, $18.4k budget, 9 vendors, 24 timeline events). This document records the real production graph and provides the concrete migration targets required before native repository wiring begins.

---

## 2. Core Identity & Operational Context

| Dimension | Current Synthetic Shadow | Production-Derived Reality (`cmqos70cb0004q6vxe9g9aiu5`) | Action / Parity Target |
|---|---|---|---|
| **Wedding Title** | Charity & Kudzie | Charity & Kudzie | **Preserve** |
| **Wedding Slug** | `charity-and-kudzie` | `charity-and-kudzie` | **Preserve** |
| **Wedding Date** | 2026-10-24 14:00:00 (Placeholder) | `2026-12-23 14:00:00` | **Replace** with actual date |
| **Lifecycle** | `before` | `before` | **Preserve** |
| **Venue** | Reference Venue / Harare | `Imba Manor` | **Replace** with actual venue |
| **Venue City / Country** | Harare, Zimbabwe | `Harare, Zimbabwe` | **Preserve** |
| **Duplicate Quarantine** | N/A | `cmsgqh26w0002js04nh627i20` [QUARANTINED DUPLICATE] | **Quarantine / Exclude** |

---

## 3. Governance & Planner Relationship

| Dimension | Current Synthetic Shadow | Production-Derived Reality | Production Integrity Notes & Action |
|---|---|---|---|
| **Planner Context** | Eleven Eleven Testing (Synthetic) | `Eleven Eleven Testing` (Profile Slug: `tony-the-planner`) | **Verified relationship** |
| **Enquiry Status** | N/A | `accepted_interest` (Responded `2026-08-09 07:13:53.456`) | **Record as Enquiry/Profile link** |
| **WeddingMembership** | Assumed Membership | `0 rows` | **Do not invent membership record** |
| **PlannerEngagement** | Assumed Engagement | `0 rows` (public & admin views) | **Do not invent engagement record** |
| **BusinessAccount Integrity** | Assumed direct account | `PlannerEnquiry.plannerBusinessAccountId` populated, but direct `BusinessAccount` lookup returned `0 rows`. | **Document integrity discrepancy; do not mutate production data.** |

---

## 4. Operational Domain Parity Comparison

| Operational Domain | Current Synthetic Shadow | Actual Production-Derived Graph | Delta / Transformation Required |
|---|---|---|---|
| **Planner Tasks** | Total: 47<br>Completed: 38<br>In Progress: 5<br>To Do: 4 | **Total: 42**<br>• Done: 7 (High: 4, Med: 2, Low: 1)<br>• In Progress: 3 (High: 1, Low: 2)<br>• To Do: 32 (High: 8, Med: 15, Low: 9) | **Replace** task list with 42 real tasks, real status/priority distributions, and categories. |
| **Planning Health** | Hardcoded `78%` | **Derived Metric:** 7 done / 42 tasks = `16.7%` task completion (or weighted algorithm based on high-priority overdue) | **Replace** hardcoded 78% with algorithmic health calculation. |
| **Budget Items** | Total: 18 items<br>Estimated: $18,400<br>Actual: $14,200<br>Paid: $11,500 | **Total: 22 items**<br>• Estimated Total: `$30,380`<br>• Actual Total: `$8,690`<br>• Paid Total: `$3,875` | **Replace** with 22 production budget line items and actual cost allocations. |
| **Guest Contributions** | Synthetic honeyfund ($3,200) | `0 rows` (or private memory submissions) | **Align** to 0 monetary contributions / memory-first schema. |
| **Vendors** | 9 Synthetic Vendors | **7 Vendors** | **Replace** with 7 production vendor records. |
| **Service Engagements** | 9 Synthetic Engagements | **8 Service Engagements** | **Replace** with 8 real service engagements. |
| **Contracts** | Synthetic templates | **0 Active Contracts** (governed via ServiceEngagements) | **Align** contract state to draft/unbound. |
| **Guests Roster** | Total: 92<br>Attending: 68<br>Pending: 18<br>Declined: 6 | **Total: 174**<br>• Attending: 2<br>• Pending: 172<br>• Declined: 0<br>• Checked In: 1 | **Replace** with 174 guests (2 attending, 172 pending). |
| **Seating Tables** | 10 Tables (84 / 92 assigned) | **8 Tables (Capacity: 64)**<br>• Table 1 (Family): 7/8<br>• Table 2 (Family): 4/8<br>• Table 3 (Bridal Party): 5/8<br>• Table 4 (Bridal Party): 0/8<br>• Table 5 (Friends): 2/8<br>• Table 6 (Friends): 1/8<br>• Table 7 (Colleagues): 2/8<br>• Table 8 (VIPs): 1/8<br>**Total Assigned: 22 / 64** | **Replace** with 8 tables, 64 total capacity, 22 assigned guest records. |
| **Programme / Timeline** | 24 Synthetic Events | **13 Programme Items** | **Replace** with 13 chronological timeline milestones. |
| **Vault Objects** | Synthetic media items | **0 rows** | **Align** to 0 media archive objects. |
| **Notifications** | Synthetic feed | **0 rows** | **Align** to 0 notification events. |

---

## 5. Security, Secrets & Privacy Boundary

1. **Private Snapshot Storage:**
   - Real operational structure and values reside strictly at `$HOME/.wewed-shadow/charity-kudzie/` (Permissions `0700`).
   - Zero private raw data or credentials exist in `/Users/shadreckmusarurwa/Project AI/wewed-native-mobile`.
2. **Excluded Elements:**
   - Password hashes, session tokens, cookies, auth grants.
   - Real asymmetric pass signing private keys (WW2).
   - Invitation secret tokens (shadow-only tokens generated for local flows).
   - Contributor/guest phone numbers and emails.
   - Payment secrets, Stripe tokens, webhook signatures.
3. **Git-Safe Derivative:**
   - Derivative fixtures committed to repository use pseudonymous identifiers (e.g. `Guest G001` .. `Guest G174`) while preserving exact counts, status distributions, table topologies, and relational integrity.

---

## 6. Implementation Prerequisites Checklist

- [x] Production read-only role proven (`wewed_shadow_reader`, `transaction_read_only = on`).
- [x] Reference wedding uniquely identified (`cmqos70cb0004q6vxe9g9aiu5`).
- [x] Quarantined duplicate identified (`cmsgqh26w0002js04nh627i20`).
- [x] Planner relationship documented (via `PlannerEnquiry` / `PlannerProfile`).
- [x] Domain count audit completed.
- [x] Parity Ledger established.
- [ ] Private snapshot generated and validated with `validate_shadow_material.py`.
- [ ] Review before native repository rewiring.
