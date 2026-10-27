# audit-06 — Front (`/Users/diaw/Downloads/agregat-front`) et vérification de l'affichage « conversation »
Lis `.manager/briefs/_audit-common.md` et applique-le. Rapport : `.manager/reports/audit-06.md` (dans agregat-back).
Le code du front est dans `/Users/diaw/Downloads/agregat-front` (React 19 + Vite) : commits dans CE dépôt-là, préfixe
`[audit-06]`, `npm test`, `npm run build`, `npx prettier --check src` avant chaque commit. Lis son `AGENTS.md`.
1. **D'abord** : la demande de l'utilisateur du 27/10 au soir (affichage de conversation « à la Claude Code ») a été
   codée par le manager en 4 commits `[conversation-a…d]` (`32dfe8f`, `bc7ca2f`, `f8a02bf`, `2dde273`), 40 tests verts.
   Cahier des charges exact : `agregat-front/.manager/briefs/conversation.md`. La vérification visuelle est
   **inachevée** : le script `agregat-front/.manager/reports/conversation-evidence/verify.mjs` échoue à sa 1re étape
   (il ne trouve pas la mission dans la barre latérale : `getByText(prompt)` — regarde ce que la barre affiche
   réellement). Répare le SCRIPT (pas l'affichage, sauf défaut réel prouvé), lance-le contre une copie figée du back
   (`git archive HEAD` de agregat-back, `node_modules` lié, `PORT=4321`, sans `.manager/secrets.env`, agents factices)
   et un Vite `AGENT_PLATFORM_API_URL=http://127.0.0.1:4321 npx vite --host 127.0.0.1 --port 5175 --strictPort`.
   Toutes les vérifications OK, captures dans `conversation-evidence/`, puis arrête ces deux serveurs.
   Si une vérification révèle un défaut de l'affichage : test rouge (vitest) → correction → vert.
2. **Ensuite** : audit du front (méthode commune) — plan : `agregat-front/README`, `design/maquette.html`,
   `.manager/briefs/front-01.md` ; cohérence avec l'API du back.
