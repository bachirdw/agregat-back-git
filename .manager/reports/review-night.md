# Relecture indépendante review-night

## Journal

- Début : lecture de `AGENTS.md`, du brief `review-night`, de la mission et du plan ; arbre Git propre à `aaa49e7`. Périmètre : `3becb42..aaa49e7`, historique et statistiques lus. Aucun rapport des sprints 02–08 utilisé comme preuve. Aucun appel de modèle prévu.
- Commande de découverte `cat ... && rg --files ... -g AGENTS.md && date ...` : code 1 car aucun AGENTS.md imbriqué trouvé par rg ; les lectures de package.json, mission et plan ont réussi. Aucun fichier modifié par cette commande. Nouvelle vérification indépendante effectuée ensuite.

## Vérifications initiales (sorties brutes)

### npm run check (initial) — code 0

```text

> agent-platform@0.1.0 check
> node scripts/check.js

Syntaxe JavaScript valide.

```

### npm run format:check (initial) — code 0

```text

> agent-platform@0.1.0 format:check
> prettier --check apps packages domain-packs tests scripts/*.js

Checking formatting...
All matched files use Prettier code style!

```

## 07:32 — Priorité 1 : premières reproductions

- Tests ciblés ajoutés dans `tests/browser-gateway.test.js` (données/sites locaux fictifs) : mutation d’élément pendant le consentement, iframe/sous-ressource/popup et double redirection. Commande `node --test --test-name-pattern='sous-ressources|élément modifié' --test-timeout=20000 tests/browser-gateway.test.js` : 2 échecs. Mutation confirmée (Missing expected rejection). Le test Chrome n’a pas atteint son scénario : lancement SIGABRT et kill EPERM dans le bac à sable (sortie conservée `/tmp/review-browser-red.log`). Relance demandée avec permissions d’exécution adaptées, conformément à l’autorisation Chrome isolé du brief.
- `ps -axo ...` pour vérifier les processus : refus du bac à sable (operation not permitted), aucun résultat exploitable. Aucun accès au Chrome utilisateur.
- Revue statique : `CdpBrowser.guard` ne contrôle que les navigations main-frame, pas les iframes, sous-ressources ni premières requêtes des popups ; deuxième saut HTTP non intercepté par Playwright. Gravité élevée. Correction prévue au niveau du contexte créé avant toute page, avec refus des pages annexes et contrôle manuel des sauts.
- Limite architecturale identifiée : le CLI natif reçoit la configuration MCP et ses secrets de pont ; il tourne avec les droits de l’utilisateur et peut appeler directement les API locales de décision sans Origin. Le code seul ne permet pas de présenter ce prototype comme une isolation contre un agent CLI malveillant. À documenter explicitement ; une véritable isolation OS/companion authentifié reste nécessaire.

### npm test (initial) — code 143

