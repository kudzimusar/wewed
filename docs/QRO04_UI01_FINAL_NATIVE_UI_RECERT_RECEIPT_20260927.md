# QRO04-UI01 — Final native UI re-certification + workspace selector closure: receipt (2026-09-27)

**Status: IMPLEMENTATION REPORT — NOT A MODERATOR ACCEPTANCE DECISION.** Decisions D-084 / D-085.

**Result: NOT PROVEN (partial).**

Proven on both platforms:
- the attending Guest uses the final Live Guest shell (Invitation → Pass → Wedding Day);
- the real C&K Guest enters on explicit `production_preview` (splash → ornate Ivory CLOSED → OPENING → OPEN → DETAILS);
- the real Planner reaches the production Planner shell;
- the raw/blue workspace selector is closed;
- Shadow and the TWA wrapper are excluded from product evidence.

Not proven:
- **7 of the 11 required GuestProfile final-surface tests fail.** They drive a *pending* synthetic Guest into the persistent shell through a Continue control that the final Ivory UI removed on 2026-09-25 (`28d80c55`), and the product deliberately withholds that route from pending Guests (§4.3). Whether the tests or the product contract is right is a product decision, returned to the moderator.
- **Gate UI is BLOCKED-ENV** (§9).

**C&K business-data writes: 0. Production writes: 0. Migrations: 0.**

## 1. Repository

| Item | Value |
| --- | --- |
| Starting point | `closure/phase13-qro04-pass-gate-ci-path-filter-20260927` @ `60c1af51ee8b8f863085d17e38009ae9ea52c3c0` (exact) |
| Branch | `closure/phase13-qro04-final-native-ui-recert-ui01-20260927` |
| Code commit | `5ef6c7a66461b8fc8f57a7601daa03d191b3cba4` |
| Final SHA | this receipt commit |
| QRO04 CI fix | preserved (`src/app/api/weddings/*/guest-session/**`) |

Known-good final files, byte-identical across `ba38a362`, `fa7284fd` and `60c1af51` before any edit:

| File | Blob |
| --- | --- |
| `LiveGuestShellView.swift` | `3b2f42f306` |
| `LiveGuestShell.kt` | `fb8b032991` |
| iOS `RoleWorkspaces.swift` | `283b8a1c56` |
| Android `RoleWorkspaces.kt` | `1a69abbf8c` |
| `RootView.swift` | `3028b12262` |
| `RootScreen.kt` | `7899358a6c` |

The Guest shells and role shells were not modified. `RootView.swift` received only a two-line additive change (passing authorized names to the selector). `RootScreen.kt` only swapped its selector call sites and removed the old selector implementations.

### Exact changed files (`60c1af51..5ef6c7a6`)

- `apps/ios/Wewed/Views/WorkspaceGrantPresentation.swift` (new): safe label resolution.
- `apps/ios/Wewed/Views/GrantSelectionView.swift`: Wewed redesign; labels via the presentation.
- `apps/ios/Wewed/Views/ContextSwitcherSheet.swift`: Wewed redesign, explicit Current; labels via the presentation.
- `apps/ios/Wewed/Views/RootView.swift`: +2 lines (vendor/business names to the selector).
- `apps/ios/Wewed/Tests/FinalNativeUiLaneRegressionTests.swift` (new, 7 tests).
- `apps/ios/GuestProfileUITests/GuestProfileUITests.swift`: classification header only.
- `apps/android/app/src/main/java/pro/wewed/app/ui/workspace/WorkspaceSelection.kt` (new): presentation, selector, switcher, card.
- `apps/android/app/src/main/java/pro/wewed/app/ui/RootScreen.kt`: call sites → new composables; old selector and switcher removed (+6/−117).
- `apps/android/app/src/test/java/pro/wewed/app/FinalNativeUiLaneRegressionTest.kt` (new, 5 tests).
- `apps/android/app/src/androidTest/java/pro/wewed/app/invitation/GuestProfileUiTests.kt`: classification header only.
- `mobile/contracts/final-native-ui-certification.json` (new): the certification manifest.
- `scripts/native-mobile/final-native-ui-certification.sh` (new): the runner.
- `scripts/native-mobile/guest-profile-ui-server.py`: **restored verbatim** from `cfd6f9b95`. It is the synthetic loopback server the final-surface tests require, and it was missing from the tree.
- `src/lib/native-ui-certification-lanes.test.ts` (new, 3 tests).

## 2. Classification

