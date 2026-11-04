# c3-question-prose-01 — Une question de l'agent, même en prose, met la mission en attente du propriétaire

Chantier C3 du `.manager/PLAN-04-11.md`. Dossier `~/Downloads/agregat-back-astra`, branche `suite-astra`, base `7a4fa3a`.

## Constat (constaté, missions 5bc9a43f et 1bd8fea6 du 04/11)
- Quand Claude pose sa question par le formulaire ACP (`elicitation/create`), Relay passe la mission en `awaiting_owner`, suspend les délais, expose `pendingQuestion`, et `POST /api/runs/:id/answer` la poursuit dans la même session (tenu 1/1 sur 5e493fd3). Code : `packages/orchestrator/index.js:1403-1490` (`elicit`, `openQuestion`, `openNext`, `settleQuestion`, `answer`, `clearQuestions`), `packages/orchestrator/questions.js`, `apps/api/server.js:358-366`, `docs/api-questions.md`, `tests/elicitation.test.js`, fixture `tests/fixtures/fake-acp.js:274-305` (`askQuestion`, `answerFile`).
- Mais quand l'agent pose sa question **en prose** dans sa réponse finale (2/2 : 5bc9a43f à deux options, 1bd8fea6 à trois options a/b/c, 0 appel d'outil), le tour se termine par `end_turn`, `index.js:1057-1062` prend le texte libre comme `summary`, et la mission finit `completed`. Le propriétaire ne voit aucune attente ; sa seule voie est `POST /resume`, qui crée un run neuf.
- Cause la plus basse, lue dans le code : la consigne que Relay envoie à l'agent dit elle-même « Si une confirmation ou un consentement reste vraiment nécessaire, demande-le clairement dans summary et arrête-toi : l'utilisateur répondra dans cette mission » (`index.js:1021`, branche `plan.browserWorkflow`). Relay demande donc la prose.
- Les étapes de workflow DAG créent un `AcpRuntime` sans `onElicitation` (`packages/orchestrator/workflow-run.js:162`) : une question en formulaire y est annulée (`packages/agent-runtime/index.js`, réponse `cancel` quand `onElicitation` manque).

