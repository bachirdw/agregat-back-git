# orienter-14-11 — Message du propriétaire pendant une mission (back)

Arbre : `~/Downloads/agregat-back-orienter`, branche `orienter-14-11` (partie de `365040b`).
Début : 14/11/2026 20:16 (heure lue par `date`).

## Fait

- **Runtime** (`packages/agent-runtime/index.js`) : `SESSION_STEERING = '_session/steering'`,
  getter `steeringSupported` (`info._meta.steering.supported === true`), `steer(text)` et
  `cancelDetachedTurn()`. `steer` n’emprunte pas `request()` (dont le délai ferme le runtime) :
  délai propre de 15 s, erreur, sortie ou délai → `{ outcome: 'failed' }`, runtime intact.
- **Route** (`apps/api/server.js`) : `POST /api/runs/:id/message`, même garde d’en-tête que les
  routes POST voisines (`x-platform-request: 1` + JSON). 202 `{id, state}`, 400 vide ou > 8 000
  caractères, 404 inconnue, 409 terminée / en clôture / workflow.
- **Orchestrateur** : `message()`, `ownerMessageEvent()`, `pendingOwnerMessages()`,
  `deliverOwnerMessages()`, `canSteer()`, `flushOwnerMessages()`, `closeOwnerMessages()`,
  `formatOwnerMessageLines()` (exportée). Messages en mémoire sur `control.ownerMessages`.
  La boucle des tours ajoute un tour `turnKind: 'owner_message'` quand le tour finit sans question
  avec des messages en attente (20 tours de ce type au plus), et joint les messages au tour de
  réponse (`ownerMessage` à côté de `answer`). Fermeture (`closed`, 409, `undelivered`) juste après
  la boucle, dans le `catch` et dans le `finally`.
- **Détections** : `ownerWords()` (prompt + messages remis ; exactement `run.prompt` sans message
  remis) remplace `run.prompt` dans toutes les lectures après la boucle : URL nommée,
  `ordersBrowserAction`, `verifyPack`, `shortResumeWithoutBrowser`, `formatCareerBilan` (succès et
  échec), `ordersAction` de la ligne d’envoi, `noSendAsked`, `inboxUnprocessed`.
- **Bilan** : une ligne de la plateforme par message, après la ligne « Questions », donc dans
  `platformNotes` ; bornée à 10 lignes + une ligne de reste. Aussi dans le Bilan d’échec.
- **Confidentialité** : `text` dans l’événement sauf mission privée (`workspace` ou `pack`
  career-ops) hors mode propriétaire ; pour l’espace career-ops le texte est écrit dans
  `relay/runs/<id>-messages.json` (comme `-input.json`).
- **Faux agent** : `steering`, `steerFile`, `holdTurn {goFile, releaseOnSteer}`, `promptsFile`,
  réponse aux tours `owner_message`.
- **Doc** : `docs/api-message.md`.

## Requête `_session/steering` envoyée

```json
{ "sessionId": "<session>", "prompt": [{ "type": "text", "text": "Message du propriétaire pendant la mission : <texte>\n\nTiens-en compte pour la suite de la même mission, dans cette session (ce n’est pas une nouvelle mission)." }],
  "_meta": { "steering": { "idleBehavior": "promptRequired" } } }
```

Source : code installé `node_modules/@agentclientprotocol/claude-agent-acp@0.95.0/dist/acp-agent.js`
(`parseSteerRequest`, `steer()` : réponses `injected`, `promptRequired` + `reason: noRunningTurn`,
`startedNewTurn` ; annonce `_meta.steering.supported`) et
`node_modules/@agentclientprotocol/codex-acp@2.2.2/dist/index.js` (`sessionSteerParamsParser`
`passthrough`, `performSteeringRequest` : `injected`, `startedNewTurn`, `failed` ; `idleBehavior`
ignoré).

## Décisions

- **Quand steerer** : tour attendu par la plateforme, agent qui annonce le steering, au moins une
  mise à jour de l’agent depuis le début de ce tour (codex-acp met en attente une requête arrivée
  avant que son tour existe, puis lance un tour à lui après le nôtre), aucune question ouverte,
  aucune permission/carte ouverte. Envoi un par un, dans l’ordre ; on s’arrête au premier message
  qui ne peut pas partir (l’ordre est gardé).
- **Carte ouverte** : les messages en attente sont marqués « fin de tour » : pas d’injection après
  le clic non plus, car l’action approuvée s’exécute alors au premier plan (avec Claude, une
  injection la ferait passer en arrière-plan). La carte n’est résolue que par `decide()`.
- **`startedNewTurn` (Codex)** : ce tour détaché n’a pas de `session/prompt` à nous ; ni sa fin ni
  sa réponse ne seraient lues, et le Bilan pourrait s’écrire pendant qu’il agit. Retenu : arrêt
  immédiat (`session/cancel`), plus aucun steering pour cette mission (`steerUnsafe`), message gardé
  et remis par le tour de fin de tour ; avant ce tour, attente bornée (5 s) d’un silence de 500 ms
  de l’agent. Événement `owner_message_steering {outcome:'startedNewTurn'}`.
- **Question refusée ou restée sans réponse** : la boucle s’arrête comme avant ; un message en
  attente est alors `undelivered` (pas de tour supplémentaire après un refus).
- **Question par formulaire (elicitation) pendant un tour** : pas d’injection pendant la question ;
  après la réponse, le message peut être injecté, sinon fin de tour.
- La réponse 202 attend au plus 1,5 s un steering rapide (état `delivered`), sinon `pending`.

## Limites assumées

- Le suivi des étapes du Skill (figé au plan) et `packages/career-ops/truth.js` ne sont pas
  modifiés : un message qui change la tâche n’ajoute pas d’étapes au suivi.
- Les mises à jour de l’agent (dont l’écho éventuel du message) suivent leur règle existante
  (pack career-ops hors mode propriétaire : non stockées).
- Messages non persistés : un redémarrage du serveur les perd (comme les questions).

## Tests (14/11/2026 20:33)

- `node --test --test-timeout=120000 tests/message-proprietaire.test.js` : 15 tests, 15 réussis,
  0 échec (lancé trois fois de suite, trois fois vert). Couvre les 10 cas du brief plus : steering
  en erreur, échec de l’agent, deux messages orientés, `startedNewTurn`, bornage du Bilan, 403 sans
  en-tête, 404.
- Phase unitaire seule (157 fichiers `tests/*.test.js` hors des 22 de `BROWSER`,
  `--test-concurrency=4 --test-timeout=120000`) : 1244 tests, 1242 réussis, 0 échec, 2 ignorés
  (`RELAY_SKILL_CLONE` absent ; Playwriter réel en SKIP), 232 s.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : tout conforme.
- Aucun test existant modifié ; seul le faux agent (fixture) a reçu des options, inertes par défaut.
- Pas de `npm test` (phase Chrome interdite), aucun serveur hors ceux des tests, ni relais 19988 ni
  API 4313/4314.

## À vérifier par un essai réel

- Claude : `injected` pendant un tour, et `promptRequired` hors tour (aucun tour lancé) ; que la
  consigne est suivie dans la suite du même tour ; effet sur un outil long au premier plan.
- Codex : `injected` en plein tour ; la fenêtre de fin de tour (`startedNewTurn`) et l’arrêt par
  `session/cancel` du tour détaché, puis le tour de fin de tour sans collision.
- Gemini : aucune annonce de steering → remise en fin de tour.
