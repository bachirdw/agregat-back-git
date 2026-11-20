# swarm-06 — Détecteur de boucles d'outils : rapport du codeur

Début : 21/11/2026 00:57 (horloge de la machine, `date`). Arbre `/Users/diaw/Downloads/agregat-back-swarm-06`,
branche `swarm-06`, base `e18ef06`, portage du copieur au commit `8177f5b`.

## Journal

- 00:57 — Lu : brief commun (en-tête, 1-5, 7, 9), plan (abréviations, 4.0, section swarm-06), `NOTES.md` et
  `loop-guard.js` du portage ; dans `IX` : `formatOwnerMessageLines`, `new ToolGuard(`,
  `control.familyObserve?.(update);`, `message()`, le bloc `catch` d'`execute` (cause d'échec) ; dans `FA` :
  `careerFailureMessage`. `MISSION_SERVER` = `relay-missions`, `CARNET_SERVER` = `relay-equipe` (`DR`).
- Portage copié tel quel en `packages/orchestrator/loop-guard.js` (`cp`, `node --check` sans erreur).
- 01:05 — `tests/swarm-06-boucles.test.js` (classe seule) écrit d'abord et lancé sur le portage brut :
  `node --test tests/swarm-06-boucles.test.js` → code 1, `ℹ tests 14 / pass 11 / fail 3`. Sortie rouge gardée :
  ```
  ✖ va-et-vient strict : avertissement à 6, critique à 12, outils nommés tous les deux
    actual: [ { rang: 8, niveau: 'avertissement', motif: 'ping_pong', outil: 'capturer', autre: undefined, n: 8 }, { rang: 12, niveau: 'critique', … n: 12 } ]
    expected: [ { rang: 6, niveau: 'avertissement', motif: 'ping_pong', outil: 'capturer', autre: 'defiler', n: 6 }, { rang: 12, … } ]
  ✖ écart voulu à swarm : 11 appels identiques puis 1 différent ne font pas un va-et-vient
    actual: [ { rang: 8, motif: 'repetition', niveau: 'avertissement' }, { rang: 12, motif: 'ping_pong', niveau: 'critique' } ]
    expected: [ { rang: 8, motif: 'repetition', niveau: 'avertissement' } ]
  ✖ réglage AGENT_PLATFORM_LOOP_GUARD et textes   (new LoopGuard({ mode: 'avertir' }).mode : undefined)
  ```
  Le premier montre aussi le seuil effectif de 8 (retour anticipé de swarm) au lieu de 6 ; le deuxième est la
  particularité de swarm écartée par le manager (décision 2).
