# CARTE : où vit quoi dans Relay, où trouver la logique éprouvée

Date : 04/11/2026. Relay : `f163b0c` (branche `suite-astra`). Dépôts d'inspiration : `/Users/diaw/Downloads/agent-repos-agregat/` (lecture seule).

**Avertissement.** Références ouvertes dans les clones, aucune ligne copiée. Les plages ont été lues le 04/11/2026 ; un clone peut avancer, revérifier avant de s'appuyer sur un numéro de ligne. Une licence de dépôt ne rend pas libre chaque fichier ou Skill contenu. Cette carte complète `.manager/reuse-map.md` et `.manager/PLAN-reuse.md` (27/10) sans les contredire ; deux écarts sont signalés en fin de document. Notation `dépôt@commit:fichier:lignes`, le dépôt étant le dossier de `agent-repos-agregat/`.

Racine Relay : `/Users/diaw/Downloads/agregat-back-astra/` (tous les chemins de la partie A sont relatifs à elle).

## Partie A : Relay, où vit quoi

| Module | Fichiers | Rôle |
|---|---|---|
| API HTTP | `apps/api/server.js` | Serveur local 127.0.0.1:4310 (`npm start`) : routes `/api/runs` (+ events, cancel, resume), `/api/permissions/:id` (l.532, réponse aux accords), `/api/runs/:id/steps/:step` (l.523, décision d'étape), `/api/career/*`, `/api/skills/*` (import, revue, install, activate), `/api/internal/*` (approvals, evidence, tool-outcome, browser-fallback, usage), `/api/files`, `/api/plan` ; `allowedSkillPath`, `publicError`, `publicAgents` en tête. |
| Compagnon | `apps/companion/doctor.js` | `npm run doctor` : diagnostic de l'installation. |
| Orchestrateur, cœur | `packages/orchestrator/index.js` (1372 l.) | Classe moteur : `plan` (l.371), `create` (l.611, chaîne `resumedFrom`), `resumeWorkflow` (l.698), `execute` (l.744), `permission` / `decide` / `clearPermissions` (l.1268-1359), `gatewayApproval` (l.299), `stepDecision` (l.348), `mcpServerFor` (l.231), budgets et usage (`meter`, `gatewayUsage`). |
| Orchestrateur, Skill | `packages/orchestrator/skill-router.js` | Manifeste de Skill (zod), `selectSkillIntents` (l.129, phrases/mots-clés, une seule intention retenue par priorité), `formatSkillOrder`, `formatToolRoles`, classe `SkillProgress` (l.255, suit l'ordre des étapes/outils), `formatSkillBilan` (l.392). |
| Orchestrateur, reprise | `packages/orchestrator/checkpoint.js` | `resumeCheckpoint` : point de reprise applicatif (objectif de départ + tours précédents). |
| Orchestrateur, garde de tour | `packages/orchestrator/turn-guard.js` | Classe `TurnGuard` : verrou de tour. |
| Orchestrateur, échecs | `packages/orchestrator/failure.js` | `rateLimitState`, `usageLimitMessage`, `authFailureMessage`, `careerFailureMessage`, `SERVER_STOPPED`. |
| Orchestrateur, preuve navigateur | `packages/orchestrator/browser-proof.js` | `readablePages`, `verifiedBrowserVisit`, `assessBrowserClaims` (l.73, extrait les URL citées du bilan par regex l.76 puis `replace(/[.,;!?]+$/)`), `browserObservationFailure`. |
| Orchestrateur, règle du doute | `packages/orchestrator/doubt-rule.js` | `DOUBT_RULE` / `withDoubtRule` : consigne ajoutée aux instructions. |
| Orchestrateur, isolation | `packages/orchestrator/isolation.js` | `workspacesRoot`, `agentHomeFor`, `removeRunHomes` : dossiers d'espace de travail et homes d'agents par mission. |
| Orchestrateur, packs | `packages/orchestrator/packs.js` | Charge `domain-packs/*`, `skillDefinitions`, `proposeDag`, `getDag`, `getPack`, `verifyPack`. |
| Orchestrateur, autres | `result.js` (`parseAgentResult`, `executionResult`), `title.js`, `workflow-run.js` (`platformMcp`, `executeWorkflow`, `aggregateOutputs`) | Résultat structuré de l'agent, titre de mission, exécution d'un DAG. |
| Agent Runtime | `packages/agent-runtime/index.js` (417 l.) | Client ACP (SDK `@agentclientprotocol/sdk` 2.0.2) : `onRequest(requestPermission)` l.163-167, `initialize` + `clientCapabilities` l.172-178 (aucune capacité `elicitation` annoncée), chargement de session l.250-257 (refuse tout rejeu : `replay_unqualified`), erreurs `AgentTimeoutError`/`AgentExitError`. |
| Agent Runtime, profils | `profiles.js` (profils d'agents, `getProfile`), `discovery.js` (`loadAgentConfig`, `findCli`, `detectAgents`), `env.js` (`buildChildEnv`, `redact`, `secretValues`), `router.js` (`chooseAgent`, `requirementsFor`), `probes.js`, `capabilities.js`, `process-liveness.js` | Catalogue, découverte des CLI, environnement fils expurgé, choix d'agent selon exigences, sondes, vivacité de processus. |
| MCP Gateway | `packages/mcp-gateway/server.js` (260 l.), `client.js` | Serveur MCP stdio `agent-platform-capabilities` (SDK 1.32.2) : `browser_navigate` (l.82), `browser_snapshot` (l.135), `registerTool` l.134/185/221 ; `client.js` = client minimal. |
| Browser Gateway | `packages/browser-gateway/index.js` (245 l.) | `BrowserGateway` (`call`/`execute` par capacité), `FixtureBrowser`, `FixturePageProvider`, `redactPageText`. |
| Browser Gateway, CDP | `cdp.js` (1526 l.) | `CdpBrowser` : `case 'browser.*'` l.1095-1375 (navigate, snapshot, extract, click, check, select, type, press, upload, download, fillForm) ; `waitForReadablePage` l.157-196 ; `snapshotRefs` l.63 ; filtres de requêtes sensibles. |
| Browser Gateway, transport | `owner-transport.js` (`ownerTransport`), `relay-start.js` (`startRelay`, `waitForExtension`, `RELAY_ENDPOINT` 127.0.0.1:19988) | Connexion au Chrome du propriétaire via le relais Playwriter. |
| Career Ops (plateforme) | `packages/career-ops/tools.js` (510 l.) | `CareerTools`, `registerCareerTools`, `sourceSnapshot`, `assertSourceReview`, schémas d'offres. |
| | `integration.js` | `CAREER_OWNER_FRAME`, `CAREER_INSTRUCTIONS`, `reviewCareer`, `assertCareerReview`. |
| | `review-migration.js` | `REVIEWED_COMMIT = 2d6ed587…` (même commit que le clone de référence), `planReviewMigration`, `applyReviewMigration`. |
| | `documents.js`, `sends.js`, `truth.js`, `workspace.js`, `no-network.cjs` | Documents, filtre d'envoi, vérité des offres, espace de travail, coupe-réseau. |
| Workflow Engine | `packages/workflow-engine/index.js`, `definition.js` | DAG SQLite (`WorkflowEngine`, états d'étape, `StepTimeoutError`), `stepKinds` = tool, agent, approval, verify, aggregate, `validateWorkflow`, `levels`. |
| Policy Engine | `packages/policy-engine/index.js`, `files.js`, `http.js`, `run-policy.js` | `browserPolicy`, `allowedPermission`, confinement de fichiers, politique HTTP/DNS, politique par mission. |
| Capability Registry | `packages/capability-registry/index.js` | Liste des capacités (`browser.navigate`, `.snapshot`, `.extract`, `.click`, `.check`, `.select`, `.fillForm`, `.type`, `.press`, `.upload`, `.download`), `describeCapabilities`. Pas de capacité d'attente ni de défilement. |
| Autres paquets | `packages/skill-registry/` (index, scan : quarantaine, revue), `packages/storage/`, `packages/billing/`, `packages/data-gateway/` | Registre de Skills, SQLite, facturation, accès données. |
| Domain Pack career-ops | `domain-packs/career-ops/manifest.yaml`, `skill-manifest.yaml`, `index.js` | `skill-manifest.yaml` : `toolRoles` (quel outil sert quelle tâche) et `intents` (phrases → étapes ordonnées). |
| Domain Pack najah | `domain-packs/najah/` (`manifest.yaml`, `index.js`, `live.js`, `fixtures.json`, `evals/ranking.json`, `skills/{offer-evaluation,opportunity-analysis,visa-sponsorship-check}`) | Classement d'opportunités, preuves enregistrées. |
| Domain Pack core | `domain-packs/core/` (`manifest.yaml`, `skills/evidence-review`) | Socle commun. |
| Tests | `tests/*.test.js` + `tests/fixtures/` (agents ACP factices `fake-acp.js`, `astra-acp.js`, `career-agent.js`) + `tests/support/` | Voir familles ci-dessous. Lanceur : `scripts/run-tests.js` (`npm test`). |
| Scripts | `scripts/run-tests.js`, `check.js`, `setup-career-ops.js`, `live-*.js`, `playwriter-smoke.js` | Voir ci-dessous. |
| Manager | `.manager/` : `MISSION.md`, `PLAN.md`, `HANDOFF.md`, `BACKLOG.md`, `briefs/` (70), `reports/` (121 dont `registre-erreurs.md`), `registre-erreurs.py`, `run-sprint.sh`, `outils/`, `reuse-map.md`, `PLAN-reuse.md`, `reuse-plan.md`, `api-usage.md` | Pilotage ; le registre d'erreurs est `.manager/reports/registre-erreurs.md` (écrit par `registre-erreurs.py`, lecture seule sur `.data/platform.sqlite`). |

**Familles de tests** (`tests/`) : navigateur (`browser-*.test.js`, `owner-*.test.js`, `approval-bridge`, `playwriter-live`, `relay-start`), career (`career-*.test.js`, `live-scripts`), Astra/ACP (`astra-*.test.js`, `agent-*.test.js`, `api-agents`, `runtime`, `process-liveness`, `resume-probe`), reprise et mémoire (`fix-resume`, `memoire-fil`, `workflow-resume`, `conversation-isolation`), workflow (`workflow-*.test.js`, `step-decision-terminal`), routeur de Skill (`skill-router`, `skill-registry`, `pack-effects`), MCP et politique (`mcp-contract`, `policy-files`, `network-policy`), outils/doute (`doubt-tools`, `tool-watchdog`, `verification-scope`), plateforme (`platform`, `billing`, `test-runner`, `web-dir`, `sse-after-end`). `scripts/run-tests.js` : phase 1 parallèle (concurrence 4) des tests hors navigateur, phase 2 série « Chrome réel » (liste `BROWSER` en tête de fichier : browser-click-ref, browser-type-upload-ref, browser-select-check, browser-fill-form, browser-field-review, browser-gateway, approval-bridge, owner-browser), chaque phase bornée par `test-phase-timeout.js`.

## Partie B : besoins couverts par les dépôts d'inspiration

Abréviations : PW = `microsoft__playwright@b8336b3`, tronc commun `packages/playwright-core/src/tools/backend/` noté `…/backend/`. Licences constatées dans le fichier LICENSE du dépôt sauf mention.

### B1. État « attend la réponse du propriétaire » (elicitation ACP, `session/request_permission`)

| Source | Référence | Licence | Ce que ça fait | Branchement chez nous |
|---|---|---|---|---|
| Spec ACP | `agentclientprotocol__agent-client-protocol@ce563ff9:docs/protocol/v1/elicitation.mdx:15-56,57-135,137-168` | Apache-2.0 | Capacité client `elicitation:{form:{},url:{}}` (chaque mode explicite), requête agent→client `elicitation/create` (modes form et url), réponses `accept`/`decline`/`cancel`, `elicitation/complete` pour l'URL. L'agent ne doit pas demander un mode non annoncé et doit gérer decline/cancel. | `packages/agent-runtime/index.js:177` n'annonce aucune capacité : ajouter `elicitation:{form:{}}` puis un `.onRequest(methods.client.elicitation.create, …)` à côté de celui de `requestPermission` (l.163). |
| Spec ACP | `agentclientprotocol__agent-client-protocol@ce563ff9:docs/protocol/v1/tool-calls.mdx:133-233` ; `docs/protocol/v1/prompt-turn.mdx:470,560-566` | Apache-2.0 | `session/request_permission` (options allow/reject, once/always) ; sur `session/cancel` le client DOIT répondre `cancelled` à toute demande en attente, puis l'agent répond `cancelled` au `session/prompt`. | Déjà en place côté Relay (l.164 renvoie `cancelled` si arrêt). Même règle à appliquer à l'élicitation. |
| Schéma | `agentclientprotocol__agent-client-protocol@ce563ff9:agent-client-protocol-schema/src/v1/client.rs:2190-2400,3890-3913` | Apache-2.0 | Types exacts `RequestPermissionRequest/Response/Outcome`, noms de méthodes `session/request_permission`, `elicitation/create`. | Référence de forme si on valide ou journalise les messages. |
| SDK TS | `agentclientprotocol__typescript-sdk@c7e0738:src/v1/acp.ts:160-181,1243-1250,1296-1312,1446-1464` | Apache-2.0 | `methods.client.session.requestPermission`, `methods.client.elicitation.create/complete`, gestionnaires typés `ClientRequestHandler`. Même version que la dépendance Relay (2.0.2). | `.onRequest(methods.client.elicitation.create, …)` s'écrit comme l'existant ; la promesse renvoyée garde la requête JSON-RPC ouverte. |
| Agent (Claude) | `agentclientprotocol__claude-agent-acp@ebfbfbd:src/acp-agent.ts:10354-10358,10537-10640` ; `src/elicitation.ts:157-247,262-340` | Apache-2.0 | `AskUserQuestion` n'est présenté en formulaire ACP que si `clientCapabilities.elicitation.form` ; questions → champs `question_<n>` (oneOf / anyOf + champ libre `_custom`) ; réponse : decline → réponses vides, cancel/inconnu → annule l'outil. | Sans capacité annoncée, l'agent ne pose pas la question en élicitation : c'est la condition d'activation côté Relay. Format du formulaire à rendre dans l'interface. |
| Agent (Claude) | `agentclientprotocol__claude-agent-acp@ebfbfbd:src/acp-agent.ts:987-1000,1220-1226,696-704,2359-2416,9746` | Apache-2.0 | Ensemble `openUserInputs` des demandes ouvertes ; `withChildAwaitingUser` ; une consigne de pilotage « later » attend le règlement d'une demande plutôt que d'annuler la requête ACP (évite de bloquer le prompt). | Suggère de suspendre les délais de silence/prompt de Relay (`timeouts.prompt`, l.325) tant qu'une demande est ouverte, et de ne pas lancer d'interruption. À vérifier par test. |
| Agent (Codex) | `agentclientprotocol__codex-acp@a77829f:src/ACPSessionConnection.ts:34-44,126-166` ; `src/CodexElicitationHandler.ts:263-290,405` | Apache-2.0 (fichier LICENSE du dépôt) | `withUserAction` : une demande d'accord ou d'élicitation en cours n'est pas confondue avec une session bloquée ; `request_user_input` de Codex converti en `elicitation/create`. | Même condition d'activation ; modèle pour un état « en attente du propriétaire » distinct de « silence ». |
| Agent (OpenCode) | `anomalyco__opencode@6806c6e:packages/cli/src/acp/elicitation.ts:86-110` ; `…/acp/permission.ts:47-80` | MIT | Côté agent : `createElicitation({mode:'form',…})` puis réponse convertie ; `requestPermission` → `once`/`always`/`reject`. | Lecture comparative de l'usage côté agent. |
| Client (acpx) | `openclaw__acpx@c0b9dfd:src/acp/client.ts:1029-1035,2186-2236,2237-2300` ; `src/acp/client-protocol.ts:25-45` | MIT | Côté client : enregistre `elicitation/create`, `session/request_permission` ; la demande attend la promesse du gestionnaire, mise en course (`raceWithAbort`) avec un `AbortSignal` (requête, prompt actif, autorité) ; sans propriétaire actif ou mode non annoncé : réponse `cancel` motivée. Aucune échéance propre : la session reste ouverte. | Modèle direct du gestionnaire Relay : promesse en attente dans un magasin d'accords, réponse via `/api/permissions/:id` (server.js:532), `cancel` si arrêt ou session différente. |
| Orchestration (CAO) | `awslabs__cli-agent-orchestrator@a382974:src/cli_agent_orchestrator/models/terminal.py:21,34` ; `mcp_server/server.py:98-125,1048-1064` | Apache-2.0 | Statut `WAITING_USER_ANSWER` d'un terminal et outil `answer_user_prompt` (validation vide/longueur). | Nom d'état à reprendre pour l'interface (« attend la réponse du propriétaire »). Idée seulement : CAO pilote des terminaux tmux, pas de l'ACP. |
| Orchestration (subagent-mcp) | `Heretyc__subagent-mcp@aa8f421:src/pending-permissions.ts:100-250,284-315` ; `src/index.ts:403,823,1996,2148,2390` | Apache-2.0 + NOTICE | Statut d'agent `permission_requested`, file de demandes par agent, plafond de file, réponse allow/deny par `request_id`. | Modèle de file/état pour plusieurs demandes simultanées. |

### B2. Capture fiable d'une page à rendu différé

| Source | Référence | Licence | Ce que ça fait | Branchement chez nous |
|---|---|---|---|---|
| Playwright | `PW:…/backend/utils.ts:20-56` ; `…/backend/tab.ts:351-354,573-577` | Apache-2.0 | `waitForCompletion` : après une action, délai de stabilisation (500 ms par défaut), puis attend la fin des requêtes document/script/xhr/fetch lancées (plafond 5 s), ou `load` si navigation (10 s). Pas de « networkidle ». | Relay a déjà `waitForReadablePage` (`cdp.js:157-196`, networkidle 1 s + indicateurs `aria-busy` / « Chargement », 8 s). Ajouter la fin de requêtes XHR après une action serait une extension locale, pas une copie. |
| Playwright | `PW:…/backend/wait.ts:20-77` | Apache-2.0 | `browser_wait_for` : attend un texte visible ou disparu (`getByText().first().waitFor`) ou un temps (max 30 s). | Candidat de capacité `browser.wait` (texte attendu, ex. une phrase de la description) : manque dans `capability-registry`. |
| Playwright | `PW:…/backend/find.ts:20-60` ; `…/backend/snapshot.ts:36-56` | Apache-2.0 | `browser_find` cherche un texte/regex dans le snapshot (contexte de 3 lignes) ; `browser_snapshot` accepte `target` (sous-arbre), `depth`, `filename`. | Permet de vérifier que la description est dans la capture, puis de recapturer seulement la zone. Brancher dans `browser.snapshot` (cdp.js:1099) ou comme vérification de `browser-proof.js`. |
| Playwright | `PW:…/backend/mouse.ts:91-110` ; `…/backend/snapshot.ts:67-100` | Apache-2.0 | `browser_mouse_wheel` (défilement par molette) ; `browser_click` par `ref`. | Défilement et clic « voir plus » : aucun outil Relay équivalent aujourd'hui (le clic existe : `browser.click`, cdp.js:1145 ; pas le défilement). |
| Playwriter | `remorses__playwriter@6489336:playwriter/src/wait-for-page-load.ts:1-198` (liste filtrée l.4-39, `linkedin.com` l.13 ; seuils `stuckThreshold`, `slowResourceThreshold`) | MIT | Attente d'état « prêt » par `document.readyState` + ressources Performance en cours, après un minimum de 500 ms, avec filtre de pisteurs/pubs. | Attention : le filtre ignore les requêtes `linkedin.com`, donc ne conviendrait pas tel quel à une page LinkedIn. Idée de seuils (ressource bloquée = ignorée), pas de copie. |
| Playwriter | `remorses__playwriter@6489336:playwriter/src/skill.md:525,561,1007,1388-1396` | MIT | Conseils : préférer attente d'élément à un délai fixe ; si rien n'a changé, `waitForPageLoad` court ; galeries paresseuses : défiler puis re-extraire ; défilement par locator ou molette. | Texte de consigne pour `skill-manifest.yaml` (« si la description manque : défiler, cliquer « voir plus », recapturer »). |
| Playwriter | `remorses__playwriter@6489336:playwriter/src/aria-snapshot.ts:961-975` | MIT | `getAriaSnapshot({page, locator, interactiveOnly, refFilter})` : capture ciblée. | Étude (refs différentes des refs Playwright, cf. reuse-map). |
| playwright-mcp | `microsoft__playwright-mcp@0c4107a:README.md`, `src/README.md` | Apache-2.0 | `src/` ne contient plus que le README : le code des outils est dans `microsoft__playwright` (lignes ci-dessus). | Aucune ligne propre à lire ici. |
| playwriter-browser-mcp | `babelcloud__playwriter-browser-mcp@5f97001:src/tools/wait.ts`, `src/tools/navigate.ts:26` | aucune licence trouvée | `browser_wait_for` et attente `load` 5 s. | Étude seulement, aucune copie. |

### B3. Formulaire de candidature multi-étapes (chantier seek-apply)

| Source | Référence | Licence | Ce que ça fait | Branchement chez nous |
|---|---|---|---|---|
| Playwright | `PW:…/backend/form.ts:25-56` | Apache-2.0 | `browser_fill_form` : champs typés (textbox, checkbox, radio, combobox, slider) par `target`, `setChecked`, `selectOption({label})`, secrets masqués (`lookupSecret`). | Équivalent de `browser.fillForm` (`capability-registry:97`, `cdp.js`). Comparer la gestion combobox/slider et le masquage des secrets ; les accords restent maison. |
| Playwright | `PW:…/backend/files.ts:20-62,64-100` | Apache-2.0 | `browser_file_upload` : suppose un sélecteur de fichier ouvert (état modal `fileChooser`), `setFiles` sous `waitForCompletion`, restaure l'état en cas d'échec ; `browser_drop` : dépôt de fichiers ou données MIME. | Relay : `browser.upload` (`cdp.js:1305-1345`, `waitForEvent('filechooser')`). Comparaison utile pour l'échec/reprise du sélecteur ; chemins confinés par `policy-engine/files.js`. |
| Playwright | `PW:…/backend/dialogs.ts:20-50` ; `…/backend/tab.ts:150-151,208-214` | Apache-2.0 | Boîtes de dialogue suivies comme états modaux (`dialog`/`dialogclosed`), `browser_handle_dialog` (accept/dismiss, `promptText`). | Aucune gestion de dialogue dans les capacités Relay : à ajouter en étape si Seek en ouvre (alerte « quitter la page »). Passer par l'accord humain. |
| Playwright | `PW:…/backend/verify.ts:27-150` | Apache-2.0 | `browser_verify_element_visible`, `_text_visible`, `_list_visible`, `_value` : assertions après remplissage. | Modèle pour une vérification avant l'étape suivante (valeur saisie relue) ; s'ajoute à `browser-proof.js`. |
| Playwright | `PW:…/backend/keyboard.ts:26-125` ; `…/backend/navigate.ts:24-100` ; `…/backend/tabs.ts:25-` | Apache-2.0 | Saisie (`browser_type`, `press_key`), navigation, onglets. | Déjà couverts par `browser.type/press/navigate` ; référence en cas de comportement divergent. |
| playwright-mcp | `microsoft__playwright-mcp@0c4107a:README.md` | Apache-2.0 | Liste d'options du serveur ; code dans `microsoft__playwright`. | Rien de plus. |
| Playwriter | `remorses__playwriter@6489336:playwriter/src/skill.md` (sections de saisie, upload, dialogues) ; `playwriter/src/executor.ts:1776` | MIT | Aide à l'agent pour piloter un vrai Chrome (cadre `state.page`). | Étude ; Relay passe par `owner-transport.js`. |
| Règle Relay | `CLAUDE.md` (racine) | n/a | Envoi final : le clic du propriétaire reste requis. | Ne rien lire ici comme dispense : tout le reste du formulaire passe sans clic. |

### B4. Choix d'un Skill/intention par phrases, contrôle de l'ordre des étapes

| Source | Référence | Licence | Ce que ça fait | Branchement chez nous |
|---|---|---|---|---|
| cliagents | `suyashb734__cliagents@4080474:src/orchestration/task-router.js:57-110,531-565` | MIT | `detectTaskType` : comptage de mots-clés anglais par type de tâche (`includes`), confiance = score/3, défaut `implement`. | Plus faible que `selectSkillIntents` (phrases normalisées, mots entiers, négations, priorité) : ne rien en reprendre pour le choix ; juste confirmer la simplicité. |
| cliagents | `suyashb734__cliagents@4080474:src/orchestration/task-router.js:112-170,300-396` | MIT | `WORKFLOWS` : étapes ordonnées avec `parallel`, `condition`, `passOutput` ; notation de candidats rôle/adaptateur. | Forme de définition d'étape ; l'ordre chez nous est dans `skill-manifest.yaml` (`intents[].steps`) et contrôlé par `SkillProgress`. |
| multiagents | `zetbrush__multiagents@6038986:broker.ts:441-698` ; `orchestrator/orchestrator-server.ts:412-663` | MIT (déclaré `package.json:74`, pas de fichier LICENSE) | Routage de messages entre pairs, `create_team`, `direct_agent`, `resume_session`. | Routage de messages entre agents, pas d'intention de Skill : sans rapport avec `skill-router.js`. |
| CAO | `awslabs__cli-agent-orchestrator@a382974:src/cli_agent_orchestrator/mcp_server/server.py:279-326,1066` ; `src/cao_workflow/models.py:10-31` | Apache-2.0 | `load_skill` (chargement d'un Skill à la demande), `StepHandle` d'un workflow. | `load_skill` : modèle d'outil qui livre le Skill seulement quand l'intention est retenue. |
| vercel skills | `vercel-labs__skills@a80e4c9:src/frontmatter.ts:8-17` ; `src/find.ts`, `src/skills.ts` | MIT | Lecture sûre du frontmatter YAML (pas de JS) ; recherche de Skills par nom. Aucun routage par phrases. | `packages/skill-registry/` : analyse du frontmatter. |
| Anthropic skills | `anthropics__skills@dbd4588:spec/agent-skills-spec.md:1-3` (renvoie à agentskills.io) ; `skills/skill-creator/SKILL.md:67,335` ; `skills/skill-creator/scripts/{run_eval.py,improve_description.py,run_loop.py}` | Par Skill : `skill-creator/LICENSE.txt` = Apache-2.0 ; pas de LICENSE à la racine | Le déclenchement d'un Skill repose sur son champ `description` (« pushy », contextes d'usage) ; scripts d'évaluation de déclenchement. | Méthode pour tester `intents[].phrases` : jeu de phrases attendues/non attendues. Spec absente en local : revoir en ligne. |
| Heretyc | `Heretyc__subagent-mcp@aa8f421:src/routing.ts` ; `routing-table.json` | Apache-2.0 + NOTICE | Table de routage de modèles/fournisseurs par tâche. | Idée pour `agent-runtime/router.js` (choix d'agent), pas de Skill. |

### B5. Extraction des liens cités dans un texte Markdown

| Source | Référence | Licence | Ce que ça fait | Branchement chez nous |
|---|---|---|---|---|
| career-ops | `career-ops-hq__career-ops@2d6ed58:tracker-parse.mjs:455-538` (`parseMarkdownLinks`, `scanMarkdownLinks` l.496) | MIT | Analyse `[libellé](cible)` avec parenthèses équilibrées et échappements ; le commentaire explique le défaut d'une regex naïve `\]\(([^)]+)\)`. | Pour `assessBrowserClaims` (`browser-proof.js:73-85`) : traiter d'abord les liens `[x](url)`. Dépôt intouchable : lecture et étude, ou réécriture maison. |
| career-ops | `career-ops-hq__career-ops@2d6ed58:providers/hackernews.mjs:37-52` ; `plugins/gmail/_helpers.mjs:8-21` | MIT | URL nues : `https?://[^\s<>"')]+` puis retrait de `.,;!?)` finals et de `]` non apparié ; dédoublonnage et `&amp;` pour Gmail. | Ressemble à `browser-proof.js:76-81`. |
| career-ops | `career-ops-hq__career-ops@2d6ed58:tracker-parse.mjs:789-797` (`unwrapReportUrlToken`) | MIT | Retire `),.;` finals puis `<` `>` d'un lien automatique, dans cet ordre. | Montre l'ordre ponctuation avant chevrons. |
| Constat | Relay `packages/orchestrator/browser-proof.js:76` | n/a | La regex exclut `<>"`[]()` et espaces mais pas `*` ni `_` ; `.replace(/[.,;!?]+$/, '')` ne retire pas `**`, ni `:`. | Aucun des dépôts lus ne retire `*`/`**` finals : voir « Ce que je n'ai pas trouvé ». |

### B6. Résultats d'outils volumineux : pagination ou troncature côté serveur

| Source | Référence | Licence | Ce que ça fait | Branchement chez nous |
|---|---|---|---|---|
| MCP servers (fetch) | `modelcontextprotocol__servers@51b6382a:src/fetch/src/mcp_server_fetch/server.py:415-445,460-478` | MIT (`src/fetch/LICENSE`) | Paramètres `max_length` / `start_index` ; tranche le texte, ajoute un avis « tronqué, rappelle avec `start_index` N » seulement s'il reste du contenu ; jamais de page vide. | Déjà imité par `career_read` (`nextOffset`, 24 000 / 48 000 caractères, commit 798ab6a) ; modèle pour `browser.extract` (`maxChars`, cdp.js:1130) et le snapshot. |
| Playwright | `PW:…/backend/snapshot.ts:36-56` ; `…/backend/response.ts:93-135,195` | Apache-2.0 | `filename` : enregistre la capture dans un fichier au lieu de la renvoyer (renvoie un lien) ; `depth` et `target` limitent l'arbre. | Option « écrire dans l'espace de travail et rendre le chemin » pour les snapshots lourds, sous `policy-engine/files.js`. |
| MCP SDK | `modelcontextprotocol__typescript-sdk@951fe560:packages/server/src/ext/skills/paging.ts:31-42` ; `packages/server/src/server/requestBody.ts:7-37` | Apache-2.0 (`packages/server/package.json:5`) | Pagination par curseur pour des listes (pas pour le résultat d'un outil) ; plafond d'octets d'un corps de requête (413). | Aucune pagination de résultat d'outil dans le SDK : confirmer que le plafond reste maison. Clone en `2.0.0-alpha.0` alors que Relay utilise `@modelcontextprotocol/sdk` 1.32.2. |
| playwright-mcp | `microsoft__playwright-mcp@0c4107a:README.md` | Apache-2.0 | Pas de code (voir B2). | Rien. |

### B7. Fichiers attendus par le Skill career-ops (dépôt intouchable)

Dépôt `career-ops-hq__career-ops@2d6ed58`, licence MIT (`LICENSE`), marque réservée (`TRADEMARK.md`).

| Fichier | Statut | Référence | Ce que ça fait | Branchement chez nous |
|---|---|---|---|---|
| `data/blacklist.md` | **Optionnel, jamais créé** (« absence = pas de filtrage », « le système ne le crée ni ne le remplit ») | `DATA_CONTRACT.md:58,208` ; `templates/blacklist.example.md:1-12` ; `scan.mjs:3441-3446,3518-3521` (`loadBlacklist` renvoie une Map vide si absent) ; `discover-ats.mjs:61` (variable `CAREER_OPS_BLACKLIST`) | Liste « ne pas postuler » ; filtre `scan`, `discover-*` et les modes `auto-pipeline`/`oferta`/`apply`. | Ne pas le créer ; son absence est normale. |
| `data/applications.md` | **Créé à la première utilisation** par le flux (agent ou fusion) | `AGENTS.md:28-29,115,309-312` ; `DATA_CONTRACT.md:37,209-210` | Suivi des candidatures : lecture `data/applications.md` puis repli racine ; écriture toujours en `data/`. Aucun script d'installation ne le crée (`doctor.mjs` ne le liste pas dans ses modèles). | Plateforme : laisser le Skill le créer dans son espace de travail, ou le fournir vide si l'on veut éviter une erreur de lecture. |
| `modes/_custom.md` | **Optionnel** ; copié depuis `modes/_custom.template.md` par `node doctor.mjs --json --init-templates` seulement à l'onboarding | `AGENTS.md:18,39,206,216-222` (« jamais signalé, non édité = état valide ») ; `doctor.mjs:1250-1252,1408-1416` ; `DATA_CONTRACT.md:19,101` ; `modes/_shared.md:26` (« if exists ») | Règles maison procédurales. | Son absence (ENOENT) est un état valide : le HANDOFF (l.92) la cite comme « fichier optionnel absent » à ne pas traiter comme cause d'échec. `scripts/setup-career-ops.js` de Relay ne les mentionne pas (aucun résultat de recherche). |

### B8. Chaîne complète de reprise de conversation

| Source | Référence | Licence | Ce que ça fait | Branchement chez nous |
|---|---|---|---|---|
| acpx | `openclaw__acpx@c0b9dfd:src/session/execution/session-management.ts:115-165` ; `src/acp/client.ts:1235-1300` ; `src/runtime/engine/reconnect.ts:830-868,877` | MIT | Choisit `session/resume` sinon `session/load` (selon capacités), sinon erreur ; `loadSessionWithOptions` peut **supprimer** les mises à jour de rejeu (`suppressReplayUpdates`), attend l'écoulement du rejeu (`waitForSessionUpdateDrain`, délais `REPLAY_IDLE_MS`, `REPLAY_DRAIN_TIMEOUT_MS`) ; en cas d'échec : `recoverRuntimeSessionLoadFailure` (nouvelle session). | Relay refuse le rejeu (`agent-runtime/index.js:250-257`, `replay_unqualified`) et passe par un point de reprise applicatif (`orchestrator/checkpoint.js`, `resumedFrom` index.js:600-662). L'approche acpx (suppression + drainage borné) est la seule qui qualifie une frontière de rejeu. |
| claude-agent-acp | `agentclientprotocol__claude-agent-acp@ebfbfbd:src/acp-agent.ts:3141-3165,9220-9240,2986` | Apache-2.0 | `loadSession` : relit l'historique du fichier de session, **attend** `replaySessionHistory` (envoi de `session/update`) avant de répondre ; `resumeSession` sans rejeu. | Réponse de `session/load` arrivée = rejeu terminé dans cette version (0.95.0, celle de Relay). À valider par test avant d'assouplir `replay_unqualified`. |
| codex-acp | `agentclientprotocol__codex-acp@a77829f:src/AcpAgentRouter.ts:90,122` ; `src/CodexAcpServer.ts:666,310-330` | Apache-2.0 | `session/load` (v1) ; en v2 fusionné dans `session/resume` avec `replayFrom`. | À lire avant de généraliser. |
| gemini-cli | `google-gemini__gemini-cli@cd1b45c:packages/cli/src/acp/acpSessionManager.ts:204-290` ; `acpSession.ts:249-` ; `acpRpcDispatcher.ts:92,183` | Apache-2.0 | `loadSession` : reconstruit l'historique du modèle (`convertSessionToClientHistory`, `resumeChat`), puis `streamHistory` **sans attendre** (l.283-286) : le rejeu peut chevaucher le prochain prompt. | Confirme le risque que `replay_unqualified` évite. Version installée par `.cli` : 0.65.0, le clone peut différer. |
| opencode | `anomalyco__opencode@6806c6e:packages/cli/src/acp/service.ts:148-165` ; `packages/cli/src/acp/replay.ts:15-41` | MIT | `loadSession` : attache la session puis rejoue l'historique par pages de 200 messages (`Stream.runForEach`) avant de répondre : la frontière est la réponse. | Idem claude-agent-acp ; installé : `opencode-ai` 1.19.4, clone possiblement différent. |

### B9. Sous-agents et parallélisme

| Source | Référence | Licence | Ce que ça fait | Branchement chez nous |
|---|---|---|---|---|
| subagent-mcp | `Heretyc__subagent-mcp@aa8f421:src/index.ts:1507,1844,1859,1971,2125,2219,2352` ; `src/wait-helpers.ts:21-33` ; `src/zombie.ts` ; `src/concurrency.ts` | Apache-2.0 + NOTICE | Outils `launch_agent`, `get_status`, `poll_agent` (processing/stalled), `kill_agent`, `send_message`, `list_agents`, `wait` (bloque jusqu'à un état rapportable, sans double rapport) ; zombies ; plafond de concurrence ; `handoff-write/read` (l.2674-2724). | Contrat lancement / suivi / résultat pour une future orchestration ; chez nous les étapes parallèles sont des niveaux du DAG (`workflow-engine/definition.js` `levels`). |
| multiagents | `zetbrush__multiagents@6038986:orchestrator/launcher.ts:619-700` ; `orchestrator/monitor.ts:95-200` ; `orchestrator/recovery.ts:35-160` ; `orchestrator/orchestrator-server.ts:412-660` | MIT (`package.json:74`, pas de LICENSE) | `launchAgent`, surveillance de processus (`monitorProcess`), reprise après crash (historique de crashs, respawn), outils `create_team`, `get_team_status`, `resume_session`. | Étude des garde-fous de respawn ; licence de fichier à confirmer avant toute copie (comme dans reuse-map). |
| CAO | `awslabs__cli-agent-orchestrator@a382974:src/cli_agent_orchestrator/mcp_server/server.py:450-552,639-730,924-1000,1129-1220` | Apache-2.0 + NOTICE | `handoff` (attend, délai 600 s), `assign` (asynchrone), `send_message`, `complete_assignment`, `get_handoff_result(job_id)` (résultat durable après délai de transport), `list_siblings`. | `get_handoff_result` : modèle de récupération d'un résultat perdu par délai. |
| cliagents | `suyashb734__cliagents@4080474:src/orchestration/task-router.js:112-170` ; `src/orchestration/run-ledger.js` ; `src/pool/warm-pool.js` | MIT | Étapes parallèles et conditionnelles ; journal de lancement. | Étude (reuse-08). |

### B10. CLI disponibles

`/Users/diaw/Downloads/agent-repos-agregat/.cli/package.json` (nom `relay-agent-clis`, privé) :

| Paquet | Version demandée | Version installée | Binaire (`.cli/node_modules/.bin`) |
|---|---|---|---|
| `@google/gemini-cli` | 0.65.0 | 0.65.0 | `gemini` → `@google/gemini-cli/bundle/gemini.js` |
| `opencode-ai` | 1.19.4 | 1.19.4 | `opencode` → `opencode-ai/bin/opencode.exe` |

Aucun binaire Claude ni Codex dans ce dossier (ils viennent de `@agentclientprotocol/claude-agent-acp` 0.95.0 et `codex-acp` 2.2.2 de `package.json` de Relay). Licences des paquets non relues ici : s'en tenir à celles des dépôts (Apache-2.0 pour gemini-cli, MIT pour opencode).

## Ce que je n'ai pas trouvé

- **B5** : aucune fonction qui retire `**`, `*` ou `_` finals d'une URL citée dans du Markdown. Les trois utilitaires de career-ops gèrent `)` `]` `.,;!?` et les chevrons, pas l'emphase. À écrire côté Relay (`browser-proof.js:76`).
- **B2** : aucune stratégie « clic sur voir plus », ni défilement automatique jusqu'au contenu différé, dans les outils MCP de Playwright ni dans playwright-mcp (code déplacé) ; seulement la molette (`mouse.ts:91`) et des conseils dans `skill.md` de Playwriter. Pas de « networkidle » dans les outils de Playwright (Relay l'emploie déjà).
- **B3** : pas de gestion de formulaire multi-étapes (suivi de pages, brouillon) dans les dépôts : seulement des outils unitaires.
- **B4** : aucun routeur par phrases comparable à `selectSkillIntents` ; `anthropics__skills/spec/` ne contient qu'un renvoi vers agentskills.io.
- **B6** : pas de pagination de résultat d'outil dans le SDK MCP (seulement des listes) ; la référence est le serveur fetch.
- **B8** : aucun dépôt ne documente une « frontière de rejeu » garantie par le protocole : c'est une propriété de l'implémentation (réponse de `session/load` après rejeu chez claude-agent-acp et opencode, non attendue chez gemini-cli).
- `playwright-mcp` : pas de code lisible (`src/README.md` seulement).

## Ce que je n'ai pas vérifié

- Les numéros de ligne de B9 (`index.ts` de subagent-mcp, `server.py` de CAO) sont ceux des déclarations d'outils ; le comportement détaillé de chaque outil n'a pas été lu en entier.
- Pas d'exécution de code des dépôts, ni de test de reprise ; le comportement de rejeu (B8) est lu, non éprouvé sur les versions installées (gemini 0.65.0, opencode 1.19.4, adaptateurs ACP de `node_modules`).
- Les clones peuvent différer des paquets installés (MCP SDK clone `2.0.0-alpha.0` contre 1.32.2 utilisé par Relay) ; les paquets installés n'ont pas été comparés ligne à ligne.
- Licences : lues dans l'en-tête des fichiers LICENSE / `package.json`, non analysées en détail. `zetbrush__multiagents`, `babelcloud__playwriter-browser-mcp`, `osanoai__multicli` : pas de fichier LICENSE ; `anthropics__skills` : licence par Skill (seul `skill-creator/LICENSE.txt` ouvert).
- `modelcontextprotocol__typescript-sdk` : le LICENSE racine annonce une transition MIT/Apache ; seul `packages/server/package.json` (Apache-2.0) a été retenu.
- Écarts avec `reuse-map.md` : (1) ce document cite `microsoft__playwright@b8336b3:…/backend/form.ts` sur 25-56 et `files.ts` 20-100, plus étroit que « 22-100 » du 27/10 car ces fichiers ne comptent que 59 et 102 lignes ; (2) la source des dépôts est `agent-repos-agregat/` (et non `agent-repos/` cité dans `PLAN-reuse.md`).
- `registre-erreurs` : le fichier de sortie est `.manager/reports/registre-erreurs.md` (déduit de `registre-erreurs.py:18`), son contenu n'a pas été lu.
