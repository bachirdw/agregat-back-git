#!/bin/sh
# La clé est chargée par Node, sans affichage ni copie. Aucun appel de modèle au démarrage.
set -eu
cd "$(dirname "$0")/.."
exec env AGENT_PLATFORM_LIVE=1 AGENT_PLATFORM_OWNER_MODE=1 GEMINI_MODEL=gemini-3.1-flash-lite \
  node --env-file-if-exists=.manager/secrets.env apps/api/server.js
