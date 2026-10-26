#!/bin/zsh
# Usage: .manager/run-until-done.sh <id> [not-before "YYYY-MM-DD HH:MM"]
# Lance le sprint <id> ; si Codex atteint sa limite d'usage, attend 30 min puis relance une session NEUVE
# qui repart du rapport (passation), jusqu'à 24 tentatives. Toute autre fin est rendue telle quelle.
set -u
cd /Users/diaw/Downloads/agregat-back
ID=$1
if [ $# -ge 2 ]; then
  T=$(date -j -f "%Y-%m-%d %H:%M" "$2" +%s)
  while [ $(date +%s) -lt $T ]; do sleep 60; done
fi
limited() { grep -q '"type":"turn.failed".*usage limit' "$1"; }
thread() { grep -o '"thread_id":"[^"]*"' "$1" | head -1 | cut -d'"' -f4; }
echo "$(date '+%F %T') start $ID"
OUT=$(.manager/run-sprint.sh "$ID"); echo "$OUT"
LOG=${OUT##*LOG=}
TID=$(thread "$LOG")
for attempt in $(seq 1 24); do
  limited "$LOG" || break
  echo "$(date '+%F %T') limite d'usage ($LOG), attente 30 min (tentative $attempt), session $TID"
  sleep 1800
  # Session NEUVE à chaque reprise (contexte court) : elle repart du rapport, qui sert de passation.
  OUT=$(.manager/run-sprint.sh "$ID")
  echo "$OUT"; LOG=${OUT##*LOG=}
done
echo "$(date '+%F %T') fin $ID ; dernier journal $LOG"
grep -o '"type":"turn.failed".\{0,200\}' "$LOG" | tail -1
