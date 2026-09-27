# QRO04-UI01 — Correct Final Native UI Re-Certification + Workspace Selector Closure

## Repository
`kudzimusar/wewed`

## Exact starting point

Source branch:
`closure/phase13-qro04-pass-gate-ci-path-filter-20260927`

Required HEAD:
`60c1af51ee8b8f863085d17e38009ae9ea52c3c0`

Create:
`closure/phase13-qro04-final-native-ui-recert-ui01-20260927`

Do not base from `main`.

Preserve the accepted QRO04 workflow fix in:
`.github/workflows/wedding-pass-convergence-ci.yml`

Moderator decisions:
- **D-084** — Shadow UI is not production UI evidence.
- **D-085** — the final native Guest UI was not lost; QRO04 diverged by launching the wrong test lane.

# 0. READ THIS FIRST — DO NOT REBUILD THE FINAL UI

The owner has already tested the final native Attending Guest experience multiple times.

Independent Git comparison proves these final native UI files are byte-identical between the last certified live Guest source `ba38a362`, QRO04 start `fa7284fd`, and QRO04 result `60c1af51`:

- iOS `apps/ios/Wewed/Views/Invitation/LiveGuestShellView.swift`
- Android `apps/android/app/src/main/java/pro/wewed/app/ui/invitation/LiveGuestShell.kt`
- iOS `apps/ios/Wewed/Views/Roles/RoleWorkspaces.swift`
- Android `apps/android/app/src/main/java/pro/wewed/app/ui/roles/RoleWorkspaces.kt`
- iOS `apps/ios/Wewed/Views/RootView.swift`
- Android `apps/android/app/src/main/java/pro/wewed/app/ui/RootScreen.kt`

**Do not redesign, replace, port, or merge Shadow UI into those final UI files.**

The objective is to reconnect qualification to the correct final-native runtime, then fix only concrete production-path UI defects.

# 1. KEEP THE THREE UI SYSTEMS SEPARATE

## A. FINAL NATIVE APPS — THIS IS THE PRODUCT WE ARE CERTIFYING

iOS:
`apps/ios/Wewed`

Android:
`apps/android/app`

### Final Guest path

iOS:
`GuestOnlyInvitationShellView -> LiveGuestInvitationView -> LiveGuestShellView`

Android:
`GuestOnlyInvitationShell -> LiveGuestInvitationScreen -> LiveGuestShell`

The canonical Guest journey is:

`Wewed splash -> approved ornate Ivory invitation -> RSVP/details -> persistent Guest shell`

Persistent Guest navigation:

`Home | Invitation | Pass | Wedding Day | More`

This is the UI authority for Guest acceptance.

### Final account-role path

Planner/Couple/Coordinator/Vendor/Admin use the production role-shell family in:
- iOS `RoleWorkspaces.swift`
- Android `RoleWorkspaces.kt`

For Planner:
- iOS `PlannerShellView`
- Android `PlannerShell`

The owner's polished `Professional Planner / Production / Our Wedding Plan` screenshot is the correct production visual family.

## B. SANITIZED / PRIVATE SHADOW — TEST HARNESS ONLY

Examples:
- `Switch Persona`
- `Sanitized Shadow`
- `Private Real Shadow`
- `Shadow Guest Test Role`
- `Shadow Usher Test Role`
- `DevelopmentPersona.attending_guest`

These are qualification/dev tools only.

They may still be tested as Shadow, but **they cannot satisfy any final native UI acceptance criterion in this unit**.

Do not use these files as final UI evidence:
- `.maestro/ios/ios-guest-pass-identity.yaml`
- `.maestro/native-guest-pass-identity.yaml`
- `.maestro/native-role-persona-switching.yaml`
- `.maestro/native-real-shadow.yaml`
- anything under `.maestro/private-real/`

unless the result is explicitly labeled `SHADOW TEST ONLY`.

