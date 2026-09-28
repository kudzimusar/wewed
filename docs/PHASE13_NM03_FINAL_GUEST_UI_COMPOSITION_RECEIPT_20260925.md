# PHASE 13 NM03 FINAL GUEST UI COMPOSITION RECEIPT

## 1. Assignment authority

- Master plan: `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01`
- Phase: **13 — final Guest UI composition closure**
- Assignment: **NM 03 — REMOTE IMPLEMENTATION / REMEDIATION**
- Governing repository documents read before product edits:
  - `docs/WEWED_IMPLEMENTATION_GOVERNANCE.md`
  - `docs/WEWED_NATIVE_PWA_PRODUCTION_CONVERGENCE_MASTER_PLAN.md`
  - `docs/PHASE13_NM02_GUEST_PRESENTATION_CONVERGENCE_RECEIPT_20260925.md`
- Scope remained the five NM03 goals only:
  1. responsive geometry;
  2. RoleShell/WeddingIdentity visual convergence;
  3. purposeful Guest IA separation;
  4. palette/icon/button normalization;
  5. simplified Ivory gateway actions.

NM03 does not claim device, production, store, or visual certification.

## 2. Exact baseline

Remote tips were independently re-fetched before editing and matched the assignment exactly:

| Authority | Branch / ref | Required SHA | Verified |
| --- | --- | --- | --- |
| Native source | `native-mobile/phase13-guest-presentation-convergence-nm02-20260925` | `fb7899f8a2cff4329163080e85efbae652bae403` | yes |
| Backend, read-only | `backend/phase13-digital-invitation-convergence-nm01-20260925` | `55cadd944564cd717fe255aca2fed34230857238` | yes |
| Production baseline | `main` | `ba4b08f8bca2d5cd5826e1ef1d2701d9049dd887` | yes |
| Qualified native visual reference | `native-mobile/wedding-identity-ui-20260918` | `e0fe259abe40fa74b5c7b350cc6b662a3918591b` | yes |

The continuation branch was created from the exact NM02 SHA.

## 3. Final branch and SHA

Branch:

`native-mobile/phase13-final-guest-ui-composition-nm03-20260925`

Important immutable points:

- source baseline: `fb7899f8a2cff4329163080e85efbae652bae403`
- CI/source-qualified implementation: `3aebc686799c7a075c0bf4c6bb136e217a7533aa`
- temporary qualification workflow removal: `bf540dad8d39713b81ed9a154cf2af19677f3dfd`
- receipt commit: reported in the moderator handoff because a commit cannot contain its own SHA.

No merge to `main` was performed.

## 4. Moderator visual finding being remediated

The moderator rejected the earlier visual-certification conclusion after direct screenshot review. NM03 remediates the source-level causes identified in that review:

- Ivory could shrink from available height, producing a narrow card with black host gutters;
- iOS Guest surfaces could exceed the device viewport horizontally;
- Couple Note and RSVP composition did not sufficiently constrain content to narrow phones;
- reopened Invitation could be visually compressed by persistent navigation;
- Ivory details ended with multiple tiny text actions instead of a deliberate gateway;
- Home, Pass, Wedding Day and More repeated profile/fact information instead of owning distinct jobs;
- default/system link treatment and unrelated green accents could appear in Guest presentation;
- bottom navigation required stronger viewport anchoring on iOS.

## 5. Source-of-truth architecture

NM03 changed presentation only. Authority remains:

```text
private invitation entry
→ Live Guest Session
→ same Guest identity
→ Ivory invitation / RSVP
→ authoritative RSVP refresh
→ answered Guest shell
→ guest-scoped Wedding Day
→ attending-only /api/wedding-day/pass
→ WW2 asymmetric verification
→ WeddingReferencePass
```

NM03 did not introduce `WeddingGraphState`, Couple/Planner repositories, Budget, Tasks, Vendors, full Guest-list authority, or a Shadow authority into the live Guest path.

## 6. Reference lineage map

| Final surface | Data authority | Visual authority | Canonical component / composition |
| --- | --- | --- | --- |
| Invitation | Live Guest Session | Ivory | `IvoryFloralGoldNative` through `NativeInvitationExperience` |
| RSVP | Live Guest Session | Ivory / Wewed wedding identity | live RSVP sheet |
| Home | Live Guest Session + guest-scoped Wedding Day highlights | RoleShell / WeddingIdentity | final Guest Home |
| Pass | WW2 | Wedding Pass | `WeddingReferencePassScreen` / `WeddingReferencePassView` |
| Wedding Day | guest-scoped Wedding Day | RoleShell / IA | final Guest Day |
| More | guest-safe published/session data | RoleShell / IA | final Guest More |

Forensic comparison used current NM02 and the `e0fe259a...` reference for:

