# Relecture de la suite d'Astra — résultat partiel

Relecture à plusieurs agents **arrêtée à 07:38** car elle a consommé la limite du propriétaire (5 % à 81 % en 15 minutes). Les cinq relectures ont rendu leurs constats ; la contre-vérification est incomplète.

29 constats, 31 verdicts de sceptiques rendus (9 réfutent, 22 confirment). Les verdicts ne sont pas reliés aux constats dans le journal : la raison permet de les rattacher. **Un constat non contre-vérifié n'est pas un fait établi.**

## Constats

### Angle v2:d2a22
Couvert : Lu : la partie reprise de packages/orchestrator/index.js (via index-tour.diff, plus create, execute et le filtrage career-ops), git diff HEAD de checkpoint.js, browser-proof.js et workflow-run.js, le diff de workflow-engine/index.js et recover, tests/tour-reprise.test.js, les routes publiques et /api/internal/evidence d'apps/api/server.js, storage/index.js, result.js, verifyPack et le verify de Najah, et une recherche des champs dans agregat-front/src. Exécuté : une seule sonde node avec données FICTIVES et fake-acp, dans le dossier temporaire puis supprimée ; aucun fichier du dépôt modifié ; npm test non lancé, tests/tour-reprise.test.js non exécuté.

Contrôlé sans défaut :
- Prompt privé : turnObjective lit le fichier privé, le checkpoint ne part que dans le prompt de l'agent local, et aucun événement ni la ligne publique ne le reçoit. Les mises à jour rejouées par session/load sont écartées tant que promptStarted est faux. Je n'ai pas relu l'intégralité d'agent-runtime pour d'éventuels journaux.
- Routes publiques : result.lastPage est retiré pour career-ops par la liste blanche. Hors career-ops, /api/runs expose bien lastPage et resumedFrom, mais result.evidence y expose déjà la même URL. Le front ne lit ni resumedFrom ni lastPage, donc aucun contrat cassé.
- Autre espace : un previous career-ops force pack et workspace career-ops via plan (index.js:398-407), et un pack différent est refusé (« Session non reprenable »).
- Jeton dans l'URL : la requête et le fragment sont retirés. Un jeton placé dans le chemin reste, mais rien de nouveau n'est exposé.
- Boucle sur resumedFrom : un cycle artificiel reste borné à 50 itérations (5 tours gardés), et resumedFrom n'est posé qu'à la création.
- Taille du prompt : bornée par clip pour tous les champs sauf lastPage (signalé dans le défaut 3).
- Événement sans data : store.event reçoit toujours un objet depuis la route evidence.
- attemptCheckpoint : stepId est bien posé par la route evidence via le scope, et les étapes workflow ne sont pas career-ops (mode forcé à agent).
- Objectif antérieur : il est présenté comme rappel de mission sous untrusted:true, sans preuve d'une consigne erronée, donc non signalé.

Portée du périmètre « hors parcours navigateur » (défauts 2 et 3) : déduite de plan (index.js:413-416) et non testée via plan() ; ma sonde fournit le plan directement, comme le fait le test.

- **majeur** — Reprise career-ops : observed.lastPage vaut toujours null en production (`packages/orchestrator/index.js:248`)
  - Scénario : Une mission career-ops lit https://fictif.test/offre (snapshot lisible), puis l'utilisateur la reprend. Résultat : checkpoint.observed.lastPage = null, alors que la plateforme a bien observé la page. Attendu : la dernière page lue. Le test « mission privée » ne contrôle que previousObjective, donc ce cas n'est pas couvert. Les deux sources lues par checkpointFor sont vides pour ce pack.
  - Preuve : index.js:1061 pose value.lastPage, index.js:1108 l'écrit dans le fichier privé relay/runs/<id>-result.json, puis la liste blanche d'index.js:1121 (simulated, summary, evidence, agent, provenance, verification) le retire de la ligne publique. Le repli d'index.js:248-254 lit les événements browser_evidence, mais apps/api/server.js:470-487 n'alimente que control.browserEvidence pour career-ops ; le seul store.event('browser_evidence') (server.js:498) est dans la branche else. Sonde FICTIVE : ligne career-ops sans événement, résultat {"lastPage":null}. La valeur existe pourtant dans <id>-result.json et dans result.evidence.
- **majeur** — Une preuve fournie par l'agent peut faire échouer un tour terminé (null ou URL invalide) (`packages/orchestrator/browser-proof.js:47`)
  - Scénario : Hors parcours navigateur et hors career-ops (Najah en mode propriétaire, tout pack hors mode propriétaire), l'agent termine son tour et répond {simulated:true,summary:'FICTIF',evidence:[null]} ou evidence:[{readable:true,url:'preuve-123'}]. Résultat : run 'failed' avec « Cannot read properties of null (reading 'readable') » ou « Invalid URL », alors que le travail, et d'éventuels effets, sont déjà faits. Attendu : run terminé, lastPage null. Avant ce changement, ces réponses passaient tant que le résumé ne citait pas d'URL.
  - Preuve : index.js:1059-1061 : observations = value.evidence pour tout pack autre que career-ops, puis lastReadablePage(observations). result.js:5 valide evidence comme z.array(z.unknown()). browser-proof.js:47 lit item.readable sans protection et browser-proof.js:49 fait new URL(last.url) sans try. Sonde FICTIVE avec tests/fixtures/fake-acp.js : [null] => failed « Cannot read properties of null » ; [{readable:true,url:'preuve-123'}] => failed « Invalid URL » ; [{readable:true}] => failed « Invalid URL ».
- **majeur** — observed.lastPage présenté comme venant de la plateforme alors qu'il peut être déclaré par le modèle (`packages/orchestrator/index.js:1061`)
  - Scénario : Hors parcours navigateur, l'agent répond evidence:[{readable:true,url:'https://piege.fictif.test/jamais-visitee?x=1'}] sans avoir rien ouvert. Résultat : result.lastPage = https://piege.fictif.test/jamais-visitee, et le tour suivant reçoit observed.lastPage avec la consigne « observed vient de la plateforme : dernière page lue ». Avec url:'file:///etc/fictif', on obtient la valeur « null/etc/fictif ». Attendu : seule une observation de la passerelle alimente observed. Une déclaration du modèle passe donc pour un fait vérifié, et le Bilan de reprise perd sa fidélité.
  - Preuve : browser-proof.js:47 accepte item.readable === true sans contrôler le protocole ni l'origine de la preuve (readableBrowserObservation n'est appelée qu'en second terme du ||). index.js:1059 transmet value.evidence brut, et index.js:248 le réutilise en priorité. checkpoint.js:20 affirme la provenance plateforme. Aucune borne de taille n'est appliquée à lastPage, contrairement aux autres champs passés par clip. Sonde FICTIVE : run completed, observed={"lastPage":"https://piege.fictif.test/jamais-visitee"} et lastPage: null/etc/fictif.
- **mineur** — La dernière page est perdue après un tour intermédiaire sans navigation (`packages/orchestrator/index.js:248`)
  - Scénario : T1 lit https://fictif.test/offre. T2 pose une question et reçoit une « Réponse sans nouvelle navigation » (evidence vidée, lastPage null). T3 reprend. Résultat : observed.lastPage = null pour T3. Attendu : https://fictif.test/offre, puisque checkpointFor parcourt déjà la chaîne des tours et que c'est la dernière page lue de la mission.
  - Preuve : index.js:1047-1050 vide value.evidence, donc index.js:1061 stocke lastPage=null. index.js:248-254 ne regarde que previous (result puis ses propres événements), jamais les tours antérieurs de la boucle d'index.js:240-243. Sonde FICTIVE avec T1.lastPage renseigné et T2.lastPage null : T3 observed = {"lastPage":null}.
- **mineur** — Au-delà de 51 tours, le « premier objectif » n'est plus le premier (`packages/orchestrator/index.js:240`)
  - Scénario : Mission de 60 tours chaînés, T1 à T60, reprise depuis T60. Résultat : earlierTurns[0].objective = 'T10'. Attendu : 'T1', comme l'annonce le commentaire « keeping the first objective » (index.js:236) et le titre du test. L'objectif d'origine disparaît sans signal.
  - Preuve : La boucle s'arrête à turns.length < 50 (index.js:240), puis turns[0] est gardé comme premier tour (index.js:246). Le test tests/tour-reprise.test.js:103-120 ne monte que jusqu'à 9 tours. Sonde FICTIVE : 60 tours => premier = T10.

### Angle v2:ac148
Couvert : Lu : `git show b995fe0` (review-migration.js, career-review-migrate.js, tests/career-review-migrate.test.js en entier) ; tools.js:160-385 (script, sourceSnapshot, assertSourceReview) ; integration.js ; policy-engine/files.js ; scripts/setup-career-ops.js ; workspace.js:40-70 ; preuve ref-02-reel-a-sec.json et sortie ref-02-vert.txt, non relancées.

Exécuté : un script node dans le dossier temporaire, sur dépôts git fictifs uniquement. Aucun test du dépôt, serveur, agent ni navigateur.

Bibliothèque réelle : consultée sans modification, avec révision HEAD égale à REVIEWED_COMMIT, 0 fichier suivi modifié (`--no-optional-locks`), relay/ non suivi, noms et tailles de relay/ et noms des fichiers de code suivis. Contenu de relay/ et CV non lus ; la migration n'y a pas été lancée.

Contrôlé sans défaut :
- `__proto__`, `constructor` et `../a.mjs` dans l'ancien reçu : bloqués, sans pollution de prototype ;
- dossier `__proto__` dans la bibliothèque : mesuré normalement ;
- reçu tableau, null, nombre, chaîne ou déjà versionné : bloqué ;
- `relay` en lien symbolique : refusé ;
- écriture du reçu par fichier temporaire O_EXCL et O_NOFOLLOW, fsync puis renameSync : remplacement atomique ;
- absence de garde-fou d'automatisation : non signalée, conformément à CLAUDE.md.

Non testé : durabilité après coupure de courant (pas de fsync du dossier), jugée spéculative ; course sur `relay` remplacé par un lien entre contrôle et écriture, même UID, déclarée hors périmètre dans files.js. La course de la ligne 123 a été déclenchée par injection dans fs.readFileSync, pas par un second processus réel.

Limite : le contrôle de la regex sur les noms réels ne porte que sur les fichiers de code suivis et en ASCII ; un fichier non suivi mesuré ou un nom non ASCII n'y est pas couvert. Le plan à sec réel, lui, a mesuré 414 entrées, sans écart.

