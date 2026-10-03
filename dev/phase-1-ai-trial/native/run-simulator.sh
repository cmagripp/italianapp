#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
native_simulator=${PAROLA_TRIAL_SIMULATOR:-80FC8AD8-F787-4C66-AC1B-462ABD6E2AEA}
node build-input.mjs
mkdir -p ../../../dist/native-investigation/NativePrototype.app
native_app=../../../dist/native-investigation/NativePrototype.app
xcrun --sdk iphonesimulator swiftc ItalianPrototype.swift -o "$native_app/NativePrototype" -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -target arm64-apple-ios26.5-simulator -parse-as-library
cp Info.plist "$native_app/Info.plist"
cp native-heldout.json "$native_app/native-heldout.json"
codesign --force --sign - "$native_app"
xcrun simctl install "$native_simulator" "$native_app"
xcrun simctl launch "$native_simulator" local.parola.nativeinvestigation
printf 'Native investigation launched. Read Documents/native-prototype.json in its separate simulator container.\n'
