# Relecture `review-prompt-prime-18-11` — le prompt du propriétaire prime sur le Skill

Arbre `~/Downloads/agregat-back-prompt`, branche `prompt-prime-18-11`. Début 18:22, fin 18:29 (`date`). Diff relu :
`a79a747..prompt-prime-18-11` (commits `b0f77fc`, `3de3fe3`, `c380c52`).

## 1. Verdict

Le changement fait ce que le brief demande, par le chemin de l'agent réel : `CAREER_INSTRUCTIONS` part dans le champ
`instructions` du prompt de chaque mission career-ops (`packages/orchestrator/index.js:1625-1628`), le même texte pour
tous les agents ; `CAREER_OWNER_FRAME` part par `systemPromptAppend` (`index.js:1468`), sans branche sur l'agent. La
phrase est définie une fois (`OWNER_PROMPT_PRIME`), insérée une fois, ne nomme aucun agent, n'ajoute ni garde ni
restriction. Les règles de la plateforme (clic avant envoi final, CAPTCHA, « ne fabrique », données non fiables) sont
intactes. Seul `packages/career-ops/integration.js` change hors tests et rapport : fichiers autorisés respectés.
Aucun défaut bloquant ; aucun correctif du code nécessaire. Un test ajouté.

## 2. Constats (constaté dans le code, sauf mention)

| Gravité | Constat                                                                                                                                                                                                                                                                                                                                                                             | Sort                                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| moyen   | Le test 3 du codeur ne vérifie le cadre système reçu que par un fragment (« le prompt du candidat qui le décide »).                                                                                                                                                                                                                                                                 | Corrigé par un test : chaque profil doit recevoir le cadre entier (`tests/review-prompt-prime-18-11.test.js`). |
| moyen   | Tension hors périmètre : la phrase dit que le prompt décide des « sources », mais l'étape `scan` du manifeste (`domain-packs/career-ops/skill-manifest.yaml:284-291`, `required: true`) reste exigée sauf URL dans le prompt ou phrase « sans scan » ; un prompt qui nomme seulement un site sans URL peut finir « Mission incomplète ». Comportement antérieur (E44), non modifié. | Laissé au propriétaire (manifeste et `packages/orchestrator/` interdits par le brief).                         |
| faible  | Le test 3 remplace `plan.agent.id` après `plan()` : `plan()` est calculé pour `fixture`, une éventuelle branche par agent dans `plan()` ne serait pas vue. Lancer `plan()` sous un vrai profil risquerait de sonder un vrai agent.                                                                                                                                                  | Laissé tel quel, noté en non vérifié.                                                                          |
| faible  | « dis dans ta réponse » : la réponse est un JSON dont seul `summary` est affiché. La consigne précise juste après que `summary` est le message complet affiché ; pas d'ambiguïté réelle.                                                                                                                                                                                            | Écarté (le texte du brief est suivi, rien à corriger).                                                         |

Vérifié sans défaut : aucun test ni fixture ne fige l'ancienne fin de phrase (`grep` de « ses formats. » et « tel qu’il
est écrit. » : aucun résultat) ; `tests/fixtures/career-agent.js:276-293` reste vrai (consigne commençant par
« Active le Skill career-ops », « suis exactement sa méthode » présent) ; les tours suivants (réponse à une question,
message du propriétaire, `index.js:1784`, `1833`) restent dans la même session, la consigne du premier tour y reste ;
une reprise passe par le même chemin (`index.js:1612`). La règle de doute qui suit dit le même ordre (« suis d’abord le
prompt, puis le Skill »). Aucune documentation ne décrit ce texte (`docs/api-questions.md` ne cite
`CAREER_INSTRUCTIONS` que pour la règle des questions) : rien à accorder.

## 3. Test ajouté

`tests/review-prompt-prime-18-11.test.js` (1 test) : par `app.engine.create` (pack career-ops, mode propriétaire,
navigateur `fixture`, `startRelay` remplacé par un témoin qui doit rester faux), l'agent factice `fake-acp` lancé sous
chaque profil de `agentIds` refuse `session/new` si le cadre reçu ne contient pas `CAREER_OWNER_FRAME` en entier ; la
consigne reçue porte `OWNER_PROMPT_PRIME`, suivie de `DOUBT_RULE`, et ne répète pas la tournure non accordée « s’applique
tel qu’il est écrit ».

