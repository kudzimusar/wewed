# NM 05 — iOS Guest UI Responsive / Overflow Root-Cause Closure Receipt

## 1. Starting state

- Repository: `kudzimusar/wewed`
- Accepted source branch: `native-mobile/phase13-ios-guest-viewport-closure-nm04-20260925`
- Required starting SHA: `3039439bd3e2911786849987fc37fc9f54ca8968`
- Verified remote starting SHA: `3039439bd3e2911786849987fc37fc9f54ca8968`
- Independent implementation branch: `native-mobile/phase13-ios-ui-overflow-closure-nm05-agent-20260925`
- Moderator experimental branch was not used, cherry-picked, or copied.
- Backend remained read-only at `55cadd944564cd717fe255aca2fed34230857238`.
- Production `main` remained at `ba4b08f8bca2d5cd5826e1ef1d2701d9049dd887`.

Execution in this session used the authoritative remote GitHub branch directly. No local worktree was used, so a local `git status --short` receipt is not available and is not represented as having been run.

## 2. Root cause

### Why the live Guest UI could become wider than the iPhone

The NM04 live Guest shell still duplicated viewport ownership:

1. the Guest shell created its own `GeometryReader`;
2. it manually installed a bottom safe-area/navigation layer;
3. descendants still received flexible or effectively unbounded proposals;
4. media used `scaledToFill` and `maxWidth: .infinity`;
5. clipping hid pixels after layout, but clipping did not prevent a greedy descendant from participating in an oversized intermediate proposal;
6. countdown and other descendants could therefore compute against a width different from the physical iPhone viewport.

The key failure was proposal propagation, not one bad countdown constant.

### Why Sanitized Shadow / RoleShell behaved better

The qualified RoleShell pattern establishes a single layout authority:

```text
physical SwiftUI proposal
→ WewedScreenContainer
→ exact published container width
→ bounded content/media
→ native TabView owns bottom safe area
```

This avoids parallel safe-area calculations and gives descendants one concrete width contract.

NM05 adopts that presentation/layout pattern only. Shadow data/repository authority was not imported into the live Guest experience.

## 3. Implementation

### `apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift`

- Replaced manual persistent Guest bottom navigation with native `TabView`.
- Wrapped each persistent Guest destination in `WewedScreenContainer`.
- Preserved the existing Guest state machine by binding `TabView` selection back to the established `onSelect` / `onOpenInvitation` callbacks.
- Removed the competing manual `safeAreaInset(edge: .bottom)` navigation implementation.
- Bound Home/Pass scroll content through `wewedBoundedWidth`.
- Bound Home hero media through the shared `wewedMedia` helper so `scaledToFill` cannot determine root width.
- Preserved canonical `WeddingReferencePassView`, Guest Session authority, Wedding Day data, and the same five Guest destinations.

### `apps/ios/Wewed/Views/Invitation/Ivory/IvoryFloralGoldNative.swift`

Dynamic invitation text now fits inside the authored card regions without rewriting authoritative values:

- couple names;
- monogram;
- tagline;
- invitation message;
- guest personalization;
- RSVP deadline;
- venue;
- venue address;
- city/country.

The implementation uses vertical `ViewThatFits` variants with smaller typography and multiline wrapping. It does not create a wider root view and does not delete data to obtain fitting.

Several Couple Note hotspot fixes were also made while exercising the real simulator harness so the authored Note region owns one deterministic native interaction path rather than overlapping/ambiguous gestures.

### Tests

- Added `GuestResponsiveRootClosureTests.swift`.
- Updated `GuestPresentationConvergenceTests.swift` to assert the native TabView / bounded-screen architecture.
- Updated `GuestViewportClosureTests.swift` so countdown tests no longer invent an expected viewport width from guessed padding.

## 4. Screen-by-screen defect status

