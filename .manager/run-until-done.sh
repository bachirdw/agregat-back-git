#!/bin/zsh
# Usage: .manager/run-until-done.sh <id> [not-before "YYYY-MM-DD HH:MM"]
# Lance le sprint <id> ; si Codex atteint sa limite d'usage, attend LIMIT_WAIT s (défaut 5 h) puis relance une session NEUVE
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
for attempt in $(seq 1 4); do
  limited "$LOG" || break
  echo "$(date '+%F %T') limite d'usage ($LOG), attente ${LIMIT_WAIT:-18000} s (tentative $attempt), session $TID"
  # Clock loop, not one long sleep: sleep does not count time while the Mac is asleep.
  T=$(( $(date +%s) + ${LIMIT_WAIT:-18000} )); while [ $(date +%s) -lt $T ]; do sleep 60; done
  # Session NEUVE à chaque reprise (contexte court) : elle repart du rapport, qui sert de passation.
  OUT=$(.manager/run-sprint.sh "$ID")
  echo "$OUT"; LOG=${OUT##*LOG=}
done
echo "$(date '+%F %T') fin $ID ; dernier journal $LOG"
grep -o '"type":"turn.failed".\{0,200\}' "$LOG" | tail -1
