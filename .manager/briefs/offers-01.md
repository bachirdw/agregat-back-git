# offers-01 — E34 : `career_offers` paginé, l'agent peut relire ses fiches

Session cloud, branche `cloud/offers-01` créée depuis `origin/suite-astra`. Test rouge d'abord, puis vert ; un commit `[offers-01]` par point, chemins explicites (jamais `git add -A`, stash ou reset). Aucune règle métier dans le moteur, aucune restriction ajoutée à l'agent, Skill et bibliothèque career-ops intouchés, aucune donnée personnelle. Deux autres sessions tournent en parallèle : `bilan-03` (`truth.js`, `skill-router.js`, manifeste `evaluate`) et `apply-01` (`career_document` dans `packages/career-ops/tools.js`, passerelle navigateur, manifeste `apply`) : dans `tools.js`, ne touche que `career_offers` et ses aides ; ne touche pas `truth.js` ni le manifeste. Rapport horodaté en français dans `.manager/reports/offers-01.md` (lire `date` avant chaque heure), section finale « Pour le manager ».

## À lire d'abord
`packages/career-ops/tools.js` (`career_offers` ~856 et la lecture de `relay/offers/*.json`), `apps/api/server.js` (routes `/api/career/offers`), `docs/api-career-ops.md` (section « Fiches Relay et rapports du Skill »), registre `.manager/reports/registre-erreurs.md` lignes E7, E27, E34, tests `tests/career-offer-contract.test.js`, `tests/career-integration.test.js`, `tests/offers-reports-legacy.test.js`.

## Point 1 — E34 : borne et pagination
Constaté (05b34578, 05/11 12:18) : `career_offers` sans argument rend 143 693 caractères, refusés par l'adaptateur Claude (« exceeds maximum allowed tokens ») ; l'agent n'a pas pu relire ses fiches. Attendu : par défaut une **page résumée** (identifiant, titre, entreprise, note, statut, date, une ligne par fiche, les plus récentes d'abord, 20 au plus), arguments `offset`/`limit` bornés, `id` ou `ids` pour une fiche complète, `query` simple (sous-chaîne sur titre/entreprise) ; la réponse dit `total`, `offset`, `next` ; aucune réponse au-delà d'une borne de caractères documentée (même famille qu'E7/E27, réutiliser la borne existante si une aide commune existe). La route `/api/career/offers` garde son comportement pour le front (ou pagine de la même façon si elle n'a pas de borne : dire lequel). Tests : 300 fiches fictives → appel sans argument sous la borne, `next` juste, fiche complète par `id`, `query` filtre.

## Point 2 — Documentation
`docs/api-career-ops.md` : arguments et bornes de `career_offers`, exemple de réponse paginée. Description de l'outil (côté MCP) mise à jour pour que l'agent sache paginer.

## Point 3
`npm run check`, `npm run format:check`, tests ciblés verts, `npm test` si possible (deux tests ACP Codex/Gemini échouent dans le cloud faute des binaires : connu ; tests Chrome non exécutables dans le cloud). Rapport, commits, push de `cloud/offers-01` seulement.