```text

> agent-platform@0.1.0 test
> node scripts/run-tests.js


▶ unitaires et intégration (parallèle) : 12 fichier(s)
(node:42188) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ résultat agent : JSON brut, clôturé, entouré de prose (1.359875ms)
✔ résultat agent : refus en texte libre rapporté avec extrait (0.183459ms)
✔ résultat agent : vide, JSON invalide, hors contrat (0.162209ms)
✔ résultat agent : extrait borné à 300 caractères (0.090125ms)
(node:42189) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ publicAgents : ni commande, ni chemins, ni environnement ; résumé de sonde (1.314667ms)
✔ catalogue HTTP : agents publics, sondes du dataDir (2722.111041ms)
✔ plan Auto en démonstration : fixture, raisons et rejets visibles (2264.499417ms)
✔ plan manuel : raisons « choisi manuellement » (1927.148667ms)
✔ plan : agent réel refusé hors mode live (1666.46525ms)
✔ plan : agent inconnu rejeté par le schéma (5.166667ms)
✔ plan live : modèle non annoncé au dernier test refusé (3215.342125ms)
✔ régression live : la permission exposée décrit l’outil demandé (3.972916ms)
✔ régression live : Gemini reçoit la confiance de l’espace de run, pas les autres agents (0.626958ms)
✔ erreurs de validation lisibles, pas de JSON zod brut (3.9535ms)
✔ probe audit : pair muet arrêté, puis session fictive sans authentification ni prompt (20725.533209ms)
(node:42191) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ tarifs : aucun prix inventé par défaut, BYOA jamais facturable, validation stricte (0.970292ms)
✔ estimation : lignes par catégorie, externe BYOA inconnu et non refacturé (0.752417ms)
✔ ledger chaîné : vérification, modification, suppression et ligne non chaînée détectées (17.2285ms)
✔ résumé par mètre : facturable / non facturable séparés (0.155834ms)
✔ plafond mensuel : dépassement refusé sans écriture partielle (3.00025ms)
✔ estimation au-dessus du budget : lancement refusé avant toute action (5063.048792ms)
✔ plafond mensuel atteint pendant un workflow : exécution arrêtée, événement et raison visibles (2041.106584ms)
✔ mesure depuis la gateway : jeton, mètres autorisés, 402 si budget dépassé (26.862208ms)
✔ gateway de données : mesure refusée → aucune requête réseau (0.329167ms)
✔ évaluation Najah : data-engineer-berlin (11.299416ms)
✔ évaluation Najah : python-remote (0.510542ms)
✔ évaluation Najah : no-false-sponsor (0.339ms)
✔ évaluation Najah : unrelated-query (0.381916ms)
(node:42206) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ mots-clés : mots vides retirés, langages conservés (2.039208ms)
✔ normalisation des sources réelles enregistrées : provenance complète, sponsoring inconnu (2.392291ms)
✔ CSV : guillemets, virgules dans les champs, CRLF (0.279125ms)
✔ registre UK : noms normalisés, correspondance de nom ≠ identité confirmée, pas de faux positif (1.033833ms)
✔ classement explicable et déterministe ; lieux FR/EN ; bonus visa seulement si demandé (13.7725ms)
✔ vérification live : classement altéré, provenance manquante, sponsoring inventé refusés (2.486417ms)
✔ gateway de données : hôtes autorisés, HTTPS, redirections revérifiées, taille, cache, mesure (21.924541ms)
✔ rejeu : réponses réelles enregistrées, jamais de réseau, allowlist conservée (14.583208ms)
✔ toolArguments : $from relie les sorties, valeur absente omise (0.818875ms)
✔ DAG Najah réel complet via l’API, en rejeu hors ligne : recherche → registre → classement → vérification (3293.083833ms)
✔ recherche : sources entrelacées, une source abondante n’évince pas les autres (1.026208ms)
(node:42342) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ gateway refuse écriture, exfiltration et URLs ambiguës (0.6485ms)
✔ ledger refuse budget négatif/dépassement sans inscription partielle (4.016875ms)
✔ historique durable et interruption au redémarrage (3.617542ms)
✔ Skill non revu, désactivé et modifié rejeté (4.408292ms)
✔ vrai MCP : découverte, classement et refus navigateur (144.855084ms)
✔ API complète : plan → ACP → MCP → résultat, SSE replay et protections HTTP (7156.399708ms)
✔ core reste indépendant de Najah (1733.639875ms)
✔ annulation et délai maximal ne produisent pas de faux succès (3552.900917ms)
✔ permissions ponctuelles : réponse valide, expiration logique et annulation (4.440417ms)
✔ runtime : handshake réel et rejet de reprise non supportée (115.762625ms)
✔ timeout réel : initialize sans réponse rejeté dans le délai (1564.034958ms)
✔ timeout réel : session/new sans réponse (1570.241916ms)
✔ timeout réel : prompt sans réponse, puis réponse tardive ignorée (3079.632417ms)
✔ annulation par signal externe pendant le prompt (173.19025ms)
✔ signal déjà annulé : aucune requête envoyée (71.42425ms)
✔ crash de l’agent pendant une requête : erreur explicite immédiate (71.558667ms)
✔ crash au démarrage (73.990583ms)
✔ bruit non JSON sur stdout toléré (79.035ms)
✔ permission en attente puis annulation : pas de blocage (384.532791ms)
✔ double cancel et close idempotents ; requête après fermeture refusée (123.116084ms)
✔ auth requise : erreur de session explicite (72.981417ms)
✔ environnement en liste blanche : la clé Gemini ne fuit pas vers un autre agent (79.238708ms)
✔ environnement : la clé Gemini est transmise au seul profil qui la déclare (181.442417ms)
✔ buildChildEnv : base, LC_*, profil, valeurs vides ignorées (0.170875ms)
✔ redact masque valeurs connues et motifs de clés (0.099042ms)
✔ mode sûr choisi parmi les modes annoncés (modes) (73.905375ms)
✔ mode sûr via configOptions (style OpenCode) (89.530167ms)
✔ mode sûr absent : refus de lancer (90.4375ms)
✔ aucun mécanisme de mode annoncé pour un profil exigeant : refus (107.227125ms)
✔ modèle via configOptions (82.804417ms)
✔ modèle via models + session/set_model (style Gemini) (71.972833ms)
✔ modèle non annoncé refusé ; vide garde le défaut (70.21225ms)
✔ reprise : load refusé sans capacité, accepté avec (156.301916ms)
✔ describe() n’expose ni environnement ni secrets (87.972833ms)
✔ normalisation : sessionModels / sessionModes / capacités (0.368333ms)
✔ routeur Auto : mode démo → fixture explicite (0.249666ms)
✔ routeur Auto : préférence, rejets expliqués (0.302333ms)
✔ routeur Auto : session refusée au dernier test → agent suivant (0.388875ms)
✔ routeur Auto : exigence de modèle et de reprise (0.253375ms)
✔ routeur Auto : ordre explicite et transport MCP http (0.155375ms)
✔ routeur Auto : aucun candidat → erreur, jamais de repli fixture silencieux (0.243541ms)
✔ découverte : agents.json, chemins absolus exigés, node_modules exclu du PATH (1.9645ms)
✔ détection : CLI factice Gemini sans option ACP → incompatible avec raison (367.465875ms)
✔ détection : CLI factice Gemini avec --acp → compatible (226.784583ms)
✔ sondes : persistance atomique, fichier corrompu ignoré (1.392791ms)
✔ reprise avec clé API : authenticate avant session/load, dossier isolé, clé jamais transmise (101.095708ms)
✔ reprise sans clé API : pas d’authenticate, pas de dossier isolé (78.116583ms)
✔ routeur Auto : dernier prompt refusé pour authentification → agent écarté, avec raison (0.32075ms)
✔ sondes : fusion — une sonde de session n’efface pas le résultat d’inférence (1.537375ms)
(node:42449) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ analyse : front matter, nom, description, empreinte stable (4.863041ms)
✔ analyse : scripts, binaires, motifs dangereux et licence absente signalés (0.831625ms)
✔ analyse : références à des fichiers non fournis (Skill non autonome) (0.844458ms)
✔ analyse : lien symbolique, fichier trop gros, trop de fichiers refusés (25.7115ms)
✔ cycle tiers : import en quarantaine → installation refusée → revue → actif → résolu (9.898042ms)
✔ revue refusée, nom réservé, revue des intégrés impossible (4.744125ms)
✔ intégrité : modification après revue → résolution refusée et intégrité fausse (4.115333ms)
✔ versions : une nouvelle version repasse en quarantaine, historique conservé (4.743666ms)
✔ export natif : .agents/skills pour Codex/Gemini/OpenCode, .claude/skills pour Claude, sans scripts (8.558458ms)
✔ import Git : seules les URL GitHub HTTPS sont acceptées (2.368208ms)
✔ import local depuis l’API : limité aux racines autorisées (0.262ms)
✔ Skills intégrés : comportement historique conservé (2.538292ms)
(node:42450) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ définition : schéma, doublons, dépendances inconnues, cycles, ordre et niveaux (3.588459ms)
✔ exécution séquentielle avec passage des sorties de dépendances (5.7415ms)
✔ parallélisme réel borné par concurrency (fan-out / fan-in) (252.110041ms)
✔ échec : dépendants ignorés, run en échec avec détail (4.897667ms)
✔ étape optionnelle en échec : le workflow continue et réussit (3.748708ms)
✔ tentatives : réussite après deux échecs, compteur persistant (4.112542ms)
✔ tentatives épuisées → échec (3.354166ms)
✔ délai d’étape : lecture en échec, écriture incertaine (jamais relancée seule) (406.165208ms)
✔ approbation humaine : attente, approbation, suite du workflow (107.21125ms)
✔ approbation refusée : dépendants ignorés (56.352416ms)
✔ annulation : étapes en cours et en attente annulées, écriture en cours incertaine (56.84775ms)
✔ sortie tardive d’une tentative abandonnée ignorée (génération) (128.7865ms)
✔ reprise après crash : étapes terminées conservées, lecture relancée, écriture incertaine (109.262125ms)
✔ exécuteur absent, sortie trop volumineuse, actions invalides (4.78575ms)
✔ événements d’étape émis et persistés pour le streaming (3.142791ms)
(node:42460) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ reprise après redémarrage du serveur : étapes réussies conservées, run terminé en place (3907.792125ms)
✔ reprise refusée : run terminé, actif, ou mode agent (3888.921291ms)
✔ brouillon de candidature : attente d’approbation, approbation via l’API, aucun envoi (2020.166208ms)
✔ brouillon refusé à la relecture : workflow en échec, reprise possible (3653.142166ms)
(node:42520) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ plan workflow : DAG Najah affiché avec agents, niveaux et étape optionnelle (1651.541542ms)
✔ workflow Najah complet : outils MCP réels, agent, vérification indépendante, agrégat (1999.405625ms)
✔ workflow général (core) : agent requis puis vérification de structure (2004.902167ms)
✔ workflow : annulation pendant l’exécution → cancelled, étapes annulées (1773.778666ms)
✔ workflow : pack sans DAG ou mode inconnu refusés (4.8985ms)
✔ aggregateOutputs : priorité au résultat vérifié, résumé d’analyse, preuves concaténées (0.1555ms)
✔ toolArguments : objectif par défaut et substitution sans évaluation (0.106834ms)
✔ injection : une analyse qui modifie le classement ne passe pas la vérification (0.381ms)
✔ proposition automatique de workflow : mots-clés, exigence réseau, défaut expliqué (0.396375ms)
✔ plan workflow « auto » : DAG proposé, raison visible, identifiant enregistré dans le run (1613.513125ms)
✔ plan : permissions affichées calculées selon le workflow réel (4444.779083ms)
ℹ tests 130
ℹ suites 0
ℹ pass 130
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 30395.080541

▶ Chrome réel (série) : 3 fichier(s)
(node:42663) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ pont d’approbation : seules les capacités accordées sont listées (142.954375ms)
✖ pont d’approbation : « Postuler » refusé dans l’interface → aucun envoi (42583.642916ms)
✖ tests/approval-bridge.test.js (56240.836ms)
✖ tests/browser-gateway.test.js
✖ tests/e2e-ui.test.js
ℹ tests 5
ℹ suites 0
ℹ pass 1
ℹ fail 1
ℹ cancelled 3
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 56243.459916

✖ failing tests:

test at tests/approval-bridge.test.js:81:1
✖ pont d’approbation : « Postuler » refusé dans l’interface → aucun envoi (42583.642916ms)
  Error: Aucune demande de permission reçue
      at decideWhenAsked (file:///Users/diaw/Downloads/agregateur-agent/tests/approval-bridge.test.js:68:9)
      at async Promise.all (index 1)
      at async TestContext.<anonymous> (file:///Users/diaw/Downloads/agregateur-agent/tests/approval-bridge.test.js:87:29)
      at async Test.run (node:internal/test_runner/test:1125:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7)

test at tests/approval-bridge.test.js:1:1
✖ tests/approval-bridge.test.js (56240.836ms)
  'Promise resolution is still pending but the event loop has already resolved'

test at tests/browser-gateway.test.js:1:1
✖ tests/browser-gateway.test.js
  'Promise resolution is still pending but the event loop has already resolved'

test at tests/e2e-ui.test.js:1:1
✖ tests/e2e-ui.test.js
  'Promise resolution is still pending but the event loop has already resolved'

```

