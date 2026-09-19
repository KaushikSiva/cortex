#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -x .venv/bin/python ]]; then CORTEX_PYTHON=.venv/bin/python
elif [[ -x .venv-voice/bin/python ]]; then CORTEX_PYTHON=.venv-voice/bin/python
else echo 'Create .venv and install robot/requirements.txt and voice/requirements.txt first.' >&2; exit 1; fi
"$CORTEX_PYTHON" robot/server.py &
CORTEX_ROBOT_PID=$!
"$CORTEX_PYTHON" voice/server.py &
CORTEX_VOICE_PID=$!
npm run dev &
CORTEX_WEB_PID=$!
trap 'kill "$CORTEX_ROBOT_PID" "$CORTEX_VOICE_PID" "$CORTEX_WEB_PID" 2>/dev/null || true' EXIT INT TERM
wait
