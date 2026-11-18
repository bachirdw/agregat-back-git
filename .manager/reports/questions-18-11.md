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
