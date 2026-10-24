# Plan MVP — état et suites (25 octobre 2026)

## Réalisé pendant la nuit (sprints 01–08, rapports dans `.manager/reports/`)
1. Audit du code réel de 27 dépôts, matrice ACP des 4 agents, conditions BYOA, ADR 003–005.
2. Runtime ACP multi-agents (Codex, Claude, Gemini CLI, OpenCode), routeur Auto, sélection de modèle.
3. Moteur de workflows DAG durable, mode workflow, reprise en place, approbations, multi-agent.
4. Registre de capacités, Browser Gateway (Chrome réel isolé / CDP partagé / relais Playwriter), pont
   d'approbation imposé par la gateway (ADR 006).
5. Registre de Skills v2 (quarantaine, revue liée à l'empreinte, versions, export natif) ; career-ops importé.
6. Najah sur sources réelles citées (Arbeitnow, Remotive, registre UK), classement vérifié, évaluations,
   brouillon de candidature avec relecture humaine.
7. Usage & facturation : mètres séparés, ledger chaîné, budgets, plafond mensuel, arrêt (ADR 007).
8. Interface complète, tests E2E sur Chrome réel, documentation.

## Prochaines étapes priorisées
1. **Tester l'extension Playwriter** avec le Chrome de l'utilisateur (consentement explicite, télémétrie
   désactivée), puis consentement d'accès au navigateur dans l'interface.
2. **Authentifier Claude Code** côté utilisateur et valider un prompt réel ; valider une reprise
   `session/load` réelle (Codex/Gemini/OpenCode l'annoncent).
3. Sources de sponsoring hors Royaume-Uni (Pays-Bas IND, Irlande…) et équilibrage des sources dans Najah.
4. Profil candidat (CV) stocké localement et chiffré, pour l'adéquation et les brouillons.
5. Génération de DAG assistée par modèle, validée par le schéma et les politiques avant exécution.
6. Multi-utilisateurs : authentification, `tenant_id` partout, isolation OS par run, PostgreSQL (+ DBOS à
   réévaluer), companion distant authentifié.
7. Mode Managed (runtime API) réutilisant packs, workflows, gateways et ledger ; abonnements et crédits.
