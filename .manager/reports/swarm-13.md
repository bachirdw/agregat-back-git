# swarm-13 — Tour de rattrapage sur un verdict négatif (codeur, 21/11/2026 05:40-05:55)

Arbre `/Users/diaw/Downloads/agregat-back-swarm-13`, branche `swarm-13`, base `a8660a4`, portage `6ca3e84`.

## Fait

- `packages/orchestrator/taches.js` : `dettes({ children, nonRemises })` et `MAX_BLOQUANTS` (10) versés depuis le
  portage (aides locales retirées : celles du fichier servent) ; trois lignes de licence ajoutées en tête
  (`validation.ts`, `engine.ts`, `FINDINGS.md`). Le fichier reste pur, sans import. `illisible: true` gardé (source
  `absent`).
- `packages/orchestrator/delegation-rule.js` : `VERDICT_NOTE` (première phrase) et `VERDICT_TURN`
  (`VERDICT_NOTE` + la suite), mot pour mot du plan, à côté de `SYNTHESIS_TURN`.
- `packages/orchestrator/delegation.js` :
  - constructeur : `this.rattrapage = process.env.AGENT_PLATFORM_VERDICT_TURN !== '0'` ;
  - `synthesis()` : `if (!given.length) return null;` → `return this.verdictTurn(mother, family, runtime, control);` ;
    dans l'objet rendu, `verdictsEnAttente` (après `retoursSynthese`) et `SYNTHESIS_TURN + ' ' + VERDICT_NOTE`,
    seulement avec une dette (calculée après `waitLiving`) ; ce cas pose aussi `family.verdictTurn` et écrit
    `verdict_turn` (précision 3). Les autres sorties sont inchangées (`control.mere`, `missed`, `return null`) ;
  - méthodes neuves : `detteOf(mother, family)` (lignes de `childrenOf` sans `REFUSED_CHILD`, verdict lu par
    `verdictOf`, le tout sous `sur` : erreur imprévue → `null`), `verdictGiven` (drapeau + événement
    `verdict_turn { taches }`, ids de 8 caractères), `verdictTurn(mother, family, runtime, control)` (gardes dans
    l'ordre : réglage, déjà donné, abandon `control.abort.signal.aborted`, dette, puis `continueSession()` en dernier),
    `verdictsJoints` (cas du tour de synthèse), `verdictBilanLine(mother)` ;
  - `familyBilan()` : la ligne « Réponse finale donnée malgré … ; tour de rattrapage donné au chef : oui | non. »
    ajoutée en dernier (après la section et la ligne des motifs), « oui » lu sur l'événement durable `verdict_turn`
    de l'exécution.
  - Rien dans `launch()`, `pump()`, `wake()`, `prerequisite()`, `settle()`, `stopFamily()`, `waitLiving()` ;
    `index.js`, `roles.js`, `family-bilan.js` non touchés.
- `docs/api-delegation.md` (tour de synthèse + section 9.13) et `docs/api-verdicts.md` (section 7 : dette, tour, ligne
  de Bilan, limites connues de la précision 5).
- `tests/swarm-13-rattrapage.test.js` : 12 tests (les 7 cas, la garde d'erreur, l'ordre des gardes et
  `continueSession()` en dernier, le verdict illisible et l'événement sans texte, `dettes` pure, les textes).

## Écarts au plan

1. Ligne de Bilan écrite seulement quand le chef a donné une réponse finale (`chiefAnswer` non vide) : une mère en
   échec (`failureSection`, sans `chiefAnswer`) ne dit pas « Réponse finale donnée malgré … » (ce serait faux). Le
   plan dit « quand la dette existe encore à la fin ». À trancher.
2. Le réglage `0` retire aussi les verdicts joints au tour de synthèse (cas 4), pas seulement le tour de rattrapage :
   lecture « additif, éteint = comportement d'aujourd'hui ». À trancher.
3. `synthesis()` : en plus de la ligne `return null`, le `if (... continueSession()) return {…}` devient un bloc
   `{ const attente = …; return {…}; }` et la ligne `instructions` change (ajout demandé par la précision 1).
4. `verdictTurn` reçoit `control` en 4e argument (précision 2 ; le plan en donne trois).
5. Ligne de Bilan construite dans `delegation.js` (méthode `verdictBilanLine`), pas dans `DR` ni `family-bilan.js`.

## Tests

- Cas 1 vu ROUGE sur le code de base (test seul, avant tout code) :
  `ℹ tests 1 / ℹ pass 0 / ℹ fail 1` — `AssertionError [ERR_ASSERTION]: un seul tour donné au chef` ;
  `actual: 0, expected: 1` (la mission finissait sans tour). Vert après le branchement.
- Garde d'erreur : test écrit après le code ; rouge vu par contrôle négatif (garde `sur` retirée un instant dans
  `detteOf`) : `ℹ tests 1 / ℹ pass 0 / ℹ fail 1`, `Error: lecture FICTIVE en échec` ; code remis (diff vérifié).
- `node --test tests/swarm-13-rattrapage.test.js` : 12/12.
- Lot + tests existants nommés (non modifiés) : `swarm-13-rattrapage`, `delegation-v2-01-a`, `delegation-v2-01-b`,
  `multi-agent-v3-02`, `multi-agent-v3-02-c`, `equipe-01-relecture`, `equipe-01-roles`, `equipe-01-continuer`,
  `equipe-01-carnet`, `chef-01`, `review-delegation-v2-01`, `swarm-04-verdict`, `swarm-04-relecture`,
  `swarm-12-retours`, `swarm-12-relecture` : 144 tests, 144 réussis, 0 échec.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code
  style! ».
- Phase unitaire (`phase-unitaire.mjs`, 05:47-05:53) : `ℹ tests 1829` · `ℹ pass 1826` · `ℹ fail 0` ·
  `ℹ cancelled 0` · `ℹ skipped 2` · `ℹ todo 1` · `FIN phase unitaire : code 0 (durée 192 s)`. Référence 1 817 / 1 814
  + les 12 tests du lot ; aucun autre chiffre ne bouge. Journal supprimé.

## Points à trancher par le manager

- Écarts 1 et 2 ci-dessus.
- Limites écrites, non corrigées (`docs/api-verdicts.md` 7.4) : mère reprise sans relance → pas de tour (Bilan « non ») ;
  après une reprise, un tour peut être redonné ; ordre de `childrenOf` sur une mère reprise ; une correction encore
  vivante après le tour de rattrapage n'a plus de synthèse (Bilan « Synthèse finale non faite »), et le verdict lu à la
  fin peut alors être `approuve` sans que le chef l'ait vu.
- Le verdict d'un vérificateur `interrupted` au redémarrage n'est pas essayé.

## Relecture indépendante (21/11/2026 05:54-06:08)

Relu : plan (4.0, section swarm-13), diff `a8660a4..HEAD` fichier par fichier, rapport du codeur, portage et NOTES,
`synthesis()` comparée à `git show a8660a4:packages/orchestrator/delegation.js`, l'appel du moteur (`index.js`,
`familyTurn` : `synthesis()` une fois par exécution), `continueSession()` (`agent-runtime` : effet seulement quand il
rend vrai), passages de swarm (`validation.ts:99-116`, `engine.ts:1243-1249`, `FINDINGS.md:255-268`) : fidèles.

