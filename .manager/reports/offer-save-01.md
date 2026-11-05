# offer-save-01 — `career_offer_save` n'écrit plus dans `reports/` ; aucune écriture de démo ou de test dans l'espace réel

Session cloud (Claude), branche `cloud/offer-save-01` depuis `origin/suite-astra` (0472f90).
Données FICTIVES uniquement (fixtures temporaires). Aucun espace career-ops réel ouvert, aucun secret lu.
Heures lues par `date` (horloge de la machine cloud, UTC).

## Journal

- 02:35 Brief `offer-save-01.md` lu. Le dépôt cloné était sur `main` (92048a8), une validation derrière `suite-astra` : branche `cloud/offer-save-01` créée depuis `origin/suite-astra` comme demandé. `npm ci` fait (Node v22.23.4, le projet demande ≥ 24 ; les tests tournent).
- 02:37 **Point 1, test rouge.** `tests/career-offer-contract.test.js` : l'assertion existante (`reports/<id>.md` existe) est remplacée par `relay/offers/<id>.md` existe et `reports/` est absent ; nouveau test « n'écrit jamais dans reports/ » (un `reports/007-…md` du Skill préexistant ; après deux `career_offer_save`, `reports/` est identique, `relay/offers/<id>.json` existe, `career_offers` liste les deux). Résultat : 2 échecs sur 12.
- 02:38 **Point 1, code.** `packages/career-ops/tools.js` (`saveOffer`) : la fiche Markdown va à `relay/offers/<id>.md` au lieu de `reports/<id>.md`. Test vert : 12/12. Commits `304b597` puis `ff9c67c` (prettier du test).
- 02:40 `career-*.test.js` : 157 verts, 2 rouges. Les 2 rouges (« Agent explicite compatible ACP… » et « une configuration Gemini modifiée… ») échouent **à l'identique sans mes changements** (vérifié par `git stash`) : préexistants, propres à l'environnement cloud.
- 02:41 **Point 2, tests rouges.** `tests/career-workspace.test.js` : `new CareerWorkspace()` en contexte de test → erreur ; `AGENT_PLATFORM_CAREER_WORKSPACE` refusé ; `root = DEFAULT_WORKSPACE` refusé ; `createApp()` sans espace n'ouvre rien de réel. `tests/career-integration.test.js` : nouvelle mission `simulated` avec un espace marqué « réel » → doit tourner dans `<dossier des espaces>/<id>`, l'espace n'est pas modifié, le résultat privé reste servi. Rouge confirmé.
- 02:44 **Point 2, code.**
  - `packages/career-ops/workspace.js` : `inTestContext()` (`NODE_TEST_CONTEXT` ou `NODE_ENV=test`) ; le constructeur lève une erreur claire sans `root` explicite, refuse la variable d'environnement et l'espace par défaut passé en `root` ; propriété `real` (vraie quand la racine ne vient pas de l'appelant) ; `copyInputs()` (copie `cv.md` et les pièces jointes) ; `defaultCareerWorkspace()` (hors test = `new CareerWorkspace()` comme avant ; en test = un dossier inexistant sous `tmpdir`, d'où « Espace career-ops introuvable » à l'usage et rien d'écrit).
  - `packages/orchestrator/index.js` et `apps/api/server.js` : le défaut `new CareerWorkspace()` devient `defaultCareerWorkspace()` ; `Orchestrator.create` donne à une mission `simulated` (ou `dataMode: fixture`) sur un espace `real` le dossier `workspacesRoot(dataDir)/<id>` au lieu de l'espace du propriétaire ; `careerOf(run)` retourne l'espace propre de la mission pour `RELAY_CAREER_WORKSPACE`, `relay/runs/*-input.json`, et les routes `/api/career/runs/:id/result|input`.
  - Première tentative de test en échec : l'agent fictif lisait `cv.md` et la pièce jointe, restés dans l'espace du propriétaire ; d'où `copyInputs`. Une assertion de mon test était fausse (`relay/` existait déjà, créé par `reviewCareer`) ; corrigée en `relay/runs`, `relay/offers`, `reports` absents.
  - `career-workspace` + `career-integration` : tout vert sauf les 2 préexistants. Les 52 fichiers de test qui touchent `createApp`/`Orchestrator`/`CareerWorkspace`/career-ops (hors Chrome) : 494 verts, 2 rouges (les mêmes). Commit `202fac4`.
