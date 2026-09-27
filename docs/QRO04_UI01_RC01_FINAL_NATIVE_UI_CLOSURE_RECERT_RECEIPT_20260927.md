# QRO04-UI01-RC01 — Final native UI closure re-certification: receipt (2026-09-27)

**Status: CERTIFICATION REPORT — NOT A MODERATOR ACCEPTANCE DECISION.** No product or test source was changed. This receipt is the only file added.

**Result: NOT PROVEN.** Two source defects at the required HEAD, both returned unpatched:

1. **The Android app does not compile.** `RootScreen.kt:241` calls `liveCoordinator.forgetGuest()`, which does not exist on Android's `LiveGuestInvitationCoordinator`. Every Android gate is therefore blocked: unit tests, builds, final-surface UI tests, pending escape, C&K and Planner.
2. **One iOS final-surface test fails reproducibly.** `testProfileAndPassReturnToPreviousSurface` looks for `guest-profile-digital-invitation`, which the final iOS Guest shell removed on 2026-09-25.

Everything that could run passed:
- iOS unit tests and builds;
- 4 of 5 iOS GuestProfile tests, including the RSVP-first pending contract, Pass date formatting and the clean production launch;
- the certification lane contract;
- Wedding Pass CI.

**C&K business-data writes = 0. Production business-data writes = 0. Migrations = 0.**

## 1. Source

| Item | Value |
| --- | --- |
| Branch | `closure/phase13-qro04-ui01-m1-pending-contract-20260927` |
| HEAD | `9c79da8269f04c6d8e3a53e909d99146e030d877` (exact) |
| PR | #221, open, unmerged, not merged by this unit |
| Delta vs UI01 (`830d98e2`) | 20 commits, 20 files (+364/−86): pending escape, Pass date format, `LoginView` identifiers, read-only workspace styling, engagement choices, test alignment |
| QRO04 CI filter | preserved (`src/app/api/weddings/*/guest-session/**`) |

## 2. Static / build qualification

| Check | Result |
| --- | --- |
| iOS `swift test` (full) | **532 / 0 failures** |
| iOS `FinalNativeUiLaneRegressionTests` | **9 / 0** |
| iOS Debug simulator build | **BUILD SUCCEEDED** |
| iOS unsigned Release device build | **BUILD SUCCEEDED** |
| Android `testDebugUnitTest` (incl. `FinalNativeUiLaneRegressionTest`) | **FAILED to compile**. No test executed. |
| Android `assembleDebug` / `assembleUat` | **FAILED** (same compile error) |
| Android Release compile (`compileReleaseKotlin`) | **FAILED** (same compile error) |
| Bun `src/lib/native-ui-certification-lanes.test.ts` | **4 / 0** |
| Wedding Pass convergence CI | run **36301320271** on `9c79da82`: **success** |

### Defect 1 — Android compile error (returned, not patched)

```
e: apps/android/app/src/main/java/pro/wewed/app/ui/RootScreen.kt:241:45 Unresolved reference: forgetGuest
```

- **Call site.** `RootScreen.kt` (commit `3edea885` "allow live invitation to clear Guest session", then `bdd11fa5`) calls `liveGuestScope.launch { liveCoordinator.forgetGuest(); … }` in `onLeaveWedding`.
- **Missing target.** `apps/android/.../invitation/LiveGuestInvitationCoordinator.kt` has **no** `forgetGuest()`. Its last change was `84da2583`. `git log --all -S'fun forgetGuest()' -- apps/android` finds no commit, on any branch, that ever added it. The only Android `forgetGuest` is `GuestInvitationBootstrap.forgetGuest(context)`.
- **Verified against a clean tree.** Worktree clean at `9c79da82`; reproduced with a fresh Gradle invocation.

## 3. Final GuestProfile UI tests (real final components, synthetic loopback server)

Server: `scripts/native-mobile/guest-profile-ui-server.py` (unchanged since UI01) on `127.0.0.1:8768`. iOS ran on the user-visible "iPhone 18 Pro" `FC17FF48-…`.

