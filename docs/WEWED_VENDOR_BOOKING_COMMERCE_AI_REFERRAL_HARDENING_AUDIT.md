# Wewed Vendor Booking Commerce / AI / Referral — Hardening Audit

**Canonical plan:** `WW-BOOKING-COMMERCE-2026-08-24-01`  
**Acceptance source:** `docs/WEWED_VENDOR_BOOKING_COMMERCE_AI_REFERRAL_PLAN.md`  
**PR:** #184 — `feat/vendor-booking-commerce-ai-referral`  
**Audit baseline head:** `f82af6cb1a6a6ef976b3b3bd21d2ace31921a8d0`  
**Release posture:** **DRAFT / NOT MERGE-READY** until all code-controlled gates below are PASS and every data-dependent Shandy gate has explicit verified evidence or is recorded as an external readiness blocker without fabricated data.

## Status legend

- **PASS** — implemented and evidence exists on the exact qualified head.
- **PARTIAL** — implementation exists but does not yet satisfy the full canonical plan.
- **MISSING** — required by the canonical plan and not yet implemented.
- **BLOCKED-DATA** — code path can be qualified generically, but Shandy-specific proof requires verified vendor-entered facts that Wewed must not invent.
- **PENDING-EVIDENCE** — implementation appears present but exact-head automated/manual evidence is not yet complete.

## 1. Non-negotiable invariants

| Requirement | Baseline status | Evidence / gap | Release action |
|---|---|---|---|
| One generic booking engine; no Shandy-specific runtime logic | PASS | Shandy activation is data-only catalogue seeding; runtime uses generic catalogue/booking services. | Preserve. |
| Booking is separate from payment/funding truth | PASS | Booking confirmation creates no payment or contribution records. Budget note explicitly states no payment/funding inference. | Add read-only payment/contribution convergence to My Bookings. |
| Couple/wedding is customer-of-record; actor is separate | PASS | Booking stores `customerUserId` and `createdByUserId`; API resolves canonical wedding couple for planner-on-behalf booking. | Add invariant regression test. |
| AI cannot accept contract terms or make payment | PASS | AutoBook policy DB checks hard-disable contract acceptance/payment; governed contract effectivity remains authoritative. | Add DB/API negative tests. |
| Quote-only services cannot become confirmed without quote acceptance | PASS | `BookingQuote`, accepted quote FK, DB confirmation guard. | Harden quote immutability/history. |
| Contract-required services cannot become confirmed without canonical effectivity evidence | PASS | DB confirmation guard checks `ContractVersionEffectivity`; booking service creates only draft contract/requirements. | Add insert-path DB guard and regression test. |
| Resource capacity cannot be exceeded by overlapping reservations | PARTIAL | Advisory/row locks + allocation capacity trigger exist; governed allocator accounts for existing overlap. Dedicated concurrent integration proof is still missing. | Add clean-Postgres concurrency contract. |
| Historical commercial/audit evidence is append-only | PARTIAL | Contract evidence is append-only; booking events/amendments/quotes still need DB immutability guards. | Add hardening migration. |

## 2. Plan phase matrix

### Phase 0 — contracts and invariants

**Status: PARTIAL**

Present:
- Booking statuses/modes/archetypes are declared.
- Customer/actor and booking/contract/payment separation are implemented.
- Referral attribution and AutoBook policy tables exist.

Gaps:
- No executable booking-specific state-machine contract yet.
- No dedicated role/actor/customer invariant test.
- Legacy mutation exports remain in `booking-commerce.ts` beside governed mutations in `booking-governance.ts`, creating two service paths even though routes currently use the governed path.

Required closure:
1. Collapse commercial mutations onto `booking-governance.ts` and remove/deprecate unreachable legacy mutation exports.
2. Add booking source contract + PostgreSQL state/invariant contract.

### Phase 1 — catalogue and media

**Status: PARTIAL**

Present:
- `ProviderCatalogItem`, variants, media, resources.
- Vendor UI supports item, size/colour/SKU variant, resource, image/video.
- Public product detail/gallery and stable item slugs.
- Progressive catalogue path works without requiring full inventory for quote/request services.

Gaps:
- Add-ons remain item JSON rather than first-class resource-aware records.
- No package-component booking model that can reserve/check every package component.
- Vendor UI lacks structured cancellation/refund policy, lead-time/service-area controls, booking horizon/duration, buffers, delivery windows, and complete blackout management surface.
- Condition/maintenance fields are not first-class operational inventory history.

Required closure:
1. Add resource-aware catalogue add-on/package-component model or explicitly bind existing canonical provider packages to bookable components.
2. Expose the required availability/policy controls in provider UX.
3. Add structured commercial/cancellation terms to the public booking surface.

### Phase 2 — availability and holds

**Status: PARTIAL**

Present:
- Deterministic resource availability for configured resources.
- Blackouts and before/after buffers.
- Quantity output and reason codes.
- Atomic holds, expiry, idempotency, advisory locking and allocation records.

