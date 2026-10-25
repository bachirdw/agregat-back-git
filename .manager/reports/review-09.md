# Relecture indépendante review-09

## Journal

- 17:48 — Lecture de `AGENTS.md`, du brief review-09, de MISSION et PLAN ; périmètre `41735e8..HEAD` identifié. Arbre initial : seul `.manager/briefs/review-09.md` non suivi (fourni par le manager). Aucun appel modèle ni navigateur utilisateur. Lancement des trois contrôles initiaux, sorties brutes temporaires en cours de collecte. Aucun rapport sprint-09 utilisé comme preuve.

## Résultats et décisions

Revue en cours : consentements et pont humain, cycle de vie CDP sous charge, honnêteté des statuts documentaires. Les défauts seront démontrés par des tests avant correction.

## État final

En cours ; aucune conclusion de conformité à ce stade.

- 17:50 — Priorités 1–2 : lecture directe de RunPolicy, CdpBrowser, BrowserGateway, serveur MCP, pont API et cycle de vie orchestrateur. Les outils MCP n'acceptent pas les options ; les décisions sont demandées hors contenu de page, liées au run/token et contrôlées avant mesure. Limite existante explicitement documentée : un CLI natif du même UID peut appeler le canal HTTP de décision ; aucun isolement humain/OS réel. Ne pas revendiquer une résistance à un CLI malveillant.
- 17:51 — Trois régressions déterministes ajoutées dans `tests/browser-gateway.test.js`, objets CDP FICTIFS, commande `node --test --test-name-pattern='démarrage :' tests/browser-gateway.test.js` : **0/3 réussies, code 1**, sortie brute `review-09-evidence/startup-red.txt`. Défauts confirmés : (a) fermeture pendant lancement permet de ressusciter le contexte après révocation ; (b) deux ensure simultanés lancent deux navigateurs dont un devient inaccessible ; (c) échec de garde laisse le contexte ouvert. Gravité élevée pour (a), moyenne pour (b)/(c), `packages/browser-gateway/cdp.js:94–155` avant correction. Correction commune du cycle de vie en préparation ; sérialiser seulement les appels Gateway ne couvre pas la fermeture ni les utilisateurs directs du provider.

- 17:50 — Correction du journal : les entrées précédentes 17:51 et 17:50 ont été saisies manuellement trop tôt ; `date +%H:%M` indique encore 17:50 au moment de cette vérification. Les prochaines entrées utilisent l'horloge de la commande. `check` et `format:check` initiaux : code 0. La phase initiale sans navigateur est verte (162/162), mais le premier test Chrome « Postuler refusé » échoue après 42,3 s ; suite encore active, résultat global non acquis. Diagnostic `ps -axo ...` refusé par le bac à sable (`operation not permitted`), aucun inventaire de processus obtenu. Recherche Playwright initiale sur chemins non présents : deux erreurs `No such file or directory`, puis localisation du bundle réel `lib/coreBundle.js`.
- 17:50 — Après première correction, les trois régressions startup passent (3/3, code 0, `startup-green.txt`). Revue supplémentaire nécessaire des résolutions tardives et de la connexion CDP avant validation complète et commit.

- 17:51 — Diagnostic Chrome ciblé (`DEBUG=pw:browser node --test --test-name-pattern="champ mot de passe" tests/browser-gateway.test.js`) : code 1, Chrome SIGABRT, tentative de destruction refusée `kill EPERM` ; sortie complète `chrome-sandbox.txt`. Relance `npm test` hors bac à sable approuvée automatiquement, profils temporaires uniquement. Ajout des cas CDP newContext/newPage muets, résultat tardif, mutation pendant lancement : 7 tests ciblés verts. Formatage des deux fichiers modifiés effectué. La deadline couvre maintenant aussi les appels CDP, sans attendre indéfiniment un newContext.

