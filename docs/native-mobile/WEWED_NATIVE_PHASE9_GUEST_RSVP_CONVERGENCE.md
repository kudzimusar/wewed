# Wewed Native Phase-9 Guest & RSVP Convergence

**Master plan:** `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01`, **Phase 9 — Digital Invitation + RSVP convergence**
**Status:** Implementation audit, subordinate to the locked master plan. Not a competing plan.

Exit condition (per the locked plan): *the same Guest record, the same configured Digital
Invitation design, and the same RSVP truth must be used by PWA, Android and iOS.* This document
classifies every field/surface Phase 9 touches:

- **LIVE** — read from and/or written to a real server domain, backed by a real persisted model.
- **DERIVED** — computed server-side from real data; never independently recalculated on the client.
- **UNSUPPORTED** — the surface exists in native code/IA but is not wired to any real server domain
  in this phase.

There is no `EMPTY` or `TEST ONLY` classification in this document: every field below is a real,
production-reachable Guest RSVP field, not a fixture/Shadow-only value.

---

## 1. Guest identity — one record, one authority

| Aspect | Classification | Detail |
| --- | --- | --- |
| Guest record | LIVE | `Guest` + `RSVP` (1:1, `RSVP.guestId` unique) — the SAME rows PWA, Android and iOS all read and write. No native-only Guest table, no replication. |
| Guest Session v2 identity | LIVE | `{ version: 2, weddingId, guestId, invitationVersionFingerprint, expiresAt }` (`src/lib/wedding-guest-session.ts`). Contains no raw RSVP token. `invitationVersionFingerprint` is recomputed from `(weddingId, guestId, rsvpToken)` on every verification (`guestSessionMatchesInvitation`) — an invitation identity change (a new `RSVP.token`, e.g. after re-issuing a card) invalidates every outstanding Guest Session for that guest, since the fingerprint no longer matches. Unchanged by Phase 9. |
| Raw RSVP credential | LIVE (never persisted) | The private link's token is used once, during `POST /api/weddings/[slug]/guest-session` (exchange) or `/invite/resume` (handoff redemption), to mint a Guest Session. Android's `GuestSessionClient`/iOS's `GuestSessionClient` both persist ONLY the server-issued session credential (`secureStorage`/Keychain) — the raw token is never written to storage, never logged. Unchanged by Phase 9. |

---

## 2. Authoritative RSVP fields — the converged set

| Field | Type | Classification | Notes |
| --- | --- | --- | --- |
| `attending` | `Boolean?` | LIVE | `null` = not yet answered, `true`/`false` = answered. |
| `mealChoice` | `String?` | LIVE | Free text server-side; PWA/Android/iOS all offer the same 5-option picker (beef/chicken/vegetarian/vegan/traditional) as a convenience, not a server-enforced enum. |
| `plusOne` | `Boolean` | LIVE | Defaults `false`. |
| `plusOneName` | `String?` | LIVE | Only meaningful when `plusOne` is true; never required to be blank when `plusOne` is false — omitted, not cleared, when the plus-one toggle is off. |
| `plusOneMeal` | `String?` | LIVE | Same rule as `plusOneName`. |
| `kidsAttending` | `Boolean` | LIVE | Defaults `false`. Forced `false` server-side whenever the wedding's `childrenPolicy` is `adults_only`, regardless of what a client requests. |
| `kidsCount` | `Int?` | LIVE | Historical value is preserved (never deleted) even when `childrenPolicy` becomes `adults_only` — only `kidsAttending` is forced false; a stale/older client's own submitted `kidsCount` is silently dropped (not applied) in that case, never destroying the pre-existing value. |
| `dietaryNotes` | `String?` | LIVE | |
| `message` | `String?` | LIVE | Always editable regardless of `attending`. |
| `checkedIn` / `checkedInAt` | `Boolean` / `Date?` | LIVE (read-only from this transport) | Written only by the Wedding-Day gate/check-in path (`PATCH /api/weddings/[slug]/guest-session`, `PATCH /api/rsvp/[token]`), never by the guest RSVP form. |
| `songRequests` | `String?` | UNSUPPORTED (this operation) | A real, separate `RSVP` column `/api/rsvp` used to also expose before Phase 9. Deliberately excluded from the converged `applyGuestRsvpUpdate` operation and from both native clients — it has no current caller and is outside Phase 9's explicit field list. The column itself is untouched; a future phase may converge it separately. |

