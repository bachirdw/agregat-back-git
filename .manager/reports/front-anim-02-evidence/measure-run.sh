#!/bin/bash
set -euo pipefail

BACK=/Users/diaw/Downloads/agregat-back
FRONT=/Users/diaw/Downloads/agregat-front
EVIDENCE="$BACK/.manager/reports/front-anim-02-evidence"

for port in 4322 5176; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null; then
    echo "Port $port déjà occupé ; arrêt sans toucher au processus existant." >&2
    exit 1
  fi
done

snapshot=$(mktemp -d /private/tmp/front-anim-02-measure.XXXXXX)
back_pid=
vite_pid=
cleanup() {
  code=$?
  trap - EXIT
  if [[ -n "$vite_pid" ]]; then kill "$vite_pid" 2>/dev/null || true; fi
  if [[ -n "$back_pid" ]]; then kill "$back_pid" 2>/dev/null || true; fi
  if [[ -n "$vite_pid" ]]; then wait "$vite_pid" 2>/dev/null || true; fi
  if [[ -n "$back_pid" ]]; then wait "$back_pid" 2>/dev/null || true; fi
  rm -rf "$snapshot"
  exit "$code"
}
trap cleanup EXIT INT TERM

git -C "$BACK" archive HEAD | tar -x -C "$snapshot"
ln -s "$BACK/node_modules" "$snapshot/node_modules"
(
  cd "$snapshot"
  exec env -u GEMINI_API_KEY PORT=4322 AGENT_PLATFORM_LIVE=0 AGENT_PLATFORM_NETWORK=0 AGENT_PLATFORM_BROWSER=fixture node apps/api/server.js
) > "$EVIDENCE/backend-measure.log" 2>&1 &
back_pid=$!
(
  cd "$FRONT"
  exec env AGENT_PLATFORM_API_URL=http://127.0.0.1:4322 node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5176 --strictPort
) > "$EVIDENCE/vite-measure.log" 2>&1 &
vite_pid=$!

ready=0
for ((i=0; i<60; i++)); do
  if curl -fsS http://127.0.0.1:4322/api/catalog >/dev/null 2>&1 && curl -fsS http://127.0.0.1:5176/ >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.25
done
if [[ "$ready" != 1 ]]; then
  echo "Serveurs locaux indisponibles ; voir backend-measure.log et vite-measure.log." >&2
  exit 1
fi

node "$EVIDENCE/measure.mjs" > "$EVIDENCE/measure.log" 2>&1
