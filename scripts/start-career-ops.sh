#!/bin/sh
# La clé est chargée par Node. Le modèle est choisi parmi ceux annoncés par
# selectAnnouncedCareerModel ; aucun appel de modèle au démarrage.
set -eu
cd "$(dirname "$0")/.."
exec env AGENT_PLATFORM_LIVE=1 AGENT_PLATFORM_OWNER_MODE=1 AGENT_PLATFORM_TIMEOUT_MS=900000 \
  node --env-file-if-exists=.manager/secrets.env apps/api/server.js