## 07:33 — Référence et confirmation hors bac à sable

- Les quatre processus de la première suite bloquée ont été identifiés par PID/PPID puis arrêtés (SIGTERM ciblé, aucune commande globale de nettoyage). La première suite affiche 130 tests non navigateur réussis ; la phase Chrome échoue faute de lancement et de permission reçue (56 s, suite interrompue). Ce résultat n’est pas une régression produit prouvée.
- Les deux nouveaux tests relancés hors bac à sable échouent réellement : 2 requêtes vers le serveur interdit dès la navigation (iframe/image), et élément muté exécuté sans nouveau consentement. Sortie `/tmp/review-browser-red-unsandboxed.log`.
- Suite de référence relancée hors bac à sable : fichier de tests navigateur temporairement remis exactement à HEAD, nouvelles régressions conservées dans `/tmp/review-browser-new-tests.js` puis restaurées automatiquement après la commande. Aucun code de production changé avant cette référence.
- Décision : préférer un contexte dédié avec JavaScript et service workers désactivés à une prétendue détection des actions sensibles exécutées par des scripts arbitraires. Régression fonctionnelle assumée : sites exigeant JavaScript et sessions du contexte utilisateur non pris en charge dans ce mode sûr ; ne pas prétendre au partage de session Playwriter sécurisé. Les formulaires HTML soumis explicitement après consentement restent possibles.

