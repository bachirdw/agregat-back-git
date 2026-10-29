# fix-router-02 — quatre défauts du routeur de Skills constatés en mission réelle (30/10)

> **BRANCHE** : travaille sur `nuit-29-10` (back et front), ne change pas de branche, ne merge pas, ne touche pas à `main`, ne pousse rien.
> **Prends ton temps** : qualité et preuves avant vitesse. Aucun appel Gemini, aucune mission réelle, aucun site réel ; tests ≥ 4320 ; ne touche ni
> au serveur 4310, ni au front 5173, ni au relais 19988. **N'ajoute aucun garde-fou.** Ne modifie ni le Skill, ni la bibliothèque, ni les CV.

Lis `.manager/briefs/_audit-common.md`, `.manager/reports/skill-router-01.md` et `fix-truth-01.md`.

## Constat réel (mission `020c59cc`, prompt : « Mode oferta … Ouvre cette annonce … dis-moi en 5 lignes ses exigences … N'enregistre rien, ne clique sur aucun bouton Apply »)
Résumé obtenu : « Mission terminée ; documents et évaluations dans l'espace privé. / Bilan / - Actions réussies : browser_navigate, browser_snapshot,
browser_extract. / - Actions échouées : browser_extract — échec signalé par l'outil. / - Non exécuté : candidature (aucun appel de formulaire). /
- Étapes du Skill : Scanner (non exécutée) ; Enregistrer (non exécutée) ; ✓ Ouvrir le formulaire (faite) ; … / - Écart d'ordre : aucun constaté. »
`skill_progress` : sept étapes, pour TROIS intentions (`search`, `apply`, `linkedin`).

## À faire (test rouge → vert par point, commit `[fix-router-02]` par point)
1. **Bilan sans contradiction** : un même appel/outil ne figure jamais à la fois en « réussies » et « échouées ». Si un outil a réussi puis échoué, ou l'inverse,
   écris-le explicitement (« browser_extract : 1 réussi, 1 échoué ») à partir des appels RÉELS du tour courant. Test avec faux agent.
2. **Intention précise** : le routeur ne retient que l'intention dominante du prompt (ou aucune). Un prompt de LECTURE/évaluation d'annonce
   (« lis l'annonce », « mode oferta », « n'enregistre rien », « ne clique sur aucun Apply ») ne doit PAS activer `apply` ni `linkedin` ; une mention
   négative (« ne pas postuler », « ne clique pas Apply ») n'active pas l'intention citée. Ajoute si utile une intention `evaluate` (lire l'annonce, puis
   `career_offer_save` seulement si l'utilisateur ne l'interdit pas) dans `domain-packs/career-ops/skill-manifest.yaml`. Tests : prompts réels des 28–30/10
   (recherche, évaluation, postuler, LinkedIn, mention négative) → intention attendue ; déterministe, sans modèle.
3. **Étape « Ouvrir le formulaire » honnête** : elle n'est « faite » que si l'URL ouverte est un formulaire de candidature (page apply), pas une simple annonce.
   Sinon l'étape reste « non exécutée ». Test.
4. **Résumé = réponse d'abord** : le résumé commence par la réponse réellement produite par l'agent (le texte que l'utilisateur a demandé), suivie du « Bilan ».
   La phrase générique « Mission terminée ; documents et évaluations dans l'espace privé. » ne s'affiche plus que si l'agent n'a produit aucun texte.
   Si l'agent a produit du texte mais qu'il a été perdu, retrouve pourquoi (cherche dans `packages/orchestrator/index.js` / `result.js` où `summary` est remplacé) et corrige. Test.
5. Avant chaque commit : `npm run check`, `npm run format:check`, tests concernés ; front si touché : `npm test`, `npm run build`, `npx prettier --check src`.
   À la fin : `CHROME_PATH=/nonexistent npm test`. Rapport `.manager/reports/fix-router-02.md` au fil de l'eau (heures `date +%H:%M`), « non vérifié » explicite.
Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
