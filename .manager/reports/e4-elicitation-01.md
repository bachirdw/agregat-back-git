# Rapport e4-elicitation-01

## 17:32 Démarrage
- Brief, CARTE §B1, runtime/orchestrateur/server/fixture lus. SDK 2.0.2 : `methods.client.elicitation.create` = `elicitation/create` (acp.d.ts:86), capacité `ElicitationCapabilities.form` (types.gen.d.ts).
- Constat : un état `waiting_permission` existe déjà (non terminal) ; `terminal` = completed/failed/cancelled/interrupted (storage/index.js:7).

## 17:33 Point 1 : adaptateur
- Test (a) écrit d'abord : rouge (`actual: undefined`). Fixture : option `capsFile` (enregistre `clientCapabilities`).
- `packages/agent-runtime/index.js` : `elicitation: { form: {} }` annoncé, option `onElicitation` (défaut `cancel`), `.onRequest(methods.client.elicitation.create, …)` ; `cancel` si runtime arrêté, mode ≠ form ou autre session. Params expurgés par `redactValue`.
- Vert : `node --test tests/runtime.test.js tests/elicitation.test.js` 55 pass / 0 fail ; check et format:check OK.

## 17:34 Point 2 : fixture
- `tests/fixtures/fake-acp.js` : `askQuestion` (ou prompt contenant `QUESTION:`) → `elicitation/create` (form, schéma `reponse` string), attend la réponse, termine avec un JSON `{simulated,summary,evidence}` citant la réponse / disant déclinée / annulée ; `answerFile` garde la réponse reçue ; `capsFile` garde les capacités.
- Tests ajoutés (accept ; decline/cancel) : `node --test tests/elicitation.test.js` 3 pass ; `runtime.test.js` 54 pass. check/format OK.

## 17:38 Point 3 : orchestrateur
- Nouveau `packages/orchestrator/questions.js` (validation plate : string/enum/oneOf, number/integer, boolean, array d'enum/anyOf ; champ inconnu et obligatoire manquant refusés).
- `packages/orchestrator/index.js` : `onElicitation` → `engine.elicit` ; file FIFO `this.questions` (une ouverte par mission) ; ouverture : `pendingQuestion` public, état `awaiting_owner`, `resumable:false`, événement `question`, `control.suspendTimers()` (silence, délais d'outil rendus pour chaque outil en attente, délai de mission avec reste mémorisé) ; `engine.answer(runId, body)` (409 si aucune ; AnswerError si invalide) → événement `answer` (contenu expurgé), `running`, `resumeTimers()` (reprend avec le temps restant) ; `engine.cancel` et tout abort répondent `cancel` aux questions avant d'annuler le prompt (drain, sans ouvrir la suivante). Interaction avec `waiting_permission` gérée dans les deux sens.
- Runtime : les délais de requête (`timeouts.prompt`) sont pausables (`pauseDeadlines/resumeDeadlines`), appelés autour de `onElicitation` ; sans cela le délai de prompt de l'adaptateur aurait tué la mission.
- Fixture : `askQuestion.toolBefore` (outil en cours sans mise à jour pendant la question).
- Tests (b)(c)(d)(e)(f) + FIFO au niveau engine : `tests/elicitation.test.js` 9 pass. Mutation vérifiée : sans `suspendTimers`, le test (f) est rouge. Anciens : tool-watchdog, agent-silence, runtime, career-timeout, fix-resume, owner-permissions + elicitation = 105 pass / 0 fail. check/format OK.
- Écart : test (b) lit l'API via `GET /api/runs/:id` qui expose déjà tout le champ de la ligne (pas de code API nécessaire pour la lecture, point 5).