### npm test initial, hors bac à sable Chrome — code 0

```text

> agent-platform@0.1.0 test
> node scripts/run-tests.js


▶ unitaires et intégration (parallèle) : 12 fichier(s)
(node:42834) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ résultat agent : JSON brut, clôturé, entouré de prose (1.651792ms)
✔ résultat agent : refus en texte libre rapporté avec extrait (0.192167ms)
✔ résultat agent : vide, JSON invalide, hors contrat (0.160917ms)
✔ résultat agent : extrait borné à 300 caractères (0.089041ms)
(node:42835) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ publicAgents : ni commande, ni chemins, ni environnement ; résumé de sonde (1.384417ms)
✔ catalogue HTTP : agents publics, sondes du dataDir (2132.497291ms)
✔ plan Auto en démonstration : fixture, raisons et rejets visibles (1844.1715ms)
✔ plan manuel : raisons « choisi manuellement » (1815.063709ms)
✔ plan : agent réel refusé hors mode live (1608.90675ms)
✔ plan : agent inconnu rejeté par le schéma (4.77875ms)
✔ plan live : modèle non annoncé au dernier test refusé (3286.281ms)
✔ régression live : la permission exposée décrit l’outil demandé (4.408333ms)
✔ régression live : Gemini reçoit la confiance de l’espace de run, pas les autres agents (0.533209ms)
✔ erreurs de validation lisibles, pas de JSON zod brut (4.312041ms)
✔ probe audit : pair muet arrêté, puis session fictive sans authentification ni prompt (20494.99925ms)
(node:42837) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ tarifs : aucun prix inventé par défaut, BYOA jamais facturable, validation stricte (1.445291ms)
✔ estimation : lignes par catégorie, externe BYOA inconnu et non refacturé (0.589584ms)
✔ ledger chaîné : vérification, modification, suppression et ligne non chaînée détectées (14.376583ms)
✔ résumé par mètre : facturable / non facturable séparés (0.171125ms)
✔ plafond mensuel : dépassement refusé sans écriture partielle (2.648458ms)
✔ estimation au-dessus du budget : lancement refusé avant toute action (3958.794208ms)
✔ plafond mensuel atteint pendant un workflow : exécution arrêtée, événement et raison visibles (2052.174625ms)
✔ mesure depuis la gateway : jeton, mètres autorisés, 402 si budget dépassé (26.714458ms)
✔ gateway de données : mesure refusée → aucune requête réseau (0.381291ms)
✔ évaluation Najah : data-engineer-berlin (10.818959ms)
✔ évaluation Najah : python-remote (0.449292ms)
✔ évaluation Najah : no-false-sponsor (0.388666ms)
✔ évaluation Najah : unrelated-query (0.454875ms)
(node:42852) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ mots-clés : mots vides retirés, langages conservés (1.463334ms)
✔ normalisation des sources réelles enregistrées : provenance complète, sponsoring inconnu (1.332292ms)
✔ CSV : guillemets, virgules dans les champs, CRLF (0.114375ms)
✔ registre UK : noms normalisés, correspondance de nom ≠ identité confirmée, pas de faux positif (0.739375ms)
✔ classement explicable et déterministe ; lieux FR/EN ; bonus visa seulement si demandé (16.252083ms)
✔ vérification live : classement altéré, provenance manquante, sponsoring inventé refusés (1.602333ms)
✔ gateway de données : hôtes autorisés, HTTPS, redirections revérifiées, taille, cache, mesure (17.419875ms)
✔ rejeu : réponses réelles enregistrées, jamais de réseau, allowlist conservée (1.485833ms)
✔ toolArguments : $from relie les sorties, valeur absente omise (0.411417ms)
✔ DAG Najah réel complet via l’API, en rejeu hors ligne : recherche → registre → classement → vérification (2452.338875ms)
✔ recherche : sources entrelacées, une source abondante n’évince pas les autres (0.820584ms)
(node:42888) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ gateway refuse écriture, exfiltration et URLs ambiguës (0.6235ms)
✔ ledger refuse budget négatif/dépassement sans inscription partielle (3.985166ms)
✔ historique durable et interruption au redémarrage (3.326041ms)
✔ Skill non revu, désactivé et modifié rejeté (4.164541ms)
✔ vrai MCP : découverte, classement et refus navigateur (134.269167ms)
✔ API complète : plan → ACP → MCP → résultat, SSE replay et protections HTTP (7100.4205ms)
✔ core reste indépendant de Najah (1754.628208ms)
✔ annulation et délai maximal ne produisent pas de faux succès (3466.542375ms)
✔ permissions ponctuelles : réponse valide, expiration logique et annulation (4.732625ms)
✔ runtime : handshake réel et rejet de reprise non supportée (101.225625ms)
✔ timeout réel : initialize sans réponse rejeté dans le délai (1560.952958ms)
✔ timeout réel : session/new sans réponse (1571.515417ms)
✔ timeout réel : prompt sans réponse, puis réponse tardive ignorée (3076.854208ms)
✔ annulation par signal externe pendant le prompt (178.357625ms)
✔ signal déjà annulé : aucune requête envoyée (69.293041ms)
✔ crash de l’agent pendant une requête : erreur explicite immédiate (81.62325ms)
✔ crash au démarrage (71.972416ms)
✔ bruit non JSON sur stdout toléré (70.869542ms)
✔ permission en attente puis annulation : pas de blocage (377.940709ms)
✔ double cancel et close idempotents ; requête après fermeture refusée (127.733916ms)
✔ auth requise : erreur de session explicite (68.831542ms)
✔ environnement en liste blanche : la clé Gemini ne fuit pas vers un autre agent (81.754708ms)
✔ environnement : la clé Gemini est transmise au seul profil qui la déclare (183.5825ms)
✔ buildChildEnv : base, LC_*, profil, valeurs vides ignorées (0.160542ms)
✔ redact masque valeurs connues et motifs de clés (0.084333ms)
✔ mode sûr choisi parmi les modes annoncés (modes) (79.367542ms)
✔ mode sûr via configOptions (style OpenCode) (99.881875ms)
✔ mode sûr absent : refus de lancer (79.062334ms)
✔ aucun mécanisme de mode annoncé pour un profil exigeant : refus (81.0365ms)
✔ modèle via configOptions (78.385542ms)
✔ modèle via models + session/set_model (style Gemini) (68.393625ms)
✔ modèle non annoncé refusé ; vide garde le défaut (67.372833ms)
✔ reprise : load refusé sans capacité, accepté avec (141.819958ms)
✔ describe() n’expose ni environnement ni secrets (88.588292ms)
✔ normalisation : sessionModels / sessionModes / capacités (0.163958ms)
✔ routeur Auto : mode démo → fixture explicite (0.221333ms)
✔ routeur Auto : préférence, rejets expliqués (0.103083ms)
✔ routeur Auto : session refusée au dernier test → agent suivant (0.065417ms)
✔ routeur Auto : exigence de modèle et de reprise (0.087834ms)
✔ routeur Auto : ordre explicite et transport MCP http (0.054542ms)
✔ routeur Auto : aucun candidat → erreur, jamais de repli fixture silencieux (0.106959ms)
✔ découverte : agents.json, chemins absolus exigés, node_modules exclu du PATH (1.1105ms)
✔ détection : CLI factice Gemini sans option ACP → incompatible avec raison (341.902791ms)
✔ détection : CLI factice Gemini avec --acp → compatible (118.372584ms)
✔ sondes : persistance atomique, fichier corrompu ignoré (1.327375ms)
✔ reprise avec clé API : authenticate avant session/load, dossier isolé, clé jamais transmise (70.089708ms)
✔ reprise sans clé API : pas d’authenticate, pas de dossier isolé (74.916167ms)
✔ routeur Auto : dernier prompt refusé pour authentification → agent écarté, avec raison (0.140791ms)
✔ sondes : fusion — une sonde de session n’efface pas le résultat d’inférence (0.984ms)
(node:42982) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ analyse : front matter, nom, description, empreinte stable (5.953542ms)
✔ analyse : scripts, binaires, motifs dangereux et licence absente signalés (0.929666ms)
✔ analyse : références à des fichiers non fournis (Skill non autonome) (0.708583ms)
✔ analyse : lien symbolique, fichier trop gros, trop de fichiers refusés (23.875958ms)
✔ cycle tiers : import en quarantaine → installation refusée → revue → actif → résolu (10.505ms)
✔ revue refusée, nom réservé, revue des intégrés impossible (4.480375ms)
✔ intégrité : modification après revue → résolution refusée et intégrité fausse (4.512125ms)
✔ versions : une nouvelle version repasse en quarantaine, historique conservé (4.58875ms)
✔ export natif : .agents/skills pour Codex/Gemini/OpenCode, .claude/skills pour Claude, sans scripts (7.92025ms)
✔ import Git : seules les URL GitHub HTTPS sont acceptées (2.295084ms)
✔ import local depuis l’API : limité aux racines autorisées (0.346708ms)
✔ Skills intégrés : comportement historique conservé (2.497417ms)
(node:42983) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ définition : schéma, doublons, dépendances inconnues, cycles, ordre et niveaux (3.619875ms)
✔ exécution séquentielle avec passage des sorties de dépendances (6.194625ms)
✔ parallélisme réel borné par concurrency (fan-out / fan-in) (252.584416ms)
✔ échec : dépendants ignorés, run en échec avec détail (4.819375ms)
✔ étape optionnelle en échec : le workflow continue et réussit (3.764042ms)
✔ tentatives : réussite après deux échecs, compteur persistant (4.183042ms)
✔ tentatives épuisées → échec (3.545708ms)
✔ délai d’étape : lecture en échec, écriture incertaine (jamais relancée seule) (405.8095ms)
✔ approbation humaine : attente, approbation, suite du workflow (107.701333ms)
✔ approbation refusée : dépendants ignorés (55.4985ms)
✔ annulation : étapes en cours et en attente annulées, écriture en cours incertaine (56.819916ms)
✔ sortie tardive d’une tentative abandonnée ignorée (génération) (129.248833ms)
✔ reprise après crash : étapes terminées conservées, lecture relancée, écriture incertaine (108.863625ms)
✔ exécuteur absent, sortie trop volumineuse, actions invalides (4.953583ms)
✔ événements d’étape émis et persistés pour le streaming (3.958959ms)
(node:42992) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ reprise après redémarrage du serveur : étapes réussies conservées, run terminé en place (3809.775709ms)
✔ reprise refusée : run terminé, actif, ou mode agent (3853.429875ms)
✔ brouillon de candidature : attente d’approbation, approbation via l’API, aucun envoi (2029.728833ms)
✔ brouillon refusé à la relecture : workflow en échec, reprise possible (3672.648417ms)
(node:43057) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ plan workflow : DAG Najah affiché avec agents, niveaux et étape optionnelle (1665.392417ms)
✔ workflow Najah complet : outils MCP réels, agent, vérification indépendante, agrégat (2014.17925ms)
✔ workflow général (core) : agent requis puis vérification de structure (1960.392459ms)
✔ workflow : annulation pendant l’exécution → cancelled, étapes annulées (1765.067292ms)
✔ workflow : pack sans DAG ou mode inconnu refusés (4.383792ms)
✔ aggregateOutputs : priorité au résultat vérifié, résumé d’analyse, preuves concaténées (0.146958ms)
✔ toolArguments : objectif par défaut et substitution sans évaluation (0.099541ms)
✔ injection : une analyse qui modifie le classement ne passe pas la vérification (0.383959ms)
✔ proposition automatique de workflow : mots-clés, exigence réseau, défaut expliqué (0.399625ms)
✔ plan workflow « auto » : DAG proposé, raison visible, identifiant enregistré dans le run (1621.406542ms)
✔ plan : permissions affichées calculées selon le workflow réel (4513.71575ms)
ℹ tests 130
ℹ suites 0
ℹ pass 130
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 29016.58025

▶ Chrome réel (série) : 3 fichier(s)
(node:43198) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ pont d’approbation : seules les capacités accordées sont listées (124.280459ms)
✔ pont d’approbation : « Postuler » refusé dans l’interface → aucun envoi (2274.722833ms)
✔ pont d’approbation : « Postuler » autorisé une fois → un envoi (995.699875ms)
✔ pont d’approbation : jeton invalide ou run inactif refusés (13.743792ms)
✔ registre : contrats stables, schémas stricts, effets déclarés (1.863833ms)
✔ politique : https, domaines, sous-domaines, IP, ports, identifiants, local explicite (3.797041ms)
✔ politique : résolution DNS vers réseau privé refusée (rebinding) (0.331ms)
✔ politique : détection des éléments sensibles (0.415208ms)
✔ politique : chemins de fichiers confinés au dossier du run (0.283958ms)
✔ politique : sérialisation pour le processus MCP (0.10525ms)
✔ redaction : clés, numéros de carte, troncature (0.19975ms)
✔ gateway : lecture sans approbation, contenu marqué non fiable, mesure (0.562834ms)
✔ gateway : clic sensible refusé sans approbation humaine, même auto-approuvé (0.402958ms)
✔ gateway : clic approuvé exécuté ; texte saisi jamais transmis à l’approbation (0.435041ms)
✔ gateway : capacités non accordées, arguments hors contrat, élément absent (0.294333ms)
✔ gateway : domaine interdit et redirection vers domaine interdit bloqués (0.191042ms)
✔ gateway : upload hors dossier et lien symbolique refusés (0.894375ms)
✔ CdpBrowser : endpoint distant refusé, configuration requise (0.12025ms)
✔ Chrome réel isolé : navigation, instantané d’accessibilité, extraction (764.460416ms)
✔ Chrome réel : « Postuler » refusé → aucun envoi au serveur (569.155417ms)
✔ Chrome réel : « Postuler » approuvé → un seul envoi (642.803792ms)
✔ Chrome réel : champ mot de passe sensible, saisie approuvée sans fuite du texte (622.267375ms)
✔ Chrome réel : redirection serveur vers domaine interdit bloquée (752.812917ms)
✔ Chrome réel : téléchargement dans le dossier du run, taille limitée (823.076917ms)
✔ Chrome partagé via CDP (comme le relais Playwriter) : onglets utilisateur intacts, navigateur jamais fermé (776.456083ms)
(node:43334) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
✔ E2E interface : workflow Najah, étapes en direct, résultats fictifs étiquetés, coût (7864.037167ms)
✔ E2E interface : brouillon de candidature, approbation humaine dans l’interface (6937.79175ms)
✔ E2E interface : estimation au-dessus du budget signalée puis lancement refusé (6335.940458ms)
✔ E2E interface : saisie avant chargement du catalogue sans erreur (2964.07375ms)
ℹ tests 29
ℹ suites 0
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 32892.279708

```

