# Rapport `questions-18-11` — la question d'un agent arrive au propriétaire, quel que soit l'agent

Codeur : sous-agent Opus. Arbre `~/Downloads/agregat-back-questions`, branche `questions-18-11`, partie de `668a32d`.
Heures lues à l'horloge (`date`) avant d'être écrites.

## Journal
- 14:28 — lecture du brief, de `HANDOFF.md` (sections 2, 5, 9), de `questions-agents-18-11.md`, de E126 et E127,
  de `docs/api-questions.md` et d'`AGENTS.md`.
- 14:31 — lecture du code : `packages/orchestrator/result.js` (`parseAgentResult`), `questions.js`
  (`decisionRequest`, `proseQuestion`), la boucle des questions de `packages/orchestrator/index.js`, la consigne
  du pack (`packages/career-ops/integration.js`), la règle de doute (`packages/orchestrator/doubt-rule.js`), qui
  parle aussi de question, et `packages/orchestrator/workflow-run.js` (étapes de workflow DAG : leur consigne ne
  parle pas de question au propriétaire ; elle n'est pas touchée).
- 14:34 — étape 1, consigne commune. Nouveau fichier `packages/orchestrator/owner-question-rule.js`
  (`OWNER_QUESTION_RULE`, seul endroit où la phrase est écrite). Reprise par : `CAREER_INSTRUCTIONS`
  (`packages/career-ops/integration.js`, les deux mentions du formulaire / champ sans format sont remplacées :
  « demande-le clairement au propriétaire et arrête-toi » garde son sens, « pose toutes les questions
  nécessaires. » est suivi de la règle) ; consigne des missions navigateur (`packages/orchestrator/index.js`,
  l'ancienne phrase formulaire + objet JSON est remplacée par la règle) ; règle de doute
  (`packages/orchestrator/doubt-rule.js`) qui renvoie à « la règle des questions », et `withDoubtRule` ajoute la
  règle commune quand la consigne ne la cite pas déjà : chaque prompt de mission (career-ops, général, Najah,
  navigateur) la porte exactement une fois. Consigne des étapes de workflow DAG (`workflow-run.js`) non touchée :
  elle ne parle pas de question et ces étapes ne traitent pas de champ `question` (formulaire seulement).
  Tests adaptés (texte figé) : `tests/doubt-tools.test.js` (règle de doute et consigne navigateur), en le disant ici.
  `node --test tests/doubt-tools.test.js` : 19/19 ; `node --test tests/career-integration.test.js` : 50/50.
- 14:42 — étape 2, filet. `packages/orchestrator/result.js` : un champ `question` présent qui ne se lit pas
  (objet sans `message`, mauvais type, hors des bornes) ne fait plus refuser la réponse ; il est retiré, le reste
  (`simulated`, `summary`, `evidence`, autres clés) est gardé, et `parseAgentResult` rend en plus
  `unreadQuestion: { options }` (à côté de `value`, pas dedans : les étapes de workflow DAG qui appellent la même
  fonction n'en reçoivent rien). Les choix : `unreadQuestionOptions`, première liste de courtes chaînes trouvée
  dans le champ lui-même ou sous l'une de ses clés (un niveau, quel que soit le nom), 1 à 8 chaînes de 1 à
  200 caractères ; sinon aucun choix. `question: null` ou chaîne vide : retiré sans signalement (« pas de
  question »). Un `summary` vide est admis quand la question est illisible (la ligne du Bilan le dira).
  `packages/orchestrator/index.js` : `readResult` retient `unreadQuestion` du tour ; dans la boucle des questions,
  si le champ était illisible, `decisionRequest(summary)` donne la question, à laquelle on joint les choix trouvés ;
  sinon la réponse est gardée et compte pour une ligne du Bilan, placée après « Questions : … » :
  « Question de l’agent non posée : l’agent a joint une question que la plateforme n’a pas pu lire ; elle n’a pas
  été posée au propriétaire. » (« (n fois) » si plusieurs tours). Événement `question_unreadable`
  `{ asked, options }` dans les deux cas (aucun texte de l'agent). Rien de propre à un agent.
  `tests/fixtures/fake-acp.js` : option `proseQuestion.reply` (réponse JSON du tour qui demande, telle quelle).
  Tests adaptés parce qu'ils figeaient l'ancien refus : `tests/agent-result.test.js` (question hors bornes →
  réponse gardée, `unreadQuestion`), `tests/reponse-prose.test.js` (`question: 3`), et `tests/fix-resume.test.js`
  (fragments de l'ancienne consigne navigateur remplacés par ceux de la règle commune).
  Nouveau `tests/question-mal-formee.test.js` (14 tests, pris par `scripts/run-tests.js` en phase sans navigateur).
- 14:45 — étape 3, `docs/api-questions.md` : sections « Consigne commune envoyée aux agents » (la phrase, où elle
  est définie, qui la cite) et « Question mal formée » (comportement, ligne du Bilan, événement). Phrase périmée
  corrigée au passage : « aucune détection de question dans le texte » était faux depuis E52 (`decisionRequest`) ;
  la simple chaîne du 11/11 est maintenant dite.
