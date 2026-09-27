#!/usr/bin/env bash
# FINAL NATIVE GUEST SURFACE certification (QRO04-UI01). Runs only the tests named in
# mobile/contracts/final-native-ui-certification.json, against the final native apps under apps/.
# Never runs Shadow/persona automation and never touches the legacy top-level TWA wrapper.
#   IOS_DESTINATION="id=<simulator-udid>" ANDROID_SERIAL=<serial> scripts/native-mobile/final-native-ui-certification.sh
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
manifest="$root/mobile/contracts/final-native-ui-certification.json"
python3 "$root/scripts/native-mobile/guest-profile-ui-server.py" & server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
ios_tests=$(python3 -c "import json;print(' '.join('-only-testing:'+t for t in json.load(open('$manifest'))['finalNativeGuestSurfaceTests']['ios']['tests']))")
android_classes=$(python3 -c "import json;print(','.join(json.load(open('$manifest'))['finalNativeGuestSurfaceTests']['android']['classes']))")
if [[ -n "${IOS_DESTINATION:-}" ]]; then
  (cd "$root/apps/ios" && xcodegen generate --spec project.yml >/dev/null && \
    xcodebuild test -project Wewed.xcodeproj -scheme Wewed -destination "$IOS_DESTINATION" $ios_tests)
fi
if [[ -n "${ANDROID_SERIAL:-}" ]]; then
  (cd "$root/apps/android" && ./gradlew connectedDebugAndroidTest \
    -Pandroid.testInstrumentationRunnerArguments.class="$android_classes")
fi