- **majeur** — La préparation réécrit le reçu : bloc de traçabilité effacé et ancien reçu approuvé sans comparaison (`packages/career-ops/integration.js:39`)
  - Scénario : Cas 1 : reçu déjà migré (avec `review`), a.mjs modifié, puis `node scripts/setup-career-ops.js` (documenté README:280, indiqué par le message d'integration.js:61), dont le seul contrôle est la révision HEAD. Résultat : reçu réécrit sans `review` ni `migratedFrom`, sans auteur ni nouvelle copie, et assertSourceReview accepte le fichier modifié. Cas 2 : ancien reçu sans version avec un écart sur a.mjs, même commande. Résultat : reçu schemaVersion 1 accepté, écart jamais mesuré, alors que planReviewMigration aurait bloqué. Attendu : un ancien reçu ne devient pas une approbation hors migration ou revue tracée, et le bloc `review` n'est pas perdu.
  - Preuve : integration.js:39 : `writeConfined(root, 'relay/source-review.json', JSON.stringify(sourceSnapshot(root)))`. Reproduit avec registre fictif : clés avant [schemaVersion, algorithm, scope, files, review], après [schemaVersion, algorithm, scope, files] ; assertSourceReview sur fichier modifié : accepté ; ancien reçu avec écart : accepté. Le commentaire tools.js:333 dit pourtant : "Never silently approve or rewrite a receipt".
- **majeur** — Le reçu écrit vient d'une seconde mesure jamais comparée à l'ancien reçu (`packages/career-ops/review-migration.js:123`)
  - Scénario : a.mjs change après la mesure du plan (ligne 38) et avant la seconde mesure (ligne 123) ; la fenêtre est courte, mais couvre le calcul sur 414 fichiers réels. Résultat : applied:true, le reçu enregistre l'empreinte du fichier modifié, le contrôle final l'accepte, et la note affirme que les empreintes sont identiques à l'ancien reçu. Attendu : écrire le snapshot comparé par le plan, ou refuser si la seconde mesure en diffère.
  - Preuve : Ligne 38 : snapshot du plan, comparé. Ligne 123 : `const snapshot = sourceSnapshot(root);`, écrit tel quel sans comparaison. Reproduit sur dépôt fictif, modification injectée via fs.readFileSync patché : empreinte de a.mjs dans l'ancien reçu 037ecd1db38c, dans le nouveau ccf99b684662, sur disque ccf99b684662 ; assertSourceReview : accepté. Aucun test ne couvre cette course.
- **mineur** — Le plan annonce applicable, puis le reçu migré est refusé par le code réel et reste en place (`packages/career-ops/review-migration.js:158`)
  - Scénario : Bibliothèque fictive avec le fichier suivi `scripts/a+b(1).js` et un ancien reçu exact. Résultat : à sec applicable:true ; --apply remplace le reçu, puis lève `Empreinte de revue invalide`, car le nom sort de la regex de tools.js:347. Sans retour arrière, le code réel refuse le reçu et une seconde application répond `Reçu déjà versionné`. Attendu : blocage au plan, sans écriture. Aucun nom de fichier de code suivi de la bibliothèque réelle ne sort de la regex aujourd'hui (contrôle ASCII).
  - Preuve : Le plan ne valide pas les chemins ; la seule validation est postérieure au renameSync. Sortie : `B plan applicable true []`, `B apply THROW: Empreinte de revue invalide`, `B reçu sur disque schemaVersion 1`, `B seconde application THROW: Migration refusée : Reçu déjà versionné`.
- **mineur** — Le contrôle final ignore la limite de 200000 octets : migration réussie, reçu inutilisable (`packages/career-ops/review-migration.js:158`)
  - Scénario : Bibliothèque fictive de 2601 fichiers mesurés. Résultat : applied:true et code de sortie 0 avec un reçu de 252797 octets, puis tools.js:172 et :233 refusent par `Fichier trop volumineux ou non régulier`. Attendu : refus avant écriture. Sans effet aujourd'hui sur le réel : 414 entrées, reçu actuel de 37996 octets.
  - Preuve : Ligne 158 : `assertSourceReview(JSON.parse(readFileSync(target)), ...)`, sans borne, alors que le code réel utilise `readConfined(root, 'relay/source-review.json', 200000)`. Le test tests/career-review-migrate.test.js:61 lit aussi avec readFileSync (ligne 60) : il annonce un reçu accepté sans passer par la lecture réelle.
- **mineur** — La copie et l'empreinte tracée peuvent désigner des octets différents (`packages/career-ops/review-migration.js:120`)
  - Scénario : L'ancien reçu change entre le plan et la relecture de la ligne 120, par exemple si la préparation tourne en même temps. Résultat : applied:true, `migratedFrom.sha256` et le nom de la copie gardent l'empreinte du plan, mais la copie contient les nouveaux octets ; l'ancien reçu contrôlé n'est conservé nulle part. Attendu : sauvegarder `bytes` lus par le plan, ou refuser si le reçu a changé.
  - Preuve : Ligne 120 : `const before = readFileSync(target);`, sans comparaison à plan.receiptSha256. Reproduit : migratedFrom.sha256 2045ceee6fba, empreinte de la copie c86bfa054440, empreinte de l'ancien reçu 2045ceee6fba. Aucun contrôle du reçu non plus avant le renameSync.
- **mineur** — La copie de sauvegarde peut rester un lien symbolique vers l'extérieur (`packages/career-ops/review-migration.js:100`)
  - Scénario : `relay/source-review.legacy-<hash>.json` existe déjà comme lien vers un fichier extérieur de même contenu. Résultat : applied:true, `migratedFrom.copy` désigne ce lien et aucune copie réelle n'existe dans relay/ ; si la cible disparaît, l'ancien reçu est perdu. Attendu : refus, comme pour le reçu lui-même (ligne 24).
  - Preuve : Ligne 100 : `if (error.code === 'EEXIST' && readFileSync(path).equals(bytes)) return;`. O_NOFOLLOW ne sert pas ici : O_EXCL renvoie EEXIST, puis readFileSync suit le lien. Reproduit sur données fictives : `E applied true ... est un lien true`.
- **mineur** — Un reçu qui n'est pas un fichier régulier bloque indéfiniment, même à sec (`packages/career-ops/review-migration.js:32`)
  - Scénario : `relay/source-review.json` est un FIFO sans écrivain. Résultat : planReviewMigration ne rend jamais la main et la commande reste figée sans message. Attendu : erreur immédiate `reçu non régulier`. La lecture n'a pas non plus de limite de taille.
  - Preuve : Ligne 24 : seul isSymbolicLink() est testé. Ligne 32 : `readFileSync(resolve(root, RECEIPT))`. Reproduit sur dépôt fictif : processus tué par le délai de 5 s (status null, SIGTERM).
- **mineur** — Le mode à sec peut écrire dans .git/index de la bibliothèque (`packages/career-ops/review-migration.js:34`)
  - Scénario : Un fichier suivi a une mtime changée et un contenu identique, puis la commande à sec s'exécute. Résultat : `git status` rafraîchit l'index, dont la mtime et les octets changent, hors de relay/. Attendu, selon le commentaire de scripts/career-review-migrate.js:3 et l'exigence du propriétaire : aucune écriture hors relay/, par exemple avec `git --no-optional-locks status`. Seules les métadonnées d'index changent, pas les fichiers de code.
  - Preuve : Ligne 34 : `git(root, 'status', '--porcelain', '--untracked-files=no')`. Reproduit sur dépôt fictif : `D applicable true index mtime modifiée true octets modifiés true`. Le test « à sec : mesure sans écrire » (tests/career-review-migrate.test.js:43) ne contrôle que relay/ et le reçu.

### Angle v2:b34b3
Couvert : Lu en entier : git diff HEAD des deux fichiers, packages/workflow-engine/index.js et definition.js, packages/orchestrator/workflow-run.js, tests/tour-reprise.test.js. Lu en partie : orchestrator/index.js (openAttempt, closeAttempt, mcpServerFor, stepDecision, resumeWorkflow, sortie d'erreur d'execute), agent-runtime/index.js (start, session, selectModel, prompt, close), mcp-gateway/client.js, skill-registry exportTo, policy-engine writeConfined, server.js (routes internes), checkpoint.js, manifest najah, Mission.tsx et App.tsx côté front.

Exécuté : tests/tour-reprise.test.js (12 sur 12 réussis) et une sonde FICTIVE dans le dossier temporaire (les deux défauts 1 et 2). Aucun fichier du dépôt modifié.

Conclusion sur le risque principal : je n'ai trouvé aucun chemin dans le code de la plateforme où un prompt ou un appel d'outil part avec beforeEffect marqué.
- promptStarted passe à vrai avant runtime.prompt (ligne 265) et avant callTool (ligne 130).
- Le catch de marquage (ligne 306) s'exécute avant le finally, donc avant la remise à faux dans closeAttempt. closeAttempt n'est appelé que dans workflow-run.js, et aucun catch de marquage ne suit un appel d'outil.
- Un signal annulé empêche le marquage.
- selectModel, session/set_mode et saveProbe ne touchent que la configuration de session et un fichier local.
- Une étape d'écriture n'est relancée automatiquement que si l'erreur est marquée, donc jamais après callTool.

Vérifié sans défaut :
- output:null au lancement ne touche pas les approbations, qui ne passent pas par launch, ni les étapes succeeded, jamais relancées.
- Runs anciens en base : output null ou absent, donc uncertain à la reprise, comportement inchangé.
- La sortie {beforeEffect:true} ne change ni aggregateOutputs (aucun summary, verified, simulated ou evidence), ni le $from de najah (sponsors.results reste undefined), ni verifyLive (`?? []`).
- run.result = {beforeEffect:true} n'arrive que si la dernière étape du DAG est optionnelle : aucun DAG livré n'est dans ce cas, et les DAG viennent uniquement des packs.
- Run final en failed et reprise autorisée. Aucun code de notification trouvé dans orchestrator/index.js ni server.js.

Comportements prudents, non signalés :
- Un délai d'étape ou une annulation avant le prompt donne encore uncertain.
- Après uncertain, puis « retry » du propriétaire, puis échec sans effet, la reprise repart sans nouvelle décision : le propriétaire a déjà choisi de relancer et l'agent reçoit l'avertissement.

Non vérifié : ce que font les vrais agents (Codex, Claude, Gemini, OpenCode) pendant session/new, par exemple des hooks locaux de leur CLI, car aucun agent réel n'a été lancé. Le commentaire de la ligne 286, « the executor proves nothing was sent », ne vaut donc que pour ce que la plateforme envoie. La gateway MCP est aussi démarrée à session/new ; seule sa route evidence refuse explicitement les appels avant le prompt, et je n'ai pas vérifié ce point pour les autres routes. Aucun scénario concret observé, donc pas de défaut signalé. La suite complète n'a pas été lancée, conformément à la consigne, et aucun fichier privé ni secret n'a été lu.

- **mineur** — Une relance après un échec sans effet annonce à l'agent que la tentative précédente a pu produire des effets (`packages/orchestrator/workflow-run.js:246`)
  - Scénario : Entrée : étape agent avec retries:1 et mcpServerFor qui échoue seulement au premier appel, donc aucun prompt envoyé. Résultat observé : la tentative 2 reçoit checkpoint.effects='unverified' et l'instruction « a pu produire des effets... signale « non vérifié » ». Le même message part après une reprise explicite d'un échec marqué beforeEffect. Attendu : aucun avertissement d'effet possible quand la tentative précédente est prouvée sans effet. Conséquence : la première tentative réelle peut vérifier avant d'agir ou rendre « non vérifié » sur une action qui n'a jamais eu lieu, ce qui fausse le compte rendu.
  - Preuve : La condition est `attempt > 1 ? { checkpoint: attemptCheckpoint(...) }` (workflow-run.js:246-257), sans regarder la cause de l'échec précédent ; le texte est fixé dans checkpoint.js (attemptCheckpoint). Sonde FICTIVE : row.state=succeeded, attempt=2, checkpoint.previousAttempt=1, effects='unverified', instructions « Une tentative précédente de cette étape n'a pas abouti et a pu produire des effets ».
Nuance : si la tentative 1 a réellement envoyé un prompt, puis que la tentative 2 échoue sans effet, l'avertissement reste justifié pour la tentative 3. Le correctif doit donc retenir qu'un prompt a déjà été envoyé sur l'une des tentatives.
- **mineur** — Un échec de l'export des Skills reste « incertain » alors qu'aucun agent n'a été lancé (`packages/orchestrator/workflow-run.js:150`)
  - Scénario : Entrée : étape agent avec une Skill tierce modifiée après résolution, donc exportTo lève « Contenu modifié après résolution ». Résultat observé : l'étape passe en uncertain et le run attend une décision. Le front affiche « L'effet de cette étape est incertain », alors qu'aucun processus agent n'existe encore. Attendu : failed (ou relance selon retries) comme les autres échecs avant prompt. mkdirSync (ligne 149) sort par le même chemin.
  - Preuve : mkdirSync et exportTo (lignes 149-158) sont hors du try de la ligne 218 ; seul ce try appelle beforeEffect(error, scope, stepSignal) à la ligne 306, et openAttempt n'arrive qu'à la ligne 159. Sonde FICTIVE avec exportTo qui lève : « export Skills: uncertain | attempt 1 | erreur: Contenu modifié après résolution ». L'erreur va dans la direction prudente : aucun effet n'est masqué, mais le run reste bloqué sur une fausse décision.
- **mineur** — Le marqueur {beforeEffect:true} s'affiche comme un résultat dans la carte de décision du front (`packages/workflow-engine/index.js:297`)
  - Scénario : Entrée : DAG najah opportunity-discovery-live. L'étape optionnelle sponsors échoue à connectMcp (délai de 15 s ou lancement raté) ; rank part quand même, se connecte, puis échoue après le début de callTool et passe en uncertain. Résultat déduit du code : la carte « Votre accord est requis » de rank affiche la sortie de chaque dépendance ayant un output, dont le bloc JSON brut { "beforeEffect": true } pour sponsors. Attendu : aucune sortie affichée pour une dépendance en échec, comme lorsque output valait null avant ce changement.
  - Preuve : Ligne 297 : `...(beforeEffect ? { output: { beforeEffect: true } } : {})`, stocké dans la colonne output et renvoyé tel quel par l'API (server.js:234). agregat-front/src/Mission.tsx:411-421 filtre sur `p.output && ...dependsOn.includes(p.step_id)` puis appelle showOutput, qui retombe sur JSON.stringify faute de summary (Mission.tsx:204-209). rank a l'effet par défaut 'unknown' (definition.js:18), il est donc non rejouable et peut passer en uncertain. Scénario déduit de la lecture, non exécuté. Le signal n'est pas au bon endroit : il est mêlé aux sorties métier alors que son seul lecteur est recover (ligne 112).

### Angle v2:c922e
Couvert : Lu : `git show e12cad9` en entier (cdp.js, owner-download.js, run-tests.js, les deux fichiers de test), http.js, `resolveUrl`/`checkUrlShape` de run-policy.js, la branche `browser.download` et `dropConnection` de cdp.js, un extrait de owner-transport.js, le garde-fou `tool_stalled` de l'orchestrateur, et le chemin `fetch`, cookies et encodage de playwright-core 1.64.1.

Exécuté : deux sondes node appelant `downloadOwnerLink` sur des serveurs locaux, avec des données fictives. Elles sont dans le dossier temporaire, et rien n'a été modifié dans le dépôt.

Non exécuté : `npm test`, les tests du dépôt, Chrome et le relais réel. Les chemins cdp.js réels, y compris la fermeture avec relais figé, sont donc déduits du code. La sonde des cookies utilise une copie du filtre de Playwright, pas Chrome.

Vérifié sans défaut :
- Redirections : la politique est réappliquée à chaque saut avant toute connexion, avec DNS épinglé. Le test de refus utilise une politique simulée, je n'ai pas exécuté ce parcours avec le vrai `RunPolicy`.
- Plafond : `Content-Length`, flux sans taille annoncée et bombes gzip, br et deflate sont refusés sans fichier, y compris sur un corps de 3xx.
- Annulation et délai pendant la phase HTTP : rejet avec la bonne raison ('Délai HTTP dépassé' observé pendant les en-têtes et pendant le corps). Le test de délai accepte aussi /abort/, mais le message réel est correct.
- Fichier partiel : un échec d'écriture supprime le fichier, et un fichier déjà présent n'est ni écrasé ni supprimé (EEXIST).
- Noms dangereux : '..' et '.' donnent EEXIST sans rien créer ; '../../evil', '/etc/passwd' et les antislashs restent dans le dossier. Noms testés dans un dossier temporaire de sonde, pas dans `downloads/`.
- `ownerDownloads` : le `finally` retire le contrôleur, il ne reste que le temps d'une attente figée.
- HTTPS : mêmes options TLS par défaut que Playwright, et cdp.js ne définit pas `ignoreHTTPSErrors`.
- 3xx sans Location : erreur HTTP, sans fichier.

Différence observée, non retenue comme défaut : l'en-tête `accept: */*` n'est plus envoyé, mais je n'ai aucun scénario concret où cela change le résultat. Le délai n'est pas non plus une régression : il couvrait déjà tout l'appel avec Playwright.

Autres corps et tests : le reste de owner-transport.js et les modifications non committées de cdp.js sans rapport avec le téléchargement n'ont pas été relus en détail. Côté tests, le manque réel est signalé au premier point : aucun test ne couvre la portée des cookies.

- **majeur** — Régression : cookies host-only et limités à un chemin envoyés à un sous-domaine ou à un chemin voisin (`packages/browser-gateway/owner-download.js:35`)
  - Scénario : Entrée : un cookie de session sans attribut Domain posé par exemple.test, un cookie Path=/app sur sous.exemple.test, puis un lien ou une redirection vers http://sous.exemple.test/application.txt. Résultat observé avec le filtre de Playwright recopié : la requête porte 'hote_seul=FICTIF; domaine=FICTIF; chemin=FICTIF'. Résultat attendu, celui de l'ancien context.request et d'un navigateur : seul 'domaine=FICTIF'. Un sous-domaine contrôlé par un tiers reçoit donc la session host-only du domaine parent.
  - Preuve : owner-download.js:35 et :41 envoient tel quel le résultat de cookiesFor, câblé sur context.cookies en cdp.js:1401. filterCookies (playwright-core coreBundle.js:14027-14040) préfixe un point à tout domaine et compare les chemins avec startsWith : ce n'est pas un filtre RFC 6265. L'ancien chemin ajoutait new Cookie(c).matches(url) (coreBundle.js:27798) avec domainMatches et pathMatches stricts (:14799-14815), et cette seconde passe a disparu. Sonde : mes essais donnent ['domaine'] avec l'ancien filtre, contre les trois cookies avec le nouveau code. Les tests ne le voient pas : owner-download.test.js simule cookiesFor, et le test Chrome ne couvre qu'un seul hôte sans redirection. Limite : la sonde utilise un magasin de cookies fictif, pas Chrome ; que CDP renvoie un domaine host-only sans point initial est une connaissance de CDP, non vérifiée ici.
- **majeur** — Régression : un Set-Cookie reçu sur une redirection n'est pas renvoyé au saut suivant (`packages/browser-gateway/owner-download.js:52`)
  - Scénario : Entrée : GET /start répond 302 avec Set-Cookie: dl=FICTIF et Location: /file.txt, et /file.txt exige ce cookie. Résultat observé : /file.txt est demandé avec cookie=null et le téléchargement échoue en 'Téléchargement HTTP 403'. Résultat attendu, celui de l'ancien code : le cookie est présent au saut suivant et le fichier est écrit. Le message de commit annonce seulement que le cookie n'est plus enregistré dans Chrome, pas que la chaîne de redirection elle-même casse.
  - Preuve : owner-download.js:52-55 ne lit que location et continue ; response.headers['set-cookie'] est ignoré, et cookiesFor relit un Chrome qui n'a pas reçu ce cookie. L'ancien chemin faisait addCookies sur chaque réponse avant de traiter la redirection (coreBundle.js:27930-27933). Sonde : [['/start', null], ['/file.txt', null]] puis REJET 'Téléchargement HTTP 403'.
- **mineur** — Régression : un Content-Encoding inconnu, en majuscules, x-gzip ou un corps vide en gzip fait échouer le téléchargement (`packages/policy-engine/http.js:78`)
  - Scénario : Entrées et résultats observés : 'Content-Encoding: binary', 'UTF-8', 'x-gzip' et 'GZIP' donnent 'Encodage HTTP non pris en charge'. Une réponse 302 avec Location et 'Content-Encoding: gzip' sans corps donne 'unexpected end of file', et la redirection n'est pas suivie. Une réponse 200 vide en gzip donne la même erreur. Résultat attendu, celui de l'ancien context.request : les encodages inconnus passent bruts, gzip, GZIP et x-gzip sont décodés, et un corps vide est accepté.
  - Preuve : http.js:76-81 compare la valeur sans la normaliser et lève une erreur hors de la table des décodeurs ; le décodage a lieu avant que l'appelant examine le statut (owner-download.js:53). Playwright met la valeur en minuscules, accepte x-gzip, laisse passer le reste et protège le cas vide avec SafeEmptyStreamTransform (coreBundle.js:28017-28035). Sonde : les six cas ont été rejetés comme décrit. Le plafond de décompression, lui, tient : les bombes gzip, br et deflate de 50 Mo sont refusées sans fichier.
- **mineur** — L'annulation et timeoutMs ne couvrent ni la résolution DNS, ni context.cookies, ni page.evaluate (`packages/browser-gateway/owner-download.js:34`)
  - Scénario : Entrée : cookiesFor ou policy.resolveUrl ne répond jamais, avec timeoutMs=100, puis signal.abort(new Error('Navigateur fermé')). Résultat observé : la promesse est encore en attente 500 ms plus tard dans les deux cas. Résultat attendu : rejet immédiat à l'annulation, ou au plus tard au délai. Sur le chemin réel, un relais figé bloque context.cookies sans limite propre, alors que l'ancien context.request.get bornait cette lecture par son timeout. L'appel reste donc suspendu jusqu'au garde-fou tool_stalled (120 s par défaut) ou jusqu'à ce que dropConnection atteigne browser.close.
  - Preuve : owner-download.js:34-35 attend resolveUrl et cookiesFor sans course contre signal ; le signal et le délai ne sont passés qu'à requestPinned (:44-46). cdp.js:1402 fait de même pour page.evaluate. Côté Playwright, le client appelle cookies avec kNoTimeout (coreBundle.js:60751), alors que l'ancien chemin passait par progress2 (:27798, :53128). Dans dropConnection, cdp.js:1482 attend page.close() sans borne avant browser.close (:1496), donc le rejet de ces attentes dépend de cette fermeture. Limite : la suspension est prouvée sur downloadOwnerLink avec des simulations ; le chemin complet avec relais figé est déduit du code, sans navigateur lancé. Le test Chrome 'couper la connexion' ne couvre que la phase HTTP.
- **mineur** — Connexion coupée pendant le DNS : TypeError au lieu de 'Navigateur fermé' (`packages/browser-gateway/cdp.js:1401`)
  - Scénario : Entrée : dropConnection se termine pendant que policy.resolveUrl est en cours. Résultat observé : rejet 'Cannot read properties of null (reading 'cookies')', transmis tel quel comme erreur de l'outil. Résultat attendu : 'Navigateur fermé', qui est bien la raison du signal.
  - Preuve : cdp.js:1401 relit this.context à chaque saut et dropConnection le met à null (:1493). owner-download.js:34-35 ne teste pas signal.aborted entre resolveUrl et cookiesFor, et le .catch qui rétablit signal.reason (:47-48) n'entoure que requestPinned. Sonde reproduisant cet ordre avec un contexte simulé : rejet 'Cannot read properties of null (reading 'cookies')'.
- **mineur** — Un 204 crée un fichier vide annoncé comme réussi et bloque la nouvelle tentative (`packages/browser-gateway/owner-download.js:57`)
  - Scénario : Entrée : un premier GET /r.pdf répond 204, le suivant 200 avec le contenu. Résultat observé : {file:'r.pdf', bytes:0, method:'session-http-link'} et un fichier de 0 octet sur le disque, puis une nouvelle tentative rejetée en EEXIST alors que le serveur sert le vrai contenu. Résultat attendu : aucun fichier et une erreur, puisqu'un 204 n'a pas de contenu à télécharger et qu'un navigateur ne télécharge rien dans ce cas. Ce n'est pas une régression : l'ancien test response.ok() faisait de même.
  - Preuve : owner-download.js:57 accepte tout le 2xx, puis :61-67 crée le fichier en O_EXCL même si le corps est vide. Sonde : '204 => OK bytes:0', [['r.pdf', 0]], puis '200 après 204 => REJET EEXIST'. Le 301 sans Location, lui, est correct : 'Téléchargement HTTP 301', sans fichier.
- **mineur** — Un seul cookie hors latin-1 fait échouer tout téléchargement sur ce site (`packages/browser-gateway/owner-download.js:41`)
  - Scénario : Entrée : un cookie pref=日本 présent pour le domaine, par exemple posé via document.cookie. Résultat observé : rejet ERR_INVALID_CHAR 'Invalid character in header content ["cookie"]', aucune requête n'est envoyée, et le lien n'est pas téléchargeable tant que ce cookie existe. Une valeur 'é' passe, mais est sérialisée en latin-1 par Node et non en UTF-8. Résultat attendu : la session est envoyée telle que Chrome l'enverrait. Ce n'est pas une régression, Playwright construit le même en-tête.
  - Preuve : owner-download.js:41 concatène les valeurs brutes dans un en-tête passé à http.request. L'exception synchrone survient dans l'exécuteur de la promesse en http.js:39, avant tout cleanup : le timer de http.js:34 continue donc jusqu'à son échéance (lecture du code). Sonde : 'cookie 日本 => REJET ERR_INVALID_CHAR'. Limite : le cookie vient d'un cookiesFor simulé ; je n'ai pas vérifié dans Chrome que context.cookies renvoie cette valeur telle quelle.
- **mineur** — L'URL du lien ignore <base href> : le fichier demandé n'est pas celui du lien (`packages/browser-gateway/cdp.js:1391`)
  - Scénario : Entrée : une page https://site.test/a/b.html contenant <base href="https://cdn.test/fichiers/"> et <a href="r.pdf">. Résultat déduit du code : la requête part vers https://site.test/a/r.pdf, avec les cookies de site.test, au lieu de https://cdn.test/fichiers/r.pdf. Le résultat est une erreur 404 ou un autre fichier. Résultat attendu : l'URL résolue par le document, celle de el.href. Ce n'est pas une régression, le commit a conservé ce calcul.
  - Preuve : cdp.js:1391 lit getAttribute('href'), donc la valeur brute, et cdp.js:1398 la résout par new URL(href, page.url()), ce qui ne tient pas compte de la base du document. Déduit de la lecture, non exécuté, puisque le navigateur était exclu.

### Angle v2:9a13a
Couvert : Lu :
- les 4 commits d'Astra (139429b, 651a4a0, 07476c4 seulement par ses stats et ses fichiers, e2f5a07 seulement par recherche ciblée dans docs/architecture-cible.md) ;
- git diff HEAD des 8 fichiers demandés, et packages/browser-gateway/relay-start.js ;
- aussi les autres fichiers non commités qui touchent ces garanties : cdp.js, browser-proof.js, checkpoint.js, orchestrator/index.js, workflow-run.js, workflow-engine/index.js ;
- les manifestes des packs, et agregat-front/src/Mission.tsx avec la gestion d'erreur d'App.tsx.

Dépendance de l'historique aux fichiers non commités : aucune trouvée.
- Aucun fichier suivi à HEAD n'importe relay-start.js (git grep vide).
- Sur une extraction de HEAD sans les modifications : imports de server.js, orchestrator/index.js, workflow-run.js et cdp.js réussis ; 49/49 tests sur astra-*, browser-proof et workflow-engine ; 132/132 sur workflow-run, runtime, resume-probe, fix-resume et career-integration.
- Le stub takeOpenedWindow de tests/owner-download-chrome.test.js:72 anticipe du code non commité, sans effet à HEAD. Ce test n'a pas été lancé (Chrome).
- Sens inverse, à savoir pour le découpage des commits : server.js et cdp.js non commités importent relay-start.js, non suivi ; orchestrator/index.js non commité importe des symboles non commités de failure.js, integration.js, browser-proof.js et checkpoint.js. Ces fichiers doivent partir ensemble. La liste de 8 fichiers demandée n'inclut ni cdp.js ni orchestrator/index.js.

Garanties d'Astra vérifiées, non annulées par le non commité :
- jetons par tentative : mcpServerFor garde scope.token et bridgeControl est inchangé ;
- session/load refusé : seul _meta est ajouté à session/new ;
- preuves navigateur : route d'évidence inchangée ;
- TurnGuard : inchangé ;
- effets unknown : beforeEffect n'agit qu'avant promptStarted, sur une erreur de l'exécuteur ; un dépassement de délai de l'étape reste uncertain ;
- valeur 'expired' de approve : tous les appelants testent !== true (index.js, cdp.js:233, cdp.js:608, tools.js, sends.js), donc elle ne vaut jamais accord ;
- lien propriétaire : un POST suivant reste soumis au garde d'envoi (cdp.js:582-608).

Exécuté en plus :
- 46/46 tests sur une copie du code de travail (astra-*, tour-reprise, relay-start) ;
- sondes FICTIVES, dans /private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/eaada6f6-c1bd-483c-9236-0431b9cff39a/scratchpad/probes/, dont les extractions ont été supprimées.

Non fait :
- suite complète, tests Chrome, agents réels, serveur, navigateur et exécution du front ;
- le chemin fonctionnel relay-start + Playwriter n'a été que lu.

Non lus : secrets, .envforme, identifiants et données privées de career-ops.

- **majeur** — Aucun pack ne déclare effect: read : un outil de lecture en échec bloque le DAG, et retries ne sert plus (`packages/workflow-engine/definition.js:18`)
  - Scénario : Workflow Najah opportunity-discovery-live. L'outil optionnel sponsors (lecture gov.uk) échoue, par exemple source indisponible. Résultat observé : sponsors=uncertain, rank/analysis/verify/report restent pending, et la mission attend une décision humaine jusqu'au délai maximal. Attendu : l'étape optionnelle passe en failed et la mission continue, comme avant 139429b. Deuxième cas : search (retries: 1) échoue. Observé : 1 seul appel puis uncertain. Avant : 2 appels puis failed. Le même mécanisme vaut pour snapshot, search, rank et context, sur tous les DAG des packs. Le beforeEffect non commité ne couvre que l'échec de connexion MCP, pas l'échec de l'outil lui-même.
  - Preuve : definition.js:18 met effect à 'unknown' par défaut ; workflow-engine/index.js:21-23 ne rend un outil rejouable que s'il est déclaré read ; index.js:288-289 le passe alors en uncertain. grep 'effect' sur domain-packs/*/manifest.yaml : aucune déclaration, et les manifestes n'ont pas été touchés par Astra ni dans le non commité. Les tests masquent le cas : tests/workflow-engine.test.js ajoute effect:'read' au faux outil. Sonde sur le code de travail avec le vrai DAG : 'search=succeeded sponsors=uncertain rank=pending analysis=pending verify=pending report=pending' ; 'search=uncertain' après 1 appel. Sonde sur 139429b~1 : 'sponsors=failed rank=succeeded ... report=succeeded', terminé=completed ; search : 2 appels, terminé=failed. docs/architecture-cible.md:47 note que la déclaration read exige la qualification du pack, mais aucun pack ne l'a reçue.
- **majeur** — Étape incertaine sur mission terminée : aucune décision possible avant reprise, et aucune issue si la reprise est refusée (`packages/orchestrator/index.js:375`)
  - Scénario : Réponse à la question ouverte. Sur une mission active, il y a toujours une issue : retry, done ou fail réveillent drive(), et le délai maximal finit par arrêter l'attente. Le blocage apparaît après un TurnGuard, un délai, une annulation ou un redémarrage : l'étape reste uncertain et la mission est failed, cancelled ou interrupted. Toute décision est alors refusée (« Workflow annulé ou inactif »). Il faut d'abord réussir resumeWorkflow. Si la reprise est refusée (définition du DAG changée, Skills changés, agent absent ou incompatible), l'étape reste uncertain sans aucun moyen de la marquer faite ou en échec. Seule cette étape reste figée : les autres missions continuent et une nouvelle mission reste possible. Dans ma sonde, le refus de reprise est provoqué par une définition volontairement différente. Corriger le premier défaut en modifiant les manifestes rendrait justement les missions déjà arrêtées non reprenables.
  - Preuve : index.js:375-378 : stepDecision lève l'erreur si la mission est terminale ou sans moteur actif. index.js:711-722 : refus de reprise pour définition ou Skills modifiés. index.js:693 : plan() peut aussi lever une erreur (agent non détecté, etc.). Sonde FICTIVE : 'DECISION retry refus : Workflow annulé ou inactif', idem done et fail, puis 'RESUME refus : Définition du workflow modifiée ou absente : reprise refusée', 'STEP uncertain'. Aucune autre route de résolution dans apps/api/server.js:522-530.
- **majeur** — Le front ne donne pas assez pour décider une fois la mission arrêtée : boutons qui échouent, cause absente ou réduite à « Annulée » (`../agregat-front/src/Mission.tsx:389`)
  - Scénario : Réponse à la question ouverte. L'agent devient silencieux ou un outil se fige, le TurnGuard coupe la mission et l'étape passe en uncertain. L'utilisateur voit « Votre accord est requis » avec Relancer, Marquer comme faite et Marquer en échec, tous actifs. Chaque clic renvoie « Workflow annulé ou inactif », et rien n'indique qu'il faut d'abord cliquer « Reprendre le workflow ». La chronologie est repliée par défaut sur une mission finie. L'erreur de l'étape vaut « Annulée » alors que personne n'a annulé. Après la reprise, run.error est effacé : la vraie cause (« Agent inactif ») ne subsiste que dans le journal JSON brut. La carte demande « Vérifiez son résultat », mais elle n'affiche que les sorties des dépendances : la sortie de l'étape est nulle, et les pages lues et appels d'outils de la tentative sont seulement dans l'activité et le journal. Il faut décider de relancer un effet peut-être réel avec ces seuls éléments. Sur une mission active, c'est suffisant de justesse : la cause et le numéro de tentative sont visibles dans la chronologie ouverte.
  - Preuve : Mission.tsx:389-393 filtre sur l'état de l'étape, sans regarder run.state. Mission.tsx:459 : disabled={busy} seulement. Mission.tsx:407-409 : texte fixe, sans s.error. Mission.tsx:223 et 228 : chronologie fermée si état final ; l'erreur n'est rendue qu'à Mission.tsx:341-343, dans cette chronologie. Mission.tsx:411-423 : seules les sorties des dépendances. workflow-engine/index.js:178-183 : error: 'Annulée' à l'abandon. orchestrator/index.js:724 : error: null à la reprise. workflow-run.js:170 : TurnGuard interrompt toute la mission. Code lu, front non exécuté.
- **majeur** — Mission privée : lastPage est supprimé par la liste blanche d'Astra, donc observed.lastPage vaut toujours null à la reprise (`packages/orchestrator/index.js:1119`)
  - Scénario : Mission career-ops qui a lu une page par la passerelle, puis reprise de la mission. Observé : result sans lastPage et checkpoint observed = {"lastPage":null}. Attendu : la dernière page lue, sans paramètres. Le point de reprise présente observed comme venant de la plateforme, mais la fonction non commitée ne marche pas sur le parcours de candidature. Le test tests/tour-reprise.test.js:86 ne le voit pas, car il fabrique lui-même un result contenant lastPage.
  - Preuve : Le value.lastPage non commité (index.js:1061) est supprimé à index.js:1119-1125 : la liste blanche issue de 651a4a0 ne le contient pas. Le repli index.js:249-253 lit les événements browser_evidence, mais server.js:471-487 n'en écrit pas pour career-ops (tout va dans control.browserEvidence). Sonde FICTIVE avec une preuve lisible injectée : 'CAREER completed evidence seen= 1 result keys= simulated,summary,evidence,agent,provenance,verification lastPage= undefined events browser_evidence= 0 checkpoint.observed= {"lastPage":null}'.
- **mineur** — lastReadablePage lit les preuves écrites par l'agent : une mission terminée peut échouer, et une page inventée est présentée comme observée par la plateforme (`packages/orchestrator/browser-proof.js:49`)
  - Scénario : Parcours agent sans browserWorkflow et hors career-ops (mode non propriétaire, ou pack najah en mode agent) : observations vaut value.evidence, qui vient de la réponse de l'agent. Cas 1 : evidence [{"readable":true}]. Observé : mission failed, « Invalid URL ». Cas 2 : evidence [null]. Observé : failed, « Cannot read properties of null (reading 'readable') ». À HEAD, les mêmes réponses donnent completed. Cas 3 : evidence [{"capability":"browser.snapshot","url":"https://inventee.test/page","snapshot":"FICTIF"}]. Observé : lastPage=https://inventee.test/page, alors que checkpoint.js affirme « observed vient de la plateforme » et que browser-proof.js réserve la preuve aux observations de la passerelle. Attendu : aucun échec, et lastPage null sans observation de la passerelle. L'exposition reste étroite, car le parcours propriétaire standard écrase evidence avec les observations réelles.
  - Preuve : index.js:1058-1061 : observations = value.evidence hors career-ops. browser-proof.js:47-50 : item.readable sans garde, new URL sans try. result.js : evidence est z.array(z.unknown()). Sonde sur le code de travail : 'failed Invalid URL', 'failed Cannot read properties of null', 'completed lastPage= https://inventee.test/page'. Même sonde sur une extraction de HEAD : les trois 'completed', lastPage undefined.

## Verdicts rendus

- CONFIRMÉ : Constat confirmé par lecture du code, sans réfutation possible. La reprise passe par server.js:361-366 : `store.get` renvoie la ligne publique, transmise comme `previous`, puis `checkpointFor` est appelé (index.js:965). `checkpointFor` n'a que deux sources pour lastPage (index.js:247-254).

1) `previous.result?.lastPage` : la valeur est posée à index.js:1061 et écrite dans le fichier privé à index.js:1108. La boucle de liste blanche d'index.js:1119-1126 la supprime ensuite pour tout pack career-ops, sans condition de mode propriétaire. `store.update` (index.js:1164-1168) enregistre donc une ligne sans lastPage. Le grep montre qu'aucun autre code ne pose lastPage dans un résultat.

