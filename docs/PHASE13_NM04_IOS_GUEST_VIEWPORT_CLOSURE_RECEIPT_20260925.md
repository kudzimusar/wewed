# PHASE 13 NM04 iOS GUEST VIEWPORT CLOSURE RECEIPT

## Assignment authority

- Assignment: **NM04**
- Master phase: **Phase 13**
- Scope: **iOS Guest viewport closure**
- Operating mode: implementation + source qualification + remediation.
- Governing plan: `WW-NATIVE-PWA-CONVERGENCE-2026-09-22-01`.
- Required governance read before source edits:
  - `docs/WEWED_IMPLEMENTATION_GOVERNANCE.md`
  - `docs/WEWED_NATIVE_PWA_PRODUCTION_CONVERGENCE_MASTER_PLAN.md`
  - `docs/PHASE13_NM03_FINAL_GUEST_UI_COMPOSITION_RECEIPT_20260925.md`

NM04 is a surgical repair of three device-observed iOS viewport defects. It does not redesign Guest architecture, Ivory, Pass, Android, backend or Phase 14.

## Exact baseline

| Authority | Branch | Required / verified SHA |
| --- | --- | --- |
| Native source | `native-mobile/phase13-final-guest-ui-composition-nm03-20260925` | `d388b00804360230ee6a1e6ee952ca22e5890a6f` |
| Backend, read-only | `backend/phase13-digital-invitation-convergence-nm01-20260925` | `55cadd944564cd717fe255aca2fed34230857238` |
| Production baseline | `main` | `ba4b08f8bca2d5cd5826e1ef1d2701d9049dd887` |
| NM03 source/CI-qualified implementation | — | `3aebc686799c7a075c0bf4c6bb136e217a7533aa` |

Continuation branch:

`native-mobile/phase13-ios-guest-viewport-closure-nm04-20260925`

The continuation branch was created directly from the exact NM03 clean SHA. No rebase onto another lineage was performed.

## Root cause

### IOS-RSVP-01 — P1

NM03 bounded the outer RSVP sheet to the device proposal, but the inner vertical ScrollView content still relied heavily on intrinsic width and `.frame(maxWidth: .infinity)`. Attendance chips, fields and nested stacks could therefore negotiate a width larger than the physical content area even while the decorative parent was bounded.

NM04 replaces that ambiguous proposal chain with concrete geometry:

```text
physical viewport width
→ RSVP outer inset
→ RSVP sheet width
→ RSVP internal horizontal padding
→ RSVP content width
→ exact equal attendance-choice widths
```

All non-carousel RSVP controls now consume the calculated content width.

### IOS-NOTE-01 — P1

NM03 calculated the Couple Note surface width, but `Text(note)` still used an effectively flexible width inside the decorated parent. A long authoritative message could express an excessive intrinsic width and push visible content/dismissal outside the iPhone viewport.

NM04 calculates both the surface width and the actual note text width. The complete note is fixed to that bounded text width and grows vertically.

### IOS-HOME-01 — P2

The Home countdown used four `guestCountdownTile` children with flexible maximum width. SwiftUI could let intrinsic number widths participate in layout negotiation, so one or more of the four cells could disappear on device.

NM04 measures the countdown row width, subtracts the three inter-tile spaces, divides the remainder by exactly four, and supplies that same fixed width to every cell.

## Geometry remediation

Presentation-only helper:

`GuestViewportGeometry`

is defined in the current iOS invitation presentation scope. It contains no identity, RSVP, Wedding Day, Ivory or Pass authority.

### RSVP modal width

```text
rsvpSheetWidth =
viewportWidth - (8pt outer inset × 2)
```

### RSVP content width

```text
rsvpContentWidth =
rsvpSheetWidth - (20pt internal padding × 2)
```

### RSVP attendance choice width

```text
attendanceChoiceWidth =
(rsvpContentWidth - 8pt inter-choice spacing) / 2
```

Both `Joyfully accept` and `Regretfully decline` receive this exact width.

Every root RSVP control uses `contentWidth`:

- heading container;
- Guest name;
- attendance row;
- plus-one toggle and fields;
- children controls;
- dietary notes;
- message to couple;
- submitting state;
- Save RSVP.

The root form remains `ScrollView(.vertical)`.

The **only** horizontal RSVP ScrollView is the bounded meal-option carousel.

### Couple Note width

```text
noteSurfaceWidth =
min(
    viewportWidth - (16pt outer inset × 2),
    420pt
)
```

### Couple Note text width

```text
noteTextWidth =
noteSurfaceWidth - (20pt internal padding × 2)
```

The authoritative note text is explicitly framed to `noteTextWidth`, remains multiline, preserves line spacing and uses vertical growth. The dismiss row is also constrained to the same width.

No note truncation, lineLimit(1), horizontal scroll or unreadable scale-down was introduced.

### Countdown tile width

The Home hero already provides the row its usable content width. NM04 now calculates:

```text
totalSpacing = 6pt × 3

tileWidth =
(rowWidth - totalSpacing) / 4
```

All four cells receive exactly `tileWidth`:

- Days;
- Hours;
- Mins;
- Secs.

Only the number text may sensibly compress inside its fixed cell if required; cells do not compete for width and the row does not horizontally scroll.

Representative width contracts cover:

`360, 375, 393, 402, 430`.

## Authority verification

NM04 does not change:

