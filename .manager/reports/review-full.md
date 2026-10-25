# Relecture complète — review-full

## Journal

- 22:46 — Lecture de `AGENTS.md`, du brief, de MISSION et PLAN. Arbre Git propre au départ. Périmètre inventorié : totalité de apps/, packages/, domain-packs/, scripts/. Aucun appel modèle autorisé dans cette revue ; aucun nécessaire prévu. Les scripts de probes live seront lus, pas exécutés.
- 22:46 — Commandes initiales : `git status --short` vide ; `rg --files` inventorie les modules ; lecture de package.json et des consignes réussie. La première recherche des fichiers cachés avec rg sans `--hidden` ne listait que AGENTS.md ; inventaire explicite des répertoires ensuite réussi.

## État provisoire
Revue en cours ; aucun résultat final revendiqué.

- 22:50 — Lecture intégrale orchestrateur (index/result/packs/workflow-run), moteur DAG (definition/index), runtime ACP (7 fichiers) et policy-engine (4 fichiers). `npm run check` et `npm run format:check` initiaux verts, sorties brutes conservées dans `/tmp/review-full-{check,format}-before.log`. `npm test` encore en cours.
- Défaut majeur confirmé par lecture : prompt agent impose `simulated:true` même en core réel (`orchestrator/index.js`), et les étapes agent font confiance au booléen généré. Second volet : l’agrégat final dépendant uniquement de verify efface `provenance.analysis` puisque verify est exclu des analyses. Décision : provenance d’exécution issue du profil runtime, provenance des données Najah distincte et propagation du champ vérifié. Ajouter tests faux ACP sans inférence payante.
- Runtime/policy : pas de correction immédiate à ce stade ; contrôles existants des délais locaux, modes sûrs, groupe de processus, environnement filtré, DNS épinglé et fichiers confinés lus. Limite explicitement documentée : pas de sandbox OS entre processus du même UID.

- 22:47 — Correction du journal : l’entrée précédente « 22:50 » était une estimation erronée ; `date +%H:%M` donne réellement 22:47. Les entrées suivantes utilisent l’horloge système.
- 22:47 — Tests rouges provenance : `node --test --test-name-pattern='booléen généré|agrégation répétée' tests/workflow-run.test.js` : 0/2, écarts true/false et null/agent. Après correctif ciblé, 3/3 (y compris aggregateOutputs existant). Ajout de couverture mode agent avec faux ACP et données Najah fictives. Fichiers touchés : orchestrator/{result,index,workflow-run}.js, tests/{agent-result,workflow-run}.test.js, tests/fixtures/fake-acp.js. Formatage ciblé réussi.
- 22:47 — Lecture billing, storage (complète après reprise d’un affichage tronqué), capability-registry, mcp-gateway client/server, data-gateway, Najah index/live, skill-registry scan/index, browser-gateway index/cdp, apps/api/server.js. Cache de données : suspicion de crash sur enveloppe JSON partielle ; à reproduire. Vérification primaire du sponsoring : correspondance nominale UK seulement, explicitement distincte de l’identité juridique.
- 22:47 — Test initial : cœur 163 réussis, 1 ignoré ; premier test Chrome d’approbation échoue après ~42 s. Une seconde suite complète a été démarrée trop tôt avant la fin de la première ; risque de contention Chrome à prendre en compte et relances ensuite séquentielles. Aucun succès global revendiqué.
