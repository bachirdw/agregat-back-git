# review-all-3 — Relecture ciblée (partie 3/3) — par Codex

Suite de la relecture complète demandée par l'utilisateur (voir `.manager/reports/review-all.md`, déjà un
défaut majeur corrigé : `6864216`). Périmètre de CETTE session uniquement : packages/skill-registry/*, packages/data-gateway/*, domain-packs/*, apps/web/*, apps/companion/*, scripts/*.js (Skills, Najah, interface, scripts).
Ne relis pas le reste. Rapport `.manager/reports/review-all-3.md` (court : constats, fichier:ligne,
preuves en fichiers dans `.manager/reports/review-all-3-evidence/`). Commits `[review-all-3]`, un par
correction, tests verts. Jamais de push, aucun appel modèle payant, Chrome isolé uniquement. Tests Chrome hors
bac à sable (escalade) ; sinon dis-le.

Cherche ce qui est faux ou ILLOGIQUE : conditions inversées, ordres d'opérations, cas limites (vide, 0,
doublons, Unicode, grandes entrées, null), états incohérents, statuts mensongers (réel/simulé, succès sans
effet), ressources non libérées, courses, erreurs avalées, contrats incohérents entre modules, tests qui ne
prouvent pas ce qu'ils annoncent. Pour chaque défaut : gravité, scénario, test rouge puis vert, correctif.
Pas de style. Fin : tableau trouvés / corrigés / non corrigés (pourquoi), suite complète (résumé).
