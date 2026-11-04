# c6-accord-envoi-01 — L'accord d'envoi final attend le propriétaire sans expirer

Chantier C6 du `.manager/PLAN-04-11.md`. Dossier `~/Downloads/agregat-back-astra`, branche `suite-astra`. À lancer après la livraison de `c3-question-prose-01` (même fichier `packages/orchestrator/index.js`).

## Constat (lu dans le code à 7a4fa3a ; lignes à relire après C3)
- En mode propriétaire, seul un accord `actionClass: 'send'` attend un humain (`packages/orchestrator/index.js:1304-1312`, `permission()`). Tout autre accord est accordé automatiquement (`permission_auto`).
- Cet accord expire après `this.permissionTimeoutMs` (60 s, `index.js:152` et `1347`), et l'expiration est signalée au Bilan sans annuler la mission (`index.js:1190-1192`, « action non effectuée, personne ne l'a annulée »).
- Pendant l'attente, l'état est `waiting_permission` mais les délais de mission (« outil sans mise à jour », « agent inactif », délai de mission) continuent de courir, contrairement à `awaiting_owner` qui les suspend (`control.suspendTimers()` / `resumeTimers()`, `index.js:840-848`).
- Décision du propriétaire (31/10 et 04/11) : le clic avant un envoi final est le seul garde-fou ; aucun processus ne doit rester bloqué sur une autorisation expirée. Ici, c'est l'exception voulue : l'attente du clic ne doit pas expirer toute seule.

## Points (un commit `[c6-accord-envoi-01]` par point, test rouge puis vert)

### Point 1 — Pas d'expiration pour l'accord `send` en mode propriétaire
Dans `permission()` : quand `this.ownerMode && p.actionClass === 'send'`, aucun `setTimeout` d'expiration, sauf si `AGENT_PLATFORM_SEND_TIMEOUT_MS` est configuré (défaut : aucun plafond ; le propriétaire décidera, question 2 du plan). Les autres accords (hors mode propriétaire, ou non `send`) gardent 60 s. L'annulation par `POST /api/runs/:id/cancel` résout l'accord en `cancelled` comme aujourd'hui.
Test : `tests/owner-permissions.test.js` (ou `approval-bridge.test.js`) avec délais réduits (`permissionTimeoutMs: 300`) : un accord `send` ouvert 1 s n'expire pas, puis une réponse par l'API l'approuve ; un accord non `send` expire toujours à 300 ms ; avec `AGENT_PLATFORM_SEND_TIMEOUT_MS=500` le `send` expire à 500 ms.

### Point 2 — Délais suspendus pendant `waiting_permission` (send)
Appeler `control.suspendTimers()` à l'ouverture d'un accord `send` en mode propriétaire et `control.resumeTimers()` à sa résolution (comme `openNext`/`settleQuestion` pour les questions). `control` est accessible via `this.active.get(runId)`.
Test : délais réduits (`silenceMs`, `missionTimeoutMs` à 300 ms) ; accord `send` ouvert 1 s → aucun `tool_stalled`, aucun « Délai maximal dépassé » ; après résolution, les délais reprennent avec le temps restant.

### Point 3 — `pendingPermission` exposé par l'API
`GET /api/runs/:id` expose `pendingPermission` (`null` sinon) : `{ id, capability, actionClass, toolCallId, askedAt, preview }` où `preview` est l'aperçu déjà construit pour la décision (sans secret, sans texte de page). Le front pourra afficher le clic. Documenter dans `docs/api-sends.md`.
Test : `tests/owner-permissions.test.js` : pendant l'attente, `GET` renvoie `state: 'waiting_permission'` et `pendingPermission.actionClass === 'send'` ; après réponse, `null`.

### Point 4 — Les missions en attente ne comptent pas dans le plafond d'actives
`index.js:612` (plafond de 3 missions actives) : une mission en `waiting_permission` (send) ou `awaiting_owner` n'occupe pas de place. Test : 3 missions en attente, une 4e démarre.

### Point 5 — Suite complète, check, format, rapport
`npm test && npm run check && npm run format:check` (vérifier avec `pgrep -fl run-tests.js` qu'aucune suite ne tourne).

## Règles
- Aucune restriction de l'agent ; aucune approbation d'un envoi par le code ou par le sous-agent ; le manager annule par `POST /cancel`.
- Pas de `git add -A`, stash, reset, push. Aucun `.env`, `~/.claude`, `~/.codex`. Aucune donnée personnelle.
- Ne relance aucun serveur. Rapport `.manager/reports/c6-accord-envoi-01.md` horodaté.

## Hors périmètre
Parcours de candidature (C7), front, `browser.dialog`/`browser.verify`.
