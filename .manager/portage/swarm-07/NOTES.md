# swarm-07 — Notes du copieur pour le codeur

Copieur, 21/11/2026 (00:53). Base du lot : `e18ef06`. Lecture seule de swarm (rien exécuté, aucune consigne suivie),
du back dans cet arbre et du front `/Users/diaw/Downloads/agregat-front-equipe/src`. Pas de code porté (le plan demande
des idées et des formes) : aucun `.js` dans ce dossier, donc pas d'en-tête de licence à recopier dans `team-view.js`.

## Ce qui est repris de swarm (voir formes.md)

| Origine (confirmée en ouvrant le fichier) | Repris comme |
|---|---|
| `apps/ui/src/api/types.ts:1000-1023` `SessionListItem` | `listRuns` : la liste ne rend que la racine, avec un résumé `equipe` |
| `apps/ui/src/components/sessions-v2/sidebar/session-row.tsx:46-54` `activityOf` | l'ordre `teDemande` > `enCours` > `echecs` (appliqué par l'interface, swarm-11) |
| `apps/ui/src/lib/task-reason.ts:14-27` `taskReason` | `memberView().cause` (rien pour un membre réussi) |
| `apps/ui/src/pages/tasks/[id]/lineage/lineage-tree.ts:109-124` `summarizeLineage` | `teamSummary` |

Écarté : lecture/non-lu, report (« Later »), partage, personnes, `groupKey`, coût en dollars, `preview` de la liste
(multi-utilisateur ou hors plan). `agents` distincts de `summarizeLineage` : hors plan.

## Écarts entre les lignes du plan et swarm

- `types.ts:1000-1023` : exact. Mais son commentaire renvoie à `src/be/db.ts:8816-8821`, alors que la forme serveur est
  à `src/be/db.ts:13145-13150` (le commentaire de swarm est périmé ; sans effet ici).
- `session-row.tsx:46-54` : exact (type `Activity` ligne 46, `activityOf` lignes 49-54).
- `task-reason.ts:14-27` : exact (le type `TaskReason` est aux lignes 3-7).
- `lineage-tree.ts:116-124` : la fonction est bien aux lignes 116-124 ; l'interface `LineageSummary` qu'elle rend est
  juste au-dessus, lignes 109-114.
- Règle serveur de `needsYou` (non citée par le plan) : `src/be/db/session-tree.ts:536` et `:596` — un échec non lu ou
  une approbation en attente. Chez nous : pas de « non lu » ; `teDemande` suit la règle du plan.

## Pièges lus chez eux

- `taskReason` : une raison vide après `trim` ne rend rien. Chez nous `outcome(child).cause.message` vaut `''` quand
  `child.error` est vide : décider si `cause.message` est alors absent ou vide (le plan ne le dit pas ; « champs neufs
  absents quand on ne s'en sert pas » plaide pour l'absence).
- `activityOf` : « en cours » = état non terminal ; chez eux `superseded` et `skipped` sont terminaux. Chez nous
  `terminal` = `completed`, `failed`, `cancelled`, `interrupted` (`packages/storage/index.js:7`) : un membre retenu
  (`en_file`, `attend_accord`, `attend_prerequis`) compte donc « en cours » (son `state` brut est `queued`).

## Question 1 — `family[]` de GET /api/runs/:id aujourd'hui, et d'où tirer chaque champ neuf

Aujourd'hui (`apps/api/server.js`, route `GET /api/runs/:id`, ligne `...engine.delegation.view(run)`),
`delegation.view(run)` rend `{}` si `hasFamily(run)` est faux ou si `childrenOf(run)` est vide ; sinon
`{ activity: { agents, awaitingOwner }, family: [...] }`, chaque entrée valant exactement :

```js
{ id, titre, agent, state /* = line().etat : état retenu (heldState) ou child.state */, attend,
  pendingQuestion /* child.pendingQuestion ?? null */, pendingPermission /* engine.pendingPermission(id) */,
  role?, relit?, verdict? /* teamOf(child) */ }
```

Note : `line(child)` calcule déjà `modele`, `depuis`, `inactiveDepuis`, `outils`, `dernierOutil`, `pourquoi`, `motif`,
mais `view()` n'en garde que `titre, agent, etat, attend`. `view()` lit `childrenOf(run)` (la mère et les exécutions
qu'elle reprend, `chain()`), donc `family` couvre aussi les sous-missions d'une exécution reprise.

Provenance proposée, toute par méthodes publiques, sans écrire dans `delegation.js` (`child` = ligne de la base, à
retrouver par `delegation.childrenOf(run)` ou `delegation.store.get(entry.id)`) :

