# NM 02 Guest Presentation Convergence Receipt

## Baseline

- Repository: `kudzimusar/wewed`
- Source branch: `native-mobile/phase13-digital-invitation-convergence-nm01-20260925`
- Verified starting SHA: `0b6ecea642fd117c89370f424f10a0f60a84f5d1`
- Continuation branch: `native-mobile/phase13-guest-presentation-convergence-nm02-20260925`
- Qualified reference line: `native-mobile/wedding-identity-ui-20260918` at `e0fe259abe40fa74b5c7b350cc6b662a3918591b`
- Backend authority, read-only: `backend/phase13-digital-invitation-convergence-nm01-20260925` at `55cadd944564cd717fe255aca2fed34230857238`
- Production baseline, untouched: `main` at `ba4b08f8bca2d5cd5826e1ef1d2701d9049dd887`
- Source-qualified implementation SHA: `ff0258ce4a78e3a8e586e2e42ad02c3f846232ab`
- Temporary qualification-workflow cleanup commit: `00c38026d8b647cd5028f670a3b12b6b8ad486df`

No backend, production data, store configuration, AASA/assetlinks, signing, Guest Session semantics, RSVP authorization semantics, or WW2 cryptographic code was changed.

## Root Cause

Phase 13 had solved the difficult authority problem correctly: private invitation entry establishes a live Guest Session, Ivory renders from that authority, RSVP writes remain same-Guest bound, Wedding Day is guest-scoped, and an attending Guest receives the verified WW2 Wedding Pass.

The presentation layer had not converged at the same rate. `LiveGuestInvitationScreen/View` and `LiveGuestShell/View` introduced deliberately narrow live surfaces around that secure authority. Those surfaces were functionally correct but visually lighter than the native Wewed presentation already qualified in the September 18–20 lineage.

NM 02 therefore did not replace the live runtime. It connected that runtime to qualified presentation primitives.

## Presentation Reuse Map

| Surface | Old simplified implementation | Qualified/reference source reused | Final implementation |
| --- | --- | --- | --- |
| RSVP | Large generic live form over a dark scrim | Ivory stationery language, `WeddingIdentityPalette`, `WeddingBrandMark`, floral/ornament background, approved primary-button language | Same full live RSVP form inside an Ivory/champagne stationery sheet while the invitation remains contextual |
| Couple note | Plain rectangular modal | Ivory/floral stationery language and wedding brand mark | Rounded floral stationery note fed only by `invitationCardMessage` |
| Home | NM 01 partially converged hero plus lightweight facts | `WeddingReferenceHomeScreen/View`, approved media/brand/countdown/card language | Existing Guest-safe hero retained; facts/cards aligned to qualified Wewed surfaces |
| Pass | Live wrapper around issued pass | `WeddingReferencePassScreen/View` | Attending route renders the existing qualified Pass directly with the real verified WW2 credential |
| Wedding Day | Plain headings/text rows | `IASectionList`, `IACard`, `WeddingIdentityPalette` | Guest-scoped programme, announcements, party, table, admission, date and venue presented as approved Wewed IA cards |
| More / profile | Plain text/facts/buttons | `IASectionList`, `IACard`, wedding identity palette | Guest-authorized profile/details, invitation, couple site, story and forget-device action in approved Wewed cards |
| Bottom navigation | Lightweight Guest-specific bar | `RoleShellScaffold` palette, icon language, selected state and touch sizing | Same five Guest destinations with IvorySoft/hairline treatment, ChampagneDeep selection and qualified icon language |

Historical comparison included the September 18–20 native hardening lineage for Home hero placement/order, responsive sizing, live media/countdown, Pass QR/scanner parity, floral density and role-shell consistency. Existing solutions were reused rather than recreated.

## Authority/Data Map

| Surface | Presentation | Live authority | Explicitly not used |
| --- | --- | --- | --- |
| Invitation / RSVP | `NativeInvitationExperience` + `IvoryFloralGoldNative` + remediated live RSVP sheet | `LiveInvitationPresentation` / `LiveGuestInvitationCoordinator` / Guest Session | Couple repository, Shadow authority |
| Couple note | Ivory stationery treatment | `LiveInvitationPresentation.invitationCardMessage` | Invented note content |
| Home | Reference Home visual language | `LiveInvitationPresentation` | Planner Tasks, Budget, Vendors, full Guest list |
| Pass | `WeddingReferencePassScreen/View` | `coordinator.weddingPass(guestId)` → `/api/wedding-day/pass` → same-Guest + attending check → WW2 asymmetric verification | Alternate QR/token/pass implementation |
| Wedding Day | `IASectionList` / `IACard` | `coordinator.weddingDay(guestId)` → `/api/wedding-day/guest` | Couple Wedding Day operations |
| More / profile | `IASectionList` / `IACard` | `LiveInvitationPresentation` plus guest-authorized published wedding story | Account/admin/planner controls |
| Navigation | Role-shell presentation language | Local `GuestSection` + already-authorized live shell state | Role/Couple entitlement repository |

