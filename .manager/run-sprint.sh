#!/bin/zsh
# Usage: .manager/run-sprint.sh <NN> [resume-session-id "message"]
# Lance (ou reprend) une session Codex gpt-6.1-sol pour un sprint, journal JSONL complet dans .manager/logs/.
set -u
cd /Users/diaw/Downloads/agregat-back
[ -f .manager/secrets.env ] && { set -a; source .manager/secrets.env; set +a; }
N=$1
TS=$(date +%Y%m%d-%H%M%S)
LOG=.manager/logs/$N-$TS.jsonl
COMMON=(-m gpt-6.1-sol -c model_reasoning_effort=\"${EFFORT:-medium}\" -c sandbox_workspace_write.network_access=true)
if [ $# -ge 3 ]; then
  codex exec resume "${COMMON[@]}" --json -o .manager/logs/$N-$TS.last.md "$2" "$3" < /dev/null > "$LOG" 2>&1
else
  PROMPT="Tu es l'ingénieur principal de ce projet, supervisé par un manager. Lis AGENTS.md puis exécute intégralement le brief .manager/briefs/$N.md. Prends ton temps, travaille en profondeur, vérifie tout. Tiens le rapport .manager/reports/$N.md à jour au fil de l'eau, y compris toutes les erreurs. Ne t'arrête que lorsque le brief est accompli ou réellement bloqué."
  codex exec "${COMMON[@]}" --add-dir /Users/diaw/Downloads/agent-repos --approve-for-me \
    --json -o .manager/logs/$N-$TS.last.md "$PROMPT" < /dev/null > "$LOG" 2>&1
fi
echo "EXIT=$? LOG=$LOG"
