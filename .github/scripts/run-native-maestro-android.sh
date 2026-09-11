#!/usr/bin/env bash
set -euo pipefail

APK_PATH="apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk"
METRO_LOG="/tmp/wewed-maestro-metro.log"
METRO_PID_FILE="/tmp/wewed-maestro-metro.pid"
XVFB_LOG="/tmp/wewed-maestro-xvfb.log"

if [[ ! -f "$APK_PATH" ]]; then
  echo "Compiled native APK is missing: $APK_PATH" >&2
  exit 1
fi

adb install -r "$APK_PATH"
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8081 tcp:8081

metro_pid=""
xvfb_pid=""

cleanup() {
  if [[ -n "$metro_pid" ]]; then
    kill "$metro_pid" 2>/dev/null || true
    wait "$metro_pid" 2>/dev/null || true
  fi
  if [[ -n "$xvfb_pid" ]]; then
    kill "$xvfb_pid" 2>/dev/null || true
    wait "$xvfb_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# React Native DevTools is Chromium-based. Expo/RN 0.86 installs it when Metro
# starts even though Maestro does not use it. Give that auxiliary process a
# virtual display so it cannot block Metro on a headless GitHub runner.
if [[ -z "${DISPLAY:-}" ]] && command -v Xvfb >/dev/null 2>&1; then
  export DISPLAY=:99
  Xvfb "$DISPLAY" -screen 0 1280x720x24 -nolisten tcp > "$XVFB_LOG" 2>&1 &
  xvfb_pid=$!
  sleep 1
  if ! kill -0 "$xvfb_pid" 2>/dev/null; then
    echo 'Xvfb failed to start.' >&2
    cat "$XVFB_LOG" || true
    exit 1
  fi
fi

: > "$METRO_LOG"

start_metro() {
  if [[ -n "$metro_pid" ]]; then
    kill "$metro_pid" 2>/dev/null || true
    wait "$metro_pid" 2>/dev/null || true
  fi

  {
    echo
    echo "===== Starting Metro at $(date -u +%Y-%m-%dT%H:%M:%SZ) ====="
  } >> "$METRO_LOG"

  (
    cd apps/mobile
    exec bunx expo start --localhost --clear
  ) >> "$METRO_LOG" 2>&1 &
  metro_pid=$!
  echo "$metro_pid" > "$METRO_PID_FILE"
}

configure_devtools_sandbox() {
  local sandbox
  local found=0

  while IFS= read -r -d '' sandbox; do
    found=1
    echo "Configuring React Native DevTools Chromium sandbox: $sandbox"
    sudo chown root:root "$sandbox"
    sudo chmod 4755 "$sandbox"
    stat -c 'DevTools sandbox owner=%U group=%G mode=%a path=%n' "$sandbox"
  done < <(
    find "$HOME/.cache/dotslash" \
      -type f \
      -path '*/React Native DevTools-linux-x64/chrome-sandbox' \
      -print0 2>/dev/null || true
  )

  [[ "$found" -eq 1 ]]
}

start_metro

metro_ready=0
sandbox_repair_attempted=0
for attempt in $(seq 1 120); do
  if curl -fsS http://127.0.0.1:8081/status | grep -q 'packager-status:running'; then
    metro_ready=1
    break
  fi

  # On Linux CI, RN DevTools may be downloaded only after Metro starts. The
  # bundled Chromium intentionally refuses to run if its SUID sandbox is not
  # root-owned with mode 4755. Repair exactly that prerequisite once, then
  # restart Metro and continue waiting for the real packager status endpoint.
  if [[ "$sandbox_repair_attempted" -eq 0 ]] \
    && grep -q 'React Native DevTools' "$METRO_LOG" \
    && grep -q 'chrome-sandbox' "$METRO_LOG"; then
    echo 'React Native DevTools requested Chromium SUID sandbox provisioning.'
    if ! configure_devtools_sandbox; then
      echo 'DevTools reported a sandbox failure but no sandbox binary was found.' >&2
      cat "$METRO_LOG" || true
      exit 1
    fi
    sandbox_repair_attempted=1
    start_metro
    continue
  fi

  if ! kill -0 "$metro_pid" 2>/dev/null; then
    echo 'Metro exited before becoming ready.' >&2
    cat "$METRO_LOG" || true
    exit 1
  fi

  if [[ "$attempt" -eq 120 ]]; then
    echo 'Metro did not become ready.' >&2
    cat "$METRO_LOG" || true
    if [[ -f "$XVFB_LOG" ]]; then
      echo '--- Xvfb diagnostics ---' >&2
      cat "$XVFB_LOG" || true
    fi
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
