# Wewed Native Phase-8 Field Classification

**Master plan:** `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01`, **Phase 8 — Achieve feature parity for mature native workspaces**
**Status:** Implementation audit, subordinate to the locked master plan. Not a competing plan. Updated as each domain is wired.

This document classifies every production-reachable native field/surface for the stakeholders in scope (Planner, Couple, Coordinator, Vendor, Admin) as the master plan §8 requires:

- **LIVE** — read from a real server domain, backed by a real persisted model.
- **DERIVED** — computed server-side (or client-side from LIVE inputs only) from real data; never independently recalculated business truth on the client.
- **EMPTY** — a real, reachable surface with a real "nothing here" answer (e.g. no contract exists for this engagement) — not the same as UNSUPPORTED.
- **UNSUPPORTED** — the surface exists in native code/IA but is not wired to any real server domain in this phase; it must say so honestly, never render fixture data.
- **TEST ONLY** — exists only in Shadow/fixture/qualification sources, never reachable from a production build.

For every LIVE/DERIVED row: source model/table, shared server helper, PWA endpoint/domain, native DTO, Android screen, iOS screen.

---

## 1. Planner / 2. Couple / 3. Coordinator

These three share ONE server domain and ONE set of native-safe endpoints (master plan §10: "The
same server-domain model should power Planner and Couple where the business data is genuinely
shared"). The wedding scope and edit permission come entirely from the freshly-resolved grant's
`weddingId`/`permissions[]` (`resolveWeddingPermissions`, wedding-access.ts) — there is no
workspaceKind branch in the route code. A Coordinator's grant carries a narrower permission set
than a Planner/Couple-owner's (no `budget.edit`/`vendors.edit`), so the SAME route already denies a
Coordinator write those roles don't have — see `DEFAULT_ROLE_PERMISSIONS` in `wedding-access.ts`.

| Field/surface | Classification | Model/table | Shared server helper | PWA endpoint | Native DTO | Android screen | iOS screen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Overview: wedding identity + task/guest/budget/vendor/timeline counts | LIVE/DERIVED | `Wedding`, `PlannerTask`, `Guest`+`RSVP`, `BudgetItem`, `Vendor`, `ProgrammeItem` | `resolveNativeGrantContext` | `/api/native/wedding/overview` (new) | `PlannerDashboardSnapshot` (partial — counts only; `attentionItems`/`recentActivity`/`readinessScore` remain UNSUPPORTED) | `RoleWorkspaces.kt` Planner/Couple "Overview" section | `RoleWorkspaces.swift` equivalent |
| Overview: Planner-portfolio (zero wedding) business identity | LIVE | `wewed_admin.BusinessAccount`/`BusinessAccountMember` (via `authority.businessMemberships`) | `resolveProductionAuthority` | `/api/native/wedding/overview` (new, `scopeKind=portfolio` branch) | n/a (no wedding fields) | Planner portfolio landing | iOS equivalent |
| Tasks: title/description/category/status/priority/dueDate/assignee/order | LIVE (read+write) | `PlannerTask` | `@/lib/planner-task-domain` (extracted from `/api/planner/tasks`) | `/api/native/wedding/tasks`, `/api/native/wedding/tasks/[id]` (new) | `PlannerTask` (existing) | `WeddingGraphState`/Tasks section | equivalent |
| Budget: per-item rows + mechanical aggregate (estimated/actual/paid by category) | LIVE/DERIVED | `BudgetItem` | `@/lib/budget-summary` (new; deliberately NOT the funding-attribution engine) | `/api/native/wedding/budget` (new, read-only) | `BudgetSummary`/`PlannerBudgetLine` | Budget section | equivalent |
| Budget: funding attribution (couple/contributor/legacy split), linked contributions, documents | UNSUPPORTED | `wewed_contributions.*` (raw SQL) | `@/lib/contributions/store` (not reused this phase) | `/api/planner/budget` (PWA only) | — | — | — |
| Budget writes (create/edit line items, reclassify funding) | UNSUPPORTED | `BudgetItem` | — | `/api/planner/budget*` (PWA only) | — | — | — |
| Guests: name/side/role/table/RSVP status/checked-in | LIVE | `Guest`, `RSVP`, `SeatingTable` | — (direct Prisma read; no PWA lib extracted, simple read) | `/api/native/wedding/guests` (new, read-only) | `Guest` (existing; `householdName`/`partySize`/`passSerial` are not tracked by this model and must render as absent, never fabricated) | Guests section | equivalent |
| Seating: table name/capacity/assigned guests | LIVE | `SeatingTable`, `Guest` | — (direct Prisma read) | `/api/native/wedding/seating` (new, read-only) | `PlannerSeatingTable` | Seating section | equivalent |
| Timeline: time/title/description/location/order | LIVE | `ProgrammeItem` | — (direct Prisma read) | `/api/native/wedding/timeline` (new, read-only) | `PlannerTimelineEntry` | Timeline section | equivalent |
| Vendors (planning-side): name/category/contractStatus/paymentStatus | LIVE | `Vendor` | — (direct Prisma read) | `/api/native/wedding/vendors` (new, read-only) | `PlannerVendorEngagement` (partial — `bookingStatus`/`nextAction` are not tracked by this model) | Vendors section | equivalent |
| Contributions | UNSUPPORTED | `wewed_contributions.*` | `@/lib/contributions/store` | `/api/planner/contributions*` (PWA only) | `PlannerContributionRecord` | Contributions section (native: honest "unsupported" state) | equivalent |
| Contracts / engagement deal-room | UNSUPPORTED | `Contract`, `ContractVersion`, `ServiceEngagement` | `@/lib/contracts/phase2.ts`/`phase3.ts` | `/api/planner/engagements/[id]/deal-room`, `.../contracts` (PWA only) | — | Contract governance/intelligence sections (native: unsupported) | equivalent |
| Documents / vault | UNSUPPORTED | `VaultObject`/`VaultLink` | `@/lib/vault/*` | various (PWA only) | `PlannerDocumentRecord` | Media archive section (native: unsupported) | equivalent |
| Seating auto-assign, guest bulk-move, timeline reorder, task delete | UNSUPPORTED (writes) | various | `@/lib/planner-*` | `/api/planner/seating/auto-assign` etc. (PWA only) | — | — | — |

## 4. Vendor

| Field/surface | Classification | Model/table | Shared server helper | PWA endpoint | Native DTO | Android screen | iOS screen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Business portfolio identity (name/type/status/onboarding/role) | LIVE | `wewed_admin.BusinessAccount`/`BusinessAccountMember` (via `authority.businessMemberships`) | `resolveProductionAuthority` | `/api/native/vendor/business` (new) | new (business identity block) | Vendor portfolio header | equivalent |
| Catalog items + offerings | LIVE (read-only) | `wewed_booking.ProviderCatalogItem`/variants/media/resources/components, `wewed_admin.ProviderServiceOffering` | `@/lib/booking-commerce` (`catalogForBusiness`, extracted from `/api/vendor/catalog`) | `/api/native/vendor/catalog` (new) | new | `VendorCatalogScreen`-equivalent (rebuilt; see §6) | equivalent |
| Catalog item creation/editing | UNSUPPORTED | same | same | `/api/vendor/catalog` POST (PWA only) | — | — | — |
| Bookings list | LIVE (read-only) | `wewed_booking.Booking`+lines | `@/lib/booking-commerce` (`bookingsForBusiness`, extracted from `/api/vendor/bookings`) | `/api/native/vendor/bookings` (new) | new | Bookings section | equivalent |
| Booking actions (approve/decline/quote/amendments) | UNSUPPORTED | `wewed_booking.Booking`/`BookingAmendment` | `@/lib/booking-governance`, `@/lib/booking-amendments` | `/api/vendor/bookings/[id]/*` (PWA only) | — | — | — |
| Vendor wedding engagement (Phase 6 grant + selected engagement) | LIVE (identity only; already shipped Phase 5/6) | `ServiceEngagement` | `resolveNativeGrantContext`+`requireGrantEngagement` | `/api/native/account/workspace` (Phase 6) | existing | existing engagement picker | equivalent |
| Vendor documents (commercial) | UNSUPPORTED | `VaultLink`/`VaultObject` via `EngagementParty` | `@/lib/vault/vendor-commercial-access` | `/api/vendor/documents*` (PWA only) | — | — | — |
| Vendor wedding-scoped work items beyond the existing engagement identity | UNSUPPORTED (F-3-adjacent) | — | — | — | — | — | — |

## 5. Admin

| Field/surface | Classification | Model/table | Shared server helper | PWA endpoint | Native DTO | Android screen | iOS screen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| System overview: pending-onboarding queue count | LIVE | `wewed_admin.BusinessAccount` | `resolveWewedAdminPermissions`/`hasWewedAdminPermission` (`@/lib/wewed-admin-policy`, same as `requireWewedAdmin`) | `/api/native/admin/overview` (new) | `AdminSystemSnapshot` (extended: real `pendingOnboarding` count in place of the placeholder `weddingsInScope`) | `AdminSystemRepository`/Admin dashboard | equivalent |
| Full overview (billing/support/incidents), client operations, command center, bookings, service engagements, contract intelligence, contributions analytics, account identity, productivity, governance, vault | UNSUPPORTED | various | `requireWewedAdmin` (cookie-only; no native-safe adapter built this phase) | `/api/admin/*` (PWA only) | — | `AdminGovernanceScreen`-equivalent (rebuilt; see §6), other admin sections | equivalent |
| Legacy `User.role='admin'` global-wedding access (F-6) | EXCLUDED (never a grant) | — | `grants.ts` (`legacy_global_admin_wedding_access`) | — | — | — | — |

## 6. Removed/rebuilt P1-N4 fabricated screens

Tracked here per master-plan §16 carry-forward P1-N4 ("fabricated screens compiled into release with no callers... Phase 8 must delete them or rebuild them on live data"). See §9 for disposition.

## 7. Explicitly out of scope for Phase 8 (unchanged)

- Guest RSVP parity — Phase 9.
- Usher/Gate production authority, Gate check-in writes — Phase 10/11.
- WW2 production — Phase 11.
- Native onboarding — later rollout gate.
- Legacy global-admin (F-6) cleanup — Phase 12.
- Deep-link signing/distribution — Phase 13.

## 8. Carry-forward gates tracked, not weakened

- F-3 — Vendor production-link gap (still open; no production Vendor link fabricated by this phase).
- F-4 — production migration committed, not applied.
- F-6 — legacy PWA global-admin hazard (Phase 12).
- `WEWED_SESSION_SECRET` Preview/Production configuration gate (unchanged).

## 9. Implementation status log

**Server (this branch, `backend/native-workspace-parity-phase8-20260922`):**

- New shared helper `src/lib/native-domain-context.ts`: `resolveNativeGrantContext` (bearer session
  + fresh `resolveProductionAuthority` + grant lookup, mirroring `/api/native/account/workspace`),
  `requireGrantPermission`/`requireGrantAdminPermission` (mirror `contextHasPermission`/
  `assertWewedAdminPermission` exactly, reusing the SAME permission vocabulary/derivation), and
  `requireWeddingScope`/`requireGrantEngagement`.
- New native-safe routes: `/api/native/wedding/{overview,tasks,tasks/[id],budget,guests,seating,
  timeline,vendors}`, `/api/native/vendor/{business,catalog,bookings}`, `/api/native/admin/overview`.
- Extracted shared helpers (not duplicated): `src/lib/planner-task-domain.ts` (from the two
  `/api/planner/tasks*` route files, which now import it too), `src/lib/budget-summary.ts` (new,
  mechanical aggregate only), `bookingsForBusiness`/`catalogForBusiness` (extracted from
  `booking-commerce.ts`'s existing `listProviderBookings`/the inline `/api/vendor/catalog` query,
  parameterized by a verified `businessAccountId` instead of the PWA's cookie-session
  pick-one-business `providerBusinessForUser`).
- Disposable-database integration suite: `src/lib/native-domain-context.integration.test.ts` (9
  tests) — valid-grant reads, foreign-wedding/foreign-business denial, revoked-grant denial,
  viewer-gets-nothing, admin-grant-cannot-read-wedding-domain, portfolio-never-fabricates-a-wedding,
  cross-context isolation. All pass; the pre-existing Phase 2/7 disposable-DB suites and the full
  `bun test src` regression are unchanged (850 pass / 36 fail / 8 errors, byte-identical to a
  stashed pre-Phase-8 baseline) — the extraction work incidentally required updating one pre-existing
  source-text assertion test (`planner-stage2-task-assignment.test.ts`) whose literal string check
  moved with the code it was checking; the invariant itself is unchanged and still proven.
- Honest, deliberate scope cut for this pass (see §1–§5 UNSUPPORTED rows): Contributions, Contracts/
  deal-room, Documents/vault, all writes beyond Tasks, and every Admin domain beyond a single real
  count are NOT wired this phase. Each requires either porting a large, delicate engine
  (contributions funding-attribution, contract lifecycle, vault access) or building genuinely new
  native-safe adapters for large PWA routes (900+ lines for `/api/admin/overview` alone) — correctly
  scoping and testing those is a bigger lift than fits safely alongside the rest of this phase's
  required work, and is reported here as remaining work rather than approximated.

**Native (Android/iOS):** in progress — see the completion report for current status.
