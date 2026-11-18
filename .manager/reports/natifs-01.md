# natifs-01 — sous-agents internes de l'agent au Bilan (C5, partie observateur et ligne de Bilan)

Branche `natifs-01`, arbre `agregat-back-natifs`. Spécification : `etat-des-lieux-multi-agent-19-11.md`, C5 (section 2)
et section 4. Les trois changements de texte de C5 (compteur, durée, carte) étaient déjà faits (lot 1b) : non touchés.

## Journal

- 08:51 — lecture d'`AGENTS.md`, des règles du brief `multi-agent-v3-01`, de C5 et de la section 4 ; lecture de
  `native-actions.js`, `profiles.js` et du flux d'`index.js` (observation l.1568, ligne de Bilan l.2118).
- 08:52-08:55 — relevé des formes dans les bases, en lecture seule (structure seulement, aucun contenu recopié).
- 08:55-08:58 — test d'abord (`tests/natifs-01.test.js`, rouge : module absent), puis le module, les déclarations, le
  « dont », le branchement ; contrôles négatifs.
- 09:00 — voisins un fichier à la fois, `npm run check`, prettier ; doc ; rapport ; commits.

## 1. Formes relevées (constaté, lecture seule)

Accès : `sqlite3 "file:<base>?mode=ro"` ; la base délégation a refusé `mode=ro` (« unable to open database file »),
ouverte en `mode=ro&immutable=1` (toujours lecture seule).

- **Forme « activité »** (`agentInfo` codex-acp 2.2.2), missions `de62fa62` et `4f1b3412`, `06a1e380` (base essai-13-11),
  `f89767fb` (base délégation) : `tool_call` titré « Start subagent <nom> » / « Interact with subagent <nom> » /
  « Complete subagent <nom> », `kind: other`, `status: in_progress`,
  `rawInput { agentThreadId, agentPath: "/root/<nom>", activityKind: started | interacted | completed }` ; chaque appel
  est suivi d'un `tool_call_update` `completed` 1 à 2 ms après ; id `call_<hex>` pour départ et échange,
  `subagent-completed-<uuid>` pour chaque fin de tour (uuid différent du fil). Pas de `_meta`, pas de `rawOutput`, aucun
  appel enfant. Séquences : `de62fa62` départ, échange, fin, échange, échange, fin ; `f89767fb` départ, fin, puis
  3 × (échange, fin) ; `4f1b3412` et `06a1e380` 1 départ, 2 échanges, 3 fins.
- **Forme « outil »** (claude-agent-acp 0.95.0), mission `a41e9279` (base essai-13-11, seule utilisation) : `tool_call`
  `title: "Task"`, `name: "Agent"`, `kind: think`, `_meta.claudeCode.toolName: "Agent"` ; puis des `tool_call_update`
  qui complètent `rawInput { description, subagent_type, run_in_background: false, prompt }` ; 23 appels enfants
  (`Bash` ×15, `Read` ×3, `mcp__platform__career_read` ×2, `Edit`, `Write`, `ToolSearch`) portant
  `_meta.claudeCode.parentToolUseId` = l'id de l'appel `Agent` ; un `tool_call_update` avec
  `_meta.claudeCode.toolResponse { status, prompt, agentId, agentType, content, resolvedModel, totalDurationMs,
totalTokens, totalToolUseCount, usage, toolStats }`, puis un dernier `tool_call_update` `status: completed`.

## 2. Changement

- `packages/orchestrator/native-subagents.js` (neuf, ~140 lignes) : `NativeSubagents(agent, { now })` lit
  `agent.nativeSubagents` ; `observe(update)` reconnaît les seules formes déclarées ; `line()` rend `''` si aucun
  sous-agent vu, sinon une ligne « Sous-agents internes de l’agent (lancés par l’agent lui-même, hors enveloppe de la
  plateforme) : n — … ». Forme activité : nom (dernier segment de `agentPath`, caractères simples, 40 au plus),
  échanges (départ + relances), fins de tour, durée du premier départ à la dernière fin vue par la plateforme, ou
  « aucune fin vue ». Forme outil : type (`agentType` déclaré, sinon `subagent_type`), appels d'outils vus, état
  (terminé, en échec, annulé, sans fin vue), durée vue par la plateforme, puis « selon l’agent : modèle …, n outils,
  durée ». La limite déclarée par le profil termine la ligne. Jamais la description, le prompt, l'id, les jetons.
  `isInner(id)` : appel fait par un sous-agent. `nativeSubagentsOf(nativeActions, agent)` : un observateur par instance
  de `NativeActions` (WeakMap) ; `attachedSubagents(nativeActions)` le lit sans le créer. Bornes : 200 sous-agents,
  4000 appels par sous-agent.
