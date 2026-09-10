# Wewed Google Play release runbook

This document records the Google Play setup for Wewed and the steps needed to operate future Android releases. It intentionally contains no passwords, keystore files, signing passwords, or provisioning tokens.

## Current release status

Last updated: 10 September 2026.

- App: **Wewed**
- Package name: `pro.wewed.app`
- Google Play app ID: `4974150999202523750`
- Developer account ID: `8527437585153848574`
- Release track: **Closed testing - Alpha**
- Track ID: `4699430816221896412`
- Test countries: **35 active regions**: Zimbabwe plus the original 28 English-speaking markets and six additional markets—India, Indonesia, Japan, Myanmar (Burma), South Korea, and Thailand. Singapore was already included in the original 29-region set.
- Release: **Wewed Zimbabwe closed test 1**
- Android version: version name `1`, version code `1`
- Target SDK: 36
- Status on 10 September 2026: **country expansion approved and published**. The closed test is active in all 35 targeted regions.
- Tester access: the existing **Beta Testers** email list is assigned to the track and contains 31 accounts.
- Production-access progress on 10 September 2026: **1 tester is currently opted in**. Google requires at least 12 opted-in testers to remain in the closed test for at least 14 continuous days before this personal developer account can apply for production access.
- Android developer verification: **Wewed is registered** with 3 signing keys. The 30 September 2026 registration warning is satisfied for this app.
- Payments profile notice: Google is offering optional enrollment in the 15% service-fee program; no action is required for the current Wewed closed test.

Useful links:

- [Wewed Play Console dashboard](https://play.google.com/console/u/0/developers/8527437585153848574/app/4974150999202523750/app-dashboard)
- [Publishing overview](https://play.google.com/console/u/0/developers/8527437585153848574/app/4974150999202523750/publishing)
- [Closed testing track](https://play.google.com/console/u/0/developers/8527437585153848574/app/4974150999202523750/tracks/4699430816221896412)
- [Tester opt-in page](https://play.google.com/apps/testing/pro.wewed.app)
- [Production website](https://wewed.pro/)

## Version 1 bundle

The first signed Android App Bundle is complete and was accepted by Google Play.

- Build output: `android/app/build/outputs/bundle/release/app-release.aab`
- SHA-256: `f8cb87d1d15639620a32ba9d259f9a585c87d08d1bfb04a16561c390732717ba`
- Launch URL: `https://wewed.pro/app?source=google-play`
- PWA manifest: `https://wewed.pro/manifest.json`
- Android association: `https://wewed.pro/.well-known/assetlinks.json`

The bundle is a Trusted Web Activity wrapper around the production PWA. The Android project lives in `android/`. The web app must be deployed and healthy because the installed Android app loads the production Wewed service.

## Private release material

Private files are stored outside the repository on the release Mac:

- Upload keystore: `~/.wewed-release/wewed-upload.jks`
- Android signing environment: `~/.wewed-release/android-signing.env`
- Play reviewer environment: `~/.wewed-release/play-review.env`

Do not commit these files or copy their values into issues, pull requests, documentation, screenshots, or chat. The Play reviewer credential is already stored in Google Play Console under **Policy and programs → App content → Sign in details**. The reviewer account opens the private sample wedding **Tariro & Tendai** and does not require an OTP, purchase, invitation code, or second device.

## Store and policy configuration

The submitted store configuration includes:

- Category: Events
- Audience: 18 and over
- Ads: No
- Advertising ID: No
- Government app: No
- Health app: No
- Financial features: budgeting and record keeping only
- Content rating: Everyone / PEGI 3 / equivalent regional ratings
- Privacy policy: `https://wewed.pro/legal/privacy`
- Account deletion: `https://wewed.pro/account-deletion`
- Support email: `support@wewed.pro`
- Store assets: app icon, feature graphic, and three phone screenshots

The Data safety declaration states that data is encrypted in transit, users can request account deletion, and Wewed does not share user data with third parties under Google Play's definition. It declares collection of the data types used by Wewed features: account and contact details, optional addresses and preferences, wedding budgets, health-related guest needs, messages, photos, videos, voice recordings, files, calendar events, contacts, app activity, diagnostics, crash information, and device identifiers.

## Closed-test operation

After Google approves the submitted changes:

1. Open the closed testing track and confirm the release is available.
2. Copy `https://play.google.com/apps/testing/pro.wewed.app` and send it only to members of the assigned **Beta Testers** list.
3. Each tester must open the link while signed in to the Google account present in that list, choose to become a tester, and install Wewed from Google Play.
4. Confirm the dashboard shows at least 12 opted-in testers.
5. Keep at least 12 testers opted in continuously for 14 days. Replacing or losing testers can delay eligibility.
6. Collect feedback and resolve crashes, broken sign-in flows, policy notices, and review findings without stopping the track.
7. When the production-access button becomes available, complete Google's closed-test questions and apply for production access.
8. After production access is granted, create a production release from the tested bundle or a newer tested version and submit it for review.

## Building a future bundle

Every uploaded Android release must use a higher `versionCode`. Update `versionCode` and `versionName` in `android/app/build.gradle`, then build with JDK 17 and the Android SDK installed.

```sh
cd android
set -a
. "$HOME/.wewed-release/android-signing.env"
set +a
./gradlew clean bundleRelease
```

The signed output is written to:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

Before uploading a future bundle:

1. Merge and deploy the corresponding web changes to `wewed.pro`.
2. Verify the manifest, service worker, launch URL, privacy policy, account-deletion page, and Android asset links.
3. Confirm `assetlinks.json` still includes the Google Play app-signing certificate and the private upload certificate.
4. Test sign-in, the sample reviewer account, navigation, offline fallback, account deletion, reporting, blocking, and the Google Play purchase restrictions.
5. Build the signed bundle and record its version and SHA-256 in this document.
6. Upload the bundle to a test track, add release notes, review Play's warnings, and submit the changes.

## Certificate fingerprints

Google Play app-signing certificate:

```text
32:16:B9:AE:56:44:F9:B5:B4:F8:C3:04:6A:6B:D6:BF:86:3E:A3:51:B3:2A:F3:AE:4B:32:27:99:B9:FE:DA:7B
```

Upload certificate:

```text
C3:D8:56:D7:82:F6:42:C6:88:4D:98:25:52:F5:67:65:3E:35:D5:DA:1E:AB:B1:12:EF:6F:C0:59:8E:88:65:8C
```

## Review and incident checklist

- Check **Publishing overview** and **Policy status** for review decisions or required action.
- If Google rejects the release, read the exact policy finding before changing the app or declaration.
- Keep the reviewer account active and its sample workspace intact for every update review.
- If the reviewer password is rotated, update the private environment file and the Play Console sign-in declaration together.
- If the domain, package name, or signing certificate changes, update the TWA configuration and `assetlinks.json` before uploading another bundle.
- If a web deployment breaks the Android experience, restore a known-good Vercel production deployment while the fix is prepared.
- Never upload a bundle signed by a different upload key unless the key change has been completed through Google Play App Integrity.
