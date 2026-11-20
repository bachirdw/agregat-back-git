# Portage swarm-14 — Mesure du coût réel d'une équipe

Copieur, 21/11/2026 (horloge lue à 09:28). Base `e7f4964`. Swarm lu en lecture seule
(`/Users/diaw/Downloads/agent-repos-agregat/desplega-ai__agent-swarm`, ci-dessous `SW/`) ; adaptateurs lus en lecture seule
dans `node_modules/@agentclientprotocol/` de l'arbre (ci-dessous `NM/`). Rien n'a été exécuté de swarm ni des adaptateurs.

Fichiers du portage : `NOTES.md` (ce fichier) et `usage-swarm.js` (trois lectures pures, voir § 4).

## 1. Leçons de swarm citées par le plan (rubrique « À copier dans swarm »)

### 1.1 `SW/thoughts/taras/research/2026-08-06-task-vs-session-cost-mismatch-audit.md:12-45` — confirmé

Le passage cité existe (101 lignes au total). Les phrases utiles :

- l. 15 : « The two numbers are produced by two independent systems and are **never expected to agree** »
  → Le chiffre annoncé par l'agent et un chiffre recalculé ne sont jamais censés être égaux.
- l. 18 : « the API **discards the harness dollar figure** and recomputes `tokens × pricing-table rates` »
  → Leur serveur jette le coût annoncé par l'agent et le recalcule (jetons × tarifs) : c'est la source de l'écart.
- l. 26 : « **$4,246 under-reported (19.3%)** » → le recalcul sous-estime de 19,3 % sur leur échantillon.
- l. 44 : « The result event's `usage` covers only the main thread; `modelUsage` covers everything and
  `total_cost_usd == Σ modelUsage[*].costUSD` (verified). »
  → Le `usage` de fin de tour ne compte que la boucle principale ; les sous-agents internes n'y sont pas, alors que le coût
  annoncé les comprend.
