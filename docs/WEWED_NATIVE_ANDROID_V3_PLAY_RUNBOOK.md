# Wewed Native Android v3 — Play Candidate Runbook

**Release candidate:** React Native / Expo Wewed 2.0.0  
**Android package:** `pro.wewed.app`  
**Android versionCode:** `3`  
**Target track:** Google Play Closed testing - Alpha  
**Authority:** `docs/WEWED_NATIVE_MOBILE_COMPLETION_RELEASE_PLAN.md`

This runbook is additive to `docs/GOOGLE_PLAY_RELEASE_RUNBOOK.md`. The existing document remains the historical record for the TWA releases and the Play account/track configuration. This document covers only the native v3 candidate and intentionally contains no keystore, password, reviewer password, provisioning token, or signing secret.

## 1. Preconditions

Do not build or upload the Play candidate until the exact feature-branch head has passed the required repository, Native Mobile, Native Bearer, App Links, structural AAB and Maestro gates.

The release Mac must retain the already-established private signing material outside Git:

- `~/.wewed-release/wewed-upload.jks`
- `~/.wewed-release/android-signing.env`

The signing environment must expose the existing variables already used by the legacy Android project and the native signing plugin:

- `WEWED_UPLOAD_STORE_FILE`
- `WEWED_UPLOAD_STORE_PASSWORD`
- `WEWED_UPLOAD_KEY_ALIAS`
- `WEWED_UPLOAD_KEY_PASSWORD`

Never copy their values into GitHub issues, pull requests, CI logs, documentation, screenshots, or chat.

## 2. Build the signed native v3 candidate

From the repository root on the release Mac:

```sh
./scripts/build-native-play-aab.sh
```

The script fails closed. It:

1. requires Bun and JDK 17 tooling;
2. sources `~/.wewed-release/android-signing.env` unless `WEWED_ANDROID_SIGNING_ENV` explicitly points to another private file;
3. verifies that all four upload-signing variables exist;
4. verifies that the keystore exists;
5. verifies the upload certificate fingerprint against the certificate already registered for Wewed;
6. pins `versionCode` to `3`, `versionName` to `2.0.0`, and the API base to `https://wewed.pro`;
7. forces `WEWED_REQUIRE_RELEASE_SIGNING=1`;
8. explicitly removes `WEWED_E2E_MODE` so the Play build cannot inherit local-CI cleartext networking;
9. generates `apps/mobile/android` through Expo prebuild;
10. runs the generated Android identity/signing/App Links/cleartext verifier;
11. builds `:app:bundleRelease`;
12. verifies the resulting AAB with `jarsigner`; and
13. prints the final AAB path and SHA-256.

Expected output path:

```text
apps/mobile/android/app/build/outputs/bundle/release/app-release.aab
```

The structural CI artifact named `wewed-native-v3-ci-aab-NOT-FOR-PLAY` is build evidence only. **Never upload that structural artifact to Google Play.**

## 3. Identity that must remain unchanged

The native upgrade deliberately preserves the existing Play application identity:

```text
package: pro.wewed.app
versionCode: 3
versionName: 2.0.0
```

Expected Wewed upload certificate SHA-256:

```text
C3:D8:56:D7:82:F6:42:C6:88:4D:98:25:52:F5:67:65:3E:35:D5:DA:1E:AB:B1:12:EF:6F:C0:59:8E:88:65:8C
```

Google Play app-signing certificate SHA-256 remains:

```text
32:16:B9:AE:56:44:F9:B5:B4:F8:C3:04:6A:6B:D6:BF:86:3E:A3:51:B3:2A:F3:AE:4B:32:27:99:B9:FE:DA:7B
```

`https://wewed.pro/.well-known/assetlinks.json` must continue to associate `pro.wewed.app` with the required certificate fingerprints before the candidate is distributed.

## 4. Closed-test upload

Upload the signed v3 AAB only to the existing Wewed Closed testing - Alpha track first. Do not replace the current TWA production path directly.

Record in the release evidence:

- exact Git commit SHA used to build;
- AAB SHA-256 printed by the build script;
- Play Console accepted versionCode/versionName;
- release notes used;
- Play pre-review warnings, if any;
- tester-track availability status.

## 5. Mandatory real-device upgrade qualification

Use a Google account already present in the assigned Beta Testers list. The critical upgrade test is an **in-place Play upgrade**, not merely a clean APK install.

The device qualification must prove:

1. the existing Play-delivered Wewed/TWA installation is present;
2. Google Play upgrades that installation to native versionCode 3 without package/signing rejection;
3. Wewed launches as the native React Native application rather than the TWA;
4. sign-in and secure session restoration work;
5. `https://wewed.pro/...` App Links resolve into Wewed where mapped;
6. `wewed://...` internal links resolve correctly;
7. a WhatsApp/browser invitation opened before install can continue through Play install using the opaque Install Referrer handoff;
8. invalid/expired/replayed deferred handoffs fail safely;
9. push-notification routing opens the intended authorized destination;
10. camera/photo/document selection, share sheet and permissions behave correctly;
11. Android Back, keyboard, safe areas, font scaling and representative orientation changes remain usable;
12. process death/background restoration does not fabricate a successful mutation;
13. Wi-Fi/mobile-data interruption produces honest retry/offline states; and
14. critical planner journeys remain coherent: Home, Tasks, Guests/Seating, Budget/Contributions, Timeline, Messages, Vendors/Marketplace, Bookings, AI and More/account safety.

Capture PASS/FAIL evidence against the exact store-delivered versionCode 3 candidate. Do not substitute the structural CI AAB, a locally installed debug APK, Chromium emulation, or the old TWA for this gate.

## 6. Cutover decision

The current TWA remains the rollback/reference implementation until store-delivered v3 qualification is complete. PR #198 remains draft until the closeout matrix records the required automated and physical evidence.

Only after all mandatory gates are green should the migration be approved for merge/cutover. If Google Play or physical-device qualification finds a defect, fix it on the feature branch, increment `versionCode` if a replacement bundle has already been uploaded, rerun the exact-head matrix, and qualify the replacement candidate rather than reusing stale evidence.
