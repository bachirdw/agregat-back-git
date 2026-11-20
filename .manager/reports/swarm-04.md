# swarm-04 — Verdicts lisibles et rôle du vérificateur (rapport du codeur)

Arbre : `/Users/diaw/Downloads/agregat-back-swarm-04`, branche `swarm-04`. Début : 20/11/2026 23:34 AEDT (horloge
lue). Base : `64c26d3` (portage du copieur).

## Fait

1. Lu : brief commun (sections 1-5, 7, 9), plan (abréviations, 4.0, section swarm-04), `NOTES.md` et
   `verificateur-source.md` du portage, `RO` (`normalizeVerdict`, `readVerdict`, `verificationLines`), `FB:92-96`,
   `verificateur.md`, les tests existants de verdict. Textes du plan conformes au code de l'arbre.
2. **Cas rouge d'abord** : `tests/swarm-04-verdict.test.js` écrit avant le code (7 cas), lancé :
   `node --test tests/swarm-04-verdict.test.js` → code 1, sortie (extrait) :

   ```text
   ✖ swarm-04 (cas réel du 20/11) : « Verdict : a_corriger » dans la réponse, sans fichier → complet: false et « sans point bloquant précis »
     actual: { valeur: 'a_corriger', bloquants: [], remarques: [], source: 'reponse' },
     expected: { valeur: 'a_corriger', bloquants: [], remarques: [], source: 'reponse', complet: false },
   ✖ swarm-04 : verdict absent → complet: false et « illisible » dans le Bilan (total et ligne par travail)
     actual: { valeur: 'a_corriger', bloquants: [], remarques: [], source: 'absent' },
     expected: { ..., source: 'absent', complet: false },
   ✔ swarm-04 : « a_corriger » par fichier avec un point bloquant complet → forme d’aujourd’hui, sans clé complet
   ✖ swarm-04 : normalizeVerdict : sans pourquoi non vide (après trim) → complet: false ; approuve jamais incomplet
   ✔ swarm-04 : « approuve » par la réponse → complet (forme d’aujourd’hui) ; Bilan inchangé
   ✖ swarm-04 : total avec plusieurs illisibles ; un verdict écrit sans clé complet garde les lignes d’avant
     actual: 'Vérifications : 3 (1 approuvée(s), 2 à corriger, 0 rejetée(s))',
     expected: 'Vérifications : 3 (1 approuvée(s), 2 à corriger, 0 rejetée(s)), 2 illisible(s)',
   ✖ swarm-04 : parseRole lit toujours verificateur.md ; consigne ≤ 4 000 caractères et porte les six exigences
   ℹ tests 7
   ℹ pass 2
   ℹ fail 5
   ```

   Les deux cas verts avant le code sont les cas « forme inchangée » (attendu : ils doivent le rester).
