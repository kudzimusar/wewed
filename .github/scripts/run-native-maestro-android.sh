#!/usr/bin/env bash
set -euo pipefail

APK_PATH="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
METRO_LOG="/tmp/wewed-maestro-metro.log"
METRO_PID_FILE="/tmp/wewed-maestro-metro.pid"

if [[ ! -f "$APK_PATH" ]]; then
  echo "Compiled native APK is missing: $APK_PATH" >&2
  exit 1
fi

adb install -r "$APK_PATH"
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081

(
  cd apps/mobile
  # React Native DevTools is a Chromium desktop process. It is unnecessary for
  # black-box Maestro qualification and cannot safely launch on a headless
  # GitHub runner because Chromium's SUID sandbox is unavailable there.
  # Keep Metro itself in normal CI mode while explicitly suppressing DevTools.
  export EXPO_NO_DEV_TOOLS=1
  exec bunx expo start --localhost --clear
) > "$METRO_LOG" 2>&1 &
metro_pid=$!
echo "$metro_pid" > "$METRO_PID_FILE"

cleanup() {
  kill "$metro_pid" 2>/dev/null || true
  wait "$metro_pid" 2>/dev/null || true
}
trap cleanup EXIT

metro_ready=0
for attempt in $(seq 1 90); do
  if curl -fsS http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
    metro_ready=1
    break
  fi

  if ! kill -0 "$metro_pid" 2>/dev/null; then
    echo 'Metro exited before becoming ready.' >&2
    cat "$METRO_LOG" || true
    exit 1
  fi

  if [[ "$attempt" -eq 90 ]]; then
    echo 'Metro did not become ready.' >&2
    cat "$METRO_LOG" || true
  fi
  sleep 1
done

if [[ "$metro_ready" -ne 1 ]]; then
  exit 1
fi

maestro test .maestro/native-public-smoke.yaml
maestro test \
  -e WEWED_MAESTRO_EMAIL="$WEWED_MAESTRO_EMAIL" \
  -e WEWED_MAESTRO_PASSWORD="$WEWED_MAESTRO_PASSWORD" \
  .maestro/native-authenticated-smoke.yaml

# Exercise both custom-scheme and verified web-link entry points after the
# authenticated journey. Physical-device verification remains a release gate
# for OS-level domain association, but these commands prove the compiled app
# owns and can resolve both native intents without crashing.
adb shell am start -W -a android.intent.action.VIEW -d 'wewed://messages' pro.wewed.app
adb shell am start -W -a android.intent.action.VIEW -d 'https://wewed.pro/messages' pro.wewed.app
