#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
trial_simulator=${PAROLA_TRIAL_SIMULATOR:-80FC8AD8-F787-4C66-AC1B-462ABD6E2AEA}
mkdir -p Trial.app
xcrun --sdk iphonesimulator swiftc Trial.swift -o Trial.app/Trial -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -target arm64-apple-ios26.5-simulator -parse-as-library
cp Info.plist Trial.app/Info.plist
codesign --force --sign - Trial.app
if ! xcrun simctl list devices booted | rg -q "$trial_simulator"; then xcrun simctl boot "$trial_simulator"; fi
xcrun simctl bootstatus "$trial_simulator" -b
xcrun simctl install "$trial_simulator" Trial.app
xcrun simctl launch "$trial_simulator" local.parola.phase1trial
echo "Read probe.json in the app's Documents directory using simctl get_app_container. The trial server must be running on 8132."
