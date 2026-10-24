# Rapport sprint 01 — Audit approfondi et ACP natif

État : **en cours**. Date locale : 25 octobre 2026 (Australia/Sydney).

## Journal

### 02:29 — Prise en charge

- Lecture de `AGENTS.md`, `.manager/MISSION.md`, `.manager/PLAN.md`, du brief, de `README.md`, de `docs/*.md` et des ADR 001–002.
- Commandes : `pwd`, `rg --files …`, `git status --short`, `cat …`, inventaire des répertoires `agent-repos` : réussies. 22 clones présents ; la mention de Transformers dans l'ancienne étude ne correspond pas à un clone fourni.
- Modification **préexistante** : `.manager/run-sprint.sh` ; elle ne sera ni modifiée ni incluse dans mes commits. Le `git add -A` prescrit est limité aux fichiers du sprint pour préserver ce travail du manager.
- Constat : l'étude précédente repose sur des extraits API ; les affirmations et décisions seront revérifiées dans les clones, sans prétendre à un audit de sécurité exhaustif.
- Travail prévu : état initial/tests, inspection source à SHA fixe des 22 clones, recherche complémentaire et clones pertinents, matrice ACP et probes sans authentification ni prompt, conditions officielles BYOA, architecture/ADR/plan, vérifications et commits atomiques.

## Décisions et alternatives

À compléter au fil de l'audit.

## État et preuves

Aucune modification produit ; tests initiaux à exécuter. Pas d'appel modèle prévu pour ce sprint.

## Points pour le manager

Aucun blocage à cette étape.

### 02:30 — Base et inventaire vérifiés

- `npm test && npm run check && npm run format:check` : code 0, **10/10 tests**, syntaxe valide, format valide ; avertissement SQLite expérimental attendu.
- Lecture du runtime ACP, doctor/live-probe, orchestrateur, stockage, policy, gateways, Skills, API et tests. Recette actuelle décrite au modèle, pas un DAG imposé par le moteur.
- Inventaire des 22 clones par `git rev-parse`, `git log -1 --format=%cI`, `git status`, lecture des LICENSE/NOTICE et manifests : créé `docs/research/sprint-01-inventory.json` (textes de licences inclus pour vérification). Clones propres.
- Hypothèses corrigées : activité git ≠ pushed_at ; OpenCode et CAO ont des SHA différents de l’ancienne étude ; SDK MCP au HEAD 2.0.0-alpha.0 alors que Relay épingle 1.32.2. Licence MCP en transition à vérifier fichier par fichier.

### 02:31 — Recherche complémentaire et versions candidates

- Recherches web : orchestration ACP, workflows Node durables, gateways MCP, tiny-agents Hugging Face ; sources officielles GitHub/Hugging Face retenues. `git clone --depth 200` de `dbos-inc/dbos-transact-ts`, `agentgateway/agentgateway`, `TencentCloud/Octop`, `huggingface/huggingface.js` : **4 succès** (code 0), inspection à suivre. Aucun script tiers exécuté.
- `npm view @google/gemini-cli version license engines dist.integrity …` : **0.65.0**, Apache-2.0, Node >=20. `npm view opencode-ai …` : **1.19.4**, MIT. Préfixe global `/usr/local`. Ces versions publiées diffèrent des sources HEAD (Gemini nightly 0.67 ; OpenCode 2.1.4), donc les probes ne prouveront pas les capacités de HEAD.
- Un `rg` sur un ancien chemin OpenCode `packages/cli/src/cli/cmd/acp.ts` a échoué (code 2, fichier absent). Chemin réel retrouvé : `packages/cli/src/commands/handlers/acp.ts`. Recherches volumineuses tronquées ; reprise par plages de lignes ciblées avec index de lecture.
- Compétence `openai-docs` lue pour la documentation officielle Codex ; aucune intégration/API ni authentification engagée.

### 02:31 — Installation globale bloquée ; repli isolé

- `npm install -g @google/gemini-cli@0.65.0 opencode-ai@1.19.4 --cache /tmp/relay-sprint01-npm --no-audit --no-fund` (escalade autorisée par le brief) : **échec réel code 243 / EACCES**, création `/usr/local/lib/node_modules/@google` refusée par les droits OS. Aucun rejet auto-review signalé. Pas de sudo, chmod ou modification de configuration globale.
- Repli : installation des mêmes versions sous `/tmp/relay-sprint01-cli` (hors dépendances Relay), pour probes sans authentification.
- Deux recherches de chemins historiques se sont révélées fausses : OpenCode ci-dessus, et `CodexAcpAgent.ts` absent (rg code 2). Les implémentations actuelles seront citées avec leurs vrais chemins.
- Sources : Gemini HEAD expose `models` + `unstable_setSessionModel`, pas `configOptions` ; Relay `selectModel()` ne couvre donc pas encore cet agent. OpenCode HEAD renvoie `configOptions` et refuse MCP SSE.

