# cartes-14-11 — recherche d'offres sans carte d'envoi à tort

Session codeur, arbre `~/Downloads/agregat-back-cartes`, branche `cartes-14-11` (partie de 365040b).
Début 14/11 20:14:31 AEDT, fin du rapport 20:40 AEDT (heures lues par `date`).

## Commits
- `6f2f291` : correctifs A, B, C + `tests/cartes-recherche.test.js` (9 tests Chrome) + inscription dans `BROWSER` de `scripts/run-tests.js`. Un seul commit : les trois correctifs touchent `cdp.js` et la mise en scène partielle n'est pas possible sans mode interactif.
- `b47bb14` : correctif D seul (`truth.js` + `tests/bilan-sans-negation.test.js`), retirable seul.
- Commit suivant : ce rapport et les entrées E112 à E115 du registre.

## Faits vérifiés dans le code (avant correctif)
1. `guard()` (`cdp.js`) : `if (!forceCard && !firstParty && !request.isNavigationRequest())` bloque en silence les écritures tierces ; une navigation tierce dans la fenêtre d'un clic continue et, faute d'`afterSendClick`, tombe sur `if (... && !request.isNavigationRequest())` puis sur la carte `browser.send`, quel que soit le genre du clic. Conforme au brief. Hors fenêtre, elle était déjà bloquée en silence (sans entrer dans `blockedThirdParty`).
2. Entrée : `index.js` classe `candidate` un champ hors formulaire (`kind: 'field'`) et un champ de formulaire sans bouton (ou un bouton de recherche GET) ; `cdp.js` (`browser.press`) met `sendClick = true` pour `candidate` ; toute écriture de la même page dans les 8 s devient `afterSendClick` → carte. Conforme.
3. Règle des 100 ko : `agentInput` vrai dès qu'un champ nommé a été saisi sur la page (`agentFields`, `agentFieldsPage`) ; une grosse écriture du site hors fenêtre va alors à la carte. Conforme.

