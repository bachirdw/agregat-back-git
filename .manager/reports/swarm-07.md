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

## Relecture indépendante

Relecteur, 21/11/2026 (01:10-01:22, heures lues par `date`). Repris du plan, du diff `e18ef06..HEAD` et du code.

### Constats

- **Majeur, corrigé** — Robustesse : une lecture qui lève (`line()`, `outcome()`, `modelAnswerOf`, `store.events`,
  `childrenOf`, `hasFamily`, `heldState`) faisait échouer `GET /api/runs` et `GET /api/runs/:id?equipe=1` (réponse 400
  du gestionnaire d'erreurs, constatée rouge). Désormais le champ manque, l'entrée garde ses champs d'avant, la mère
  est rendue sans `equipe`.
- **Majeur, corrigé** — Mémoire : un membre fini, repris sur place (`resume` remet `queued`, puis il finit de nouveau)
  sans appel entre-temps gardait l'ancien `resultat` et l'ancienne durée (clé = état seul). La clé de validité porte
  maintenant l'état, `startedAt` et `finishedAt`.
- **Mineur, corrigé** — `resultat`/`cause.message` coupaient un emoji en deux (`\ud83d` seul en fin, constaté rouge).
- **Décision du manager, appliquée** — `teDemande` est un nombre (0 quand personne n'attend) ; tests du codeur adaptés,
  document mis à jour.
- **Mineur, corrigé** — `docs/api-equipe-vue.md` : bloc `equipe` déformé par Prettier (`(membres, …);`), remplacé par
  un exemple JSON ; ajoutés : `teDemande` nombre, robustesse, coupe sûre, recalcul d'un membre repris, retard ≤ 2 s
  de `inactiveDepuis` pour un membre en cours.
- **Mineur, laissé** — Pour un membre privé, `doneOf()` est appelé (pour `usage`) et lit le fichier privé `fichiers`
  sans rien en rendre. Rien ne sort ; à revoir avec swarm-14 (`usage`), qui écrira peut-être `child_done` après le
  passage en `completed` : la mémoire d'un membre fini ne verrait alors pas `usage` arrivé plus tard.
- **Info** — `agentState` sans mode réel : agent simulé `pret`, installé `mode_reel_eteint` (raison « Mode réel
  désactivé »), absent `non_installe` ; une limite n'apparaît qu'en mode réel (ordre voulu par swarm-02). En mode réel,
  une limite à venir donne `etat: 'limite'`, `raison`, `jusqua` (test du codeur).
- **Info** — `dernierOutil` d'un membre privé : le titre d'outil stocké pour un espace career-ops est déjà réduit au nom
  de l'outil (`storedToolTitle`) ; `motif` n'est pas rendu par `memberView` ; `pourquoi` est une valeur fermée.

### Vérifications

- Périmètre : seuls `team-view.js`, `server.js`, `docs/api-equipe-vue.md`, les deux fichiers de tests du lot, le
  portage et ce rapport sont touchés ; `delegation.js`, `index.js` et les tests existants ne le sont pas.
- « Rien d'existant ne change », comparé à la base : le `server.js` de `e18ef06` chargé à part (copie temporaire,
  supprimée) et le serveur du lot sur la même base fictive (seule, mère publique à 4 membres, mère privée) : liste dans
  le même ordre et égale clé par clé et valeur par valeur hors `equipe` (2 mères) ; `GET /api/runs/:id` sans paramètre
  identique pour la mission seule, les mères et chaque sous-mission ; catalogue égal hors `etat`, `raison` ; autres
  clés du catalogue identiques.
- Interface (`agregat-front-equipe/src`) : lit `/runs`, `/runs/:id`, `/catalog` ; type `Run` (`family`, `activity`,
  champs de l'exécution) et `Agent` (`id`, `installed`, `compatible`, `reason`, `probe`…) : aucune de ces clés ne change ;
  `equipe`, `etat`, `raison`, `jusqua` n'y sont pas lus.
- Charge (200 exécutions : 80 seules, 20 mères de 5 membres, 30 événements par membre) : par appel de `GET /api/runs`,
  1 `store.list()` + 20 `store.children()`, aucune lecture d'événements ; médiane 6,5 ms (max 29 ms) par HTTP, `?racines=1`
  6,6 ms (100 `store.get` en plus) ; `GET /api/runs/:id?equipe=1` 3,6 ms. Pas de mémoire courte nécessaire.

### Contrôles négatifs (code remis ensuite, arbre vérifié)

`privateRun` du membre retiré → 2 rouges ; `prive` de la mère forcé à faux dans le serveur → 1 rouge ; `agentState`
retiré du catalogue → 1 rouge ; `equipe` retiré de la liste → 3 rouges ; `teDemande` jamais incrémenté → 3 rouges ;
protections de `teamSummary` retirées → 1 rouge ; `?equipe=1` toujours vrai → `tests/equipe-01-roles.test.js` rouge
(justifie le paramètre). Coupe des emoji, clé de mémoire et protection de `withTeam` : vus rouges avant correction.

### Tests

- Ajouté `tests/swarm-07-relecture.test.js` (6 tests) : `teDemande` nombre (3 cas d'attente, 0 sinon, par HTTP) ;
  lecture qui lève → 200, champs d'avant, mère sans `equipe` ; réponse illisible → pas de `resultat` ; emoji en bord de
  coupe ; membre repris sur place recalculé ; membre privé sous mère publique et l'inverse, par les deux routes, avec
  un témoin public qui voit le texte.
- Lot + existants nommés (`api-agents`, `chef-01`, `equipe-01-carnet`, `equipe-01-roles`, `delegation-v2-01-b`,
  `swarm-02-limites`) : 97/97.
- Phase unitaire : `ℹ tests 1690` · `ℹ pass 1687` · `ℹ fail 0` · `ℹ cancelled 0` · `ℹ skipped 2` · `ℹ todo 1` ·
  `FIN phase unitaire : code 0 (durée 205 s)` (base 1 674 / 1 671 + 16 tests du lot). `npm run check` : « Syntaxe
  JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code style! ».

### Points à trancher par le manager

- `?equipe=1` sur `GET /api/runs/:id` : à garder (décision prise) ; l'interface neuve (swarm-09) doit l'appeler.
- Limite connue : `store.list()` coupe à 200 avant le filtre `?racines=1` (écrit dans le document).
- swarm-14 : vérifier que `usage` d'un membre fini arrive avant ou avec `finishedAt`, sinon invalider la mémoire.

Verdict : `bon_a_integrer`.