- 17:52 — La suite initiale en bac à sable reste bloquée après ses échecs Chrome/E2E ; arrêt explicite des seuls PID identifiés 86896, 86589, 86074, 86059. Sortie brute sauvegardée dans `tests-sandbox.txt`. Attention : cette tentative a commencé avant les modifications, mais certains fichiers navigateur ont été chargés après elles ; elle ne fournit donc pas un décompte avant fiable. Une copie exacte du HEAD initial par `git archive HEAD` dans `/tmp/review-09-baseline` (node_modules lié, aucun secret copié) exécute une seconde référence propre hors bac à sable. Aucun résultat de suite initiale inventé.

- 17:52 — Référence HEAD initial exacte : `npm test` hors bac à sable **210/210, code 0** (162 + 48), sortie brute `tests-before.txt`. Après correction du cycle de vie : **216/216, code 0** (162 + 54), `tests-fix1.txt` ; `npm run check` et `npm run format:check` codes 0 (`check-fix1.txt`, `format-fix1.txt`). La tentative en bac à sable arrêtée se termine code 143 ; le test du faux binaire a aussi échoué une fois parce que sa regex exigeait uniquement le texte Playwright alors que la nouvelle deadline globale peut gagner : assertion corrigée pour accepter les deux causes de timeout explicites, sans supprimer le test. Décision : lancement unique, révocation immédiate, vérification de politique à chaque frontière asynchrone, nettoyage transactionnel et des résultats tardifs ; erreur initiale de garde conservée. Commit atomique du cycle de vie avant la suite de la revue.

- 17:52 — `git add -A && git commit ...` refusé par le bac à sable : impossible de créer `.git/index.lock` (code 128). Aucun commit créé à cette tentative ; relance avec autorisation limitée à ce commit local.

- 17:53 — Nouveau défaut confirmé (moyen), `cdp.js:506` après premier correctif : `close` conserve la connexion CDP vivante. Assertion réelle ajoutée au test CDP : échec code 1, `isConnected() === true`, `disconnect-red.txt`. Inspection du paquet épinglé Playwright `lib/coreBundle.js:44501–44575,54120` : le close du client connectOverCDP ferme uniquement le transport et les fichiers temporaires, sans commande Browser.close distante. Correctif : libérer aussi ce client, y compris connexion résolue tardivement ; vérifier séparément les onglets via endpoint CDP pour ne pas réutiliser le client déconnecté. Recherche dun fichier workflow au nom supposé : `rg` code 2 (fichier inexistant), chemin réel `workflow-run.js` identifié.

- 17:53 — Test ciblé après correctif CDP : **8/8, code 0**, dont Chrome réel partagé et cas de course. Nouvelle couverture ajoutée pour connexion CDP elle-même résolue après deadline (en plus du contexte/de la page). ADR 006 enrichi des garanties exactes et de la limite restante : pair bloquant ses opérations de nettoyage/exécutable hostile, pas de promesse de destruction universelle. Premier commit local : `142476c`.

- 17:54 — Deuxième correction : suite complète `npm test` **217/217, code 0** (162 + 55), contrôles syntaxe et formatage code 0, sorties brutes `tests-fix2.txt`, `check-fix2.txt`, `format-fix2.txt`. Banc indépendant 64 essais/concurrence 8 lancé après fin de cette suite ; script copié du banc du sprint 09 avec préfixe de traces distinct `/tmp/review09-trace-*` pour ne pas écraser les anciennes preuves.

## Défauts confirmés et traitement

