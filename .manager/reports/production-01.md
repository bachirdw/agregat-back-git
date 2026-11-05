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

## Point 3 — Manifeste

- 00:46 Rouge constaté, `tests/skill-router.test.js` (3 tests ajoutés, 2 attentes mises à jour) :
  `ℹ pass 28 / ℹ fail 5`, première ligne : `✖ Évaluation FICTIVE : ordre du Skill déclaré par le manifeste`.
- `skill-manifest.yaml`, intention `evaluate` : `read-offer → liveness → reserve → report → cv-build → cv-verify →
  cv-pdf → tsv → track → save-evaluation` : les trois étapes CV suivent `modes/auto-pipeline.md` (Step 3, PDF
  entre le rapport et le suivi) et sont **facultatives** (le mode `oferta` n'a pas de PDF automatique) ;
  `cv-pdf` porte `proves: CV produit` ; `tsv` dit « pdf ✅ si PDF produit sinon ❌ ».
  Intention `documents` réécrite : `payload` (`career_write output/`, table JSON de `pdf.md`) → `cv-structure`
  (facultatif, 17b) → `cv-build` (18) → `cv-verify` (19, « code zéro ; non nul = fait absent du CV source,
  corriger le HTML, jamais cv.md ») → `cv-pdf` (21, `--report={###}`, `proves: CV produit`) → `pdf-ready`
  (`mark-pdf-ready`, facultatif, fin du mode pdf) → `cover` (`generate-cover-letter`, `cover.md` étape 9,
  facultatif, `proves: lettre produite`). `career_document` retiré de l'intention (reste un outil MCP, pièce
  jointe pour `email_send`). Phrases ajoutées : « adapte mon cv », « cv adapté », « lettre de motivation »,
  « mode pdf », « mode cover », « génère le pdf ». `unlessPhrases` sur les étapes CV (« lettre seule », « sans cv »).
  Aucune étape `required` : information au Bilan, pas de blocage. Toute la chaîne `persists` : « n'enregistre
  rien » ne laisse aucune étape (premier essai avec `cv-verify` non persistant : 2 rouges, corrigé).
  `manifest.yaml` : étape descriptive « Produire le CV adapté par le Skill… » après `merge-tracker`.
- `skill-router.js` **non touché** : les champs génériques existants (`proves`, `persists`, `unlessPhrases`,
  `optional`) suffisent.
- 00:48 Vert : `skill-router` 33/33 ; sous-ensemble (11 fichiers : `career-integration`, `tool-watchdog`,
  `doubt-tools`, `pack-effects`, `note-sans-lecture`, `bilan-vs-events`, `mcp-contract`, `career-skill-suivi`,
  `career-truth`, `skill-registry`) 150/152, mêmes 2 « Agent non détecté ». `check`/`format:check` verts.
- Écarts : rôles d'outils (`toolRoles`) inchangés (figés par `doubt-tools.test.js`, comme au chantier
  précédent) ; pas de rôle « produire le CV ». Dans `evaluate`, la chaîne CV est facultative : un agent en mode
  oferta la verra « ignorée », pas « non exécutée ».

## Point 4 — Bilan (`truth.js`)

- 00:49 Rouge constaté, `tests/career-skill-production.test.js` (6 tests ajoutés) : `ℹ fail 1` sur le fichier
  entier (`SyntaxError: … does not provide an export named 'factsUnsourced'`).