- Live Guest Session identity authority;
- `originGuestId` or stale-session protection;
- RSVP write authority through `LiveGuestInvitationCoordinator → GuestSessionClient → PUT /api/weddings/{slug}/guest-session`;
- `NativeInvitationExperience`;
- `IvoryFloralGoldNative`;
- Guest shell state machine;
- `/api/wedding-day/guest` authority;
- `/api/wedding-day/pass` authority;
- same-Guest checks;
- WW2 token format or asymmetric verification;
- `WeddingReferencePassView`;
- Pending / Attending / Declined product semantics.

Blob equality was independently checked between NM03 and NM04 for:

| Frozen iOS authority | NM03 blob | NM04 blob | Result |
| --- | --- | --- | --- |
| `IvoryFloralGoldNative.swift` | `cd8712128592ef95a33719550c2c85217f01b878` | same | unchanged |
| `NativeInvitationExperience.swift` | `4b898546b026524148d006b5a03a83b75f6d5905` | same | unchanged |
| `GuestOnlyInvitationShellView.swift` | `08093b93ac86941d540c007c73c23c24a81b0d72` | same | unchanged |
| `WeddingReferencePassView.swift` | `19491ab10b0dfa00b7cf09b43d7d6eae90207615` | same | unchanged |
| `GuestSessionClient.swift` | `44bc09ec6241efff643ff6bbf32428a40e738b42` | same | unchanged |

No alternate Pass, QR renderer, Guest identity path or server contract was introduced.

## Changed files

Permanent product changes:

- `apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift`
- `apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift`

Permanent targeted test addition:

- `apps/ios/Wewed/Tests/GuestViewportClosureTests.swift`

Required receipt:

- `docs/PHASE13_NM04_IOS_GUEST_VIEWPORT_CLOSURE_RECEIPT_20260925.md`

A temporary branch-local workflow was used for CI qualification and removed before final handoff.

No `apps/android/**`, backend, Prisma, production, Ivory, Pass, signing, store or qualification-fixture file is a permanent NM04 change.

## Tests

### Targeted regression coverage

`GuestViewportClosureTests.swift` proves:

- RSVP modal/content width is derived numerically from viewport width;
- attendance choices divide the bounded content width equally;
- representative iPhone widths fit;
- root RSVP scrolling is vertical;
- the meal selector is the only horizontal RSVP ScrollView;
- Save RSVP remains full-width within the bounded content;
- Couple Note surface and actual text width are viewport-derived;
- note text remains multiline and horizontally non-scrollable;
- explicit note dismiss remains present;
- countdown math partitions exactly four equal cells;
- Days, Hours, Mins and Secs are all wired to the same measured tile width.

Existing NM03/NM01 tests were not weakened.

### Required command

```bash
cd apps/ios
swift test
```

Result: **PASS**

CI receipt:

```text
Test Suite 'All tests' passed
Executed 457 tests, with 14 tests skipped and 0 failures (0 unexpected)
```

### iOS app compilation

```bash
cd apps/ios
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

Result: **PASS**

CI receipt:

```text
** BUILD SUCCEEDED **
```

Source/build qualification is not device visual certification.

## CI

Temporary workflow:

`.github/workflows/nm04-temporary-ios-viewport-qualification.yml`

It was used only because existing workflow branch filters did not automatically run on the NM04 continuation branch.

Authoritative successful qualification:

- workflow: **NM04 Temporary iOS Viewport Qualification**
- run ID: **36131916390**
- job ID: **108060903964**
- qualified SHA: `9a27e5ebc19a62ce4d7f68fc595891f8697cd99e`
- Swift tests: **PASS**
- XcodeGen project generation: **PASS**
- iOS simulator application build: **PASS**

The workflow was removed after qualification.

Workflow-cleanup commit:

`680d17f38af9a2d7b616f3878c3cf8c2eeb95c8b`

## Remaining findings

### P0

None discovered.

### P1

None known in source/build qualification after the three NM04 repairs.

Device rendering must still prove that the observed RSVP and Couple Note P1 defects are visually closed.

### P2

No remaining source-level blocker identified for the Home countdown.

Device rendering must still confirm all four cells are visible simultaneously.

### P3

No blocking cosmetic item recorded in NM04. Device review may identify minor cosmetic follow-ups without widening this source assignment.

### ENV

None blocking. Remote macOS CI executed both required gates successfully.

### EXT

The required iPhone visual regression is deliberately external to NM04 source qualification.

Later live-production-data parity, store/signing work and production activation remain out of scope.

## LNM handoff

Do **not** rerun Android.

Do **not** repeat the entire Guest journey yet.

Render exactly these five iOS screenshots from the NM04 build:

1. **Home**
   - show `Days | Hours | Mins | Secs` simultaneously;
   - no clipped cell/value.
2. **RSVP**
   - full `Will you be joining us?` heading visible;
   - full `Joyfully accept` and `Regretfully decline` controls visible;
   - all root fields stay inside viewport;
   - only meal choices may horizontally scroll;
   - Save RSVP visible.
3. **Couple Note**
   - complete authoritative note wraps across lines;
   - note remains centered;
   - dismiss control visible/tappable;
   - no horizontal bleed.
4. **Invitation**
   - regression guard only;
   - no black exposed host gutter;
   - no new horizontal clipping.
5. **Pass**
   - regression guard only;
   - canonical `WeddingReferencePassView` still renders correctly.

If those five screens pass, return evidence to the moderator for the next gate. NM04 itself makes no device visual-certification claim.