## C. LEGACY ANDROID TWA/UAT WRAPPER — NOT THE NATIVE APP

Top-level:
`android/`

This is the Bubblewrap/Trusted Web Activity wrapper around web/PWA.

It is not:
`apps/android/app`

Do not use screenshots, APKs, launch behavior, or UI from top-level `android/` as proof of the final native Compose application.

# 2. EXACT REASON QRO04 SHOWED SANITIZED SHADOW

QRO04 used:
- `.maestro/ios/ios-guest-pass-identity.yaml`
- `.maestro/native-guest-pass-identity.yaml`

Those explicitly set:
`wewed_native_env: "shadow"`

That is why the owner saw the Shadow Guest screens.

Do not “fix” this by editing the final Guest shell.

The correction is:
**run the correct final-native test path.**

# 3. FIRST GATE — RE-PROVE THE EXISTING FINAL ATTENDING GUEST UI WITHOUT SHADOW

Before changing product UI, run the existing final-surface Guest UI tests.

## iOS

Use:
`apps/ios/GuestProfileUITests/GuestProfileUITests.swift`

This suite launches the real `GuestOnlyInvitationShellView` through the DEBUG-only loopback Guest UI server path.

Required tests include:
- `testInvitationHomeReopenAndRelaunch`
- `testProfileAndPassReturnToPreviousSurface`
- `testAttendingCardOpensServerPassAndWeddingDay`
- `testPendingAndDeclinedDoNotGetPass`
- `testProductionGuestOnlyLaunchSurvivesWithoutCrash`

For the attending test, capture visible evidence that the UI is the final Guest shell:
- no `Sanitized Shadow`;
- no `Switch Persona`;
- no role-shell Shadow badge;
- final bottom navigation;
- Pass surface;
- Wedding Day surface.

The loopback data is synthetic, but the UI components must be the real final Guest components.

## Android

Use:
`apps/android/app/src/androidTest/java/pro/wewed/app/invitation/GuestProfileUiTests.kt`

This file explicitly says:
`Real Compose surfaces + guest HTTP client; synthetic server, never Private Real.`

Run at minimum:
- `GuestHomeDigitalInvitationTest`
- `GuestInvitationNavigationTest`
- `GuestPassEligibilityTest.attendingCardOpensVerifiedServerPassAndWeddingDay`
- pending/declined Pass tests.

Capture visible evidence from the instrumentation run.

### HARD FAILURE

If either platform's attending-Guest final-surface test unexpectedly enters Shadow:
STOP and investigate the dispatcher/launch configuration.

Do not patch the UI until the misroute is understood.

# 4. SECOND GATE — RE-PROVE THE REAL C&K GUEST ENTRY ON PRODUCTION_PREVIEW

Use the existing real C&K invitation credential from the owner's secure local file.

Do not print it.

Use explicit:
`production_preview`

Never omit the environment.

Never use:
`shadow`
`sanitized_shadow`
`private_real_shadow`.

Use the current read-only integration Preview.

## iOS real Guest

Build/install:
`apps/ios/Wewed`
DEBUG `pro.wewed.app.dev`.

Prove before launch:
- exact branch SHA;
- app bundle id;
- exact Preview origin;
- `WEWED_NATIVE_ENV=production_preview`;
- no other `wewed://` handler if possible.

Launch the real private invitation.

Required visible sequence:
`Wewed splash -> ornate Ivory CLOSED -> OPENING -> OPEN -> DETAILS`

Required negative assertions:
- no `Sanitized Shadow`;
- no `Private Real Shadow`;
- no `Switch Persona`;
- no Shadow Guest fixture name/id;
- no generic Botanical card;
- no raw ISO date.

Because the certified C&K Guest remains RSVP pending, do **not** mutate RSVP merely to enter Home.

For this real-data track, proving invitation + RSVP-required state is sufficient.

## Android real Guest