## 07:34 — Priorité 1 : correction navigateur

- Référence complète hors bac à sable : **159 tests réussis** (130 + 29), aucune erreur, aucun skip. `npm run check` et `npm run format:check` initiaux verts. Le diagnostic MCP isolé vers example.com a aussi réussi (aucun modèle, aucun secret, profil jetable fermé).
- Défauts élevés corrigés : filtrage incomplet des cibles/réseau (`packages/browser-gateway/cdp.js`, ancienne guard ~54), consentement périmé (`index.js`, ancienne call ~40–90), écriture via lien downloads/écrasement de fichier (ancienne perform ~163), valeurs privées transmises dans describe (ancienne ~108). Tests négatifs ajoutés ; la mutation et l’accès réseau ont échoué avant correction.
- Choix : contexte dédié (aussi pour CDP partagé), JS/workers désactivés, routage de toutes les ressources avant création des pages, nouveaux onglets/WebSockets refusés, chaîne HTTP suivie manuellement bornée, changements d’origine refusés. Actions sérialisées et page/élément revérifiés après attente humaine. Snapshot binaire des uploads, taille bornée ; downloads sans écrasement et dossier symbolique refusé.
- Limites documentées dans ADR 006 : isolation OS absente contre CLI local malveillant ; DNS navigateur non épinglé (rebinding non garanti) ; sites JS et cookies du contexte utilisateur indisponibles. Un contrôle DNS avant connexion ne suffit pas à résoudre le rebinding. Pas de promesse contraire dans le verdict final.

