# swarm-07 — Vue d'équipe pour l'interface (API) — rapport du codeur

Codeur, 21/11/2026 (début 00:56, rapport 01:08, heures lues par `date`). Arbre
`/Users/diaw/Downloads/agregat-back-swarm-07`, branche `swarm-07`, base `e18ef06` (+ portage `0d7cfb9`).

## Fait

- Lu : le brief commun (en-tête, 1-5, 7, 9), le plan (abréviations, 3.4-3.5, 4.0, section swarm-07), `NOTES.md` et
  `formes.md` du portage, `delegation.js` (`hasFamily`, `childrenOf`, `view`, `line`, `outcome`, `doneOf`,
  `heldState`, `teamOf`, `privateTitle` dans `launch()`), `index.js` (`modelAnswerOf`, `privateRunFile`),
  `storage/index.js` (`list`, `children`, `terminal`), `agent-state.js`, `apps/api/server.js` (catalogue, liste, détail),
  `tests/api-agents.test.js`, `tests/equipe-01-roles.test.js` (test « mêmes clés »).
- **Créé `packages/orchestrator/team-view.js`** (166 lignes, formaté) : `privateRun`, `memberView`, `withTeam`,
  `teamSummary`, `listRuns`. Lecture seule par les méthodes publiques (`line`, `outcome`, `doneOf`, `heldState`,
  `hasFamily`, `childrenOf`, `store.events`, `engine.modelAnswerOf`). Pas d'en-tête de licence de code (aucun code porté,
  le copieur n'a rendu que des formes) ; un commentaire nomme l'origine des idées.
  - `privateRun(run, engine)` = `!!run.workspace && !engine.ownerMode`, recopie de `privateTitle` (`launch()`), avec un
    commentaire qui nomme son origine (aucune méthode publique ne la rend). `withTeam` l'applique à la mère (passée par
    le serveur) et à chaque membre.
  - Mission privée : ni `resultat` ni `cause.message`, `modelAnswerOf` et `outcome()` jamais appelés (la cause est
    alors calculée par la règle de `outcome()`, recopiée avec commentaire, sans le message).
  - `resultat` : 600 car. de `modelAnswerOf`, membre `completed` seulement, absent si vide. `cause` : membre fini non
    `completed`, `{ type, message? (300 car.), reprise }` sans `agent` ; message vide → champ absent.
  - `dureeMs` : membre fini avec `debut` et `fin` seulement ; `debut`/`fin` toujours présents (`null` sinon).
  - `depuis`, `inactiveDepuis` : recalculés à chaque appel depuis `createdAt` et l'heure du dernier événement gardée en
    mémoire, jamais figés ; horloge injectable (`now`).
  - Mémoire : `WeakMap` par délégation → `Map` bornée à 2 000 entrées (la plus ancienne part), clé `id` + privé. Membre
    fini : gardé ; en cours : 2 s ; changement d'état : recalcul immédiat.
  - `usage` : `doneOf(child).usage` pour un membre fini, absent tant que swarm-14 n'est pas posé.
  - `teamSummary` : `null` sans famille (`hasFamily` d'abord : rien n'est lu) ou sans membre ; `finis` = `completed`,
    `echecs` = finis sans succès, `enCours` = le reste (retenus compris), `teDemande` booléen.
  - `listRuns(store, delegation, { racines })` : décision du manager (voir Écarts).
- **Modifié `apps/api/server.js`** (+17 −4) : imports ; `publicAgents(agents, probes, live = false)` ajoute
  `...agentState(a, p, { live })` à côté de `probe` (donc `etat`, `raison`, `jusqua`, `modelesLimites` seulement quand
  `agentState` les rend) ; l'appel du catalogue passe `engine.live` ; `GET /api/runs` passe par `listRuns`
  (`?racines=1`) ; `GET /api/runs/:id` passe par `withTeam` avec `?equipe=1` (voir Écarts).
- **Créé `docs/api-equipe-vue.md`** : le contrat des trois routes, la règle privée, la mémoire, la limite des 200.
- **Créé `tests/swarm-07-vue-equipe.test.js`** (10 tests).
- Non touchés : `delegation.js`, `index.js`, tous les tests existants (dont `tests/api-agents.test.js` : aucune égalité
  stricte n'a cassé).

## Écarts au plan

1. **Décision du manager (liste)** : `GET /api/runs` sans paramètre rend la même liste qu'avant (sous-missions
   comprises, même ordre, mêmes clés) plus `equipe` sur chaque mère ; `?racines=1` rend la liste sans les sous-missions
   (orpheline gardée). `listRuns(store, delegation, { racines })` remplace le `{ tout }` du plan ; pas de `?tout=1`.
