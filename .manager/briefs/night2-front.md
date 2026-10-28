# night2-front — revue complète du front (`/Users/diaw/Downloads/agregat-front`)

Lis `.manager/briefs/_audit-common.md`. Périmètre : tout `src/`, `tests/e2e.test.mjs`, `style.css`, `vite.config.ts`.
Cherche : états d'erreur non affichés, requêtes sans gestion d'échec ou d'annulation (SSE qui se rouvre en boucle, fuites
d'écouteurs), conditions de course entre missions, accessibilité clavier/focus, texte coupé ou chevauchant à 375 px et 1550 px,
thème sombre, `prefers-reduced-motion`, tests qui ne pourraient pas échouer. Corrige les défauts certains avec test rouge → vert,
commit `[night2-front]` dans le dépôt front (jamais de push). Avant chaque commit : `npm test`, `npm run build`, `npx prettier --check src`.
Ne touche pas au Vite 5173 de l'utilisateur ; mesures navigateur sur serveur de test ≥ 4320. Rapport :
`.manager/reports/night2-front.md` (dans le dépôt back).
