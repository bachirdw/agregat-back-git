# Relecture complète de TOUT le code (review-all) — par Codex

Demande de l'utilisateur : relire tout le code et trouver ce qui est faux ou **illogique**. Tu n'as pas à
faire confiance aux rapports ni aux commits précédents (y compris ceux du manager). Rapport
`.manager/reports/review-all.md`, mis à jour après chaque module (la limite d'usage peut couper). Commits
`[review-all]`, un par correction, tests verts à chaque commit. Jamais de push, aucun appel modèle payant,
Chrome isolé uniquement (jamais le Chrome de l'utilisateur).

## Contexte
- `review-full` a déjà corrigé plusieurs défauts (voir `.manager/reports/review-full.md`) : ne refais pas,
  mais vérifie que ces correctifs sont justes.
- **Jamais relus indépendamment** (priorité 1) : mode propriétaire (`51d111f` : `owner-transport.js`,
  `cdp.js`, `orchestrator`, `policy-engine`, `apps/api/server.js`, workflow `browser-agent`) et correctifs du
  manager ce matin : redirection de chemin (`a299199`, `cdp.js` goto/redirectedTo), délai du journal
  live-run (`de817db`).
- Ton bac à sable empêche Chrome de démarrer (SIGABRT/EPERM) : exécute les tests navigateur hors bac à sable
  (escalade) ; si impossible, dis-le et distingue clairement ce qui n'a pas pu être exécuté.

## Méthode, module par module (apps/, packages/*, domain-packs/*, scripts/)
Cherche : erreurs logiques (conditions inversées, ordres d'opérations, cas limites : vide, 0, doublons,
Unicode, très grandes entrées, valeurs nulles), états incohérents, statuts mensongers (réussi alors que rien
n'a été fait, réel/simulé mal étiqueté), ressources non libérées, courses, erreurs avalées, code mort,
contrats incohérents entre modules, tests qui ne vérifient pas ce qu'ils annoncent.
Pour chaque défaut : gravité, fichier:ligne, scénario concret, **test rouge puis vert**, correctif ciblé.
Ne corrige pas le style.

## Fin
`npm test`, `npm run check`, `npm run format:check` au début et à la fin (sorties brutes). Tableau final :
module relu (oui/partiel), défauts trouvés / corrigés / non corrigés (pourquoi), tests avant → après.
