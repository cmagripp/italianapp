#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
native_runtime=../assets/native-llama/runtime
native_build=$native_runtime/build-ios-sim
native_app=../../../dist/native-qwen-investigation/NativeQwen.app
mkdir -p "$native_app"
xcrun --sdk iphonesimulator swiftc GGUFPrototype.swift "$native_runtime/bridge-ios-sim.o" -import-objc-header llama-bridge.h -o "$native_app/NativeQwen" -sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)" -target arm64-apple-ios26.5-simulator -parse-as-library "$native_build/src/libllama.a" "$native_build/ggml/src/libggml.a" "$native_build/ggml/src/libggml-base.a" "$native_build/ggml/src/libggml-cpu.a" "$native_build/ggml/src/ggml-metal/libggml-metal.a" "$native_build/ggml/src/ggml-blas/libggml-blas.a" -lc++ -framework Accelerate -framework Metal -framework Foundation
cp Info.plist "$native_app/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleIdentifier local.parola.nativeqweninvestigation' "$native_app/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleExecutable NativeQwen' "$native_app/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleName Parola Native Qwen Investigation' "$native_app/Info.plist"
cp qwen-native-cases.json "$native_app/qwen-native-cases.json"
codesign --force --sign - "$native_app"
printf 'Built isolated native Qwen simulator app; not installed or launched yet.\n'
