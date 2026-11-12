# contrat-agents-01 — Un seul contrat de lecture des appels d'outils (rapport au fil de l'eau)

Codeur : Opus (sous-agent). Arbre `~/Downloads/agregat-back-cto`, branche `cto-11-11`, seul écrivain.

## Journal

- 23:01 — Lecture d'`AGENTS.md`, du brief et de `nuit-12-11.md` (A2 à A4, diagnostic). Arbre propre au départ
  (`git status --short` vide), tête `017e8f2`.
- 23:03 — Inventaire des lecteurs (`rg -n "rawInput|toolCallName|claudeCode|is_mcp_tool_call" packages apps`) :
  `tool-guard.js` (`toolCallName`, `isPlatformToolCall`, `isGatewayToolCall`, `careerScriptDelay`),
  `native-actions.js`, `skill-router.js` (`toolInput`, `toolName`, `matches`), `career-ops/truth.js`
  (`createTurnTruth.observe`), `career-ops/attachments.js` (`trackAttachments`), `orchestrator/index.js`
  (`permissionToolName`, `sendTarget`, repérage `browserToolObserved`), `workflow-run.js` (`isBrowserToolName(title)`).
- 23:04 — Lecture SEULE de `.data/platform.sqlite` (python3, `mode=ro`) pour les missions b62c886b, c8d8a1a4
  (Claude), a635d2ea, c031ef07, 32638afc (Codex). Extraits tronqués écrits hors dépôt (bloc-notes de session) ;
  rien de ces extraits n'entre dans Git.
- 23:05 — Formes constatées (journaux réels) :
  - Claude (`claude-agent-acp` 0.95.0) : `tool_call` `pending` avec `name` = `title` = `mcp__platform__<outil>`,
    `rawInput: {}` ; l'entrée arrive par des `tool_call_update` ultérieurs, à plat, sans titre, l'outil nommé
    seulement dans `_meta.claudeCode.toolName` ; pour Bash, une mise à jour ultérieure porte la commande comme
    TITRE (`title: "rm -f …"`) ; question : outil natif `AskUserQuestion` puis élicitation.
  - Codex (`codex-acp` 2.2.2) : `tool_call` `in_progress`, `title` = `mcp.platform.<outil>`, SANS `name`,
    `rawInput: {server, tool, arguments:{…}}`, `_meta.is_mcp_tool_call` ; réponses `rawOutput.result.content` ;
    commandes natives `name: exec_command`, titre = la commande ; c031ef07 : permission (classe `execute`) puis une
    seule mise à jour `in_progress`, jamais de `tool_call` ni de clôture ; aucune question Codex dans ces missions.
- 23:06 — Fixtures `tests/fixtures/acp-shapes/claude.json` et `codex.json` : 8 cas chacun (navigation par la
  passerelle, dépôt de fichier, `career_script` long (`scan`), `career_write` d'un rapport, commande native, commande
  native jamais close, demande de permission, question). Toutes les valeurs remplacées par des valeurs FICTIVES de
  même forme (`offres.example.test`, `exec-00000000-…`, `toolu_01FICTIF…`, `dossier-fictif`). Les cas non constatés
  sont marqués `observed: "construit : …"` (Claude : natif jamais clos ; Codex : dépôt de fichier, question). La
  demande de permission ACP elle-même n'est pas journalisée : sa forme (`toolCallId`, `kind`) est reconstruite.
  Les marqueurs `{ "platform": "gateway_received" | "permission" }` rejouent ce que la plateforme voit hors ACP.
- 23:08 — `tests/contrat-agents.test.js` (13 tests, sans Chrome). Premier passage AVANT tout correctif (seul
  `readToolCall` ajouté, `permissionToolName` exporté) : **8 verts, 5 rouges** — `isGatewayToolCall` (écart de
  fixture, voir plus bas), `ToolGuard` (idem), `NativeActions`, `createTurnTruth`, `permissionToolName`.
