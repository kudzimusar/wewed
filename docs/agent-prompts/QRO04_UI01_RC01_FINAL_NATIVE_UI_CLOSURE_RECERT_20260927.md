# QRO04-UI01-RC01 — Final Native UI Closure Re-Certification

## Repository
`kudzimusar/wewed`

## Role
You are the **independent re-certification agent**.

Do not patch tracked product/test source in this run.

If a defect remains:
`certifier -> moderator -> closure -> re-certification`.

## Exact source

Branch:
`closure/phase13-qro04-ui01-m1-pending-contract-20260927`

Required HEAD:
`9c79da8269f04c6d8e3a53e909d99146e030d877`

Open PR:
`#221`

Do not switch to integration, main, Shadow, Private Real Shadow or the top-level TWA wrapper.

Moderator decision:
**D-086 — QRO04-UI01 partial return triaged; RSVP-first contract preserved; bounded UI closure awaiting re-certification**

## Non-negotiable product contract

Pending Guest:
- remains on Invitation / RSVP;
- does **not** enter persistent Home/Pass/Wedding Day before answering;
- has no WW2 admission credential;
- Pass CTA prompts RSVP;
- may locally leave/forget this wedding so a shared device can return to normal Wewed account entry.

Answered Guest:
- may enter persistent Guest shell;
- attending may receive a Pass when the Wedding Pass authority allows it;
- declined never receives an admission credential.

Do **not** restore `invitation-continue`.

Do **not** weaken `GuestCapabilityPolicy.mayEnterPersistentExperience`.

# 1. PRE-FLIGHT

Before tests:

1. fetch remote;
2. verify branch HEAD is exactly `9c79da8269f04c6d8e3a53e909d99146e030d877`;
3. verify PR #221 targets `closure/phase13-qro04-final-native-ui-recert-ui01-20260927`;
4. inspect the diff and confirm no Shadow/TWA port was introduced;
5. confirm the known-good final shell files remain the product UI:
   - iOS `LiveGuestShellView.swift`;
   - Android `LiveGuestShell.kt`;
6. confirm C&K is still read-only for this unit.

If HEAD moved unexpectedly, STOP and return moderator.

# 2. STATIC / UNIT QUALIFICATION

Run:

## iOS
- full `swift test`;
- `FinalNativeUiLaneRegressionTests`;
- Debug simulator build;
- unsigned Release device build.

## Android
- `testDebugUnitTest`;
- `FinalNativeUiLaneRegressionTest`;
- `assembleDebug`;
- `assembleUat`;
- compile Release as far as possible without production signing material.

## Shared
- `bun test src/lib/native-ui-certification-lanes.test.ts`.

Required:
- all new regression guards pass;
- no production signing key is introduced.

# 3. FINAL NATIVE GUEST SURFACE TESTS — ALL MUST PASS

These are synthetic-data tests through the real final Guest components, not Shadow.

## iOS
Run the entire:
`apps/ios/GuestProfileUITests/GuestProfileUITests.swift`

Expected current semantics:

### testInvitationHomeReopenAndRelaunch
- answered attending Guest;
- invitation -> persistent shell -> Home;
- invitation can be reopened;
- relaunch restores the answered Guest to Home.

### testProfileAndPassReturnToPreviousSurface
- answered declined Guest;
- persistent shell allowed;
- Pass destination has no admission credential;
- invitation round-trip returns to prior destination.

### testAttendingCardOpensServerPassAndWeddingDay
- attending Guest;
- WW2 Pass surface present;
- Wedding Day present;
- Pass date is human-formatted;
- literal `2027-06-12` absent from the Pass UI.

### testPendingAndDeclinedDoNotGetPass
Pending:
- no persistent shell;
- no Continue;
- `invitation-leave-wedding` visible;
- Pass CTA opens RSVP prompt;
- no QR.

Declined:
- persistent context allowed;
- declined Pass state;
- no QR.

### testProductionGuestOnlyLaunchSurvivesWithoutCrash
- DEBUG test seam clears the prior synthetic Guest session before switching to production lane;
- app reaches a valid production entry state;
- **no request for `/api/weddings/guest-ui/guest-session` may hit production**.

## Android
Run the entire:
`apps/android/app/src/androidTest/java/pro/wewed/app/invitation/GuestProfileUiTests.kt`

Expected:
- all current tests pass;
- pending stays invitation-bound;
- `invitation-leave-wedding` exists;
- attending Pass date formatted;
- warm Guest B replacement re-stages as a fresh invitation arrival and then resolves Guest B in the persistent shell;
- no Shadow/persona UI.

Any GuestProfile failure = NOT PROVEN. Do not patch it yourself.

# 4. PENDING-GUEST DEVICE ESCAPE — RUNTIME PROOF

This is a local identity/session operation, not a wedding business-data write.

Use a dedicated iOS simulator and Android emulator/device.

Use explicit `production_preview`.

