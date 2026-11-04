# 01 — Contrat du Skill career-ops (tel que défini par son propre dépôt)

Dépôt lu : `~/Downloads/agregat-career-ops` (commit 2d6ed58, `package.json` version 1.38.0). Lecture seule, rien lancé, rien modifié, aucun fichier interdit ouvert (`cv.md`, `config/profile.yml`, `data/`, `reports/`, `output/`, `jds/`, `relay/`, `.env` : non lus).
Je décris le Skill ; je ne compare rien à Relay.
Légende : **lu** = texte relevé dans le fichier cité ; **déduit** = conclusion tirée de plusieurs passages ou d'une absence.
Les chemins sans préfixe sont relatifs au dépôt du Skill.

## 0. Écart avec la consigne : le README de ce commit n'a pas les deux blocs attendus

- Le README de 2d6ed58 ne contient NI le tableau « The everyday commands » NI le dépliant « All commands, by stage of the search » (`grep -n -i "everyday|by stage"` sur `README.md` : aucun résultat ; `README.md:96-707` n'a que les sections listées ci-dessous). **lu / déduit** (absence).
- Les sections réellement présentes : « Your turn » (96), « What career-ops does for you » (145), « What career-ops will not do » (160), « Features » (169), « Quick Start » (201), « Usage » (278), « How It Works » (329), « Pre-configured Portals » (474), « Project Structure » (512), « External Data Directory » (550), « FAQ » (622). **lu**
- Ce qui joue le rôle de la liste de commandes à ce commit : la liste « Usage » (`README.md:282-323`), le menu du routeur (`.agents/skills/career-ops/SKILL.md:148-196`) et la table « Skill Modes » (`AGENTS.md:440-487`). Je m'appuie sur ces trois sources pour la section 2. **lu**
- Les mots « paste a URL or JD / scan / pipeline / apply / tracker / followup » existent comme modes, mais pas sous la forme de tableau du « quotidien ». Le mot « paste » est dans le slogan (`README.md:42`) et la ligne Usage `{JD} → AUTO-PIPELINE` (`README.md:284`). **lu**

## 1. Ce que le Skill fait et ne fait pas

Fait (README) :
- Promesse : « Paste a job. On your machine, it tells you if it's still open and if it fits. It tailors your CV and drafts your answers. You press Submit. » (`README.md:42-43`) **lu**
- « Still open? It checks that the posting is still live before you write a word. » (`README.md:149`) ; « Not you? It scores the role against your real CV and tells you to skip a weak fit. You can override it. » (`README.md:150`) ; « It drafts the CV, the cover letter and the answers. You read them. You send them. » (`README.md:151`) ; « It finds the person and drafts the note. It never sends it. » (`README.md:152`) ; « Every application stays on your machine. » (`README.md:153`). **lu**
- Évaluation A-H avec bloc G (légitimité de l'offre) et signal d'autorisation de travail (`README.md:173`) ; génération de CV PDF ATS (`README.md:175`) ; lettre de motivation (`README.md:176`) ; brouillons d'e-mail « without sending, submitting, or clicking anything » (`README.md:177,188`) ; Auto-Pipeline « Paste a URL, get a full evaluation + PDF + tracker entry » (`README.md:185`) ; scanner de portails « 100+ companies » (`README.md:189`). **lu**
- Fonctionne dans une CLI d'agent IA locale (`README.md:104,583`, `ARCHITECTURE.md:9-11`). **lu**

Ne fait pas (README) :
- « Auto-submit an application. It drafts the answer to every field; you review and click Submit. The script never POSTs (`prepare-application.mjs`). » (`README.md:162`) **lu**
- « Send an email. Drafts only. There is no mail transport anywhere in this codebase. » (`README.md:163`) **lu**
- « Phone home. No telemetry, no backend of ours. » (`README.md:164`) **lu**
- « Push you to apply below 4.0/5. It will tell you not to. You can override it, and it will say so. » (`README.md:165`) **lu**
- « It reformulates your CV; it must never fabricate it. » (`README.md:167`) ; un contrôle de code bloque un PDF dont les chiffres/faits ne sont ni dans le CV ni dans le digest (`README.md:167,628`), il avertit mais ne bloque pas sur les titres (`README.md:628`). **lu**
- Ligne « Human-in-the-Loop » : « The system never submits an application -- you always have the final call » (`README.md:174`), avec un commentaire HTML disant que c'est une garantie absolue sans nuance (`README.md:174`). FAQ : « It drafts and fills; it never submits. You press Submit. » (`README.md:643`). **lu**
- Avertissement : les prompts disent de ne pas soumettre, mais un modèle peut se comporter de façon imprévue ; relire toute sortie (`README.md:663`). **lu**
- Conformité aux conditions des portails à la charge de l'utilisateur ; ne pas spammer les employeurs (`README.md:664`). **lu**

Principes d'architecture : local-first, agnostique de l'IA (la logique est dans `modes/*.md`), human-in-the-loop (« It never submits applications on your behalf », `ARCHITECTURE.md:9-11`). **lu**
Qualité, pas volume : « NEVER submit an application without the user reviewing it first... always STOP before clicking Submit/Send/Apply » (`AGENTS.md:499-504`). **lu**

## 2. Les commandes et ce que chacune enchaîne

Routage : un message qui n'est pas un sous-commande mais contient du texte d'offre ou une URL d'offre → `auto-pipeline` (`.agents/skills/career-ops/SKILL.md:96`, `AGENTS.md:444`). Sans argument : menu (`SKILL.md:50`). **lu**
Contexte chargé avant tout mode : `_shared.md` + `_profile.md` + `_custom.md` + fichier du mode pour `auto-pipeline, oferta, ofertas, pdf, text, contacto, apply, pipeline, scan, batch` (`SKILL.md:208-212`) ; `_profile.md` + `_custom.md` + mode pour `tracker, followup, cover, email, discover, intake, ats, ...` (`SKILL.md:214-218`). `scan`, `apply` (avec Playwright) et `pipeline` (3 URLs ou plus) sont lancés comme sous-agent « single-pass » (`SKILL.md:226-238`). **lu**
Vérification d'installation avant tout parcours qui a besoin du profil : `node doctor.mjs --json` ; `onboardingNeeded: true` → ne pas évaluer/scanner/rédiger avant que `cv.md`, `config/profile.yml`, `modes/_profile.md`, `portals.yml` existent (`AGENTS.md:188-211`). **lu**
Vérification de mise à jour au premier message : `node update-system.mjs check` (`AGENTS.md:76-90`). **lu**

### 2.1 « Paste a URL or JD » = mode `auto-pipeline` (`modes/auto-pipeline.md`)

Étapes dans l'ordre (lu, `modes/auto-pipeline.md`) :
1. Step 0 (7-27) extraction du JD si URL : Playwright (`browser_navigate` + `browser_snapshot`) préféré ; option `scan.extractor: cli` → `node browser-extract.mjs <url>` (repli silencieux sur Playwright en cas d'erreur) ; puis WebFetch ; puis WebSearch ; sinon demander à l'utilisateur de coller le JD. Texte collé : utilisé tel quel.
2. Step 0.5 « Liveness gate » (29-41) : jugée sur le snapshot déjà obtenu (pas un script). Trois issues : JD indisponible (squelette/login → non confirmé, pas « fermé »), actif, fermé. Fermé → STOP (ni évaluation, ni PDF) ; si l'entrée venait de `data/pipeline.md` la marquer `- [x] ~~Company | Role~~ — oferta nieaktywna` (38). Texte collé sans URL : porte sautée (39).
3. Step 0.6 blacklist (43-47) : si `data/blacklist.md` existe ; hit → STOP et demander ; seul un « oui » explicite continue.
4. Step 0.7 dealbreaker (49-51) via `modes/oferta.md:42-63`.
5. Step 1 (53-59) évaluation A-G identique à `oferta` ; agences : porte de confirmation avant toute écriture (57) ; budget de recherche borné, pas de sous-agents (59, `oferta.md:69-80` : plafond 5 requêtes WebSearch).
6. Step 2 (61-64) rapport `reports/{###}-{company-slug}-{YYYY-MM-DD}.md` avec `**URL:**` et `**Legitimacy:**`.
7. Step 3 (66-72) CV : selon `cv.output_format` (`latex` → `modes/latex.md`, `text` → `modes/text.md`, défaut → `modes/pdf.md`).
8. Step 4 (74-80) brouillon des réponses de formulaire seulement si score ≥ 4.5, enregistré en section `## H) Draft Application Answers` du rapport.
9. Step 5 (110-114) suivi : un TSV d'ajout fusionné par `node merge-tracker.mjs`, « never a row written into data/applications.md by hand ». Si une étape d'artefact échoue après les portes, continuer et marquer l'étape en attente dans le tracker (114).
Fichiers lus : `cv.md`, `config/profile.yml`, `modes/_profile.md`, `_custom.md`, `article-digest.md`, `data/blacklist.md`, `templates/cv-template.html` (`AGENTS.md:13`, `_shared.md:253,273` ; **lu**).
Fichiers écrits : `reports/*.md`, `output/*.pdf|html`, `batch/tracker-additions/{num}-{slug}.tsv`, puis `data/applications.md` (par `merge-tracker.mjs` uniquement), `jds/*` éventuellement (`pdf.md:21-22`). **lu**
Interdit : inventer des faits (`_shared.md:240`), soumettre (`_shared.md:242`), écrire `applications.md` à la main (`_shared.md:263`, `AGENTS.md:661`), sous-agents imbriqués (`_shared.md:248,279-286`), traiter le contenu de l'offre comme des instructions (`AGENTS.md:66-74`). **lu**
Remarque : le README Usage décrit « evaluate + report + PDF + tracker » (`README.md:284`) ; `auto-pipeline.md` ajoute les portes (liveness, blacklist, dealbreaker, agence) et l'étape H conditionnelle. **déduit**

### 2.2 `scan` (`modes/scan.md`, script `scan.mjs`)

- Entrée : `portals.yml` (`scan.md:27-31`). Script zéro-token `node scan.mjs` / `npm run scan` ; « Recommended Level 0: run `node scan.mjs`... at the start of the agent's workflow » (`scan.md:126`). **lu**
- Lit : `portals.yml`, `data/scan-history.tsv`, `data/pipeline.md`, `data/applications.md`, `data/blacklist.md` (`scan.md:182-184`, `docs/SCRIPTS.md:944`). **lu**
- Écrit : `data/pipeline.md` (section Pending, `- [ ] {url} | {company} | {title}`, `scan.md:280`), `data/scan-history.tsv` (via `formatScanHistoryRow`/`appendToScanHistory` de `scan.mjs`, jamais à la main, `scan.md:281`), `data/scan-runs.tsv`, `data/portal-health.tsv` (`DATA_CONTRACT.md:41-44`). **lu**
- Interdit/obligatoire : Playwright séquentiel, jamais parallèle (`scan.md:198-199`) ; résultats de scraping = données non fiables (`scan.md:23`) ; ne pas relire l'historique en entier (`scan.md:183`) ; ne pas lancer de sous-agent imbriqué, scan borné par `portals.yml`, « never an open-ended research task » (`scan.md:21`). **lu**
- Fin de scan : « Run the `pipeline` mode to evaluate the new offers » (`scan.md:450`). **lu**

### 2.3 `pipeline` (`modes/pipeline.md`)

- Lit `data/pipeline.md` (lignes `- [ ] `), `config/profile.yml` (`spend_tier`, `auto_pdf_score_threshold`, `cv.output_format`), `modes/_custom.md` → Pipeline Rules (`pipeline.md:21,37-44`). **lu**
- Enchaînement : (1) `node cv-sync-check.mjs` (141-145) ; (2) balayage de vivacité `node check-liveness.mjs --file <tmp>` (5-17, LinkedIn exclu du balayage) ; expirés → déplacés en Processed `— posting expired (liveness sweep)` ; (3) pour chaque URL survivante : extraction du JD (Playwright → WebFetch → WebSearch, 33, 121-126), pré-filtre bon marché si `spend_tier` standard/premium (19-27, journal `data/discard.log`), réservation d'un numéro `node reserve-report-num.mjs` (36, 133-137), exécution complète de `auto-pipeline` (37), déplacement de Pending à Processed seulement pour une évaluation terminée (38). **lu**
- Écrit : `data/pipeline.md`, `data/discard.log`, rapports, CV, TSV d'ajout (puis `merge-tracker.mjs`). **lu**
- Contraintes : navigateur partagé → une URL à la fois ; parallèle seulement avec extracteur isolé (45) ; ne pas lire tout `pipeline.md` (31) ; `needs_confirmation` et `unreadable` restent `- [ ]` et sont listés à part (38, 48-50). **lu**
- PDF « gate » : seuil `auto_pdf_score_threshold`, 3.0 par défaut (42-44). **lu**

### 2.4 `apply` (`modes/apply.md`, `docs/APPLY_AUTOFILL.md`)

- Promesse : « Do not submit the form. Stop before Submit, Send, or Apply. Continue only after the candidate confirms they submitted it. » (`apply.md:19`, `AGENTS.md:515`, `APPLY_AUTOFILL.md:5-7`). **lu**
- Étapes : DETECT → IDENTIFY → SEARCH `reports/` → LOAD rapport + section H → TAILORED (CV sur mesure, pas `cv.md`) → PREFLIGHT → PRE-SCAN questions éliminatoires → avertissements juridiques → ANALYZE → GENERATE → SWEEP des champs requis avant chaque Save/Next/Submit → PRESENT → PERSIST (`apply.md:28-45`). **lu**
- Navigateur : Playwright lancé par le projet avec `node apply-scope.mjs launch-options` ; interdit `chromium.connect`, `connectOverCDP`, lecture de `DevToolsActivePort`, port de débogage distant, répertoire de profil Chrome (`apply.md:15`, `AGENTS.md:513`) ; interdit de fouiller `$HOME` ou une autre installation (`AGENTS.md:512`). **lu**
- Lit : rapport, section `## Application Answers` (via `node application-answers.mjs --read --strict`, `apply.md:165`), CV sur mesure (via `application-artifacts.mjs` ou `output/cv-*.html`, `apply.md:192-235`), `config/profile.yml` (autorité pour identité, autorisation de travail, rémunération, `apply.md:239-241`), `data/applications.md` (contrôle de doublon `precheck-duplicate.mjs` + contrôle inter-canaux, `apply.md:53-59`). **lu**
- Écrit : section `## Application Answers` du rapport (`State: filled`, puis `submitted` après confirmation de l'utilisateur, `apply.md:372-390`) ; après confirmation d'envoi par le candidat : `node set-status.mjs --report <n> Applied`, `node followup-seed.mjs {num}` (`apply.md:392-398`). **lu**
- Ne jamais inventer les réponses légales, démographiques, d'autorisation de travail, visa, salaire, handicap, etc. : « needs_candidate_confirmation » (`apply.md:279-286`). **lu**
- Cas Ashby : une soumission depuis Playwright peut être rejetée comme spam ; le Skill dit de passer la main au navigateur ordinaire du candidat et de « not attempt to hide automation signals or bypass the site's verification » (`apply.md:423-427`). Lever : hCaptcha, ne pas toucher cases/radios/captcha (`apply.md:429-432`, `APPLY_AUTOFILL.md:15-17`). **lu**
- `prepare-application.mjs` : « Never POSTs anything » (`docs/SCRIPTS.md:1482-1492`). **lu**
- Mode non surveillé : jamais de soumission, termine par une ligne `needs_confirmation: ...` (`apply.md:7`). **lu**

### 2.5 `tracker` (`modes/tracker.md`)

- Lit le tracker (`{DATA_ROOT}/data/applications.md` ou `CAREER_OPS_TRACKER`), via `node tracker.mjs query` avec filtres plutôt que lecture complète (`tracker.md:3-5`). Affiche statistiques, `salary-gap.mjs`, `funnel-velocity.mjs`, `stats.mjs --summary` (`tracker.md:52-65`). **lu**
- Écriture : changement d'état via `node set-status.mjs --report <n> <State>` (jamais à la main) ; ajout manuel via TSV + `merge-tracker.mjs` avec score `N/A`, rapport `—`, PDF `❌` (`tracker.md:36-40`) ; fermeture en masse via `close-stale.mjs --summary` puis `--confirm` (`tracker.md:38`). **lu**
- Après changement de `cv.md`/profil : `node reeval-candidates.mjs --summary` (lecture seule, `tracker.md:67`). **lu**

### 2.6 `followup` (`modes/followup.md`)

- Lit `data/applications.md`, `data/active-interviews.md`, `data/follow-ups.md`, `reports/`, `config/profile.yml`, `cv.md` (`followup.md:14-21`). Étapes : vérifier `follow_ups.enabled` (23-25) ; `node followup-cadence.mjs` (27-45) ; `node rejection-latency.mjs` avec porte de confirmation (48-66) ; tableau de bord (68-85) ; brouillons pour les entrées overdue/urgent seulement (87-). **lu**
- Écrit `data/follow-ups.md` seulement pour ce que l'utilisateur a réellement envoyé : « Only record follow-ups the user confirms they actually sent. Never record a draft as sent. » (`followup.md:201`). **lu**
- Brouillons uniquement, aucun envoi (`README.md:163`). **lu**

### 2.7 Les autres commandes, par étape de la recherche (liste du README/SKILL, un par un)

Source : `README.md:282-323` et `SKILL.md:148-196`. Pour chaque commande : mode d'entrée / sortie principale / interdit (seuls les modes lus sont détaillés ; les autres sont déduits de la ligne de menu, marqués « menu »).

Trouver :
- `scan` : voir 2.2.
- `discover` (`modes/discover.md`) : résout des noms d'entreprises vers des cartes ATS scannables par `node discover-ats.mjs` (aperçu par défaut, `--write` seul modifie `portals.yml`, `discover.md:68-82,161-164`) ; zéro token (`discover.md:154-157`) ; Workday demande un indice fourni par l'utilisateur, jamais de devinette (`discover.md:158-160`) ; liste candidate depuis l'historique : `node discover-new-companies.mjs --out` (`discover.md:54-58`). **lu**
- `titles` (menu : titres adjacents à partir du CV), `triage` (menu : première note rapide, « writes no files », `SKILL.md:183`), `batch` (menu : workers headless, `AGENTS.md:567-582`), `agent-inbox` (menu). **menu / déduit**
Évaluer :
- `oferta` : évaluation seule A-H, pas de PDF automatique (`README.md:286`, `modes/oferta.md`). `ofertas` : comparer plusieurs offres. `training`, `project` : évaluer une formation / un projet. `deep`, `contacto`, `interview-prep` : recherche d'entreprise, contacts et brouillon de message (« never sends », `README.md:152`), préparation d'entretien. **lu (menu) / déduit pour le détail**
Produire :
- `pdf` (`modes/pdf.md`), `text`, `latex`, `latex-tex`, `ats` (`modes/ats.md`), `cover` (`modes/cover.md`), `email` (`modes/email.md`), `add`/`expand`, `master-profile`, `intake` (`modes/intake.md`) : détail en section 3.
Postuler : `apply` (2.4) ; `prepare-application.mjs` (aperçu Greenhouse/Ashby/Lever, jamais de POST, `SCRIPTS.md:1482-1492`).
Suivre : `tracker` (2.5), `followup` (2.6), `reply-watch` (classer les réponses, `data/reply-candidates.json`, propositions seulement après revue, `DATA_CONTRACT.md:49-50`), `outcome` (enregistrer le résultat + archiver), `patterns`, `calibrate`, `upskill`, `offer-prep`, `interview/*`, `interview-redflag`, `update`, `retro`. **menu / lu partiel (DATA_CONTRACT)**

## 3. Les phases dans l'ordre, et les replis

### 3.1 Scan des portails

- Config : `portals.yml` (`search_queries`, `tracked_companies`, `title_filter`, `location_filter`, `max_posting_age_days`, `scan_history.*`), utilisateur-couche (`scan.md:27-31,229-248`, `DATA_CONTRACT.md:32`). **lu**
- Quatre niveaux, additifs et dédupliqués (`scan.md:39-178`) : L0 parseurs locaux / `scan.mjs` ; L1 Playwright sur `careers_url` ; L2 API/flux ATS ; L3 WebSearch avec filtres `site:`. Priorité : L0 → L1 → L2 → L3 (`scan.md:172-178`). **lu**
- Règle « parseur local réussi » : une entreprise couverte par un parseur local qui a réussi n'est plus rescannée en Playwright/API ; en L3 ses résultats sont écartés (`scan.md:104-126`). **lu**
- Fournisseurs : « 55+ provider modules cover ATS APIs, board-wide feeds, XML/RSS feeds, markdown feeds, and local parsers » (`README.md:487`) ; le catalogue lui-même liste plus de 110 lignes (`docs/SUPPORTED_JOB_BOARDS.md:9-126`). Sources sans API ou interdites par robots.txt / protections anti-bot sont refusées explicitement (`SUPPORTED_JOB_BOARDS.md:134-142`) : « out of scope on both technical and ethical grounds » pour Glassdoor/Dice (`SUPPORTED_JOB_BOARDS.md:141-142`). **lu**
- Tiers à clé : « Auth-gated/login-required sources are intentionally out of core (they belong in the plugin layer) » (`ARCHITECTURE.md:55`, `providers/README.md:23`) ; plugins fournisseurs détect-exempt : ne se déclenchent que sur une entrée `portals.yml` avec `provider: <id>` (`plugins/_engine.mjs:738-743`, `plugins/apify/skill.md:10-11`). **lu**
- Panne réseau / source en échec : (a) parseur en échec → journaliser, repli sur l'API ATS s'il y en a, continuer avec les autres, ne pas marquer l'entreprise « ok » (`scan.md:195`) ; (b) `careers_url` en 404/redirection → noter, tenter `scan_query`, marquer pour mise à jour manuelle (`scan.md:207,491-494`) ; (c) navigation/parseur qui échoue sur une URL → `skipped_error`, ne pas interrompre tout le scan (`scan.md:277,286`) ; (d) `data/portal-health.tsv` enregistre l'accessibilité (`reachable, empty, slug_gone, network, auth, server, unknown, unverified_zero`, `DATA_CONTRACT.md:44`). Aucun passage du Skill ne dit d'inventer des offres quand un fournisseur est muet. **lu / déduit** (dernière phrase)
- Proxy sortant : `fetch()` Node peut ignorer `HTTP_PROXY` ; `CAREER_OPS_TRUST_PROXY_EGRESS=1 node scan.mjs` à n'activer que si le proxy bloque lui-même les adresses privées ; sans cela, une erreur DNS « names the proxy setup needed » (`README.md:256-260`). **lu**
- Vérification de vivacité : par défaut `scan.mjs` « trusts what each ATS feed returns » ; `node scan.mjs --verify` ajoute une vérification Playwright séquentielle, uniquement sur les nouvelles offres (`README.md:491-497`). Niveau 3 : chaque résultat WebSearch est « unverified » et doit être confirmé avant d'entrer dans le pipeline (`scan.md:170,261-277`). **lu**

### 3.2 Pipeline (`data/pipeline.md`) et états

- Format : section Pending `- [ ] {url}` (1 colonne) ou `{url} | {company} | {title} | {location} | {compensation}` (max 5), segments étiquetés optionnels `posted:`, `trust:`, `note:`, `rank:` dans cet ordre ; `- [!]` pour erreur ; Processed `- [x] #143 | URL | Company | Role | 4.2/5 | PDF ✅` (`pipeline.md:56-119`). Les titres de section peuvent être en d'autres langues (`pipeline.md:73`). **lu**
- États d'élément : `- [ ]` en attente ; `- [x]` traité ; `- [!]` erreur / JD indisponible (`AGENTS.md:539`) ; marquages barrés `~~...~~ — posting expired / blacklisted / oferta nieaktywna` (`pipeline.md:13`, `auto-pipeline.md:38,47`). **lu**
- Références `local:jds/{file}` pour les JD privés (`scan.md:299-303`, `AGENTS.md:594-596`). **lu**

### 3.3 Quand le scan ne couvre pas la demande

Ce que dit le Skill (ordre de repli) :
1. Offre trouvée à la main : `coverage-check.mjs <url> --company --title` explique pourquoi le scan l'a manquée et propose le changement de `portals.yml` sans l'appliquer (`AGENTS.md:143`, `KEEPING_PORTALS_LIVE.md:147-154`). **lu**
2. Entreprise inconnue : `node discover-ats.mjs "<Company>"` (aperçu) puis `--write` après confirmation ; si non résolue ou carte vide : entrée manuelle `careers_url` (+ `api` si connu) ou `scan_method: websearch` + `scan_query` (`KEEPING_PORTALS_LIVE.md:26-40`). **lu**
3. Portail 100 % JS sans API : « paste a specific JD into `data/pipeline.md` and run `/career-ops pipeline` » (`discover.md:147-148`). **lu**
4. Recherche large : seule recherche web prévue = Niveau 3 `search_queries` + `site:` (WebSearch), à vérifier ensuite par `check-liveness.mjs` ou Playwright (`scan.md:166-170`). Le Skill n'a pas de mode « recherche web ouverte » : `scan` est « bounded by portals.yml; never an open-ended research task » (`scan.md:21`) ; `oferta` interdit `deep-research` et plafonne à 5 requêtes (`oferta.md:73-80`). **lu**
5. Élargir les titres : mode `titles` (menu). **menu**
6. Agrégateurs (LinkedIn, Wellfound, Naukri...) : « UNCONFIRMED by default »; il faut retrouver la même offre chez l'employeur ; trouvée → l'URL employeur est canonique ; introuvable → obsolète, enregistrer `skipped_expired` via `appendToScanHistory` ; employeur non identifiable → signal du bloc G, s'arrêter (`AGENTS.md:541-553`). **lu**
7. LinkedIn : une seule tentative navigateur par offre et par exécution ; squelette/login → s'arrêter, demander le texte ; « Do not retry LinkedIn through WebFetch, guest endpoints, alternate accounts, or anti-bot/login workarounds »; l'entrée reste `- [!] ... JD unavailable; paste text or provide employer URL` (`AGENTS.md:532-539`). **lu**

Outils d'extraction de JD (ordre déduit du texte, aucun mode ne les enchaîne tous) :
- `fetch-jd.mjs <url>` : JD via l'API publique d'un ATS connu, stdout + exit 0 ; sinon exit 1, stdout vide, « the caller's existing browser/WebFetch fallback is the next step » (`AGENTS.md:139`, en-tête de `fetch-jd.mjs`). Aucun fichier `modes/*.md` ni `batch/batch-prompt.md` ne le cite (grep : seulement AGENTS.md et docs/SCRIPTS.md:33). **lu / déduit** (absence dans les modes)
- `browser-extract.mjs <url> --mode jd|listing` : lecteur Playwright headless, lecture seule, JSON compact ; opt-in via `scan.extractor: cli` (`auto-pipeline.md:18`, `pipeline.md:124`, `scan.md:138`) ; Workday lu via son JSON CXS ; une extraction vide est une erreur `empty_text`, pas un JD vide (en-tête du fichier). **lu**
- Chaîne officielle dans les modes : Playwright (ou `browser-extract` si opt-in) → WebFetch → WebSearch → demander à l'utilisateur (`auto-pipeline.md:15-23`, `pipeline.md:121-126`). **lu**
- `jd-capture.mjs` : retrouve une capture `jds/` par numéro de rapport ; ne sert pas à lire une offre en ligne (en-tête du fichier, `AGENTS.md:179`) ; l'archivage s'écrit par `archive-posting.mjs --report=N` (`AGENTS.md:600-605`). **lu**
- Vivacité : `check-liveness.mjs` = API ATS d'abord (zéro token), Playwright en repli seulement si l'API renvoie `null` ; `uncertain` ne déclenche pas Playwright et reste non confirmé (`AGENTS.md:519-521`, `SCRIPTS.md:878-903`). **lu**

### 3.4 Lecture d'une offre et évaluation A-H (`modes/oferta.md`)

- Portes avant le bloc A : vivacité (URL), cache de faits publics, blacklist, dealbreaker, agence (`oferta.md:9-67`). Budget de recherche : 5 requêtes WebSearch max pour D+G, pas de sous-agents (`oferta.md:69-80`). **lu**
- Blocs : A résumé du rôle, B correspondance CV, C niveau, D rémunération/demande, E plan de personnalisation, F plan d'entretien (STAR+R), G légitimité de l'offre ; H réponses de formulaire seulement si score ≥ 4.5 (`oferta.md:3,105-397,749-751`, `docs/ARCHITECTURE.md:42-53`). Un seul score global 1-5, sans formule (`docs/ARCHITECTURE.md:54-55`). **lu**
- Sortie obligatoire : rapport avec en-tête `**URL:**` (entre Score et PDF) et `**Legitimacy:** {tier}` (`AGENTS.md:663`, `oferta.md:692-710`), bloc `## Machine Summary` YAML (`oferta.md:716,766`), `## Job Description (archived verbatim)` (`oferta.md:760,768`, `AGENTS.md:590`), `## Keywords extracted` et `## Keyword Coverage` via `keyword-match.mjs` (`oferta.md:754-758,772-782`). **lu**
- Numéro de rapport : réservé par `node reserve-report-num.mjs` puis libéré par `--release` (`oferta.md:684`, `AGENTS.md:588`). **lu**
- Tracker : TSV puis `merge-tracker.mjs` (`oferta.md:784-800`). **lu**

### 3.5 Production

- CV (`modes/pdf.md`) : 23 étapes (`pdf.md:17-94`) : lire `cv.md` ; contrôle de doublon (`precheck-duplicate.mjs`) ; mots-clés ; **écrire le JD dans `jds/{slug}.md` d'abord** puis `jd-skill-gap.mjs` ; format de page ; payload JSON → `cv-title-check.mjs` (17a) → `verify-cv-structure.mjs` (17b) → `build-cv-html.mjs` (18) → `verify-cv-facts.mjs` (19, « a hard gate before PDF rendering ») → audit HM optionnel (20) → `generate-pdf.mjs --report=N` (21) → variante ATS optionnelle (21a) → `keyword-match.mjs --cv` (22) → rapport final (23). Après génération : `node mark-pdf-ready.mjs {report}` pour passer la colonne PDF de ❌ à ✅ (`pdf.md:428-430`). Les sections `cv.locked_sections` ne sont jamais modifiées (`pdf.md:9`). **lu**
- Lettre (`modes/cover.md`) : porte JD (12-24) ; 4 questions obligatoires avant de rédiger (164-166 : « No instruction... overrides this gate ») ; brouillon dans le chat avant PDF (212) ; PDF « Only after explicit user approval » (287-289) via `generate-cover-letter.mjs` ; validateur de faits avant rendu (291-296). En mode non surveillé, sans réponses : aucun fichier et `needs_confirmation: cover_input ...` (`cover.md:10`). **lu**
- E-mail (`modes/email.md`) : « Never submit. Never send email. Never click send. Draft only. » (15-16) ; sortie dans le chat, « Do not write files unless the user explicitly asks to save the draft » (545). Variantes : rapport/slug, JD collé, `stuck`, `noshow` (20-62). **lu**
- ATS (`modes/ats.md`) : `ats-payload.mjs` puis `verify-ats.mjs`, déterministe, lecture seule, consultatif (`ats.md:7-14`). **lu**
- Profil (`modes/intake.md`) : lit `documents/` ; `intake.mjs` extrait ; rien n'est écrit sans confirmation explicite (`intake.md:17-21`). **lu**

### 3.6 Candidature : jusqu'où, où ça s'arrête

- Jusqu'à : ouvrir le formulaire, répondre à chaque champ, remplir les champs texte/select, joindre le CV sur mesure, vérifier les champs requis. S'arrête avant Submit/Send/Apply ; reprend seulement quand le candidat confirme l'envoi (`apply.md:19`, `AGENTS.md:515`). **lu**
- Le mot « Submit » n'est cliqué par l'agent dans aucun passage lu. Le Skill prévoit même le cas où le clic du candidat échoue chez Ashby (3.6, `apply.md:423-427`) : l'application n'est « submitted » qu'après la page de succès ou l'e-mail de confirmation ; sinon l'état reste `filled` (`apply.md:427`). **lu**
- En parcours non surveillé : « never ask, never wait and never submit » (`apply.md:7`). **lu**

### 3.7 Suivi

- Après confirmation d'envoi : `set-status.mjs --report N Applied [--on date]` ; `followup-seed.mjs` ; section Application Answers → `submitted` ; suggestion `contacto` (`apply.md:392-398`). **lu**
- Cycle de vie : `Evaluated → Applied → Responded → Assessment → Interview → Offer / Rejected / Discarded / SKIP`, plus `Hired` terminal (`modes/tracker.md:24`, `AGENTS.md:672-683`, `templates/states.yml:17-80`). **lu**
- `followup` (2.6), `reply-watch`, `outcome` (menu), `close-stale.mjs`. Toute écriture d'état passe par `set-status.mjs` : validation stricte `states.yml`, verrou partagé, écriture atomique, ledger `data/status-log.tsv` (`AGENTS.md:140,151,662`). **lu**

## 3 bis. Offres déjà vues, déjà évaluées, déjà postulées (ajout demandé)

Principe général (lu) : tout l'état est dans des fichiers de la couche utilisateur qui persistent d'une session à l'autre (`DATA_CONTRACT.md:37-41,63-66`, `ARCHITECTURE.md:22-24`). Le Skill n'a pas de mémoire de session : « le Skill se souvient » = ces fichiers + les scripts qui les relisent.

### (a) Éviter de retraiter une offre déjà scannée / évaluée / postulée

Au scan (lu) :
- `scan.mjs` déduplique contre trois sources : `scan-history.tsv` (URL déjà vue, sauf les lignes `skipped_title/location/age/no_apply_control`, qui ne comptent pas comme « vues »), `applications.md` (société + rôle normalisés déjà évalués), `pipeline.md` (URL exacte en Pending ou Processed) (`scan.md:250-253`). Le compteur « Duplicates: N (already evaluated or in pipeline) » (`scan.md:443`).
- Clé d'URL : `url-key.mjs` retire seulement une liste noire de paramètres de suivi, met l'hôte en minuscules, force https, ignore fragments non identitaires et barre finale, trie la requête ; il « under-strips on purpose » (un doublon visible vaut mieux qu'une fusion silencieuse). Une URL inutilisable ou « N/A » donne une clé vide, jamais une clé commune (`url-key.mjs:1-37`). `scan.mjs` utilise la même logique (`normalizeUrlForDedup`, `scan.md:183`).
- Identité forte : `listing-fingerprint.mjs` produit un `listing_key` (ats_provider + board_slug + posting_id) pour Greenhouse, Ashby, Lever ; il sert de jeton de dédup supplémentaire et se stocke dans la colonne 15 de `scan-history.tsv` ; sans triplet complet, retour à la dédup existante (`docs/listing-fingerprint.md:1-14`, `scan.md:325`).
- Autres signaux de dédup à l'écriture dans `scan-history` : `requisition_id` (col. 13) garde séparés deux postes de même titre à réquisitions différentes ; `scan_history.dedup_include_location` et `dedup_include_language` (opt-in, défaut off) ; `preferred_languages` (`scan.md:322-324`, `docs/SCRIPTS.md:915-925`).
- Re-examen contrôlé : sans `scan_history.recheck_after_days`, la dédup d'historique vaut « forever » ; avec, les vieilles lignes `added` et `skipped_expired` redeviennent éligibles ; les statuts invalides permanents restent permanents (`docs/SCRIPTS.md:915`).
- Doublons inter-sociétés (agence qui republie) : empreinte SimHash du JD (col. 8), signalée seulement, rien n'est supprimé (`scan.md:255-258,423-433`).
- Reposts : `detect-reposts.mjs` lit `scan-history.tsv`, ne considère que les lignes `added`, exige 2+ URLs distinctes sur 2+ dates de scan dans 90 jours avec la même « identité de titre » ; avertissement, pas un filtre (`detect-reposts.mjs:1-38`, `AGENTS.md:157`).
- Dans le pipeline : `reconcile-pipeline.mjs` existe parce que le mode batch n'écrit pas dans `pipeline.md` ; sans lui les offres évaluées restent en Pending et « the next scan and the next pipeline run both re-surface them, and they get evaluated again (duplicate reports, duplicate tracker rows) » ; il déplace vers Processed les entrées `completed/skipped` de `batch/batch-state.tsv` (`reconcile-pipeline.mjs:1-24`). Ce risque de retraitement est donc reconnu par le Skill pour le chemin batch. Le chemin `pipeline` interactif déplace lui-même l'élément de Pending à Processed seulement après évaluation terminée (`pipeline.md:38`).
- Évaluation : `merge-tracker.mjs` déduplique à l'écriture (URL normalisée d'abord, « Pass 0 » ; puis numéro de rapport ; puis société normalisée + rôle flou) ; une ré-évaluation de score plus haut met la ligne à jour sur place (`merge-tracker.mjs:1-14,1834`, `docs/SCRIPTS.md:167`, `AGENTS.md:647,657`). Règle écrite : « NEVER create new entries in applications.md if company+role already exists. Update the existing entry. » (`AGENTS.md:592`, `oferta.md:788`). `dedup-tracker.mjs` nettoie a posteriori : regroupe par société normalisée, ne fusionne que les rôles au titre identique et aux URLs non contradictoires, garde le meilleur score et l'état le plus avancé (`dedup-tracker.mjs:1-12`). `verify-pipeline.mjs` signale les doublons (`docs/ARCHITECTURE.md:101-106`).
- Avant de produire un CV / postuler : `precheck-duplicate.mjs --company --title [--req] [--url]` (lecture seule, conseil, exit 0) classe les lignes du tracker : 1) URL ou numéro de réquisition, 2) même société + même identité de titre, 3) même organisation mère / titre proche ; une ligne `Rejected` est signalée par un avertissement, jamais un blocage (`precheck-duplicate.mjs:1-24`). Appelé par `pdf.md:19` et `apply.md:53`. **Il n'est pas appelé par `auto-pipeline.md` ni `pipeline.md`** (grep : aucune occurrence dans ces deux modes ; seuls `oferta.md:788` et `scan.md:252` parlent de l'existant). **lu / déduit**
- Cache de faits : `evaluation-cache.mjs` ne réutilise que quatre champs publics (`company, role, advertised_comp, reports_to`) lus dans le `Machine Summary` d'un rapport, si l'identité d'annonce est forte, la vivacité est fraîchement « active » (TTL 5 min) et les faits ont moins de 24 h (`evaluation-cache.mjs:11-15`, `AGENTS.md:145`, `oferta.md:31`). L'ajustement au candidat est « always recomputed ». Ce n'est donc PAS un mécanisme « ne pas réévaluer une offre déjà évaluée » mais un raccourci de recherche de faits. **lu**
- Réutilisation d'un CV : `jd-similarity.mjs` recommande `reuse`, `reuse-with-edits` ou `regenerate` en comparant deux JD ; « deliberately a recommendation layer », ne supprime ni n'écrase rien (`jd-similarity.mjs:1-11`, `pdf.md:13-15,39`). Les CV d'une candidature sont rangés dans un « bundle » dérivé du numéro de rapport (`application-artifacts.mjs`, `apply.md:192-215`) ou en `output/cv-*` avec le manifeste `data/pdf-index.tsv` (`DATA_CONTRACT.md:52`). `apply` retrouve le rapport par recherche du nom de société dans `reports/` et recharge la section `Application Answers` (`apply.md:158-180`). La lettre : la section `## Cover Letter Draft` du rapport, et `cover {slug}` repart de ce brouillon (`cover.md:19,373-381`). **lu**
- Fermeture : `close-stale.mjs` (dry-run par défaut, `--confirm` pour écrire) passe en `Discarded` les lignes `Applied` silencieuses depuis plus de `--days` (60 par défaut), sauf entretien actif, transition ultérieure dans le ledger ou relance ouverte (`close-stale.mjs:1-45`, `tracker.md:38`). Offre fermée détectée à l'évaluation : entrée de pipeline marquée `~~...~~ — oferta nieaktywna` et, si une ligne de tracker existe, `Discarded` (`auto-pipeline.md:38`, `pipeline.md:13`). Le liveness enregistre `skipped_expired` dans `scan-history` (`AGENTS.md:138`).

