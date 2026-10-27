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
  echo "$(date '+%F %T') limite d'usage ($LOG), attente (tentative $attempt), session $TID"
  # Clock loop, not one long sleep: sleep does not count time while the Mac is asleep.
  # Wait until the reset time announced by Codex ("try again at 3:18 AM") + 2 min, else LIMIT_WAIT.
  AT=$(grep -o 'try again at [0-9]*:[0-9]* [AP]M' "$LOG" | tail -1 | cut -d' ' -f4-)
  T=$(( $(date +%s) + ${LIMIT_WAIT:-18000} ))
  if [ -n "$AT" ]; then
    R=$(date -j -f "%Y-%m-%d %I:%M %p" "$(date +%F) $AT" +%s 2>/dev/null) && {
      [ $R -le $(date +%s) ] && R=$(( R + 86400 ))
      T=$(( R + 120 ))
    }
  fi
  # Dated form: "try again at Nov 2nd, 2026 5:55 PM".
  AD=$(grep -o 'try again at [A-Z][a-z]* [0-9]*[a-z]*, [0-9]* [0-9]*:[0-9]* [AP]M' "$LOG" | tail -1 | cut -d' ' -f4- | sed -E 's/([0-9])(st|nd|rd|th),/\1/')
  if [ -n "$AD" ]; then
    R=$(date -j -f "%b %d %Y %I:%M %p" "$AD" +%s 2>/dev/null) && T=$(( R + 120 ))
  fi
  echo "$(date '+%F %T') reprise prévue le $(date -r $T '+%F %H:%M') (touch .manager/logs/resume-now pour reprendre tout de suite)"
  rm -f .manager/logs/resume-now
  while [ $(date +%s) -lt $T ] && [ ! -f .manager/logs/resume-now ]; do sleep 60; done
  rm -f .manager/logs/resume-now
  # Session NEUVE à chaque reprise (contexte court) : elle repart du rapport, qui sert de passation.
  OUT=$(.manager/run-sprint.sh "$ID")
  echo "$OUT"; LOG=${OUT##*LOG=}
done
echo "$(date '+%F %T') fin $ID ; dernier journal $LOG"
grep -o '"type":"turn.failed".\{0,200\}' "$LOG" | tail -1