2) Les événements `browser_evidence` : le seul `store.event` de ce type est à server.js:498, dans la branche else de `workspace === 'career-ops'` (server.js:470-497). La branche career-ops n'alimente que `control.browserEvidence`, qui est en mémoire. Les autres occurrences (index.js:251, 1034, 1088 et workflow-run.js:253) ne font que lire ces événements.

`lastReadablePage([])` renvoie donc null (browser-proof.js:48), et `resumeCheckpoint` produit `observed: {lastPage: null}`, alors que ses instructions annoncent « observed vient de la plateforme : dernière page lue ».

Aucune règle du propriétaire ne rend ce comportement voulu. Il ne s'agit pas d'un garde-fou, et le commentaire d'index.js:226 indique que le point de reprise va au même agent local, comme le fait déjà `turnObjective`, qui relit le fichier privé -input.json.

Les tests ne couvrent pas ce cas. tour-reprise.test.js:86 injecte lastPage directement dans une ligne fictive, et le test « mission privée » (lignes 123-146) ne contrôle que previousObjective.

Conséquence réelle mais limitée : l'agent repris ne reçoit pas la dernière page lue, et il garde l'objectif et la réponse précédents. Le libellé « majeur » est discutable, mais le défaut existe.
  - Correction : Dans `checkpointFor`, pour `previous.workspace === 'career-ops'`, relire lastPage depuis le fichier privé, sur le modèle de `turnObjective` : `JSON.parse(readConfined(this.career.path(), `relay/runs/${previous.id}-result.json`, 2000000)).lastPage`, dans un try/catch qui renvoie null si le fichier manque (mission échouée, par exemple). Ajouter au test « mission privée » un fichier -result.json fictif et un contrôle de `checkpoint.observed.lastPage`. Ne pas ajouter lastPage à la liste blanche publique, qui protège l'espace privé.
- CONFIRMÉ : Réfutation échouée : le défaut est réel et reproduit de bout en bout. La sévérité « majeur » reste discutable, car l'agent garde previousAnswer et previousObjective à la reprise, mais le fait est exact.

