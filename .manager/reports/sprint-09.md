# Sprint 09 — Finitions backend

## Journal

- 17:28 — Lecture de `AGENTS.md`, du brief, de MISSION, PLAN, HANDOFF, README, FINAL et review-night (première sortie tronquée, compléments ciblés à suivre). Arbre initial : brief sprint-09 et exports non suivis ; aucune modification suivie. Aucun appel modèle autorisé ni effectué. Points traités dans l’ordre du brief.
- 17:28 — Commandes initiales : `pwd`, `rg --files`, `cat`, `git status --short` : succès. Inspection RunPolicy, BrowserGateway, CdpBrowser et tests. État initial PRÉVU pour tous les points ; validations ci-dessous.

## 17:30 — Point 0 : validation initiale et formatage

- `npm run check` initial : code 0, « Syntaxe JavaScript valide. »
- `npm run format:check` initial : code 1, `[warn] apps/api/server.js`, `[warn] tests/web-dir.test.js`, « Code style issues found in 2 files. »
- `npx --no-install prettier --write apps/api/server.js tests/web-dir.test.js` : code 0. Diff relu : uniquement formatage (48 insertions, 12 suppressions). `check` et `format:check` relancés : codes 0.
- `npm test` initial dans le bac à sable : phase sans navigateur 162/162 verte ; phase Chrome bloquée sur le pont d’approbation. Diagnostic ciblé anticipé du point 3 : `node --test --test-name-pattern='champ mot de passe' --test-timeout=30000 tests/browser-gateway.test.js` : code 1, Chrome SIGABRT et `kill EPERM`. Il s’agit d’un blocage d’environnement, pas encore de la cause de l’instabilité historique. Sortie brute ci-dessous. Relance de la suite hors bac à sable demandée, Chrome isolé uniquement.

> agent-platform@0.1.0 check
> node scripts/check.js

Syntaxe JavaScript valide.