- `RoleShellScaffold`;
- `RoleWorkspaceContent`;
- `IANavigationContract`;
- `WeddingIdentityStyle`;
- canonical Ivory and WeddingReferencePass presentation.

No RoleShell-wide source was changed.

## 7. Android implementation

Changed Android presentation:

- `LiveGuestInvitationScreen.kt`
  - Wewed-styled Back to My Wedding control;
  - bounded Couple Note;
  - equal-width attendance choices;
  - minimum practical touch heights;
  - champagne primary action treatment;
  - approved Forest retained only for selected/semantic state.
- `LiveGuestShell.kt`
  - final five-destination composition;
  - Home converted to orientation/actions/highlights;
  - canonical attending Pass routing preserved;
  - declined no-admission Pass redesigned as Wewed presentation with RSVP route;
  - Wedding Day reordered around programme and venue execution;
  - More converted from a profile wall into extras/help/legal/device settings;
  - bottom navigation remains exactly five destinations.
- `IvoryFloralGoldNative.kt`
  - viewport-width-driven card geometry;
  - warm Ivory exposed host;
  - vertical scrolling when authored card height exceeds application viewport;
  - final gateway reduced to View Invitation + Guest Pass.

## 8. iOS implementation

Changed iOS presentation:

- `LiveGuestInvitationView.swift`
  - safe-area Wewed Back to My Wedding affordance;
  - RSVP sheet explicitly sized from the proposed device viewport;
  - Couple Note explicitly sized from the proposed viewport;
  - form fields wrap/stay inside the sheet;
  - equal-width accept/decline controls;
  - explicit Wewed close control for Couple Note;
  - champagne primary treatment and approved Forest semantic selection.
- `LiveGuestShellView.swift`
  - root composition constrained by `GeometryReader` device width;
  - bottom navigation installed with `safeAreaInset(edge: .bottom)` and explicit viewport width;
  - Home / Pass / Wedding Day / More responsibilities separated;
  - Home consumes only immediate Guest-safe highlights/actions;
  - More is extras/settings, not a repeated detailed profile.
- `IvoryFloralGoldNative.swift`
  - viewport-width-driven scale;
  - warm Ivory host;
  - vertical ScrollView overflow instead of height shrink;
  - final two-action gateway.

## 9. Responsive geometry changes

| Surface | Android width policy | iOS width policy | Vertical policy |
| --- | --- | --- | --- |
| Ivory closed/open | viewport-driven | viewport-driven | scroll if required |
| Ivory details | viewport-driven | viewport-driven | scroll if required |
| RSVP | bounded viewport | bounded viewport | scroll |
| Note | bounded viewport | bounded viewport | wrap |
| Home | viewport | viewport | scroll |
| Pass | viewport | viewport | scroll |
| Wedding Day | viewport | viewport | scroll |
| More | viewport | viewport | scroll |
| Bottom nav | viewport fixed | viewport fixed | fixed |

Representative narrow widths are pinned by unit/source contracts: 360, 375, 393, 402 and 430 points/dp plus a wider 480 case that confirms the existing 430 card cap.

## 10. Ivory host/background changes

The physical Ivory artwork still retains its own authored internal dark/gold/ivory surfaces.

The application host around the card is now `WeddingIdentityPalette.Ivory/ivory`, not the dark `#15100B` stage. The dark `IvoryPalette.Stage` remains behind the physical artwork itself only.

Available height no longer determines card width.

The mobile rule is now:

```text
viewport width
→ min(width, authored max width)
→ derive height from 9 / 19.5 aspect
→ vertical scroll if the card exceeds available application height
```

## 11. RSVP changes

The authoritative RSVP model and mutation path are unchanged.

The form still carries:

- attendance;
- meal;
- plus one;
- plus-one name;
- plus-one meal;
- children attendance/count where permitted;
- dietary/access notes;
- message to the couple.

Presentation changes:

- bounded sheet width;
- vertical scrolling;
- equal-width attend/decline controls;
- practical touch sizes;
- no off-screen text fields;
- champagne primary Save RSVP action;
- Forest remains a semantic selected/success state, not a competing primary color system.

## 12. Couple Note changes

The Couple Note remains conditional on the authoritative `invitationCardMessage`.

No fallback couple-authored text was invented.

Both platforms now:

- bound the note to mobile viewport width;
- wrap long note content;
- keep the wedding Ivory/floral/champagne treatment;
- provide an explicit close affordance;
- preserve the invitation behind the modal.

## 13. Home information architecture

Home now answers: **what matters immediately when I open my wedding app?**

It contains:

- wedding hero identity and countdown;
- Directions to Venue;
- Wedding Pass status/action;
- My Digital Invitation;
- next published programme item when currently authorized;
- latest announcement when currently authorized.

It deliberately does not repeat detailed RSVP meal, dietary, plus-one, message, or table-profile fields.

## 14. Invitation information architecture

