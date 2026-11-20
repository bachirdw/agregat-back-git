# swarm-03 — Leçons durables : le module par fichiers (rapport du codeur)

Ouvert le 20/11/2026 à 23 h 37 (heure de la machine). Arbre `/Users/diaw/Downloads/agregat-back-swarm-03`, branche
`swarm-03`, base du lot `3631948`, portage du copieur `fb556a3`.

## Journal

- 23 h 35 — Lu : brief commun (sections 1 à 5, 7, 9), plan (abréviations 13-19, règles 4.0 309-345, section du lot
  506-560), `NOTES.md` et `lecons-regles.js` du portage, `packages/policy-engine/files.js` (signatures réelles :
  `safeDirectory(root, path)`, `writeConfined(root, path, data)`, `readConfined(root, path, maxBytes)` rend un
  `Buffer`, ouverture `O_NOFOLLOW`), `packages/agent-runtime/env.js` (`redact(text, secrets = secretValues())`, masque
  aussi `sk-…` et `AIza…`), `scripts/check.js`, `.prettierrc`.
- 23 h 38 — Écrit `tests/swarm-03-lecons.test.js` AVANT le module (cas rouge d'abord). Lancé :
  `node --test tests/swarm-03-lecons.test.js` → `ℹ tests 1 / pass 0 / fail 1` (module absent,
  `ERR_MODULE_NOT_FOUND`).
- 23 h 39 — Écrit `packages/orchestrator/lecons.js` : sept lignes de licence du portage en tête, partie 1 = règles
  pures du portage (reprises telles quelles, sauf `extrait` mis sur une ligne avant la coupe à 300, mots vides
  complétés, `TTL_PAR_SOURCE` retiré car sans usage), partie 2 = classe `Lecons`. Premier passage : 18/19 ; l'échec
  venait de MON test (`utilite(30, 1)` vaut 60/31 ≈ 1,935, pas 2) : attente corrigée en `utilite(30, 0) = 2` et
  `1,9 < utilite(30, 1) < 2`. Puis 19/19.
- 23 h 40 — Rouge du seuil sur le brut (contrôle négatif, non commité) : filtre déplacé APRÈS les multiplicateurs
  (`communs × score / brute ≥ 2`). Sortie gardée :

  ```
  ✖ rappel : seuil sur la pertinence brute, une leçon très bien notée sans mots communs n’est pas servie
  ℹ tests 1 / pass 0 / fail 1
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
    actual: [ { id: 'l-3ee7b2d350d06a93', titre: 'Formulaire de candidature bloqué', extrait: 'Quand le formulaire
    refuse le fichier joint, …', date: '2026-01-10T10:00:00.000Z', utile: 20, inutile: 0 } ],
    expected: [],
  ```

  (un seul mot commun, dans le titre, leçon promue et notée 20 fois « utile » : servie si le seuil porte sur le score
  composé.) Code remis à l'identique depuis une copie, puis 19/19.
- 23 h 41 — `npx prettier --write` sur mes trois fichiers ; `npm run check` → « Syntaxe JavaScript valide. », code 0 ;
  `npm run format:check` → « All matched files use Prettier code style! ».
- 23 h 42 — Phase unitaire lancée en arrière-plan. Commit `7768d15`.

- 23 h 45 — Phase unitaire terminée (`phase-unitaire.mjs`), lignes lues dans le journal :

  ```
  ℹ tests 1630
  ℹ pass 1627
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 2
  ℹ todo 1
  FIN phase unitaire : code 0 (durée 210 s)
  ```

  Référence 1 611 / 1 608 / 0 / 2 / 1 + 19 tests du lot = 1 630 / 1 627 : aucun autre chiffre n'a bougé. La rubrique
  « ✖ failing tests » du journal ne contient que le test « à faire » connu (`tests/review2-lecture-18-11.test.js:248`).
  Journal et dossier `swarm-03-preuves` supprimés ensuite. Commit du rapport `ac50e83`, complété ensuite.

## Tests

- `node --test tests/swarm-03-lecons.test.js` : 19 / 19, code 0.
- Phase unitaire : 1 630 tests, 1 627 réussis, 0 échec, 2 ignorés, 1 à faire, FIN code 0.
- `npm run check` : code 0 ; `npm run format:check` : tout conforme.
- Aucun test existant modifié.

## Fait

- `packages/orchestrator/lecons.js` : `new Lecons({ dir, now, ttlJours = 30 })` ; `noter`, `rappel`, `citer`,
  `noterUtilite`, `promouvoir`, `remplacer`, `supprimer`, `liste`, `purger` ; règles pures exportées (`utilite`,
  `motsSignificatifs`, `jaccard`, `preparerLecon`, `choisirLecons`, `extrait`, …). Une leçon par fichier
  `<dir>/<portee>/<id>.json` par `readConfined` (64 Kio) / `writeConfined`, dossier de portée vérifié par
  `safeDirectory` (lien refusé), aucune création à la lecture. `portee` : `^[a-z0-9][a-z0-9_-]{0,63}$` ; `id` :
  `^l-[0-9a-f]{16}$` (longueur fixe, piège de la citation par sous-chaîne). Texte, étiquettes, mission, auteur et
  origine passent par `redact`. Horloge injectée. Messages d'erreur fixes, sans texte de leçon.
- Décisions du manager appliquées : (1) `pleine` contrôlé seulement avant d'écrire une leçon neuve (test : rejeu et
  quasi-doublon passent dans une portée de 500) ; (2) `SEUIL_QUASI_DOUBLON = 0.8` constante nommée, documentée « à
  mesurer sur des notes réelles » ; (3) mots vides français et anglais complétés (articles, prépositions, pronoms,
  auxiliaires, adverbes courants) ; (4) `TEXTE_PAS_UNE_LECON`, `TITRE_SECTION`, `INTRO_SECTION`, `CONSEIL_NOTE`,
  `rendreLecons` gardés et marqués « PROPOSAL », branchés nulle part.
