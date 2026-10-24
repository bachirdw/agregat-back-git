# Rapport sprint 07 — Usage & facturation

**Exécutant : Claude (manager)** — Codex en limite d'usage jusqu'à 7h29. Voir ADR 007.

## Réalisé
- `packages/billing` : catalogue de mètres (facturables / observés), grille validée (prix BYOA interdit,
  devise, plafond mensuel), prix arrondi au centime supérieur, estimation de plan, résumé par mètre.
- Stockage : ledger chaîné SHA-256 avec migration, `verifyLedger`, plafond mensuel transactionnel.
- Orchestrateur : `meter()` unique, arrêt du run sur dépassement, refus préalable si estimation > budget,
  pont `/api/internal/usage/:runId` (402) ; gateways navigateur et données mesurent avant d'agir.
- UI : champ budget, estimation détaillée et avertissement, consommation par catégorie, BYOA « non
  refacturé », intégrité du registre.
- Tests : `tests/billing.test.js` (10) ; suite **144 tests verts**.

## Erreurs et corrections pendant le sprint
- Première estimation fondée sur le nom de l'étape → comptait des requêtes réseau pour le DAG fictif.
  Deuxième version fondée sur le nom de l'outil → **couplage interdit** de la facturation au pack Najah et
  `opportunities_rank_live` (simple tri) compté comme réseau. Version finale : estimation déclarée par
  l'étape du DAG (`estimate`), facturation générique.
- Deux modifications de tests par substitution Python n'avaient pas été appliquées (fichier reformaté par
  Prettier entre-temps) ; détecté en relisant le fichier, refait avec l'outil d'édition.
