#!/usr/bin/env bash
# Guards the Android package identity split between local builds and Google Play.
#
#   pro.wewed.app      Google Play only (Play App Signing identity)
#   pro.wewed.app.dev  every locally installable debug build
#
# A debug APK that resolves to pro.wewed.app silently replaces the
# Play-installed Wewed on a tester device or emulator, after which Google Play
# can no longer update it ("Can't install Wewed"). Run this after assembling a
# debug APK and before installing it.
set -euo pipefail

play_package='pro.wewed.app'
output_dir="${1:-}"
expected_package="${2:-pro.wewed.app.dev}"

if [ -z "$output_dir" ]; then
  echo "usage: $0 <apk-output-dir> [expected-local-package]" >&2
  exit 2
fi

if [ "$expected_package" = "$play_package" ]; then
  echo "FAIL: local builds may not use the Google Play package $play_package." >&2
  exit 1
fi

metadata="$output_dir/output-metadata.json"
if [ ! -f "$metadata" ]; then
  echo "FAIL: $metadata not found; assemble the debug APK first." >&2
  exit 1
fi

actual_package="$(sed -n 's/.*"applicationId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$metadata" | head -n 1)"

if [ "$actual_package" = "$play_package" ]; then
  echo "FAIL: $metadata resolves to the Google Play package $play_package." >&2
  echo "      Installing it would replace the Play-installed Wewed; local builds must use $expected_package." >&2
  exit 1
fi

if [ "$actual_package" != "$expected_package" ]; then
  echo "FAIL: expected local package $expected_package, got '${actual_package:-<none>}' in $metadata." >&2
  exit 1
fi

echo "PASS: local Android package is $actual_package; $play_package stays reserved for Google Play."