Reproduction avant correctif (`node --test tests/cartes-recherche.test.js`, 8 tests à ce moment) : 3 réussis, 5 en échec — A widget et A plain (une carte `browser.send` pour le traceur), B résultats (2 cartes pour une Entrée), B chemin de soumission (2 cartes au lieu d'une : la télémétrie aussi), C (la télémétrie de 150 ko retenue et une carte). L'hypothèse 3 est donc confirmée par test avant de coder C.

## Changements
- **A** (`cdp.js`, `guard()`) : après le blocage des écritures tierces hors navigation, une navigation tierce est bloquée en silence (hôte dans `blockedThirdParty`, donc `blockedThirdPartyPosts`) si : pas de `forceCard`, `this.sendClick !== true` (ni envoi accordé, ni étape, ni clic ou touche `candidate`), requête d'un **cadre enfant** (`request.frame().parentFrame() !== null`, doute = onglet), et `carriesAgentData` faux (valeurs et fichiers suivis). Variante retenue : la plus étroite, limitée aux cadres enfants. Raison : le pixel publicitaire poste dans un iframe caché ; une navigation de l'onglet lui-même vers un autre site après un clic ordinaire (bouton icône d'envoi) garde sa carte, ce qu'un test épingle.
- **B** (`cdp.js`, `enterContext` ; `index.js`) : `enterContext` rend `search` (élément dans `[role="search" i]` ou `<search>`, rôle `searchbox`, ou `input[type=search]` : attributs déclarés par la page, jamais un libellé). En mode propriétaire, `candidate` devient `widget` si `search`, non multiligne, `kind` `form` ou `field`, pas de `guardSubmit`, et pas de bouton par défaut ou un bouton classé `candidate` (formulaire de recherche) sans indice d'envoi. `submit` (bouton d'envoi, formulaire POST implicite, socket à risque) n'est jamais touché. La règle existante `widget` + même page + `isSubmitPath` garde la carte.
- **C** (`cdp.js`) : `#markAgentField` lit si le champ est d'une ligne dans une zone de recherche ; seuls les autres champs entrent dans `agentInputFields` / `agentInputPage`, qui remplacent `agentFields` / `agentFieldsPage` dans le calcul d'`agentInput`. `agentFields` reste entier pour le reste (aperçu de soumission, fenêtre ouverte par le site). Remise à zéro à la navigation de l'agent, comme `agentFields`.
- **D** (`truth.js`) : `SANS` ajouté aux négations (`(?<![\p{L}])sans` mot entier, sauf suivi de « oublier », « faute », « attendre », « tarder »). La copie de `NEGATED` dans `packages/orchestrator/skill-router.js` n'est pas touchée (hors brief) : le routage d'intentions lit encore « sans rien envoyer » comme avant.

Aucune liste d'hôtes, aucune règle propre à un site, aucune carte ni garde ajoutée.

## Tests ajoutés
`tests/cartes-recherche.test.js` (Chrome headless, deux serveurs FICTIFS 127.0.0.1 et localhost) : A widget et plain sans saisie (aucune carte, rien ne part, hôte bloqué) ; A avec saisie de l'agent dans le formulaire (carte) ; A navigation de l'onglet lui-même (carte) ; A après « Envoyer ma candidature » (carte) ; B Entrée dans trois zones de recherche (div role=search hors formulaire, formulaire role=search avec « Rechercher », `<search>` + `type=search`) : 6 écritures parties et tracées, aucune carte ; B vers `/api/messages/send` : une carte, rien ne part ; B champ hors zone et textarea dans la zone : carte ; C : 150 ko après saisie de recherche passent sans carte, après saisie d'un autre champ : carte.
`tests/bilan-sans-negation.test.js` (4 tests unitaires).

## Commandes et résultats (après correctif)
- `node --test tests/cartes-recherche.test.js` : 9/9.
- `tests/audit-nav-fix5.test.js` 17/17 ; `audit-nav-tour2` 9/9 ; `televersement-autre-site` 2/2 ; `accord-mission-chrome` 2/2 ; `audit-nav-iframe` 2/2 ; `audit-nav-carte-envoi` 6/6 ; `owner-browser` 42/42 ; `carte-ombre-chrome` 1/1 ; `envoi-issue` 9/9.
- `audit-ws.test.js` : premier passage 19/20 (échec de « WebSocket (relais, transport propriétaire, Chrome jetable par CDP) : message retenu jusqu'à la carte », 11,5 s, fichier entier en 167 s, machine chargée ; sortie détaillée non conservée) ; le test seul : 1/1 ; le fichier entier relancé : 20/20 en 39,5 s. Lu comme une instabilité de charge, non prouvé.
- Phase unitaire seule (158 fichiers hors `BROWSER`, `--test-concurrency=4 --test-timeout=120000`) : 1233 tests, 1231 réussis, 0 échec, 2 ignorés (avant D : 1229, 1227, 0, 2). Les fichiers cités `owner-mode*`, `carte-offre-datee*`, `review-carte-r1-01*`, `review-accord-mission`, `review-audit-suite-02` sont dans cette phase.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code style! ».
- Aucun test existant modifié.

## Incident
Une première commande de lancement des fichiers Chrome contenait par erreur `import('./scripts/run-tests.js')` (qui aurait lancé toute la suite) : refusée par le classificateur avant exécution. Une seconde boucle sur tous les fichiers `BROWSER` a aussi été refusée ; je me suis tenu aux fichiers cités, un par commande. Non lancés : `onglet-eveille`, `browser-click-ref`, `browser-type-upload-ref`, `browser-select-check`, `browser-fill-form`, `browser-field-review`, `browser-gateway`, `approval-bridge`, `apply-flow`, `apply-01-approval-card`, `appels-rappels-reseau`, `audit-nav-onglet`.

## Non vérifié
- Pas d'essai sur un vrai site : que le traceur du 14/11 passait bien par un cadre enfant est déduit (pixel publicitaire en iframe caché) ; s'il naviguait l'onglet lui-même, A ne le couvre pas.
- Si le traceur recopie la recherche tapée (adresse de la page avec la requête), `carriesAgentData` la reconnaît et la carte reste (choix volontaire : la recherche tapée reste une donnée de l'agent pour A). Même chose pour une trame WebSocket portant la requête après une Entrée de recherche.
- Les 15 « envois » couverts par l'accord de mission et le compte du Bilan ne sont pas retouchés : ils disparaissent si plus aucune carte n'est ouverte à tort, ce qui n'est vérifié que par les tests.
