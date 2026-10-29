# front-anim-07 — reprise de front-anim-06 : la ligne d'outil repliée fait encore 6 662 px dans une colonne de 780 px

Lis `.manager/briefs/_audit-common.md` (Interdits, économie de contexte) puis `.manager/reports/front-anim-06.md`.
Dépôt : `/Users/diaw/Downloads/agregat-front` (`main`) ; rapport : `/Users/diaw/Downloads/agregat-back/.manager/reports/front-anim-07.md`.
Aucun appel Gemini, aucune mission réelle, aucun site réel, aucun push, ne touche ni au Vite 5173 ni au serveur 4310 (tests sur ≥ 4320).
Aucun garde-fou ajouté.

## Contre-mesure du manager (29/10, ~20:45, navigateur réel, front HEAD `bf69b97`, viewport 1550×810, vraie mission career-ops)
`document.scrollingElement.scrollLeft` vaut 0 (le défilement horizontal est bien supprimé), mais le contenu n'est PAS contenu :
- `.thread` : `clientWidth` 780, contenu 1452 px ; `.career-thread`, `.agent-turn`, `.activity`, `.activity-tools` : 1428 px > 732 px.
- Les éléments les plus larges sont `LI`, `DETAILS.fold.tool.completed` et `SUMMARY` d'un appel `career_offer_save` : **6 662 px**,
  `white-space: normal`, `overflow-wrap: normal`. Le texte du résumé est la liste des arguments
  (`fetchedAt: 2026-10-28T03:51:06.949Z, title: Software…, url: https://remotive.com/remote-jobs/soft…`), très long.
- `.scroll-content` a `overflow-x: hidden` : cela cache le symptôme (le fil est rogné), mais la ligne repliée n'est ni tronquée par une
  ellipse ni contenue. La mesure Playwright de front-anim-06 n'a donc pas couvert ce cas : sa fixture n'a pas cette forme
  (`<li><details class="fold tool"><summary>` avec un texte d'arguments de plusieurs milliers de pixels, sans espace).

## À faire (test rouge → vert, un commit `[front-anim-07]` par point)
1. Reproduis d'abord : un test vitest ou Playwright (serveur de test ≥ 4320, mission fixture) avec exactement cette forme DOM et un
   résumé de plusieurs milliers de caractères. Montre-le ROUGE (largeur de `li`, `details`, `summary` > largeur de la colonne).
2. Corrige le CSS : sur la ligne repliée, `summary` et ses enfants ont `min-width: 0; max-width: 100%`, texte des arguments tronqué par
   `text-overflow: ellipsis; white-space: nowrap; overflow: hidden` ; dans le détail déplié `overflow-wrap: anywhere` ; les `li` de
   `.activity-tools` et les `details.fold` ont `min-width: 0` (cause probable : un parent flex/grid qui laisse la largeur intrinsèque).
   Vérifie `.activity`, `.activity-tools`, `.agent-turn`, `.career-thread`, `.thread`.
3. Mesure (Playwright hors bac à sable si besoin, sinon « non vérifié » + commande exacte pour le manager) à 1550×810 ET 375×812 :
   pour chaque élément de `.thread`, `scrollWidth ≤ clientWidth + 1` (hors éléments à `overflow` explicite) ; `scrollLeft` = 0.
4. Avant chaque commit : `npm test`, `npm run build`, `npx prettier --check src`.

Dernier message ≤ 12 lignes : FAIT · COMMITS · PREUVES · RESTE.