3. `packages/orchestrator/roles.js` :
   - `normalizeVerdict` : `a_corriger` ou `rejete` sans aucun point bloquant dont le `pourquoi` (après `trim`) n'est
     pas vide → `complet: false` ajouté ; sinon l'objet garde exactement sa forme d'avant (pas de clé `complet`).
   - `readVerdict` : source `reponse` avec `a_corriger`/`rejete` → `complet: false` ; source `absent` →
     `complet: false` ; `approuve` par la réponse inchangé.
   - `verificationLines` : total suivi de « , n illisible(s) » (n = verdicts de source `absent`) ; ligne par travail
     selon une fonction interne `verdictWords` : source `absent` → « illisible (aucun verdict rendu) », sinon
     `complet === false` → « <valeur> sans point bloquant précis », sinon la valeur (texte d'avant). `last` garde le
     verdict entier au lieu de la seule valeur.
4. `packages/orchestrator/family-bilan.js` : ligne « Verdict vu par la plateforme » : source `absent` → « illisible
   (aucun verdict rendu ; compté à corriger) » ; `complet === false` → « ; incomplet : aucun point bloquant précis »
   ajouté dans la parenthèse ; sinon inchangée.
5. `packages/orchestrator/roles/verificateur.md` : corps remplacé par le texte proposé par le copieur (en-tête
   inchangé) ; il porte les six exigences du plan ; 1 038 caractères (borne 4 000), mesuré par `node`. Aucun nom
   d'agent, de modèle, de Skill ni de site.
6. `docs/api-verdicts.md` créé : forme du verdict, table des cas de `complet`, lignes du Bilan, rôle, limites.
7. `tests/equipe-01-roles.test.js` : trois égalités strictes changées (voir Tests).

Forme exacte de la ligne de total obtenue (décision 3 du manager, après la parenthèse) :
`Vérifications : 3 (1 approuvée(s), 1 à corriger, 1 rejetée(s)), 1 illisible(s)` (constatée par `node` sur les
données du test `tests/equipe-01-roles.test.js:330`, dont l'expression régulière reste verte, non modifiée).

Décisions appliquées : `pourquoi` fait d'espaces = vide (trim) ; Bilan décidé sur `complet === false` et
`source === 'absent'`, jamais sur le nombre de points bloquants ; `absent` passe avant « sans point bloquant
précis ». `index.js` et `delegation.js` non touchés (`verdictOf` rend l'objet tel quel).

## Écarts au plan

- Aucun sur le comportement. Placement de « , n illisible(s) » : après la parenthèse fermante (décision 3).
- Un verdict de source `absent` est compté « illisible » dans le total et reste aussi compté dans « à corriger »
  (les trois valeurs publiques ne changent pas).

## Tests

Tests existants modifiés (`tests/equipe-01-roles.test.js`, uniquement ajout d'une clé dans l'objet attendu, aucune
assertion relâchée) :

| Fichier:ligne (après) | Avant | Après |
| --- | --- | --- |
| `tests/equipe-01-roles.test.js:258-264` | `deepEqual(readVerdict(…réponse…), { valeur: 'rejete', bloquants: [], remarques: [], source: 'reponse' })` | même objet + `complet: false` |
| `tests/equipe-01-roles.test.js:265-271` | `deepEqual(readVerdict(…'rien FICTIF'…), { valeur: 'a_corriger', bloquants: [], remarques: [], source: 'absent' })` | même objet + `complet: false` |
| `tests/equipe-01-roles.test.js:458-464` | `deepEqual(done.verdict, { valeur: 'a_corriger', bloquants: [], remarques: [], source: 'absent' })` | même objet + `complet: false` |

`tests/equipe-01-relecture.test.js` et `tests/equipe-01-roles-pack.test.js` : non modifiés, verts.

Lot et tests voisins : `node --test tests/swarm-04-verdict.test.js tests/equipe-01-roles.test.js
tests/equipe-01-relecture.test.js tests/equipe-01-roles-pack.test.js tests/equipe-01-continuer.test.js` →
ℹ tests 46, ℹ pass 46, ℹ fail 0. `tests/swarm-04-verdict.test.js` seul : 7 / 7.

Phase unitaire (`node …/phase-unitaire.mjs <ARBRE>`, finie le 20/11 vers 23:41 AEDT) :

```text
ℹ tests 1618
ℹ pass 1615
ℹ fail 0
ℹ cancelled 0
ℹ skipped 2
ℹ todo 1
FIN phase unitaire : code 0 (durée 184 s)
```

Référence 1 611 / 1 608 / 0 / 2 / 1 : + 7 tests (ceux du lot), rien d'autre ne bouge. Le bloc « ✖ failing tests »
du journal ne contient que le test « à faire » déjà connu (`tests/review2-lecture-18-11.test.js:248`). Journal
supprimé après lecture.

`npm run check` → « Syntaxe JavaScript valide. », code 0. `npm run format:check` → « All matched files use Prettier
code style! », code 0 (après `npx prettier --write` sur les fichiers du lot).

## Points à trancher par le manager

- `docs/api-delegation.md` (non touché, possédé par un lot parallèle) : renvoi vers `docs/api-verdicts.md` à ajouter
  aux lignes 292-296 (paragraphe « Verdict » : la forme doit mentionner `complet?: false`), 303-306 (« Bilan de la
  mère » : lignes « illisible » / « sans point bloquant précis » et « , n illisible(s) ») et 308 (« Limites » :
  « `absent` le plus souvent »).
- Le texte de rôle n'a pas été rejoué avec des agents réels (hors lot, plan).