- `docs/api-lecons.md` : forme d'une leçon, ordre de `noter`, rappel, notes, fin de vie, chemins.
- `tests/swarm-03-lecons.test.js` : 19 tests, tous les cas de la rubrique « Tests à écrire » plus bornes, rejeu,
  classement (utilité, remplacée, propriétaire), purger, fichiers abîmés, portée pleine, mots significatifs.

## Écarts au plan

- Taille : `lecons.js` fait environ 700 lignes après Prettier (dont ≈ 150 de commentaires repris de swarm) : au-delà
  du « moyen » (400 lignes de code neuf). Les règles du portage et la classe sont dans le même fichier, comme demandé.
- Choix non fixés par le plan : portée ou identifiant hostile → exception (`Portée de leçon invalide`,
  `Identifiant de leçon invalide`) plutôt qu'un refus `{ statut: 'refusee' }`, parce que les raisons de refus de
  `noter` sont listées par le plan ; `noterUtilite` rend `{ statut: 'notee' | 'deja_notee' | 'inconnue', id }` et
  deux refus neufs (`note_invalide` si `utile` n'est pas un booléen, `mission_absente`) ; `remplacer(id, portee,
  { par })` ; `citer` cherche l'identifiant dans toutes les portées (la signature du plan n'a pas de portée) ;
  `rappel` borne `max` à 5 ; les expirées sont supprimées du disque à la lecture ; une citation ou une note
  « inutile » ne renouvelle pas la fin de vie ; une leçon promue garde `expire: null` même confirmée.
- Aucun fichier existant modifié ; aucun branchement (lot 15).

## Points à trancher par le manager

1. `origine` est pris tel que donné à `noter` : un appelant qui passe `origine: 'proprietaire'` obtient le poids 1,5.
   Au lot 15, la plateforme doit fixer `origine` elle-même (jamais l'agent).
2. Exception plutôt que refus pour une portée ou un identifiant hostile (voir écarts) : à confirmer pour le contrat
   des outils du lot 15.
3. Seuil de quasi-doublon 0,8 en Jaccard : à mesurer sur des notes réelles (un mot changé sur une quinzaine donne
   0,875 ; deux mots changés passent sous 0,8).

## Relecture indépendante

Relecteur indépendant, 20/11/2026 à partir de 23 h 45 (heure de la machine). Repartie du plan (4.0, section du lot),
du diff `3631948..HEAD`, du code et de swarm (lecture seule, rien exécuté).

### Contrôles

- Périmètre : seuls `packages/orchestrator/lecons.js`, `tests/swarm-03-lecons.test.js`, `docs/api-lecons.md`, le
  portage et ce rapport sont touchés ; aucun fichier existant modifié ; `index.js` et `delegation.js` intacts.
- Fidélité à swarm (fichiers ouverts) : `usefulness` (`reranker.ts:115-120`), poids de citation 0,5 / 0,25
  (`implicit-citation.ts:36-40`), deltas alpha / bêta (`store.ts:125-126`), 0,3 (`constants.ts:73`), 0,8 (`:84`),
  30 jours (`:21`), plancher et ordre (`task-learning.ts:146-178`) : identiques. En-têtes de licence en tête du fichier.
- Formules du plan : utilité `min(2, 2α/(α+β))`, plancher 0,5, jamais sous 1 sans note « inutile » ; cité +0,5 alpha,
  non cité +0,25 bêta ; note utile +1 alpha et fin de vie renouvelée ; note inutile +1 bêta, preuve gardée ; une note
  par mission ; titre × 3, étiquettes × 2, texte × 1 ; × 0,3 ; × 1,5 ; seuil de 2 mots sur le brut avant tout
  multiplicateur : conformes (vérifié par lecture et par contrôle négatif).
- Confinement essayé : portée `..`, `../x`, `a/b`, `a\b`, `/tmp`, octet nul, 65 caractères, majuscules, accent,
  `null`, nombre → exception avant tout accès ; id hostile → exception (`noterUtilite`, `supprimer`, `remplacer.par`),
  ignoré par `citer` ; dossier de portée en lien ou en fichier, fichier de leçon en lien ou en dossier : rien lu ni
  écrit hors de `dir`.
- Secrets (variable d'environnement fictive et motif `sk-…`) dans texte, titre, étiquette, mission, auteur, origine,
  mission d'une note et `memeAppel` : absents du disque et des messages.

### Constats

1. **Majeur, corrigé.** Un fichier de leçon aux champs mal typés faisait lever `rappel` (`etiquettes` en texte :
   `TypeError … flatMap is not a function`), était servi et réécrit corrompu (`alpha: '5'` devenait `'50.5'` après une
   citation, score `NaN`), servi pour toujours (`expire: 'pas une date'`) ou supprimé du disque comme expiré
   (`expire: 12`, lu comme l'an 2001). `valide()` contrôle désormais toute la forme écrite par `noter` ; un fichier
   hors forme est ignoré, jamais servi, ni réécrit ni supprimé.
2. **Majeur, corrigé.** « Une lecture ne crée rien » était faux : `noterUtilite`, `promouvoir`, `remplacer`,
   `supprimer` sur une portée absente créaient `dir` et le dossier de portée (`readConfined` → `safeDirectory` crée les
   dossiers manquants). `#lireFichier` vérifie d'abord le dossier de portée.
