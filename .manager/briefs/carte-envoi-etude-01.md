# carte-envoi-etude-01 — Étude chiffrée : comment décider la carte d'envoi (E100, A7) (analyste Opus, lecture seule)

**Aucun code modifié.** Tu écris un seul fichier : `.manager/reports/carte-envoi-etude-01.md` (ne le commite pas).
Le propriétaire tranchera ; l'architecture reste gelée. Ne lance aucun test, aucun navigateur, aucune requête HTTP.

## Contexte
Seule règle intouchable : l'envoi final (candidature, e-mail, message) attend le clic du propriétaire, toujours. Tout
le reste passe sans clic. Aujourd'hui la carte dépend du libellé du contrôle cliqué (`packages/policy-engine/
run-policy.js` : `ownerClickKind`, listes de mots) et de mots dans le chemin de la requête (`packages/browser-gateway/
cdp.js` : garde des écritures, `isSubmitPath`, fenêtre de 8 s, couverture). Trois cycles sur le même symptôme (fausses
cartes pendant une lecture : E89, E93, E100) et un trou (A7 : « Oui » d'une modale hors formulaire). Voir
`.manager/reports/nuit-12-11.md` (« Audit », « Diagnostic ») et le registre (E26, E28, E42, E43, E66, E89, E93, E100).

## À produire
1. **Le corpus des cas réels** : pour chaque défaut du registre et chaque constat des audits des 10/11 et 12/11 qui touche
   la carte d'envoi (fausse carte, carte manquante, carte répétée), une ligne : geste de l'agent, ce que la page a
   envoyé (méthode, même site ou autre site, navigation ou non, corps porteur ou non d'une saisie ou d'un fichier de
   l'agent, délai après le geste), décision actuelle, décision juste. Complète par les événements `permission` réels de
   la base `.data/platform.sqlite` (LECTURE SEULE ; hôtes et chemins seulement, aucune donnée personnelle).
2. **Trois règles candidates**, décrites en une demi-page chacune, sans jargon :
   R1 — l'existant resserré (listes de mots réduites aux verbes, bouton à menu = jamais un envoi) ;
   R2 — la carte décidée par ce qui part : formulaire soumis par navigation, contrôle de soumission d'un formulaire, ou
        corps de requête qui porte une valeur saisie par l'agent ou le fichier qu'il a joint (la passerelle connaît
        `agentFields` et `uploadedFile`) ; les mots ne servent plus que de filet ;
   R3 — un outil explicite `browser_submit` que l'agent doit appeler pour le geste final (toujours carté), tout clic
        ordinaire qui écrit des données de l'agent hors de cet outil étant retenu et signalé.
   Dis pour chacune ce qu'elle exige du code (fichiers, ordre de grandeur), ce qu'elle retire, et ses angles morts
   connus (brouillon enregistré à chaque étape d'un formulaire ; candidature en un clic sans aucune saisie ; télémétrie
   qui répète les mots-clés tapés ; envoi par WebSocket ; iframe d'un autre site).
3. **Le tableau de décision** : chaque cas du corpus × R1, R2, R3 → carte juste, fausse carte, envoi sans carte. Totaux.
4. **Ce que font les références** (`~/Downloads/agent-repos-agregat`, lecture seule) pour le même problème, avec
   références `dépôt/chemin:lignes` : `openclaw__acpx` (politique de permission), `agentgateway__agentgateway`,
   `microsoft__playwright-mcp`, `remorses__playwriter`, `awslabs__cli-agent-orchestrator`.
5. **Recommandation** en dix lignes, avec ce qu'il faudrait mesurer en réel avant de décider, et le plus petit premier
   pas réversible (par exemple derrière une variable d'environnement, désactivée par défaut).
Distingue partout le fait lu ou constaté du jugement. Français, phrases courtes, aucun secret, aucune donnée
personnelle, aucune URL d'offre.