| System | Paths | Counts as product UI evidence? |
| --- | --- | --- |
| **Final native application** | `apps/ios/Wewed`, `apps/android/app` (`production_preview` lane; GuestProfile final-surface tests) | **Yes** |
| **Shadow test harness** | Switch Persona, Sanitized/Private Real Shadow, `DevelopmentPersona`, every `.maestro/**` flow launching `wewed_native_env: shadow*` (20 flows + private-real) | **No: SHADOW TEST ONLY** |
| **Legacy TWA wrapper** | top-level `android/` (Bubblewrap) | **No**. Not installed, launched or qualified. |

Nothing Shadow was run in this unit.

## 3. Devices, app IDs, lane

| Item | Value |
| --- | --- |
| iOS device | user-visible simulator "iPhone 18 Pro" `FC17FF48-A93F-48B3-9544-72356B1529B5`; the UAT app `pro.wewed.app.uatdev` stays installed and untouched |
| iOS app | `pro.wewed.app.dev` (DEBUG), built from this branch |
| Android device | `emulator-5554` |
| Android app | `pro.wewed.app.dev` (DEBUG), explicit component `pro.wewed.app.dev/pro.wewed.app.MainActivity`; `pro.wewed.app.uatdev` also claims `wewed://` and was never targeted |
| Live lane | explicit `WEWED_NATIVE_ENV` / `wewed_native_env` = **`production_preview`** |
| Preview origin | `https://wewed-jf9t9h8sz-11-11.vercel.app` (`dpl_GG31VmHJUcTeYorQy6EPBNmehhAn`, integration `fa7284fd`, read-only, no writable wedding configured) |

iOS link delivery used `XCUIApplication(bundleIdentifier: "pro.wewed.app.dev").open(url)`, so only the dev app could receive the invitation. The temporary UI tests that did this were not committed.

## 4. Gate 1 — final-surface GuestProfile tests (synthetic loopback server, real final components)

Server: the restored `scripts/native-mobile/guest-profile-ui-server.py` on `127.0.0.1:8768`. Confirmed to be the one answering ("Alex & Sam" / "UI Guest A"). An unrelated untracked `mobile/shadow/tools/qualification_server.py` owned by another process also listened on `*:8768` and was left untouched.

### 4.1 iOS (`xcodebuild test`, visible simulator)

| Test | Result |
| --- | --- |
| `testAttendingCardOpensServerPassAndWeddingDay` | **pass** (24.2 s; re-run 20.1 s) |
| `testProductionGuestOnlyLaunchSurvivesWithoutCrash` | **pass** |
| `testInvitationHomeReopenAndRelaunch` | fail: `invitation-continue` not found |
| `testProfileAndPassReturnToPreviousSurface` | fail: `invitation-continue` not found |
| `testPendingAndDeclinedDoNotGetPass` | fail: `invitation-continue` not found |

### 4.2 Android (`connectedDebugAndroidTest`, emulator)

| Test | Result |
| --- | --- |
| `GuestPassEligibilityTest.attendingCardOpensVerifiedServerPassAndWeddingDay` | **pass** |
| `GuestPassEligibilityTest.declinedHasNoAdmissionCredential` | **pass** |
| `GuestHomeDigitalInvitationTest.linkThenHomeThenSameInteractiveStationery` | fail: timeout (`invitation-continue`) |
| `GuestInvitationNavigationTest.secondInvitationReplacesFirstOnSameDevice` | fail: timeout (pending Guest held on the invitation) |
| `GuestInvitationNavigationTest.profileAndPassReturnToPreviousDestination` | fail: timeout (pending Guest held on the invitation) |
| `GuestPassEligibilityTest.pendingHasNoAdmissionCredential` | fail: timeout (pending Guest held on the invitation) |

### 4.3 Why they fail (evidence, not patched)

- `28d80c55` (2026-09-25, "make iOS Ivory viewport-driven and simplify gateway") removed the Ivory "Continue" control (`invitation-continue`).
- No Android main source has that tag.
- The coordinator contract asserts *"pending invitation must not expose a Continue transition"* (`LiveGuestInvitationCoordinatorTests`), and `GuestCapabilityPolicy.mayEnterPersistentExperience(attending:)` holds a **pending** Guest on the invitation.
- Every failing test starts a pending synthetic Guest and expects to reach Home, More or Pass without answering.
- Every test whose Guest is attending or declined passes.
- None of the failures entered Shadow.

**Moderator decision:** update these tests to the current pending-Guest contract, or change the product so pending Guests can enter the shell.

### 4.4 Visual proof, attending Guest (final shell)

Captured from the passing attending runs.

