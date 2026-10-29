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
- 19:56 — Commit local du point 1 : `dcccf24`. Premier `git add -A && git commit` code 128 à cause de `.git/index.lock` interdit dans le bac à sable ; reprise avec permission étendue code 0, aucun push.
- 19:57 — Point 2 : `tests/fix-resume.test.js` reproduit `summary: ""` avec texte FICTIF utile ; rouge code 1 (3/4 réussites, `point2-red.log`). `packages/orchestrator/result.js` récupère la prose hors JSON, limite à 2 000 caractères et masque les secrets connus via `redact`. Le JSON seul à résumé vide reste refusé. Tests d’intégration et unitaires `tests/fix-resume.test.js tests/agent-result.test.js` verts, code 0 (12/12, `point2-green.log`).

## Décisions complémentaires
- Le résumé de secours vient uniquement de la prose hors bloc JSON ; recopier le JSON brut produirait un résumé inutile. Le résultat purement JSON avec `summary: ""` reste hors contrat faute de texte exploitable. Aucun garde-fou retiré.
- 19:57 — Pré-commit point 2 : `npm run check` code 0 ; `npm run format:check` code 1 (`packages/orchestrator/result.js`). Correction de format automatique ciblée avant de relancer les contrôles.
- 19:58 — Point 2 pré-commit : après formatage ciblé (`prettier` code 0), `npm run check` code 0, `npm run format:check` code 0, tests ciblés code 0 (12/12), `CHROME_PATH=/nonexistent npm test` code 0 (`point2-test.log`, dernier groupe 58 réussites, 59 ignorés sans Chrome). État : opérationnel sur faux agent ACP ; aucun test de modèle réel.
- 19:59 — Commit local du point 2 : `0d44702`. Point 3 : test de `careerFailureMessage` rouge, code 1 (2/3, `point3-red.log`) pour deux causes connues. Ajout de libellés constants dans `packages/orchestrator/failure.js`, sans recopier l’extrait privé ; test ciblé vert (3/3).
- 19:59 — Test intégré privé ajouté pour « Navigation non prouvée » : premier passage rouge, code 1 (`point3-green.log` écrasé ensuite). Diagnostic temporaire (`point3-diagnostic.log`) : espace temporaire sous lien `/var` → `/private/var`, donc « Espace de travail symbolique ou invalide » ; `realpathSync` corrige la fixture. Instrumentation temporaire retirée. Second passage vert, code 0 (4/4, `point3-green.log`). Aucune donnée réelle dans ces diagnostics.
- 20:00 — Pré-commit point 3 : `npm run check` code 0, `npm run format:check` code 1 sur `tests/career-failure.test.js` ; formatage ciblé requis et relance des gates.
- 20:03 — Point 3 pré-commit : formatage ciblé code 0 ; `npm run check` code 0 (`point3-check.log`), `npm run format:check` code 0 (`point3-format.log`), `node --test tests/career-failure.test.js` code 0 (4/4, `point3-green.log`), `CHROME_PATH=/nonexistent npm test` code 0 (`point3-test.log`, dernier groupe 58 réussites et 59 ignorés sans Chrome). `git diff --check` code 0. Aucun appel Gemini, aucune mission ni site réel, aucun serveur démarré par ces tests.

## État final
- **Opérationnel sur fixtures** : reprise ACP sans nouvelle navigation acceptée et signalée ; nouveau navigateur appelé sans preuves toujours refusé ; mission neuve sans navigation refusée.
- **Opérationnel sur fixtures** : résumé vide complété par la prose finale hors JSON, limitée à 2 000 caractères et expurgée des secrets connus. JSON seul avec résumé vide reste hors contrat.
- **Opérationnel sur fixtures** : causes « Navigation non prouvée » et « Réponse non structurée de l’agent » affichées pour les échecs privés sans extrait privé.
- **Non vérifié** : navigation Chrome réelle et modèle réel (interdits/indisponibles dans ce brief). Le manager peut relancer la suite avec Chrome hors bac à sable.

## Questions / reste
- Aucun point fonctionnel restant sur le brief. Contrôle du manager avec Chrome souhaité selon les règles communes.
