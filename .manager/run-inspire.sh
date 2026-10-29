#!/bin/zsh
# Après fix-router-03 : fix-open-01 (mode propriétaire sans restriction), puis fix-inspire-01 (inspirations GitHub).
cd /Users/diaw/Downloads/agregat-back
while [ ! -f .manager/logs/fix-router-03.done ]; do sleep 30; done
EFFORT=high .manager/run-until-done.sh fix-open-01 > .manager/logs/fix-open-01-runner.log 2>&1
EFFORT=high .manager/run-until-done.sh fix-inspire-01 > .manager/logs/fix-inspire-01-runner.log 2>&1