Build/install:
`apps/android/app`
DEBUG `pro.wewed.app.dev`.

Use explicit component routing to:
`pro.wewed.app.dev/pro.wewed.app.MainActivity`

Pass:
`wewed_native_env=production_preview`
plus the approved Preview origin/bypass.

Launch the same real invitation.

Assert the same sequence and negative conditions as iOS.

Do not let top-level `android/` TWA/UAT intercept the link.

# 5. THIRD GATE — REAL PLANNER ON THE FINAL PRODUCTION ROLE UI

Use only the final native apps:
- iOS `apps/ios/Wewed`
- Android `apps/android/app`

Launch explicitly in:
`production_preview`

Use the real Planner credential from the existing secure local file.

Read-only only.

Expected route:
`native sign-in -> production authority -> grant/context selection if required -> PlannerShell`

Required final destination:
- `Professional Planner`
- `Production` environment marker
- C&K selected
- `Our Wedding Plan`
- native Planner navigation

There must be:
- no PersonaPicker;
- no `Sanitized Shadow`;
- no `Private Real Shadow`;
- no Shadow persona identity.

# 6. FIX ONLY THE CONFIRMED PRODUCTION UI DEFECT: WORKSPACE/CONTEXT SELECTION

The owner supplied proof that the real production-native account flow can show an unfinished selector with default-blue links and a raw id such as:
`planner-<uuid>`.

This is a real product defect.

Relevant files include:
- iOS `apps/ios/Wewed/Views/GrantSelectionView.swift`
- iOS `apps/ios/Wewed/Views/ContextSwitcherSheet.swift`
- Android production grant/context selector counterparts.

Fix these on both platforms.

Requirements:
- use the same Wewed ivory/champagne/forest visual language as the polished Planner shell;
- no default system-blue link list;
- no raw `grantId`, `accessUserId`, UUID, businessAccountId or vendorId as a user-facing title;
- show human-readable wedding/business/role context;
- show role/scope clearly;
- show selected/current context clearly;
- retain explicit Sign out;
- preserve authority/selection behavior exactly.

Presentation must not become authority.

Preferred label policy:
1. wedding title when available;
2. authorized business/vendor presentation name when already available;
3. safe human role label such as `Planner Portfolio`, `Vendor Business`, `Coordinator Workspace`, `Wewed Administration`;
4. never expose an internal id as fallback UI text.

Do not redesign the Planner shell itself unless a concrete regression is observed.

# 7. DO NOT SPEND THIS UNIT REBUILDING SHADOW

Shadow cleanup is secondary hygiene.

For this unit:
- do not rename every Shadow fixture;
- do not redesign Shadow;
- do not port final UI into Shadow;
- do not remove Shadow infrastructure.

Only make a Shadow-side change if necessary to prevent a production test from accidentally accepting Shadow as final evidence.

The priority is correct final native UI qualification.

# 8. REGRESSION TESTS TO ADD

Add deterministic tests that fail if this mistake happens again.

Required:

1. `production_preview` resolves to `NativeDataEnvironment.PRODUCTION` on iOS/Android.
2. Production/production_preview cannot apply `DevelopmentPersona`.
3. Production/production_preview cannot present PersonaPicker/`Switch Persona`.
4. The real invitation-bound Guest route dispatches to:
   - iOS `GuestOnlyInvitationShellView / LiveGuestShellView`;
   - Android `GuestOnlyInvitationShell / LiveGuestShell`.
5. It does not dispatch to Shadow `GuestShellView / GuestShell`.
6. The existing GuestProfile tests are explicitly classified as FINAL NATIVE GUEST SURFACE tests, not Shadow.
7. Any Maestro file declaring `wewed_native_env: shadow` is rejected from the production-UI certification command/list.
8. Grant selection visible label cannot fall back to raw `grantId`.
9. Context switcher visible label cannot expose internal identifiers.
10. Top-level `android/` TWA/UAT wrapper is not invoked by the native-app qualification scripts.