## 4. Contre-épreuve

- A : retrait de `${OWNER_PROMPT_PRIME} ` de `CAREER_INSTRUCTIONS` → `tests/prompt-prime-18-11.test.js` : 1 réussi,
  2 échoués (tests 2 et 3, `actual: 0, expected: 1`). Remis.
- B : cadre ramené à « s’applique tel qu’il est écrit. » → test 3 du codeur échoué (`ENOENT` sur le fichier de prompt :
  le faux agent a refusé `session/new`). Remis.
- C : même retrait qu'en B → `tests/review-prompt-prime-18-11.test.js` échoué (0 réussi, 1 échoué). Remis.
- Après chaque remise : `git diff --stat -- packages` vide, `git status --short` ne montre que le nouveau fichier de test.

## 5. Résultats (18:23-18:28, tous avec `AGENT_PLATFORM_CDP_ENDPOINT=http://127.0.0.1:1`, un fichier à la fois)

| Fichier                                   | Résultat                       |
| ----------------------------------------- | ------------------------------ |
| `tests/prompt-prime-18-11.test.js`        | 3 tests, 3 réussis, 0 échoué   |
| `tests/review-prompt-prime-18-11.test.js` | 1 test, 1 réussi, 0 échoué     |
| `tests/career-integration.test.js`        | 50 tests, 50 réussis, 0 échoué |
| `tests/consigne-fichiers-travail.test.js` | 2, 2, 0                        |
| `tests/career-pipeline-flow.test.js`      | 7, 7, 0                        |
| `tests/review-questions-18-11.test.js`    | 14, 14, 0                      |
| `tests/career-review-router.test.js`      | 3, 3, 0                        |
| `tests/career-review-migrate.test.js`     | 10, 10, 0                      |
| `tests/note-sans-lecture.test.js`         | 11, 11, 0                      |
| `tests/bilan-mixtes.test.js`              | 3, 3, 0                        |
| `tests/memoire-fil.test.js`               | 4, 4, 0                        |
| `tests/preuves-entre-tours.test.js`       | 14, 14, 0                      |

`npm run check` : « Syntaxe JavaScript valide. » ; `npx prettier --check` sur `packages/career-ops/integration.js`,
`tests/prompt-prime-18-11.test.js`, `tests/review-prompt-prime-18-11.test.js` et ce rapport : conformes.

Non lancés (missions en mode propriétaire hors navigateur `fixture`, risque de toucher le navigateur ou le relais pendant
une mission réelle) : `tests/doubt-tools.test.js`, `tests/question-mal-formee.test.js`, `tests/reprise-memoire.test.js`,
`tests/reprise-memoire-relecture.test.js`, `tests/mission-pieces-jointes.test.js`, `tests/review-accord-mission.test.js`,
`tests/review-precision-18-11.test.js`. `npm test` complet : interdit.

## 6. Non vérifié

- Aucun essai réel : on ne sait pas si un vrai agent suit la phrase (garder des offres que le Skill déconseille quand le
  prompt le demande) ni s'il dit ce que le Skill recommandait. Essai du manager, avec Claude et avec Codex.
- Quels vrais agents lisent `_meta.systemPrompt` (le cadre) : non vérifié ; seule la consigne `instructions` est sûre
  d'arriver à tous.
- Une branche par agent dans `plan()` (voir constat faible) n'est pas couverte.

## 7. Reste à décider par le propriétaire

- Étape `scan` exigée même quand le prompt choisit ses sources sans URL ni « sans scan » : l'assouplir ou non
  (manifeste du pack et moteur, hors de ce sprint).
- Mot « propriétaire » dans la consigne, « candidat » dans le cadre : unifier ou non (noté par le codeur).
- `packages/orchestrator/skill-router.js:339` répète « suis exactement sa méthode » sans la précision ; ce n'est pas
  contradictoire (la méthode reste au Skill), l'accorder ou non.
