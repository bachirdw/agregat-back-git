# Sprint 09 — Finitions backend (par Codex)

Contexte : lis `.manager/HANDOFF.md` (état, décisions, pièges). Rapport `.manager/reports/sprint-09.md`, mis à
jour **après chaque point** (la limite d'usage peut couper la session). Commits locaux `[sprint-09]`, un par
point, tests verts à chaque commit. Jamais de push. Aucun appel modèle payant.

## Transparence (non négociable)
Pour chaque point : commandes exécutées, sorties brutes pertinentes (tests réussis ET échoués), erreurs,
corrections, ce qui reste incomplet. Statut explicite : OPÉRATIONNEL (prouvé par test), SIMULÉ, INCOMPLET, PRÉVU.
Ne masque aucun échec, ne déclare rien fonctionnel sans test.

## Points (dans l'ordre ; passe au suivant si bloqué, en documentant le blocage)
0. Début : `npm test`, `npm run check`, `npm run format:check` — résultats bruts dans le rapport.
   Constat du manager (17:27) : suite Chrome 37/37 verte, `check` vert, mais `format:check` ÉCHOUE sur
   `apps/api/server.js` et `tests/web-dir.test.js` → `prettier --write` sur ces 2 fichiers, relire le diff.
1. `run-sprint.sh` déjà commité (41735e8). Ajouter `exports/` au `.gitignore` (zips générés).
2. Navigateur : review-night a désactivé JavaScript et les contextes partagés. En faire des **options de
   RunPolicy explicites**, désactivées par défaut, activables uniquement avec un consentement enregistré
   (approbation humaine imposée par la gateway, pas par prompt). Tests : refus par défaut, refus sans
   consentement, acceptation avec consentement, consentement non réutilisable par un autre run. ADR 006 à jour.
3. Test Chrome instable « champ mot de passe » (`tests/browser-gateway.test.js`) : cause racine (ressource non
   libérée, attente sans délai, port partagé…). Reproduire sous charge (exécutions répétées / parallèles),
   corriger, prouver par N exécutions consécutives vertes (donner N et les sorties).
4. `.manager/reports/FINAL.md` : compléter § 7 avec review-night (voir `.manager/reports/review-night.md`) et
   ce sprint ; décompte de tests réel issu de ta dernière exécution. Tableau OPÉRATIONNEL / SIMULÉ /
   INCOMPLET / PRÉVU pour les 10 points du MVP, chacun avec la preuve (test ou commande).
5. README : vérifier que chaque commande de démarrage fonctionne réellement (exécute-les, colle les sorties).

## Fin
`npm test && npm run check && npm run format:check` verts (sorties brutes), liste des commits, points non
terminés et pourquoi.
