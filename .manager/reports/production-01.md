# production-01 — CV adapté et lettre produits par la chaîne du Skill

Session cloud, branche `cloud/production-01` depuis `origin/suite-astra` (465ebee). Skill lu en lecture seule
dans un clone temporaire `career-ops-hq/career-ops` @ `35b7c531` (hors dépôt). Données FICTIVES
uniquement (`example.test`), aucun secret, aucun fichier du Skill modifié.

## Journal

- 00:30 Branche créée. Lecture du brief, d'`AGENTS.md`, de `skill-suivi-01` (brief + rapport), de l'audit
  (`02-relay-vs-skill.md` Q1 « pdf »/« cover », Q6 point 5).
- 00:32 Clone du Skill au commit demandé. Lecture de `modes/pdf.md` (étapes 17a–23, « Selecting the
  template », payload JSON, `mark-pdf-ready` en fin de mode), `modes/cover.md` (étape 9, payload,
  `output/{company-slug}-{role-slug}-cover.pdf`), `modes/auto-pipeline.md` (Step 3 PDF entre le rapport et le
  suivi), `DATA_CONTRACT.md` (`data/pdf-index.tsv` écrit par `generate-pdf.mjs`, `output/*`), en-têtes et
  analyse d'arguments des sept scripts (`build-cv-html`, `verify-cv-facts`, `verify-cv-structure`,
  `generate-pdf`, `generate-cover-letter`, `mark-pdf-ready`, `cv-templates`).
- 00:34 Lecture de Relay : `tools.js` (SKILL_ENTRIES, contrôles isolés, `career_write`), `truth.js`,
  `skill-router.js`, manifestes, passerelle (`gatewayProgress` → `apps/api/server.js` → `recordGatewayTool`),
  tests `career-skill-scripts`, `career-skill-suivi`, `career-integration` (fixture Skill), `skill-router`.
- 00:35 **Refus de la session** : lancer les scripts réels du Skill (code externe cloné), même dans un dossier
  FICTIF avec `CAREER_OPS_ROOT` temporaire, est refusé par le classificateur de la session cloud
  (« Code from External »). Je ne contourne pas : ici, contrat d'appel seulement ; un test d'exécution réelle,
  conditionné à une variable d'environnement, est laissé au manager (point 5).

## Grammaires relevées dans les scripts (lecture, non exécutées)