| iOS test | Result |
| --- | --- |
| `testAttendingCardOpensServerPassAndWeddingDay` | **pass**. Asserts the Pass shows **"Jun 12, 2027"** and not the raw `2027-06-12`, then Wedding Day. |
| `testInvitationHomeReopenAndRelaunch` | **pass** |
| `testPendingAndDeclinedDoNotGetPass` | **pass**. Pending: no `invitation-continue`, no `live-guest-shell`, **`invitation-leave-wedding` present**, the Guest Pass CTA opens `invitation-rsvp-prompt`, no `wedding-pass-qr`. Declined: no QR. |
| `testProductionGuestOnlyLaunchSurvivesWithoutCrash` | **pass** |
| `testProfileAndPassReturnToPreviousSurface` | **FAIL, reproduced twice**: `XCTAssertTrue failed - guest-profile-digital-invitation` (not found within 20 s after `nav-guest-more`) |

Android GuestProfile UI tests: **not executable** (Defect 1).

### Defect 2 — stale iOS final-surface assertion (returned, not patched)

- **Removed element.** `guest-profile-digital-invitation` does not exist anywhere in `apps/ios/Wewed`. It was removed from the More tab by `4cbf961c` (2026-09-25 "finalize iOS Guest shell IA").
- **Current More tab.** It exposes `guest-profile-couple-site`, `guest-more-gifts`, `guest-more-help`, `guest-more-privacy`, `live-guest-profile-name`, `live-guest-profile-rsvp` and `live-guest-forget-wedding`.
- **Second issue in the same test.** It enters a **declined** Guest and finally asserts `live-guest-pass-pending`, which looks inconsistent with the declined state (`live-guest-pass-declined` would be expected).
- **Moderator decision.** Align the test with the current More tab, or restore the entry.

## 4. Gates not executed (stopped at the build/test failures, as instructed)

These gates were not run, because the prompt says to return failures rather than proceed or patch. The Android halves of each cannot run until Defect 1 is fixed:
- pending-Guest device escape with the real C&K invitation (Leave this wedding → normal welcome/Sign In → re-open the same invitation);
- real C&K `production_preview` Guest UI re-certification;
- real Planner and workspace presentation, including the portfolio read-only landing;
- runtime proof that iOS `sign-in-email`, `sign-in-password` and `sign-in-submit` are independently addressable. (M1's `643944fe` targets this; the `FinalNativeUiLaneRegressionTests` source guards pass.)
- Android Pass-date check.

## 5. Pass-date result

- **iOS: proven.** The passing attending test asserts "Jun 12, 2027" is visible and `2027-06-12` is not.
- **Android: not executable** (Defect 1).

## 6. Production traffic safety

- Window 06:53:47Z–06:57:01Z (full iOS GuestProfile run, including `testProductionGuestOnlyLaunchSurvivesWithoutCrash`): the production deployment `dpl_ApFS83c3…` received **0** requests to `/api/weddings/guest-ui/guest-session`. **The UI01-reported leak is gone.**
- Production traffic in the window was unrelated user activity (`/api/notifications/count`, `/api/auth/me`, public pages) and cron jobs.
- No C&K `production_preview` qualification was run in this unit, so there was no C&K qualification traffic of any kind.

## 7. Gate UI

**BLOCKED-ENV — no production-shaped disposable Gate account/authority visual harness exists.** Unchanged. Shadow Usher was not used, and no real C&K Gate or operator was created. The accepted QRO04 WW2 cryptographic and Gate backend result is unaffected.

## 8. Safety accounting

- **C&K business-data writes = 0. Production business-data writes = 0. Migrations = 0.**
- No source patch, merge, deploy, env change, WW2 activation or store action.
- No credentials were used in this unit (the C&K and Planner gates were not reached). The Admin file was not read. `WEWED_PARITY_ALLOW_PASS_GET` unset.

QRO04-UI01-RC01 NOT PROVEN — Android does not compile at 9c79da82 (RootScreen.kt:241 calls nonexistent LiveGuestInvitationCoordinator.forgetGuest()) and iOS testProfileAndPassReturnToPreviousSurface asserts the removed guest-profile-digital-invitation — 0 C&K WRITES — RETURNING TO MODERATOR.
