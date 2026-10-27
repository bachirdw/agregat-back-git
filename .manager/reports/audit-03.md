# Audit 03 — orchestrateur, Workflow Engine, stockage, Data Gateway

## Journal horodaté et commandes

- 01:25 — Lecture de `AGENTS.md`, du brief et des règles communes ; aucune passation audit-03, Git propre (HEAD `ff007ac`). Création de ce rapport et de `audit-03-evidence/`.
- 01:25 — `npm test`, `npm run check`, `npm run format:check` initiaux, sorties redirigées vers `audit-03-evidence/baseline-*.log`. Test : **échec** (phase unitaire/intégration : 295/296 réussis, 1 ignoré, 0 échec ; phase Chrome : 61 réussis, 75 échecs, lancement Chrome `SIGABRT` et `kill EPERM` dans le bac à sable). Check et format : exit 0. Aucun succès global revendiqué.
- 01:26 — Lecture ciblée de MISSION/PLAN, ADR 003, architecture, reuse-05, HANDOFF ; lecture des quatre packages et repérage de tous les tests qui les importent (`rg -l`). `wc -l ... tests/orchestrator*.test.js` : **échec** zsh « no matches found » ; inventaire repris avec chemins explicites.
- 01:27 — Hypothèse d'un cache malformé : test ajouté à `tests/najah-live.test.js`, ciblé **vert** (1/1, `cache-red.log` malgré son nom). Le code absorbait déjà l'erreur : hypothèse fausse ; couverture du cas conservée.
- 01:27 — Sortie DAG UTF-8 : test ajouté à `tests/workflow-engine.test.js`, **rouge** (attendu `failed`, obtenu `completed`, `output-red.log`). Correction de `packages/workflow-engine/index.js` : `Buffer.byteLength` du JSON avant persistance. `node --test tests/workflow-engine.test.js tests/najah-live.test.js` : 34/34 réussis (`targeted-green.log`).
- 01:28 — Lecture de `openclaw__acpx@c0b9dfd` et `dbos-inc__dbos-transact-ts@980dc55`, licences MIT vérifiées ; aucune copie. Suite ciblée élargie lancée, preuve `targeted-scope.log`.
- 01:30 — `node --test` sur 13 fichiers du périmètre et dépendances : 184/184 réussis (`targeted-scope.log`). Garde précommit : `CHROME_PATH=/nonexistent npm test` exit 0 (unitaire/intégration : 296 réussis, 1 ignoré ; navigateur : 58 réussis, 66 ignorés), `npm run check` exit 0, `npm run format:check` exit 0, `git diff --check` exit 0. Preuves `precommit-*`, `diff-check.log`. Chrome réel non renouvelé ; le test initial sans cette variable reste rouge.
- 01:30 — Premier `git add -A && git commit` : **échec** `Unable to create .git/index.lock: Operation not permitted` (bac à sable, `.git` en lecture seule). Reprise demandée avec élévation pour ce seul commit local autorisé ; aucun push.

## Écarts au plan

| Exigence (source) | État réel | Preuve | Gravité |
| --- | --- | --- | --- |
| DAG durable, séquentiel/parallèle, approbation, vérification et agrégation (`.manager/PLAN.md:20`, `docs/adr/003-runtime-and-durable-workflows.md:24-34`) | fait en code et tests fictifs | `packages/workflow-engine/definition.js:5-77`, `index.js:154-306`, `packages/orchestrator/workflow-run.js:80-264`, `tests/workflow-engine.test.js`, `tests/workflow-run.test.js` | faible |
| Reprise en place ; sorties terminées préservées ; effets d'écriture incertains (`docs/adr/003-runtime-and-durable-workflows.md:28-34`) | fait en code et tests fictifs ; aucun exactly-once externe revendiqué | `packages/workflow-engine/index.js:93-153,236-290`, `packages/orchestrator/index.js:462-503`, `tests/workflow-resume.test.js:34-97`, `tests/workflow-engine.test.js:278-314,346-376` | faible |
| Tables d'étapes **et de tentatives**, admission et état atomiques, politique de conflits de workspace (`docs/adr/003-runtime-and-durable-workflows.md:26-29`) | partiel : table `workflow_steps` avec compteur de tentatives ; pas de table d'historique des tentatives ni de transaction couvrant état+événement ; répertoires distincts par étape agent, aucune politique explicite pour outils | `packages/workflow-engine/index.js:30-78,236-248`, `packages/storage/index.js:60-81`, `packages/orchestrator/workflow-run.js:120-128` | moyenne |
| Domain Pack indépendant du cœur (`.manager/MISSION.md:16-17,38-39`) | différent : career-ops chargé et traité directement dans le cœur ; extraction demande un brief dédié selon reuse-plan | `packages/orchestrator/index.js:1-8,106-116,209-229,401-459,529-710`; `.manager/reuse-plan.md:109` | moyenne |
| Budgets et compteurs séparés, limite avant action (`.manager/MISSION.md:62-64`) | fait pour les chemins inspectés ; prix par défaut zéro, sans prétention sur les coûts fournisseur | `packages/orchestrator/index.js:74-98`, `packages/storage/index.js:148-203`, `packages/data-gateway/index.js:156-158`, `tests/billing.test.js` | faible |
| Limites des sorties/événements (`docs/adr/003-runtime-and-durable-workflows.md:27-28`, robustesse de persistance) | partiel avant correction : sortie DAG bornée en caractères, non en octets ; corrigé pour les sorties d'étapes ; événements ACP bornés par étape agent et chaque événement stocké en octets, mais aucune borne cumulée par run à la lecture/écriture du Store | `packages/workflow-engine/index.js:18,266-270`, `packages/orchestrator/workflow-run.js:136-151`, `packages/storage/index.js:68-89` | moyenne |
| Choix de conserver le DAG SQLite (`.manager/reuse-plan.md:78-87`) | fait : aucun remplacement DBOS/acpx, aucun ajout de dépendance | `packages/workflow-engine/index.js`, `package.json` | faible |

