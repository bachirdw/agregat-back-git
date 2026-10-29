# fix-resume-01 — reprise, résumé et erreurs visibles

## Journal
- 19:52 — Lecture de `AGENTS.md`, du brief et des règles communes ; aucune passation préexistante, arbre Git propre, HEAD `cdd09e6`. Création du rapport et du dossier de preuves. Aucun appel modèle ni mission réelle prévus.

## Décisions et état
- En cours : localiser les contrôles du workflow navigateur et les tests ACP concernés. Les trois corrections seront testées rouge puis vert et commitées séparément.
- 19:54 — Point 1 : ajout d’un faux événement `browser.navigate` rejoué pendant `session/load` et d’un événement navigateur du tour courant dans `tests/fixtures/fake-acp.js`. Tests d’intégration dans `tests/fix-resume.test.js` : reprise sans navigation, reprise avec appel navigateur non prouvé et nouvelle mission sans navigation. `node --test tests/fix-resume.test.js` rouge (code 1, 1/3 échec attendu, `point1-red.log`). Premier correctif encore rouge (code 1, 1/3) : l’événement rejoué était compté comme appel courant ; correction en filtrant `promptStarted`. Deuxième passage vert (code 0, 3/3, `point1-green.log`). `packages/orchestrator/index.js` distingue la réponse de reprise sans nouvelle navigation et conserve le contrôle des autres parcours.
- 19:54 — Gate de référence `CHROME_PATH=/nonexistent npm test` : code 0, 117 tests du dernier groupe dont 59 ignorés faute de Chrome (`baseline-test.log`). Aucun service payant appelé.

## Décisions
- Les événements `tool_call` de `session/load` sont historiques ; seuls ceux du prompt courant comptent comme nouveaux appels. La réponse sans navigation garde le texte et indique explicitement son statut dans le résumé et la provenance.
- 19:55 — Pré-commit point 1 : `npm run check` code 0 (`point1-check.log`), `npm run format:check` code 0 (`point1-format.log`), test ciblé code 0 (3/3), `CHROME_PATH=/nonexistent npm test` code 0 (`point1-test.log`, dernier groupe 58 réussites et 59 ignorés sans Chrome). État : opérationnel pour la reprise ACP fictive ; navigation réelle non vérifiée dans ce bac à sable.
- 19:55 — `git add -A && git commit` bloqué (code 128) : création de `.git/index.lock` refusée par le bac à sable (`Operation not permitted`). Demande d’exécution avec permission étendue pour le commit local, sans push.
