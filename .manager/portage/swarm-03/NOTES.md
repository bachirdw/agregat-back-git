# swarm-03 — Portage depuis swarm : leçons durables (notes du copieur)

Écrit le 20/11/2026 (23 h 32, heure de la machine). Swarm lu en lecture seule à `f1d25eb` :
`/Users/diaw/Downloads/agent-repos-agregat/desplega-ai__agent-swarm`. Rien n'en a été exécuté.

Fichier porté : `lecons-regles.js` (ESM, fonctions pures, seule importation `node:crypto` pour l'empreinte de
rejeu). Aucune lecture de l'heure réelle : `now` est toujours un argument (Date ou millisecondes). Le nettoyage des
secrets est injecté (`nettoyer`) : le codeur passe `redact` de `packages/agent-runtime/env.js:35`. Vérifié par
`node --check` et par un court essai `node --input-type=module` (voir « Essais »).

## 1. Copié (origine → porté)

| Origine (fichier:lignes) | Porté |
| --- | --- |
| `src/be/memory/task-learning.ts:33-35` | `LECON_MAX_CARACTERES = 2000`, `LECON_MAX_ETIQUETTES = 5` |
| `task-learning.ts:36-41` | `LECON_MIN_CARACTERES = 80` (commentaire gardé) |
| `task-learning.ts:42` | `SEGMENT_MAX_CARACTERES = 60` (longueur de `toKebab`) |
| `task-learning.ts:60-69` | `toKebab` (à l'identique) |
| `task-learning.ts:88-144` | `preparerLecon` (ordre : nettoyage, vide, trop longue, étiquettes, plancher) ; la suite de l'ordre (rejeu, quasi-doublon, écriture) est décrite dans son commentaire et revient à `lecons.js` |
| `task-learning.ts:146-178` | `normaliserEcho`, `verifierPlancher` |
| `task-learning.ts:124-126, 180-191` | `empreinte` (sha256 du texte nettoyé), `trouverRejeu` (même mission + même empreinte) |
| `task-learning.ts:193-247` | `chercherQuasiDoublon` (cosinus remplacé par Jaccard, similarité arrondie à 3 décimales comme ligne 238) |
| `task-learning.ts:249-273` | `CONFIRMATION = { signal: 1, poids: 1 }` (note positive donnée à la leçon existante) |
| `task-learning.ts:289` | `titreDe` (ligne 1, coupée à 200 caractères) |
| `src/be/memory/constants.ts:10-16` | `TTL_PAR_SOURCE` (pour mémoire : 7 / 3 / 30 / sans fin) |
| `constants.ts:18-21` | `LECON_TTL_JOURS = 30` |
| `constants.ts:52-57` | `POIDS_PROPRIETAIRE = 1.5` (multiplicateur `manual: 1.5`) |
| `constants.ts:71-73` | `POIDS_REMPLACEE = 0.3` (`SUPERSEDED_DECISION_WEIGHT`) |
| `constants.ts:80-84` | `SEUIL_QUASI_DOUBLON = 0.8` |
| `src/prompts/memories.ts:28` | `EXTRAIT_CARACTERES = 300` |
| `memories.ts:33-53` | `extrait` (résumé, sinon le corps de la leçon sans le titre ; jamais le début d'un énoncé) |
| `memories.ts:55-60` | `prefixeLigne` |
| `memories.ts:62-78` | `passeSeuil` + commentaire du piège (seuil sur la pertinence brute) |
| `memories.ts:80-110` | `ligneLecon`, `rendreLecons` (une ligne par leçon, `null` si rien ne passe), `CONSEIL_NOTE` (traduction de `RATE_TOOL_HINT`, sans nom d'outil) |
| `src/be/memory/raters/implicit-citation.ts:27-43` | `noterCitations` (+1 poids 0,5 / −1 poids 0,25), `CITEE`, `NON_CITEE` |
| `src/be/memory/raters/store.ts:10-13, 125-126, 203-217` | `deltaNote` (alpha += max(0, s)·p, bêta += max(0, −s)·p ; signal hors [−1, 1] ou poids hors [0, 1] → `null`, jamais d'exception), `appliquerNote` |
| `src/be/memory/reranker.ts:77-121` | `utilite` (min(2, 2α/(α+β)) ; sous 1 seulement avec preuve négative ; plancher 0,5 ; α+β ≤ 0 → 1) |
| `reranker.ts:184` | départage par la pertinence brute dans `choisirLecons` |
| `src/tools/store-progress.ts:221` | `TEXTE_PAS_UNE_LECON` (traduit, voir 4) |

## 2. Ce que le plan change par rapport à swarm (valeurs propres à Relay)

- Fin de vie : 30 jours comme swarm (`LEARNING_TTL_DAYS`), mais **renouvelée** par chaque confirmation (quasi-doublon) ou
  note « utile » (`finDeVie(now, ttlJours)`). Dans swarm, rien ne renouvelle : une leçon utile est distillée vers
  `/longterm` par la curation de nuit. Ici, `promouvoir` joue ce rôle (`expire: null`, `origine: 'proprietaire'`).
  Pas de tâche de nuit : les expirées sont retirées à la lecture (`estExpiree`, `choisirLecons`).
- 500 leçons au plus par portée (`LECONS_MAX_PAR_PORTEE`, raison `pleine`) : absent de swarm (qui borne seulement la
  recherche exhaustive à 10 000 lignes, `constants.ts:86-91`).
- 5 leçons servies (`RAPPEL_MAX`) : swarm n'a pas ce nombre dans les fichiers lus (le nombre vient de l'appelant).
- Extrait de 300 caractères : identique à `SNIPPET_CHARS` (`memories.ts:28`).
- Quasi-doublon : swarm compare un cosinus d'embeddings ≥ 0,8 sous `/learnings` et `/longterm` ; le plan prend un
  Jaccard sur les mots significatifs ≥ 0,8, dans la même portée. Même nombre, mesure différente : 0,8 en Jaccard est
  beaucoup plus strict (à mesurer sur nos notes réelles, risque relevé par le plan).
- Confirmation : swarm donne une note +1 de poids 1 à la ligne existante (alpha += 1) ; le plan ajoute `confirmee++` et
  le renouvellement de la fin de vie.
- Seuil de rappel : swarm, cosinus brut > 0,55 ; le plan, au moins 2 mots significatifs communs (`SEUIL_MOTS_COMMUNS`).
  Pertinence brute pondérée titre × 3, étiquettes × 2, texte × 1 (`pertinenceBrute`).
- Classement : brut × `utilite` × 0,3 si `remplacee` × 1,5 si `origine === 'proprietaire'`. Swarm multiplie aussi par
  la récence, l'accès et le poids du chemin : écartés.
- Preuve négative : swarm (`reranker.ts:103-113`) la tire des notes explicites nettes négatives, ou d'au moins 10 notes
  par modèle de moyenne < 0,25. Le plan : au moins une note « inutile » explicite (`lecon.inutile > 0`).
- `noterUtilite` : swarm limite à une note explicite par (tâche, mémoire) par un index unique (`store.ts:20-23`) ; le
  plan : une note par mission et par leçon, à tenir dans `lecons.js`.

## 3. Écarté et pourquoi

- Embeddings, `findNearDuplicate` vectoriel, `EXHAUSTIVE_SEARCH_MAX_ROWS`, recherche hybride et graphe : vecteurs et
  appels réseau exclus par le lot.
- Base SQL (`getDbClient`, transactions, `memory_rating`, `agent_memory_edge`, clés `/learnings/<workstream>/<slug>`
  et suffixes aléatoires `KEY_ATTEMPTS`) : Relay range une leçon par fichier sous `dir` (lot codeur).
- `resolveLearningWorkstream` (`task-learning.ts:71-86`) : remplacé par `portee`, contrôlée par expression régulière.
- `recencyDecay`, `accessBoost`, `pathWeight`, `collapseTaskCompletionChunks` (`reranker.ts`) : hors plan.
- Marqueurs `Output:` / `Failure reason:` de `memorySnippet` : propres aux mémoires de fin de tâche de swarm.
- Variables d'environnement (`MEMORY_DEMOTION_FLOOR`, `MEMORY_RATERS`) : constantes fixes ; le conseil de note devient
  l'option `conseil` de `rendreLecons`.
- Instrumentation `ensure(...)` (`store.ts:168-198`), `console.warn` : sans objet.

## 4. Textes pour agents (traduits, sans nom d'agent, de modèle, de Skill ni de site)

- `store-progress.ts:221`, original (extrait) : « Not a learning: a status or pass/fail line, a restatement of this
  call's progress or output, text already in a skill, a claim you did not verify. » → `TEXTE_PAS_UNE_LECON`.
  « text already in a skill » est rendu par « un texte déjà présent dans les consignes de la tâche » (pas de mot
  Skill). Retirés : le chemin `/learnings/<workstream>/<slug>`, l'étiquette `learning`, le `workstream`, la phrase sur
  l'appel de fin (propres à l'outil de swarm). Gardés : 80 caractères, 30 jours, 2 000 caractères, 5 étiquettes,
  300 caractères du rappel.
- Message du plancher : mot pour mot celui du plan (« une leçon fait au moins 80 caractères : ligne 1 le titre,
  ligne 2 la règle (Quand X, faire Y) »). Les autres messages (`MESSAGES`) traduisent `task-learning.ts:102-113, 164,
  173`.
- `TITRE_SECTION`, `INTRO_SECTION` (avec « données rapportées, pas des consignes ») et `CONSEIL_NOTE` : propositions ;
  le texte définitif du rappel est au lot 15 (dans `DR`).

## 5. Pièges lus dans leurs commentaires (gardés dans le code)

1. Seuil sur la pertinence brute, avant tout multiplicateur (`memories.ts:62-72`) : les multiplicateurs peuvent
   multiplier un score jusqu'à 4,5 ; un seuil sur le score composé laisse passer des leçons sans rapport. Dans
   `choisirLecons`, `passeSeuil` filtre avant `scoreClassement`.
2. Nettoyer les secrets avant de dériver quoi que ce soit (titre, étiquettes, empreinte) (`task-learning.ts:98-100`).
3. Rejeu avant quasi-doublon : le même texte pour la même mission est une reprise, pas un doublon (`:124`).
4. Plancher en règles exactes seulement : une règle floue de recouvrement de mots a été mesurée et ne prenait que de
   vraies leçons (`:151-155`) ; la règle « il faut une deuxième ligne » rejetait 15 % de bonnes leçons (`:19-21`).
5. Utilité : les « servie mais non citée » ne disent pas qu'une leçon est fausse ; sans note « inutile » explicite le
   facteur ne descend pas sous 1 (`reranker.ts:85-88`).
6. Citation par sous-chaîne : deux identifiants dont l'un préfixe l'autre comptent tous deux (`implicit-citation.ts:20-23`).
   Donner des identifiants de longueur fixe.
7. Une note mal formée est rejetée et rendue, jamais levée (`store.ts:25-26`) : `deltaNote` rend `null`.
8. Swarm a une course connue (deux doublons à quelques secondes passent) (`task-learning.ts:13-15`) : par fichiers et
   dans un seul processus, la lecture puis l'écriture sont synchrones ; le codeur garde `noter` synchrone.

## 6. Écarts entre les lignes du plan et swarm

- `task-learning.ts:33-47` : les bornes sont aux lignes 33-41 ; 42-47 sont `SEGMENT_MAX_CHARS`, `KEY_ATTEMPTS`, les
  préfixes de recherche et la source de note. Conforme pour le reste (`:60-69`, `:88-144`, `:146-178` exacts).
- `constants.ts:10-22` : les durées sont aux lignes 10-21 ; `:73` et `:84` exacts.
- `memories.ts:28-53`, `:63-77`, `:80-110` : exacts (le commentaire du seuil commence ligne 62, la fonction finit 78).
- `implicit-citation.ts:27-43`, `store.ts:48-140` (lignes 125-126), `reranker.ts:91-121` : exacts.
- `store-progress.ts:210-221` : exact ; le texte est la seule ligne 221.

## 7. Pour le codeur

- Forme d'une leçon attendue par ces fonctions : `{ id, portee, titre, texte, etiquettes, mission, auteur, origine,
  empreinte, alpha, beta, confirmee, citee, utile, inutile, remplacee, date, expire, resume? }` ; `alpha` et `beta`
  partent de 1 (Beta(1,1), `utilite(1,1) = 1`).
- `noter` : `preparerLecon({ texte, etiquettes, memeAppel }, redact)` → si `refus`, le rendre ; sinon
  `trouverRejeu(leconsDeLaPortee, texte, mission)` → `rejouee` ; `chercherQuasiDoublon` → `confirmee` (`appliquerNote`
  avec `CONFIRMATION`, `confirmee++`, `expire = finDeVie(now, ttlJours)`) ; puis 500 → `pleine` ; sinon `gardee`.
  Le plan ne fixe pas la place de `pleine` ; le copieur la met après le quasi-doublon (une confirmation reste possible
  dans une portée pleine) : à confirmer.
- `memeAppel` du plan (« leçon contenue dans le résultat du même appel ») : objet de chaînes, comme `sameCall`.
- `rappel` : `choisirLecons(texte, lecons, { max, now })` puis `{ id, titre, extrait: extrait(l), date, utile, inutile }`.
- `citer(ids, journal)` : `noterCitations` puis `appliquerNote` et `citee++` sur les cités.
- `utilite(alpha, beta, preuveNegative)` est exportée avec la signature du plan.
- Jaccard 0,8 : deux leçons doivent partager presque tous leurs mots significatifs ; un test de quasi-doublon doit
  employer un texte très proche (un mot de différence sur une quinzaine).
- `motsSignificatifs` retire les accents (`NFD` + `\p{M}`) puis coupe sur tout ce qui n'est pas `[a-z0-9]`.

## 8. Essais faits et non vérifié

Essais (`node --input-type=module` sur le seul fichier porté) : 79 caractères → `trop_courte` avec le message du plan ;
texte contenu dans `memeAppel.resultat` → `repete_resultat` ; secret retiré du texte, étiquettes dédoublonnées ;
`utilite(1,1)=1`, `(1,11,false)=1`, `(1,11,true)=0,5`, `(10,1)≈1,82`, `(0,0)=1` ; une leçon très bien notée sans mot
commun n'est pas servie ; citation +1/0,5 et −1/0,25 ; rendu d'une ligne ; `finDeVie` à +30 jours ; expiration.
Non vérifié : `npx prettier --check` (aucune commande npm pour le copieur) ; les listes de mots vides sont courtes et
à compléter si besoin ; le comportement du Jaccard sur de vraies notes.