## Défauts

| N° | Fichier:ligne | Gravité | Défaut | Scénario | Corrigé ou proposé |
| --- | --- | --- | --- | --- | --- |
| 1 | `packages/workflow-engine/index.js:266-269` | moyenne | Limite de sortie de 200 000 mesurée en unités JS ; JSON UTF-8 peut dépasser la borne persistée | sortie fictive de 120 000 `é` : 240 002 octets, ancien run `completed` | corrigé par le commit `[audit-03] Borner les sorties du workflow en octets UTF-8` ; rouge→vert `output-red.log` / `targeted-green.log` |
| 2 | `packages/workflow-engine/index.js:49-67`, `packages/storage/index.js:60-81` | moyenne | Mutation de l'état et écriture de l'événement sont deux écritures distinctes | crash entre UPDATE et INSERT : état présent sans événement correspondant | proposé : transaction atomique dans un brief dédié, sans refonte pendant cet audit |
| 3 | `packages/orchestrator/index.js:1-8,209-229` | moyenne | Couplage career-ops dans l'orchestrateur universel | ajout d'un pack indépendant demande des branches métier dans le cœur | proposé : extraction via API de pack, brief dédié déjà demandé par reuse-plan |

## Comparaison aux sources

| Mécanisme | Source vérifiée | Notre code / décision |
| --- | --- | --- |
| Graphe et parallélisme | `openclaw__acpx@c0b9dfd:src/flows/graph.ts:4-34`, `runtime.ts:345-370` : une seule sortie par nœud, curseur séquentiel | `definition.js:52-79`, `index.js:201-235` : fan-out/fan-in borné ; conserver le moteur maison. |
| Reprise | `openclaw__acpx@c0b9dfd:src/flows/runtime.ts:206-251` : nouveau runId et état de flow initialisé ; pas d'API de reprise durable constatée sur cette surface | `index.js:93-120`, `orchestrator/index.js:462-503` : reprise en place avec état persistant ; conserver. |
| Étapes durables | `dbos-inc__dbos-transact-ts@980dc55:src/dbos-executor.ts:1205-1244,1271-1296` : résultats d'opérations réutilisés et réenfilage au redémarrage | `workflow-engine/index.js:93-120,236-290` : reprises SQLite locales ; DBOS dépend de PostgreSQL, migration hors périmètre. |
| Effets externes | `dbos-inc__dbos-transact-ts@980dc55:src/dbos-executor.ts:1205-1244` rejoue une opération non enregistrée | `workflow-engine/index.js:93-115,274-283` : `uncertain` interdit le rejeu automatique d'une écriture ; choix plus prudent pour ce contrat. |

Sources acpx et DBOS sous MIT (`LICENSE:1-5`) ; étude seule, zéro code copié et aucune notice ajoutée.

## Tests ajoutés

- `tests/workflow-engine.test.js` : sortie UTF-8 au-delà de la limite en octets, rouge avant correction puis vert.
- `tests/najah-live.test.js` : entrée de cache JSON structurée mais `result: null` ; confirme le repli existant.
- Couverture existante vérifiée : graphes invalides, parallélisme borné, retries, approbation/refus, timeout, annulation, sortie tardive, reprise après crash et écriture incertaine (`tests/workflow-engine.test.js`) ; reprise HTTP et définition modifiée (`tests/workflow-resume.test.js`) ; budget refusé avant réseau, cache/rejeu et deadline (`tests/billing.test.js`, `tests/najah-live.test.js`). Les accidents entre état et événement, la borne cumulée d'événements et les effets externes réels restent sans preuve spécifique ; aucun effet réel n'a été déclenché pendant l'audit.

## Décisions, questions et état final

- **Décision** : correction ponctuelle de la taille UTF-8. Pas de remplacement du DAG, pas de migration DBOS et pas de refonte du couplage career-ops pendant cet audit.
- **Question manager** : prioriser un brief pour l'atomicité état/événement et l'historique des tentatives ? Décider séparément de l'API de pack pour sortir career-ops du cœur.
- **Opérationnel** : correctif UTF-8 confirmé rouge→vert ; suite ciblée 184/184, garde `CHROME_PATH=/nonexistent npm test`, check et format verts. Aucune API de modèle, mission ou source réelle appelée.
- **Incomplet** : validation Chrome réelle impossible dans ce bac à sable (`SIGABRT`, `EPERM`, 75 échecs initiaux). Rejouer sur un hôte où Chrome démarre. Atomicité de l'état/événement, historique des tentatives, borne cumulée d'événements et découplage career-ops restent proposés.
- **Sécurité reportée** : points d'envoi et persistance privée indiqués dans `_audit-common.md`, recensés sans modification.
