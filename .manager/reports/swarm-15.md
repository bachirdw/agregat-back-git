# swarm-15 — Leçons durables : branchement dans l'équipe (rapport du codeur)

Arbre `/Users/diaw/Downloads/agregat-back-swarm-15`, branche `swarm-15`, base `03f3178`. Début : 21/11/2026 10:04.

## Journal

- 10:04 Lu : brief commun (sections 1-5, 7, 9), plan (abréviations, 4.0, swarm-03, swarm-15), portage
  (`NOTES.md`, `textes-lecons.md`), fichiers de Relay à modifier, `packages/orchestrator/lecons.js` (lecture seule).
- Constat : `docs/api-lecons.md` existe déjà (lot 03) ; il est complété (nouvelle section), pas recréé.
- Constat : ajouter les deux outils à la liste du CHEF de la passerelle (plan, `GW:14`) rend rouges deux égalités
  strictes qui ne sont pas dans la liste autorisée : `tests/chef-01.test.js` (vers la ligne 220) et
  `tests/equipe-01-carnet.test.js` (vers la ligne 147). Non modifiées : signalées (voir Points à trancher).
- Constat : la passerelle est lancée avec le seul `env` de la déclaration du serveur (`connectMcp` →
  `StdioClientTransport` : environnement par défaut + `env` déclaré) ; le réglage ne lui arrive que s'il est dans cet
  `env`, construit par `Delegation.servers()` (chef) et `Carnet.servers()` (sous-mission), deux fonctions hors de la
  liste du lot. Une ligne ajoutée dans chacune (seulement quand le réglage vaut `0`) : voir Écarts.
- 10:12 Code écrit (DR, CA `note()`, DJ, GW, SV), puis `tests/swarm-15-lecons-equipe.test.js`. Premier passage :
  8/9 ; cause : `rappel()` rend `extrait` et non `texte`, la ligne de `ligneLecon` sortait sans extrait ; corrigé en
  passant l'extrait comme `resume` (`ligneLecon({ ...lecon, resume: lecon.extrait })`). Deuxième passage : 9/9.
