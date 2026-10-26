#!/bin/zsh
# Usage: .manager/run-chain.sh <id1> [<id2> …] — exécute les briefs l'un après l'autre (run-until-done),
# détaché du terminal. Fin signalée par .manager/logs/chain.done (contient l'heure et le dernier id).
cd /Users/diaw/Downloads/agregat-back
rm -f .manager/logs/chain.done
for ID in "$@"; do
  .manager/run-until-done.sh "$ID" > .manager/logs/$ID-runner.log 2>&1
done
echo "$(date '+%F %T') $*" > .manager/logs/chain.done
