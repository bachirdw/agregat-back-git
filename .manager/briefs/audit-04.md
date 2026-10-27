# audit-04 — MCP Gateway, Skill Registry, facturation
Lis `.manager/briefs/_audit-common.md` et applique-le. Rapport : `.manager/reports/audit-04.md`.
Partie : `packages/mcp-gateway/*`, `packages/skill-registry/*`, `packages/billing/*` ; tests `tests/mcp*.test.js`,
`tests/skill*.test.js`, `tests/billing*.test.js` (et `rg -l` dans `tests/`).
Plan : ADR 004 (Skills SKILL.md portables, quarantaine, revue liée à l'empreinte), ADR 007 (facturation : mètres
séparés, BYOA jamais facturable, aucun prix inventé, ledger SHA-256 chaîné), `reuse-plan.md` § reuse-06 et reuse-07.
Sources : `modelcontextprotocol__typescript-sdk` (usages recommandés de `McpServer`), `modelcontextprotocol__servers`,
`vercel-labs__skills` (chemins par agent), `anthropics__skills/spec` (format ; licences par Skill), `agentgateway`
(concepts d'autorisation, étude seule).
Vérifie en priorité : schémas d'outils exposés, refus d'arguments inconnus, mesure avant action, intégrité du ledger,
export des Skills par agent, confinement des chemins.
