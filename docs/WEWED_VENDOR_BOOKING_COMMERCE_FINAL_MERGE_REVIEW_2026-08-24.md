# Wewed Vendor Booking Commerce — Final Merge Review

**Canonical plan:** `WW-BOOKING-COMMERCE-2026-08-24-01`  
**PR:** #184  
**Branch:** `feat/vendor-booking-commerce-ai-referral`  
**Review date:** 2026-08-24  
**Review posture:** Final independent hardening pass before authorized merge.

## Fresh-review findings

The previous release qualification was not accepted as sufficient evidence by itself. A new inspection of the highest-risk commercial, availability, funding-truth, contract, capacity and AI authorization paths found three merge-blocking issues that were not caught by the prior green matrix.

### 1. Booking-created Planner Vendor payment truth

**Finding:** `ensureVendor()` created Planner `Vendor` rows with `paymentStatus='pending'` even though the canonical Planner payment state defaults to `unpaid`. Booking creation must never imply payment progress.

**Hardening:** booking-created Vendor rows now start with `paymentStatus='unpaid'`; `contractStatus='pending'` remains separate. Source-contract coverage rejects the old `pending/pending` combination.

### 2. Past booking windows without minimum-notice configuration

**Finding:** the deterministic availability engine only rejected past starts as a side effect of `minNoticeMinutes`. A provider with no configured notice window could therefore receive a past window as policy-valid.

**Hardening:** all deterministic booking windows now fail closed with `PAST_BOOKING_WINDOW` when `startsAt < now`, independently of provider notice policy. Runtime regression coverage exercises this case.

### 3. AutoBook total-open commitment race

**Finding:** `maxTotalOpenCents` was checked by reading current open bookings before draft creation. Two concurrent AI actions could both pass that read and exceed the same wedding-wide commitment cap.

**Hardening:** a private `AutoBookBudgetReservation` boundary now serializes AutoBook commitment authorization by wedding with a PostgreSQL transaction advisory lock. The server:

- validates the exact active policy revision and expiry;
- sums current non-terminal bookings plus active short-lived reservations;
- atomically reserves the proposed amount before creating a draft;
- consumes the reservation onto the created booking;
- releases it if draft creation fails;
- denies direct `PUBLIC`, `anon`, and `authenticated` access;
- continues to prohibit AI contract acceptance and payment.

The function accepts the `BIGINT` parameter type emitted by Prisma while enforcing the established INTEGER-cent storage boundary.

## Regression evidence added

The dedicated Booking Commerce contracts now assert:

- serialized gown contention cannot double-book capacity 1;
- quantity rental contention cannot exceed pool capacity;
- package component capacity remains deterministic;
- past booking windows fail with `PAST_BOOKING_WINDOW`;
- two concurrent AutoBook reservations of 6,000 cents against a 10,000-cent wedding cap produce exactly one reservation and one `total_limit` rejection;
- booking-created Planner Vendors use `unpaid` payment truth;
- the AutoBook execution path uses the database reservation boundary and detects policy revision changes.

## Release decision

No merge is permitted from this document alone. The exact repository head containing these fixes must still pass the full PR workflow matrix, clean PostgreSQL migration/drift checks, Booking Commerce runtime contracts, production build/browser gates, exact-SHA Vercel preview, branch-drift check, unresolved-review check and final infrastructure advisory review.

Shandy-specific scenarios that require vendor-owned prices, variants, stock, availability, deposits or operational facts remain data-readiness checks and must not be satisfied through fabricated data.