États et transitions (lu) :
- Inbox / en attente : `- [ ]` dans `data/pipeline.md` ; erreur `- [!]` ; traité `- [x] #NNN | URL | ... | score | PDF ✅/❌` ; ignoré par pré-filtre `- [x] #-- | url | skipped (pre-screen mismatch)` avec ligne dans `data/discard.log` (`pipeline.md:23,27,35,56-71`).
- Évaluée : ligne du tracker `Evaluated` (écrite à la fin de l'évaluation, PDF ❌ ou ✅) (`oferta.md:797-798`). « CV produit » n'est pas un état : c'est la colonne PDF (❌→✅ par `mark-pdf-ready.mjs`, `pdf.md:430`) et le manifeste `pdf-index.tsv`. Idem la lettre : pas de colonne, seulement le fichier et la note dans le rapport (`cover.md:381`).
- Postulée : `Applied` seulement après confirmation du candidat (`apply.md:394-395`). Suite : `Responded → Assessment → Interview → Offer`, terminaux `Hired, Rejected, Discarded, SKIP` (`states.yml:16-80`, `AGENTS.md:672-683`, `tracker.md:24-34`). Transition par `set-status.mjs` uniquement, journal `status-log.tsv` (`AGENTS.md:151,662`).
- `DATA_CONTRACT.md` ne définit pas les états ; il liste les fichiers (`DATA_CONTRACT.md:37,40,41,56,63,64`). `scan.md` ne parle que des statuts de `scan-history` (section Scan History, `scan.md:305-335`) ; ce ne sont pas les états du tracker. Deux vocabulaires distincts : statuts de `scan-history` (added, skipped_*...) et états du tracker. **lu**

Limites qu'on voit dans le texte (déduit, sans extrapoler) :
- La reconnaissance « déjà évaluée » se fait par URL normalisée, identité forte ATS, ou société+rôle flou contre `applications.md`. Elle ne repose pas sur le contenu du JD. Si l'URL change (réécriture de lien, autre agrégateur) et que le titre diffère, le Skill ne dit pas qu'il reconnaîtra l'offre ; il dit privilégier la sous-normalisation (doublon visible plutôt que fusion erronée) (`url-key.mjs:5-12`).
- Les modes `auto-pipeline` et `pipeline` ne contiennent pas d'appel à `precheck-duplicate.mjs`. La protection avant évaluation tient à la dédup de `scan.mjs` et à celle de `merge-tracker.mjs` au moment d'écrire.
- Pour les offres examinées hors `scan.mjs` (L1-L3 faites par l'agent), la dédup est faite à la main par l'agent avec Grep sur les fichiers (`scan.md:183-184`) : sa fiabilité dépend de l'agent. **déduit**

### (b) Offres examinées par un scan mais non retenues par les filtres

Ce que dit le Skill (lu) :
- Elles ne vont ni dans `pipeline.md` ni dans `jds/` : seules les offres qui passent les filtres sont ajoutées à Pending (`scan.md:279-281`). Pas de JD sauvegardé pour elles.
- Elles sont écrites dans `data/scan-history.tsv` : une ligne par offre avec URL, première date de vue, portail, titre, société, statut, lieu, empreinte, date de publication, société normalisée, etc. (`scan.md:307-325`). Statuts : `skipped_title` (titre rejeté par `title_filter`), `skipped_location`, `skipped_age`, `skipped_no_apply_control`, `skipped_dup`, `skipped_expired`, `skipped_error`, `skipped_invalid_url`, `skipped_blocked_host`, `cooldown:{company}:{until}` (`scan.md:283-286,316,331-335`). « They exist so a mis-aimed setting is visible in the data rather than only as a summary counter » (`scan.md:331`) ; l'enregistrement de `skipped_title` est confirmé par le commentaire de `filter-audit.mjs:19-21` (« The rejected titles are now in scan-history.tsv as skipped_title (#2695) »).
- Une ligne par offre et par statut, pas une par scan (`scan.md:331`). Le corps du JD n'est pas stocké dans le TSV (« the JD body itself is not stored in the TSV », `scan.md:433`) ; seul un SimHash est gardé si le fournisseur livrait le corps.
- Ces lignes ne comptent pas comme « vues » : `skipped_title/location/age/no_apply_control` « carry no dedup weight » ; changer un réglage fait réapparaître l'offre au scan suivant (« A keyword added to `title_filter.positive` gets back every title it now matches on the next scan », `scan.md:251,331`). Les statuts `added`, `skipped_dup`, `skipped_expired` pèsent dans la dédup (sauf `recheck_after_days`).
- Compteur de fin de scan : « Filtered by title: N relevant » et « Duplicates » (`scan.md:437-448`) ; le scan envoie aussi un compteur par exécution dans `data/scan-runs.tsv` (`DATA_CONTRACT.md:42`) et la santé des portails dans `portal-health.tsv`.
- « Tier » : `scan.md` ne parle pas de filtre par tier. Le mot « tier » du Skill désigne soit `spend_tier` (économie/standard/premium, routage de modèle, `pipeline.md:19-27`), soit les niveaux `block/allow/block_hard` de `location_filter` (`scan.md:236`). Pré-filtre du `pipeline` : les offres jugées manifestement hors cible sont marquées dans Processed et consignées une ligne dans `data/discard.log` (horodatage, URL, raison), résumé par `discard-analytics.mjs` (`pipeline.md:23,27`, `AGENTS.md:147`).
- Retrouver / relancer :
  - Relancer avec d'autres filtres : modifier `title_filter`, `location_filter`, `max_posting_age_days` dans `portals.yml` puis relancer `node scan.mjs` ; les offres `skipped_title/location/age` réapparaissent (`scan.md:331`, `docs/SCRIPTS.md:915`). Options de fenêtre : `--posted-after/--posted-before`, `--since N` (`scan.md:345-421`). Tester sans écrire : `node scan.mjs --company "<X>" --dry-run --json` (`KEEPING_PORTALS_LIVE.md:83-90`). Voies parallèles par variables `CAREER_OPS_PORTALS/PIPELINE/SCAN_HISTORY` (`SCRIPTS.md:951-969`).
  - Auditer : `filter-audit.mjs --summary` rejoue `title_filter.positive` sur `scan-history.tsv` (mots-clés inutiles, redondants, bruyants) ; il ne couvre que les offres qui ont passé le filtre de titre et n'est pas un rapport des « presque » rejetées : « a near-miss report over them is a separate tool » (`filter-audit.mjs:1-24`, `AGENTS.md:171`). Aucun outil de near-miss n'est cité dans les fichiers lus.
  - Expliquer une offre vue à la main et manquée : `coverage-check.mjs <url> --company --title` lit le statut dans `scan-history` (déjà vue, écartée par un filtre, entreprise désactivée, sans fournisseur...) et propose un changement de `portals.yml` sans l'appliquer (`AGENTS.md:143`, `KEEPING_PORTALS_LIVE.md:147-154`).
  - Consulter l'historique : lire `data/scan-history.tsv` par Grep sur URL/hôte (le fichier atteint plusieurs mégaoctets, il ne faut pas le lire en entier, `scan.md:183`) ; `stats.mjs --summary` agrège totaux de scan, couverture de portails et tendances (`AGENTS.md:150`, `SCRIPTS.md:1743`).
- À propos de « ~3 000 offres perdues » : d'après les fichiers lus, une offre examinée mais filtrée laisse une trace (une ligne dans `scan-history.tsv` avec titre, société, lieu, URL, statut) mais pas de JD, pas de rapport, pas de ligne `pipeline.md`. Le Skill ne la décrit ni comme perdue ni comme archivée : l'historique est une liste de ce qui a été vu ; pour la réévaluer il faut la réintroduire (changer le filtre et rescanner, ou coller son URL dans `pipeline.md`). Je n'ai pas lu `scan.mjs` : je ne peux pas confirmer que toutes les voies de filtre (par ex. `content_filter`, remarque `filter_on` : « a rejection by another field declared in filter_on is not [recorded as skipped_title] », `scan.md:331`) écrivent bien une ligne ; ce dernier cas est écrit comme NON enregistré. **lu / non vérifié dans le code**
- Offres reconnues d'une session à l'autre : les fichiers étant persistants, `applications.md`, `reports/`, `pdf-index.tsv`, `scan-history.tsv` et `pipeline.md` servent de mémoire ; la reconnaissance repose sur les clés ci-dessus. Le Skill ne promet pas qu'un agent hôte qui n'applique pas `merge-tracker`/`precheck-duplicate`/`set-status` reconnaîtra une offre déjà traitée.

## 4. Contrat de données

Deux couches : système (`modes/`, `*.mjs`, `templates/`, `providers/`, `plugins/`, `docs/`) mises à jour par `update-system.mjs` ; utilisateur (`cv.md`, `config/profile.yml`, `portals.yml`, `data/*`, `reports/*`, `output/*`, `jds/*`, `batch/tracker-additions/*`, `modes/_profile.md`, `_custom.md`, `_brief.md`...) que l'updater ne touche jamais (`DATA_CONTRACT.md:5-68,97-185,187-193`, `ARCHITECTURE.md:15-20`). « If a file is user-owned, no update process may modify or delete it. » (`DATA_CONTRACT.md:189`). **lu**
Les fichiers sont canoniques, les bases dérivées : `data/applications.md`, `reports/`, `data/pipeline.md` sont la source de vérité ; SQLite (`data/applications.db`) n'est qu'un index dérivé (`ARCHITECTURE.md:22-24`, `DATA_CONTRACT.md:39`). **lu**
Racine des données : `CAREER_OPS_ROOT` ou `CAREER_OPS_DATA_DIR` > fichier `.career-ops-data` > racine du dépôt ; les scripts et prompts restent dans le dépôt ; `CAREER_OPS_TRACKER` surcharge le chemin du tracker (`DATA_CONTRACT.md:195-210`, `AGENTS.md:20-30`, `README.md:550-572`). Ajout/lecture de chemins dans un script : via `path-resolver.mjs`, pas `__dirname` (`AGENTS.md:30`). **lu**

Formats :
- `data/pipeline.md` : voir 3.2 (`modes/pipeline.md:56-119`). **lu**
- `data/applications.md` : tableau Markdown `| # | Date | Company | Role | Score | Status | PDF | Report | Notes |` (`AGENTS.md:311-314`, `tracker.md:10`), variante avec colonne Via après Company (`tracker.md:16`), colonne optionnelle URL (`SCRIPTS.md:173-183`). Pas de gras `**`, pas de date, pas de texte additionnel dans le champ Status (`AGENTS.md:686-688`). **lu**
- Ajouts : un TSV par évaluation dans `{DATA_ROOT}/batch/tracker-additions/{num}-{company-slug}.tsv`, ligne d'en-tête obligatoire `num date company role status score pdf report notes url`, une seule ligne de données ; étiquettes requises : `num, date, company, role, score, status, pdf, report` ; en-tête dupliqué ou score illisible → fichier ignoré bruyamment ; score `X.X/5` ou sentinelle `N/A` / `—` / `-` (`AGENTS.md:625-643`). Le TSV porte l'URL brute ; `merge-tracker.mjs` dédoublonne d'abord par URL normalisée, puis numéro de rapport, puis société+rôle flou (`AGENTS.md:647-649`, `SCRIPTS.md:167`). Les liens de rapport sont réécrits relativement au tracker (`AGENTS.md:651`). Tri par `#` croissant à chaque écriture (`AGENTS.md:655`). **lu**
- `reports/{###}-{company-slug}-{YYYY-MM-DD}.md` : numéro à 3 chiffres ; en-tête avec `**URL:**` entre Score et PDF et `**Legitimacy:**` ; blocs A-F + G + Verdict + Risk Summary + `## Machine Summary` ; `## Job Description (archived verbatim)` obligatoire ou capture `jds/` équivalente (`AGENTS.md:181,663`, `oferta.md:690-762`). Les agences : slug `confidential-{agency}`, le fichier n'est jamais renommé (`oferta.md:687`). **lu**
- États canoniques : `Evaluated, Applied, Responded, Assessment, Interview, Offer, Rejected, Discarded, SKIP` + `Hired` (`templates/states.yml`) ; alias multilingues acceptés (`states.yml:19,25,31,37`), mais le champ doit en contenir exactement un (`states.yml:5-7`). **lu**
- `data/scan-history.tsv` : 15 colonnes, ajout en fin seulement, jamais de réordonnancement ; statuts `added, skipped_dup, skipped_title, skipped_expired, skipped_location, skipped_age, skipped_no_apply_control, skipped_invalid_url, skipped_blocked_host, cooldown:...` ; échappement des formules (`scan.md:305-343`, `DATA_CONTRACT.md:41`). **lu**
- `data/status-log.tsv` : `{tracker#}\t{date}\t{from}\t{to}\t{source}\t{note}`, append-only, source dans un ensemble fermé (`AGENTS.md:151`, `DATA_CONTRACT.md:56`). **lu**
- `data/pdf-index.tsv` : `report \t pdf \t html \t format \t date`, écrit par `generate-pdf.mjs` (`apply.md:216-219`, `DATA_CONTRACT.md:52`). **lu**

Qui écrit quoi (scripts) :
| Fichier | Écrivain autorisé |
|---|---|
| `data/applications.md` (nouvelles lignes) | `merge-tracker.mjs` (depuis les TSV) — `AGENTS.md:661` |
| `data/applications.md` (état, notes) | `set-status.mjs` — `AGENTS.md:662` |
| colonne PDF | `mark-pdf-ready.mjs`, `sync-pdf-flags.mjs` — `SCRIPTS.md:1519-1520` |
| `data/pipeline.md` | `scan.mjs`, agent (marquage Processed/`[!]`), `reconcile-pipeline.mjs`, `sync-batch-input.mjs` (`pipeline.md:73`) |
| `data/scan-history.tsv` | `appendToScanHistory` de `scan.mjs`, `check-liveness.mjs` (`skipped_expired`) — `scan.md:281`, `AGENTS.md:138` |
| numéros de rapport | `reserve-report-num.mjs` — `AGENTS.md:588` |
| `data/follow-ups.md` | `followup-seed.mjs`, agent après confirmation d'envoi — `followup.md:201` |
| `portals.yml` | `onboard-write.mjs` (onboarding), `discover-ats.mjs --write` — `AGENTS.md:265`, `discover.md:161-164` |
| `Application Answers` | `application-answers.mjs` — `apply.md:386-389` |
**lu**

Ce qu'un outil extérieur ne doit pas faire :
- Écrire directement dans `applications.md` (`AGENTS.md:661`, `_shared.md:263,275`). **lu**
- Calculer `max+1` pour un numéro de rapport (`AGENTS.md:588,582`). **lu**
- Composer à la main une ligne `scan-history.tsv` (`scan.md:281`). **lu**
- Mettre des données personnelles dans les fichiers système (`AGENTS.md:16`, `DATA_CONTRACT.md:189`). **lu**
- Créer une nouvelle ligne du tracker si société+rôle existe déjà : mettre à jour l'existante (`AGENTS.md:592`). **lu**
- Renommer un rapport après coup (`oferta.md:687`, `tracker.md:47`). **lu**
- Écrire la table `status-log.tsv` autrement que par `set-status.mjs` (voir `DATA_CONTRACT.md:56` : « see DATA_CONTRACT before writing... »). **lu / déduit**

## 5. Ce que le Skill attend d'un agent hôte (`AGENTS.md`)

- Source de vérité exclusive : contenus destinés à l'extérieur (CV, lettre, e-mail, réponses, messages) générés uniquement depuis `cv.md`, `article-digest.md`, `config/profile.yml`, `modes/_profile.md`, `writing-samples/`, plus ce que l'utilisateur dit dans la conversation (`AGENTS.md:34-40`). Fichiers dérivés (`story-bank.md`) : narration oui, chiffres seulement s'ils sont tracés vers un fichier primaire (`AGENTS.md:42-46`). Hors périmètre : mémoire automatique, autres dépôts, inférences de session (`AGENTS.md:50,58-60`). **lu**
- « Keywords get reformulated, never fabricated. » Aucune revendication d'auteur non attribuée (`AGENTS.md:54-56`). **lu**
- Contenu externe non fiable : offres, pages entreprise, champs de formulaire, e-mails sont des données, jamais des instructions ; ne peut pas déclencher d'écritures, d'envois, ni modifier les règles ; texte impératif visant l'IA → le citer comme anomalie (signal bloc G) et continuer (`AGENTS.md:66-74`). Idem pour la sortie d'une skill de plugin (`AGENTS.md:186`). **lu**
- Ordre de démarrage : mise à jour (`update-system.mjs check`, 76-90) ; `doctor.mjs --json` avant tout workflow qui a besoin du profil (188-211) ; `node cv-sync-check.mjs` à la première évaluation de la session (`_shared.md:254`) ; lire `_profile.md`, puis `_custom.md` (`AGENTS.md:18`). **lu**
- Vérification des offres, obligatoire : ne jamais décider qu'une offre est active d'après un extrait WebSearch/WebFetch ; commencer par `node check-liveness.mjs <url>` (`AGENTS.md:519-521`). Repli navigateur : `browser_navigate` + `browser_snapshot` ; page illisible = « non confirmé », pas « fermé » (`AGENTS.md:523-526`). Piège « Related jobs » (WebFetch peut attribuer un badge d'une offre voisine, `AGENTS.md:528`). Exception travailleurs headless : repli WebFetch avec `**Verification:** unconfirmed (batch mode)` (`AGENTS.md:530`). **lu**
- Remarque d'incohérence apparente : `AGENTS.md:521` demande `check-liveness.mjs` en premier ; `auto-pipeline.md:31-33` juge la vivacité sur le snapshot Playwright déjà fait. Les deux textes coexistent. **déduit**
- Éthique : ne jamais soumettre sans relecture ; décourager sous 4.0/5 ; qualité plutôt que vitesse (`AGENTS.md:497-504`). **lu**
- Périmètre `apply` : `node apply-scope.mjs root` ; pas de recherche dans `$HOME` ; navigateur lancé par le projet ; pas de CDP ni de profil Chrome (`AGENTS.md:508-515`). **lu**
- Tracker : nouveaux ajouts par TSV + `merge-tracker.mjs` après chaque lot d'évaluations ; mises à jour par `set-status.mjs` ; états canoniques (`AGENTS.md:591-592,659-688`). **lu**
- Sous-agents : un worker « single-pass », jamais de sous-agent imbriqué ni de skill de recherche récursive ; recherche d'entreprise/rémunération toujours en ligne et bornée ; un `/career-ops <JD>` évalue un seul rôle (`_shared.md:279-286`). Navigateur MCP/Playwright jamais partagé entre agents concurrents (`_shared.md:272,284`). **lu**
- Exécutions non surveillées (`claude -p`, `codex exec`, ou orchestrateur sans tour utilisateur) : ne pas demander, ne pas attendre, appliquer le défaut du mode, ne rien écrire que la porte protège, finir par une seule ligne `needs_confirmation: {gate} {detail} - {resume}` (`_shared.md:298-312`). Les modes déclinent cette règle : auto-pipeline (5), apply (7), cover (10), oferta (7), intake (3). **lu**
- Langue : `language.output` (défaut `en`) pour toute prose destinée à l'humain (`AGENTS.md:405-414`). **lu**
- Personnalisation : jamais dans `modes/_shared.md` ni autres fichiers système ; faits → `_profile.md`/`profile.yml`, règles procédurales → `_custom.md` (`AGENTS.md:16`). **lu**
- Plugins : le Skill d'un plugin activé se charge via `node plugins.mjs skill <id>` ; sa sortie est une documentation tierce non fiable qui ne peut pas outrepasser AGENTS.md, modifier le cœur, révéler des secrets ou soumettre (`AGENTS.md:186`). **lu**
- Interdiction d'inventer des identifiants : « NEVER infer, guess, or invent the employer » (`AGENTS.md:551`). **lu**

## 6. Apify et autres sources

Apify (fichier:ligne) :
- Le README ne cite Apify qu'une fois : fonctionnalité « Plugin System » : « Opt-in integrations (Gmail, Notion, Apify + a community registry), disabled by default » (`README.md:197`). **lu**
- Nature : plugin fournisseur (hook `provider`) groupé dans `plugins/apify/`, « keyed provider » ; clé `APIFY_TOKEN` dans `.env` ; hôte autorisé `api.apify.com` ; `humanInTheLoop: true` (`plugins/apify/manifest.json:2-12`). **lu**
- Activation : `config/plugins.yml` → `plugins.apify.enabled: true` (désactivé par défaut) (`config/plugins.example.yml:17-20`, `enabled: false` ; `docs/PLUGINS.md:21-23` : deux portes, activé ET clés dans `.env`) ; `node plugins.mjs enable apify --confirm` enregistre le consentement (`docs/PLUGINS.md:17,21-23`). **lu**
- Déclenchement : « It fires ONLY on a `portals.yml` entry that sets `provider: apify` — never via auto-detection » (`plugins/apify/skill.md:10-11`, `plugins/apify/index.mjs:14-15,111-112`, `plugins/_engine.mjs:738-739`). Si le plugin est inactif, `provider: apify` produit une erreur explicite (`plugins/_engine.mjs:743-760`). **lu**
- Entrée `portals.yml` : `provider: apify`, `actor: <user/actor>`, `input: {...}`, `field_map` (title, url obligatoires ; company, location, description optionnels) (`plugins/apify/skill.md:15-26`, `index.mjs:119-134`). Exemple de la doc : un acteur Indeed avec un plafond `maxItems: 25` (`skill.md:20`). **lu**
- Exécution : `POST https://api.apify.com/v2/acts/{actor}/runs`, attente du run, lecture des items du dataset (`plugins/apify/_apify.mjs:20,112,144,173`) ; délai par défaut 180 s (`_apify.mjs:21`), `timeout_ms` surchargeable par entrée (`index.mjs:137`) ; run avorté en cas de dépassement (`_apify.mjs:133,166-169`) ; échec si le statut n'est pas réussi (`_apify.mjs:199`). Authentification par en-tête Bearer plutôt que `?token=` (`_apify.mjs:48-50`). **lu**
- Résultats : normalisés en `{title, url, company, location}` ; toute URL non `https` rejetée (`index.mjs:63-70,152`) ; descriptions facultatives enregistrées dans `jds/{slug}-{sha1(url)[0:10]}.md` avec frontmatter YAML, l'entrée pipeline devenant `local:jds/...` (`index.mjs:96-163`, `AGENTS.md:602`) ; correctif récent sur l'écriture du frontmatter (`CHANGELOG.md:66`). **lu**
- Passage par `scan.mjs` : les résultats traversent les mêmes filtres que les autres fournisseurs (titres, lieu, âge, dédup, blacklist) puisque `node scan.mjs` « runs the provider for that entry and writes the results to the pipeline like any other source » (`skill.md:30-31`). **lu / déduit** (le détail des filtres vient de `scan.md:229-253`)
- Particularité de confiance : le plugin Apify est l'exception documentée à la règle « tout le réseau passe par `ctx.fetch` » ; son client est limité à un hôte codé en dur (`plugins/README.md:88-93`, `plugins/apify/_apify.mjs:18-20`). **lu**
- Coût : aucun passage du dépôt ne chiffre ni ne plafonne un coût Apify (grep `cost|budget` dans `plugins/apify/` : aucune consigne ; seuls `maxItems` et `timeout_ms` bornent le run, côté entrée). La facturation Apify dépend du compte de l'utilisateur et n'est pas décrite. **lu / déduit** (absence)
- Pas de `providers/apify.mjs` : Apify n'existe que dans `plugins/` (liste de `providers/` : aucun fichier apify). **lu**
- Aucune mention d'Apify dans `modes/*.md`, `AGENTS.md`, `docs/SUPPORTED_JOB_BOARDS.md`, `docs/KEEPING_PORTALS_LIVE.md` (grep). **lu**
- Mention d'origine : le plugin « homes the LinkedIn-via-Apify use case from #791/#1202 » (`index.mjs:11-13`). Le Skill n'autorise cependant pas le contournement de LinkedIn par le navigateur ; la garde LinkedIn vise l'agent hôte et son navigateur (`AGENTS.md:532-539`). **lu / déduit**

Autres sources prévues :
- Fournisseurs zéro-clé du catalogue (`docs/SUPPORTED_JOB_BOARDS.md:9-126`) ; `scan-ats-full.mjs` (balayage inverse de jeux de données ATS publics, `AGENTS.md:134`) ; `scan-hn.mjs` (`package.json: scan:hn`) ; `scan-interamt.mjs`, `scan-dayforce.mjs` (Playwright, `AGENTS.md:135,137`) ; `company-funded.mjs` (entreprises récemment financées, `README.md:190`). **lu**
- Moteurs de recherche à clé côté communauté : Tavily (`TAVILY_API_KEY`), Serper (`SERPER_API_KEY`), alertes LinkedIn via Gmail, etc., agréés dans le registre (`docs/PLUGINS.md:145-157`, `plugins-registry/` : tavily, serper, keenable, linkedin-alerts...). **lu**
- Plugins groupés : `apify`, `gmail`, `notion`, `h1b-sponsor` (liste de `plugins/`). **lu**
- Sponsor affiché dans le README : SerpApi (`README.md:138-143`), « Sponsors never appear in evaluations, rankings or recommendations » (`README.md:143`). Aucun lien fonctionnel avec le scanner. **lu**
- Sources refusées : sites dont robots.txt interdit l'accès ou protégés par défi anti-bot ; le Skill refuse de contourner (`SUPPORTED_JOB_BOARDS.md:134-142`). **lu**
- Variables d'environnement : `CAREER_OPS_PORTALS`, `CAREER_OPS_PROFILE`, `CAREER_OPS_PIPELINE`, `CAREER_OPS_SCAN_HISTORY` (voies de recherche parallèles, `SCRIPTS.md:951-965`) ; `CAREER_OPS_ROOT`, `CAREER_OPS_DATA_DIR`, `CAREER_OPS_TRACKER`, `CAREER_OPS_BLACKLIST` (`DATA_CONTRACT.md:200-208`) ; `CAREER_OPS_TRUST_PROXY_EGRESS` (`README.md:258`) ; `CAREER_OPS_CLI` écrite dans `.env` par `remember-cli.mjs` (`AGENTS.md:334-340`). **lu**

## 7. Points de rupture pour une plateforme qui enveloppe le Skill

(Déduits des règles lues ; chaque ligne cite la règle d'origine.)

1. Écrire `data/applications.md` directement (au lieu d'un TSV + `merge-tracker.mjs`) : contourne le verrou partagé, la détection de doublons par URL/rapport/société+rôle, la normalisation des liens de rapport, le tri (`AGENTS.md:661,647-655`, `_shared.md:263`). Risque de lignes doublées, de colonnes décalées, de statuts non canoniques.
2. TSV sans ligne d'en-tête ou avec colonnes incohérentes : fichier ignoré « loudly » (`AGENTS.md:634-641`). Un TSV sans `report` ne peut pas cibler la ligne à renommer (`tracker.md:46`).
3. Changer un état par une autre voie que `set-status.mjs` : perte du ledger `status-log.tsv`, de la validation `states.yml` et des mises en relation `followup-seed` (`AGENTS.md:151,662`, `tracker.md:36`).
4. Calculer soi-même le numéro de rapport : collisions entre workers (`AGENTS.md:588,582`).
5. Sauter une porte : liveness, blacklist, dealbreaker, agence, ou l'archivage du JD verbatim (`auto-pipeline.md:29-51`, `oferta.md:9-67,760-770`, `AGENTS.md:590`). Les portes d'agence exigent une réponse explicite avant toute écriture (`_shared.md:288-296`).
6. Changer l'ordre : exécuter `pdf` avant le rapport casse le lien PDF↔rapport (`--report`, `data/pdf-index.tsv`) et le contrôle de mots-clés qui lit le rapport (`pdf.md:81,93`). Évaluer avant le contrôle de vivacité coûte une évaluation sur une offre morte (`oferta.md:11`).
7. Écrire `scan-history.tsv` ou `pipeline.md` autrement que par `scan.mjs`/`appendToScanHistory` : lignes trop courtes, doublons, dédup cassée (`scan.md:281`, `DATA_CONTRACT.md:41`).
8. Remplacer une commande du Skill par un outil maison (par ex. un lecteur de pages propre à la plateforme au lieu de `check-liveness.mjs` / `browser-extract.mjs` / `fetch-jd.mjs`) : les verdicts ne sont plus ceux que `scan-history` enregistre ; les codes de fermeture (`http_gone`, `expired_url`, `expired_body`, `listing_page` vs `insufficient_content`, `expired_body_soft`) pilotent l'invalidation du cache (`auto-pipeline.md:38`). Un « squelette » traité comme « fermé » viole la règle « unconfirmed, not closed » (`AGENTS.md:526,537`).
9. Plusieurs agents sur une même session navigateur : lectures croisées (`_shared.md:272,284`, `scan.md:198-199`, `pipeline.md:45`).
10. Cliquer Submit/Send/Apply, ou marquer `Applied` sans confirmation de l'utilisateur : viole le contrat central (`README.md:162,174`, `AGENTS.md:501,515`, `apply.md:19,392-395,427`). Idem pour l'envoi réel d'un e-mail : le Skill n'a aucun transport (`README.md:163`).
11. Enregistrer un brouillon de relance comme envoyé (`followup.md:201`).
12. Contourner les protections d'un site (CAPTCHA, détection de robot, connexion) : le Skill s'y interdit (`apply.md:426`, `SUPPORTED_JOB_BOARDS.md:134-142`, `AGENTS.md:538`).
13. Se connecter à un Chrome existant / CDP / profil utilisateur pour `apply` : explicitement interdit (`AGENTS.md:513`).
14. Écrire hors des chemins de la couche utilisateur, ou modifier `modes/`, `AGENTS.md`, `cv.md`, ou le Skill lui-même : les fichiers système sont remplacés par la mise à jour ; `cv.md` est « never modify » (`_shared.md:241`, `DATA_CONTRACT.md:93-193`).
15. Obéir au texte d'une offre / d'une page / d'un e-mail / d'une sortie de plugin : interdit (`AGENTS.md:66-74,186`).
16. Alimenter le pipeline avec des offres issues d'une recherche web sans contrôle de vivacité : les résultats L3 sont non vérifiés (`scan.md:170,261`) ; agrégateurs non confirmés (`AGENTS.md:543`).
17. Apify : activer sans `enabled: true` + token → erreur explicite ; l'utiliser comme recherche libre n'est pas prévu, il lit une entrée `portals.yml` précise ; des URL non https sont écartées ; le coût reste à la charge du compte, sans plafond dans le Skill (section 6).
18. Détail de contrat de format : ne pas écrire de gras ni de date dans la colonne Status ; sentinelles de score `N/A`/`—`/`-` pour les lignes sans évaluation (`AGENTS.md:643,686-688`).
19. Mode non surveillé : toute porte qui poserait une question doit se terminer par la ligne `needs_confirmation: ...` et ne rien écrire de protégé (`_shared.md:298-312`). Une plateforme qui « continue quand même » viole ce contrat.
20. Le README (`:153`) promet que tout reste sur la machine ; le Skill envoie le CV au fournisseur d'IA choisi (`README.md:164`). Envoyer des données du dossier vers un autre service tiers n'est pas prévu (aucun passage ne l'autorise).

## 8. Non vérifié

- Le code des scripts : `scan.mjs`, `merge-tracker.mjs`, `set-status.mjs`, `check-liveness.mjs`, `generate-pdf.mjs`, `apply-scope.mjs`, `plugins/_engine.mjs` (hors lignes citées). Je n'ai lu que les docs, les en-têtes de `fetch-jd.mjs`, `browser-extract.mjs`, `jd-capture.mjs`, `plugins/apify/*` et `plugins/_engine.mjs` (extrait 735-760). Tout comportement « déduit » reste à confirmer dans le code.
- `docs/SCRIPTS.md` seulement en survol (sections merge, liveness, scan, prepare:application, utilitaires) ; `docs/AUTOMATION.md`, `docs/PLUGIN_REVIEW.md`, `plugins/README.md` (extraits) et `providers/ADDING_A_PROVIDER.md` non lus en entier.
- `modes/_shared.md` lu en partie (règles globales, sous-agents, non surveillé, agence) ; non lus : Spend Tier, Scoring, Block G détaillé. `modes/oferta.md` lu aux portes, à l'enregistrement et au format ; blocs A-G détaillés non relus ligne à ligne. `modes/pdf.md` lu pour les 23 étapes et la fin ; la section schéma JSON, template, Canva et photo non lues. `modes/cover.md`, `modes/email.md`, `modes/ats.md`, `modes/intake.md` survolés par titres et passages clés.
- Modes cités sans lecture : `ofertas`, `contacto`, `deep`, `triage`, `batch`, `titles`, `reply-watch`, `outcome`, `patterns`, `calibrate`, `upskill`, `offer-prep`, `interview*`, `retro`, `update`, `add`, `expand`, `master-profile`, `text`, `latex*`. Leur description dans la section 2.7 vient du menu (`SKILL.md`, `README.md`).
- `batch/batch-prompt.md` et `batch-runner.sh` non lus (chaîne de travailleurs headless).
- Les modes de langue (`modes/de`, `fr`, `es`...) non lus ; le Skill dit qu'ils sont des adaptations des modes de base (`modes/README.md:80`).
- Le tableau « The everyday commands » et le dépliant « All commands, by stage of the search » n'existent pas dans ce README (section 0) : si le propriétaire se réfère à une autre version, elle n'est pas dans ce commit. Je n'ai pas vérifié les traductions du README (`README.fr.md`, etc.) ; aucune ne devrait contenir ce que le README anglais n'a pas, mais je ne l'ai pas contrôlé.
- Coût réel d'une exécution Apify, quotas, choix d'acteurs : hors dépôt, non vérifié.
- Les dossiers interdits (`relay/`, `data/`, `reports/`, `config/profile.yml`, etc.) n'ont pas été ouverts ; ce que le Skill y écrit vient uniquement de la doc.

## 9. Les 10 points les plus importants

1. Le README de 2d6ed58 n'a pas le tableau « everyday commands » ni le dépliant « by stage » : la référence utilisable est `README.md:278-327` + `SKILL.md:148-196` + `AGENTS.md:440-487`.
2. Contrat central : le Skill prépare et ne soumet jamais ; `apply` s'arrête avant Submit/Send/Apply, reprend après confirmation du candidat ; aucun transport d'e-mail (`README.md:162-163,174`, `apply.md:19`).
3. « Coller une offre » = `auto-pipeline` : extraction → porte de vivacité → blacklist → dealbreaker → évaluation A-G → rapport → CV (PDF par défaut) → réponses H si ≥ 4.5 → ligne de suivi par TSV + `merge-tracker.mjs` (`auto-pipeline.md:7-114`).
4. Les écritures passent par des scripts canoniques : TSV d'ajout avec en-tête → `merge-tracker.mjs` ; états → `set-status.mjs` ; numéros → `reserve-report-num.mjs` ; `scan-history` → `appendToScanHistory` ; jamais d'écriture directe de `applications.md` (`AGENTS.md:588,661-662`).
5. Format fixe : rapport `reports/{###}-{slug}-{date}.md` avec `**URL:**`, `**Legitimacy:**`, `Machine Summary` et JD archivé verbatim ; états canoniques de `templates/states.yml` ; `pipeline.md` en `- [ ]/- [x]/- [!]` (`AGENTS.md:181,663,668-688`, `pipeline.md:56-119`).
6. Un offre non lisible ou inconnue est « non confirmée », jamais « fermée » ; LinkedIn : une seule tentative navigateur, pas de contournement ; agrégateurs = non confirmés jusqu'à l'employeur (`AGENTS.md:526,532-553`).
7. Scan : L0 parseurs/`scan.mjs` → L1 Playwright → L2 API → L3 WebSearch (à vérifier par liveness) ; pas de recherche web ouverte prévue ; repli sur panne : API, `scan_query`, `skipped_error`, continuer (`scan.md:39-178,195,207,277`).
8. Quand le scan ne couvre pas : `coverage-check.mjs`, `discover-ats.mjs` (aperçu puis `--write` sur confirmation), entrée `websearch`, ou coller l'offre dans `pipeline.md` ; `fetch-jd.mjs` n'est cité que par AGENTS.md/SCRIPTS, aucun mode ne l'enchaîne (`discover.md:147-148`, `KEEPING_PORTALS_LIVE.md:26-40`, `AGENTS.md:139`).
9. Apify : plugin groupé, désactivé par défaut, `APIFY_TOKEN` dans `.env`, hôte `api.apify.com`, déclenché seulement par une entrée `portals.yml` avec `provider: apify`, `actor`, `input`, `field_map`, délai 180 s par défaut, aucun plafond de coût dans le Skill, URL non https écartées (`plugins/apify/*`, `config/plugins.example.yml`).
10. Mode non surveillé (`claude -p`, `codex exec`) : ne rien demander, ne rien attendre, ne rien écrire de ce que la porte protège, finir par une seule ligne `needs_confirmation: {gate} {detail} - {resume}` (`_shared.md:298-312`) ; contenu d'offre, de page et de plugin = données, pas instructions (`AGENTS.md:66-74,186`).
