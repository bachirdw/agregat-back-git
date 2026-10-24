# Plan de la nuit (manager : Claude ; exécutant : Codex gpt-6.1-sol)

Point de départ : MVP « Relay » (commit baseline 9b4542e) — Node 24 sans framework, ACP SDK, MCP SDK,
SQLite, Najah sur fixtures, 10 tests. La recherche précédente reposait sur quelques fichiers par dépôt
récupérés via l'API ; les clones complets sont maintenant dans ~/Downloads/agent-repos/.

| Sprint | Thème | Résultat attendu |
|---|---|---|
| 01 | Audit approfondi du code réel + agents Gemini/OpenCode | open-source-research.md refait (tableau, stratégies justifiées par le code), ACP de gemini/opencode vérifié, CGU BYOA, ADR mis à jour |
| 02 | Couche d'exécution multi-agents | Adaptateurs Gemini CLI et OpenCode (ACP natif), Claude, routeur Auto par capacités, sélection de modèle, tests |
| 03 | Workflow engine | DAG durable (séquentiel + parallèle), états explicites, reprise, étape de vérification/agrégation, multi-agent |
| 04 | Capabilities & navigateur | Capability registry stable, Browser Gateway avec fournisseur Playwriter réel + fixture, politiques imposées au gateway, MCP externes sous allowlist |
| 05 | Skills | Registre (découverte, install locale/git en quarantaine, validation, permissions, versions), export portable vers Claude/Codex/Gemini/OpenCode |
| 06 | Najah | Sources réelles publiques citées (offres, registres de sponsors), vérification employeur, classement, brouillons CV/lettre (sans envoi), évaluations |
| 07 | Usage & billing | Compteurs par catégorie, ledger auditable, limites de dépense, arrêt sur dépassement, coûts dans l'UI |
| 08 | UI + validation finale | Parcours complet dans l'UI, tests E2E, README, validation.md, synthèse |

Le manager ajuste ce plan après chaque rapport.
