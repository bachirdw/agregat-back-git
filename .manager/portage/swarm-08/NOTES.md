# swarm-08 — Portage depuis swarm : liste d'agents fidèle, refus et repli au lancement

Copieur, 21/11/2026 vers 02:05 (horloge lue par `date`). Base `391f027`. Portage demandé : ce `NOTES.md`
seulement (formes et messages) ; aucun `.js` porté (la logique d'état vient de swarm-02, déjà intégré).

Origine : `/Users/diaw/Downloads/agent-repos-agregat/desplega-ai__agent-swarm` (licence MIT, © desplega.sh), lu en
lecture seule. Abréviations : `DJ` = `packages/orchestrator/delegation.js`, `DR` = `delegation-rule.js`,
`RO` = `roles.js`, `CO` = `continuation.js`, `DOC` = `docs/api-delegation.md`.

## 1. Passages d'origine (confirmés) et traduction

### 1.1 `src/tools/get-swarm.ts` — une ligne par agent avec son état

Lignes confirmées : 67-91 (le plan dit 66-90 : décalage d'une ligne, même passage). Commentaire du piège, l. 68-69 :

> "A pool agent without a live runtime reports "offline", but a task sent to it starts a runtime. Mark it, so a Lead
> does not read it as unavailable."

Traduction : « Un agent sans exécution vivante se dit "hors ligne", mais une tâche qu'on lui envoie le démarre.
Marquez-le, pour que le chef ne le lise pas comme indisponible. » → Leçon pour Relay : l'état montré au chef doit être
l'état **réel** (ni « indisponible » à tort, ni « disponible » à tort) ; c'est le cas 1 du lot (deux agents
`disponible: true` alors que l'un a une session refusée et l'autre une limite).

Ligne par agent, l. 80 : ``- ${a.name} (${a.status}${onDemand}${a.isLead ? ", lead" : ""}) — id: ${a.id}`` avec, l. 79,
`", on demand: send-task starts it"`. En-tête l. 85 : `Found ${agents.length} agent(s) in the swarm.`
Commentaire l. 75-76 : "Include the ID — send-task targets agents by ID" (« Mettre l'identifiant : l'envoi d'une tâche
vise l'agent par son identifiant »).

Forme portée (Relay rend du JSON, pas de texte) : une entrée par agent dans `mission_suivre.agents[]` :
`{ id, disponible, etat, raison?, jusqua?, simule?, modeles: [{ id, nom, limiteJusqua? }], modeleParDefaut }`, triée
agents prêts d'abord (ordre stable sinon). `id` = ce que le chef passe à `agent` (même rôle que « id: » de swarm).
Écarté : `name`, `isLead`, `onDemand` (sans équivalent dans Relay), le texte « Found n agent(s) ».

### 1.2 `runbooks/model-tiers.md` — message d'échec qui nomme le chemin essayé

Lignes confirmées : section « ### Fallbacks on provider errors » l. 148, puce « **No pick.** » l. 155 (les l. 156-160
sont la section suivante « Model groups », hors sujet). Phrase d'origine (l. 155) :

> "When a fallback was configured or a hop happened, `failureReason` leads with `rate_limit on claude-glm; no fallback
> left (tried: claude-glm → claude-regular → claude-smart)` and the skipped profiles."

Traduction : « Quand un repli était configuré ou qu'un saut a eu lieu, la cause d'échec commence par `<classe> sur
<profil> ; plus de repli (essayés : a → b → c)`, puis les profils écartés. » Code qui l'écrit :
`src/tasks/worker-follow-up.ts` l. 466 :
``message: `${errorClass} on ${current}; ${keysExhausted}no fallback left (tried: ${path.join(" → ")})${skippedText}` ``
et l. 461-463 : `skippedText = "; skipped: " + "<profil> (<raison>)"` joints par « , ».

Adaptation pour Relay (aucun nom d'agent ni de modèle dans le texte fixe ; les identifiants viennent des données) :
- Refus au lancement (`agent_indisponible`), forme du plan, mot pour mot :
  `'<agent> : <raison> ; agents prêts : a, b ; choisis-en un, ou malgreIndisponible: true si tu sais qu’il est revenu'`.
  `<raison>` = `raison` de `agentState` (« Limite d’usage jusqu’à HH:MM », « Session refusée (…) », « Dernier prompt
  refusé (…) ») : l'heure est déjà dans la raison d'une limite. Aucun agent prêt : le plan ne donne pas le texte
  (suggestion : « agents prêts : aucun »). Pour un modèle sous limite, `<raison>` à construire par le codeur (le plan
  ne la cite pas ; suggestion : `limitReason(jusqua)` précédé du modèle, ex. « modèle X : Limite d’usage jusqu’à
  HH:MM »).
- Repli (agent non nommé), `note`, mot pour mot du plan : « Agent prévu codex indisponible (limite d’usage jusqu’à
  23:27) : lancé sur claude. » → gabarit : `Agent prévu ${prevu} indisponible (${raison en minuscule initiale}) : lancé
  sur ${choisi}.` (les noms sont ici des données, pas du texte fixe).
- « tried: a → b → c » : Relay ne fait qu'un seul saut par lancement (le premier agent prêt) ; le chemin essayé se
  résume à `agentPrevu` → `agent` sur la ligne. La flèche « → » n'est pas reprise par le plan.

### 1.3 `src/tasks/worker-follow-up.ts` — `nextFallback` : jamais deux fois le même profil

Lignes : `nextFallback` commence l. 343 (confirmé) ; les l. 343-380 ne couvrent que le début (chemin et ensemble
`visited`) ; la règle de saut est l. 427-450 et le message final l. 456-467. Docstring l. 326-327 :

> "A profile the work already ran on is never picked again."

Traduction : « Un profil sur lequel le travail a déjà tourné n'est jamais repris. » Code l. 350-358 :
`profileHops = hops.filter(hop => hop.from !== hop.profile)` (« un nouvel essai sur une autre clé du même profil n'est
pas une étape de la chaîne », l. 349) ; `path = [premier from, ...profils sautés]`, plus le profil courant s'il n'y est
pas ; `visited = new Set(path)`. Boucle l. 427-429 : `if (visited.has(name) || judged.has(name)) continue;` (un
candidat déjà essayé ou déjà jugé est sauté). Docstring l. 329-331 : pas de plafond de sauts, car chaque saut ajoute
un profil à `visited` et le graphe est acyclique : la marche finit.

Règle portée pour Relay : au repli (agent non nommé), exclure l'agent prévu indisponible **et** les agents déjà
essayés pour cette tâche : pour une `reprend`, les agents des tentatives précédentes de la même tâche tombées sur une
limite ou une connexion refusée (chaîne `famille.reprend` / `famille.continue`, voir `taskOf()` dans `launch()`).
Le plan ne le demande pas explicitement (il dit « le premier agent prêt ») : un agent revenu prêt (limite passée)
peut redevenir candidat, ce qui est voulu (« la limite s'efface à l'heure dite »). À trancher par le codeur ou le
manager : `etat` recalculé suffit en pratique, car un agent tombé sur une limite a `etat: 'limite'` jusqu'à `jusqua`.
Écarté : clés, pools, groupes de modèles, `checkProfileForAgent`, `lead-only`, base de swarm.

## 2. Ce que le code intégré contient réellement (lecture seule, base 391f027)

### 2.1 Modules de swarm-02 (`packages/agent-runtime/`)
- `agent-state.js` exporte trois fonctions :
  - `agentState(agent, probe, { now = Date.now(), live = false } = {})` → `{ etat, raison?, jusqua?, modelesLimites? }`.
    Ordre : `agent.simulated` → `simule` (live) / `pret` (hors live) ; `!installed` → `non_installe` (« CLI non
    détecté ») ; `!compatible` → `adaptateur_absent` (`agent.reason` ou « Adaptateur ACP absent ») ; `!live` →
    `mode_reel_eteint` ; `probe.limite.jusqua` à venir → `limite` (raison `limitReason`, `jusqua`) ; `session === false`
    ou `inference === false` → `connexion_refusee` si refus de moins de `PROBE_TTL_MS` (10 min), sinon `a_reessayer`
    (raison « Session refusée (…) » / « Dernier prompt refusé (…) », **pas de `jusqua`**) ; sinon `pret`.
    `modelesLimites` = `{ <id modèle>: <jusqua ISO> }` des limites de modèle à venir, absent sinon. Valeurs de `etat` :
    `simule`, `pret`, `non_installe`, `adaptateur_absent`, `mode_reel_eteint`, `limite`, `connexion_refusee`,
    `a_reessayer`. Lecture seule ; ne lève pas sur `probe` absent.
  - `noteFailure(dataDir, agentId, { message, announcement, rateLimit, models, model, cancelled, simulated, now })` →
    `null` ou `classifyFailure(...)` = `{ classe, modele?, jusqua, source }` ; `classe` ∈ `limite`, `limite_modele`,
    `credits`, `connexion`, `surcharge`, `serveur` ; `jusqua` = `null` pour les trois dernières.
  - `clearLimit(dataDir, agentId, modele)`.
- `probes.js` : `loadProbes(dataDir)` → objet `{ <agentId>: probe }` (synchrone, `{}` si absent ou illisible),
  ré-exporté par `agent-runtime/index.js` (c'est cet import qu'emploie `DJ`). `agent-state.js` n'est **pas** ré-exporté
  par `index.js` : importer `../agent-runtime/agent-state.js` directement (comme `IX` et `apps/api/server.js`).
- `limits.js` : `limitReason(jusqua)` → « Limite d’usage jusqu’à HH:MM » (heure locale `fr-FR`), « Limite d’usage »
  si date invalide.
- Appels existants : `agentState` dans `apps/api/server.js` (`publicAgents`, l. ~80) seulement ; `noteFailure` /
  `clearLimit` dans `IX` (l. ~2251 et ~1779) et `workflow-run.js` ; `router.js` (`chooseAgent`) écarte une limite à venir.

### 2.2 `control.echecAgent`
Posé dans `IX` (bloc `catch` de l'exécution, ~l. 2251) : `control.echecAgent = noteFailure(...)`, sur le `control` de
la sous-mission elle-même. Il est posé **avant** `this.store.update(run.id, { state: 'failed' | 'cancelled' })`, et
`this.active.delete(run.id)` vient dans le `finally`, après. `DJ.ended(child, state)` lit déjà
`const control = this.engine.active.get(child.id)` et est appelé par l'écouteur de `watch()` sur l'événement d'état
terminal : `control.echecAgent` y est donc lisible, car `store.update` (`packages/storage/index.js`) appelle
`this.event(id, 'state', …)` puis `this.emit(id, event)` de façon synchrone (lu dans le code, non lancé : à prouver
par un test du lot). Il vaut `null` pour une annulation, un agent
simulé, ou une erreur non classée. **Écart** : le plan dit « `control.echecAgent` (posé par swarm-02) » mais `DJ` ne
le lit nulle part aujourd'hui ; le nom est bien `echecAgent`. Une réussite ne passe pas par ce `catch` (pas de champ).

### 2.3 `DJ` — endroits nommés (par le nom, les numéros ont bougé)
- Constructeur : `this.agentsCache = null;` ; `AGENTS_CACHE_MS = 60000` (constante en tête).
- `async agents()` (~l. 1447) : remplit `agentsCache = { at, list }` par `await detectAgents()` ; `list` ne garde
  aujourd'hui que `{ id, disponible, simule? }` avec `disponible = installed && compatible && (simulated ? !live :
  live)`. **Écart avec le plan** : la détection brute (`installed`, `compatible`, `simulated`, `reason`) n'est pas
  gardée ; c'est à changer. Puis, à chaque appel : `loadProbes`, ajout de `modeles: [{ id, nom }]` (depuis
  `probes[id].models.options`) et `modeleParDefaut` (`probes[id].models.current ?? null`).
  Correspondance proposée pour garder `disponible` sans casser `otherAgent` ni le test « agent simulé indisponible en
  mode réel » (`tests/equipe-01-roles.test.js`) : `disponible = etat === 'pret' || etat === 'a_reessayer'` (identique à
  aujourd'hui pour tous les cas sans sonde ; `false` désormais pour `limite` et `connexion_refusee`). `limiteJusqua`
  d'un modèle = `modelesLimites[model.id]`.
- `follow()` : `agents: await this.agents()` (c'est `mission_suivre.agents`).
- `launch(mother, control, args)` (~l. 891), dans l'ordre réel :
  1. `team = args.role ? this.roleOf(...)` ; `installed = team?.autreAgent && !args.agent ? await this.agents() : null`
     (le **seul** `await` avant les compteurs ; il remplit le cache dans ce cas) ; recontrôle `mission_terminee`.
  2. `family`, `root`, `refus_proprietaire`, `envelope(root)`, `consigne`, `children`, `launched`, ids de
     `apres`/`relit`/`reprend`/`continue` (`introuvable`), `previous`, contrôle `reprend` (`parametres_invalides`).
  3. **Contrôle de doublon (swarm-05)** : `const part = partDe(args, args.agent ?? mother.agent);` … `if
     (double?.niveau === 'identique' && args.doublon !== true && this.doublon === 'refuse') throw fail('doublon', …)`.
     → emplacement du contrôle (1) « agent nommé » : juste après ce `throw`.
  4. `taskOf`, `family.resuming`, `reprise_en_cours`, `reprise`, `free`, `counted`, puis **contrôle d'enveloppe** :
     `if (!free && counted >= total) { … enveloppe_refusee / enveloppe_atteinte … }` (zone des compteurs : n'y rien
     écrire).
  5. `fichiers` (`fichier_hors_espace`).
  6. **Choix de l'agent** : `const base = previous ?? mother;` ; `reviewer = installed ? otherAgent(installed,
     authors, { live: this.engine.live, probes: loadProbes(this.engine.dataDir) }) : null;` ;
     `const agent = args.agent ?? reviewer ?? base.agent;` ;
     `const modele = args.modele ?? (agent === base.agent ? (base.model ?? '') : '');` → emplacement du contrôle (2).
     Note : `agent` et `modele` sont des `const` ; le repli doit les calculer avant (ou passer en `let`).
  7. `named`, `titre`, `folder = … this.resultsFolder(...)` (crée le dossier : le refus (2) doit venir avant), `tache`,
     `link` (`link.link` = `famille` de la ligne : y mettre `agentPrevu` / `agentImpose`), consentement,
     `control.mere = true`, `estMere`, puis **`family.pending++;`**, `this.creating(...)` (swarm-05), compteurs.
  8. `engine.create({ prompt, agent, model: modele, … })` ; dans le `catch`, un `agent_indisponible` existe déjà :
     `if (error?.issues || /Agent non détecté|Adaptateur|Mode réel désactivé|Agent réel/.test(message)) throw
     fail('agent_indisponible', message);` (message de l'engine, sans liste d'agents prêts).
  9. Résultat : `{ id, titre, etat, agent, modele, dossierResultats?, espace?, famille, doublonProbable?, ...note([
     CONSENT_PENDING_NOTE, SAME_AGENT_NOTE, doublonNote ]) }` — la phrase de repli s'ajoute à ce tableau `note([...])`.
- `ended(child, state)` (~l. 581) : `this.finals.set(child.id, { envois, fichiers })` et
  `this.store.event(child.famille.mere, 'child_done', { childId, state, envois, ...(workspace ? {} : { fichiers }) })`.
  `doneOf(child)` relit `finals`, sinon l'événement `child_done` (après redémarrage) : pour garder `echec` après un
  redémarrage, `doneOf` doit aussi rendre `done?.data?.echec` (non nommé par le plan).
- `outcome(child)` (~l. 1423) : `cause = null` si `completed`, sinon `{ type: /Limite d’usage/ ? 'limite_usage' :
  'erreur', agent, reprise: (match « réessayer à … »), message }` → `classe`, `jusqua`, `agentsPrets` à ajouter
  (champs absents quand on ne s'en sert pas). `outcome` est synchrone et sert aussi à `precedentOf` (`CO`) et au tour
  de synthèse : `agentsPrets` doit se lire sans `await` (cache + `loadProbes`).
- `membersOf(run, mother)` (~l. 1229, swarm-05) : lignes `{ id, titre, role?, agent, etat, texte?, creeLe,
  dernierSigneLe }` passées à `membres(...)` ; non touché par ce lot (l'`etat` y est l'état de la sous-mission, pas de
  l'agent).
- `line(child)` (~l. 1390) : `{ id, titre, agent, modele, etat, depuis, … }` lit `child.famille` pour `pourquoi`/`motif`
  : `agentPrevu` / `agentImpose` écrits dans `link.link` y seront relisibles si le codeur les y ajoute.

### 2.4 `otherAgent` (`RO`, ~l. 158)
`otherAgent(agents, authors, { live = false, probes = {} } = {})` : garde `agent?.disponible && !used.has(id)` ; hors
live, le premier ; en live, exclut `simule` et `probes[id].session === false`, préfère `session === true`, sinon le
premier. Lit seulement `id`, `disponible`, `simule` de `delegation.agents` : marche sans changement si `disponible`
devient faux pour `limite` / `connexion_refusee` (cas 5 du lot). Il peut servir tel quel au repli (2) :
`otherAgent(liste, [agentPrévu, …déjà essayés], { live, probes })` donne exactement « premier prêt, jamais simulé en
live, session prouvée d'abord ».

### 2.5 `DR` (`delegation-rule.js`)
- `CHIEF_METHOD` : `export const CHIEF_METHOD = '… pour chaque sous-mission, choisis l’agent et le modèle selon la
  difficulté de la partie (…), parmi ceux que donne mission_suivre, et suis ce que la demande du propriétaire en dit ; …'`
  (constante d'une ligne ; `CHIEF_RULE = CHIEF_INTRO + DECISION_RULE + CHIEF_METHOD`). Phrase à ajouter, mot pour mot :
  « mission_suivre donne l’état réel de chaque agent (etat, raison, jusqua) : ne choisis qu’un agent prêt » (le style
  de la constante finit chaque clause par « ; »).
- `MISSION_TOOLS.mission_lancer.schema` : `.strict()` ; `agent: z.string().trim().min(1).max(40).optional()`, …,
  `doublon: z.boolean().optional()` en dernier → ajouter `malgreIndisponible: z.boolean().optional()`.
- `MISSION_TOOLS.mission_continuer.schema` : `{ id, message, agent?, modele? }`, `.strict()` → même ajout. Sans cet
  ajout, `.strict()` rejette le champ.
- Les descriptions de `mission_lancer` / `mission_suivre` parlent d'« agents installés » ; le plan ne demande pas de
  les changer.

### 2.6 `CO` (`continuation.js`) — `continueChild(delegation, mother, control, args)`
- Sous-mission en cours : `args.agent !== undefined || args.modele !== undefined` → `parametres_invalides` ; puis
  `engine.message`. Le levier `malgreIndisponible` n'y a pas de sens : ne pas le rejeter (à décider : l'ignorer).
- Sous-mission finie : `delegation.launch(mother, control, { consigne: args.message, continue: child.id, agent:
  args.agent ?? child.agent, modele…, role…, fichiers…, ...brief.tache })` → ajouter `malgreIndisponible`.
- **Écart** : `agent` est **toujours** rempli pour une suite (`args.agent ?? child.agent`) ; `launch()` ne peut donc
  pas savoir si le chef l'a nommé. Une suite sans agent nommé vers un agent sous limite tombera dans le refus (1), pas
  dans le repli (2), et portera `agentImpose: true` à tort. Pour suivre le plan (c), il faut que `CO` dise à `launch()`
  que l'agent vient de la tentative précédente (ex. passer `agent` seulement quand `args.agent` est donné, la
  tentative précédente fournissant l'agent via `base = previous`). Le plan ne nomme que `malgreIndisponible` pour `CO`
  : à trancher.

### 2.7 Docs
- `docs/api-delegation.md` : tableau des outils, ligne `mission_suivre` (`agents: [{ id, disponible, modeles: [{ id,
  nom }], modeleParDefaut }]`) ; ligne « Erreurs : … `agent_indisponible`, … » (sans détail) ; puce `terminees[]` :
  « `cause` d'un échec : `{ type: "limite_usage"|"erreur", agent, reprise, message }` » ; section 3.1 « Regard
  indépendant » et « Agent simulé dans `agents` » ; section 9 « Compléments du chantier swarm » (9.1 swarm-01 … 9.5
  swarm-05) → une 9.8 swarm-08 à ajouter.
- `docs/api-agents-etat.md` (swarm-02) : sections `classifyFailure`, fichier des sondes, `noteFailure`, `clearLimit`,
  « États : `agentState` », « Mode Auto » → ajouter « ce que voit le chef » (`mission_suivre.agents`, refus, repli,
  `cause`).

## 3. Écarts entre le plan et le code (à lire par le codeur)

1. `agentsCache.list` ne garde pas `installed`, `compatible`, `simulated`, `reason` : à garder (le plan le demande).
2. `control.echecAgent` existe (IX) mais n'est lu nulle part dans `DJ` ; `doneOf()` doit aussi rendre `echec` relu de
   `child_done` pour la vie après redémarrage (non nommé par le plan).
3. Cache vide : le contrôle est synchrone et ne lit que `agentsCache` ; il est `null` tant que `agents()` n'a pas été
   appelé (aucun `mission_suivre`, aucun rôle `autreAgent`) et des tests remplacent `delegation.agents = async () =>
   …` (`tests/equipe-01-roles.test.js` l. ~83, `tests/equipe-01-relecture.test.js` l. ~349) **sans** remplir le cache.
   Le plan dit pour (2) « si le cache est vide, même refus » : appliqué à la lettre à tout lancement sans agent nommé,
   cela refuserait presque tous les lancements des tests existants. Lecture sûre : ne refuser que si l'agent prévu est
   **constaté** indisponible ; cache vide → juger l'agent prévu par ses seules sondes (`loadProbes`, pseudo-agent
   `{ installed: true, compatible: true }` en live) et, s'il est indisponible, refuser faute de remplaçant connu. De
   même pour (1) : un agent nommé absent du cache n'est pas refusé par ce contrôle (l'engine rend déjà
   `agent_indisponible` / `Agent inconnu`).
