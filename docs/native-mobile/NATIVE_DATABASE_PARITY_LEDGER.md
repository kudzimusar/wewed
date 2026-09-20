# Native Database Parity Ledger

**Generated against the backend on 2026-09-20.** Measured by
`mobile/contracts/audit_mobile_api_coverage.py`, not hand-maintained.

---

## The rule this ledger enforces

> Where Wewed web has a database-backed capability, the native app must consume the **same
> canonical service**, or the route is a **gap**.
>
> `UNSUPPORTED` is legitimate **only** when Wewed itself lacks the capability. Never when the
> mobile adapter has simply not been written.

A native route paired with an honest "unsupported" is no longer acceptable progress when the
website already ships the feature. It reclassifies our unfinished work as an absent product
feature, and a gap recorded that way stops being counted.

## Classifications

| Code | Meaning |
|---|---|
| `FULL_PARITY` | Same canonical service, read + write |
| `READ_ONLY_PARITY` | Same canonical service, reads only; writes deliberately gated |
| `SHADOW_WRITE_PARITY` | Reads real; writes land in the local UAT overlay only |
| `MOBILE_ADAPTER_MISSING` | **The capability exists on the web. Native has not wired it.** |
| `UI_MISSING` | Adapter exists; no native surface renders it |
| `AUTHORIZATION_BLOCKED` | Rows exist; this credential may not read them |
| `NOT_APPLICABLE` | Wewed genuinely does not have this |

---

## 1. The headline number

```
backend route files ........................ 259
backend operations ......................... 395
paths in mobile/contracts/openapi.yaml .....   9   (2.3%)
contract paths resolving to a real route ...   0
```

**Every path in the "canonical" mobile contract describes a route the backend does not have.**
It was written against a sandbox that no longer runs, and nothing compared it to the product. It
is now marked `x-status: superseded`.

The native production factory refuses production reads outright
(`productionReadVerifyNotConfigured`, `productionDisabled`), so **no native role experience
currently reads the live Wewed service layer.**

## 2. Coverage by backend area

| Area | Route files | Operations | Mobile contract | Classification |
|---|---:|---:|---:|---|
| planner | 57 | 95 | 0 | `MOBILE_ADAPTER_MISSING` |
| admin | 24 | 35 | 0 | `MOBILE_ADAPTER_MISSING` |
| vendor | 12 | 18 | 0 | `MOBILE_ADAPTER_MISSING` |
| bookings | 12 | 16 | 0 | `MOBILE_ADAPTER_MISSING` |
| weddings | 6 | 15 | 0 | `MOBILE_ADAPTER_MISSING` |
| auth | 7 | 7 | 1 (stale) | `MOBILE_ADAPTER_MISSING` |
| mobile | 5 | 6 | 0 | `MOBILE_ADAPTER_MISSING` |
| contributions | 3 | 4 | 0 | `MOBILE_ADAPTER_MISSING` |
| internal | 3 | 3 | 0 | `NOT_APPLICABLE` |
| rsvp | 2 | 5 | 0 | `MOBILE_ADAPTER_MISSING` |
| invitations | 1 | 1 | 0 | `MOBILE_ADAPTER_MISSING` |
| other | 127 | 190 | 0 | mixed |

## 3. Corrections to previously reported status

Two claims in earlier reports were wrong, both understating what Wewed already has.

### 3.1 Guest session exchange — reported absent, actually exists

I previously wrote *"there is no claim exchange endpoint, so no `GuestInvitationSession` can be
minted."* The endpoints exist:

| Capability | Route |
|---|---|
| Exchange RSVP claim → guest session | `GET /api/weddings/[slug]/guest-session/exchange?token=…` |
| Guest session lifecycle | `GET/POST/PUT/PATCH/DELETE /api/weddings/[slug]/guest-session` |
| Invitation access exchange | `GET /api/weddings/[slug]/invitation-access/exchange` |
| Deferred install handoff | `POST /api/invitations/install-handoff` |

