# Sondes du manager (Claude) — 27/10, 11:30–11:38

Pages FICTIVES servies sur 127.0.0.1 ; via Playwriter, seul l'onglet créé par `ownerTransport` est touché.

| Sonde | Résultat |
|---|---|
| `manager-visibility.mjs` (Playwright via `ownerTransport`) | onglet agent `visibilityState: hidden` dès sa création ; `click({force:true})` « réussi » en 134 ms, compteur **0** ; clic normal : délai de 3 s dépassé, compteur 0. `newCDPSession` refusé par notre transport (`Target.attachToBrowserTarget`). |
| `manager-screencast.mjs` (CDP brut via `ownerTransport`) | `hidden`, `requestAnimationFrame` figé (1 image) ; `Input.dispatchMouseEvent` sans effet ; `Page.startScreencast` accepté mais l'onglet reste `hidden`, rAF figé, clic souris toujours sans effet. |
| `manager-bringtofront.mjs` | `Target.activateTarget` refusé par Playwriter 0.7.0 (« Not allowed ») ; `Page.bringToFront` accepté sans aucun effet (`hidden`, rAF figé, clic 0). |
| `manager-isolated-hidden.mjs` (Chrome isolé, onglet créé en arrière-plan par `Target.createTarget({background:true})`) | `visible` et cliquable en headless ET en fenêtre, même sans les options anti-arrière-plan de Playwright : **le Chrome isolé ne reproduit pas l'onglet caché de Playwriter**. |

Lecture des sources : Playwriter amont (`remorses__playwriter@6489336`, 0.9.0 ; installé : 0.7.0) crée lui aussi ses
onglets avec `active:false` (`extension/src/background.ts:1136-1150`) ; son test
`playwriter/src/screencast-background-tab.test.ts` porte sur un onglet d'abord actif puis mis en arrière-plan, pas
sur un onglet jamais affiché. Aucune solution amont repérée pour un onglet créé caché.
