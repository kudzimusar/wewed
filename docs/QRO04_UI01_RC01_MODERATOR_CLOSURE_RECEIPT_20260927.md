# QRO04-UI01-RC01 — Moderator closure receipt (2026-09-27)

**Status: MODERATOR PATCH COMPLETE — RE-CERTIFICATION REQUIRED.**

The RC01 certifier returned two ordinary bounded defects at `9c79da82` / receipt head `e1546d68`. The moderator independently verified both against PR #221 and patched them directly on the existing M1 branch.

## 1. Source

| Item | Value |
| --- | --- |
| Branch | `closure/phase13-qro04-ui01-m1-pending-contract-20260927` |
| PR | #221, open and unmerged |
| Returned receipt head | `e1546d68e994bf90864071cac46f1eff72c6734e` |
| Android closure commit | `119a08f6ceb81f1d25c2ca43b74b13db43af7896` |
| iOS closure commit | `b0a4cc6b46b97648e62562aaf5795284e99d4c54` |\n| Android shared-role safe-area commit | `3d0787d62011edbcf468878086a96906b376dbce` |\n| Android safe-area regression guard | `ccecb5231aee690af6f22640bfc78210ba81d138` |

## 2. Defect closure

### Android compile blocker — PATCHED

`apps/android/app/src/main/java/pro/wewed/app/ui/RootScreen.kt` called nonexistent
`liveCoordinator.forgetGuest()` from the fallback live-invitation route.

The fallback now clears the remembered Guest through the existing Android Guest-session authority:

```kotlin
GuestInvitationBootstrap.forgetGuest(androidContext)
liveInvitation = LiveInvitationState.Idle
```

The now-unused coroutine scope and `kotlinx.coroutines.launch` import were removed.

This does not add a second session authority, does not mutate RSVP, does not sign out an account,
and matches the existing bootstrap contract used elsewhere for leaving Guest mode.

### iOS stale final-surface test — PATCHED

`apps/ios/GuestProfileUITests/GuestProfileUITests.swift`
`testProfileAndPassReturnToPreviousSurface` no longer expects the removed
`guest-profile-digital-invitation` More-tab card and no longer expects a declined Guest to render
`live-guest-pass-pending`.

The test now proves the current final Guest IA directly:

1. declined Guest opens More;
2. bottom-nav Invitation opens the invitation;
3. Back to wedding returns to More;
4. declined Guest opens Pass;
5. bottom-nav Invitation opens the invitation;
6. Back to wedding returns to `live-guest-pass-declined`.

No removed Continue control or alternate RSVP bypass was restored.

## 3. Moderator source review

The returned defect report was correct on both defects.

The Android fix is bounded to the fallback route in `RootScreen.kt`. The existing
`GuestInvitationBootstrap.forgetGuest(context)` contract clears only Guest-session storage,
resets Guest-only entry state, and leaves account credentials alone.

The iOS More tab intentionally contains wedding extras/help/profile/device controls and no longer
duplicates the first-class Invitation destination. The persistent Guest navigation remains:

`Home | Invitation | Pass | Wedding Day | More`

For declined Guests the final Pass surface is `live-guest-pass-declined`, not the pending surface.

## 3A. Visual defect discovered from Android Planner runtime screenshot — PATCHED

A visible Android Professional Planner screenshot showed the shared role header entering the system
status-bar/display-cutout area: the role title, active wedding and Production badge were positioned
under the camera/system icons.

This is not Planner-specific. `RoleContextBar` is the common IA V2 role header used by the shared
role shell, and it did not consume any Android status-bar inset while the app targets SDK 36.

Patched:

- `apps/android/app/src/main/java/pro/wewed/app/ui/roles/RoleShellScaffold.kt`
- commit `3d0787d62011edbcf468878086a96906b376dbce`
- `RoleContextBar` now places its content inside `Modifier.statusBarsPadding()`.

Regression guard added:

- `apps/android/app/src/test/java/pro/wewed/app/FinalNativeUiLaneRegressionTest.kt`
- commit `ccecb5231aee690af6f22640bfc78210ba81d138`
- source guard prevents the shared role header from losing its status-bar inset again.

This fix deliberately targets the shared role chrome rather than adding a Planner-only fixed margin.

## 4. Qualification status

The returned RC01 evidence remains useful for the pre-patch head: iOS unit/build gates passed,
4/5 iOS GuestProfile tests passed, the production Guest-session leak was absent in that run, and
Gate UI remained BLOCKED-ENV.

However, the moderator patch head has **not yet received fresh build/UI/runtime qualification**.
Source inspection alone is not acceptance evidence.

Required next qualification must at minimum prove:

- Android `testDebugUnitTest`, `assembleDebug`, `assembleUat`, and Release Kotlin compilation;
- all Android GuestProfile instrumentation tests, including warm Guest B replacement;
- all five iOS GuestProfile tests, including the repaired return-surface test;
- iOS login identifier runtime addressability;
- pending/attending/declined final-native journeys;
- Android Pass-date formatting;
- real C&K `production_preview` pending Guest escape with zero RSVP/business-data mutation;
- real Planner/read-only workspace presentation;
- zero synthetic Guest-session leakage to production.

## 5. Safety accounting for this moderator patch cycle

- C&K business-data writes: **0**
- Production business-data writes: **0**
- Migrations: **0**
- Deployments/releases/merges: **0**
- Credentials used: **0**
- Production runtime calls generated by this moderator patch cycle: **0**

Gate UI remains **BLOCKED-ENV** unless a valid production-shaped disposable Gate authority harness
becomes available.

## 6. Moderator classification

> **QRO04-UI01-RC01 — NOT PROVEN, ORDINARY SOURCE DEFECTS PATCHED; FRESH RE-CERTIFICATION REQUIRED.**

Do not merge PR #221 or advance beyond QRO04 until the patched head is independently qualified.
