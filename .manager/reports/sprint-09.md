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

## 17:42 — Point 4 OPÉRATIONNEL

- `.manager/reports/FINAL.md` réécrit avec §7 review-night + sprint 09, 10 critères MVP et preuves par fichier de test/commande, statuts OPÉRATIONNEL / SIMULÉ / INCOMPLET / PRÉVU explicites. Dernier décompte réel 210/210 (162 + 48), zéro skip ; aucune inférence fournisseur de ce sprint revendiquée.
- Lecture ciblée de `docs/research/live-probe.json` (statuts seulement) et noms de tests réels ; aucune nouvelle sonde fournisseur. Les commandes de démarrage seront effectivement contrôlées au point 5 ; renvoi vers son journal, pas de sortie inventée.
- Dernière suite et contrôles verts du point 3 toujours applicables : seules les documentations changent. `git diff --check` relancé avant commit.

## 17:42 — Point 5 : vérification du README

- Début par `npm ci --ignore-scripts`, après fin de tous les tests pour ne pas modifier node_modules pendant leur exécution. Versions déjà épinglées dans le lock, aucune nouvelle dépendance ; aucun script de paquet exécuté.
- Port 4310 signalé occupé dans HANDOFF : le serveur du manager doit rester intact. Les démarrages seront testés avec un port libre explicite, puis vérification HTTP et arrêt de NOS processus uniquement. Aucun run réel, authentification, clé ou prompt fournisseur ne sera lancé. Les exemples d’inférence et le relais Playwriter seront distingués des commandes de démarrage sans modèle.

## 17:44 — Point 5 : résultats des commandes

- `npm ci --ignore-scripts` : code 0, 129 paquets ajoutés, 130 audités, 0 vulnérabilité déclarée par npm. Aucun changement de lock/dépendance. `npm run doctor` : code 0, détection des CLI seulement. `npm run demo` : code 0, état completed et simulated:true pour les offres fictives.
- Pour préserver la base `.data` et les processus du manager, les commandes npm start ont été réellement exécutées depuis une copie `git archive HEAD` dans `/tmp/sprint09-readme.0VqKUz`, avec node_modules du projet en lien et nouvelle base isolée. Aucun fichier d’authentification copié. Les variables sensibles ne sont pas journalisées et la clé Gemini est retirée des environnements de ces serveurs.
- `npm start` sans port : code 1, EADDRINUSE 127.0.0.1:4310 (serveur du manager laissé intact). `PORT=0 npm start`, live, fixture, isolated avec chemin Chrome, playwriter, et `PORT=4311 npm start` : tous démarrent ; pour chacun GET /, /api/catalog, /api/runs = HTTP 200, historique isolé []. Arrêt explicite des seuls groupes créés : code -15 attendu (SIGTERM de test). Aucun run réel créé, aucune connexion navigateur utilisateur.
- Démarrage playwriter validé = API disponible seulement (connexion différée). Relais/extension toujours INCOMPLETS, pas installés ni contactés. Chrome isolé/CDP temporaires sont validés par les tests du sprint.
- README : ajout de la résolution du port occupé dès le démarrage, port 0, options/consentements et paresse du fournisseur navigateur ; suppression des blocs d’inférence redondants non validables sans consommation ; diagnostics/session et prompts réels distingués ; décompte 210, modèle configOptions OU models et estimation indicative corrigés d’après le code. Les scripts live restent documentés comme opérations réelles séparées, non exécutées ici (interdiction d’appels modèle du brief et accès utilisateur requis).

