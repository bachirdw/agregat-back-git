# accord-mission-01 — Un clic vaut pour tous les envois de la mission

Codeur Opus. Branche `accord-mission-01` créée depuis `contacts-13-11` (arbre propre vérifié). Données de test FICTIVES.

## Journal
- **13/11 16:44** Lecture d'AGENTS.md, de la section 1 de `passation.md` et de `carte-envoi-etude-01.md`. Relecture du
  code cité par le plan : `mcp-gateway/server.js` (`approve`, `reportToolOutcome` attendu avant de rendre la main à
  l'agent), `apps/api/server.js` (routes `approvals`, `tool-outcome`, `permissions`), `orchestrator/index.js`
  (`gatewayApproval` 470-541, `permission` 1827-1941, `formatSendLine` 154-187, Bilan 1621-1638), `policy-engine/index.js`
  (`allowedPermission` 14-19), `skill-router.js` (`skillManifestSchema` 154-190), `packs.js` (manifeste chargé au démarrage).
  Références du plan conformes, à quelques lignes près.
- **16:46** a) `sendGrant: { channels: [browser] }` dans `domain-packs/career-ops/skill-manifest.yaml`, clé facultative
  et stricte (`browser`, `email`) dans `skillManifestSchema`. Commit `47ada20`.
- **16:47** b) `allowedPermission` admet `allow_mission` (`PERMISSION_KINDS`), `allow_always` toujours refusé. Le filtre
  de `permission()` n'admet `allow_mission` que sur une carte que la plateforme construit (`missionGrant: true`, posé
  par `gatewayApproval`) : une option de ce genre venue d'un agent ACP est écartée. Commit `af6701f`.
- **16:48** c) `gatewayApproval` : `sendGrantChannels(runId)` lit le manifeste du pack de la mission (`run.pack` du
  magasin) ; canal = famille de la capacité (`browser.*`, `email.*`). Troisième option ajoutée après les deux
  d'aujourd'hui (identifiants, noms, ordre inchangés). Réponse `allow_mission` : accord de cet envoi + `sendGrant`
  posé sur `this.active.get(runId)` + événement `send_grant {scope:'mission'}`. Accord présent : `send_auto` sans
  passer par `permission()`, `sendsApproved++`, `sendsGranted++`, `grantedTargets`, `sendCalls.add(callId)`.
  Suspension : `otherSendOpen` parcourt les contrôles de la mission qui ont eu un envoi approuvé
  (`mission.sendControls`), cherche un autre appel dans `sendCalls` (issue inconnue) ou d'issue `uncertain` dans
  `sendSettled` (l'écriture bloquée A8 y est `uncertain`). Commit `1815043`.
- **16:49** Faux pas : j'ai lancé une fois, en parallèle, `approval-bridge.test.js` et `apply-01-approval-card.test.js`
  (ensemble Chrome, non modifiés) avec des tests unitaires, SANS avoir vérifié les missions avant. Vérification faite
  juste après (16:49) : 4314 → 9 completed ; 4313 → 41 completed, 6 failed, 1 cancelled ; aucune mission en cours.
  Verts (93 tests). Ensuite, Chrome lancé uniquement pour mon nouveau fichier, après vérification.
- **16:50** d) `formatSendLine(…, granted = 0, grantedTargets = [])`, Bilan branché sur `control.sendsGranted` et
  `control.grantedTargets`. `docs/api-sends.md` décrit l'option, les événements et la ligne. `bilan-vs-events.mjs`
  compte les `send_auto` et signale un écart avec « N par son accord de mission » du Bilan. Commit `8691b78`.
