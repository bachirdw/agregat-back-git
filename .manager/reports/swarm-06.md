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

## Relecture indépendante

Relecteur indépendant, 21/11/2026 01:15 → fin (horloge `date`). Repartie du plan (4.0, section swarm-06), du diff
`e18ef06..HEAD`, du code et du portage ; swarm relu en lecture seule (`src/hooks/tool-loop-detection.ts`).

### Périmètre et moteur

- Diff conforme au périmètre : `loop-guard.js`, test, faux agent, doc, portage, rapport ; `index.js` +29 −1 (seule ligne
  retirée : l'ancien libellé de `formatOwnerMessageLines`), `failure.js` +1 (l'expression d'erreur nue intacte). Rien
  d'autre dans `IX` : import, création près de `new ToolGuard(`, deux lignes après `control.familyObserve?.(update);`,
  méthode `toolLoop`, libellé. Aucun test existant modifié (`git diff --stat -- tests/` : deux fichiers neufs).
- `observe` : tout est dans un `try` ; mémoire bornée (historique 40, `parId` 40, `vus` et `attente` 1 024 chacun ;
  aucun argument gardé). `toolLoop` : tout dans un `try` ; `message()` est `async` (ne lève pas de façon synchrone ; s'il
  levait, le `try` le couvre) ; `control.abort` absent → l'arrêt n'a pas lieu, rien ne lève ; run retiré de la base →
  `store.event`/`message` lèvent ou rejettent, pris. Getter qui lève, `Proxy`, `BigInt`, cycles, 100 000 niveaux : couverts
  par le test du codeur, revus.
- Coût mesuré (script jetable, `LoopGuard.observe` seul) : 20 000 événements d'outil ordinaires 40 à 100 ms au total
  (2 à 5 µs l'un) ; 20 000 messages non-outils 1 ms ; tas stable (≈ 20 Mo, aucune croissance). Arguments de 2 Mo :
  l'ancien hachage de swarm (boucle JS caractère par caractère) coûtait 9 à 14 ms par mise à jour, soit ≈ 14 fois la
  sérialisation que `store.event` fait déjà → **corrigé** (condensé natif sha1 : 1,9 ms, ≈ 2 fois une sérialisation).
  Cas pathologique laissé : 50 000 clés dans les arguments ≈ 54 ms par mise à jour (tri des clés ; `readToolCall` seul
  ≈ 16 ms sur le même objet).

### Mode par défaut identique à la base

- Constaté sur la base elle-même : `git archive e18ef06` extrait dans le dossier de preuves (supprimé depuis), même
  mission FICTIVE (`boucle-agent.js`, formes plat n=9, morceaux n=20, enveloppe n=20) jouée sur la base et sur le lot ;
  sortie normalisée (heures, durées, chemins retirés) : lot réglage `0` = base **à l'octet** ; lot par défaut = base
  une fois retirés les événements `tool_loop` (1 ou 2 selon le cas) : même état, même erreur, même `result` (Bilan,
  réponse), mêmes 33 / 86 / 66 événements dans le même ordre. Test durable ajouté (défaut contre `0`, trois formes).
- Lecteurs de la liste d'événements : tous filtrent par type (`carnet.js`, `resume-history.js`, `delegation.js`,
  `index.js` 216/1086/2062/2138/2148, `apps/api/server.js` 708/715, `.manager/outils/bilan-vs-events.mjs`) ; le
  plafond `too_many_events` compte les mises à jour de l'agent (`++events`), pas les événements stockés. Interface
  (`agregat-front-equipe/src`) : `ConnectionsPanel.tsx` ignore un type inconnu (chaîne de `else if` sans branche par
  défaut) ; `Mission.tsx` l'affiche dans le journal brut (`#seq · tool_loop` et ses données). Aucun effet.

### Constats

1. Majeur, **corrigé** (décision du manager) : va-et-vient d'un même outil entre deux jeux d'arguments → « les outils X
   et X ». Note, cause d'arrêt et raison interne ont maintenant leur forme à un outil (« l’outil X vient d’être appelé N
   fois en alternant deux jeux d’arguments… », « Boucle d’outils : X appelé N fois en alternant deux jeux d’arguments ;
   relancer autrement. »). Test vu rouge d'abord. Doc mise à jour.
2. Majeur, **corrigé** : coût du hachage sur de gros arguments (ci-dessus). Test relatif (empreinte < 5 × sérialisation)
   vu rouge d'abord (13,6 ms contre 1,2 ms).
3. Mineur, laissé (ligne hors du libellé nommé par le plan) : au Bilan « Note de la plateforme **reçu** à … » (accord ;
   le gabarit `reçu à` est commun aux trois libellés).
