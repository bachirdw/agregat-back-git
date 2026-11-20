# swarm-16 — Portage depuis swarm : niveaux de modèle par rôle (notes du copieur)

Copieur, 21/11/2026 (heure lue : 09:45 AEDT au début). Arbre `agregat-back-swarm-16`, base `e7f4964`.
Swarm lu en lecture seule dans `/Users/diaw/Downloads/agent-repos-agregat/desplega-ai__agent-swarm` ; rien n'en a été
exécuté. Seul fichier porté : `niveaux.js` (vérifié par `node --check` et un court essai `node --input-type=module`).

## 1. Ce qui est copié

| Origine (swarm) | Lignes lues | Porté dans `niveaux.js` |
| --- | --- | --- |
| `src/types.ts` | 91-94 (`ModelTierSchema` : `smol`, `regular`, `smart`, `ultra` ; `MODEL_TIERS`) | `NIVEAUX = ['leger','standard','fort']` |
| `src/types.ts` | 210-216 (`parseModelTier` : `trim`, minuscules, sinon `undefined`) | `parseNiveau` (rend `null` ; accents retirés : « léger » → `leger`) |
| `src/types.ts` | 121-208 (`DEFAULT_MODEL_TIER_MAP`) | rien dans le code : table recopiée en section 5, point de départ des motifs |
| `src/be/model-tier-resolution.ts` | 8-23 (en-tête : ordre de priorité, « first hit wins ») et 352-371 (`taskModelCandidates`) | `choisirModele` : modèle donné, puis niveau, puis défaut (ordre de Relay en 1.1) |
| `src/be/model-tier-resolution.ts` | 496-508 (commentaire de `applyCliSupport`) et 386-432 (`resolveTaskModel`, `harnessMismatch` seulement pour `source === "model"`) | règle « un niveau qui ne se résout pas retombe sur le défaut ; un modèle donné ne retombe pas » |
| plan swarm-16 | — | `modelePour`, `niveauDe`, `avecNiveaux` (pour `agents()`), `niveauNonReconnu` (texte du plan) |

### 1.1 Ordre de priorité de `choisirModele` (celui du plan, adapté de swarm)

1. `modele` donné (toute chaîne, `''` compris) → `source: 'modele'`, jamais vérifié ici ;
2. `niveau` donné → son modèle, `source: 'niveau'` ;
3. `precedent` (modèle de la tentative précédente : reprise ou suite ; l'appelant ne le donne que si l'agent reste le même)
   → `source: 'precedent'` ;
4. `niveauRole` (niveau de la fiche du rôle) → son modèle, `source: 'role'` ;
5. `defaut` (la règle d'aujourd'hui, calculée par l'appelant) → `source: 'defaut'`.

Retour : `{ modele, source, niveau?, note? }`. `niveau` n'y est que s'il est connu (`niveauDe` du modèle choisi). Un niveau
(2 ou 4) qui ne se résout pas va directement à `defaut` avec `note: niveauNonReconnu(niveau)` =
« niveau fort non reconnu chez cet agent : modèle par défaut » (texte du plan).

### 1.2 Règles de résolution

- `modelePour(niveau, profil, modelesAnnonces)` : parcourt `modelesAnnonces` dans l'ordre de l'agent ; rend l'identifiant du
  premier dont l'identifiant contient (sans casse) un motif de ce niveau ET dont `niveauDe` est ce niveau ; sinon `null`.
  Entrées acceptées : chaînes ou objets `{ id, name }` (forme des sondes : `probe.models.options`).
- `niveauDe(modelId, profil)` : le niveau dont un motif est contenu dans l'identifiant ; si des motifs de plusieurs niveaux y
  sont, le plus long l'emporte (le plus précis), à longueur égale le premier de `NIVEAUX`. Ainsi `modelePour` et `niveauDe`
  ne se contredisent jamais (exemple vérifié : motifs `leger: ['flash-lite']`, `standard: ['flash']` → `…-flash-lite` est
  `leger`, pas `standard`).
- Jamais d'exception (essayé : `null`, nombres, tableaux, `niveaux` non objet, motifs non chaînes ou vides, `choisirModele(null)`,
  `choisirModele('x')`, identifiant de 100 000 caractères).

## 2. Ce qui est écarté, et pourquoi