- 01:06 — `loop-guard.js` modifié selon les décisions du manager : va-et-vient en alternance stricte
  (`alternanceFinale`), retour anticipé « moins de 8 appels » retiré, champ `autre` (second outil) dans le
  signalement de va-et-vient, textes du va-et-vient (note et cause d'arrêt), `mode` et `noter(motif)` sur la classe.
  Relance : `ℹ tests 14 / pass 14 / fail 0`.
- Contrôle négatif du piège de swarm : `hashArgs` remplacé un instant par l'ancien
  `JSON.stringify(args, Object.keys(args).sort())` → le test « cas rouge du piège de swarm » rougit (8 → avertissement,
  15 → critique sur 20 appels qui ne diffèrent que par une clé imbriquée) ; code remis, 14/14.
- Faux agent `tests/fixtures/boucle-agent.js` (N appels identiques, formes `plat`, `morceaux`, `enveloppe` ; seul le
  premier tour boucle ; il rend le nombre de tours et de notes reçues).
- Branchements dans `IX` (import, création près de `new ToolGuard(`, observation après
  `control.familyObserve?.(update);`, méthode `toolLoop` placée avant le commentaire de `launch()`, libellé de
  `formatOwnerMessageLines`) et dans `FA` (une ligne). Tests moteur et bout en bout ajoutés : 23/23.
- Contrôles négatifs des branchements (chaque fois remis ; `git diff --stat` vérifié ensuite) : sans la ligne
  d'observation → 5 échecs ; sans la ligne de `FA` → 1 ; ancien libellé → 2 ; arrêt jamais déclenché → 3 ; note jamais
  envoyée → 2 ; liste d'exclus vide par défaut → 1.
- Tests existants nommés (`orchestrator-max-events`, `tool-guard`, `message-proprietaire`, `runtime-onevent`,
  `swarm-02-limites`, `swarm-02-relecture`) lancés ensemble : 1er passage 62 tests / 61 / 1 échec
  (« R6. plafond : 20 tours owner_message au plus… », `tests/message-proprietaire.test.js`) ; ce test seul : vert ;
  le fichier seul, deux fois : 25/25 ; les six fichiers relancés ensemble : 62/62. Noté « échec sous charge ».
- `npm run check` → code 0 (« Syntaxe JavaScript valide. ») ; `npm run format:check` → code 0.

## Fait

- `packages/orchestrator/loop-guard.js` (portage installé, en-têtes de licence gardés en première ligne) : `LoopGuard`
  (`observe`, `etat`, `noter`, `mode`), `SEUILS`, `EXCLUS`, `deepSortKeys`, `hashArgs`, `isPathOnlyArgs`, `RAISONS`,
  `HOOK`, `texteAvertissement`, `messageArret`, `loopGuardMode`, `MODES`.
- `packages/orchestrator/index.js` : `git diff --stat` 29 insertions, 1 suppression (l’ancien libellé, réécrit sur 6 lignes par prettier ; tout le reste est ajouté). Réglage lu au départ de l'exécution
  par `loopGuardMode(process.env.AGENT_PLATFORM_LOOP_GUARD)` (même façon que `AGENT_PLATFORM_NETWORK`, lu à
  l'usage) : `0` → pas de garde ; défaut `observer`. `toolLoop` : événement `tool_loop { niveau, motif, outil, n }`,
  `control.loop = guard.etat()`, note `{ de: 'plateforme' }` en mode `avertir` (une par motif), arrêt
  `{ code: 'tool_loop' }` au critique en mode `arreter` ; le tout dans un `try`.
- `packages/orchestrator/failure.js` : 1 ligne ajoutée dans `careerFailureMessage`. L'expression d'erreur nue n'est
  pas touchée.
- `tests/swarm-06-boucles.test.js` (23 tests), `tests/fixtures/boucle-agent.js`, `docs/api-garde-boucles.md`.

## Écarts au plan

1. **Ligne d'observation sur deux lignes** : le plan la donne en une ligne
   (`const boucle = …; if (boucle) this.toolLoop(…);`) ; `prettier` (`npm run format:check`, qui couvre `packages`) la
   coupe en deux. Contenu identique, deux lignes ajoutées.
2. **Un signalement par motif et par niveau** (pas « par motif ») : décision 1 du manager.
3. **Va-et-vient en alternance stricte** (décision 2) : écart à swarm, dit dans `loop-guard.js` et la doc ; seuil
   d'avertissement effectif 6 (swarm : 8, à cause de son retour anticipé).
4. **Mode `avertir`** : la note part au premier signalement d'un motif, quel que soit son niveau (normalement
   l'avertissement) ; le critique du même motif n'envoie pas une seconde note. Le plan dit « au premier
   avertissement d'un motif » ; les deux lectures coïncident sauf si un critique arrivait sans avertissement préalable.
5. **Textes dans `loop-guard.js`**, pas dans `DR` (règle 4.0) ni écrits en dur dans `toolLoop` : `DR` n'est pas à ce lot.
6. Le signalement de va-et-vient porte un champ de plus, `autre` (le second outil), pour le texte ; l'événement
   `tool_loop` ne le porte pas (`{ niveau, motif, outil, n }` seulement).

## Points à trancher par le manager

- Textes de la note et de la cause d'arrêt dans `loop-guard.js` : à déplacer dans `DR` par le lot qui le possède ?
- Va-et-vient entre deux appels du même outil (arguments différents) : le texte donné dit « les outils X et X ».
  Gardé mot pour mot ; une variante « l’outil X, avec deux jeux d’arguments en alternance » serait plus juste.
- Cause d'arrêt du va-et-vient (« Boucle d’outils : X et Y appelés en alternance N fois avec les mêmes arguments ;
  relancer autrement. ») : écrite par le codeur sur le modèle de la répétition ; le plan n'en donne pas.
- La note en mode `avertir` passe par `message()` : elle est refusée (sans effet sur la mission) pour un parcours
  `workflow`, et pour une mission privée son texte n'est pas écrit dans l'événement `owner_message` (règle existante).

## Tests

- Fichier du lot `tests/swarm-06-boucles.test.js` : `ℹ tests 23 / pass 23 / fail 0` (classe seule : 14 ; moteur :
  `formatOwnerMessageLines`, `careerFailureMessage`, `toolLoop` qui ne lève pas ; bout en bout : défaut 9 appels,
  réglage `0`, `arreter` sur les trois formes, `avertir`).
- Phase unitaire (`phase-unitaire.mjs`, 01:08 → fin, durée 224 s) :
  ```
  ℹ tests 1697
  ℹ pass 1694
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 2
  ℹ todo 1
  FIN phase unitaire : code 0 (durée 224 s)
  ```
  Référence de la base : 1 674 / 1 671 / 0 / 2 / 1 ; + 23 tests du lot, aucun autre chiffre ne bouge. (La rubrique
  « ✖ failing tests » du journal ne liste que le test « à faire » attendu, `tests/review2-lecture-18-11.test.js:248`.)
- `npm run check` : code 0. `npm run format:check` : code 0.
- Tests existants modifiés : aucun.
- Non vérifié : comportement sur des missions réelles (aucune lancée) ; formes d'arguments d'autres agents que les deux
  des fixtures.
