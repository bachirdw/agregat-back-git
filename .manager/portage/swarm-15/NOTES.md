# swarm-15 — Notes du copieur (portage depuis swarm)

Adapté de desplega-ai/agent-swarm (MIT, © desplega.sh). Rédigé le 21/11/2026 à 09:46, arbre
`/Users/diaw/Downloads/agregat-back-swarm-15`, branche `swarm-15`, base `e7f4964`.
Swarm lu en lecture seule : `/Users/diaw/Downloads/agent-repos-agregat/desplega-ai__agent-swarm`. Rien n'en a
été exécuté. Aucun fichier de Relay modifié hors de ce dossier.

Contenu du portage : `textes-lecons.md` (phrases d'origine, fichier, ligne, traduction) et ce fichier.
**Pas de code porté** : le plan dit que le code est celui du lot swarm-03 (`packages/orchestrator/lecons.js`).

---

## 1. Ce qui est copié (origine → texte porté)

| Origine | Lignes lues | Porté dans |
|---|---|---|
| `src/tools/store-progress.ts` (champ `learning`) | 210-221 | `textes-lecons.md` § 1 |
| `src/tools/store-progress.ts` (tâche finie, échec non bloquant) | 524-546, 147-154, 804-810 | § 2 |
| `src/commands/runner.ts` (`fetchRelevantMemories`) | 4254-4292, 7409-7416, 7942-7951 | § 3 |
| `src/prompts/memories.ts` (titre, invitation à noter) | 80-110 | § 4 |
| `src/tools/memory-rate.ts` | 1-150 | § 5 |
| `src/tasks/task-terminal-effects.ts` (citation à la fin) | 27-37, 116-153 | § 6 |
| `src/be/memory/raters/implicit-citation.ts` (règle déjà portée au lot 03) | 35-41 | § 6 (rappel) |

Écarté : l'en-tête HTTP `X-Source-Task-ID`, `memory-store`, `memory_rerate` (outil annoncé, absent),
`referencesSource`, le chemin `/learnings/<workstream>/<slug>`, le « workstream », la porte
`MEMORY_RATERS` (`isExplicitSelfRaterEnabled`) : sans objet dans Relay.

## 2. Règles de swarm que le codeur doit respecter

1. **Ce qu'est une leçon** (`store-progress.ts:221`) : ce qui changerait la façon de travailler du suivant
   (piège, impasse, méthode qui a marché) ; ligne 1 le titre, ligne 2 la règle « Quand X, faire Y », les
   preuves après ; seuls les 300 premiers caractères sont montrés. **Ce qui n'en est pas une** : une ligne
   d'état ou de réussite / échec, la reprise de l'avancement ou du résultat du même appel, un texte déjà dans
   les consignes, une affirmation non vérifiée. Moins de 80 caractères, ou contenu dans le résultat du même
   appel : refusé (plancher déjà codé : `verifierPlancher`, `MESSAGES.trop_courte`).
2. **Une tâche finie ne prend plus de leçon** (`store-progress.ts:524-529`). Dans Relay, `Delegation.call()`
   refuse déjà (403) l'appel d'une exécution qui n'est plus active (`this.engine.active.get(motherId)` et son
   jeton) : un membre fini ne peut plus appeler `carnet_noter`. Rien à ajouter, à garder vrai.
3. **L'échec d'écriture d'une leçon ne bloque rien** (`store-progress.ts:530-545`, `:804-810`) : le
   résultat de la leçon est **joint** au résultat de l'appel ; un refus ou une exception de la leçon ne refuse
   pas la note du carnet. Plan : `lecon: { statut, id | message }` à côté de `{ n, total }`.
4. **Recherche au départ** (`runner.ts:4254-4292`) : requête = l'énoncé de la tâche (au départ comme à la
   reprise : `task.task`) ; 5 au plus (`limit: 5`) ; une erreur ou une réponse en échec rend `null` :
   **jamais d'échec du départ** ; rien trouvé → section absente (`memories.ts:87-94`). Dans Relay : un
   `try/catch` autour de `rappel()` dans `promptParts()`, champ absent si `[]` ou erreur.