Sorties brutes installation et démarrages :
```text

added 129 packages, and audited 130 packages in 5s

49 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities

COMMANDE : npm start (port par défaut)

> agent-platform@0.1.0 start
> node apps/api/server.js

(node:83379) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
node:events:486
      throw er; // Unhandled 'error' event
      ^

Error: listen EADDRINUSE: address already in use 127.0.0.1:4310
    at Server.setupListenHandle [as _listen2] (node:net:1948:16)
    at listenInCluster (node:net:2005:12)
    at node:net:2214:7
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)
Emitted 'error' event on Server instance at:
    at emitErrorNT (node:net:1984:8)
    at process.processTicksAndRejections (node:internal/process/task_queues:90:21) {
  code: 'EADDRINUSE',
  errno: -48,
  syscall: 'listen',
  address: '127.0.0.1',
  port: 4310
}

Node.js v24.14.1

Pas de démarrage ; exit=1
Arrêt de notre groupe de test : code 1

COMMANDE : PORT=0 npm start

> agent-platform@0.1.0 start
> node apps/api/server.js

(node:83396) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
Agent Platform : http://127.0.0.1:63504 — mode démonstration

GET / : HTTP 200, 7877 octets
GET /api/catalog : HTTP 200, 12210 octets
GET /api/runs : HTTP 200, 2 octets
Historique isolé : []
DÉMARRAGE ET HTTP VALIDÉS ; aucun run créé
Arrêt de notre groupe de test : code -15

COMMANDE : AGENT_PLATFORM_LIVE=1 PORT=0 npm start

> agent-platform@0.1.0 start
> node apps/api/server.js

(node:83416) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
Agent Platform : http://127.0.0.1:63508 — BYOA réel disponible

GET / : HTTP 200, 7877 octets
GET /api/catalog : HTTP 200, 12209 octets
GET /api/runs : HTTP 200, 2 octets
Historique isolé : []
DÉMARRAGE ET HTTP VALIDÉS ; aucun run créé
Arrêt de notre groupe de test : code -15

COMMANDE : AGENT_PLATFORM_BROWSER=fixture PORT=0 npm start

> agent-platform@0.1.0 start
> node apps/api/server.js

(node:83461) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
Agent Platform : http://127.0.0.1:63513 — mode démonstration

GET / : HTTP 200, 7877 octets
GET /api/catalog : HTTP 200, 12210 octets
GET /api/runs : HTTP 200, 2 octets
Historique isolé : []
DÉMARRAGE ET HTTP VALIDÉS ; aucun run créé
Arrêt de notre groupe de test : code -15

COMMANDE : AGENT_PLATFORM_BROWSER=isolated AGENT_PLATFORM_CHROME_PATH=Chrome AGENT_PLATFORM_LIVE=1 PORT=0 npm start

> agent-platform@0.1.0 start
> node apps/api/server.js

(node:83482) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
Agent Platform : http://127.0.0.1:63517 — BYOA réel disponible

GET / : HTTP 200, 7877 octets
GET /api/catalog : HTTP 200, 12209 octets
GET /api/runs : HTTP 200, 2 octets
Historique isolé : []
DÉMARRAGE ET HTTP VALIDÉS ; aucun run créé
Arrêt de notre groupe de test : code -15

COMMANDE : AGENT_PLATFORM_BROWSER=playwriter AGENT_PLATFORM_LIVE=1 PORT=0 npm start

> agent-platform@0.1.0 start
> node apps/api/server.js

(node:83505) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
Agent Platform : http://127.0.0.1:63522 — BYOA réel disponible

GET / : HTTP 200, 7877 octets
GET /api/catalog : HTTP 200, 12209 octets
GET /api/runs : HTTP 200, 2 octets
Historique isolé : []
DÉMARRAGE ET HTTP VALIDÉS ; aucun run créé
Arrêt de notre groupe de test : code -15

COMMANDE : PORT=4311 npm start

> agent-platform@0.1.0 start
> node apps/api/server.js

(node:83528) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
Agent Platform : http://127.0.0.1:4311 — mode démonstration

GET / : HTTP 200, 7877 octets
GET /api/catalog : HTTP 200, 12210 octets
GET /api/runs : HTTP 200, 2 octets
Historique isolé : []
DÉMARRAGE ET HTTP VALIDÉS ; aucun run créé
Arrêt de notre groupe de test : code -15

```
Diagnostic CLI :
```text

> agent-platform@0.1.0 doctor
> node apps/companion/doctor.js

{
  "node": "v24.14.1",
  "agents": [
    {
      "id": "fixture",
      "name": "Démonstrateur ACP",
      "command": "/usr/local/bin/node",
      "args": [
        "/Users/diaw/Downloads/agregateur-agent/tests/fixtures/agent.js"
      ],
      "simulated": true,
      "env": [],
      "safeModes": [],
      "preference": 99,
      "installed": true,
      "compatible": true,
      "version": "fixture-0.1.0",
      "readiness": "test-reproductible"
    },
    {
      "id": "codex",
      "name": "Codex",
      "cli": "codex",
      "package": "codex-acp",
      "env": [
        "CODEX_HOME",
        "OPENAI_API_KEY",
        "CODEX_API_KEY"
      ],
      "safeModes": [
        "read-only"
      ],
      "preference": 1,
      "command": "/Users/diaw/Downloads/agregateur-agent/node_modules/.bin/codex-acp",
      "args": [],
      "cliPath": "/Users/diaw/.local/bin/codex",
      "installed": true,
      "compatible": true,
      "reason": null,
      "version": "codex-cli 0.163.0",
      "readiness": "handshake-requis"
    },
    {
      "id": "claude",
      "name": "Claude Code",
      "cli": "claude",
      "package": "claude-agent-acp",
      "env": [
        "ANTHROPIC_API_KEY",
        "CLAUDE_CONFIG_DIR"
      ],
      "safeModes": [
        "default"
      ],
      "preference": 2,
      "command": "/Users/diaw/Downloads/agregateur-agent/node_modules/.bin/claude-agent-acp",
      "args": [],
      "cliPath": "/usr/local/bin/claude",
      "installed": true,
      "compatible": true,
      "reason": null,
      "version": "2.1.114 (Claude Code)",
      "readiness": "handshake-requis"
    },
    {
      "id": "gemini",
      "name": "Gemini CLI",
      "cli": "gemini",
      "acpFlags": [
        "--acp",
        "--experimental-acp"
      ],
      "env": [
        "GEMINI_API_KEY",
        "GOOGLE_API_KEY",
        "GOOGLE_CLOUD_PROJECT",
        "GEMINI_CLI_HOME"
      ],
      "safeModes": [
        "default",
        "plan"
      ],
      "fixedEnv": {
        "GEMINI_CLI_TRUST_WORKSPACE": "true"
      },
      "apiKeyAuth": {
        "envKey": "GEMINI_API_KEY",
        "methodId": "gemini-api-key",
        "homeEnv": "GEMINI_CLI_HOME"
      },
      "preference": 3,
      "command": "/Users/diaw/Downloads/agent-repos/.cli/node_modules/.bin/gemini",
      "args": [
        "--acp"
      ],
      "cliPath": "/Users/diaw/Downloads/agent-repos/.cli/node_modules/.bin/gemini",
      "installed": true,
      "compatible": true,
      "reason": null,
      "version": "0.65.0",
      "readiness": "handshake-requis"
    },
    {
      "id": "opencode",
      "name": "OpenCode",
      "cli": "opencode",
      "args": [
        "acp",
        "--hostname",
        "127.0.0.1",
        "--pure"
      ],
      "env": [
        "OPENCODE_CONFIG",
        "OPENCODE_CONFIG_DIR"
      ],
      "safeModes": [
        "plan"
      ],
      "preference": 4,
      "command": "/Users/diaw/Downloads/agent-repos/.cli/node_modules/.bin/opencode",
      "cliPath": "/Users/diaw/Downloads/agent-repos/.cli/node_modules/.bin/opencode",
      "installed": true,
      "compatible": true,
      "reason": null,
      "version": "1.19.4",
      "readiness": "handshake-requis"
    }
  ],
  "note": "Présence/version ne prouvent ni authentification ni capacité de prompt. npm run test:live teste le handshake."
}

```
Démonstration :
```text

> agent-platform@0.1.0 demo
> node scripts/demo.js

(node:83432) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
{
  "id": "e348771a-97f2-401a-a923-7c13025ece5f",
  "createdAt": "2026-10-25T06:43:16.798Z",
  "state": "completed",
  "prompt": "Rechercher des offres d'emploi Python SQL",
  "agent": "fixture",
  "pack": "najah",
  "skills": [
    "opportunity-analysis",
    "evidence-review"
  ],
  "model": "",
  "budgetCents": 0,
  "mode": "agent",
  "cwd": "/var/folders/85/5y3ssg_162zdsww_qy9p9m_m0000gn/T/relay-demo-lFkDUb/workspaces/e348771a-97f2-401a-a923-7c13025ece5f",
  "simulated": true,
  "sessionId": "8a1cfa79-b571-4a3e-8723-6bf0d2c6dde9",
  "resumable": false,
  "skillsSnapshot": [
    {
      "id": "opportunity-analysis",
      "version": "0.1.0",
      "hash": "3ef980c06fbef6e608e96ebef62bcc083aa81cd48e2a885f8353b32351d301e5",
      "origin": "bundled"
    },
    {
      "id": "evidence-review",
      "version": "0.1.0",
      "hash": "fa4a0249bd829fc0354f73a4f6caee8f4ef4862d26a95e6a0ce28e8dc75397d0",
      "origin": "bundled"
    }
  ],
  "plan": {
    "steps": [
      "Préparer les Skills",
      "Examiner la source de démonstration",
      "Rechercher dans le jeu de test",
      "Classer avec des critères explicites",
      "Vérifier le résultat"
    ],
    "cost": {
      "platformCents": 0,
      "externalCents": null,
      "currency": "EUR",
      "lines": [
        {
          "dimension": "workflow_run",
          "units": 1,
          "cents": 0
        }
      ],
      "budgetCents": 0,
      "withinBudget": true,
      "description": "Aucun modèle appelé"
    },
    "workflow": null
  },
  "result": {
    "simulated": true,
    "summary": "Classement de trois offres fictives selon les compétences mentionnées. Sponsoring non vérifié.",
    "evidence": [
      {
        "tool": "browser_snapshot",
        "data": {
          "simulated": true,
          "provider": "fixture",
          "url": "https://jobs.example.test",
          "text": "Page de test locale : trois offres fictives. Aucun accès à Chrome ou au réseau."
        }
      },
      {
        "tool": "opportunities_search",
        "data": {
          "simulated": true,
          "opportunities": [
            {
              "id": "demo-001",
              "title": "Software Engineer — Python",
              "company": "Example Harbour Labs (fictif)",
              "location": "Sydney",
              "skills": [
                "python",
                "api",
                "sql"
              ],
              "sponsorship": "unknown",
              "source": "https://jobs.example.test/demo-001",
              "simulated": true
            },
            {
              "id": "demo-002",
              "title": "Frontend Engineer — React",
              "company": "Example Coast Studio (fictif)",
              "location": "Melbourne",
              "skills": [
                "react",
                "typescript",
                "design"
              ],
              "sponsorship": "unknown",
              "source": "https://jobs.example.test/demo-002",
              "simulated": true
            },
            {
              "id": "demo-003",
              "title": "Data Analyst — SQL & Python",
              "company": "Example Southern Data (fictif)",
              "location": "Remote Australia",
              "skills": [
                "sql",
                "python",
                "analytics"
              ],
              "sponsorship": "unknown",
              "source": "https://jobs.example.test/demo-003",
              "simulated": true
            }
          ]
        }
      },
      {
        "tool": "opportunities_rank",
        "data": {
          "simulated": true,
          "opportunities": [
            {
              "id": "demo-001",
              "title": "Software Engineer — Python",
              "company": "Example Harbour Labs (fictif)",
              "location": "Sydney",
              "skills": [
                "python",
                "api",
                "sql"
              ],
              "sponsorship": "unknown",
              "source": "https://jobs.example.test/demo-001",
              "simulated": true,
              "score": 60,
              "reasons": [
                "Compétence mentionnée : python",
                "Compétence mentionnée : sql"
              ]
            },
            {
              "id": "demo-003",
              "title": "Data Analyst — SQL & Python",
              "company": "Example Southern Data (fictif)",
              "location": "Remote Australia",
              "skills": [
                "sql",
                "python",
                "analytics"
              ],
              "sponsorship": "unknown",
              "source": "https://jobs.example.test/demo-003",
              "simulated": true,
              "score": 60,
              "reasons": [
                "Compétence mentionnée : sql",
                "Compétence mentionnée : python"
              ]
            },
            {
              "id": "demo-002",
              "title": "Frontend Engineer — React",
              "company": "Example Coast Studio (fictif)",
              "location": "Melbourne",
              "skills": [
                "react",
                "typescript",
                "design"
              ],
              "sponsorship": "unknown",
              "source": "https://jobs.example.test/demo-002",
              "simulated": true,
              "score": 0,
              "reasons": [
                "Aucune compétence correspondante ; score nul"
              ]
            }
          ]
        }
      }
    ],
    "opportunities": [
      {
        "id": "demo-001",
        "title": "Software Engineer — Python",
        "company": "Example Harbour Labs (fictif)",
        "location": "Sydney",
        "skills": [
          "python",
          "api",
          "sql"
        ],
        "sponsorship": "unknown",
        "source": "https://jobs.example.test/demo-001",
        "simulated": true,
        "score": 60,
        "reasons": [
          "Compétence mentionnée : python",
          "Compétence mentionnée : sql"
        ]
      },
      {
        "id": "demo-003",
        "title": "Data Analyst — SQL & Python",
        "company": "Example Southern Data (fictif)",
        "location": "Remote Australia",
        "skills": [
          "sql",
          "python",
          "analytics"
        ],
        "sponsorship": "unknown",
        "source": "https://jobs.example.test/demo-003",
        "simulated": true,
        "score": 60,
        "reasons": [
          "Compétence mentionnée : sql",
          "Compétence mentionnée : python"
        ]
      },
      {
        "id": "demo-002",
        "title": "Frontend Engineer — React",
        "company": "Example Coast Studio (fictif)",
        "location": "Melbourne",
        "skills": [
          "react",
          "typescript",
          "design"
        ],
        "sponsorship": "unknown",
        "source": "https://jobs.example.test/demo-002",
        "simulated": true,
        "score": 0,
        "reasons": [
          "Aucune compétence correspondante ; score nul"
        ]
      }
    ]
  },
  "finishedAt": "2026-10-25T06:43:17.084Z"
}

```

