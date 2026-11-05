# preuves-entre-tours-01 — Rapport (E35)

Sous-agent codeur (Opus), dossier `~/Downloads/agregat-back-astra`, branche `suite-astra`. Heures lues par `date +%H:%M`.

## 12:33 — Lecture
- Brief, `AGENTS.md`, `packages/orchestrator/index.js` (`create`, `execute`, boucle de question en JSON, `elicit`/`askProse`/`settleQuestion`/`answer`), `skill-router.js` (`SkillProgress`, `incomplete`), `career-ops/truth.js` (`createTurnTruth`), `browser-proof.js`, `apps/api/server.js` (routes `/answer`, `/resume`, `/api/internal/evidence`, `/api/internal/tool-outcome`), `agent-runtime` (élicitation), fixtures `fake-acp.js` et `career-agent.js`.
- **Constat de lecture, contraire au diagnostic du brief** : une réponse à une question ne relance pas `execute()`. Les deux voies de question restent dans le même appel : (1) le formulaire (élicitation ACP) est une requête de l'agent pendant le `session/prompt` en cours, la réponse du propriétaire résout cette requête et le même prompt continue ; (2) la question en JSON est traitée par la boucle `while (agentValue.question)` d'`execute()`, qui renvoie un nouveau `runtime.prompt` dans la même session **sans** passer par la remise à zéro des lignes 1059-1060 ni recréer `turnTruth` (créé une fois, ligne 788). `control.browserEvidence`, `turnTruth` et `skillProgress` couvrent donc déjà tous les tours de réponse d'une même exécution. Seule la **reprise** (`POST /api/runs/:id/resume` → `create(input, previous)`, nouvelle exécution, même session ACP) repart de zéro.

## 12:38-12:42 — Point 1 : test de bout en bout (rouge constaté)
- Fixture `tests/fixtures/career-agent.js`, branche `FICTIF_ENTRE_TOURS` : au tour 1, l'agent FICTIF poste `browser.navigate` puis `browser.snapshot` lisible d'une page FICTIVE (`https://jobs.example.test/entre-tours/42`) sur `RELAY_EVIDENCE_URL` avec le jeton reçu dans la configuration MCP de sa session (exactement ce que fait la passerelle réelle en mode propriétaire, `mcp-gateway/server.js:207-217`), écrit une ligne de suivi (`batch/tracker-additions/…tsv`, étape `tsv` du Skill), puis pose une question : en JSON (le tour 2 est un second prompt) ou par formulaire (`FORMULAIRE`). Après la réponse, note `career_offer_save` (3/5) sur la même URL, ou sur une URL jamais lue (`URL_JAMAIS_LUE`). Branche `FICTIF_ENTRE_TOURS_SUITE` : note dans une exécution de reprise.
- Test `tests/preuves-entre-tours.test.js` (7 cas, application en mode propriétaire, navigateur `fixture`, réponse par `POST /api/runs/:id/answer`).
- Résultat (`node --test --test-reporter=spec tests/preuves-entre-tours.test.js`) : **6 verts, 1 rouge**.
  - Verts dès l'état actuel du code : question en JSON et question par formulaire, même URL → `completed`, pas de « notée sans lecture », étapes `tsv` (tour 1) et `save-evaluation` (tour 2) `done`, Bilan « Actions réussies » avec `career_write` et `career_offer_save`, 0 contradiction « absent » de `bilan-vs-events` ; URL jamais lue → `failed` « Mission incomplète : 1 offre(s) notée(s) sans lecture de leur page » (contrôle exercé).
  - **Rouge** : `E35 FICTIF, reprise de la même mission : la page lue avant la reprise couvre la note` — ligne d'échec : `AssertionError [ERR_ASSERTION]: Mission incomplète : 1 offre(s) notée(s) sans lecture de leur page` (`actual: 'failed', expected: 'completed'`).
- `npm run check` vert ; `npm run format:check` vert.
- **Vérifié** : le défaut de preuves entre tours existe pour la reprise d'une mission (nouvelle exécution), pas pour les tours de réponse à une question.
- **Écart avec le brief** : le brief attribue l'échec de 05b34578 à la remise à zéro par tour de question ; ce chemin est déjà tenu (test vert). Voir la section « Cause probable de 05b34578 » plus bas.

