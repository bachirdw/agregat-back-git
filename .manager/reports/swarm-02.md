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

## Relecture indépendante (21/11/2026, à partir de 00:02)

Relu : plan (4.0, section du lot), `git diff 3631948..HEAD` fichier par fichier, le portage et ses notes, ce
rapport. Fichiers d'origine de swarm ouverts en lecture seule.

### Constats

- **Majeur, corrigé (d477040)** — faux positif par extrait cité. Le bloc d'échec de `index.js` reçoit aussi les
  erreurs du moteur qui citent la réponse de l'agent : `JSON invalide dans la réponse de l’agent : « <300 car.
  de la réponse> »` (`index.js:1794`). Une réponse qui disait « the rate limit of the API is 100/min » ou
  « HTTP 429 » était classée `limite` et notée 1 h dans les sondes : agent écarté par Auto pour rien. Test rouge
  d'abord (`tests/swarm-02-relecture.test.js`), puis `classifyFailure` retire de l'erreur tout passage « … »
  (fermé ou tronqué) avant lecture. Swarm fait de même pour une erreur du harnais qui cite un statut
  (`provider-error-class.ts:50-53`). Le message montré (`usageLimitMessage`, `failure.js`) a le même défaut
  depuis avant le lot : non corrigé (hors lot).
- **Mineur, corrigé (point 4 du manager)** — reproduit : sonde ancienne `{ session:false, at:<il y a 1 h> }`
  sans `sessionAt` ; après `noteFailure` d'une limite de 2 min, à +3 min, `chooseAgent` écartait l'agent
  (« session refusée », retryable) alors qu'il était choisi avant. Même effet pour `inference:false` et pour
  `agentState` (`connexion_refusee` au lieu de `a_reessayer`). Correction dans `agent-state.js` seul :
  `noteFailure` et `clearLimit` figent `sessionAt`/`inferenceAt` à l'ancien `at` quand ils manquent. Cas
  limité aux sondes écrites avant `sessionAt` (30/10). `probes.js` non touché.
- **Mineur, corrigé** — test du codeur dépendant de l'horloge : cas 8 et étape de workflow attendent
  `22:00`, mais entre 22:00 et 22:02 locales l'heure est « à peine passée » et devient maintenant + 1 min.
  Constaté rouge sous `TZ=Asia/Tokyo` lancé à 22:00 JST. Assertion rendue tolérante à cette fenêtre.
- **Vérifié, laissé (point 5)** — `node -e` : `/^(?:Internal error|Agent arrêté\b)/i` rend `false` pour
  « Agent arrêté : refusal » et « Agent arrêté », `true` pour « Agent arrêtée ». `limits.js` reprend la même
  expression : un agent qui annonce sa limite dans son texte puis s'arrête avec un `stopReason` autre que
  `end_turn` (refusal, max_tokens, max_turn_requests…) n'est jamais noté par l'annonce ; seul `rateLimit`
  ne compte pas non plus (il exige une erreur nue). Seules les erreurs `Internal error` (et celles qui disent
  elles-mêmes une limite) sont notées. Décision au manager (corriger `failure.js` et `limits.js` ensemble).
- **Vérifié, conforme** — moteur : dans `execute(run, plan, control)`, `text` et `rateLimit` sont déclarés
  en tête (l. 1332, 1339), `plan.models` vient de `plan()` (l. 1008, peut être `null` → `[]`), `run.model`
  existe ; dans `workflow-run.js`, `text`/`rateLimit` (l. 173-175), `described` (l. 269) et `definition`
  sont dans la portée du `catch`. `noteFailure` est enveloppé de `try/catch`, ne lève pas (`e` non-Error,
  `undefined`, options mal typées : testé) ; il s'exécute après `usageLimit`/`authFailure` et avant `cause`,
  sans les modifier ; `control.echecAgent` n'est lu nulle part ailleurs. Mission annulée ou simulée : `null`,
  rien écrit. `clearLimit` est sous la même condition que le `saveProbe` d'inférence. Hors mode équipe :
  mêmes événements, même Bilan, mêmes messages ; seule différence, l'écriture de `limite` dans les sondes.
- **Vérifié** — sondes : JSON cassé → `loadProbes` rend `{}`, l'écriture repart d'un fichier neuf (même
  comportement que tout `saveProbe`) ; absent → créé ; lecture seule ou dossier = fichier → classification
  rendue, rien écrit ; `dataDir` undefined → rien écrit. Écriture synchrone, une ou deux lectures, pas de
  boucle ni de réseau.
- **Vérifié** — routeur : `now` est un nombre (`Date.now()` par défaut) ; `Date.parse(undefined ?? '')`
  → `NaN > now` → `false` ; `jusqua` absent, texte invalide, nombre : choix identique (testé par le codeur et
  par contrôle négatif) ; limite passée : non rejeté.
- **Vérifié** — heures : 12:00 AM → minuit du lendemain ; 12:30 PM passé → lendemain ; passée de < 2 min →
  + 1 min ; passée de 3 min → lendemain (~24 h, voulu par le plan) ; 24:00, 13:61, 30 février → `null`
  (durée par défaut). Toutes les branches de `classifyFailure` passent par `clampMs` (1 min à 7 jours).
  Reste, hérité de swarm : « resets Nov 19, 5pm (UTC) » lu le 20/11 → année suivante → borné à 7 jours ;
  « resets Feb 30 (UTC) » normalisé au 2-3 mars. « resets at 3pm (UTC) » n'est pas lu (→ 1 h). Mineurs, laissés.
  Tests du lot et de relecture verts sous `TZ=UTC`, `America/Los_Angeles`, `Asia/Tokyo`, `Pacific/Kiritimati`,
  `Pacific/Pago_Pago`.
- **Vérifié** — fidélité : `NEVER_FALLBACK`, `OVERLOADED`, `SERVER_ERROR`, `isRateLimitMessage`,
  `isCodexCreditsExhaustedMessage` (renommé), `clampMs`, 7 jours, 2 h, parsing daté/heure/secondes/minutes
  identiques à swarm ; `SPEND_CAP_TEXT` généralisé sans nom de fournisseur ; `parseModelLimitMessage`
  générique ; ordre crédits → modèle → limite → connexion → surcharge → serveur. En-têtes de licence en tête.
  Aucun nom de modèle, d'agent ni de fournisseur dans le code (grep).
- **Mineur, laissé** — une erreur nue dont le dernier paragraphe parle d'une limite comme contenu est classée
  `limite` (règle du plan, même que le message montré). Le français « Limite d'usage atteinte » n'est pas
  reconnu comme limite (seule l'heure « réessayer à » est lue). Le cas 8 du plan demande une « fausse
  sous-mission » : le codeur l'a joué en mission simple (même chemin `execute`).
- **Doc** : `docs/api-agents-etat.md` décrit le code ; deux phrases ajoutées pour les deux corrections.

### Contrôles négatifs (code remis après chaque essai, `git status` propre)

Rouge à chaque fois : `noteFailure` retiré de `index.js` ; `clearLimit` retiré de `index.js` ; `noteFailure`
retiré de `workflow-run.js` ; `clearLimit` retiré de `workflow-run.js` ; branche du routeur neutralisée ;
lecture du seul dernier paragraphe retirée ; branche `limite_modele` retirée ; retrait des passages « … »
(nouveau test) ; dates de refus figées retirées (nouveau test). `SKEW_MS = 0` ne rougissait aucun test :
test ajouté (rouge ensuite).

### Tests ajoutés

`tests/swarm-02-relecture.test.js` (4 tests) : extrait cité ; ancien refus sans date ; fichier des sondes
abîmé ; heures limites (décalage < 2 min, minuit, 12 AM, 12:30 PM, date impossible).

### Totaux (après d477040)

- Fichiers du lot + existants nommés (`swarm-02-limites`, `swarm-02-relecture`, `probe-routing`,
  `sonde-refus-auth`, `career-failure`) : verts ; lot + relecture : 16/16 sous cinq fuseaux.
- Phase unitaire : `ℹ tests 1627`, `ℹ pass 1624`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 2`, `ℹ todo 1`,
  `FIN phase unitaire : code 0 (durée 196 s)` (1 611 + 12 du lot + 4 de relecture ; le bloc « failing tests »
  du journal ne liste que le test « à faire » connu de `review2-lecture-18-11`). Journal supprimé.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier
  code style! ».

### Points à trancher par le manager

1. « Agent arrêté : … » jamais reconnu comme erreur nue (`failure.js` et `limits.js`) : corriger les deux
   ensemble ? (change le message montré).
2. Le message montré (`usageLimitMessage`) lit encore les extraits « … » cités dans l'erreur : même défaut
   que celui corrigé ici, dans `failure.js` (hors lot).
3. `chooseAgent` n'écarte pas pour la limite du seul modèle demandé (relevé par le codeur, hors plan).

Verdict : `bon_a_integrer`.
