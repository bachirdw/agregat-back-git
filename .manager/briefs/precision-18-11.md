# Brief `precision-18-11` — la consigne commune dit qu'un outil de question qui n'attend pas n'est pas un formulaire (E130)

Écrit par le manager le 18/11/2026 sur l'accord du propriétaire (« Oui, corrige », 17:36).
Arbre : `~/Downloads/agregat-back-precision`, branche `precision-18-11` (partie de `contacts-13-11`).
Rapport au fil de l'eau : `.manager/reports/precision-18-11.md`. Commits locaux `[precision-18-11]` par chemins
explicites (`git commit -m … -- <fichiers>`, `git add` seulement pour un fichier nouveau). Aucun push, aucun merge.

À lire d'abord : `.manager/reports/e130-faits-18-11.md` (les faits, les sondes et les essais réels), la ligne E130 de
`.manager/reports/registre-erreurs.md`, `docs/api-questions.md`, `packages/orchestrator/owner-question-rule.js`.

## Le problème, établi par des faits
- La consigne commune (`OWNER_QUESTION_RULE`) dit : « utilise le formulaire de question de ton agent s'il t'en offre un ;
  sinon termine ta réponse JSON par le champ question… ».
- Un agent peut posséder un outil de question qui **rend la main tout de suite, sans attendre la réponse**. Il le prend
  pour « le formulaire de son agent », l'appelle, puis attend ou termine son tour. Rien n'arrive à la plateforme : la
  question n'est jamais posée au propriétaire (missions d2f836d2 et e6ddb095 du 18/11).
- Essai réel du 18/11 à 17:33, une mission par agent, même prompt : avec la phrase « un outil de question qui rend la
  main tout de suite, sans attendre la réponse, n'est pas un formulaire de question ; si c'est le seul que tu as, pose ta
  question par le champ JSON question de ta réponse » ajoutée au prompt, l'agent qui n'a que cet outil pose sa question
  par le champ JSON (question `prose` ouverte, e5a4d8a6) et l'agent qui a un vrai formulaire le garde (`form`, 22f7d608).

## Règles du propriétaire qui cadrent ce sprint
- Mêmes autorisations et mêmes consignes pour tous les agents. **Rien de propre à un agent** : pas de branche sur
  l'identité de l'agent, pas de nom d'agent ni de nom d'outil d'un agent dans la phrase envoyée aux agents.
- Ne rien ajouter qui restreigne l'agent ou l'empêche d'aller au bout : la phrase **précise** ce qu'est un formulaire,
  elle n'interdit aucun outil. Aucune garde, aucun contrôle nouveau, aucune relecture orientée sécurité.

## Travail demandé (petit, et rien d'autre)
1. `packages/orchestrator/owner-question-rule.js` : ajouter à `OWNER_QUESTION_RULE` la précision, au plus près des mots
   essayés en réel : « Un outil de question qui rend la main tout de suite, sans attendre la réponse, n'est pas un
   formulaire de question : si c'est le seul que tu as, pose ta question par le champ JSON question. » La placer juste
   après la phrase qui donne les deux voies, avant « Dans les deux cas… ». Le reste de la phrase commune ne change pas.
   Le commentaire du fichier (en anglais, comme l'existant) dit pourquoi, en renvoyant à E130.
2. Vérifier par `grep` que toutes les consignes qui parlent de question au propriétaire reprennent bien la constante
   (pack career-ops, missions navigateur, `withDoubtRule`) et qu'aucune ne redit ailleurs, avec d'autres mots, « utilise
   le formulaire de ton agent » sans la précision. Si tu en trouves une, fais-la citer la constante, sans rien retirer
   d'autre.
3. `docs/api-questions.md` : la phrase commune à jour, et une ligne qui dit pourquoi cette précision existe.
4. Tests, par le même chemin que l'agent réel (agent factice `tests/fixtures/fake-acp.js`) : adapter les assertions qui
   figent le texte de la phrase (`tests/fix-resume.test.js`, `tests/question-mal-formee.test.js`,
   `tests/review-questions-18-11.test.js`, `tests/doubt-tools.test.js` si besoin) ; ajouter un test qui vérifie que la
   consigne réellement envoyée à l'agent contient la précision, pour le pack career-ops et pour une mission navigateur,
   et qu'elle est identique pour tous les profils d'agents.

## Ce qu'on ne touche pas
Le traitement des questions (`result.js`, `questions.js`, `workflow-run.js`, `agent-runtime`), le lancement des agents,
les profils d'agents, les dépendances (`package.json`, `package-lock.json`), le pack career-ops hors de la consigne, la
bibliothèque et le Skill career-ops, les CV. Pas de mise à jour de l'adaptateur `codex-acp`.

## Vérification
- Tests ciblés seulement, un fichier à la fois : `node --test tests/<fichier>.test.js` (les fichiers touchés et leurs
  voisins : `agent-result`, `elicitation`, `question-finale`, `bilan-questions`, `reponse-prose`, `doubt-tools`,
  `fix-resume`, `question-mal-formee`, `review-questions-18-11`, `career-integration`), puis `npm run check` et
  `npx prettier --check` sur les fichiers touchés. **Pas de `npm test` complet** (le manager le lance à l'intégration).
- Aucun agent réel lancé, aucune API démarrée, aucun accès au relais Playwriter (port 19988), aucun réseau.

## Règles de travail
- Jamais `git add -A`, stash, reset, rebase ni réécriture d'historique. Un seul écrivain dans l'arbre à la fois.
- N'entre jamais dans `~/Downloads/agregat-back`. Ne lis aucun secret (`.env*`, `.envforme`, `.manager/secrets.env`,
  `~/.codex/auth.json`, `~/.claude*`). Aucune donnée personnelle dans le code, les tests ou le rapport.
- `date` avant chaque heure écrite. Constaté et hypothèse séparés. Dire ce qui n'est pas vérifié.
- Une commande refusée n'est jamais reformulée ni enrobée dans un script : note-le au rapport et continue.

## Ce qui est fini quand
La phrase commune porte la précision, toutes les consignes la reprennent, la documentation est à jour, les tests ciblés
sont verts, et le rapport dit ce qui a changé, les résultats exacts des tests et ce qui n'est pas vérifié (dont : aucun
essai réel, que le manager fera).
