# Relecture `review-collecte-18-11` du sprint `collecte-18-11` (E135)

Arbre `~/Downloads/agregat-back-collecte`, branche `collecte-18-11`. Relecteur-correcteur indépendant (sous-agent
Opus), seul écrivain. Début 18/11/2026 vers 19:09, fin 19:15 (`date` : 19:14 au dernier essai). Base de comparaison : `8758de4`.

## 1. Périmètre — conforme (constaté)
- `git diff --stat 8758de4..12d5dff` : `.manager/reports/collecte-18-11.md` (+110), `packages/career-ops/truth.js`
  (+30 −1), `tests/collecte-18-11.test.js` (+160). Rien d'autre.
- Dans `truth.js`, le diff ne contient que des lignes ajoutées entre `COUNT_LIMIT` et `export function
  inboxUnprocessed` (commentaire + constantes), et la ligne `if (COUNT_LIMIT.test(…)) return null;` remplacée par la
  même condition `|| COLLECT_ONLY.test(…)`, que prettier a coupée sur deux lignes. Aucune autre ligne déplacée par
  prettier ; sens inchangé (même retour `null`, même ordre d'évaluation).

## 2. Inertie — conforme (constaté, avec une réserve)
- Balayage hors dépôt (script dans le bac à brouillon) : 2 945 chaînes et lignes de 321 fichiers (`tests`, `docs`,
  `domain-packs`, `apps`, `packages`) qui citent boîte d'entrée / inbox / pipeline / offre(s) / offer(s), passées dans
  l'ancienne et la nouvelle `inboxUnprocessed` (truth.js de `8758de4` extrait à part). Une seule chaîne de test change :
  `tests/bilan-sans-negation.test.js`, « Lis l’offre FICTIVE sans la noter, puis envoie un courriel… ». Ce test n'a
  pas de boîte d'entrée garnie : la règle rendait déjà `null` ; le fichier reste vert (4/4). Le motif s'y déclenche à
  juste titre (« la » = l'offre, et ce n'est pas un ordre de traitement de la boîte).
- Aucun prompt « Traite la boîte d’entrée … » / « Process the inbox … » des tests existants ne déclenche le motif.
  Test d'inertie ajouté (chaînes des fichiers de test qui citent boîte d'entrée, inbox ou pipeline).

## 3. Faux positifs — défaut trouvé et corrigé
Constaté avant correction : 21 vrais ordres de traitement déclenchaient le motif (donc une boîte non traitée n'était
plus signalée), alors qu'ils étaient tous jugés « non traitée » avant le sprint. Exemples (FICTIFS) :
« Traite la boîte d’entrée sans les noter en dessous de 4 », « ne les note pas en dessous de 3 », « ne les traite pas
deux fois », « ne la note pas sur 10 mais sur 5 », « ne les ouvre pas toutes », « sans l’ouvrir dans un nouvel
onglet », « n’évalue aucune offre de plus de 30 jours », « si le lien n'ouvre pas, passe à la suivante »,
« don't open them in a new tab », « do not process them twice », « without scoring them below 3 », « never open it
twice », « if the page is not opening, skip it ». Causes : après un pronom, aucune fin de proposition n'était
exigée (contrairement aux entrées nommées) ; « n'ouvre pas » et « not » + verbe nu en fin de proposition.

Correction, au plus étroit (`truth.js`, commit `11aebc8`, +12 −4) :
- après le pronom (formes 1, 3 et anglaise `them|it`), même fin que pour les entrées nommées (`ENTRY_TAIL`), avec
  « une à une / un par un / individuellement / one by one / individually » admis avant ;
- « aucune offre » suivi de la même fin ;
- « n'ouvre pas » + verbe nu : retiré (il faut nommer les entrées) ; « not » + verbe nu : retiré (« without / do not /
  don't / never / nor » + verbe nu restent).
Déjà non déclenchés et vérifiés : « n'ouvre les offres que si… », « never rate the offers below 3 », « sans ouvrir
ni noter les offres déjà vues ». « ne traite pas plus de 10 offres » rendait déjà `null` avant le sprint
(`COUNT_LIMIT`), inchangé.

