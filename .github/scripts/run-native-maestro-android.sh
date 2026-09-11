#!/usr/bin/env bash
set -euo pipefail

APK_PATH="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
METRO_LOG="/tmp/wewed-maestro-metro.log"
METRO_PID_FILE="/tmp/wewed-maestro-metro.pid"
METRO_STATUS_URL="http://localhost:8081/status"

if [[ ! -f "$APK_PATH" ]]; then
  echo "Compiled native APK is missing: $APK_PATH" >&2
  exit 1
fi

adb install -r "$APK_PATH"
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081

(
  cd apps/mobile
  # Expo SDK 57 treats EXPO_UNSTABLE_HEADLESS as the headless-server switch.
  # In this mode Expo disables the standalone React Native DevTools shell, so
  # Maestro can use Metro without downloading or launching Chromium on Linux CI.
  export EXPO_UNSTABLE_HEADLESS=1
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
for attempt in $(seq 1 120); do
  # Expo's --localhost path asks Node to listen on the hostname "localhost".
  # On GitHub Linux that hostname can resolve to IPv6 ::1, so probe the same
  # hostname rather than assuming an IPv4-only 127.0.0.1 listener.
  if curl -fsS "$METRO_STATUS_URL" | grep -q 'packager-status:running'; then
    metro_ready=1
    break
  fi

  if ! kill -0 "$metro_pid" 2>/dev/null; then
    echo 'Metro exited before becoming ready.' >&2
    cat "$METRO_LOG" || true
    exit 1
  fi

  if [[ "$attempt" -eq 120 ]]; then
    echo 'Metro did not become ready.' >&2
    cat "$METRO_LOG" || true
    echo '--- localhost resolution ---' >&2
    getent ahosts localhost || true
    echo '--- listeners on port 8081 ---' >&2
    ss -ltnp 2>/dev/null | grep ':8081' || true
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
