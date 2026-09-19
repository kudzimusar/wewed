#!/usr/bin/env bash
set -euo pipefail

SOURCE_FIXTURE="$HOME/.wewed-shadow/charity-kudzie/charity-kudzie-private-real-shadow.json"

if [[ ! -f "$SOURCE_FIXTURE" ]]; then
  echo "FAIL: Source private real shadow fixture not found at $SOURCE_FIXTURE"
  exit 1
fi

echo "== Provisioning Private Real Shadow Fixture =="
echo "Source: $SOURCE_FIXTURE"
sha256sum "$SOURCE_FIXTURE" 2>/dev/null || shasum -a 256 "$SOURCE_FIXTURE"

# 1. Android Emulator Provisioning
if command -v adb >/dev/null 2>&1; then
  devices="$(adb devices | grep -v "List of devices" | grep "device$" || true)"
  if [[ -n "$devices" ]]; then
    echo "Provisioning to Android emulator/device..."
    adb push "$SOURCE_FIXTURE" /data/local/tmp/charity-kudzie-private-real-shadow.json
    adb shell chmod 644 /data/local/tmp/charity-kudzie-private-real-shadow.json
    echo "PASS: Android /data/local/tmp provisioned"
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
      # Simulator sandbox home
      sim_home="$HOME/Library/Developer/CoreSimulator/Devices/$sim_udid/data"
      target_dir="$sim_home/.wewed-shadow/charity-kudzie"
      mkdir -p "$target_dir"
      cp -f "$SOURCE_FIXTURE" "$target_dir/charity-kudzie-private-real-shadow.json"

      # Provision whichever Wewed identity is installed. Debug/UAT must never
      # depend on the production bundle identifier.
      ios_bundle_ids=(
        "pro.wewed.app.dev"
        "pro.wewed.app.uatdev"
        "pro.wewed.app"
      )
      for bundle_id in "${ios_bundle_ids[@]}"; do
        app_data="$(xcrun simctl get_app_container "$sim_udid" "$bundle_id" data 2>/dev/null || true)"
        if [[ -n "$app_data" && -d "$app_data" ]]; then
          mkdir -p "$app_data/Documents"
          cp -f "$SOURCE_FIXTURE" "$app_data/Documents/charity-kudzie-private-real-shadow.json"
          echo "PASS: iOS $bundle_id Documents container provisioned at $app_data/Documents"
        fi
      done
      echo "PASS: iOS simulator home provisioned at $target_dir"
    done
  else
    echo "INFO: No iOS simulator booted"
  fi
fi

echo "== Provisioning Complete =="
