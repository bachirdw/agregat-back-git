# Rapport fix-browser-01

## Journal
- 20:09 — Lecture de `AGENTS.md`, du brief et de `_audit-common.md`; `git status --short` vide, dernier commit `637cfd1`. Aucun rapport de passation préexistant. Périmètre : rendre visible le repli sans changer son comportement. Fichiers touchés : ce rapport et dossier de preuves.

## Décisions et état
- En cours. Aucun appel Gemini, mission réelle ou site réel prévu.
- 20:10 — Lecture ciblée de `cdp.js`, du relais MCP, de la route interne API, de l’orchestrateur, des tests propriétaire et de l’architecture. Décision : événement enregistré côté API avec déduplication par run, message public fixe sans URL ; notification du MCP en `finally`, y compris si l’appel navigateur échoue. Le comportement de lancement du repli reste inchangé.
- 20:11 — `npm test` de référence lancé, preuve `fix-browser-01-evidence/baseline-test.log`. Code 1 : phase non Chrome 323 tests, 322 réussites, 1 ignoré ; phase Chrome 129 tests, 61 réussites, 68 échecs dus à `SIGABRT` et `kill EPERM` dans le bac à sable. Aucun changement du code pendant la phase Chrome. La sortie très longue reste dans le fichier de preuve.
- 20:11 — Création des tests fictifs d’événement et de résumé. Premier lancement `node --test tests/fix-browser.test.js` interrompu (code 130) : le teardown avait laissé une entrée `engine.active`, et `engine.close()` attendait sa suppression. Correction du teardown, sans changement produit.
- 20:12 — Test rouge `node --test tests/fix-browser.test.js` : code 1, 2 échecs attendus (route absente : HTTP 404 ; résumé sans ligne navigateur), 1 réussite. Preuve `fix-browser-01-evidence/red.log`.
- 20:13 — Modifications `apps/api/server.js`, `packages/mcp-gateway/server.js`, `packages/orchestrator/index.js`, `docs/architecture.md` et tests. Test vert initial : code 0, 3/3 réussis (`green.log`). Séparation des tests par point : code 0, 3/3 (`green-split.log`). Extension du test d’intégration Chrome existant : vérification d’un seul événement pour deux outils et de la ligne finale ; exécution réelle à confirmer hors bac à sable.

## Décisions et état
- Événement `browser_fallback` : `run`, motif public constant, `connected: false`. Déduplication à la réception : plusieurs appels ou relais MCP recréés ne multiplient pas l’événement. La raison technique brute reste seulement dans les preuves existantes ; elle peut contenir une URL et n’est pas reprise dans l’événement.
- Résumé ajouté à la fin du traitement, après éventuelle synthèse privée de career-ops, pour conserver une information exacte sur le navigateur utilisé.
- Reste : contrôles de format et vérification, commits atomiques, suite complète sans Chrome, rapport final.
- 20:14 — `npm run check` code 0, `npm run format:check` code 0, tests ciblés 3/3 code 0 (`check-1.log`, `format-1.log`, `tests-1.log`). `prettier --write` code 0 sur quatre fichiers après un premier `format:check` code 1 (`format-precommit.log`).
- 20:14 — Première tentative `git add ... && git commit ...` : code 128, création de `.git/index.lock` refusée par le bac à sable (`Operation not permitted`). Aucun commit créé ; demande d’exécution avec élévation pour l’écriture Git locale.
- 20:14 — Commit local du point 1 créé avec élévation Git : `8c36d33` (`apps/api/server.js`, `packages/mcp-gateway/server.js`, test événement). Aucune écriture hors index/commit Git ni push.
- 20:15 — Contrôles avant point 2 : `npm run check` code 0, `npm run format:check` code 0, tests ciblés 3/3 code 0 (`check-2.log`, `format-2.log`, `tests-2.log`). Commit local `34df647` : résumé conditionnel et assertions Chrome d’intégration. Les assertions Chrome restent non vérifiées dans ce bac à sable.
- 20:17 — Suite complète finale `CHROME_PATH=/nonexistent npm test` : code 0. Phase non Chrome : 326 tests, 325 réussis, 1 ignoré, 0 échec. Phase Chrome : 117 tests, 58 réussis, 59 ignorés, 0 échec. Preuve `fix-browser-01-evidence/final-no-chrome.log`. Cette preuve est **sans Chrome** : l’intégration de lancement réel et les assertions ajoutées à `owner-browser.test.js` devront être relancées hors bac à sable par le manager.

## État final et points manager
- **Opérationnel (sans Chrome)** : route interne d’événement unique et motif public, résumé conditionnel, documentation du provider. Preuve : tests ciblés 3/3 et suite sans Chrome verte.
- **Non vérifié ici** : lancement du Chrome isolé réel après relais absent ; le bac à sable provoque `SIGABRT`/`kill EPERM` (preuve baseline). Le test d’intégration enrichi est prêt pour le contrôle du manager.
- Alternative rejetée : republier `fallbackReason` brut dans l’événement ; ce texte peut contenir une URL privée. L’événement émet un motif fixe tandis que les preuves existantes conservent le détail technique.
- Aucun appel Gemini, mission réelle, site réel, push ou changement de comportement du repli. Aucun serveur propriétaire existant touché.
- Reste : contrôles avant dernier commit, commit documentation et rapport ; contrôle Chrome hors bac à sable par le manager.
- 20:18 — Contrôles avant documentation : `npm run check` code 0, `npm run format:check` code 0, tests ciblés 3/3 code 0, `git diff --check` code 0 (`check-3.log`, `format-3.log`, `tests-3.log`). Commit local `6e6fdb1` : une phrase d’architecture.

## Commits
- `8c36d33` — événement `browser_fallback` par run.
- `34df647` — résumé final conditionnel et test d’intégration Chrome.
- `6e6fdb1` — documentation des deux providers.
