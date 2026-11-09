# Correctif WebSocket, second tour (ws2) — 10/11, ~05:00-06:20 AEDT

Branche `audit-ws2` (worktree `agregat-back-audit-ws2`, seul écrivain). Suite de `correctifs-ws.md` et de
sa relecture `relecture-ws.md` (10 constats). Décision du manager appliquée telle quelle : le relais
`routeWebSocket` retient ou réordonne du trafic normal (risque Gmail/LinkedIn dans le vrai Chrome) ; il
devient OPTIONNEL et désactivé par défaut, et c'est le REPLI (carte AVANT l'action) qui protège.

Épreuves : pages et serveur WebSocket FICTIFS locaux (`ws` sur 127.0.0.1, port choisi par le système),
Chrome headless isolé, et un Chrome headless jetable joint par CDP (`--remote-debugging-port=0`) pour le
transport propriétaire. Aucun agent réel, aucune clé, aucun réseau externe, jamais le port 19988 ni
4310-4312, 4321, 5173-5175.

Fichiers touchés : `packages/browser-gateway/cdp.js`, `packages/browser-gateway/index.js`,
`tests/audit-ws.test.js`. Rien dans `domain-packs/`, `packages/career-ops/`, `packages/orchestrator/`.

## 1. Relais WebSocket optionnel, désactivé par défaut (`cdp.js`, `guard()`)

- `AGENT_PLATFORM_WS_GUARD=1` : le relais `routeWebSocket` est installé (comportement de `audit-ws`,
  plus les correctifs du §4). Si l'installation échoue, `socketGuardFailed` garde l'erreur et le repli
  s'applique.
- Toute autre valeur, ou variable absente (le défaut) : AUCUN relais. Les sockets de la page restent
  natifs (ni retenus, ni relayés, ni réordonnés). `socketGuardFailed` vaut
  « relais WebSocket non activé (AGENT_PLATFORM_WS_GUARD=1 pour l’activer) : carte avant l’action
  d’envoi », ce qui met le gateway en repli.

## 2. Le repli (défaut) : la carte AVANT l'action d'envoi (`index.js`, `cdp.js`)

Nouveau : le fournisseur sait quels onglets de la mission ont un WebSocket ouvert, par les événements du
navigateur (`page.on('websocket')`, `close`), sans rien relayer (`#watchSockets`, `socketOpen()`). Un
onglet vu pour la première fois après son chargement compte comme « socket peut-être ouvert » (doute →
carte) jusqu'à son document suivant. Un fournisseur qui ne sait pas répondre : doute → carte.

Sur un onglet avec WebSocket ouvert (`socketRisk`), en mode propriétaire, sans relais :

| Action de l'agent | Avant ws2 (défaut = relais) | Après ws2 (défaut = repli) |
|---|---|---|
| Clic « Envoyer » / « Send » / « Répondre »… hors formulaire (`candidate`, pas un lien `<a>`) | pas de carte avant, trame retenue si elle portait la saisie | **carte avant le clic** ; refus → le clic n'a pas lieu |
| Clic sur une icône d'envoi sans libellé (`title`, `data-tooltip`, `data-testid`, `data-icon`, `<svg><title>` disant send/envoyer/submit) | `plain` : rien | **carte avant le clic** |
| Entrée sur le bouton « Envoyer » (`control`) | `candidate` : rien avant | **carte avant la touche** (constat 5) |
| Entrée dans un champ hors formulaire (`field`) | `candidate` | **carte avant** (déjà le cas avec `=0`) |
| Entrée dans un formulaire sans bouton d'envoi, sans autocomplétion, non implicite | `candidate` | **carte avant** (constat 5) |
| Entrée dans un textarea / contenteditable hors formulaire (`message`) | carte avant (fix5) | inchangé |
| Ctrl+Entrée / Cmd+Entrée | refusés par le schéma de `browser.press` (touches permises : flèches, Échap, Début, Fin, Tab, Entrée) | inchangé : refusés, rien n'est pressé (test ajouté) |
| Battement, frappe, accusé de lecture, clic ordinaire (« Marquer comme lu ») | passent (relayés) | passent **nativement**, sans carte ni retard |

