# review-freins-01 — relecture indépendante du sprint freins-01

Relecteur : sous-agent Opus (session `review-freins-01`). Arbre `agregat-back-freins`, branche `freins-01`.
Commits relus : 3b7ef60, a7fcbab, f40cdad, 90c8d60, 11fd81d, 57c2b02, 759f803. Consigne du propriétaire
(13/11) : « que ça marche ; enlève tout ce qui bride l'agent ». Aucune garde ajoutée, aucun resserrement.

## Journal

- 17:11 — Lu AGENTS.md, la section 1 de la passation et `.manager/reports/freins-01.md`. Diff relu contre
  la base de fusion (`ccc8a95`) : `git diff contacts-13-11..freins-01` montre aussi, comme supprimés, les
  tests de l'accord de mission ajoutés depuis sur `contacts-13-11` (10 commits `accord-mission-01`) ; ce
  ne sont pas des suppressions du sprint (vérifié : `git log freins-01..contacts-13-11`).
- 17:15 — Défaut trouvé (A) : le schéma MCP de `career_script` (`tools.js`, `register('career_script')`)
  bornait encore `args` à 30 valeurs de 1 000 caractères ; la levée de f40cdad n'agissait que sur la
  classe. Par la passerelle, 31 arguments ou un argument de 1 001 caractères restaient refusés.
- 17:17 — Corrections dans `packages/career-ops/tools.js` (voir « Constats »), test
  `tests/review-freins-01.test.js` (9 tests). Rouge sur le code du sprint (copie temporaire de
  `HEAD:tools.js`, puis remise de la version relue) : 2 échecs (arguments par la passerelle, sortie de
  plusieurs Mo) ; vert après : 9/9.
- 17:19 — Fichiers ciblés (10 fichiers, dont ceux du sprint hors Chrome) : 141 tests, 141 réussis.
- 17:22 — Phase unitaire complète (158 fichiers hors ensemble `BROWSER`, `--test-concurrency=4
--test-timeout=120000`) : 1212 tests, 1210 réussis, 0 échec, 2 ignorés (sprint : 1203 ; +9 de cette
  relecture). `npm run check` : syntaxe valide. `npm run format:check` : conforme.
- 17:25 — Aucune mission en cours (4313, 4314). Suite Chrome, fichiers modifiés par le sprint, un par un :
  `owner-browser` 42/42, `browser-select-check` 3/3, `browser-type-upload-ref` 4/4. Cette relecture ne
  modifie aucun fichier Chrome.
- Commits : 09776c9 (code et tests), puis ce rapport.

## Constats

### Faux, corrigé

1. A — `career_script` par la passerelle : schéma MCP resté à 30 × 1 000 (`tools.js:1650` avant
   correction). Désormais `ownerMode ? 200 × 10 000 : 30 × 1 000` (`tools.js:1652-1653`) ; hors mode
   propriétaire, identique. Test : listage du schéma dans les deux modes, 200 URL et un argument de
   10 000 caractères passent par la passerelle, 201 et 10 001 refusés.
