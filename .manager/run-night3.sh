#!/bin/zsh
# Chaîne de nuit du 29→30/10 : fix-truth-01 (medium), skill-router-01 (high), night2-front, rapport final.
cd /Users/diaw/Downloads/agregat-back
rm -f .manager/logs/chain.done
EFFORT=medium .manager/run-until-done.sh fix-truth-01 > .manager/logs/fix-truth-01-runner2.log 2>&1
EFFORT=high .manager/run-until-done.sh skill-router-01 > .manager/logs/skill-router-01-runner.log 2>&1
EFFORT=medium .manager/run-until-done.sh night2-front > .manager/logs/night2-front-runner.log 2>&1
EFFORT=medium .manager/run-until-done.sh night2-final > .manager/logs/night2-final-runner.log 2>&1
echo "$(date '+%F %T') night3" > .manager/logs/chain.done
