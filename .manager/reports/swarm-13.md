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
