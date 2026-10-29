# front-anim-06 — finir le point 10 (débordement horizontal) et afficher l'avertissement « Chrome isolé »

Lis `.manager/briefs/_audit-common.md` (Interdits, économie de contexte) puis `.manager/reports/front-anim-05.md` (point 10) et
`.manager/reports/fix-browser-01.md`. Travaille dans `/Users/diaw/Downloads/agregat-front` (branche `main`) ; le rapport va dans
`/Users/diaw/Downloads/agregat-back/.manager/reports/front-anim-06.md`. Aucun appel Gemini, aucune mission réelle, aucun site réel,
aucun push, ne touche ni au Vite 5173 de l'utilisateur ni au serveur 4310 (serveurs de test ≥ 4320 seulement). Aucun garde-fou ajouté.

## État de départ
Le dépôt front contient des changements NON commités d'une session Codex interrompue : `src/style.css` (+25) et
`src/front-anim.test.tsx` (+8) pour le point 10. Relis-les d'abord : garde ce qui est bon, jette le reste, ne présume rien. Montre le test
ROUGE avant la correction (revenir sur le dernier commit pour le prouver), puis VERT.

## À faire (un commit `[front-anim-06]` par point, test rouge → vert)
1. **Plus aucun débordement horizontal** : lignes d'outils très longues (5 000 caractères sans espace) tronquées par une ellipse sur leur
   ligne repliée, `overflow-wrap: anywhere` dans le détail déplié, Markdown / `pre` / `code` contenus dans la colonne ;
   `document.scrollingElement.scrollLeft` égal à 0 et `scrollWidth ≤ clientWidth` pour `.main`, `.scroll-content`, `html`, `body`.
   Tests vitest (géométrie simulée) puis mesure Playwright à 1550×810 et 375×812 sur un serveur de test ≥ 4320 avec une mission fixture
   (si Chrome avorte dans le bac à sable, escalade ciblée ; sinon écris « non vérifié » et la commande exacte pour le manager).
2. **Avertissement de repli** : le back émet désormais un événement `browser_fallback` (voir `fix-browser-01`) et ajoute une ligne
   « Navigateur : Chrome isolé, non connecté à vos comptes… » au résumé final. Affiche l'événement dans le fil de la mission comme un
   avertissement discret (même style que l'avertissement `agent_silent`), une seule fois par mission. Test vitest rouge → vert.
3. Avant chaque commit : `npm test`, `npm run build`, `npx prettier --check src`.

## Rapport au fil de l'eau (heures par `date +%H:%M`), preuves en `front-anim-06-evidence/`, « non vérifié » explicite.
Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
