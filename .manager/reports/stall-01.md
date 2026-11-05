# stall-01 — E49 : la garde « outil figé » s'arme à la remise de l'appel, pas à son ouverture

Base : `547b5b7` (`origin/dev`), branche `cloud/stall-01`, session cloud (conteneur Linux, heures en UTC).
Brief : `.manager/briefs/stall-01.md` absent de `origin/dev` au départ de la session ; la tâche reçue en
reprenait le texte intégral, suivi ici. Aucun push hors `cloud/stall-01`, aucun merge, aucun modèle appelé,
aucun site réel, Skill et bibliothèque career-ops intouchés.

## Journal

- 09:01 — Départ. `git fetch origin dev`, `git checkout -B cloud/stall-01 origin/dev`. Lecture de `CLAUDE.md`,
  `AGENTS.md`, `packages/orchestrator/index.js` (garde inline `watchTool`/`armTool`, lignes 880-905 ;
  `toolIdleMs` 120000 par défaut au constructeur, ligne 146), `packages/orchestrator/turn-guard.js` (garde
  des étapes DAG, `workflow-run.js`), `packages/mcp-gateway/server.js` (passerelle stdio lancée par l'agent ;
  mesure `tool_call` envoyée à Relay **avant** le handler, bilan d'outil **après**), `apps/api/server.js`
  (routes internes `usage`, `approvals`, `evidence`, `tool-outcome`), `tests/fixtures/fake-acp.js`,
  `tests/tool-watchdog.test.js`, `tests/agent-silence.test.js`, `tests/elicitation.test.js`.
- 09:05 — Environnement : `node_modules` absent, `npm ci` (131 paquets, adaptateurs ACP optionnels non
  installés : avertissement EBADENGINE sous Node 22). Node 22 par défaut dans le conteneur, Node 24 disponible
  (`/opt/node24/bin`) : tous les tests ci-dessous tournent avec `PATH=/opt/node24/bin:$PATH`.
- 09:13 — Lecture des adaptateurs ACP installés par `npm ci` (dépendances optionnelles présentes sous Node 24).
  `@agentclientprotocol/claude-agent-acp` 0.95.0, `dist/tool-calls/renderer.js` : le premier `tool_call` d'un
  bloc d'outil part en **statut `pending`** avec `name: toolUse.name` (forme `mcp__<serveur>__<outil>`), le
  `rawInput` encore vide ; `dist/acp-agent.js` (`content_block_delta` → `partialRefinement`) : chaque champ
  complet du JSON d'entrée donne un `tool_call_update` à `rawInput` partiel (d'où `{ path }` seul pendant
  que `text` se compose) ; `requestPermissionFromClient` : la demande de permission ACP part quand le SDK
  exécute l'outil, après l'entrée complète. Codex (`codex-acp`) est un binaire : non lu, pas d'hypothèse.
- 09:15 — Analyse : la garde `watchTool`/`armTool` armait `toolIdleMs` dès le premier `tool_call` ou
  `tool_call_update` non terminal, donc pendant la composition. Point de remise observable par Relay :
  (1) la décision de permission ACP (`permission()`, événement `permission_auto` en mode propriétaire,
  `toolCallId` de l'appel connu) ; (2) la passerelle MCP, lancée par l'agent (stdio) : elle envoie à Relay la
  mesure `tool_call` **avant** d'exécuter le handler (`POST /api/internal/usage/:run`, `gatewayUsage`),
  puis approbations, preuves navigateur et bilan d'outil (`tool-outcome`) ; sans identifiant ACP (la
  passerelle tire son propre UUID). Décision : la remise par permission arme l'appel nommé ; toute
  activité de la passerelle arme les appels ouverts non encore armés et réarme les autres.
- 09:16 — Horloge injectable : `this.timers = { setTimeout, clearTimeout }` dans le constructeur de
  `Orchestrator`, utilisée par les gardes de silence, d'outil et de délai de mission (`execute`). Les
  attentes réelles de fermeture (100 ms, 5 s) restent sur l'horloge réelle. Pas de nouvelle variable
  d'environnement, aucun délai allongé.
