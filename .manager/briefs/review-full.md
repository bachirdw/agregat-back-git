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

## Méthode
`npm test`, `npm run check`, `npm run format:check` au début et à la fin (sorties brutes). Pour chaque défaut :
gravité (critique/majeur/mineur), fichier:ligne, scénario concret, **test qui le démontre (rouge puis vert)**,
correctif ciblé. Ne corrige pas le style. Ne cache aucun échec. Termine par un tableau : défauts trouvés,
corrigés, non corrigés (et pourquoi), tests avant → après.
