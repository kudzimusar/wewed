# PR #202 UAT setup

Branch: `feature/private-invitation-android-delivery-20260912`. Do not merge before qualification.

Fixture: `wewed-pr202-uat-20260912`, **Wewed PR 202 — Synthetic UAT**. Guest IDs end in `-guest-a` and `-guest-b`. Physical code: `UAT2020912`.

The fixture provisioner runs only with `VERCEL_ENV=preview`, the exact branch, and explicit `WEWED_UAT_PROVISION` plus a random fixture secret. It creates only this fixture's records in one transaction and refuses identity collisions. It is not invoked by normal builds. Do not log or commit its secret or guest URLs.

The premium invitation-style migration is now applied to the UAT database. The synthetic wedding persists `ivory-floral-gold` as its authoritative invitation style; guest-facing `card=` parameters no longer override that saved design.

Set `WEWED_PREVIEW_WRITABLE_WEDDING_ID=wewed-pr202-uat-20260912` for this preview branch only. Guest RSVP writes, public wedding mutations, physical scan counters, and handoff creation/consumption honor the same boundary as Planner permissions. Physical links grant shared read access and clear private identity; they do not identify an anonymous guest for RSVP.

## Android UAT

`:app:assembleUat` remains the debug-signed local/simulator APK associated with `uat.wewed.pro`. It is useful for ordinary native smoke testing but **does not qualify Google Play deferred-install recovery**.

`:app:bundleUatPlay` is the Play-distribution candidate. The `uatPlay` variant:

- keeps the production package id `pro.wewed.app`;
- inherits the non-debug/release build type;
- sets `BuildConfig.UAT=true`;
- launches `https://uat.wewed.pro/app?source=google-play-uat`;
- resumes personal deferred invitations at `https://uat.wewed.pro/invite/resume`;
- resumes physical deferred invitations at `https://uat.wewed.pro/invite/physical-resume`;
- accepts `WEWED_ANDROID_VERSION_CODE` and `WEWED_ANDROID_VERSION_NAME` so each Play upload can use a valid new version code.

The dedicated workflow is `.github/workflows/android-invitation-uat-play-aab.yml`. Pull requests always compile the release-grade AAB contract. When Android upload-key secrets exist it also builds and verifies a signed candidate. A manual workflow dispatch can optionally upload that signed AAB to the existing Google Play closed-testing track.

Required repository secrets for a signed candidate are:

- `WEWED_ANDROID_UPLOAD_KEYSTORE_BASE64`
- `WEWED_UPLOAD_STORE_PASSWORD`
- `WEWED_UPLOAD_KEY_ALIAS`
- `WEWED_UPLOAD_KEY_PASSWORD`

Automated Google Play publication additionally requires `WEWED_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` with Android Publisher access to `pro.wewed.app`.

### Digital Asset Links

Production already associates `pro.wewed.app` with the established Wewed Android signing fingerprints. The PR #202 UAT assetlinks endpoint publishes the same established signing identities for `uat.wewed.pro`, which covers the Google Play app-signing identity used across Play tracks for the same package. Optional `WEWED_UAT_ANDROID_SHA256` values are additive, not required for the established Play association.

On the PR #202 preview, `https://uat.wewed.pro/.well-known/assetlinks.json` is rewritten to `/api/uat/assetlinks` only when `WEWED_PREVIEW_WRITABLE_WEDDING_ID=wewed-pr202-uat-20260912`; production retains its existing static association file.

### Deferred-install enablement gate

`ANDROID_DEFERRED_INVITATION_HANDOFF=0` remains deliberate until **all** of the following are true:

1. the signed `uatPlay` AAB is accepted by the existing Google Play closed-testing track;
2. Play serves that build to the test account/device;
3. `https://uat.wewed.pro/.well-known/assetlinks.json` returns `pro.wewed.app` with the established Play signing fingerprint(s);
4. the installed Play build resolves the UAT host as an Android App Link;
5. only then is `ANDROID_DEFERRED_INVITATION_HANDOFF=1` enabled on the PR #202 preview.

Final qualification is a clean-device round trip: personal invitation or physical QR → Google Play → install → Wewed → exact UAT invitation → Ivory Floral Gold → RSVP. Only opaque short-lived handoff material may enter the Install Referrer; raw RSVP credentials and guest PII must never appear there.

The Excel regression now waits for the visible responsive review element instead of deciding desktop/mobile before React commits the response. The release gate still uses `--fail-on-flaky-tests`.