- 09:17 — Faux agent `tests/fixtures/fake-acp.js` : scénario `composeTool` (`tool_call` pending,
  `tool_call_update` à `{ path }` seul, attente d'un fichier `goFile` qui matérialise la composition,
  `rawInput` complet, demande de permission sauf `permission: false`, appel réel `career_write` par la
  passerelle MCP de Relay si `mcp: true`, `stall: true` = jamais clos). Tests
  `tests/tool-stall-delivery.test.js` (horloge simulée, mode propriétaire, pack career-ops, plan non simulé
  pour passer par `permission_auto`).
- 09:18 — **Tests rouges sur la garde inchangée** (`node --test --test-concurrency=1 tests/tool-stall-delivery.test.js`,
  sortie `stall-01-evidence/rouge.txt`) : (a) et (a bis) rouges comme attendu, `tool_stalled` après 150 s
  simulées de composition (`["state","state","session","agent","agent","agent_silent","tool_stalled"]`) ;
  (b) et (c) verts (comportement conservé) ; (b bis) rouge pour l'événement `tool_armed` absent, puis
  bloqué 120 s par mon helper qui attendait la mission avant de fermer l'application (corrigé : fermeture
  d'abord). Processus `fake-acp.js` résiduel tué à la main.
- 09:21 — Correctif. `packages/orchestrator/tool-guard.js` (nouveau) : `ToolGuard` (observe, deliver, suspend,
  resume, clear ; horloge injectable), `toolCallName` (name, puis title, puis rawInput), `isPlatformToolCall`
  (préfixe `mcp__<serveur>__` des serveurs MCP de la mission, ici `platform`). `packages/orchestrator/index.js` :
  garde inline remplacée (lignes ~886-922), `control.toolDelivered(toolCallId, via)`, appel depuis
  `permission()` (décision automatique, décision humaine, plan simulé), `gatewayUsage()`, `gatewayApproval()` ;
  `apps/api/server.js` : routes `tool-outcome` et `evidence`. Événement `tool_armed { toolCallId, via }`
  (`permission`, `gateway`, `in_progress`, `tool_call`) une fois par appel, sans donnée personnelle.
- 09:23 — `tests/tool-stall-delivery.test.js` : **5/5 verts** (`stall-01-evidence/vert-stall-01.txt`).
  `tests/tool-guard.test.js` (nouveau, garde seule, 8 cas) : **8/8**. `npm run check` et `npm run format:check` :
  verts.