- `packages/agent-runtime/profiles.js` : `nativeSubagents` déclaré pour `codex` (forme activité, limite « modèle et
  consommation non rapportés par l’agent ») et `claude` (forme outil, limite « chiffres « selon l’agent » déclarés par
  lui, non mesurés par la plateforme ; consommation non reprise »). Aucun autre profil.
- `packages/orchestrator/native-actions.js` (le « dont » seulement) : `call.tallied = true` quand un appel est compté ;
  `line(subagents = attachedSubagents(this))` ajoute « ; dont n de ses sous-agents internes » si n > 0 ; import de
  `attachedSubagents`.
- `packages/orchestrator/index.js` : deux lignes du flux (observer après `nativeActions.observe`, l.1570 ; ligne de
  Bilan après `nativeActions.line()`, l.2121), plus l'import (l.83). La ligne existante `nativeActions.line()` est
  inchangée : le « dont » trouve l'observateur par `attachedSubagents`. Le Bilan est bien assemblé là où la
  spécification le dit (numéros décalés de quelques lignes).
- `docs/api-delegation.md` : section 5.1.

## 3. Tests (résultats exacts, `AGENT_PLATFORM_AGENTS_CONFIG=/nonexistent/agents.json`, un fichier à la fois)

`natifs-01` 9/9 (avant le code : rouge, module absent). Voisins : `actions-natives` 6/6, `apply-01-bilan` 7/7,
`audit-nav2-bilan` 4/4, `audit-suite-02-bilan-cv-joint` 3/3, `bilan-courriel` 2/2, `bilan-evaluer-puis-postuler` 8/8,
`bilan-questions` 2/2, `bilan-sans-negation` 4/4, `bilan-vs-events` 7/7, `career-bilan-requested` 6/6,
`career-truth` 4/4, `truth-tool-names` 6/6, `platform` 11/11, `career-integration` 50/50, `career-failure` 11/11,
`fix-resume` 28/28, `delegation-v2-01-b` 12/12, `multi-agent-v3-01-a` 7/7, `multi-agent-v3-01-b` 8/8, `chef-01` 16/16,
et pour le profil : `api-agents` 12/12, `demarrage-01` 9/9, `conversation-isolation` 9/9. `bilan-mixtes` non lancé
(navigateur). `npm run check` : « Syntaxe JavaScript valide. » ; `npx prettier --check` sur les 7 fichiers touchés :
conforme.

Tests de `natifs-01` (données FICTIVES qui recopient les formes) : activité 1 et 2 sous-agents (ligne exacte), outil
terminé (ligne exacte + « dont 3 ») et en échec, sans sous-agent (aucune ligne, actions natives identiques pour codex,
claude, fixture), forme non déclarée non reconnue (fixture, gemini, opencode, profil vide, et chaque adaptateur ignore
la forme de l'autre), `nativeSubagentsOf`, puis par la plateforme (faux agent `fake-acp.js` inchangé, `nativeTools`) :
les deux lignes au Bilan, et Bilan sans sous-agent égal au caractère près au littéral d'avant
(`'Mission FICTIVE faite.\nActions natives de l’agent (hors outils de la plateforme) : 1 commande.'`, vérifié vert
aussi en retirant les deux lignes d'`index.js`).

## 4. Contrôles négatifs (changement retiré → test rouge, puis remis)

- observation retirée d'`index.js` → 1 rouge (par la plateforme) ;
- ligne de Bilan retirée → 1 rouge ;
- déclaration codex cassée → 3 rouges ; déclaration claude cassée → 3 rouges ;
- « dont » neutralisé → 2 rouges ;
- ligne toujours écrite (`'\n'` sans sous-agent) → 3 rouges dont le Bilan identique au caractère près.

## 5. Points ouverts

- Constaté : `/api/agents` expose désormais `nativeSubagents` avec le reste du profil (`publicAgents` retire seulement
  `command`, `args`, `cliPath`, `env`) ; aucune donnée sensible, `api-agents` vert.
- Le nom d'un sous-agent de forme activité est celui que l'agent a choisi ; il pourrait contenir un nom propre de la
  mission (nettoyé en caractères simples, 40 au plus). À décider : le garder ou ne dire que le nombre.
- Forme activité : les demandes d'autorisation `exec-…` orphelines (hypothèse forte : commandes des sous-agents) ne
  sont pas rattachées ; pas de « dont » pour cette forme. Un échec distinct d'une fin n'est pas observable.
- Non observé : sous-agent `run_in_background: true` (il serait dit « sans fin vue » si aucune fin n'arrive), Gemini,
  OpenCode (pas de déclaration).
- Les versions d'adaptateurs qui changeraient la forme feraient disparaître la ligne sans erreur (aucune décision n'en
  dépend).
