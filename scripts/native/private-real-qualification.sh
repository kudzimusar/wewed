#!/usr/bin/env bash
# LOCAL-ONLY Private Real Shadow qualification.
#
# Proves the app on a device is showing the authentic wedding graph, without ever printing,
# committing or uploading a private value:
#   1. installs the private snapshot into the pro.wewed.app.dev app's own storage;
#   2. checks the app loaded exactly those bytes (SHA-256 logged at launch vs. the file);
#   3. runs the .maestro/private-real flows (pseudonym pattern + generic contributor checks,
#      Invitation -> RSVP -> Pass for one guest);
#   4. inspects the live view hierarchy of key screens and reports COUNTS only;
#   5. removes the snapshot from the device again.
# Screenshots and hierarchy dumps stay under ~/.wewed-shadow/…/qualification/ (mode 700), never in Git.
#
# Usage: scripts/native/private-real-qualification.sh android emulator-5560
#        scripts/native/private-real-qualification.sh ios <simulator-udid>
set -euo pipefail

PLATFORM="${1:?android|ios}"
DEVICE="${2:?device serial or simulator udid}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_ID="pro.wewed.app.dev"
FILE_NAME="charity-kudzie-private-real-shadow.json"
SNAPSHOT="${WEWED_PRIVATE_SHADOW_PATH:-$HOME/.wewed-shadow/charity-kudzie/$FILE_NAME}"
OUT="$HOME/.wewed-shadow/charity-kudzie/qualification/$(date +%Y%m%d-%H%M%S)-$PLATFORM"
export PATH="$HOME/Library/Android/sdk/platform-tools:$HOME/.maestro/bin:$PATH"

[ -f "$SNAPSHOT" ] || { echo "FAIL: private snapshot not found (set WEWED_PRIVATE_SHADOW_PATH)."; exit 1; }
case "$OUT" in "$ROOT"*) echo "FAIL: refusing to write private evidence inside the repository."; exit 1;; esac
mkdir -p "$OUT" && chmod 700 "$OUT"
EXPECTED_SHA="$(shasum -a 256 "$SNAPSHOT" | cut -d' ' -f1)"
echo "== Private Real Shadow qualification ($PLATFORM, $DEVICE)"
echo "snapshot sha256 (expected): ${EXPECTED_SHA:0:16}…"
echo "private evidence directory: $OUT"

provision() {
  if [ "$PLATFORM" = android ]; then
    adb -s "$DEVICE" shell pm path "$APP_ID" >/dev/null || { echo "FAIL: $APP_ID is not installed on $DEVICE"; exit 1; }
    # Copies elsewhere on the device are read first by the app; remove stale ones so provenance is unambiguous.
    adb -s "$DEVICE" shell rm -f "/data/local/tmp/$FILE_NAME" "/sdcard/$FILE_NAME" >/dev/null 2>&1 || true
    adb -s "$DEVICE" exec-in run-as "$APP_ID" sh -c "mkdir -p files && cat > files/$FILE_NAME" < "$SNAPSHOT"
  else
    local data; data="$(xcrun simctl get_app_container "$DEVICE" "$APP_ID" data)"
    mkdir -p "$data/Documents" && cp -f "$SNAPSHOT" "$data/Documents/$FILE_NAME"
  fi
}

remove_snapshot() {
  if [ "$PLATFORM" = android ]; then
    adb -s "$DEVICE" shell run-as "$APP_ID" rm -f "files/$FILE_NAME" >/dev/null 2>&1 || true
  else
    local data; data="$(xcrun simctl get_app_container "$DEVICE" "$APP_ID" data 2>/dev/null || true)"
    [ -n "$data" ] && rm -f "$data/Documents/$FILE_NAME"
  fi
}
trap remove_snapshot EXIT

loaded_sha() {
  if [ "$PLATFORM" = android ]; then
    adb -s "$DEVICE" logcat -d -s WewedProvenance:I | grep -o 'environment=PRIVATE_REAL_SHADOW sha256=[0-9a-f]*' | tail -1 | sed 's/.*sha256=//'
  else
    xcrun simctl spawn "$DEVICE" log show --last 5m --style compact --predicate 'eventMessage CONTAINS "WewedProvenance"' 2>/dev/null \
      | grep -o 'environment=private_real_shadow sha256=[0-9a-f]*' | tail -1 | sed 's/.*sha256=//'
  fi
}

