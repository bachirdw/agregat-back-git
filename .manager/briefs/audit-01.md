# audit-01 — Agent Runtime (ACP)
Lis `.manager/briefs/_audit-common.md` et applique-le. Rapport : `.manager/reports/audit-01.md`.
Partie : `packages/agent-runtime/*` (index, profiles, env, discovery, capabilities, router, probes, process-liveness),
tests `tests/runtime.test.js`, `tests/process-liveness.test.js`, et ce qui concerne le runtime dans `tests/owner-mode.test.js`.
Plan : MISSION/PLAN (Agent Runtime interchangeable, ACP v1 seul protocole, adaptateurs officiels, env en liste blanche,
modes sûrs), ADR 001 et 003, `reuse-plan.md` § reuse-04, `reports/reuse-04.md`.
Sources : `openclaw__acpx` (agent-registry, spawn-command-options, permission-policy, session/*),
`agentclientprotocol__typescript-sdk`, `claude-agent-acp`, `codex-acp`, `google-gemini__gemini-cli` (ACP, modes, modèles).
Points à vérifier en priorité : reprise de session, délais, annulation, refus de permission, redaction des secrets,
découverte des CLI et des modèles annoncés, cohérence des identifiants d'agents entre runtime, router et catalogue.