- **iOS:** Wewed splash → Ivory gateway (A | S) → OPEN "Alex & Sam" → DETAILS ("You're Invited": RSVP, Calendar, Venue, Gifts, Note) → "Loading Wedding Pass…" → **Wedding Pass** (UI Guest A, ATTENDING, QR, table Acacia) → **Wedding Day** (Programme, Venue & directions, Announcements, Arrival, My Party). Persistent bottom navigation **Home | Invitation | Pass | Wedding Day | More**.
- **Android:** the same sequence and the same bottom navigation.
- **Both:** no Sanitized Shadow, Private Real Shadow, Switch Persona, Shadow badge or G007/G011 anywhere.
- Screenshots are kept locally (synthetic data only).

## 5. Gate 2 — real Charity & Kudzie Guest on `production_preview` (read-only)

| | iOS | Android |
| --- | --- | --- |
| Entry | cold launch, dev app only, real invitation (stale `card=botanical` retained) | cold explicit component, same link |
| Result | **pass** (26.0 s): `invitation-trifold`, `invitation-style-ivory-floral-gold`, closed cover; no `premium-invitation-experience` (GenericMotion); OPENING → OPEN (closed cover gone, centre panel) → DETAILS; Guest Pass CTA reads "RSVP required" | **pass**: closed cover → centre panel with personalization → details and Guest Pass CTA |
| Negatives | no Sanitized/Private Real Shadow, Switch Persona, "Shadow", G007/G011, Botanical/Garden Romance, raw ISO date, persona picker or role shell | same. The only regex hit was the element ID `invitation-guest-personalization`, a false positive; screen text was clean. |

Visual states: ornate CLOSED ("C&K", "A special invitation awaits", "Tap to open") → OPENING → OPEN ("Wednesday · Dec 23 · 2026", Imba Manor) → DETAILS. These screenshots show the real Guest's name and are **not committed**.

The C&K Guest stayed **pending**, and no RSVP was changed to reach the shell.

## 6. Gate 3 — real Planner on `production_preview` (read-only)

- **Sign-in:** native sign-in on the read-only Preview. Native account routes perform no DB writes. Preview suppresses account bookkeeping, and there is no writable wedding.
- **Persona input ignored:** a deliberate `wewed_native_persona=attending_guest` launch input was passed on both platforms and had no effect.
- **Destination:** "Professional Planner", **Production**, Charity & Kudzie, **"Our Wedding Plan"**. Tabs Overview/Tasks/Budget/Guests/Vendors; bottom navigation Workspace | Clients | Daily Ops | Wedding Day | More.
- **Negatives:** no persona picker, no Shadow, no `sign-in-shadow-entry`. The persona button `role-switch-button` is absent in production, as designed.

## 7. Workspace selector — before / after

| | Before (`60c1af51`) | After (`5ef6c7a6`) |
| --- | --- | --- |
| iOS selector | "Choose a workspace"; first option **`planner-dea0757e-cc3d-42f6-a394-abf18e9cf742`**; default-blue text rows; blue "Sign out" link | "Choose your workspace": Wewed ivory cards, champagne edge, "PROFESSIONAL PLANNER" chip, serif forest titles, scope line; portfolio shown as **"Eleven Eleven Testing"** (authorized business name); outlined secondary "Sign out" |
| Android selector | same raw `planner-dea0757e-…` label; Material outlined buttons | same Wewed design and labels |
| Context switcher | raw `businessAccountId`/`grantId` fallbacks; default list/dialog styling | "Switch workspace": same cards, **"Current"** marker on the active workspace, champagne Close |
| Raw-identifier scan (visible labels) | iOS 1, Android 1 | **0 on every screen** (iOS: selector, switcher; Android: welcome, sign-in, selector, portfolio, switcher, Planner shell) |

Label rule, in order: wedding title → authorized vendor or business name → safe role name (`Planner Portfolio`, `Vendor Business`, `Coordinator Workspace`, `Our Wedding`, `Wewed Administration`). A "name" that is itself identifier-shaped is refused. No authority change: same `selectGrant` / `selectGateGrant`, same grant lists.

## 8. Regression protection

| Guard | iOS | Android |
| --- | --- | --- |
| `production_preview` → PRODUCTION | `testProductionPreviewResolvesTheProductionEnvironment` | `productionPreviewResolvesTheProductionEnvironment` |
| No DevelopmentPersona / Switch Persona / Shadow sign-in entry in production | `testProductionPreviewCannotApplyADevelopmentPersona`, `testProductionEnvironmentsNeverOfferPersonaSwitchingOrAShadowEntry`, `testPersonaPickerAndShadowEntryAreGatedOnPersonaSwitching` | `productionPreviewCannotApplyADevelopmentPersonaOrOfferTheShadowEntry` |
| Invitation-bound production Guest → Live Guest shell, never Shadow `GuestShell(View)` | `testInvitationBoundProductionGuestDispatchesToTheLiveGuestShell` | `invitationBoundProductionGuestDispatchesToTheLiveGuestShell` |
| Grant/context labels never fall back to IDs | `testGrantTitlesPreferHumanNamesAndNeverFallBackToIdentifiers`, `testSelectorAndSwitcherSourcesNeverRenderAGrantIdentifier` | `grantTitlesPreferHumanNamesAndNeverFallBackToIdentifiers`, `selectorAndSwitcherSourcesNeverRenderAGrantIdentifier` |
| Certification excludes Shadow automation and the `android/` TWA; GuestProfile classified FINAL NATIVE GUEST SURFACE | `src/lib/native-ui-certification-lanes.test.ts` (3 tests), `mobile/contracts/final-native-ui-certification.json`, `scripts/native-mobile/final-native-ui-certification.sh` | same |

