# Rapport `generique-01` — un pack qui n'est pas career-ops doit pouvoir marcher (G1, G2, G4)

Session de code, 18/11/2026, de 19:32 à 19:52 (heures lues par `date`). Arbre `~/Downloads/agregat-back-generique`,
branche `generique-01`, base `dad6c23`. Commit de code : `d34ed9f`. Non intégré : attend l'accord du propriétaire.

## En une phrase
Un pack fait de deux manifestes, sans `index.js` et sans rapport avec l'emploi, garde maintenant son pack et ses étapes
en mode propriétaire, voit sa passerelle d'outils démarrer, finit `completed` avec un Bilan, et peut déclarer qu'un de
ses outils a droit à plus de 120 s ; pour career-ops, najah, core et auto, les empreintes relevées avant le changement
sont identiques après.

## Vérification des lignes citées par le brief (constaté avant de coder)
- G1 : `packages/orchestrator/index.js:781-788` (base) : `!['najah', 'career-ops'].includes(v.pack)` décidait seul de
  la bascule vers `core` + `browser-agent` en mode propriétaire. Constaté.
- G2 : `packages/mcp-gateway/server.js:379-380` importait `domain-packs/<id>/index.js` sans condition (sauf `core`) ;
  `packages/orchestrator/packs.js:115-117`, `verifyPack`, idem. Constaté.
- G4 : `packages/orchestrator/index.js:1384` : `idleFor: (update) => careerScriptDelay(update, scriptLimits)` ;
  `tool-guard.js:164` : `careerScriptDelay` ne reconnaît que `career_script`. Constaté.
- Constaté aussi : les packs sont lus une seule fois, au chargement de `packs.js`, dans `domain-packs/` ; la
  passerelle (processus à part) relit les packs elle-même ; l'enum `pack` de l'entrée (`index.js:101`) est bâtie au
  chargement. D'où le réglage de test décrit plus bas.

## Ce qui a changé, ligne par ligne