- `ultra` : le plan veut trois niveaux ; `smart` et `ultra` de swarm vont tous deux à `fort` (section 5).
- `LEGACY_MODEL_TO_TIER` (`haiku→smol`, `sonnet→regular`, `opus→smart`, `fable→ultra`, types.ts:107-112) : ce sont des noms
  de modèles ; dans Relay ils ne peuvent être que des données de profil.
- Couches `worker-env` (`MODEL_TIER_*` de l'agent) et `tier-config` (`swarm_config`), profils et groupes de modèles
  (`profile`, `modelGroup`), alias `latest:` et catalogue (`@desplega/model-catalog`, prix, `soakDays`), écriture
  `model_alias_resolutions` (`getDbClient`), `console.warn`/`console.info` : Relay n'a ni base de catalogue ni ces couches ;
  la seule source de vérité est la liste des modèles annoncés par l'agent (sondes).
- `applyCliSupport` et `fallbackForUnsupportedModel` (repli vers un modèle « frère » quand le CLI refuse) : en Relay le
  contrôle « Modèle non annoncé » du moteur (`IX`) reste seul juge d'un modèle donné ; on n'en garde que la règle.
- `harnessMismatchReason` (erreur `[model-harness-mismatch]`) : pas de refus neuf (règle 4.0 : un garde-fou neuf signale).
- `async` : tout est synchrone et pur.
- `effort`, `allowCustomModel`, `profile`, `modelGroup` de `send-task.ts` : hors du lot.

## 3. Pièges lus dans leurs commentaires

- model-tier-resolution.ts:25 : une couche qui ne se résout à rien « falls through to the next layer ». Le plan de Relay dit
  autre chose pour un niveau : retour direct à la règle d'aujourd'hui (porté ainsi). Différence réelle seulement si `niveau`
  donné ne se résout pas ET que le rôle a un niveau : swarm essaierait le niveau du rôle, le portage non.
- model-tier-resolution.ts:503-507 : seul un identifiant explicitement demandé échoue, « silently running another model would
  betray the request » ; un niveau veut dire « le meilleur modèle utilisable » et peut retomber. Porté : `modele` donné n'est
  jamais remplacé.
- model-tier-resolution.ts:383-384 : une couche de niveau dont la valeur ne tourne pas chez l'agent est sautée ; seul un modèle
  donné provoque l'erreur. Porté par construction : un niveau ne choisit que parmi les modèles annoncés.
- swarm `taskModelCandidates` ignore un `model` vide (`model?.trim()` faux). Écart voulu : Relay prend `''` comme demande
  explicite du modèle par défaut (`args.modele ?? …` aujourd'hui) ; le portage garde le comportement de Relay.

## 4. Écarts entre les lignes du plan et swarm

- `src/types.ts:91-94` : exact (4 niveaux, pas 3).
- `src/types.ts:121-141` : la table commence bien ligne 121 mais s'étend jusqu'à 208 (12 agents, `acp` vide en 202-207) ;
  121-141 ne couvre que `claude`, `claude-managed`, `codex` et le début de `pi`.
- `src/be/model-tier-resolution.ts:8-23` : exact pour la liste ; la phrase sur les alias qui « falls through » est en 24-25.
  Le code de l'ordre est en 352-371 (`taskModelCandidates`) et 386-432 (`resolveTaskModel`).
- `:496-508` : c'est le commentaire de `applyCliSupport` (support du CLI), pas une fonction de résolution des niveaux ;
  la règle « un modèle donné échoue » y est bien (505-507) ; le code qui l'applique est en 517-519.
- `src/tools/send-task.ts:138-166` : `model` 138-145, `modelTier` 146-148 ; 149-171 sont `allowCustomModel`, `effort`,
  `profile`, `modelGroup` (hors lot).
- `templates/skills/delegate-work/content.md:27-41` : exact (titre « Routing table » en 27, table 29-41) ; la matrice des
  exécutants est juste avant (11-21).

## 5. Table de swarm par agent (`src/types.ts:121-208`, `DEFAULT_MODEL_TIER_MAP`) — données, pas code

| agent swarm | smol | regular | smart | ultra |
| --- | --- | --- | --- | --- |
| claude | haiku | sonnet | opus | fable |
| claude-managed | claude-haiku-5-5 | claude-sonnet-5-5 | claude-opus-5-5 | claude-fable-5-1 |
| codex | gpt-6-luna | gpt-6.1-terra | gpt-6.1-sol | gpt-6-astra |
| pi, opencode, dsh, fx | openrouter/deepseek/deepseek-v4.1-flash | (idem) | openrouter/deepseek/deepseek-v4-pro-0813 | openrouter/anthropic/claude-opus-5.5 |
| cursor | gpt-5.4-mini | claude-sonnet-5-5 | claude-opus-5-5 | claude-fable-5-1 |
| devin | devin | devin | devin | devin |
| amp | low | medium | high | ultra |
| grok | grok-build-0.1 | grok-4.3 | grok-4.6 | grok-4.7 |
| acp | (vide) | (vide) | (vide) | (vide) |

Correspondance proposée : `leger` ← smol, `standard` ← regular, `fort` ← smart et ultra. Pas de `gemini` chez swarm.
Point de départ des motifs pour `PR` (À CONFIRMER par le codeur contre `agent-probes.json` de la machine, non lu ici) :
`claude` : `leger: ['haiku']`, `standard: ['sonnet']`, `fort: ['opus', 'fable']` ; `codex` : `leger: ['luna']`,
`standard: ['terra']`, `fort: ['sol', 'astra']` ; `gemini` (d'après les identifiants des tests seulement) :
`leger: ['flash-lite']`, `standard: ['flash']`, `fort: ['pro']` ; `opencode` : identifiants libres
(`fournisseur/modèle`), pas de motif sûr. Un identifiant `default` (annoncé par les faux agents) ne correspond à aucun niveau.
Attention aux motifs courts : `sol` ou `pro` sont contenus dans d'autres mots ; ne garder que ce qui est vrai des
identifiants réellement annoncés.

## 6. Textes d'origine et traduction (sans nom d'agent ni de modèle)

### 6.1 `src/tools/send-task.ts`

- 144 (`model`) : « Concrete model override for this task, interpreted by the assignee's harness/provider. This does not
  switch providers. Prefer `profile` for a named harness + model + effort. The model must run on the assignee's harness (an
  Anthropic model on a Claude agent, an OpenAI model on a Codex agent); a mismatch is rejected. »
  → « Modèle précis pour cette tâche, lu par l'agent qui la reçoit. Il ne change pas d'agent. Le modèle doit être annoncé par
  cet agent ; sinon la tâche est refusée. »
- 147 (`modelTier`) : « Deprecated: pass modelGroup "<tier>" (the tier's group) or profile "<harness>-<tier>" (same model)
  instead. Portable model tier for this task: 'smol', 'regular', 'smart', or 'ultra'. Resolved at claim time through the model
  group named after the tier, else the seeded <harness>-<tier> profile of the assignee's harness. Legacy model shortnames map
  as haiku→smol, sonnet→regular, opus→smart, fable→ultra. »
  → « Niveau de modèle portable pour cette tâche : leger, standard ou fort. Il est traduit, au départ, en un modèle que
  l'agent qui la reçoit annonce. » (la mention « Deprecated » et les noms courts ne s'appliquent pas à Relay).
- Phrase du plan pour `DR` (à écrire mot pour mot) : « niveau : leger pour une part simple ou répétitive, standard par défaut,
  fort pour une part difficile ou un contrôle sensible ; un modele donné l’emporte ».

### 6.2 `templates/skills/delegate-work/content.md:27-41` (« Routing table » : travail → exécutant)

| ligne | travail (texte d'origine) | exécutant d'origine | niveau Relay | traduction |
| --- | --- | --- | --- | --- |
| 31 | orchestration, spec-writing, architecture | modèle fort par défaut, jamais délégué | (le chef) | orchestration, rédaction de la spécification, architecture : reste chez le chef |
| 32 | hard problems: long-horizon reasoning, novel architecture with many unknowns, high-stakes design calls, or anything Opus 5.5 already got wrong twice | le plus fort | fort | problèmes difficiles : raisonnement long, architecture neuve à nombreuses inconnues, décisions de conception à fort enjeu, ou ce que le modèle habituel a déjà raté deux fois |
| 33 | UI implementation (pages, components, styles, UX flows) | fort | fort | réalisation d'interface (pages, composants, styles, parcours) |
| 34 | code review — routine / per-phase | moyen | standard | relecture de code courante, par étape |
| 35 | code review — complex, security-sensitive, cross-cutting, or reviewing Sol/Astra output | fort | fort | relecture complexe, sensible pour la sécurité, transversale, ou relecture d'un travail fait par un modèle fort |
| 36 | API-level QA / E2E agents, plan-verification agents | moyen | standard | contrôle par l'API, essais de bout en bout, vérification d'un plan |
| 37 | browser E2E / driving the real UI | fort | fort | essais de bout en bout dans le navigateur, conduite de la vraie interface |
| 38 | search, locate, pattern-find, doc digests, plan-structure validation, log/test-output triage | léger | leger | chercher, localiser, repérer des motifs, résumer des documents, valider la structure d'un plan, trier des journaux ou des sorties de tests |
| 39 | bounded mechanical edits that need session tools (MCP, browser, secrets), so Codex can't take them | léger, liste exacte, escalade au premier raté | leger | modifications mécaniques bornées (liste exacte des modifications) ; passer au niveau au-dessus au premier raté ; ni code de fonctionnalité, ni choix de conception |
| 40 | bulk mechanical call-sequences (~10+ similar tool/API calls, any fan-out over a list) | un script | (hors niveaux) | longues suites d'appels mécaniques semblables : un script, pas un modèle |
| 41 | raw code implementation from a frozen spec | autre agent, variante selon l'ampleur | standard (fort si multi-fichiers ou débogage subtil, d'après 45-47) | écriture du code d'une spécification arrêtée |

Phrase voisine utile (ligne 25) : « Defaults, not limits. … if a cheaper executor's output doesn't meet the bar, rerun or redo
with a smarter one without asking. » → « Des choix par défaut, pas des limites : si le travail d'un niveau plus léger ne suffit
pas, refais-le à un niveau plus fort sans demander. »

## 7. Pour le codeur : repères dans l'arbre (par nom et texte ; numéros lus le 21/11 sur `e7f4964`)

- `packages/agent-runtime/profiles.js` : `export const profiles = [ … ]`, un objet par agent (`id`, `name`, `cli`,
  `package`, `env`, `fixedEnv`, `modelEnv`, `safeModes`, `nativeSubagents`, `preference`) ; `getProfile(id)` en fin de
  fichier. Poser `niveaux: { leger: [...], standard: [...], fort: [...] }` dans l'objet du profil, à côté de `modelEnv` /
  `safeModes` (profils `claude` l.41, `codex` l.18, `gemini` l.74 s'ils annoncent plusieurs modèles) ; rien sur `fixture`
  ni sur un profil qui n'annonce qu'un modèle.
- `packages/orchestrator/roles.js` : `export function parseRole(text, fileName)` (l.39-66) ; l'en-tête est lu par
  `/^\s*([A-Za-z]+)\s*:\s*(.*)$/` dans `header` (donc `niveau: fort` est déjà lu) ; l'objet rendu (`nom`, `description`,
  `verdict`, `autreAgent`, `consigne`) l.59-65 : y ajouter `niveau` seulement quand il vaut `leger|standard|fort`
  (`parseNiveau`). `export const roleList = (roles) =>` (l.145-151) : liste `nom, description, verdict, autreAgent`.
  `loadRoles` (l.89) lit plateforme, pack puis espace par le même `parseRole` : un rôle de pack a donc le niveau sans autre
  branchement. Fiches : `packages/orchestrator/roles/{chercheur,developpeur,redacteur,verificateur}.md`.
- `packages/orchestrator/delegation-rule.js` : `export const MISSION_TOOLS = {` l.266 ; `mission_lancer.description` l.269
  (une seule chaîne ; elle cite déjà « agent et modele : par défaut ceux de la mission mère ») ; `schema: z.object({…}).strict()`
  l.270-301, `modele: z.string().trim().max(200).optional()` l.275, `role` l.286. `.strict()` : `niveau` doit être déclaré
  ou l'appel est refusé. `mission_continuer` (l.335-347) a aussi `modele`, pas de `niveau` au plan.
- `packages/orchestrator/delegation.js`, `async launch(mother, control, args)` l.1029 :
  - le rôle est lu l.1032 : `const team = args.role ? this.roleOf(mother, args.role) : null;` (`roleOf` l.1452 rend la fiche
    ou `{ nom }`) ;
  - `const previous = sisters.get(args.reprend ?? args.continue) ?? null;` l.1063 ; `const base = previous ?? mother;` l.1139 ;
  - CHOIX DU MODÈLE AUJOURD'HUI : l.1148-1149
    `const planned = args.agent ?? reviewer ?? base.agent;`
    `const plannedModel = args.modele ?? (planned === base.agent ? (base.model ?? '') : '');`
    puis swarm-08 l.1153 `const why = chiefAgent || forced ? null : this.unavailable(planned, plannedModel);` et l.1163
    `const modele = instead ? '' : plannedModel;` ; `modele` part dans `this.engine.create({ … model: modele … })` (l.1235) et
    dans l'événement `child_launched` (l.1314-1320). L'ancienne ligne 934 du plan (`const modele = args.modele ?? …`) est
    devenue ces lignes 1149 et 1163. Le contrôle d'indisponibilité du chef (l.1083-1095) utilise aussi `args.modele`.
  - ZONE INTERDITE (compteurs) : de `family.resuming ??= new Map();` l.1105 jusqu'à la `}` de
    `if (!free && counted >= total) { … }` l.1133 (ancien 890-918) ; et de `family.pending++;` l.1225 jusqu'à la `}` qui ferme
    `if (control.abort.signal.aborted || family.stopped) { … }` l.1284 (ancien 990-1035), `try/catch/finally` de
    `engine.create` compris.
  - `async agents()` l.1736-1750 (cache, `detectAgents`) puis `agentsNow()` l.1754-1781 : c'est `agentsNow` qui bâtit
    `modeles: optionsOf(probes[agent.id]).map((model) => ({ id, nom, limiteJusqua? }))` l.1770-1774 et
    `modeleParDefaut: probes[agent.id]?.models?.current ?? null` ; `niveau` s'ajoute dans ce `map` (`niveauDe(model.id,
    getProfile(agent.id))`). `optionsOf` l.142-147.
- PIÈGE suite : `continueChild` (`packages/orchestrator/continuation.js` l.41-53) appelle `launch` avec
  `modele: child.model ?? ''` quand le chef n'a pas donné d'agent (ou le même) : dans `launch`, une suite arrive donc avec
  `args.modele` déjà rempli, indiscernable d'un modèle donné par le chef. Effet : la suite garde le modèle précédent (voulu
  par le plan) et ni `niveau` ni le niveau du rôle (transmis par `role:`) n'y changent rien. `continuation.js` n'est pas
  dans la liste du lot.
- Sondes : `packages/agent-runtime/probes.js`, `probesFile(dataDir) = resolve(dataDir, 'agent-probes.json')` et
  `loadProbes(dataDir)` (`{}` si absent ou illisible) ; `dataDir` par défaut `resolve(ROOT, '.data')`
  (`packages/orchestrator/index.js` l.395, `apps/api/server.js` l.101). Dans `delegation.js` : `this.probes()` l.1791 et
  `loadProbes(this.engine.dataDir)` l.1145. Forme lue : `probes[id].models = { current, options: [{ id, name }] }`. Pas de
  dossier `.data` dans cet arbre ; le fichier de la machine n'a pas été lu.
- Contrôle du moteur (non touché) : `packages/orchestrator/index.js` l.875 et 883-884, `known.some((m) => m.id === v.model)`
  → « Modèle non annoncé par … au dernier test » ; `delegation.js` l.1255 le rend en `modele_inconnu`.
- Identifiants de modèles annoncés dans les données de test (`tests/fixtures/`) : `fake-acp.js` l.64-66 `fake-lite`
  (courant) et `fake-pro` ; `modele-acp.js` l.21 `default` (courant), `modele-a`, `modele-b` ; `agent.js`, `chef-agent.js`,
  `astra-acp.js` : aucun ; `acp-shapes/*.json` : aucune liste de modèles relevée. Dans des tests (pas des fixtures) :
  `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3.8-flash` (`career-integration.test.js` l.261-262,
  `runtime.test.js` l.856), `opus[1m]` (`review-multi-agent-v3-01.test.js` l.379), `m1`, `m2`. Aucun fichier de secrets lu.
- `tests/swarm-08-agents.test.js` l.582 vérifie qu'aucun nom (`gpt`, `opus`, `sonnet`, ids d'agents…) n'apparaît dans un
  texte : les motifs du profil ne doivent pas fuir dans les textes rendus (seul `niveau` sort).

## 8. Non vérifié

- Les identifiants réellement annoncés par les agents de la machine (`agent-probes.json` non lu) : les motifs de la section 5
  sont à confirmer.
- L'effet d'un `niveau` sur l'agent choisi par swarm-08 (`instead` remet `modele = ''`) : à décider par le codeur (le portage
  ne choisit que le modèle, pour un agent déjà choisi).
- Aucun test de Relay lancé (rôle de copieur).
