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