| Surface | Original defect | Implemented correction | Simulator result | Screenshot path / status | Remaining concern |
| --- | --- | --- | --- | --- | --- |
| Home | root-width propagation could clip countdown/right edge; manual bottom bar competed with safe area | bounded WewedScreenContainer + bounded media + native TabView | live visual harness reached app launch/capture stage but did not complete artifact upload before closure | intended: `artifacts/phase13/nm05-ios-ui-overflow-closure-20260925/01_home.png`; **OPEN** | device visual evidence still required |
| RSVP | risk of root displacement from shell proposal; prior containment work depended on parent correctness | RSVP remains bounded, now receives bounded root proposal from shared container | source/build proven; visual artifact not completed | `02_rsvp.png` **OPEN** | device visual evidence required |
| Couple Note | containment plus ambiguous Note interaction during visual automation | bounded note retained; Note hotspot made a deterministic native interaction | simulator harness repeatedly exercised this path; no final uploaded screenshot set | `03_couple_note.png` **OPEN** | device visual evidence required |
| Invitation closed | dynamic authored text may overflow sensitive regions | responsive fitted dynamic text variants within authored regions | source/build proven; visual artifact not completed | `04_invitation_closed.png` **OPEN** | actual production strings still need visual review |
| Invitation details | dynamic tagline/venue/personalization may overflow; Note hit target ambiguity | responsive text fitting + deterministic Note interaction | source/build proven; visual artifact not completed | `05_invitation_details.png` **OPEN** | device visual evidence required |
| Pass | manual shell/nav safe-area geometry could affect canonical Pass presentation | native TabView safe-area ownership; canonical WeddingReferencePassView unchanged | source/build proven; visual artifact not completed | `06_pass.png` **OPEN** | device visual evidence required |
| Wedding Day | persistent shell could be horizontally displaced / bottom-nav compressed | bounded shared screen container + native TabView | source/build proven; visual artifact not completed | `07_wedding_day.png` **OPEN** | device visual evidence required |
| More | same shell/nav/root-width issue | bounded shared screen container + native TabView | source/build proven; visual artifact not completed | `08_more.png` **OPEN** | device visual evidence required |

The implementation-agent visual self-check was attempted through temporary GitHub Actions simulator harnesses using the real DEBUG live Guest shell. The latest visual evidence runs were still in the capture/launch stages and did not produce a completed eight-file artifact package before this task was closed to prevent another CI loop.

No visual defect is downgraded because compilation succeeded.

## 5. Special Home assertion

Source-level invariant now is:

```text
physical viewport
→ WewedScreenContainer
→ bounded Home content
→ bounded hero media
→ bounded countdown row
→ four equal countdown cells
```

The regression tests no longer infer the row width from arbitrary outer-padding arithmetic.

Final device evidence showing all four simultaneous labels:

`Days | Hours | Mins | Secs`

remains OPEN for moderator/LNM review.

## 6. Special navigation assertion

Persistent destinations remain exactly:

`Home | Invitation | Pass | Wedding Day | More`

Navigation now uses native iOS `TabView`, which owns the bottom safe area and home-indicator separation.

The manual Guest safe-area/tab-bar implementation was removed.

Actual final iPhone rendering of label treatment remains part of the open simulator/device visual review.

## 7. Special Ivory / ellipsis assertion

Repository/source investigation found no literal production/source string matching the screenshot fragment `"Forever & Always • 14..."`.

The authoritative trace remains:

```text
GuestInvitationSnapshot
→ LiveInvitationPresentation
→ IvoryInvitationData
→ IvoryFloralGoldNative
```

NM05 does not manufacture or strip ellipses and does not use `prefix(...)` to shorten authoritative content.

The temporary visual fixture intentionally exercised a long string:

`Forever & Always • 14 December 2026`

to stress the fitting path.

Because the actual owner/production Guest Session payload is not stored in this repository task context, the exact original owner screenshot source string cannot be independently proven from source alone. The final device pass must therefore confirm whether any visible production ellipsis is authored server content or presentation truncation.

## 8. Regression guards

Verified unchanged in authority/contract:

- splash → invitation sequencing;
- Pending RSVP gating;
- answered Guest access;
- Invitation destination semantics;
- live Guest Session identity authority;
- canonical Guest Pass authority;
- WW2 verification path;
- Wedding Day authority;
- Guest-only authority;
- production backend semantics;
- Android.

