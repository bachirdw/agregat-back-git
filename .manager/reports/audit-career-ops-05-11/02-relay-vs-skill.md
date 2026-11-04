# Audit 02 : Relay face au Skill career-ops

Relecteur d'architecture, lecture seule, 05/11/2026 09:46 (horloge lue).
Skill : `~/Downloads/agregat-career-ops` @ `2d6ed58`. Relay : `~/Downloads/agregat-back-astra`, branche `suite-astra`.
Aucun fichier modifié hors de ce rapport, aucun script lancé, aucune donnée personnelle lue (`cv.md`, `config/profile.yml`, `data/`, `reports/`, `portals.yml` non ouverts).

Notation : **lu** = vérifié dans le fichier cité ; **déduit** = conclusion tirée de plusieurs lectures, sans exécution.
Les numéros de ligne Skill sont préfixés `S:` et ceux de Relay `R:`.

---

## 0. Remarque préalable sur le README

Le brief cite un tableau « The everyday commands » et un dépliant « All commands, by stage of the search ». **Ils n'existent pas au commit 2d6ed58** (lu : `grep` sans résultat ; titres listés dans `S:README.md`). La liste des commandes est le bloc « Usage » `S:README.md:278-327`, le principe est dans « What career-ops will not do » `S:README.md:160-167` et « How It Works » `S:README.md:329-349`. Ce rapport s'appuie sur ces sections, sur le routeur `S:.agents/skills/career-ops/SKILL.md` et sur la table « Skill Modes » `S:AGENTS.md:440-487`.

## 1. Le contrat du Skill en cinq phrases (lu)

1. **Les fichiers sont la source de vérité.** Il s'agit de `data/pipeline.md` (boîte d'entrée), de `reports/{###}-{slug}-{date}.md` et de `data/applications.md` (suivi), selon `S:ARCHITECTURE.md:22-24` et `S:ARCHITECTURE.md:80-88`.
2. **On n'ajoute jamais de ligne de suivi à la main.** On écrit un TSV dans `batch/tracker-additions/`, puis `merge-tracker.mjs` le fusionne. Une mise à jour d'état passe par `set-status.mjs` (`S:AGENTS.md:661-662`, `S:modes/_shared.md:263`, `S:modes/oferta.md` « Record in tracker »).
3. **Chaque phase a ses scripts.** Le numéro de rapport vient de `reserve-report-num.mjs`, la vérification qu'une offre est encore ouverte de `check-liveness.mjs`, le PDF de `build-cv-html.mjs` + `generate-pdf.mjs` (avec contrôle des faits), la couverture de mots-clés de `keyword-match.mjs` (`S:AGENTS.md:519-530`, `S:AGENTS.md:588`, `S:modes/pdf.md:70-92`).
4. **Ordre d'enchaînement :** scan, puis `data/pipeline.md`, puis pipeline (tri des offres closes, pré-filtre, puis auto-pipeline pour chaque URL), puis le rapport, le PDF et le TSV fusionné, puis apply (`S:docs/ARCHITECTURE.md:40-59`, `S:modes/pipeline.md:5-45`).
5. **Garde-fous du Skill :** jamais de soumission ni d'envoi, aucun transport d'e-mail. Apply s'exécute dans un Playwright lancé par le projet, jamais en se connectant au Chrome de l'utilisateur (`S:README.md:162-163`, `S:AGENTS.md:499-516`, `S:modes/apply.md:15-19`).

## 2. Ce que Relay met à disposition de l'agent (lu)

- **Espace de travail.** C'est le clone du Skill lui-même : `DEFAULT_WORKSPACE = ~/Downloads/agregat-career-ops` (`R:packages/career-ops/workspace.js:13`). Le dossier de mission est ce même chemin (`R:packages/orchestrator/index.js:661-664`), avec `CAREER_OPS_ROOT` et `CAREER_OPS_DATA_DIR` qui pointent sur ce clone (`R:index.js:908-911`).
- **Outils MCP** (`R:packages/career-ops/tools.js:490-568`) :
  - `career_read` lit les fichiers de l'utilisateur et `AGENTS.md`, `DATA_CONTRACT.md`, `modes/`, `templates/`, `references/`. Il refuse tout chemin qui contient un segment commençant par un point, donc `.agents/skills/career-ops/SKILL.md` (`R:tools.js:71-91`). Il refuse aussi `batch/batch-prompt.md`, alors que c'est la source du schéma Machine Summary (`S:modes/oferta.md`, « Machine Summary (required) »).
  - `career_write` écrit dans `cv.md`, `portals.yml`, `config/profile.yml`, `modes/_profile|_custom|_brief.md` et `(data|reports|output|documents|jds)/*.(md|txt|yml|json|tsv)` (`R:tools.js:82-83`). Il **autorise donc `data/applications.md` et `data/pipeline.md`** mais **refuse `batch/tracker-additions/*.tsv`** et `output/*.html`.
  - `career_offer_save` écrit `relay/offers/<uuid>.json` et, si une note est donnée, `reports/<uuid>.md` (`R:tools.js:173-191`).
  - `career_document` convertit le Markdown en PDF avec le moteur de rendu propre à Relay (`R:packages/career-ops/documents.js:13-112`).
  - `career_script` accepte seulement `scan`, `find`, trois contrôles (`jd-skill-gap`, `cv-title-check`, `verify-cv-facts`) et, en mode propriétaire, `scripts/<fichier>` (`R:tools.js:228-305`).
  - S'y ajoutent `email_send` (SMTP après accord, `R:packages/career-ops/sends.js:69-166`), `linkedin_draft`, `jobs_search_live` (Arbeitnow/Remotive, code Najah, `R:domain-packs/career-ops/index.js:1`, `R:domain-packs/najah/index.js:41-60`) et les outils `browser_*` qui pilotent le Chrome du propriétaire.
- **Outils natifs du CLI.** En mode propriétaire (`AGENT_PLATFORM_OWNER_MODE=1`, `R:index.js:142`), toute permission ACP autre qu'un envoi est accordée automatiquement (`R:index.js:1375-1386`). Pour Gemini, `assertCareerReview` *exige* que `tools.core` soit absent (`R:packages/career-ops/integration.js:72-79`), ce qui laisse tous les outils natifs de Gemini disponibles. **Déduit :** l'agent peut lancer `node merge-tracker.mjs`, `check-liveness.mjs`, etc. par son shell natif, sans aucun clic. La liste blanche de `career_script` ne borne donc pas réellement l'agent. Ces appels natifs restent en revanche **invisibles** pour le suivi d'étapes et pour le Bilan, qui ne reconnaissent que les outils MCP nommés (`R:packages/career-ops/truth.js:53-56`). `docs/api-career-ops.md:11` (« L'agent ne dispose que de l'activation de Skill comme outil natif ») est donc **périmé** (déduit).

