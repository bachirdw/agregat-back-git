# Rapport du sprint `collecte-18-11` (E135, option B)

Arbre : `~/Downloads/agregat-back-collecte`, branche `collecte-18-11`. Codeur : sous-agent Opus.

## Journal
- 19:05 — Lecture du brief, de `e135-faits-18-11.md`, de la ligne E135 du registre et d'`AGENTS.md` (le brief
  l'emporte : commits par chemins explicites, jamais `git add -A`). Arbre propre au départ, tête `8758de4`.
  Relu : `inboxUnprocessed` et `COUNT_LIMIT` (`packages/career-ops/truth.js:914-941`), les tests
  `tests/career-pipeline.test.js` (E51), `tests/boite-ajouts-traites.test.js`, `tests/career-pipeline-flow.test.js`
  et le scénario `FICTIF_PIPELINE_AJOUT` de l'agent factice `tests/fixtures/career-agent.js`.
- 19:06 — Motif `COLLECT_ONLY` ajouté à côté de `COUNT_LIMIT` dans `packages/career-ops/truth.js` (constantes,
  commentaire, et la seule ligne `if (COUNT_LIMIT.test(…) || COLLECT_ONLY.test(…)) return null;` dans
  `inboxUnprocessed`). Rien d'autre ne change dans la fonction ni dans le fichier.
- 19:07 — Fichier neuf `tests/collecte-18-11.test.js` (5 tests). Vert du premier coup.
- 19:07 — Contre-épreuve : ligne de `inboxUnprocessed` remise provisoirement à l'identique d'avant → 2 tests rouges
  sur 5 (les prompts reconnus rendent la cause ; la collecte « sans les ouvrir ni les noter » finit `failed`, soit
  E135 reproduit), les 3 autres verts. Ligne remise ensuite.
- 19:08 — `npx prettier --check` signalait les deux fichiers touchés (la version de `truth.js` à la tête était
  propre, vérifié sur une copie dans le bac à brouillon) : `npx prettier --write` sur ces deux fichiers seuls,
  changement de mise en forme uniquement (la ligne du `if` passe sur deux lignes). Tests relancés, verts.

## Ce qui a changé
- `packages/career-ops/truth.js` : +29 −1 lignes, toutes entre `COUNT_LIMIT` et la fin d'`inboxUnprocessed`.
- `tests/collecte-18-11.test.js` : neuf.
- Ce rapport.
Rien d'autre : ni orchestrateur, ni `skill-router.js`, ni manifeste du pack, ni agent factice, ni `package*.json`.

## Le motif retenu (`COLLECT_ONLY`, drapeaux `iu`, en tête : début de texte ou caractère qui n'est ni lettre ni chiffre)
Verbes : `ouvrir|noter|évaluer|traiter` (infinitif, « e » ou « é ») ; conjugués `ouvre(s|z)|note(s|z)|évalue(s|z)|
traite(s|z)` ; anglais `open(ing)|score/scoring|rate/rating|evaluate/evaluating|process(ing)`. Apostrophe droite ou
courbe. Cinq formes :
1. `sans | ne pas | ne jamais | ni` (+ `jamais`) + pronom `l'`, `la`, `les` + infinitif : « sans l'ouvrir »,
   « ni la noter », « ne pas les évaluer », « sans jamais les ouvrir ».
2. `sans | ne pas | ne jamais` + infinitif(s) reliés par `,` `ni` `ou` `et` (`sans` répété admis), puis soit une
   entrée nommée (`les | l' | chaque | ces | cette` + `offre(s) | annonce(s) | entrée(s)`) suivie d'une fin de
   proposition (`. , ; : ! ? )`, fin de ligne ou de texte) ou de `ni et ou sans mais juste seulement`, soit
   directement une fin de proposition : « sans ouvrir ni noter les annonces. », « sans évaluer. ».
3. `ne` + pronom + verbe conjugué + `pas | jamais | plus | ni` : « ne les traite pas », « ne l'ouvre pas ».
4. `ne | n'` + verbe conjugué + `pas | jamais | plus` + entrée nommée (même fin) ou fin de proposition, ou
   + `aucun(e) offre | annonce | entrée` : « n'ouvre pas les offres. », « n'évalue aucune offre ».
5. Anglais : `without | do not | don't | never | not | nor` + verbe(s) reliés par `,` `or` `nor` `and`, puis
   `them | it`, ou une entrée (`the | any | each | these` facultatif + `offer(s) | posting(s) | entry | entries |
   listing(s) | ad(s)`, même fin, mots `and or nor without but just only`), ou fin de proposition.

