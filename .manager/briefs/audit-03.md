# audit-03 — Orchestrateur, Workflow Engine, stockage, Data Gateway
Lis `.manager/briefs/_audit-common.md` et applique-le. Rapport : `.manager/reports/audit-03.md`.
Partie : `packages/orchestrator/*`, `packages/workflow-engine/*`, `packages/storage/*`, `packages/data-gateway/*` ;
tests `tests/workflow-*.test.js`, `tests/orchestrator*.test.js`, `tests/storage*.test.js`, `tests/data-gateway*.test.js`
(et tout test qui les vise : `rg -l` dans `tests/`).
Plan : ADR 003 (DAG maison minimal sur SQLite, étapes tool/agent/approval/verify/aggregate, générations, état
`uncertain`, reprise en place, câblage `$from`), `reuse-plan.md` § reuse-05 (décision de non-remplacement), MISSION/PLAN.
Sources : `openclaw__acpx/src/flows/*`, `dbos-inc__dbos-transact-ts` (étapes durables, reprise idempotente).
Vérifie en priorité : reprise après crash, écritures incertaines jamais rejouées, délais et annulation, budgets,
limites d'événements, couplage career-ops dans le cœur de l'orchestrateur (constat d'architecture à documenter).
