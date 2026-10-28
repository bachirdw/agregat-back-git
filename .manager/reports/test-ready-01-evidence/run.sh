#!/bin/bash
set -euo pipefail

BACK=/Users/diaw/Downloads/agregat-back
FRONT=/Users/diaw/Downloads/agregat-front
EVIDENCE="$BACK/.manager/reports/test-ready-01-evidence"
for port in 4322 5176; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null; then
    echo "Port $port déjà occupé ; aucun processus existant touché." >&2
    exit 1
  fi
done

snapshot=$(mktemp -d /private/tmp/test-ready-01.XXXXXX)
restart_pid_file="$snapshot/restart.pid"
back_pid=
vite_pid=
cleanup() {
  code=$?
  trap - EXIT
  if [[ -f "$restart_pid_file" ]]; then
    read -r restarted_pid < "$restart_pid_file" || true
    if [[ -n "${restarted_pid:-}" ]]; then kill "$restarted_pid" 2>/dev/null || true; fi
  fi
  if [[ -n "$vite_pid" ]]; then kill "$vite_pid" 2>/dev/null || true; fi
  if [[ -n "$back_pid" ]]; then kill "$back_pid" 2>/dev/null || true; fi
  if [[ -n "$vite_pid" ]]; then wait "$vite_pid" 2>/dev/null || true; fi
  if [[ -n "$back_pid" ]]; then wait "$back_pid" 2>/dev/null || true; fi
  rm -rf "$snapshot"
  exit "$code"
}
trap cleanup EXIT INT TERM

mkdir -p "$snapshot/back" "$snapshot/workspace/.agents/skills/career-ops"
git -C "$BACK" archive HEAD | tar -x -C "$snapshot/back"
ln -s "$BACK/node_modules" "$snapshot/back/node_modules"
# Seule la fixture de ce sprint est prise de l'arbre courant ; le code de plateforme reste figé.
cp "$BACK/tests/fixtures/career-agent.js" "$snapshot/back/tests/fixtures/career-agent.js"
cat > "$snapshot/workspace/.agents/skills/career-ops/SKILL.md" <<'EOF'
---
name: career-ops
description: Routeur de test FICTIF
license: MIT
---
# FICTIF
EOF
echo 'CV FICTIF : Python et SQL.' > "$snapshot/workspace/cv.md"
(
  cd "$snapshot/back"
  exec env -u GEMINI_API_KEY -u GOOGLE_API_KEY -u OPENAI_API_KEY -u ANTHROPIC_API_KEY \
    AGENT_PLATFORM_LIVE=0 AGENT_PLATFORM_NETWORK=0 AGENT_PLATFORM_BROWSER=fixture \
    TEST_READY_SNAPSHOT="$snapshot/back" TEST_READY_WORKSPACE="$snapshot/workspace" \
    node "$EVIDENCE/server.mjs"
) > "$EVIDENCE/backend.log" 2>&1 &
back_pid=$!
(
  cd "$FRONT"
  exec env AGENT_PLATFORM_API_URL=http://127.0.0.1:4322 \
    node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5176 --strictPort
) > "$EVIDENCE/vite.log" 2>&1 &
vite_pid=$!
ready=0
for ((i=0; i<80; i++)); do
  if curl -fsS http://127.0.0.1:4322/api/catalog >/dev/null 2>&1 &&
     curl -fsS http://127.0.0.1:5176/ >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.25
done
if [[ "$ready" != 1 ]]; then
  echo 'Serveurs locaux indisponibles ; voir backend.log et vite.log.' >&2
  exit 1
fi
TEST_READY_SNAPSHOT="$snapshot/back" TEST_READY_WORKSPACE="$snapshot/workspace" \
TEST_READY_BACK_PID="$back_pid" TEST_READY_RESTART_PID_FILE="$restart_pid_file" \
node "$EVIDENCE/flow.mjs" > "$EVIDENCE/flow.log" 2>&1
