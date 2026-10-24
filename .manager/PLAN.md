# Plan de la nuit (manager : Claude ; exécutant : Codex gpt-6.1-sol, raisonnement xhigh)

Objectif : tout prêt au réveil du propriétaire (~10h00 AEDT, 25 octobre 2026).
Point de départ : MVP « Relay » (commit baseline 9b4542e) — Node 24 sans framework, ACP SDK, MCP SDK,
SQLite, Najah sur fixtures, 10 tests. Clones complets dans ~/Downloads/agent-repos/ (dont career-ops, MIT).

## Cycle par sprint
1. **Implémentation** (session Codex neuve, brief `briefs/sprint-NN.md`) → rapport `reports/sprint-NN.md`.
2. **Relecture indépendante** (autre session Codex neuve, brief `briefs/review-NN.md`) : relit tout le diff du
   sprint sans faire confiance au rapport, exécute les tests, cherche bugs/failles/promesses non tenues,
   AJOUTE des tests (cas limites, erreurs, sécurité), corrige les défauts confirmés → `reports/review-NN.md`.
3. **Contrôle du manager** : relit diff et rapports, relance `npm test`/`check`/`format:check` lui-même,
   ajuste le brief suivant. Passation : chaque session repart de zéro avec les rapports précédents.

## Sprints
| # | Thème | Résultat attendu |
|---|---|---|
| 01 | Audit du code réel + agents Gemini/OpenCode | Recherche refaite (tableau, stratégies justifiées par fichiers/lignes), matrice ACP 4 agents, CGU BYOA, ADR, critique d'architecture |
| 02 | Couche d'exécution multi-agents | Adaptateurs Gemini CLI et OpenCode (ACP natif), Claude, Codex ; routeur Auto par capacités ; sélection de modèle (configOptions ET models/unstable_setSessionModel) ; CLI en dossier persistant |
| 03 | Workflow engine | DAG durable (séquentiel + parallèle), états explicites, reprise, approbations humaines, étape vérification/agrégation, multi-agent |
| 04 | Capabilities & navigateur | Capability registry stable (browser.*), Browser Gateway : fournisseur Playwriter réel + fixture, politiques imposées au gateway (domaines, actions sensibles, scripts, onglets), companion local ; MCP externes sous allowlist |
| 05 | Skills | Registre : découverte, install locale/git en quarantaine, scan/validation, permissions, versions, activation ; export portable Claude/Codex/Gemini/OpenCode ; import des Skills career-ops comme Skills tiers non fiables |
| 06 | Najah | Intégration career-ops (s'inspirer/adopter les modes et scripts utiles, licence MIT + marque respectée), sources publiques réelles citées (offres, registres de sponsors), vérification employeur, classement, brouillons CV/lettre sans envoi, évaluations |
| 07 | Usage & billing | Compteurs par catégorie, ledger auditable, limites de dépense, arrêt sur dépassement, coûts dans l'UI ; BYOA jamais refacturé |
| 08 | UI + E2E + docs | Parcours complet dans l'UI (prompt → agent → Skills → plan → exécution → navigateur → résultats), tests E2E, README, validation.md |
| R-final | Relecture globale + durcissement | Deux relectures croisées de l'ensemble, corrections, rapport final `reports/FINAL.md` |

## Budget API (plafond absolu fixé par le propriétaire : 10 $ pour toute la nuit)
- Seule API payante autorisée : Gemini, si une clé est fournie dans `.manager/secrets.env` (jamais commitée).
- Plafond opérationnel : **2 $ estimés** et **40 appels** au total ; journal obligatoire `.manager/api-usage.md`.
- Tests réels Codex/Claude via abonnement : prompts de quelques mots, rares.

Le manager ajuste ce plan après chaque rapport (section « Ajustements » ci-dessous).

## Ajustements
- 02:45 — Ajout des relectures indépendantes, de career-ops (MIT, marque réservée : ne pas utiliser le nom
  comme nom de produit), et du budget API.
