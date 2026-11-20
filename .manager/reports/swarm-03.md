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
