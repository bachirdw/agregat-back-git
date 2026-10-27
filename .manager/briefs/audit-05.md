# audit-05 — API HTTP, Domain Packs, intégration career-ops côté plateforme
Lis `.manager/briefs/_audit-common.md` et applique-le. Rapport : `.manager/reports/audit-05.md`.
Partie : `apps/api/server.js`, `domain-packs/*` (najah), `packages/career-ops/*` (côté plateforme uniquement),
`scripts/*` (scripts de démarrage, sondes) ; tests `tests/api*.test.js`, `tests/career-*.test.js`, `tests/najah*.test.js`,
`tests/live*.test.js` (sans appel réel), et `rg -l` dans `tests/`.
Plan : MISSION/PLAN (Domain Packs indépendants, Najah avec sources publiques citées, aucun sponsoring déduit sans
source primaire), README, ADR 005 (CGU), ADR 008 (propriétaire), `docs/validation.md`.
**INTERDIT** : modifier la bibliothèque career-ops ou son Skill ; aucun envoi, aucune candidature ; ne touche pas aux
données personnelles de `~/Downloads/agregat-career-ops` (ne les lis pas : CV, profil). Lis seulement les fichiers de
code de la plateforme.
Vérifie en priorité : validation des entrées HTTP, SSE (reprise par curseur), routes career-ops, confinement des
fichiers servis, cohérence API ↔ front (`/Users/diaw/Downloads/agregat-front/src/api.ts`, `types.ts`).
