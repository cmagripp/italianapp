#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
printf '%s\n' "$$" > evidence/mac-server.pid
exec ../assets/native-llama/runtime/llama-b11146/llama-server -m ../assets/native-llama/models/Qwen3-8B-Q4_K_M.gguf --host 127.0.0.1 --port 8162 -c 4096 -np 1 -ngl 99 -b 256 -ub 256 -fa auto --metrics --no-webui > evidence/mac-server.log 2>&1