## 07:35 — Erreur pendant le durcissement navigateur

- Les tests ciblés ont révélé une erreur introduite dans guard : la première requête de popup peut ne pas avoir de frame ; le catch appelait de nouveau request.frame(), causant un rejet non traité et une attente jusqu’au délai de fichier. Détail obtenu avec le reporter TAP (`/tmp/review-browser-detail.log`). Correction : capturer la frame une seule fois et aborter sans la relire. Les autres scénarios Chrome existants passent, y compris mot de passe. Les suites affectées sont bornées par leur test-timeout.

### Vérification correction navigateur — npm test : 0

✔ E2E interface : workflow Najah, étapes en direct, résultats fictifs étiquetés, coût (7366.517167ms)
✔ E2E interface : brouillon de candidature, approbation humaine dans l’interface (7257.561ms)
✔ E2E interface : estimation au-dessus du budget signalée puis lancement refusé (6399.234584ms)
✔ E2E interface : saisie avant chargement du catalogue sans erreur (3002.54525ms)
ℹ tests 33
ℹ suites 0
ℹ pass 33
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 36622.950625

## 07:36 — Validation et commit navigateur

- `npm test` : **163/163 réussis** (130 + 33), aucun skip ; `npm run check`, `npm run format:check` et `git diff --check` verts. Commandes complètes dans `/tmp/review-night-commit1-test.log`. État : protections testées opérationnelles dans Chrome isolé, transport CDP partagé testé uniquement sur profil jetable.

