# Relecture corrective `review-questions-18-11`

Correcteur : sous-agent Opus, seul écrivain de l'arbre `~/Downloads/agregat-back-questions` (branche
`questions-18-11`). Base relue : `668a32d..102b6fa` (4 commits du codeur). Heures lues à l'horloge (`date`).

## Journal
- 14:52 : lecture du brief `questions-18-11`, du rapport du codeur et du diff.
- 14:55 : défauts du contrôle de la réponse reproduits par `node -e` sur `parseAgentResult` (voir plus bas).
- 15:05 : correctifs, tests, contre-épreuve, `npm run check` et `npm run format:check` passés.

## Défauts, par gravité, et leur sort

### Moyens
1. **L'événement `question_unreadable` disait `asked:true` au-delà de 10 questions** (relecteurs 1 et 10).
   *Constaté* par le nouveau test (sans correctif : 11 événements `asked:true` pour 10 questions posées).
   **Corrigé** dans `packages/orchestrator/index.js` : `asked = Boolean(question) && questionCount.asked < MAX_QUESTIONS`,
   et `options` vaut 0 quand la question n'est pas posée. La ligne « Questions trop nombreuses … non posée » ne change pas.
2. **Un objet `{"question":…}` mal formé écrit à part faisait refuser toute la réponse** (relecteurs 2, 5 et 7).
   *Constaté* : contrat puis `{"question":{"choices":["a","b"]}}` donnait `ok:false` (« Réponse hors contrat »).
   Même chose pour de la prose suivie de cet objet. **Corrigé** dans `questionOnly` (`packages/orchestrator/result.js`) :
   un objet dont la seule clé est `question` et dont la valeur est un objet ou une liste est reconnu même s'il est
   illisible. Il est fusionné comme avant, puis le filet du codeur le retire (`unreadQuestion`). Résultat : la réponse est
   gardée, la question est posée si `summary` demande, sinon une ligne s'ajoute au Bilan. La citation d'un formulaire
   `{"question":"…","answer":"…"}` et un objet à deux clés restent refusés (test). La phrase commune n'est pas réécrite :
   avec ce correctif, ses deux lectures (clé dans la réponse, ou objet à part) marchent.
3. **Message valide mais options hors bornes : le message est perdu** (relecteurs 4 et 6). *Constaté*
   (`unreadQuestion: {options: []}`, message absent). **Non corrigé : décision du propriétaire**, hors de la lettre du brief
   (le brief dit que la question vient de la fin de `summary`). Deux pistes : (a) garder `message` quand il se lit, avec
   les options qui sont dans les bornes ou aucune ; (b) écrire les bornes dans `OWNER_QUESTION_RULE` (« 8 options au plus,
   200 caractères chacune »). Le comportement actuel est figé par deux tests d'orchestrateur, pour qu'on voie le
   changement le jour où il est tranché.

### Faibles
4. **Étape de workflow DAG : question illisible retirée en silence, summary vide accepté** (relecteurs 3 et 11).
   *Lu dans le code, puis constaté* par le nouveau test (sans correctif : aucun événement, aucune ligne).
   **Corrigé** dans `packages/orchestrator/workflow-run.js` : si `parsed.unreadQuestion` existe, l'événement
   `question_unreadable {stepId, asked:false, options:0}` est écrit et la ligne de la plateforme s'ajoute au résumé de
   l'étape. Ainsi le résumé n'est plus jamais vide dans ce cas. La ligne est définie à un seul endroit
   (`unreadQuestionLine`, `result.js`) et sert aussi à la mission.
5. **`DOUBT_RULE` renvoie à « la règle des questions », un nom qu'aucune phrase ne porte** (relecteur 9). *Lu dans le code*.
   **Corrigé** : `OWNER_QUESTION_RULE` commence maintenant par « Règle des questions : pour poser une question au
   propriétaire, … ». Aucun test ne figeait le début de la phrase (grep). `docs/api-questions.md` est mis à jour.
6. **`AskUserQuestion` cité dans la phrase commune** (relecteur 8). **Non corrigé : décision du propriétaire.** La phrase
   est la même pour tous les agents, sans aucune branche par agent. Mais elle nomme l'outil d'un seul agent. Choix possibles :
   « (elicitation ACP) » seul, ou « l'outil de question de ton agent ou l'elicitation ACP ».
7. **Test « identiques pour tous les profils » faible** (relecteur 12). *Lu dans le code* : le relecteur a raison, `plan()`
   ne tourne qu'avec `agent:'fixture'`. **Non corrigé** : pour créer la mission avec `agent: profile.id`, il faudrait que
   `plan()` détecte l'agent réel installé (`detectAgents`) et que le mode réel soit actif (`AGENT_PLATFORM_LIVE=1`).
   On entre alors sur le terrain des vrais agents, interdit à cette session. Ce qui a été constaté : le code qui construit
   la consigne (`index.js`) ne lit pas `plan.agent`. Dans `plan()`, la branche `id === 'gemini'` (qui existait avant le
   sprint) ne touche que le modèle, pas la consigne.

## Effets du correctif 2 à connaître
- `{"question":{"message":""}}` seul (sans contrat) était refusé ; il est maintenant accepté avec `summary` vide et
  `unreadQuestion`. Le Bilan porte la ligne de la plateforme. Le test `tests/agent-result.test.js` (audit 10/11) qui
  figeait le refus est adapté et le dit en commentaire.
