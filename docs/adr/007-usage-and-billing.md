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
- Estimation des opérations déclarées de chaque plan, tentatives de lecture comprises, à partir des étapes du DAG et de l'estimation **déclarée par l'étape**
  (`estimate`) : la facturation ne connaît aucun outil propre à un pack. Lancement refusé si l'estimation
  dépasse le budget du run.
- Ledger en ajout seul, chaîné par SHA-256 (`prev_hash`, `hash`), vérifiable (`verifyLedger`) et affiché
  dans l'interface. Migration automatique des bases existantes.

## Limites
- Chaînage détectant les modifications accidentelles ou naïves ; pas de preuve contre le propriétaire du
  disque (ancrage externe/signature à prévoir pour un service multi-utilisateurs).
- Pas d'abonnements, de crédits prépayés ni de rapprochement avec les coûts réels des fournisseurs.
- Infrastructure et documents : mètres définis, instrumentation à faire.


## Durcissement review-night

Les appels d’outils initiés par les agents sont mesurés au serveur MCP avant exécution ; les appels du
scheduler restent mesurés une seule fois par le scheduler. Un serveur sans pont ne peut exécuter des
outils facturables. Les unités et mètres sont validés au stockage, qui refuse tout débit de tours BYOA.
Le ledger possède un ancrage local de son nombre de lignes et de sa tête, mis à jour dans la même
transaction que l’ajout ; une suppression de queue est détectée même après redémarrage. Les nouvelles
empreintes v2 encodent les champs en JSON avec l’identifiant de ligne ; les anciennes chaînes restent
lisibles. Un ledger corrompu bloque les ajouts. L’ancrage initial d’une migration ne peut prouver
l’absence de suppressions antérieures à son installation ; aucun ancrage local ne résiste à un
propriétaire malveillant du disque qui réécrit ensemble la chaîne et ses métadonnées.

L’estimation ne borne pas les appels dynamiques d’un agent : le budget vérifié à chaque action est le
plafond effectif. L’interface ne qualifie plus l’estimation de « maximum ».
