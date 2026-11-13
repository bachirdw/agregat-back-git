# Sprint contacts-courriel-01 — décideur LinkedIn par le navigateur, e-mail préparé dans la messagerie

Arbre : `/Users/diaw/Downloads/agregat-back-contacts`, branche `contacts-courriel-01` (depuis `contacts-13-11`,
commit de départ `694e0a2`). Données de test toutes FICTIVES.

## Journal

- 13:47 Arbre créé (`git worktree add … -b contacts-courriel-01 contacts-13-11`), `npm ci` fait (node_modules absent).
- 13:50 Lecture d'AGENTS.md et de la section 1 de `passation.md`. Vérification du diagnostic dans le code (voir
  « Écarts avec le diagnostic »).

## Écarts avec le diagnostic (vérifiés dans le code le 13/11 vers 13:50)

- `linkedin_draft` (tools.js 1515) : sa description dit « les outils navigateur lisent LinkedIn comme tout site » ;
  elle ne dit pas que le Chrome est déjà connecté. Aucune mention de cette connexion nulle part dans le code.
- Étape `find` de l'intention `linkedin` : `alternativeTools: [browser_extract, google_web_search]`. Une
  recherche web Gemini (`google_web_search`) seule CRÉDITAIT donc `find` ; le WebSearch natif de Claude
  n'est pas un outil déclaré du manifeste et ne créditait rien.
- Le moteur sait déjà exiger une adresse : `urlPattern` (mots de chemin) d'une étape, comparé à `rawInput.url`.
  Sur le canal de la passerelle (route tool-outcome, apps/api/server.js ~615), `rawInput.url` d'une capture
  ou d'une extraction est la page lue (`landedUrl`, packages/mcp-gateway/outcome.js). Aucun changement du
  moteur n'est nécessaire pour le point 3.
- Le reste du diagnostic est conforme (lignes à ±5 près).

## Point 1 — trois rôles d'outils (13:50 → 13:53)

- Tests d'abord dans `tests/doubt-tools.test.js` : liste des identifiants de rôles, texte exact de
  `formatToolRoles` (test existant étendu) et nouveau test « formatToolRoles du vrai manifeste porte personne,
  e-mail et LinkedIn ». Rouge : 3 échecs sur 17 (`contacts-courriel-01-evidence/p1-rouge.txt`).
- Manifeste : rôles `confirm-person`, `prepare-email`, `keep-linkedin-message`. La note de la personne a été
  raccourcie à 198 caractères (plafond du schéma : 200). Vert : 17/17 (`p1-vert.txt`). Le test existant
  « tous les outils nommés existent sur le serveur MCP du pack » couvre aussi les trois nouveaux rôles (vert).
- Non-régression lancée : career-skill-production 8/8, career-skill-suivi 12/12, skill-router 41/41,
  contacts-courriel 12/12.