# 9. GATE UI IN THIS UNIT

QRO04 backend/crypto Gate convergence is already accepted.

Do not create a real C&K Gate or real usher merely for visual proof.

If an existing production-shaped synthetic Gate UI test can run through final native role/authority components without Shadow, run it.

If not, classify Gate visual proof:
`BLOCKED-ENV — no production-shaped disposable Gate account/authority harness yet`

and return that exact gap to moderator.

Do not substitute Shadow Usher and call it production.

# 10. PRESERVE QRO04 BACKEND RESULT

Do not rerun or redesign X/revoke/Y unless a UI change touches Pass/Gate code.

Preserve:
`.github/workflows/wedding-pass-convergence-ci.yml`

and its corrected path:
`src/app/api/weddings/*/guest-session/**`

Run the workflow once on the closure branch as regression confirmation.

# 11. SAFETY / LIVE DATA

Charity & Kudzie remains real owner data.

This unit is read-only against C&K.

Forbidden:
- RSVP change;
- wedding-date change;
- invitation style/token change;
- Pass issuance;
- WW2 activation;
- Gate creation;
- check-in;
- production deploy;
- live migration;
- main merge;
- store publish;
- Admin credentials.

Expected C&K business-data writes:
`0`

# 12. EVIDENCE PACKAGE

Create:
`docs/QRO04_UI01_FINAL_NATIVE_UI_RECERT_RECEIPT_20260927.md`

Include:

## Source identity
- base SHA `60c1af51...`
- final SHA
- exact diff

## Three-system classification
- final native apps = `apps/ios` + `apps/android`
- Shadow = dev/test only
- top-level `android/` = legacy TWA/PWA wrapper

## Attending Guest final-surface evidence
iOS:
- GuestProfile UITest result
- screenshots/video of final bottom nav, Pass, Wedding Day
- no Shadow markers

Android:
- GuestProfile instrumentation result
- screenshots/video of final bottom nav, Pass, Wedding Day
- no Shadow markers

## Real C&K production_preview evidence
Both platforms:
- exact app id
- exact source SHA
- exact Preview origin
- explicit production_preview
- splash -> Ivory invitation
- no Shadow
- 0 writes

## Planner evidence
Both platforms:
- styled grant selector
- no blue fallback
- no raw id
- production Planner shell reached
- `Our Wedding Plan` visible

## Gate visual classification
PROVEN on production-shaped disposable authority, or exact BLOCKED-ENV reason.

## Regression
- iOS tests
- Android tests
- build results
- Wedding Pass CI
- secret scan

Do not commit screenshots containing a real Guest's name unless redacted.

# 13. STOP CONDITIONS

STOP and return to moderator if:
- current final Guest shell source differs unexpectedly from the known-good blobs before your edits;
- a production_preview launch resolves Shadow;
- fixing the route requires architecture changes;
- live C&K mutation would be required;
- live WW2 migration would be required;
- production deploy/main merge would be required;
- a real Gate operator must be created.

Do not improvise around those boundaries.

# 14. SUCCESS LINE

`QRO04-UI01 FINAL NATIVE UI RE-CERTIFIED — IOS/ANDROID ATTENDING GUEST USE LIVE GUEST SHELL, REAL C&K ENTRY USES PRODUCTION_PREVIEW, PLANNER USES PRODUCTION ROLE SHELL, RAW/BLUE WORKSPACE SELECTOR CLOSED — SHADOW/TWA EXCLUDED FROM PRODUCT EVIDENCE — 0 C&K WRITES — RETURNING TO MODERATOR.`

Failure:

`QRO04-UI01 <NOT PROVEN|BLOCKED-ENV|FALSE / STALE> — <exact reason> — FINAL NATIVE UI NOT REPLACED BY SHADOW — 0 C&K WRITES — RETURNING TO MODERATOR.`
