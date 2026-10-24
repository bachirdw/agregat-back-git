# ADR 007 — Mesure d'usage, ledger chaîné, budgets et plafonds

Date : 25 octobre 2026 (sprint 07). Statut : accepté pour le MVP ; complète l'ADR 002.

## Décision
- Mètres séparés (`packages/billing`) : workflows, outils plateforme, recherches de données, actions
  navigateur, documents, modèles du mode Managed, infrastructure. Les tours d'un **CLI de l'utilisateur
  (BYOA)** et les outils natifs observés sont mesurés pour la transparence mais **non facturables** : la
  configuration qui tenterait de leur donner un prix est refusée.
- Aucun prix n'est inventé : grille à 0 par défaut, configurable dans `.data/pricing.json`
  (`currency`, `centsPerUnit`, `monthlyCapCents`).
- Point de mesure unique `Orchestrator.meter()` ; les gateways (navigateur, données) mesurent **avant**
  l'action via `/api/internal/usage/:runId` (jeton par run) : un refus (budget du run ou plafond mensuel)
  refuse l'action elle-même (HTTP 402) et arrête l'exécution (`budget_exceeded`).
- Estimation de chaque plan (maximum) à partir des étapes du DAG et de l'estimation **déclarée par l'étape**
  (`estimate`) : la facturation ne connaît aucun outil propre à un pack. Lancement refusé si l'estimation
  dépasse le budget du run.
- Ledger en ajout seul, chaîné par SHA-256 (`prev_hash`, `hash`), vérifiable (`verifyLedger`) et affiché
  dans l'interface. Migration automatique des bases existantes.

## Limites
- Chaînage détectant les modifications accidentelles ou naïves ; pas de preuve contre le propriétaire du
  disque (ancrage externe/signature à prévoir pour un service multi-utilisateurs).
- Pas d'abonnements, de crédits prépayés ni de rapprochement avec les coûts réels des fournisseurs.
- Infrastructure et documents : mètres définis, instrumentation à faire.
