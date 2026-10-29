# Audit night2-back

## Journal

- 21:13 — Lecture de `AGENTS.md`, du brief, de `_audit-common.md`, de la mission et du plan. Aucun rapport de passation préexistant ; `git status --short` vide ; HEAD `27f1d29`. Périmètre inventorié : 67 fichiers source sous `packages`, `apps/api`, `domain-packs`, `scripts`. Aucun appel de modèle ni site réel prévu.
- 21:13 — `git log --since=2026-10-28 --oneline --stat` enregistré dans `/tmp/night2-back-log.txt` (173 lignes) ; lecture ciblée à poursuivre.

- 21:15 — Lecture ciblée de `orchestrator/index.js`, `workflow-run.js`, `agent-runtime/index.js`, `workflow-engine/index.js`, `storage/index.js` et `mcp-gateway/client.js`. Suite initiale `npm test` toujours active : 0 échec sur la partie sans Chrome (journal `night2-back-evidence/baseline-test.log`), puis série Chrome en cours. Aucun défaut corrigé à ce stade.
- 21:19 — Revue ciblée de `apps/api/server.js`, `browser-gateway/index.js`, `owner-transport.js`, `cdp.js`, `capability-registry/index.js`, `mcp-gateway/server.js`, `career-ops/sends.js`, `tools.js`, `truth.js`, `data-gateway/index.js`, `domain-packs/najah/index.js`, `scripts/live-{probe,run}.js` et `career-live-smoke.js`. Contrôle des tests existants par noms de cas et des écarts déjà consignés dans `audit-01` à `audit-05` et `GAP-REPORT`. Pas d'appel réel.
- 21:19 — `node --test tests/workflow-resume.test.js` : rouge 7/8 (`workflow-approval-red.log`, décision tardive acceptée), puis vert 8/8 (`workflow-approval-green.log`) après ajout d'un contrôle d'annulation à `stepDecision` dans `packages/orchestrator/index.js`. Suite complète avant commit relancée ; journaux `precommit-*` en cours.

- 21:17 — Référence : `npm test` code 1 ; phase sans Chrome `fail 0`, phase Chrome échoue avec `SIGABRT` et `kill EPERM` (`night2-back-evidence/baseline-test.log`). `npm run check` et `npm run format:check` codes 0. Test de régression ajouté à `tests/workflow-resume.test.js` pour la décision synchrone après annulation ; exécution ciblée en cours.

- 21:21 — Avant commit : `npm test` code 1, phase sans Chrome 327 tests / 326 réussites / 0 échec / 1 ignoré ; phase Chrome 129 tests / 61 réussites / 68 échecs de lancement `SIGABRT`/`kill EPERM`. `npm run check` et `npm run format:check` codes 0. Preuves `precommit-test.log`, `precommit-check.log`, `precommit-format.log`. `git diff --check` code 0.

- 21:21 — `git add -A && git commit` code 128 : création de `.git/index.lock` refusée par le bac à sable (`Operation not permitted`). Escalade contrôlée demandée pour le commit local, sans push.

## Écarts au plan

| Exigence (source) | État réel | Preuve | Gravité |
|---|---|---|---|
| Suivi, intervention, approbations et historique (`.manager/MISSION.md:7-12`) | Fait pour le MVP local ; course d'annulation corrigée | `packages/orchestrator/index.js:222-230,437-541,858-942`, `tests/workflow-resume.test.js` | Moyenne avant correction |
| Reprise durable, états explicites et vérification (`.manager/MISSION.md:66-68`, `.manager/PLAN.md:20`) | Partiel : reprise testée sur fixtures, transaction état + événement absente | `packages/workflow-engine/index.js:44-78,93-120`, `packages/storage/index.js:60-81`; constat antérieur `audit-03.md:15-31` | Moyenne |
| Quatre agents ACP, interruption, modèle et session (`.manager/MISSION.md:7-15,41-46`) | Partiel : faux ACP testé ; reprise fournisseur réelle non renouvelée, Windows `.cmd` non pris en charge | `packages/agent-runtime/index.js:119-318`, `tests/runtime.test.js`, `audit-01.md:16-33` | Moyenne |
| Capacités MCP/navigateur abstraites (`.manager/MISSION.md:41-57`, `.manager/PLAN.md:21`) | Partiel : MCP stdio et gateway CDP/fixture ; Chrome de test impossible dans ce bac à sable | `packages/mcp-gateway/{client,server}.js`, `packages/browser-gateway/{index,cdp,owner-transport}.js`; `baseline-test.log` | Moyenne |
| Pack indépendant et sources vérifiées (`.manager/MISSION.md:18-20,38-39`, `.manager/PLAN.md:23`) | Partiel : Najah UK avec provenance ; career-ops encore branché dans le cœur | `domain-packs/najah/{index,live}.js`, `packages/orchestrator/index.js:235-438`, `audit-05.md:22-39` | Moyenne |
| API locale et flux de suivi (`.manager/MISSION.md:7-12,66-68`) | Fait pour le prototype local ; aucune preuve d'isolation multi-utilisateurs | `apps/api/server.js:94-209,269-474`, `tests/platform.test.js` | Faible pour le prototype |