### 02:33 — Audit des flows et probes lancées

- Installation isolée `npm install --prefix /tmp/relay-sprint01-cli --save-exact …` : **succès**, 9 paquets, 12 s. Versions/help obtenus avec configuration temporaire et environnement sans clés héritées : Gemini 0.65.0, OpenCode 1.19.4. `opencode acp --help` confirme `--hostname` par défaut 127.0.0.1 ; le probe impose cette valeur et `--pure`. Aucun changement du préfixe npm global.
- Création `scripts/acp-audit-probe.js`, lancé avec chemins explicites : initialise ACP v1 puis `session/new` sans MCP ; jamais authenticate/prompt ; demandes de permission refusées ; configurations temporaires propres, groupes de processus arrêtés. Résultat à suivre.
- acpx : lecture effective runtime/flows/store/graph/types. Boucle à curseur unique (`runtime.ts:345–364`), une sortie par nœud (`graph.ts:24–29`), `run()` crée toujours un nouvel état ; pas de méthode de reprise de flow trouvée. Retrait recommandé de l’ancienne prescription « intégrer acpx avant DAG durable/parallélisme ». Son runtime reste intéressant, distinct du moteur métier.
- CAO possède désormais aussi un journal/reprise et des politiques de récupération, au-delà de tmux ; ne pas le réduire à son README ancien.
- Lecture des licences Skills : `anthropics/skills` sans licence racine, `skill-creator` Apache-2.0 mais `docx/LICENSE.txt` restrictif ; aucune licence globale Apache présumée.
- Erreurs complémentaires : un glob zsh vers `services/global*` inexistant a interrompu une commande de repérage (code 1) ; remplacé par `rg --files`. Fetch web de `learn.chatgpt.com/docs/auth.md` refusé (type Markdown non supporté), page HTML lue avec succès. Page Consumer Anthropic servie en coréen : chercher la version anglaise explicite avant citation.

### 02:35 — Résultats ACP natifs et traçabilité

- `node scripts/acp-audit-probe.js /tmp/relay-sprint01-cli/node_modules/.bin/gemini /tmp/relay-sprint01-cli/node_modules/.bin/opencode` : code 0 ; résultats distincts dans `docs/research/sprint-01-acp-probe.json`. Gemini **initialize réussi (protocole 1), session/new refusée -32000 « Gemini API key is missing or not configured. »** ; OpenCode **initialize et session/new réussis**, modèles/configOptions annoncés, aucun prompt. Ces catalogues ne prouvent ni accès modèle ni prix.
- Écart confirmé : OpenCode publié 1.19.4 annonce SSE=true, source HEAD 2.1.4 annonce SSE=false. Matrice devra séparer ces deux preuves.
- Nettoyage : Gemini sorti code 0 ; OpenCode terminé SIGTERM. `ps` initial refusé par sandbox (« operation not permitted », code 1) ; contrôle relancé avec escalade, aucun processus des chemins probes trouvé (`rg` code 1 = aucune correspondance). Pas de serveur résiduel observé.
- `npm pack playwright-core@1.64.0-alpha-1790635538000 --ignore-scripts …` : succès ; archive extraite dans `/tmp/relay-playwright-core` sans exécuter de scripts, afin d’inspecter le véritable moteur extension derrière le wrapper playwright-mcp.
- Ajout du script reproductible `scripts/audit-inventory.py` ; inventaire régénéré sur les 26 clones (licences, empreintes, manifests, SHA, derniers commits et état shallow).

### 02:35 — Vérification et premier commit

- `python3 scripts/audit-inventory.py … && prettier --write scripts/acp-audit-probe.js && npm test && npm run check && npm run format:check` : code 0, 26 dépôts ; **10 réussis, 0 échec**, syntaxe/format valides.
- Premier `git add … && git commit …` : **échec sandbox code 128**, création `.git/index.lock` refusée. Relance avec escalade pour le commit local explicitement demandé, sans inclure `.manager/run-sprint.sh`.
