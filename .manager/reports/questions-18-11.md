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
- 14:43 — étape 3, `docs/api-questions.md` : sections « Consigne commune envoyée aux agents » (la phrase, où elle
  est définie, qui la cite) et « Question mal formée » (comportement, ligne du Bilan, événement). Phrase périmée
  corrigée au passage : « aucune détection de question dans le texte » était faux depuis E52 (`decisionRequest`) ;
  la simple chaîne du 11/11 est maintenant dite.
  (Heure de cette ligne corrigée de 14:45 en 14:43 : écrite avant la lecture de l'horloge, erreur de ma part.)

## Tests lancés (constaté)
- `node --test tests/question-mal-formee.test.js` : 14/14 (après deux corrections du test lui-même :
  `pendingQuestion` vaut `undefined` et non `null` quand aucune question n'a été posée ; le test career-ops passe
  en mode propriétaire, sinon le résumé est « Réponse disponible dans l’espace privé. »).
- Touchés et voisins, un fichier à la fois : agent-result 13/13, elicitation 26/26, question-finale 8/8,
  bilan-questions 2/2, reponse-prose 6/6, message-proprietaire 25/25, reprise-memoire 8/8, fix-resume 28/28,
  career-failure 11/11, bilan-vs-events 7/7, workflow-resume 8/8, doubt-tools 19/19, career-pipeline-flow 7/7,
  resume-probe 3/3, career-integration 50/50, bilan-evaluer-puis-postuler 8/8, bilan-mixtes 3/3, career-sends 21/21,
  consigne-fichiers-travail 2/2, contrat-agents 14/14, contacts-courriel 26/26, intention-anglais-sonde 44/44,
  mission-pieces-jointes 3/3, intention-candidature 2/2, memoire-fil 4/4, owner-mode 14/14, preuves-entre-tours 14/14,
  review-accord-mission 8/8, reprise-memoire-relecture 8/8, truth-tool-names 6/6, workflow-run 18/18,
  skill-registry 22/22, tool-guard 17/17.
- Avant adaptation, trois tests rouges qui figeaient l'ancien comportement : agent-result (« question hors contrat
  refusée »), reponse-prose (`question: 3` refusée), fix-resume (fragments de l'ancienne consigne navigateur).
  Adaptés et dits plus haut.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : d'abord un avertissement sur
  `tests/fixtures/fake-acp.js` (parenthèses autour de `cfg.proseQuestion.reply ?? {…}`), corrigé par
  `prettier --write` sur ce seul fichier, puis « All matched files use Prettier code style! ».
- Non lancés (interdits par le brief) : `npm test`, tests Chrome, tests réels.

## Ce qui n'est pas vérifié
- Rien n'est vérifié en réel : aucun agent réel (Claude, Codex, Gemini, OpenCode) n'a reçu la nouvelle consigne.
  Que Codex suive désormais le format sans qu'on l'écrive dans le prompt est une hypothèse (fait 8 du
  18/11 : avec le format écrit dans le prompt, il l'a suivi) ; à jouer par le manager.
- Que Claude ouvre toujours son formulaire avec la nouvelle phrase : non vérifié (même hypothèse inverse).
- Suite complète non lancée.

## Points pour le manager et décisions pour le propriétaire
1. La phrase commune garde l'exemple « AskUserQuestion / elicitation ACP » des anciennes consignes : c'est le nom
   de l'outil de question de Claude. Je l'ai gardé pour ne pas faire régresser Claude (7 formulaires sur 10
   missions) ; il est écrit pour tous et ne change rien pour les autres agents. Le propriétaire peut préférer
   « (elicitation ACP) » seul, au nom de la règle « aucune particularité d'un agent » : à trancher.
2. Un champ mal formé qui contient pourtant un `message` valide (par exemple 9 options, ou une option de
   201 caractères) : selon le brief, seule la fin de `summary` donne la question ; le `message` du champ n'est pas
   repris. Si `summary` ne demande rien, la question n'est pas posée et le Bilan le dit. Reprendre ce `message`
   serait une extension du brief : à trancher.
3. Un objet `{"question":{…}}` seul (sans `simulated`/`summary`/`evidence`) et mal formé reste « hors contrat »
   comme avant (il n'y a pas de « reste de la réponse » à garder) ; pour career-ops, le repli en prose affiche
   alors le texte brut du tour. Non traité : à décider si le filet doit s'étendre à ce cas.
4. Étapes agent d'un workflow DAG (`workflow-run.js`) : elles appellent aussi `parseAgentResult` ; un champ
   `question` mal formé n'y fait plus échouer l'étape, il est retiré sans ligne ni événement (ces étapes ne posent
   que des questions de formulaire). Effet de bord voulu par le brief côté contrôle de la réponse ; dit ici.
5. Front (autre dépôt, non touché) : l'événement `question_unreadable` est nouveau ; la ligne du Bilan arrive déjà
   dans `platformNotes`, rien n'est nécessaire pour l'afficher. Le front pourrait montrer l'événement dans le fil.
6. `"question": null` et chaîne vide sont lus « pas de question » (avant : réponse refusée) : choix de ma part,
   dit ici.

## État final
Opérationnel en tests à agent factice ; non vérifié en réel. Commits locaux `[questions-18-11]` sur la branche
`questions-18-11`, aucun push, aucun merge.
