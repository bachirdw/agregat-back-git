# revue-skill-02 — Revue technique de career-ops `2d6ed587` → `35b7c531`

Rédigé le 05/11/2026 à 10:39 AEDT (heure lue avec `date`). Relecteur en lecture seule (sous-agent Claude).
Rien n'a été écrit dans le dépôt du Skill. Seules commandes git : `git --no-optional-locks diff/show/log/rev-parse/ls-tree/status -uno`.
Aucun script lancé, aucun `npm`. Fichiers interdits non lus (`cv.md`, `config/profile.yml`, `data/`, `reports/`, `output/`, `drafts/`, `inputs/`, `jds/`, `relay/`, `.env`).
Aucune donnée personnelle ci-dessous.

## 0. Verdict

**Oui, le reçu peut être renouvelé pour `35b7c531`, sous réserves (§4).** Rien de bloquant dans ce que j'ai lu
ligne à ligne (environ 4 300 lignes de diff, voir §5), ni dans les recherches automatiques passées sur 100 % des lignes ajoutées hors tests.
Ce que j'ai trouvé :
- aucun nouvel hôte de télémétrie ;
- aucun `eval` ni `new Function` ;
- aucun téléchargement suivi d'une exécution ;
- aucun envoi du CV, du profil ou du tracker vers un hôte nouveau ;
- les portes `apply` (s'arrêter avant Submit) et `set-status` (aucun `Applied` automatique) sont intactes, et leur contrôle est même renforcé.

Le plus gros changement est l'arrivée d'un **mode « plugin Claude Code »** : un hook `SessionStart` qui lance `npm install`
et un dossier de données par défaut `~/career-ops-data`. Il ne s'active que lorsque le code tourne depuis `~/.claude/plugins/{cache,marketplaces,synced}`, ce qui n'est pas le cas de Relay.

## 1. Volume et liste des fichiers

Commande : `git diff --stat 2d6ed587..35b7c531 -- '*.mjs' '*.js' '*.json' '*.sh' ':!node_modules' ':!package-lock.json'`.

| Ensemble | Fichiers | Lignes de diff (+/−) |
|---|---|---|
| Tout le périmètre demandé | 807 (357 ajoutés, 450 modifiés, 0 supprimé, 0 renommé) | 66 681 (+63 757 / −2 924) |
| Tests `tests/` | 417 | 33 133 |
| Tests `web/tests/` | 121 | 8 173 |
| Code hors tests (diff extrait) | — | 34 328 lignes de sortie de diff, 21 980 lignes ajoutées |
| **Périmètre réel du reçu Relay** (`sourceSnapshot` : sans dossiers en point sauf `.agents`, sans `web`, `tests`, `dashboard`, `test-fixtures`, `node_modules`, ni dossiers de données) | **194** (43 ajoutés, environ 151 modifiés) | **21 439** |

Fichiers ajoutés dans le périmètre Relay (43) :
`antigravity-directory/plugin.json`, `openai-directory/plugin.json`, `hooks/hooks.json`, `scripts/claude-plugin-session-start.mjs`,
`cv-voice.mjs`, `jd-years.mjs`, `role-clarity.mjs`, `sponsor-check.mjs`, `privacy-status.mjs`, `linkedin-import.mjs`, `provider-id-cache.mjs`,
`lib/agent-launch.mjs`, `lib/browser-launch.mjs`, `lib/endpoint-headers.mjs`, `lib/linkedin-import.mjs`, `lib/llm-outbound.mjs`,
`lib/machine-summary-section.mjs`, `lib/pdf-server.mjs`, `lib/pii-interceptor.mjs`, `lib/privacy-guard.mjs`, `lib/test-queue.mjs`,
`utils/privacy-filter.mjs`, `plugins-registry/exa.json`,
`providers/{_cached-lookup,_city-slug,_http-cache,_wp-job-feed,apple,applicantpro,bulldogjob,clearcompany,darwinbox,deel,factorial,germantechjobs,homerun,inrecruiting,jobscz,keka,notion,pracecz,wp-job-manager}.mjs`.

Plus gros fichiers modifiés hors tests : `keyword-match.mjs` (+435/−100), `generate-pdf.mjs` (+427/−44), `openrouter-runner.mjs` (+389/−67),
`scan.mjs` (+285/−37), `verify-cv-facts.mjs` (+285/−15), `github-evidence.mjs` (+279/−16), `doctor.mjs` (+243/−35), `batch/batch-runner.sh` (+204/−24).

**Dépendances** (`package.json`) : une seule modification, `undici` `^6.28.1` → `^7.30.1` (commit a83f4f0d, tunnel CONNECT pour le proxy).
Aucune nouvelle dépendance de premier niveau. Deux scripts npm ajoutés : `role-clarity`, `privacy:status`.
`package-lock.json` **n'est pas versionné** dans le dépôt. La copie locale sur disque est **périmée** : version 1.38.0, `undici` `^6.28.1` résolu en 6.29.1.
`node_modules` contient donc sans doute undici 6 alors que le code attend la 7 (option `proxyTunnel` d'`EnvHttpProxyAgent`), d'où un risque de casse du proxy (déduit).
`web/package.json` ajoute `pdfjs-dist ^6.4.299`, qui tire `@napi-rs/canvas`, un binaire natif. Ce fichier est hors périmètre Relay.

## 2. Trouvailles

Gravité : B = bloquant, S = à surveiller, A = anodin. Degré : L = lu, D = déduit.

| # | Fichier:ligne (à `35b7c531`) | Ce que fait le code | Grav. | Degré |
|---|---|---|---|---|
| 1 | `hooks/hooks.json:1-16`, `scripts/claude-plugin-session-start.mjs:67-90,129-160` | Hook `SessionStart` du plugin Claude Code. Il lance `npm install --omit=dev --ignore-scripts --no-audit --no-fund` dans `${CLAUDE_PLUGIN_DATA}`, puis crée le lien symbolique `node_modules` → ce dossier et crée `~/career-ops-data`. Il ne fait rien hors d'une copie de plugin (`isPluginInstallCopy`). Il installe des dépendances depuis le registre npm, sans lockfile et sans les scripts d'installation. | S | L |
| 2 | `path-resolver.mjs` (fonctions `getCareerOpsRoot`, `isPluginInstallCopy`, `pluginDefaultDataRoot`) | Nouvelle priorité du dossier de données : env > marqueur > `~/career-ops-data` (seulement pour une copie de plugin) > racine du dépôt. Un `CAREER_OPS_ROOT` placé dans `~/.claude/plugins/...` est refusé (`UnsafeDataRootError`). `realpathSync` est appelé sur `~/.claude/plugins/*` dans un `try/catch`. | S | L |
| 3 | `lib/pii-interceptor.mjs` (fin de fichier : `installPiiInterceptor()` à l'import) | Remplace `globalThis.fetch` par un garde-fou. Il inspecte **seulement** les requêtes vers des hôtes LLM (`LLM_HOSTS` de `lib/llm-outbound.mjs`, plus les ports locaux 11434/1234/8000, plus les chemins `/chat/completions`, `/completions`, `/v1/messages`, `/api/chat`, `:generateContent`). Par défaut il bloque. Le mode « redact » demande `PRIVACY_REDACT=1`. Le garde-fou ne se coupe qu'avec `PRIVACY_GUARD=off` **et** `PRIVACY_BYPASS_TOKEN` (`lib/privacy-guard.mjs:760-777`). Configuration : `config/privacy.yml`. Lecture locale seulement, rien n'est écrit, rien ne part sur le réseau. Mesure de protection. | A | L |
| 4 | `lib/llm-outbound.mjs` (`matchesPathHint`, `LLM_PATH_HINTS`) | Une requête de **scan** dont le chemin finit par `/completions` ou `/api/chat` serait inspectée, voire bloquée par erreur, si l'intercepteur est actif. Les scripts qui l'installent (`openrouter-runner`, les évaluateurs) ne sont pas lancés par Relay. | A | D |
| 5 | `lib/pdf-server.mjs:26-80,163-210` | Serveur PDF partagé : un processus enfant `node generate-pdf.mjs --pdf-server` écoute sur un **socket Unix dans `os.tmpdir()/co-pdf-<uid>`** (mode 0700), avec un fichier `.pid`. Il écrit hors du dépôt, dans le dossier temporaire. Il ne s'active qu'avec `CAREER_OPS_PDF_SHARED=1` (que `batch-runner.sh` exporte quand le PDF n'est pas sauté) ou depuis `web/server.mjs`. | S | L |
| 6 | `lib/browser-launch.mjs:85-170` | Lit le `.env` du dossier de données, mais n'en garde que `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` et `CAREER_OPS_BROWSER_AUTODETECT`, sans les appliquer à `process.env`. Avec l'auto-détection (option à activer), Playwright lance Brave, Chrome ou Edge installés via `executablePath`. C'est un `launch` simple, pas `launchPersistentContext`, donc le profil de l'utilisateur n'est pas utilisé (déduit : la recherche sur `launchPersistentContext\|userDataDir` ne trouve rien). | A | L |
| 7 | `github-evidence.mjs` (`collect`, `cleanReadme`, `findPreviousScan`) | Lit désormais, via `gh api repos/<r>/readme`, le **README des dépôts de la liste autorisée, y compris privés** (taille plafonnée à 6 000 caractères), et l'écrit dans `output/github-evidence-*.json`. Il utilise le jeton `gh` de l'utilisateur. Ce texte non fiable arrive ensuite dans le contexte de l'agent, d'où un vecteur d'injection de consigne. | S | L |
| 8 | `providers/{jobscz,pracecz}.mjs` (via `_profile-keywords.mjs`, qui existait déjà) | Sans `keywords:` dans le portail, les **rôles cibles du profil** partent comme requête de recherche vers jobs.cz et prace.cz. C'est le même mécanisme qu'avant pour vdab, platsbanken, gupy, etc. Seulement si le portail est configuré. | A | L |
| 9 | 19 nouveaux fournisseurs (`providers/*.mjs`) | Hôtes : `*.intervieweb.it`, `*.applicantpro.com`, `*.notion.site` (POST `/api/v3/loadPageChunk`), `feed.homerun.co`, `jobs.apple.com`, `jobs.deel.com`, `careers-api.clearcompany.com`, `www.prace.cz`, `germantechjobs.de/rss`, `*.darwinbox.in` (POST), `bulldogjob.pl`, `*.factorialhr.com`, flux WP Job Manager, `*.keka.com`, `www.jobs.cz`. Tous sont déclarés dans `docs/SUPPORTED_JOB_BOARDS.md`. Ils passent par `_http.mjs` (garde IP, `redirect: 'error'`, corps plafonné à 10 Mo). Les corps POST ne contiennent que des identifiants de tableau ou de page, aucune donnée locale. Plusieurs sont **détectés automatiquement depuis `careers_url`**, sans clé `provider:`, ce qui contourne la liste blanche de fournisseurs de Relay (voir §4). | S | L (hôtes et méthodes), D (corps complets non tous lus) |
| 10 | `providers/_http.mjs` | `EnvHttpProxyAgent({... proxyTunnel: true})` (undici 7). Accepte des identifiants dans l'URL du proxy en `http:` vers la boucle locale. Corps plafonné (10 Mo, 256 Ko pour une erreur). Prend en charge `If-None-Match`/304. | A | L |
| 11 | `providers/_http-cache.mjs`, `scan.mjs` (`withHttpCache`) | **Cache HTTP actif par défaut** : réponses des tableaux gardées 15 min dans `data/cache/http/` (le nom de fichier est un hash, l'URL n'est pas stockée, les en-têtes `authorization`/`cookie` sont exclus de la clé). Désactivation : `CAREER_OPS_HTTP_CACHE=0`. Plus un cache d'identifiants `data/cache/provider-ids/<provider>.json`. Écritures dans le dossier de données. | A | L |
| 12 | `sponsor-check.mjs:986-1060` | Télécharge le registre britannique des sponsors (`www.gov.uk` API puis `assets.publishing.service.gov.uk`), avec vérification de l'hôte à chaque redirection. Cache dans `data/cache/sponsor-register/`. Aucune donnée locale envoyée. | A | L |
| 13 | `lib/endpoint-headers.mjs` | Ajoute les en-têtes `x-opencode-session` et `User-Agent` seulement vers `opencode.ai`, pour l'évaluateur OpenAI-compatible. | A | L |
| 14 | `openai-eval.mjs` (aide), `openrouter-runner.mjs` | Exemples d'endpoints (`api.runcrate.ai`, `cloudgpu.app`, `api.cheapaimodel.ai`, `api.minimax.io/.cn`) cités dans l'aide `--url`. Ce sont des choix de l'utilisateur, aucun n'est appelé par défaut. `openrouter-runner` installe l'intercepteur, passe le délai par défaut de 15 s à 120 s et valide la réponse du modèle (il rejette les balises d'appel d'outil). | A | L |
| 15 | `batch/batch-runner.sh` | Nouveau `--mode match` / `--single-pass`, qui n'injecte ni profil ni `_custom.md`. Verrou atomique (`set -C`). Arrêt du serveur PDF par `node -e` avec chemins passés en variables d'environnement, sans entrée externe. `claude -p --dangerously-skip-permissions` existait **déjà** à la version revue. | S (existant) | L |
| 16 | `scripts/followup-sweep.sh` | Durci : `claude -p --permission-mode dontAsk --allowedTools` limité, `--disallowedTools` sur `set-status`, `followup-seed` et `Edit(data/**)`. | A | L |
| 17 | `lib/status-hooks.mjs:150-160` | `CAREER_OPS_FOLLOWUPS` (variable d'environnement) gagne désormais sur le chemin déduit du tracker pour semer `follow-ups.md`. | A | L |
| 18 | `set-status.mjs`, `normalize-statuses.mjs` | Pas d'`Applied` automatique. Ajouts : refus d'une liste `14,78`, correspondance de société sans forme juridique (`companiesMatchIgnoringCorporateForm`), état « daté » (`Applied 2026-01-02 …`) canonisé avec le texte restant déplacé dans Notes, journal des transitions écrit en état canonique ou `-`. | A | L |
| 19 | `modes/apply.md` (lignes 7, 19, 66-110) | « Stop before Submit, Send, or Apply » et le mode non surveillé « never submit » sont **inchangés**. Ajout de l'**identité d'annonce** (#5854) : on n'écrit jamais dans le rapport d'une autre annonce, et le choix « brouillon sans sauvegarde » est proposé. | A | L |
| 20 | `update-system.mjs:5874-5915` | Dans une copie de plugin, `update-system` refuse d'agir (`managed-by-plugin`). Ailleurs, comportement inchangé. `upgrade-tests.mjs` (outil de CI) clone le dépôt dans `tmpdir` et y lance `update-system apply --confirm` : à ne jamais lancer depuis Relay. | A | L |
| 21 | `plugins/_engine.mjs`, `plugins/_net.mjs`, `plugins.mjs` | Corps plafonné, délai DNS de 5 s, garde IP mise en commun avec `providers/_ip-guard.mjs`. `enable` demande toujours `--confirm`. **Aucun plugin activé par défaut** (lu dans `plugins.mjs` et `doctor.mjs` : activation = `config/plugins.yml` plus les variables d'environnement requises). | A | L |
| 22 | `plugins-registry/exa.json` (nouveau), `tavily.json`, `docx.json` | Registre : ajout d'**exa** (`api.exa.ai`, `EXA_API_KEY`, dépôt tiers épinglé par sha). tavily passe en 0.1.2 et ne fait plus que la recherche. docx passe en 0.1.4. Rien n'est installé tant que `plugins.mjs add` n'est pas lancé. | S | L |
| 23 | `web/src/lib/core/logo-fetch.mjs` (hors périmètre Relay) | L'interface web envoie le **domaine de chaque société** à `www.google.com/s2/favicons`. | S (web seulement) | L |
| 24 | `doctor.mjs` | Gemini CLI retiré de la liste `CLI_NAMES`. Choix du CLI d'agent d'après le `PATH` quand aucun n'est configuré. Lit le `.env` pour le statut des plugins. Le refus `UnsafeDataRootError` fait sortir avec le code 1. | A | L |

Hôtes nouveaux relevés dans les lignes ajoutées, outre ceux des fournisseurs : `www.gov.uk`, `assets.publishing.service.gov.uk` (sponsor-check),
`www.google.com` (web seulement), `registry.npmjs.org` (lockfile web et npm du hook). Les autres hôtes (`career-ops.org`, `santifer.io`,
`agent-plugins.org`, `github.com`) n'apparaissent que dans des manifestes JSON, comme métadonnées, sans aucun appel.

Recherches passées sur toutes les lignes ajoutées hors tests :
- `child_process|exec|spawn|eval|new Function|vm.run|import(variable)` : seuls cas `batch-tailor` (spawnSync du CLI, sans shell), `lib/pdf-server` (spawn de `process.execPath`),
  `lib/run-bounded` (`execFileSync` node), `outcome.mjs` (`execFileSync` avec arguments en tableau, existait déjà), `scripts/claude-plugin-session-start` (npm), `upgrade-tests` (CI),
  `batch-runner.sh` (`node -e` à chemins fixes) ;
- `homedir|keychain|.ssh|.aws|.npmrc|launchPersistentContext|userDataDir|cookies` : seulement `path-resolver.mjs` (`~/.claude/plugins`, `~/career-ops-data`) ;
- écritures : toutes dans le dossier de données ou le dépôt, sauf `lib/pdf-server` (tmpdir), `upgrade-tests` (tmpdir) et le hook plugin (`CLAUDE_PLUGIN_DATA`, `~/career-ops-data`).

## 3. Ce que le Skill déclare

- `VERSION` reste à **1.38.0** et `CHANGELOG.md` **n'a pas bougé** entre les deux commits. Aucune version n'a été publiée pour ces 452 commits
  (dernier commit le 04/11/2026). Aucune note de version ne couvre donc ces changements.
- `SECURITY.md` : **inchangé**.
- `docs/PRIVACY.md` (+245) : documente le garde-fou (blocage par défaut, `config/privacy.yml`, double condition pour le couper, limites, dont
  « un client HTTP natif, un processus enfant ou un navigateur échappent au garde-fou »).
- `docs/CLAUDE_PLUGIN.md` (+78, nouveau) : documente le hook et `~/career-ops-data`.
- `docs/PLUGINS.md` : ajoute exa au registre, réduit la description de tavily, renvoie vers LinkedIn sans plugin (`linkedin-import.mjs`).
- `docs/AUTOMATION.md` (+12) : documente le durcissement des permissions de `followup-sweep.sh`.
- `DATA_CONTRACT.md` : nouveaux fichiers utilisateur `data/cache/provider-ids/<provider>.json`, `data/cache/http/`, `data/templates/*`, et 4e niveau du dossier de données (plugin).
- `templates/states.yml` : **inchangé**.

## 4. Réserves pour renouveler le reçu

1. **Ne jamais exécuter** `scripts/claude-plugin-session-start.mjs`, `upgrade-tests.mjs`, `updater-migration-tests.mjs`, `test-all.mjs`, `update-system.mjs`
   ni `plugins.mjs add|enable` depuis Relay. Ils restent dans l'empreinte, ce qui est normal, mais hors de la liste des commandes. Relay ne lance
   aujourd'hui que `scan`, `find`, `jd-skill-gap`, `cv-title-check` et `verify-cv-facts` (`packages/career-ops/tools.js:284-296`) : rien ne change sur ce point.
2. **Ne pas installer le dépôt comme plugin Claude Code** (`~/.claude/plugins/...`). Garder `CAREER_OPS_ROOT`/`CAREER_OPS_DATA_DIR` = racine du dépôt, ce que fait déjà
   Relay, pour ne pas basculer vers `~/career-ops-data`.
3. **Variables à ne pas fournir** aux scripts lancés par Relay : `PRIVACY_GUARD`, `PRIVACY_BYPASS_TOKEN`, `PRIVACY_REDACT`, `CAREER_OPS_PDF_SHARED`,
   `CAREER_OPS_BROWSER_AUTODETECT`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CAREER_OPS_FOLLOWUPS`, `CAREER_OPS_PIPELINE`,
   `CAREER_OPS_PRIVACY`, ainsi que toute clé `EXA_API_KEY`/`TAVILY_API_KEY`/`APIFY_*`.
4. **Plugins** : laisser `config/plugins.yml` vide ou absent. Ne pas ajouter exa ni tavily.
5. **Fournisseurs** : la liste blanche de Relay ne contrôle que la clé `provider:`. Or les nouveaux fournisseurs sont choisis automatiquement d'après l'hôte de `careers_url`
   (notion.site, keka, homerun, etc.). Pour que la liste blanche tienne, Relay doit aussi filtrer les hôtes de `careers_url`/`api` dans `portals.yml`.
   Le défaut existait déjà, mais la surface passe de 19 à beaucoup plus d'hôtes possibles.
6. **Dépendances** : refaire `npm install` (undici 7) avant tout `scan` derrière un proxy, ou constater que le scan direct reste en undici 6. À vérifier par un essai, pas par la revue.
7. Pas de `.env` dans le dépôt : Relay le refuse déjà (`tools.js:306`). Cela couvre aussi la lecture du `.env` par `lib/browser-launch.mjs`.

## 5. Changements d'interface pour `skill-suivi-01`

- **Aucun script renommé ni supprimé.** Nouveaux scripts : `role-clarity.mjs`, `jd-years.mjs` (module plus filtre), `sponsor-check.mjs`, `privacy-status.mjs`
  (`npm run privacy:status`), `linkedin-import.mjs` (`--dry-run`), `cv-voice.mjs`, `provider-id-cache.mjs`.
- `set-status.mjs` :
  - un sélecteur `14,78` sort en erreur d'usage (`EXIT_USAGE`) et propose `--row N` par ligne ;
  - le message `no-tracker` donne le chemin d'écriture (`resolveTrackerPathForWrite`) ;
  - la colonne `from` du journal des transitions vaut l'état canonique ou `-` ;
  - un ancien état daté est réécrit et son texte part dans Notes.
- `normalize-statuses.mjs` : canonise `<État> AAAA-MM-JJ …`. Il laisse la ligne telle quelle (avec un avertissement) si le tracker n'a pas de colonne Notes.
- `outcome.mjs` : prend l'URL de la colonne URL du tracker, puis celle des Notes. La clé de capture est le numéro du rapport lié s'il est unique, sinon le numéro de ligne.
  Nouvelle erreur `empty-selector`.
- `add-entry.mjs` : nouvelle charge `articleDigestUpdate: { dedupKey, bullet }` (ajoute une puce sous une entrée existante). Verrous `<fichier>.add-entry.lock`.
- `close-stale.mjs` : correspondance sans forme juridique avec `active-interviews.md`. Échoue si ce fichier existe mais ne peut pas être lu.
- `lib/tracker-addition.mjs` : nouvelle fonction `parseScoreSummary()` (bloc `---SCORE_SUMMARY---`).
- `scan.mjs` :
  - **sort avec le code 1** sur une clé de premier niveau mal orthographiée dans `portals.yml` ;
  - nouveaux statuts de `scan-history` : `skipped_experience`, ainsi que `skipped_content`, `skipped_visa`, `skipped_country_eligibility` (désormais listés) ;
  - les lignes du pipeline peuvent porter `| yrs: …` ;
  - nouveau bloc `experience_filter` dans `portals.yml` (lit `candidate.years_of_experience` du profil) ;
  - `max_response_mb` par entrée ;
  - variables `CAREER_OPS_HTTP_CACHE`, `CAREER_OPS_HTTP_CACHE_TTL_MS`, `CAREER_OPS_PIPELINE` ;
  - `--verify` écarte aussi `insufficient_content`.
- `batch/batch-runner.sh` : `--mode full|match`, `--single-pass` ; nouveau prompt `batch/batch-prompt-match.md`.
- `github-evidence.mjs` : `--since AAAA-MM-JJ` ; sortie avec `readmes[]` ; référence = le précédent `output/github-evidence-*.json`.
- `modes/apply.md` : « Posting identity », trois choix en cas d'écart (évaluer comme nouvelle annonce / brouillon sans sauvegarde / arrêter), règle « écrire seulement dans le rapport de cette annonce ».
- Nouveaux fichiers de données : `data/cache/http/`, `data/cache/provider-ids/`, `data/cache/sponsor-register/`, `data/templates/`, `config/privacy.yml`
  (modèle `config/privacy.example.yml`), `output/github-evidence-*.json` (contenu enrichi).
- **États** : `templates/states.yml` inchangé, aucun nouvel état du tracker.
- `doctor.mjs --json` : nouveau champ `dataRootError` ; contrôle `pluginInstall`.

## 6. Non vérifié

- **Lignes lues ligne à ligne : environ 4 300**, sur 21 439 lignes de diff dans le périmètre du reçu Relay (environ 20 %) et 66 681 lignes au total (environ 6,5 %).
  Les tests n'ont pas été lus (41 306 lignes).
- Le reste du code hors tests (environ 17 000 lignes) n'a été couvert que par des **recherches automatiques** sur 100 % des lignes ajoutées : appels réseau, URL et hôtes,
  `child_process`/`eval`, accès disque, `homedir`, variables d'environnement.
  Fichiers non lus en entier : `keyword-match.mjs`, `generate-pdf.mjs`, `role-clarity.mjs`, `cv-voice.mjs`, `invite-match.mjs`, `jd-years.mjs` (en-tête et appels seulement),
  `lib/privacy-guard.mjs` (environ 150 lignes sur 864), `sponsor-check.mjs` (accès disque et réseau seulement), le corps des 19 nouveaux fournisseurs (hôtes,
  méthodes et corps POST seulement), `ics-interview`, `liveness-*`, `analyze-patterns`, `tracker-utils`, `merge-tracker`, `dedup-tracker`, `validate-*`, `.github/scripts/*`, et tout le code `web/` hors recherches.
- Pas vérifié par un essai : comportement de `isPluginInstallCopy` sous `node --permission --allow-fs-read=<root>` (le `realpathSync` est dans un
  `try/catch`, donc sans doute sans effet, déduit) ; compatibilité undici 6 sur disque contre la 7 attendue.
- `modes/*.md` (134 fichiers, +4 804) : seules ont été vérifiées les phrases liées à Submit/Send/Applied/unattended et la porte `apply.md`.
