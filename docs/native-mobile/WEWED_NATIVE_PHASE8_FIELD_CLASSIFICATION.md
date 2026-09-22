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
| Contributions: type/amount/commitment/fulfillment/verification state, contributor, allocation | LIVE (read-only) | `wewed_contributions.*` (raw SQL) | `@/lib/contributions/store` (`loadContributionWorkspace` — the SAME engine `/api/planner/contributions` calls; no second funding truth computed anywhere) | `/api/native/wedding/contributions` (new, read-only) | `PlannerContributionRecord` | Contributions section (now reads real rows) | equivalent |
| Contribution writes (allocate/mark-thanked/mark-verified/mark-received/create-task) | UNSUPPORTED | `wewed_contributions.*` | `@/lib/contributions/store` | `/api/planner/contributions/[id]/actions` (PWA only) | — | — | — |
| Service engagement list + Deal Room (contract status/versions/parties/payments/linked vault docs) | LIVE (server, read-only) | `ServiceEngagement`, `Contract`, `ContractVersion` | `listManagedServiceEngagements`/`getServiceEngagementDealRoom` (`@/lib/contracts/phase2.ts` — the SAME functions `/api/planner/engagements/current` and `.../[id]/deal-room` call; zero reimplementation) | `/api/native/wedding/engagements`, `/api/native/wedding/engagements/[id]/deal-room` (new, closure round 2) | none yet | none yet — no existing native repository/UI surface represents the managed-contract lifecycle; the server adapter exists, is disposable-DB tested (valid/foreign-wedding/foreign-engagement-404/revoked-grant/permission-denied/coordinator-equivalence/Vendor-F-3-denied/PWA-native-equivalence), and is ready to be wired once a native screen is designed — see §11 | none yet |
| Documents / vault | LIVE (read-only) | `VaultObject`/`VaultLink` | `listWeddingVaultObjects` (`@/lib/vault/catalog.ts` — the SAME function `/api/vault` GET calls) | `/api/native/wedding/vault` (new, closure round 2) | `PlannerDocumentRecord` | `ShadowDocumentsDestination` now calls the real repository unconditionally (production included), exactly like Budget/Contributions/Seating — a Vendor's own `vendor:wedding:...` grant is explicitly refused (`GRANT_SCOPE_INVALID`), matching the PWA's `requireVaultWeddingAccess` vendor exclusion | equivalent |
| Seating auto-assign, guest bulk-move, timeline reorder, task delete | UNSUPPORTED (writes) | various | `@/lib/planner-*` | `/api/planner/seating/auto-assign` etc. (PWA only) | — | — | — |

## 4. Vendor

| Field/surface | Classification | Model/table | Shared server helper | PWA endpoint | Native DTO | Android screen | iOS screen |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Business portfolio identity (name/type/status/onboarding/role) | LIVE | `wewed_admin.BusinessAccount`/`BusinessAccountMember` (via `authority.businessMemberships`) | `resolveProductionAuthority` | `/api/native/vendor/business` (new) | `VendorBusinessIdentity` | `ProductionVendorBusinessRepository`/`ProductionVendorBusinessContent` — a `vendor:business` grant now renders this real shell (was the generic minimal snapshot; fixed this pass) | equivalent |
| Catalog items + offerings | LIVE (read-only) | `wewed_booking.ProviderCatalogItem`/variants/media/resources/components, `wewed_admin.ProviderServiceOffering` | `@/lib/booking-commerce` (`catalogForBusiness`, extracted from `/api/vendor/catalog`) | `/api/native/vendor/catalog` (new) | `VendorCatalogItem`/`VendorCatalogOffering` | `ProductionVendorBusinessContent` (rebuilt on live data; the old fabricated `VendorCatalogScreen` was deleted in the original Phase 8 pass) | equivalent |
| Catalog item creation/editing | UNSUPPORTED | same | same | `/api/vendor/catalog` POST (PWA only) | — | — | — |
| Bookings list | LIVE (read-only) | `wewed_booking.Booking`+lines | `@/lib/booking-commerce` (`bookingsForBusiness`, extracted from `/api/vendor/bookings`) | `/api/native/vendor/bookings` (new) | `VendorBooking` | `ProductionVendorBusinessContent` | equivalent |
| Booking actions (approve/decline/quote/amendments) | UNSUPPORTED | `wewed_booking.Booking`/`BookingAmendment` | `@/lib/booking-governance`, `@/lib/booking-amendments` | `/api/vendor/bookings/[id]/*` (PWA only) | — | — | — |
| Vendor wedding engagement (Phase 6 grant + selected engagement) | LIVE (identity only; already shipped Phase 5/6) | `ServiceEngagement` | `resolveNativeGrantContext`+`requireGrantEngagement` | `/api/native/account/workspace` (Phase 6) | existing | existing engagement picker | equivalent |
| Vendor documents (commercial) | UNSUPPORTED | `VaultLink`/`VaultObject` via `EngagementParty` | `@/lib/vault/vendor-commercial-access` | `/api/vendor/documents*` (PWA only) | — | — | — |
| Vendor wedding-scoped work items beyond the existing engagement identity | UNSUPPORTED (F-3-adjacent) | — | — | — | — | — | — |

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
