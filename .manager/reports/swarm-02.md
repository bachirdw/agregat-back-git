# swarm-02 — Limites d’usage et état réel des agents (codeur)

Arbre `/Users/diaw/Downloads/agregat-back-swarm-02`, branche `swarm-02`. Début 20/11/2026 23:38 (horloge lue).
Base du lot `3631948` ; portage du copieur `7b5b8e3`.

## Fait

- `packages/agent-runtime/limits.js` : portage installé tel quel (4 lignes d’en-tête de licence en tête), plus
  une forme : « try again at 22:00 » (24 h, sans AM/PM, ancrée sur « try again at », bornes 0-23 / 0-59), forme
  écrite par le faux agent (consigne LIMITE) et déjà lue par le message montré de `failure.js`. Sans elle, le
  bout en bout n’aurait lu aucune heure (durée par défaut 1 h).
- `packages/agent-runtime/agent-state.js` (écrit, sans origine swarm) : `agentState`, `noteFailure`,
  `clearLimit`, selon la section du lot. `noteFailure` : tout dans un try/catch, arguments vérifiés,
  synchrone, sans réseau ; écrit `limite` (classes `limite`, `credits`) ou `limitesModele[<id>]` (fusion avec
  les modèles déjà notés), rien pour connexion/surcharge/serveur ; écrit seulement `{ classe, jusqua, source, at }`.
  `clearLimit` : n’écrit que s’il y a quelque chose à effacer (`limite: null`, entrée du modèle retirée,
  `limitesModele: null` si vide). `agentState` : lecture seule.
- `packages/agent-runtime/router.js` : import de `limitReason` et une branche dans `chooseAgent`, après
  « adaptateur absent » et avant les refus de sonde ; l’agent n’entre pas dans `retryable` (jamais « réessayé »).
- `packages/orchestrator/index.js` : une ligne d’import ; `clearLimit(...)` juste après la ligne
  `saveProbe(... inference: true ...)` (même condition `!plan.simulated && end_turn`) ;
  `control.echecAgent = noteFailure(...)` juste après `usageLimit` et `authFailure`, texte du plan
  (Prettier l’a mis sur plusieurs lignes). Diff : 12 lignes ajoutées, aucune retirée.
- `packages/orchestrator/workflow-run.js` : une ligne d’import ; `noteFailure(...)` juste après `usageLimit`
  (vers 306) ; `clearLimit(...)` juste après le `saveProbe` de réussite (vers 314). Pour une étape :
  `models: described.models?.options`, `model` = `run.model` seulement si l’étape est menée par l’agent de la
  mission (sinon `null`), `cancelled: control.cancelled`, `simulated: definition.simulated`. Diff : 16 lignes
  ajoutées, aucune retirée.
- `docs/api-agents-etat.md` : classes, règle de lecture (dont la règle de `rateLimit` vérifiée dans
  `failure.js:27-42`), heures lues, champs `limite` et `limitesModele`, états, mode Auto.
- `probes.js`, `failure.js`, `tests/fixtures/chef-agent.js` : non modifiés.

## Décisions

- Règle `rateLimit` (décision 2 du manager) vérifiée dans `failure.js` : `usageLimitMessage` ne retient
  l’événement que si l’erreur est nue (`!(bareFailure && rateLimit)`), et un message qui dit lui-même une limite
  est lu par `LIMIT_TEXT`. Le portage (`rateLimit && (bare || isRateLimitMessage(error))`) est gardé ;
  `resetsAt` passe avant l’heure du texte (limite et crédits).
- Constaté et laissé tel quel : l’expression d’erreur nue `/^(?:Internal error|Agent arrêté\b)/i` (dans
  `failure.js` et reprise par le portage) ne reconnaît jamais « Agent arrêté : … » (le `\b` après « é » ne
  trouve pas de frontière sans drapeau `u`). Vérifié par commande : `usageLimitMessage` rend `null` pour
  « Agent arrêté : refusal » + annonce de limite. Le classement fait exactement pareil (même règle) ; un test
  le fixe. `failure.js` est hors lot.