- 23:09 — Correctifs (une fonction de lecture partagée, `packages/orchestrator/tool-call.js`, `readToolCall` →
  `{ name, tool, server, input }`) branchée dans chaque lecteur. Deux ajustements de test, pas de code : les cas
  `permission` reçoivent leur marqueur de décision (le rejouer sans décision laissait l'appel Claude non armé, ce
  qu'aucune mission réelle ne fait) ; `native_never_closed` et `question` ne comparent que ce qui est comparable
  (Codex n'y nomme aucun appel : ni la lecture ni le garde ne peuvent le dire natif ; le garde le garde natif par
  défaut et le libère, ce qui est l'issue attendue).
- 23:10 — `node --test tests/contrat-agents.test.js` : 13/13. Sous-ensemble des lecteurs touchés (tool-guard,
  actions-natives, truth-tool-names, career-truth, skill-router, owner-permissions, bilan-vs-events + contrat) :
  **120/120**, existants non modifiés. `npm run check` : « Syntaxe JavaScript valide. »
- 23:11 — Fichier `missions-finies` présent : suite complète lancée (`npm test`, puis `format:check`).

## Écarts trouvés et corrigés

| Agent | Module | Avant | Après |
|---|---|---|---|
| Codex | `career-ops/truth.js` (`createTurnTruth.observe`) | titre `mcp.platform.<outil>` non reconnu (regex ne connaissait que `mcp__x__`) : AUCUN appel Codex vu par le canal ACP (ni issue, ni preuve, ni rapport `reports/` → `hasOfferSave` faux, ni note) ; seul le canal passerelle (`recordGatewayTool`) le masquait en mission | même issue que Claude : `browser_navigate:-`, `career_script:scan`, `career_write:reports/`, offre notée |
| Codex | `career-ops/attachments.js` (`trackAttachments`) | même regex : un `browser_upload` Codex jamais compté par l'ACP (`attached: 0`) | `attached: 1` comme Claude |
| Codex | `orchestrator/native-actions.js` | sans le `isPlatform` de l'orchestrateur, chaque appel de la passerelle Codex (kind `execute`) comptait « 1 commande » au Bilan (E98 n'était corrigé que par le câblage) | le module reconnaît lui-même le nom nu : aucune action native pour un appel de la passerelle |
| Claude | `orchestrator/index.js` (`permissionToolName`) | la trace nommait `mcp__platform__career_read` (Claude) mais `career_read` / `browser.navigate` (Codex) | Claude nomme comme Codex (`career_read`, `browser.navigate`) ; voir « Point à trancher » |
| les deux | `tool-guard.js` (`isGatewayToolCall`, `careerScriptDelay`), `skill-router.js` (`toolInput`, `toolName`), `index.js` (repérage `browserToolObserved`), `workflow-run.js` (`isBrowserToolName(update.title)`) | lectures dispersées, chacune à sa façon (déjà justes pour les deux formes sauf exceptions ci-dessus) | une seule lecture ; mises à jour Claude sans titre (`_meta` seul) désormais nommées (`isGatewayToolCall` rend `true` au lieu de `null` : sans effet, l'appel était déjà connu de la passerelle) |

Note sur l'ordre de lecture : `readToolCall` lit `name`, puis `_meta.claudeCode.toolName`, puis `title`, puis
`rawInput.name` / `rawInput.tool` (sauf forme Codex `{server, tool}`, lue en premier). `skill-router.toolName`
lisait autrefois `rawInput.name` avant le titre ; aucun adaptateur relevé ne porte `rawInput.name` (recherche dans
les journaux et les tests : aucun cas), donc aucun changement constaté — non prouvé pour un adaptateur inconnu.

## Gemini CLI et OpenCode (étape 4) : pas de fixture, forme non établie sans doute possible

- Gemini CLI (`agent-repos-agregat/google-gemini__gemini-cli`, tête `cd1b45c`, lecture seule) :
  `packages/cli/src/acp/acpSession.ts` (envois `tool_call` vers les lignes 737 et 828) n'émet **aucun `rawInput`**
  ni `name` : seulement `toolCallId`, `title` (= `getDisplayTitle()`, qui pour un outil MCP rend `params.command`
  quand il existe, sinon une description formatée — `core/src/tools/mcp-tool.ts`, `formatToolDisplayTitle`),
  `kind`, `locations`, `content`. L'identifiant est `fc.id` fourni par le modèle, sinon `<nom>-<horodatage>-<n>`.
  Conséquence : ni les arguments (motif d'URL, délai propre de `career_script`, chemin de `career_write`) ni de façon
  sûre le nom (le titre d'un `career_script` serait la commande, p. ex. `scan`) ne sont lisibles par l'ACP ; seul
  le canal passerelle les voit. Il manquerait, pour l'établir : le nom réel de `fc.name` d'un outil MCP (préfixe
  `mcp_<serveur>_` ou non selon la version) et une mission réelle Gemini journalisée.
- OpenCode (`anomalyco__opencode`, tête `6806c6e`) : `packages/cli/src/acp/tool.ts` (`pendingToolCall`,
  `runningToolUpdate`) émet `name` = nom de l'outil, `rawInput` = entrée à plat, `title` = nom ou commande — forme
  lisible par `readToolCall`. Mais le nom d'un outil MCP (`core/src/tool/mcp.ts` : `namespace(server)` +
  `tool.name`, option `codemode`) dépend du registre d'outils (préfixe `<serveur>_` ou outil seul, ou appel enrobé
  par le mode code) : non établi sans doute possible, donc aucune fixture. Il manquerait une mission réelle
  OpenCode journalisée.

## Ce qui reste propre à un agent (non uniformisable par la lecture)

- Codex peut laisser un appel natif sans `tool_call` ni clôture (c031ef07) : aucun nom à lire ; le garde le
  traite natif par défaut et le libère à la parole suivante du modèle (comportement existant, vérifié par le test).
- Les questions : Claude passe par l'outil `AskUserQuestion` (appel natif + élicitation), Codex par le texte de sa
  réponse ; aucune des deux n'ouvre d'appel de la passerelle (vérifié).
- Les réponses : Claude `rawOutput` = tableau MCP, Codex `rawOutput.result.content` ; `exitFailedOf` lit déjà les
  deux (même échec au code 1, vérifié pour `SkillProgress` et la vérité). `attachments.answerOf` ne lit que
  `rawOutput.content` : pour Codex le nom déposé vient de l'entrée (`path`) et non de la réponse (`uploaded`) ;
  même issue sur la fixture, écart possible seulement si la passerelle dépose un autre fichier que celui demandé.
  Non corrigé (hors lecture des appels, à trancher).
- Un appel Claude de la passerelle n'est armé qu'à sa remise (permission ou passerelle) ; Codex l'annonce
  `in_progress` d'emblée et il est armé tout de suite : règle d'origine (`isPlatformToolCall`), inchangée.

## Point à trancher par le manager

- `permissionToolName` change pour Claude : la trace `permission_auto` / la carte nomment désormais `career_read`,
  `browser.navigate`… au lieu de `mcp__platform__career_read`. C'est le seul changement visible pour Claude ; il
  aligne Claude sur Codex (le test existant « format Codex » fixe `browser.navigate`, donc l'inverse n'était pas
  possible sans modifier un test). `formatAutoSendLine` (seul lecteur fonctionnel, `browser.send`) n'est pas touché :
  ses permissions viennent de la passerelle et portent `capability`. L'outil hors dépôt
  `.manager/outils/bilan-vs-events.mjs` lit ce champ : non vérifié pour la forme `browser.navigate` (non modifié,
  hors périmètre).

## État final

- Opérationnel : `readToolCall` (`packages/orchestrator/tool-call.js`) utilisé par `isGatewayToolCall`,
  `careerScriptDelay`, `NativeActions`, `SkillProgress` (`toolInput`, `toolName`), `createTurnTruth`,
  `trackAttachments`, `permissionToolName`, le repérage navigateur de l'orchestrateur et de `workflow-run`.
- Tests ajoutés : `tests/contrat-agents.test.js` (13 tests) + fixtures `tests/fixtures/acp-shapes/{claude,codex}.json`.
- 23:22 — Suite complète, une fois (Mac éveillé, `missions-finies` présent) : `npm test` unitaires **1115 tests,
  1113 réussis, 0 échec, 2 ignorés** ; Chrome **225/225** ; `npm run check` « Syntaxe JavaScript valide. » ;
  `npm run format:check` « All matched files use Prettier code style! ». Aucun test existant modifié ; le test
  fragile « Chrome isolé : délai du faux exécutable muet » est passé.
- Aucun réseau, aucun Chrome du propriétaire, ni relais, ni 4310/4313, aucun `.env*` lu ; base lue en `mode=ro`.
