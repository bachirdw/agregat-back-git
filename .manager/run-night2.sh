#!/bin/zsh
# Chaîne de nuit du 28→29/10 : attend 22:50 (retour de la limite Codex), puis front-anim-05 (high), revues (medium), rapport.
cd /Users/diaw/Downloads/agregat-back
rm -f .manager/logs/chain.done
EFFORT=high .manager/run-until-done.sh front-anim-05 "2026-10-28 22:50" > .manager/logs/front-anim-05-runner.log 2>&1
for ID in night2-back night2-front night2-final; do
  EFFORT=medium .manager/run-until-done.sh "$ID" > .manager/logs/$ID-runner.log 2>&1
done
echo "$(date '+%F %T') night2" > .manager/logs/chain.done
