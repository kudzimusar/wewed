# IA V2 Route Data Audit — fixture leakage and state semantics

**Document ID:** WW-NATIVE-ROUTE-AUDIT-2026-09-20-01
**Status:** EVIDENCE RECORD
**Basis:** `PRIVATE_REAL_SHADOW_ENTITY_COVERAGE_2026-09-20.md` (what the protected snapshot holds)

Every section reachable through IA V2 is classified as exactly one of:

- **REPOSITORY_BACKED** — reads the canonical repository for the active scope.
- **HONEST_EMPTY** — the contract exists and returned zero rows; the UI says so.
- **UNSUPPORTED** — no native/backend contract exists in this environment; the UI says so.
- **FIXTURE_ONLY_NOT_EXPOSED** — demo content that must not be reachable such that its rows look
  like Private Real Shadow records.

The rule: in `PRIVATE_REAL_SHADOW`, **no fixture-only row may appear to be real account data.**

---

## Couple

| Route | Classification | Notes |
|---|---|---|
| Home | REPOSITORY_BACKED | wedding, tasks, guests, budget, vendors |
| Plan → Overview | REPOSITORY_BACKED | module summaries from the wedding graph + planner projection |
| Plan → Tasks / Budget / Contributions / Vendors / Seating / Timeline | REPOSITORY_BACKED | |
| Plan → Documents | HONEST_EMPTY | `contracts` key exists with 0 records |
| Guests → Guest List / RSVP / Groups / Seating / Passes | REPOSITORY_BACKED | 174 guest records |
| Guests → Invitations | UNSUPPORTED | no invitation entity; a pass serial is not delivery proof (P0-14) |
| Guests → Messages | UNSUPPORTED | no message contract |
| Wedding Day → Programme / Venue / Vendor Status / Announcements / Offline | REPOSITORY_BACKED | |
| Wedding Day → My Pass | UNSUPPORTED for couple | the couple holds no guest pass credential |
| Wedding Day → Key Contacts | UNSUPPORTED | no contact directory |
| More → Wedding Profile / Documents | REPOSITORY_BACKED / HONEST_EMPTY | |
| More → Our Story / Gallery | UNSUPPORTED | not published for this wedding |
| More → Honeymoon | UNSUPPORTED | **corrected (P0-12)** — previously showed guest memory records as honeymoon funding |
| More → Settings / Help / Account | REPOSITORY_BACKED (local) | |

## Planner

| Route | Classification | Notes |
|---|---|---|
| Workspace → all nine worksheets | REPOSITORY_BACKED | Documents HONEST_EMPTY |
| Clients → Active Weddings | REPOSITORY_BACKED + explicit test-access label | **no PlannerEngagement exists**; shown as accepted enquiry (P0-13) |
| Clients → Upcoming / Enquiries / Archived / Team Assignment | UNSUPPORTED | |
| Clients → Client Profiles | FIXTURE_ONLY_NOT_EXPOSED — **open** | `ClientProfileDestination` still carries static client text |
| Daily Ops → Today / Overdue / Deadlines / Vendor Follow-ups / Guest Issues / Team Activity | REPOSITORY_BACKED | date semantics corrected (P0-14) |
| Daily Ops → Approvals / Payments Requiring Attention | UNSUPPORTED | |
| Daily Ops → Messages | UNSUPPORTED | **corrected** — was a hard-coded planner thread |
| Wedding Day → Run Sheet / Programme / Gate / Vendor Arrivals | REPOSITORY_BACKED | |
| Wedding Day → Incidents / Live Notes | UNSUPPORTED | |
| More → Team Hub / Invitations & QR / Intelligence / Files | FIXTURE_ONLY_NOT_EXPOSED — **open** | legacy destinations retain static copy |
| More → Planner Actions | Mixed | Refresh and Switch Worksheet are real; six are explicitly "Not connected" (P0-11) |

## Guest

| Route | Classification | Notes |
|---|---|---|
| Home / Invitation / RSVP / Party / Pass / Table / Admission | REPOSITORY_BACKED | identity-bound to the credential (P0-4/P0-5) |
| Invitation → Dietary / Message to Couple / Contribution | UNSUPPORTED | |
| Wedding Day → Programme / Venue / Announcements / Table | REPOSITORY_BACKED | |
| More → Our Story / Gift Info | UNSUPPORTED | |

## Vendor

| Route | Classification | Notes |
|---|---|---|
| Home | REPOSITORY_BACKED | authorized vendor only; no first-row fallback (P0-10) |
| Jobs → Service Details / Venue | REPOSITORY_BACKED | |
| Jobs → Deliverables / Contract / Payment / Files / Notes / Contacts | UNSUPPORTED | contracts = 0 records |
| Schedule → Calendar / Arrival Time | REPOSITORY_BACKED | |
| Schedule → Setup / Service Window / Breakdown / Dependencies | UNSUPPORTED | |
| Messages | UNSUPPORTED | **corrected** |
| More → Services / Company Profile | FIXTURE_ONLY_NOT_EXPOSED — **open** | `VendorCatalog` retains static documents |

## Gate Team

| Route | Classification | Notes |
|---|---|---|
| Scan | REPOSITORY_BACKED | gate id from the declared Shadow assignment table (P0-3) |
| Admissions → all six | REPOSITORY_BACKED | duplicate-scan semantics corrected (P0-14) |
| Guests | REPOSITORY_BACKED | operational fields only |
| Incidents → all six | UNSUPPORTED | no incident contract |
| More → Gate Assignment / Offline / Sync / Venue Map | REPOSITORY_BACKED | |

## Coordinator

| Route | Classification | Notes |
|---|---|---|
| Today / Run Sheet | REPOSITORY_BACKED | |
| Team → Tasks / Vendors | REPOSITORY_BACKED | |
| Team → Ushers / Staff / Assignments / Contacts | UNSUPPORTED | no team roster |
| Wedding Day → Gate / Admissions / Vendor Arrivals / Venue Zones | REPOSITORY_BACKED | |
| Wedding Day → Incidents | UNSUPPORTED | |

## Admin

| Route | Classification | Notes |
|---|---|---|
| Dashboard | REPOSITORY_BACKED (system projection) | `AdminSystemRepository`; no wedding required (P0-13) |
| Cases | UNSUPPORTED | 0 support cases |
| Accounts → all six | UNSUPPORTED | no account administration contract |
| Audit → Check-ins | REPOSITORY_BACKED | only when drilled into a wedding |
| Audit → Data Changes / Access Events / Payments / Contracts / Admin Actions | UNSUPPORTED | no audit stream |
| More → System Health | REPOSITORY_BACKED (system projection) | |

---

## Open fixture-only routes (remaining work)

These legacy destinations are still reachable from Planner/Vendor **More** and retain static copy.
They do not claim wedding-graph facts, but they are not repository-backed either and must be
converted to UNSUPPORTED or gated to `FIXTURE`/`SANITIZED_SHADOW` before this milestone closes:

- `ClientProfileDestination` / `ClientProfileView`
- `CollaborationDestination` / `CollaborationHubView` (Team Hub)
- `InvitationsDestination` / `PlannerInvitationToolsView` (Invitations & QR)
- `AIWorkspaceDestination` / `WewedAIWorkspaceView` (Intelligence)
- `MediaArchiveDestination` / `MediaArchiveView` (Files / Documents)
- `VendorCatalogScreen` / `VendorCatalogView` (Services / Company Profile)
- `MarketplaceDirectory` (not currently on an IA V2 route)

**Corrected in this phase:** `MessagesInboxScreen` / `MessagesInboxView`, which hard-coded a
planner conversation with a timestamp and read as a real thread.