- 02:46 **Point 3.** `.manager/outils/offers-reports-legacy.mjs` : lecture seule par défaut, `--root`, `--apply` déplace sans jamais supprimer (tout est vérifié avant le premier déplacement ; destination occupée = annulation). Identifiant synthétique = groupe d'un seul caractère répété (`22222222`), deux groupes identiques, ou suite de six chiffres hexadécimaux consécutifs (`123456…`). `reports/<uuid>.md` ordinaire → `relay/offers/<uuid>.md` ; synthétique → `relay/legacy/…` (non relu par Relay). Aucun contenu de fiche affiché. `tests/offers-reports-legacy.test.js` : 5 tests (rouge = module absent, vérifié en le déplaçant ; puis vert). `docs/api-career-ops.md` : section « Fiches Relay et rapports du Skill : deux dossiers » (+ phrase corrigée dans « Offres et résultats »). Commit `25173d9`.
- 02:48 `npm run check` : « Syntaxe JavaScript valide ». `npm run format:check` : vert. Tests ciblés (`offers-reports-legacy`, `career-offer-contract`, `career-workspace`) : 25/25.

## Pour le manager

**Vérifié réellement (relancé ici) :**
- Après `career_offer_save` (avec et sans rapport), `reports/` est inchangé, `relay/offers/<id>.json` existe, `career_offers` le liste ; le `.md` va sous `relay/offers/`.
- `new CareerWorkspace()` en contexte de test échoue ; la variable `AGENT_PLATFORM_CAREER_WORKSPACE` et `~/Downloads/agregat-career-ops` en `root` sont refusés ; `createApp()` sans espace n'ouvre rien.
- Une mission `simulated` sur un espace marqué `real` tourne dans `<dossier des espaces>/<id>`, l'espace d'origine reste identique et le résultat privé est servi par l'API.
- Le script de listing ne modifie rien sans `--apply` (test en ligne de commande) et son déplacement fonctionne sur une fixture temporaire.
- `npm run check`, `npm run format:check`, tests ciblés et 52 fichiers de test voisins : verts, hors les 2 échecs préexistants ci-dessous.

**Non vérifié :**
- La suite complète (`npm test`) et les tests Chrome : non lancés, comme demandé. À lancer en local.
- Le comportement sur une vraie machine : sans contexte de test, `defaultCareerWorkspace()` reste `new CareerWorkspace()` ; le chemin « simulé → dossier temporaire » est prouvé par un test avec `career.real = true` posé à la main (un test ne peut pas construire un espace réel), pas avec un vrai espace.
- Le front : non touché ; il lit toujours `/api/career/offers`. Les fiches `.md` déplacées ne sont lues par aucune route.
- Node v22 au lieu de ≥ 24.
- 2 tests rouges **préexistants** (identiques sans mes changements) : « Agent explicite compatible ACP : career-ops conserve Codex sans imposer de clé Gemini » et « Career Ops : une configuration Gemini modifiée ne bloque pas Codex, mais bloque Gemini » (`career-providers`/`career-integration`). Non analysés.
- La détection « synthétique » est heuristique (groupe répété/identique, suite de six). Sur l'espace réel du propriétaire, relire la liste avant tout `--apply`.

**Écarts et choix à connaître :**
- Branche : la consigne de la session désignait aussi `claude/lucid-wozniak-faex3t` ; j'ai suivi le brief et la demande (`cloud/offer-save-01`, depuis `origin/suite-astra`).
- Une mission simulée reçoit, dans son dossier temporaire, une **copie de `cv.md` et des pièces jointes** du propriétaire (l'agent fictif les lit). C'est une lecture de l'espace réel et une écriture dans `.data/workspaces/<id>` (non versionné). À arbitrer si le propriétaire préfère un CV fictif.
- Le garde de test vise le constructeur ; les défauts de `createApp` et `Orchestrator` sont devenus paresseux (dossier inexistant en test), sinon une vingtaine de fichiers de test qui n'ont pas d'espace career-ops auraient échoué à la construction.
- Le brief dit de ne jamais exécuter `--apply` : le script n'a jamais été lancé avec `--apply` ; seules ses fonctions `apply`/`moves` sont appelées par un test sur une fixture temporaire.
- Test rouge du point 3 écrit après le script, puis rouge vérifié en retirant le module.
- Aucune règle métier ajoutée à l'orchestrateur au-delà de la racine d'un espace simulé ; aucune restriction ajoutée à l'agent.
