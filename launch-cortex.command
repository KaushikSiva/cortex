#!/usr/bin/env bash
set -euo pipefail

# Double-click launcher for macOS. Run from the copied Desktop/cortex folder or
# from the git checkout; the existing workspace is used when the artifact copy
# does not contain installed dependencies.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -x "$SCRIPT_DIR/.venv/bin/python" || -x "$SCRIPT_DIR/.venv-voice/bin/python" ]] && [[ -d "$SCRIPT_DIR/node_modules" ]]; then
  CORTEX_ROOT="$SCRIPT_DIR"
elif [[ -d "/Users/kaushiksivakumar/workspace/cortex/node_modules" ]]; then
  CORTEX_ROOT="/Users/kaushiksivakumar/workspace/cortex"
else
  CORTEX_ROOT="$SCRIPT_DIR"
  echo "Installing JavaScript dependencies…"
  (cd "$CORTEX_ROOT" && npm install)
fi

cd "$CORTEX_ROOT"
export CORTEX_MEMORY_DIR="${CORTEX_MEMORY_DIR:-$CORTEX_ROOT/memory}"
bash scripts/start-local.sh &
LAUNCHER_PID=$!
sleep 2
open "http://localhost:3000" >/dev/null 2>&1 || true
wait "$LAUNCHER_PID"