- *Hypothèse, non testée* : un objet `{"question":{…}}` cité depuis une page après la réponse au contrat (et non écrit par
  l'agent pour demander) est maintenant lu comme une question illisible. La réponse est gardée et le Bilan porte la
  ligne, au lieu d'un refus. Cela me paraît préférable au refus, mais c'est à surveiller en réel.
- *Hérité, non changé* : contrat, puis prose, puis objet question seul (l'objet n'est pas collé à la réponse). Le résumé
  est alors la prose qui l'entoure, et cette prose contient le texte du contrat. C'était déjà le cas pour une question au
  bon format.

## Tests ajoutés (`tests/review-questions-18-11.test.js`, 13 tests, par l'agent factice)
Les tests passent tous par l'agent factice, qui reçoit deux nouvelles options : `proseQuestion.apart` (réponse au contrat
puis objet `{"question"}` à part) et `proseQuestion.replies` (une réponse par tour).
- 11e question illisible au-delà de la limite : non posée, `asked:false`, « Questions trop nombreuses » au Bilan. Le point
  de reprise (`questionsOf`) compte les 10 questions posées par ce chemin, avec leur réponse.
- Contrat puis objet mal formé à part : (a) `summary` sans question, donc réponse gardée, ligne dans `platformNotes`,
  aucun `agent_output_rejected` ; (b) `summary` qui demande, donc question ouverte avec ses choix, puis suite dans la
  même session.
- Prose puis objet seul mal formé (`bare`) : pas de JSON brut, ligne au Bilan.
- Pack career-ops (mode propriétaire) avec ce même objet seul mal formé : pas de texte brut, ligne au Bilan.
- La citation de formulaire `{"question","answer"}` et l'objet question à deux clés restent refusés.
- Message valide et 9 options : avec un `summary` qui demande, la question vient de `summary`, sans choix ; avec un
  `summary` vide, la question n'est pas posée et la ligne apparaît (état actuel, à trancher).
- Question illisible au 1er tour, puis au bon format au 2e : un seul événement, aucune ligne « non posée ».
- `summary` qui demande et champ au bon format : le champ structuré l'emporte.
- Question illisible au tour de travail puis au tour du message du propriétaire : ordre des tours `[null, 'owner_message']`
  et « (2 fois) » au Bilan.
- Étape de workflow DAG avec un champ question illisible : étape gardée, événement `{stepId, asked:false, options:0}`,
  ligne dans le résultat.
- La phrase commune commence par « Règle des questions : », le nom que lui donne la règle de doute.

Non ajoutés : le test « Najah ou core sans browserWorkflow : la consigne porte la règle une seule fois » est déjà couvert
par la boucle de `withDoubtRule`, et aucune branche nouvelle ne le justifie. Le test « par profil réel » n'est pas
ajouté, pour la raison du point 7.

## Contre-épreuve (constaté)
J'ai copié `result.js`, `index.js` et `workflow-run.js` dans le scratchpad. J'ai neutralisé les trois correctifs
(`asked = Boolean(question)`, `false &&` dans `questionOnly`, `if (false)` dans `workflow-run.js`), puis relancé
`node --test tests/review-questions-18-11.test.js` : **6 échecs, 7 réussites**. Les tests rouges : limite des 10
questions, deux tests « contrat puis objet à part », objet seul `bare`, career-ops, étape DAG. J'ai ensuite remis les
copies (`cmp` identique) ; `git status` ne montrait plus que les changements voulus.

## Résultats exacts (constaté, `node --test tests/<f>.test.js`, un fichier à la fois)
review-questions-18-11 13/13, question-mal-formee 14/14, agent-result 13/13 (12/13 avant l'adaptation dite plus haut),
doubt-tools 19/19, reponse-prose 6/6, fix-resume 28/28, elicitation 26/26, question-finale 8/8, bilan-questions 2/2,
message-proprietaire 25/25, reprise-memoire 8/8, reprise-memoire-relecture 8/8, career-integration 50/50,
career-failure 11/11, career-pipeline-flow 7/7, career-sends 21/21, bilan-vs-events 7/7, workflow-resume 8/8,
workflow-run 18/18, contrat-agents 14/14, owner-mode 14/14, step-decision-terminal 5/5, review-audit-suite-02 2/2,
audit-suite-02-workflow-send 2/2, approval-bridge 15/15, preuves-entre-tours 14/14, memoire-fil 4/4,
intention-anglais-sonde 44/44. Après le passage de Prettier, quatre fichiers relancés : review-questions-18-11 13/13,
question-mal-formee 14/14, message-proprietaire 25/25, workflow-run 18/18.
`npm run check` : « Syntaxe JavaScript valide. » `npm run format:check` : « All matched files use Prettier code style! »

## Non vérifié
- Rien en réel : aucun agent réel n'a été lancé (interdit). La suite complète (`npm test`) et les tests Chrome n'ont pas
  été lancés.
- Le front (autre dépôt) n'a pas été regardé : l'événement `question_unreadable` peut désormais porter `stepId`.

## Reste à décider (propriétaire)
- Point 3 : garder le `message` lisible d'un champ dont les options sont hors bornes, ou écrire les bornes dans la phrase commune.
- Point 6 : garder ou non `AskUserQuestion` dans la phrase commune.

## Fichiers touchés
`packages/orchestrator/result.js`, `packages/orchestrator/index.js`, `packages/orchestrator/workflow-run.js`,
`packages/orchestrator/owner-question-rule.js`, `docs/api-questions.md`, `tests/fixtures/fake-acp.js`,
`tests/agent-result.test.js`, `tests/review-questions-18-11.test.js` (nouveau), ce rapport (nouveau).
