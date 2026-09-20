#!/usr/bin/env bash
set -euo pipefail

# The extractor, the builder and this script are one pipeline. Provisioning the file the builder
# just wrote — rather than a legacy September export that happens to still be on disk — is what
# stops the device from running an older graph while the environment badge reads "Private Real".
SNAPSHOT_NAME="charity-kudzie-private-real-uat-v2.json"
REQUIRED_SCHEMA="private-real-uat/2"
PROTECTED_DIR="$HOME/.wewed-shadow/charity-kudzie"
SOURCE_FIXTURE="$PROTECTED_DIR/$SNAPSHOT_NAME"
MANIFEST="$PROTECTED_DIR/private-real-uat-v2-manifest.json"

if [[ ! -f "$SOURCE_FIXTURE" ]]; then
  echo "FAIL: Canonical Private Real UAT snapshot not found at $SOURCE_FIXTURE"
  echo "Run: python3 mobile/shadow/tools/build_canonical_uat_snapshot.py"
  exit 1
fi

# Refuse to provision a snapshot the native builds cannot parse, so a schema mismatch surfaces
# here instead of as an empty screen on the device.
snapshot_schema="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["metadata"]["schemaVersion"])' "$SOURCE_FIXTURE" 2>/dev/null || echo unreadable)"
if [[ "$snapshot_schema" != "$REQUIRED_SCHEMA" ]]; then
  echo "FAIL: snapshot schema is '$snapshot_schema' but the native builds require '$REQUIRED_SCHEMA'."
  exit 1
fi

echo "== Provisioning Private Real UAT Snapshot =="
echo "Source: $SOURCE_FIXTURE"
echo "Schema: $snapshot_schema"
SNAPSHOT_SHA="$( { sha256sum "$SOURCE_FIXTURE" 2>/dev/null || shasum -a 256 "$SOURCE_FIXTURE"; } | awk '{print $1}')"
echo "SHA-256 (prefix): ${SNAPSHOT_SHA:0:16}"
if [[ -f "$MANIFEST" ]]; then
  # Counts only. No private values are printed.
  python3 -c 'import json,sys; m=json.load(open(sys.argv[1])); c={k:v for k,v in m.get("domainCounts",{}).items() if v}; print("Domains: " + ", ".join(f"{k}={v}" for k,v in sorted(c.items(), key=lambda kv: -kv[1])))' "$MANIFEST"
fi

# 1. Android Emulator Provisioning
if command -v adb >/dev/null 2>&1; then
  devices="$(adb devices | grep -v "List of devices" | grep "device$" || true)"
  if [[ -n "$devices" ]]; then
    echo "Provisioning to Android app-private storage..."
    staging="/data/local/tmp/wewed-private-real-uat.$$"
    cleanup_android_staging() {
      adb shell rm -f "$staging" >/dev/null 2>&1 || true
    }
    trap cleanup_android_staging EXIT

    adb push "$SOURCE_FIXTURE" "$staging" >/dev/null
    adb shell chmod 644 "$staging"

    provisioned=0
    for package_id in pro.wewed.app.dev pro.wewed.app.uatdev; do
      if adb shell pm path "$package_id" >/dev/null 2>&1; then
        # The command crosses two shells (host -> adb shell -> run-as sh), so the inner script is
        # single-quoted as one argument. The previous form lost its quoting and failed with
        # "mkdir: Needs 1 argument", silently leaving the device unprovisioned.
        if adb shell "run-as $package_id sh -c 'mkdir -p files; cp \"$staging\" files/$SNAPSHOT_NAME; chmod 600 files/$SNAPSHOT_NAME'" 2>/dev/null \
           && adb shell "run-as $package_id sh -c 'test -s files/$SNAPSHOT_NAME'" 2>/dev/null; then
          echo "PASS: Android $package_id app-private snapshot provisioned"
          provisioned=1
        fi
      fi
    done

    cleanup_android_staging
    trap - EXIT

    if [[ "$provisioned" != "1" ]]; then
      echo "FAIL: No debuggable Wewed .dev/.uatdev app was available for app-private provisioning."
      echo "Install the isolated native debug/UAT app first; public tmp/sdcard storage is prohibited."
      exit 2
    fi
  else
    echo "INFO: No Android device/emulator online"
  fi
fi

# 2. iOS Simulator Provisioning
if command -v xcrun >/dev/null 2>&1; then
  booted_sims="$(xcrun simctl list devices booted | grep "(Booted)" | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/' || true)"
  if [[ -n "$booted_sims" ]]; then
    for sim_udid in $booted_sims; do
      echo "Provisioning to iOS simulator UDID: $sim_udid..."
      # Provision whichever isolated Wewed identity is installed. Private
      # snapshots live in Application Support, never Documents/iCloud.
      ios_bundle_ids=(
        "pro.wewed.app.dev"
        "pro.wewed.app.uatdev"
      )
      ios_provisioned=0
      for bundle_id in "${ios_bundle_ids[@]}"; do
        app_data="$(xcrun simctl get_app_container "$sim_udid" "$bundle_id" data 2>/dev/null || true)"
        if [[ -n "$app_data" && -d "$app_data" ]]; then
          target_dir="$app_data/Library/Application Support/wewed"
          mkdir -p "$target_dir"
          cp -f "$SOURCE_FIXTURE" "$target_dir/$SNAPSHOT_NAME"
          chmod 600 "$target_dir/$SNAPSHOT_NAME"
          echo "PASS: iOS $bundle_id protected Application Support snapshot provisioned"
          ios_provisioned=1
        fi
      done

      if [[ "$ios_provisioned" != "1" ]]; then
        echo "INFO: No isolated iOS .dev/.uatdev app container is installed yet."
      fi
      if [[ "$ios_provisioned" == "1" ]]; then
        echo "PASS: iOS private snapshot exists only inside installed .dev/.uatdev app containers."
      fi
    done
  else
    echo "INFO: No iOS simulator booted"
  fi
fi

# Record what was provisioned so the operator (and the UAT lane) can confirm the device is on the
# same snapshot the pipeline just produced.
echo "== Provisioning Complete =="
echo "Provisioned snapshot: $SNAPSHOT_NAME"
echo "Schema: $REQUIRED_SCHEMA  SHA-256 prefix: ${SNAPSHOT_SHA:0:16}…"
echo "NOTE: 'clearState: true' in a Maestro flow, and re-installing the app, both wipe this"
echo "      app-private snapshot. Run sanitized flows first, then provision, then the UAT lane."
