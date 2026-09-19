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
    echo "Provisioning to Android app-private storage..."
    staging="/data/local/tmp/wewed-private-real-shadow.$"
    adb push "$SOURCE_FIXTURE" "$staging" >/dev/null
    adb shell chmod 644 "$staging"

    provisioned=0
    for package_id in pro.wewed.app.dev pro.wewed.app.uatdev; do
      if adb shell pm path "$package_id" >/dev/null 2>&1; then
        if adb shell run-as "$package_id" sh -c \
          "mkdir -p files && cp '$staging' files/charity-kudzie-private-real-shadow.json && chmod 600 files/charity-kudzie-private-real-shadow.json"; then
          echo "PASS: Android $package_id app-private snapshot provisioned"
          provisioned=1
        fi
      fi
    done

    adb shell rm -f "$staging"

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
      # Simulator sandbox home
      sim_home="$HOME/Library/Developer/CoreSimulator/Devices/$sim_udid/data"
      target_dir="$sim_home/.wewed-shadow/charity-kudzie"
      mkdir -p "$target_dir"
      cp -f "$SOURCE_FIXTURE" "$target_dir/charity-kudzie-private-real-shadow.json"

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
          cp -f "$SOURCE_FIXTURE" "$target_dir/charity-kudzie-private-real-shadow.json"
          chmod 600 "$target_dir/charity-kudzie-private-real-shadow.json"
          echo "PASS: iOS $bundle_id protected Application Support snapshot provisioned"
          ios_provisioned=1
        fi
      done

      if [[ "$ios_provisioned" != "1" ]]; then
        echo "INFO: No isolated iOS .dev/.uatdev app container is installed yet."
      fi
      echo "PASS: iOS simulator home provisioned at $target_dir"
    done
  else
    echo "INFO: No iOS simulator booted"
  fi
fi

echo "== Provisioning Complete =="
