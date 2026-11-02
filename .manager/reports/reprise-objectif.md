# Rapport reprise-objectif : point de reprise et objectif de départ

Branche : `reprise-objectif`, partie de `origin/cloud-base-suite-astra` (`caf7716`). Données de test toutes fictives. Aucun modèle appelé, aucun envoi, aucun site réel.

## Journal

- 11:33 : `git fetch origin cloud-base-suite-astra contre-verif-cloud codex/browser-audit-31-10`, puis `git checkout -b reprise-objectif origin/cloud-base-suite-astra`. Le suivi automatique vers `cloud-base-suite-astra` est retiré (`git branch --unset-upstream`) pour ne jamais pousser sur la base par erreur.
- 11:35 : lecture de `AGENTS.md`, des constats 1, 2, 3 et 11 de `contre-verif-cloud.md` et du diff de `6754f25` (checkpoint, browser-proof, orchestrateur, test).
- 11:40 : lecture de la base. Constats sur `caf7716` :
  - `resumeCheckpoint(previous)` ne transmet que `previousAnswer`, l'état et l'identifiant. Aucun objectif, ni de départ ni du tour précédent.
  - `checkpointFor`, `turnObjective` et `resumedFrom` n'existent pas dans la base : ils n'existaient que dans `6754f25`.
  - Une mission privée a son prompt masqué en base (`Mission privée dans l'espace de candidature`) et le vrai prompt dans `relay/runs/<id>-input.json`.
  - Les observations navigateur de la plateforme passent par la route `/api/internal/evidence`, en mode propriétaire seulement. Elles vont dans `control.browserEvidence` (forme compacte, adresse sans paramètres) pour toutes les missions, et dans les événements `browser_evidence` seulement hors career-ops.
  - Le schéma de résultat est en `.passthrough()` : tout champ ajouté par le modèle (`lastPage`, `observed`…) arrive dans `value`, puis dans la ligne publique hors career-ops.
- 11:44 : `npm ci --omit=optional` (les dépendances manquaient). Node local : v22.23.4, alors que `package.json` demande >= 24 (avertissement EBADENGINE).
- 11:46 : tests de départ ciblés `astra-turn`, `fix-resume`, `browser-proof`, `astra-proof` : 33/33 verts. `npm test` complet de départ lancé en arrière-plan.
- 11:50 : écriture de `tests/tour-reprise.test.js` (13 tests). Chaque tour passe par `Orchestrator.create` puis `execute`, avec le faux agent `tests/fixtures/fake-acp.js` substitué dans le plan réel (même méthode que `career-integration.test.js`). Les pages « lues » passent par la vraie route `/api/internal/evidence` du serveur, avec le jeton du tour, pendant que le faux agent attend (`lateMs`). Le prompt réellement transmis est capté en enveloppant `AcpRuntime.prototype.prompt`, et le faux agent lui-même refuse le tour si l'objectif de départ manque (`expectInstructions`). Je n'ai pas modifié `fake-acp.js`, pour éviter un conflit avec les sessions parallèles.
- 11:58 : premier lancement sur la base : le fichier entier échouait à l'import (`lastReadablePage` absent). Les fonctions unitaires sont donc importées dynamiquement dans le seul test unitaire, pour que les tests d'intégration s'exécutent sur la base.
- 12:00 : **rouge sur la base, 13/13 en échec**, avec les causes attendues :
  - mission privée et mission générale : aucune page enregistrée par la plateforme ; le point de reprise n'a ni `missionObjective` ni `previousOwnerMessage` (le test d'objectif long échoue sur `missionObjective` indéfini) ;
  - page inventée : sur la base, un champ `observedByPlatform` fourni par le modèle traverse `.passthrough()` jusqu'à la ligne publique et jusqu'au fichier privé. C'est exactement le risque du constat 3 si l'on relisait ce champ sans l'écraser ;
  - preuve `[null]` avec une URL citée : le tour terminé passe en `failed` (« Cannot read properties of null (reading 'sourceId') » dans `assessBrowserClaims`). Défaut **antérieur** à `6754f25`, signalé par le constat 2 ;
  - `checkpointFor` et `pageAddress` n'existent pas.

## État à l'arrêt (12:05) : **PARTIEL, rien n'est corrigé**

Arrêt demandé par la session de coordination (limite Claude presque épuisée). Seuls le test rouge et ce rapport sont commités. **Aucun code de production n'a été modifié** : le défaut reste entier sur cette branche, et `tests/tour-reprise.test.js` est **rouge (13/13)** par construction. `npm test` complet de départ était encore en cours, résultat non relevé. `npm run check` et `npm run format:check` non relancés.

Conception prévue (non implémentée), pour la session suivante :
- `create` enregistre `resumedFrom: previous?.id ?? null` (une ligne hors du périmètre strict, indispensable pour remonter au premier tour, même après un tour en échec).
- `checkpointFor(previous)` remonte `resumedFrom` (borné, sans boucle) jusqu'au premier tour connu. L'objectif se relit par `turnObjective` : `run.prompt` pour une mission générale, `readConfined(career.path(), relay/runs/<id>-input.json)` pour une mission privée. La page vient du fichier privé `-result.json` pour une mission privée, de `previous.result` sinon.
- `resumeCheckpoint` : `schemaVersion`, `missionObjective` et `previousOwnerMessage` bornés à 4000 caractères avec la marque `[tronqué]`, `previousAnswer` (12000), `observedByPlatform: { lastPage }` repassé par `pageAddress`, une table `provenance` (propriétaire / déclaré par le modèle / plateforme) et une consigne qui désigne `objective` comme dernier message du propriétaire.
- `execute` : `value.observedByPlatform = { lastPage: lastReadablePage(control.browserEvidence) }`, toujours écrasé, jamais lu dans la réponse du modèle. La liste blanche existante le retire de la ligne publique career-ops, et le fichier privé le garde. `assessBrowserClaims` reçoit `control.browserEvidence` hors `browserWorkflow`, au lieu des preuves déclarées par l'agent, et ignore les éléments qui ne sont pas des objets.
- `browser-proof.js` : `pageAddress` (http(s), sans identifiants, paramètres ni fragment, 2048 caractères au plus) et `lastReadablePage`, qui saute les éléments mal formés sans lever d'erreur.
- Limite connue : un jeton placé dans le chemin même de l'adresse n'est pas détecté.

## `npm test` de départ, sur la base `caf7716` sans aucune modification (terminé après l'arrêt)
Code de sortie 1. Phase parallèle : 455 tests, 449 verts, 5 en échec, 1 ignoré. En échec : « career-ops conserve Codex sans imposer de clé Gemini », « une configuration Gemini modifiée ne bloque pas Codex », « Auto et mode workflow auto choisissent le parcours navigateur général », et deux tests d'arrêt d'un petit-enfant qui ignore SIGTERM. Phase Chrome : 128 tests, 127 verts, mais `owner-browser.test.js` est compté en échec avec 1 test annulé. Ces échecs existent **avant** tout changement de cette branche. Ils viennent probablement de l'environnement (Node 22 au lieu de 24, CLI absents), mais je n'en ai pas cherché la cause.
