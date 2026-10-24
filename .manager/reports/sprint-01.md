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

### 02:37 — Premier commit créé et approfondissement

- Commit local **779deb0** créé avec succès après escalade ; `.manager/run-sprint.sh` exclu.
- Audit complémentaire : DBOS possède reprise réelle et cache des résultats, mais `system_database.ts` importe `pg` (PostgreSQL requis, pas SQLite). agentgateway implémente transport enfant MCP et RBAC CEL ; sans règles son validateur autorise (ne constitue pas une policy deny-by-default pour Relay). tiny-agents : boucle modèle/MCP, mémoire de conversation en RAM ; Octop délègue au paquet `octop-harness` externe, limite explicitée plutôt que lui attribuer du code absent. Un chemin supposé `packages/harness/…/client.py` inexistant a produit rg code 2.
- Playwright MCP : wrapper délègue à playwright-core ; moteur de l’archive exacte inspecté (extensionContextFactory, CDP relay avec jeton optionnel, interception réseau, outil `browser_run_code_unsafe`). Correction : le mode extension utilise bien Chrome utilisateur, pas seulement un navigateur isolé. Aucune extension installée/lancée.
- Registre npm : Claude 0.95.0 gitHead = SHA du clone ; Codex 2.2.2 gitHead = `202e66e63343ec4f5a5e35ab590251d813d129ca`, différent du HEAD malgré la même version déclarée. Le diff s’est révélé **bien plus grand que supposé**, sortie tronquée (> 50 000 tokens) ; reprise avec `--shortstat` et diff du seul package. Ne pas transposer les nouveautés HEAD au paquet épinglé.
- Navigation web : deux `click` sur URL brute n’ont pas été résolus ; repris avec identifiants de page, succès sur les CGU Gemini API et Code Assist. Version anglaise Consumer Anthropic `?lang=en` inaccessible par l’outil ; pas de citation anglaise inventée.

### 02:38 — Conclusion des lectures source et rédaction

- 26 dépôts ont maintenant des plages source enregistrées (aucun dépôt limité au README). Les clones et les sources de dépendance n’ont pas été exécutés, hors CLI officiels autorisés.
- Diff Codex source/publié quantifié : **413 fichiers, +24 311 / −1 209 lignes**, SDK HEAD `~2.0.0` et Codex `^0.164.0` contre SDK publié `^1.5.0` et Codex `^0.160.1`. Le numéro 2.2.2 identique n’assure donc pas l’identité source/binaire.
- Lecture approfondie CAO : reprise effective `resume_from_last_completed` + plafond hérité du lanceur ; branches parallel/pipeline encore `NotBuiltYetError`.
- Lecture launchers : multiagents écrit les configurations utilisateur globales ; seulement observé dans le clone, jamais exécuté. cliagents utilise `--full-auto` hors JSON read-only ; ne pas adopter ses défauts.
- Sources officielles BYOA consultées : Anthropic legal/compliance et contrats ; OpenAI auth, intégration/exec/SDK/app-server, SIWC et contrats régionaux/commerciaux ; Gemini CGU CLI, API et Code Assist ; OpenCode Terms. La page Gemini ACP a une description MCP au handshake qui diverge de `newSession(mcpServers)` dans le code : priorité au contrat source et aux probes.
- Rédaction en cours : tableau des 26, matrice HEAD vs paquets, stratégie composant, architecture et ADR. Pas de validation commerciale générale déduite d’une licence open source.

### 02:45 — Contrôles documentaires et évolution concurrente du dépôt

- Contrôle automatisé de **127 références** locales/GitHub à SHA fixe : chemins/plages existants, zéro erreur ; empreintes des **107 plages source** de l’index conformes.
- `npm test` : **10/10**, `npm run check` et `npm run format:check` verts. `git diff --check` a ensuite signalé **une ligne vide finale** dans `docs/open-source-research.md` (code 2) ; corrigée, recontrôle à suivre.
- Relecture des manifests : correction avant commit du champ licence Playwriter (LICENSE MIT réel, mais champs package racine et sous-paquet vides), retrait de dépendances secondaires non confirmées dans le tableau multicli/DBOS. L’inventaire révèle 17 historiques shallow dont 13 clones fournis : précision ajoutée, aucune prétention d’historique exhaustif.
- Le manager a créé entre-temps les commits `3f88a1d`, `1288cf5`, `ea89aaf`. Son changement initial `run-sprint.sh` est maintenant committé par lui ; il n’a pas été inclus dans mon commit. Relecture des consignes/brief/plan courants pour intégrer les éventuelles nouvelles exigences sans écraser ses changements.

### 02:45 — Consignes manager intégrées