Using the existing real C&K invitation credential:
1. open the pending C&K invitation;
2. prove RSVP remains pending;
3. prove persistent Guest shell is not accessible;
4. prove `Not your invitation? Leave this wedding` is visible;
5. activate it;
6. prove only the local Guest relationship is cleared;
7. prove the device returns to normal Wewed welcome/account entry rather than remaining trapped;
8. if a Planner account session already exists in that qualification lane, prove it may restore normally; otherwise prove Sign In is reachable;
9. re-open the **same existing C&K invitation credential** and prove it still resolves the same Guest/Ivory invitation;
10. do not rotate the invitation credential.

Required business-data writes:
`0`

The C&K Guest remains pending before and after.

# 5. REAL C&K GUEST — PRODUCTION_PREVIEW

Re-prove on both platforms using exact closure source:

`splash -> ornate Ivory CLOSED -> OPENING -> OPEN -> DETAILS / RSVP required`

Required negatives:
- no Shadow;
- no Persona Picker;
- no TWA;
- no Botanical;
- no raw ISO date;
- no persistent Guest shell while pending.

No RSVP mutation.

# 6. REAL PLANNER — PRODUCTION_PREVIEW

Re-prove both platforms:
- production lane;
- real Planner authority;
- styled `Choose your workspace`;
- no raw grant ID;
- no default-blue selector;
- select C&K;
- `Professional Planner`;
- `Production`;
- `Our Wedding Plan`.

Then deliberately visit the Planner portfolio/read-only landing if available and prove:
- no raw permission strings such as `account.manage, weddings.manage`;
- no raw businessAccountId/grantId as a visible title;
- `Switch workspace` uses Wewed styling;
- `Sign out` is not a default-blue fallback.

# 7. IOS SIGN-IN ACCESSIBILITY

On iOS prove automation can independently address:
- `sign-in-email`;
- `sign-in-password`;
- `sign-in-submit`.

The root marker `sign-in-root` must no longer mask them.

# 8. PRODUCTION TRAFFIC ISOLATION

During the synthetic GuestProfile production smoke window:
- production must receive **zero** `/api/weddings/guest-ui/guest-session` requests.

During C&K production_preview qualification:
- qualification traffic goes only to the intended Preview;
- production receives zero accidental native qualification Guest/session traffic.

Any accidental production qualification Guest traffic:
`FALSE / STALE`
and STOP.

# 9. PASS DATE

Both final native Pass cards must render the synthetic date `2027-06-12` in human form.

Required:
- raw `2027-06-12` absent as the visible Pass date;
- human date visible.

Do not change server date authority.

# 10. GATE UI STATUS

Do not create a real Gate/operator.

Do not use Shadow Usher as production evidence.

Re-check whether a production-shaped disposable Gate visual harness now exists. If not, retain exact classification:

`BLOCKED-ENV — no production-shaped disposable Gate account/authority visual harness exists`.

This does **not** invalidate the already-accepted QRO04 WW2 cryptographic/Gate backend result.

It remains the next environment closure after RC01.

# 11. WEDDING PASS REGRESSION

Run the Wedding Pass convergence CI/workflow against the closure source if available.

The accepted path-filter fix must remain.

No live WW2 migration.
No shared Preview WW2 activation.
No C&K Pass issuance.

# 12. RECEIPT

Create:
`docs/QRO04_UI01_RC01_FINAL_NATIVE_UI_CLOSURE_RECERT_RECEIPT_20260927.md`

Receipt-only tracked change.

Include:
- exact starting source SHA;
- exact test commands/results;
- all iOS GuestProfile results;
- all Android GuestProfile results;
- pending Guest escape proof;
- same-invitation re-open proof;
- C&K pre/post RSVP/style/token-digest safe values;
- iOS/Android C&K production_preview visual result;
- iOS/Android Planner result;
- portfolio/read-only result;
- iOS sign-in identifier result;
- Pass date result;
- production request count;
- Preview request count;
- Gate visual classification;
- Wedding Pass CI result;
- C&K business-data writes = 0;
- production business-data writes = 0;
- migrations = 0;
- secret scan.

Do not commit unredacted real Guest screenshots.

# 13. SAFETY

Do not:
- patch source;
- merge PR #221;
- merge to integration/main;
- deploy production;
- change C&K RSVP;
- change C&K wedding date;
- change invitation style/token;
- issue C&K Pass;
- create Gate/check-in/operator;
- apply live migrations;
- enable WW2 live;
- read Admin credentials;
- publish native apps.

## Success

`QRO04-UI01-RC01 FINAL NATIVE UI CLOSURE CERTIFIED — RSVP-FIRST PENDING CONTRACT + DEVICE ESCAPE + IOS/ANDROID FINAL GUEST + REAL C&K PRODUCTION_PREVIEW + PLANNER/WORKSPACE PRESENTATION PASS — 0 C&K WRITES — GATE VISUAL <PROVEN|BLOCKED-ENV> — RETURNING TO MODERATOR.`

## Failure

`QRO04-UI01-RC01 <NOT PROVEN|BLOCKED-ENV|FALSE / STALE> — <exact reason> — 0 C&K WRITES — RETURNING TO MODERATOR.`