## 12:43-12:50 — Point 2 : les preuves d'une mission passent à sa reprise
- Mécanisme générique (aucune règle métier, aucun nom de pack) :
  - `browser-proof.js` : `missionReads(evidence, limit = 400)` garde, des preuves d'une exécution, les navigations et les captures lisibles seulement, une fois par capacité et source, dans l'ordre, au format compact déjà public (origine + chemin, empreinte `sourceId`, fournisseur, `loading`, `readable`, heure) ; jamais de texte de page ni d'identifiant de tour.
  - `truth.js` : `createTurnTruth({ root, seed })` ; `seed.jdRead === true` reprend « annonce lue » d'une exécution précédente de la mission.
  - `index.js` (`execute`) : `inherited = store.get(previous.id).missionProof` (seulement quand l'exécution poursuit une mission : `create(input, previous)`) ; `turnTruth` amorcé avec `jdRead` ; `control.browserEvidence` amorcé avec les lectures héritées (marquées `inherited: true`) au lieu d'un tableau vide ; `browserEvidenceCapabilities` reste vidé (il dit ce que **cette** exécution a observé : la ligne « Notes non vérifiées » n'est pas changée). La mission enregistre `missionProof` `{ reads, sourceRead }` dans le même `store.update` que l'état final (succès et échec), avant toute attente, pour qu'une reprise immédiate la trouve ; un échec avant le prompt recopie l'héritage. Une mission neuve (`previous` nul) part de zéro.
  - Les tours de réponse à une question n'avaient besoin d'aucun changement (déjà dans la même exécution, voir 12:33).
  - Garde : `previous?.id` (les tests de `fix-resume` passent un `previous` sans identifiant).
- Tests ajoutés (`tests/preuves-entre-tours.test.js`, 10 cas au total) : reprise même URL → `completed` ; reprise URL jamais lue → « 1 offre(s) notée(s) sans lecture » ; mission neuve sans `previous` → contrôle exercé (aucun héritage) ; reprises en chaîne (tour 2 sans navigateur ni note, `missionProof` identique, tour 3 noté → `completed`) ; `missionReads` (filtre, doublons, aucun texte privé ni `turnId`, borne, entrée vide) ; `createTurnTruth` amorcé (`true` seulement, pas une chaîne).
- `SkillProgress` entre tours de question : un seul objet par exécution, `start()` appelé une fois avant le premier prompt ; vérifié par le test de bout en bout (étape `tsv` faite au tour 1 toujours `done`, `save-evaluation` faite au tour 2 `done`). Pas de changement de code. Entre exécutions (reprise), les étapes repartent « en attente » : non changé (voir écarts).

## Cause probable de 05b34578 (non vérifiée, à trancher par le manager)
- Les trois questions de 05b34578 étaient des **formulaires** (élicitation), donc toutes dans une seule exécution : le chemin couvert par les tests verts du point 1. La remise à zéro par tour ne peut pas expliquer l'échec.
- Seul fait lu dans l'espace du propriétaire (extraction ciblée de `relay/runs/05b34578…-result.json`, champs `provenance` et `verification` seulement, aucun contenu privé recopié) : `provenance.data = "navigateur réel"`. Ce champ n'est posé que si `verifiedBrowserVisit(control.browserEvidence)` est non vide (`index.js`, bloc career-ops) : au moins une navigation suivie d'une capture **lisible de la même URL** était bien dans les preuves à la fin. L'en-tête du rapport donne `**URL:** https://www.seek.com.au/job/95692808`.
- Hypothèses compatibles avec ce fait (dans l'ordre de probabilité) :
  1. la capture SEEK est arrivée avec `loading: true` (`cdp.js` `waitForReadablePage` : un élément visible `aria-busy="true"` ou un indicateur « Loading… » pendant les 8 s) → `readable: false` pour l'offre, tandis qu'une autre page (site carrières de l'employeur, recherche) a donné la paire lisible qui explique « navigateur réel » ;
  2. l'URL capturée (`page.url()` après chargement) diffère de l'URL notée par l'hôte ou le chemin (redirection SEEK, sous-domaine) : `pageKey` compare `hôte + chemin`.
- **À vérifier par le manager** dans les événements de 05b34578 (`.data`, interdit pour moi) : le `rawOutput` du ou des `browser_snapshot` / `browser_extract` sur seek.com.au — champs `url` et `loading`. `loading: true` → hypothèse 1 (le défaut est alors dans la lisibilité, pas dans les tours) ; `url` différente → hypothèse 2.

## 13:05 — Point 2 : tests et vérifications
- Ciblés, fichier par fichier (`node --test tests/<f>.test.js`) : elicitation 24/24, note-sans-lecture 8/8, fix-resume 22/22, owner-permissions 27/27, skill-router 38/38, bilan-vs-events 5/5, bilan-mixtes 3/3, career-failure 11/11, career-integration 44/44, preuves-entre-tours 10/10. `npm run check` vert, `npm run format:check` vert.
- Incident sans effet : un premier lancement groupé filtrait `# pass` alors que le rapporteur par défaut ici est `spec` (`ℹ pass`) : sortie vide, relancé fichier par fichier. `timeout` absent de macOS (sortie vide aussi, relancé sans).
- **Vérifié** : reprise d'une mission → la lecture d'avant compte, le contrôle reste exercé ; mission neuve → rien d'hérité.
- **Non vérifié** : suite complète (`npm test`, au manager) ; comportement en réel.

## 13:05 — Point 3 : Bilan d'une mission à question
- « Questions : n posée(s), n répondue(s) » : présent (boucle JSON). Pour les formulaires, la ligne n'est pas écrite (le compteur ne couvre que la question en JSON) : non changé, signalé en écart.
- « Actions réussies » couvre déjà tous les tours d'une exécution (un seul `turnTruth`) : vérifié de bout en bout (point 1 : `career_write` du tour 1 et `career_offer_save` du tour 2 au Bilan, 0 contradiction « absent » d'`analyseRun` sur les événements réels du test).
- Test unitaire ajouté dans `tests/bilan-vs-events.test.js` : mission à question, appels des deux tours au Bilan → 0 contradiction ; Bilan réduit au dernier tour → « career_write absent » signalé. 6/6 ; check et format verts.
- Aucun code de production changé à ce point.

## Écarts et points ouverts
1. Le diagnostic du brief (remise à zéro à chaque tour de question) est contredit par le code et par le test : les tours de question tiennent déjà. La cause réelle de 05b34578 reste à établir (section « Cause probable »).
2. Reprise : seules les **preuves de lecture** (pages lues, annonce lue) passent à l'exécution suivante. Le `turnTruth` complet (appels terminés, suivi, documents, boîte d'entrée) et les étapes du Skill ne passent pas : le Bilan d'une reprise décrit cette exécution, celui d'avant reste dans la mission précédente. À décider par le manager si le Bilan d'une reprise doit cumuler.
3. Sur une reprise sans navigation, `provenance.data` peut valoir « navigateur réel » et `evidence` contenir les paires héritées (marquées `inherited: true`) : c'est la provenance de la mission ; le texte « … dans ce tour » de `assessBrowserClaims` n'a pas été reformulé.
4. La ligne « Questions : … » n'existe pas pour les questions par formulaire.

## 13:06 — Point 4 : état final
- Commits : f3f32ec (point 1), 3c15233 (point 2), fc54d3d (point 3). Tests ciblés verts (compteurs aux sections 13:05). Check et format verts. Suite complète : au manager.
- État : tours de question **opérationnels** (déjà, prouvé) ; reprise **opérationnelle** pour les preuves de lecture (testé en FICTIF) ; cause réelle de 05b34578 **non établie**.

## 13:09 — Point 5 (demande du manager) : E1, offre lue après redirection vers un autre hôte — test rouge
- Cause réelle de 05b34578 donnée par le manager (réponses d'outil en base) : navigation demandée sur `www.seek.com.au/job/<n>`, redirection vers `au.seek.com/job/<n>`, capture lisible (`loading: false`) sur l'URL finale ; note sur l'URL demandée ; `pageKey` (hôte + chemin) ne rapproche pas les deux. Hypothèse 2 de la section « Cause probable » confirmée.
- Fixture `FICTIF_REDIRECTION` (career-agent) : la **vraie** `BrowserGateway` sur `FixturePageProvider` (redirection déjà prise en charge par le fournisseur : `pages[url].redirect`), page FICTIVE `https://www.exemple.test/offre/1` → `https://a.exemple.test/offre/1` ; sorties postées sur `RELAY_EVIDENCE_URL` comme `mcp-gateway/server.js` ; `browser.navigate` (URL demandée) puis `browser.snapshot` sans URL ; note sur l'URL demandée (ou `https://www.exemple.test/offre/2`, `AUTRE_CHEMIN`).
- Rouge constaté : `E1 FICTIF : une offre lue après redirection vers un autre hôte est lue pour sa note` — `AssertionError [ERR_ASSERTION]: Mission incomplète : 1 offre(s) notée(s) sans lecture de leur page` (actual `failed`). La variante autre chemin est déjà verte (`failed`, contrôle exercé).
