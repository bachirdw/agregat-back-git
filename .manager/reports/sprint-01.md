# Rapport sprint 01 — Audit approfondi et ACP natif

État : **brief accompli — audit et livrables opérationnels**. Date locale : 25 octobre 2026 (Australia/Sydney).

## Journal

### 02:29 — Prise en charge

- Lecture de `AGENTS.md`, `.manager/MISSION.md`, `.manager/PLAN.md`, du brief, de `README.md`, de `docs/*.md` et des ADR 001–002.
- Commandes : `pwd`, `rg --files …`, `git status --short`, `cat …`, inventaire des répertoires `agent-repos` : réussies. 22 clones présents ; la mention de Transformers dans l'ancienne étude ne correspond pas à un clone fourni.
- Modification **préexistante** : `.manager/run-sprint.sh` ; elle ne sera ni modifiée ni incluse dans mes commits. Le `git add -A` prescrit est limité aux fichiers du sprint pour préserver ce travail du manager.
- Constat : l'étude précédente repose sur des extraits API ; les affirmations et décisions seront revérifiées dans les clones, sans prétendre à un audit de sécurité exhaustif.
- Travail prévu : état initial/tests, inspection source à SHA fixe des 22 clones, recherche complémentaire et clones pertinents, matrice ACP et probes sans authentification ni prompt, conditions officielles BYOA, architecture/ADR/plan, vérifications et commits atomiques.

## Décisions et alternatives

Décisions finales et alternatives détaillées dans les ADR 003–005, l’étude et la synthèse en fin de rapport.

## État et preuves

Voir l’état final et les preuves en fin de rapport. Aucun appel modèle réalisé par cette session.

## Points pour le manager

Brief non bloqué. Priorités et limites de validation détaillées en fin de rapport.

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

### 02:51 — Validation fournisseur répétée après correctif

- Commit **83de350** créé : deadline du probe + test pair muet, sans modification du runtime produit.
- Probe natif répété après la correction, toujours avec configurations isolées et sans authenticate/prompt. Résultats régénérés dans `docs/research/sprint-01-acp-probe.json` : mêmes handshakes/session (Gemini auth manquante, OpenCode session créée), versions publiées inchangées. Pas de conclusion inférence/stream/cancel live déduite.
- Index final : **122 plages source**, 27 clones avec SHA/manifest/licences, plus bundle Playwright exact avec intégrité npm.

## Vérification finale des objectifs du brief

| Objectif | Résultat et preuve |
|---|---|
| 1. Audit source des 22 dépôts | Fait, plus les compléments : 27 SHA/manifests/licences/date de commit ; 122 plages indexées, lectures sur chacun des 27 dépôts. `docs/research/sprint-01-inventory.json`, `sprint-01-code-index.json`, étude avec liens immuables et lignes. Historique shallow signalé, pas présenté comme complet. |
| 2. Recherche complémentaire | Recherches web officielles GitHub/Hugging Face ; 4 clones `--depth 200` réussis (DBOS, agentgateway, Octop, huggingface.js), code inspecté ; career-ops fourni ensuite par le manager, vérifié et inspecté. |
| 3. Tableau et stratégie | Étude entièrement refaite : comparaison, licences réelles, protocoles/sessions/stream/permissions/coûts/extension/limites, stratégie par composant. acpx flows, CAO, Playwriter/Playwright extension et Vercel Skills réévalués sur le code. Aucun fork imposé. |
| 4. Matrice ACP 4 agents | Commandes exactes, versions sources/publiées/épinglées, capacités et preuves séparées. Écarts Gemini modèles, OpenCode SSE, Codex gitHead et SDK explicités. |
| 5. Installation et handshake | Global EACCES consigné ; CLI épinglés sous `/tmp`, deux initialize réussis ; session Gemini refusée faute d’auth, session OpenCode réussie. Aucun authenticate/prompt. Probe borné et testé contre faux pair muet. |
| 6. CGU BYOA | Pages officielles des 4 fournisseurs consultées, URL et extraits courts dans ADR 005, distinction abonnement/API/hébergé ; aucune autorisation commerciale générale inventée. Limite de langue Consumer Anthropic documentée. |
| 7. Architecture et plan | Architecture avec 3 diagrammes Mermaid et distinction actuel/prévu ; ADR 003–005 ajoutés, ADR 001 précisé ; section « Propositions sprint-01 » sprints 02–08 dans le plan courant, changements du manager conservés. |

## État final : opérationnel / simulé / incomplet / prévu

