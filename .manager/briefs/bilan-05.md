# bilan-05 — Intent `pipeline` : libérer le numéro ; E36 reste : « Nothing to merge into » = rien fusionné

Session cloud (Opus, mode rapide), branche `cloud/bilan-05` créée depuis `origin/dev`. Test rouge d'abord, puis vert ; un commit `[bilan-05]` par point, chemins explicites dans `git add`. Aucune règle métier dans le moteur, aucune restriction ajoutée à l'agent, Skill et bibliothèque career-ops intouchés, aucune donnée personnelle. En parallèle, `bilan-04` modifie `packages/orchestrator/skill-router.js`, `packages/career-ops/tools.js`, `packages/orchestrator/index.js` et la section `search` du manifeste : ne touche à aucun de ces trois fichiers `.js`, et dans le manifeste seulement la section `pipeline`. Rapport horodaté en français `.manager/reports/bilan-05.md` (lire `date` avant chaque heure), section finale « Pour le manager ».

## Point 1 — `release` dans l'intent `pipeline`
`bilan-03` a ajouté à l'intent `evaluate` l'étape `release` (`career_script reserve-report-num`, `args: ['--release','{###}']`, `optional: true`, `persists: true`) après `report`. L'intent `pipeline` réserve aussi un numéro par entrée (`reserve`, `report`) et ne libère pas. Attendu : même étape `release` après `report` dans `pipeline`, même libellé, même commentaire ; `tests/release-report-num.test.js` étendu à `pipeline` (une entrée réservée puis rapport sans libération → « Libérer le numéro du rapport (ignorée) » ; avec libération → « faite »).

## Point 2 — E36 reste : « Nothing to merge into »
Constaté (05b34578) : `merge-tracker` a répondu « No applications.md found. Nothing to merge into. » avec code 0 ; le Bilan a dit « Suivi du Skill : fusion réussie, nombre de lignes non lu (merge-tracker) ». Attendu : `packages/career-ops/truth.js` (~651, `trackerLine`, `trackerSummary`) reconnaît cette sortie comme « rien fusionné : tableau de suivi absent » (0 ajoutée, 0 mise à jour, motif), sans règle métier (c'est la lecture fidèle de la sortie du script). Test dans `tests/truth-tool-names.test.js` ou `tests/bilan-vs-events.test.js` : sortie exacte → ligne de Bilan « Suivi du Skill : rien fusionné (tableau de suivi absent) ».

## Point 3
`npm run check`, `npm run format:check`, tests ciblés verts, `npm test` si possible (deux tests ACP Codex/Gemini échouent dans le cloud faute des binaires : connu). Rapport, commits, push de `cloud/bilan-05` seulement.