- Hors des lignes citées, mais même leçon : l. 72 « `costSource='unpriced'` rows ($3,428, mostly claude-opus-4-7) keep the
  harness dollars (accurate!) » (le chiffre de l'agent gardé tel quel est le bon) ; l. 79 « **Persist both numbers.** »
  (garder les deux chiffres) ; l. 67 « accumulates `msg.cost`/tokens on every **finalized** `message.updated` event with no
  message-id dedup » (double compte d'un adaptateur qui additionne des événements répétés : ~2×).

Traduction pour Relay : ne rien recalculer (pas de tarif, pas de conversion), écrire « annoncé » ; le total de jetons du
Bilan ne comprend pas les sous-agents internes de l'agent, le coût annoncé si (voir § 2.1, même constat dans l'adaptateur
installé) ; additionner seulement ce qui est par tour, garder le dernier de ce qui est cumulé.

### 1.2 `SW/thoughts/taras/research/2026-04-09-codex-lead-ping-transcript.txt:1-45` — écart de lignes

Le fichier a 73 lignes. Les lignes 1-45 ne montrent que le déroulé du chef ; les chiffres qui portent la leçon sont plus bas :

- l. 29 et 36 : le chef attend par « `/bin/bash -lc 'sleep 3'` » puis « `sleep 6'` », entre des relectures répétées de la
  tâche (l. 24, 31, 38) et du salon (l. 26, 33, 40).
- l. 51 (chef) : « ◀ turn.completed  in=357142 cached=278912 out=2156 »
- l. 73 (membre) : « ◀ turn.completed  in=117877 cached=87808 out=919 »

Traduction : pour un travail trivial (poster « pong »), le chef qui attend et relit consomme environ trois fois les jetons
du membre (357 142 contre 117 877 en entrée). Le fichier ne contient aucune phrase qui l'énonce : c'est une lecture des
chiffres. D'où le compteur `attente { appels, ms }` du plan.

### 1.3 `SW/CHANGELOG.md:134` — confirmé

« Runner: a task that turns terminal mid-session gets a grace window (`RUNNER_TERMINAL_TASK_GRACE_MS`, 45s) to end its turn,
so its Claude cost is still recorded (#3179). »
→ Une tâche close avant la fin de sa session perdait son coût : on laisse le tour se terminer pour que le coût soit noté.

Traduction pour Relay : lire `runtime.usage()` après le dernier tour, et ne pas dépendre de la vie du processus
(`usageTotal` est un objet en mémoire du runtime, il survit à `close()`). Voir § 3.3 l'ordre exact.

## 2. Relevé exact des adaptateurs installés

Versions lues dans les `package.json` : `claude-agent-acp` 0.95.0, `codex-acp` 2.2.2, `sdk` 2.0.2.

### 2.1 `claude-agent-acp` 0.95.0 — `NM/claude-agent-acp/dist/acp-agent.js`

**Fin de tour (`PromptResponse.usage`) — PAR TOUR.**
- Forme, `sessionUsage()` l. 9245-9253 : `{ inputTokens, outputTokens, cachedReadTokens, cachedWriteTokens, totalTokens }`,
  `totalTokens = tallyTotal(...)` = somme des quatre (l. 9421-9424 : « Per the Anthropic API `inputTokens` excludes the cache
  counters, so this is not double-counting »). Rendue par `turnOutcome()` l. 9259-9265 et sur annulation l. 1245.
- Preuve du « par tour » : `resetTurnScratch()` l. 2958-2986, appelée à l'activation de chaque tour (l. 3028) :
  `session.accumulatedUsage = session.activeTurn?.carriedUsage ?? { inputTokens: 0, outputTokens: 0, cachedReadTokens: 0, cachedWriteTokens: 0 };`
  Le compteur repart de zéro à chaque tour. Ajout l. 5004-5009 (`accumulatedUsage.inputTokens += message.usage.input_tokens`
  …), seulement pour un résultat non autonome (commentaire l. 4998-5003 : un résultat autonome « would leak those tokens into
  that turn's PromptResponse.usage »).
- Seule reprise d'un compte d'avant : `carriedUsage`, posé par `clear-context-coordinator.js:53`
  (`turn.carriedUsage = { ...oldSession.accumulatedUsage }`) quand l'adaptateur redémarre sa session au milieu d'un tour
  (effacement du contexte) : c'est le compte du MÊME tour qui est reporté, pas un cumul de session.
- Portée : la boucle principale seulement. Commentaire l. 9311-9320 : « `token_count` mirrors the response's own `usage`,
  which the SDK reports for the MAIN AGENT LOOP only. The `model_usage` rows come from `result.modelUsage`, which also counts
  Task subagents… ». La version complète par modèle est dans `response._meta.quota.model_usage` (non demandée par le plan).

**Événement `usage_update` — `used`/`size` = occupation du contexte, `cost` = CUMULÉ sur la session.**
- Avec coût, sur chaque `result` : l. 5061-5079 : `{ sessionUpdate: "usage_update", used: lastAssistantTotalUsage, size:
  session.contextWindowSize, cost: { amount: message.total_cost_usd, currency: "USD" }, _meta? }` (seulement si
  `lastAssistantTotalUsage !== null`).
- Sans coût : pendant le flux l. 5565-5576, après compaction l. 4187-4197 (`used` = jetons après compaction), sur
  `rate_limit_event` l. 6085-6094 (avec `_meta["_claude/rateLimit"]`).
- `cost` cumulé : le schéma du SDK le dit (`NM/sdk/dist/v1/schema/types.gen.d.ts:2692` « Total cumulative cost for
  session. », l. 2723 « Cumulative session cost (optional). ») ; swarm l'écrit aussi (`SW/src/providers/acp-swarm-events.ts:125-127`) ;
  dans l'adaptateur, c'est `message.total_cost_usd` du SDK, et le commentaire l. 5015 dit que `modelUsage` est « a running
  total for the whole query() call ». Pas de calcul visible dans l'adaptateur qui le prouve davantage.
- Un `usage_update` sans `cost` (flux, compaction, limite) ne doit PAS effacer le dernier coût gardé.

### 2.2 `codex-acp` 2.2.2 — `NM/codex-acp/dist/index.js`

**Fin de tour : `buildPromptUsage()` l. 45382-45385 — PAR TOUR (par prompt).**
```js
buildPromptUsage(sessionState) {
  const usage = sessionState.promptTokenUsage?.usage() ?? null;
  return usage === null ? null : toPromptUsage(usage);
}
```
- Forme, `toPromptUsage()` l. 27945-27954 : `{ totalTokens, inputTokens, cachedReadTokens, cachedWriteTokens, outputTokens,
  thoughtTokens }`. `inputTokens` est déjà sans le cache (`toTokenCount()` l. 27935-27944 :
  `Math.max(0, usage.inputTokens - usage.cachedInputTokens - usage.cacheWriteInputTokens)`), `totalTokens` est celui de Codex
  (cache compris). Peut valoir `null` (Codex n'a rien rapporté).
- Preuve du « par tour » : `beginPromptTokenUsage()` l. 45377-45381 crée à chaque prompt
  `new PromptTokenUsage(startTotal)` avec `startTotal = sessionState.totalTokenUsage` (total du fil AU DÉBUT du prompt) ; elle
  est appelée à chaque prompt (l. 45023, et l. 44926 pour une commande). `PromptTokenUsage.usage()` l. 28011-28019 rend
  `latest − start` (`combine(latest, start, (x, y) => x - y)`), ou, si le total a reculé ou si le départ est inconnu, la somme
  des `last` observés pendant ce prompt (`summedLast`, l. 28006). Dans les deux cas : la part du prompt, pas le cumul.
  Rendu en fin de tour l. 45207, sur commande l. 44998, sur annulation l. 45347, sur échec terminal l. 45358.
- Portée : `handleTokenUsageUpdated` (l. 31913-31918) n'est appelé que pour le fil de la session ; les sous-agents natifs
  ne sont pas comptés dans `promptTokenUsage`.

**Événement : `createUsageUpdate()` l. 31919-31940 — `{ sessionUpdate: "usage_update", used, size }`, jamais de `cost`.**
- Fil principal : `used = lastTokenUsage.totalTokens` (dernière requête), `size = modelContextWindow`.
- Piège : un fil de sous-agent natif publie AUSSI un `usage_update` sur la même session, avec `used = params.tokenUsage.last.totalTokens`
  du sous-agent et sa fenêtre (l. 31926-31928). « Garder le dernier `{ used, size }` » peut donc montrer le contexte d'un
  sous-agent. Rien dans l'événement ne les distingue.
- Rien n'est publié si `used`, `size` manquent ou si `size <= 0` (l. 31932).

### 2.3 Schéma du SDK (`NM/sdk/dist/v1/unstable/schema/zod.gen.js`)
- `zUsage` l. 1349-1357 : `totalTokens`, `inputTokens`, `outputTokens` obligatoires ; `thoughtTokens`, `cachedReadTokens`,
  `cachedWriteTokens` facultatifs (nullish). `zPromptResponse.usage` l. 1365 : nullish (champ « UNSTABLE »).
- `zUsageUpdate` (`dist/v1/schema/zod.gen.js:1317-1322`) : `used`, `size` obligatoires, `cost` nullish ; `zCost` l. 1309-1313 :
  `{ amount, currency }`.

### 2.4 Conclusion pour le double compte
Les deux adaptateurs installés rendent un `usage` PAR TOUR : l'additionner tour après tour est juste. Le `cost` (Claude
seulement) est CUMULÉ : garder le dernier, ne jamais l'additionner. `used`/`size` est une occupation : garder le dernier.

### 2.5 Non vérifié
- Gemini, OpenCode : aucun adaptateur installé sous `NM/` ; rien n'a été cherché ailleurs.
- `total_cost_usd` cumulé : établi par le schéma ACP et par swarm, pas par un calcul visible dans l'adaptateur.
- Comportement réel (aucun CLI lancé) : tout ce qui précède est lu dans le code.

## 3. Ce que le codeur doit savoir

### 3.1 Signatures voulues par le plan (`packages/agent-runtime/usage.js`)
- `createUsage()` → objet de cumul neuf (par exemple `{ tours: 0, entree: 0, sortie: 0, total: 0, jetonsVus: false,
  cout: null, contexte: null }` ; la forme interne est libre).
- `addPromptUsage(u, response)` : ajoute `response.usage` d'un tour ; forme inconnue ignorée.
- `addUpdate(u, update)` : garde le dernier `cost` et le dernier `{ used, size }`.
- `publicUsage(u)` → `{ tours, jetons: { entree, sortie, total } | null, cout: { montant, devise } | null, contexte: { utilise,
  taille } | null }` (plan 3.2), ou `null` en entier quand l'agent n'a rien annoncé (« non annoncé »).

### 3.2 Cas limites
- `response` ou `response.usage` absent, `null`, non objet, tableau, ou sans `inputTokens` ni `outputTokens` finis : ignoré
  (codex rend `usage: null` quand Codex n'a rien rapporté).
- Champ non fini (`NaN`, `Infinity`), négatif, chaîne : tenu pour absent ; ne jamais produire `NaN` dans le Bilan.
- `totalTokens` absent : décider `entree + sortie` (+ caches s'ils sont là) ou `total` non annoncé ; les deux adaptateurs le
  rendent, et il compte le cache (les nombres sont donc grands : 357 142 dans la trace de swarm).
- `tours` : à décider s'il compte tous les tours ou seulement ceux qui ont annoncé un `usage`. Un tour sans `usage` ne doit
  pas rendre `jetons` non nul.
- `addUpdate` : `update.sessionUpdate !== 'usage_update'` → rien ; `cost` absent → garder l'ancien ; `cost.amount` non fini
  ou négatif → ignoré ; devise : swarm ne garde que l'USD (voir `coutAnnonce`), le plan dit `{ montant, devise }` : au codeur
  de garder la règle de swarm ou toute devise (dans ce cas, ne jamais additionner deux devises).
- `used`/`size` : `size <= 0` → ignoré (règle de codex-acp et de swarm).
- Ne jamais lever : ces fonctions sont appelées dans `handleUpdate()` et dans `prompt()`.
- Annulation : les deux adaptateurs rendent aussi un `usage` sur `stopReason: "cancelled"` ; si `request()` rejette
  (délai, arrêt), il n'y a pas de réponse : rien à ajouter.

### 3.3 Endroits de Relay, repérés par nom et texte (lignes constatées sur `e7f4964`)
- `packages/agent-runtime/index.js`
  - `async prompt(text, signal)` (l. 434-449) : `return await this.request(methods.agent.session.prompt, …)` dans un `try`,
    `finally { this.promptActive = false; this.ready = false; }` → garder la réponse dans une variable, `addPromptUsage(this.usageTotal, response)`, la rendre.
    Le même runtime sert plusieurs tours (`continueSession()` l. 452, tours de synthèse et de verdict du chef) : le cumul
    sur le runtime est le cumul de l'exécution.
  - `handleUpdate(update)` (l. 160-174) : `if (this.stopped) return;` puis le contrôle des modes, puis
    `if (this.promptActive) this.deliverEvent(...)` → la ligne `usage_update` se place avant ce filtre. Attention : elle doit
    aussi se placer après `if (this.stopped) return;` ou avant, à décider (un coût publié après `close()` est perdu sinon).
  - `this.usageTotal = createUsage()` à créer dans le constructeur (l. 72-…), méthode neuve `usage()` → `publicUsage(this.usageTotal)`.
  - Aujourd'hui `usage_update` n'est lu nulle part dans `packages/` ni `apps/` (recherche faite) : il part tel quel vers `onEvent` pendant un tour.
- `packages/orchestrator/index.js` : bloc `} finally {` de l'exécution (l. 2320, celui qui fait `this.timers.clearTimeout(timer);
  clearSilence(); toolGuard.clear();` … `control.runtime?.close();` … `this.active.delete(run.id);`). La ligne du plan
  `const usage = control.runtime?.usage?.(); if (usage) this.store.event(run.id, 'usage', usage);` peut aller en tête du
  bloc. Le runtime est créé une fois par exécution (`const runtime = new AcpRuntime({` l. 1556, `control.runtime = runtime;`
  l. 1660) ; `runtime.session(...)` peut être appelé deux fois si la reprise échoue (l. 1669 puis 1680), sur le même runtime.
- `packages/orchestrator/delegation.js`
  - `ended(child, state)` (l. 712-756) : lit `const control = this.engine.active.get(child.id);`, écrit
    `this.finals.set(child.id, { envois, fichiers, ...(echec ? { echec } : {}) });` puis
    `this.store.event(child.famille.mere, 'child_done', { childId, state, envois, … })`. Il est appelé par `watch()` (l. 814) dès
    l'événement `state` terminal, AVANT le `finally` du moteur : `control` et `control.runtime` y sont encore là ; le dernier
    tour du membre est fini à ce moment.
  - `doneOf(child)` (l. 605-620) : rend `this.finals.get(child.id)` sinon relit `child_done` en base (`envois`, `fichiers`,
    `echec`) → y ajouter `usage` de `done?.data?.usage` pour la relecture après redémarrage.
  - `wait(mother, control, { ids, toutes, delaiSecondes }, signal)` (l. 1848-1914) : `const family = this.family(mother.id);`
    puis `family.waiting = (family.waiting ?? 0) + 1;` et l'attente `untilOr(...)` dans un `try/finally`. Seulement quand on
    attend vraiment (`if (running.length && !done())`). À décider : compter chaque appel (le plan : « augmenté à chaque
    appel ») ou seulement ceux qui attendent. Horloge : `this.now` existe (l. 166, injectée par les tests, swarm-08).
    Attention : `family` est en mémoire et `forget(family)` (l. 910-922) la supprime quand mère et membres sont finis ;
    `familyBilan()` est appelé avant (Bilan à la fin du tour du chef, l. 2183 de `index.js`).
  - `familyBilan(run, { chiefAnswer, motherSends })` (l. 530-576) : construit `children: children.map((child) => ({ id, titre,
    agent, modele, state, durationMs, bilan, envois, … }))` passé à `familySection({ accord, synthese, chiefAnswer, motherSends,
    children })` → `usage: this.doneOf(child).usage` par enfant, et `chef: { agent, usage: this.engine.active.get(run.id)?.runtime?.usage?.(), attente }`.
    `familyBilan` est appelé depuis `bilanSection()` (l. 510-529) dans le tour du chef et depuis `failureSection()` (l. 588) :
    dans les deux cas le chef est encore dans `engine.active`.
- `packages/orchestrator/family-bilan.js`, `familySection({ children, chiefAnswer, motherSends, accord, synthese })` (l. 75-136) :
  la ligne `Consommation : ${children.length} sous-mission(s), ${formatDuration(total)} de durée des sous-missions Relay (…).`
  (l. 128-133) est la dernière ligne. `formatDuration()` l. 24-33 donne « 9 min 20 s ». Les nombres du plan sont écrits
  « 412 000 » et « 1,84 USD » (séparateur de milliers et virgule française) : aucun formateur de ce genre n'existe dans le
  fichier.
- `packages/orchestrator/team-view.js` (swarm-07)
  - Lecture : `fixedFields()` l. 88-91 : `if (done) { const usage = quiet(() => delegation.doneOf(child)?.usage); if (usage !== undefined && usage !== null) fields.usage = usage; }`
    (seulement pour un membre fini) ; `memberView()` l. 108-122 le recopie tel quel (`...(usage !== undefined ? { usage } : {})`).
  - Mémoire : `memories` (WeakMap par délégation, l. 12-22, au plus `MAX_KEPT = 2000` entrées, les plus anciennes partent).
    Une entrée finie n'est recalculée que si `mark` (`state`, `startedAt`, `finishedAt`) change (l. 110-113) ; jamais au bout de
    `LIVE_MS`. Elle n'est jamais vidée par `forget()`. Donc : si `memberView` lit un membre déjà terminal AVANT que `ended()`
    ait rempli `finals`, l'absence de `usage` reste en mémoire. Comme `ended()` est appelé de façon synchrone sur l'événement
    `state` terminal, ce cas dépend de l'ordre des écouteurs du store : à vérifier par le codeur ou à couvrir par un test.

## 4. Fidélité à swarm : code repris (`usage-swarm.js`)

Swarm a du code directement utile, dans son adaptateur ACP générique :
- `coutAnnonce(update)` ← `SW/src/providers/acp-swarm-events.ts:124-136` (`acpReportedCostUsd`) : coût d'un `usage_update`,
  USD seulement, montant fini et ≥ 0 ; commentaire d'origine gardé (cumulé : garder le dernier). Swarm le garde dans
  `SwarmAcpClient.sessionUpdate` (`SW/src/providers/acp-adapter.ts:194-196` : `if (costUsd !== null) this.reportedCostUsd = costUsd;`) —
  c'est la règle « garder le dernier » du plan.
- `contexteAnnonce(update)` ← `SW/src/providers/acp-swarm-events.ts:98-108` (cas `usage_update` : `used`, `size`, part
  seulement si `size > 0`).
- `jetonsDuTour(usage)` ← `SW/src/providers/acp-adapter.ts:413-437` (`buildCostData`, partie jetons : `inputTokens`,
  `outputTokens`, `cachedReadTokens ?? undefined`, `cachedWriteTokens ?? undefined`).
- Écarté : la somme. Swarm n'additionne rien : `acp-adapter.ts:423-424` « A swarm session sends one prompt, so the target's
  cumulative session cost is the task's total. » (une session = un prompt, `numTurns: 1`). Relay envoie plusieurs tours par
  runtime : le cumul des jetons par tour est à écrire par le codeur (`addPromptUsage`). Écartés aussi : `durationMs`,
  `provider`, `target.promptCost` (coût par cible), toute la tarification (`pricing`, `session_costs`) — contraire au plan.
- Ajouts Relay dans `jetonsDuTour` (pas chez swarm) : champs non finis ou négatifs tenus pour absents, forme sans entrée ni
  sortie → `null`, `totalTokens` lu.
- Vérifié : `node --check` et un essai par `node --input-type=module -e` sur le fichier porté (coût USD gardé, `-1`, `NaN`,
  `EUR` et absence → `null` ; `size: 0` → `null` ; `usage` vide, `null`, `Infinity`/négatif → `null`).