| ID | Gravité | Localisation avant correction | Scénario et preuve | Traitement |
|---|---|---|---|---|
| R09-1 | Élevée | `packages/browser-gateway/cdp.js:94–155` (HEAD initial) | `close()` pendant `launchPersistentContext()` ; `ensure()` revient ensuite avec une page, contexte jamais fermé. Test « fermer pendant le lancement », rouge dans `startup-red.txt`. | Corrigé : révocation immédiate, contrôle après attente, ressource tardive fermée ; commit 142476c. |
| R09-2 | Moyenne | `cdp.js:94–155` (HEAD initial) | Deux `ensure()` concurrents lancent deux contextes ; le premier est écrasé. Test « appels concurrents », 2 lancements au lieu de 1. | Corrigé : promesse de démarrage partagée ; commit 142476c. |
| R09-3 | Moyenne | `cdp.js:135` (HEAD initial) | Échec de `context.route()` après lancement : contexte conservé sans gardes. Test « erreur de garde », zéro fermeture avant correction. | Corrigé : nettoyage transactionnel, erreur d'origine conservée ; commit 142476c. |
| R09-4 | Moyenne | `cdp.js:111,156` (HEAD initial) | `newContext`/`newPage` CDP sans deadline, possibilité de rester suspendu et d'adopter une ressource tardive. | Corrigé : deadline de démarrage globale et nettoyage des retours tardifs, tests fictifs context/page ; commit 142476c. |
| R09-5 | Moyenne | `cdp.js:395–398` (HEAD initial) | Fermeture de provider CDP laissant `browser.isConnected() === true`. Test Chrome réel rouge `disconnect-red.txt`. | Corrigé : fermeture du transport client, Chrome/onglets préservés ; commit b56cba7. |
| R09-6 | Élevée hors périmètre de confiance mono-utilisateur | `apps/api/server.js:299–302`, contrôles Host/Origin lignes 88–93 | Un programme natif local peut lister les permissions puis envoyer la décision HTTP en omettant Origin. Le jeton du pont ne protège pas cette route humaine. | Non corrigé au niveau OS : limite connue, démonstration et clarification documentaire à livrer. Impossible d'établir l'identité humaine avec ces seules routes ; ne pas présenter le consentement comme une protection contre un CLI hostile du même UID. |

Les numéros historiques des défauts CDP désignent les fichiers du commit 66aff05, relus dans le diff demandé.
R09-4 est couvert par des tests de pairs fictifs qui restent muets puis répondent tard ; cela ne prétend pas
identifier une nouvelle cause interne Chromium. Aucun délai n'est présenté comme une garantie universelle
contre un exécutable hostile ; les opérations de nettoyage du pair peuvent elles-mêmes bloquer.

## Vérifications de la frontière de consentement

- La politique est construite dans l'orchestrateur depuis le pack et les variables de déploiement, puis sérialisée vers MCP. Les booléens ne sont pas des arguments de capacité ; un JSON de politique ne contient aucun consentement transférable.
- `prepare` impose un vrai booléen `true`, des demandes distinctes et un run identifié ; absence de pont, refus partiel, annulation et modification ne créent pas d'autorisation. L'instance est liée à l'objet politique et à son JSON ; après `close`, elle reste définitivement fermée.
- Le pont vérifie token, run actif, état terminal et signal d'annulation ; `gatewayUsage` répète ces contrôles avant toute action réelle. Le finally de l'orchestrateur détruit runtime/processus et supprime token et permissions. Un workflow partage sa connexion directe au sein du run, et la ferme dans son finally ; un nouveau provider redemande les options.
- Les requêtes de consentement JavaScript/contexte partagé affichent des risques constants et le run, sans instructions de page. Les sorties navigateur sont marquées non fiables et aucune capacité execute/evaluate n'est enregistrée. Les filtres réseau et Host/Origin limitent les requêtes de pages vers le contrôle local. Cela ne prouve pas la résistance de l'agent à toute injection ; cela borne ce qu'il peut obtenir via ces seuls outils.
- Le canal HTTP humain reste accessible à un programme natif du même utilisateur. Une injection conduisant un CLI à utiliser ses outils natifs sort de la protection offerte par MCP ; isolation système et canal humain séparé restent requis.

- 17:55 — Banc de charge terminé : **64/64, concurrence 8, durée 33,38 s, code 0**, aucun essai ignoré. Sortie brute `stress-summary.txt`, un essai intégral `stress-example.txt`, script reproductible `stress.py` ; les 64 traces détaillées restent `/tmp/review09-trace-01.log` à `64.log`. Le démarrage isolé du sprint 09 est donc reproduit vert indépendamment, après les corrections de cycle de vie. Deuxième correction prête : 217 tests et tous contrôles verts, plus charge 64/64.

