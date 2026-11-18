# Rapport `precision-18-11` — précision de la consigne commune des questions (E130)

Session de code du 18/11/2026, début 17:38, fin 17:43 (heures lues par `date`). Arbre
`~/Downloads/agregat-back-precision`, branche `precision-18-11`. Seul écrivain. Aucun agent réel, aucune API, aucun
réseau, aucun accès au relais.

## Ce qui change, fichier par fichier
- `packages/orchestrator/owner-question-rule.js` : `OWNER_QUESTION_RULE` porte, juste après « (message obligatoire,
  options facultatives). » et avant « Dans les deux cas… », la phrase : « Un outil de question qui rend la main tout de
  suite, sans attendre la réponse, n’est pas un formulaire de question : si c’est le seul que tu as, pose ta question par
  le champ JSON question. » Le reste de la phrase est inchangé. Commentaire (anglais) qui renvoie à E130 et dit que la
  phrase précise ce qu'est un formulaire sans interdire d'outil.
- `docs/api-questions.md` : phrase commune à jour, et un paragraphe « Pourquoi la précision… (E130) ».
- `tests/fix-resume.test.js` : la mission navigateur (agent factice) attend aussi la précision dans la consigne envoyée.
- `tests/question-mal-formee.test.js` : le test existant « consigne commune (career-ops / mission navigateur) …
  identiques pour tous les profils d’agents » vérifie en plus que la consigne réellement envoyée à l'agent factice
  contient la précision, écrite en clair dans le test (constante `PRECISION`), pour chaque profil ; l'égalité des
  consignes entre profils était déjà vérifiée.
- `tests/review-questions-18-11.test.js` : nouveau test, la précision est à sa place (après les deux voies, avant
  « Dans les deux cas »), une seule fois, et la phrase ne nomme pas l'outil asynchrone en cause.

## Point 2 du brief (grep), constaté
`grep` de `OWNER_QUESTION_RULE`, « formulaire de question », « formulaire de ton agent », `withDoubtRule`,
`AskUserQuestion`, « champ JSON question », « Règle des questions » dans `packages`, `apps`, `tests`, `docs` : la
constante est citée par `packages/career-ops/integration.js` (consigne du pack), `packages/orchestrator/index.js`
(missions navigateur) et ajoutée par `withDoubtRule` (`doubt-rule.js`) ; aucune autre consigne ne redit « utilise le
formulaire de ton agent » avec d'autres mots. Rien d'autre à modifier.

## Tests (un fichier à la fois, après le changement)
| Commande | Résultat |
|---|---|
| `node --test tests/question-mal-formee.test.js` | 14 tests, 14 pass, 0 fail |
| `node --test tests/review-questions-18-11.test.js` | 14 tests, 14 pass, 0 fail |
| `node --test tests/fix-resume.test.js` | 28 tests, 28 pass, 0 fail |
| `node --test tests/doubt-tools.test.js` | 19 tests, 19 pass, 0 fail (non modifié : il cite la constante) |
| `node --test tests/agent-result.test.js` | 13 tests, 13 pass, 0 fail |
| `node --test tests/elicitation.test.js` | 26 tests, 26 pass, 0 fail |
| `node --test tests/question-finale.test.js` | 8 tests, 8 pass, 0 fail |
| `node --test tests/bilan-questions.test.js` | 2 tests, 2 pass, 0 fail |
| `node --test tests/reponse-prose.test.js` | 6 tests, 6 pass, 0 fail |
| `node --test tests/career-integration.test.js` | 50 tests, 50 pass, 0 fail |
| `npm run check` | « Syntaxe JavaScript valide. », code 0 |
| `npx prettier --check` (5 fichiers touchés) | « All matched files use Prettier code style! » |

## Commits
- `715bb74` consigne commune et documentation.
- `2e4820e` tests. Coquille dans le message : « figurée » pour « figée » (non corrigée : pas d'amend).
- Le commit de ce rapport suit.

## Écarts au brief
- Apostrophes typographiques (’) dans la précision, comme le reste de la phrase commune, au lieu des apostrophes droites
  du brief. Mots identiques sinon.
- Constaté, non changé (hors du brief, qui dit que le reste de la phrase ne change pas) : la phrase commune contient
  déjà « (AskUserQuestion / elicitation ACP) », nom d'outil d'un agent. À trancher par le manager.

## Non vérifié
- Aucun essai réel (le manager le fera) : effet de la phrase intégrée sur les agents réels, épreuve 3 à rejouer.
- Pas de `npm test` complet (laissé au manager).
- Pas de passage « rouge » des nouvelles assertions (pas de retour arrière temporaire du code) ; déduit : elles portent
  sur le texte en clair de la précision, donc échoueraient sans elle.
