# Correctif WebSocket en mode propriétaire (10/11, ~04:25-04:50 AEDT)

Branche `audit-ws` (worktree `agregat-back-audit-ws`). Ce correctif traite le point resté ouvert dans
`correctifs-fix5.md` (« ce qui reste ») et dans `SYNTHESE.md` : en mode propriétaire, les messages
WebSocket ne passaient pas par le garde réseau.

Toutes les épreuves ont été faites sur des pages et un serveur WebSocket FICTIFS locaux (`ws` sur
127.0.0.1, port choisi par le système). Deux navigateurs ont servi :
- Chrome headless isolé ;
- un Chrome headless jetable joint par CDP (`--remote-debugging-port=0`), qui passe par le transport
  propriétaire (`owner-transport.js`, `provider.name === 'playwriter-owner'`).

Il n'y a eu aucun agent réel, aucune clé, aucun réseau externe. Le vrai relais n'a jamais été utilisé.
Les ports 19988, 4310-4312, 4321 et 5173-5175 n'ont jamais servi.

Fichiers touchés :
- `packages/browser-gateway/cdp.js` ;
- `packages/browser-gateway/index.js` ;
- les tests `tests/audit-ws.test.js` (Chrome) et `tests/audit-ws-trames.test.js` (unitaire) ;
- la liste `BROWSER` de `scripts/run-tests.js`.

Rien n'a été touché dans `packages/orchestrator/` ni dans `domain-packs/`.

## 1. Constat vérifié (rouge avant)

Page FICTIVE de messagerie :
- un WebSocket vers son propre serveur ;
- un battement de présence toutes les 150 ms ;
- un indicateur de frappe à chaque saisie ;
- un bouton « Envoyer » hors formulaire (`type="button"`) et un bouton icône (`aria-label="Envoyer le
  message"`), qui envoient `{type:'message', text}` par le WebSocket.

Sur HEAD (`d93ee0b`), l'agent tape le message puis clique « Envoyer ». Le clic est classé `candidate` :
aucune carte avant le clic, et seule une écriture HTTP déclenchée par ce clic attend la carte. Le
message part sans aucune carte : 0 carte, 1 message reçu par le serveur FICTIF. Même chose avec le
bouton icône.

Ce qui était déjà couvert après fix5 : Entrée dans un textarea ou un contenteditable hors formulaire
demande la carte avant la touche, et la touche n'est pas pressée en cas de refus. Le test « Entrée…
avant la touche » est vert avant et après.

Ce qui manquait :
- les clics `candidate` (« Envoyer » hors formulaire, bouton icône) ;
- les clics `plain` ;
- Entrée dans un champ hors formulaire (`field` → `candidate`) ;
- les autres touches (Ctrl+Entrée).

Le message envoyé par WebSocket dans ces cas n'était vu par rien.

## 2. Mécanisme retenu : `routeWebSocket` + verdict par trame (`cdp.js`)

En mode propriétaire, `guard()` installe, à côté de la route HTTP :

```js
await this.context.routeWebSocket('**/*', (socket) => this.#guardSocket(socket));
```

Chaque WebSocket des onglets de la mission est relayé : `connectToServer()` fait la vraie connexion
depuis la page (mêmes cookies, même origine). Les trames du serveur vers la page passent sans
changement. Chaque trame de la page vers le serveur passe par `#socketHold`. Elle est **retenue** pour
la carte d'envoi seulement si les quatre conditions suivantes sont réunies :

1. **Fenêtre** : elle part pendant un `browser.click` ou un `browser.press` de l'agent, ou dans les
   8 s qui suivent. Toute autre action de l'agent ferme cette fenêtre : saisie, navigation…
   (`this.socketAction`, posé dans `#perform`, fin datée dans `perform`).
2. **Pas une étape** : l'action n'est pas une étape de formulaire (`formStep`, comme pour HTTP).
3. **Saisie de l'agent** : elle porte une valeur que l'agent a tapée (3 caractères ou plus) ou un
   fichier qu'il a joint (`socketCarriesAgentData`). Les variantes reconnues sont :
   - celles de `carriesAgentData` : brut, JSON, URL-encodé, base64, fichier ;
   - JSON avec non-ASCII échappé (`é`) ;
   - chaque ligne de 8 caractères ou plus (éditeur riche qui envoie par opérations).
4. **Pas une répétition** : ce socket n'a pas déjà envoyé exactement la même trame hors de toute
   action. Un battement qui répète un nom saisi n'est pas un envoi.

Toutes les autres trames passent aussitôt, sans carte : présence, frappe, accusés de lecture,
abonnements, brouillon synchronisé pendant la frappe. Elles passent aussi pendant qu'une trame retenue
attend sa carte : le site ne tombe pas faute de battement.

