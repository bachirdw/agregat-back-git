# Preuves synthétiques — reuse-00

Page **FICTIVE** servie exclusivement sur 127.0.0.1 par `aria-ref-proof.mjs`. Aucun site réel ni donnée personnelle. Les journaux complets sont conservés localement à côté de ce fichier (`*.log`, ignorés par Git) ; les faits décisifs sont reproduits ci-dessous.

| Commande | Code | Résultat |
|---|---:|---|
| `node aria-ref-proof.mjs isolated` sous bac | 1 | Chrome SIGABRT/EPERM au lancement. |
| `node aria-ref-proof.mjs isolated` hors bac | 0 | Snapshot bouton `[ref=e2]`, clic normal compteur 1, forcé 2, ancien ref après nouveau snapshot 3, onglet caché 4, ancien ref après navigation : timeout. |
| `GET http://127.0.0.1:19988/extension/status` | 0 | `connected:true` ; seul ce booléen est retenu, la réponse brute contenait un profil utilisateur. |
| `node aria-ref-proof.mjs relay` | 0 | Snapshot bouton `[ref=f1e2]` ; clic normal expire ; clic forcé annoncé mais compteur **0** ; clic `aria-ref` caché expire ; `locator.evaluate(el=>el.click())` sur cette ref porte le compteur à **1** ; ancien ref après navigation : « Invalid frame ». |
| `npm test` sous bac | 1 | Phase non-Chrome : 265 réussis / 0 échec / 1 ignoré ; phase Chrome : 55 réussis / 67 échecs, tous à examiner dans `npm-test.log`, avec lancements Chrome SIGABRT/EPERM. |
| `npm test` hors bac | 0 | Phase non-Chrome : 265 réussis / 0 échec / 1 ignoré ; phase Chrome : 122 réussis / 0 échec. |
| `npm run check` | 0 | « Syntaxe JavaScript valide. » |
| `npm run format:check` | 0 | « All matched files use Prettier code style! » |

Le script ne valide pas une correction du gateway : il établit le défaut à corriger par `reuse-01`. Le succès annoncé par `force:true` n'a pas déclenché le gestionnaire de clic de la page fictive via Playwriter. Le résultat du clic DOM a été vérifié par le compteur après l'action.
