#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIGNING_ENV="${WEWED_ANDROID_SIGNING_ENV:-$HOME/.wewed-release/android-signing.env}"
EXPECTED_UPLOAD_SHA256='C3:D8:56:D7:82:F6:42:C6:88:4D:98:25:52:F5:67:65:3E:35:D5:DA:1E:AB:B1:12:EF:6F:C0:59:8E:88:65:8C'

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

command -v bun >/dev/null 2>&1 || fail 'Bun is required.'
command -v java >/dev/null 2>&1 || fail 'JDK 17 is required.'
command -v keytool >/dev/null 2>&1 || fail 'keytool is required (install/use JDK 17).'
command -v jarsigner >/dev/null 2>&1 || fail 'jarsigner is required (install/use JDK 17).'

[ -f "$SIGNING_ENV" ] || fail "Signing environment not found at $SIGNING_ENV"

set -a
# shellcheck disable=SC1090
. "$SIGNING_ENV"
set +a

for variable in \
  WEWED_UPLOAD_STORE_FILE \
  WEWED_UPLOAD_STORE_PASSWORD \
  WEWED_UPLOAD_KEY_ALIAS \
  WEWED_UPLOAD_KEY_PASSWORD; do
  [ -n "${!variable:-}" ] || fail "Missing $variable in the signing environment."
done

[ -f "$WEWED_UPLOAD_STORE_FILE" ] || fail "Upload keystore not found at $WEWED_UPLOAD_STORE_FILE"

actual_upload_sha256="$({
  keytool -list -v \
    -keystore "$WEWED_UPLOAD_STORE_FILE" \
    -storepass:env WEWED_UPLOAD_STORE_PASSWORD \
    -alias "$WEWED_UPLOAD_KEY_ALIAS"
} | awk -F'SHA256: ' '/SHA256:/{print $2; exit}' | tr -d '[:space:]')"

[ -n "$actual_upload_sha256" ] || fail 'Could not read the upload certificate SHA-256 fingerprint.'
[ "$actual_upload_sha256" = "$EXPECTED_UPLOAD_SHA256" ] || fail \
  "Upload certificate mismatch. Expected $EXPECTED_UPLOAD_SHA256 but found $actual_upload_sha256"

export CI=true
export EXPO_NO_TELEMETRY=1
export EXPO_PUBLIC_WEWED_API_BASE_URL="${EXPO_PUBLIC_WEWED_API_BASE_URL:-https://wewed.pro}"
export WEWED_ANDROID_VERSION_CODE="${WEWED_ANDROID_VERSION_CODE:-3}"
export WEWED_APP_VERSION="${WEWED_APP_VERSION:-2.0.0}"
export WEWED_REQUIRE_RELEASE_SIGNING=1
unset WEWED_E2E_MODE

[ "$WEWED_ANDROID_VERSION_CODE" = '3' ] || fail \
  "This release-candidate script is pinned to Android versionCode 3; got $WEWED_ANDROID_VERSION_CODE"
[ "$EXPO_PUBLIC_WEWED_API_BASE_URL" = 'https://wewed.pro' ] || fail \
  "Play candidate must use https://wewed.pro; got $EXPO_PUBLIC_WEWED_API_BASE_URL"

printf 'Upload certificate verified: %s\n' "$EXPECTED_UPLOAD_SHA256"
printf 'Generating native Android project for Wewed %s (versionCode %s)...\n' \
  "$WEWED_APP_VERSION" "$WEWED_ANDROID_VERSION_CODE"

cd "$REPO_ROOT/apps/mobile"
bun install
bun run prebuild:android
node scripts/verify-generated-android.mjs

cd android
./gradlew :app:bundleRelease --no-daemon --stacktrace

AAB="$PWD/app/build/outputs/bundle/release/app-release.aab"
[ -s "$AAB" ] || fail "Signed AAB was not created at $AAB"
jarsigner -verify "$AAB" >/dev/null

if command -v shasum >/dev/null 2>&1; then
  aab_sha256="$(shasum -a 256 "$AAB" | awk '{print $1}')"
elif command -v sha256sum >/dev/null 2>&1; then
  aab_sha256="$(sha256sum "$AAB" | awk '{print $1}')"
else
  fail 'Neither shasum nor sha256sum is available to fingerprint the AAB.'
fi

printf '\nWewed native Play candidate built successfully.\n'
printf 'AAB: %s\n' "$AAB"
printf 'versionName: %s\n' "$WEWED_APP_VERSION"
printf 'versionCode: %s\n' "$WEWED_ANDROID_VERSION_CODE"
printf 'SHA-256: %s\n' "$aab_sha256"
printf 'Upload only this signed candidate to the Wewed Closed testing track after exact-head CI is green.\n'
