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
| Tasks: title/description/category/status/priority/dueDate/assignee/order | LIVE (read+write) | `PlannerTask` | `@/lib/planner-task-operations` (`createPlannerTaskOperation`/`updatePlannerTaskOperation`/`togglePlannerTaskOperation` — the ONE shared operation both `/api/planner/tasks*` and `/api/native/wedding/tasks*` call; `@/lib/planner-task-domain` supplies formatting/validation to both) | `/api/native/wedding/tasks`, `/api/native/wedding/tasks/[id]` (new) | `PlannerTask` (existing) | `WeddingGraphState`/Tasks section | equivalent |
| Budget: per-item rows + mechanical aggregate (estimated/actual/paid by category) | LIVE/DERIVED | `BudgetItem` | `@/lib/budget-summary` (new; deliberately NOT the funding-attribution engine) | `/api/native/wedding/budget` (new, read-only) | `BudgetSummary`/`PlannerBudgetLine` | Budget section | equivalent |
| Budget: funding attribution (couple/contributor/legacy split), linked contributions, documents | UNSUPPORTED | `wewed_contributions.*` (raw SQL) | `@/lib/contributions/store` (not reused this phase) | `/api/planner/budget` (PWA only) | — | — | — |
| Budget writes (create/edit line items, reclassify funding) | UNSUPPORTED | `BudgetItem` | — | `/api/planner/budget*` (PWA only) | — | — | — |
| Guests: name/side/role/table/RSVP status/checked-in | LIVE | `Guest`, `RSVP`, `SeatingTable` | — (direct Prisma read; no PWA lib extracted, simple read) | `/api/native/wedding/guests` (new, read-only) | `Guest` (existing; `householdName`/`partySize`/`passSerial` are not tracked by this model and must render as absent, never fabricated) | Guests section | equivalent |
| Seating: table name/capacity/assigned guests | LIVE | `SeatingTable`, `Guest` | — (direct Prisma read) | `/api/native/wedding/seating` (new, read-only) | `PlannerSeatingTable` | Seating section | equivalent |
| Timeline: time/title/description/location/order | LIVE | `ProgrammeItem` | — (direct Prisma read) | `/api/native/wedding/timeline` (new, read-only) | `PlannerTimelineEntry` | Timeline section | equivalent |
| Vendors (planning-side): name/category/contractStatus/paymentStatus | LIVE | `Vendor` | — (direct Prisma read) | `/api/native/wedding/vendors` (new, read-only) | `PlannerVendorEngagement` (partial — `bookingStatus`/`nextAction` are not tracked by this model) | Vendors section | equivalent |
| Contributions: type/amount/commitment/fulfillment/verification state, contributor, allocation | LIVE (read-only) | `wewed_contributions.*` (raw SQL) | `@/lib/contributions/store` (`loadContributionWorkspace` — the SAME engine `/api/planner/contributions` calls; no second funding truth computed anywhere) | `/api/native/wedding/contributions` (new, read-only) | `PlannerContributionRecord` | `ShadowContributionsDestination` — production-reachable as of closure round 3 (see §12; a dispatch-level guard in `RoleWorkspaces.kt`/`.swift` was silently routing production to a static UNSUPPORTED message before this destination's already-real repository call could ever run, so the round-2 "LIVE" classification below was premature — the full chain is genuinely complete now) | equivalent |
| Contribution writes (allocate/mark-thanked/mark-verified/mark-received/create-task) | UNSUPPORTED | `wewed_contributions.*` | `@/lib/contributions/store` | `/api/planner/contributions/[id]/actions` (PWA only) | — | — | — |
| Service engagement list + Deal Room (contract status/versions/parties/payments/linked vault docs) | LIVE (server + native client, read-only — engagement list since closure round 3, Deal Room detail since closure round 4; see §13.3 for the round-3 overstatement this corrects) | `ServiceEngagement`, `Contract`, `ContractVersion` | `listManagedServiceEngagements`/`getServiceEngagementDealRoom` (`@/lib/contracts/phase2.ts` — the SAME functions `/api/planner/engagements/current` and `.../[id]/deal-room` call; zero reimplementation) | `/api/native/wedding/engagements`, `/api/native/wedding/engagements/[id]/deal-room` | `ServiceEngagementSummary`/`ContractSummary` (list, closure round 3); `DealRoomDetail`/`DealRoomVendor`/`DealRoomParty`/`DealRoomContractDetail`/`DealRoomContractVersion`/`DealRoomBudgetItem`/`DealRoomPayment`/`DealRoomDocument` (detail, new closure round 4 — deliberately NOT `PlannerVendorEngagement`, a different legitimate domain; field set mirrors the PWA's own `DealRoomRecord`, nothing invented) | `ContractsRepository`/`ProductionContractsRepository`, folded into the EXISTING "Vendors" destination as a second, clearly-labelled list; each row is now tap-to-expand into its real Deal Room (still not a new IA navigation section — see §12/§13.3) | equivalent |
| Documents / vault | LIVE (read-only) | `VaultObject`/`VaultLink` | `listWeddingVaultObjects` (`@/lib/vault/catalog.ts` — the SAME function `/api/vault` GET calls) | `/api/native/wedding/vault` | `PlannerDocumentRecord` | `ShadowDocumentsDestination` — production-reachable as of closure round 3 (see §12; same dispatch-level guard bug as Contributions above) — a Vendor's own `vendor:wedding:...` grant is explicitly refused (`GRANT_SCOPE_INVALID`), matching the PWA's `requireVaultWeddingAccess` vendor exclusion. A live failure now renders as a distinct "unavailable" state (`ProductionLoadState`/`IASectionUnavailable`), never a fabricated empty list | equivalent |
| Seating auto-assign, guest bulk-move, timeline reorder, task delete | UNSUPPORTED (writes) | various | `@/lib/planner-*` | `/api/planner/seating/auto-assign` etc. (PWA only) | — | — | — |

## 4. Vendor

| Field/surface | Classification | Model/table | Shared server helper | PWA endpoint | Native DTO | Android screen | iOS screen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Business portfolio identity (name/type/status/onboarding/role) | LIVE | `wewed_admin.BusinessAccount`/`BusinessAccountMember` (via `authority.businessMemberships`) | `resolveProductionAuthority` | `/api/native/vendor/business` (new) | `VendorBusinessIdentity` | `ProductionVendorBusinessRepository`/`ProductionVendorBusinessContent` — a `vendor:business` grant now renders this real shell (was the generic minimal snapshot; fixed this pass) | equivalent |
| Catalog items + offerings | LIVE (read-only) | `wewed_booking.ProviderCatalogItem`/variants/media/resources/components, `wewed_admin.ProviderServiceOffering` | `@/lib/booking-commerce` (`catalogForBusiness`, extracted from `/api/vendor/catalog`) | `/api/native/vendor/catalog` (new) | `VendorCatalogItem`/`VendorCatalogOffering` | `ProductionVendorBusinessContent` (rebuilt on live data; the old fabricated `VendorCatalogScreen` was deleted in the original Phase 8 pass) | equivalent |
| Catalog item creation/editing | UNSUPPORTED | same | same | `/api/vendor/catalog` POST (PWA only) | — | — | — |
| Bookings list | LIVE (read-only) | `wewed_booking.Booking`+lines | `@/lib/booking-commerce` (`bookingsForBusiness`, extracted from `/api/vendor/bookings`) | `/api/native/vendor/bookings` (new) | `VendorBooking` | `ProductionVendorBusinessContent` | equivalent |
| Booking actions (approve/decline/quote/amendments) | UNSUPPORTED | `wewed_booking.Booking`/`BookingAmendment` | `@/lib/booking-governance`, `@/lib/booking-amendments` | `/api/vendor/bookings/[id]/*` (PWA only) | — | — | — |
| Vendor wedding engagement identity (Phase 6 grant + selected engagement) | LIVE (identity only; already shipped Phase 5/6) | `ServiceEngagement` | `resolveNativeGrantContext`+`requireGrantEngagement` | `/api/native/account/workspace` (Phase 6) | existing | existing engagement picker | equivalent |
| Vendor's own engagement contract (category/lifecycle status/agreed amount/contract status+version) | LIVE (closure round 3, hardened round 4 §13.2 for same-grant multi-engagement selection, read-only) | `ServiceEngagement`, `Contract` | `getServiceEngagementDealRoom` (SAME function Contracts above and the Planner Deal Room route call) | `/api/native/vendor/engagement` (new — a distinct Vendor-only, wedding-scoped route; `workspaceKind=vendor && scopeKind=wedding` required, engagementId validated via `requireGrantEngagement` against the grant's own `serviceEngagementIds`; closure round 4 — a grant with MORE THAN ONE `serviceEngagementIds` entry and no `engagementId` supplied now fails closed with `422 ENGAGEMENT_SELECTION_REQUIRED` instead of silently auto-selecting `[0]`; auto-select remains only for a genuinely single-engagement grant) | `VendorEngagementDetail` (new, reuses `ContractSummary`) | `VendorEngagementRepository`/`ProductionVendorEngagementRepository`, wired into the EXISTING "Contract" section under Vendor → Jobs (already a defined IA section, previously unconditionally UNSUPPORTED) — `VendorShell` itself is now production-reachable (`AppRole.VENDOR` added to `productionRoleWired`); the production binding is now keyed on `(accessUserId, grantId, engagementId)`, not `(accessUserId, grantId)` alone, and the pre-existing Phase 5/6 engagement picker is reachable again ahead of the shell when a grant requires a selection | equivalent |
| Vendor documents (commercial) | UNSUPPORTED | `VaultLink`/`VaultObject` via `EngagementParty` | `@/lib/vault/vendor-commercial-access` | `/api/vendor/documents*` (PWA only) | — | — | — |
| Vendor wedding-scoped work items beyond engagement identity and contract status (Wedding-Day presence/arrival, deliverables, payment records, files, notes, client/planner contacts) | UNSUPPORTED (F-3-adjacent) | — | — | — | — | — | — |

## 5. Admin

| Field/surface | Classification | Model/table | Shared server helper | PWA endpoint | Native DTO | Android screen | iOS screen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| System overview: pending-onboarding queue count | LIVE | `wewed_admin.BusinessAccount` | `resolveWewedAdminPermissions`/`hasWewedAdminPermission` (`@/lib/wewed-admin-policy`, same as `requireWewedAdmin`) | `/api/native/admin/overview` (new) | `AdminSystemSnapshot.pendingOnboardingCount` | `AdminShell` now reads `appViewModel.adminRepository`, which is `ProductionAdminSystemRepository` once an `admin:system` grant resolves — it used to construct `ShadowAdminSystemRepository` unconditionally even in production (real defect, fixed this pass); an `admin:system` grant now also renders through the real `AdminShell` instead of the minimal snapshot | equivalent |
| Platform analytics summary (business/active/pending-review account counts, open support cases, open incidents, risk signals) | LIVE (closure round 2) | `BusinessAccount`, `SupportCase`, `PlatformIncident`, `PaymentRecord`, `Wedding` | `loadAdminOverview` (`@/lib/admin/overview.ts` — extracted verbatim from `/api/admin/overview` GET, which now calls the same function; per-section reads gated by the SAME `resolveWewedAdminPermissions`/`hasWewedAdminPermission` check) | `/api/native/admin/overview` (extended) | `AdminSystemSnapshot.businessAccountsTotal`/`activeAccountsTotal`/`pendingReviewAccountsTotal`/`openSupportCasesTotal`/`openIncidentsTotal` | `AdminDashboardContent` renders each as its own card, null (not shown) when not fetched | equivalent |
| Client operations: business-account rows (name/type/status/onboarding/risk flags) | LIVE (closure round 2) | `BusinessAccount` | `loadAdminOverview` (same as above) | `/api/native/admin/overview` (extended, `accounts[]`) | `AdminSystemSnapshot.accounts: List<AdminAccountSummary>` | `AdminAccountsSection` now renders real rows (was a static, unconditional UNSUPPORTED message ignoring the repository entirely) | equivalent |
| Governance/support: support cases + platform incidents | LIVE (closure round 2, read-only) | `SupportCase`, `PlatformIncident` | `loadAdminOverview` (same as above), each gated independently by `admin.support.read`/`admin.incidents.read` — currently only ever non-empty for `wewed_super_admin`, since native admin permissions resolve from `platformRoles[0]` alone with no per-membership override threaded through yet (a pre-existing, documented limitation, not new this pass) | `/api/native/admin/overview` (extended, `supportCases[]`/`incidents[]`) | `AdminSystemSnapshot.supportCases`/`incidents` | `AdminCasesSection` (new; was a static unconditional UNSUPPORTED message) | equivalent |
| Command center, bookings, service engagements, contract intelligence, contributions analytics, account identity, productivity, cross-wedding vault browsing | UNSUPPORTED | various | `requireWewedAdmin` (cookie-only; no native-safe adapter built this phase) | `/api/admin/*` (PWA only) | — | listed honestly in `ProductionAdminSystemRepository.unsupportedStreams`, never a fabricated count | equivalent |
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
- Honest, deliberate scope cut for the original pass (see §1–§5 UNSUPPORTED rows): Contracts/
  deal-room, Documents/vault, writes beyond Tasks, and every Admin domain beyond a single real
  count are NOT wired. Each requires either porting a large, delicate engine (contract lifecycle,
  vault access) or building genuinely new native-safe adapters for large PWA routes (900+ lines for
  `/api/admin/overview` alone) — correctly scoping and testing those is a bigger lift than fits
  safely alongside the rest of this phase's required work, and is reported here as remaining work
  rather than approximated. Contributions was originally in this cut list too; it is now LIVE (see
  the closure entry below) because the moderator's review made it an explicit, unambiguous exit
  gate ("Phase 8 cannot finish while Contributions remains merely a native placeholder") and the
  existing `loadContributionWorkspace` engine was directly reusable without new business logic.

### Phase 8 closure (moderator review response)

An independent moderator reviewed the original Phase 8 pass, found and fixed several defects
directly (401/403 code semantics, GRANT_REVOKED vs PERMISSION_DENIED vs resource-404, LIVE-domain
failures no longer masquerading as empty lists, Shadow claims removed from production Planner UI),
and identified the remaining exit gates closed in this follow-up:

- **Shared task mutation domain (§5).** `src/lib/planner-task-operations.ts` is now the ONE
  operation both `/api/planner/tasks*` and `/api/native/wedding/tasks*` call for create/update/
  toggle — the native routes were their own second implementation of this logic before. See §1's
  Tasks row.
- **Contributions (§6).** Now LIVE, read-only, via `/api/native/wedding/contributions` calling
  `loadContributionWorkspace` directly. See §1's Contributions row.
- **Vendor production shell (§A).** A `vendor:business` grant now renders
  `ProductionVendorBusinessContent` (real identity/catalog/offerings/bookings) instead of the
  generic minimal snapshot. See §4.
- **Admin production shell (§B).** `AdminShell` no longer constructs `ShadowAdminSystemRepository`
  unconditionally — production defaults to `ProductionBoundaryAdminSystemRepository` (honest,
  unbound) until a real `admin:system` grant binds `ProductionAdminSystemRepository`, and Admin now
  renders through the real `AdminShell` in production at all (it previously fell through to the
  minimal snapshot unconditionally, same as every other unwired role). See §5.
- **Documents false-empty fix (§11).** `ShadowDocumentsDestination` said "no documents recorded"
  for production, where the repository always returns empty because no adapter exists — now says
  UNSUPPORTED explicitly instead of calling the repository at all. See §1's Documents row.
- **P1-N4 remainder (§10).** Deleted `PlannerDestinations.kt`'s dead `PlannerDestinationRoute` enum
  (zero references anywhere) and 20 zero-caller composables (individually grep-confirmed before
  deletion), several of which hardcoded a "Charity & Kudzie" wedding, an "Eleven Eleven Testing"
  planner, and invented guest/table/contract counts. `GenericToolDestination` (their shared
  renderer) became dead in turn and was removed with them. The 5 that forwarded to a live
  `Shadow*Destination` sibling left those siblings untouched.
- **Still explicitly out of scope, honestly, not silently:** Contracts/deal-room, Documents/vault
  adapters, Budget/Guest/Seating/Timeline/Vendor writes, Contribution write actions, and every
  Admin domain beyond the one real count. Each remains a genuinely separate, substantial engine to
  port safely — see the "Honest, deliberate scope cut" paragraph above.

**Android (branch `native-mobile/workspace-parity-phase8-20260922`):**

- New `NativeDomainApiClient` (reuses the existing `WeddingDayHttpTransport` seam; added `patch()`
  to that interface with a default that throws unless overridden, so the two existing fake test
  transports needed no change).
- New `ProductionWeddingRepository`/`ProductionPlannerDashboardRepository`: real `getWedding`,
  `getTasks`/`createTask`/`toggleTask`, `getGuests`/`searchGuests`, `getBudget`, `getBudgetLines`,
  `getSeatingTables`, `getTimelineEntries`, `getVendorEngagements`. Confirmed by direct inspection
  of `rememberWeddingGraph` that it wraps the whole wedding-graph load in one try/catch with no
  per-field isolation — so `getVendors`/`getAnnouncements`/`getAuditRecords` (required, no-default
  `WeddingRepository` methods, but Wedding-Day concepts unrelated to this phase) return honest
  empty lists rather than throwing, matching the interface's own established "this source holds
  none" idiom; the true Wedding-Day write/identity methods
  (`resolveGuestIdentity`/`checkInGuest`/`updateVendorState`/`postAnnouncement`/`getWeddingPass`/
  `resolveInvitation`/`confirmRsvp`) remain fail-closed since the graph loader never calls them.
- `ProductionAdminSystemRepository`: real `pendingOnboardingCount` (nullable; null on failure, not
  a fabricated zero) alongside the existing honest `unsupportedStreams` list.
- `AppViewModel.repository`/`plannerRepository` are now rebindable
  (`bindProductionRepositories`), mirroring the existing `bindActiveWedding` pattern.
  `RootScreen.kt` reactively rebinds them from the freshly-revalidated `productionWorkspace`
  snapshot's own `grantId`/`weddingId`, and Couple/Planner/Coordinator now render through the SAME
  real `CoupleShell`/`PlannerShell`/`CoordinatorShell` every other environment already uses.
  Vendor/Usher/Admin reaching a wedding-scoped grant still render the Phase 5/6 minimal
  `ProductionReadOnlyWorkspaceContent` snapshot — a deliberate, honestly-reported scope boundary
  for this pass (their server adapters exist and are tested; the native role-shell wiring for them
  is remaining work, not a regression).
- P1-N4: deleted `HomeScreen.kt`, `PlannerScreen.kt`, `GuestsScreen.kt`, `PassScreen.kt` (each
  confirmed zero external callers) and the `MarketplaceDirectoryScreen`/`MasterCalendarScreen`/
  `VendorCatalogScreen`/`AdminGovernanceScreen` functions inside `WholeProductScreens.kt` (same
  file's other functions are still used and were left untouched). These four carried a hardcoded
  "Charity & Kudzie" wedding and invented vendor/compliance data — exactly the §8.13 fabrication
  hazard. The reachable `Shadow*`/`WeddingReference*` equivalents are unchanged and, since they
  already read `appViewModel.plannerRepository`/`repository` directly, now render real production
  data automatically once those are bound. The 20 dead `PlannerDestinationRoute` composables in
  `PlannerDestinations.kt` were NOT removed in this pass (risk of cascading enum-exhaustiveness
  breakage elsewhere was not fully verified under this phase's time budget) — tracked here
  explicitly as remaining P1-N4 cleanup rather than silently left unaddressed.
- New test `ProductionDomainRepositoriesTest` (fake-transport, deterministic): real endpoint calls
  with grantId+bearer, PATCH toggle, Wedding-Day fail-closed vs. honest-empty split, 401 never
  returns fixture data, Budget/Seating/Timeline/Vendor mapping, portfolio grant never fabricates a
  wedding, Admin real count vs. null-on-failure. Full existing unit suite, `assembleDebug` and
  `assembleRelease` all pass unchanged.

**iOS (branch `native-mobile/workspace-parity-phase8-20260922`):** see the completion report for
current status (delegated as a faithful port of the Android change above, given the codebases are
a confirmed 1:1 mirror at every prior phase).

## 10. Independent moderator review — Phase 8 remains open

Independent review was performed against the pushed Phase-8 server/native branches rather than the implementation report alone.

Reviewer closure patches completed before the next implementation pass:

- Native-domain HTTP failures now carry explicit server error codes. 401 is a session-invalid signal; only explicit GRANT_REVOKED/AUTHORITY_UNAVAILABLE responses clear the selected grant; permission denials and resource-level 404 responses do not masquerade as revocation.
- Android/iOS production-domain clients now propagate session invalidation and explicit grant revocation into the existing account-session state instead of collapsing every non-success into a generic repository error.
- LIVE planner/timeline calls no longer convert transport/authority failures into empty collections. "No rows" and "the live call failed" remain distinct states.
- Production-reachable Planner UI no longer carries Shadow-only authorization claims or infers empty attention/activity/Wedding-Day operational streams from unsupported production domains.
- Focused server authority-error tests and Android/iOS transport/repository tests pin those distinctions.

Independent qualification:
- Server reviewer CI at product SHA a0ead1f1bd16e2321b13a82ea4fcc4dc9be4a4e9: PASS (disposable Postgres migrations, Phase-8 domain integration, carried Phase-2/7 authority tests, Guest Session v2/portfolio/projection tests, production build). Temporary workflow was removed; server branch then advanced only by that workflow removal.
- Native reviewer CI at product SHA b34ee8524ca1aa122228a769825e22372faba5a7: PASS (Android unit tests + debug/release assembly; iOS Swift tests/build + generated-project simulator build + unsigned device Release build). Temporary workflow was removed; native branch then advanced only by that workflow removal.

**Phase-8 acceptance: NOT YET. Phase 9 remains closed.**

Remaining Phase-8 exit-gate work:

1. Wire the already-created Vendor business/catalog/bookings production repositories into the actual production Vendor role shell on both platforms; the current role shell still operates from the wedding graph/minimal workspace path.
2. Wire the real Admin system repository into the production Admin role shell on both platforms; the current Admin shell still constructs ShadowAdminSystemRepository.
3. Finish the mature domains explicitly marked UNSUPPORTED above where Phase-8 parity requires them: Contributions/funding attribution, Contracts/deal-room, Documents/vault, and the agreed mature Planner/Couple/Coordinator write surfaces. Reuse the existing PWA/server engines; do not create mobile-only business rules.
4. Move Planner task create/update orchestration itself behind a shared server-domain operation. Phase 8 currently shares validation/formatting constants but still has parallel PWA/native route mutation code.
5. Remove or prove unreachable the remaining P1-N4 dead Planner destination surfaces and re-audit all newly production-reachable role-shell copy for fixture/Shadow assumptions and false-empty states.
6. Preserve F-3, F-4, F-6 and the production/Preview WEWED_SESSION_SECRET gate exactly as carry-forward constraints. Do not weaken authority to make Vendor/Admin UI wiring pass.

## 11. Phase 8 closure round 2 (response to §10)

A second moderator review of the round-1 closure (Vendor shell, Admin shell routing, shared task
operation, Contributions, P1-N4 remainder) accepted that work but held Phase 8 open on: closing
`NativeRepositoryFactory.PRODUCTION`'s remaining non-determinism, connecting Contracts/Deal-Room,
connecting Documents/Vault, completing more of the mature Admin domain, controlled writes, and full
qualification including an actual Xcode simulator + unsigned device Release build (not the SPM
`swift build -c release` substitute used previously). This section records what closed and what is
still honestly open.

**1. `NativeRepositoryFactory.PRODUCTION` closure — a real, previously-latent race, not a
theoretical one.** `bindProductionRepositories`/`bindProductionAdminRepository` ran from a
`LaunchedEffect`/`.task(id:)`, which starts asynchronously relative to the composition that decided
a role shell was eligible to render. Composition itself continues immediately past that effect call
into the shell's own body in the same pass — so the OLD render gate (checking only that the
workspace snapshot looked right) could let `PlannerShell`/etc. begin composing, and its own
`rememberWeddingGraph`/`WeddingGraphState.load` effect fire, while `appViewModel.repository` was
STILL the always-throwing `ProductionBoundaryWeddingRepository` placeholder from construction — an
avoidable, timing-dependent failure flash on ordinary navigation, exactly "a generic boundary
repository underneath a role that appears functional." Fixed by making the bind itself an
observable fact (`AppViewModel.boundProductionGrantId`/`boundAdminGrantId`, `StateFlow`/`@Published`,
flipped only after the repository fields are assigned) and gating the shell render on the CONFIRMED
bind matching the active grant, not on the snapshot alone — showing a brief loading state instead of
the shell for the one frame this can take, never the boundary-backed shell itself. Both platforms;
both platforms carry new unit tests pinning the null-before-bind / set-after-bind / updated-on-rebind
contract directly (`AppViewModelProductionBindingTest.kt` / `AppStateProductionBindingTests.swift`).
The factory itself (`NativeRepositoryFactory.make`) is unchanged — it already returned an honestly
unbound, never-fabricating placeholder; the defect was entirely in the render/bind ordering above it.

**2. Contracts / Deal-Room — connected at the server, deliberately not yet at the client.**
`/api/native/wedding/engagements` and `/api/native/wedding/engagements/[id]/deal-room` now exist,
calling `listManagedServiceEngagements`/`getServiceEngagementDealRoom` directly — the SAME functions
the PWA's `/api/planner/engagements/current` and `.../[id]/deal-room` call, zero reimplementation.
Disposable-DB tests cover valid access, foreign wedding, foreign engagement (404, not a leak),
revoked grant, a Coordinator's equivalent access, an actual denied membership (403
`PERMISSION_DENIED`, not merely "no default role lacks the permission"), the Vendor's OWN
`vendor:wedding:...` grant on that exact engagement being refused (F-3: holding a real Vendor
wedding grant never doubles as Planner/Couple/Coordinator authority), and PWA/native equivalence
(same engagement list, same Deal Room shape, through both transports). What is NOT done: no Android/
iOS repository or UI surface exists for this data. `PlannerVendorEngagement` (the model that would
seem to fit) is already legitimately in use for a DIFFERENT domain — the `Vendor.contractStatus`/
`paymentStatus` planner-tracked fields, not the managed-contract lifecycle — so reusing it would
conflate two real, distinct domains rather than reuse one. Building a new Deal Room screen is a
product-design decision (what should it show, how does a mobile user act on a contract) outside
this closure's "wire existing surfaces to real data" mandate, so it is reported here honestly as
remaining work with a concrete, tested, reusable server foundation already in place — not silently
dropped and not invented under time pressure.

**3. Documents / Vault — connected end to end, both platforms.** `/api/native/wedding/vault` calls
`listWeddingVaultObjects` directly (the same function `/api/vault` GET uses). Android's
`ProductionPlannerDashboardRepository.getDocuments()` and iOS's equivalent now map real rows and
throw (never fabricate empty) on a live failure, matching the estabished Contributions/Budget
precedent exactly. `ShadowDocumentsDestination` no longer special-cases production to a static
UNSUPPORTED message — it calls the repository unconditionally, exactly like every sibling section,
so an empty result is now an honest "no documents recorded" rather than an assumed one. A genuine
defect was caught and fixed before shipping: a Vendor's own `vendor:wedding:...` grant carries
`scopeKind: "wedding"` and a real `weddingId` too (it is a completely different authority axis from
Couple/Planner/Coordinator, per the Production Authority Contract's own grant-mapping table), so
`requireWeddingScope` alone would have incorrectly admitted it to the full wedding Vault — the PWA's
`requireVaultWeddingAccess` explicitly excludes vendor sessions, and this route now does too
(`workspaceKind === 'vendor'` → 403 `GRANT_SCOPE_INVALID`), with a disposable-DB regression test
pinning it directly.

**4. Admin mature domains — overview analytics, client operations (accounts), and governance/
support (cases + incidents) connected; the rest remain honestly UNSUPPORTED.** `/api/admin/overview`
GET's 400-line inline query/analytics logic was extracted verbatim into `@/lib/admin/overview.ts`
(`loadAdminOverview`), and BOTH the PWA route and the extended `/api/native/admin/overview` now call
it — same per-section permission gating (`admin.billing.read`/`admin.support.read`/
`admin.incidents.read`), same risk-flag/analytics derivation, zero duplication. `counts.
pendingOnboarding` (the Phase 7 onboarding-reconciliation queue metric) is deliberately unchanged
and un-conflated with the broader `summary.incompleteOnboarding` — they measure different things
and always have. Android/iOS `AdminSystemSnapshot` gained `businessAccountsTotal`/`activeAccountsTotal`/
`pendingReviewAccountsTotal`/`openSupportCasesTotal`/`openIncidentsTotal`/`accounts`/`supportCases`/
`incidents`, rendered by `AdminDashboardContent` (new summary cards), `AdminAccountsSection` (was a
static, unconditional UNSUPPORTED message that ignored the repository entirely — now real rows), and
a new `AdminCasesSection` (same fix for the "Cases" destination). Command center, bookings, service
engagements, contract intelligence, contributions analytics, account identity, productivity, and
cross-wedding vault browsing remain UNSUPPORTED — each is its own separate PWA surface with its own
business logic to extract safely, not attempted this pass. A pre-existing, honestly-documented
limitation (not introduced or fixed this pass): native Admin permissions resolve from the grant's
`platformRoles[0]` role-default set alone, with no per-membership custom-permission override
threaded through yet — so today only `wewed_super_admin` (`['*']`) ever actually sees the
support/incidents sections in practice; the per-section gating logic is correct and forward-
compatible for when that gap closes, but cannot be exercised end-to-end by a narrower role today.

**5. Controlled writes — unchanged this round.** Task create/update/toggle remains the one shared,
tested mutation surface. No new writes were added: Contracts (draft/versioning/acceptance), Vault
(upload), Budget line edits, Contribution actions, and Seating/Timeline/Vendor-planning writes each
require porting or safely gating an existing, non-trivial write workflow, and none of that changed
in this round — reported honestly as still open rather than partially attempted and left inconsistent.

**6. Qualification — the actual Xcode gate, not the SPM substitute, now run and passing.**
`xcodegen generate` (using the repository's own committed `project.yml`, gitignored generated
`.xcodeproj`) followed by `xcodebuild -scheme Wewed -configuration Debug -destination
'id=<simulator>'` (a real booted iOS Simulator) succeeded, and a `-configuration Release
-destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO` build succeeded too — both new evidence
this round, superseding the earlier `swift build -c release` stand-in. See the completion report for
exact commands and pass/fail counts across server disposable-DB suites, `bun test src` regression,
Android `testDebugUnitTest`/`assembleDebug`/`assembleRelease`, and `swift test`.

**7. Context isolation — re-proved for the paths this round's changes touch.** The
`AppViewModel.boundProductionGrantId`/`boundAdminGrantId` mechanism from item 1 is itself a direct,
tested guarantee that a context switch (Wedding A → Wedding B, or a wedding-scoped role → Admin)
cannot render a shell backed by the PREVIOUS context's repository — `AppViewModelProductionBindingTest`
covers rebinding to a second grant (Wedding A → B) and switching from a wedding-scoped context to
Admin specifically (proving `scopedRepository()` becomes unreachable via the pre-existing, unrelated
`_activeWeddingId` gate even though the stale repository OBJECT reference is untouched by the Admin
bind — the two mechanisms are independent and both hold). Vendor business/engagement isolation is
unchanged by this round (nothing in scope here touches that code path) and was not re-tested beyond
what round 1 already covered.

**Phase-8 acceptance: still NOT YET, by the same standard as §10 — see the completion report's own
explicit statement, not this document, for the current answer.** This document records
classification and reasoning; it does not itself declare a phase accepted.

## 12. Phase 8 closure round 3

A third moderator review inspected the actual round-2 shipped code (not the completion report) and
found that two of round 2's own claims did not hold up: Documents/Contributions were classified LIVE
while a dispatch-level production guard elsewhere in the same files still routed production to a
static UNSUPPORTED message before the (already-real) repository call could run, and the
`NativeRepositoryFactory.PRODUCTION` closure only removed a same-account render race, not the
account-scoped binding gap the locked plan actually required. This section is the honest account of
what round 3 closed, keeping the §9 rule strictly this time: a domain is LIVE only once the complete
chain — server truth → native adapter → production repository → production-reachable role shell —
is verified end to end, not merely believed to be.

**1/2. Stale production UI guards + explicit load-state model (Documents, Contributions).**
`RoleWorkspaces.kt`'s/`.swift`'s Planner-workspace and Couple-plan section dispatchers each carried a
`if (environment == PRODUCTION) IAUnsupportedSection(...) else ShadowXDestination(...)` guard on
Contributions and Documents specifically — the ONLY two sections with this pattern; Budget/Seating/
Timeline/Vendors dispatch unconditionally right next to them. This ran BEFORE
`ShadowContributionsDestination`/`ShadowDocumentsDestination` (already correctly wired to real
repositories in round 2) ever executed, silently overriding that work. Removed on both platforms.
Once reachable, the destinations themselves needed real failure semantics: they held no explicit
loading/error state, so a live transport/permission/revocation failure either escaped an uncaught
coroutine (Android) or was silently swallowed by `try?` into an empty array (iOS) — both of which
read identically to "authoritative empty" to a viewer. A new `ProductionLoadState`
(`Loading`/`Loaded(T)`/`Unavailable`) plus `rememberProductionLoad`/`ProductionLoadView` helper and a
new `IASectionUnavailable` view (distinct from `IAUnsupportedSection` — different copy, different
icon, different test id) now make a live failure render as its own honest state. Five-outcome test
matrices (successful data, successful empty, transport failure, permission denial, grant revocation)
were added for both domains on both platforms.

**3. Contracts native client — closed.** New `NativeDomainApiClient.engagements(...)`,
`ContractsRepository`/`ServiceEngagementSummary`/`ContractSummary` (a DISTINCT model from
`PlannerVendorEngagement` — deliberately not reused, since that model represents the separate,
legitimate `Vendor.contractStatus`/`paymentStatus` planning-side domain), `ProductionContractsRepository`.
Folded into the EXISTING "Vendors" destination as a second, clearly-labelled ("Contracts &
Engagements") list, rather than added as a new Level-2 IA navigation section —
`mobile/contracts/ia-v2-navigation.json` is a locked, cross-platform "AUTHORITATIVE" contract both
platforms assert equality against in unit tests, and adding an entry there is a product/IA decision
outside this closure's "wire existing surfaces to real data" mandate.

**4/5. Cross-account binding hardening + `NativeRepositoryFactory.PRODUCTION` closure — the real
fix this time.** Round 2 tracked each production bind as a bare `grantId` string. A grantId is not
account-scoped: two different accounts can independently resolve an IDENTICAL grant id — `admin:
system` for two different platform administrators, or `coordinator:wedding:<id>` for two people who
each genuinely hold a separate membership on the same wedding. The concrete failing scenario:
Account A binds `admin:system`; Account A is replaced by Account B; B independently resolves the
SAME `admin:system` string before B's own bind completes; a grantId-only check treats A's stale
binding — and the bearer session closed over inside its repository object — as already valid for B.
Every production repository domain (wedding+planner, admin, contracts, vendor engagement) is now
tracked as a `ProductionBinding<T>` (`Unbound | Bound(accessUserId, grantId, value)`) on both
platforms; `repository`/`plannerRepository`/`adminRepository`/`contractsRepository`/
`vendorEngagementRepository` are computed from it rather than stored mutable fields, so "unbound" is
an explicit, type-checked case rather than a same-typed placeholder a caller could mistake for real.
`clearProductionBinding()` drops every axis synchronously on sign-out/session-invalidation. New tests
prove: Account A → B sharing an identical `admin:system` grant id, Account A → B sharing an identical
wedding-scoped grant id, Wedding A → B, Planner → Admin → Planner (axis independence), and
`clearProductionBinding` resetting everything.

**6. Vendor wedding-engagement production shell — closed.** `AppRole.VENDOR`/`.vendor` added to the
production-wired role set, backed by a new `VendorEngagementRepository` reading
`/api/native/vendor/engagement` (new server route — a Vendor-only, wedding-scoped axis, completely
separate from both the Vendor business-portfolio shell and the Planner-side Contracts list; a
Planner/Couple/Coordinator grant is refused `GRANT_SCOPE_INVALID`, and a Vendor business-portfolio
grant is refused the same way by this wedding-scoped route). Wired into the EXISTING "Contract"
section under Vendor → Jobs — already a defined IA section on both platforms, previously
unconditionally UNSUPPORTED — handled before the unrelated Wedding-Day `authorizedEngagement(graph)`
gate, since engagement/contract identity and Wedding-Day presence are different authority axes read
from different sources. Disposable-DB server tests cover: legitimate engagement succeeds (with and
without an explicit `engagementId`), foreign engagement refused (422, not a leak), foreign business
grant refused (403), zero engagements fails closed (422), a revoked business membership denied
entirely, and both a Planner/Couple grant and a Vendor business-portfolio grant refused
(`GRANT_SCOPE_INVALID`) by this route.

**7. Admin failure/empty semantics — closed.** `ProductionAdminSystemRepository.snapshot()` now
throws on any live failure instead of silently degrading to the same nulled-out shape
`ProductionBoundaryAdminSystemRepository` uses for "intentionally not yet bound" — those are two
different facts, and collapsing them made a failed fetch indistinguishable from a genuinely empty
console. `AdminDashboardContent`/`AdminAccountsSection`/`AdminCasesSection` now route through the
same load-state model as items 1/2, each independently (a failure in one section does not affect the
others). `ProductionBoundaryAdminSystemRepository` itself is unchanged and still never throws.

**8. Reviewed only the already-connected Admin surfaces (overview analytics, accounts, support
cases, incidents) for honesty — no new Admin domain was added this round**, per the moderator's
explicit instruction that the blocker was correctness of what already exists, not the count of
connected domains.

**9. This document.** Corrected: Documents/Contributions were not actually production-reachable in
round 2 despite being marked LIVE (see items 1/2 above); Contracts gained a real native client;
Vendor's own engagement/contract identity is now LIVE.

**10/11. Qualification evidence and deployment reporting — see the completion report for this
round**, including temporary reviewer CI (`.github/workflows/_tmp-phase8-round3-*-qualification.yml`
on both branches — removed after a successful run, matching the pattern established in round 2) and
the explicit Preview-vs-Production deployment distinction the moderator asked for.

**Phase-8 acceptance: still NOT YET.** Remaining, honestly: Contracts/Vault write actions, Budget
line edits, Seating/Timeline/Vendor-planning writes, and the Admin domains beyond overview/accounts/
support/incidents (command center, bookings, service engagements, contract intelligence,
contributions analytics, account identity, productivity, cross-wedding vault browsing) are all still
UNSUPPORTED, by deliberate, documented scope decision, not oversight.

## 13. Phase 8 closure round 4

A fourth moderator review inspected the actual round-3 shipped code (not the completion report) and
found three real defects that round 3's own "closed" claims did not survive:
`NativeRepositoryFactory.PRODUCTION` still constructed a same-typed
`ProductionBoundaryWeddingRepository`/`ProductionBoundaryPlannerRepository` placeholder for the
unbound state instead of representing "unbound" as something structurally distinct from a
repository; the Vendor production binding was keyed only on `(accessUserId, grantId)` even though one
`vendor:wedding:<business>:<vendor>` grant can legitimately carry multiple `serviceEngagementIds`,
so a same-grant engagement switch was never actually proven safe (round 3's own "Vendor engagement A
to B" test changed grants, not the selected engagement within one grant); and Contracts' round-3
"LIVE (server + native client)" classification for the Deal Room specifically was premature — the
native client only ever called the engagement-LIST endpoint, never the per-engagement Deal Room one,
so the mature contract/parties/payments/documents detail was never actually reachable from a device.
This section is the honest account of round 4's closure of exactly those three items, nothing more.

**1. `NativeRepositoryFactory.PRODUCTION` closure — this time removing the transitional type
entirely, not just its use as a default.** `NativeRepositoryBundle` (Android: a single data class;
iOS: a single struct) — used uniformly for every environment, including PRODUCTION, where it held a
`ProductionBoundaryWeddingRepository`/`ProductionBoundaryPlannerRepository` pair — is deleted.
`NativeRepositoryFactory.make` now returns a sealed/enum `NativeRepositoryOutcome` with exactly two
shapes: `NonProduction`/`.nonProduction(wedding:planner:environment:baseUrl:)` (FIXTURE/SHADOW/
SANITIZED_SHADOW/PRIVATE_REAL_SHADOW — unchanged behavior, only the wrapping type changed) and
`ProductionBootstrap`/`.productionBootstrap(baseUrl:)` for PRODUCTION, which carries no wedding/
planner field of any kind — it is not repository-shaped, so there is nothing to read off it even by
mistake. `AppViewModel`/`AppState`'s `repository`/`plannerRepository`/`adminRepository`/
`contractsRepository`/`vendorEngagementRepository` no longer fall back to a same-typed placeholder
when the corresponding `ProductionBinding` is `Unbound`/`.unbound` — each now throws a new,
purpose-built exception (`ProductionRepositoryUnbound`, Android an `IllegalStateException` subtype,
iOS a `get throws` computed property surfacing an `Error` struct) that is deliberately distinct from
the pre-existing `ProductionReadOnlyDomainUnavailable`/`ProductionReadOnlyDomainError` (which means "a
bound repository's live call just failed" — a different fact from "never bound at all"). The now-dead
`ProductionBoundaryWeddingRepository`/`ProductionBoundaryPlannerRepository`/
`ProductionBoundaryAdminSystemRepository`/`ProductionBoundaryContractsRepository`/
`ProductionBoundaryVendorEngagementRepository` classes are deleted outright on both platforms (grep-
confirmed zero remaining references before deletion). `RootScreen.kt`/`RootView.swift`'s render gate
is unchanged in intent — it still waits for a confirmed `ProductionBinding.Bound`/`.bound` before
composing any role shell — but is now the ONLY path by which a role shell can ever observe a mature
repository at all; reaching the new exception in practice would mean that gate itself has a bug, not
that a network call failed. New regression tests on both platforms directly pin: `factory(PRODUCTION)`
yields a value that is not repository-shaped at all (a structural/type-level assertion, not just a
runtime one); the unbound state throws before any mature-domain repository is reachable, for all 5
domains; `clearProductionBinding()`/sign-out cannot leave a mature repository reachable either; and
Fixture/Shadow/Sanitized-Shadow/Private-Real-Shadow behavior is provably unchanged (same fixtures,
same assertions, only the wrapping-type access syntax differs).

**2. Vendor same-grant multi-engagement selection — the binding key gained the missing dimension,
and the server now fails closed instead of guessing.** `ProductionBinding.Bound`/`.bound` (the shared
generic binding type used by all four production domains) gained a 4th field, `engagementId: String?`
(`nil` for the other three domains, which have no engagement axis). `NativeDomainApiClient.
vendorEngagement` on both platforms now requires an explicit `engagementId: String?` third parameter,
threaded from `AppViewModel.bindProductionVendorEngagementRepository`/
`AppState.bindProductionVendorEngagementRepository` through to `ProductionVendorEngagementRepository`
and the `GET /api/native/vendor/engagement?grantId=...&engagementId=...` request. The client-side bind
effect (`LaunchedEffect`/`.task(id:)`) now re-runs when the selected engagement changes, and does
nothing while a multi-engagement grant has no selection yet — instead, the pre-existing Phase 5/6
engagement picker (already present in `ProductionReadOnlyWorkspaceContent`, with
`onSelectEngagement`/`engagementSelectionRequired`/`engagementOptions`) is re-inserted ahead of
`VendorShell`/`VendorShellView` specifically for the Vendor role. This picker had become unreachable
for Vendor the moment round 3 added Vendor to the production-wired role set — a real regression,
fixed here by restoring the exact same, reused (never duplicated) composable/view. The render gate's
"is this binding current" check now additionally compares `engagementId` for the Vendor role only
(the other roles have nothing to compare). Server-side, `/api/native/vendor/engagement` no longer
does `engagementCheck.engagementId ?? grant.serviceEngagementIds[0] ?? null` — auto-select now fires
only when `serviceEngagementIds.length === 1`; a grant with more than one engagement and no
`engagementId` supplied returns `422 { code: 'ENGAGEMENT_SELECTION_REQUIRED', engagementIds: [...] }`
instead of silently picking one. A disposable-DB fixture proves the full matrix on a genuinely
same-grant, two-engagement Vendor entity (same vendor, same wedding, same grant id): request A
returns A, request B returns B, switching either way returns exactly that one, omitting the id with
two-plus engagements fails closed with the new code, a foreign engagement id (real, but belonging to
a different vendor entity even under the same business) is refused, and a revoked grant is denied
regardless of engagement count. Both platforms carry a matching client-side regression proving the
binding is genuinely keyed by `(accessUserId, grantId, engagementId)`, not merely `(accessUserId,
grantId)` — a stale engagement-A binding is proven, inline, to never validate a same-grant
engagement-B requirement.

**3. Native Deal Room read path — closed, without duplicating any business logic.** The server side
of Contracts/Deal-Room was already complete since round 2 and unchanged this round
(`/api/native/wedding/engagements/[id]/deal-room` calling `getServiceEngagementDealRoom` directly).
What was missing, per the moderator's finding, was the native CLIENT: `ProductionContractsRepository`
never called it, so the round-3 "LIVE (server + native client)" classification for the Deal Room
specifically was not actually true end to end. Both platforms now have `NativeDomainApiClient.
dealRoom(sessionToken:, grantId:, engagementId:)` (engagement id URL-encoded into the path, matching
the route's own `[id]` segment), a full DTO set on `ContractsRepository`
(`DealRoomVendor`/`DealRoomParty`/`DealRoomContractVersion`/`DealRoomContractDetail`/
`DealRoomBudgetItem`/`DealRoomPayment`/`DealRoomDocument`/`DealRoomDetail`) whose field set mirrors
exactly what the PWA's own `DealRoomRecord` (`planner-vendor-deal-room.tsx`) consumes from the SAME
engine — nothing invented, nothing computed client-side — and `ProductionContractsRepository.
getDealRoom(engagementId:)`, which throws (never fabricates a partial/empty room) on ANY non-success
fetch, exactly like every other production repository in this codebase. The existing "Vendors" →
"Contracts & Engagements" list (unchanged, still not a new IA navigation section) gained a
tap-to-expand interaction: opening a row fetches that engagement's Deal Room, keyed independently per
row so switching rows never shows a stale one, and renders vendor identity, parties (with
"review required" flags — the acceptance/review-state signal the moderator asked for), contract
versions, commercial/payment information, and linked Vault documents. Tests on both platforms prove:
every field maps correctly from a realistic response; the exact requested path/engagement id; and all
four non-success outcomes (foreign engagement 404, permission denial, session-invalid, grant
revocation) throw rather than returning anything, so a denial or a genuine failure can never render as
an empty or fabricated Deal Room.

**4. This document.** Corrected per the moderator's explicit instruction: §1 row 42 (Contracts/Deal
Room) no longer implies the Deal Room detail itself was native-client-reachable before this round;
§4 row 56 (Vendor's own engagement) now records the same-grant multi-engagement correction and the
binding-key change; this section records the TRUE `NativeRepositoryFactory.PRODUCTION` architecture
now that the boundary-repository transition is actually removed, not merely bypassed by a render-race
fix (which is what round 3 had actually shipped despite its own "closed" claim).

**5. Scope discipline — nothing beyond these three items changed.** No new native domain, no new
writes, no new IA navigation entry, no change to Guest/RSVP behavior, no F-3 relationship fabricated,
no change to F-4, no production data read or written, no production migration applied, no
`WEWED_SESSION_SECRET` read or changed, and Phase 9 was not started. Task create/update/toggle remains
the one shared, tested mutation surface introduced in the original Phase 8 pass — unchanged this
round.

**6. Qualification evidence — see the completion report for this round** for exact, full (non-
abbreviated) qualified and final SHAs, temporary reviewer-CI run ids
(`.github/workflows/_tmp-phase8-round4-*-qualification.yml` on both branches — removed after a
successful run, matching the pattern established in rounds 2/3), and the explicit Preview-vs-
Production deployment confirmation for every SHA produced this round.

**Phase-8 acceptance: see the completion report's own explicit statement, not this document, for the
current answer — this document records classification and reasoning, it does not itself declare a
phase accepted.** Remaining, honestly, exactly as before this round (none of it was in scope for round
4 and none of it changed): Contracts/Vault write actions, Budget line edits, Seating/Timeline/
Vendor-planning writes, and the Admin domains beyond overview/accounts/support/incidents.

## 14. Phase 8 closure round 5 — production root bootstrap correction

A fifth moderator review inspected the actual round-4 shipped code (not the completion report) and
found one real defect in the production root, distinct from round 4's own three items: round 4
correctly deleted the `ProductionBoundary*Repository` objects and made every production repository
getter throw `ProductionRepositoryUnbound` until a verified binding exists — but the actual
authenticated-root construction on both platforms still called the old, single
`ActorAssignmentSources.forEnvironment(environment, repository, plannerRepository, ...)` API, whose
signature demanded a `WeddingRepository`/`WeddingRepositoryProtocol` argument even for PRODUCTION,
which never needed one. Because Kotlin/Swift both evaluate call arguments before entering the callee,
Android's `appViewModel.repository` was read (and thrown) at that call site BEFORE the async bind
effect had any chance to run and before the render gate could show its loading state — a genuine
runtime bootstrap crash, not merely a theoretical one. iOS avoided the equivalent crash only via an
invalid production fallback, `(try? appState.repository) ?? FixtureWeddingRepository()`, which existed
for the identical reason (the API still required a repository parameter) rather than because
production context resolution had any legitimate use for a Fixture repository. This section records
round 5's closure of exactly this one item.

**1. `ActorAssignmentSources` no longer has a repository dependency for PRODUCTION at all.** The
previous single `forEnvironment(...)` function is deleted on both platforms, replaced with three
narrowly-typed constructors: `forShadow(repository, plannerRepository, environment)` (Shadow/Fixture/
dev-persona environments only — the only one that takes a repository, since those environments always
have a real, non-throwing one), `forProduction(productionAuthority, selectedGrantIds,
selectedEngagementId)` and `empty()` (neither takes a repository parameter at all — there is
structurally nothing for a caller to misuse even by accident). `RootScreen.kt`/`RootView.swift` now
branch on `dataEnvironment`/authority themselves BEFORE ever touching
`appViewModel.repository`/`appState.repository`, delegating to a new pure, directly unit-tested helper
(`resolveActorAssignmentSource`, `ActorAssignment.kt`/`.swift`) rather than evaluating the repository
unconditionally as a call argument. iOS's invalid `?? FixtureWeddingRepository()` fallback is deleted
outright, not merely made harder to reach.

**2. Regression tests prove the exact scenario that broke, directly, on both platforms
(`RootAssignmentBootstrapTest.kt` / `RootAssignmentBootstrapTests.swift`).** An unbound PRODUCTION
app-state with a valid, freshly-resolved authority now builds a real `ProductionActorAssignmentSource`
without ever throwing `ProductionRepositoryUnbound` and without constructing or requiring any
Fixture/Shadow repository (a structural guarantee via the type signature, not just a runtime one); no
authority yet still yields `EmptyActorAssignmentSource`, also without touching a repository; Shadow
environments are unchanged and still require a real repository; `clearProductionBinding()` leaves
assignment resolution safe while the mature repository domains remain correctly unreachable until a
fresh bind; an Account A → Account B replacement on the same app-state instance is proven to never mix
assignments or consult a stale repository; and the Vendor same-grant `selectedEngagementId` (round 4
§2) is proven to still flow all the way through the new three-constructor API unchanged.

**3. Scope discipline — native-only, nothing else changed.** No server product code was touched this
round; round 4's server qualification evidence (run `35813862536`, product SHA
`36e02adc9420b96f9dd18f8063fc7b55ed74f110`) is retained rather than rerun. Round 4's closures are
unchanged and unregressed: `NativeRepositoryOutcome.ProductionBootstrap`, the `ProductionRepositoryUnbound`
distinction, the deleted `ProductionBoundary*Repository` classes, the Vendor
`(accessUserId, grantId, engagementId)` binding key and `ENGAGEMENT_SELECTION_REQUIRED`, the native
Deal Room client/repository/UI, Documents, Contributions, Admin failure semantics, and shared task
operations. The P1-N4 "20 dead composables" line in round 4's own completion report was itself stale —
independent inspection of the current native files found only explanatory comments describing an
already-completed deletion, not a reachable fabricated surface; no P1-N4 work was reopened or
reattempted this round.

**4. Qualification evidence — see the completion report for this round** for the exact, full
qualified and final native SHA, temporary reviewer-CI run id
(`.github/workflows/_tmp-phase8-round5-native-qualification.yml` — removed after a successful run),
and the explicit Preview-vs-Production deployment confirmation.

**Phase-8 acceptance: see the completion report's own explicit statement, not this document, for the
current answer.** Remaining, honestly, unchanged by this round: Contracts/Vault write actions, Budget
line edits, Seating/Timeline/Vendor-planning writes, and the Admin domains beyond
overview/accounts/support/incidents.