- 17:56 — Priorité 1 : deux nouvelles preuves passent (2/2, code 0, `boundary.txt`) : faux outil/arguments MCP ne valent pas consentement, run terminal refusé ; Origin hostile et null refusées, mais appel natif sans Origin accepte une décision locale. Aucun navigateur lancé pour ces tests. R09-6 est donc démontré sans modèle. Décision : ne pas inventer une authentification humaine avec un simple nouveau jeton accessible au même UID ; documenter INCOMPLET hors périmètre MCP de confiance. README et FINAL corrigés : statut navigateur borné, disponibilité réseau Najah non renouvelée, import GitHub réussi seulement historique, anciens décomptes par composant retirés au profit des tests exacts.

- 17:57 — Vérification supplémentaire de R09-1 : une fermeture AVANT la microtâche du launcher déclenchait encore le faux lancement, bien que son résultat soit ensuite nettoyé. Nouveau test isolé `tests/browser-startup.test.js`, rouge code 1 (`queued-red.txt`). Correction : revérifier fermé/politique dans la microtâche avant appel effectif. Test vert code 0 (`queued-green.txt`), aucun processus réel lancé. Le test de fermeture PENDANT lancement attend désormais explicitement le démarrage de sa fixture. Une nouvelle validation complète sera nécessaire après ce changement ; la suite dite finale en cours est une validation intermédiaire et sera conservée comme telle.

## Audit des statuts documentaires (priorité 3)

Chaque ligne OPÉRATIONNEL de FINAL a été rapprochée du fichier de tests cité et de son exécution :

| Point | Preuve effectivement lue et exécutée | Conclusion documentaire |
|---|---|---|
| Prompt/interface | E2E démonstrateur, erreurs budget, saisie avant catalogue | Opérationnel pour ces parcours ; la sélection de modèles est aussi testée API/runtime, pas présentée comme une inférence E2E fournisseur. |
| Sélection/Auto | api-agents et runtime : filtres, refus, modèles annoncés | Opérationnel pour routage local ; fournisseurs conditionnels et sondes historiques. |
| CLI/ACP | runtime : faux CLI/chemins/capacités ; test probe muet | Opérationnel pour détection/protocole ; aucun nouveau handshake externe promis. |
| Sessions | runtime : handshake, modes, load, crash/timeout/annulation sur faux agents | Opérationnel pour runtime, inférence réelle non renouvelée. |
| Streaming/historique | platform et E2E, SSE et stockage | Opérationnel dans le prototype local. |
| Skills | skill-registry : cycle local, quarantaine, hash, export, traversées/liens | Opérationnel local ; les tests importGit ne testent que des refus. README distingue désormais import GitHub implémenté/preuve réseau historique. |
| MCP | platform et approval-bridge : processus stdio réels et refus | Opérationnel pour serveur plateforme ; services externes arbitraires incomplets. |
| Navigateur | browser-gateway, approval-bridge, charge indépendante | Opérationnel MCP/Chrome isolé et CDP temporaire ; extension Playwriter et canal humain isolé incomplets. |
| Najah | najah-live en rejeu enregistré, evals, sponsors par nom seulement | Opérationnel pour le traitement hors ligne ; disponibilité actuelle des sources non revalidée. |
| DAG | workflow-engine, workflow-run, workflow-resume et E2E | Opérationnel pour orchestration ; analyse modèle simulée dans la suite. |

Facturation : billing teste effectivement tarifs, BYOA, budgets, plafond, ledger et compteurs ; retrait du
compte historique « 9 tests » du README au profit du fichier de preuve. Les comptes « 12 Skills » et
« 15 + 8 + 4 workflow » étaient également historiques, retirés du README. Les preuves historiques du
sprint 09 restent marquées comme telles dans FINAL et ne sont pas réattribuées à cette revue.