`setWeddingGuestSessionCookie` already mints a session carrying wedding, guest and RSVP token.
**Correct classification: `MOBILE_ADAPTER_MISSING`.** Recording it as a missing server contract
would have retired it from the queue.

### 3.2 "Private Real fidelity: PASS" was too broad

It meant **Charity & Kudzie wedding-graph fidelity**, not whole-database parity. The extractor
covers 29 wedding-scoped tables. It does not cover `BusinessAccount`, `BusinessAccountMember`,
`PlatformAdministrator`, admin scopes, `SupportCase`, `PlatformIncident`, `PaymentRecord`,
booking commerce, provider catalog, `ProviderClaim`, planner portfolio or transaction governance.

**Read every prior "Private Real PASS" as `CHARITY_KUDZIE_WEDDING_GRAPH_PASS`.**

## 4. Defects closed in this pass

| Defect | Was | Now |
|---|---|---|
| Couple → Invitations (Android) | `passSerial != null` → **"Issued"** — claimed delivery from a Pass serial derived from RSVP; iOS correctly refused, so also a parity defect | Shows real RSVP status; names `/api/planner/guests/invitations` as `MOBILE_ADAPTER_MISSING`. Neither system records delivery — the web returns an *addressable* link, QR and share message |
| Guest → Dietary / Message / Party | "Unsupported" while the **same repository record** rendered in the Couple's worksheet | Wired to the guest's own RSVP: dietary, meal, message, song request, plus-one, children |
| Guest → Contribution / Memory | "No native contract exists" | `MOBILE_ADAPTER_MISSING`, naming the contributions API |
| Planner → Client Profiles | Static legacy screen asserting **"174 guest records"** — already stale, the real count is 175 — duplicating a repository-backed Client Profile elsewhere | Both routes now resolve to the repository-backed projection |
| `mobile/contracts/openapi.yaml` | "Canonical Mobile API" | `x-status: superseded`, with the measured 0/9 resolution recorded in the file |
| `MOBILE_FEATURE_PARITY_MATRIX.md` | Claimed sign-in, session restore, biometrics, sign-out, 401 recovery and iOS Keychain **In Parity** | Invalidated, with a table of each false claim against runtime evidence |
| `NATIVE_ROLE_CAPABILITY_MATRIX.md` | Old navigation model, old personas | Marked stale |

## 5. Per-role data state

| Role | Wedding graph | Platform breadth | Blocking |
|---|---|---|---|
| Couple | Good | Invitations, messages, contracts, actions | Planner/messaging adapters |
| Guest | Strong | Own RSVP detail **now wired** | Guest-session adapter |
| Planner | Good worksheets | **95 operations, 0 wired** | Collaboration, contracts, payments, vault, event-day |
| Vendor | Thin | **18 operations, 0 wired** | Bookings, catalog, documents |
| Gate | Strong narrow slice | Incidents are shells | Incident domain |
| Coordinator | Partial | Ushers, staff, assignments, contacts | Event-day/collaboration |
| Admin | Authorization model only | **35 operations, 0 wired** | Every surface + the read grant |

## 6. What "production read" must mean

Not "authentication starts working". It must mean:

```
real signed-in user  +  real authorization  +  real context
  +  real mobile API  +  the same production truth the website shows
  +  zero production mutations
```

If the desktop shows a value and the user is authorized to see it, native shows the same value.

## 7. Next queue

1. Rebuild the mobile API contract around the real backend (`/api/mobile/*`), starting from auth.
2. Implement production-read repository adapters; retire snapshot-only repositories from
   `PRODUCTION_READ_VERIFY`.
3. Consume the **existing** guest-session exchange endpoints.
4. Wire the real Planner invitation APIs.
5. Bring Planner collaboration, payments, approvals, reminders, contracts/vault and event-day
   across from the existing web services.
6. Bring Vendor booking, catalog and document APIs into native.
7. Build Admin mobile APIs over the existing Admin service layer.
8. Keep this ledger generated, never hand-written.
