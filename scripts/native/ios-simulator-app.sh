#!/usr/bin/env bash
# Build the SwiftUI app for the iOS Simulator, wrap it as an .app bundle and install it.
#
# Local/Shadow builds use the bundle id pro.wewed.app.dev (same isolation rule as Android),
# so they never replace an App Store / TestFlight pro.wewed.app install on the simulator.
#
# Usage: scripts/native/ios-simulator-app.sh [simulator-udid]   (default: first booted simulator)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOS="$ROOT/apps/ios"
DERIVED="$IOS/.build/out"
APP="$IOS/build/WewedApp.app"
BUNDLE_ID="pro.wewed.app.dev"

UDID="${1:-$(xcrun simctl list devices booted -j | python3 -c 'import json,sys; d=json.load(sys.stdin)["devices"]; print(next(x["udid"] for v in d.values() for x in v if x["state"]=="Booted"))')}"

(cd "$IOS" && xcodebuild \
  -scheme WewedApp \
  -sdk iphonesimulator \
  -destination "generic/platform=iOS Simulator" \
  -derivedDataPath "$DERIVED" \
  -configuration Debug \
  -quiet \
  build)

PRODUCTS="$DERIVED/Build/Products/Debug-iphonesimulator"
[ -d "$PRODUCTS" ] || PRODUCTS="$DERIVED/Products/Debug-iphonesimulator"

rm -rf "$APP"
mkdir -p "$APP"
cp "$PRODUCTS/WewedApp" "$APP/WewedApp"
cp -R "$PRODUCTS/WewedIOS_WewedKit.bundle" "$APP/"
cp "$IOS/Wewed/AppTarget/Info.plist" "$APP/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $BUNDLE_ID" "$APP/Info.plist"
/usr/libexec/PlistBuddy -c "Add :CFBundleSupportedPlatforms array" -c "Add :CFBundleSupportedPlatforms:0 string iPhoneSimulator" "$APP/Info.plist" 2>/dev/null || true
codesign --force --sign - --timestamp=none "$APP" >/dev/null

xcrun simctl install "$UDID" "$APP"
echo "Installed $BUNDLE_ID on $UDID"