2. **`?equipe=1` sur `GET /api/runs/:id` (écart du codeur, à trancher)** : le plan veut que chaque entrée de `family[]`
   gagne les champs neufs sans condition. Mais `tests/equipe-01-roles.test.js` (vers la ligne 695, test « mêmes clés
   qu'avant » que la règle 4.0 impose de garder vert sans modification) fait `assert.deepEqual(Object.keys(
   view.family[0]).sort(), [...7 clés])` sur la réponse HTTP. Pour ne pas casser ce test (hors de ma liste), les champs
   neufs ne sont ajoutés qu'avec `?equipe=1` ; sans paramètre, la réponse est identique à avant. Même motif que la
   décision du manager sur la liste (défaut inchangé, nouveauté sur paramètre). L'interface neuve (swarm-09) devra
   appeler `GET /api/runs/:id?equipe=1`.
3. `teDemande` est un booléen (« au moins un membre », plan ; `needsYou` de swarm, formes.md). La partie 3.5 parle de
   « 1 te demande » : si l'interface veut un nombre, c'est un changement d'une ligne.
4. `memberView` prend en plus `{ now }` (horloge injectable) ; `privateRun` est exporté (le serveur s'en sert).
5. `modelesLimites` ajouté au catalogue quand non vide (précision du manager, au-delà du plan).

## Tests

- `node --test tests/swarm-07-vue-equipe.test.js` : 10/10 réussis. Cas : mère à trois membres (en cours, fini, échec sur
  limite d'usage) avec tous les champs ; `dureeMs = fin − debut` ; jamais démarré (`debut` nul, pas de durée) ; cause
  vide sans message ; mission privée (ni résultat ni message, `modelAnswerOf` jamais appelé, membre privé sous mère non
  privée) ; `?equipe=1` garde les clés et valeurs d'avant ; sans paramètre, 7 clés d'avant ; mission sans famille :
  mêmes clés avec ou sans `?equipe=1` ; sous-mission ouverte par son id ; `GET /api/runs` même liste et mêmes clés
  (+ `equipe` sur la mère, juste) ; `?racines=1` sans sous-missions, orpheline gardée ; mère retirée de la base :
  sous-missions gardées et toujours ouvrables ; `teDemande` (carte, accord) ; mémoire (fini une fois, en cours 2 s,
  changement d'état, `depuis` non figé, borne) ; catalogue (`etat` de chaque agent, `limite`/`jusqua`/`raison`,
  `modelesLimites`, `non_installe`, `mode_reel_eteint`).
- Existants, non modifiés : `chef-01`, `equipe-01-carnet`, `swarm-02-limites`, `api-agents`, `equipe-01-roles`,
  `delegation-v2-01-b`, `owner-mode`, `web-dir`, `platform` : 108/108 réussis.
- Contrôles négatifs faits par le codeur (code remis ensuite) : `privateRun` rendant toujours `false` → 1 test rouge ;
  filtre de `?racines=1` neutralisé → 1 test rouge.
- `npm run check` : « Syntaxe JavaScript valide. », code 0. `npm run format:check` : « All matched files use Prettier
  code style! ».
- Phase unitaire (`phase-unitaire.mjs`, 01:08-01:12) : `ℹ tests 1684` · `ℹ pass 1681` · `ℹ fail 0` ·
  `ℹ cancelled 0` · `ℹ skipped 2` · `ℹ todo 1` · `FIN phase unitaire : code 0 (durée 216 s)`. Référence de la base :
  1 674 / 1 671 ; les 10 tests du lot s'y ajoutent exactement, aucun autre chiffre ne bouge. Journal supprimé.

## Points à trancher par le manager

- Écart 2 (`?equipe=1`) : le garder, ou adapter `tests/equipe-01-roles.test.js` (hors de mon lot) pour rendre les
  champs sans condition comme le plan.
- `teDemande` booléen ou nombre (écart 3).
- Limite connue écrite dans le document : `store.list()` coupe à 200 avant le filtre `?racines=1`.