## Android Changes

### `LiveGuestInvitationScreen.kt`

- Preserved `NativeInvitationExperience` and the canonical Ivory dispatcher.
- Preserved all existing RSVP fields and `GuestRsvpUpdate` semantics.
- Re-presented RSVP as a rounded IvorySoft/champagne sheet using:
  - `WeddingOrnamentBackdrop`;
  - `WeddingBrandMark`;
  - serif heading treatment;
  - Forest/ForestSoft selected controls;
  - approved Wewed primary-action treatment.
- Re-presented the authoritative couple note as floral wedding stationery.
- No Guest credential, Guest Session, RSVP endpoint or state-machine change.

### `LiveGuestShell.kt`

- Preserved exact IA: `Home | Invitation | Pass | Wedding Day | More`.
- Aligned bottom navigation with the qualified role shell:
  - IvorySoft surface;
  - hairline divider;
  - ChampagneDeep selected state;
  - Muted unselected state;
  - transparent indicator;
  - qualified icon mappings including MailOutline, Celebration and ManageAccounts.
- Retained the NM 01 Guest-safe Home hero and upgraded supporting fact cards.
- Re-presented Wedding Day with `IASectionList` / `IACard`.
- Re-presented More/profile with `IASectionList` / `IACard`.
- Attending Pass still routes directly to `WeddingReferencePassScreen`.
- Declined Pass still exposes no QR and retains the route back to Invitation.

## iOS Changes

### `LiveGuestInvitationView.swift`

- Preserved `NativeInvitationExperience` and canonical Ivory routing.
- Preserved all existing RSVP fields and mutation semantics.
- Re-presented RSVP with `WeddingFloralBackground`, `WeddingBrandMark`, Ivory/champagne surfaces and `WeddingPrimaryButtonLabel`.
- Re-presented the authoritative couple note as wedding stationery.
- Kept the implementation Swift-package portable; no unguarded UIKit-only dependency was introduced.

### `LiveGuestShellView.swift`

- Preserved exact five-destination Guest IA.
- Aligned the bar with qualified role-shell icon/palette/touch treatment.
- Retained the NM 01 Guest-safe Home hero.
- Reused `WeddingSectionCard`, `IASectionList` and `IACard`.
- Re-presented Wedding Day and More/profile with the same Wewed component language.
- Attending Pass still routes directly to `WeddingReferencePassView`.
- Declined Pass still renders no admission QR.

## RSVP Convergence

The RSVP presentation changed; the contract did not.

The form still carries the authoritative existing field set:

- attending / declining;
- meal choice;
- plus one;
- plus-one name;
- plus-one meal;
- children attendance/count where policy permits;
- dietary/access notes;
- message to the couple.

Pending/attending/declined state semantics are unchanged. The invitation remains the pending Guest's only application surface until an authoritative RSVP answer exists.

## Note Convergence

The note still appears only when `invitationCardMessage` is present. No fallback couple-authored content was invented.

The visual treatment now uses the same floral/ivory/champagne/serif language as the invitation instead of a generic rectangular alert.

## Home Convergence

The existing NM 01 Guest Home was not discarded. Its already-converged elements remain:

- wedding hero media;
- Wewed brand mark;
- serif couple identity;
- date;
- live countdown;
- personalized Guest greeting;
- strong My Digital Invitation destination.

Supporting Guest facts now sit in the same approved card language used elsewhere in native Wewed.

No Couple planning controls or Couple repository data were introduced.

## Pass Convergence

No Pass implementation was created.

The attending Guest route continues to load the pass through the existing live coordinator and renders:

- Android: `WeddingReferencePassScreen`;
- iOS: `WeddingReferencePassView`.

The underlying Guest Session clients were not modified. Their existing same-Guest, attending-only, `/api/wedding-day/pass`, `WW2.` and asymmetric public-key verification rules remain the credential authority.

Declined Guests receive the existing no-admission explanation and no QR.

## Wedding Day Convergence

Authority remains the existing guest-scoped `/api/wedding-day/guest` path.

The presentation now uses approved Wewed list/card primitives for:

- programme;
- announcements when authorized;
- party details when authorized;
- table;
- check-in/admission state when authorized;
- date and venue.

No Couple Wedding Day operational controls or new backend fields were introduced.

## More/Profile Convergence

The existing Guest-authorized information remains the only source:

- Guest name;
- wedding;
- RSVP state;
- meal;
- plus one;
- children;
- dietary/access notes;
- Guest message;
- table;
- published wedding story;
- digital invitation;
- couple website;
- forget-this-wedding-on-this-device action.