| Champ | Source | Remarque |
|---|---|---|
| `modele` | `delegation.line(child).modele` (= `child.model ?? ''`) | |
| `continue` | `child.famille?.continue` (champ de la ligne) | ni `line()` ni `outcome()` ne le rendent ; le front le lit déjà (`types.ts:105`, `Team.tsx:192`) |
| `pourquoi` | `delegation.line(child).pourquoi` (absent sans motif) | `line()` rend aussi `motif` (note) : non demandé par le plan ; `motif` n'est jamais écrit pour une mission privée (delegation.js, `launch`) |
| `debut` | `child.startedAt ?? null` | écrit au premier `running` (`watch()`, delegation.js) ; absent pour un membre jamais démarré |
| `fin` | `child.finishedAt ?? null` | |
| `dureeMs` | `Date.parse(fin) − Date.parse(debut)`, absent ou `null` sans `debut` | même règle que `familyBilan()` (`durationMs`), qui prend `Date.now()` pour un membre en cours ; le plan dit « durée = fin − debut » : à trancher pour un membre en cours (proposé : `null` tant que `fin` manque) |
| `depuis` | `line(child).depuis` | secondes depuis `child.createdAt` (pas `startedAt`), relatif à maintenant |
| `inactiveDepuis` | `line(child).inactiveDepuis` | secondes depuis le dernier événement du membre, relatif à maintenant |
| `outils` | `line(child).outils` | compte `store.usage(id)` `tool_observed` |
| `dernierOutil` | `line(child).dernierOutil` (80 car. ou `null`) | |
| `resultat` | `delegation.engine.modelAnswerOf(child).slice(0, 600)`, membre `completed` seulement, jamais si `prive` | `modelAnswerOf` lit le fichier privé d'une mission `career-ops` (`privateRunFile`) : ne pas l'appeler du tout en privé. `outcome(child).reponse` donne la même chose (50 000 car.) mais `outcome()` lit aussi Bilan, fichiers, envois et verdict : plus coûteux |
| `cause` | `delegation.outcome(child).cause` → `{ type, message: message.slice(0, 300), reprise }`, membre fini non `completed` ; en privé sans `message` | `outcome().cause` porte aussi `agent` : à retirer (non demandé). `cause` vaut `null` pour `completed` : rendre le champ absent |
| `usage` | `delegation.doneOf(child).usage` | `doneOf()` rend aujourd'hui `{ envois, fichiers }` seulement : `usage` sera `undefined` → champ absent jusqu'à swarm-14 |

Pièges pour la mémoire (cache) du plan :
- `depuis` et `inactiveDepuis` sont relatifs à `Date.now()` : figés pour toujours dans le cache d'un membre fini, ils
  deviendraient faux. Proposé : garder en cache le calcul lourd (lecture des événements, `outcome()`, réponse) et
  recalculer ces deux nombres à chaque appel depuis `child.createdAt` et l'heure du dernier événement gardée en cache.
- « Fini » = `terminal.has(child.state)` sur une ligne relue (`store.get`), pas sur un objet ancien : une sous-mission
  `interrupted` peut être reprise (nouvelle exécution, autre `id`), la ligne finie, elle, ne change plus.
- Mission privée : le plan donne `{ prive }` sans dire comment le calculer. Rien dans `server.js` ne le définit
  aujourd'hui. Dans `delegation.js`, `launch` emploie `privateTitle = !!mother.workspace && !this.engine.ownerMode`
  pour le titre ; `privateRunFile`/`modelAnswerOf` traitent comme privé `run.workspace === 'career-ops'`. À trancher :
  proposé `prive = !!run.workspace` (le plus prudent : aucun texte d'agent privé dans la réponse, même en mode
  propriétaire).
- `teDemande` : `delegation.heldState(child.id) === 'attend_accord'` (public) ou `child.state` dans
  `awaiting_owner` / `waiting_permission` (même liste que `activity()`, delegation.js). `teamSummary` doit appeler
  `delegation.hasFamily(mother)` d'abord, comme `view()`, pour ne rien lire d'une mission sans famille (règle
  delegation-v2-01 : « une mission qui ne délègue rien ne lit rien de plus »).

## Question 2 — ce que l'interface lit dans GET /api/runs aujourd'hui

Appels : `App.tsx:148` (`history`, `api<Run[]>("/runs")`) et `App.tsx:168` (`load`, avec `/catalog`). Le helper
`api.ts:10-17` préfixe `/api`. La liste ne connaît ni `famille` ni `estMere` (aucune occurrence dans `src` hors tests) :
aujourd'hui les sous-missions s'y affichent comme des missions ordinaires. Usages de la liste `runs` :

