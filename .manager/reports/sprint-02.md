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

### 03:40–04:15 — Agents réels (preuves dans docs/validation.md et docs/research/live-probe.json)
- `.data/agents.json` → les 4 agents réels détectés compatibles. Ajout de `--pure` à OpenCode (sans plugins).
- Sonde sans prompt : Codex `read-only` (7 modèles), Claude `default` (5), OpenCode `plan` (9 modèles gratuits),
  Gemini **échec** « Gemini API key is missing » car ma commande ne chargeait pas `.manager/secrets.env` →
  relance avec la clé : session OK, mode `default`, 6 modèles via `models`.
- Prompt réel Gemini `gemini-3.5-flash-lite` : « OK », 10 451 tokens d'entrée (prompt système du CLI), 2,4 s.
- Prompt réel OpenCode modèle gratuit : « OK ». **Mais** run Najah refusé par la politique des modèles gratuits
  (« backend for other services ») → respecté, pas de contournement, ADR 005 complété ; refus désormais
  présenté proprement (`parseAgentResult`, 4 tests).
- Run Najah réel Gemini n°1 : **Gemini a inventé deux offres** sans appeler d'outil ; vérification Najah a
  rejeté. Cause trouvée dans le code : MCP ignoré en dossier non approuvé (`mcp-client-manager.ts:461`) →
  `GEMINI_CLI_TRUST_WORKSPACE=true` au seul profil Gemini (espace de run vide créé par la plateforme).
- Run n°2 : 4 demandes de permission, toutes refusées par mon script car l'API n'exposait pas l'outil →
  bug corrigé (`tool` ajouté à la permission exposée).
- Run n°3 : **completed** — `browser_snapshot`, `opportunities_search`, `opportunities_rank` appelés avec
  permission ponctuelle, classement identique à l'outil, vérification Najah OK. Coût cumulé ≈ 0,024 $.
- Nouveau script `scripts/live-run.js` (pilote un run réel via l'API ; n'approuve que les outils plateforme).
- UI : sélecteur de modèle alimenté par les modèles annoncés, statut d'agent (session validée / authentification
  requise), raisons du routeur Auto et rejets dans le plan. API : `publicAgents` sans chemins ni environnement.

## État final du sprint 02
- **Opérationnel et testé** : runtime ACP à délais réels, crash/annulation, env en liste blanche, masquage des
  secrets, modes sûrs, modèles (deux mécanismes), routeur Auto, sondes, UI modèles. **59 tests verts**.
- **Validé en réel** : 4 handshakes/sessions ; prompts Gemini et OpenCode ; workflow Najah complet avec Gemini.
- **Non validé** : prompt Codex (limite d'usage), Claude (authentification), reprise `session/load` réelle.
- **Limites** : la décision d'approuver les outils plateforme est encore manuelle (script/UI) ; une règle de
  politique « outils internes en lecture seule = autorisation ponctuelle automatique » relève du sprint 04.
  `GEMINI_CLI_TRUST_WORKSPACE` devra être revu quand un dépôt utilisateur sera monté comme espace de travail.
- **Pour la relecture (Codex)** : vérifier `request()` (courses entre abort/exit/réponse), `applySafeMode`,
  le routeur, la liste blanche d'environnement, `parseAgentResult` (extraction du premier `{` au dernier `}`).