- Commit initial refusé par le bac à sable : création de `.git/index.lock` impossible (Operation not permitted), aucun commit créé. Relance des mêmes opérations Git locales avec permission adaptée.

## 07:37 — Priorité 1 : cycle de vie du pont

- Tests rouges confirmés (sans Chrome) : un jeton valide permettait de mesurer un run inactif ; une permission de step ne réagissait pas à son signal local annulé. Deux échecs dans `/tmp/review-bridge-red.log`. Le deuxième laisse les minuteurs de permission jusqu’à expiration dans la version initiale (60 s), consigné sans masquer le délai.
- Correctifs ciblés : `gatewayUsage` et `gatewayApproval` exigent un contrôle actif non annulé ; les permissions écoutent leur signal, se terminent une seule fois, retirent le listener et conservent waiting_permission tant qu’une autre demande reste ouverte. Gateway réelle sans pont de mesure : refus fermé, au lieu de ne rien facturer. Tests de jeton croisé, annulation, réponse tardive, concurrence et absence du pont ; 3 tests ciblés attendus. Tests de facturation adaptés pour représenter un run réellement actif.

Vérification pont npm test — code 0
✔ E2E interface : workflow Najah, étapes en direct, résultats fictifs étiquetés, coût (7536.919375ms)
✔ E2E interface : brouillon de candidature, approbation humaine dans l’interface (6921.735167ms)
✔ E2E interface : estimation au-dessus du budget signalée puis lancement refusé (6317.294083ms)
✔ E2E interface : saisie avant chargement du catalogue sans erreur (3048.212792ms)
ℹ tests 36
ℹ suites 0
ℹ pass 36
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 33854.330583