3. **Majeur, corrigé.** `rappel`, `liste`, `purger(portee)` levaient sur un dossier de portée remplacé par un lien ou
   par un fichier, et `purger()` sans portée s'arrêtait alors sans purger les autres portées. Désormais lu comme une
   portée vide (rien suivi) ; `noter` y lève toujours (`writeConfined`).
4. Mineur, laissé : lecture bornée aux 1 000 premiers noms triés ; au-delà (fichiers abîmés en nombre), des leçons
   valides sont invisibles et `pleine` peut ne plus jouer. Cas improbable, documenté.
5. Mineur, laissé (non faux) : `UTILITE_MAX` ne joue jamais avec α, β ≥ 0 ; la branche `resume` d'`extrait` n'est
   jamais alimentée par `noter` ; le filtre d'expiration de `choisirLecons` double celui de la lecture ; `rendreLecons`,
   `ligneLecon`, `prefixeLigne` et les quatre textes « PROPOSAL » ne sont appelés nulle part (désormais testés).
6. Mineur, laissé : sans `mission`, un même texte noté N fois donne N confirmations (alpha + N) ; `remplacer` accepte
   `par` égal à la leçon elle-même ou inconnu ; un même id dans deux portées : `citer` ne touche que la première.
7. Doc : `docs/api-lecons.md` précisée (portée en lien ou en fichier, lecture sans création, forme contrôlée, pas de
   rejeu sans mission). Le reste correspond au code.

### Contrôles négatifs (mutation, test rejoué, code remis ; rien ne reste)