4. Mineur, laissé : `nomSur` accepte un titre d'un seul mot comme nom d'outil ; un titre réduit à un nom de fichier
   (`rapport.pdf`) serait montré. Une commande avec espace, chemin ou argument ne l'est jamais (testé, y compris titre
   qui cite une commande avec `_meta` → `Bash`).
5. Mineur, laissé : la règle « appel pauvre » de Relay est plus large que celle de swarm (accepte `{ path }`,
   `{ file_path }` à plat et toute valeur de `kind`) : voulu par le plan. Un appel sans argument n'est jamais « pauvre ».
6. `message-proprietaire.test.js` seul, cinq fois de suite : 25/25 à chaque fois. R6 envoie des messages toutes les
   10 ms pendant des tours de 60 ms et attend un dernier message « non remis » : test de course à l'horloge, sans appel
   d'outil répété, que le lot ne touche pas (libellé `de` absent inchangé) → échec sous charge.

### Faux positifs (à trancher, rien n'est changé)

Comportement actuel fixé par un test (`usages répétés légitimes`) ; en `observer`, seulement des événements :
- Pagination (clic « suivant » mêmes arguments / capture de page) : va-et-vient avertissement au 6e appel, **critique au
  12e** (6 pages), répétition avertie au 8e clic. En `avertir` : une note dès la 3e page ; en `arreter` : mission arrêtée
  à la 6e page. Faux positif net.
- Capture de page ou sondage d'un état (même commande) : 8 → avertissement, 15 → critique (`arreter` coupe un sondage
  de 15 coups).
- Relire le même fichier (`{ file_path }` seul) après chaque modification : avertissement à la 8e lecture, jamais de
  critique (appel pauvre, 24 hors d'atteinte dans 40 appels).
- `mission_attendre` et le carnet : exclus, rien.
- Outils du navigateur de la plateforme (`browser_snapshot`, `browser_click`, `browser_navigate`, `browser_extract`) :
  ce sont eux qui font les faux positifs ci-dessus. Pistes pour le manager : les exclure, ou relever leurs seuils comme
  les appels pauvres, ou n'arrêter que sur la répétition (pas sur le va-et-vient) ; à mesurer en `observer` d'abord.

### Contrôles négatifs (chaque fois remis, `git status` vérifié)

- Ligne d'observation de `IX` neutralisée → 7 échecs (dont le test « défaut contre 0 » ajouté).
- Arrêt quel que soit le mode (`guard.mode === 'arreter'` retiré) → 3 échecs.
- Note à chaque signalement (`guard.noter` retiré) → 1 échec.
- Ancien hachage → test de coût rouge ; textes à un outil retirés → test du même outil rouge.
- Ceux du codeur (`FA`, libellé, exclus, tri récursif) relus dans le test : ils portent bien sur ces lignes.

### Tests ajoutés (`tests/swarm-06-relecture.test.js`, 6 tests)

Même outil en va-et-vient (textes) ; coût de l'empreinte et sens du hachage ; nom montré quand le titre cite une
commande ; usages répétés légitimes ; défaut contre réglage `0` à `tool_loop` près (trois formes, état, Bilan,
réponse, événements) ; `arreter` : cause au Bilan, `active` vidé, `activeSlots() === 0`, aucune permission en attente.
Fichiers du lot : 29/29. Avec `orchestrator-max-events`, `tool-guard`, `message-proprietaire`, `runtime-onevent` :
75/75.

### Totaux (relecture)

Phase unitaire (`phase-unitaire.mjs`, 01:26 → 01:30) :
```
ℹ tests 1703
ℹ pass 1700
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ todo 1
FIN phase unitaire : code 0 (durée 203 s)
```
Base 1 674 / 1 671 + 23 (codeur) + 6 (relecture) ; aucun autre chiffre ne bouge. `npm run check` : code 0 ;
`npm run format:check` : code 0.

### Points à trancher par le manager

- Faux positifs du navigateur de la plateforme (pagination : critique au 12e appel) avant tout passage à `avertir` ou
  `arreter` : exclure ces outils, relever leurs seuils, ou ne pas arrêter sur le va-et-vient.
- Accord « Note de la plateforme reçu » au Bilan (gabarit commun dans `IX`, hors de la ligne nommée par le plan).
- Textes de la note et de la cause dans `loop-guard.js`, à déplacer dans `DR` par le lot qui le possède.
- Hachage : condensé sha1 au lieu du hachage 32 bits de swarm (écart de portage, dit dans le code et la doc).

Verdict : `bon_a_integrer`.