## 17:45 — Point 5 : préparation de la clôture

- FINAL §5 complété par les démarrages réellement vérifiés et l’échec EADDRINUSE explicite ; intégration extension toujours distinguée du simple démarrage d’API.
- Validation finale lancée sous la forme `npm test && npm run check && npm run format:check` après npm ci. Erreur mineure de redirection : seul le dernier contrôle est envoyé au fichier initialement prévu ; sorties npm test/check capturées via la session outil pour être archivées, sans relancer inutilement la suite. Les preuves brutes finales seront ajoutées après terminaison.

## 17:46 — Point 5 OPÉRATIONNEL et validation finale

- Commande finale `npm test && npm run check && npm run format:check` : **code 0** après réinstallation npm, **210/210** tests (162 + 48), zéro échec/annulation/skip. `npm audit` séparé : code 0, `found 0 vulnerabilities`. `git diff --check` vert.
- Sortie finale npm test/check capturée après le premier bloc d’amorçage et format:check archivé : `sprint-09-evidence/final-validation.txt`. Le premier bloc initial apparaissait dans la sortie outil ; les résumés ci-dessous sont les sorties réelles, pas une extrapolation.
- Vérification finale des processus par `ps ... | rg 'sprint09-readme|FICTIF-chrome|playwright_chromiumdev_profile-|node --test.*browser-gateway.test.js'` : uniquement les deux processus de la recherche elle-même, aucun résidu de nos serveurs/Chrome/fixtures. Le serveur préexistant du manager est intact.