Gaps:
- Availability response lacks earliest-next-availability and explicit source/version/provenance.
- Operating hours, minimum notice, booking horizon, min/max duration, service area, delivery windows and staff/day capacity are not fully enforced.
- Package component availability is not implemented.
- No dedicated concurrent clean-Postgres test yet.

Required closure:
1. Enforce structured availability policy fields in the same deterministic service used by UI/AI.
2. Add concurrency/capacity/expiry integration tests.
3. Add package-component checking before any package is Instant Book eligible.

### Phase 3 — pricing, requests, quotes and commercial confirmation

**Status: PARTIAL**

Present:
- Deterministic fixed/unit pricing, variant overrides, add-on price snapshot, fees, deposit policy, quote-only state.
- Request/quote/instant flows.
- Vendor quote proposal + explicit customer acceptance.
- Exact booking price snapshot stored.

Gaps:
- Pricing engine does not yet implement the full plan set (hour/day/person/session/km/package/starting-from) as structured deterministic models.
- Quote records need finality/immutability guard.
- Payment milestone creation from confirmed/deposit schedule is not yet linked.
- `BudgetItem.actualCost` is currently created as `0`; because the column is nullable, this risks representing “actual final cost = zero” rather than “actual cost unknown”.

Required closure:
1. Correct Budget semantics to preserve unknown actual cost as NULL.
2. Create canonical payment-milestone hooks only from verified booking/contract terms; never mark paid.
3. Add quote immutability guard and pricing regression contracts.

### Phase 4 — amendments, cancellation, refunds and disputes

**Status: MISSING / PARTIAL**

Present:
- `BookingAmendment` table exists.
- Pre-effective cancellation is governed and releases resources.
- Effective contract changes are rejected from the simple cancellation path.

Gaps:
- No booking amendment propose/review/apply API or UX.
- No append-only amendment history enforcement.
- No post-confirmation governed cancellation/refund flow linking Contract Amendment / payment/refund state.
- No availability and price delta check for amendments.

Required closure:
1. Implement booking amendment proposal, deterministic impact calculation, acceptance and effective timestamp.
2. Route effective-contract material changes through canonical Contract Amendment.
3. Preserve original booking/line snapshots; never destructive-edit historical commercial facts.

### Phase 5 — Planner, Budget, Payments, Contributions, Communications

**Status: PARTIAL**

Present:
- Confirmed booking links to canonical Vendor + `ServiceEngagement`.
- Confirmed booking creates BudgetItem without inferring paid/funded state.
- Deterministic PlannerTask links for service/pickup/return.
- Unified Calendar already projects ServiceEngagement/PlannerTask dates.
- Existing Notification system receives booking states.

Gaps:
- No `PaymentMilestone` hook from booking/contract terms.
- My Bookings does not yet expose canonical managed payment status.
- My Bookings does not yet expose canonical contribution allocations/funding source.
- No `CommunicationEntityLink` from booking/service engagement to contextual conversation.
- No booking-specific requirement-satisfaction record.
- Operational booking DB columns `deliveryAt`, `setupStart`, `setupEnd`, `collectionAt` exist but booking API/UX does not currently populate them.

Required closure:
1. Add read-only payment/contribution summary by ServiceEngagement/BudgetItem and surface it in My Bookings.
2. Add payment milestone hook when a verified deposit/total schedule exists, leaving payment status unpaid.
3. Attach/resolve existing communications conversations through canonical `CommunicationEntityLink` rather than a parallel message store.
4. Wire delivery/setup/collection fields through API/UX/tasks/calendar.

### Phase 6 — Vendor Booking Centre and fulfilment

**Status: PARTIAL**

Present:
- Vendor booking inbox.
- Quote/action/fulfilment status controls.
- Planner booking order book.
- Service/pickup/return tasks.

Gaps:
- No dedicated today/pickup/delivery/return/inspection operations board.
- No condition inspection/photo evidence or inventory maintenance history.
- No shortage/sub-rent workflow.
- No structured damage/deposit dispute handoff.

Required closure:
1. At minimum expose operational dates and explicit fulfilment progression on Vendor Booking Centre.
2. Add resource condition/evidence model or canonical Vault linkage before claiming full rental operations.

### Phase 7 — sharing, QR and referral

**Status: PARTIAL / PENDING-EVIDENCE**

Present:
- Stable provider and product routes.
- Referral tokens and redirect route.
- Provider share UI and QR generation infrastructure.
- Referral opens/booking-start/confirmation events.

Gaps:
- Need full channel/referrer/campaign attribution audit against plan.
- Need product/package/appointment-level share proof.
- Need logged-in wedding-context deep-link proof.
- Need canonical social preview metadata qualification.

Required closure:
- Add exact-head referral attribution tests and manual share/QR UAT.

### Phase 8 — AI Wedding Architect + AutoBook

**Status: PARTIAL / PENDING-EVIDENCE**

