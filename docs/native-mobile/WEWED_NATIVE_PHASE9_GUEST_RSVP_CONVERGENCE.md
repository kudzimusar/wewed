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

### RSVP reachability & pre-open server refresh across response statuses

In accordance with PWA parity and independent moderator review findings, RSVP editing remains accessible across all response statuses on native Android and iOS, and strictly refreshes server truth before the editor can open:
- **`PENDING` -> RSVP editable:** Action label is displayed as `"RSVP"`. Tapping triggers pre-open server refresh before opening the editor sheet.
- **`ACCEPTED` -> RSVP editable:** Action label is dynamically displayed as `"Update RSVP"`. Card displays confirmation badge (`RSVP confirmed`), while the action remains fully interactive and reachable. Tapping triggers pre-open server refresh before reopening the editor sheet.
- **`DECLINED` -> RSVP editable:** Action label is dynamically displayed as `"Update RSVP"`. Card displays status banner (`Response recorded — not attending`), while the action remains fully interactive and reachable. Tapping triggers pre-open server refresh before reopening the editor sheet.

#### Pre-open server refresh architecture
To prevent stale native client state from overwriting concurrent server/PWA edits (e.g., PWA changes meal from beef to vegan while native screen remains open), tapping RSVP / Update RSVP does not immediately open the editor sheet. Instead:
1. Native UI initiates `coordinator.prepareRsvpEdit(currentGuestId)`.
2. Fresh server snapshot is loaded directly via `client.loadInvitation(weddingSlug)`.
3. Snapshot identity is validated: `refreshedSnapshot.guestId == currentGuestId`.
4. On success:
   - Produces `RsvpEditPreparation.Ready(refreshedPresentation, presentingState)`.
   - Native screen updates its active presentation and binds `rsvpEditorPresentation = refreshedPresentation`.
   - Editor sheet opens bound exclusively to `rsvpEditorPresentation`. Stale enclosing state cannot leak into the form.
5. On failure, the editor does **NOT** open:
   - **`Unavailable(status)`:** Transport/network error. Preserves current card state, prevents opening a stale editor, and presents a retryable notice (`Unable to refresh invitation. Please check your connection and try again.`).
   - **`RevokedOrUnauthorized`:** Session expired or unauthorized (`401`). Editor does not open; routes to session-reopen required notice.
   - **`StaleOrReplacedGuest`:** Refreshed session belongs to a different guest ID (`409`). Editor does not open; routes to session-reopen required notice. No cross-guest overwrites or retry against another guest.

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
| Pre-open refresh | `LiveGuestInvitationCoordinator.prepareRsvpEditor()` -> `RsvpEditorPreparation` (`Ready(snapshot)`, `ReopenRequired`, `StaleOrReplacedGuest`, `Unavailable(status)`) — capture-before-I/O, compare-before-mutate; on `StaleOrReplacedGuest` the binding is left untouched |
| RSVP form UI | `LiveGuestInvitationScreen.kt`'s `LiveRsvpForm` bound to refreshed `rsvpEditorPresentation`. Action resolved via `resolveLiveInvitationActions` and `ivoryRsvpActionLabel` ("RSVP" while awaiting response, "Update RSVP" once answered), remaining reachable across PENDING, ACCEPTED, and DECLINED states. Network refresh failures surface `RefreshUnavailableNotice`; a stale-or-replaced guest surfaces a distinct `StaleOrReplacedGuestNotice`. |
| Invitation styles & engine | All 12 styles rendered natively: `IvoryFloralGoldNative` (dedicated) and `GenericMotionInvitationNative` (for the 11 generic styles). Contract generated into `GeneratedInvitationStyles.kt` from `src/lib/digital-invitation-card.ts`, including an explicit `InvitationRendererKind` (`IVORY_CUSTOM` / `GENERIC_MOTION`) per style. `NativeInvitationExperience` dispatches on `rendererFor(style)`, which reads that generated field — never a separate hardcoded `if style == ivory...`. |
| Invitation style source | `LiveInvitationPresentation.invitationCardStyle`, sourced exclusively from the GET response's `wedding.invitationCardStyle` — never from a deep-link parameter |