## Règles du propriétaire (ne pas y déroger)
- Aucune restriction de l'agent, aucun garde-fou ajouté : on lui donne une voie d'attente, on ne lui interdit rien. Le clic avant un envoi final reste le seul garde-fou.
- Bibliothèque career-ops, Skill et CV intouchés. Aucune règle métier en dur dans le moteur (rien qui teste `pack.id === 'career-ops'` en plus de ce qui existe).
- Pas de détection heuristique de question dans la prose (pas de regex « ? » ni de liste de mots) : la voie est le formulaire ACP, ou un champ structuré `question` dans la réponse JSON.
- Jamais de `git add -A`, de stash, de reset, de push. Ne lis aucun `.env`, `secrets.env`, rien sous `~/.claude` ni `~/.codex`. Aucune donnée personnelle (nom, lieu, lien d'offre, texte de page) dans le code, les tests, les commits ou le rapport.
- Ne relance ni n'arrête l'API 4310, le front 5173 ni le relais 19988 : le manager s'en charge.

## Points, dans l'ordre (un commit `[c3-question-prose-01]` par point, test rouge puis vert, rapport au fil de l'eau)

### Point 1 — La consigne demande le formulaire, pas la prose (`index.js:1021`)
Remplacer, dans la consigne de la branche `browserWorkflow`, la phrase « Si une confirmation ou un consentement reste vraiment nécessaire, demande-le clairement dans summary et arrête-toi : l'utilisateur répondra dans cette mission. » par : « Si une confirmation, un choix ou une précision reste nécessaire, pose la question par le formulaire de question de ton agent (AskUserQuestion / elicitation ACP) : la mission attend la réponse du propriétaire sans se terminer, dans la même session. Si ton agent n'a pas de formulaire, termine ta réponse par un objet JSON {"question":{"message":"…","options":["…"]}} et la plateforme attendra de la même façon. »
Test : le `promptFile` de la fixture contient la nouvelle phrase et plus l'ancienne (`tests/astra-turn.test.js` ou `tests/memoire-fil.test.js`, selon celui qui lit déjà `promptFile`). Vérifier que `tests/doubt-tools.test.js` ne compte pas cette phrase.

### Point 2 — Contrat : champ `question` facultatif dans la réponse (`packages/orchestrator/result.js`)
`resultSchema` accepte `question?: { message: string (1-4000 car.), options?: string[] (max 8, chacune 1-200 car.) }`. Une réponse qui porte `question` a un `summary` qui peut être vide (`''`). `parseAgentResult` la rend telle quelle. La réponse en prose reste traitée comme aujourd'hui (`index.js:1057-1070`) : rien de nouveau pour elle.
Tests : `tests/result-contract.test.js` (ou le fichier existant qui teste `parseAgentResult`) : question acceptée ; `options` à 9 entrées refusée ; `message` vide refusé.

### Point 3 — `question` → `awaiting_owner`, réponse → nouveau tour dans la même session (`index.js`, autour de 1056-1075 et 1403-1490)
- Après `parseAgentResult`, si `result.value.question` est présent : ouvrir une question **par la même file** que `elicit()` (`this.questions`, `openNext`, `settleQuestion`), avec `kind: 'prose'`, `message` = `question.message`, `requestedSchema` = un seul champ texte `reponse` (si `options` : `oneOf: [{ const, title }]` plus la possibilité d'un texte libre ; choisir une forme que `validateContent` accepte déjà, sinon l'étendre). Ainsi `GET /api/runs/:id` expose `pendingQuestion` (ajouter `kind`) et `POST /answer` fonctionne sans changement de forme. Délais suspendus par `control.suspendTimers()`, `resumable: false`, événement `question`.
- À la réponse `accept` : `control.resumeTimers()`, puis **nouveau tour** : `runtime.prompt(texteDeRéponse, signal)` dans la même session (`sessionId` inchangé, pas de `session/load`), `text = ''`, le tour continue comme un tour normal (mêmes `turnTruth`, `control.browserEvidence`, `skillProgress`). Le texte envoyé à l'agent : `JSON.stringify({ answer: { reponse }, platform: { turnKind: 'answer' } })` plus, une seule fois, la consigne courte « Réponse du propriétaire à ta question ; poursuis la mission dans cette session. » Pas de nouveau gabarit complet (E20).
- Bornes : 10 questions par mission au plus (au-delà : fin `completed` avec « questions trop nombreuses » dans le résumé, pas un échec) ; un plafond d'attente absolu **seulement** s'il est configuré (`AGENT_PLATFORM_QUESTION_TIMEOUT_MS`, défaut : aucun — décision du propriétaire en attente) ; à l'expiration : `completed`, résumé « Question restée sans réponse : <message> ».
- `decline` : `completed`, résumé « Question refusée par le propriétaire : <message> », Bilan normal, aucune action supplémentaire. `POST /cancel` pendant l'attente : `cancelled` comme aujourd'hui (`clearQuestions`).
- Le résumé final de la mission cite les questions posées et les réponses reçues (événements `question`/`answer` suffisent côté API ; dans `summary`, une ligne « Questions : n posée(s), n répondue(s) »).
Tests (`tests/elicitation.test.js`, par `createApp` et la fixture) : nouvelle option `proseQuestion` de `fake-acp.js` (le faux agent termine son premier tour par un JSON `{simulated:false, summary:'', evidence:[], question:{message:'Dois-je continuer FICTIF ?', options:['oui','non']}}`, puis, au second prompt, répond `{simulated:false, summary:'Réponse reçue : <texte>', evidence:[]}`) : (a) `POST /api/runs` → état `awaiting_owner`, `pendingQuestion.kind === 'prose'`, `sessionId` posé ; (b) `POST /answer {action:'accept', content:{reponse:'oui'}}` → `completed`, même `sessionId`, résumé contenant « Réponse reçue : oui » ; (c) `decline` → `completed` avec « Question refusée » ; (d) `cancel` → `cancelled` ; (e) délais réduits à 300 ms : pendant l'attente aucun `tool_stalled`, aucun « Délai maximal dépassé » ; (f) 409 sans question, 400 réponse vide ou > 12 000 car.

### Point 4 — Étapes de workflow DAG (`workflow-run.js:162`)
Passer `onElicitation: (p) => orch.elicit(run.id, p, control)` au `AcpRuntime` de l'étape, avec `control.suspendTimers`/`resumeTimers` de l'étape si elles existent (sinon, no-op documenté). La réponse par `POST /answer` sur le run du workflow poursuit l'étape.
Test : `tests/workflow-run.test.js` (ou nouveau) avec `askQuestion` : étape → `awaiting_owner` → réponse → étape terminée.

### Point 5 — Redémarrage pendant l'attente (`packages/storage`, démarrage de l'API)
Aujourd'hui : `interrupted`, question perdue (`docs/api-questions.md:13`). Faire au moins : la mission `interrupted` garde la question dans son résumé (« Question restée sans réponse au redémarrage : <message> ») et `pendingQuestion: null`. Test Store.
Si le temps manque, dire-le dans le rapport ; ce point ne bloque pas les autres.

### Point 6 — Documentation et suite complète
`docs/api-questions.md` : `kind` (`form` | `prose`), forme de la réponse à une question en prose, décline, plafond configurable, DAG. Puis `npm test && npm run check && npm run format:check`. **Avant de lancer `npm test` complet, vérifier qu'aucun autre `node scripts/run-tests.js` ne tourne** (`pgrep -fl run-tests.js`) : la suite Chrome ouvre des ports fixes. Durée : 4-5 minutes ; lancer en arrière-plan dans un fichier journal et attendre `EXIT`.

## Hors périmètre
- Reprise en même session par `POST /resume` (chantier C11), enveloppe de prompt (C10), front `agregat-front`.
- Toute détection de question dans la prose libre. Toute restriction des outils ou des commandes de l'agent.

## Sortie attendue
- Commits locaux `[c3-question-prose-01] Point n : …`, un par point, jamais de push.
- Rapport `.manager/reports/c3-question-prose-01.md` horodaté (heure du Mac) : par point, test rouge constaté (sortie exacte), test vert, fichiers touchés, écarts par rapport au brief, ce qui est vérifié et ce qui ne l'est pas.
- Message final au manager : commits, fichiers, résultat exact de `npm test` (comptes), `check`, `format:check`, écarts, non vérifié.
