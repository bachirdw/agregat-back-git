# bilan-05 — E38 dans l'intent `pipeline`, E36 reste (« Nothing to merge into »)

Session cloud, branche `cloud/bilan-05` créée depuis `origin/dev` (91736e4). Heures UTC (`date`). Tout est FICTIF : aucune donnée personnelle, aucun secret, aucun envoi réel. Node du conteneur : v22.23.4 (le dépôt demande ≥ 24 ; rien n'a gêné). Fichiers réservés à `bilan-04` (`skill-router.js`, `tools.js`, `orchestrator/index.js`, section `search` du manifeste) : non touchés.

## Journal
- 05:42 — Branche créée, brief lu (texte de la session appelante, le fichier `.manager/briefs/bilan-05.md` n'est pas encore sur `dev`). `node_modules` absent du clone : `npm ci` (dépendances du dépôt, rien d'autre).
- 05:44 — **Point 1 (E38, intent `pipeline`)**. Tests rouges constatés (`tests/release-report-num.test.js`, 3 nouveaux tests : « étape release absente de pipeline »). Manifeste, intent `pipeline`, juste après `report` : étape `release` identique à celle d'`evaluate` (titre « Libérer le numéro du rapport », `career_script` / `reserve-report-num`, `args: ['--release','{###}']`, même précondition, même `done`, `optional: true`, `persists: true`, même commentaire), plus `unlessPhrases: [sans écrire, à sec, sans rien écrire]` comme les étapes `reserve`, `report`, `tsv`, `track` de cet intent (dispensée « à sec », retirée par « n'enregistre rien », exactement comme la réservation). `tests/skill-router.test.js` : liste d'étapes attendue de `pipeline` complétée par `release` ; la mission FICTIVE à trois entrées libère désormais chaque numéro (10 étapes faites, aucun écart d'ordre) — sans libération l'étape serait « ignorée », comme dans `evaluate`. Vert : release-report-num 10/10, skill-router, career-pipeline-flow, career-pipeline, career-integration, preuves-entre-tours, doubt-tools, mcp-contract, career-skill-suivi : 155 passés, 2 échecs connus (binaires Codex/Gemini). Commit 48fdc19.
- 05:47 — **Point 2 (E36 reste)**. Tests rouges constatés (`tests/truth-tool-names.test.js`, 3 nouveaux tests : `trackerSummary('No applications.md found. Nothing to merge into.')` rendait `null`, Bilan « fusion réussie, nombre de lignes non lu »). `packages/career-ops/truth.js` : `trackerSummary` reconnaît « Nothing to merge into » → `{ added: 0, updated: 0, reason: 'tableau de suivi absent' }` (lecture de la sortie du script, aucune règle métier) ; `recordGatewayTool` ne garde qu'un motif du vocabulaire de `truth.js` (jamais un texte libre venu de la route `tool-outcome`) ; `trackerRows()` ne rend le motif que tant qu'aucune ligne n'a été fusionnée sur le tour (le tableau créé puis une vraie fusion « +2 added » → « 2 lignes ajoutées, 0 mise à jour ») ; Bilan : « Suivi du Skill : rien fusionné (tableau de suivi absent) (merge-tracker). ». La passerelle passe par `gatewayProgress` → `callProgress` → `trackerSummary` : rien à changer dans `apps/api/server.js` ni `mcp-gateway`. Vert : truth-tool-names 6/6, career-skill-suivi, acp-replay-tracker, bilan-vs-events, career-truth, bilan-mixtes, career-integration, mcp-contract, release-report-num : 96 passés, 2 échecs connus. `npm run check`, `npm run format:check` verts. Commit faf473a.
- 05:48 — `npm test` complet lancé (Chrome présent : `/usr/bin/google-chrome`).
- 05:54 — `npm test` complet terminé sur faf473a (code 1) : voir le tableau. Les deux échecs `process-liveness` / `runtime` (petit-enfant ignorant SIGTERM) sont ceux déjà vus dans bilan-03 sur une base intacte : environnement du conteneur, pas ce chantier.
- 05:56 — `owner-browser.test.js` relancé seul avec un délai de 300 s : 42/42 verts (annulé dans la suite par le délai de fichier de 120 s, comme dans bilan-02 et bilan-03).

## Commandes et résultats
| Quoi | Résultat réel |
|---|---|
| Tests ciblés du point 1 (release-report-num, skill-router, career-pipeline-flow, career-pipeline, career-integration, preuves-entre-tours, doubt-tools, mcp-contract, career-skill-suivi) | 155 passés, 2 échecs connus (ACP Codex/Gemini, binaires absents) |
| Tests ciblés du point 2 (truth-tool-names, career-skill-suivi, acp-replay-tracker, bilan-vs-events, career-truth, bilan-mixtes, career-integration, mcp-contract, release-report-num) | 96 passés, 2 échecs connus |
| `npm test`, phase unitaires/intégration | 739 tests : 733 passés, 4 échecs (2 ACP connus + `process-liveness` « close : groupe qui ignore SIGTERM… » et `runtime` « sécurité : petit-enfant ignorant SIGTERM… », environnement), 2 skip |
| `npm test`, phase Chrome réel | 140 tests : 139 passés, 0 échec, 1 annulé (`owner-browser.test.js`, délai de fichier 120 s) |
| `owner-browser.test.js` seul, délai 300 s | 42/42 passés |
| `npm run check`, `npm run format:check` | verts à chaque commit |

## Pour le manager
**Vérifié (exécuté ici)**
- Point 1 : intent `pipeline`, étape `release` juste après `report`, même forme que dans `evaluate` (titre, outil, argument, `args`, `optional: true`, `persists: true`, comparée champ à champ en test) ; présente dans l'ordre envoyé à l'agent ; mission FICTIVE pipeline : réservation puis rapport sans libération → ligne « Étapes du Skill » contient « · Libérer le numéro du rapport (ignorée) », avec `--release` → « ✓ … (faite) », aucun écart d'ordre dans les deux cas ; « à sec » dispense l'étape, « n'enregistre rien » la retire (comme `reserve`).
- Point 2 : sortie exacte « No applications.md found. Nothing to merge into. » (code 0) par l'ACP comme par la passerelle → « Suivi du Skill : rien fusionné (tableau de suivi absent) (merge-tracker). » ; un motif inconnu venu de la route `tool-outcome` est ignoré (compte « 0 ligne ajoutée, 0 mise à jour », jamais un texte libre) ; tableau créé puis vraie fusion sur le même tour → les lignes comptent, le motif disparaît.
- `npm run check`, `npm run format:check`, suite complète (voir tableau).

**Non vérifié**
- Le texte « No applications.md found. Nothing to merge into. » vient du registre (E36, mission 05b34578) : le script `merge-tracker.mjs` du Skill n'est pas dans ce conteneur (bibliothèque non clonée). La reconnaissance se fait sur « Nothing to merge into » (insensible au reste de la phrase) ; si le Skill formule autrement, la ligne retombe sur « fusion réussie, nombre de lignes non lu », comme avant.
- Aucune mission réelle rejouée (pas de base du Mac ici) : à confirmer avec `bilan-vs-events.mjs` sur la prochaine mission sans tableau de suivi.
- Fichier `.manager/briefs/bilan-05.md` : absent de `origin/dev` au moment de la session, brief pris du texte de la session appelante.

**Écarts et décisions à trancher**
1. Point 1 : `unlessPhrases: [sans écrire, à sec, sans rien écrire]` ajoutées à `release` dans `pipeline` (pas dans le brief), par cohérence avec `reserve`, `report`, `tsv`, `track` de cet intent : sans elles, « à sec » aurait laissé une étape facultative « ignorée » alors que la réservation est dispensée. À confirmer.
2. Point 1 : `tests/skill-router.test.js` modifié (liste d'étapes attendue de `pipeline`, mission à trois entrées qui libère chaque numéro). Ce fichier de test n'est pas dans la liste réservée à `bilan-04`, mais `bilan-04` touche `skill-router.js` : conflit possible seulement sur ce test, à surveiller à la fusion.
3. Point 2 : le motif est affiché seulement tant qu'aucune ligne n'a été fusionnée sur le tour ; dès qu'un appel compte des lignes, seuls les comptes s'affichent. Choix de lecture, pas de règle métier.
4. Point 2 : « Nothing to merge into » à code 0 continue de prouver l'étape `track` (« suivi écrit », manifeste `proves`) : le routeur d'étapes n'est pas touché (fichier réservé à `bilan-04`), seul le Bilan dit « rien fusionné ». Si le manager veut que le suivi soit dit « non écrit » dans ce cas, c'est une suite distincte.
5. Node du conteneur v22.23.4 (dépôt : ≥ 24) ; rien n'a gêné.

## État final
Branche `cloud/bilan-05` : 48fdc19 (point 1), faf473a (point 2), puis ce rapport. Aucun push vers `dev` ni `main`, aucun merge.