- `saveProbe` met à jour `at` à chaque écriture : une limite notée rafraîchit `at`, qui sert de date de repli au
  routeur pour une sonde négative sans `sessionAt`/`inferenceAt` (cas ancien ; `saveProbe` pose toujours ces
  dates aujourd’hui). Même effet que toute autre écriture de sonde ; non corrigé (hors lot).

## Tests

Cas rouge d’abord (cas 3) : le test a été écrit puis lancé sans le module (fichier retiré un instant) :
`Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../packages/agent-runtime/limits.js'`, `ℹ fail 1`. Un rouge
de comportement n’a pas pu être produit : le portage appliquait déjà la règle de lecture. Le test vérifie donc
aussi que le texte contient bien une forme de limite (`isRateLimitMessage(annonce) === true`) : seule la règle
de lecture rend `null`. Ensuite vert.

Premier passage complet : `cas 4` rouge (« Agent arrêté : … » n’est pas une erreur nue, voir Décisions) ; test
corrigé pour suivre la règle de `failure.js`.

`tests/swarm-02-limites.test.js` : 12 tests (cas 1 à 9 du plan, mémoire et effacement, robustesse — fichier à la
place du dossier, dossier en mode 000, arguments absents ou mal typés, getter qui lève —, étape de workflow).
Heures attendues calculées en heure locale (`setHours`), aucune chaîne ISO en dur.

- `node --test tests/swarm-02-limites.test.js tests/probe-routing.test.js tests/sonde-refus-auth.test.js tests/career-failure.test.js`
  → tests 28, pass 28, fail 0. Les trois fichiers existants ne sont pas modifiés.
- Contrôles négatifs faits par moi (code remis ensuite, diff vérifié) : sans `noteFailure` dans `index.js` →
  cas 8 rouge ; sans `clearLimit` dans `index.js` → cas 8 rouge ; branche du routeur neutralisée → cas 9
  rouge ; sans `noteFailure` dans `workflow-run.js` → test workflow rouge ; sans `clearLimit` dans
  `workflow-run.js` → test workflow rouge.
- `npm run check` : « Syntaxe JavaScript valide. », code 0. `npm run format:check` : « All matched files use
  Prettier code style! ».
- Phase unitaire (`phase-unitaire.mjs`, après le commit 5c7c8a2) : `ℹ tests 1623`, `ℹ pass 1620`,
  `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 2`, `ℹ todo 1`, `FIN phase unitaire : code 0 (durée 239 s)`.
  Référence 1 611 / 1 608 + les 12 tests du lot ; aucun autre chiffre ne bouge. Journal supprimé.

## Écarts au plan

- Forme « try again at 22:00 » ajoutée à `parseResetTime` (voir Fait).
- `clearLimit` est appelé sous la même condition que la ligne `saveProbe` qui le précède (`if (!plan.simulated
  && response.stopReason === 'end_turn')`), sans quoi il s’exécuterait aussi pour un agent simulé ou un arrêt.
- Dans `workflow-run.js`, l’appel `noteFailure` n’assigne rien (il n’y a pas de `control` d’étape équivalent
  à `control.echecAgent`).
- Un test de plus que le plan : la même mémoire pour une étape de workflow (l’étape en échec reste « uncertain »
  en attente du propriétaire : le test lit la sonde puis annule).

## Points à trancher par le manager

1. L’expression d’erreur nue ne reconnaît pas « Agent arrêté : … » (`failure.js` et ce lot) : à corriger
   ensemble plus tard (`(?![\p{L}\p{N}_])` avec drapeau `u`, ou `Agent arrêté(?:\s|:|$)`) ? Corriger
   changerait le message montré.
2. `chooseAgent` n’écarte pas un agent pour la limite du modèle demandé (`limitesModele[requirements.model]`) :
   non demandé par le plan ; `agentState` l’expose dans `modelesLimites`.