Périmètre : seuls les fichiers autorisés ; `index.js` non touché ; rien dans `launch()`, `pump()`, `wake()`,
`prerequisite()`, `settle()`, `stopFamily()`, `waitLiving()` ; aucun test existant modifié.

### Point 1 (`synthesis()` sans dette = base) : prouvé par différence

`tests/swarm-13-relecture.test.js` recopie MOT POUR MOT la `synthesis()` de `a8660a4` et la joue sur la même classe
que celle d'aujourd'hui, sur deux familles fictives identiques, pour 10 chemins (rien à remettre ; résultats à
remettre ; sous-mission vivante ; pas une mère ; mode multi-agent éteint ; abandon ; abandon pendant l'attente ;
session fermée ; session fermée après l'attente ; session fermée sans rien à remettre) × 3 familles sans dette (sans
vérification ; `approuve` ; `a_corriger` puis suite revérifiée `approuve`) : tour rendu (dont `instructions` à l'octet),
événements, nombre d'appels à `continueSession()`, `delivered`, `unsynthesized` et Bilan identiques : 30/30. Plus les
10 chemins avec une vraie dette et le réglage `0` : tour, événements, appels identiques à la base : 10/10.
Avec une dette, sur chaque chemin où la base ne donne pas de tour, toujours `null` et mêmes événements ; seul écart :
« session fermée, rien à remettre » demande `continueSession()` une fois (rend faux, sans effet) : voulu par le plan.

### Constats

- Majeur, corrigé : `verdictsEnAttente` n'était borné qu'en points (10) ; rien ne bornait le nombre de tâches (jusqu'à
  la centaine par exécution avec l'enveloppe à 200, davantage sur une chaîne reprise). Ajout `MAX_EN_ATTENTE = 20`
  (`taches.js`), appliqué dans `verdictGiven` (tour et verdicts joints, et la liste de l'événement) ; le Bilan compte
  et nomme toujours toutes les dettes. Pire cas : 20 × 10 × 1 000 caractères. Test rouge d'abord (25 dettes : 25 rendues).
- Mineur, corrigé : l'écriture de `verdict_turn` n'était pas gardée : un magasin qui lève à ce moment, après
  `continueSession()`, faisait lever `synthesis()` et échouer la mission. Gardée par `sur` (drapeau posé avant) : le
  tour est donné. Test rouge d'abord (`Error: écriture FICTIVE en échec`).
- Vérifié sans défaut : `continueSession()` en dernier ; drapeau avant l'événement ; pas de tour si abandon, session
  fermée, réglage 0, déjà donné ; erreur dans le calcul (lecture du verdict qui lève) → `null` ; événement à
  identifiants de 8 caractères ; titres = ceux déjà en base (génériques pour une mission privée) ; « oui » relu sur
  l'événement après redémarrage simulé (nouvelle instance) ; textes `VERDICT_TURN` / `VERDICT_NOTE` mot pour mot du
  plan ; ligne de Bilan mot pour mot ; `taches.js` reste pur ; en-têtes de licence présents ; docs fidèles.

### Contrôles négatifs (chacun retiré un instant, fichier remis puis vérifié par `cmp`)

`return null` remis à la place de `verdictTurn` → 10 rouges ; verdicts joints retirés → 1 ; garde « déjà donné »
retirée → 3 ; `continueSession()` avant la dette → 8 ; garde d'abandon retirée → 1 ; ligne de Bilan retirée → 6 ;
garde de l'événement retirée → 1 ; borne `MAX_EN_ATTENTE` retirée → 1 ; consigne sans dette changée → 10 ;
`approuve` compté comme dette → 23 ; réglage ignoré → 5 ; garde `sur` de `detteOf` retirée → 1.

### Tests

- Ajoutés : `tests/swarm-13-relecture.test.js`, 44 tests (30 + 10 différentiels, chemins sans tour avec dette, borne,
  événement qui lève, Bilan après redémarrage).
- Lot + existants nommés (16 fichiers) : 188/188.
- Phase unitaire : `ℹ tests 1873` · `ℹ pass 1870` · `ℹ fail 0` · `ℹ cancelled 0` · `ℹ skipped 2` · `ℹ todo 1` ·
  `FIN phase unitaire : code 0 (durée 195 s)` (1 817 + 12 + 44). `npm run check` et `npm run format:check` verts.

### Points à trancher par le manager

- `MAX_EN_ATTENTE = 20` sans champ disant combien de dettes n'ont pas été jointes au tour (forme du plan gardée) ;
  ajouter un compte serait un champ neuf.
- Écarts 1 et 2 du codeur (ligne de Bilan seulement avec réponse finale ; réglage 0 retire aussi les verdicts joints) :
  conformes aux décisions déjà données ; limites de 7.4 inchangées.