Rougissent (avant relecture) : rétrogradation sans preuve, plancher 0,5, poids cité, poids non cité, `citee++`,
confirmation sans alpha, renouvellement par « utile », renouvellement par « inutile », `deja_notee`, renouvellement
par confirmation, rejeu, `pleine` avant le quasi-doublon, seuil 1 ou 3 mots, seuil de doublon 0,9, redact des
étiquettes, expression de portée, borne de `max`, suppression des expirées, leçon promue renouvelée, TTL 31, extrait 301.
Restaient VERTS (tests manquants, ajoutés puis vus rouges) : poids titre 3 → 1, étiquette 2 → 1, remplacée 0,3 → 1,
propriétaire 1,5 → 1, note « inutile » poids 1 → 0,5, redact de mission / auteur / origine, redact de `memeAppel`,
contrôle `objet.id === id`. Corrections de la relecture : chacune retirée un instant rend un test rouge (sauf le
`Array.isArray(etiquettes)`, redondant avec `.every` qui lève et est rattrapé).

Sortie rouge des tests ajoutés avant correction (extrait) :

```
✖ champs abîmés : … actual: [ …, 'l-a000000000000001', 'l-a000000000000002', 'l-a000000000000003',
  'l-a000000000000004', 'l-a000000000000006', 'l-a000000000000007', 'l-a000000000000008' ], expected: [ <seule valide> ]
✖ une lecture ne crée rien … actual: true, expected: false
✖ dossier de portée remplacé par un lien ou un fichier … Error: Lien symbolique refusé dans le chemin
```

### Tests ajoutés

`tests/swarm-03-relecture.test.js` : 7 tests (champs abîmés ; lecture sans création ; portée en lien ou en fichier ;
pondérations et multiplicateurs exacts ; note « inutile » et citation exactes ; secrets de mission, auteur, origine et
même appel ; rendu proposé). Lot : 26 / 26 (`node --test tests/swarm-03-lecons.test.js tests/swarm-03-relecture.test.js`).

### Totaux (relecture)

Phase unitaire (`phase-unitaire.mjs`, 20/11 vers 23 h 53, 244 s) :

```
ℹ tests 1637
ℹ pass 1633
ℹ fail 1
ℹ cancelled 0
ℹ skipped 2
ℹ todo 1
FIN phase unitaire : code 1 (durée 244 s)
```

L'échec : `tests/elicitation.test.js:535` « question en JSON : délais suspendus pendant l’attente » (attente de 5 s
dépassée), fichier que le lot ne touche pas et qui n'emploie pas le module. Relancé seul :
`node --test tests/elicitation.test.js` → 26 / 26, code 0 : **échec sous charge**. Attendu : 1 611 + 26 = 1 637, soit
1 634 réussis sans cet échec ; aucun autre chiffre n'a bougé. `npm run check` : « Syntaxe JavaScript valide. » ;
`npm run format:check` : tout conforme. Journal supprimé.

### Points à trancher par le manager

1. Exception ou refus pour une portée ou un id hostile (avis, sans trancher). Exception (choix actuel) : rien n'est
   jamais lu ni écrit, et les appels internes du lot 15 (`promptParts`, `ended`, `familyBilan`) avalent déjà toute
   erreur du module ; mais la portée y vient du pack de la mission (un nom avec point ou majuscule lèverait, avalé :
   aucune leçon, en silence), les routes `POST /api/lecons/:portee/:id` doivent traduire l'exception en 400, et
   l'outil `lecon_utile { id }` (id donné par l'agent) doit l'attraper et fabriquer lui-même un message. Refus
   `{ statut: 'refusee', raison: 'portee_invalide' | 'id_invalide', message }` : même forme que les autres refus, un
   levier rendu à l'agent (règle 4.0 « s'il refuse il donne le levier »), aucun `try` dans l'outil ; mais un appelant
   qui oublie de lire `statut` continue sans voir l'erreur. Dans les deux cas, le lot 15 doit normaliser le nom du pack
   en portée.
2. Pour le lot 15 : aucune méthode `lire(id, portee)` pour `lecon_lire` (seulement `liste` puis recherche) ;
   `raison?` de `lecon_utile` n'a pas de champ dans `noterUtilite` ; `origine` donnée par l'appelant (point 1 du codeur).
3. Sans `mission`, un même texte répété gonfle alpha (une confirmation par appel) : le lot 15 doit toujours passer la
   mission.

Verdict du relecteur : `bon_a_integrer`.
