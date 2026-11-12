# audit-suite-02 — Restes de l'audit du 12/11 (rapport au fil de l'eau)

Codeur Opus, arbre `agregat-back-cto`, branche `cto-11-11`. Brief : `.manager/briefs/audit-suite-02.md`.

## Journal
- **21:58** Lecture d'`AGENTS.md`, du brief, des sections « Audit » et « Diagnostic » de `nuit-12-11.md` et du constat
  `confirmed[2]` (A10). Lecture de `workflow-run.js` (l. 143-240), `index.js` (`gatewayApproval`, `bridgeControl`,
  `openAttempt`, `permission`, contrôle de mission l. 1135-1165).
- **22:04** **A10** (mode workflow, attente du clic d'envoi). Test rouge écrit d'abord :
  `tests/audit-suite-02-workflow-send.test.js` (faux agent ACP `composeTool`, garde d'étape à 300 ms, carte d'envoi
  posée par `gatewayApproval` avec le jeton de la tentative de l'étape).
  - Rouge (avant correctif) : test 1 `AssertionError: silence de l’étape non coupé pendant l’attente` (la garde de
    l'étape émet `agent_silent` et arrête la mission pendant l'attente du clic) ; test 2 `carte toujours présente
    avant le clic` (la carte a déjà été fermée par l'arrêt). 0/2.
  - Hypothèse fausse écartée : j'ai d'abord essayé de porter `actionClass: 'send'` dans une permission ACP du faux
    agent ; l'événement `permission_auto` montre que le champ n'arrive pas à `permission()` (le SDK ACP ne transmet que
    les champs de son schéma). Une permission ACP n'attend donc jamais le clic en mode propriétaire ; seule la carte de
    la passerelle est concernée. Modification du faux agent annulée (`git checkout` du seul fichier de fixture).
  - Correctif : `permission(…, observedTool, pauser)` suspend et reprend `pauser ?? this.active.get(runId)` (et son
    `runtime`) ; `gatewayApproval` transmet la tentative quand elle porte `suspendTimers` (seules les tentatives d'étape
    DAG en ont) ; `workflow-run.js` expose sur la tentative `suspendTimers` / `resumeTimers` / `runtime` de l'étape
    (garde de l'étape + contrôle de mission, comme pour la question de formulaire) et passe `stepControl` à
    `onPermission`. Mode agent inchangé : sa tentative n'existe pas (jeton de mission), `pauser` vaut `undefined`.
  - Vert : 2/2 ; le test 2 prouve aussi que la garde reprend après le clic (un outil muet est coupé ensuite).
  - Non-régression (un fichier à la fois) : workflow-run 18/18, astra-bridge 5/5, career-sends 9/9,
    tool-stall-delivery 6/6, audit-nav2-bilan 4/4, accord-page-changee 2/2, accord-attente-longue 6/6,
    appels-en-cours 4/4.
  - Non prouvé par test : la pause du délai `prompt` du runtime de l'étape (600 s) ; le code passe par le même
    `pauseDeadlines` que le mode agent, mais aucun test n'attend 600 s ni n'espionne le runtime de l'étape.
- **22:08** **2a — négation dans `selectSkillIntents`**. Sonde (script hors dépôt, manifeste career-ops) :
  « Ne clique pas sur Envoyer et prépare ma candidature… » → `[]`, « N'envoie rien : prépare ma candidature… » → `[]`,
  « Ne lance pas le scan et cherche des offres… » → `[]`, alors que les parties affirmatives seules donnent `apply` et
  `search`. **Prouvé.**
  - Test rouge `tests/audit-suite-02-negation-intention.test.js` : 1/2 (le cas affirmatif échoue sur le premier
    prompt, le cas « seulement nié » passe déjà).
  - Correctif dans `skill-router.js` : la portée de la négation reprend la règle de `career-ops/truth.js` (arrêt à
    « mais », « puis », « et » et à la ponctuation), plus les deux-points. Mêmes mots que `truth.js`, aucun nouveau ;
    les formes anglaises de `truth.js` (« don't », « without »…) ne sont pas ajoutées au routeur, qui ne les traitait
    pas.
  - Incident : un premier commentaire contenait « candidature », mot interdit dans le source du routeur par le test
    « C7 FICTIF : le motif d’URL de l’étape open vient du manifeste du pack » (rouge 40/41) ; commentaire reformulé,
    aucun test modifié.
  - Vert : test 2/2 ; non-régression un fichier à la fois : skill-router 41/41, apply-01-bilan 7/7,
    bilan-evaluer-puis-postuler 8/8, career-integration 50/50, career-script-usage 4/4, contacts-courriel 12/12,
    doubt-tools 16/16, ecart-ordre-nomme 3/3, etape-reprise-echec 6/6, intention-50-prompts 2/2,
    intention-anglais-sonde 44/44, intention-anglais 2/2, intention-candidature 2/2, intention-par-phrase 5/5,
    lecture-page-liste 12/12, lecture-page-resultats 4/4, note-sans-lecture 11/11, open-sans-mot-cle 9/9,
    ouvrir-formulaire-clic 3/3, preuve-effet 7/7, preuves-entre-tours 14/14, release-report-num 10/10, tool-watchdog 1/1.
  - Non traité : `truth.js` ne s'arrête pas aux deux-points (« Ne soumets pas : postule… »), relevé par l'auditeur ;
    le brief ne le demande pas et l'effet sur le Bilan n'est pas établi.
- **22:13** **2b — Bilan « rédaction de document » avec un CV déjà produit**. Sonde (hors dépôt) : prompt FICTIF
  « Prépare ma candidature pour l'offre du rapport 010 et joins mon CV adapté, arrête-toi avant l'envoi. » → intention
  `apply` ; vérité avec `browser_navigate`, `browser_fillForm`, `browser_upload` réussis et étapes `apply` publiées →
  Bilan « Non exécuté : rédaction de document. » **Prouvé** (le motif `prépar….{0,80}CV` lit « Prépare ma
  candidature … CV »).
  - Test rouge `tests/audit-suite-02-bilan-cv-joint.test.js` : 2/3 (le cas `apply` échoue ; sans intention et
    intention `documents` passent déjà).
  - Correctif dans `career-ops/truth.js` (code de la plateforme, pas la bibliothèque) : même règle que pour la
    candidature et l'évaluation (« with an intent selected, … due only when one of its steps declares it ») : avec une
    intention choisie, la rédaction n'est réclamée que si une de ses étapes, ni facultative ni dispensée, prouve
    « CV produit » ou « lettre produite ». Sans intention, les mots décident comme avant. Aucun mot ajouté.
    Pour `apply`, l'étape `cv-pdf` est facultative, donc la ligne disparaît ; pour `documents`, `cv-pdf` est
    obligatoire, la ligne reste.
  - Vert 3/3 ; non-régression un fichier à la fois (career-integration 50/50, apply-01-bilan 7/7,
    career-skill-production 8/8, career-truth 4/4, career-bilan-requested 6/6, bilan-mixtes 3/3, bilan-courriel 2/2,
    career-skill-suivi 12/12, career-pipeline 16/16, acp-replay-tracker 5/5, boite-ajouts-traites 4/4,
    career-script-help 3/3, career-rescore 2/2, career-script-limits 4/4, scan-alerte 4/4, truth-tool-names 6/6, et
    ceux du point 2a).
  - Reste tel quel : la ligne « CV du Skill : non produit » apparaît toujours pour ce prompt (vrai : aucun CV produit
    pendant la mission) ; non demandé par le brief.
- **22:15** **2c — écriture de soumission plus de 8 s après un clic `candidate`**. Sonde sans Chrome (hors dépôt) :
  `CdpBrowser` en mode propriétaire avec un contexte Playwright FICTIF injecté (`chromium.launchPersistentContext`),
  gestionnaire `ownerSendGuard` appelé directement avec une requête POST de la page du clic. Résultat avant
  correctif : `/api/applications/submit` 2 s après le clic → carte ; **9 s après → partie sans carte** ;
  `/api/stats` 9 s après → partie sans carte. **Prouvé** au niveau du gestionnaire de routes (la première sortie
  « hors fenêtre du clic » laisse partir toute écriture du site). C'est un envoi final possible sans carte.
  - Test rouge `tests/audit-suite-02-envoi-tardif.test.js` (même montage, aucun Chrome lancé, hors ensemble
    `BROWSER`) : 2/3, le cas 9 s échoue.
  - Correctif minimal dans `cdp.js` : après un clic `candidate` non approuvé, une écriture de **la même page** vers un
    **chemin de soumission** du **même site** (`isSubmitPath`, liste existante) attend la carte même hors de la
    fenêtre de 8 s ; elle est rattachée au clic (`clickToken`), comme dans la fenêtre. Télémétrie, autre page, autre
    site : règles inchangées, aucune carte de plus. Aucun mot ajouté.
  - Vert 3/3 ; non-régression (fichiers sans Chrome) : browser-startup 1/1, audit-ws-trames 2/2,
    browser-download 11/11, owner-transport 12/12, owner-send-filter 7/7, televersement-regle 5/5. Les tests Chrome
    de la passerelle seront joués avec la suite complète, après `missions-finies`.
  - Non prouvé : le même trou pour un clic `plain` / `widget` suivi d'une écriture tardive vers un chemin de
    soumission (la règle du constat 2 du 10/11 est aussi bornée à la fenêtre) ; non demandé, non traité. Pas de
    preuve dans un vrai Chrome (le montage appelle le gestionnaire de routes directement).
- **22:16** **3 — test fragile « Chrome isolé : délai du faux exécutable muet… »**. Cause documentée
  (`reuse-01a.md`, 12:53) : sous charge, la deadline de 1000 ms se déclenche avant que Node ait démarré le faux
  exécutable et écrit son fichier PID ; l'assertion `existsSync(pidFile)` lue aussitôt échoue, et le nettoyage, qui
  lit le même fichier tout de suite, peut laisser le processus vivre. Correctif dans le test seul : attente bornée
  (15 s) du fichier PID, pour l'assertion « le faux Chrome a réellement démarré » comme pour le nettoyage (SIGKILL du
  PID connu). Inchangés : `startupTimeoutMs: 1000`, le message de délai attendu, la borne de 5 s sur le rejet.
  `npm run check` code 0, `npm run format:check` code 0. Le test est dans `browser-gateway.test.js` (ensemble
  `BROWSER`) : rouge/vert sous charge et suite complète attendent `missions-finies`.
- **22:31** `missions-finies` présent (attente par boucle bornée : la commande `timeout` n'existe pas sur ce Mac,
  premier essai code 127, remplacé par une boucle zsh de 57 × 10 s ; une attente de 570 s sans fichier, puis
  trouvé). Rouge/vert du point 3 sous charge (24 boucles CPU pour 8 cœurs, 60 s) : copie temporaire de l'ancien test
  (`git show HEAD:…` dans un fichier `tests/zz-…` supprimé aussitôt) contre le nouveau, 3 tours, filtre
  `--test-name-pattern="faux exécutable muet"` : **ancien 1/3** (2 échecs `le faux Chrome a réellement démarré`),
  **nouveau 3/3**. Aucun processus `FICTIF-chrome` restant (`pgrep`).
- **22:41** Suite complète une fois (sortie hors dépôt) : `npm test` code 0 — unitaires et intégration 151 fichiers,
  1100 tests, 1098 réussis, 0 échec, 2 ignorés ; Chrome réel (série) 20 fichiers, 225/225, 0 échec (le test du
  faux exécutable muet compris). `npm run check` code 0, `npm run format:check` code 0.

## État final
- A10 : **corrigé** (passerelle, mode workflow), 2 tests ; mode agent inchangé.
- 2a : **prouvé et corrigé** (routeur du Skill), 2 tests.
- 2b : **prouvé et corrigé** (Bilan, avec intention choisie), 3 tests.
- 2c : **prouvé (gestionnaire de routes, sans Chrome) et corrigé** — c'était un envoi final possible sans carte ;
  3 tests.
- 3 : **test fragile rendu insensible à la charge** ; ancien 1/3 sous charge, nouveau 3/3.

## Commits
c38ef4b (A10), e8c5207 (2a), d8bbb5a (2b), 044fefa (2c), 37c4ee0 (test fragile), puis le commit de ce rapport.

## Non prouvé, écarts, points pour le manager
- A10 : la pause du délai `prompt` (600 s) du runtime de l'étape n'est couverte par aucun test (même
  `pauseDeadlines` que le mode agent). Une permission ACP ne porte jamais `actionClass` (le SDK filtre les champs
  hors schéma) : seule la carte de la passerelle attend le clic ; `stepControl` est quand même transmis à
  `onPermission` pour un futur cas.
- 2c : preuve au niveau du gestionnaire de routes avec un contexte FICTIF, pas dans un vrai Chrome ; le même trou
  pour un clic `plain` / `widget` (règle du constat 2 du 10/11, bornée à la fenêtre) n'est ni établi ni traité.
- 2a : `truth.js` ne s'arrête pas aux deux-points pour la négation (relevé par l'auditeur) ; non demandé, non
  touché.
- Écart d'outil : la commande `timeout` du brief n'existe pas sur ce Mac (code 127) ; remplacée par une boucle zsh
  bornée équivalente.
- Écart de méthode au point 3 : pour montrer le rouge, une copie temporaire de l'ancien fichier de test a été créée
  dans `tests/` puis supprimée avant tout commit (jamais commitée).
- Aucun test existant modifié hormis le test fragile du point 3 ; aucun site réel, aucun envoi, ni 4310/4313 ni relais
  19988, aucun `.env*` lu.