Tests navigateur après correction : code 1

## 07:38 — Validation pont

- `npm test` : **166/166 réussis** (130 + 36) ; check et format:check verts. Les trois régressions du pont sont opérationnelles. Le test rouge initial a aussi produit deux erreurs différées « database is not open » après fermeture de sa fixture, faute de résolution des permissions initiales (corrigé par le listener).
- Nettoyage : deux anciennes commandes Chrome restaient vivantes malgré test-timeout (exception popup initiale, gestionnaire de route abandonné). Arrêt SIGTERM ciblé des PID 43649/43611 et 43899/43884/43883 identifiés comme nos descendants ; aucun Chrome utilisateur touché. Les exécutions corrigées terminent normalement.

## 07:40 — Priorité 2 : runtime ACP

- Trois tests rouges reproduits avant correctif (`/tmp/review-runtime-red.log`) : prompt accepté malgré refus du mode sûr (élevé, index.js session/prompt) ; secret fictif présent dans RequestError et événements/permissions (élevé, handlers ACP et request) ; jeton MCP absent du masque (élevé, session).
- Corrections : état ready imposé avant prompt, démarrage unique et interdit après close, erreurs/retours/événements/permissions nettoyés récursivement avant callbacks ou stockage, secrets MCP ajoutés à la liste, fermeture et timeout rejettent les requêtes et arrêtent le runtime, changement annoncé vers un mode dangereux révoque ready. Le groupe de processus est aussi tué après sortie du leader (sinon les descendants ignorant SIGTERM pouvaient rester).
- Cinq tests de sécurité avec faux agents ajoutés, dont SQLite inspecté, notification de mode dangereux et petit-enfant résistant. Aucun appel réel de modèle. Limite : un CLI peut mentir sur son mode ; ACP ne remplace pas une isolation système.

Validation runtime ciblée — code 1

- Échec de validation runtime : 44 tests ciblés, 1 échec du contrat historique après close (« Runtime fermé » attendu, nouvel état ready retournait « Session non prête »). Les protections réussissent ; ordre des gardes prompt corrigé pour préserver le message existant. La suite complète lancée trop tôt a chargé cette version et doit être relancée avant commit ; aucune suppression de test.

Vérification runtime npm test — code 1
✔ E2E interface : workflow Najah, étapes en direct, résultats fictifs étiquetés, coût (7536.446709ms)
✔ E2E interface : brouillon de candidature, approbation humaine dans l’interface (7213.980083ms)
✔ E2E interface : estimation au-dessus du budget signalée puis lancement refusé (9510.5205ms)
✔ E2E interface : saisie avant chargement du catalogue sans erreur (4222.175542ms)
ℹ tests 36
ℹ suites 0
ℹ pass 36
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 39456.490292

## 07:41 — Préparation priorité 3

- Reproducteur sans modèle (`node --input-type=module`, SQLite temporaire, exécuteur FICTIF incrémentant un compteur puis lançant une erreur) : une étape write retries=2 produit **3 effets** avant failed ; recover(retryFailed=true) la remet ensuite pending. Défaut élevé de double effet confirmé dans `WorkflowEngine.launch/recover`. Les tests automatisés et le correctif suivront le commit runtime.

## 07:42 — Préparation priorité 4

- Reproducteur sans réseau : scanSkillDir accepte une racine symbolique ; importGit accepte un subdir absolu hors clone (programme /usr/bin/true substitué à Git, source et SKILL entièrement fictifs en dossier temporaire). Sorties : « Racine symbolique acceptée : fictif » et « Sous-dossier Git absolu importé hors clone : fictif ». Défauts confirmés, pas de clone ni lecture d’identifiants. Le scan/copie puis relecture séparés exposent aussi une TOCTOU ; un snapshot immuable des octets analysés est prévu.

Vérification runtime corrigé npm test — code 0
✔ E2E interface : workflow Najah, étapes en direct, résultats fictifs étiquetés, coût (7313.979834ms)
✔ E2E interface : brouillon de candidature, approbation humaine dans l’interface (6829.472ms)
✔ E2E interface : estimation au-dessus du budget signalée puis lancement refusé (6285.620792ms)
✔ E2E interface : saisie avant chargement du catalogue sans erreur (2995.116334ms)
ℹ tests 36
ℹ suites 0
ℹ pass 36
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 32975.450833

## 07:42 — Validation et commit runtime

- Relance complète corrigée : **171/171 tests réussis** (135 + 36), aucun skip ; check, format:check, diff --check verts. Les 44 tests runtime ciblés sont verts. État : runtime opérationnel sur pairs fictifs, pas de validation payante ni de garantie de bac à sable OS.