Invitation remains the personal wedding object and RSVP control surface.

It preserves:

- canonical `NativeInvitationExperience`;
- saved invitation style;
- Ivory when `ivory-floral-gold`;
- RSVP/update RSVP;
- calendar;
- venue;
- registry/contribution action;
- couple note;
- personal card state.

The final bottom gateway is no longer a list of every invitation capability.

## 15. Pass information architecture

Attending Guest:

```text
Pass tab
→ coordinator.weddingPass(guestId)
→ /api/wedding-day/pass
→ same guest + attending checks
→ WW2 verification
→ WeddingReferencePass
```

Declined Guest:

- no QR;
- polished no-admission explanation;
- invitation remains active;
- Update RSVP in Invitation remains available.

Pending Guest cannot enter the persistent Guest shell under the unchanged state machine.

## 16. Wedding Day information architecture

The final order is execution-oriented:

1. Programme;
2. Venue & directions;
3. Announcements;
4. Arrival — table/check-in when authorized;
5. My Party when authorized.

The view consumes only `/api/wedding-day/guest` through the live coordinator. No Couple wedding-day controls were added.

## 17. More information architecture

More is now **extras, help, legal and device relationship**, rather than a repeated profile page.

It can show:

- Our Story when published;
- Couple Website;
- Gift & Contribution Info;
- Help;
- Privacy & Legal;
- small subordinate My details summary;
- Forget this wedding on this device.

No Gallery destination was invented because no authoritative Guest gallery destination was established in NM03 source.

## 18. Bottom navigation / icons

The IA remains exactly:

`Home | Invitation | Pass | Wedding Day | More`

Android continues to use the qualified Material icon family and WeddingIdentity palette.

iOS uses the established SF Symbol mappings and now explicitly anchors the complete five-item bar to the GeometryReader viewport through a bottom safe-area inset.

Selected state is ChampagneDeep; unselected state is Muted; the host is IvorySoft.

## 19. Palette audit

Explicit changed-Guest-source audit:

```text
system blue instances remaining in Guest journey:
0

generic green primary actions remaining:
0
```

Justified semantic exceptions:

- `WeddingIdentityPalette.Forest/forest` remains for selected RSVP choices and semantic switch/success state;
- error red remains for actual policy/error messaging.

These are semantic state colors, not competing primary CTA colors.

## 20. Ivory CTA state matrix

| RSVP state | View Invitation | Guest Pass | Persistent Guest shell |
| --- | --- | --- | --- |
| Pending | available | locked → RSVP | unavailable |
| Attending | available | → Pass | available |
| Declined | available | → no-admission Pass | available |

The final Ivory gateway contains only:

- `View Invitation`;
- `Guest Pass`.

`Continue` and `Visit Couple Website` are no longer bottom gateway actions.

## 21. Guest identity / security invariants

Unchanged:

- Live Guest Session remains the identity authority;
- same Guest ID continues across Invitation, RSVP, Home, Pass, Wedding Day and More;
- `originGuestId` RSVP binding remains intact;
- stale/replaced Guest protection remains intact;
- pending Guest cannot enter the persistent Guest experience;
- declined Guest may enter the Guest shell but receives no venue credential;
- no RSVP token, Guest Session cookie, handoff secret or WW2 credential logging was introduced.

## 22. WW2 authority verification

NM03 did not modify Guest Session clients or pass cryptographic code.

The existing contract remains:

```text
refresh Guest Session
→ verify same Guest
→ require attending == true
→ /api/wedding-day/pass
→ returned guestId must match
→ token must begin WW2.
→ asymmetric public-key verification
→ WeddingReferencePass
```

No alternate QR renderer was introduced.

Regression tests continue to prohibit `QRCodeWriter`, `WeddingQRCodeView` and `QRCodeGenerator` in the live Guest shell.

## 23. Frozen-area verification

NM03 did not change:

- backend branch/contracts;
- production `main`;
- production data;
- Charity & Kudzie records;
- Play delivery;
- App Store delivery;
- AASA;
- assetlinks;
- signing;
- WW2 keys;
- Guest Session transport/credential semantics;
- role-wide RoleShell/RoleWorkspace/IANavigation source.

## 24. Changed-file list

Product source:

- `apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestInvitationScreen.kt`
- `apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestShell.kt`
- `apps/android/app/src/main/java/pro/wewed/app/ui/invitation/ivory/IvoryFloralGoldNative.kt`
- `apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift`
- `apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift`
- `apps/ios/Wewed/Views/Invitation/Ivory/IvoryFloralGoldNative.swift`

Tests:

- `apps/android/app/src/test/java/pro/wewed/app/navigation/GuestPresentationConvergenceTest.kt`
- `apps/android/app/src/test/java/pro/wewed/app/navigation/IvoryInvitationGeometryTest.kt`
- `apps/ios/Wewed/Tests/GuestPresentationConvergenceTests.swift`
- `apps/ios/Wewed/Tests/IvoryInvitationGeometryTests.swift`

