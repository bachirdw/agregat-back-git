#!/bin/zsh
# Attend la fin de fix-router-03 puis lance fix-inspire-01 (une seule mission Codex à la fois).
cd /Users/diaw/Downloads/agregat-back
while [ ! -f .manager/logs/fix-router-03.done ]; do sleep 30; done
EFFORT=high .manager/run-until-done.sh fix-inspire-01 > .manager/logs/fix-inspire-01-runner.log 2>&1