`WeddingReferencePassView` remains the Pass renderer and no competing QR/token authority was introduced.

## 9. Source-level test evidence

Authoritative qualification run on the final product-source tip before workflow cleanup:

- GitHub Actions run: **36205991671**
- qualified source SHA: `ce0a21f7c36e2f0aa20b72adf3f0aa1b888a361e`
- job: `iOS responsive source + app build`
- result: **SUCCESS**

Commands:

```bash
cd apps/ios
swift test
swift build

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

Results:

- `swift test`: **PASS**
- tests executed: **467**
- skipped: **14**
- failures: **0**
- `swift build`: **PASS**
- XcodeGen: **PASS**
- simulator application build: **PASS**
- receipt: `** BUILD SUCCEEDED **`

The product files did not change after `ce0a21f7...`; subsequent branch commits only removed temporary qualification workflows and add this receipt.

## 10. Visual self-check evidence

Visual automation was attempted through the real DEBUG live Guest entry, using temporary CI-only Guest Session fixtures and the canonical WW2 Pass path.

Relevant runs include:

- `36145085867` — failed earlier visual harness;
- `36205991713` — latest evidence lane reached **Capture Guest screens** but did not finish before workflow cleanup;
- `36205991803` — redundant fast lane still in launch/capture progression when the loop was terminated.

Temporary workflows were deliberately removed so the branch would stop spawning repeated simulator jobs.

No completed eight-screenshot package is claimed.

## 11. Git evidence

Branch:

`native-mobile/phase13-ios-ui-overflow-closure-nm05-agent-20260925`

Starting SHA:

`3039439bd3e2911786849987fc37fc9f54ca8968`

Final product-source qualified SHA:

`ce0a21f7c36e2f0aa20b72adf3f0aa1b888a361e`

Temporary-workflow cleanup tip before this receipt:

`df183e53ec5e7eaa9586021cc8281c82b58bc658`

Permanent tracked changes versus accepted NM04:

- `apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift`
- `apps/ios/Wewed/Views/Invitation/LiveGuestInvitationView.swift`
- `apps/ios/Wewed/Views/Invitation/Ivory/IvoryFloralGoldNative.swift`
- `apps/ios/Wewed/Tests/GuestResponsiveRootClosureTests.swift`
- `apps/ios/Wewed/Tests/GuestPresentationConvergenceTests.swift`
- `apps/ios/Wewed/Tests/GuestViewportClosureTests.swift`
- this receipt

Temporary NM05 workflow files are absent from the final branch.

No merge to `main`, production deployment, database mutation, signing/store action, backend change, or Android change was performed.

## 12. Risks / open items

### OPEN — visual certification

The eight required simulator/device screenshots are not claimed as complete. This remains the primary open item for the moderator.

### OPEN — actual owner invitation dynamic string

Source proves the UI no longer truncates by deleting or explicitly prefixing text and now fits dynamic values responsively. The exact owner-session string behind the screenshot fragment must still be checked against a real Guest Session payload during independent visual review.

### OPEN — native TabView final device label treatment

Source establishes native safe-area ownership and five destinations. Final device review must confirm the platform-selected icon/label appearance is understandable and sits fully above the home indicator.

### Not open

- compilation;
- Swift unit/source contracts;
- simulator app build;
- Guest Session authority;
- RSVP authority;
- WW2 Pass authority;
- Wedding Day authority;
- Android/backend/production boundaries.

## 13. Moderator handoff

Review the independent NM05 agent branch from accepted NM04.

Focus the next independent review on:

1. Home countdown: all four cells visible simultaneously;
2. bottom TabView position relative to the home indicator on Home/Pass/Wedding Day/More;
3. long live invitation tagline, names, venue and RSVP deadline;
4. Couple Note hit target and full message presentation;
5. canonical WeddingReferencePass under native TabView;
6. no horizontal displacement on all eight requested surfaces.

Do not infer device visual certification from the green build.

NM 05 IMPLEMENTATION COMPLETE — RETURNING TO MODERATOR FOR INDEPENDENT REVIEW.