| Script | Forme admise par le script | Retenu pour `career_script` | Exclu |
|---|---|---|---|
| `build-cv-html.mjs` | `<in.json> <out.html> [template]`, `--preview <in.json> [template]`, `<in.json> --markdown <out.md> [template]`, `--test` | les trois formes de rendu ; fichiers sous `output/`, modèle sous `templates/` ou `data/templates/` (chemin relatif ou absolu dans l'espace, tel que `cv-templates resolve` l'imprime) | `--test` (auto-test) |
| `verify-cv-facts.mjs` | `<doc> [--source p]… [--config p] [--json]`, `--self-test` | `<output/*.html|md> [--json]`, isolé (lecture seule, sans réseau) | `--source`, `--config` (une source choisie par l'agent pourrait être le document lui-même ; `cover.md` : « The rendered letter is not a source »), `--self-test` |
| `verify-cv-structure.mjs` | `<payload.json> [--source cv.md]`, `--self-test` | `<output/*.json>`, isolé | `--source`, `--self-test` |
| `generate-pdf.mjs` | `<in.html> <out.pdf> [--format=letter|a4] [--country=XX] [--report=NNN] [--kind=cv|cover] [--allow-reorder] [--allow-nonchronological] [--max-pages=N] [--strict-pages] [--skip-fact-check]`, `--batch=` | tout sauf exclusions ; drapeaux à valeur en forme `--x=y` (seule forme que le script lit sans erreur d'opérande) | `--skip-fact-check` (désactive la porte des faits), `--batch=` (manifeste externe au parcours) |
| `generate-cover-letter.mjs` | `--payload p [--out p] [--format f] [--country XX] [--report NNN]` | tout ; `--payload` obligatoire ; fichiers sous `output/` | — |
| `mark-pdf-ready.mjs` | `<report#> [--dry-run] [--json]` | tout | — |
| `cv-templates.mjs` | `<list|resolve|lint> <cv|cover> [name] [--format=html|tex] [--fallback]` | tout, isolé | — |

## Point 1 — Liste blanche `career_script` (chaîne CV/lettre)

- 00:39 Rouge constaté, `tests/career-skill-scripts.test.js` (3 tests ajoutés + MCP étendu) : `ℹ pass 4 / ℹ fail 4`,
  ligne : `Commande career-ops non autorisée : … ou un script du Skill (reserve-report-num, …, check-liveness)`.
  (`npm ci` d'abord : `node_modules` absent du conteneur.)
- 00:41 `packages/career-ops/tools.js` : 7 entrées ajoutées à `SKILL_ENTRIES` (`build-cv-html`, `verify-cv-facts`,
  `verify-cv-structure`, `generate-pdf`, `generate-cover-letter`, `mark-pdf-ready`, `cv-templates`), grammaires
  du tableau ci-dessus. La grammaire gagne trois formes génériques : `assigns` (`--x=y`, forme que `generate-pdf`
  et `cv-templates` lisent), `requiredFlags` (`--payload`), `custom` (les trois formes de rendu de
  `build-cv-html`). Fichiers confinés à `output/` (sous-dossiers admis, aucun segment `..` ni `.x`) ; modèle sous
  `templates/` ou `data/templates/`, relatif ou absolu dans l'espace (sortie de `cv-templates resolve`).
  `verify-cv-facts`, `verify-cv-structure`, `cv-templates` tournent isolés comme les contrôles existants
  (`--permission` lecture seule sur l'espace, préchargement sans réseau) ; `build-cv-html`, `generate-pdf`,
  `generate-cover-letter`, `mark-pdf-ready` écrivent dans l'espace et tournent comme `scan`.
  `verify-cv-facts` garde sa forme « contrôle » (`path`, `--json` ajouté par Relay) ; la forme Skill répond à `args`.
  Description MCP de `career_script` complétée (exemples d'appel).
- 00:43 Vert : `career-skill-scripts` 8/8 ; non-régression `career-integration`, `doubt-tools`,
  `astra-source-review`, `career-script-help`, `mcp-contract` : 71/73, les 2 échecs sont
  « Agent non détecté sur cette machine » (CLI Codex absent du conteneur cloud, indépendant du chantier).
  `npm run check` et `npm run format:check` verts.
- Vérifié : admission/refus par grammaire (faux scripts), isolation réseau/écriture des trois contrôles,
  exécution non isolée de `build-cv-html` (il écrit son HTML), reçu de revue exigé. **Non vérifié** : les vrais
  scripts (refus de la session, voir 00:35) ; en particulier `verify-cv-facts.mjs` réel sous `--permission`
  (il importe `path-resolver.mjs`, qui sonde `~/.claude/plugins` : `realpathSync` refusé est attrapé par le
  script, `existsSync` répond faux ; à constater en réel).
- Écarts déclarés : `--source`/`--config` de `verify-cv-facts`, `--source` de `verify-cv-structure` exclus
  (une source choisie par l'agent pourrait être le document contrôlé) ; `--skip-fact-check` et `--batch=` de
  `generate-pdf` exclus ; `--test`/`--self-test` exclus. Les valeurs à drapeau de `generate-pdf` ne sont
  admises qu'en forme `--x=y` (le script traite `--report` seul comme opérande manquant).

## Point 2 — Chemins de `career_write`

- 00:44 Rouge constaté, `tests/career-skill-production.test.js` (nouveau, 2 tests) : `ℹ pass 0 / ℹ fail 2`,
  lignes : `Fichier hors du périmètre career-ops` (HTML sous `output/` refusé) et `Missing expected exception.`
  (`data/pdf-index.tsv` écrit directement).
- `tools.js` : `output/**/*.html` écrivable (HTML construit par `build-cv-html`, corrigé par l'agent quand
  `verify-cv-facts` refuse un fait, `pdf.md` étape 19), sous-dossiers de bundle admis
  (`output/applications/042/cv/tailored/v001/cv.html`). `output/*.json` l'était déjà (payload CV, payload de
  lettre : Relay confine à `output/` ce que `pdf.md`/`cover.md` placent dans `/tmp`). Interdits gardés :
  `data/applications.md` (message merge-tracker/set-status) ; ajouté : `data/pdf-index.tsv` refusé à
  l'écriture directe (DATA_CONTRACT.md : écrit par `generate-pdf.mjs --report`), message vers `generate-pdf` et
  `mark-pdf-ready`. Lecture inchangée.
- 00:45 Vert : 2/2 ; sous-ensemble career (7 fichiers) 81/83, mêmes 2 échecs « Agent non détecté ».
  `check` et `format:check` verts.
- Écart déclaré : **`drafts/` n'est pas ouvert** : le Skill écrit la lettre sous `output/{company-slug}-{role-slug}-cover.pdf`
  (`cover.md` étape 9) et son payload dans `/tmp` ; `drafts/` est en outre le dossier des brouillons d'e-mail de
  Relay (`career_drafts`, schéma `emailSchema`), une écriture libre y casserait la liste des brouillons. Le PDF
  lui-même n'est pas écrivable par `career_write` (binaire produit par `generate-pdf`/`generate-cover-letter`).