## 9. Gate UI

**BLOCKED-ENV — no production-shaped disposable Gate account/authority visual harness exists.** No test, script or flow provides a synthetic operational Gate grant to the final native Gate components (a local server has no Supabase account path). Shadow Usher was not used. No real C&K Gate or operator was created. The accepted QRO04 WW2 cryptographic result is unaffected.

## 10. Unit, build and CI results

| Check | Result |
| --- | --- |
| iOS `swift test` | **530 / 0 failures** (523 + 7 new) |
| iOS Debug simulator build (via UI tests) and Release `iphoneos` unsigned build | **BUILD SUCCEEDED** |
| Android `testDebugUnitTest` | **509 / 0 failures / 0 skipped** (504 + 5 new) |
| Android `assembleDebug`, `assembleUat` | success |
| Android `assembleRelease` | compiles; **packaging requires the production upload key** (`WEWED_UPLOAD_*`), which this unit must not configure |
| Bun `native-ui-certification-lanes.test.ts` | 3 / 0 |
| Wedding Pass convergence CI | run **36296986503** on `5ef6c7a6`: **success**, every step green |

## 11. Safety accounting

- **C&K business-data writes: 0.** A read-only re-check after all runs shows the Guest state equals the certified pre-state (pending, Ivory, token sha256 `92277a97…`).
- **Production writes: 0. Migrations: 0.** No deploy, merge, env change, store action, Pass, Gate or check-in.
- **Production requests (disclosed):** one `GET /api/weddings/guest%2Dui/guest-session` → **404** on production (`dpl_ApFS83c3…`) at 04:20:21Z, from the *established* test `testProductionGuestOnlyLaunchSurvivesWithoutCrash`. It launches with `WEWED_NATIVE_ENV=production` right after the other GuestProfile tests have stored a synthetic `guest-ui` Guest session, so the production launch restores it and queries `wewed.pro`. It was a read with no write. **Recommended fix:** that test should clear the Guest session before its production-lane launch. Not patched here. All other qualification traffic reached only the Preview or loopback.
- **Simulator housekeeping:** to reach account sign-in on the visible phone, only the dev app's keychain rows (`FAKETEAMID.pro.wewed.app.dev`) were cleared. The UAT app was untouched.
- **Secrets:** credentials came from the owner's mode-600 file via literal parsers, supplied through the test-runner environment or `adb input`, never printed. XCTest result bundles (which can hold typed text) were deleted after screenshot export. The Admin file was not read. `WEWED_PARITY_ALLOW_PASS_GET` unset.

## 12. Observations for the moderator (not patched)

1. **Pending-Guest device lock-in.** A pending C&K Guest session restores the invitation on every launch, and "forget this wedding" is only reachable from the persistent shell, which pending Guests cannot enter. A Planner who opened a pending invitation on the same phone cannot reach account sign-in (observed on the visible simulator).
2. **`LoginView` identifier masking (iOS).** The container's `sign-in-root` identifier overrides `sign-in-email`, `sign-in-password` and `sign-in-submit`, so UI automation cannot address those fields.
3. **Raw ISO date on the Pass card.** The iOS and Android Wedding Pass cards show `2027-06-12` (synthetic data), while Wedding Day formats the date.
4. **Portfolio read-only workspace placeholder** ("Wewed workspace") still uses blue "Switch context"/"Sign out" links and shows raw permission keys (`account.manage, weddings.manage`). It is outside the selector scope. The Android Gate authority screen prints `Assignment: <id>`.

QRO04-UI01 NOT PROVEN — 7 of 11 required GuestProfile final-surface tests fail on the removed Ivory Continue / pending-Guest entry contract (attending, declined, C&K production_preview entry and Planner shell pass on iOS and Android; selector closed; Gate UI BLOCKED-ENV) — FINAL NATIVE UI NOT REPLACED BY SHADOW — 0 C&K WRITES — RETURNING TO MODERATOR.