---

## Q1. Les commandes du README et ce que Relay en fait

Légende : **Skill** = Relay laisse faire le Skill ; **Réimpl.** = Relay le refait avec ses outils ; **Bloqué** = impossible par les outils MCP ; **Natif** = possible seulement par le shell natif de l'agent, non suivi par Relay.

| Commande README | Attendu du Skill | Ce que fait Relay | Verdict | Degré |
|---|---|---|---|---|
| Coller une URL ou une annonce (`S:README.md:284,325`, `S:modes/auto-pipeline.md`) | Extraction, vérification que l'offre est ouverte (`check-liveness.mjs`, Step 0.5), liste noire, critères éliminatoires, A-G (+H si ≥ 4,5), `reports/{###}-…` avec numéro réservé, PDF (`modes/pdf.md`), TSV puis `merge-tracker.mjs` | Intention `evaluate` : lecture par `career_read jds/` ou par le navigateur, puis `career_offer_save` (`R:domain-packs/career-ops/skill-manifest.yaml:22-50`). Aucune étape de vérification d'ouverture, de PDF ni de suivi. `check-liveness.mjs`, `reserve-report-num.mjs` et `merge-tracker.mjs` sont absents de `career_script`. Le rapport est `reports/<uuid>.md` au format Relay. Le seuil H du manifeste est « si la note vaut 5 » (`R:manifest.yaml:39`) | **Réimpl.**, et la moitié manque. Le chemin conforme n'existe qu'en **Natif** | lu |
| `oferta` (`S:README.md:286`) | Comme ci-dessus, sans PDF automatique | Même intention `evaluate` | **Réimpl.** | lu |
| `scan` (`S:README.md:311`) | `node scan.mjs` (niveau 0), puis Playwright, API et WebSearch. Résultats ajoutés à `data/pipeline.md` + `scan-history.tsv` | `career_script scan` lance bien `scan.mjs --quiet` (`R:tools.js:342-343`). C'est le seul vrai appel au Skill. Mais un validateur Relay **refuse tout le scan** dès que `portals.yml` contient une clé `parser|command|script|plugin` ou un `provider` hors de `greenhouse, lever, ashby, workday, smartrecruiters, jobstreet` (`R:tools.js:311-330`). Le Skill livre plus de 100 fournisseurs (`S:providers/`), dont `arbeitnow`, `remotive`, `bamboohr`, `teamtailor`, et des parseurs locaux (`S:templates/portals.example.yml:5,785-787`) | **Skill, mais filtré** | lu |
| `pipeline` (`S:README.md:285`) | Tri des offres closes (`check-liveness --file`), pré-filtre, puis auto-pipeline pour chaque élément `- [ ]`, puis `- [x]` dans Processed | **Aucune intention, aucun outil dédié.** Les outils nécessaires ne sont pas dans `career_script`. Relay peut écrire `data/pipeline.md` à la main avec `career_write` | **Bloqué** côté MCP ; **Natif** possible | lu (absence) / déduit (natif) |
| `apply` (`S:README.md:310`, `S:modes/apply.md`) | Playwright lancé par le projet (`apply-scope.mjs launch-options`), interdiction de `connectOverCDP` et du Chrome de l'utilisateur, arrêt avant Submit, puis `set-status.mjs … Applied` | Intention `apply` : `browser_navigate` → `fillForm` → `upload` → `verify` → `snapshot` dans le **Chrome du propriétaire** (`R:skill-manifest.yaml:101-139`). `CAREER_OWNER_FRAME` demande de **cliquer le bouton final**, que la plateforme retient jusqu'au clic du propriétaire (`R:integration.js:24`). Pas de `set-status.mjs` | **Contourné** (décision écrite du propriétaire) | lu |
| `tracker` (`S:README.md:308`, `S:modes/tracker.md`) | `node tracker.mjs query`, statistiques, `set-status.mjs` | Pas d'intention. `tracker.mjs` et `set-status.mjs` ne sont pas dans `career_script`. Lecture possible de `data/applications.md` par `career_read` (déclaré optionnel, `R:manifest.yaml:26`). Relay a son propre tableau `GET /api/career/offers` → `relay/offers` (`R:apps/api/server.js:275-276`) | **Réimpl.** (vue parallèle) / lecture seule | lu |
| `followup` (`S:README.md:318`) | `node followup-cadence.mjs`, puis brouillons | Pas d'intention. `followup-cadence.mjs` absent. `scripts/followup-sweep.sh` passe la liste blanche (mode propriétaire, avec accord) mais lance lui-même un CLI agent sans surveillance (`S:scripts/followup-sweep.sh:1-51`) | **Bloqué** / **Natif** | lu |
| `pdf` (`S:README.md:298`) | `cv-title-check`, `build-cv-html.mjs` avec modèle, `verify-cv-facts`, `generate-pdf.mjs`, `data/pdf-index.tsv` | Intention `documents` : `career_write` puis `career_document`, avec un rendu Markdown → HTML minimal et une police Arial fixe, **sans contrôle des faits**, sans `pdf-index.tsv`, et un nom `output/<uuid>.pdf` (`R:documents.js:67-112`, `R:skill-manifest.yaml:83-100`). `cv-title-check` et `verify-cv-facts` sont exposés, mais seulement sur `output/*` et sans les options du Skill (`--summary`, `S:modes/pdf.md:49`) | **Réimpl.** | lu |
| `cover` (`S:README.md:302`) | `generate-cover-letter.mjs --payload` | Même intention `documents` (`career_write` + `career_document`) | **Réimpl.** | lu |
| `email` (`S:README.md:303`) | Brouillon seulement, « no mail transport » (`S:README.md:163`, `S:modes/email.md:15`) | `email_send` envoie par SMTP réel après accord (`R:sends.js:27-166`) | **Contourné** (ajout d'un transport) | lu |
| `discover` (`S:README.md:312`) | `discover-ats.mjs --summary` puis `--write` | Absent de `career_script`. `career_write portals.yml` est possible à la main | **Bloqué** / **Natif** | lu |
| `contacto` | Brouillon LinkedIn ≤ 300 caractères | `linkedin_draft` (Relay) : texte libre, ouvre le profil dans le Chrome du propriétaire | **Réimpl.** | lu |
| Autres commandes (`deep`, `interview-prep`, `patterns`, `outcome`, `batch`, `titles`, `upskill`…) | Mode + scripts propres | Aucune intention. Le mode est lisible par `career_read modes/…`. Les scripts sont absents de `career_script`. `batch` (CLI sans surveillance) n'est pas prévu | **Natif** seulement | lu / déduit |
| `find` (outil) | `find.mjs` | `career_script find` avec `--json` (`R:tools.js:344`) | **Skill** | lu |

Commandes réellement laissées au Skill par l'interface MCP : **`scan` (filtré), `find`, trois contrôles**. Tout le reste est réimplémenté, bloqué, ou dépend du shell natif auto-approuvé, que Relay ne suit pas.

## Q2. Contrat de données : divergences nommées

| # | Divergence | Skill | Relay | Degré |
|---|---|---|---|---|
| D1 | Nom du rapport | `reports/{###}-{slug}-{date}.md`, numéro réservé par `reserve-report-num.mjs` (`S:modes/oferta.md` §1, `S:docs/ARCHITECTURE.md:93`) | `reports/<uuid>.md` (`R:tools.js:181-189`) | lu |
| D2 | En-tête du rapport | `**Date/URL/Via/Archetype/Score/Decision/Legitimacy/Work Auth/PDF:**`, puis la phrase Verdict | `Note : X/5`, `Source : url` | lu |
| D3 | Corps du rapport | Machine Summary YAML obligatoire, A-G, Verdict, Risk Summary, Score Evidence, H, mots-clés, Keyword Coverage, annonce archivée mot pour mot (obligatoire, #2789) | `## A` … `## G` (`## H` facultatif) en texte libre de 10 000 caractères au plus par section (`R:tools.js:15-21`). Pas de Machine Summary, pas d'annonce archivée, pas de Legitimacy | lu |
| D4 | Échelle de note | Note globale 1-5 avec décimales (exemples `4.2/5`, `2.1/5`, `S:modes/pipeline.md:69-70`), seuil H ≥ 4,5 | `z.number().int().min(1).max(5)` (`R:tools.js:44`) : 4,5 ne peut pas s'écrire. Le manifeste en tire « H si la note vaut 5 » (`R:manifest.yaml:39`) | lu |
| D5 | Ligne de suivi | TSV dans `batch/tracker-additions/` puis `merge-tracker.mjs`, statut `Evaluated` | **Aucune ligne produite.** `career_write` refuse `batch/…` mais autorise l'écriture directe de `data/applications.md`, que le Skill interdit (`S:AGENTS.md:661`) | lu |
| D6 | Magasin d'offres | `data/pipeline.md` (boîte d'entrée) + `scan-history.tsv` | `relay/offers/<uuid>.json`, absent du contrat de données (`S:DATA_CONTRACT.md`). **Les fiches Relay n'apparaissent pas dans `data/pipeline.md`**, donc `pipeline` ne les traite jamais. À l'inverse, Relay ne relit pas `data/pipeline.md` | lu |
| D7 | Annonce collée sans URL | Prise en charge (on saute la vérification d'ouverture, `S:modes/auto-pipeline.md:39`) | `url` obligatoire au format `https?:` (`R:tools.js:25-29`) : une annonce sans lien ne peut pas être enregistrée | lu |
| D8 | PDF | `output/cv-{candidate}-{report}-{company}-{date}.pdf` + `data/pdf-index.tsv`, colonne PDF ✅ | `output/<uuid>.pdf`, puis copie dans `inputs/<uuid>.pdf` (`R:documents.js:109-111`). Pas de lien avec le rapport | lu |
| D9 | CV | `cv.md` en Markdown propre (sections `## Experience`…) rédigé avec l'utilisateur ; documents bruts dans `documents/` via `intake`, avec confirmation avant écriture (`S:AGENTS.md:232-241`, `S:AGENTS.md:39-50`) | Chaque téléversement **écrase `cv.md`** avec la sortie brute de `pdftotext -layout` ou `textutil` (`R:workspace.js:107`). Les contrôles du Skill qui repèrent les titres (`cv-title-check`, `jd-skill-gap`) en sont dégradés | lu / déduit (effet) |
| D10 | Dossiers hors contrat | Couche utilisateur listée exhaustivement | Relay crée `relay/`, `inputs/`, `drafts/`, `outbox/` dans le clone. L'updater du Skill ne les connaît pas | lu / déduit |
| D11 | États | `templates/states.yml` : Evaluated → Applied → … | Aucun état. `score`/`report` null valent « non évalué ». Pas de `Applied` après une candidature | lu |
| D12 | Mise à jour | Une réévaluation retrouve la ligne existante (fusion) | « Chaque appel crée donc une offre : il n'existe pas de mise à jour » (`R:docs/api-career-ops.md:64`) | lu |

**Qui produit quoi (lu) :** `data/pipeline.md` et `scan-history.tsv` sont produits par le script du Skill (`scan.mjs`) quand le scan passe le filtre. `reports/*.md` vient de **Relay** (`career_offer_save`), ou du Skill seulement si l'agent écrit lui-même par le shell natif (déduit). `data/applications.md` n'est **jamais produit par Relay par un chemin conforme**, et seulement en natif.

## Q2 bis. Isolement entre missions (question ajoutée par le coordinateur)

Ce qui suit vient du code de Relay et de ce que la documentation publique dit de Claude Code. Le contenu de `~/.claude` n'a pas été lu.

### Ce que Relay isole réellement (lu)

| Élément | Gemini | Claude Code (authentifié par compte) |
|---|---|---|
| Maison de l'agent | Isolée par mission **seulement avec une clé API** : `apiKeyAuth.homeEnv = GEMINI_CLI_HOME` (`R:packages/agent-runtime/profiles.js:49-56`). Le chemin `agentHomeFor(homesBase…)` (`R:index.js:927`) vaut `<espace>/relay/agent-homes/<run>/gemini` (`R:index.js:65-66`, `R:packages/orchestrator/isolation.js:22`), supprimé en fin de mission (`R:isolation.js:23-24`, `R:index.js:1368`). La maison n'est créée et transmise que si `usesApiKeyAuth()` est vrai (`R:agent-runtime/index.js:114-127`) | **Aucune.** Le profil `claude` n'a pas d'`apiKeyAuth` (`R:profiles.js:26-36`), donc pas de maison de mission. `HOME` est transmis tel quel (`R:packages/agent-runtime/env.js:3-6,19-24`), de même que `CLAUDE_CONFIG_DIR` s'il est défini chez le parent (`R:profiles.js:31`) |
| Mémoire automatique | n/a | **Coupée** : `fixedEnv: { CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' }`, avec le commentaire « Its automatic memory is shared by every session of a project: missions must not inherit it » (`R:profiles.js:32-33`). Ce réglage est conservé pour career-ops, qui ne fait qu'étendre `fixedEnv` (`R:index.js:906-908`). L'hypothèse du coordinateur (« MEMORY.md partagé, l'agent se souvient ») est donc **contredite par le code** pour la mémoire automatique. Que l'adaptateur `claude-agent-acp` respecte bien cette variable n'est **pas vérifié** |
| Session | Toujours `session/new` ; `session/load` est refusé (`replay_unqualified`, `R:agent-runtime/index.js:318-327`). La suite d'une conversation passe par un point de reprise de la plateforme (`R:isolation.js:20-21`, `checkpoint.js`) | Idem : pas de rejeu de l'historique d'une session précédente |
| Dossier de travail (`cwd`) | L'espace career-ops, le même pour toutes les missions (`R:index.js:661-664`) | Idem |

### Ce qui fuit malgré tout (déduit)

1. **Transcriptions et résultats d'outils.** Claude Code range ses sessions par projet, c'est-à-dire par `cwd`, sous `~/.claude/projects/<chemin encodé>/` (documentation publique). Avec un `cwd` unique, **toutes les missions career-ops écrivent dans le même dossier**. Elles ne sont pas rechargées automatiquement (session neuve à chaque fois, mémoire coupée). En revanche, l'agent peut les **relire par ses outils natifs**, qui sont auto-approuvés en mode propriétaire (`R:index.js:1380-1386`). Rien ne le lui interdit et rien ne le lui suggère.
2. **Configuration personnelle du propriétaire.** Avec le `HOME` réel, Claude Code charge `~/.claude/CLAUDE.md`, `~/.claude/settings.json` (crochets, permissions), les Skills, extensions et serveurs MCP de l'utilisateur (documentation publique). Ces éléments s'appliquent à **chaque** mission career-ops, à côté des consignes de Relay. C'est la fuite la plus réelle : la configuration personnelle peut modifier le comportement de la mission, dans les deux sens.
3. **Tout ce que le Skill garde volontairement d'une mission à l'autre** (`data/`, `reports/`, `cv.md`) est partagé, comme il se doit. Les fichiers propres à Relay (`relay/offers`, `relay/runs`, `inputs/`) le sont aussi, et l'agent peut les relire par `career_offers` ou par son shell.
4. **Conséquence sur les consignes du Skill.** `S:AGENTS.md:58-60` prévoit la mémoire automatique pour « l'état opérationnel » (rôles postulés, préférences). Relay la coupe. Ce n'est pas une contradiction de méthode, mais la continuité ne vient alors **que** des fichiers du Skill et du point de reprise de Relay.

### Options qui ne restreignent pas l'agent, et leur effet sur les données du Skill (déduit)

| Option | Ce qu'elle isole | Effet sur `data/pipeline.md`, le suivi, les rapports | Coût et risque |
|---|---|---|---|
| A. Statu quo (mémoire coupée, session neuve) | Mémoire automatique, historique de session | Aucun : tout reste partagé dans le clone | Transcriptions accumulées et lisibles ; configuration personnelle chargée |
| B. `CLAUDE_CONFIG_DIR` par mission, sur le modèle de `GEMINI_CLI_HOME` (`agentHomeFor`) | Transcriptions, réglages, crochets, Skills et MCP personnels | Aucun : `cwd`, `CAREER_OPS_ROOT` et `CAREER_OPS_DATA_DIR` désignent toujours le clone | Avec une authentification par compte, les identifiants et `.claude.json` vivent dans le dossier de configuration ou dans le trousseau macOS. Un dossier vide peut forcer une reconnexion, ou demander de copier ou relier les identifiants (non vérifié). C'est à essayer sur une mission jetable |
| C. `cwd` distinct par mission (dossier vide), avec `CAREER_OPS_ROOT` pointant sur le clone | Projet Claude Code (transcriptions) par mission | Les données utilisateur restent partagées, car le Skill les résout par la racine de données (`S:DATA_CONTRACT.md:195-210`). Mais les **scripts et `modes/` se résolvent depuis le dépôt**, et `AGENTS.md` / `CLAUDE.md` ne seraient plus chargés automatiquement depuis le `cwd`. L'agent devrait se placer dans le clone (`cd`), ce qui ramène les transcriptions au projet partagé si Claude Code suit le changement de dossier (non vérifié). Un lien symbolique est exclu : `CareerWorkspace.path()` refuse un espace symbolique (`R:workspace.js:60-65`) | Le plus intrusif pour la méthode du Skill. Déconseillé |
| D. Restreindre les sources de réglages de l'adaptateur (par exemple « projet seulement » si `claude-agent-acp` l'expose) | Configuration personnelle (point 2) | Aucun | Option de l'adaptateur non vérifiée dans ce dépôt |
| E. Pas de `session/load` | Déjà le cas (`R:agent-runtime/index.js:318-327`) | Aucun | n/a |

Recommandation de relecteur : B, éventuellement combinée avec D, est la seule option qui isole sans toucher au Skill ni aux données partagées. Il faut d'abord vérifier comment l'authentification par compte survit à un `CLAUDE_CONFIG_DIR` vide. Ne pas retenir C.

## Q3. Ordre des phases et replis

- **Ordre du manifeste** (`R:manifest.yaml:31-41`) : lire le CV, puis scan, puis `jobs_search_live` en secours, puis `career_offer_save`, puis `email_send`. **La phase `pipeline` a disparu**, de même que la production (PDF et suivi). On passe directement de « recherche » à « enregistrer une fiche » (lu).
- **Intention `search`** (`R:skill-manifest.yaml:51-82`) : `scan` (obligatoire, sauf si le prompt contient une phrase de `unlessPhrases`), puis `career_offer_save` (`readFirst`). Pour le Skill, le scan se termine dans `data/pipeline.md` et l'évaluation est une commande distincte. Relay enchaîne scan et enregistrement de fiches **dans un autre magasin** (lu).
- **Routeur** : `selectSkillIntents` ne garde qu'**une seule intention** (`R:packages/orchestrator/skill-router.js:183`), choisie par priorité (search 100 > evaluate 90 > documents 70 > apply 60). Un prompt du type « trouve et postule » ne suit donc que `search` (lu). `formatSkillOrder` dit « sans imposer une méthode ni un ordre » (`R:skill-router.js:189`), alors que `requiredOrder` annonce « Sans elles, la plateforme déclare la mission incomplète » (`R:skill-router.js:227`) et que le Bilan signale un « Écart d'ordre » : **message contradictoire** (lu).
- **Replis** :
  - Si le scan échoue (code non nul), le secours est `jobs_search_live` (Arbeitnow, Remotive), selon `R:skill-manifest.yaml:10-11` et la description de l'outil `R:najah/index.js:51`. C'est une **invention de Relay**, réutilisée de Najah. Le Skill possède lui-même les fournisseurs `arbeitnow` et `remotive`, mais le filtre de Relay les refuse dans `portals.yml` (`R:tools.js:321`) : le secours remplace une fonction du Skill que Relay a bloquée (lu).
  - Si un portail échoue (réseau, 403), il faut « lis ses offres dans le navigateur » (`R:skill-manifest.yaml:9`). Le Skill prévoit bien Playwright (niveau 1) puis WebSearch (niveau 3, avec vérification d'ouverture avant ajout à `pipeline.md`, `S:modes/scan.md:128,166-176,261-280`). Le repli « navigateur » de Relay ressemble au niveau 1, mais **sans** l'ajout à `pipeline.md` ni l'écriture dans `scan-history.tsv`, et il passe par le Chrome du propriétaire au lieu du Playwright du projet (déduit).
  - Pour lire une offre, Relay prescrit `browser_navigate` puis `browser_snapshot` (`R:skill-manifest.yaml:12-16`). Le Skill commence par `check-liveness.mjs` (API ATS gratuites) et par la règle LinkedIn « une seule tentative » (`S:AGENTS.md:521-539`). La règle LinkedIn n'est pas reprise par Relay (lu, absence).

## Q3 bis. Offres déjà vues, évaluées ou postulées (question ajoutée par le coordinateur)

### Les mécanismes du Skill (lu)

Ils existent tous au commit `2d6ed58` : `url-key.mjs`, `dedup-tracker.mjs`, `precheck-duplicate.mjs` (lecture seule, consultatif, lit le suivi), `evaluation-cache.mjs`, `templates/states.yml`, `lib/scan-history-columns.mjs`.

- Le scan déduplique contre `data/scan-history.tsv` (URL déjà vue), contre `data/pipeline.md` et contre `data/applications.md` (entreprise) (`S:modes/scan.md:183-184,251-253`).
- **Chaque offre examinée** reçoit une ligne dans `scan-history.tsv`, avec le statut `added`, `skipped_dup`, `skipped_title`, `skipped_location`, `skipped_age`, `skipped_expired`, `skipped_error`, etc. (`S:modes/scan.md:283-286,316-335`, `S:DATA_CONTRACT.md:41`).
- `apply` lance `precheck-duplicate.mjs` avant d'écrire un CV (`S:modes/apply.md:53`). `merge-tracker.mjs` déduplique d'abord par URL normalisée (`S:AGENTS.md:647`).

### Ce que fait Relay (lu)

- `career_offer_save` **ne fait aucun contrôle de doublon.** Pas d'appel à `url-key`, `precheck-duplicate` ni `evaluation-cache`, pas de lecture de `scan-history.tsv`, de `pipeline.md` ni de `applications.md`. Chaque appel crée un nouvel UUID (`R:tools.js:173-191`), et la documentation le dit en toutes lettres : « il n'existe pas de mise à jour par identifiant » (`R:docs/api-career-ops.md:64`). Le seul champ d'identité, `sourceOfferId`, est « simple donnée qui n'est jamais utilisée » (`R:docs/api-career-ops.md:65-66`). La même offre évaluée deux jours de suite donne deux fiches et deux rapports.
- Aucune ligne du code career de Relay ne lit ni n'écrit `scan-history.tsv` ou `pipeline.md` (`grep` sans résultat dans `R:packages/career-ops/*.js`).
- Aucun état n'est enregistré : pas d'`Evaluated`, pas d'`Applied`, pas de `set-status` après une candidature (voir D11).

### Une offre enregistrée hier par Relay est-elle « déjà connue » du Skill ? (déduit)

**Non**, par aucun des trois canaux de déduplication :

- elle n'est pas dans `scan-history.tsv` (sauf si `scan.mjs` l'avait lui-même trouvée) ;
- elle n'est pas dans `pipeline.md` ;
- elle n'est pas dans `applications.md`.

`scan` peut donc la remettre dans `pipeline.md`, et `pipeline` l'évaluerait de nouveau. Réciproquement, Relay ne sait pas qu'une offre a déjà été évaluée ou postulée par le Skill, sauf si l'agent lit lui-même le suivi.

### Les offres examinées mais non retenues (les « ~3 000 perdues »)

| Source de la recherche | Trace | Degré |
|---|---|---|
| `career_script scan` qui passe le filtre Relay | **Gardée par le Skill** : `scan.mjs` écrit chaque offre examinée dans `data/scan-history.tsv` avec son statut, et ajoute les retenues à `pipeline.md`. Relay lance ce script et ne retire rien. Les offres ne sont donc **pas perdues** : elles sont dans `scan-history.tsv`, mais Relay ne les montre nulle part (son tableau ne lit que `relay/offers`, `R:apps/api/server.js:275-276`) | lu (code) / déduit (pas de fichier lu) |
| Scan refusé par le filtre de `portals.yml` (`R:tools.js:311-330`) | Aucune exécution, donc aucune trace | lu |
| `jobs_search_live` (Arbeitnow, Remotive) | **Aucune trace par offre.** Seule existe une cache de réponses HTTP de la plateforme, indexée par empreinte d'URL, dans `<dataDir>/cache/data` (`R:index.js:273`, `R:packages/data-gateway/index.js:42,212-222`). Elle est hors du clone et illisible par le Skill. Les offres que l'agent n'enregistre pas par `career_offer_save` n'existent plus qu'à l'état de texte dans sa réponse | lu |
| Lecture par le navigateur (repli « portail en échec ») | Aucune trace, sauf `career_offer_save` sur les offres retenues | lu |

Conclusion (déduit) : si les ~3 000 offres viennent du scan du Skill, elles sont dans `data/scan-history.tsv` et ne sont pas visibles dans Relay. Si elles viennent de `jobs_search_live` ou du navigateur, rien ne les garde. Contrôle simple à faire par le propriétaire, que ce relecteur n'a pas fait faute d'accès : compter les lignes de `data/scan-history.tsv` après le dernier scan.

Comblement dans le périmètre du manifeste : déclarer dans `skill-manifest.yaml` une étape `precheck` (`career_script precheck-duplicate`, à ajouter à la liste blanche) avant `save-evaluation` et avant `apply/open`, et une étape « ajouter à `pipeline.md` » pour les offres de `jobs_search_live` ou du navigateur, afin que la déduplication du Skill les voie.

## Q4. Règles métier codées en dur dans le moteur (inventaire du `grep`)

Commande : `grep -n -i "career\|pack\.id\|candidature\|postuler\|offre"` sur `packages/orchestrator/*.js`, `packages/browser-gateway/*.js`, `packages/mcp-gateway/server.js`, `apps/api/server.js` (lu).

### packages/orchestrator/index.js

| Ligne | Ce qu'elle fait | Pourrait venir du manifeste ? | Restreint l'agent ? |
|---|---|---|---|
| 2-8, 36, 45-47 | Importe `CAREER_INSTRUCTIONS`, `CAREER_OWNER_FRAME`, `CareerWorkspace`, `formatCareerBilan`, `careerFailureMessage` | Oui (consignes, espace, Bilan déclarés par le pack) | Non |
| 66 | Dossier des homes d'agent dans `relay/` du clone pour career-ops | Oui (`workspace` du pack) | Non |
| 72 | `workspace: z.enum(['career-ops'])`, le seul espace privé possible | Oui | Oui (un seul espace privé) |
| 100 | Libellé « offres et évaluations non vérifiées » | Oui | Non |
| 141, 151, 169, 182 | Espace career, délai de mission de 15 min réservé à career-ops | Oui (`timeout` du pack) | Non |
| 259-266 | Transmet `RELAY_CAREER_WORKSPACE` et les variables `CAREER_SMTP_*` à la passerelle | Oui (variables déclarées par le pack) | Non |
| 402-416 | Une pièce jointe, le pack career-ops ou un routage auto vers career-ops **force** pack = career-ops, mode agent, supprime `workflow` et refuse tout autre Skill | Partiellement | **Oui** : aucun autre Skill dans l'espace privé, pièce jointe = career-ops |
| 420 | Le parcours `browser-agent` est exclu pour `najah` et `career-ops` | Oui | Non |
| 437, 453 | Ajoute le Skill career-ops, vérifie sa revue et son empreinte | Oui (revue déclarée) | Oui (refus si l'empreinte change) |
| 467-468 | Choix du modèle Gemini annoncé, pour career-ops seulement | Oui | Non |
| 592-594 | Message « Chaque envoi SMTP ou soumission exige votre approbation » | Oui | Non |
| 605-645 | Prompts et entrées privés dans `relay/runs/` ; une seule mission career-ops active à la fois | Oui | Oui (sérialisation) |
| 663-675 | Le dossier de mission est le clone ; titre « Candidature » hors mode propriétaire | Oui | Non |
| 707-714 | Prompt masqué en base pour career-ops | Oui (confidentialité du pack) | Non |
| 809 | Diagnostic d'échec réservé à career-ops | Oui | Non |
| 845 | Délai propre au pack | Oui | Non |
| 892-897 | Exporte les Skills autres que career-ops | Oui | Non |
| 901 | `CAREER_OWNER_FRAME` dans le canal système | Oui (consigne système du pack) | Non (au contraire, il lève des règles du Skill) |
| 905-919 | `CAREER_OPS_ROOT`, `CAREER_OPS_DATA_DIR`, réglages Gemini, `GEMINI_MODEL` | Oui | Gemini : hooks et extensions désactivés |
| 924 | `ownerMode` forcé à vrai dans le runtime ACP pour career-ops | Oui | Non (élargit) |
| 962-963, 992, 1075, 1094 | Flux et causes masqués, texte brut accepté comme réponse | Oui | Non |
| 1027 | Pièces jointes career | Oui | Non |
| 1034-1035 | Choix de `CAREER_INSTRUCTIONS` | Oui | Voir Q5 |
| 1059 | Message d'échec d'authentification | Oui | Non |
| 1173-1240 | Bilan career : mention « Notes non vérifiées » si une note `x/5` apparaît sans `career_offer_save`, sans `career_read jds/` ni capture ; neutralisation d'une reprise courte sans navigateur ; Bilan `formatCareerBilan` ; résultat privé | Partiellement (critères de preuve déclaratifs) | **Oui, indirectement** : seuls les outils Relay comptent comme preuve, une évaluation conforme au Skill faite en natif est déclarée « non vérifiée » ou « évaluation enregistrée » manquante |
| 1243, 1253, 1285, 1305-1343 | Formats de Bilan, compteur d'envois, messages d'échec | Oui | Non |
| 1368, 1461 | Nettoyage des homes, titre d'outil stocké pour une permission career | Oui | Non |

### Autres fichiers

| Fichier:ligne | Ce qu'elle fait | Manifeste ? | Restreint ? |
|---|---|---|---|
| `orchestrator/failure.js:61-62` | `careerFailureMessage` : causes montrables pour une mission privée | Oui | Non |
| `orchestrator/workflow-run.js:251,305-307` | Consigne du DAG (pas de shell) ; `verifyPack` | Générique | Concerne les DAG, pas career |
| `orchestrator/skill-router.js:189` | « Lis le mode pertinent du Skill **via career_read** » : nom d'outil career codé en dur dans le routeur générique | **Oui** (devrait venir de `toolRoles`) | Oriente vers `career_read`, qui ne peut pas lire `SKILL.md` ni `batch/` |
| `orchestrator/skill-router.js:164-166` | `intent.id === 'evaluate'` et `step.id !== 'save-evaluation'` codés en dur (« n'enregistre pas ») | **Oui** (une option `unlessPhrases` sur l'étape suffirait) | Non |
| `orchestrator/skill-router.js:210-211, 407` | Règle « Ne note une offre qu'après avoir lu sa page » et cause « offre(s) notée(s) sans lecture » : vocabulaire métier dans le routeur | Oui (`readFirst` existe déjà, le texte pourrait venir du pack) | Non |
| `career-ops/truth.js:5-14, 150-225` | Expressions régulières françaises « postule/envoie/évalue/CV/lettre » qui déclarent des actions manquantes (« candidature », « évaluation enregistrée », « rédaction de document » si `career_write` est absent) | **Oui** (critères à déclarer dans le manifeste) | **Oui, indirectement** : pousse l'agent vers `career_write` et `career_offer_save` au lieu des scripts du Skill |
| `mcp-gateway/server.js:1-4, 94-106` | Compte rendu d'outil : `career_script` contenant « scan », `career_read jds/`, URL notée de `career_offer_save` | Oui | Non |
| `mcp-gateway/server.js:243-255` | Enregistrement **en dur** des outils career quand `pack.id === 'career-ops'` (le `register()` du pack est vide, `R:domain-packs/career-ops/index.js:2`) | **Oui** : c'est le rôle de `register()` | Fixe l'ensemble des outils |
| `mcp-gateway/server.js:257-270` | `registerLive` réexporté de Najah → `jobs_search_live` | Oui | Non |
| `browser-gateway/index.js:13` | Texte d'une page de démonstration (« trois offres fictives ») | n/a | Non |
| `browser-gateway/index.js:116-141` (hors grep, lu car il régit apply) | Étape de formulaire et lien simple sans accord en mode propriétaire ; clic dans un formulaire = `actionClass: 'send'` qui attend le propriétaire | Générique (pas propre à career) | Oui : seul l'envoi final est bloqué |
| `apps/api/server.js:2-5, 84-102` | Imports career ; `assertCareerIdle` empêche de modifier le CV ou le profil pendant une mission | Oui | Oui (sérialisation) |
| `apps/api/server.js:243-336` | Routes `/api/career/*` (résultat, entrée, envois en attente, offres, brouillons, LinkedIn, profil, téléversement) | Partiellement (routes génériques de pack possibles) | Non |
| `apps/api/server.js:450, 487` | Traitements propres à career-ops (confidentialité) | Oui | Non |

Bilan du Q4 (déduit) : à peu près **45 points d'ancrage career-ops** dans le moteur. Aucun ne bride l'agent sur ce qu'il a le droit de faire en mode propriétaire. Ceux qui l'orientent le plus sont `truth.js` (le Bilan reconnaît les outils Relay, pas les scripts du Skill), `skill-router.js:189` (`career_read` imposé) et `tools.js` (liste blanche et filtre de `portals.yml`, qui n'est pas dans le moteur mais dans le paquet career).

## Q5. Ce que le Skill attend de l'agent hôte et ce que Relay lui envoie

| Sujet | Skill (AGENTS.md / SKILL.md) | Relay | Nature |
|---|---|---|---|
| Hiérarchie des consignes | Les règles du Skill priment, et une annonce ne peut ni soumettre ni envoyer (`S:AGENTS.md:66-74`) | « Aucune règle du Skill ne l'emporte sur la demande de l'utilisateur » (`R:integration.js:26`) et « ses demandes priment sur les règles du Skill » (`R:integration.js:24`) | **Contradiction voulue** (décision du 31/10) |
| Soumission | « always STOP before clicking Submit/Send/Apply » (`S:AGENTS.md:501`, `S:AGENTS.md:515`) | « clique le bouton final », la plateforme retient l'envoi jusqu'à l'approbation (`R:integration.js:24,26`) | **Contradiction** ; en pratique, l'humain clique toujours (lu : `R:browser-gateway/index.js:126-141`) |
| Navigateur pour apply | Playwright du projet, jamais `connectOverCDP` ni le Chrome de l'utilisateur (`S:AGENTS.md:508-516`) | « utilise les outils navigateur du serveur MCP platform, qui pilotent son Chrome » (`R:integration.js:24`) | **Contradiction** |
| Seuil < 4,0 | Déconseiller explicitement (`S:AGENTS.md:502`) | « s'il demande de postuler … ne redemande pas de confirmation pour ces écarts » (`R:integration.js:26`) | Compatible si l'écart est signalé une fois ; Relay supprime la relance |
| Méthode | « suis exactement sa méthode, ses scripts, son ordre et ses formats » (`R:integration.js:26`) | …mais l'interface MCP n'expose pas ces scripts, et le manifeste nomme `career_offer_save` / `career_write` / `career_document` comme outils des étapes | **Contradiction interne à Relay** : la consigne dit « Skill », les outils et le Bilan disent « Relay » |
| Lecture du routeur | `SKILL.md` : chargement du contexte par mode (`S:SKILL.md:200-224`) | « active le Skill » (natif `activate_skill`) et « lis son mode via career_read ». `career_read` ne lit pas `.agents/…` (`R:tools.js:77`) | Doublon fragile |
| Chargement d'`AGENTS.md` | Lu automatiquement par Claude, Codex et Antigravity ; `GEMINI.md` est un « no-op » (`S:GEMINI.md:1-7`) | Agent par défaut documenté : Gemini (`R:docs/api-career-ops.md:4-5`). `relay/gemini-settings.json` ne fixe pas `context.fileName` (`R:integration.js:50-59`). **Déduit :** avec Gemini CLI, `AGENTS.md` (règles d'intégrité du suivi, vérification d'offre) n'est pas chargé, sauf si l'agent le lit lui-même | Manque probable |
| Questions | Le Skill pose ses questions en conversation (liste noire, agence, critères éliminatoires) | Règle de doute : formulaire ACP ou champ `question` (`R:doubt-rule.js:5-6`) ; `CAREER_INSTRUCTIONS` répète la même consigne (`R:integration.js:28`) | **Doublon** compatible |
| Données non fiables | `S:AGENTS.md:66-74` | `R:integration.js:27` | Doublon compatible |
| Pas d'invention | Source-of-Truth Boundary (`S:AGENTS.md:32-56`) | « Ne déduis jamais un fait absent du CV » (`R:integration.js:27`) | Doublon compatible ; mais le PDF Relay saute `verify-cv-facts`, le seul contrôle codé (`S:README.md:167`) |
| Format de réponse | Rapport, PDF et tableau récapitulatif du Skill | JSON `{simulated, summary, evidence}` obligatoire (`R:integration.js:28`) | Ajout de Relay, sans conflit |
| E-mail | « no mail transport » | `email_send` SMTP | **Contradiction** (ajout assumé) |

## Q6. Verdict

### Phase par phase

| Phase | Verdict |
|---|---|
| Installation et CV | **Contourné** : `cv.md` est écrasé par du texte brut à chaque téléversement, sans `intake` ni confirmation |
| Scan | **Respecté, mais filtré** : vrai `scan.mjs`, mais refusé en entier dès qu'un fournisseur sort de la liste de 6 ou qu'un parseur local est configuré |
| Pipeline (boîte d'entrée) | **Manquant** : ni intention ni outil ; les fiches Relay n'y entrent jamais |
| Vérification d'ouverture | **Manquant** (`check-liveness.mjs` inaccessible par MCP) |
| Évaluation A-G(H) | **Réimplémenté** : format, nom de fichier, note entière et seuil H propres à Relay ; pas de Machine Summary ni d'annonce archivée |
| Production (CV PDF, lettre) | **Réimplémenté** : moteur de rendu Relay, sans modèle du Skill ni contrôle des faits |
| Suivi | **Manquant** (aucune ligne TSV ni fusion ; écriture directe possible, donc risque de violer la règle 1 de « Pipeline Integrity ») |
| Apply | **Contourné** (Chrome du propriétaire, clic final retenu par la plateforme ; décision écrite du propriétaire), sans `set-status Applied` |
| Relances, découverte, tracker | **Manquant** côté MCP ; possible en natif sans suivi |
| E-mail | **Contourné** (transport SMTP ajouté, envoi soumis à accord) |

### Les 5 écarts les plus graves pour un utilisateur qui attend le comportement du README

1. **Aucune ligne de suivi.** « evaluate + report + PDF + tracker » (`S:README.md:284`) devient « une fiche dans `relay/offers` ». `data/applications.md`, le tableau de bord TUI, `tracker`, `followup` et `patterns` ne voient aucune évaluation faite par Relay (D5, D6).
2. **Deux magasins qui s'ignorent.** Le scan du Skill remplit `data/pipeline.md`. Relay enregistre ailleurs, ne traite jamais la boîte d'entrée, et n'a pas de commande `pipeline`. Les éléments `- [ ]` s'accumulent.
3. **Rapports incompatibles avec les scripts du Skill.** `reports/<uuid>.md` sans numéro, sans en-tête `**Score:**/**URL:**/**Legitimacy:**`, sans Machine Summary ni annonce archivée, avec une note entière (4,5 impossible, H seulement à 5). `find`, `verify-pipeline`, `keyword-match`, `calibrate` et la réservation de numéros ne les comprennent pas (déduit pour chaque script).
4. **Offres mortes évaluées et CV non contrôlé.** Pas de `check-liveness.mjs` avant l'évaluation, ni de `verify-cv-facts` / `generate-pdf.mjs` avant le PDF. C'étaient les deux garde-fous « en code » mis en avant par le README (`S:README.md:149`, `S:README.md:167`).
5. **Scan refusé en entier par un filtre Relay** dès que `portals.yml` sort de 6 fournisseurs ou contient un parseur local. Le repli `jobs_search_live` (Arbeitnow/Remotive) réimplémente des fournisseurs que le Skill possède déjà et que ce même filtre interdit. En plus : **`cv.md` écrasé** par le texte brut du PDF à chaque téléversement.

(Les écarts sur apply et l'e-mail sont réels mais correspondent à une décision écrite du propriétaire. Ils ne figurent pas dans les cinq ci-dessus pour cette raison.)

### Comment les combler sans toucher au Skill ni refondre l'architecture

Le périmètre est le manifeste existant (`manifest.yaml`, `skill-manifest.yaml`) plus des listes et constantes déjà présentes dans le paquet career. Rien ne met en œuvre `docs/architecture-cible.md`.

1. **Suivi.** Ajouter une étape `track` à l'intention `evaluate` avec `tool: career_script`, `argument: merge-tracker`. Dans la liste blanche existante de `career_script` (`R:tools.js:284-292`, même mécanisme que `controls`), ajouter `merge-tracker`, `reserve-report-num`, `set-status`, `tracker` (query), `check-liveness`, `verify-pipeline`, `followup-cadence`, `keyword-match`, `discover-ats --summary` comme entrées audités du Skill. Ajouter `batch/tracker-additions/*.tsv` à `userPath` de `career_write`, et en **retirer** `data/applications.md`, pour respecter la règle 1 du Skill.
2. **Évaluation au format du Skill.** Dans `skill-manifest.yaml`, remplacer `save-evaluation: career_offer_save` par `career_write` sur `reports/` (argument `reports/`), précédé de `career_script reserve-report-num`, ou garder `career_offer_save` seulement comme index secondaire. Corriger `manifest.yaml:39` (« H si note ≥ 4,5 ») et accepter une note décimale. Ouvrir `batch/batch-prompt.md` à la lecture (`systemPath`).
3. **Ordre du Skill.** Ajouter une intention `pipeline` (phrases « traite la boîte d'entrée », « pipeline ») avec les étapes `check-liveness` → évaluation → `career_write reports/` → TSV → `merge-tracker`, et une étape `liveness` obligatoire en tête de `evaluate` (avec `unlessPhrases` pour l'annonce collée sans URL). Faire pointer la fin de l'intention `search` sur « éléments ajoutés à `data/pipeline.md` » au lieu de `career_offer_save`.
4. **Scan.** Élargir la liste des `provider` acceptés à la liste du Skill (`providers/*.mjs`, en lecture seule), au lieu de six noms codés en dur. Rétrograder le `fallbackTools: jobs_search_live` du manifeste au profit des fournisseurs `arbeitnow`/`remotive` du Skill.
5. **Production.** Pointer l'intention `documents` sur `career_script` `build-cv-html` + `verify-cv-facts` + `generate-pdf`, avec écriture autorisée de `output/*.html|json`, et garder `career_document` comme simple pièce jointe pour `email_send`.
6. **CV.** Ne pas écrire `cv.md` lors d'un téléversement (`updateCv: false` par défaut). Déposer dans `documents/` et laisser le mode `intake` proposer.
7. **Bilan.** Faire déclarer les critères de `truth.js` par le manifeste (par exemple « évaluation enregistrée » = `reports/` écrit ou `merge-tracker` réussi), pour qu'un chemin conforme au Skill ne soit plus compté comme manquant. C'est la limite de « manifeste seulement » : ce point touche aussi `truth.js`.

## Q7. Non vérifié

- Aucun script n'a été exécuté. Le comportement réel de `find.mjs`, `verify-pipeline.mjs` et `reserve-report-num.mjs` face à `reports/<uuid>.md` est **déduit**, pas observé.
- Le chargement réel d'`AGENTS.md` par Gemini CLI dans Relay (réglage `context.fileName`, comportement d'`activate_skill`) n'est pas vérifié.
- Le contenu de `portals.yml` de l'utilisateur n'a pas été lu (interdit). On ne sait donc pas si le filtre bloque son scan aujourd'hui.
- L'usage effectif du shell natif par les agents lors des missions réelles n'a pas été vérifié (journaux `.data/` et `relay/runs/` interdits).
- `review-migration.js`, `no-network.cjs`, `sends.js` en entier, `cdp.js`, ainsi que les traductions des modes (`modes/fr/…`) n'ont pas été relus ligne à ligne.
- La valeur et l'état du reçu de revue `relay/source-review.json` (condition préalable au scan) n'ont pas été vérifiés : dossier interdit.
- Le frontend `agregat-front` n'a pas été relu.
- Q2 bis : non vérifié que `claude-agent-acp` respecte `CLAUDE_CODE_DISABLE_AUTO_MEMORY`, ni quels réglages utilisateur il charge, ni le comportement de l'authentification par compte avec un `CLAUDE_CONFIG_DIR` vide. `~/.claude` n'a pas été lu (interdit).
- Q3 bis : le nombre réel de lignes de `data/scan-history.tsv` n'a pas été compté (dossier interdit).
- Le pack career-ops reçoit aussi, par `registerLive` de Najah, les outils `sponsor_check_uk` et `opportunities_rank_live` (`R:domain-packs/najah/index.js:70-101`). Leur usage dans les missions career n'a pas été évalué.
- `docs/architecture-cible.md` n'a été parcouru que pour le constat (§2-3) : aucune proposition ici ne la met en œuvre.