4. Le contrôle (2) vient après le contrôle d'enveloppe et `fichiers` (c'est là que `agent` est choisi) : un lancement
   non nommé à l'enveloppe pleine rend `enveloppe_atteinte` avant `agent_indisponible`. Il reste avant
   `resultsFolder()` et `family.pending++` (aucun dossier, aucun compteur).
5. Doublon (swarm-05) : `partDe(args, args.agent ?? mother.agent)` est calculé avant le choix de l'agent ; en repli,
   la part enregistrée par `this.creating(family, part, …)` porte l'agent prévu, pas l'agent lancé. Sans effet sur un
   refus, mais une comparaison ultérieure « même agent » peut être faussée. À signaler, pas à corriger dans ce lot
   (zone swarm-05).
6. `mission_continuer` remplit toujours `agent` (voir 2.6) : repli impossible pour une suite sans changement de `CO`.
7. `connexion_refusee` n'a pas de `jusqua` : le refus ne peut dire « l'heure » que pour une limite.
8. Modèle sous limite (`modelesLimites[modele]`) : le plan le compte comme indisponible ; pour un agent non nommé, le
   repli change d'agent et `modele` retombe à `''` (règle actuelle `agent === base.agent ? base.model : ''`).
9. `a_reessayer` ne bloque pas (cas 4) : `disponible: true`, mais il n'est pas « prêt » au sens strict ; pour le tri
   « prêts en tête » et la liste « agents prêts », décider si `a_reessayer` compte (suggestion : oui après `pret`).

## 4. Non vérifié
- `control.echecAgent` lisible dans `ended()` : déduit de la lecture (émission synchrone dans `store.update`), non
  lancé.
- Rien n'a été exécuté (ni Relay, ni swarm) ; aucun `.js` porté, donc aucun `node --check`.
