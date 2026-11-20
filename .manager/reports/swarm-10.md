# swarm-10 — Résultat validé par schéma (outil `resultat_rendre`) — rapport du codeur

Arbre : `/Users/diaw/Downloads/agregat-back-swarm-10`, branche `swarm-10`, base `d3574af`, portage `fff07fd`.
Début : 21/11/2026 04:30 (heure lue par `date`).

## Journal

- 04:30 — Lu : brief commun (sections 1-5, 7, 9), plan (abréviations, 4.0, section swarm-10), `NOTES.md` et
  `schema-resultat.js` du portage ; dans Relay : `delegation-rule.js`, `delegation.js` (constructeur, `promptParts`,
  `call`, `launch`, `briefs`, `verdictOf`, `outcome`), `carnet.js`, `continuation.js`, `roles.js` (`normalizeVerdict`,
  `readVerdict`), `policy-engine/files.js`, `mission-gateway/server.js`, `tests/fixtures/chef-agent.js`,
  `tests/equipe-01-carnet.test.js` (E3), `tests/equipe-01-roles.test.js`, `docs/api-verdicts.md`.
- 04:31 — Rapport ouvert. Tests du lot écrits d'abord (`tests/swarm-10-resultat.test.js`, 12 tests).
- 04:32 — Première exécution (aucun module encore) : `node --test tests/swarm-10-resultat.test.js` → code 1, 1 test,
  0 réussi, 1 échec (`ERR_MODULE_NOT_FOUND … schema-resultat.js`).
- 04:33 — Portage installé tel quel : `cp .manager/portage/swarm-10/schema-resultat.js packages/orchestrator/` (en-tête
  de licence de 4 lignes en tête). Textes de `delegation-rule.js` (RESULT_TOOLS, SCHEMA_RULE, `daughterRule` à 4
  arguments, début de VERDICT_RULE, `mission_lancer.schemaResultat` et sa phrase). `resultat-valide.js` écrit.
  Branchements de `delegation.js`, `GW` et du faux agent pas encore faits.
- 04:34 — Deuxième exécution (rouge attendu) : code 1, 12 tests, 6 réussis, 6 échecs. Correction d'un test du lot
  (deuxième sous-mission fictive qui partageait le dossier de la première).
- 04:35 — Faux agent : marqueur `RESULTAT:<json>` (ligne entière). Cas rouges seuls
  (`--test-name-pattern="cas rouge"`) : code 1, 3 tests, 1 réussi (validateur pur, déjà corrigé par le portage), 2
  échecs — sorties ci-dessous.
- 04:36 — Branchements : constructeur, `call()` (une ligne avant le refus 403), `launch()` (contrôle synchrone juste
  après le contrôle `reprend`), `briefs` + écriture de `schema-resultat.json`, `promptParts()`, `outcome()`, `GW`.
  `npx prettier --write` sur mes fichiers. Tests du lot : code 0, 12/12.
- 04:37 — Précision 1 appliquée (`tests/equipe-01-carnet.test.js`). Tests existants nommés + voisins : code 0, 260/260
  (`equipe-01-carnet`, `equipe-01-roles`, `mcp-contract`, `delegation-v2-01-b`, `swarm-0*`, `equipe-01-continuer`,
  `chef-01`, `multi-agent-v3-01-b`, `multi-agent-v3-02`).
- 04:37 — Documentation : `docs/api-delegation.md` 9.10, `docs/api-verdicts.md` section 6.
- 04:38 — `npm run check` : code 0 (« Syntaxe JavaScript valide. ») ; `npm run format:check` : code 0.

### Sorties rouges (avant les branchements)

Piège du schéma au lancement (`{ properties: { a: null } }`) — le paramètre passait le schéma zod et la sous-mission
était lancée sans contrôle de forme :

```text
✖ 1. cas rouge : au lancement, schemaResultat mal formé ou racine non objet → parametres_invalides, rien de créé ; {} accepté sans schéma
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  false !== true
      at … tests/swarm-10-resultat.test.js:208:10   (assert.equal(trap.isError, true))
```

Vérificateur `{ verdict: 'a_corriger' }` sans point bloquant — aucun refus `resultat_invalide` (l'outil n'existait pas
côté plateforme ; par `verdict.json` le verdict était accepté puis marqué incomplet après coup) :

