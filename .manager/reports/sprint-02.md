# Rapport sprint 02 — Couche d'exécution multi-agents

**Exécutant : Claude (manager), pas Codex.** Codex a atteint sa limite d'usage à 02:56 (tous modèles,
retour annoncé 7h29). Pour ne pas perdre la nuit, le manager réalise ce sprint selon le même protocole ; la
relecture indépendante `review-02` sera faite par Codex à son retour.

## Journal

### 03:00 — Diagnostic
- Défaut confirmé : `AcpRuntime.request()` passait `{ signal }` au SDK alors que `SendRequestOptions` attend
  `cancellationSignal` (`node_modules/@agentclientprotocol/sdk/dist/core/jsonrpc.d.ts`). Le délai de 30 s et
  l'annulation étaient donc ignorés ; un agent muet bloquait le run jusqu'au délai global de l'orchestrateur.
  De plus l'annulation SDK est coopérative : la promesse attend la réponse du pair.
- Contrats réels lus : Gemini CLI `packages/cli/src/acp/acpRpcDispatcher.ts:224` (`unstable_setSessionModel`
  → méthode `session/set_model`, params `{sessionId, modelId}`), `acpSessionManager.ts:157–171` (`modes` +
  `models` dans la réponse de session ; modes `default/autoEdit/yolo/plan`). OpenCode 1.19.4 : modèles ET mode
  en `configOptions` (catégories `model` et `mode`), modèles `opencode/*-free` annoncés.

### 03:05 — CLI persistants
- `npm install --save-exact --ignore-scripts @google/gemini-cli@0.65.0 opencode-ai@1.19.4` dans
  `~/Downloads/agent-repos/.cli/` : succès (9 paquets). OpenCode refuse de démarrer sans son postinstall ;
  script lu avant exécution (copie locale du binaire `opencode-darwin-arm64` déjà téléchargé, pas de réseau),
  puis `node postinstall.mjs` : OK. `gemini --version` 0.65.0, `opencode --version` 1.19.4.

### 03:10–03:35 — Refonte `packages/agent-runtime`
- `profiles.js` : profils déclaratifs (commande, variables d'environnement autorisées, modes sûrs, préférence).
- `env.js` : environnement enfant en **liste blanche** (base système + variables du profil) ; masquage des
  secrets dans stderr (valeurs connues + motifs `AIza…`, `sk-…`).
- `discovery.js` : CLI utilisateur via `.data/agents.json` (`cliDirs`, `paths`, chemins absolus exigés),
  `AGENT_PLATFORM_CLI_DIRS`, puis PATH hors node_modules ; raisons d'incompatibilité explicites.
- `capabilities.js` : normalisation modèles (`configOptions` OU `models`), modes, capacités (MCP stdio
  obligatoire, http/sse, loadSession, auth).
- `router.js` : Auto par exigences (reprise, modèle, transport MCP) + dernières sondes ; rejets expliqués ;
  **aucun repli fixture silencieux** en mode réel.
- `probes.js` : dernières sondes par agent (`.data/agent-probes.json`, écriture atomique, sans secrets).
- `index.js` : délai local réel par méthode, réaction à l'abandon et au crash (`AgentExitError`, y compris
  quand le SDK signale d'abord « connection closed »), réponses tardives ignorées, mode sûr choisi parmi les
  modes annoncés (sinon refus), modèle via `session/set_config_option` ou `session/set_model`.
- Orchestrateur : Auto branché sur le routeur, raisons du choix dans le plan, sondes enregistrées après
  session réussie/refusée, modèle refusé s'il n'a pas été annoncé au dernier test.

### 03:35 — Tests
- Nouveau faux agent paramétrable `tests/fixtures/fake-acp.js` (muet, crash, bruit stdout, auth requise,
  modèles des deux styles, modes, permission bloquée, réponse tardive, fuite stderr simulée).
- Erreur rencontrée : le SDK refuse `onRequest('session/set_model')` sans parseur (« Unknown ACP request
  method ») → parseur zod ajouté dans le faux agent. Côté client, les méthodes non standard passent.
- Erreur rencontrée : crash → « ACP connection closed » au lieu d'`AgentExitError` → correctif ci-dessus.
- `tests/runtime.test.js` : **35 tests**. Suite complète : **46 réussis, 0 échec** ; check et format verts.