Present:
- AI planning remains based on canonical deterministic marketplace plan.
- AutoBook action uses governed booking service.
- Per-booking/open-commitment/category controls exist.
- DB denies AI contract acceptance and payment.

Gaps:
- AutoBook policy is narrower than canonical plan: missing allowed booking modes/providers, deposit cap, explicit hold/request/instant flags, expiry, exclusion reasons, approval/revocation timestamps.
- Need proof that AI consumes the same deterministic availability result as human booking for executable actions.
- Need negative tests for policy expiry/limit/contract/payment/non-refundable cases.

Required closure:
1. Extend AutoBook policy to canonical permission dimensions.
2. Add deterministic guardrail contract and Postgres negative tests.

### Phase 9 — analytics and Admin support

**Status: PARTIAL**

Present:
- Vendor booking/referral analytics API.

Gaps:
- Current item-value aggregation uses `SUM(DISTINCT ...)`, which can undercount two distinct equal-value bookings.
- No Vendor Analytics page on baseline head.
- Analytics do not yet cover full funnel/utilization/lost-stockout/lead-time/cancellation/AI-assisted dimensions.
- No Admin read-only booking support/search/audit surface.

Required closure:
1. Fix aggregation correctness.
2. Add Vendor Analytics UX.
3. Add Admin read-only booking support view.
4. Expand funnel metrics only from authoritative recorded events.

### Phase 10 — Shandy reference configuration and UAT

**Status: BLOCKED-DATA + PENDING-EVIDENCE**

Present:
- Shandy is activated through generic data-only catalogue shells for attire/decor/tents.
- No guessed price, inventory, size, colour, media or availability is seeded.

External readiness blocker:
- Mandatory Shandy gown/chair scenarios requiring exact variants, stock, media, deposits, fitting details, operational buffers and availability cannot be honestly certified until Shandy enters/verifies those facts.

Code qualification still required:
- Use synthetic deterministic test fixtures (not represented as Shandy facts) to prove individual-rental and quantity-rental concurrency, variant, buffer, quote, contract, task, Budget and referral behavior.
- When verified Shandy data exists, execute the canonical 26-scenario reference UAT without code changes or Shandy-specific branches.

### Phase 11 — release qualification

**Status: PENDING-EVIDENCE**

Required exact-head evidence:
- Fresh PostgreSQL complete migration chain.
- Prisma drift check.
- Booking RBAC/cross-tenant isolation.
- Capacity/concurrency/hold expiry.
- Deterministic pricing/quote/contract state transitions.
- Planner/Budget/Payments/Contributions/ServiceEngagement regressions.
- Communications/Notifications regressions.
- AI policy/authorization safety.
- QR/referral/privacy.
- Desktop/mobile customer, planner and vendor UX.
- Existing Wewed CI/e2e suites.
- Production build.
- Vercel preview exact SHA and smoke qualification.
- Supabase security/performance advisors reviewed.
- Main drift review immediately before merge.
- Final closeout evidence recorded in this file or a release report.

## 3. Database integrity findings

### Must fix before merge

1. **Fresh migration failure identified and corrected** — `20260824030400_booking_operations_notifications` referenced the notification helper with the wrong function signature in REVOKE statements. Baseline correction commit: `f82af6cb1a6a6ef976b3b3bd21d2ace31921a8d0`. Exact-head migration rerun remains a release gate.
2. Add append-only/finality guards for `BookingEvent`, `BookingAmendment`, and accepted/final `BookingQuote` evidence.
3. Add confirmation guard for any future insert path that could attempt `status='confirmed'`, not only status updates.
4. Remove duplicate legacy mutation boundary so one governed service is authoritative.
5. Correct Budget actual-cost unknown semantics.
6. Add cross-scope integrity for any new package/add-on/payment/contribution/communication links.

## 4. UX integrity findings

### Customer / couple

- Product gallery/variants/pricing/date/quantity/add-ons/availability/request flow exists.
- Missing full logistics inputs, cancellation/refund policy display, payment/contribution/message/amendment summary and direct “My Bookings” success CTA.

### Planner

- My Bookings + AutoBook controls exist.
- Missing full commercial timeline (quote → contract → payment → contribution), amendments and contextual communications.

### Vendor

- Catalogue + booking inbox exist.
- Missing policy/availability configuration depth, analytics page, rental-condition operations and stronger day-of operational board.

### Admin

- Required booking support visibility is missing from baseline changed files.

## 5. Release decision rule

PR #184 stays **draft** until:

1. Every **MISSING** and code-controlled **PARTIAL** item required for the canonical release scope is either implemented and proven or the canonical plan is explicitly amended in-repo with a reason and impact statement.
2. Every exact-head automated gate is green (infrastructure-only failures must be cleanly rerun).
3. Shandy-specific data-dependent scenarios are either passed with verified vendor data or recorded as **BLOCKED-DATA** with the generic engine independently proven; no fabricated Shandy facts are permitted.
4. Supabase and Vercel release evidence matches the same final branch SHA.
5. Branch drift from `main` is resolved and the final merge candidate is requalified.