2. D — Sortie de script jusqu'à 5 Mo rendue entière à l'agent. Lu dans le code : au-delà de 256 Kio,
   l'événement `agent` n'est pas écrit (`packages/storage/index.js:113` lève « Événement trop
   volumineux », `packages/orchestrator/index.js:1284` ; `packages/agent-runtime/index.js:171` le
   transforme en `platform_event_dropped`) : la mission continue, le suivi (`turnTruth.observe`,
   `skillProgress.observe`) a déjà vu la mise à jour, mais le journal perd la réponse. Surtout, une
   réponse de plusieurs Mo (plus d'un million de jetons) dépasse le contexte de tout agent : l'appel est
   perdu, voire la session. Correction au plus petit, sans rétablir l'arrêt du script :
   `boundScriptOutput` (`tools.js:811`), appliquée à la réponse de `career_script` en mode propriétaire
   seulement (`tools.js:1659`) : au-delà de 200 000 caractères (la sortie que rendait un script avant le
   sprint), début (100 000) et fin (100 000) avec la mention « [Sortie de N caractères (M octets) : début
   et fin montrés, K caractères du milieu omis ; le script a tourné jusqu'au bout.] », et les champs
   `outputChars`, `outputOmitted`. `exitCode`, `timedOut`, `truncated` inchangés. Test : sortie FICTIVE
   de 3 000 000 caractères par la passerelle, réponse sous 256 Kio, début et fin présents.
3. F — Branche « même le lien court dépasse » d'`email_send` : inatteignable (objet ≤ 500, destinataire
   ≤ 254 : moins de 5 400 caractères encodés, sous 8 000 et 16 384). Retirée avec l'import devenu
   inutile de `NAVIGATE_URL_MAX` dans `tools.js` ; aucun comportement ne change. Test : pire lien court
   (objet de 500 « € », 250 émojis ou 500 « & », destinataire de 253 caractères) sous les deux bornes.

### Fragile, laissé (une ligne chacun)

- B — Crédit d'un `career_read` sur le chemin DEMANDÉ : juste après le point 1, car le fichier lu par un
  motif ou un préfixe est toujours dans le dossier du chemin demandé (même préfixe `reports/`, `jds/`).
  Mais le crédit suit le préfixe, pas le genre : `reports/*.tsv` (un TSV) crédite « Lire le rapport de
  l'offre », comme la lecture directe de ce TSV le faisait déjà avant le sprint
  (`packages/orchestrator/skill-router.js:564-567`, `x.includes(step.argument)` ;
  `packages/career-ops/truth.js:67`). Test de constat ajouté (crédit actuel, non corrigé).
- B, élargi par le point 3 — `skill-router.js:567` compare par `includes` : en mode propriétaire, une
  lecture de `lib/reports/x.js` (n'importe quel dossier contenant `reports/`) créditerait « Lire le
  rapport ». Non testé par la passerelle, moteur hors périmètre.
- B, sous-crédit — `data/pipeline*` lit `data/pipeline.md` sans créditer l'étape « Lire les entrées en
  attente » (`argument: data/pipeline.md`, chemin demandé différent).
- `career_read` à 200 000 caractères : avec l'adaptateur Claude (limite de sortie MCP par défaut,
  environ 25 000 jetons ; E27 citait déjà « la limite de l'adaptateur Claude » pour 48 000), une page de
  200 000 caractères peut être refusée par l'adaptateur ; l'agent doit alors relire plus court. Non
  éprouvé. Un événement de plus de 256 Kio (200 000 caractères accentués) est aussi perdu du journal.
- Capture SIMULÉE de la passerelle de fixture (`mcp-gateway/server.js:216`) : `maxChars` 48 000 au plus
  (fixture seulement) ; laissé, un test du sprint le fige.
- Lecture propriétaire : un fichier nommé `secrets.env` (sans point initial) se lit ; seul `.env*` et
  `relay/agent-homes/` sont exclus, conformément à la consigne.
- Sortie bornée : `scanNetworkFailures` lit un JSON entier ; une sortie de `scan` de plus de 200 000
  caractères en JSON ne se lit plus comme JSON (repli sur le texte). Cas non rencontré.

### Correct (vérifié)

- A — Par la passerelle MCP en mode propriétaire : `reports/005`, `reports/005*`, `reports/005-*.md`
  lisent le rapport (`path` = chemin lu, `requestedPath`), `scripts/…` et `lib/sous/…` se lisent, une
  lecture de 150 000 caractères passe, 200 001 est refusé ; hors mode propriétaire, un sous-dossier reste
  hors du périmètre. `fillForm` de 100 champs et adresse de 5 000 caractères admis par les schémas du
  registre, que la passerelle publie telle quelle (`mcp-gateway/server.js:311`) ; aucune autre borne
  dans `browser-gateway`, `policy-engine` ni l'orchestrateur (`SNAPSHOT_MAX_CHARS` de
  `browser-gateway/paginate.js:6` n'est utilisé nulle part).
- B — Motif `reports/005-*.md` à un seul rapport : étape « Lire le rapport de l'offre » créditée, à juste
  titre (test par la passerelle et la route tool-outcome).
- C — Point 2 : diagnostic du codeur confirmé, et plus large. Le crédit se décide sur le chemin demandé
  en trois endroits : `mcp-gateway/server.js:119` (`jdRead`), `career-ops/truth.js:67` et `:599`
  (canal ACP, `paths.get(toolCallId)`), et surtout `orchestrator/skill-router.js:564-567` : sur le canal
  ACP, tout `career_read` réussi crédite « Lire réellement l'annonce » (étape sans argument) et un
  `reports/` demandé crédite « Lire le rapport ». Le plus petit changement : (1) `tools.read` rend une
  liste en succès avec `listing: true`, sans `path` ; (2) la passerelle calcule `argument` et `jdRead`
  sur le `path` de la réponse et n'envoie rien pour une liste ; (3) `truth.js` fait de même sur le canal
  ACP (`rawOutput`) ; (4) `skill-router.js` (`matches`) ignore une réponse `listing: true`. Le point 4
  est dans `packages/orchestrator`, interdit à cette relecture : le changement ne tient PAS dans
  `packages/career-ops` et `mcp-gateway/server.js`. Laissé ; la liste reste un refus qui nomme les
  chemins exacts.
- E — Écriture inchangée en mode propriétaire (passerelle) : scripts, `lib/`, scripts du Skill,
  `data/applications.md`, `data/pdf-index.tsv`, `relay/source-review.json` refusés ; un fichier de plus de
  10 Mo répond « Fichier trop volumineux ou non régulier » sans chemin absolu ; un binaire répond « n'est
  pas un fichier texte » (test du sprint). Hors mode propriétaire : identique (tests du sprint et de
  cette relecture).
- F — `bodyOmitted` n'est posé que si le lien complet dépasse 8 000 et que le lien court s'est ouvert ;
  la bascule au-delà de 8 000 marche (tests du sprint `career-sends`).
- G — Schéma `browser_press` : Backspace, Delete, PageUp, PageDown admis ; Espace et combinaisons
  refusés. Le classement d'Entrée (`browser-gateway/index.js:330`, `cdp.js:2776`) ne dépend que de
  `key === 'Enter'` : inchangé.
- H — Tests existants modifiés par le sprint : chacun suit le nouveau comportement et garde ce qu'il
  protégeait (bornes refusées à la nouvelle limite, formes piégées toujours refusées hors mode
  propriétaire et confinées en mode propriétaire, écriture toujours refusée). Aucun test supprimé par le
  sprint (les « suppressions » du diff à deux points viennent de `contacts-13-11`).

## Non vérifié

- Aucun essai réel (aucune mission, aucun POST vers une API en marche) ; tout par fixtures.
- Comportement réel des adaptateurs (Claude, Codex, Gemini, OpenCode) face à une réponse de 200 000
  caractères.
- Le seuil de 8 000 caractères du lien de composition sur la messagerie réelle.
- Touches nouvelles en onglet caché (constat du codeur, `cdp.js` hors périmètre).