## 4. Faux négatifs utiles — conforme (constaté)
La forme de la phrase d'origine, « ajoute chaque offre trouvée à data/pipeline.md, sans l'ouvrir une à une, sans la
noter et sans l'évaluer », déclenche avant et après correction, ainsi que 12 variantes testées : « sans l'ouvrir une
à une » seul, « sans les ouvrir une par une », « sans l’ouvrir, ni la noter, ni l’évaluer », « sans l'ouvrir ni la
noter ni l'évaluer », « sans ouvrir, noter ni évaluer les offres », entre parenthèses, « ne les ouvre pas, ne les note
pas, ne les évalue pas », « sans l’ouvrir individuellement », et en anglais « without opening them one by one,
scoring or evaluating them », « without opening it individually », « do not open, score or evaluate them. ». Les 16
formes reconnues du codeur restent reconnues.

## 5. Rien de propre à un agent, rien qui restreigne, aucune donnée personnelle — conforme (constaté)
Aucun nom d'agent ni de site dans le diff ; le motif ne fait que retirer une exigence de fin (il ne bloque rien) ;
seules adresses : `jobs.example.test` et `127.0.0.1` éphémère des tests.

## Résultats exacts des tests (après correction, un fichier à la fois, `node --test --test-reporter=tap`)
Avant correction, `review-collecte-18-11` : 3 tests, 2 pass, 1 fail (faux positifs), contre-épreuve faite.

| Fichier | tests | pass | fail |
|---|---|---|---|
| collecte-18-11 | 5 | 5 | 0 |
| review-collecte-18-11 (neuf) | 3 | 3 | 0 |
| boite-ajouts-traites | 4 | 4 | 0 |
| career-pipeline-flow | 7 | 7 | 0 |
| career-pipeline | 16 | 16 | 0 |
| doubt-tools | 19 | 19 | 0 |
| etape-reprise-echec | 6 | 6 | 0 |
| contacts-courriel | 26 | 26 | 0 |
| lecture-page-liste | 12 | 12 | 0 |
| intention-par-phrase | 5 | 5 | 0 |
| intention-anglais | 2 | 2 | 0 |
| preuve-effet | 7 | 7 | 0 |
| release-report-num | 10 | 10 | 0 |
| question-finale | 8 | 8 | 0 |
| skill-router | 41 | 41 | 0 |
| bilan-sans-negation | 4 | 4 | 0 |

`npm run check` : « Syntaxe JavaScript valide. » ; `npx prettier --check` sur `truth.js` et les deux fichiers de
test : propre. Aucun de ces fichiers ne démarre de navigateur (recherche `chromium|playwright|puppeteer|headless|19988`
: 0).

## Non vérifié
- `npm test` complet (consigne) ; aucun essai réel (agent, Skill, site) : le prompt réel d'E135 n'est testé que par
  sa forme.
- Le balayage d'inertie ne voit que les chaînes du dépôt, pas les prompts réels passés en base des missions.

## À décider par le propriétaire (hypothèses, non tranchées ici)
- Mélange dans un même prompt : « Traite la boîte d’entrée ; ajoute aussi les nouvelles offres sans les ouvrir. »
  déclenche le motif (constaté) et la boîte non traitée ne serait plus signalée. Le motif ne sait pas distinguer à
  quoi s'applique la restriction ; le resserrer demanderait de lire la phrase entière (hors « au plus étroit »).
- Pronoms : « la », « l' » renvoyant à autre chose qu'une offre, en fin de proposition (« ne note pas mon adresse,
  sans la noter. ») déclenchent encore ; risque déjà signalé par le codeur.
- Verbe nu en fin de proposition après « sans » reste reconnu, comme voulu par le codeur : « Traite la boîte d’entrée sans évaluer. » déclenche donc aussi (constaté), alors que ce peut être un traitement sans évaluation. Non corrigé : forme retenue par le codeur, à trancher.
