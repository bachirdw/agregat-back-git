#!/bin/zsh
# Lance l'API de la branche courante en mode propriétaire, avec les délais de la commande type
# (passation, section 7). Aucun secret : comme l'API 4313 du 11/11, aucun fichier de secrets n'est chargé
# (les agents CLI utilisent leur propre connexion).
# E134 (18/11) : un outil sans nouvelle n'est déclaré figé qu'après 10 min (120 s par défaut), pour ne pas
# couper une longue recherche quand une capture est lente (onglet en arrière-plan, E79).
#   zsh .manager/outils/api-branche.sh <port> [dossier de l'espace career-ops]
# Sans dossier, l'espace career-ops réel configuré par l'API est utilisé. Variables GEMINI retirées
# (aucun test avec la clé Gemini, décision du 10/11).
cd "$(dirname "$0")/../.." || exit 1
PORT_API=${1:?port}
ESPACE=${2:-}
typeset -a ESPACE_ENV
if [[ -n "$ESPACE" ]]; then
  ESPACE_ENV=(AGENT_PLATFORM_CAREER_WORKSPACE="$ESPACE" AGENT_PLATFORM_WORKSPACE_ROOTS="$ESPACE" AGENT_PLATFORM_SKILL_ROOTS="$ESPACE")
fi
exec env -u GEMINI_API_KEY -u GOOGLE_API_KEY PORT="$PORT_API" AGENT_PLATFORM_LIVE=1 AGENT_PLATFORM_OWNER_MODE=1 \
  AGENT_PLATFORM_TIMEOUT_MS=7200000 AGENT_PLATFORM_SEND_TIMEOUT_MS=7200000 \
  AGENT_PLATFORM_QUESTION_TIMEOUT_MS=7200000 AGENT_PLATFORM_SILENT_MS=900000 \
  AGENT_PLATFORM_TOOL_IDLE_MS=600000 \
  AGENT_PLATFORM_BROWSER_LOCAL_ORIGINS=http://127.0.0.1:4321 $ESPACE_ENV \
  node apps/api/server.js