## 6. iOS mapping

| Server concept | Native type/symbol |
| --- | --- |
| Guest Session v2 identity | `GuestSessionClient` (`apps/ios/Wewed/Invitation/GuestSessionClient.swift`) — same Keychain-backed persistence contract as Android |
| RSVP write payload | `GuestRsvpUpdate` (new this phase) |
| RSVP read/write response | `GuestRsvpRecord` (new this phase) |
| `originGuestId` binding | `LiveGuestInvitationCoordinator.presentedGuestId`/`activeWeddingSlug` — same capture-at-presentation-time contract |
| Pre-open refresh | `LiveGuestInvitationCoordinator.prepareRsvpEditor()` -> `RsvpEditorPreparation` (`ready(snapshot:)`, `reopenRequired`, `staleOrReplacedGuest`, `unavailable(status:)`) — capture-before-I/O, compare-before-mutate; on `staleOrReplacedGuest` the binding is left untouched |
| RSVP form UI | `LiveGuestInvitationView.swift`'s `LiveRsvpFormView` bound to refreshed `rsvpEditorPresentation` (keyed with `.id(formSessionId)`). Action resolved via `resolveLiveInvitationActions` and `ivoryRsvpActionLabel`, remaining reachable across PENDING, ACCEPTED, and DECLINED states. Network refresh failures surface `refreshUnavailableAlert`; a stale-or-replaced guest surfaces a distinct `staleOrReplacedGuestView`. |
| Invitation styles & engine | All 12 styles rendered natively: `IvoryFloralGoldNative` (dedicated) and `GenericMotionInvitationNative` (for the 11 generic styles). Contract generated into `GeneratedInvitationStyles.swift` from `src/lib/digital-invitation-card.ts`, including an explicit `InvitationRendererKind` (`.ivoryCustom` / `.genericMotion`) per style. `NativeInvitationExperience` dispatches on `rendererFor(style)`, which reads that generated field — never a separate hardcoded `if style == ivory...`. |
| Invitation style source | Same GET-response-only source; no deep-link override |

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

## 8. Invitation design authority & 12-style native renderer matrix (§10)

`Wedding.invitationCardStyle` (normalized via `normalizeInvitationCardStyle`, `src/lib/digital-invitation-card.ts`)
is authoritative for all 12 supported styles. `resolvePersonalInvitation` (the `/invite/[slug]`
redeem path) accepts a `requestedCard` parameter but never reads it — the returned `card` is always
`normalizeInvitationCardStyle(wedding.invitationCardStyle)`. `GET /api/weddings/[slug]/guest-session`
never accepts a style parameter at all.

### Authoritative 12-style contract & single source of truth
The design contract is derived directly from `src/lib/digital-invitation-card.ts` using `mobile/contracts/generate_invitation_style_contract.py`, producing:
- `mobile/contracts/invitation-styles.json`
- `apps/android/app/src/main/java/pro/wewed/app/models/GeneratedInvitationStyles.kt`
- `apps/ios/Wewed/Models/GeneratedInvitationStyles.swift`

Extracting authoritative palettes (`stage`, `paper`, `ink`, `primary`, `accent`, `muted`), motion presets, and atmosphere presets from web source prevents divergent color or motion definitions.