> agent-platform@0.1.0 format:check
> prettier --check apps packages domain-packs tests scripts/*.js

Checking formatting...
[warn] apps/api/server.js
[warn] tests/web-dir.test.js
[warn] Code style issues found in 2 files. Run Prettier with --write to fix.

> agent-platform@0.1.0 check
> node scripts/check.js

Syntaxe JavaScript valide.

> agent-platform@0.1.0 format:check
> prettier --check apps packages domain-packs tests scripts/*.js

Checking formatting...
All matched files use Prettier code style!
✖ Chrome réel : champ mot de passe sensible, saisie approuvée sans fuite du texte (484.641417ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 584.675375

✖ failing tests:

test at tests/browser-gateway.test.js:373:1
✖ Chrome réel : champ mot de passe sensible, saisie approuvée sans fuite du texte (484.641417ms)
  browserType.launch: Target page, context or browser has been closed
  Browser logs:

  <launching> /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,AvoidCorsURLLoaderRestartOnRedirect,Translate,AutoDeElevate,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --no-first-run --no-default-browser-check --user-data-dir=/var/folders/85/5y3ssg_162zdsww_qy9p9m_m0000gn/T/playwright_chromiumdev_profile-IQxKo0 --remote-debugging-pipe --no-startup-window
  <launched> pid=76236
  Call log:
  [2m  - <launching> /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,AvoidCorsURLLoaderRestartOnRedirect,Translate,AutoDeElevate,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --no-first-run --no-default-browser-check --user-data-dir=/var/folders/85/5y3ssg_162zdsww_qy9p9m_m0000gn/T/playwright_chromiumdev_profile-IQxKo0 --remote-debugging-pipe --no-startup-window[22m
  [2m  - <launched> pid=76236[22m
  [2m  - [pid=76236] <gracefully close start>[22m
  [2m  - [pid=76236] <kill>[22m
  [2m  - [pid=76236] <will force kill>[22m
  [2m  - [pid=76236] exception while trying to kill process: Error: kill EPERM[22m
  [2m  - [pid=76236] <process did exit: exitCode=null, signal=SIGABRT>[22m
  [2m  - [pid=76236] starting temporary directories cleanup[22m
  [2m  - [pid=76236] finished temporary directories cleanup[22m
  [2m  - [pid=76236] <gracefully close end>[22m

      at CdpBrowser.ensure (/Users/diaw/Downloads/agregateur-agent/packages/browser-gateway/cdp.js:57:37)
      at async CdpBrowser.perform (/Users/diaw/Downloads/agregateur-agent/packages/browser-gateway/cdp.js:184:18)
      at async BrowserGateway.execute (/Users/diaw/Downloads/agregateur-agent/packages/browser-gateway/index.js:120:20) {
    log: [ '  - <launching> /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-client-side-phishing-detection --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,BlockOriginHeaderModificationOnRedirect,AvoidCorsURLLoaderRestartOnRedirect,Translate,AutoDeElevate,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --export-tagged-pdf --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --edge-skip-compat-layer-relaunch --disable-infobars --disable-search-engine-choice-screen --disable-sync --enable-unsafe-swiftshader --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --no-first-run --no-default-browser-check --user-data-dir=/var/folders/85/5y3ssg_162zdsww_qy9p9m_m0000gn/T/playwright_chromiumdev_profile-IQxKo0 --remote-debugging-pipe --no-startup-window', '  - <launched> pid=76236', '  - [pid=76236] <gracefully close start>', '  - [pid=76236] <kill>', '  - [pid=76236] <will force kill>', '  - [pid=76236] exception while trying to kill process: Error: kill EPERM', '  - [pid=76236] <process did exit: exitCode=null, signal=SIGABRT>', '  - [pid=76236] starting temporary directories cleanup', '  - [pid=76236] finished temporary directories cleanup', '  - [pid=76236] <gracefully close end>' ]
  }

### 17:31 — Point 0 OPÉRATIONNEL

Relance `npm test` hors bac à sable : code 0, 199/199 tests (162 + 37), aucun skip. `check`, `format:check`, `git diff --check` verts après formatage. Les diagnostics ciblés hors bac à sable mot de passe (1/1) et pont d’approbation (1/1) passent. Aucun test supprimé. Sortie complète de la suite validée :

```text

> agent-platform@0.1.0 test
> node scripts/run-tests.js


▶ unitaires et intégration (parallèle) : 14 fichier(s)
(node:76298) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ résultat agent : JSON brut, clôturé, entouré de prose (1.32925ms)
✔ résultat agent : refus en texte libre rapporté avec extrait (0.171209ms)
✔ résultat agent : vide, JSON invalide, hors contrat (0.158833ms)
✔ résultat agent : extrait borné à 300 caractères (0.085542ms)
(node:76299) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ publicAgents : ni commande, ni chemins, ni environnement ; résumé de sonde (1.140084ms)
✔ catalogue HTTP : agents publics, sondes du dataDir (2157.257042ms)
✔ plan Auto en démonstration : fixture, raisons et rejets visibles (1876.3865ms)
✔ plan manuel : raisons « choisi manuellement » (1812.872875ms)
✔ plan : agent réel refusé hors mode live (1770.167125ms)
✔ plan : agent inconnu rejeté par le schéma (6.10475ms)
✔ plan live : modèle non annoncé au dernier test refusé (3259.105ms)
✔ régression live : la permission exposée décrit l’outil demandé (4.854375ms)
✔ régression live : Gemini reçoit la confiance de l’espace de run, pas les autres agents (0.549167ms)
✔ erreurs de validation lisibles, pas de JSON zod brut (5.810458ms)
✔ probe audit : pair muet arrêté, puis session fictive sans authentification ni prompt (20488.474917ms)
(node:76301) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ tarifs : aucun prix inventé par défaut, BYOA jamais facturable, validation stricte (0.931417ms)
✔ estimation : lignes par catégorie, externe BYOA inconnu et non refacturé (0.64775ms)
✔ ledger chaîné : vérification, modification, suppression et ligne non chaînée détectées (20.14275ms)
✔ résumé par mètre : facturable / non facturable séparés (0.1655ms)
✔ plafond mensuel : dépassement refusé sans écriture partielle (4.764333ms)
✔ estimation au-dessus du budget : lancement refusé avant toute action (4011.187334ms)
✔ plafond mensuel atteint pendant un workflow : exécution arrêtée, événement et raison visibles (1969.278292ms)
✔ mesure depuis la gateway : jeton, mètres autorisés, 402 si budget dépassé (26.601792ms)
✔ gateway de données : mesure refusée → aucune requête réseau (1.146542ms)
✔ sécurité facturation : mètres propres, unités finies, BYOA gratuit même à la couche stockage (4.126541ms)
✔ ledger : suppression de queue détectée après réouverture et écriture suivante refusée (5.065292ms)
✔ agent : appels MCP facturés avant action et arrêt au budget, aucun double comptage du workflow (2108.547792ms)
✔ estimation : les retries de lecture sont inclus, aucune relance automatique de write (0.145667ms)
✔ ledger : compteur et identifiant v2 liés à l’empreinte ; suppression totale détectée (3.734667ms)
✔ monnaie : un ledger non vide ne change pas de devise implicitement (2.921333ms)
✔ évaluation Najah : data-engineer-berlin (10.522334ms)
✔ évaluation Najah : python-remote (0.454084ms)
✔ évaluation Najah : no-false-sponsor (0.334375ms)
✔ évaluation Najah : unrelated-query (0.330042ms)
(node:76316) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ mots-clés : mots vides retirés, langages conservés (1.508834ms)
✔ normalisation des sources réelles enregistrées : provenance complète, sponsoring inconnu (2.576791ms)
✔ CSV : guillemets, virgules dans les champs, CRLF (0.127292ms)
✔ registre UK : noms normalisés, correspondance de nom ≠ identité confirmée, pas de faux positif (0.861042ms)
✔ classement explicable et déterministe ; lieux FR/EN ; bonus visa seulement si demandé (11.360667ms)
✔ vérification live : classement altéré, provenance manquante, sponsoring inventé refusés (4.852958ms)
✔ gateway de données : hôtes autorisés, HTTPS, redirections revérifiées, taille, cache, mesure (22.008375ms)
✔ rejeu : réponses réelles enregistrées, jamais de réseau, allowlist conservée (3.175666ms)
✔ toolArguments : $from relie les sorties, valeur absente omise (0.418834ms)
✔ DAG Najah réel complet via l’API, en rejeu hors ligne : recherche → registre → classement → vérification (2602.873708ms)
✔ recherche : sources entrelacées, une source abondante n’évince pas les autres (8.866458ms)
✔ sécurité cache : allowlist, format, taille et corruption revérifiés sur chaque lecture (3.18475ms)
✔ sécurité réseau : deadline totale, annulation du corps et limite en rejeu (52.204166ms)
✔ Najah : aucune source disponible ne devient pas un classement vérifié vide (0.5365ms)
✔ politique réseau : IPv4 mappées en hexadécimal et réseaux réservés refusés (0.927833ms)
✔ cache concurrent : publications atomiques et cache symbolique ignoré (16.001042ms)
✔ transport : connexion sur IP validée sans seconde résolution, taille, compression et deadline (59.241459ms)
✔ origines locales : uniquement HTTP loopback explicite, pas d’origine null ou distante (0.333625ms)
(node:76360) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ gateway refuse écriture, exfiltration et URLs ambiguës (0.62675ms)
✔ ledger refuse budget négatif/dépassement sans inscription partielle (4.718583ms)
✔ historique durable et interruption au redémarrage (3.796041ms)
✔ Skill non revu, désactivé et modifié rejeté (4.261583ms)
✔ vrai MCP : découverte, classement et refus navigateur (149.736167ms)
✔ API complète : plan → ACP → MCP → résultat, SSE replay et protections HTTP (7235.654083ms)
✔ core reste indépendant de Najah (1887.923667ms)
✔ annulation et délai maximal ne produisent pas de faux succès (3359.116709ms)
✔ permissions ponctuelles : réponse valide, expiration logique et annulation (5.376625ms)
✔ runtime : handshake réel et rejet de reprise non supportée (108.914959ms)
✔ timeout réel : initialize sans réponse rejeté dans le délai (1567.0565ms)
✔ timeout réel : session/new sans réponse (1574.005083ms)
✔ timeout réel : prompt sans réponse, puis réponse tardive ignorée (3079.57675ms)
✔ annulation par signal externe pendant le prompt (192.391041ms)
✔ signal déjà annulé : aucune requête envoyée (76.62575ms)
✔ crash de l’agent pendant une requête : erreur explicite immédiate (77.962709ms)
✔ crash au démarrage (71.555708ms)
✔ bruit non JSON sur stdout toléré (72.648083ms)
✔ permission en attente puis annulation : pas de blocage (378.403417ms)
✔ double cancel et close idempotents ; requête après fermeture refusée (129.233542ms)
✔ auth requise : erreur de session explicite (87.187042ms)
✔ environnement en liste blanche : la clé Gemini ne fuit pas vers un autre agent (81.244833ms)
✔ environnement : la clé Gemini est transmise au seul profil qui la déclare (176.25575ms)
✔ buildChildEnv : base, LC_*, profil, valeurs vides ignorées (0.14ms)
✔ redact masque valeurs connues et motifs de clés (0.080125ms)
✔ mode sûr choisi parmi les modes annoncés (modes) (72.025792ms)
✔ mode sûr via configOptions (style OpenCode) (70.968167ms)
✔ mode sûr absent : refus de lancer (69.490209ms)
✔ aucun mécanisme de mode annoncé pour un profil exigeant : refus (81.990417ms)
✔ modèle via configOptions (93.418208ms)
✔ modèle via models + session/set_model (style Gemini) (97.920917ms)
✔ modèle non annoncé refusé ; vide garde le défaut (127.103583ms)
✔ reprise : load refusé sans capacité, accepté avec (179.291125ms)
✔ describe() n’expose ni environnement ni secrets (103.978334ms)
✔ normalisation : sessionModels / sessionModes / capacités (0.241375ms)
✔ routeur Auto : mode démo → fixture explicite (0.271417ms)
✔ routeur Auto : préférence, rejets expliqués (0.121667ms)
✔ routeur Auto : session refusée au dernier test → agent suivant (0.108667ms)
✔ routeur Auto : exigence de modèle et de reprise (0.147834ms)
✔ routeur Auto : ordre explicite et transport MCP http (0.07625ms)
✔ routeur Auto : aucun candidat → erreur, jamais de repli fixture silencieux (0.121875ms)
✔ découverte : agents.json, chemins absolus exigés, node_modules exclu du PATH (0.910792ms)
✔ détection : CLI factice Gemini sans option ACP → incompatible avec raison (279.427042ms)
✔ détection : CLI factice Gemini avec --acp → compatible (123.354125ms)
✔ sondes : persistance atomique, fichier corrompu ignoré (1.853916ms)
✔ reprise avec clé API : authenticate avant session/load, dossier isolé, clé jamais transmise (69.884417ms)
✔ reprise sans clé API : pas d’authenticate, pas de dossier isolé (79.388375ms)
✔ routeur Auto : dernier prompt refusé pour authentification → agent écarté, avec raison (0.151458ms)
✔ sondes : fusion — une sonde de session n’efface pas le résultat d’inférence (1.123959ms)
(node:76434) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ sécurité : échec du mode sûr interdit ensuite le prompt et start après close (72.987375ms)
✔ sécurité : secrets masqués dans événements, permissions, erreurs et SQLite (77.358417ms)
✔ sécurité : secret du pont MCP ajouté à la liste de masquage, fermeture rejette un pair muet (143.108084ms)
✔ sécurité : changement asynchrone vers un mode dangereux ferme le runtime (78.5ms)
✔ sécurité : petit-enfant ignorant SIGTERM arrêté même après sortie du parent (1684.863833ms)
(node:76461) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ analyse : front matter, nom, description, empreinte stable (8.482458ms)
✔ analyse : scripts, binaires, motifs dangereux et licence absente signalés (1.996167ms)
✔ analyse : références à des fichiers non fournis (Skill non autonome) (3.929625ms)
✔ analyse : lien symbolique, fichier trop gros, trop de fichiers refusés (37.190417ms)
✔ cycle tiers : import en quarantaine → installation refusée → revue → actif → résolu (11.761125ms)
✔ revue refusée, nom réservé, revue des intégrés impossible (5.838208ms)
✔ intégrité : modification après revue → résolution refusée et intégrité fausse (6.003ms)
✔ versions : une nouvelle version repasse en quarantaine, historique conservé (5.940291ms)
✔ export natif : .agents/skills pour Codex/Gemini/OpenCode, .claude/skills pour Claude, sans scripts (13.264167ms)
✔ import Git : seules les URL GitHub HTTPS sont acceptées (3.166666ms)
✔ import local depuis l’API : limité aux racines autorisées (2.231334ms)
✔ Skills intégrés : comportement historique conservé (3.585583ms)
✔ sécurité : racine symbolique et import API via parent symbolique refusés (0.771375ms)
✔ sécurité Git : sous-dossier absolu, options, credentials, ports et URL décorées refusés avant clone (3.050125ms)
✔ sécurité export : octets revérifiés après resolve et destinations sans liens symboliques (6.22675ms)
✔ sécurité revue : consentement lié à l’empreinte effectivement présentée (5.36875ms)
✔ analyse bornée : snapshot stable et arborescence trop profonde refusée (2.285917ms)
✔ écriture confinée : remplacement d’un hardlink ne modifie pas sa cible extérieure (1.424875ms)
✔ API de revue : empreinte obligatoire et version courante uniquement (26.0215ms)
(node:76464) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ dist optionnel : fichiers confinés, MIME, API et protections HTTP conservées (1651.940125ms)
(node:76487) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ définition : schéma, doublons, dépendances inconnues, cycles, ordre et niveaux (3.590958ms)
✔ exécution séquentielle avec passage des sorties de dépendances (6.348417ms)
✔ parallélisme réel borné par concurrency (fan-out / fan-in) (253.141125ms)
✔ échec : dépendants ignorés, run en échec avec détail (5.936709ms)
✔ étape optionnelle en échec : le workflow continue et réussit (4.903791ms)
✔ tentatives : réussite après deux échecs, compteur persistant (4.44025ms)
✔ tentatives épuisées → échec (4.041666ms)
✔ délai d’étape : lecture en échec, écriture incertaine (jamais relancée seule) (407.279833ms)
✔ approbation humaine : attente, approbation, suite du workflow (106.790166ms)
✔ approbation refusée : dépendants ignorés (55.43875ms)
✔ annulation : étapes en cours et en attente annulées, écriture en cours incertaine (55.89025ms)
✔ sortie tardive d’une tentative abandonnée ignorée (génération) (128.824292ms)
✔ reprise après crash : étapes terminées conservées, lecture relancée, écriture incertaine (107.44775ms)
✔ exécuteur absent, sortie trop volumineuse, actions invalides (5.089375ms)
✔ événements d’étape émis et persistés pour le streaming (3.526167ms)
✔ écriture : toute erreur après lancement devient incertaine, sans relance automatique (46.723666ms)
✔ annulation pendant la notification running : exécuteur non lancé (3.884833ms)
(node:76495) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ reprise après redémarrage du serveur : étapes réussies conservées, run terminé en place (3950.439625ms)
✔ reprise refusée : run terminé, actif, ou mode agent (3960.746292ms)
✔ brouillon de candidature : attente d’approbation, approbation via l’API, aucun envoi (2082.430959ms)
✔ brouillon refusé à la relecture : workflow en échec, reprise possible (3865.538708ms)
✔ reprise concurrente : un seul contrôle et une seule exécution (16.508583ms)
✔ redémarrage : les runs anciens au-delà de la liste UI sont tous interrompus (70.769791ms)
✔ reprise : refus si la définition durable a été modifiée (3536.932875ms)
(node:76538) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ plan workflow : DAG Najah affiché avec agents, niveaux et étape optionnelle (1829.196833ms)
✔ workflow Najah complet : outils MCP réels, agent, vérification indépendante, agrégat (2040.123625ms)
✔ workflow général (core) : agent requis puis vérification de structure (2024.301ms)
✔ workflow : annulation pendant l’exécution → cancelled, étapes annulées (1758.553ms)
✔ workflow : pack sans DAG ou mode inconnu refusés (4.911584ms)
✔ aggregateOutputs : priorité au résultat vérifié, résumé d’analyse, preuves concaténées (0.139292ms)
✔ toolArguments : objectif par défaut et substitution sans évaluation (0.09ms)
✔ injection : une analyse qui modifie le classement ne passe pas la vérification (0.410583ms)
✔ proposition automatique de workflow : mots-clés, exigence réseau, défaut expliqué (0.454417ms)
✔ plan workflow « auto » : DAG proposé, raison visible, identifiant enregistré dans le run (1722.645208ms)
✔ plan : permissions affichées calculées selon le workflow réel (4822.644459ms)
✔ timeout d’étape pendant initialize : le processus ACP est fermé sans attendre le handshake (533.912334ms)
ℹ tests 162
ℹ suites 0
ℹ pass 162
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 32226.657959

▶ Chrome réel (série) : 3 fichier(s)
(node:76717) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ pont d’approbation : seules les capacités accordées sont listées (135.18625ms)
✔ pont d’approbation : « Postuler » refusé dans l’interface → aucun envoi (2236.623209ms)
✔ pont d’approbation : « Postuler » autorisé une fois → un envoi (943.478542ms)
✔ pont d’approbation : jeton invalide ou run inactif refusés (14.319292ms)
✔ pont : jeton lié au run et compteur refusé après abandon ou hors activité (3.516417ms)
✔ permission : annulation locale résout immédiatement, conserve les autres demandes et ignore une réponse tardive (3.797083ms)
✔ gateway réelle sans pont de mesure : action refusée avant lancement de Chrome (122.483ms)
✔ registre : contrats stables, schémas stricts, effets déclarés (1.891417ms)
✔ politique : https, domaines, sous-domaines, IP, ports, identifiants, local explicite (3.8325ms)
✔ politique : résolution DNS vers réseau privé refusée (rebinding) (0.372625ms)
✔ politique : détection des éléments sensibles (0.427667ms)
✔ politique : chemins de fichiers confinés au dossier du run (0.2985ms)
✔ politique : sérialisation pour le processus MCP (0.098ms)
✔ redaction : clés, numéros de carte, troncature (0.209042ms)
✔ gateway : lecture sans approbation, contenu marqué non fiable, mesure (0.649792ms)
✔ gateway : clic sensible refusé sans approbation humaine, même auto-approuvé (0.468333ms)
✔ gateway : clic approuvé exécuté ; texte saisi jamais transmis à l’approbation (0.45475ms)
✔ gateway : capacités non accordées, arguments hors contrat, élément absent (0.312291ms)
✔ gateway : domaine interdit et redirection vers domaine interdit bloqués (0.21925ms)
✔ gateway : upload hors dossier et lien symbolique refusés (0.870042ms)
✔ CdpBrowser : endpoint distant refusé, configuration requise (0.108625ms)
✔ Chrome réel isolé : navigation, instantané d’accessibilité, extraction (728.420291ms)
✔ Chrome réel : « Postuler » refusé → aucun envoi au serveur (589.167709ms)
✔ Chrome réel : « Postuler » approuvé → un seul envoi (603.453083ms)
✔ Chrome réel : champ mot de passe sensible, saisie approuvée sans fuite du texte (627.229791ms)
✔ Chrome réel : redirection serveur vers domaine interdit bloquée (768.936209ms)
✔ Chrome réel : téléchargement dans le dossier du run, taille limitée (702.976292ms)
✔ Chrome partagé via CDP (comme le relais Playwriter) : onglets utilisateur intacts, navigateur jamais fermé (866.652167ms)
✔ Chrome : sous-ressources, iframe, popup et redirections en chaîne restent confinés (1243.25425ms)
✔ gateway : un élément modifié pendant l’approbation ne reçoit pas le consentement précédent (0.63125ms)
✔ Chrome : téléchargement refuse un dossier symlink (578.3945ms)
✔ gateway : upload revalidé après consentement et appels sérialisés (26.144834ms)
✔ Chrome : redirection 303 après formulaire ne répète pas le POST approuvé (564.890625ms)
(node:76903) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ E2E interface : workflow Najah, étapes en direct, résultats fictifs étiquetés, coût (7700.2225ms)
✔ E2E interface : brouillon de candidature, approbation humaine dans l’interface (7558.862709ms)
✔ E2E interface : estimation au-dessus du budget signalée puis lancement refusé (6906.707708ms)
✔ E2E interface : saisie avant chargement du catalogue sans erreur (3424.039375ms)
ℹ tests 37
ℹ suites 0
ℹ pass 37
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 36757.037583

```

## 17:31 — Point 1 OPÉRATIONNEL

- `run-sprint.sh` déjà présent au commit `41735e8`, aucune modification nécessaire.
- Ajout de `exports/` au `.gitignore`. `git check-ignore exports/claude-design/` retourne `exports/claude-design/` (code 0), `git diff --check` vert. Les fichiers zip existants restent locaux.
- Les 199 tests et les deux contrôles du point 0 sont toujours applicables : seul `.gitignore` et le rapport changent depuis cette validation ; aucun code modifié.

- 17:31 — Les deux tentatives de commit des points 0 et 1 ont échoué avant écriture de l’index : `fatal: Unable to create .../.git/index.lock: Operation not permitted` (code 128). Le bac à sable autorise les fichiers du dépôt mais interdit `.git` ; relance avec permissions adaptées. Aucun commit créé lors des deux échecs.

## Point 2 — Implémentation en cours

- 17:32 — `RunPolicy` : `allowJavaScript` et `allowSharedContext` booléens, défaut false, `runId` explicite, sérialisation sans consentement. Options demandées au démarrage par `AGENT_PLATFORM_BROWSER_JAVASCRIPT=1` / `AGENT_PLATFORM_BROWSER_SHARED_CONTEXT=1` ; les arguments MCP restent stricts et ne permettent pas de les activer.
- `BrowserGateway` appelle la préparation du provider avant toute ouverture/description. Le provider demande une approbation humaine distincte, sensible, par option, via le pont existant (événements permission et permission_resolved persistés). Autorisation en mémoire privée, liée à l’instance, au run et à la politique complète ; ni JSON ni autoApprove ne peuvent l’accorder. Changer de run ou de politique impose un autre provider/consentement. Pas de persistance réutilisable après redémarrage.
- Mode CDP : contexte dédié par défaut ; partage explicite du contexte utilisateur seulement après accord. Le routage laisse les onglets existants continuer, les réglages JS et bypass service worker visent uniquement l’onglet plateforme. Fermeture : retrait du handler et de l’écouteur, fermeture uniquement de notre page, jamais du contexte partagé.
- Tests ciblés initiaux : options 3/3, Chrome (JS et CDP défaut) 2/2, codes 0. Tests intégration du pont et contexte partagé réel ajoutés ; validation en cours. Recherche `rg ... tests/core.test.js` : fichier absent (code 2), nom erroné dans une recherche, aucun effet produit.

- 17:33 — La première suite sous bac à sable a continué à échouer (Chrome SIGABRT, 15 s CDP, attentes d’approbation 42 s), puis restait vivante après les échecs E2E. `ps` hors bac à sable a identifié exclusivement ses descendants ; `kill -TERM 77094 76080 75553` : code 0. La relance validée du point 0 était indépendante et terminée avec code 0. Échecs initiaux complets archivés dans le rapport ci-dessous.
- Première suite du point 2 : consentements via pont (refus, accord enregistré, annulation) verts ; nouveau scénario de contexte partagé rouge. Diagnostic TAP ciblé lancé pour conserver la cause avant correction.

## 17:34 — Point 2 : erreur détectée et correction

- Première suite navigateur : 43/44 verts, 1 rouge. Le test partagé réel a prouvé que détacher la session CDP réactive JavaScript : titre `FICTIF script actif` au lieu de `FICTIF sans script`. Correction : conserver la session CDP de notre page jusqu’au reset/close. Relance ciblée partagée + JS : 2/2 verts, code 0. Aucune assertion affaiblie.
- Consentement renforcé contre mutation de politique ou fermeture pendant la décision. Tests supplémentaires : refus partiel, mutation, fermeture ; documentation ADR 006 des options, risques scripts/cookies, absence d’isolation OS, perturbation possible des requêtes sans frame, extension Playwriter non validée.
- `npm run check`, `npm run format:check`, `git diff --check` : codes 0. Suite complète en cours avant commit.

Sortie TAP de l’échec confirmé :
```text
TAP version 13
# Subtest: Chrome partagé via CDP (comme le relais Playwriter) : onglets utilisateur intacts, navigateur jamais fermé
not ok 1 - Chrome partagé via CDP (comme le relais Playwriter) : onglets utilisateur intacts, navigateur jamais fermé
  ---
  duration_ms: 2115.705125
  type: 'test'
  location: '/Users/diaw/Downloads/agregateur-agent/tests/browser-gateway.test.js:422:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly equal:
    + actual - expected

    + 'FICTIF script actif'
    - 'FICTIF sans script'
               ^

  code: 'ERR_ASSERTION'
  name: 'AssertionError'
  expected: 'FICTIF sans script'
  actual: 'FICTIF script actif'
  operator: 'strictEqual'
  stack: |-
    TestContext.<anonymous> (file:///Users/diaw/Downloads/agregateur-agent/tests/browser-gateway.test.js:493:16)
    async Test.run (node:internal/test_runner/test:1125:7)
    async startSubtestAfterBootstrap (node:internal/test_runner/harness:358:3)
  ...
1..1
# tests 1
# suites 0
# pass 0
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2244.770958

```
Correction ciblée :
```text
✔ Chrome partagé via CDP (comme le relais Playwriter) : onglets utilisateur intacts, navigateur jamais fermé (1259.740583ms)
✔ Chrome : JavaScript désactivé par défaut, activé après consentement et réseau toujours filtré (1105.597167ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2448.859334

```

- 17:35 — `git diff --check` a détecté deux lignes vides avec espaces dans la sortie TAP copiée au rapport (code 2). Espaces finaux retirés du rapport uniquement ; sortie de test inchangée sur le fond.

## 17:35 — Point 2 OPÉRATIONNEL

- Suite complète : code 0, **207/207** tests (162 + 45), aucun skip. Après dernière revue du routage partagé (suivi des pages par WeakSet pour ne pas bloquer les onglets utilisateur pendant un reset), tous les tests BrowserGateway relancés : **31/31**, code 0. Les autres chemins sont inchangés.
- `check` et `format:check` : codes 0. État du fournisseur isolé et du partage de contexte temporaire : OPÉRATIONNEL sur Chrome réel. Transport extension Playwriter : INCOMPLET, extension non testée. Pas de modèle appelé.

Sorties brutes pertinentes :
```text
▶ unitaires et intégration (parallèle) : 14 fichier(s)
ℹ tests 162
ℹ suites 0
ℹ pass 162
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 32367.046083
▶ Chrome réel (série) : 3 fichier(s)
ℹ tests 45
ℹ suites 0
ℹ pass 45
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 41160.407625
✔ registre : contrats stables, schémas stricts, effets déclarés (1.965792ms)
✔ politique : https, domaines, sous-domaines, IP, ports, identifiants, local explicite (4.007292ms)
✔ politique : résolution DNS vers réseau privé refusée (rebinding) (0.424042ms)
✔ politique : détection des éléments sensibles (0.442292ms)
✔ politique : chemins de fichiers confinés au dossier du run (0.324208ms)
✔ politique : sérialisation pour le processus MCP (0.121209ms)
✔ redaction : clés, numéros de carte, troncature (0.2075ms)
✔ gateway : lecture sans approbation, contenu marqué non fiable, mesure (0.660834ms)
✔ gateway : clic sensible refusé sans approbation humaine, même auto-approuvé (0.458ms)
✔ gateway : clic approuvé exécuté ; texte saisi jamais transmis à l’approbation (0.44125ms)
✔ gateway : capacités non accordées, arguments hors contrat, élément absent (0.30775ms)
✔ gateway : domaine interdit et redirection vers domaine interdit bloqués (0.204458ms)
✔ gateway : upload hors dossier et lien symbolique refusés (1.1405ms)
✔ CdpBrowser : endpoint distant refusé, configuration requise (0.124417ms)
✔ Chrome réel isolé : navigation, instantané d’accessibilité, extraction (859.097ms)
✔ Chrome réel : « Postuler » refusé → aucun envoi au serveur (717.516166ms)
✔ Chrome réel : « Postuler » approuvé → un seul envoi (858.549958ms)
✔ Chrome réel : champ mot de passe sensible, saisie approuvée sans fuite du texte (775.999334ms)
✔ Chrome réel : redirection serveur vers domaine interdit bloquée (1004.4955ms)
✔ Chrome réel : téléchargement dans le dossier du run, taille limitée (842.448417ms)
✔ Chrome partagé via CDP (comme le relais Playwriter) : onglets utilisateur intacts, navigateur jamais fermé (1183.536833ms)
✔ Chrome : sous-ressources, iframe, popup et redirections en chaîne restent confinés (1519.239166ms)
✔ gateway : un élément modifié pendant l’approbation ne reçoit pas le consentement précédent (0.440083ms)
✔ Chrome : téléchargement refuse un dossier symlink (869.737833ms)
✔ gateway : upload revalidé après consentement et appels sérialisés (25.743208ms)
✔ Chrome : redirection 303 après formulaire ne répète pas le POST approuvé (863.714625ms)
✔ options navigateur : défaut sûr, booléens stricts et aller-retour JSON sans consentement (0.217625ms)
✔ options navigateur : aucun lancement sans consentement, y compris JSON prétendument approuvé (0.225416ms)
✔ options navigateur : consentement strict, non transférable et changement de politique refusé (0.202625ms)
✔ Chrome : JavaScript désactivé par défaut, activé après consentement et réseau toujours filtré (1303.988208ms)
✔ options navigateur : refus partiel, mutation et fermeture pendant le consentement restent fermés (0.296459ms)
ℹ tests 31
ℹ suites 0
ℹ pass 31
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 10931.37675

> agent-platform@0.1.0 check
> node scripts/check.js

Syntaxe JavaScript valide.

> agent-platform@0.1.0 format:check
> prettier --check apps packages domain-packs tests scripts/*.js

Checking formatting...
All matched files use Prettier code style!

```

## Point 3 — Journal reconstitué après erreur de manipulation du rapport

- 17:35 — Confirmation : première suite sous bac à sable arrêtée en code 143 (SIGTERM de ses seuls descendants identifiés). Relance hors bac à sable du point 2 terminée code 0 et commitée. Lancement de `/tmp/sprint09-stress.py` : 64 processus `node --test --test-name-pattern='champ mot de passe' --test-timeout=15000 tests/browser-gateway.test.js`, concurrence 8, superviseur 25 s. Ports 0, profils Chrome jetables, sites fictifs, aucun modèle.
- 17:36 — Premier banc : 63 essais réussis, essai 34 en timeout superviseur à 25 s. Le harness initial ne gérait pas TimeoutExpired et n’a pas sauvegardé sa sortie : traceback brut conservé dans `sprint-09-evidence/first-harness-timeout.txt`. Aucune déclaration de 64/64. Chrome temporaire orphelin 79624 identifié par `ps` (PPID 1, profil playwright_chromiumdev_profile-4Mvjmy), `kill -TERM 79624` réussi.
- 17:37 — Instrumentation du test par `BROWSER_STRESS_TRACE=1`, traces `DEBUG=pw:api,pw:browser`. Banc corrigé : logs écrits immédiatement, délai superviseur 35 s, arrêt des seuls processus/groupe Chrome identifiés depuis chaque log. Sortie consolidée avant correction : 62/64, échecs 18 et 25 (code 124). Dans les DEUX traces : `browserType.launch succeeded`, puis `browser.newContext started` sans retour ; aucune navigation/saisie. À 15 s, cleanup lance browser.close qui attend aussi. Le superviseur nettoie les Chrome 80378 et 80484 ; `ps` confirme leur absence.
- Cause reproductible du chemin : création séparée d’un contexte incognito (`launch` + `newContext`, dernier appel non borné) sous contention de démarrage Chrome ; fermeture gracieuse bloquée également. Pas un conflit de port, ni le champ mot de passe. La cause interne au binaire Chromium reste inconnue ; les traces localisent précisément le blocage contourné.
- 17:38 — Source Playwright installée inspectée : `node_modules/playwright-core/lib/coreBundle.js` (`_innerLaunch`, `launchPersistentContext`, `defaultArgs`, profil vide = mkdtemp nettoyé, page initiale about:blank). Deux premières recherches de fichiers internes présumaient une structure non bundlée : `rg` code 2, fichiers absents ; correction vers coreBundle.js, aucune dépendance modifiée.
- Correction `CdpBrowser` isolé : `launchPersistentContext('', options)`, deadline de démarrage 30 s configurable strictement positive, options JS/workers intégrées ; réutilisation de la page initiale vérifiée about:blank après installation des gardes. Profil toujours JETABLE, jamais utilisateur. Plus de newContext/newPage non borné au démarrage isolé. Le chemin CDP est inchangé par ce correctif.
- Test de contrat ajouté avant correction : rouge `TypeError: chromium.launch is not a function` sur faux Chromium qui propose le lancement atomique ; vert après correction. Cleanup du serveur local de test désormais attendu avec closeAllConnections. Augmenter le timeout ou baisser la concurrence a été rejeté : cela aurait caché la contention.
- 17:38–17:39 — Même banc tracé après correction : **64/64 essais consécutifs verts**, concurrence 8, 33,62 s, aucun skip. Traces rouges, résumés avant/après et banc reproductible conservés dans `sprint-09-evidence/`. Commande reproductible : `python3 .manager/reports/sprint-09-evidence/stress.py` (Chrome et permissions de processus nécessaires). Le banc temporaire écrit dans /tmp ; les preuves avant ont été sauvegardées avant leur réutilisation.
- 17:39 — Test supplémentaire du faux exécutable muet : deadline rejetée à 1 s, mais assertion erronée d’ESRCH immédiat rouge. Premier diagnostic « bac à sable » insuffisant : même échec hors bac à sable. TAP brut dans `sprint-09-evidence/deadline-wrong-assumption.txt`. `DEBUG=pw:browser` montre Browser.close gracieuse en attente : ce faux binaire ne parle pas CDP, même pour fermer. Le test a été corrigé pour prouver la deadline et tuer explicitement SA fixture en cleanup, sans prétendre que le produit détruit immédiatement n’importe quel exécutable récalcitrant. `ps` ultérieur ne trouve plus ces fixtures/testeurs ; aucune terminaison supplémentaire nécessaire.
- 17:40 — `npm run check` et `npm run format:check` verts ; suite complète hors bac à sable lancée. ADR 006 complété : profil jetable, cause, preuve de charge et limite du binaire complètement muet.
- 17:41 — ERREUR de manipulation du rapport : un script de suppression d’espaces finaux a ouvert ce fichier en écriture avant de le lire, le tronquant à une ligne. Détecté immédiatement par `wc -l`. Restauration des points 0–2 depuis `git show HEAD:.manager/reports/sprint-09.md` (aucune réécriture Git), puis reconstitution de ce journal du point 3 depuis les appels outils et preuves /tmp conservées. Code, tests, preuves et commits intacts. Cette erreur est consignée explicitement, pas effacée du bilan.

### Sorties brutes du point 3

Avant correction (banc tracé) :
```text
Essai 08/64 : code 0
Essai 02/64 : code 0
Essai 03/64 : code 0
Essai 05/64 : code 0
Essai 01/64 : code 0
Essai 06/64 : code 0
Essai 07/64 : code 0
Essai 04/64 : code 0
Essai 13/64 : code 0
Essai 16/64 : code 0
Essai 14/64 : code 0
Essai 11/64 : code 0
Essai 15/64 : code 0
Essai 10/64 : code 0
Essai 12/64 : code 0
Essai 09/64 : code 0
Essai 23/64 : code 0
Essai 19/64 : code 0
Essai 17/64 : code 0
Essai 20/64 : code 0
Essai 22/64 : code 0
Essai 21/64 : code 0
Essai 24/64 : code 0
Essai 26/64 : code 0
Essai 29/64 : code 0
Essai 27/64 : code 0
Essai 28/64 : code 0
Essai 30/64 : code 0
Essai 31/64 : code 0
Essai 34/64 : code 0
Essai 33/64 : code 0
Essai 36/64 : code 0
Essai 32/64 : code 0
Essai 35/64 : code 0
Essai 37/64 : code 0
Essai 39/64 : code 0
Essai 38/64 : code 0
Essai 42/64 : code 0
Essai 41/64 : code 0
Essai 40/64 : code 0
Essai 43/64 : code 0
Essai 48/64 : code 0
Essai 47/64 : code 0
Essai 49/64 : code 0
Essai 46/64 : code 0
Essai 44/64 : code 0
Essai 45/64 : code 0
Essai 50/64 : code 0
Essai 51/64 : code 0
Essai 52/64 : code 0
Essai 53/64 : code 0
Essai 54/64 : code 0
Essai 55/64 : code 0
Essai 57/64 : code 0
Essai 56/64 : code 0
Essai 58/64 : code 0
Essai 59/64 : code 0
Essai 60/64 : code 0
Essai 61/64 : code 0
Essai 63/64 : code 0
Essai 62/64 : code 0
Essai 64/64 : code 0
Essai 18/64 : code 124
Essai 25/64 : code 124
TOTAL: 62/64 ; concurrence 8 ; durée 47.30s ; échecs [18, 25]

```
Après correction :
```text
Essai 08/64 : code 0
Essai 02/64 : code 0
Essai 05/64 : code 0
Essai 03/64 : code 0
Essai 07/64 : code 0
Essai 04/64 : code 0
Essai 01/64 : code 0
Essai 06/64 : code 0
Essai 15/64 : code 0
Essai 12/64 : code 0
Essai 14/64 : code 0
Essai 09/64 : code 0
Essai 10/64 : code 0
Essai 16/64 : code 0
Essai 13/64 : code 0
Essai 11/64 : code 0
Essai 23/64 : code 0
Essai 21/64 : code 0
Essai 22/64 : code 0
Essai 18/64 : code 0
Essai 17/64 : code 0
Essai 19/64 : code 0
Essai 20/64 : code 0
Essai 31/64 : code 0
Essai 26/64 : code 0
Essai 24/64 : code 0
Essai 27/64 : code 0
Essai 29/64 : code 0
Essai 25/64 : code 0
Essai 28/64 : code 0
Essai 30/64 : code 0
Essai 32/64 : code 0
Essai 33/64 : code 0
Essai 34/64 : code 0
Essai 36/64 : code 0
Essai 38/64 : code 0
Essai 37/64 : code 0
Essai 35/64 : code 0
Essai 39/64 : code 0
Essai 41/64 : code 0
Essai 40/64 : code 0
Essai 42/64 : code 0
Essai 43/64 : code 0
Essai 44/64 : code 0
Essai 45/64 : code 0
Essai 47/64 : code 0
Essai 46/64 : code 0
Essai 50/64 : code 0
Essai 48/64 : code 0
Essai 49/64 : code 0
Essai 53/64 : code 0
Essai 54/64 : code 0
Essai 52/64 : code 0
Essai 55/64 : code 0
Essai 51/64 : code 0
Essai 56/64 : code 0
Essai 57/64 : code 0
Essai 58/64 : code 0
Essai 59/64 : code 0
Essai 60/64 : code 0
Essai 61/64 : code 0
Essai 63/64 : code 0
Essai 64/64 : code 0
Essai 62/64 : code 0
TOTAL: 64/64 ; concurrence 8 ; durée 33.62s ; échecs []

```
Test de contrat avant correction :
```text
✖ Chrome isolé : contexte et page initiale font partie du lancement borné, sans newContext (1.993791ms)
ℹ tests 1
ℹ suites 0
ℹ pass 0
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 76.301375

✖ failing tests:

test at tests/browser-gateway.test.js:854:1
✖ Chrome isolé : contexte et page initiale font partie du lancement borné, sans newContext (1.993791ms)
  TypeError: chromium.launch is not a function
      at CdpBrowser.ensure (file:///Users/diaw/Downloads/agregateur-agent/packages/browser-gateway/cdp.js:110:37)
      at TestContext.<anonymous> (file:///Users/diaw/Downloads/agregateur-agent/tests/browser-gateway.test.js:890:33)
      at Test.runInAsyncScope (node:async_hooks:228:14)
      at Test.run (node:internal/test_runner/test:1118:25)
      at Test.start (node:internal/test_runner/test:1015:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17)

```

## 17:41 — Point 3 OPÉRATIONNEL

Correction du chemin de démarrage isolé prouvée par 64/64 essais consécutifs sous charge et suite complète **210/210** (162 + 48), aucun skip. `check`, `format:check`, `git diff --check` verts. Limites : cause interne Chromium non déterminée, pas de garantie universelle pour tout binaire récalcitrant ; mode CDP non modifié par ce correctif de contention du mode isolé. Aucun modèle appelé.

Sorties brutes de validation :
```text
▶ unitaires et intégration (parallèle) : 14 fichier(s)
ℹ tests 162
ℹ suites 0
ℹ pass 162
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 31405.255417
▶ Chrome réel (série) : 3 fichier(s)
✔ Chrome isolé : contexte et page initiale font partie du lancement borné, sans newContext (0.20325ms)
✔ Chrome isolé : délai du faux exécutable muet et nettoyage explicite de la fixture (1007.913417ms)
✔ Chrome isolé : délai de démarrage strictement positif et entier (0.7175ms)
ℹ tests 48
ℹ suites 0
ℹ pass 48
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 37525.498583

> agent-platform@0.1.0 check
> node scripts/check.js

Syntaxe JavaScript valide.

> agent-platform@0.1.0 format:check
> prettier --check apps packages domain-packs tests scripts/*.js

Checking formatting...
All matched files use Prettier code style!

```