## Défauts

| N° | Fichier:ligne | Gravité | Défaut et scénario | Statut |
|---|---|---|---|---|
| 1 | `packages/orchestrator/index.js:222-230` | Moyenne | `cancel()` puis `stepDecision()` dans le même tour pouvait marquer l'étape de relecture `succeeded` malgré le signal d'annulation ; la reprise conservait alors une approbation tardive. | Corrigé : test rouge `workflow-approval-red.log` (7/8), vert `workflow-approval-green.log` (8/8), commit à venir. |
| 2 | `packages/workflow-engine/index.js:44-78`, `packages/storage/index.js:60-81` | Moyenne | Changement d'état et événement dans deux écritures SQLite ; crash intermédiaire pouvant désynchroniser l'historique. | Proposé : transaction dédiée, déjà connu par `audit-03.md`. |
| 3 | `packages/mcp-gateway/server.js:144-163` | Moyenne | Si l'action navigateur réussit puis que le POST du journal d'évidence échoue, l'outil renvoie `isError` ; son effet réel devient incertain pour l'agent. | Proposé : contrat de résultat « effet effectué, journal indisponible » et test d'intégration avant changement. |
| 4 | `packages/browser-gateway/owner-transport.js:40-68,107-111` | Moyenne | Une réponse `Target.createTarget` après le délai est ignorée car sa requête a été retirée de `pending` ; la cible créée peut échapper au nettoyage. | Proposé : suivi des réponses tardives et test CDP factice ; environnement Chrome indisponible ici. |
| 5 | `scripts/live-probe.js:43-73` | Élevée pour le budget | `LIVE_PROMPT=1` peut appeler Gemini sans lire ni contrôler le cumul API et inscrit un tarif supposé. | Proposé ; déjà connu dans `audit-05.md` et `GAP-REPORT.md`. Script non exécuté, aucun modèle appelé. |

## Comparaison aux sources

| Mécanisme | Source locale à commit fixe | Comparaison / décision |
|---|---|---|
| Reprise du DAG | `agent-repos/openclaw__acpx@c0b9dfd:src/flows/runtime.ts:206-251` et `dbos-inc__dbos-transact-ts@980dc55:src/dbos-executor.ts:1205-1244` (cf. `audit-03.md:35-45`) | Notre reprise SQLite conserve l'identifiant du run et les étapes réussies ; décision tardive après annulation corrigée dans le contrôle local. Aucun code copié. |
| Agent ACP | SDK installé `@agentclientprotocol/sdk` 2.0.2 `dist/core/jsonrpc.js:476,568-572` (cf. `audit-01.md:39-50`) | `cancellationSignal` et deadline locale dans `agent-runtime/index.js:174-222` ; aucun changement nécessaire constaté. |
| Outils MCP | `agent-repos/modelcontextprotocol__typescript-sdk@951fe560:packages/server/src/server/mcp.ts:263-285,1090-1118` (cf. `audit-04.md:39-47`) | `McpServer.registerTool` enveloppé pour mesurer avant handler ; schémas stricts déjà corrigés. Aucune copie. |
| Navigateur | `agent-repos/microsoft__playwright@b8336b3:packages/playwright-core/src/tools/backend/tab.ts:483-504` (cf. `audit-02.md:37-47`) | Le gateway s'appuie sur des snapshots et références, mais la preuve Chrome actuelle ne passe pas dans ce bac à sable. Aucun nouveau code copié. |
| Skills tiers | `agent-repos/vercel-labs__skills@a80e4c9:src/skill-lock.ts:13-38` (cf. `audit-05.md:41-49`) | Le registre garde la provenance et la revue ; aucun fichier de la bibliothèque career-ops touché. |

## Tests ajoutés et preuves

- `tests/workflow-resume.test.js` : annulation puis approbation tardive, échec 7/8 avant correction, réussite 8/8 après correction. Journaux sous `night2-back-evidence/`.

## Décisions et alternatives

- L'annulation d'une approbation relève de la cohérence du workflow ; refus de la décision tardive à l'entrée `stepDecision`, sans changer le moteur ni la politique de sécurité reportée. La refonte transactionnelle du stockage reste proposée.
- Les défauts de sécurité explicitement reportés par `_audit-common.md` (envois, GET privés, fragments de CV SQLite) restent signalés seulement. Aucun garde-fou ajouté.

## Questions et suite