- 09:25 — Sous-ensemble gardes/permissions/pont (`tool-watchdog`, `agent-silence`, `elicitation`, `fix-resume`,
  `workflow-run`, `silent-ms-env`, `career-timeout`, `astra-turn`, `career-integration`, `owner-permissions`,
  `approval-bridge`) : 157 tests, **155 verts, 2 rouges connus** du conteneur (« Agent non détecté sur cette
  machine », `career-integration` : Codex absent ; identiques à ceux notés par apply-01 sur l'arbre de base),
  sortie `stall-01-evidence/vert-gardes.txt`. Commit `cd68748` (code, fixture, tests).
- 09:29 — Phase parallèle complète (`node --test --test-concurrency=4 --test-timeout=120000` sur les 94 fichiers
  hors Chrome, même liste que `scripts/run-tests.js`) : 759 tests, 752 verts, 2 ignorés, **5 rouges** : les
  4 connus du conteneur (2 « Agent non détecté sur cette machine » de `career-integration`, 2 tests de
  groupe de processus `process-liveness` / `runtime` « petit-enfant ignorant SIGTERM », notés à l'identique
  par apply-01 sur l'arbre de base) **et (b bis), mon test** : sous charge, `tool_armed` (mesure d'usage,
  avant le handler) arrivait avant l'écriture du fichier que le test vérifiait aussitôt. Course du test,
  pas du produit : le faux agent écrit `doneFile` quand la remise est terminée (décision reçue, appel MCP
  répondu) et (b), (b bis) l'attendent avant d'avancer l'horloge. Deux passages à concurrence 4 avec
  `career-integration`, `elicitation`, `workflow-run`, `tool-watchdog`, `agent-silence` : 100/102 à chaque
  fois, les 2 rouges étant les « Agent non détecté ». Commit `[stall-01]` suivant (tests seuls).

## Le défaut, tel que lu dans le code

- Relay (`execute`, `packages/orchestrator/index.js`) armait `toolIdleMs` (120 s) au premier `tool_call` ou
  `tool_call_update` non terminal et réarmait à chaque mise à jour ACP, quelle qu'elle soit.
- L'adaptateur Claude surface un appel d'outil dès le début du bloc, en statut `pending` et sans entrée
  complète, puis n'envoie un `tool_call_update` qu'à chaque champ JSON terminé. Pour `career_write`, le
  champ `path` est court et le champ `text` est le rapport entier : entre les deux, aucune mise à jour pendant
  toute la composition. La remise (demande de permission ACP, puis appel MCP) ne vient qu'après.
- La garde ne distinguait pas « l'agent compose » de « l'outil tourne ». Au-delà de 120 s de composition, elle
  coupait la mission (`tool_stalled`, « Outil sans mise à jour depuis 120 s ; relancer »), avant tout appel
  réel à la passerelle : le rapport n'était jamais écrit. C'est le cas E49 (rapport A–G de plusieurs milliers
  de caractères), et une cause possible des arrêts antérieurs du même message quand l'outil coupé était un
  outil MCP de Relay.

## Ce qui a changé (commit `cd68748`, puis `adb421e` pour les tests)

| Fichier | Lignes | Changement |
|---|---|---|
| `packages/orchestrator/tool-guard.js` | nouveau, 103 l. | `ToolGuard` : appels ouverts, armés ou non ; `observe(update)` (ACP), `deliver(id, via)` (remise), `suspend/resume` (question du propriétaire), `clear` ; horloge injectable ; `onArm`, `onStall`. `toolCallName(update)` : `name`, puis `title`, puis `rawInput.name/tool`. `isPlatformToolCall(update, servers)` : préfixe `mcp__<serveur>__` des serveurs MCP de la mission. |
| `packages/orchestrator/index.js` | 62 | import. |
| | 198 | `this.timers = { setTimeout, clearTimeout }` : horloge des gardes de silence, d'outil et de délai (remplaçable en test). |
| | 234 | `gatewayUsage()` : la mesure envoyée par la passerelle avant le handler remet les appels ouverts (`toolDelivered(null, 'gateway')`). |
| | 358 | `gatewayApproval()` : une demande d'approbation de la passerelle compte comme remise/progression. |
| | 888-914 | `ToolGuard` de la mission (remplace `toolTimers`, `pendingTools`, `armTool`) ; `watchTool` garde le titre « Searching the web » et délègue ; `control.toolDelivered(toolCallId, via)`. |
| | 929, 936 | suspension et reprise des délais passent par la garde (un appel en composition reste désarmé à la reprise). |
| | 1052 | `gatewayServers = mcpServers` (serveurs MCP déclarés à `session/new`, ici `platform`). |
| | 1428 | `finally` : `toolGuard.clear()`. |
| | 1451-1487 | `permission()` : une décision (automatique en mode propriétaire, humaine, ou l'annulation d'un plan simulé) remet l'appel nommé par `toolCall.toolCallId`. |
| `apps/api/server.js` | 478, 534 | bilan d'outil (`tool-outcome`) et preuve navigateur (`evidence`) : progression de l'outil. |
| `tests/fixtures/fake-acp.js` | `composeTool` | scénario de composition longue puis remise (accord et/ou appel MCP réel), gel, `doneFile`. |
| `tests/tool-stall-delivery.test.js` | nouveau | (a), (a bis), (b), (b bis), (c) ; horloge simulée ; mission career-ops en mode propriétaire, plan non simulé, faux agent qui appelle la vraie passerelle MCP de Relay (`career_write` écrit `reports/001-entreprise-fictive-2026-11-05.md`). |
| `tests/tool-guard.test.js` | nouveau | garde seule, 8 cas. |

Règles d'armement, telles que codées :
1. Appel d'un outil de la plateforme (`mcp__platform__…`) en statut `pending` : rien d'armé, quel que soit le temps de composition ; la garde de silence (`AGENT_PLATFORM_SILENT_MS`, 180 s par défaut, avertissement à 60 s) reste seule à couvrir un agent muet.
2. Remise observée : décision de permission ACP (l'appel nommé), ou activité de la passerelle (mesure d'usage avant le handler, approbation, preuve, bilan d'outil : tous les appels ouverts, car la passerelle ne connaît pas l'identifiant ACP). Un `tool_call_update` en statut `in_progress` arme aussi (l'adaptateur dit que l'outil tourne).
3. Appel armé : réarmé à chaque mise à jour ACP non terminale, à chaque décision de permission et à chaque activité de la passerelle ; désarmé à `completed`, `failed`, `cancelled`. Sans rien pendant `toolIdleMs` (120 s inchangé) : `tool_stalled`, mission `failed`, message inchangé (« Outil sans mise à jour depuis 120 s ; relancer. », « : Searching the web » conservé).
4. Outil natif de l'agent (Bash, WebSearch, Read…, titre sans préfixe de serveur MCP de la mission) : règle antérieure, armé dès sa première mise à jour.
5. Événement `tool_armed { toolCallId, via }` (`permission`, `gateway`, `in_progress`, `tool_call`), une fois par appel.

Aucune règle propre à career-ops dans le moteur (le préfixe vient du nom du serveur MCP déclaré à la session ; `career_write` n'apparaît que dans les tests). Aucune restriction nouvelle pour l'agent, aucune variable d'environnement nouvelle, aucun délai allongé, Skill et bibliothèque career-ops intouchés, aucune donnée personnelle ici ni dans les événements ajoutés.

## Limites et points non couverts

- **Outils natifs** : pour Claude, la demande de permission ACP serait une remise observable aussi pour Bash,
  Write ou Edit, mais les outils en lecture (Read, Glob, WebSearch) n'en demandent pas, et Codex/Gemini
  ne passent pas par la même voie ; faute de remise fiable, la règle antérieure est conservée (brief, point 3).
  Conséquence connue : un long `Write` natif composé plus de 120 s par Claude serait encore coupé (même
  mécanisme qu'E49, hors passerelle) ; non observé, non corrigé, à décider par le manager.
- **Nom de l'appel** : la classification « outil de la plateforme » repose sur le nom `mcp__platform__<outil>`
  (celui de l'adaptateur Claude, confirmé par le collecteur d'E49 et par `renderer.js`). Codex et Gemini
  nomment leurs appels MCP sans ce préfixe : ils sont traités comme natifs, donc armés dès le `tool_call`,
  ce qui correspond à leur comportement (appel annoncé quand il démarre). Le binaire `codex-acp` n'a pas
  été lu ; Gemini CLI non installé ici : à vérifier en réel si un rapport long y échoue de la même façon.
- **Remise sans identifiant** : l'activité de la passerelle arme tous les appels ouverts. Avec des appels
  parallèles de Claude, un frère encore en composition serait armé en même temps (retour à l'ancienne règle
  pour lui) ; en pratique un seul bloc d'outil se compose à la fois.
- **Étapes DAG (`workflow-run.js`, `TurnGuard`)** : chemin non touché, toujours armé à l'ouverture ; même
  correctif applicable si une étape agent appelle un outil MCP long.
- **Horloge simulée** : seules les gardes du moteur la suivent ; la permission humaine (60 s) et le délai de
  l'ACP runtime restent réels.
- **Premier commit `cd68748`** : auteur `stall-01` et sans pied de page de session (oubli) ; pas d'`amend`
  (règle `AGENTS.md`), les commits suivants sont conformes.
- **Non vérifié en réel** : aucun modèle appelé. La preuve attendue : `permission_auto` puis `tool_armed`
  (`via: permission`) pour `mcp__platform__career_write`, puis `tool_call_update completed`, mission
  `completed`, sur une mission `pipeline` Claude dont le rapport dépasse 120 s de composition.
- 09:30 — **Phase parallèle complète, après le correctif des tests** (même commande, 94 fichiers, sortie
  `stall-01-evidence/vert-suite-parallele.txt`) : **767 tests, 761 verts, 2 ignorés, 4 rouges**, tous connus
  du conteneur : `career-integration` ×2 « Agent non détecté sur cette machine » (Codex absent),
  `process-liveness` et `runtime` ×1 chacun (« petit-enfant ignorant SIGTERM », signaux de groupe du
  conteneur). **Reproduits à l'identique sur l'arbre `origin/dev` intact** (worktree temporaire,
  `node_modules` lié : 110 tests, 106 verts, les 4 mêmes rouges ; `stall-01-evidence/base-dev-echecs-connus.txt`),
  worktree supprimé ensuite. `npm run check` : « Syntaxe JavaScript valide. » `npm run format:check` :
  « All matched files use Prettier code style! ». Phase Chrome non lancée (pas de Chrome dans le cloud).
- 09:31 — Registre : ligne E49 passée à « Corrigé, à vérifier en réel » (cause analysée, commit `cd68748`,
  preuve réelle attendue). Rapport clos, commit, push sur `cloud/stall-01` seulement.

## Commandes exactes

```sh
export PATH=/opt/node24/bin:$PATH   # Node 24.x (le conteneur démarre sur Node 22)
npm ci
node --test --test-concurrency=1 --test-timeout=120000 tests/tool-stall-delivery.test.js   # rouge avant, vert après
node --test tests/tool-guard.test.js
node --test --test-concurrency=4 --test-timeout=120000 tests/tool-watchdog.test.js tests/agent-silence.test.js tests/elicitation.test.js tests/fix-resume.test.js tests/workflow-run.test.js tests/silent-ms-env.test.js tests/career-timeout.test.js tests/astra-turn.test.js tests/career-integration.test.js tests/owner-permissions.test.js tests/approval-bridge.test.js
node --test --test-concurrency=4 --test-timeout=120000 $(ls tests/*.test.js | grep -v -E 'browser-click-ref|browser-type-upload-ref|browser-select-check|browser-fill-form\.|browser-field-review|browser-gateway|approval-bridge|owner-browser|apply-flow|apply-01-approval-card')   # phase parallèle de scripts/run-tests.js
npm run check && npm run format:check
```

## Pour le manager

**Ce qui a changé.** La garde « outil figé » ne démarre plus à l'ouverture ACP d'un appel d'outil de la
plateforme, mais à sa remise : décision de permission (`permission_auto` ou décision humaine) ou première
activité de la passerelle MCP de Relay (mesure `tool_call` envoyée avant le handler, approbation, preuve,
bilan d'outil). Elle se réarme à chaque progression et coupe toujours à 120 s un appel remis sans réponse,
message inchangé. Un `tool_call` en composition (statut `pending`, `rawInput` partiel) n'arme rien : la garde
de silence couvre l'agent muet. Outils natifs hors passerelle : inchangés. Nouvel événement `tool_armed`
(`toolCallId`, `via`). Fichiers et lignes : tableau ci-dessus (`packages/orchestrator/tool-guard.js` nouveau ;
`packages/orchestrator/index.js` 62, 198, 234, 358, 888-914, 929, 936, 1052, 1428, 1451-1487 ;
`apps/api/server.js` 478, 534 ; `tests/fixtures/fake-acp.js` ; deux fichiers de tests nouveaux).
Commits sur `cloud/stall-01` : `cd68748` (code et tests), `adb421e` (course de test), puis ce rapport.

**Preuves.** Tests rouges sur la garde inchangée (`rouge.txt` : `tool_stalled` après 150 s simulées de
composition), verts après (5/5 et 8/8) ; gardes existantes vertes (`tool-watchdog`, `agent-silence`,
`elicitation`, `fix-resume`, `workflow-run`…) ; phase parallèle 761/767, les 4 rouges étant ceux du conteneur,
reproduits sur `origin/dev` intact ; `check` et `format:check` verts.

**Limites** (détail à la section précédente) : outils natifs toujours armés à l'ouverture (un long `Write`
natif de Claude resterait exposé, non observé) ; classification par le nom `mcp__platform__…` de l'adaptateur
Claude, Codex/Gemini traités comme natifs (cohérent avec un appel annoncé au démarrage, non vérifié sur le
binaire) ; activité de la passerelle sans identifiant ACP, donc tous les appels ouverts armés ; étapes DAG
(`TurnGuard`) non touchées ; premier commit sans pied de page de session, non amendé.

**À vérifier en réel** (Mac du propriétaire, Chrome et Claude réels) : relancer la mission `pipeline` d'E49
(ou toute mission dont un rapport A–G dépasse 120 s de rédaction). Attendu dans les événements :
`agent` `tool_call` `pending` pour `mcp__platform__career_write`, `agent_silent` à 60 s possible (avertissement
seul), aucun `tool_stalled`, puis `permission_auto` et `tool_armed` (`via: permission`) pour ce même
`toolCallId`, `tool_call_update` `completed`, rapport présent dans `reports/`, mission `completed`.
Contre-épreuve : un vrai gel (navigateur figé) doit encore donner `tool_stalled` 120 s après `tool_armed`.
Si une mission Codex ou Gemini montre le même symptôme, lire le nom que leur adaptateur donne aux appels
MCP et étendre `isPlatformToolCall` (une ligne), sans règle métier.