Sur un onglet SANS WebSocket ouvert : rien ne change par rapport à fix5 (un « Postuler » / « Envoyer »
hors formulaire ne demande rien avant le clic, et ses écritures HTTP attendent la carte). Règle (b)
préservée : seuls les onglets qui peuvent envoyer par WebSocket reçoivent la carte avant.

Cas fix5 non touchés : formulaires (bouton d'envoi d'un formulaire, Entrée avec bouton désigné, Entrée
implicite, recherche GET), autocomplétion libre (`guardSubmit`), étapes.

Ajout général (tous modes propriétaires) : une icône `plain` dont l'infobulle ou l'icône dit un envoi
devient `candidate` (ses écritures HTTP attendent la carte). Avant, ses écritures HTTP passaient
« accordées et tracées ». Mots retenus, volontairement étroits : `send…`, `envoy…`, `envoi…`, `submit…`,
`soumet…` (pas les classes CSS, pas « post »).

Bilan en repli : après un clic ou une touche ACCORDÉS, la première trame WebSocket nouvelle de la page
(pas un battement déjà vu, chiffres ignorés) est comptée une fois comme soumission de l'appel
(`status: null`) — observée par `framesent`, jamais retenue. Les suivantes couvertes sont tracées.

## 3. Constat 4 : accord après la fermeture du socket (relais activé)

`#guardSocket` suit la fermeture des deux côtés (`socket.onClose` / `server.onClose`, propagation de la
fermeture refaite à la main, codes 1005/1006 non transmis). Une trame accordée sur un socket fermé ne part
pas et n'est **pas** comptée au Bilan ; la couverture d'un accord ne compte rien non plus sur un socket
fermé. Non fait : une ligne explicite « accordé, non parti » au Bilan (le Bilan ne compte simplement rien).

## 4. Sous le drapeau `=1` seulement

- **Constat 1 (fait)** : après un clic `candidate` (ou une Entrée classée ainsi) qui n'a pas demandé de
  carte, sur la même page, la **première trame nouvelle** du socket est retenue pour la carte même sans
  la saisie de l'agent (message chiffré/transformé, pièce jointe, réponse rapide). Une seule par action.
- **Constat 3 (en partie)** : les trames sont comparées chiffres retirés (`/\d+/g` → `#`) : un battement
  horodaté qui porte la saisie n'est plus retenu. Non fait : rejet sans nouvelle carte des autres trames
  retenues après un refus, plafond de trames retenues.
