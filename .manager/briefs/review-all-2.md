# review-all-2 — Relecture ciblée (partie 2/3) — par Codex

Suite de la relecture complète demandée par l'utilisateur (voir `.manager/reports/review-all.md`, déjà un
défaut majeur corrigé : `6864216`). Périmètre de CETTE session uniquement : packages/agent-runtime/*, packages/orchestrator/*, packages/workflow-engine/*, packages/storage/*, packages/billing/* (exécution, états, reprise, ledger).
Ne relis pas le reste. Rapport `.manager/reports/review-all-2.md` (court : constats, fichier:ligne,
preuves en fichiers dans `.manager/reports/review-all-2-evidence/`). Commits `[review-all-2]`, un par
correction, tests verts. Jamais de push, aucun appel modèle payant, Chrome isolé uniquement. Tests Chrome hors
bac à sable (escalade) ; sinon dis-le.

Cherche ce qui est faux ou ILLOGIQUE : conditions inversées, ordres d'opérations, cas limites (vide, 0,
doublons, Unicode, grandes entrées, null), états incohérents, statuts mensongers (réel/simulé, succès sans
effet), ressources non libérées, courses, erreurs avalées, contrats incohérents entre modules, tests qui ne
prouvent pas ce qu'ils annoncent. Pour chaque défaut : gravité, scénario, test rouge puis vert, correctif.
Pas de style. Fin : tableau trouvés / corrigés / non corrigés (pourquoi), suite complète (résumé).