**Partial-update semantics (all three clients, one rule):** a field the caller does not name in the
request is left completely untouched in the stored row — never coerced to `null`, never overwritten.
To intentionally clear a free-text field (`mealChoice`/`plusOneName`/`plusOneMeal`/`dietaryNotes`/
`message`), a client sends an explicit empty string; the server trims it to a stored `null`. Booleans/
`kidsCount` have no "cleared" state on the wire — omitting them is the only way to leave them
untouched.

---

## 3. Server mutation operation

`applyGuestRsvpUpdate` (`src/lib/guest-rsvp-mutation.ts`, new this phase) is the ONE place these
field/policy rules live. Given an already-authorized `(weddingId, rsvpToken)` pair, it:

1. Loads the wedding's `childrenPolicy` (`weddingContent` row, `section: 'rsvp'`, `field:
   'childrenPolicy'`).
2. Refuses (`code: 'CHILDREN_NOT_ALLOWED'`, 400) if the policy is `adults_only` and the caller
   requested `kidsAttending: true`.
3. Builds a Prisma patch from only the fields the caller actually named, with basic type validation
   (wrong-typed values are dropped, never written) — never a blind passthrough of the request body.
4. Forces `kidsAttending: false` and drops any submitted `kidsCount` (without touching the stored
   value) when the policy is `adults_only`.
5. Writes the patch and returns the full stored row.

Before Phase 9, `PUT /api/weddings/[slug]/guest-session` (Guest Session v2) and `POST /api/rsvp` (a
second, older guest-facing transport) each reimplemented these rules independently, and had drifted:
`/api/rsvp` had NO adults-only enforcement at all, and unconditionally overwrote
`plusOneName`/`plusOneMeal`/`dietaryNotes`/`message` with `null` whenever a caller omitted them —
silently erasing previously-saved answers on every partial edit. Both routes now call the same
`applyGuestRsvpUpdate`; only their own transport-specific authorization remains route-specific.

---

## 4. Transports

| Transport | Classification | Authorization | Mutation logic |
| --- | --- | --- | --- |
| `PUT /api/weddings/[slug]/guest-session` (Guest Session v2) | LIVE | Guest Session v2 cookie + `originGuestId` stale-context check (the form's presented-guest binding must match the currently-resolved guest; mismatch or missing → `409 STALE_GUEST_CONTEXT`) | `applyGuestRsvpUpdate` |
| `POST /api/rsvp` (legacy, cookie-based `resolveWeddingAccessForRequest`) | LIVE | Guest Session v2 / app-session / shared-invitation cookie, wedding-privacy-gated (guest access only for `public`/`link_only` weddings — a pre-existing, unchanged distinction; `private` weddings only admit couple/planner/staff through this specific route) | `applyGuestRsvpUpdate` (reconciled this phase) |
| `PATCH /api/rsvp/[token]` | LIVE, unrelated domain | Staff `guests.edit` permission | Check-in toggle only — not a guest-editable RSVP field, untouched by this phase |
| `GET /api/weddings/[slug]/guest-session` | LIVE | Guest Session v2 cookie | Read-only; also carries `wedding.invitationCardStyle`/`childrenPolicy` |

**Native never gets a second transport.** Android and iOS both call `PUT /api/weddings/[slug]/guest-session`
exclusively — no `/api/native/rsvp` or any other native-only route exists or was added.

---

## 5. Android mapping

| Server concept | Native type/symbol |
| --- | --- |
| Guest Session v2 identity | `GuestSessionClient` (`apps/android/.../invitation/GuestSessionClient.kt`) — session persisted via `SecureStorage`, raw token never stored |
| RSVP write payload | `GuestRsvpUpdate` (new this phase) — 9 nullable fields, `null` = omit |
| RSVP read/write response | `GuestRsvpRecord` (new this phase, replaces a bare `Boolean?`) |
| `originGuestId` binding | `LiveGuestInvitationCoordinator.presentedGuestId` — captured only when a card is presented, never at save time |
| RSVP form UI | `LiveGuestInvitationScreen.kt`'s `LiveRsvpForm` (new this phase, replaces a 2-button accept/decline dialog) — full field parity with the PWA's premium invitation RSVP dialog |
| Invitation style | `LiveInvitationPresentation.invitationCardStyle`, sourced exclusively from the GET response's `wedding.invitationCardStyle` — never from a deep-link parameter |

## 6. iOS mapping

| Server concept | Native type/symbol |
| --- | --- |
| Guest Session v2 identity | `GuestSessionClient` (`apps/ios/Wewed/Invitation/GuestSessionClient.swift`) — same Keychain-backed persistence contract as Android |
| RSVP write payload | `GuestRsvpUpdate` (new this phase) |
| RSVP read/write response | `GuestRsvpRecord` (new this phase) |
| `originGuestId` binding | `LiveGuestInvitationCoordinator.presentedGuestId`/`activeWeddingSlug` — same capture-at-presentation-time contract |
| RSVP form UI | `LiveGuestInvitationView.swift`'s `LiveRsvpFormView` (new this phase) — field-for-field parity with Android's `LiveRsvpForm` and the PWA's dialog |
| Invitation style | Same GET-response-only source; no deep-link override |

---

## 7. Policy / error semantics (all three clients, one contract)

| Server response | Meaning | Native handling |
| --- | --- | --- |
| `200` | Saved | Full `GuestRsvpRecord` parsed as authoritative truth; both native coordinators then re-read (`refresh()`) rather than trusting the local edit |
| `409 STALE_GUEST_CONTEXT` | The presented card no longer matches the resolved guest (switched account, expired/rotated session) | `RsvpOutcome.ReopenRequired` / `.reopenRequired` — no silent retry against the new guest; the person is told to reopen the current invitation |
| `400 CHILDREN_NOT_ALLOWED` | Adults-only policy refused a `kidsAttending: true` request | `RsvpOutcome.ChildrenNotAllowed` / `.childrenNotAllowed` — a distinct message, never folded into the stale-context notice (a Phase 9 fix: it previously was, on both platforms) |
| `401` | Session invalid/expired | `RsvpOutcome.ReopenRequired` / `.reopenRequired` |
| other/transport failure | Unreachable | `RsvpOutcome.Unavailable` / `.unavailable(status:)` — distinguishable from a refusal |

---

## 8. Invitation design authority (§10)

`Wedding.invitationCardStyle` (normalized via `normalizeInvitationCardStyle`, `src/lib/digital-invitation-card.ts`)
is authoritative for all 12 supported styles. `resolvePersonalInvitation` (the `/invite/[slug]`
redeem path) accepts a `requestedCard` parameter but never reads it — the returned `card` is always
`normalizeInvitationCardStyle(wedding.invitationCardStyle)`. `GET /api/weddings/[slug]/guest-session`
never accepts a style parameter at all. Proven end-to-end for every supported style (disposable-DB
integration test, `src/lib/guest-rsvp-convergence.integration.test.ts`).

---

## 9. Explicitly unchanged this phase

- The explicit-card-first (`splash → card`) and returning-guest (`Home first`) navigation flows —
  no navigation/entry code was touched.
- The "My Digital Invitation" tab reopening the same configured card.
- Invitation motion/the 12 supported invitation designs' visual presentation.
- Guest Session v2's credential model, fingerprint invalidation/rotation behavior.
- `songRequests` (see §2) and every other Admin/Vendor/Contracts domain from Phase 8.

See the completion report for this phase for exact qualified/final SHAs, temporary reviewer-CI run
ids, and the explicit Preview-vs-Production deployment confirmation. This document records
classification and reasoning; it does not itself declare the phase accepted.