```text
ℹ tests 162
ℹ suites 0
ℹ pass 162
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 33486.828041
▶ Chrome réel (série) : 3 fichier(s)
ℹ tests 48
ℹ suites 0
ℹ pass 48
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 39514.37175
Syntaxe JavaScript valide.
Checking formatting...
All matched files use Prettier code style!
found 0 vulnerabilities
```

## État final et passation au manager

| Point | Statut final | Preuve |
|---|---|---|
| 0 — contrôles et formatage | OPÉRATIONNEL | 199 tests initiaux verts hors sandbox ; 210 finaux ; check/format:check verts |
| 1 — exports ignorés | OPÉRATIONNEL | git check-ignore exports/claude-design/ = code 0 |
| 2 — options navigateur et consentements | OPÉRATIONNEL | RunPolicy par run, tests unitaires, Chrome réel, pont MCP et décisions SQLite ; 8 nouveaux tests au point 2 |
| 3 — instabilité mot de passe | OPÉRATIONNEL sur le cas reproduit | 62/64 avant, traces newContext bloqué, 64/64 après sous concurrence 8 ; 3 régressions ajoutées, suite 210/210 |
| 4 — FINAL | OPÉRATIONNEL | Dix critères MVP et preuves, §7 review-night/sprint 09, décompte réel |
| 5 — démarrage README | OPÉRATIONNEL sur API/démo | npm ci/doctor/demo verts ; six démarrages sur ports libres, HTTP 200 ; EADDRINUSE du port 4310 documenté et contourné par 4311 |

