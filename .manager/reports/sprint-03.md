# Rapport sprint 03 — Moteur de workflows DAG durable

**Exécutant : Claude (manager)** — Codex en limite d'usage jusqu'à 7h29. Relecture indépendante par Codex prévue.

## Décisions
- Moteur maison minimal (`packages/workflow-engine`), conformément à l'ADR 003 : acpx flows = curseur unique
  sans reprise, DBOS exige PostgreSQL, CAO = Python/tmux. Persistance dans la base SQLite existante (une table
  `workflow_steps`), pas de nouveau service.
- La plateforme, pas le modèle, décide de l'ordre, du parallélisme, des tentatives, des approbations et de la
  vérification. Les étapes `tool` appellent la gateway MCP directement (déterministes, sans modèle) ; seules
  les étapes `agent` utilisent un agent, éventuellement différent par étape (champ `agent`, multi-agent).

## Journal
- 03:20 `definition.js` : schéma zod strict (5 types d'étapes, effet read/write, retries ≤ 3, timeout,
  optional), unicité, dépendances connues, détection de cycles (Kahn), niveaux parallèles.
- 03:30 `index.js` : ordonnanceur à concurrence bornée ; génération par tentative (sortie tardive ignorée) ;
  étape `write` interrompue ou expirée → `uncertain` + décision humaine (retry/done/fail), jamais relancée
  seule ; approbations humaines ; reprise après crash (`recover`) ; annulation ; événements `workflow`/`step`.
- 03:35 15 tests moteur, tous verts du premier coup.
- 03:45 Intégration : `packages/orchestrator/workflow-run.js` (exécuteurs tool/agent/verify/aggregate),
  mode `mode: 'workflow'` dans l'API, DAG déclarés dans les manifestes Najah (6 étapes) et Général (4 étapes),
  validés au chargement. Routes `POST /api/runs/:id/steps/:stepId` (approbation / résolution d'incertitude),
  étapes renvoyées par `GET /api/runs/:id`. `parseAgentResult` déplacé dans `result.js` (évite un cycle).
- 03:50 **Blocage** : les tests d'intégration ne se terminaient jamais (aucune sortie : `node --test` attend la
  fin du fichier). Diagnostic : pas de blocage d'import (vérifié module par module), boucle d'événements
  inactive (`sample` : kevent). Isolement test par test → le test passe mais le processus reste vivant →
  `ps` : un processus `mcp-gateway/server.js` survivant. Cause : **course** — `snapshot` et `search` en
  parallèle appelaient `mcpClient()` avant la fin de la première connexion → deux gateways, une seule fermée.
  Correctif : mémoïsation de la promesse de connexion. Fausse piste notée : mon premier script de diagnostic
  utilisait `/tmp`, bloqué par le bac à sable (0 % CPU, sans rapport avec le bug).
- 03:55 Bug : pour le pack Général le résumé de l'agent était perdu à l'agrégation → corrigé, test ajouté.
- 04:00 UI : sélecteur « Workflow DAG / Agent unique », étapes en direct (SSE `step`), boutons
  Approuver/Refuser et Relancer/Marquer faite/échec. Vérifié dans le navigateur : 6 étapes « Réussie ».
- 04:02 Bug UX : erreur zod brute (JSON) affichée à l'utilisateur → `publicError()` + test.
- 04:08 **Réel** : DAG Najah avec Gemini `gemini-3.5-flash-lite` → completed ; analyse rédigée par Gemini,
  classement déterministe vérifié. Coût ≈ 0,003 $.

## État
- **Opérationnel et testé** : moteur DAG (15 tests), intégration (8 tests), API étapes, UI. **83 tests verts.**
- **Validé en réel** : DAG Najah avec Gemini.
- **Non fait / limites** : reprise d'un workflow après redémarrage du serveur via l'API (le moteur sait
  `recover`, mais la route de reprise relance encore un nouveau run en mode agent) ; pas encore d'étape
  `approval` dans les DAG fournis ; le planificateur ne génère pas encore de DAG à partir du prompt (il
  sélectionne celui du pack) ; duplication partielle entre le mode agent et l'exécuteur `agent`.
