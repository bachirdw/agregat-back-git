# Brief `collecte-18-11` — une collecte d'offres demandée « sans traitement » ne doit plus finir en échec (E135)

Écrit par le manager le 18/11/2026 à 19:04. Ordres du propriétaire du 18/11 : « le prompt prime sur le Skill » (une
limite écrite dans le prompt n'est pas un défaut) ; tout prompt doit aboutir avec tout agent ; coder en parallèle ; et
**aller doucement sur ce qui marche** : changements additifs, le moins possible dans le moteur.
Arbre : `~/Downloads/agregat-back-collecte`, branche `collecte-18-11`. Rapport : `.manager/reports/collecte-18-11.md`.
À lire d'abord, en entier : `.manager/reports/e135-faits-18-11.md` ; puis la ligne E135 de
`.manager/reports/registre-erreurs.md`.

## Faits
Une mission dont le prompt demande de parcourir des pages de résultats et d'ajouter chaque offre à `data/pipeline.md`
« sans l'ouvrir, sans la noter et sans l'évaluer » fait ce travail, puis finit en `failed` : « Mission incomplète : boîte
d'entrée non traitée (0 sur 75) ». La cause est la règle `inboxUnprocessed` (`packages/career-ops/truth.js`, vers les
lignes 918 à 941) : elle ne connaît qu'une façon pour le prompt de borner le traitement, un nombre d'entrées
(`COUNT_LIMIT`). La même fonction sert à l'état de la mission et à la ligne « Non exécuté » du Bilan.

## Travail demandé (option B du rapport des faits, et elle seule)
1. Dans `packages/career-ops/truth.js`, à côté de `COUNT_LIMIT` et sur le même modèle, ajouter un motif « collecte sans
   traitement » : quand le prompt dit lui-même de **ne pas traiter les entrées** (ne pas les ouvrir, ne pas les noter,
   ne pas les évaluer, ne pas les traiter ; en français et en anglais, comme `COUNT_LIMIT`), `inboxUnprocessed` rend
   `null`. Rien d'autre ne change dans la fonction ni dans le fichier.
2. Le motif doit porter sur les **offres ou entrées** (pronom « l' », « la », « les », ou « les offres », « les
   annonces », « les entrées », ou verbe sans complément en fin de proposition). Il ne doit pas se déclencher sur une
   restriction qui parle d'autre chose : « sans scan », « sans postuler », « sans rien envoyer », « sans ouvrir le
   navigateur », « sans écrire », « ne note pas mon adresse »… Cas limites à trancher par des tests, au plus prudent :
   dans le doute, le motif ne se déclenche pas (le comportement actuel reste).
3. Tests dans un fichier neuf `tests/collecte-18-11.test.js` :
   - la fonction seule : une douzaine de prompts qui déclenchent, une douzaine qui ne déclenchent pas (dont tous les
     exemples ci-dessus et les prompts des tests existants de la boîte d'entrée) ;
   - par le même chemin que l'agent réel (reprendre la façon de faire de `tests/boite-ajouts-traites.test.js` et de
     `tests/career-pipeline-flow.test.js`, agent factice `tests/fixtures/fake-acp.js`) : une mission qui ajoute des
     entrées à une boîte déjà garnie, avec un prompt de collecte « sans les ouvrir ni les noter » → état `completed`,
     aucune ligne « boîte d'entrée non traitée » au Bilan ; la même mission sans cette restriction → toujours « Mission
     incomplète : boîte d'entrée non traitée (0 sur N) », à l'identique d'aujourd'hui.
4. Relancer, sans les modifier, `tests/career-pipeline-flow.test.js`, `tests/boite-ajouts-traites.test.js` et tout
   autre fichier de test qui appelle `inboxUnprocessed` ou cite « boîte d’entrée » : ils doivent rester verts.

## Fichiers
`packages/career-ops/truth.js` (une constante et une ligne dans `inboxUnprocessed`, plus le commentaire) ;
`tests/collecte-18-11.test.js` (neuf) ; ton rapport. Rien d'autre : ni l'orchestrateur, ni `skill-router.js`, ni le
manifeste du pack, ni `fake-acp.js`. Si un autre fichier devait changer, ne le touche pas : note-le au rapport.

## Règles de travail (les mêmes pour tous les sprints du 18/11)
- Commits locaux préfixés `[collecte-18-11]`, par chemins explicites (`git commit -m … -- <fichiers>`, `git add` seulement
  pour un fichier nouveau). Jamais `git add -A`, stash, reset, rebase, amend ni réécriture d'historique. Aucun push,
  aucun merge.
- Un seul écrivain dans l'arbre à la fois. N'entre jamais dans `~/Downloads/agregat-back`. N'écris rien hors de
  `~/Downloads/agregat-back-collecte`. Ne lis aucun secret (`.env*`, `.envforme`, `.manager/secrets.env`,
  `~/.codex/auth.json`, `~/.claude*`).
- Règles du propriétaire : mêmes consignes et mêmes outils pour tous les agents, **rien de propre à un agent** ; **ne
  rien ajouter qui restreigne l'agent** ; pas de garde nouvelle, pas de relecture orientée sécurité. **Rien d'existant ne
  change** : une mission dont le prompt ne contient pas le nouveau motif doit se comporter exactement comme avant.
- Intouchables : la bibliothèque et le Skill career-ops, les CV, `package.json` et `package-lock.json`.
- Tests ciblés seulement, un fichier à la fois : `node --test tests/<fichier>.test.js`, puis `npm run check` et
  `npx prettier --check` sur les fichiers touchés. **Pas de `npm test` complet, aucun test qui démarre un navigateur**
  (une suite complète et des missions réelles tournent dans d'autres arbres) ; liste au rapport les tests que tu n'as
  pas pu lancer pour cette raison. Aucun agent réel lancé, aucune API démarrée, aucun accès au relais Playwriter (port
  19988), aucun réseau.
- Aucune donnée personnelle (nom, entreprise, URL d'offre, texte de prompt réel) dans le code, les tests ou le rapport.
- `date` avant chaque heure écrite. Constaté et hypothèse séparés. Dire ce qui n'est pas vérifié (dont : aucun essai
  réel, que le manager fera). Une commande refusée n'est jamais reformulée ni enrobée dans un script.

## Ce qui est fini quand
Le motif est ajouté dans le seul fichier nommé, les tests ciblés sont verts, et le rapport dit ce qui a changé, la liste
exacte des formulations reconnues et refusées, les résultats exacts des tests, ce qui n'est pas vérifié et ce qui reste
à décider par le propriétaire.
