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

## Point 2 — Contrat : champ `question` facultatif (19:36)
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
