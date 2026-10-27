# audit-02 — Browser Gateway, registre des capacités, politique
Lis `.manager/briefs/_audit-common.md` et applique-le. Rapport : `.manager/reports/audit-02.md`.
Partie : `packages/browser-gateway/*` (index, cdp, owner-transport), `packages/capability-registry/*`,
`packages/policy-engine/*` ; tests `tests/browser-*.test.js`, `tests/owner-*.test.js`, `tests/policy*.test.js`
(phase Chrome : `node scripts/run-tests.js` ou le fichier seul ; Chrome isolé, pages FICTIVES locales).
Plan : ADR 004 et 006, ADR 008 (propriétaire), `reuse-plan.md` § reuse-01/02/03 + 5 amendements, rapports
`reuse-01*.md`, `reuse-02.md`, `review-reuse-02-claude.md`, `review-reuse-01c-claude.md`.
Sources : `microsoft__playwright` (`packages/playwright-core/src/tools/backend/*`), `remorses__playwriter`
(aria-snapshot, cdp-relay, relay-client), `microsoft__playwright` NOTICE.
Attention : les constats de **sécurité** (envoi sans accord, GET privés) sont reportés : liste-les, ne les corrige pas.
Vérifie en priorité : refs `eN`/`fNeN`, onglet caché (actions DOM prouvées par effet), `fillForm`, attentes de page,
upload/download confinés, cohérence schémas zod ↔ JSON Schema MCP ↔ instructions données aux modèles.
