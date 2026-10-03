#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
# This uses already provisioned pinned assets. It never downloads a model.
native_runtime=../assets/native-llama/runtime
native_source=$native_runtime/llama.cpp-7fe450e19305b828c199d602c23a8337aaa1f03b
native_build=$native_runtime/build-ios-sim
test -f "$native_source/include/llama.h"
cmake -S "$native_source" -B "$native_build" \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_SYSTEM_NAME=iOS \
  -DCMAKE_OSX_SYSROOT=iphonesimulator -DCMAKE_OSX_ARCHITECTURES=arm64 \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=26.5 -DBUILD_SHARED_LIBS=OFF \
  -DLLAMA_BUILD_APP=OFF -DLLAMA_BUILD_COMMON=OFF -DLLAMA_BUILD_EXAMPLES=OFF \
  -DLLAMA_BUILD_TOOLS=OFF -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_SERVER=OFF \
  -DLLAMA_BUILD_MTMD=OFF -DLLAMA_OPENSSL=OFF \
  -DGGML_METAL=ON -DGGML_METAL_EMBED_LIBRARY=ON -DGGML_METAL_TARGET_OS=ios \
  -DIOS=ON -DGGML_OPENMP=OFF -DGGML_NATIVE=OFF
cmake --build "$native_build" --parallel 8
xcrun --sdk iphonesimulator clang++ -std=c++17 -O2 \
  -target arm64-apple-ios26.5-simulator \
  -isysroot "$(xcrun --sdk iphonesimulator --show-sdk-path)" \
  -I "$native_source/include" -I "$native_source/ggml/include" \
  -c llama-bridge.cpp -o "$native_runtime/bridge-ios-sim.o"
printf 'Pinned native simulator runtime and bridge built. No app launched.\n'
