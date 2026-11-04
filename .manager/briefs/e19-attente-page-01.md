# e19-attente-page-01 — Attendre un texte ou défiler avant une capture (sous-agent Claude Sonnet)

Rédigé par le manager le 04/11/2026 à partir de `.manager/CARTE.md` §B2 et du registre (E19 : offre LinkedIn ouverte dans le Chrome du propriétaire, deux `browser_snapshot` lisibles à 8 s d'intervalle, en-tête présent, description absente ; l'agent n'avait aucun moyen d'attendre un texte ni de défiler). Dépôt `/Users/diaw/Downloads/agregat-back-astra`, branche `suite-astra`. Rapport `.manager/reports/e19-attente-page-01.md`. Commits `[e19-attente-page-01]`, jamais de push. Ne lis aucun `.env`, `secrets.env`, `~/.claude`, `~/.codex`. Aucune restriction de l'agent : on lui donne deux leviers de plus, il choisit.

## Constat (lu dans le code)
- `packages/browser-gateway/cdp.js:157-196` `waitForReadablePage` : `networkidle` 1 s puis absence d'indicateurs de chargement, budget 8 s. Rien n'attend un texte précis, rien ne défile.
- `browser.extract` (`cdp.js:1118-1125`) attend déjà la visibilité du sélecteur demandé (`waitFor({ state: 'visible' })`) ; `browser.snapshot` (`capability-registry/index.js:25-32`) n'accepte que `url`.
- Playwright (`~/Downloads/agent-repos-agregat/microsoft__playwright/packages/playwright-core/src/tools/backend/wait.ts`, `mouse.ts:91`, `find.ts`, Apache-2.0) : attente de texte, de sélecteur, défilement par la souris ; à lire avant d'écrire, copier la forme des outils, pas leur code tel quel.
- Playwriter `waitForPageLoad` filtre `linkedin.com` (voir CARTE §B2) : ne pas s'appuyer dessus.

## À faire, test rouge puis vert à chaque point
1. `packages/capability-registry/index.js` : `browser.snapshot` et `browser.extract` acceptent en plus `waitForText: z.string().trim().min(2).max(200).optional()` (attendre que le texte visible du document contienne cette chaîne, insensible à la casse, jusqu'à 8 s, puis capturer quand même en signalant `waitedFor: { text, found: false }`) et `scroll: z.enum(['bottom', 'page']).optional()` (défiler en bas de page, ou d'une hauteur d'écran, avant d'attendre et de capturer). Descriptions des outils mises à jour en français : « waitForText : attend ce texte avant de capturer ; scroll : fait défiler pour charger la suite ».
2. `packages/browser-gateway/cdp.js` : implémenter dans le fournisseur Chrome (`page.waitForFunction` sur `document.body.innerText`, `page.mouse.wheel` ou `window.scrollBy`), dans le même budget de 8 s que `waitForReadablePage`, et renvoyer `waitedFor` et `scrolled` dans le résultat. Le fournisseur fixture (`FixtureBrowser`) accepte les mêmes paramètres et les reflète dans sa réponse simulée.
3. `packages/orchestrator/browser-proof.js` : une capture obtenue après `waitForText` non trouvé reste « lisible » si du texte existe, mais `compactBrowserEvidence` conserve `waitedFor` pour que le Bilan puisse dire « texte attendu non apparu ».
4. Tests : fixture MCP (`tests/mcp-contract.test.js` : bornes du schéma) ; Chrome réel dans `tests/owner-browser.test.js` sur le modèle du test « extract FICTIF : élément tardif sans indicateur de chargement » (`:982`) : page qui insère un `<p>` après 3 s → `snapshot` avec `waitForText` le contient ; page dont le contenu n'apparaît qu'après défilement (`IntersectionObserver`) → `snapshot` avec `scroll: 'bottom'` le contient ; texte jamais présent → `waitedFor.found === false` et capture rendue en moins de 10 s.
5. `npm test` complet hors bac, `npm run check`, `npm run format:check`. Rapport avec sorties exactes.

## Vérification réelle (manager)
Mission Claude sonnet sur une offre LinkedIn fournie par le propriétaire (lien hors rapport) : l'agent doit pouvoir obtenir la description avec `waitForText` ou `scroll`. Critère de fin : E19 non reproduit sur une offre réelle, ou cause précisément identifiée si le texte n'apparaît toujours pas.

## Hors périmètre
Clic automatique sur « voir plus » (l'agent a déjà `browser.click`) ; rendu différé propre à SEEK ; `browser.download`.