#### Contract governance & fail-closed bidirectional validation
The contract generation and validation system enforces strict bidirectional set equality (`webStyleIds == NATIVE_RENDERERS`):
- **Fail-closed on new web styles:** If the PWA defines a style not explicitly approved in `NATIVE_RENDERERS`, the generator exits non-zero (`ContractValidationError: Web invitation styles missing native renderer approval: ...`), failing both generation and `--check` modes.
- **Fail-closed on removed web styles:** If a style is removed from the PWA but retained in `NATIVE_RENDERERS`, validation fails (`ContractValidationError: NATIVE_RENDERERS names styles the web does not define: ...`).
- **Strict rendererKind contract truth:** Invariant `nativeRenderer == true <-> rendererKind in {IVORY_CUSTOM, GENERIC_MOTION}` is enforced. Unsupported styles are never assigned `GENERIC_MOTION` (assigned `None`/null). Both Kotlin and Swift generators reject generating code for unsupported styles lacking a valid `rendererKind`.
- **Executable future-style regression suite:** `mobile/contracts/test_invitation_style_contract.py` runs in permanent CI (`.github/workflows/digital-invitation-experience-ci.yml`) and temporary qualification, asserting that synthetic 13th styles without native declarations fail closed.

### 12-style native renderer matrix

| Style ID | Name | Motion | Atmosphere | Native Android | Native iOS | RSVP Reachable | Initial State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ivory-floral-gold` | Ivory Floral Gold | `tri-fold` | `champagne-glow` | LIVE (`IvoryFloralGoldNative`) | LIVE (`IvoryFloralGoldNative`) | LIVE (PENDING, ACCEPTED, DECLINED) | Closed ceremony |
| `midnight` | Midnight Gold | `gate-fold` | `stars` | LIVE (`GenericMotionInvitationNative`) | LIVE (`GenericMotionInvitationNative`) | LIVE (PENDING, ACCEPTED, DECLINED) | Closed ceremony |
| `botanical` | Garden Romance | `floral-reveal` | `petals` | LIVE (`GenericMotionInvitationNative`) | LIVE (`GenericMotionInvitationNative`) | LIVE (PENDING, ACCEPTED, DECLINED) | Closed ceremony |
| `royal-emerald` | Royal Emerald | `envelope-letter` | `soft-bokeh` | LIVE (`GenericMotionInvitationNative`) | LIVE (`GenericMotionInvitationNative`) | LIVE (PENDING, ACCEPTED, DECLINED) | Closed ceremony |
| `classic-white` | Classic White | `book-open` | `minimal` | LIVE (`GenericMotionInvitationNative`) | LIVE (`GenericMotionInvitationNative`) | LIVE (PENDING, ACCEPTED, DECLINED) | Closed ceremony |
| `blush-romance` | Blush Romance | `envelope-letter` | `soft-bokeh` | LIVE (`GenericMotionInvitationNative`) | LIVE (`GenericMotionInvitationNative`) | LIVE (PENDING, ACCEPTED, DECLINED) | Closed ceremony |
| `african-luxe` | African Luxe | `gate-fold` | `candlelight` | LIVE (`GenericMotionInvitationNative`) | LIVE (`GenericMotionInvitationNative`) | LIVE (PENDING, ACCEPTED, DECLINED) | Closed ceremony |
| `editorial` | Modern Editorial | `single-card-lift` | `minimal` | LIVE (`GenericMotionInvitationNative`) | LIVE (`GenericMotionInvitationNative`) | LIVE (PENDING, ACCEPTED, DECLINED) | Closed ceremony |
| `black-tie` | Black Tie | `gate-fold` | `candlelight` | LIVE (`GenericMotionInvitationNative`) | LIVE (`GenericMotionInvitationNative`) | LIVE (PENDING, ACCEPTED, DECLINED) | Closed ceremony |
| `watercolour-garden` | Watercolour Garden | `floral-reveal` | `watercolour-bloom` | LIVE (`GenericMotionInvitationNative`) | LIVE (`GenericMotionInvitationNative`) | LIVE (PENDING, ACCEPTED, DECLINED) | Closed ceremony |
| `sunset-terracotta` | Sunset Terracotta | `sleeve-pull` | `soft-bokeh` | LIVE (`GenericMotionInvitationNative`) | LIVE (`GenericMotionInvitationNative`) | LIVE (PENDING, ACCEPTED, DECLINED) | Closed ceremony |
| `celestial` | Celestial | `book-open` | `stars` | LIVE (`GenericMotionInvitationNative`) | LIVE (`GenericMotionInvitationNative`) | LIVE (PENDING, ACCEPTED, DECLINED) | Closed ceremony |
| *(unknown future)* | Unknown Style | — | — | UNSUPPORTED / UPDATE REQUIRED | UNSUPPORTED / UPDATE REQUIRED | N/A | Fail-closed |

*Note: `botanical` (Garden Romance) serves as the authoritative server fallback style whenever a missing or invalid style is configured.*

### Real RSVP editor open flow
```text
tap
→ capture expectedSlug/expectedGuestId from the presentation binding (before any I/O)
→ client.loadInvitation(expectedSlug)   [never refresh()/load()/restoreRememberedGuest()]
→ compare refreshed snapshot identity against what was captured, BEFORE mutating any state
   ├─ identity match      → rebind to fresh snapshot → Ready → editor opens with server truth
   └─ identity mismatch   → StaleOrReplacedGuest → binding left untouched → editor does not open
                             (no rebind, no retry, no opening the replacement guest's editor)
```

---

## 9. Explicitly unchanged this phase

- The explicit-card-first (`splash → card`) and returning-guest (`Home first`) navigation flows —
  no navigation/entry code was touched.
- The "My Digital Invitation" tab reopening the same configured card.
- Guest Session v2's credential model, fingerprint invalidation/rotation behavior.
- `songRequests` (see §2) and every other Admin/Vendor/Contracts domain from Phase 8.

---

## 10. Checkpoint D-025 — Safe compare-before-rebind RSVP editor refresh and 12-style native parity (2026-09-23)

1. Round-2 RSVP multi-status reachability was valid.
2. Independent moderator review found the Round-2 "fresh server truth on reopen" claim was false:
   `key(presentation)`/`.id(UUID())` only reset UI state; no server GET occurred before editor opening.
3. Existing `coordinator.refresh()` could not safely be reused blindly because it rebinds
   `presentedGuestId` to whichever guest the current session resolves.
4. A compare-before-rebind editor preparation operation (`prepareRsvpEditor()`, 0 parameters) was implemented.
5. Independent moderator review also found native invitation parity was only 1/12 styles.
6. The shared generated PWA design contract and generic native motion engine were added.
7. All current 12 registry styles now render natively (12 × LIVE).
8. Unknown future styles remain fail-closed (`UNSUPPORTED / UPDATE REQUIRED`).

See the completion report for this phase for exact qualified/final SHAs, temporary reviewer-CI run
ids, and the explicit Preview-vs-Production deployment confirmation. This document records
classification and reasoning; it does not itself declare the phase accepted.


## Moderator acceptance (2026-09-23)

Phase 9 is **ACCEPTED** under master-plan Rule 10 after independent remote-code review and reviewer-owned closure patches.

Accepted evidence:
- server final head: `465feb3bbd3d4e2a6c57f95e689a94761513773f`;
- native reviewer final head: `dc33d7b483286d325dfb2b1c4e249710639e3a5f`;
- qualified Round-5 native product: `96792039b4548a7cce653c3cda4be85b93635e1e`;
- native qualification run: `35853500269` at temporary workflow commit `a94a8a30dc2f9d9213412e9d61ad0e8cd084fbc3`;
- retained server qualification: `35826332669` at `72f34663535d5fbbfbbb6bb79319ae69327a2994`.

Final reviewer closure also restored the permanent Digital Invitation workflow's repository checkout before the contract regression/`--check` steps. The reviewer-only CI patch did not alter product code.

Phase 10 (Usher/Gate authority) is authorized. Phase 11, production migration, production deployment, signing and distribution remain unauthorized.