- 10:15 Tests liés rejoués (equipe-01-carnet, swarm-10-resultat, chef-01, swarm-01-decision, mcp-contract,
  delegation-v2-01-b, equipe-01-roles, swarm-03-*, swarm-14-*) : 124 tests, 122 réussis, 2 échecs attendus (listes
  d'outils du chef, ci-dessous). `npm run check` : code 0. `npm run format:check` : vert.

## Fait

- `delegation-rule.js` : `carnet_noter` gagne `durable: z.boolean().optional()` et la phrase `CARNET_DURABLE` (mot pour
  mot du plan) en fin de description ; `CARNET_TOOLS_SANS_LECONS` (l'outil d'avant, pour le réglage `0`) ;
  `LECON_TOOLS` (`lecon_lire { id }`, `lecon_utile { id, utile, raison? }`, `raison` ≤ 300) ; `CHIEF_LECONS` et
  `DAUGHTER_LECONS` (mot pour mot) ; `LECON_NATURE`, `LECON_MESSAGES`, `leconsLine()` (ligne de Bilan).
- `carnet.js` `note()` : note identique (texte normalisé par `normaliserEcho`) du même auteur → `{ n, total, deja: true }`
  sans rien écrire ; `durable: true` → `delegation.garderLecon(...)`, résultat joint sous `lecon` ; sans `durable`, le
  résultat est `{ n, total }` comme avant.
- `delegation.js` : constructeur (`leconsOn`, `lecons` = `<dataDir>/lecons`, `leconsPrivees` par espace, `servies` par
  exécution) ; `promptParts()` (champ `lecons` du chef, `famille.lecons` d'une sous-mission, phrases insérées juste après
  celles du carnet, rien quand rien ne passe) ; `call()` (route de `LECON_TOOLS`) ; `ended()` (citation par la réponse du
  membre, `modelAnswerOf`) ; `familyBilan()` (citation du chef par `chiefAnswer`, ligne « Leçons : … »). Bloc neuf de
  méthodes « swarm-15 » : `leconsDe`, `leconsPrive`, `servir`, `garderLecon`, `leconCall`, `citerLecons`, `leconsBilan`,
  `leconsRoute`. Chaque appel au module est enveloppé (`sur`) ; un échec = pas de leçon.
- `mission-gateway/server.js` : `LECON_TOOLS` dans les deux listes ; `AGENT_PLATFORM_LECONS=0` → ni les deux outils ni
  `durable`.
- `apps/api/server.js` : deux routes seulement (diff ci-dessous), même position et mêmes contrôles que les voisines.
- `docs/api-lecons.md` § 8 (existait déjà depuis le lot 03 : complété, intro mise à jour) ; `docs/api-delegation.md` § 7 bis.

Diff de `apps/api/server.js` (22 lignes ajoutées, aucune autre ligne changée) :

```js
      // swarm-15 : les leçons durables d'une portée (`espace=prive` : mode propriétaire seulement).
      if (req.method === 'GET' && path === '/api/lecons') {
        const { status, body } = engine.delegation.leconsRoute({
          espace: url.searchParams.get('espace'),
          ownerMode,
          portee: url.searchParams.get('portee'),
        });
        return json(res, status, body);
      }
      ...
      // swarm-15 : promouvoir, remplacer ou supprimer une leçon (`espace: 'prive'` : mode propriétaire).
      const lecon = path.match(/^\/api\/lecons\/([a-z0-9][a-z0-9_-]{0,63})\/(l-[0-9a-f]{16})$/);
      if (lecon) {
        const { status, body: done } = engine.delegation.leconsRoute({
          espace: body.espace, ownerMode, portee: lecon[1], id: lecon[2], action: body.action, par: body.par,
        });
        return json(res, status, done);
      }
```
(la première après `/api/catalog`, avant `GET /api/runs` ; la seconde après `POST /api/runs`, donc après le garde
`x-platform-request` + JSON).

## Écarts au plan

1. **Passage du réglage à la passerelle** : une ligne dans `Delegation.servers()` (chef) et une dans `Carnet.servers()`
   (sous-mission), hors des fonctions nommées : `{ name: 'AGENT_PLATFORM_LECONS', value: '0' }` ajouté à l'`env` du
   serveur **seulement quand le réglage vaut `0`** (sinon l'`env` est inchangé). Sans elles, la passerelle ne voit jamais
   le réglage (`connectMcp` ne transmet que l'`env` déclaré). Prouvé par le test « réglage 0 » (mission entière).
2. Méthodes neuves dans `delegation.js` (bloc « swarm-15 » après `promptParts()`), en plus des fonctions nommées.
3. Textes ajoutés dans `delegation-rule.js` au-delà de la liste (messages des outils, `LECON_NATURE`, `leconsLine`,
   `CARNET_DURABLE`, `CARNET_TOOLS_SANS_LECONS`) : règle 4.0 « tout texte donné aux agents s'écrit dans DR ».
4. `docs/api-lecons.md` existait (lot 03) : complété, pas créé.
5. `durable: true` avec une catégorie autre que `methode`/`piege`/`decision` (le plan ne dit rien) : la note est gardée,
   `lecon: { statut: 'refusee', message }` dit pourquoi.
6. Chef dont le propriétaire a refusé les sous-agents : `CHIEF_REFUSED` ne contient pas la phrase du carnet ;
   `CHIEF_LECONS` y est ajoutée à la fin, son « ; » final remplacé par un point.
7. `raison` de `lecon_utile` : non conservée (aucun événement de note dans le plan) ; dit dans la description de l'outil
   et dans la documentation.
8. Ligne de Bilan : leçons **distinctes** servies / citées dans la famille ; « gardées » = événements `lecon_gardee` de
   l'exécution de la mère ; accords au pluriel au-delà de 1 (« 0 servie, 0 citée, 1 gardée »).

## Tests

- `tests/swarm-15-lecons-equipe.test.js` : 9 tests, 9 réussis. Couverture : mission 1 garde (fichier écrit, événement
  `lecon_gardee { id }`) ; note identique → `deja: true` ; trop courte → note gardée, leçon refusée avec
  `MESSAGES.trop_courte` ; sans `durable` → `{ n, total }` exact ; mission 2 voisine → chef (`lecons`) et sous-mission
  (`famille.lecons`) reçoivent titre, extrait, identifiant, une ligne ; phrases après celles du carnet ; `lecon_lire`
  (texte entier ; inconnue → refus clair) ; `lecon_utile` deux fois → une note, non servie → refus ; réponse du membre
  lisible à sa fin et citée, réponse du chef citée (`citee` = 2) ; `raison` absente du fichier ; ligne de Bilan ; demande
  sans rapport → rien, prompt d'avant ; pas de sous-mission → pas de ligne (limite) ; routes lister / promouvoir
  (`expire: null`) / remplacer / supprimer, erreurs 400 / 403 / 404 ; réglage `0` (mission entière) → ni champ, ni phrase,
  ni outil, ni `durable`, routes 404 ; module qui lève à chaque méthode (mission entière, puis unitaire sur citer,
  noterUtilite, liste) → mission identique, aucune erreur ; mission privée → leçon dans l'espace, rien en base ni dans
  `<dataDir>`, routes de l'espace en mode propriétaire seulement ; autre pack → rien ; portée hors format → pas de leçon,
  note gardée ; prompts chef / sous-mission sans leçon identiques à l'octet (JSON comparé) à ceux de la base et du réglage
  `0` ; passerelle lancée seule : deux listes avec les outils, `AGENT_PLATFORM_LECONS=0` les retire avec `durable` ;
  textes mot pour mot et sans nom d'agent.
- Tests existants adaptés (les trois autorisés, liste attendue seulement) : `tests/equipe-01-carnet.test.js:249`,
  `tests/swarm-10-resultat.test.js:251` et `:420` (ajout de `lecon_lire`, `lecon_utile`).
- **Tests existants rouges, non modifiés** (hors liste autorisée) : la liste des outils du **chef** gagne aussi les deux
  outils (plan : « les deux listes ») :
  - `tests/chef-01.test.js:220` (test « sans delegation : outils et phrase prêtés… », ligne 144) ;
  - `tests/equipe-01-carnet.test.js:147` (test « E3. le chef note… », ligne 122).
  Il suffit d'ajouter `'lecon_lire', 'lecon_utile'` en fin de la liste attendue. `tests/mcp-contract.test.js` : vert.

### Phase unitaire entière (outil du brief, terminée à 10:26 le 21/11)

```
ℹ tests 1892
ℹ pass 1887
ℹ fail 2
ℹ cancelled 0
ℹ skipped 2
ℹ todo 1
FIN phase unitaire : code 1 (durée 381 s)
```
Référence de la base : 1 883 / 1 880. Les 9 tests du lot s'ajoutent (1 892). Les 2 échecs sont exactement les deux
listes d'outils du chef citées plus haut (`tests/chef-01.test.js:144`, assertion ligne 220 ;
`tests/equipe-01-carnet.test.js:122`, assertion ligne 147), causées par ce lot. La troisième entrée « test at » du
journal (`tests/review2-lecture-18-11.test.js:248`) est le test « à faire » (⚠) déjà connu. `npm run check` : code 0 ;
`npm run format:check` : « All matched files use Prettier code style! ». Journal supprimé.

## Points à trancher par le manager

1. **Deux tests rouges hors liste** (ci-dessus) : autoriser l'ajout de `'lecon_lire', 'lecon_utile'` à la liste
   attendue du chef dans `tests/chef-01.test.js:220` et `tests/equipe-01-carnet.test.js:147`, ou décider de ne pas
   prêter les outils au chef (écart au plan). Je n'y ai pas touché.
2. **Lignes hors fonctions nommées** : `Delegation.servers()` et `Carnet.servers()` (passage du réglage, seulement
   quand il vaut `0`). À valider.
3. **Route de liste** : forme choisie, la plus simple : `GET /api/lecons?portee=<p>` lit `<dataDir>/lecons` ;
   `&espace=prive` lit `<espace propriétaire>/relay/lecons` (dossier `engine.career.path()`) et n'est servi qu'en mode
   propriétaire (403 sinon) ; même `espace: 'prive'` dans le corps du POST. Une mission privée dont l'espace n'est pas
   celui du propriétaire (autre `cwd`) n'est pas joignable par la route.
4. `raison` de `lecon_utile` non conservée (aucun événement de note prévu) ; à garder dans un événement si voulu.
5. Identifiants servis gardés en mémoire seulement (`servies`) : un redémarrage ou une reprise les perd (plus de
   `lecon_utile` ni de citation pour ces leçons) ; la carte n'est jamais vidée (petite, des identifiants).
6. Limite documentée : un chef sans sous-mission n'a ni ligne « Leçons » ni citation (`familyBilan()` rend `''`).
7. Note identique → `deja: true` appliquée avec ou sans `durable`, même au réglage `0` (comportement du carnet).