- `truth.js` : critères `CV produit` et `lettre produite` lus dans le manifeste (`proves`, même mécanisme
  `proved()` que « évaluation enregistrée »). Lignes du Bilan : « CV du Skill : produit (PDF) / non produit »
  (affichée si un CV est demandé — verbes préparer/rédiger/adapter/générer… + « CV » — ou s'il a été
  produit), « Lettre : produite / non produite » (même règle avec « lettre »), « CV non vérifié : n fait(s)
  sans source (verify-cv-facts) » quand le dernier `verify-cv-facts` a rendu un code non nul (effacée par une
  relance à zéro ; « verify-cv-facts a échoué (code non nul) » si rien n'est compté : fichier absent, erreur).
  Comptage `factsUnsourced(text)` : sortie `--json` (`invented` + `unsupportedFacts`) ou texte (items « - »
  sous « … absent from sources: ») ; les phrases interdites (`forbidden`) ne sont **pas** comptées (règle de
  style, pas une source manquante ; premier essai les comptait, 2 rouges, corrigé). Deux canaux : ACP
  (`rawOutput`, code non nul) et passerelle (`gatewayProgress` renvoie `facts: {unsourced}` pour un
  `verify-cv-facts` échoué ; `recordGatewayTool` le lit). `WRITE_PREFIXES` gagne `output/` (préfixe seulement,
  jamais le nom du fichier). Un `generate-pdf` à code non nul ne prouve rien (règle existante).
  « rédaction de document » (critère `Non exécuté`) inchangé, mais lu dans le prompt hors négations.
- **Fichier hors périmètre touché : `apps/api/server.js`, 1 ligne** (`facts: body.facts` transmis à
  `recordGatewayTool`), indispensable au canal passerelle (seul canal fiable pour Gemini), comme `argument`/`tracker`
  au chantier précédent. `packages/mcp-gateway/server.js` non touché (il étale déjà `gatewayProgress`).
- 00:52 Vert : `career-skill-production` 8/8 ; sous-ensemble (10 fichiers dont `career-truth`,
  `bilan-vs-events`, `truth-tool-names`, `owner-permissions`, `agent-silence`, `tool-watchdog`) 130/132,
  mêmes 2 « Agent non détecté ». `check`/`format:check` verts.
- Non vérifié : le format exact de sortie du vrai `verify-cv-facts.mjs` est pris de son `runCli` (lu, non
  exécuté) ; si une version future change ses en-têtes, le Bilan dira « a échoué (code non nul) » (vérité
  dégradée, pas fausse).

## Point 5 — Fixture de bout en bout

- 00:53 Rouge constaté, `tests/career-integration.test.js` (2 tests ajoutés) : `actual: 'failed'` sur l'état
  de la mission tant que la fixture n'avait pas sa branche (puis, branche écrite, une attente trop large :
  « non vérifié » apparaît aussi dans « Affirmations de l'agent : non vérifiées » ; resserrée en « CV non vérifié »).
  Erreur en route : `prepare(root)` inséré d'abord dans un autre test (`prepare is not defined`), déplacé dans
  `runCareerFixture`.
- `tests/fixtures/career-agent.js`, branche `FICTIF_SKILL_CV` (intention `documents`) : `career_read
  config/profile.yml` → `career_write output/cv-candidat-fictif-042-entreprise-fictive.json` (payload de
  `pdf.md`) → `verify-cv-structure` → `cv-templates resolve cv` (chemin absolu du modèle réutilisé tel quel)
  → `build-cv-html [json, html, template]` → `verify-cv-facts [html]` (code non nul : l'agent s'arrête
  **avant le PDF**, `pdf.md` étape 19) → `generate-pdf [html, pdf, "--format=a4", "--report=042"]` →
  `mark-pdf-ready ["042"]` → si « lettre » dans le prompt : payload `output/cover-payload-….json` puis
  `generate-cover-letter ["--payload", …]`. `FICTIF_CV_INVENTE` : puces inventées dans le payload.
- `tests/career-integration.test.js` : sept faux scripts au contrat des vrais (arguments, fichiers écrits,
  sorties : `🔗 Manifest: data/pdf-index.tsv updated (report 042)`, format d'échec de `verify-cv-facts`,
  JSON de `mark-pdf-ready`, refus hors `output/` de la lettre, codes 0/1/2) ; espace FICTIF : `cv.md`,
  `config/profile.yml`, `templates/cv-template.html`, `data/applications.md` avec la ligne 042 à ❌.
- Vérifié (test 1) : HTML construit depuis le payload, PDF écrit, `data/pdf-index.tsv` lié à 042, colonne PDF
  passée à ✅, lettre écrite sous `output/`, `cv.md` et profil intacts, Bilan « CV du Skill : produit (PDF) »,
  « Lettre : produite », 7 étapes « ✓ (faite) », « Écart d'ordre : aucun constaté », aucun `output/<uuid>.pdf`
  (`career_document` non appelé). Vérifié (test 2) : fait inventé → `verify-cv-facts` à 1, **aucun PDF**,
  index absent, colonne PDF inchangée, mission **terminée** (pas bloquée), Bilan « CV non vérifié : 2 fait(s)
  sans source (verify-cv-facts) », « CV du Skill : non produit », étape « ✗ Vérifier les faits… (échec
  signalé par l'outil) », « · Produire le PDF… (non exécutée) », et le contenu des faits refusés n'apparaît pas
  dans le Bilan de la plateforme.
- **Vrais scripts : non lancés ici** (refus de la session, 00:35). `tests/career-skill-production.test.js`
  contient un test d'exécution **réelle** de `verify-cv-facts.mjs` (sans réseau ni Chromium) sur un espace
  FICTIF, actif seulement si `RELAY_SKILL_CLONE=<clone du Skill>` ; sans la variable il est `skipped` et le
  dit. **Je n'ai pas pu le voir passer** : à lancer par le manager
  (`RELAY_SKILL_CLONE=~/Downloads/agregat-career-ops node --test tests/career-skill-production.test.js`).
  Les autres scripts (`build-cv-html` : modèle du clone + `js-yaml` ; `generate-pdf`/`generate-cover-letter` :
  Playwright) ne sont testés que par contrat.
- 00:58 Vert : `career-skill-production` 8/8 + 1 ignoré, `career-integration` 44/46 (mêmes 2 « Agent non
  détecté »), `skill-router`, `career-skill-scripts`, `career-skill-suivi`, `tool-watchdog` : total 103/105,
  1 ignoré. `check`/`format:check` verts.