Une trame retenue suit `#decideSocketFrame` :
- **Couverte par l'accord du clic ou de la touche** : c'est la couverture fix5 (`this.cover` : même
  site, nombre borné, 8 s, fermée par l'action suivante). Elle part sans nouvelle carte. La première
  est comptée **une fois** au Bilan comme soumission de l'appel (`submissions`, hôte seul, `status:
  null` : pas de statut HTTP en WebSocket). Les suivantes sont tracées en écritures automatiques.
- **Sinon** : la carte `browser.send` (`method: 'WEBSOCKET'`, adresse et corps masqués comme pour
  HTTP), rattachée à l'appel du clic (`origin`). Une rafale partage une seule question
  (`sendDecision`, commun avec HTTP).
  - **Refus** : la trame ne part pas.
  - **Accord** : elle part une fois et est comptée une fois. L'accord couvre une trame de plus vers le
    même site (un message envoyé en deux trames : une carte, un envoi).

L'ordre est gardé entre trames retenues d'un même socket. Une trame libre peut doubler une trame
retenue.

## 3. Repli si le transport ne sait pas router les WebSocket (`index.js`)

Si `routeWebSocket` échoue, `provider.socketGuardFailed` garde la raison. En mode propriétaire, le
classement se fait alors avant l'action :
- un clic `candidate` (hors lien `<a>`) devient `submit` : la carte vient avant le clic ;
- Entrée dans un champ hors formulaire (`field`) devient `submit`.

Ce repli ajoute des cartes plutôt que d'en retirer. Il n'est jamais actif quand le garde est en place.

## 4. Transport propriétaire

`routeWebSocket` fonctionne à travers `owner-transport.js`. C'est vérifié avec un Chrome headless jetable
joint par CDP :
- `socketGuardFailed === null` ;
- message retenu ;
- refus : rien ne part ;
- accord : le message part une fois ;
- la présence continue.

**Non vérifié** : le vrai relais Playwriter (extension `chrome.debugger`), interdit ici.
`routeWebSocket` y a besoin de `Page.addScriptToEvaluateOnNewDocument` et `Runtime.addBinding`,
gérés par `chrome.debugger`. Deux cas sont possibles :
- si l'installation échoue, le repli du point 3 s'applique ;
- si elle réussit mais que le relais ne renvoie pas les appels de la liaison, les WebSocket des pages
  resteraient sans connexion. Ce serait une panne visible, pas un envoi sans carte.

À vérifier lors d'un essai réel du propriétaire sur une messagerie : la page reçoit-elle bien ses
messages ?

## 5. Tests

`tests/audit-ws.test.js` (Chrome, ajouté à `BROWSER`). « Rouge avant » : fichiers `cdp.js` et `index.js`
de HEAD remis le temps du test.

| Test | Avant | Après |
|---|---|---|
| « Envoyer » hors formulaire : 1 carte, refus → aucun message ; présence et frappe libres, la présence continue pendant la carte | rouge (0 carte, message parti) | vert |
| Bouton icône d'envoi, refus → rien ne part | rouge | vert |
| Accord → le message part une fois, compté une fois (soumission `status: null`), aucune écriture automatique en plus, la réponse du serveur revient à la page | rouge | vert |
| Entrée dans la zone de message : carte avant la touche (déjà couvert par fix5) | vert | vert |
| Clic ordinaire « Marquer comme lu », trame sans saisie : passe sans carte (négatif) | vert | vert |
| Brouillon synchronisé pendant la frappe, battement qui porte le nom saisi : passent sans carte (négatif) | vert | vert |
| Entrée accordée (carte avant la touche) : 1 seule carte, le message part une fois, compté sur l'appel | rouge (non compté) | vert |
| Repli : transport sans `routeWebSocket` → carte avant le clic « Envoyer », refus → le clic n'a pas lieu | rouge | vert |
| Transport propriétaire (Chrome jetable par CDP) : retenu, refus → rien, accord → une fois, présence libre | rouge | vert |

`tests/audit-ws-trames.test.js` (unitaire, sans Chrome) : formes reconnues (JSON, `é`, ligne d'un
éditeur riche, binaire, socket.io URL-encodé) et trames neutres (présence, frappe, accusés, vides,
saisies trop courtes).

Résultats (après le commit `5b1befc`, 10/11 vers 04:40 AEDT) :

| Vérification | Résultat |
|---|---|
| Tous les tests Chrome en série (commande du brief, plus `audit-ws.test.js`) | 237/237 verts, 0 échec |
| Phase unitaire sans Chrome (fichiers hors `BROWSER`, concurrence 4) | 1003 verts, 2 ignorés, 0 échec |
| `npm run check` | OK |
| `npm run format:check` | OK |

## 6. Limites connues (non traitées)

- **WebSocket ouverts dans un Worker : NON COUVERT, vérifié.** `routeWebSocket` agit dans les pages
  et leurs frames seulement. Épreuve FICTIVE (Playwright 1.64, Chrome headless, page et Worker qui
  envoient chacun une trame) :
  - le serveur a reçu `depuis-page` et `depuis-worker` ;
  - la route n'a vu que `depuis-page`.

  Une messagerie qui envoie depuis un Worker (ou un SharedWorker) échappe encore à la carte.

  Pistes pour un prochain correctif, non faites cette nuit (risque de casser des sites, règle b) :
  - observer `Network.webSocketFrameSent` du Worker par CDP : on le verrait, sans pouvoir le retenir ;
  - remplacer `WebSocket` dans les Workers via `Target.setAutoAttach` + `Runtime.evaluate` avant
    leur script.
- **Envoi différé de plus de 8 s** après le clic (file d'attente hors ligne, envoi programmé) : il
  passe, comme pour HTTP.
- **Faux positifs possibles**, au titre de « dans le doute, une carte » :
  - autocomplétion par WebSocket (choix d'une suggestion qui renvoie le texte saisi) ;
  - trame d'une nouvelle page, ouverte par un clic, qui porterait une saisie antérieure de l'agent.
- **Saisies reconnues** : seules celles de `browser.type` et `browser.fillForm` (`agentValues`, les
  40 dernières) et les fichiers joints. Un texte collé par script de la page, ou fortement transformé
  (chiffré, compressé), n'est pas reconnu.
- **Mode non propriétaire** : inchangé. Les WebSocket y sont fermés (`socket.close()`).
- **Contexte des pages de l'utilisateur** : la route est posée sur le contexte. Le transport
  propriétaire n'y expose que les onglets de la mission.

## 7. Commits

- `5b1befc` [audit-ws] Retenir jusqu'à la carte un message de l'agent envoyé par WebSocket
  (`cdp.js`, `index.js`, deux fichiers de test, liste `BROWSER`).
- Ce rapport.
