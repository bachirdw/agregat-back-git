# Correctifs orch2 — 10/11 (branche `audit-orch2`)

Restes de `correctifs-orch.md`, `correctifs-socle.md`, `correctifs-career.md`. Un commit par point,
test rouge avant / vert après (rouge vérifié en retirant le correctif, sauf mention). Aucun agent réel,
aucune clé, aucun réseau. `packages/browser-gateway/`, `packages/mcp-gateway/` et la bibliothèque
career-ops non touchés.

| #   | Point                                         | Commit    | Test                                                         |
| --- | --------------------------------------------- | --------- | ------------------------------------------------------------ |
| 1   | Sonde négative : `AUTH_REFUSAL`               | `20cf5bb` | `tests/sonde-refus-auth.test.js`                             |
| 2   | `unsupervised` passé au moteur de workflow    | `3c91a1d` | `tests/workflow-run.test.js`                                 |
| 3   | `close()` borné                               | `462f291` | `tests/arret-borne.test.js`                                  |
| 4   | DAG : navigation non prouvée en avertissement | `4da870c` | `tests/astra-turn.test.js` (test réécrit)                    |
| 5   | Code de sortie des scripts jusqu'au Bilan     | `cd4a724` | `tests/career-integration.test.js` (+ 3 attendus mis à jour) |
| 6   | Écart d'ordre nommé, étape répétable          | `5d9380a` | `tests/ecart-ordre-nomme.test.js`                            |

## Détail

1. **Vrai constat, plus grave qu'annoncé.** `saveProbe` filtrait déjà par `AUTH_REFUSAL`, mais pour
   career-ops l'orchestrateur réécrivait le message en « Authentification API refusée » avant, après un
   test `/auth|login|…/` : n'importe quel échec citant « author » ou « login » devenait un faux refus et
   marquait l'agent inutilisable. Les deux sites (`index.js`, `workflow-run.js`) utilisent maintenant
   `AUTH_REFUSAL` (exporté par `agent-runtime/index.js`) ; la réécriture ne se fait que sur un vrai refus.
2. **Choix : option `unsupervised` de l'orchestrateur, supervisé par défaut.** L'orchestrateur ne sait
   pas si un humain suit (ni le mode propriétaire ni l'API ne l'indiquent) ; les tests existants
   (`refuseUncertain`) supposent le comportement supervisé, et en mode propriétaire le front règle les
   étapes `uncertain`. L'option vaut `AGENT_PLATFORM_UNSUPERVISED=1` (ou `new Orchestrator(…, {unsupervised})`)
   pour un lancement par script/CI ; `executeWorkflow` la transmet au moteur. Rien n'est restreint.
3. **Arrêt.** `close()` abortait déjà (cause « Serveur arrêté ») puis attendait sans borne. Il attend
   maintenant `closeTimeoutMs` (10 s, `AGENT_PLATFORM_CLOSE_MS`), puis pour les missions restantes :
   `closeAll`, annulation/fermeture du runtime, permissions et questions soldées, état `interrupted`
   (cause « Serveur arrêté pendant la mission »), sortie de `active`. SIGINT/SIGTERM de `server.js`
   passent par `app.close()` : ils aboutissent. Sans correctif le test reste bloqué.
4. **Alignement.** `workflow-run.js` ne lève plus « Navigation non prouvée » : événement
   `browser_unproven` et ligne « Avertissement — … Réponse de l'agent gardée : à vérifier. » au résumé de
   l'étape, travail gardé. Le test de `astra-turn` qui attendait l'étape `uncertain` puis `failed` est
   réécrit (mission `completed` avec avertissement).
5. **Code de sortie.** Chemin le plus court : `gatewayProgress` (truth.js, déjà appelé par la passerelle
   MCP, donc sans toucher `mcp-gateway/`) ajoute `exitCode` (entier) au compte rendu d'un `career_script`
   en échec ; la route `tool-outcome` le transmet à `recordGatewayTool`. Verdict seulement si le script a
   répondu un code 1–125 : sans code (la passerelle a levé : spawn, délai, annulation) ou 126/127/≥128
   (non exécutable, introuvable, tué par signal), c'est une panne de l'outil. Limite : un script qui plante
   par exception sort aussi en 1 et reste indiscernable d'un verdict. Les compte rendus `completed` sont
   inchangés.
6. **Écart d'ordre.** `finish()`/`current()` fournissent `orderDetails` (≤ 4 lignes « X avant Y » : X fait
   avant Y qui le précède dans le manifeste ; ou « X avant Y » quand Y, obligatoire et antérieur, n'a pas
   été fait) ; `formatSkillBilan` écrit « Écart d'ordre : constaté (Relire les valeurs saisies avant
   Joindre le CV adapté) ». Règle générale : champ de manifeste `repeatable` (étape refaisable, par page) ;
   les étapes répétables sont exclues de la comparaison d'ordre. Posé sur `verify` de l'intention `apply`
   (`domain-packs/career-ops/skill-manifest.yaml`) : relire la page 1 avant de téléverser à la page 2 n'est
   plus un écart. Un champ de plus au schéma strict du manifeste.

## Tests

Phase unitaire sans Chrome (`--test-concurrency=2`, hors browser-/approval-bridge/owner-browser/apply-flow/…) : 925 tests, 923 réussis, 0 échec, 2 ignorés. `npm run check` et `npm run format:check` : verts.
