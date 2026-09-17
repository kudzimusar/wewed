# WEWED NATIVE CONTRACT GAP REGISTER & SECURITY CORRECTIONS

**Authority Reference:** `main` @ `2be25d724b51539f4677f2f15050e0deb873922e`  
**Current Contract File:** `mobile/contracts/openapi.yaml`  
**Stale Spec File:** `docs/native-mobile/PROPOSED_BACKEND_INTEGRATION_SPEC.md`  

---

## 1. Critical Security Architecture Blocker: HMAC vs Asymmetric ECDSA

### Finding & Mandate
- **Defect:** `docs/native-mobile/PROPOSED_BACKEND_INTEGRATION_SPEC.md` lines 79–83 states:  
  `POST /api/checkin/verify: Validates HMAC QR payload and records attendance.`
- **Authoritative Contract:** The Wedding Pass cryptographic contract was frozen as **WW2 Asymmetric ECDSA P-256 with SHA-256** (DER / IEEE P1363 signatures). Scanning devices only receive public verification material; gate ushers **cannot** mint valid passes or forge tokens.
- **Action:** `PROPOSED_BACKEND_INTEGRATION_SPEC.md` is officially flagged as **STALE AND BLOCKED**. Under no circumstances will HMAC verification be introduced to production backend routes or native verification routines.

---

## 2. Deficiencies in `mobile/contracts/openapi.yaml`

A line-by-line audit of `mobile/contracts/openapi.yaml` reveals that it does **not** represent the authoritative production backend (`main` @ `2be25d72`):

1. **Missing Vendor Role:**  
   The `Role` schema defines:
   ```yaml
   type: string
   enum: [couple, planner, usher, guest, admin]
   ```
   It completely omits `vendor`, despite production featuring rich vendor presence, vendor catalogs, vendor documents, and vendor bookings.
2. **Missing Entire Production Modules:**
   The following production API families found in `src/app/api/**` on `main` have **zero representation** in `openapi.yaml`:
   - `/api/marketplace/**` (Planner and Vendor marketplace listings, directory, inquiries)
   - `/api/vendor/**` (Catalog, documents, booking analytics, service areas)
   - `/api/planner/contract-intelligence/**` (AI contract risk audit, SLA monitoring)
   - `/api/planner/contracts/**/governance` (Executed contracts vault, amendments, review links)
   - `/api/planner/release-center/**` (Post-wedding archival assets, deliverables)
   - `/api/notebook/**` (Voice recordings, AI transcription readiness, audio notes)
   - `/api/media/archive/**` (High-res CAD floorplans, media vault)
   - `/api/wedding-architect/plan` (AI wedding simulation and conflict resolution engine)
   - `/api/notifications/**` (Push subscriptions, channel preferences)
   - `/api/messages/**` (Dynamic multi-role shared inbox)
   - `/api/royalty/**` (Creator royalties, partner revenue events)
3. **Simplified Planner Contracts:**
   `PlannerTask` in `openapi.yaml` lacks `assignee`, `vendorId`, `checklistItems`, `milestonePhase`.  
   `BudgetSummary` in `openapi.yaml` is a flat summary without transaction history, installments, or funding sources.

---

## 3. Native Decoupling Strategy

To avoid premature integration risks or polluting production schemas:
- The native clients **MUST NOT** rely directly on the current incomplete `openapi.yaml` as an integration bridge.
- The native clients establish **domain-level repository interfaces** backed entirely by deterministic, self-contained domain fixtures.
- When Milestone B (Production Integration) is formally unlocked, a unified whole-product OpenAPI 3.1 contract will be generated directly from the production TypeScript router schemas and Prisma models.

