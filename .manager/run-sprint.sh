#!/bin/zsh
# Usage: .manager/run-sprint.sh <NN> [resume-session-id "message"]
# Lance (ou reprend) une session Codex (MODEL, défaut gpt-6-sol : gpt-6.1-sol épuise la limite trop vite) pour un sprint, journal JSONL complet dans .manager/logs/.
set -u
cd /Users/diaw/Downloads/agregat-back
[ -f .manager/secrets.env ] && { set -a; source .manager/secrets.env; set +a; }
N=$1
TS=$(date +%Y%m%d-%H%M%S)
LOG=.manager/logs/$N-$TS.jsonl
COMMON=(-m ${MODEL:-gpt-6-sol} -c model_reasoning_effort=\"${EFFORT:-medium}\" -c sandbox_workspace_write.network_access=true)
if [ $# -ge 3 ]; then
  codex exec resume "${COMMON[@]}" --json -o .manager/logs/$N-$TS.last.md "$2" "$3" < /dev/null > "$LOG" 2>&1
else
  PROMPT="Tu es l'ingénieur principal de ce projet, supervisé par un manager. Lis AGENTS.md puis exécute intégralement le brief .manager/briefs/$N.md. PASSATION : si .manager/reports/$N.md existe déjà, une session précédente a été coupée ; c'est ta passation : lis-la (fin du fichier d'abord) et git log/git status, ne refais pas ce qui est commité, reprends au point suivant. Prends ton temps, travaille en profondeur, vérifie tout. Tiens le rapport .manager/reports/$N.md à jour au fil de l'eau, y compris toutes les erreurs. Ne t'arrête que lorsque le brief est accompli ou réellement bloqué. ÉCONOMIE DE CONTEXTE (ta limite d'usage dépend de tout ce que tu lis) : redirige toute sortie longue vers un fichier (npm test > .manager/reports/<id>-evidence/x.log 2>&1) puis lis seulement le résumé (grep/tail, quelques lignes) ; ne colle jamais de sortie brute longue dans le rapport, référence le fichier ; lis les fichiers par plages ciblées (rg -n puis sed -n), pas en entier ; lance la suite complète seulement au début et avant chaque commit, et sinon le seul fichier de test concerné."
  codex exec "${COMMON[@]}" --add-dir /Users/diaw/Downloads/agent-repos --add-dir /Users/diaw/Downloads/agregat-front ${EXTRA_DIR:+--add-dir $EXTRA_DIR} --approve-for-me \
    --json -o .manager/logs/$N-$TS.last.md "$PROMPT" < /dev/null > "$LOG" 2>&1
fi
echo "EXIT=$? LOG=$LOG"
