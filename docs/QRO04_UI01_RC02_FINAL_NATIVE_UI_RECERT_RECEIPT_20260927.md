# QRO04-UI01-RC02 — Re-certification of PR #221 after moderator defect closure + Android safe-area fix (2026-09-27)

**Status: CERTIFICATION REPORT — NOT A MODERATOR ACCEPTANCE DECISION.**

**Recommended classification:**
- Guest/Planner final-native UI closure: **ACCEPTED**. Independently proven on the final SHA with green builds and tests plus runtime evidence, after the bounded fixes below.
- Gate final-native UI: **BLOCKED-ENV** (no production-shaped disposable Gate account/authority visual harness exists).

**Writes:** C&K business data 0 · production business data 0 · migrations 0. PR #221 was **not merged**.

## 1. Source

| Item | Value |
| --- | --- |
| Branch | `closure/phase13-qro04-ui01-m1-pending-contract-20260927` (PR #221, open) |
| Starting HEAD | `f8c5a074d970f360fbd47c602a5fe8b991d4b460` (exact; verified after fetch) |
| Intervening since RC01 | `119a08f6` Android `forgetGuest` via `GuestInvitationBootstrap`; `b0a4cc6b` iOS return-surface test; `44afcbe2` receipt; `3d0787d6` Android `RoleContextBar` `statusBarsPadding()`; `ccecb523` guard; `f8c5a074` receipt |
| Final tested SHA | **`acf00fd08c97bc57b977b7b1c10b9176f3128d00`** (worktree clean) |

## 2. Defects found during qualification and patched (bounded, as RC02 authorizes)

| Commit | Defect (demonstrated before editing) | Fix |
| --- | --- | --- |
| `45389998` | Android `profileAndPassReturnToPreviousDestination` still tapped the removed `guest-profile-digital-invitation` (same stale IA as the iOS test the moderator fixed). Two Android tests asserted exact `"UI Guest A"` although Guest Home greets `"Welcome, <name>"` since `742e0044`; exact matching also made the stale-Guest-A negative check vacuous. The warm-B check ran on the details view, which carries no name (recording showed B correctly on the OPEN card). | Test-only: mirror the iOS IA route (More → Invitation → Back → More; declined Pass → Invitation → Back → declined Pass); substring name matching; check B on the OPEN card; assert exactly 2 guest-session exchanges (A, then B). |
| `1dc4757f` | **Android system Back on the live RSVP form closed the whole app** (dropped to the launcher mid-RSVP; observed at runtime). | `BackHandler(enabled = !isSubmitting, onBack = onDismiss)`: Back closes the form like the scrim. |
| `f0d2912b` | **Android workspace selector and full-screen read-only workspace drew under the status bar/camera cutout** (runtime screenshot: "WEWED" and "Wewed workspace" collided with the clock and icons). iOS and Android read-only workspace showed wire values **"Planner · portfolio"**. | `statusBarsPadding()` + `navigationBarsPadding()` on the selector, and on the read-only workspace only where it is full-screen (portfolio landing, vendor engagement choice); content inside `RoleShellScaffold` unchanged. Human label "Professional Planner · All weddings in your portfolio" via `WorkspaceGrantPresentation`. |
| `acf00fd0` | **Planner "Invitations & QR" falsely stated "No scan destinations are configured for this wedding."** The production native data source never loads `QRDestination` rows (repository default `emptyList()`/`[]`, no native route), while C&K has an active printed-invitation destination (see §7). | Production shows an honest not-loaded state: "Printed-invitation and scan QR destinations are managed in Wewed on the web. The app does not load them yet." Shadow/fixture unchanged. |
| `5cb5b123`, `acf00fd0` | — | Regression guards: Android `FinalNativeUiLaneRegressionTest` (+4), iOS `FinalNativeUiLaneRegressionTests` (+2). |

## 3. Static / build qualification on the final SHA `acf00fd0`

| Command | Result |
| --- | --- |
| iOS `swift test` | **534 / 0 failures** |
| iOS `swift test --filter FinalNativeUiLaneRegressionTests` | **11 / 0** |
| iOS `xcodebuild … -configuration Debug -sdk iphonesimulator … build` | **BUILD SUCCEEDED** |
| iOS `xcodebuild … -configuration Release -sdk iphoneos CODE_SIGNING_ALLOWED=NO build` | **BUILD SUCCEEDED** |
| Android `./gradlew testDebugUnitTest` | **516 / 0 failures / 0 skipped** (`FinalNativeUiLaneRegressionTest` 12 / 0) |
| Android `./gradlew assembleDebug assembleUat` | **BUILD SUCCESSFUL** |
| Android `./gradlew compileReleaseKotlin compileReleaseJavaWithJavac` | **BUILD SUCCESSFUL** |
| Android `./gradlew assembleRelease` | stops at the signing boundary only ("Release packaging requires WEWED_UPLOAD_*"); not configured by design |
| `bun test src/lib/native-ui-certification-lanes.test.ts` | **4 / 0** |
| Wedding Pass convergence CI | runs `36303953227` (`f8c5a074`), `36307285208` (`5cb5b123`), `36307450410` (`acf00fd0`): **success** |

The Android compile blocker is closed by an actual successful build, not only by the removed symbol.

## 4. Final GuestProfile tests (real final components, synthetic loopback server) on `acf00fd0`

**iOS** (user-visible simulator "iPhone 18 Pro" `FC17FF48-…`, 08:52:45–08:56:01Z) — **5 / 5 pass**:
`testAttendingCardOpensServerPassAndWeddingDay` (Pass "Jun 12, 2027", no raw `2027-06-12`), `testInvitationHomeReopenAndRelaunch`, `testPendingAndDeclinedDoNotGetPass` (no Continue, no shell, `invitation-leave-wedding`, CTA → RSVP, no QR), `testProductionGuestOnlyLaunchSurvivesWithoutCrash`, and the repaired `testProfileAndPassReturnToPreviousSurface`.

**Android** (`emulator-5554`, `connectedDebugAndroidTest`) — **6 / 6 pass**:

| Test | Result | What it proves |
| --- | --- | --- |
| `linkThenHomeThenSameInteractiveStationery` | pass | Home reopens the same interactive invitation |
| `profileAndPassReturnToPreviousDestination` | pass | final IA return surfaces |
| `secondInvitationReplacesFirstOnSameDevice` | pass | warm B: splash restaged, B on the OPEN card, no leftover A text, **exactly 2 exchanges** |
| `pendingHasNoAdmissionCredential` | pass | invitation-bound, leave visible, CTA → RSVP, no QR |
| `declinedHasNoAdmissionCredential` | pass | persistent context, `live-guest-pass-declined`, no QR |
| `attendingCardOpensVerifiedServerPassAndWeddingDay` | pass | Pass QR, **"Jun 12, 2027"** not `2027-06-12`, Wedding Day |

## 5. Real C&K pending Guest — `production_preview`, read-only

Preview `https://wewed-jf9t9h8sz-11-11.vercel.app` (`dpl_GG31VmHJUcTeYorQy6EPBNmehhAn`). Apps `pro.wewed.app.dev`. Link delivery: iOS `XCUIApplication(bundleIdentifier:).open`; Android explicit component `pro.wewed.app.dev/pro.wewed.app.MainActivity`. `pro.wewed.app.uatdev` and the TWA wrapper were never targeted.

| Step | iOS | Android |
| --- | --- | --- |
| Remembered pending Guest on launch | reopened its invitation → Leave → **account workspace restored** | — |
| Link while Planner session present | ornate Ivory CLOSED (`invitation-style-ivory-floral-gold`, closed cover) | same |
| Persistent shell / Continue | absent / absent | absent / absent |
| "Not your invitation? Leave this wedding" | visible | visible (CLOSED and DETAILS) |
| Guest Pass CTA | "Guest Pass. RSVP required" → RSVP form, no QR | RSVP form, no QR |
| RSVP form dismissal (never saved) | scrim | **system Back** (after `1dc4757f`) |
| Leave this wedding | → **Planner workspace** ("Our Wedding Plan"); invitation gone | → **Planner workspace**; account-session store `wewed_secure_account_session_production_preview.xml` intact |
| Re-open same invitation | ornate Ivory CLOSED again | ornate Ivory CLOSED again |
| Shadow / Botanical / raw ISO date | none | none |

C&K state after all runs equals the certified pre-state (RSVP pending, `ivory-floral-gold`, Guest token sha256 `92277a97…`). The Preview received **no** `PUT` in the window. The real Guest's name appears on screenshots, which are therefore **not committed**.

## 6. Real Planner — `production_preview`, read-only

- **iOS runtime addressability.** `sign-in-root`, `sign-in-email` (TextField), `sign-in-password` (SecureTextField) and `sign-in-submit` (Button) each resolve independently. The root no longer masks its children.
- **Workspace selector ("Choose your workspace").** Wewed ivory/champagne cards; the portfolio is shown as "Eleven Eleven Testing", weddings by title; no raw grant or business IDs.
- **Portfolio read-only landing.** "Professional Planner · All weddings in your portfolio", "2 authorized capabilities" (no `account.manage, weddings.manage`), styled "Switch workspace" and "Sign out".
- **Switch workspace.** Every workspace named; **Current** marked.
- **Planner shell.** Professional Planner · **Production** · Charity & Kudzie · **Our Wedding Plan**; Overview/Tasks/Budget/Guests/Vendors; Workspace/Clients/Daily Ops/Wedding Day/More.
- **Scans.** No raw IDs, permission strings, Shadow or persona picker on any captured screen (iOS and Android).

### Android safe area (runtime, Pixel 8 emulator 1080×2400; status bar/cutout 0–132 px, gesture area 2337–2400 px)

| Surface | Measured | Result |
| --- | --- | --- |
| Planner role header | "Professional Planner" top 158, "Charity & Kudzie" 221–284, "Production" 190–253 | fully below the status bar; normal ~10 dp spacing; badge clear of system icons |
| Bottom navigation | bottom 2291 | above the gesture area |
| Workspace selector | "WEWED" top 206 (was inside the status bar before `f0d2912b`) | fixed |
| Portfolio read-only landing (second reachable role surface) | first content top 185 (was 53 before `f0d2912b`) | fixed |
| Invitations & QR (same role header) | header identical to the Planner shell | safe |

## 7. Invitations & QR — findings recorded separately

1. **Does the production graph have zero `QRDestination` records for C&K?** **No.** Read-only `GET /api/planner/guests/invitations/physical` on the Preview returned `configured: true`, `scanCount: 5` (176 invited). The code was not printed.
2. **Was the screen an honest real-data empty state?** **No.** The native production source never loads `QRDestination`, so "No scan destinations are configured" was false. Now fixed to an honest not-loaded state (`acf00fd0`, both platforms, runtime-verified).
3. **Is the saved invitation card style absent from this Planner surface?** **Yes** (`invitationCardStyle = null` at the route). Documented feature-parity gap; not redesigned here.

## 8. Production / Preview request accounting (07:40–09:01Z)

- **Production (`dpl_ApFS83c3…`).** **0** qualification requests: 0 to `/api/weddings/guest-ui/guest-session` (the old synthetic-residue leak stays fixed across both iOS GuestProfile runs), 0 C&K guest-session, 0 native. Traffic was other users' `/api/notifications/count`, cron jobs and public pages.
- **Integration Preview (`dpl_GG31…`).** All qualification traffic: native account/wedding GETs, C&K guest-session exchanges/reads, one physical-QR GET, sign-ins; **0 PUT**.

## 9. Gate

**BLOCKED-ENV — no production-shaped disposable Gate account/authority visual harness exists.** Shadow Usher not used; no real C&K Gate or operator created. The accepted QRO04 WW2 cryptographic/Gate backend result is unaffected.

## 10. Remaining feature-parity gaps (not defects of this closure)

- Native Planner does not load `QRDestination` rows or the saved invitation card style (needs a native read route).
- Portfolio read-only landing is a placeholder ("Detailed workspace data is enabled in the feature-parity phase").
- The moderator receipt `QRO04_UI01_RC01_MODERATOR_CLOSURE_RECEIPT_20260927.md` §1 contains literal `\n` sequences that break its table (cosmetic).

## 11. Safety

C&K writes 0; production business-data writes 0; migrations 0; no merge, deploy, env change, WW2 activation, Gate operator, check-in, store action or Admin credential. Credentials came from the owner's mode-600 file (literal parser; runner env / `adb input`), never printed. XCTest result bundles were deleted after screenshot export. Temporary UI tests were never committed. `WEWED_PARITY_ALLOW_PASS_GET` unset.

QRO04-UI01-RC02 GUEST/PLANNER FINAL NATIVE UI CLOSURE ACCEPTED (recommended) — PATCHED HEAD acf00fd0 GREEN ON IOS/ANDROID, ANDROID SAFE AREA PROVEN AT RUNTIME, PENDING ESCAPE KEEPS ACCOUNT, 0 PRODUCTION QUALIFICATION TRAFFIC — GATE VISUAL BLOCKED-ENV — 0 C&K WRITES — RETURNING TO MODERATOR.
