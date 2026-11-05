# sources-01 — rapport (11:20)

## Journal
- 11:12 Lecture du brief, de tools.js (liste de 6 fournisseurs en dur, ~l.458) ; `scripts.js` n'existe pas (rien à y toucher).
- 11:14 Points 1-2 : `packages/career-ops/providers.js` (`listSkillProviders(root)`, cache par processus, `validatePortalsConfig`, `assertCareersHost`) ; tools.js l'appelle. Commit d9a8c72 (points 1 et 2 ensemble : le code est indissociable).
  - Rouge constaté : avec l'ancien bloc de validation, 5 tests sur 8 de `tests/career-providers.test.js` échouent ; vert : 8/8.
- Point 3 : `skill-manifest.yaml` sans `fallbackTools`/`fallbackWhen`, note alignée sur modes/scan.md (API, scan_query, skipped_error) ; `manifest.yaml` : titre de l'étape jobs_search_live adouci. Commit 572120b. Rouge constaté : ancien manifeste = 3 échecs dans doubt-tools ; vert 16/16.
  - Tests adaptés (dit explicitement) dans `tests/doubt-tools.test.js` : texte figé du rôle, assertion sur `fallbackTools` (désormais absent), et les rejets de schéma utilisent un rôle construit avec secours (le schéma garde ses règles).
  - Erreur en route : première note YAML avec « : » non quotée (YAMLParseError), corrigée en la quotant.
- Point 4 : test des variables non transmises (même fichier). Pas de rouge possible : l'environnement des scripts est déjà une liste blanche (`buildChildEnv`) ; le test verrouille ce comportement. Doc `docs/api-career-ops.md` (contrôle de portals.yml + section Apify désactivé).

## Vérifications
- Ciblés : career-*, skill-router, doubt-tools, pack-effects : 176 tests, 0 échec. `npm run check` et `npm run format:check` verts. Suite complète non lancée (manager).

## Limites
- Les fournisseurs sont lus dans `<racine career-ops>/providers` (l'espace revu, dont l'empreinte est contrôlée par le reçu), pas directement dans le clone. Les tests utilisent des fichiers vides FICTIFS ; le vrai clone n'a pas été lu par le code.
- Nom du fournisseur = nom de fichier (comme demandé) ; le Skill utilise `id` du module, normalement identique : non vérifié pour les ~75 fichiers.
- Contrôle d'hôte syntaxique, sans DNS (un nom public résolvant en privé n'est pas détecté ici ; le Skill a ses propres gardes `_ip-guard`).
- `tools.js`, `jobs_search_live` (description MCP) et le titre d'étape du workflow gardent le mot « secours » (non modifiés au-delà du titre).
