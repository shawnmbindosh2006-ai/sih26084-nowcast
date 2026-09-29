#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PYTHON_BIN="${PYTHON_BIN:-python3}"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-5173}"
MODE="${1:-persistence}"

if [[ "$MODE" != persistence && "$MODE" != fixture ]]; then
  echo 'Usage: start-demo.sh [persistence|fixture]' >&2
  exit 2
fi
if [[ "$API_PORT" == "$WEB_PORT" ]]; then
  echo 'API_PORT and WEB_PORT must differ.' >&2
  exit 2
fi
if [[ "$WEB_PORT" != 5173 ]]; then
  echo 'The API currently allows dashboard origin port 5173 only.' >&2
  exit 2
fi
if [[ ! -x .venv/bin/python ]]; then
  "$PYTHON_BIN" -m venv .venv
fi
.venv/bin/python -m pip install -r requirements-app.txt
export PYTHONPATH="$ROOT/src"
if [[ ! -f runs/demo-event/event.json ]]; then
  .venv/bin/python -m nowcast.data generate runs/demo-event
fi
.venv/bin/python -m nowcast.data validate runs/demo-event/event.json >/dev/null
mkdir -p runs/logs
export NOWCAST_RUNS_DIR="$ROOT/runs/api"
if [[ "$MODE" == persistence ]]; then
  export NOWCAST_EVENT_BUNDLE_PATH="$ROOT/runs/demo-event/event.json"
else
  unset NOWCAST_EVENT_BUNDLE_PATH NOWCAST_EVENT_PATH || true
fi
export VITE_API_BASE_URL="http://127.0.0.1:$API_PORT"
export npm_config_cache="$ROOT/runs/npm-cache"
(cd web && npm ci --cache "$npm_config_cache" && npm run build)

.venv/bin/python -m uvicorn nowcast.api.app:app --host 127.0.0.1 --port "$API_PORT" >runs/logs/api.stdout.log 2>runs/logs/api.stderr.log &
API_PID=$!
WEB_PID=''
cleanup() {
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
  kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM
for attempt in {1..30}; do
  if curl --fail --silent "http://127.0.0.1:$API_PORT/health" >/dev/null; then break; fi
  kill -0 "$API_PID" 2>/dev/null || { echo 'API exited; see runs/logs/api.stderr.log' >&2; exit 1; }
  sleep 1
done
curl --fail --silent "http://127.0.0.1:$API_PORT/health" >/dev/null
(cd web && npm run preview -- --host 127.0.0.1 --port "$WEB_PORT") >runs/logs/web.stdout.log 2>runs/logs/web.stderr.log &
WEB_PID=$!
echo "API: http://127.0.0.1:$API_PORT"
echo "Dashboard: http://127.0.0.1:$WEB_PORT"
echo 'Synthetic CPU demo. Press Ctrl+C to stop both servers.'
wait "$WEB_PID"