Sonde FICTIVE : createApp en ownerMode, CareerWorkspace temporaire, vrai pack career-ops avec tests/fixtures/career-agent.js. Deux preuves ont été postées par la vraie route POST /api/internal/evidence/<id> (navigate puis snapshot lisible de https://fictif.test/offre), toutes deux en statut 200.

Résultat de la sonde :
- état de la mission : completed ;
- clés de la ligne publique : simulated, summary, evidence, agent, provenance, verification, donc pas de lastPage ;
- événements browser_evidence dans le store : 0 ;
- lastPage dans le fichier privé <id>-result.json : https://fictif.test/offre ;
- app.engine.checkpointFor(row).observed : {"lastPage":null}.

Chemin dans le code :
- index.js:1061 pose value.lastPage et index.js:1108 l'écrit dans le fichier privé.
- La liste blanche d'index.js:1121 le retire de la ligne stockée.
- Le repli d'index.js:249-254 lit les événements browser_evidence. Or le seul store.event('browser_evidence') de production est à server.js:498, dans la branche else ; la branche career-ops (server.js:470-487) ne remplit que control.browserEvidence.
- Le seul autre émetteur à type dynamique (workflow-run.js:164) relaie les événements du TurnGuard. Il n'a pas été tracé jusqu'au bout, mais la sonde confirme 0 événement.

Aucune règle du propriétaire ne rend ce comportement voulu : ce n'est ni un garde-fou ni une demande d'accord. checkpoint.js annonce à l'agent que « observed vient de la plateforme : dernière page lue », et turnObjective (index.js:227-235) va déjà chercher le prompt dans le fichier privé pour ce même pack, ce qui confirme que la source privée est prévue pour le point de reprise. Les tests existants ne couvrent pas ce cas : tests/tour-reprise.test.js:86 injecte lastPage directement dans result, et le test « mission privée » ne contrôle que previousObjective.

Limite : un tour en échec n'écrit pas <id>-result.json (écriture seulement sur le chemin de succès, index.js:1108). Le correctif ci-dessous n'y change rien : lastPage y restera null.
  - Correction : Dans packages/orchestrator/index.js, lire lastPage depuis le fichier privé pour career-ops, sur le modèle de turnObjective. Ajouter :

lastPageOf(run) {
  if (run.workspace !== 'career-ops') return run.result?.lastPage ?? null;
  try {
    return JSON.parse(readConfined(this.career.path(), `relay/runs/${run.id}-result.json`, 2000000)).lastPage ?? null;
  } catch {
    return null;
  }
}

Puis, à la ligne 248 de checkpointFor, remplacer `previous.result?.lastPage ??` par `this.lastPageOf(previous) ??`.

Ajouter un test de reprise career-ops qui vérifie observed.lastPage après des preuves postées par la route /api/internal/evidence.
- CONFIRMÉ : Constat confirmé par le code et par une sonde FICTIVE, je n'ai pas pu le réfuter.

**Chemin dans le code**
- `result.js:5` accepte `evidence: z.array(z.unknown())`, donc n'importe quel élément.
- `executionResult` recopie la valeur telle quelle.
- `index.js:1031` ne remplace `value.evidence` que si `plan.browserWorkflow` est vrai.
- `index.js:1059-1061` passe donc les preuves de l'agent à `lastReadablePage` pour tout pack autre que career-ops.
- `browser-proof.js:47` lit `item.readable` sans protection, et `browser-proof.js:49` fait `new URL(last.url)` sans `try`.
- L'exception remonte au `catch` de `index.js:1169`, et le run passe en `failed` au lieu de `completed`.

**Sonde** (`engine.execute` avec `tests/fixtures/fake-acp.js`, pack core, hors parcours navigateur)

| `evidence` | État | Détail |
|---|---|---|
| `[]` | completed | `lastPage` null |
| `['FICTIF']` | completed | `lastPage` null |
| `[{url,title}]` | completed | `lastPage` null |
| `[null]` | failed | « Cannot read properties of null (reading 'readable') » |
| `[{readable:true}]` | failed | « Invalid URL » |
| `[{readable:true,url:'preuve-123'}]` | failed | « Invalid URL » |
| `[{readable:true,url:'https://fictif.test/a'}]` | completed | `lastPage` renseigné |

**Portée**
- Najah en mode propriétaire : `browserWorkflow` est faux pour ce pack (`index.js:413-416`), et `verify` (`domain-packs/najah/index.js:104-110`) ne contrôle ni `evidence` ni son contenu. Ce chemin est lu dans le code, je ne l'ai pas sondé : la sonde passe par le pack core.
- Tout pack hors mode propriétaire : `browserWorkflow` est faux aussi.
- Parcours navigateur et career-ops : non touchés, car leurs observations viennent de la passerelle.

**Régression**
`git diff` montre que `lastReadablePage` et son appel à `index.js:1061` sont nouveaux. Avant, `assessBrowserClaims` ne parcourait `evidence` que si le résumé citait une URL, donc ces réponses passaient quand il n'en citait pas.

**Règles du propriétaire**
Aucune ne rend ce comportement voulu : ce n'est pas un garde-fou, et le CLAUDE.md demande la robustesse technique et un Bilan fidèle. Le champ `lastPage` sert seulement au point de reprise, il ne justifie pas de faire échouer un tour terminé.

**Sévérité**
Le déclencheur est peu fréquent : les formes réalistes (chaînes, `{url,title}`) passent. Il faut un `null` ou un `readable:true` sans URL valide. « Majeur » est donc sans doute un peu fort, mais le défaut est réel et reproductible.
  - Correction : Dans `packages/orchestrator/browser-proof.js`, rendre `lastReadablePage` tolérant : ignorer les éléments non lisibles ou sans URL valide, et continuer la recherche.

```js
export function lastReadablePage(evidence = []) {
  for (const item of [...evidence].reverse()) {
    if (item?.readable !== true && !readableBrowserObservation(item)) continue;
    try {
      const url = new URL(item.url);
      return url.origin + url.pathname;
    } catch {}
  }
  return null;
}
```

Corriger aussi `assessBrowserClaims` (lignes 86-90) avec `item?.sourceId` et `item?.url`. Sinon `[null]` échoue toujours dès que le résumé cite une URL : ce plantage existait déjà avant ce changement, et cet appel précède `lastReadablePage` à `index.js:1060`.
- CONFIRMÉ : Constat non réfuté : le défaut est reproduit avec une sonde FICTIVE.

**Chemin dans le code**
- `index.js:1058-1061` : pour tout pack autre que career-ops, `observations = value.evidence`, ce qui inclut les réponses de l'agent quand `browserWorkflow` est faux. C'est le cas de Najah en mode propriétaire (`index.js:413-416`) et de tout pack hors mode propriétaire.
- `result.js:5` accepte `z.array(z.unknown())`.
- `executionResult` recopie `evidence` tel quel, et `verifyPack` ne le contrôle pas (`core` sort tout de suite, `verify` de Najah ne regarde que `opportunities`).
- `browser-proof.js:47` lit `item.readable` sans protection et `browser-proof.js:49` fait `new URL(last.url)` sans `try`. L'exception remonte au `catch` de `index.js:1169`, qui passe le run en `failed` (`index.js:1219`), alors que l'agent a répondu `end_turn`.

**Sonde** : `engine.execute` avec `tests/fixtures/fake-acp.js`, `ownerMode: true`, packs `core` et `najah`, données fictives. Résultats identiques sur les deux packs :
- `[]`, `['preuve FICTIVE']`, `[1,{a:1}]` : `completed`, `lastPage` null.
- `[{readable:true,url:'https://fictif.test/a?b=1'}]` : `completed`, `lastPage` `https://fictif.test/a`.
- `[null]` : `failed`, « Cannot read properties of null (reading 'readable') ».
- `[{readable:true,url:'preuve-123'}]` et `[{readable:true}]` : `failed`, « Invalid URL ».

**Limite de la sonde** : la variante hors mode propriétaire n'a pas été exécutée, seulement lue dans le code. Avec `browserWorkflow:false`, c'est le même chemin. Le cas Najah a été lancé avec un `plan` fixture écrit à la main, sans passer par la création de run.

**Régression** : confirmée par lecture du diff, pas par exécution de l'ancien code. `lastReadablePage` et son appel à `index.js:1061` sont nouveaux dans le diff non commité. Avant, `assessBrowserClaims` ne parcourait `evidence` que si le résumé citait une URL, donc ces réponses passaient quand le résumé n'en citait pas.

**Règles du propriétaire** : aucune ne rend ce comportement voulu. Il ne s'agit pas d'un garde-fou, et un tour terminé marqué `failed` à cause d'un champ facultatif contredit le Bilan fidèle et la robustesse technique.

**Portée réelle** : `null` ou `readable:true` dans `evidence` restent rares pour un agent, car la consigne impose seulement `evidence:array`. Le déclenchement est donc peu fréquent, mais le résultat erroné est certain quand il se produit, y compris après d'éventuels effets déjà réalisés.

**Défaut voisin** (lu, non exécuté) : `browser-proof.js:87-89` lève la même exception sur `[null]` quand le résumé cite une URL. Il existait déjà avant ce changement.
  - Correction : Dans `packages/orchestrator/browser-proof.js`, rendre `lastReadablePage` tolérant :

```js
export function lastReadablePage(evidence = []) {
  for (const item of [...evidence].reverse()) {
    if (item?.readable !== true && !readableBrowserObservation(item)) continue;
    try {
      const url = new URL(item.url);
      return url.origin + url.pathname;
    } catch {}
  }
  return null;
}
```

Une entrée illisible est ignorée et la recherche continue sur les précédentes.

Pour le défaut voisin, lignes 87-89 : utiliser `item?.sourceId` et `item?.url` dans le filtre de `assessBrowserClaims`.
- CONFIRMÉ : Constat confirmé par le code : je n'ai pas réussi à le réfuter.

Chaîne vérifiée :
- `result.js:5-6` et `result.js:74-77` : `evidence` est un `z.array(z.unknown())`, recopié tel quel depuis la réponse du modèle.
- `index.js:1031-1055` : seul `plan.browserWorkflow` remplace `value.evidence` par les observations de la passerelle.
- `index.js:1058-1059` : hors career-ops, `observations` vaut donc `value.evidence`, c'est-à-dire la déclaration du modèle.
- `index.js:1061` : `value.lastPage = lastReadablePage(observations)`.
- `browser-proof.js:47` : `item.readable === true` suffit, sans contrôle du protocole ni de l'origine, car `readableBrowserObservation` n'arrive qu'en second terme du `||`.
- `browser-proof.js:49-50` : la valeur renvoyée est `origin + pathname`. Pour `file:`, `origin` vaut la chaîne « null ».
- `index.js:247-248` : `previous.result?.lastPage` est lu en priorité et masque les vrais événements `browser_evidence` du tour précédent.
- `checkpoint.js:16` et `checkpoint.js:20` : la valeur part dans `observed`, avec la consigne « observed vient de la plateforme : dernière page lue ».

Le parcours est atteignable :
- En mode non propriétaire, qui est le mode par défaut (`server.js:83`), `browserWorkflow` est faux (`index.js:413-416`), donc tout run agent du pack core suit ce chemin.
- En mode propriétaire, le pack najah le suit aussi. Son `verify` (`domain-packs/najah/index.js:104-109`) ne contrôle que `simulated` et `opportunities`, pas `evidence`.
- La reprise passe par `server.js:360-375`, puis `index.js:965`, et `resumable` vaut true (`index.js:944`).

Sonde FICTIVE sur les fonctions réelles (`lastReadablePage` et `resumeCheckpoint`, sans run complet ni agent) :
- `[{readable:true,url:'https://piege.fictif.test/jamais-visitee?x=1'}]` donne `observed={"lastPage":"https://piege.fictif.test/jamais-visitee"}`.
- `url:'file:///etc/fictif'` donne `{"lastPage":"null/etc/fictif"}`.

Le code a été ajouté dans le diff non committé (`lastReadablePage` n'existe pas dans HEAD). Le défaut vient donc de ce changement.

Les règles du propriétaire ne couvrent pas ce comportement : elles interdisent d'ajouter des garde-fous aux parcours d'automatisation du navigateur, mais maintiennent la fidélité aux actions réelles. Or il s'agit ici d'une provenance fausse, hors parcours navigateur, et la correction n'ajoute ni blocage ni demande d'accord.

Deux réserves sur le constat :
- « Le Bilan de reprise perd sa fidélité » est exagéré. Le Bilan career-ops n'est pas touché : ce pack utilise `control.browserEvidence` et supprime `lastPage` (`index.js:1119-1125`). L'effet porte sur `checkpoint.observed`, transmis au tour suivant.
- Le checkpoint porte `untrusted:true` au niveau global, mais sa consigne affirme explicitement la provenance plateforme pour `observed`. Cela ne réfute donc pas le constat.

Défaut voisin relevé par la même sonde : `evidence:[{readable:true}]` lève `Invalid URL` et `evidence:[null]` lève un `TypeError` dans `lastReadablePage`. Lors d'un run, cette exception à `index.js:1061` est levée pendant l'exécution (effet sur l'état final non observé, la sonde n'ayant pas lancé de run). Une même déclaration du modèle peut donc aussi interrompre le traitement du résultat.
  - Correction : 1. `packages/orchestrator/index.js:1061` : alimenter `lastPage` uniquement depuis les observations de la plateforme, et jamais depuis `value.evidence` :
`value.lastPage = lastReadablePage(plan.pack.id === 'career-ops' ? (control.browserEvidence ?? []) : this.store.events(run.id).filter((e) => e.type === 'browser_evidence').map((e) => e.data));`

2. `packages/orchestrator/browser-proof.js`, `lastReadablePage` : tolérer les entrées non objet, accepter seulement les URL http(s) et ne pas lever d'exception sur une URL invalide. Par exemple, parcourir les éléments à l'envers, ignorer ceux où `item?.readable !== true && !readableBrowserObservation(item)`, faire `new URL` dans un try/catch, puis ignorer tout protocole autre que `http:` ou `https:`. Il faut garder `readable === true`, car les événements compactés par `compactBrowserEvidence` ne contiennent pas de `snapshot`.
- CONFIRMÉ : Constat confirmé par le code et par une sonde FICTIVE, je n'ai pas pu le réfuter.

Enchaînement réel :
- Au tour T2 sans navigation, index.js:1047-1050 vide value.evidence. index.js:1061 stocke donc lastPage = lastReadablePage([]) = null.
- Cette branche exige observed.length === 0 (index.js:1038-1041), donc T2 n'a aucun événement browser_evidence. Le repli de index.js:249-253 renvoie lui aussi null.
- La boucle de index.js:240-243 parcourt les tours antérieurs, mais ne relève que objective et answer, jamais lastPage.
- Sonde appelant Orchestrator.prototype.checkpointFor avec T1.lastPage='https://fictif.test/offre' et T2.lastPage=null : observed={"lastPage":null}, earlierTurns sans page.

Pistes de réfutation examinées, aucune ne tient :
- Reprise de session : elle ne compense pas. agent-runtime/index.js:250-260 refuse toute reprise avec session existante (replay_unqualified), et index.js:927-937 ouvre une session neuve. T3 n'a donc que le checkpoint.
- Contrat du champ : checkpoint.js:21 annonce à l'agent « observed vient de la plateforme : dernière page lue », sans restriction au tour précédent. Null est donc une valeur inexacte alors qu'une page a été lue dans la mission. Aucun brief ni document ne limite lastPage au seul tour précédent.
- Tests : tests/tour-reprise.test.js:76-102 ne couvre que le cas où lastPage est porté par le tour précédent. Rien n'y fixe le null comme comportement voulu.
- Règles du propriétaire : aucune n'est concernée, ce n'est pas un garde-fou. Il s'agit de la fidélité du contexte fourni à l'agent.

Limite d'impact, cohérente avec la sévérité « mineur » : earlierTurns garde l'objectif et la réponse de T1, qui peuvent citer l'URL, mais rien ne le garantit. Une page atteinte par navigation et non citée dans la réponse est perdue pour T3.
  - Correction : Dans checkpointFor (packages/orchestrator/index.js:237-254), reprendre la dernière page connue en remontant la chaîne des tours.

Ajouter avant la boucle un helper local :
const pageOf = (r) => r.result?.lastPage ?? lastReadablePage((r.id ? this.store.events(r.id) : []).filter((e) => e.type === 'browser_evidence').map((e) => e.data));

Initialiser `let lastPage = pageOf(previous);` avant la boucle.

Dans la boucle de la ligne 241, qui remonte du plus récent au plus ancien, ajouter `lastPage ??= pageOf(cursor);`.

Passer `lastPage` à resumeCheckpoint à la place de l'expression des lignes 247-253.

Ajouter un test : T1.lastPage renseigné, T2.lastPage null, et attendre que T3 ait observed.lastPage égal à l'URL de T1.
- CONFIRMÉ : Constat confirmé, je n'ai pas réussi à le réfuter.

Code : la boucle de checkpointFor part de previous.resumedFrom et remonte vers l'origine (index.js:239-243). Elle s'arrête dès que turns.length atteint 50. Elle garde donc les 50 tours les plus récents, et turns[0] à la ligne 246 est le plus ancien de cette fenêtre, pas le premier de la mission.

Sonde : la même boucle, avec le vrai resumeCheckpoint et des données fictives, donne :
- 51 tours : ['T1','T47','T48','T49','T50'], correct ;
- 52 tours : ['T2','T48',...], l'objectif T1 est perdu ;
- 60 tours : ['T10','T56','T57','T58','T59'].

Le seuil réel est bien « au-delà de 51 tours ». T60 n'y figure pas parce qu'il est passé dans previousObjective.

Atteignabilité : aucune limite de chaîne n'existe. POST /api/runs/:id/resume (apps/api/server.js:360-384) appelle engine.create(..., old). create ne vérifie que resumable, agent, pack et état terminal (index.js:620-627), puis pose resumedFrom (index.js:649). Le checkpoint est envoyé à chaque reprise (index.js:965).

Intention : le commentaire « keeping the first objective » (index.js:236) et le test « une longue mission garde son premier objectif » (tests/tour-reprise.test.js:103-120, 9 tours seulement) annoncent le premier objectif. Le 50 n'est donc qu'une borne de parcours, sans spécification contraire.

Règles du propriétaire : aucune règle de CLAUDE.md ne rend ce comportement voulu, et il ne s'agit pas d'un garde-fou d'automatisation du navigateur.

Portée : le défaut reste mineur. Il faut plus de 51 reprises, et l'agent reçoit quand même les derniers tours, mais l'objectif d'origine disparaît sans signal.
  - Correction : Dans checkpointFor (index.js:238-243), remonter toute la chaîne au lieu de s'arrêter à 50 tours, puis ne lire les objectifs que des tours gardés. resumedFrom pointe toujours vers un run déjà créé, donc pas de cycle possible par create. Exemple : `const chain = []; let cursor = previous.resumedFrom ? this.store.get(previous.resumedFrom) : null; while (cursor) { chain.unshift(cursor); cursor = cursor.resumedFrom ? this.store.get(cursor.resumedFrom) : null; } const kept = chain.length > 5 ? [chain[0], ...chain.slice(-4)] : chain; const turns = kept.map((run) => ({ objective: this.turnObjective(run), answer: run.result?.summary }));` puis passer `turns` à resumeCheckpoint. Ajouter à tests/tour-reprise.test.js un cas de 60 tours attendant T1 en tête.
- CONFIRMÉ : Constat confirmé, je n'ai pas réussi à le réfuter. Sonde FICTIVE de bout en bout : createApp, puis engine.execute avec le fixture astra-acp et browserWorkflow:true, aucun navigateur. T1 est stocké avec lastPage=https://fictif.test/offre et une consigne sans URL. T2 passe par le vrai execute : état completed, résumé « Réponse sans nouvelle navigation. ... », result.lastPage=null, alors que son propre checkpoint avait bien observed.lastPage=https://fictif.test/offre. checkpointFor(T2), c'est-à-dire le checkpoint de T3, donne observed={"lastPage":null}. L'URL n'apparaît nulle part dans le checkpoint de T3 (includes('fictif.test/offre') = false).

Lecture du code :
- index.js:1047 vide value.evidence et index.js:1061 stocke lastPage=null.
- index.js:247-254 ne consulte que previous.result?.lastPage, puis les événements de previous.
- La boucle index.js:240-243 remonte la chaîne des tours, mais seulement pour objective et answer.

Pistes de réfutation écartées :
1. Ce n'est pas un comportement voulu : le texte remis à l'agent (checkpoint.js:20) définit observed comme « dernière page lue », sans le limiter au tour précédent. Les briefs et la documentation ne mentionnent pas lastPage. Le test tests/tour-reprise.test.js:86-98 ne couvre que le cas où le tour précédent a une page.
2. L'historique de session ne compense pas : agent-runtime/index.js:256-260 refuse toujours la reprise avec replay_unqualified, donc la session est neuve et le checkpoint est la seule mémoire de la plateforme.
3. earlierTurns ne compense pas de façon fiable : l'URL n'y figure que si la consigne ou la réponse la cite (réponse coupée à 1500 caractères, tours intermédiaires omis au-delà de 5).
4. Aucune règle du propriétaire n'est en jeu : il s'agit d'un contexte de reprise, pas d'un garde-fou.

Sévérité mineure confirmée : l'agent perd une indication de contexte, sans effet faux. L'instruction demande de ne rouvrir la page que si la demande l'exige, et l'agent peut encore la retrouver si elle est citée dans le texte.
  - Correction : Dans checkpointFor (packages/orchestrator/index.js:240-254), retenir la première page non nulle en remontant la chaîne : previous.result?.lastPage, puis les browser_evidence de previous, puis pour chaque tour antérieur de la boucle cursor.result?.lastPage (ou les browser_evidence de ce tour). Ajouter un test à tests/tour-reprise.test.js : T1.lastPage renseigné, T2.lastPage null, checkpointFor(T2).observed.lastPage === T1.lastPage.
- CONFIRMÉ : Constat non réfuté : je l'ai reproduit en appelant le vrai `Orchestrator.prototype.checkpointFor` sur un store fictif. Résultats pour `earlierTurns`, par longueur de chaîne :
- 9 tours : [T1,T5,T6,T7,T8]
- 51 tours : [T1,T47..T50], encore correct
- 52 tours : [T2,T48..T51]
- 60 tours : [T10,T56..T59]
- 200 tours : [T150,T196..T199]

Cause : `packages/orchestrator/index.js:240` arrête la remontée à 50 tours antérieurs, et la ligne 247 prend `turns[0]`, qui est alors le plus ancien des 50 tours gardés, pas la racine de la mission. Le commentaire de `index.js:236` annonce pourtant « keeping the first objective ». Le test `tests/tour-reprise.test.js:103` s'intitule « garde son premier objectif », mais ne monte qu'à 9 tours.

Aucun rattrapage trouvé :
- `create` (`index.js:621-625`) ne plafonne pas la longueur de la chaîne `resumedFrom`.
- `resumeCheckpoint` (`checkpoint.js`) n'ajoute aucun signal de troncature.
- Le checkpoint part à chaque reprise (`index.js:965`), et l'objectif d'origine n'est transmis ailleurs dans le prompt que via `title`, hors checkpoint.

Aucune règle du propriétaire ne rend ce comportement voulu : il s'agit de contexte de reprise, pas d'un garde-fou. Gravité mineure confirmée, car il faut au moins 52 tours chaînés, et la perte est silencieuse.

Rien n'a été modifié dans le dépôt. La sonde est dans /private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/eaada6f6-c1bd-483c-9236-0431b9cff39a/scratchpad/probe.mjs.
  - Correction : Dans `checkpointFor`, remonter toute la chaîne avec une garde contre les cycles, en ne gardant que la racine et les 4 derniers tours. Cela évite aussi de relire le fichier privé de chaque tour. Le correctif n'a pas été exécuté ; relu à la main, il donne le même résultat que le code actuel jusqu'à 51 tours :

const recent = [];
const seen = new Set();
let first = null;
let cursor = previous.resumedFrom ? this.store.get(previous.resumedFrom) : null;
while (cursor && !seen.has(cursor.id)) {
  seen.add(cursor.id);
  first = cursor;
  if (recent.length < 4) recent.unshift(cursor);
  cursor = cursor.resumedFrom ? this.store.get(cursor.resumedFrom) : null;
}
const kept = first && !recent.includes(first) ? [first, ...recent] : recent;
const turns = kept.map((run) => ({ objective: this.turnObjective(run), answer: run.result?.summary }));

Puis passer `turns` directement à `resumeCheckpoint`, à la place de l'expression `turns.length > 5 ? ... : turns`. Ajouter à `tests/tour-reprise.test.js` un cas à 60 tours qui attend 'T1' en premier.
- RÉFUTÉ : Constat réfuté : la mécanique décrite est exacte, mais c'est le rôle voulu de la préparation, pas un défaut.

**Ce qui est exact.** `reviewCareer` réécrit bien le reçu sans comparaison (`packages/career-ops/integration.js:39`). `scripts/setup-career-ops.js:8-12` ne contrôle que la révision HEAD. Je n'ai pas rejoué le script, le code suffit à le voir.

**Pourquoi ce n'est pas un défaut.**

1. **La préparation est la revue explicite.** La ligne 39 date du commit d'origine `cfabf57` [career-ops-01]. README:280 décrit la commande comme « quarantaine, revue technique du routeur connu, activation ». Le refus de `assertSourceReview` et les blocages de `planReviewMigration` demandent justement une « nouvelle revue nécessaire ». Le reçu réécrit à ce moment-là est la nouvelle approbation, décidée par le propriétaire, seul utilisateur, qui lance la commande à la main.

2. **L'écart entre les deux commandes est documenté.**
   - `.manager/reports/astra-01.md:50` dit que la fonction de revue côté plateforme produit le nouveau format.
   - `.manager/reports/suite-astra-01.md:24` crée une commande de migration dédiée et écarte `setup-career-ops.js` pour cet usage.
   - `planReviewMigration` ne bloque que la migration de format « sans nouvelle lecture du code » (`review-migration.js:136`). Il ne prétend pas gouverner la re-revue. Dans le cas 2, l'écart bloque la migration, puis la commande de revue tranche : c'est l'enchaînement prévu.
   - La phrase « Tout écart bloque sans décision explicite » (`suite-astra-01.md:25`) admet elle-même une décision explicite, et lancer la préparation en est une.

3. **Le commentaire cité ne s'applique pas ici.** `tools.js:333` (« Never silently approve or rewrite a receipt ») accompagne `assertSourceReview`, qui ne réécrit rien. Une commande manuelle documentée, qui affiche son résultat, n'est pas silencieuse.

4. **Aucun résultat erroné n'est démontré sur le bloc `review`.** Hors `review-migration.js`, aucun code ne lit `review` ni `migratedFrom` : `assertSourceReview` ne les consulte pas. L'exigence de ce bloc était restée une question ouverte (« À trancher », `suite-astra-01.md:27`), pas une règle. La copie `relay/source-review.legacy-*.json` n'est pas supprimée par la préparation. Ce qui se perd est le lien vers cette copie dans le reçu, pas l'ancien reçu.

5. **Le correctif attendu ajouterait un blocage.** Il ferait refuser ou tracer une re-revue lancée par le propriétaire sur sa propre bibliothèque. Aucune règle de `CLAUDE.md` ne l'exige. Le message d'`integration.js:61` concerne d'ailleurs le Skill, pas le reçu, donc il ne dirige pas à tort vers une approbation de `a.mjs`.

**Limite restante.** La préparation ne laisse aucun auteur ni aucune date dans le reçu. C'est une amélioration possible de la traçabilité, pas un défaut au sens demandé. Le doute éventuel se résout donc en réfutation.
- CONFIRMÉ : Constat confirmé, non réfuté. J'ai fait exécuter `engine.execute` avec `tests/fixtures/fake-acp.js`, données fictives, sans modèle ni navigateur. L'agent déclare seulement `evidence:[{readable:true,url}]`, et aucun événement `browser_evidence` n'est enregistré.

Résultats de la sonde :
- **Mode non propriétaire, pack core :** avec `url='https://piege.fictif.test/jamais-visitee?x=1'`, le run est `completed`, `result.lastPage` vaut `https://piege.fictif.test/jamais-visitee`, et `checkpointFor` renvoie ce même `observed.lastPage`.
- **Protocole file :** avec `url='file:///etc/fictif'`, `lastPage` vaut `null/etc/fictif`.
- **Mode propriétaire, pack najah :** le chemin est aussi atteignable, car `domain-packs/najah/index.js:104-110` ne contrôle que `opportunities` et jamais `evidence`. On obtient `lastPage=https://piege.fictif.test/najah`.
- **Tour suivant :** le faux agent exige via `expectInstructions` que l'invite contienne `piege.fictif.test/t1` et « observed vient de la plateforme ». Le tour 2 se termine `completed`, donc l'invite contient bien les deux. La déclaration du modèle est présentée comme un fait de la plateforme.

Enchaînement dans le code :
- `browser-proof.js:47` accepte `item.readable === true` sans contrôler le protocole ni l'origine.
- `index.js:1059` utilise `value.evidence`, qui reste celui du modèle hors parcours navigateur.
- `index.js:1061` en tire `lastPage`.
- `index.js:248` le réutilise en priorité.
- `checkpoint.js:20` affirme la provenance plateforme.

Aucune règle du propriétaire ne rend ce comportement voulu. Il s'agit d'une provenance fausse, pas d'un garde-fou absent, et CLAUDE.md maintient un « Bilan fidèle aux actions réelles ».

Portée plus étroite que le titre ne le suggère :
- Le parcours navigateur n'est pas touché, car `index.js:1049` remplace `evidence` par les observations de la passerelle.
- Career-ops n'est pas touché non plus : il part de `control.browserEvidence`, puis la liste blanche de `index.js:1120-1125` supprime `lastPage`.
- Le contrôle de reprise de tentative dans `workflow-run.js:250` ne lit que les événements du store.

Effet supplémentaire observé : le même point fait échouer des réponses par ailleurs valides. `evidence:[null]` donne un run `failed` avec « Cannot read properties of null (reading 'readable') », et `evidence:[{readable:true,url:'pas une url'}]` donne `failed` avec « Invalid URL ».

Une réserve sur le scénario : la sonde prouve l'entrée dans le point de reprise (`observed`), pas une altération du texte du Bilan lui-même.
  - Correction : Dans `packages/orchestrator/index.js:1061`, ne plus alimenter `lastPage` avec `value.evidence`, mais seulement avec les observations de la passerelle :

```js
value.lastPage = lastReadablePage(
  plan.pack.id === 'career-ops'
    ? (control.browserEvidence ?? [])
    : this.store.events(run.id).filter((e) => e.type === 'browser_evidence').map((e) => e.data),
);
```

Cela écarte aussi les plantages sur `evidence:[null]` et sur une URL invalide, puisque le modèle n'atteint plus `lastReadablePage`.
- CONFIRMÉ : Constat non réfuté : le code se comporte comme décrit, et je l'ai reproduit moi-même sur un dépôt fictif.

**Lecture du code**
- `planReviewMigration` compare à l'ancien reçu le snapshot de `review-migration.js:38`, mais ne le renvoie pas.
- `applyReviewMigration` remesure à la ligne 123 et écrit cette mesure sans la comparer à rien (lignes 124-125).
- Le contrôle de la ligne 158 compare le reçu à une nouvelle mesure du disque. Il ne voit donc pas un changement survenu avant la ligne 123 : il accepte ce que la seconde mesure vient d'enregistrer.
- La note de la ligne 131 affirme pourtant « Empreintes identiques à l'ancien reçu ».

**Reproduction**
Script dans le dossier temporaire, avec `a.mjs` modifié au premier `fsyncSync`, c'est-à-dire dans `writeBackup`, entre les lignes 38 et 123 :
- `applied: true` ;
- ancien reçu 037ecd1db38c, reçu écrit 7fbfeb28d098, disque 7fbfeb28d098 ;
- note inchangée ;
- `assertSourceReview` accepte.

**Pistes de réfutation écartées**
- Le test `tests/career-review-migrate.test.js` ne couvre pas cette course : ses cas de blocage modifient les fichiers avant l'appel.
- Aucune règle du propriétaire ne rend ce comportement voulu. Le commentaire des lignes 27-28 dit « any gap blocks », et le brief `suite-astra-02` (étape 2) exige un écart nul.
- Le périmètre de `sourceSnapshot` exclut `relay/` (`tools.js:306`). La copie de sauvegarde n'impose donc pas de remesurer.
- La migration n'a pas encore été appliquée au reçu réel : `relay/` ne contient aucune copie `source-review.legacy-*`, et le reçu date du 31/10. Le chemin reste donc à exécuter.

**Réserve sur la gravité**
« Majeur » me paraît surévalué :
- la fenêtre ne dure que le temps de quelques écritures et d'un hachage ;
- la commande est manuelle, à usage unique, et son en-tête demande de l'appliquer API arrêtée ;
- je n'ai trouvé aucun processus qui écrive dans le code de la bibliothèque pendant ce temps ;
- la reproduction, la mienne comme celle du constat, injecte la modification artificiellement ;
- un processus capable d'écrire dans la bibliothèque pourrait aussi modifier directement le reçu, qui n'est pas signé : ce n'est donc pas une frontière de sécurité.

Le défaut est réel mais de gravité mineure : un reçu peut affirmer faussement l'identité des empreintes, et la correction est très courte.
  - Correction : Dans `applyReviewMigration`, juste après la ligne 123 et avant toute écriture du reçu, comparer la seconde mesure à l'ancien reçu et refuser en cas d'écart :

```js
const legacy = JSON.parse(before);
const measured = Object.keys(snapshot.files);
if (
  measured.length !== Object.keys(legacy).length ||
  measured.some((path) => legacy[path] !== snapshot.files[path])
)
  throw new Error('Migration refusée : code tiers modifié pendant la migration');
```

`legacy` vient de `before`, déjà lu à la ligne 120 : ce contrôle couvre donc aussi un reçu remplacé entre le plan et l'écriture. L'ancien reçu reste intact, puisque le refus précède le renommage de la ligne 153.

Ajouter un test sur dépôt fictif qui modifie `a.mjs` dans cette fenêtre, par exemple via `fs.fsyncSync` patché puis `syncBuiltinESMExports`. Il doit vérifier le rejet et que le reçu reste inchangé.
- RÉFUTÉ : Constat réfuté : le scénario ne peut pas se produire par le parcours réel, et même forcé il ne dégrade rien.

1. Le scénario contourne le verrou de révision. `planReviewMigration` bloque dès que HEAD diffère de `REVIEWED_COMMIT`, figé sur 2d6ed587 (packages/career-ops/review-migration.js:18 et :73). `scripts/career-review-migrate.js` n'expose que `--apply`, `--reviewer` et `--root`, et n'a aucune option `reviewedCommit`. Une « bibliothèque fictive » passée par `--root` obtient donc `applicable:false` (« Révision non revue ») et aucune écriture. La sortie `plan applicable true` n'existe qu'en injectant `reviewedCommit` par l'API du module, ce que seul tests/career-review-migrate.test.js:40 fait.

2. Au commit figé, aucun fichier mesuré ne sort de la regex. `git ls-tree` à 2d6ed587 ne donne aucun .js/.mjs/.json/.sh hors du jeu de caractères ; les seuls noms hors jeu sont les `web/.../[id]/...`, et `web` est exclu par `sourceSnapshot` (tools.js:293). Tout fichier suivi modifié bloque aussi le plan (review-migration.js:74).

3. Sur le disque réel, rien non plus. Un petit script reprend les exclusions de `sourceSnapshot` et la regex de tools.js:347, en lisant les noms seulement : `{ measured: 414, horsRegex: [] }`.

4. Le seul cas restant est très improbable : un fichier non suivi au nom atypique dans la bibliothèque, ET déjà listé avec son empreinte exacte dans l'ancien reçu. Sinon le plan bloque via `added`.

5. Même dans ce cas, il n'y a pas de régression. Le contrôle de la regex dans `assertSourceReview` (tools.js:345-353) passe avant le test `legacy` et s'applique aussi à l'ancien reçu : celui-ci était déjà refusé avec la même erreur `Empreinte de revue invalide`. Le refus reste strict, le code n'approuve rien à tort, l'erreur est levée et la copie `relay/source-review.legacy-*.json` reste disponible (review-migration.js:122).

Je n'ai pas relancé la reproduction du constat. Je n'ai pas non plus lu le reçu réel de la bibliothèque, car je m'en suis tenu au code et aux noms de fichiers.
- CONFIRMÉ : Constat non réfuté : je l'ai reproduit de deux façons, sur dépôts fictifs dans le dossier temporaire, sans toucher au dépôt.

Lecture du code (packages/career-ops/review-migration.js) :
- La ligne 38 mesure le snapshot du plan et le compare à l'ancien reçu, mais ce snapshot n'est pas renvoyé par le plan.
- La ligne 123 refait une mesure, écrite telle quelle aux lignes 124-125 sans aucune comparaison.
- La ligne 120 relit le reçu dans `before`, sans vérifier que son contenu correspond encore à `plan.receiptSha256`.
- La ligne 158 compare le reçu écrit à une mesure du disque : elle accepte donc le fichier modifié.
- La note de la ligne 131 affirme pourtant « Empreintes identiques à l'ancien reçu ».

Reproduction 1, écriture injectée juste après la ligne 120 via fs.readFileSync patché :
- `applied:true`, a.mjs vaut 037ecd1db38c dans l'ancien reçu et 4253c5b7d3e1 dans le nouveau comme sur disque.
- `git status` affiche `M a.mjs`, et `assertSourceReview` accepte.

Reproduction 2, sans patch : un processus `sh` indépendant écrit a.mjs après un délai aléatoire de 20 à 80 ms, sur 414 fichiers fictifs, 40 essais.
- 6 refus, 28 reçus avec l'ancienne empreinte, 6 reçus avec l'empreinte modifiée.
- Dans ces 6 derniers cas, `assertSourceReview` accepte. La course est donc atteignable sans injection, ce taux venant d'un délai choisi pour tomber dans la fenêtre.

Conséquence : `assertSourceReview` est le contrôle lu avant les scripts career-ops (tools.js:172-173 et 233-235). Aucune autre vérification git n'y figure (recherche de `rev-parse`, `status --porcelain` et `sourceCommit` dans packages, apps et scripts). Du code modifié dans la fenêtre passerait donc pour revu, avec une note fausse. Le commentaire des lignes 27-28 pose pourtant que tout écart bloque.

Aucune règle du propriétaire ne rend ce comportement voulu : ce n'est pas un parcours d'automatisation du navigateur, et un reçu doit rester fidèle à la réalité. Aucun test de tests/career-review-migrate.test.js ne couvre cette course : les cas bloqués modifient l'état avant l'appel.

Réserve sur la gravité : la fenêtre est courte (une mesure prend environ 24 ms ici, plus le fsync de la copie). Il faut aussi un écrivain concurrent, alors que le script demande d'appliquer API arrêtée. Le défaut est réel, mais « majeur » paraît élevé : « mineur » ou « moyen » serait plus juste.
  - Correction : Dans applyReviewMigration, juste après la ligne 123, avant de construire le reçu :

const legacy = JSON.parse(before);
const paths = Object.keys(snapshot.files);
if (sha256(before) !== plan.receiptSha256 || paths.length !== Object.keys(legacy).length || paths.some((path) => legacy[path] !== snapshot.files[path])) throw new Error('Migration refusée : code ou reçu modifié pendant la migration');

Toute modification postérieure à cette comparaison laisse l'ancienne empreinte dans le reçu : la ligne 158 ou le contrôle suivant la refuse. Ajouter un test de course avec écriture injectée entre le plan et la seconde mesure.
- CONFIRMÉ : Constat non réfuté : je le reproduis avec la vraie `SkillRegistry` et un vrai `Store` sur données fictives, en appelant `reviewCareer` directement.

**Reproductions**
- `scripts/setup-career-ops.js:8-12` ne contrôle que `rev-parse HEAD`, sans `git status`. Un arbre modifié à la révision revue passe donc. Ce contrôle du script a été lu, pas exécuté : la révision exigée ne peut pas être simulée sur un dépôt fictif.
- Aucune étape du registre ne bloque une deuxième préparation (`importLocal`, `review`, `install` dans `packages/skill-registry/index.js:122-261`).
- Cas 1 : reçu avec bloc `review`, puis `a.mjs` modifié. `assertSourceReview` refuse avant la préparation. Après `reviewCareer`, les clés sont `[schemaVersion, algorithm, scope, files]` et le fichier modifié est accepté. La sortie (`hash`, `files`, `sourceFiles`) ne signale rien.
- Cas 2 : ancien reçu sans version avec un écart. Refus avant, reçu schemaVersion 1 accepté après. `integration.js:39` n'appelle jamais `planReviewMigration` (`review-migration.js:71`), qui aurait bloqué.
- Sans aucun écart de code : avec un dossier de données neuf, `assertCareerReview` répond « lancer la préparation » (`integration.js:61`). Suivre ce message efface le bloc `review` et `migratedFrom`. Ce bloc avait été exigé pour ref-02 (`.manager/briefs/suite-astra-02.md:12`, `.manager/reports/suite-astra-01.md:25`). `review-migration.js:126-138` l'écrit et rien ne le recopie.

**Pistes de réfutation écartées**
- Aucune règle du propriétaire ne couvre ce cas : CLAUDE.md vise les parcours d'automatisation du navigateur, pas ce reçu d'empreintes.
- La préparation est bien une commande explicite, et la seule qui écrit un reçu pour du code modifié. Mais README:280 la décrit comme « revue technique du routeur connu », seul le routeur est vérifié, et `docs/api-career-ops.md:9` la prévoit « à la révision revue ». Elle approuve pourtant tous les fichiers mesurés sans lire l'arbre.
- `.manager/reports/suite-astra-01.md:24` écartait déjà ce script pour la migration et demandait que tout écart bloque (`:26`), mais la voie est restée ouverte.

**Réserves sur le constat**
- Le message de `integration.js:61` porte sur l'état du Skill, pas sur un écart de `a.mjs`. Il mène à la préparation, sans la recommander pour ce cas.
- Le commentaire de `tools.js:333` accompagne le contrôle lui-même, pas la préparation.
- Rien dans le code ne lit le bloc `review` ; il ne sert qu'à l'audit. Il faut en plus que le propriétaire lance la commande à la main. La gravité « majeur » me paraît donc haute, « moyen » conviendrait mieux, mais le résultat erroné est réel.
  - Correction : Dans `reviewCareer` (`integration.js:39`), ne plus écraser le reçu sans condition.
- Reçu absent : l'écrire, comme aujourd'hui.
- Reçu versionné et identique à `sourceSnapshot` : le laisser tel quel, ce qui conserve `review` et `migratedFrom`.
- Reçu sans version, ou écart de fichiers : refuser avec le message de `assertSourceReview`, qui nomme les fichiers, et renvoyer vers `scripts/career-review-migrate.js` pour l'ancien format.
- Un renouvellement voulu après changement de code passe par une option explicite avec auteur (par exemple `--renew-review --reviewer`), qui garde une copie de l'ancien reçu et écrit un bloc `review`.
- RÉFUTÉ : Le mécanisme existe bien, mais le scénario n'est pas atteignable par le seul point d'entrée de production.

**Ce qui se reproduit.** En appelant directement `planReviewMigration` et `applyReviewMigration` avec un `reviewedCommit` injecté, j'obtiens exactement les sorties du constat. Pour `scripts/a+b(1).js` : plan `true []`, puis `Empreinte de revue invalide`, reçu sur disque en `schemaVersion 1`, seconde application refusée. Il en va de même pour un nom en NFD. L'ordre est bien celui décrit : `review-migration.js:153` renomme, puis `review-migration.js:158` valide.

**Pourquoi le scénario ne se produit pas en réel.**
- `reviewedCommit` n'est passé que par `tests/career-review-migrate.test.js`. Le seul appelant de production, `scripts/career-review-migrate.js`, n'expose que `apply`, `reviewer` et `root`. La valeur par défaut est donc le commit figé `REVIEWED_COMMIT` (`review-migration.js:18`, blocage à la ligne 73).
- Test du CLI sur la même bibliothèque fictive avec un reçu exact :
  - à sec : code de sortie 2, `applicable:false`, `Révision non revue` ;
  - `--apply` : code de sortie 2, `Migration refusée`, reçu inchangé, aucune copie écrite.
- Le plan n'indique donc pas « applicable » sur cette bibliothèque, et rien n'est écrit.
- Un hash de commit fixe l'arborescence suivie. Au commit `2d6ed58`, qui est aussi le HEAD actuel de la bibliothèque, 413 fichiers de code suivis sont dans le périmètre, et 0 sort de la regex de `tools.js:347`.
- Le parcours de la bibliothèque, sur les noms seulement, donne 414 fichiers mesurés et 0 hors regex.
- Un nouveau fichier non suivi au nom atypique est bloqué par `Fichiers non couverts par le reçu` (`review-migration.js:69`), avant toute écriture.

**Cas résiduel.** Il faudrait à la fois un fichier non suivi au nom atypique et un ancien reçu contenant déjà ce nom avec la bonne empreinte. Je n'ai pas lu le reçu réel, car il n'entre pas dans le code autorisé. Comme les noms du reçu doivent correspondre à ceux du disque pour que le plan passe, et qu'aucun nom du disque ne sort de la regex, ce cas exigerait un fichier ajouté plus un reçu qui le couvre déjà.

**Impact, même dans ce cas.** Il resterait faible. Un ancien reçu est de toute façon refusé par `assertSourceReview`, avant comme après la migration. La copie `.legacy-*` est conservée, et le CLI sort en erreur avec le code 2.
- RÉFUTÉ : Constat réfuté : le mécanisme existe bien, mais aucun scénario atteignable ne le déclenche hors d'une simultanéité manuelle très improbable.

Ce qui est exact :
- `review-migration.js:120` relit le reçu sans le comparer à `plan.receiptSha256`.
- Les lignes 121 et 134 gardent l'empreinte du plan.
- Si le reçu changeait entre les lignes 32 et 120, la trace serait donc fausse.
- Je n'ai pas rejoué la reproduction citée. Elle est cohérente avec le code, mais elle suppose d'écrire dans le reçu pendant cette fenêtre.

Pourquoi le déclencheur n'est pas réel :
1. Le seul écrivain de `relay/source-review.json` dans le code de production est `reviewCareer` (`integration.js:39`). Une recherche sur `source-review` ne montre aucun autre écrivain.
2. `reviewCareer` n'est appelé que par `scripts/setup-career-ops.js`, une commande lancée à la main (README:280, `docs/api-career-ops.md:9`). Ni l'API ni le package.json ne l'appellent.
3. La migration est elle aussi une commande manuelle à usage unique. Son en-tête impose de l'appliquer API arrêtée (`scripts/career-review-migrate.js:2`). Une fois le reçu migré, le plan la refuse (lignes 49 et 64).
4. Le propriétaire gère seul l'application. Il faudrait donc qu'il lance la préparation en même temps que la migration, et que l'écriture tombe dans la fenêtre réduite aux lignes 33 à 120 : deux appels git et `sourceSnapshot`.

Deux cas limitent encore la portée :
- Une seconde migration concurrente ne produit pas ce résultat : la copie du même nom existe déjà avec d'autres octets, donc `writeBackup` lève l'erreur (lignes 100-101).
- Dans le cas de la préparation, c'est elle qui aurait écrasé l'ancien reçu. Le nouveau reçu reste mesuré sur le disque et validé à la ligne 158 : l'effet se limite à une trace de migration inexacte, sans empreinte de code fausse.

Le scénario « la préparation tourne en même temps » est donc spéculatif. Selon la consigne, ce doute réel vaut réfutation.
- RÉFUTÉ : Constat réfuté : le mécanisme existe, mais aucun parcours réel n'y mène et la migration ne dégrade rien.

Ce qui est exact : `review-migration.js:158` relit le reçu sans borne, alors que `tools.js:172` et `:233` passent par `readConfined(..., 200000)`. Reproduit avec une bibliothèque fictive de 2601 fichiers : `applied:true`, puis refus `Fichier trop volumineux ou non régulier`. Le reçu mesurait 216405 octets dans mon essai (les 252797 du constat dépendent de la longueur des chemins).

1. La migration ne rend pas inutilisable un reçu qui fonctionnait. Dans ce même essai, l'ancien reçu faisait déjà 215884 octets et `readConfined` le refusait déjà avec la même erreur. Elle n'ajoute que 521 octets. Un reçu utilisable ne deviendrait inutilisable que si l'ancien mesurait environ 199480 à 200000 octets. Le scénario cité n'est pas dans cette fenêtre, et un refus avant écriture laisserait l'outil tout aussi bloqué.

2. Le seul appelant de production ne peut pas atteindre ce cas. `scripts/career-review-migrate.js:22` appelle `applyReviewMigration` sans `reviewedCommit`, donc avec `REVIEWED_COMMIT` figé (`review-migration.js:18` et `:73`). L'option n'est transmise par aucun autre code de `packages`, `apps` ou `scripts`. La bibliothèque doit donc être à ce commit précis, sans fichier suivi modifié, avec un reçu qui couvre exactement les fichiers mesurés (`:69-71`). Mesure en lecture seule : le HEAD réel est bien `2d6ed58`, et le reçu actuel fait 37996 octets, très loin de la limite. Le constat le reconnaît lui-même. La bibliothèque fictive du scénario n'existe que par la surcharge de `reviewedCommit` dans un test.

3. Dépasser la limite exigerait plus de 2000 fichiers de code non suivis supplémentaires, tous déjà couverts par l'ancien reçu. Ce n'est pas un scénario réel.

Le test `tests/career-review-migrate.test.js:60-61` lit avec `readFileSync`, mais sur une bibliothèque de 2 fichiers : il n'affirme rien de faux sur la taille.

Il s'agit donc d'un écart théorique sur une migration à usage unique, sans entrée réelle produisant un résultat erroné. En cas de doute, la consigne est de considérer le constat réfuté.
- RÉFUTÉ : Constat réfuté : le mécanisme existe, mais le scénario annoncé n'est pas atteignable par la commande réelle et ne dégrade rien.

Script : /private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/eaada6f6-c1bd-483c-9236-0431b9cff39a/scratchpad/repro.mjs (bibliothèques fictives de 2, 2000 et 2601 fichiers).

Ce qui est confirmé :
- En appelant directement `applyReviewMigration` avec un `reviewedCommit` injecté, 2601 fichiers donnent `applied:true` et un reçu de 212689 octets.
- `readConfined(root, 'relay/source-review.json', 200000)` refuse ensuite ce reçu par `Fichier trop volumineux ou non régulier`.
- La ligne review-migration.js:158 ne borne effectivement pas sa lecture.

Ce qui est faux ou inatteignable :
1. **« Code de sortie 0 » est faux pour ce scénario.** scripts/career-review-migrate.js n'expose pas `reviewedCommit` : il appelle `applyReviewMigration(root, { reviewer })`, donc avec `REVIEWED_COMMIT` figé (review-migration.js:18). Sur les trois bibliothèques fictives, `--apply` donne le code 2 et `Migration refusée : Révision non revue`. Seul un paramètre d'API, utilisé uniquement par les tests (aucune autre occurrence dans packages, scripts, apps), permet d'atteindre l'état décrit.
2. **Le cas réel suppose un état qui n'existe pas.** La commande n'aboutit que si HEAD vaut exactement 2d6ed58, sans fichier suivi modifié, et si le reçu sans version couvre tous les fichiers mesurés (review-migration.js:69-74).
   - À ce commit, environ 426 fichiers suivis sont mesurables (décompte approximatif par filtre `git ls-tree`).
   - Le constat indique 414 entrées, et le reçu réel pèse 37996 octets.
   - Dépasser 200000 octets demanderait environ 2000 fichiers non suivis de plus, tous déjà présents avec leur empreinte exacte dans l'ancien reçu.
   - Or le code actuel n'écrit plus ce format : integration.js:39 écrit `sourceSnapshot`, qui est versionné.
   - Le constat admet lui-même l'absence d'effet réel.
3. **Aucune dégradation, même dans ce cas hypothétique.** La migration n'ajoute qu'environ 500 octets au reçu (162891 à 163407, 212173 à 212689). Pour produire un reçu trop gros, l'ancien reçu devait déjà frôler ou dépasser la limite. Avant migration, tools.js:172 et :233 refusaient déjà ce reçu, soit pour sa taille, soit parce qu'il était sans version (`assertSourceReview`). Après migration, le refus reste explicite et une copie de l'ancien reçu est conservée.

Le test tests/career-review-migrate.test.js:60-61 lit bien avec `readFileSync`, mais sur un reçu de deux entrées : il ne produit donc aucun résultat erroné.

Aucun fichier du dépôt n'a été modifié.
- CONFIRMÉ : Réfutation échouée : le défaut est réel, mais il ne se déclenche que si un autre processus écrit le reçu pendant la migration.

Code (packages/career-ops/review-migration.js) :
- La ligne 32 lit le reçu et calcule `receiptSha256`.
- Le plan lance ensuite deux commandes git et `sourceSnapshot`.
- La ligne 120 relit le fichier sans comparer à `plan.receiptSha256`.
- La ligne 121 nomme la copie avec l'empreinte du plan, et la ligne 134 trace cette même empreinte.
- Aucun contrôle ne précède le `renameSync` de la ligne 153.

Reproduction : petit script node dans le dossier temporaire, données fictives, dépôt non modifié. J'ai forcé le moment de l'écriture avec un faux `git` placé dans le PATH, qui remplace le reçu pendant `git status`. Ce n'est donc pas une course observée naturellement.
- Cas « préparation » (reçu versionné, comme l'écrit `reviewCareer`) : applied:true, `migratedFrom.sha256` et le nom de la copie à 2045ceee6fba, copie à 8cd11668fcc7. La copie contient le reçu versionné, et l'ancien reçu contrôlé n'est conservé nulle part.
- Cas « octets corrompus » (`not json`) : applied:true, même trace, copie à 7ccfa1fbf394 contenant `not json`.

Pistes de réfutation écartées :
- Le commentaire « API arrêtée » de scripts/career-review-migrate.js:2 ne couvre pas le cas, car scripts/setup-career-ops.js est un processus distinct qui écrit ce reçu (integration.js:39).
- Aucune règle du propriétaire ne rend ce comportement voulu : ce n'est pas un garde-fou de parcours navigateur, et CLAUDE.md demande un Bilan fidèle aux actions réelles.
- Le code contredit son propre invariant, écrit aux lignes 27-28 et 99 (« its name holds the hash of these bytes »).

Limites :
- Sans écrivain concurrent, les deux lectures sont identiques et le défaut ne se produit pas.
- Il faut lancer deux commandes manuelles en même temps, dans une fenêtre courte (celle des deux commandes git et de `sourceSnapshot`). La gravité « mineur » est donc justifiée.
- Une partie du correctif proposé dans le constat est moins bonne : sauvegarder les `bytes` du plan écraserait quand même le reçu que la préparation vient d'écrire. Il vaut mieux refuser.
  - Correction : Après la ligne 120 de packages/career-ops/review-migration.js, ajouter : `if (sha256(before) !== plan.receiptSha256) throw new Error('Reçu modifié pendant la migration : relancer le plan');`. Refaire le même contrôle juste avant le `renameSync` de la ligne 153 réduit la seconde fenêtre, sans la fermer complètement.
- RÉFUTÉ : Constat réfuté sur la portée, pas sur la mécanique : le comportement décrit est exact, mais je ne trouve aucun scénario réel qui y mène, et aucune garantie n'est perdue.

**Ce qui est exact.** Je l'ai reproduit sur données fictives : `applied true copy relay/source-review.legacy-7ae90a4475b9.json lien true`. Avec O_EXCL, un lien existant renvoie EEXIST, puis `readFileSync` le suit (review-migration.js:100).

**Pourquoi ce n'est pas un défaut concret :**
1. **Aucun chemin de code ne crée ce lien.** Ce nom n'est écrit que par `writeBackup`, avec O_EXCL|O_NOFOLLOW (lignes 93-97), donc toujours comme fichier ordinaire. `relay/` est exclu de `sourceSnapshot` (tools.js:306). Le scénario suppose qu'on ait créé à la main un lien portant les 12 premiers caractères du SHA-256 du reçu, vers un fichier aux octets identiques. Une erreur de manipulation ne produit pas cela : il faudrait le vouloir.
2. **Le refus ne protégerait pas la copie.** Celui qui peut poser ce lien dans `relay/` a les droits du même utilisateur. Il peut aussi supprimer ou remplacer une copie ordinaire après la migration. La perte décrite (« si la cible disparaît ») reste donc possible avec ou sans le refus.
3. **Rien n'est écrit à travers le lien et rien ne fuit.** Le fichier suivi est seulement comparé, et sur EEXIST aucune écriture n'a lieu. Le confinement des écritures tient : le reçu passe par un fichier temporaire dans `relay/` puis un `renameSync` (lignes 140-153).
4. **Le bilan reste fidèle au moment de l'exécution.** `migratedFrom.copy` désigne un chemin qui donne bien les octets de l'ancien reçu, et `migratedFrom.sha256` les identifie. Le nouveau reçu est vérifié par `assertSourceReview` (ligne 158). Dans packages, scripts et tests, seuls le script et le test importent ce module, et rien dans ces fichiers ne relit `copy` : ce champ reste informatif.
5. **La comparaison avec la ligne 24 ne vaut pas.** Là, le reçu est un contrôle d'autorisation lu ensuite par le code. Un lien y changerait ce qui est accepté, alors qu'ici il s'agit d'une copie d'archive que rien ne consomme.

**État réel.** Dans la bibliothèque, je n'ai listé que les noms et métadonnées de `relay/source-review*` : aucune copie `legacy-*` n'existe et aucun de ces fichiers n'est un lien.

**Réserve.** Le O_NOFOLLOW de la ligne 95 ne sert à rien tant que le repli de la ligne 100 existe, ce qui contredit légèrement l'intention affichée. C'est une incohérence sans effet atteignable. Si le propriétaire veut l'aligner malgré tout, ajouter `!lstatSync(path).isSymbolicLink()` à la condition de la ligne 100 suffit.

Script de reproduction, hors dépôt : /private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/eaada6f6-c1bd-483c-9236-0431b9cff39a/scratchpad/repro.mjs. Rien n'a été modifié dans le dépôt ni dans la bibliothèque.
- CONFIRMÉ : Réfutation échouée : le comportement est reproduit sur données fictives, avec `/private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/eaada6f6-c1bd-483c-9236-0431b9cff39a/scratchpad/repro-backup.mjs`.

Résultat avec un lien préexistant `relay/source-review.legacy-<hash>.json` vers un fichier extérieur de même contenu : `applied true`, `est un lien true`. Après suppression de la cible : `copie lisible apres disparition false`.

Cause, packages/career-ops/review-migration.js:93-100 : O_EXCL renvoie EEXIST avant que O_NOFOLLOW ne serve, puis `readFileSync` suit le lien et compare les octets de la cible. `migratedFrom.copy` (ligne 136) désigne alors ce lien.

Le code contredit sa propre intention :
- la ligne 24 refuse les liens pour `relay` et pour le reçu ;
- le commentaire de la ligne 99 n'admet que la copie laissée par une exécution interrompue, or un lien n'en est pas une.

Aucune règle du propriétaire ne rend ce comportement voulu. Il ne s'agit pas d'un garde-fou de parcours navigateur : c'est un outil de migration, et CLAUDE.md maintient la robustesse technique et les chemins confinés.

Limites qui confirment la gravité « mineur » :
- Aucun code du dépôt ne crée ce lien : il faudrait le poser à la main ou par un agent, sous le nom exact portant le hash. Le dossier relay/ réel ne contient aucun fichier `legacy-*`.
- Rien n'est écrit à travers le lien.
- La perte annoncée est partielle : seuls les octets exacts de l'ancien reçu disparaissent. Le nouveau reçu conserve les mêmes empreintes, puisque le plan exige un écart nul, ainsi que le sha256 de l'ancien (`migratedFrom.sha256`).

Correction testée sur une copie dans le dossier temporaire, sans toucher au dépôt, avec `/private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/eaada6f6-c1bd-483c-9236-0431b9cff39a/scratchpad/check-fix.mjs` :
- lien : refus EEXIST, reçu intact ;
- copie d'une exécution interrompue : `applied true` ;
- aucune copie : `applied true`.

La suite `tests/career-review-migrate.test.js` n'a pas été relancée avec cette correction.
  - Correction : packages/career-ops/review-migration.js:100 : `if (error.code === 'EEXIST' && lstatSync(path).isFile() && readFileSync(path).equals(bytes)) return;`. `lstatSync` est déjà importé. Un lien ne satisfait pas `isFile()` et l'erreur EEXIST est relancée, avant toute écriture du nouveau reçu.
- RÉFUTÉ : Le mécanisme est exact, mais le scénario n'est pas un défaut réel, donc constat réfuté. Le blocage se reproduit sur un dépôt fictif : avec un FIFO comme reçu, `node scripts/career-review-migrate.js --root <fictif>` reste bloqué à review-migration.js:32. Trois éléments retirent sa portée.

1. Aucun parcours ne produit cette entrée. Le seul écrivain du reçu dans le code est `writeConfined` (integration.js:39), plus la migration elle-même via renameSync. `git grep mkfifo|isFIFO` ne trouve rien dans packages, scripts et tests. Il faudrait que le propriétaire, seul gestionnaire de l'application selon CLAUDE.md, crée lui-même un FIFO dans sa bibliothèque : c'est une entrée fabriquée pour le test, sans cas d'usage.

2. L'effet est nul et réversible. La commande est lancée à la main, à sec par défaut, et rien n'est écrit avant la ligne 32. En test, le processus bloqué s'est arrêté dès SIGINT (code -2, Ctrl-C équivalent) et `relay/` n'a pas changé. Aucun service ni workflow n'appelle ce module : seuls scripts/career-review-migrate.js et les tests l'importent. La règle « outil figé arrêté » ne s'applique donc pas à une commande manuelle au premier plan.

3. Le résultat attendu ne correspond pas au code du dépôt. Le lecteur de référence `readConfined` (policy-engine/files.js:62) fait lui aussi `openSync` sans O_NONBLOCK et ne teste `isFile()` qu'après l'ouverture, donc il bloquerait aussi sur un FIFO sans écrivain. Le remplacer ici n'apporterait pas l'erreur immédiate annoncée.

Le grief sur la taille reste spéculatif : le reçu est généré par la plateforme (414 entrées selon le rapport astra-01), et aucun scénario concret ni résultat erroné n'est donné.
- CONFIRMÉ : Réfutation échouée sur les faits, avec une réserve sur la justification du constat.

Ce qui est confirmé :
- packages/career-ops/review-migration.js:34 lance `git status --porcelain --untracked-files=no` sans `--no-optional-locks`.
- Reproduit avec `planReviewMigration` sur un dépôt fictif, après un changement de mtime d'un fichier suivi dont le contenu reste identique : `applicable true`, mtime de .git/index modifiée, octets modifiés. Sur un dépôt sans changement, seule la mtime de l'index a changé, pas ses octets.
- Avec un dépôt fictif équivalent, `git status` simple modifie l'index, alors que `git --no-optional-locks status` le laisse inchangé.
- scripts/career-review-migrate.js:3 annonce « no write outside relay/ » et review-migration.js:27 « Measures only » : ces promesses sont fausses pour .git/index.
- tests/career-review-migrate.test.js:43 ne contrôle que relay/ et le reçu.
- Aucune règle du propriétaire ne rend ce comportement voulu. La règle d'automatisation du navigateur de CLAUDE.md ne s'applique pas à cette commande.

Ce qui doit être corrigé dans le constat :
- Je n'ai pas trouvé d'« exigence du propriétaire » interdisant d'écrire dans .git/index. Le brief suite-astra-02 (ligne 20) et la mémoire de la règle career-ops protègent seulement les fichiers suivis, et .git/index n'en est pas un. Mes recherches dans MISSION, PLAN, HANDOFF, AGENTS et le rapport suite-astra-01 n'ont rien donné de plus.
- Le seul engagement enfreint est donc le commentaire du script, écrit par la plateforme.

Portée : le défaut reste mineur. Le plan calculé est juste, aucun fichier de code n'est touché, et l'écriture se limite au cache d'index que tout `git status` rafraîchit. Le fichier relay/ n'est pas concerné. Le mode --apply passe par le même code (ligne 117), mais il écrit déjà dans relay/ et l'écart n'y change rien d'utile.
  - Correction : Dans packages/career-ops/review-migration.js:34, remplacer par `git(root, '--no-optional-locks', 'status', '--porcelain', '--untracked-files=no')`. Le helper place `-C root` avant les arguments, donc l'option globale reste bien avant la sous-commande. Ajouter au test « à sec » une comparaison de la mtime et des octets de .git/index avant et après, après avoir changé la mtime d'un fichier suivi.
- RÉFUTÉ : Le blocage est réel, mais je le classe comme réfuté, car rien dans le produit ne peut produire ce scénario. Ce classement relève du jugement : aucun test ne montre le contraire.

Ce que j'ai reproduit sur un dépôt fictif, avec un FIFO sans écrivain à `relay/source-review.json` :
- `planReviewMigration` reste figé (status null, SIGTERM à 5 s).
- `node scripts/career-review-migrate.js --root ...` aussi, sans aucune sortie.
- Le résumé est donc exact sur les faits : `review-migration.js:24` ne teste que `isSymbolicLink()`, `review-migration.js:32` lit sans limite de taille.

Pourquoi ce n'est pas un défaut concret :
1. **Entrée impossible par le code :** `grep mkfifo` ne trouve rien dans packages, scripts et apps. Le reçu n'est écrit que par `writeConfined` (`integration.js:39`, `files.js:39-57`), qui fait un renommage atomique d'un fichier régulier. Il faudrait qu'un processus du même utilisateur crée délibérément ce FIFO, et `files.js:18-19` exclut ce cas du modèle de menace.
2. **Seul type de fichier concerné :** je n'ai testé que le FIFO. Le blocage décrit ne vise que lui, car un répertoire donne une erreur en principe et créer un périphérique demande root (non testé).
3. **Portée limitée :** le module n'est importé que par `scripts/career-review-migrate.js` et son test. Aucun script npm, brief, API ou agent ne lance cette commande, qui se lance donc à la main. Elle n'a rien écrit à ce stade, puisque le blocage survient avant toute écriture et que Ctrl-C suffit. La règle « outil figé arrêté » du propriétaire vise les outils des parcours d'exécution, pas ce cas.
4. **« Attendu » non fondé :** l'erreur immédiate `reçu non régulier` n'existe pas non plus dans le lecteur de référence. `readConfined` fige lui aussi sur le même FIFO (reproduit, SIGTERM à 5 s), parce que `openSync` sans `O_NONBLOCK` (`files.js:62`) bloque avant le `isFile()` de la ligne 65.
5. **Taille :** aucun résultat erroné n'est démontré. Le reçu est produit localement et petit, et je n'ai pas testé de reçu géant.

**À savoir si le sujet est repris un jour :** `readConfined` est aussi utilisé sur ce reçu à `tools.js:172` et `tools.js:233`. Un tel FIFO figerait donc ces chemins aussi, et non la seule commande de migration. L'ouverture avec `O_NONBLOCK` rend bien la main et `fstat` indique `isFIFO` (testé en isolation, pas intégré au code). Si ce point devait être corrigé, c'est dans `readConfined`, sous la même condition irréaliste.

Rien n'a été modifié dans le dépôt : mes scripts et le dépôt fictif sont dans le dossier temporaire.
- CONFIRMÉ : Constat non réfuté : je l'ai reproduit sur des dépôts fictifs, avec `planReviewMigration` réel (git 2.39.5).

**Reproduction**
- Fichier suivi avec mtime changée et contenu identique : `applicable: true`, `trackedChanges: []`, octets et mtime de `.git/index` modifiés, fichier de code inchangé.
- Sans changement de mtime, mais juste après le commit : seule la mtime de l'index a changé, les octets non.
- Contre-essai avec `git status` seul sur le même scénario : octets et mtime changent.
- Contre-essai avec `git --no-optional-locks status` : sortie identique (vide), ni les octets ni la mtime ne changent.

**Code**
- `packages/career-ops/review-migration.js:34` appelle bien `git status` sans cette option.
- Le commentaire de la ligne 27 annonce « Measures only ».
- `scripts/career-review-migrate.js:3` annonce « no write outside relay/ ». Ces deux affirmations sont fausses pour le chemin à sec.
- Le test `tests/career-review-migrate.test.js:43` ne contrôle que `relay/` et le reçu, donc il ne peut pas voir cette écriture.

**Réserve sur le constat**
- « L'exigence du propriétaire » n'est pas établie telle quelle. Le brief `.manager/briefs/suite-astra-02.md:20` protège les « fichiers suivis » de la bibliothèque, et `.git/index` n'en est pas un.
- Le défaut réel est donc l'écart entre la promesse du code et son comportement, sans dommage sur les fichiers. La gravité « mineur » convient.
- Aucune règle du propriétaire ne rend cette écriture voulue.
  - Correction : `packages/career-ops/review-migration.js:34` : `git(root, '--no-optional-locks', 'status', '--porcelain', '--untracked-files=no')`. Ajouter au test « à sec » une comparaison des octets et de la mtime de `.git/index` avant et après, avec un fichier suivi dont la mtime a changé.
- CONFIRMÉ : Constat confirmé par le code, je n'ai pas réussi à le réfuter. Je n'ai rien exécuté : ni la sonde du constat ni une autre, tout vient de la lecture du code.

1. Le prompt ne regarde pas la cause de l'échec. La condition est seulement `attempt > 1` (packages/orchestrator/workflow-run.js:246-258). `attemptCheckpoint` fixe ensuite `effects:'unverified'` et le texte « a pu produire des effets » (packages/orchestrator/checkpoint.js:25-34).

2. Le cas sans effet est prouvé par la plateforme elle-même. `beforeEffect` marque l'erreur quand `scope.promptStarted` est faux et que le signal n'est pas annulé (workflow-run.js:88-94, 306). `scope.promptStarted` ne passe à vrai qu'à la ligne 265, juste avant `runtime.prompt`.

3. Deux chemins mènent à une tentative 2 après un échec sans effet :
- Relance automatique : pour une étape agent, non rejouable (workflow-engine/index.js:21-23), seul un échec `beforeEffect` peut atteindre la relance `attempt <= step.retries` (index.js:288-291). Tout autre échec passe à `uncertain`. Toute relance automatique d'une étape agent suit donc un échec sans effet, et reçoit quand même l'avertissement. Ce chemin suppose une étape agent avec `retries` > 0 : je n'en ai trouvé que dans le test tests/tour-reprise.test.js:226-236. Ma recherche de `retries` dans `packages` et `apps` n'en montre aucune déclarée en dur, et le schéma l'autorise (definition.js:19).
- Reprise explicite, accessible en production par POST resume (apps/api/server.js:362, puis orchestrator/index.js:685) : `recover` remet à `pending` une étape dont `output.beforeEffect === true` (index.js:108-124). `launch` incrémente alors `attempt` et remet `output` à null (index.js:245-251). La tentative 2 reçoit donc le checkpoint. C'est le cas d'un `runtime.start` ou d'un `mcpServerFor` en échec, suivi d'un clic sur Reprendre.

4. Aucun test ni commentaire ne présente ce comportement comme voulu. Le test « relancer une étape incertaine prévient l'agent » (tests/tour-reprise.test.js:253-284) couvre un échec après l'envoi du prompt, où l'avertissement est justifié. Le commentaire de checkpoint.js:24 parle d'un effet réel possible, sans viser le cas prouvé sans effet.

5. Aucune règle du propriétaire ne rend ce comportement voulu. CLAUDE.md demande un Bilan fidèle aux actions réelles et n'exige aucune consigne de ce type. L'avertissement est une affirmation fausse et une contrainte de plus sur la première tentative réelle.

Limite sur la portée : la conséquence reste mineure. L'agent fait une lecture de plus, et ne rend « non vérifié » que s'il ne peut pas lire. Le texte envoyé est tout de même inexact. La nuance du constat tient aussi : si une tentative antérieure a réellement envoyé un prompt, l'avertissement doit rester, d'où un correctif qui examine toutes les tentatives et pas seulement la dernière. `launch` efface `output`, donc ce fait ne peut pas y être conservé.
  - Correction : Dans l'exécuteur agent de packages/orchestrator/workflow-run.js, journaliser les tentatives prouvées sans effet, puis n'ajouter le checkpoint que si l'une des tentatives antérieures n'en fait pas partie. Ce sens est prudent : une tentative non marquée (ancienne donnée, annulation, crash) garde l'avertissement.

Dans le catch (ligne 305-306) :
```js
const failure = beforeEffect(error, scope, stepSignal);
if (failure.beforeEffect) orch.store.event(run.id, 'attempt_before_effect', { stepId: step.id, attempt });
throw failure;
```

Avant de construire le prompt :
```js
const stepEvents = orch.store.events(run.id);
const clean = new Set(stepEvents.filter((e) => e.type === 'attempt_before_effect' && e.data.stepId === step.id).map((e) => e.data.attempt));
const mayHaveEffects = Array.from({ length: attempt - 1 }, (_, i) => i + 1).some((n) => !clean.has(n));
```

Remplacer ensuite `attempt > 1 ?` par `mayHaveEffects ?` à la ligne 246. Pour `attempt === 1`, le tableau est vide et `mayHaveEffects` vaut faux, donc le comportement ne change pas.

Tests à ajouter dans tests/tour-reprise.test.js :
- échec de `mcpServerFor` au premier appel seulement, avec `retries:1` : pas de `checkpoint` à la tentative 2 ;
- tentative 1 avec prompt envoyé puis `uncertain` et retry, tentative 2 en échec sans effet, tentative 3 : `checkpoint` présent.
- CONFIRMÉ : Réfutation échouée : le constat est reproduit sur les deux chemins, avec une sonde fictive (fixture astra-acp qui renvoie le checkpoint reçu).

- Relance automatique (retries:1, mcpServerFor en échec au premier appel seulement) : étapes running:1 pending:1 running:2 succeeded:2. Aucun prompt n'est parti à la tentative 1, pourtant la tentative 2 reçoit previousAttempt=1, effects='unverified' et « a pu produire des effets ».
- Reprise explicite : après le premier échec, l'état est failed avec output={beforeEffect:true}. Une nouvelle exécution avec resumeWorkflow=true (ce que fait orchestrator/index.js:723, atteint par la route resume, apps/api/server.js:360-362) envoie le même message. La sonde n'a pas appelé la route HTTP, seulement execute() avec ce drapeau.

Cause : workflow-run.js:246 teste seulement `attempt > 1`. Or un échec survenu avant le prompt est marqué beforeEffect (workflow-run.js:89-93), et le moteur écrit que rien n'a été envoyé (workflow-engine/index.js:286), puis saute la décision « incertain » (index.js:112, 288).

Le prompt contredit donc ce que la plateforme sait déjà. Ce n'est pas un choix voulu :
- Le seul test du checkpoint après une vraie exécution (tests/tour-reprise.test.js:253-284) couvre un échec après l'envoi du prompt.
- La reprise beforeEffect (tests/tour-reprise.test.js:286) ne vérifie pas le checkpoint.
- Aucune règle de CLAUDE.md ne demande cet avertissement. « Bilan fidèle aux actions réelles » va plutôt dans le sens du constat.

Portée : défaut mineur. Le contenu faux du prompt est déterministe. L'effet sur la réponse dépend du modèle : lecture superflue, ou « non vérifié » sur une action jamais tentée. Je ne l'ai pas observé avec un vrai agent. La plateforme ne réutilise pas effects='unverified' ailleurs dans ce chemin.

Nuance du constat confirmée : si la tentative 1 a envoyé un prompt et que la tentative 2 échoue avant le sien, l'avertissement reste justifié à la tentative 3. Regarder seulement le dernier échec ne suffit donc pas ; launch remet d'ailleurs output à null (workflow-engine/index.js:251).

Aucun fichier du dépôt n'a été modifié ; la sonde est dans /private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/eaada6f6-c1bd-483c-9236-0431b9cff39a/scratchpad/probe.mjs.
  - Correction : Dans packages/orchestrator/workflow-run.js, tracer durablement l'envoi du prompt et conditionner le checkpoint à cette trace.

1. Juste avant `scope.promptStarted = true` (ligne 265), ajouter :
`orch.store.event(run.id, 'step_prompt_sent', { stepId: step.id, attempt });`

2. Avant de construire le prompt, calculer :
`const promptedBefore = orch.store.events(run.id).some((e) => e.type === 'step_prompt_sent' && e.data.stepId === step.id);`

3. Remplacer `attempt > 1 ?` (ligne 246) par `promptedBefore ?`.

La trace survit à la reprise explicite et couvre la nuance « prompt envoyé à une tentative antérieure ». Une étape déjà « incertaine » puis relancée garde son avertissement.

Tests à ajouter dans tests/tour-reprise.test.js :
- échec beforeEffect puis tentative 2 : pas de checkpoint ;
- prompt envoyé à la tentative 1, échec beforeEffect à la 2 : checkpoint présent à la 3.
- CONFIRMÉ : Constat non réfuté : je l'ai confirmé par le code et par une sonde FICTIVE avec le vrai moteur et le vrai registre.

**Code**
- `mkdirSync` et `exportTo` (`packages/orchestrator/workflow-run.js:149-158`) sont hors du `try` de la ligne 218. Seul ce `try` appelle `beforeEffect` (ligne 306), et `openAttempt` n'arrive qu'à la ligne 159.
- L'erreur remonte donc sans `beforeEffect` jusqu'à `packages/workflow-engine/index.js:288`. Une étape agent n'est jamais `replayable` (ligne 23), donc elle passe en `uncertain` (ligne 289). Les `retries` sont ignorés.
- `drive()` attend ensuite une décision (ligne 229) et le run reste en `running`. `Mission.tsx:408` affiche « L'effet de cette étape est incertain », alors qu'aucun processus agent n'existe.

**Sonde (étape agent avec `retries: 2`)**
- Skill absente du registre, vrai `exportTo` : `uncertain | attempt 1 | erreur: Skill inconnu | run: running`.
- `mkdirSync` en échec, un fichier occupant le chemin : `uncertain | attempt 1 | EEXIST | run: running`.

**Le comportement n'est pas voulu**
- Le commentaire de `beforeEffect` (`workflow-run.js:88`) et celui du moteur (`workflow-engine/index.js:286`) réservent `uncertain` aux cas où un effet a pu se produire.
- `tests/tour-reprise.test.js:198` impose déjà `failed` sans décision pour un échec équivalent avant prompt (MCP mal configuré).
- Aucune règle du propriétaire ne justifie cette attente. Le constat n'est pas l'absence d'un garde-fou : c'est une décision demandée à tort.

**Précision sur le message cité**
Pour une Skill modifiée entre le plan et l'étape, `exportTo` lève plutôt « Skill désactivé, non revu ou modifié » (`skill-registry/index.js:285`). En effet `resolve` relit le contenu juste avant le contrôle de la ligne 306, donc « Contenu modifié après résolution » ne survient que si le contenu change entre ces deux lectures. Le chemin et le résultat restent identiques. Une Skill désactivée en cours de run passe par le même `resolve` (ligne 284), d'après le code et sans sonde.

La gravité « mineur » convient : l'erreur va dans le sens prudent et l'utilisateur peut encore choisir `retry` ou `fail`.
  - Correction : Dans `packages/orchestrator/workflow-run.js`, envelopper les lignes 149-158 pour marquer l'échec comme survenu avant tout effet :

try {
  mkdirSync(cwd, { recursive: true, mode: 0o700 });
  if (plan.skills.length) orch.store.event(run.id, 'skills_exported', { ... });
} catch (error) {
  throw beforeEffect(error, { promptStarted: false }, stepSignal);
}

Le moteur applique alors les `retries`, puis `failed` avec `output: { beforeEffect: true }`, comme pour les autres échecs avant prompt. La correction n'a pas été appliquée (lecture seule).
- CONFIRMÉ : Constat confirmé, je n'ai pas pu le réfuter. Dans `packages/orchestrator/workflow-run.js`, `mkdirSync` et `exportTo` (lignes 149-158) sont hors du try de la ligne 218 et avant `openAttempt` (ligne 159). Leur erreur ne reçoit donc jamais `beforeEffect`. Une étape agent n'étant jamais `replayable` (`packages/workflow-engine/index.js:21-23`), la ligne 288 la passe en `uncertain`, sans utiliser les `retries`.

Sonde FICTIVE avec le vrai `createApp` et `execute`, sur une étape agent avec `retries: 2` :
- **Témoin, MCP qui lève :** failed, attempt 3, sortie `{"beforeEffect":true}`, run failed.
- **`exportTo` simulé qui lève « Contenu modifié après résolution » :** uncertain, attempt 1, 0 session agent, run toujours running.
- **`exportTo` réel, Skill inconnue :** uncertain, attempt 1, erreur « Skill inconnu », 0 session.
- **`mkdirSync` réel, EEXIST :** uncertain, attempt 1, 0 session.

Aucun agent n'a démarré dans ces trois cas, mais le run attend une décision et le front affiche « L'effet de cette étape est incertain » (`agregat-front/src/Mission.tsx:408`). Aucune règle du propriétaire ne rend ce comportement voulu. La règle « aucun processus ne doit rester bloqué » de `CLAUDE.md` va plutôt dans le sens du constat, et le test `tests/tour-reprise.test.js` attend déjà `failed` pour un échec MCP avant prompt.

Précision : le message exact « Contenu modifié après résolution » suppose une modification entre le `resolve` et le scan internes à `exportTo`, et je ne l'ai obtenu qu'avec un `exportTo` simulé. Le même chemin est atteint sans simulation par toute erreur de `resolve` (Skill inconnue testée ; désactivée ou modifiée d'après le code, non testé) et par `mkdirSync`.
  - Correction : Dans `packages/orchestrator/workflow-run.js`, envelopper les lignes 149-158 pour marquer l'échec comme survenu avant tout effet : `try { mkdirSync(...); if (plan.skills.length) orch.store.event(... exportTo ...); } catch (error) { throw beforeEffect(error, { promptStarted: false }, stepSignal); }`. L'étape suit alors `retries`, puis passe en `failed` avec `output.beforeEffect`, comme les autres échecs avant prompt.
- CONFIRMÉ : Constat confirmé par le code et par une simulation du moteur réel avec des exécuteurs fictifs. Défaut réel, mais mineur et limité à l'affichage.

Enchaînement vérifié :
1. `sponsors` (domain-packs/najah/manifest.yaml:109-117) est une étape tool optionnelle sans `effect`, donc `unknown` (definition.js:18), avec 0 retry. Si `connectMcp` échoue (délai de 15 s, packages/mcp-gateway/client.js:12), `promptStarted` est encore faux et l'erreur reçoit `beforeEffect=true` (workflow-run.js:89-94, 116).
2. Le moteur passe alors l'étape en `failed` avec `output: {beforeEffect:true}` (workflow-engine/index.js:288-298). tests/tour-reprise.test.js:207 fixe déjà cette valeur pour une étape agent.
3. Une dépendance optionnelle en `failed` est considérée comme satisfaite (index.js:189-191), donc `rank` démarre. `rank` n'est pas rejouable (tool, `unknown`). Une erreur après `promptStarted = true` (workflow-run.js:130-139) ne porte pas `beforeEffect`, et l'étape passe en `uncertain` (index.js:288-289).
4. L'API renvoie les lignes telles quelles (apps/api/server.js:234 via `steps()`), et `plan.workflow.steps` contient bien `dependsOn` (orchestrator/index.js:500-506).
5. La carte (agregat-front/src/Mission.tsx:389-422) filtre uniquement sur `p.output` et `dependsOn`, sans regarder l'état. `showOutput` n'a pas de `summary` et retombe sur `JSON.stringify` (Mission.tsx:204-209), ce qui affiche le bloc `{ "beforeEffect": true }` sous « Votre accord est requis ».

Simulation (WorkflowEngine réel, SQLite en mémoire, DAG de même forme, données FICTIVES) : search=succeeded, sponsors=failed avec output `{"beforeEffect":true}`, rank=uncertain avec output null. Le filtre de la carte, reproduit à l'identique, retient `['search', 'sponsors']`. Le rendu React lui-même n'a pas été exécuté.

Aucune règle du propriétaire ne rend ce comportement voulu : il s'agit d'un marqueur interne affiché à tort, pas d'un garde-fou.

Portée : il faut deux pannes dans le même run (connexion ratée pour `sponsors`, puis échec de `rank` après le début de l'appel). Dans les DAG najah, seul ce chemin a une dépendance optionnelle sous une étape pouvant passer en `uncertain` ou en approbation. `application-draft` ne l'atteint pas, car `draft` n'est pas optionnel. Le marqueur reste aussi dans `inputs.sponsors` de `rank`, sans effet : `$from: sponsors.results` donne `undefined` comme avec `null`.
  - Correction : Correction minimale côté front, dans agregat-front/src/Mission.tsx:413 : remplacer le filtre `p.output && ...` par `p.state === "succeeded" && p.output && ...`. Seules les sorties d'étapes réussies sont alors affichées, et le signal lu par `recover` (workflow-engine/index.js:112) reste inchangé. Le test tests/tour-reprise.test.js:207 reste donc valable.