screenshot() {
  if [ "$PLATFORM" = android ]; then adb -s "$DEVICE" exec-out screencap -p > "$OUT/$1.png"
  else xcrun simctl io "$DEVICE" screenshot "$OUT/$1.png" >/dev/null 2>&1; fi
}

run_flow() {
  local name="$1"
  if maestro --device "$DEVICE" test --test-output-dir "$OUT/maestro-$name" "$ROOT/.maestro/private-real/$name.yaml" > "$OUT/maestro-$name.log" 2>&1; then
    echo "PASS flow: $name"
  else
    echo "FAIL flow: $name (log: $OUT/maestro-$name.log)"; FAILED=1
  fi
}

inspect() {
  # Dump the current screen and report counts only. Names never leave this machine's private folder.
  local label="$1"
  maestro --device "$DEVICE" hierarchy > "$OUT/hierarchy-$label.json" 2>/dev/null || true
  screenshot "screen-$label"
  python3 - "$SNAPSHOT" "$OUT/hierarchy-$label.json" "$label" <<'PY' || FAILED=1
import json, re, sys
snapshot, dump, label = sys.argv[1:4]
names = {g["name"].strip() for g in json.load(open(snapshot))["guests"] if g.get("name", "").strip()}
try:
    tree = json.loads(open(dump).read()[open(dump).read().index("{"):])
except Exception:
    print(f"FAIL inspect {label}: could not read the view hierarchy"); sys.exit(1)
texts = []
def walk(node):
    for key, value in (node.get("attributes") or {}).items():
        if key in ("text", "accessibilityText", "hintText", "content-desc", "value", "label") and isinstance(value, str) and value.strip():
            texts.append(value.strip())
    for child in node.get("children") or []:
        walk(child)
walk(tree)
pseudonyms = sum(1 for t in texts if re.search(r"Guest G\d+", t))
generic = sum(1 for t in texts if "Guest Contributor" in t)
real = {n for n in names for t in texts if n == t or n in t}
ok = pseudonyms == 0 and generic == 0 and len(real) > 0
print(f"{'PASS' if ok else 'FAIL'} inspect {label}: visible text nodes={len(texts)}, "
      f"authorized real identities visible={len(real)}, 'Guest G###' pseudonyms={pseudonyms}, 'Guest Contributor'={generic}")
sys.exit(0 if ok else 1)
PY
}

FAILED=0
provision

# Provenance: launch once in private mode and compare the bytes the app loaded with the file.
if [ "$PLATFORM" = android ]; then
  adb -s "$DEVICE" logcat -c
  adb -s "$DEVICE" shell am force-stop "$APP_ID"
  adb -s "$DEVICE" shell am start -W -n "$APP_ID/pro.wewed.app.MainActivity" --es wewed_native_env private_real_shadow >/dev/null
else
  xcrun simctl terminate "$DEVICE" "$APP_ID" >/dev/null 2>&1 || true
  xcrun simctl launch "$DEVICE" "$APP_ID" -wewed_native_env private_real_shadow >/dev/null
fi
sleep 4
LOADED_SHA="$(loaded_sha || true)"
if [ "$LOADED_SHA" = "$EXPECTED_SHA" ]; then
  echo "PASS provenance: app loaded the private snapshot (sha256 ${LOADED_SHA:0:16}… matches)"
else
  echo "FAIL provenance: app reported '${LOADED_SHA:-nothing}', expected ${EXPECTED_SHA:0:16}…"; FAILED=1
fi

run_flow couple-journey
run_flow inspect-couple-guests;        inspect couple-guests
run_flow inspect-couple-contributions; inspect couple-contributions
run_flow guest-journey;                inspect guest-pass
run_flow planner-contributions;        inspect planner-guests

echo "private evidence kept locally in $OUT (not in Git, not uploaded)"
if [ "$FAILED" -ne 0 ]; then echo "RESULT: FAIL"; exit 1; fi
echo "RESULT: PASS"
