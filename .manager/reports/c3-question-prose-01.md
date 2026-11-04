# Rapport c3-question-prose-01 — question en prose → attente du propriétaire

Session : sous-agent codeur (Claude), branche `suite-astra`, base `bf5586e` (brief) au-dessus de `7a4fa3a`.

## 19:32 — Démarrage
- Brief lu, code cité lu (`index.js` execute/elicit, `questions.js`, `result.js`, `workflow-run.js`, fixture `fake-acp.js`, `tests/elicitation.test.js`).
- Constat confirmé : la consigne navigateur (`index.js:1022`) demandait la question « dans summary ».
- Observation hors périmètre (non modifiée) : la règle de doute (`withDoubtRule`, testée par `tests/doubt-tools.test.js`) et `CAREER_INSTRUCTIONS` (`packages/career-ops/integration.js:26`) disent encore « pose la question clairement dans summary » / « demande-le clairement dans summary ». Le brief ne cible que la branche `browserWorkflow` ; à trancher par le manager.

## Point 1 — Consigne : formulaire, pas prose
- 19:33 Test ajouté : `tests/doubt-tools.test.js` « Consigne navigateur : une question passe par le formulaire ACP ou le champ question » (c'est ce fichier qui lit déjà `promptFile`, pas `astra-turn`/`memoire-fil`).
- Rouge constaté :
```
✖ Consigne navigateur : une question passe par le formulaire ACP ou le champ question (2065.697084ms)
ℹ pass 0
ℹ fail 1
  AssertionError [ERR_ASSERTION]: Le prompt de l’utilisateur prime sur toute autre règle. Si une confirmation ou un consentement reste vraiment nécessaire, demande-le clairement dans summary et arrête-toi : […]
```
- Implémentation : phrase remplacée dans `packages/orchestrator/index.js` (branche `browserWorkflow`). Apostrophe typographique `n’a` (style du fichier) au lieu de `n'a` du brief.
- `tests/fix-resume.test.js` (« mission navigateur : le prompt prime… ») attendait l'ancienne phrase `demande-le clairement dans summary` : remplacée par deux fragments de la nouvelle.
- Vert : `doubt-tools` 7/7 (motif « Consigne navigateur|Règle de doute »), `fix-resume` motif ciblé 1/1. `doubt-tools` ne compte pas cette phrase (il compte « sans choisir au hasard », inchangé).

## Point 2 — Contrat : champ `question` facultatif (19:34)
- Tests ajoutés dans `tests/agent-result.test.js` (fichier existant qui teste `parseAgentResult`, pas de `result-contract.test.js`) : question acceptée avec `summary: ''` ; 9 options, message vide, message > 4000, option vide, option > 200 refusés ; summary vide sans question toujours refusé.
- Rouge constaté :
```
✖ question structurée acceptée, summary vide permis, rendue telle quelle (1.358834ms)
✖ question hors contrat refusée : 9 options, message vide, option trop longue (0.204958ms)
ℹ pass 0
ℹ fail 2
  AssertionError [ERR_ASSERTION]: {"ok":false,"reason":"Réponse hors contrat (simulated, summary, evidence attendus)",…}
  AssertionError [ERR_ASSERTION]: {"message":"Q ?","options":["o0",…,"o8"]}
```
- Implémentation : `packages/orchestrator/result.js`, `questionSchema` (message 1-4000, options ≤ 8 de 1-200) et `refine` : summary non vide **ou** question présente. Les clés inconnues dans `question` sont retirées par zod (le reste de la réponse reste `passthrough`). La prose libre n'est pas touchée.
- Vert : `tests/agent-result.test.js` 11/11.

## Point 3 — `question` → `awaiting_owner`, réponse → nouveau tour dans la même session (19:36-19:38)
- Fixture `tests/fixtures/fake-acp.js` : option `proseQuestion` (`true` ou `{message?, options?, always?}`) : premier tour = JSON `{simulated:false, summary:'', evidence:[], question:{message:'Dois-je continuer FICTIF ?', options:['oui','non']}}` ; tour dont le prompt porte `platform.turnKind === 'answer'` = `Réponse reçue : <reponse>` (`always` : redemande à chaque tour). Option `callsFile` : méthodes ACP reçues, écrites à chaque prompt.
- 9 tests ajoutés dans `tests/elicitation.test.js` (« question en JSON : … ») : (a) awaiting_owner + `kind: 'prose'` + `sessionId` ; (b) accept par l'API → completed, même session, 2 `session/prompt`, 1 `session/new`, 0 `session/load`, ligne « Questions : 1 posée(s), 1 répondue(s) » ; second prompt = `{answer, platform:{turnKind:'answer'}, instructions}` sans `objective` ; (c) decline → « Question refusée par le propriétaire : … », 1 seul prompt ; (d) cancel → cancelled ; (e) toolIdle 300 ms / silence 300 ms / mission 1500 ms, attente 2 s → aucun `tool_stalled`/`agent_silent`/« Délai maximal dépassé » ; (f) 409 avant question et après fin, 400 pour `''`, 12 001 car., `{}` ; texte libre hors options accepté ; 10 questions puis « questions trop nombreuses » ; plafond configuré 300 ms → « Question restée sans réponse », événement `answer` `action: 'expired'`.
- Rouge constaté (avant implémentation, après le point 2) :
```
✖ question en JSON : awaiting_owner, pendingQuestion kind prose, sessionId posé (5044.65175ms)
… (les 9 tests)
ℹ pass 0
ℹ fail 9
  Error: Attente dépassée : {…,"state":"completed",…,"result":{"simulated":false,"summary":"","evidence":[],"question":{"message":"Dois-je continuer FICTIF ?","options":["oui","non"]},…}}
```
  (la mission finissait `completed` avec la question enfouie dans le résultat : le défaut constaté.)
- Implémentation :
  - `packages/orchestrator/questions.js` : `kind: 'form'` sur les questions ACP ; `proseQuestion()` = un champ texte `reponse` (`minLength 1`, `maxLength 12000`), options en `examples` (suggestions, jamais liste fermée : `validateContent` les ignore, texte libre accepté), `options` recopiées sur la question publique.
  - `packages/orchestrator/index.js` : `elicit` et `askProse` passent par la même file (`enqueueQuestion` → `openNext`/`settleQuestion`/`answer`) ; boucle après `parseAgentResult` (lecture factorisée dans `readResult`, prose libre inchangée) ; accept → `runtime.continueSession()` puis `runtime.prompt(JSON.stringify({answer, platform:{turnKind:'answer'}, instructions:'Réponse du propriétaire à ta question ; poursuis la mission dans cette session.'}))`, `text = ''`, mêmes `turnTruth`/`browserEvidence`/`skillProgress` (pas de remise à zéro) ; decline/expiration → completed avec la ligne citée ; 10 questions max (`MAX_QUESTIONS`) ; plafond `AGENT_PLATFORM_QUESTION_TIMEOUT_MS` (option `questionTimeoutMs`, défaut `null` = aucun), armé à l'ouverture, levé au règlement ; ligne « Questions : n posée(s), n répondue(s). » dans le résumé.
  - `packages/agent-runtime/index.js` : `continueSession()` : `prompt()` remettait `ready = false` après chaque tour (« Another turn requires a fresh session identity »), ce qui interdisait le tour de réponse. La méthode réautorise un tour dans la même session si le runtime n'est ni arrêté ni en tour (un changement de mode non sûr a déjà fermé le runtime). Écart nécessaire non écrit dans le brief.
- Choix : la consigne courte est jointe à chaque tour de réponse (une fois par message), pas seulement au premier. Le plafond d'attente s'applique aussi aux questions de formulaire ACP (réponse `cancel` à l'agent), puisque la file est commune.
- Vert : `tests/elicitation.test.js` + `tests/agent-result.test.js` 34/34 ; `tests/runtime.test.js` + `tests/astra-runtime.test.js` 56/56.
- Observation : pendant ce point, des fichiers que je n'ai pas touchés sont apparus modifiés dans l'arbre (`docs/api-career-ops.md`, `domain-packs/career-ops/manifest.yaml`, `packages/career-ops/tools.js`, `packages/mcp-gateway/server.js`, `packages/orchestrator/packs.js`) : une autre session travaille dans ce worktree. Je ne les ajoute à aucun commit.