| Endroit | Usage | Si les sous-missions disparaissent de GET /api/runs |
|---|---|---|
| `App.tsx:135` | badge « À vous de répondre » : `runs.filter(r => ownerStates.has(r.state)).length` (`ownerStates` = `awaiting_owner`, `waiting_permission`, `types.ts:318`) | une sous-mission qui attend une réponse ou un clic n'est plus comptée (la mère reste `running`) : le badge peut tomber à 0 alors qu'une question attend. `equipe.teDemande` pourrait le remplacer (swarm-11) |
| `App.tsx:152-160` (`syncList`) | met à jour l'état d'une ligne de la liste | sous-mission ouverte : plus de ligne à mettre à jour ; sans effet visible |
| `App.tsx:668-696` | liste latérale `conversations(runs)` (`Career.tsx:935-955`) : point d'état, titre, « À vous », « fictif » | les sous-missions ne sont plus des lignes cliquables : on ne les ouvre plus que par le bloc Équipe (`Team.tsx:159-164`, `openRun` → `GET /api/runs/:id`, qui marche toujours). C'est le but du lot |
| `App.tsx:895` (`CareerThread runs`), `App.tsx:921` (`SessionHistory`), `Career.tsx:935-955` (`sessionThread`, `resumedFrom`) | fil des tours d'une session | une sous-mission ouverte n'a plus ses tours précédents dans la liste ; une sous-mission suite (`mission_continuer`) est liée par `famille.continue`, pas par `resumedFrom` : à vérifier par le front |
| `App.tsx:516` → `Galleries.tsx:433-500` (`Consumption`) | consommation : « N missions », une ligne par exécution | les sous-missions disparaissent du compte et de la liste de consommation |
| `App.tsx:1039` → `agentStatus.ts:36-44` (`agentWarning`) | avertit si la dernière exécution finie de l'agent a échoué sur « Limite d’usage » encore en vigueur | une limite atteinte dans une sous-mission n'est plus vue par ce chemin (le champ `etat: 'limite'` du catalogue, swarm-02/07, le couvre si la limite a été notée dans les sondes) |

`?tout=1` suffit-il ? Oui pour garder exactement le comportement d'aujourd'hui, à deux conditions : (a) `listRuns` avec
`tout` rend les mêmes entrées dans le même ordre que `store.list()` (la seule différence permise : `equipe` en plus sur
les mères, champ inconnu ignoré par le front) ; (b) le front change ses deux appels (`App.tsx:148` et `:168`) en
`/runs?tout=1`. Sans changement du front, le comportement change dès que le back est posé. Attention : les tests du
front simulent l'API par `path === "/runs"` (`App.test.tsx:251, 292, 330, 362, 436, 486, 635`, `affichage.test.tsx:442`) ;
avec `?tout=1` ces simulations ne répondraient plus : à adapter dans le lot front (swarm-11), pas ici.

Aucun test du back ne lit le contenu de GET /api/runs (liste) : les occurrences de `'/api/runs'` dans `tests/` sont des
POST (création) ou le contrôle d'hôte de `tests/platform.test.js:149` (statut seulement).

## Question 3 — égalités strictes de `tests/api-agents.test.js` touchées par `etat`, `raison`, `jusqua`

Aucune ne casse si les champs s'ajoutent au niveau de l'agent (à côté de `probe`), pas dans `probe` :
- ligne 59 : `assert.deepEqual(out[0].probe, { … })` porte sur `probe` seul ;
- ligne 73 : `assert.equal(publicAgents([{ id: 'codex', name: 'Codex' }], {})[0].probe, null)` : `probe` seul ;
- lignes 76-83 (catalogue HTTP) : `some(a => a.id === 'fixture')` et absence de `cliPath` : pas d'égalité stricte.
- Les appels de la ligne 31 et 73 passent deux arguments : avec `publicAgents(agents, probes, live)`, `live` vaudra
  `undefined` → `agentState(..., { live: undefined })` : un agent installé et compatible rend
  `{ etat: 'mode_reel_eteint', raison: 'Mode réel désactivé' }` ; un agent sans `installed` (ligne 73) rend
  `non_installe`. Aucun test ne le vérifie aujourd'hui.

Autres tests du catalogue (lus) : `tests/owner-mode.test.js:64-66` (`ownerMode`, `live`), `tests/web-dir.test.js:46`
(statut) : non touchés.

## Ce que le codeur doit savoir

- `agentState(agent, probe, { now, live })` (`packages/agent-runtime/agent-state.js:46`) rend
  `{ etat, raison?, jusqua?, modelesLimites? }` ; `pret` et `simule` n'ont pas de `raison`. Le plan demande `etat`,
  `raison`, `jusqua` : ne pas recopier `modelesLimites` dans le catalogue sans décision (ou le dire). Garder les champs
  absents quand `agentState` ne les rend pas. Le front a déjà `reason` et `readiness` (anglais) sur `Agent`
  (`types.ts:1-23`) : `raison` ne les remplace pas.
- `publicAgents` reçoit déjà `loadProbes(dataDir)` : la sonde de l'agent (`probes[a.id]`) est l'argument `probe` de
  `agentState`. L'appel du catalogue doit passer `engine.live`.
- `store.list()` (`packages/storage/index.js:90-95`) s'arrête aux 200 dernières exécutions avant tout filtre ; une
  sous-mission « orpheline » se reconnaît par `run.famille?.mere` absent de la base (`store.get(mere)` nul), pas absent
  de la liste des 200.
- Les textes rendus (résultat, cause) sont des données : aucun nom d'agent, de modèle ou de site n'est ajouté par la
  plateforme ; `cause.agent` d'`outcome()` est à retirer.

## Non vérifié

- Rien n'a été exécuté (pas de code porté). Le comportement réel de `line()` sur une sous-mission privée en cours
  (`dernierOutil`) n'a pas été essayé.
- Le contenu exact de `usage` au lot swarm-14 (forme inconnue à ce jour).