Those items are now presented with `IASectionList` / `IACard` rather than plain text rows.

## Navigation Convergence

The finalized IA is unchanged:

`Home | Invitation | Pass | Wedding Day | More`

Android and iOS now mirror the approved role-shell treatment more closely for icon language, selected state, IvorySoft background, ChampagneDeep accent, typography and practical touch sizing.

Invitation still reopens the live invitation path and canonical Ivory renderer. No third navigation system was introduced.

## Security Boundary Verification

Blob-SHA comparison against the NM 01 baseline confirmed these authority-critical files are unchanged:

- Android `NativeInvitationExperience.kt`;
- Android `IvoryFloralGoldNative.kt`;
- Android `WeddingReferencePassScreen.kt`;
- Android `GuestSessionClient.kt`;
- iOS `NativeInvitationExperience.swift`;
- iOS `IvoryFloralGoldNative.swift`;
- iOS `WeddingReferencePassView.swift`;
- iOS `GuestSessionClient.swift`.

Dedicated NM 02 regression tests also pin:

- exactly five Guest destinations;
- pending cannot enter persistent Guest Home;
- attending and declined answered states can enter the persistent app according to existing policy;
- attending Pass uses the canonical WeddingReferencePass;
- declined Pass contains no QR;
- Live Guest does not bind `WeddingGraphState`, Couple repository accessors, Budget, Tasks, Vendors or full Guest-list authority;
- no duplicate QR renderer is introduced;
- Invitation continues through the live canonical Ivory path;
- full RSVP field coverage is retained;
- the note remains bound to `invitationCardMessage`.

## Tests and Build Results

A temporary branch-only workflow was used because the normal workflow branch filters do not target the NM 02 continuation branch. The workflow was removed after qualification and is not part of the final product tree.

### Authoritative final qualification

GitHub Actions run: **36098079361**

Qualified code SHA: `ff0258ce4a78e3a8e586e2e42ad02c3f846232ab`

Android command:

```bash
cd apps/android
./gradlew testDebugUnitTest assembleDebug --no-daemon --stacktrace
```

Result:

- **PASS**
- `:app:testDebugUnitTest` completed.
- `:app:assembleDebug` completed.
- `BUILD SUCCESSFUL in 2m 40s`.

iOS command:

```bash
cd apps/ios
swift test
```

Result:

- **PASS**
- `GuestPresentationConvergenceTests`: 5/5 passed.
- Full Swift package suite: **446 tests executed, 14 skipped, 0 failures**.
- `Test Suite 'All tests' passed`.

### Qualification repair history

The first temporary run exposed one source-level Android import defect: `BorderStroke` was referenced without its Compose foundation import. That gap was patched before the authoritative final run. No unsafe workaround was used.

## Remaining Findings

- No P0 authority/identity defect discovered in NM 02 scope.
- No backend contract defect discovered.
- No unresolved P1 presentation-convergence blocker remains in source.
- No known P2 inconsistency identified that requires widening the assignment.
- True Android/iOS device presentation behavior remains intentionally unclaimed by NM 02 and belongs to later moderator-controlled runtime qualification.

## External Blockers

- App Store handoff/store configuration remains external to NM 02 and was not changed.
- Production configuration and signed-device/runtime certification were not required for this source-remediation assignment and were not attempted.

Neither item blocks the NM 02 source convergence implemented here.

## Final SHAs

- NM 02 starting native SHA: `0b6ecea642fd117c89370f424f10a0f60a84f5d1`
- Qualified reference SHA: `e0fe259abe40fa74b5c7b350cc6b662a3918591b`
- Backend read-only authority SHA: `55cadd944564cd717fe255aca2fed34230857238`
- Production baseline SHA: `ba4b08f8bca2d5cd5826e1ef1d2701d9049dd887`
- Source-qualified NM 02 implementation SHA: `ff0258ce4a78e3a8e586e2e42ad02c3f846232ab`
- Temporary workflow removal SHA: `00c38026d8b647cd5028f670a3b12b6b8ad486df`
- The exact continuation-branch tip containing this receipt is reported in the moderator handoff, because a commit cannot self-reference its own SHA.

## Moderator Handoff

Review branch:

`native-mobile/phase13-guest-presentation-convergence-nm02-20260925`

The branch is source-qualified and contains no temporary CI workflow.

Review focus:

1. presentation-only convergence of RSVP/note;
2. Guest-safe reuse of Home/IA card language;
3. canonical WeddingReferencePass routing;
4. Wedding Day and More visual convergence;
5. five-tab role-shell presentation parity;
6. authority boundary tests.

No device/UAT or production certification is claimed by this receipt.