### Formulations reconnues (testées, `inboxUnprocessed` rend `null`)
« …ajoute chaque offre à data/pipeline.md, sans l'ouvrir, sans la noter et sans l'évaluer. » (forme du prompt
d'E135, avec des mots FICTIFS) ; « sans les ouvrir ni les noter » ; « sans les évaluer » ; « ne les traite pas. » ;
« n’ouvre pas les offres. » ; « ne pas les noter, juste les lister » ; « sans ouvrir ni noter les annonces. » ;
« sans évaluer. » ; « n'évalue aucune offre » ; « sans traiter les entrées, juste la collecte » ; « sans jamais
les ouvrir » ; « et ne l’ouvre pas. » ; « without opening or scoring them » ; « do not evaluate the offers. » ;
« don’t open them » ; « without processing the entries. ».

### Formulations refusées (testées, la cause reste « boîte d’entrée non traitée (0 sur 3) »)
- Prompts des tests existants : « Traite la boîte d’entrée FICTIVE » (avec ou sans `FICTIF_PIPELINE`,
  `FICTIF_PIPELINE_AJOUT`, `DEMANDE`), « …, n’enregistre rien », « Process the inbox FICTIF ».
- Restrictions sur autre chose : « sans scan », « sans postuler », « sans rien envoyer », « sans ouvrir le
  navigateur », « sans écrire », « ne note pas mon adresse », « sans noter mon numéro », « without applying »,
  « without opening the browser », « Ouvre et note chaque offre, sans rien envoyer ».
- Cas limites tranchés au plus prudent (le motif ne se déclenche pas) : « sans ouvrir les offres expirées »
  (entrées qualifiées : restriction partielle), « ne traite pas les entrées de plus de 30 jours », « sans
  évaluation » (nom, pas verbe), « sans rien noter » (« rien » ne désigne pas les entrées), « Ne traite pas la
  boîte d’entrée » (porte sur la boîte, pas sur les entrées), « Évalue les offres et note-les ».

## Résultats exacts des tests (un fichier à la fois, `node --test tests/<fichier>.test.js`)
| Fichier | tests | pass | fail |
|---|---|---|---|
| collecte-18-11 (neuf) | 5 | 5 | 0 |
| career-pipeline-flow | 7 | 7 | 0 |
| boite-ajouts-traites | 4 | 4 | 0 |
| career-pipeline | 16 | 16 | 0 |
| doubt-tools | 19 | 19 | 0 |
| etape-reprise-echec | 6 | 6 | 0 |
| lecture-page-liste | 12 | 12 | 0 |
| intention-anglais | 2 | 2 | 0 |
| contacts-courriel | 26 | 26 | 0 |
| preuve-effet | 7 | 7 | 0 |
| release-report-num | 10 | 10 | 0 |
| intention-par-phrase | 5 | 5 | 0 |
| question-finale | 8 | 8 | 0 |
| skill-router | 41 | 41 | 0 |
Ce sont tous les fichiers de test qui appellent `inboxUnprocessed` ou citent « boîte d’entrée » (recherche `grep`),
aucun ne démarre de navigateur (recherche de `chromium|playwright|puppeteer|headless|19988` : 0). Après formatage,
`collecte-18-11` et `boite-ajouts-traites` relancés : 5/5 et 4/4. `npm run check` : « Syntaxe JavaScript valide. » ;
`npx prettier --check` sur les deux fichiers touchés : propre.

## Écarts par rapport au brief
- Le brief cite l'agent factice `tests/fixtures/fake-acp.js` ; `tests/career-pipeline-flow.test.js` passe en fait
  par `tests/fixtures/career-agent.js` (scénario `FICTIF_PIPELINE_AJOUT` : boîte lue, vivacité balayée, une entrée
  ajoutée sans cocher). J'ai repris ce chemin-là, sans modifier l'agent factice.
- Comme `career-pipeline-flow`, les deux tests de bout en bout créent l'application en mémoire et l'écoutent sur un
  port éphémère de 127.0.0.1, fermé à la fin du test : ce n'est pas l'API du propriétaire, mais c'est un serveur
  local de test (je le signale au regard de « aucune API démarrée »).

## Ce qui n'est pas vérifié
- Aucun essai réel (agent réel, vrai Skill, vrai site) : le manager le fera. En particulier, non vérifié que le
  prompt réel d'E135 (non reproduit ici) passe le motif mot pour mot ; seule sa forme (« sans l'ouvrir, sans la
  noter et sans l'évaluer ») est testée.
- `npm test` complet non lancé (consigne) ; seuls les 14 fichiers ci-dessus l'ont été.
- Le motif ne touche que `inboxUnprocessed` (état de la mission et ligne « Non exécuté » du Bilan) : l'intention
  retenue reste `pipeline` et le Bilan peut encore lister des étapes « non exécutée » (balayage, réservation…)
  comme aujourd'hui ; non examiné plus avant.

## Ce qui reste à décider (propriétaire)
- Faut-il élargir aux formes refusées par prudence (« sans évaluation », « sans rien noter », « ne traite pas la
  boîte d’entrée », entrées qualifiées) ?
- Faut-il ajouter d'autres verbes (« lire », « consulter », « scorer ») ? Non fait : hors des quatre verbes du brief.
- Intégration de la branche : sur accord seulement (aucun push, aucun merge).
- Risque connu, laissé tel quel : les pronoms sont pris pour des entrées sans vérifier à quoi ils renvoient
  (« sans la noter » après « mon adresse », « without opening it » après « the browser » déclencheraient). Le brief
  admet les pronoms ; à resserrer si un cas réel le montre.
