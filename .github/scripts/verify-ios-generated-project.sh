#!/usr/bin/env bash
# P1 XcodeGen preservation guard.
#
# `xcodegen generate` previously overwrote the committed Info.plist and entitlements with
# defaults, silently removing the wewed URL scheme, the camera usage description and the
# applinks:wewed.pro associated domain. Those losses break RSVP -> Pass deep-link continuity and
# the gate scanner, and a build still succeeds afterwards — so only an explicit check catches it.
set -euo pipefail

ios_dir="${1:-apps/ios}"
plist="$ios_dir/Wewed/AppTarget/Info.plist"
entitlements="$ios_dir/Wewed/AppTarget/Wewed.entitlements"
project="$ios_dir/Wewed.xcodeproj/project.pbxproj"

fail() { echo "FAIL: $1" >&2; exit 1; }

test -f "$plist" || fail "Info.plist is missing at $plist"
test -f "$entitlements" || fail "Entitlements are missing at $entitlements"

grep -q '<string>wewed</string>' "$plist" || fail "Info.plist lost the 'wewed' URL scheme"
grep -q 'NSCameraUsageDescription' "$plist" || fail "Info.plist lost NSCameraUsageDescription"
grep -q 'applinks:wewed.pro' "$entitlements" || fail "Entitlements lost applinks:wewed.pro"

if [ -f "$project" ]; then
  grep -q 'PRODUCT_BUNDLE_IDENTIFIER = pro.wewed.app.dev;' "$project" || fail "Debug bundle id is not pro.wewed.app.dev"
  grep -q 'PRODUCT_BUNDLE_IDENTIFIER = pro.wewed.app.uatdev;' "$project" || fail "UAT bundle id is not pro.wewed.app.uatdev"
  grep -q 'PRODUCT_BUNDLE_IDENTIFIER = pro.wewed.app;' "$project" || fail "Release bundle id is not pro.wewed.app"
fi

echo "PASS: generated iOS project preserves URL scheme, camera usage, associated domains and bundle identity split."