- **Constat 2 (NON fait, reste du mode optionnel)** : le relais Playwright réordonne binaire et texte et
  fait transiter chaque trame reçue par Node. Correctif proposé par la relecture (n'envelopper que
  `WebSocket.prototype.send` par un script d'initialisation, réception native) non entrepris cette nuit.
  C'est la raison même du défaut « relais désactivé » : ne pas activer `=1` sur un site qui mêle binaire
  et texte.

## 5. Tests (`tests/audit-ws.test.js`, Chrome, déjà dans `BROWSER`)

Les tests du relais posent `AGENT_PLATFORM_WS_GUARD=1` et le restaurent (`relay(t)`) ; ceux du repli
retirent la variable (`relay(t, null)`). « Rouge avant » : `cdp.js` et `index.js` de HEAD (`7297f29`)
remis le temps d'une passe : 9 échecs sur 19, tous attendus.

| Test | Avant | Après |
|---|---|---|
| Relais : « Envoyer » → carte **en attente** (approve qui attend une promesse), la présence continue pendant l'attente, refus → rien (corrige le test ~131, constat 9) | vert (le test ne prouvait rien) | vert |
| Relais : icône d'envoi refusée ; accord → une fois, compté une fois ; Entrée accordée ; clic ordinaire | vert | vert |
| Relais : brouillon et battement **horodaté** portant la saisie → sans carte (constat 3) | rouge | vert |
| Relais demandé, `routeWebSocket` qui échoue **à l'installation** → carte avant le clic ET avant Entrée sur le bouton (corrige le test ~278, constat 9) | rouge | vert |
| Variable absente / `=0` → « relais WebSocket non activé », carte avant le clic | rouge / rouge | vert |
| Relais, transport propriétaire (Chrome jetable par CDP) | vert | vert |
| Repli : clic « Envoyer » → carte avant, refus → rien ; battement au rythme (≥ 3 en 600 ms) et frappe sans carte | rouge | vert |
| Repli : icônes sans libellé (`title="Envoyer"` + svg, `data-icon="send"`) → carte avant, refus → rien | rouge | vert |
| Repli : Entrée sur « Envoyer » → carte avant ; refus → rien ; accord → part une fois, compté une fois (`status: null`), aucun battement tracé | rouge | vert |
| Repli : Ctrl/Cmd/ControlOrMeta+Entrée refusés (schéma) ; Entrée seule dans la zone → carte avant | vert | vert |
| Repli : Entrée dans la zone de message → carte avant ; clic ordinaire → aucune carte | vert | vert |
| Repli : page sans WebSocket → « Envoyer » hors formulaire ne demande rien (règle b) | vert | vert |
| Relais : message transformé (sans le texte tapé) après « Envoyer » → retenu, refus → rien (constat 1) | rouge | vert |
| Relais : accord après fermeture du socket → rien ne part, rien compté (constat 4) | rouge | vert |
| Repli, transport propriétaire (Chrome jetable par CDP) : `socketOpen()` voit le socket, présence native au rythme, carte avant le clic « Envoyer », refus → rien | — (ajouté après la passe rouge) | vert |

Résultats : voir §7.

## 6. Restes et limites (documentés, non traités)

- **Repli, socket ouvert par le clic lui-même** (messagerie qui se connecte au premier envoi) : au
  moment du clic aucun socket n'est ouvert, donc pas de carte avant ; le message part sans carte si
  c'est par WebSocket (les écritures HTTP, elles, attendent). À vérifier dans l'essai réel.
- **Repli, faux positifs** (règle « dans le doute, une carte ») : sur une page avec WebSocket, un
  « Postuler » / « Publier » / « Confirmer » de type bouton hors formulaire demande la carte avant le clic,
  même s'il n'ouvre qu'un formulaire. Un onglet repris après son chargement compte comme socket ouvert.
- **Workers** : un WebSocket ouvert dans un Worker n'émet pas `page.on('websocket')` : il n'entre pas
  dans `socketOpen()` (ni dans le relais, déjà noté dans `correctifs-ws.md`).
- **Mode relais (`=1`)** : constat 2 (ordre binaire/texte, latence, `isTrusted`), constat 3 restant,
  constat 8 (iframes d'un autre site via le vrai relais) — non traités ; c'est pourquoi le relais est
  désactivé par défaut.
- **Bilan « accordé, non parti »** : non écrit (on ne compte rien, ce qui reste exact).
- Vrai relais Playwriter : non éprouvé (port 19988 interdit). Le repli n'exige que les événements
  `Network.webSocket*` du navigateur, que Playwright active déjà ; à confirmer à l'essai réel.

## 7. Résultats des vérifications (10/11, 05:08-05:17 AEDT)

| Vérification | Résultat |
|---|---|
| `tests/audit-ws.test.js` + `audit-ws-trames.test.js` (après le dernier changement de `cdp.js`) | 22/22 verts |
| Tous les tests Chrome en série (commande du brief) | 250/250 verts, 0 échec |
| Phase unitaire sans Chrome (fichiers hors `BROWSER`, concurrence 4) | 1011 verts, 2 ignorés, 0 échec |
| `npm run check` | OK |
| `npm run format:check` | OK |

Note : pendant la série Chrome, `cdp.js` a reçu une petite retouche (la fermeture propagée par
`socket.close()` est asynchrone : rejet absorbé, seuls les codes 1000 et 3000-4999 sont transmis). Le
fichier `audit-ws.test.js` a donc été relancé seul ensuite (ligne 1 du tableau).

## 8. Commit

- `[audit-ws2]` Relais WebSocket optionnel (`=1`), repli par défaut avec la carte avant l'action d'envoi,
  constats 1, 3 (en partie), 4 et 5, tests (`cdp.js`, `index.js`, `tests/audit-ws.test.js`, ce rapport).