- Relecture des AGENTS/PLAN/brief actuels : nouvelle priorité tests, budget API et carrière. Le brief sprint 01 est inchangé ; le cycle de relecture indépendante appartient aux sessions suivantes du manager (pas de sous-agent lancé). Aucun appel payant n’a été réalisé, aucune clé/secret lu.
- Le manager a ajouté `career-ops-hq__career-ops` parmi les clones et le plan 05–06 le cite désormais. Inspection additionnelle décidée pour documenter sa licence/marque et ses scripts utiles, plutôt que laisser une nouvelle dépendance métier non évaluée. L’inventaire passera de 26 à 27 projets, avec 4 clones complémentaires effectués par moi + ce clone fourni ensuite par le manager.
- `git diff --check` après correction EOF : code 0. Le rapport consigne ce petit échec comme les autres ; aucun test supprimé ni historique réécrit.

### 02:47 — Complément career-ops et livrables complets

- career-ops `2d6ed587e60cbb1aaaac7e3dd4a9f5b7b46a26af`, dernier commit 24/10 15:15 UTC, package 1.38.0 : LICENSE MIT et TRADEMARK réellement lus. Inspection du router SKILL, rank-pipeline (CLI headless/limites/compteurs), prepare-application (résumé de champs à soumettre manuellement), browser-extract (API publique puis Playwright, gardes URL et routes), cli-launch et Data Contract. **Aucun script de ce dépôt exécuté**, aucune installation (postinstall Chromium observé, non lancé).
- Inventaire final **27 dépôts** : 22 initiaux + mes 4 clones complémentaires + ajout manager ; **18 historiques shallow**, arbres présents complets. Recherche GitHub officielle complémentaire réalisée pour career-ops ; aucune promesse marketing prise pour preuve de code.
- Livraison documentaire préparée : étude comparative + matrice ACP, index source/paquets, architecture Mermaid état actuel/cible, ADR 003 runtime/workflow, 004 navigateur/Skills, 005 CGU BYOA, ADR 001 précisé, README/validation/notices synchronisés, propositions 02–08 dans le plan courant du manager (ses nouvelles sections conservées).
- Choix : ACP natif Gemini/OpenCode ; SDK/adaptateurs conservés ; pas de fork ; DAG local borné SQLite plutôt qu’adoption présumée acpx flows ; Playwriter revu derrière gateway et alternative Playwright extension ; import Skills/career-ops en quarantaine, code MIT et marque respectés.

### 02:48 — Défaut de timeout découvert dans mon script et le socle

- Lecture du contrat SDK installé `dist/core/jsonrpc.d.ts:84–92` : **`cancellationSignal`**, pas `signal`, et annulation coopérative (la promesse reste suspendue jusqu’à réponse du pair). Mon premier script avait repris le pattern erroné de `AcpRuntime.request()` ; les probes réelles avaient répondu et leurs résultats restent exacts, mais le délai de 20 s n’était pas imposé. Erreur reconnue et corrigée.
- Correction du script d’audit : option SDK correcte + deadline locale Promise.race, puis fermeture/arrêt du groupe enfant. Vérification en cours avec un faux CLI explicitement fictif qui ne répond jamais, sans modèle ni réseau ; artefacts de ce test dans un cwd temporaire pour préserver les preuves réelles.
- Le runtime produit possède le même défaut préexistant ; à signaler **priorité 1 sprint 02**, avec tests de pair muet et de cancel/permission. Pas de changement métier/runtime non demandé dans ce sprint d’analyse.

### 02:49 — Timeout corrigé et régression déterministe

- Test manuel du script corrigé : faux pair muet puis faux pair répondant (versions et session marquées **FICTIF**), code 0 en **20,89 s** ; deadline réelle imposée, deuxième initialize/session réussis, deux enfants terminés SIGTERM. Artefact uniquement sous `/var/folders/…/relay-probe-regression-xnsmixeb/docs/research/sprint-01-acp-probe.json`, preuve fournisseur réelle préservée.
- Ajout d’un test d’intégration significatif `tests/audit-probe.test.js` : reproduit le pair muet ignorant l’annulation et vérifie qu’un second pair fonctionne sans appel authenticate/prompt ; aucun modèle/service/réseau externe. Durée attendue ~21 s car le test couvre la vraie deadline de 20 s, sans raccourci de test. Suite complète relancée, résultat à suivre.
- Rapport/étude/architecture/ADR 003/plan 02 signalent le défaut préexistant du runtime, sans le dissimuler derrière les tests verts ; correction produit hors périmètre de ce sprint. `.manager/api-usage.md` modifié par le manager, exclu de mes commits ; mes appels API/inférence restent à zéro.

### 02:50 — Contrôles du correctif de probe

- `npm test && npm run check && npm run format:check && git diff --check` : **code 0, 11 tests réussis, 0 échoué/ignoré**, durée 20,80 s ; syntaxe et format valides. Le nouveau test contre pair muet prend 20,76 s et ne requiert aucun modèle. Aucun test métier existant modifié/supprimé.
- Commit atomique du correctif de script/test/rapport demandé ci-après ; documentation complète et propositions dans un commit distinct ensuite.