- **16:51** e) `demo-candidature.py` : `DEMO_GRANT=1` et prompt `deux` (pack career-ops : seul pack qui déclare
  `sendGrant`). La page FICTIVE se rejoue en revenant à sa racine (`GET /` rend l'étape 1). Sortie inchangée sans
  `DEMO_GRANT`. Commit `1bbb29d`. Non lancé (aucune mission réelle).
- **16:52** Test Chrome `tests/accord-mission-chrome.test.js`, ajouté à `BROWSER`. Missions vérifiées avant (16:52,
  mêmes décomptes, aucune en cours). Commit `cf8c3de`.
- **16:53** Preuve rouge : code de `contacts-13-11` exporté (`git archive`) dans un dossier temporaire, nouveaux
  fichiers de test copiés, lancés là (missions revérifiées à 16:53 pour Chrome).
- **16:55** Phase unitaire complète, `npm run check`, `npm run format:check`.
- **16:56** Constat : `contacts-13-11` a reçu un commit d'un autre écrivain après ma création de branche (`9122530`,
  rapport du manager) ; ma branche part de `ccc8a95`, rien de commun touché.

## Preuves rouge puis vert
Rouge (code de base, tests nouveaux) :
- `platform.test.js` : 2 échecs (`allow_mission` refusé ; `sendGrant` absent du manifeste).
- `owner-permissions.test.js` : 6 échecs (option absente, aucun `send_auto`, etc.). Trois tests nouveaux passent déjà
  sur la base, par nature : ce sont des gardes de non-régression (option ACP `allow_mission` écartée, `Refuser` ne
  pose rien, pack sans `sendGrant` sans option).
- `career-sends.test.js` : 1 échec ; `envoi-approuve-effectue.test.js` : 1 ; `bilan-vs-events.test.js` : 1.
- Chrome `accord-mission-chrome.test.js` : 1 échec (« actual [allow, deny], expected [allow, deny, allow_mission] ») ;
  le second test (accord ponctuel, la seconde carte attend) passe sur la base : garde de non-régression.
Vert (branche) : tous ces tests passent.
- Phase unitaire complète (155 fichiers hors `BROWSER`, `--test-concurrency=4 --test-timeout=120000`) :
  1194 tests, 1192 réussis, 0 échec, 2 ignorés (clone du Skill absent ; Playwriter réel).
- Chrome, un par un : `accord-mission-chrome.test.js` 2/2.
- `npm run check` : syntaxe valide ; `npm run format:check` : conforme.

## Ligne du Bilan
Sans envoi accordé par la mission : chaîne identique à l'ancienne (testée sur quatre formes). Avec :
`Envoi par la plateforme : 2 approuvé(s), dont 1 par le propriétaire et 1 par son accord de mission (cibles : 127.0.0.1:<port>/submit).`
Cibles distinctes, cinq au plus, puis « et N autre(s) » ; cible inconnue dite « cible inconnue ».

## Écarts et précisions par rapport au plan
- L'envoi automatique exige un identifiant d'appel valide (`callId`), sinon la carte normale revient : sans lui
  l'issue ne pourrait pas être suivie dans `sendCalls`. L'option reste proposée sans `callId`.
- Canal = famille de la capacité : `browser.download` assimilé à un envoi (clic d'envoi) est couvert comme
  `browser.click`/`press`/`send`.
- `allow_mission` n'est admis par le filtre de `permission()` que sur une carte de la plateforme (`missionGrant`).
- `send_auto.target` vaut `null` si ni requête, ni action de formulaire, ni page ne donnent d'hôte ; le libellé est
  celui du bouton, sinon le titre de la carte (ex. « ACTION SENSIBLE · browser.send » pour une écriture réseau).
- `sendsAsked` n'est pas incrémenté par un envoi accordé sans carte (aucune demande au propriétaire).
- Un même appel qui écrit deux fois sous l'accord compte deux envois accordés (comme deux clics aujourd'hui).

## Ce qui n'est pas vérifié
- Le Bilan d'une vraie mission (chemin `execute`) avec accord : seuls `formatSendLine` et les compteurs du contrôle
  sont testés ; aucun test de mission complète avec faux agent ne passe par l'accord.
- La reprise est simulée en remplaçant le contrôle de mission (ce que font `resume`/`resumeWorkflow`), pas en
  appelant `resume`.
- Missions DAG (contrôle d'étape) : accord posé sur la mission, compteurs sur le contrôle d'étape ; non testé.
- `demo-candidature.py` (`DEMO_GRANT`, `deux`) : non lancé ; agent réel : jamais essayé.
- Suite Chrome complète : réservée au manager.
