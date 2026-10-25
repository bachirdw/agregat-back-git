# Relecture complète du code (review-full) — par Codex

Tu relis TOUT le code applicatif (`apps/`, `packages/`, `domain-packs/`, `scripts/`), pas seulement un diff.
Ne fais confiance à aucun rapport : vérifie par la lecture et l'exécution. Rapport
`.manager/reports/review-full.md`, mis à jour après chaque module (la limite d'usage peut couper la session).
Commits `[review-full]`, un par correction, tests verts à chaque commit. Jamais de push, aucun appel modèle
payant, Chrome isolé uniquement.

## À chercher, module par module
- **Bugs** : exceptions non gérées, promesses non attendues, ressources non libérées (processus, sockets,
  fichiers, timers), courses, valeurs nulles/undefined, erreurs avalées silencieusement.
- **Erreurs logiques** : conditions inversées, cas limites (liste vide, 0, doublons, Unicode, très grandes
  entrées), états incohérents (run terminé mais étapes actives, budget compté deux fois), ordres d'opérations,
  statuts mensongers (succès affiché alors que rien n'a été fait, « sponsor » sans preuve).
- **Code mort, duplications, contrats incohérents** entre modules (API ↔ orchestrateur ↔ runtime ↔ gateways).
- **Tests** : tests qui passent sans vérifier ce qu'ils annoncent (assertions faibles, mocks qui court-circuitent
  la logique testée). Signale-les et renforce-les.

## Défaut constaté par le manager (22:45, run réel 79e2d3e7…)
Prompt « va sur youtube cherche cyril hanouna », agent Codex réel (codex-acp 2.2.2, session réelle) :
`run.simulated = false`, mais `result.simulated = true` et l'étape verify indique
`provenance.analysis = "démonstrateur"`. Statut mensonger : une analyse d'un vrai agent est étiquetée
démonstrateur. Trouver la cause (orchestrator/result/verify core), test rouge puis vert.

## Défaut de redirection de chemin (reste ouvert) — tentative du manager 26/10 ~08:20, REVERTÉE
Repro : `node --test .manager/reports/review-full-evidence/redirect-path-repro.mjs`. Approche essayée :
rendre le 3xx même origine à Chrome (`route.fulfill({status, location})`) pour qu'il suive lui-même. La repro
passe, MAIS régression de sécurité prouvée : la requête suivie par Chrome après un 3xx « fulfilled » n'est
**pas** ré-interceptée par `context.route` ; la chaîne `/one` → `/two` → origine interdite atteint le serveur
interdit (`tests/browser-gateway.test.js` « redirections en chaîne restent confinés » : forbiddenHits 1 ≠ 0).
Ne pas réutiliser cette approche. Piste : garder le suivi côté gateway, et pour une navigation du cadre
principal redirigée, annuler puis relancer `page.goto(cibleFinale)` déjà vérifiée par la politique.

## Méthode
`npm test`, `npm run check`, `npm run format:check` au début et à la fin (sorties brutes). Pour chaque défaut :
gravité (critique/majeur/mineur), fichier:ligne, scénario concret, **test qui le démontre (rouge puis vert)**,
correctif ciblé. Ne corrige pas le style. Ne cache aucun échec. Termine par un tableau : défauts trouvés,
corrigés, non corrigés (et pourquoi), tests avant → après.

## Test instable constaté par le manager (26/10 ~08:30)
`tests/live-scripts.test.js` « live-run : même un journal terminal qui ne ferme pas est borné » : 1 échec dans
`npm test` complet (phase parallèle), puis 6/6 vert isolé. Code identique à `f6ec07b` (suite verte). Cause
probable : délai trop court sous charge. Trouver la cause racine (pas juste augmenter le délai), prouver par
exécutions répétées sous charge.