```text
✖ 3. cas rouge d’abord : vérificateur « a_corriger » sans point bloquant → refusé ; rappel avec un point bloquant → verdict complet
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + undefined
  - 'resultat_invalide'
      at … tests/swarm-10-resultat.test.js:301:10
```

- 04:38-04:41 — Phase unitaire entière (`phase-unitaire.mjs`, premier plan puis passée en arrière-plan par l'outil au
  bout de 180 s ; attendue jusqu'à sa fin) — lignes recopiées plus bas. Journal et dossier de preuves supprimés ensuite.

## Fait

- `packages/orchestrator/schema-resultat.js` : le portage du copieur, copié sans changement (pur, sans import, en-tête
  de licence en première ligne).
- `packages/orchestrator/resultat-valide.js` : `VERDICT_SCHEMA` (mot pour mot du plan), `verdictErrors` (schéma du
  verdict puis la règle de `normalizeVerdict` : 20 premiers points, `pourquoi` coupé à 500 car. puis non vide),
  `launchErrors` (forme de swarm + racine `object` ou sans `type`), classe `ResultatValide` : `schemaOf`, `given`,
  `schemaForLaunch` (refus `parametres_invalides` ; héritage pour reprise et suite), `readSchema` / `writeSchema`
  (lecture confinée bornée à 256 Ko, existence vérifiée avant pour ne créer aucun dossier, jamais d'exception),
  `call` (403 hors sous-mission ; `parametres_invalides` ; résultat > 200 000 car. ou verdict > 20 Ko refusés ;
  `resultat_invalide` avec le texte du plan ; valide → `resultat.json` / `verdict.json` par `writeConfined`, mémoire,
  événement `resultat_rendu { childId }`, `{ accepte: true }`), `of` (`{ valide: true, valeur }` / `{ valide: false,
erreurs }` / `null` ; mémoire, sinon fichier écrit entre `startedAt` et `finishedAt`). `call()` et `of()` sont
  entourés d'un `try` et rendent un refus propre ou `null`.
- `delegation-rule.js` : `RESULT_TOOLS`, `SCHEMA_RULE` (texte du plan), `daughterRule(folder, role, suite, schema)`
  (le 4e argument traverse l'appel récursif), `VERDICT_RULE` commençant par le texte du plan, `schemaResultat` et sa
  phrase dans `mission_lancer`.
- `delegation.js` : constructeur ; `call()` une ligne avant le refus 403 ; `launch()` un appel synchrone juste après le
  contrôle `reprend` (avant doublon, enveloppe, dossier et compteurs) ; `briefs.schemaResultat` + `schema-resultat.json`
  après la création ; `promptParts()` (`famille.schemaResultat` et 4e argument, pas pour un rôle de vérification) ;
  `outcome()` (`resultat` seulement quand `of()` rend quelque chose). Rien dans les compteurs, `pump`, `wake`,
  `prerequisite`, `settle`, `stopFamily`, `waitLiving` ; `index.js` et `server.js` non touchés.
- `GW` : `const TOOLS = onlyCarnet ? { ...CARNET_TOOLS, ...RESULT_TOOLS } : { ...MISSION_TOOLS, ...CARNET_TOOLS };`
  (prettier l'écrit sur trois lignes) et `RESULT_TOOLS` ajouté à l'import.
- `CHEF` : lignes `RESULTAT:<json>` → `resultat_rendre`, journal `resultat-<pid>.json` `{ tools, calls }`.
- Docs : `docs/api-delegation.md` 9.10, `docs/api-verdicts.md` section 6.

## Écarts au plan

1. Phrase de `mission_lancer` placée avant « role : … » et non en fin de description : `tests/equipe-01-roles.test.js`
   exige que la description finisse par « lisible dans terminees. » (texte de la phrase inchangé, mot pour mot).
2. Rôle de vérification : `of()` rend `null` (le verdict reste dans `verdict` de `terminees[]`, pas en double dans
   `resultat`) et le rôle ne reçoit ni `famille.schemaResultat` ni la phrase du schéma ; un `schemaResultat` donné à un
   rôle de vérification est gardé mais ignoré (la forme est celle du verdict).
3. Description de `RESULT_TOOLS.resultat_rendre` : le plan ne la cite pas ; texte écrit par moi (sans nom d'agent).
4. `{ valide: false, erreurs }` : les erreurs du dernier refus, sinon `["aucun résultat rendu"]`, seulement une fois la
   sous-mission finie et quand un schéma était demandé.
5. Héritage (précision 6) : seulement quand `schemaResultat` est absent ; une reprise qui donne `{}` n'hérite pas
   (sens de swarm : `{}` arrête l'héritage).
6. Résultat accepté mais non écrit (dossier absent ou écriture refusée) : `{ accepte: true, note }` au lieu de
   `{ accepte: true }`.
7. `MALFORMED_SCHEMA` (texte du portage, non cité par le plan) gardé : il ne sert que pour un schéma relu mal formé, ce
   que `readSchema` écarte déjà ; en pratique jamais montré.

## Tests

- Lot : `node --test tests/swarm-10-resultat.test.js` → code 0, 12 tests, 12 réussis. Les 7 cas du plan (1 : trois
  tests ; 2 : intégration + classe ; 3 : intégration + `verdictErrors` / verdict trop long ; 4 et 5 : un test ; 6 ; 7),
  plus l'héritage reprise/suite et `daughterRule` à 4 arguments.
- Existants nommés (précision 11) et voisins, sans modification hors précision 1 : 260/260, code 0.
- Phase unitaire entière (référence 1 778 / 1 775 / 0 / 2 / 1) :

```text
ℹ tests 1790
ℹ pass 1787
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ todo 1
FIN phase unitaire : code 0 (durée 209 s)
```

- `npm run check` : code 0 ; `npm run format:check` : code 0.

### Tests existants modifiés

- `tests/equipe-01-carnet.test.js` ligne 249 (précision 1) :
  `assert.deepEqual(log.tools, ['carnet_noter', 'carnet_lire']);` →
  `assert.deepEqual(log.tools, ['carnet_noter', 'carnet_lire', 'resultat_rendre']);`. Rien d'autre.
- Aucun test n'a rougi à cause du nouveau début de `VERDICT_RULE` (les tests lisent la constante).

## Points à trancher par le manager

1. Écart 1 (place de la phrase dans la description de `mission_lancer`).
2. Écart 2 (verdict d'un rôle de vérification hors de `resultat` ; `schemaResultat` ignoré pour ce rôle, sans le dire au
   chef).
3. `famille.precedent` d'une suite ne porte pas le résultat analysé de la précédente (`continuation.js` hors du lot).
4. Les maps `kept` / `refused` de `ResultatValide` ne sont jamais vidées (comme `briefs`) : petite mémoire par
   sous-mission, jusqu'au redémarrage.
5. Non vérifié : un agent réel (aucun lancé) ; le comportement des clients MCP réels avec `z.record` en paramètre
   (vérifié seulement avec le client MCP du dépôt, par le faux agent).

Fin : 04:42.

## Relecture indépendante

Relecteur indépendant, 21/11/2026 04:44-04:57 (heures lues par `date`). Base `d3574af`, commits relus `fff07fd`,
`f3da6e2`, `a41b0c3`.

### Contrôles

- Périmètre : seuls les fichiers autorisés sont touchés (`git diff d3574af..HEAD --stat`) ; `index.js` et
  `apps/api/server.js` intacts ; `tests/` : le fichier du lot, `chef-agent.js` et la seule ligne 249 de
  `tests/equipe-01-carnet.test.js`.
- `delegation.js` ligne par ligne : import, constructeur, `promptParts()` (schéma, 4e argument), une ligne dans `call()`
  avant le refus 403, un appel synchrone dans `launch()` juste après le contrôle `reprend` (avant doublon, enveloppe,
  dossier, compteurs ; aucun `await` ajouté), `briefs.schemaResultat` et `writeSchema` après la création, `outcome()`.
  Rien dans les compteurs, `pump`, `wake`, `prerequisite`, `settle`, `stopFamily`, `waitLiving`.
- Textes mot pour mot du plan : phrase de `mission_lancer`, `SCHEMA_RULE`, début de `VERDICT_RULE`, message
  « Le résultat ne respecte pas… Corrige et rappelle resultat_rendre. », `VERDICT_SCHEMA`. Aucun nom d'agent, de
  modèle, de Skill ni de site.
- Fidélité à swarm (fichiers d'origine relus) : `validate`, `matchesType`, `findJsonSchemaShapeErrors`,
  `isEffectiveOutputSchema` : mêmes cas, même ordre ; écarts voulus et commentés (propriétés propres au lieu de `in`,
  sous-schéma non objet = erreur, profondeur bornée à 32, valeurs citées bornées). En-tête de licence en première
  ligne ; fichier pur (aucun import).
- Cloisonnement : identité prise du jeton (`mother` de `call()`), paramètres stricts (un `childId` de plus est refusé) ;
  403 hors sous-mission ; le chef n'a pas l'outil ; une sous-mission n'a aucun outil de mission.

### Constats

1. Mineur, corrigé : messages non bornés en longueur. Un nom de propriété très long (10 000 caractères) donnait un
   refus `parametres_invalides` de 20 183 caractères au chef, et autant dans `resultat_invalide` / `erreurs`. Test rouge
   d'abord (`swarm-10-relecture`, 20 183 > 2 000), puis chaque erreur coupée à 300 caractères (`MAX_ERROR_CHARS`) dans
   `invalidMessage`, le refus au lancement, `refused` et `of()`. Le début des textes du plan ne change pas.
2. Mineur, corrigé (test manquant) : rien ne vérifiait qu'un `schemaResultat` donné à un rôle de vérification n'arrive
   pas dans son prompt (contrôle négatif N9 resté vert). Le test 3 du lot donne désormais ce schéma au vérificateur et
   vérifie l'absence de `famille.schemaResultat` et de la phrase du schéma.
3. Laissé (conforme au plan, à connaître) : `of()` relit `resultat.json` même sans schéma ; un fichier de ce nom
   écrit par l'agent lui-même (sans l'outil) pendant l'exécution apparaît donc dans `terminees[].resultat` (jusqu'à
   1 Mo lu). Voir points à trancher.

### Contrôles négatifs (chaque fichier copié, modifié, tests du lot relancés, remis, `cmp` identique)

N1 ligne de `call()` retirée : 4 échecs · N2 refus au lancement neutralisé : 2 · N3 `GW` sans `RESULT_TOOLS` : 4 ·
N4 règle du verdict sans point bloquant retirée : 3 · N5 `resultat` retiré d'`outcome()` : 3 · N6 écriture de
`schema-resultat.json` retirée : 1 · N7 récursion de `daughterRule` sans le 4e argument : 2 · N8 fenêtre de temps du
fichier retirée : 2 · N9 schéma donné au vérificateur : 0 puis 1 après le test ajouté · N10 `.strict()` retiré : 1 ·
N11 racine `object` non contrôlée : 1 · N12 bornes des erreurs retirées : 1 · N13 héritage retiré : 1 · N14 403 hors
sous-mission retiré : 1. Dossier de preuves supprimé.

### Tests ajoutés

`tests/swarm-10-relecture.test.js` (5 tests) : identité de l'appelant et paramètre en trop ; dossier hostile
(`../`, absolu, `relay/../../`) et liens symboliques (`resultat.json`, `schema-resultat.json`) : rien d'écrit hors de
l'espace, accepté avec une note ; valeur cyclique, schéma mal formé en mémoire, magasin qui lève, schéma de 5 000
niveaux, noms très longs, 501 erreurs : aucune exception, messages bornés ; fichiers falsifiés après un redémarrage
(JSON illisible, valeur hors forme, schéma piège de swarm, tableau, fichier de plus de 256 Ko) ; vérificateur
« approuve » avec des points bloquants accepté, schéma du chef ignoré, refus qui n'écrit rien. Plus deux assertions
dans le test 3 du lot.

### Totaux

- Lot + relecture : 17/17. Existants nommés (`equipe-01-carnet`, `equipe-01-roles`, `mcp-contract`,
  `delegation-v2-01-b`) avec le lot : 64/64, non modifiés hors la ligne 249 autorisée.
- Phase unitaire entière (référence 1 778 / 1 775) :

```text
ℹ tests 1795
ℹ pass 1792
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ todo 1
FIN phase unitaire : code 0 (durée 189 s)
```

- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : tous les fichiers conformes.

### Points à trancher par le manager

1. `of()` sans schéma : un `resultat.json` écrit par l'agent sans l'outil remonte au chef (plan : « le fichier s'il a
   été écrit pendant l'exécution »). Le limiter aux sous-missions qui ont un schéma ou qui ont appelé l'outil, ou
   abaisser la borne de lecture (1 Mo), si l'on veut que « sans schéma, rien ne change » soit strict.
2. Points 1 à 5 du codeur (place de la phrase, verdict hors `resultat`, `precedent` d'une suite, mémoire non vidée,
   clients MCP réels non essayés) : inchangés.

Verdict : `bon_a_integrer`.
