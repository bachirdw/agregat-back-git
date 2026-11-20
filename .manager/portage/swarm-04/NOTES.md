# swarm-04 — Notes du copieur (portage depuis desplega-ai/agent-swarm, MIT, © desplega.sh)

Écrit le 20/11/2026 (horloge lue : 23:32 AEDT). Swarm lu en lecture seule, rien n'en a été exécuté. Pas de code à
porter dans ce lot (plan, section swarm-04) : seul `verificateur-source.md` (phrases, lignes, traductions, texte de
rôle proposé) et ces notes.

## 1. Ce qui est copié

| Origine (swarm) | Repris dans |
| --- | --- |
| `src/workflows/validation.ts:6-12, 24-51` (`validateOutputSchema`, `extractPassResult`) | Règle 1 de `verificateur-source.md` ; idée « hors forme = pas un verdict » → `complet: false` |
| `templates/official/reviewer/SOUL.md:23, 29-31, 34` | Règles 2, 3, 4 |
| `templates/official/reviewer/CLAUDE.md:33-34` | Règle 3 |
| `REVIEW.md:7, 11, 15, 32` | Règles 3 et 4 |
| `templates/workflows/ralph-loop/content.md:5, 10, 19, 37, 43` | Règles 3 et 5 |

Écarté : `runStepValidation` (validation.ts:53-117 : boucle « retry/halt » de leur moteur de workflows, sans
équivalent dans ce lot ; le plan dit « Moteur : non touché ») ; les règles de CI de `CLAUDE.md:38-50` (`gh pr checks`,
propres aux PR GitHub) ; la liste des tests sans valeur de `REVIEW.md:34-50` (hors des six exigences du lot) ; les
noms d'outils, de Skill (`code-quality`) et de modèles (`raw-llm`, `LLM`) : non repris dans le texte proposé.

## 2. Écarts entre les lignes du plan et ce que j'ai trouvé

- `validation.ts:1-51` : les lignes 1-4 sont des imports ; le passage utile est 6-12 (`validateOutputSchema` : une
  forme fausse rend une erreur) et 24-51 (`extractPassResult`). Pas de phrase « une sortie hors forme est une erreur »
  écrite telle quelle : c'est le comportement du code (lignes 11, 31, 36, 43-46) ; je cite donc le code et ses
  commentaires (lignes 6, 25, 27-28, 42, 48).
- `SOUL.md:29` : confirmé (« No rubber stamps »). Le « comment corriger » est à la ligne 31 (« Constructive, not
  destructive »), pas 29.
- `CLAUDE.md:33-34` : confirmé.
- `REVIEW.md:11, 32-34` : la ligne 11 parle d'un test de la « junk list », pas du test de non-régression ; la phrase
  voulue est seule à la ligne 32 ; la ligne 33 est vide et la 34 est le titre `## Junk tests`. La phrase la plus
  proche de la règle 4 en dehors de 32 est à la ligne 7 (« a missing or non-failing regression test »).
- `ralph-loop/content.md` : le plan ne donne pas de lignes ; verdict lisible par machine aux lignes 37 (outputSchema
  `verdict` PASS/FAIL + `fixes`), 5, 10 et 19.

## 3. Forme d'un verdict : swarm face à Relay

**Swarm** (`src/workflows/validation.ts`) : le résultat d'un validateur est ramené à un **booléen** par
`extractPassResult(executorType, output)`. Seul un champ explicite compte : `pass === true` (validate),
`exitCode === 0` (script), `passed === true` (property-match), `result.pass === true` (validateur modèle) ; sortie
absente, non objet ou texte libre → `false`. Avant cela, `validateOutputSchema` rend une **erreur** (chaîne
« Output schema validation failed: … ») quand la sortie ne suit pas le schéma déclaré : une sortie hors forme n'est
jamais lue comme un verdict. Ensuite `runStepValidation` rend `{ outcome: 'pass'|'halt'|'retry', passed?,
retryContext? }`. Dans ralph-loop, la forme conseillée est `{ verdict: 'PASS'|'FAIL', fixes: [] }`.

**Relay** (`packages/orchestrator/roles.js`) :
- `normalizeVerdict(raw, source)` (lignes 169-183) : `null` si `raw.verdict` (passé par `roleKey`) n'est pas dans
  `VERDICTS = ['approuve','a_corriger','rejete']` (ligne 24) ; sinon `{ valeur, bloquants, remarques, source }` avec
  `bloquants` = 20 au plus, chaque élément `{ ou, pourquoi }` (500 car. par champ, `clip`) ; un élément non objet
  devient `{ ou: '', pourquoi: clip(item) }` ; `remarques` = 20 au plus, 500 car.
- `readVerdict({ cwd, folder, answer, since, until })` (lignes 191-211) : 1) `verdict.json` du dossier de résultats
  (lecture confinée, 20 Ko, écrit entre `since` et `until`) normalisé avec source `fichier` ; 2) sinon la dernière
  ligne « Verdict : … » de la réponse (`ANSWER_LINE`, ligne 185-186) → `{ valeur, bloquants: [], remarques: [],
  source: 'reponse' }` ; 3) sinon `{ valeur: 'a_corriger', bloquants: [], remarques: [], source: 'absent' }`.