Aucun point du brief laissé bloqué. Port 4310 préexistant conservé ; commandes vérifiées dans une copie
isolée pour ne pas récupérer les runs/base du manager. Démarrage API Playwriter validé, connexion à
l’extension toujours INCOMPLÈTE (déjà hors validation sans extension) ; prompts fournisseurs non exécutés.
Les tests restent sans modèles ; zéro appel payant, aucun secret lu/affiché, aucun push/publication/envoi.
La cause interne de Chromium et la destruction immédiate de tout binaire muet ne sont pas garanties.
Les protections du contexte partagé, leurs risques et limites restent celles de l’ADR 006.

### Commits locaux

- `def9132` — [sprint-09] Corriger le formatage initial et consigner les validations.
- `8716201` — [sprint-09] Ignorer les exports générés.
- `8619221` — [sprint-09] Exiger un consentement par run pour JavaScript et les contextes partagés.
- `485b981` — [sprint-09] Éviter le blocage Chrome à la création du contexte sous charge.
- `1710ebe` — [sprint-09] Actualiser le bilan final et les preuves des dix critères MVP.
- Clôture point 5 : commit contenant cette version du rapport, intitulé
  `[sprint-09] Vérifier les démarrages et clôturer les validations` ; identifiant via `git log -1 --oneline`.

### Suites / questions pour le manager

- Extension Playwriter et fournisseurs : validation utilisateur séparée, sans confondre session, accès
  inférence et conformité d’usage ; aucun appel réel ajouté ici.
- Isolation OS et canal de décision, contexte partagé simultané entre plusieurs runs, authentification
  multi-utilisateurs : suites d’architecture connues, pas de promesse SaaS dans le bilan.
- Conserver les traces avant/après du banc ; reproduire la contention avec le script d’évidence pour toute
  modification future du démarrage Chrome. Un binaire entièrement muet nécessite encore une supervision
  de processus plus forte ; le test se contente d’une deadline et nettoie sa fixture explicitement.

- 17:46 — Premier essai de commit de clôture interrompu par `git diff --cached --check` (code 2) : ligne vide supplémentaire en fin de final-validation.txt. Ligne vide finale retirée du fichier de sortie uniquement ; aucun contenu de test modifié, aucun commit créé lors de cet essai. Relance du contrôle puis commit.