5. **Une note d'utilité par tâche et par souvenir** (`memory-rate.ts`, `http/memory.ts:711`) : le doublon
   est refusé avec un message, pas en erreur fatale ; **seule une leçon servie à cette tâche peut être notée**
   (`memory-rate.ts:126-137`) ; la raison (`note`) est gardée sur 500 caractères et jamais montrée aux autres.
   Signal +1 / −1, poids 1.
6. **Citation à la fin** (`task-terminal-effects.ts:116-153`) : leçons servies à la tâche × journal de la tâche
   (recherche littérale de l'identifiant) ; rien si aucune leçon servie ; **en succès comme en échec**
   (`status: "completed" | "failed"`) ; un échec de la notation ne change jamais l'état de la tâche.

## 3. Écarts entre le plan et swarm (lignes et contenu)

- `store-progress.ts:210-221` : exact. `:524-545` : exact (accolade ligne 546).
- `runner.ts:4255-4291` : le passage est en 4254-4292 (une ligne de plus à chaque bout).
- `memories.ts:80-110` : exact. Le plan dit « invitation à noter 2 à 5 souvenirs » : swarm dit « 2-5
  ratings per task » (2 à 5 **notes** par tâche) et ne l'affiche que si la note explicite est ouverte
  (`MEMORY_RATERS`). La phrase `CHIEF_LECONS` / `DAUGHTER_LECONS` du plan ne reprend pas « 2 à 5 ».
- `memory-rate.ts` : swarm refuse la note d'une leçon **non servie** à la tâche ; le plan ne le dit pas.
  `Lecons.noterUtilite` ne le vérifie pas non plus (voir § 5) : à faire dans le branchement.
- `task-terminal-effects.ts:115-145` : le bloc est en 116-153.
- Swarm rend une **section Markdown** jointe au prompt ; le plan donne des **champs JSON** (`lecons`,
  `famille.lecons`) avec une phrase. Le rendu Markdown du lot 03 (`rendreLecons`, `TITRE_SECTION`,
  `INTRO_SECTION`, `CONSEIL_NOTE`, `TEXTE_PAS_UNE_LECON`) reste donc sans usage dans ce lot.
- Swarm stocke la leçon comme champ de `store-progress` (fin de tâche) ; le plan la fait passer par
  `carnet_noter` + `durable`, et seulement pour les catégories `methode`, `piege`, `decision`.

## 4. Repères dans l'arbre pour le codeur (par nom et texte ; lignes constatées à `e7f4964`)

### 4.1 Module des leçons — `packages/orchestrator/lecons.js` (725 lignes, lot swarm-03)

En-tête : 7 lignes de licence (origines task-learning, constants, memories, implicit-citation, store,
reranker, store-progress). Imports : `readConfined`, `safeDirectory`, `writeConfined`
(`../policy-engine/files.js`), `redact` (`../agent-runtime/env.js`).

Constantes exportées utiles : `RAPPEL_MAX = 5`, `EXTRAIT_CARACTERES = 300`, `LECON_MIN_CARACTERES = 80`,
`LECON_MAX_CARACTERES = 2000`, `LECON_TTL_JOURS = 30`, `MESSAGES`, `PORTEE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/`,
`ID_RE = /^l-[0-9a-f]{16}$/`.

Classe `Lecons` (signatures exactes) :

| Méthode | Signature | Rend | Lève |
|---|---|---|---|
| constructeur | `new Lecons({ dir, now = () => Date.now(), ttlJours = LECON_TTL_JOURS } = {})` | — | `dir` absent ou vide |
| noter | `noter({ texte, portee, etiquettes, mission, auteur, origine, memeAppel } = {})` | `{ statut: 'gardee', id }` · `{ statut: 'rejouee', id }` · `{ statut: 'confirmee', id, similarite }` · `{ statut: 'refusee', raison, message }` | portée invalide ; horloge invalide |
| rappel | `rappel(texte, portee, { max = RAPPEL_MAX } = {})` | `[{ id, titre, extrait, date, utile, inutile }]` (5 au plus) | portée invalide |
| citer | `citer(ids, journal)` | `[{ id, citee: boolean }]` (ids inconnus ou mal formés sautés) | horloge invalide |
| noterUtilite | `noterUtilite(id, portee, { utile, mission } = {})` | `{ statut: 'notee', id }` · `{ statut: 'deja_notee', id }` · `{ statut: 'inconnue', id }` · `refusee` (`note_invalide`, `mission_absente`) | id ou portée invalide |
| promouvoir | `promouvoir(id, portee)` | `{ statut: 'promue', id }` · `inconnue` | id ou portée invalide |
| remplacer | `remplacer(id, portee, { par } = {})` | `{ statut: 'remplacee', id }` · `inconnue` | id, `par` ou portée invalide |
| supprimer | `supprimer(id, portee)` | `{ statut: 'supprimee', id }` · `inconnue` | id ou portée invalide |
| liste | `liste(portee)` | leçons vivantes (objets complets : `texte` entier, `alpha`, `beta`, `citee`, `expire`…) | portée invalide |
| purger | `purger(portee?)` | nombre retiré | portée invalide |

`memeAppel` de `noter` : une chaîne (prise comme `{ resultat }`) ou un objet `{ progres, resultat }`.
`mission` sert au rejeu (`trouverRejeu` ne joue que si `mission` est donné). Fonctions pures exportées aussi :
`noterCitations(ids, journal)`, `choisirLecons(texte, lecons, { max, now })`, `extrait(lecon)`,
`utilite(alpha, beta, preuveNegative)`, `rendreLecons(lecons, { conseil })`.

**Écarts entre les signatures réelles et ce que le plan suppose :**

1. **Pas de méthode de lecture d'une leçon** : `lecon_lire { id }` doit se faire par
   `liste(portee).find((l) => l.id === id)` (lit jusqu'à 1 000 fichiers de la portée) ; `lecons.js` n'est pas
   dans la liste des fichiers à modifier du lot.
2. **`noterUtilite` exige la portée** et ne connaît pas `raison` : l'outil `lecon_utile { id, utile, raison? }`
   n'a pas de portée → la retrouver par les identifiants servis à l'exécution ; `raison` n'a pas de place dans
   le module (swarm la garde 500 caractères pour la télémétrie) : à décider (ignorer, ou la garder ailleurs).
3. **`noterUtilite` ne vérifie pas que la leçon a été servie** (swarm le refuse) : le contrôle est au
   branchement. Le statut « une seule note » s'appelle `deja_notee` (une note par `mission`).
4. **`citer` cherche dans toutes les portées de son dossier** (pas de paramètre de portée) : pour une mission
   privée, appeler `citer` sur l'instance `Lecons` de l'espace, pas sur celle de `<dataDir>/lecons`.
5. **Beaucoup de méthodes lèvent** (`controlerPortee`, `controlerId`, horloge) : tout appel du branchement va
   dans un `try/catch` (règle du plan : « toute erreur du module est avalée »).
6. **Portée = pack** : `PORTEE_RE` accepte `core`, `career-ops`, `najah` (dossiers de `domain-packs/`), pas
   une majuscule ni un point (un pack de test de `AGENT_PLATFORM_TEST_PACKS_DIR` mal nommé → exception →
   avalée, aucune leçon).
7. `noter` rend `similarite` en plus pour `confirmee` ; le plan joint `lecon: { statut, id | message }`.

### 4.2 `packages/orchestrator/delegation-rule.js`

- `CARNET_SERVER = 'relay-equipe'`, `CARNET_CATEGORIES = ['methode', 'decouverte', 'decision', 'piege',
  'question']`, `CHIEF_CARNET`, `DAUGHTER_CARNET` (au-dessus de `CARNET_TOOLS`).
- `export const CARNET_TOOLS = { carnet_noter: { description, schema }, carnet_lire: {…} }` (plan : `DR:66-86` ;
  constaté vers les lignes 75-95). Schéma actuel de `carnet_noter` :
  `z.object({ texte: z.string().trim().min(1).max(2000), categorie: z.enum(CARNET_CATEGORIES).default('decouverte') }).strict()`.
  Description actuelle, mot pour mot : « Ajoute une note au carnet de l’équipe, lu par l’agent principal et par
  chaque membre : texte (court et précis) ; categorie : methode (une méthode qui marche), decouverte (par
  défaut), decision, piege ou question (pour l’agent principal). Rend le rang de la note (n) et le nombre de
  notes (total). » `.strict()` : un champ `durable` est aujourd'hui refusé (`parametres_invalides`).
- `RESULT_TOOLS = { resultat_rendre }` (swarm-10) juste après : modèle pour la constante neuve `LECON_TOOLS`.
- `chiefRule(delegation)` assemble `${CHIEF_RULE}${TEAM_RULE}${SUITE_RULE}${CHIEF_CARNET}…` ; `DAUGHTER_HEAD`
  (non exporté) finit par `DAUGHTER_CARNET` ; `daughterRule(folder, role, suite, schema)` le réutilise par
  `.replace(DAUGHTER_HEAD, …)`. Où poser `CHIEF_LECONS` / `DAUGHTER_LECONS` : le plan ne le dit pas ; les
  joindre seulement quand le champ est donné, pour que « prompt identique sans leçon » tienne.

### 4.3 `packages/orchestrator/carnet.js` — `note()`

`note(run, mother, { texte, categorie })` (plan : `CA:186-221`, constaté au même endroit). Ordre : `book(mother)`
→ refus `carnet_plein` (200 notes, lève `fail(...)`) → `chief = !run.famille` → objet
`{ n, auteur, role?, categorie, texte, a, mission: run.id, chef }` → `book.notes.push` → marque `carnet: true`
→ espace privé : fichier `relay/runs/<racine>-carnet.json` + événement sans texte ; sinon événement complet
→ `mirror` → **`return { n: note.n, total: book.notes.length }`**. Auteur : `CHIEF_AUTHOR = 'agent principal'`
pour le chef, sinon `run.famille.titre ?? run.title ?? run.id` (deux membres de même titre ont le même auteur ;
`mission: run.id` est plus précis). `Carnet.call(run, control, body)` lit `CARNET_TOOLS[body.tool]` et ne route
que `carnet_noter` / `carnet_lire`. `Carnet` n'a pas de lien vers les leçons sauf `this.delegation`.

### 4.4 `packages/orchestrator/delegation.js` (1 998 lignes)

- **Constructeur** `constructor(engine)` : réglages lus au départ sur `process.env` (`AGENT_PLATFORM_DELEGATION`
  → `this.lent`, `AGENT_PLATFORM_DOUBLON`, `AGENT_PLATFORM_VERDICT_TURN`) ; `this.now`, `this.carnet = new
  Carnet(this)`, `this.resultats = new ResultatValide(this)`. `AGENT_PLATFORM_LECONS` se lit au même endroit.
  `this.engine.dataDir` existe (utilisé par `loadProbes`). `this.engine.ownerMode` existe.
- **`promptParts(run, servers = [])`** : chef reconnu par `servers.some((s) => s.name === MISSION_SERVER)` →
  `return { fields: {}, rule: '\n' + chiefRule(run.delegation) }` ; sous-mission → `fields: { famille: { …,
  ...this.carnet.forStart(run), … } }`, `rule: '\n' + (membres) + daughterRule(...)`. Texte de la demande :
  `this.engine.turnObjective(mother)` (lit le fichier privé pour un espace privé) ; consigne d'une
  sous-mission : `run.prompt` (créée par `engine.create({ prompt: consigne, pack: mother.pack, workspace? })`
  dans `launch()`). Pack : `run.pack` / `mother.pack`. Espace privé : `run.workspace` (vaut `'career-ops'`) et
  `run.cwd`. Le moteur joint les champs : `packages/orchestrator/index.js`, `const familyPrompt =
  this.delegation.promptParts(run, mcpServers);` puis `...familyPrompt.fields` dans le JSON du prompt (plan :
  `IX:1684-1687`, constaté vers 1711-1715).
- **`call(motherId, token, body, signal)`** : `motherId` est l'exécution qui appelle (chef ou sous-mission) ;
  après le contrôle du jeton : `if (CARNET_TOOLS[body?.tool]) return this.carnet.call(mother, control, body);`
  puis `if (RESULT_TOOLS[body?.tool]) …` — `LECON_TOOLS` se route au même endroit, avant le refus « Outils de
  mission non prêtés ». `control.toolDelivered?.(null, 'gateway')` est appelé par les routes existantes.
- **`ended(child, state)`** : appelée par `watch()` sur l'état terminal d'une **sous-mission** seulement ; elle
  n'a pas la réponse du membre : `this.engine.modelAnswerOf(child)` la donne (utilisée par `outcome()`).
  Appelée pour tout état terminal (succès, échec, annulation), comme swarm.
- **`familyBilan(run, { chiefAnswer = '', motherSends = 0 } = {})`** : rend `''` si `!this.hasFamily(run)`
  (aucune sous-mission lancée) ou sans enfant. `bilanSection(run, options)` l'appelle et ajoute ensuite
  `this.carnet.bilanLine(run)` (mère seulement) ; le moteur appelle `this.delegation.bilanSection(run, {
  chiefAnswer: agentSaid, motherSends })` (`index.js`, « chef-01 : the « Sous-missions » section »).
  **Écart** : un chef servi en leçons qui ne lance aucune sous-mission n'aurait ni citation ni ligne si on les
  pose dans `familyBilan` ; `bilanSection` (à côté de la ligne du carnet) les aurait. À trancher.
- **Lot parallèle** : swarm-14 modifie `ended()` et `familyBilan()` dans un autre arbre : prévoir une fusion
  sur ces deux fonctions. Ce portage n'en dépend pas.
- Zones interdites (brief § 7) : compteurs de `launch()`, `pump()`, `wake()`, `prerequisite()`, `settle()`,
  `stopFamily()`, `waitLiving()`.

### 4.5 `packages/mission-gateway/server.js` — les deux listes d'outils

```js
const onlyCarnet = process.env.RELAY_GATEWAY_TOOLS === 'carnet';
const TOOLS = onlyCarnet
  ? { ...CARNET_TOOLS, ...RESULT_TOOLS }
  : { ...MISSION_TOOLS, ...CARNET_TOOLS };
```
(plan : `GW:14` ; constaté lignes 14-17). La passerelle est un **processus à part** : elle ne voit le réglage
`AGENT_PLATFORM_LECONS` que si on le lui passe (les `env` sont fixés par `Carnet.servers()` —
`RELAY_GATEWAY_TOOLS: 'carnet'` — et `Delegation.servers()`). Non vérifié : si le processus hérite de
l'environnement du serveur.

**Tests existants touchés** : trois égalités strictes sur la liste des outils d'une sous-mission,
`['carnet_noter', 'carnet_lire', 'resultat_rendre']` : `tests/equipe-01-carnet.test.js:249`,
`tests/swarm-10-resultat.test.js:251` et `:420`. Ajouter `LECON_TOOLS` à la liste d'une sous-mission les rend
rouges ; le plan n'autorise d'adapter `equipe-01-carnet` que pour le résultat de `carnet_noter`, et
`swarm-10-resultat` n'est pas dans la liste. À trancher par le manager. Égalités `{ n, total }` sur le
résultat de `carnet_noter` : `tests/equipe-01-carnet.test.js:160-161`, `:253-254`, `:435` (inchangées tant que
`lecon` et `deja` sont absents d'une note simple).

### 4.6 `apps/api/server.js` — deux routes et le mode propriétaire

- **Mode propriétaire** : paramètre de `createApp({ …, ownerMode = process.env.AGENT_PLATFORM_OWNER_MODE ===
  '1', … })`, passé à `new Orchestrator(store, skills, { …, ownerMode, … })` ; variable locale `ownerMode` dans
  le gestionnaire (déjà employée : `/api/catalog`, `browser-fallback`), et `engine.ownerMode`. Dans
  `delegation.js`, l'espace privé hors mode propriétaire se lit `!!mother.workspace && !this.engine.ownerMode`.
- **GET** : les routes GET sont avant `if (req.method !== 'POST') return json(res, 404, …)` ; placer
  `GET /api/lecons` près de `if (req.method === 'GET' && path === '/api/runs')` (sur `path`, paramètres par
  `url.searchParams.get('portee')`).
- **POST** : après le garde `x-platform-request: 1` + `content-type: application/json` et la lecture du corps
  (`const body = JSON.parse(raw || '{}')`), près de `if (path === '/api/runs') return json(res, 201, …)`.
  Motif conseillé : `path.match(/^\/api\/lecons\/([a-z0-9][a-z0-9_-]{0,63})\/(l-[0-9a-f]{16})$/)` (= `PORTEE_RE`
  et `ID_RE`). Une exception levée dans le gestionnaire est rendue par le `catch` commun (non relu en détail).
- Espace privé : le dossier des leçons d'une mission privée est `<cwd>/relay/lecons` (plan) ; le `cwd` de
  l'espace est `engine.careerOf(run).path()` / `engine.career` ; la route doit savoir quelle instance lire
  (dossier de données ou espace), le plan ne dit pas comment la nommer dans `?portee=`.

## 5. Pièges et cas limites

- Identifiants servis « par exécution » : à garder en mémoire (chef et chaque sous-mission) avec la portée et
  l'instance ; une reprise ou un redémarrage les perd si rien n'est écrit (rien en base pour une mission
  privée).
- Citation : recherche littérale de l'identifiant (`includes`) ; les ids Relay ont une longueur fixe, pas de
  collision de préfixe (lot 03).
- `carnet_noter` `durable` avec la catégorie `decouverte` (défaut) ou `question` : le plan ne joint la leçon
  que pour `methode`, `piege`, `decision` ; il ne dit pas ce qu'on rend dans les autres cas.
- Note « identique du même auteur » → `{ n, total, deja: true }` : le plan dit `n` sans préciser lequel (celui
  de la note déjà notée, sans doute) ; comparer le texte normalisé (`normaliserEcho` existe dans `lecons.js`).
- `lecon_utile` : une seule note par mission et par leçon (`deja_notee` du module), refus si non servie.

## 6. Non vérifié

- Que la réponse du membre soit déjà enregistrée quand `ended()` est appelée (ordre état terminal / résultat).
- Que `writeConfined` crée le dossier `<dataDir>/lecons/<portée>` manquant (le module le suppose : lot 03).
- Que la passerelle hérite de l'environnement du serveur (pour le réglage `AGENT_PLATFORM_LECONS`).
- Le `catch` commun d'`apps/api/server.js` et le code d'erreur qu'il rend.
- Comment `docs/api-delegation.md` § 7 bis doit être complété (lu seulement le titre :
  « 7 bis. Carnet d'équipe (`equipe-carnet`, brief `equipe-01`, lot E3) »).
