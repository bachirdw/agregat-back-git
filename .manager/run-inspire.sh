#!/bin/zsh
# Reprise de fix-open-01 puis fix-inspire-01 (séquentiel, une mission Codex à la fois).
cd /Users/diaw/Downloads/agregat-back
EFFORT=high .manager/run-until-done.sh fix-open-01 > .manager/logs/fix-open-01-runner.log 2>&1
EFFORT=high .manager/run-until-done.sh fix-inspire-01 > .manager/logs/fix-inspire-01-runner.log 2>&1
echo "$(date '+%F %T') fin chaîne open+inspire" > .manager/logs/inspire-chain.done