| Élément | État réel |
|---|---|
| Recherche, inventaire, matrice, ADR, propositions | **Opérationnels**, livrables écrits et références/empreintes vérifiées. Inspection ciblée approfondie, pas audit exhaustif de sécurité. |
| Scripts inventaire/probe et test pair muet | **Opérationnels** ; 11 tests verts au dernier contrôle, syntaxe et format verts ; test de deadline mesuré ~20,8 s. |
| ACP natif installé temporairement | **Opérationnel pour initialize** ; session OpenCode obtenue, Gemini bloqué par auth attendue. Aucun binaire installé globalement, aucune inférence. |
| MVP / navigateur / données Najah | **État de base conservé** : workflow fixture et trois offres fictives ; Browser Gateway simulé, aucun Chrome réel connecté. |
| Timeout individuel runtime | **Défaut préexistant constaté, non corrigé ici** : `signal` ignoré par SDK. La correction concerne mon script d’audit ; correctif produit et tests contre pair muet proposés au sprint 02. |
| Streaming/cancel/load/MCP avec fournisseurs réels | **Non validés live dans ce sprint** ; support source/annonces documenté, pas de résultat inventé. |
| DAG durable parallèle, registry tiers, provider réel | **Prévus**, pas implémentés par ce sprint d’analyse. |
| Commercialisation BYOA / Managed | **Non validée contractuellement** ; ADR prudent et conditions par mode, pas un blocage du travail technique demandé. |

Les probes natifs et faux agents sont arrêtés ; contrôle `ps` final sans correspondance. Aucun e-mail, candidature, publication, compte, authentification, lecture/copie manuelle de credentials ou changement de configuration globale. **Zéro appel modèle/API payante de ma session** (le journal API du manager est son travail indépendant).

Précisions d’erreurs de repérage : l’ancien chemin OpenCode `src/global/index.ts` était également absent ; une plage demandée au-delà de la fin de Playwriter `mcp.ts` (484 alors que le fichier a 392 lignes) était vide. Recherches reprises aux vrais chemins/plages ; la plage vide n’est pas incluse dans l’index. Aucun échec de test métier, aucun test supprimé. Les sorties trop volumineuses ont été reprises par extraits courts ; les erreurs/rejets de navigation et sandbox figurent dans le journal.

## Points pour le manager et reste à faire

- Relecture indépendante à lancer selon le cycle du manager ; elle n’a pas été présentée comme déjà effectuée.
- Le montage commercial et les conditions exactes par méthode de connexion restent à confirmer avant distribution payante/distante. L’étude ne remplace pas cette validation.
- Les CLI d’audit sont sous `/tmp/relay-sprint01-cli` : le sprint 02 doit choisir une installation persistante autorisée. Aucune dépendance produit ajoutée/mise à jour et aucun script tiers métier exécuté ici.
- `.manager/api-usage.md` a été modifié par le manager pendant le travail : exclu de mes commits. Aucun secret ajouté aux fichiers du sprint.

## Décisions et recommandations pour le sprint 02

1. **Corriger d’abord le timeout ACP du runtime** : `cancellationSignal` selon SDK réel + deadline locale et arrêt groupe enfant, pas seulement annulation coopérative. Tests : pair muet, session/new qui ne répond pas, cancel avec demande de permission en attente et sortie tardive.
2. Garder ACP SDK 2.0.2/v1 et les adaptateurs verrouillés ; utiliser Gemini/OpenCode natifs. Ne pas transférer les nouveautés HEAD codex-acp au paquet 2.2.2 publié.
3. Préférer `gemini --acp`, normaliser `models`/`unstable_setSessionModel` et `configOptions`, modes et transports MCP à partir des réponses de session et de la version effectivement lancée.
4. Séparer CLI détecté / handshake / session / inférence / usage contractuel ; Auto filtre par exigences/capacités et expose les échecs auth, sans repli fixture silencieux.
5. Choisir les modes réellement annoncés, conserver refus par défaut/permissions ponctuelles, et traiter les outils/configs natifs comme une frontière distincte. Aucun accès fournisseur n’est accordé par le prompt.
6. Préparer les contrats run/étape/tentative/session pour le DAG SQLite du sprint 03. Ne pas intégrer acpx flows comme s’il fournissait le fan-out/fan-in durable. DBOS attend PostgreSQL ; CAO sert de référence de reprise et plafonds.
7. Garder browser/Skills/packs découplés. Playwriter provider revu, alternative Playwright MCP extension, Skills/career-ops en quarantaine ; notices MIT/marque respectées, aucune action d’envoi. Les tests restent sans modèle/service payant ; toute inférence ultérieure doit suivre le budget du manager.

### 02:53 — Contrôle final avant commit documentaire

- `npm test && npm run check && npm run format:check && git diff --check` : **code 0**, **11 réussis, 0 échec, 0 ignoré**, durée totale **20,60 s** (pair muet 20,55 s). Syntaxe JavaScript et Prettier conformes.
- Vérification documentaire finale : **134 références**, **122 empreintes de plages**, **27 dépôts**, **zéro erreur** ; clôtures de blocs Markdown vérifiées et 3 diagrammes Mermaid relus. Pas de rendu graphique Mermaid exécuté, aucune prétention de validation visuelle.
- Aucun processus résiduel des probes natifs/faux agents au contrôle effectué après leur arrêt. Aucun changement runtime métier ou dépendance produit ; `scripts/audit-inventory.py` étendu pour TRADEMARK.
- Dernier commit documentaire local préparé sous le message `[sprint-01] Refondre l’audit source et les décisions d’architecture`. `.manager/api-usage.md` exclu (modification du manager). Aucun push. Tous les objectifs du brief sont accomplis ; les limites live/contrats et le défaut runtime sont explicités ci-dessus pour la relecture indépendante.