Receipt:

- `docs/PHASE13_NM03_FINAL_GUEST_UI_COMPOSITION_RECEIPT_20260925.md`

A temporary branch-local workflow was used for remote qualification and removed before final handoff.

## 25. Tests added/changed

Android and iOS contract coverage now pins:

- representative narrow mobile widths;
- width-driven Ivory scale;
- height derived from authored aspect;
- warm host + vertical overflow behavior;
- no height-based card shrink;
- only View Invitation + Guest Pass in the final gateway;
- Pending/Attending/Declined Guest capability semantics;
- exact five-tab Guest IA;
- distinct Home, Wedding Day and More responsibilities;
- canonical WeddingReferencePass use;
- no Couple/Planner repository authority;
- no alternate QR implementation;
- no generic-green/system-blue Guest primary actions;
- iOS bottom navigation safe-area/viewport anchoring;
- full RSVP field contract and authoritative Couple Note binding.

## 26. CI commands and results

Android:

```bash
cd apps/android
./gradlew testDebugUnitTest assembleDebug --no-daemon --stacktrace
```

Result: **PASS**.

The GitHub Actions Android job completed:

- unit tests: PASS;
- debug application assembly: PASS.

iOS:

```bash
cd apps/ios
swift test
```

Result: **PASS**.

Additional macOS application compilation:

```bash
xcodegen generate --spec project.yml

xcodebuild \
  -project Wewed.xcodeproj \
  -scheme Wewed \
  -configuration Debug \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Result: **PASS**.

This proves source/build qualification only, not visual/device certification.

## 27. CI run IDs

Authoritative final NM03 source qualification:

- GitHub Actions run **36111595203**
- qualified SHA: `3aebc686799c7a075c0bf4c6bb136e217a7533aa`
- Android job: **SUCCESS**
- iOS Swift tests: **SUCCESS**
- iOS generated app project build for simulator: **SUCCESS**

Earlier runs were cancelled by the branch workflow's `cancel-in-progress` concurrency policy as newer commits were pushed; they are not qualification evidence.

The temporary workflow was removed after the successful run.

## 28. Findings repaired during implementation

### P1 — Ivory height-driven shrink / black gutters
Repaired by width-authoritative card sizing, warm host, derived height and vertical overflow.

### P1 — iOS horizontal overflow
Repaired by viewport-bounded shell, RSVP, Couple Note and bottom-navigation geometry.

### P1 — weak/tiny Ivory gateway
Repaired by two practical touch targets: View Invitation and Guest Pass.

### P1 — duplicated Guest destination responsibilities
Repaired by recomposing Home, Wedding Day and More around distinct jobs.

### P2 — inconsistent/default action treatment
Repaired by replacing visible default/system treatment with WeddingIdentity Champagne/Ivory/Ink styling and preserving Forest only for semantic state.

### P2 — declined Pass looked like a generic fact page
Repaired with a dedicated Wewed no-admission surface and an explicit RSVP-update route, without creating a credential.

No P0 authority/security defect was discovered during NM03.

## 29. Remaining findings

- No known P0 authority/security gap remains in NM03 source scope.
- No known P1 source-composition blocker remains after successful dual-platform CI.
- Source tests cannot certify actual rendered pixels, dynamic type combinations, keyboard behavior, safe-area differences on physical devices, or final screenshot quality.
- Store/signing/production issues are outside NM03 and remain external gates as defined by the master plan.

## 30. LNM visual-certification handoff

NM03 intentionally stops before device visual certification.

The next gate is the required narrow fourteen-screenshot acceptance set:

### Android
1. Home
2. Invitation
3. Pass
4. Wedding Day
5. More
6. RSVP
7. Couple Note

### iOS
1. Home
2. Invitation
3. Pass
4. Wedding Day
5. More
6. RSVP
7. Couple Note

Reviewer focus:

- no black exposed Ivory gutters;
- no horizontal clipping;
- no off-screen/partial navigation;
- no default blue links;
- gateway actions are practical touch targets;
- distinct five-tab responsibilities;
- canonical WeddingReferencePass;
- no Shadow/Couple/Planner data leakage;
- same visual family as RoleShell/WeddingIdentity/qualified native reference.

Only after those fourteen primary surfaces are accepted should the complete identity/pending/attending/declined qualification be repeated.

## 31. Stop condition

No NM03 stop condition was triggered.

- exact baseline was established;
- no backend change was required;
- no production mutation was required;
- no store/signing action was required;
- repository write/CI infrastructure succeeded;
- no unresolved architecture decision was required.

NM03 is therefore source-, CI- and build-qualified while explicitly **not** claiming device visual certification.