### `packages/orchestrator/index.js` (G1, G4, réglage de test)
- Import : `declaredToolDelay` ajouté à la liste importée de `./tool-guard.js` (l. 78).
- `mcpServerFor` (l. 528-530) : 3 lignes. Si `AGENT_PLATFORM_TEST_PACKS_DIR` est défini, il est transmis à la
  passerelle (sinon rien n'est ajouté à son environnement). Réglage de test seulement.
- `plan` (l. 785-791), G1 : la liste `['najah', 'career-ops']` est remplacée par un fait lu sur le pack choisi :
  `chosen = v.pack === 'auto' ? null : packs.find(...)` ; `ownPath = Boolean(chosen?.skillManifest ||
  chosen?.workflow.steps.length)` ; `browserWorkflow = this.ownerMode && !ownPath && (même condition de workflow)`.
  Correspondance avec aujourd'hui : career-ops a un manifeste de Skill → gardé ; najah a trois étapes de workflow →
  gardé ; core n'a ni l'un ni l'autre (`workflow.steps: []`) → navigation libre ; `auto` → navigation libre (le pack
  n'est pas « choisi », comme avant). « Parcours propre » = des étapes déclarées dans `workflow.steps` du
  `manifest.yaml` ; le DAG ne compte pas, car `core` en a un et doit continuer à basculer.
- `execute`, garde des outils (l. 1391-1394), G4 : `idleFor` devient `careerScriptDelay(...) ??
  declaredToolDelay(update, plan.pack.toolTimeouts)`. `career_script` passe en premier, son mécanisme est intact ; un
  pack sans déclaration rend `null`, donc le délai commun. Un délai déclaré plus court que 120 s n'a aucun effet
  (`ToolGuard` prend le maximum) : rien ne restreint l'agent.

### `packages/orchestrator/packs.js` (G2, G4, réglage de test)
- Imports : `pathToFileURL`, `skillManifestSchema` (lecture seule de `skill-router.js`, non modifié).
- Schéma du manifeste (l. 32-36), G4 : champ facultatif `toolTimeouts` : `{ <nom d'outil>: <ms entier positif> }`.
  `z.object` retire déjà les clés inconnues ; sans la clé, l'objet du pack est identique à avant (vérifié par test).
- Lecture des packs (l. 49-68) : le corps de l'ancienne boucle est sorti tel quel dans `readPack(folder,
  skillManifest)` et `packIds(base)` ; `domain-packs/` est lu exactement comme avant (même filtre `manifest.yaml`, même
  tri, `loadSkillManifest(id)`). `packFolder(id)` rend le dossier d'un pack, `domain-packs/<id>` par défaut.
  **La découverte des packs ne change pas : un `manifest.yaml` reste exigé.**
- Réglage de test (l. 69-86) : si `AGENT_PLATFORM_TEST_PACKS_DIR` est défini, les packs FICTIFS de ce dossier sont
  ajoutés **après** ceux de `domain-packs/` (même règle `manifest.yaml`, manifeste de Skill validé par le schéma
  existant, refus d'un identifiant en double). Non défini (le cas normal), rien ne change.
- `skillDefinitions` (l. 92) : chemin du Skill par `packFolder(p.id)` — même chemin qu'avant pour `domain-packs/`.
- `verifyPack` (l. 140-146), G2 : sans `index.js` dans le dossier du pack, le résultat est rendu tel quel, comme pour
  `core`. Avec `index.js`, même import qu'avant (URL de fichier du même chemin).

### `packages/orchestrator/tool-guard.js` (G4)
- Nouvelle fonction `declaredToolDelay(update, delays)` (l. 172-178) : lit le nom d'outil par `readToolCall` (le
  lecteur unique de tous les adaptateurs : Claude `mcp__platform__x`, Codex `mcp.platform.x` / `rawInput.tool`) et rend
  le délai déclaré, ou `null`. Rien d'autre ne change dans le fichier.

### `packages/mcp-gateway/server.js` (G2)
- Imports : `resolve`, `existsSync`, `pathToFileURL`, `packFolder`.
- l. 381-384 : l'import du plugin du pack se fait seulement si `packFolder(pack.id)/index.js` existe (et toujours pas
  pour `core`). Sans ce fichier, aucun outil propre n'est enregistré et la passerelle démarre.

### Tests et pack FICTIF (nouveaux)
- `tests/fixtures/packs-generique-01/montage-video-fictif/` : `manifest.yaml` (une étape `evidence_echo`,
  `toolTimeouts: { rendu_video_fictif: 150000 }`) et `skill-manifest.yaml` (deux intentions : `monter-video`, avec
  une étape requise et une optionnelle sur `rendu_video_fictif`, et `sous-titrer`). Aucun `index.js`.
- `tests/fixtures/packs-generique-01/sans-parcours-fictif/manifest.yaml` : ni manifeste de Skill ni étape ; sert à
  prouver que la bascule vers `core` dépend du pack, plus de son nom.
- `tests/generique-01.test.js` (15 tests), décrits plus bas.

## Résultats exacts des tests (constatés)
`node --test tests/generique-01.test.js` : tests 15, pass 15, fail 0 (≈ 15 à 24 s).
1. G1 : pack FICTIF en mode propriétaire → `browserWorkflow: false`, pack et intention `monter-video` gardés. ✔
2. G1 : `sans-parcours-fictif` → `core` + `browser-agent`, comme avant. ✔
3. G2 : passerelle du pack FICTIF démarrée, outils `browser_snapshot`, `evidence_echo` ; `verifyPack` rend l'objet
   reçu, inchangé. ✔
4. Preuve : `create` → `plan` → `execute` avec l'agent de démonstration (`tests/fixtures/agent.js`, qui lit les outils
   par MCP et les appelle), mode propriétaire, navigateur simulé : `completed`, `pack` FICTIF, résumé avec `Bilan` et
   l'étape « Lire les rushes FICTIFS » à l'état `done`, pas de « Mission incomplète ». ✔
5. G4 : faux agent ACP (`fake-acp.js`, `stallTool`) qui ouvre `mcp__platform__rendu_video_fictif` et ne répond plus ;
   horloge simulée : aucun `tool_stalled` à 120 s ni à 149,999 s, `tool_stalled` à 150 s (`afterMs: 150000`),
   mission `failed`. ✔
6. G4 : `declaredToolDelay` lit le délai sous les formes Claude et Codex ; `null` sans déclaration, y compris pour un
   nom comme `toString` ; `toolTimeouts` absent de core, najah, career-ops ; `careerScriptDelay` rend toujours
   600000 + 15000. ✔
7-14. Inertie (8 tests) : pour career-ops, najah, core et auto, en mode propriétaire et hors mode propriétaire,
   comparaison à des empreintes relevées **sur la base `dad6c23`, avant tout changement**, par la même sonde : le
   pack retenu, `browserWorkflow`, l'empreinte du plan (entrée, workflow, étapes, permissions, mode de données,
   objet du pack entier, Skills, intentions), la liste des outils offerts par la passerelle, l'empreinte de la
   consigne envoyée à l'agent (`instructions` et `workflow`, lues par le faux agent ACP), l'état et le résumé de fin
   de mission (faux agent ACP) et, hors career-ops, l'état et le résumé de fin de l'agent de démonstration. ✔ (8/8)
15. Inertie : dans un processus sans `AGENT_PLATFORM_TEST_PACKS_DIR`, les packs chargés sont `core`, `career-ops`,
   `najah`, identiques (JSON entier) à ceux du processus de test, sans clé `toolTimeouts`. ✔

En plus, la sonde complète (scratchpad, non versionnée) a été relancée après les changements, avec et sans le réglage
de test : sortie identique à celle de la base, sauf l'empreinte du champ `skills` de career-ops, qui varie déjà d'une
exécution à l'autre sur la base (chemins temporaires) ; ce champ n'entre donc pas dans les tests (seuls les
identifiants de Skills y sont comparés).

Tests existants relancés, un fichier à la fois, tous verts : tool-guard 17/17, delai-navigation-libre 3/3, owner-mode
14/14, tool-stall-delivery 6/6, tool-watchdog 1/1, career-timeout 1/1, agent-silence 2/2, career-integration 50/50,
career-optional-files 4/4, pack-effects 4/4, platform 11/11, najah-evals 4/4, workflow-run 18/18, workflow-resume 8/8,
skill-registry 22/22.
`npm run check` : « Syntaxe JavaScript valide. » `npx prettier --check` sur les fichiers touchés : conforme (après
`prettier --write` sur `packs.js`, mise en forme seulement).

## Contre-épreuve (constatée, chaque changement retiré seul puis remis)
- G1 retiré (liste de noms rétablie) : 3 échecs — G1 « garde son pack », la Preuve, G4 bout en bout (le pack devient
  `core`) ; les 8 tests d'inertie restent verts.
- G2 retiré (import sans condition dans la passerelle et dans `verifyPack`) : 2 échecs — G2 et la Preuve.
- G4 retiré (`idleFor` sans `declaredToolDelay`) : 1 échec — « coupé au délai commun de 120 s ».
- Sur la base entière, le pack FICTIF n'est pas chargeable (réglage absent) : les tests du pack FICTIF échouent dès le
  plan (« pack » hors de l'énumération).

## Ce qui n'est pas vérifié
- Aucun essai réel : aucun agent réel (Claude, Codex, Gemini, OpenCode), aucun navigateur réel, aucun relais.
- Pas de suite complète (`npm test`) : seuls les fichiers listés ci-dessus.
- Non lancés exprès : `mcp-contract.test.js` (mode `isolated`, peut lancer Chrome), `najah-live.test.js` (passerelle de
  données réseau, même en rejeu : contrôle DNS possible). Tous les autres tests du dépôt non relancés.
- La passerelle n'a été lancée qu'en navigateur `fixture` dans les tests neufs (pas `playwriter`).
- Le chemin `workflow` (DAG) d'un pack sans `index.js` n'est pas couvert ; `verifyPack` y est le même code.
- Hypothèse non vérifiée : un adaptateur réel qui nomme l'outil autrement que les formes connues de `readToolCall`
  ne recevrait pas le délai déclaré (il garderait 120 s).

## Écarts au brief
- Un fichier non cité par le brief n'a pas été touché ; mais `packages/orchestrator/index.js` porte en plus de G1/G4
  trois lignes de réglage de test dans `mcpServerFor` (transmettre `AGENT_PLATFORM_TEST_PACKS_DIR` à la passerelle,
  processus à part dont l'environnement est filtré). Sans elles, la passerelle du pack FICTIF ne trouve pas le pack.
  Inertes quand la variable n'est pas définie.
- Le champ de G4 est dans le schéma de `manifest.yaml` (`packs.js`), pas dans le manifeste de Skill : son schéma est
  dans `skill-router.js`, que le brief interdit de toucher.
- Le pack FICTIF est sous `tests/fixtures/packs-generique-01/` (avec un second pack FICTIF, `sans-parcours-fictif`,
  pour la règle de bascule).
- Le test G4 de bout en bout prend le plan réel (`create` → `plan`) mais remplace l'agent de démonstration par le faux
  agent ACP `fake-acp.js` (seul faux agent qui sait laisser un outil sans réponse) ; la Preuve « completed avec Bilan »
  utilise l'agent de démonstration sans remplacement.

## Ce que j'ai vu en route, laissé tel quel (à décider par le propriétaire)
1. Délai de mission (G9 de l'état des lieux, constaté ici) : avant G1, un autre pack en mode propriétaire devenait la
   navigation libre et avait 15 min ; maintenant qu'il garde son pack, il a le délai commun des missions (3 min,
   `timeoutFor`, `index.js:439-443`), career-ops seul ayant 15 min. Un outil déclaré à plus de 3 min serait donc coupé
   par le délai de mission. Le test G4 déclare 150 s pour rester sous ces 3 min. À décider : un délai de mission
   déclaré par le pack, ou celui de career-ops pour tout pack qui a un manifeste de Skill.
2. Message d'échec d'un outil figé hors career-ops : « Outil sans mise à jour », sans le délai ni « relancer »
   (`failure.js:69` ne le détaille que pour career-ops). Constaté par le test G4.
3. Consigne envoyée à un pack non career-ops : elle parle encore de Najah (`index.js`, point « trompeur » de l'état
   des lieux) ; le pack FICTIF la reçoit telle quelle.
4. Réglage `AGENT_PLATFORM_TEST_PACKS_DIR` : voulu de test seulement ; s'il devait servir à charger des packs hors du
   dépôt pour de vrai, c'est une décision à part (droits du dossier, revue des packs).