- Différence clé : swarm fait d'une forme fausse un **échec explicite** ; Relay fait aujourd'hui d'un verdict absent
  un `a_corriger` **indiscernable** d'un vrai, et d'une ligne de réponse un verdict sans point bloquant. Le lot garde
  les trois valeurs publiques et ajoute `complet: false` (facultatif, seulement `false`, absent sinon).

## 4. Ce que le codeur doit savoir

- Règle d'ajout de `complet: false` (plan) : `normalizeVerdict` → valeur `a_corriger` ou `rejete` et **aucun**
  bloquant avec un `pourquoi` non vide (après `clip`, et sans doute après `trim` : à trancher, le plan dit « non
  vide »). `readVerdict` → source `reponse` avec `a_corriger`/`rejete`, et source `absent`. `approuve` : jamais
  `complet`. Un verdict complet garde exactement sa forme (pas de clé `complet: true`).
- Un bloquant chaîne (`bloquants: ['B FICTIF']`) donne `{ ou: '', pourquoi: 'B FICTIF' }` : il compte comme précis
  (`pourquoi` non vide). Le test `tests/equipe-01-relecture.test.js:122` s'en sert.
- Dans `verificationLines` et `familySection`, tester `verdict.complet === false` et `verdict.source === 'absent'`,
  **pas** `bloquants.length` : les tests passent des verdicts construits à la main sans `complet` ni `source`
  (`tests/equipe-01-relecture.test.js:218-228` : `{ valeur: 'a_corriger' }`, et
  `tests/equipe-01-roles.test.js:301` : `v(valeur, source)` sans bloquant) et attendent les lignes d'aujourd'hui.
  Priorité : source `absent` → « illisible (aucun verdict rendu) » avant « sans point bloquant précis » (un absent a
  aussi `complet: false`).
- `verificationLines` (lignes 239-246) ne garde aujourd'hui que `valeur` dans `last` : il faudra garder le verdict
  entier (ou `source`/`complet`) pour écrire la ligne par travail.
- Le texte proposé pour `verificateur.md` fait 1 038 caractères (corps actuel : 489) ; `parseRole` refuse au-delà de
  4 000 (`MAX_CONSIGNE`, roles.js:22, ligne 57) ; `tests/equipe-01-roles-pack.test.js:170` vérifie
  `100 < consigne.length <= 4000` pour chaque rôle de la plateforme.
- La forme de `verdict.json` n'a pas de champ « comment corriger » : le texte de rôle demande de le mettre dans
  `pourquoi`. Ne pas ajouter de champ (contrat inchangé, plan : seul `complet` est neuf).
- `DJ` non touché : `verdictOf` rend l'objet tel quel (plan).

## 5. Égalités strictes des tests existants (lues dans l'arbre, non lancées)

`tests/equipe-01-roles.test.js` :
- **Cassent** avec `complet: false` (deepEqual sur l'objet entier) :
  - ligne 258-263 : `readVerdict` par la réponse, `rejete`, source `reponse` → recevra `complet: false`.
  - ligne 264-269 : `readVerdict` absent → recevra `complet: false`.
  - ligne 456-461 : `done.verdict` de `mission_attendre`, source `absent` → recevra `complet: false`.
- **Restent vertes** si le codeur suit le plan :
  - ligne 518-523 : verdict par fichier avec un bloquant complet (forme inchangée).
  - lignes 541, 543, 544, 576-578, 581 : expressions régulières ou paires `[valeur, source]`.
  - ligne 328 : `/Vérifications : 3 \(1 approuvée\(s\), 1 à corriger, 1 rejetée\(s\)\)/` avec un enfant
    `v('rejete', 'absent')` (ligne 322) : si « , 1 illisible(s) » est ajouté **dans** la parenthèse, juste avant `)`,
    l'expression (qui exige `rejetée(s))`) casse ; ajouté après la parenthèse fermante, elle reste verte. À choisir
    en connaissance de cause ; le plan dit seulement « la ligne de total ajoute « , n illisible(s) » ». Noter aussi
    que ce cas `rejete` + `absent` n'arrive pas en vrai (`absent` vaut toujours `a_corriger`).
  - ligne 327 : `a_corriger (source : fichier)` pour V1 construit sans `complet` : vert si `familySection` teste
    `complet === false`.

`tests/equipe-01-relecture.test.js` :
- ligne 125, 129, 140 : `equal` sur `source`/`valeur` seulement → vertes.
- ligne 203-206 : vérification jamais partie, pas de verdict → vertes.
- ligne 222 : `lines.includes('« A » : dernier verdict a_corriger, non revérifié depuis')` avec un verdict
  `{ valeur: 'a_corriger' }` sans `complet` → verte si la condition est `complet === false` (casse si elle porte sur
  l'absence de bloquants).
- Je n'y ai trouvé aucune égalité stricte qui casse forcément.

## 6. Non vérifié

- Aucun test lancé (rôle de copieur). Les « restent vertes » ci-dessus sont lus dans le code, pas constatés.
- Le texte de rôle n'a pas été joué avec un agent réel (le plan le met hors lot).
- `docs/api-delegation.md:292-309` décrit le verdict d'aujourd'hui ; je ne sais pas si le codeur doit le mettre à jour
  (fichier non listé dans le lot : `docs/api-verdicts.md` est le seul document à créer).
