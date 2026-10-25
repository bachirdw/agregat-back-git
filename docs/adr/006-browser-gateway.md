# ADR 006 — Browser Gateway : capacités typées, politique imposée par le code, Playwriter comme simple transport

Date initiale : 25 octobre 2026 (sprint 04). Actualisé le 26 octobre 2026 (docs-01). Statut : accepté, périmètre sécurisé ; exception propriétaire dans l’[ADR 008](008-local-owner-mode.md).

## Contexte
Le serveur MCP de Playwriter (`remorses/playwriter`, `MCP.md`) expose un outil `execute` qui exécute du
**code Playwright arbitraire** dans le Chrome de l'utilisateur, avec ses sessions authentifiées. Le relais
local écoute sur `127.0.0.1:19988` et accepte `chromium.connectOverCDP('http://127.0.0.1:19988')` (README,
section « Playwright API »). Le relais envoie par défaut une télémétrie anonyme (désactivable par
`PLAYWRITER_TELEMETRY=0` ou `DO_NOT_TRACK=1`, `playwriter/src/telemetry.ts`).

## Périmètre actuel

Les garanties ci-dessous concernent le **mode sécurisé** (`ownerMode=false`). Le mode propriétaire
local utilise `owner-transport.js`, partage le profil, active JavaScript et supprime les approbations ;
il est opérationnel dans un périmètre de confiance différent, décrit dans l'ADR 008. Le refus Playwriter
sécurisé et la navigation Playwriter propriétaire sont deux comportements distincts et testés.

## Décision
- Ne **jamais** exposer `execute` (ni aucune évaluation de script) aux agents. Playwriter est utilisé comme
  **transport CDP** : la plateforme s'y connecte (`CdpBrowser({ endpoint })`) et n'expose que des capacités
  typées du registre (`browser.navigate/snapshot/extract/click/type/upload/download`).
- La `BrowserGateway` impose, dans le code : contrat zod strict par capacité, capacités accordées par run,
  HTTPS + domaines autorisés (sous-domaines inclus), refus des IP directes, ports non standard, identifiants
  dans l'URL, résolution DNS vers réseau privé (SSRF/rebinding), redirections HTTP revérifiées une à une
  (Playwright ne route pas les requêtes de redirection — trouvé par un test sur Chrome réel), contrôle de
  l'URL finale, fichiers confinés au dossier du run (liens symboliques résolus), taille de téléchargement.
- Toute action `write` exige une décision humaine sauf pré-autorisation explicite ; toute action **sensible**
  (soumettre, postuler, envoyer, payer, champ mot de passe ou carte, fichier) exige **toujours** une décision
  humaine, même pré-autorisée. La demande d'approbation contient le sélecteur et la longueur du texte,
  pas sa valeur ; cela n'est pas une garantie d'absence de ce texte dans les sorties ou journaux du CLI.
- Les sorties issues des pages sont marquées `untrusted` avec un avertissement d'injection ; secrets et
  numéros de carte masqués, texte tronqué.
- Le processus MCP demande les décisions à l'API locale (pont d'approbation à jeton aléatoire par run, en
  mémoire uniquement) ; elles apparaissent dans la même interface que les permissions ACP.
- En connexion CDP, la plateforme ouvre **son propre onglet** et un contexte dédié par défaut,
  ferme uniquement ses ressources et ne ferme jamais le navigateur. Endpoint CDP non local refusé.

## Modes (`AGENT_PLATFORM_BROWSER`)
- `fixture` (défaut) : démonstrateur sans réseau ni navigateur.
- `isolated` : Chrome headless avec profil jetable (`AGENT_PLATFORM_CHROME_PATH`). **Testé réellement.**
- `playwriter` : relais Playwriter local (`AGENT_PLATFORM_CDP_ENDPOINT`, défaut `http://127.0.0.1:19988`).
  **INCOMPATIBLE en mode sécurisé avec le relais réel 0.7.0** : refus avant connexion CDP. L'extension est installée et
  connectée ; le smoke vérifie le refus sûr et la conservation des onglets (playwriter-01 ci-dessous).
  Le Chrome partagé via CDP classique reste testé avec un profil temporaire et une session CDP d'onglet effective.

## Alternatives rejetées
- Donner `execute` de Playwriter aux agents : contrôle impossible des effets et des données.
- Playwright MCP (Microsoft) en mode extension : bon candidat, mais même problème de granularité côté
  politique ; reste une alternative de transport.
- Confirmations par consignes de prompt : contournables ; ici la décision est imposée par la gateway.

## Limites connues
- Les ressources sont satisfaites par le transport HTTP de la plateforme, avec IP DNS validée épinglée ;
  en contexte dédié, les cookies proviennent uniquement du contexte propre à la plateforme. Le partage
  explicite décrit plus bas réutilise les cookies utilisateur.
- La détection d'élément sensible est heuristique (mots-clés FR/EN, types de champ) : en cas de doute, une
  action `write` demande déjà une décision humaine par défaut.
- Pas encore de liste blanche par onglet existant (accès aux onglets de l'utilisateur volontairement exclu).

## Durcissement de la relecture review-night

Par défaut, le contexte CDP est propre à la plateforme, y compris en connexion à Chrome partagé : aucun
cookie ni worker du contexte utilisateur n’est réutilisé. JavaScript et service workers sont désactivés.
Le sprint 09 ajoute les exceptions explicites ci-dessous pour les sites nécessitant des scripts ou une session utilisateur. Toutes les ressources et
iframes passent par le filtre du contexte installé avant la page ; nouveaux onglets et WebSockets refusés.
Les redirections sont suivies manuellement avec contrôle à chaque saut et limite de cinq ; les changements
d’origine sont refusés. Depuis `a299199`, le navigateur rejoint aussi le chemin final de même origine :
servir le corps final sous le chemin initial donnait une base incorrecte aux liens relatifs. La régression
Chrome réelle correspondante est dans `tests/browser-gateway.test.js`.
Les appels de la gateway sont sérialisés et les éléments/pages revérifiés après consentement. La saisie
n’expose plus les valeurs de champs dans la description envoyée à l’approbation. Les téléchargements
n’écrasent jamais un fichier existant et refusent un dossier downloads symbolique.

Cette défense vise les pages hostiles dans le fournisseur. Elle ne constitue pas un bac à sable système :
un CLI natif exécuté sous le compte utilisateur peut lire la configuration MCP (dont le jeton de pont),
appeler les API de décision locales ou utiliser ses outils natifs. Une isolation de processus/réseau et un
canal de décision réservé à l’utilisateur sont requis avant tout usage avec agents non fiables ou en
multi-utilisateurs. Le transport HTTP commun connecte désormais l’adresse validée par DNS (lookup épinglé), sans deuxième
résolution par Chrome ou fetch. Les réponses et leur décompression sont bornées ; le transport ne suit
aucune redirection à l’insu de la politique.


## Options explicites avec consentement (sprint 09)

`RunPolicy` porte `runId`, `allowJavaScript: false` et `allowSharedContext: false`. Les deux options sont
booléennes strictes et ne sont pas des arguments des outils MCP. Pour demander leur activation au démarrage :
`AGENT_PLATFORM_BROWSER_JAVASCRIPT=1` et/ou `AGENT_PLATFORM_BROWSER_SHARED_CONTEXT=1` (cette dernière exige
un endpoint CDP, mode `playwriter`). Ce réglage demande une permission ; il ne l'accorde pas.

Avant toute ouverture, la gateway exige une décision humaine **distincte et sensible par option**
(`browser.enableJavaScript`, `browser.shareContext`), via le pont d'approbation existant. Absence de pont,
refus, annulation ou expiration : aucun lancement. Les événements `permission` et `permission_resolved`
enregistrent le run, la demande, le risque affiché et la décision dans SQLite. Les préautorisations
`autoApprove` n'ont aucun effet sur ces options. Un run sans identifiant ne peut pas les activer.

Le consentement effectif reste privé au provider, lié à l'identité de la politique et à son JSON complet.
Il n'est jamais sérialisé dans `RunPolicy`. Un autre run, un autre provider, une politique modifiée ou une
reconnexion après arrêt nécessitent un nouveau consentement. Toute modification pendant la décision ou
fermeture concurrente invalide la préparation. Le partage du navigateur CDP (transport) reste possible sans
partager le contexte utilisateur (cookies/sessions).

Avec `allowSharedContext`, seul notre nouvel onglet utilise le contexte CDP par défaut. Le filtre laisse
les onglets existants continuer ; les popups de notre page sont refusés. Les réglages CDP JavaScript et
bypass des service workers visent notre page, avec session CDP maintenue jusqu'à sa fermeture (la détacher
annule ces réglages). Les WebSockets de notre page sont bloqués. À la fermeture, les handlers de routage et
l'écouteur sont retirés ; le contexte utilisateur et ses onglets restent ouverts.

**Risques consentis et limites** : les cookies et sessions du contexte partagé sont accessibles aux pages
autorisées. Des GET ou scripts sur ces domaines peuvent produire des effets automatiques ; l'approbation
ne prétend pas rendre JavaScript sans effet. Les requêtes sans frame (notamment certains workers/premiers
popups) restent refusées au niveau du contexte partagé et peuvent perturber d'autres activités ; le mode
isolé est recommandé. Les requêtes identifiées des onglets existants ne sont pas filtrées par notre politique.
Le partage ne convient pas à deux runs simultanés dans le même contexte (leurs routes pourraient interférer).
Les limites d'isolation OS et de confiance du canal de décision décrites plus haut restent applicables.

Preuves : `tests/browser-gateway.test.js` (défauts, refus sans consentement, accord, refus partiel,
non-transfert inter-run, mutation, fermeture, scripts réels et contexte partagé temporaire avec onglet
utilisateur préservé) ; `tests/approval-bridge.test.js` (MCP → décision → événements persistés, jeton lié
au run, annulation pendant le consentement). Cette validation historique ne prouvait pas la compatibilité
avec l'extension Playwriter ; voir la correction playwriter-01 ci-dessous.

## Fiabilité du démarrage isolé (sprint 09)

Sous charge (huit Chrome jetables simultanés), `launch()` puis `browser.newContext()` a bloqué avant
navigation dans deux essais tracés sur 64 ; sa fermeture gracieuse attendait également. Le démarrage
isolé utilise désormais `launchPersistentContext('', options)` : malgré son nom, le chemin vide demande
un profil temporaire géré/nettoyé par Playwright, jamais le profil utilisateur. Le contexte et la page
initiale about:blank sont créés dans la deadline `startupTimeoutMs` (30 s par défaut). Les gardes sont
installées avant la première navigation, puis la page initiale est réutilisée. Les ports du site de test
restent aléatoires. Le reset crée ensuite une page dans ce même contexte.

Après correction : 64/64 essais du même scénario mot de passe avec concurrence 8, sans skip. Traces,
synthèses et banc reproductible : `.manager/reports/sprint-09-evidence/`. Ce résultat établit la disparition
du blocage observé dans ce banc, pas une garantie universelle sur tous les binaires Chrome/charges.
Un exécutable totalement muet qui ignore même Browser.close provoque bien le rejet à la deadline, mais
sa destruction gracieuse peut être retardée par Playwright ; la fixture de test est arrêtée explicitement.

## Corrections de la relecture review-09

Le lancement est unique par provider, même pour plusieurs `ensure` concurrents. La fermeture révoque
immédiatement le consentement, attend le lancement en cours et nettoie ses ressources ; chaque frontière
asynchrone revérifie la fermeture et la politique. Un résultat tardif après expiration est fermé sans être
adopté. Une erreur d'installation des gardes ferme le contexte et conserve l'erreur d'origine. Une deadline
globale couvre aussi les étapes CDP `connectOverCDP`, `newContext`, les gardes et `newPage`.

Le client Playwright `connectOverCDP` est déconnecté à la fermeture, y compris lorsqu'il arrive après la
deadline. Pour la version épinglée, son `browser.close()` ferme le transport CDP et ses fichiers temporaires,
sans envoyer la commande CDP `Browser.close` au Chrome distant (`playwright-core/lib/coreBundle.js`,
`_connectOverCDPImpl`). Le test réel vérifie `isConnected() === false`, puis retrouve les onglets et leur
titre via un appel HTTP indépendant ; le processus Chrome temporaire reste vivant. Les objets Page de
l'ancien client ne doivent plus être utilisés après cette déconnexion.

Ces corrections ne garantissent pas la destruction d'un exécutable arbitraire qui ignore le protocole,
ni une fermeture bornée si le pair bloque aussi ses opérations de nettoyage. L'isolation des processus
et le canal humain protégé restent nécessaires contre un CLI natif hostile.


## Compatibilité réelle et refus sûr (playwriter-01)

Le correctif manager 64374e9 acceptait une session CDP d'onglet absente grâce au routage/CSP. Cette solution
est **retirée** : un service worker préexistant peut synthétiser un document sans passer par `route.fulfill`,
sans la CSP ajoutée, avec JavaScript actif. La régression sur un profil jetable reproduit le titre
`FICTIF SCRIPT EXECUTED`, puis prouve que le véritable `Network.setBypassServiceWorker` restaure le document
réseau filtré. Le consentement JavaScript ne dispense pas de ce bypass : le worker compromet aussi le
contrôle réseau. Aucun worker ou état utilisateur n'est inspecté ou supprimé pour ce test.

Toute nouvelle page partagée exige désormais une session CDP d'onglet fonctionnelle, puis le succès de
`Emulation.setScriptExecutionDisabled`, `Network.enable`, puis `Network.setBypassServiceWorker`.
La contre-épreuve réelle a montré que le bypass sans `Network.enable` laissait le worker servir le document ;
le domaine Network doit être activé sur cette session avant son réglage. Chaque échec ferme uniquement
la page créée et déconnecte le client ; aucune page exploitable n'est conservée. La CSP et le refus des
requêtes script restent des défenses supplémentaires pour les réponses réseau.

Sur un endpoint HTTP identifié par `/json/version` comme `Playwriter/*`, le fournisseur refuse même avant
`connectOverCDP`. Ce précontrôle évite l'auto-attachement de Playwright aux cibles existantes et leur
initialisation. Sans partage consenti, l'erreur explique l'absence de contexte isolé et le consentement
nécessaire ; elle précise également que le partage ne résout pas l'incompatibilité. Avec partage consenti,
la navigation reste refusée pour protection CDP indisponible. Les versions Playwriter futures restent
refusées jusqu'à validation d'un adaptateur dédié. Un endpoint WebSocket ne permet pas cette identification
HTTP anticipée ; la protection CDP obligatoire reste appliquée, mais ce chemin n'est pas validé pour
l'extension ni utilisé dans le smoke autorisé.

### Méthodes réellement traitées dans le code inspecté

Installation effective : `/Users/diaw/.npm-global/lib/node_modules/playwriter`, paquet 0.7.0. Le chemin
renvoyé par `npm root -g` (`/usr/local/lib/node_modules`) ne contenait pas ce paquet. Clone consulté :
`remorses__playwriter`, commit `6489336628e6737e32a59f25ed270622400cb277`. Le code installé fait foi
pour l'analyse de cette installation ; le clone est une comparaison, pas une version supposée identique.

| Méthode | Traitement constaté | Portée de la preuve |
|---|---|---|
| `Browser.getVersion` | Réponse synthétique `Chrome/Extension-Bridge` | `dist/cdp-relay.js:504` ; `/json/version` réel annonce `Playwriter/0.7.0` |
| `Target.getTargets`, `Target.getTargetInfo` | Inventaire des cibles connectées | `dist/cdp-relay.js:568–598`, inspection ; pas de lecture de contenu |
| `Target.attachToTarget` | Renvoie le sessionId existant d'une cible connectée | `dist/cdp-relay.js:554` ; ne suffit pas au chemin public `newCDPSession` de Playwright |
| `Target.createTarget`, `Target.closeTarget` | Relais vers `chrome.tabs` création/fermeture | `dist/cdp-relay.js:599–621`, `dist/extension/background.js:3147–3170` ; pas exécuté par notre smoke |
| `Target.setAutoAttach` | Transmis aux onglets connectés ; peut créer un onglet initial | `dist/cdp-relay.js:531`, `dist/extension/background.js:3112` ; raison du précontrôle sans attachement |
| `Browser.setDownloadBehavior` | Comportement mémorisé et appliqué aux cibles de l'extension | `dist/cdp-relay.js:513` ; portée plus large que notre onglet, autre raison de ne pas attacher le client au relais |
| `Target.createBrowserContext`, `Target.attachToBrowserTarget` | Pas de traitement spécial ; absence de cible → `No tab found` | `dist/extension/background.js:3175` ; erreurs réelles du manager dans le brief, reproduites par faux relais |
| `Emulation.setScriptExecutionDisabled`, `Network.setBypassServiceWorker`, `Fetch.*` | Commandes ciblées transmises à `chrome.debugger.sendCommand` | `dist/extension/background.js:3180–3195` ; pas une preuve de session publique Playwright fonctionnelle |

Playwright 1.64.1 : `coreBundle.js:40194` appelle `_clientRootSession()` pour `newCDPSession(page)` ;
`:36323` exige `Target.attachToBrowserTarget`. Le routage réseau n'ajoute pas le bypass worker à cette
page (`:39018` ne traite que la page interne de storage state). Aucun champ privé Playwright n'est utilisé
pour contourner ces contrats. Le mode propriétaire maintient désormais une session CDP directe ciblée via `owner-transport.js`.
Il ne rétablit pas les garanties sécurisées ci-dessus : les gardes du provider y sont désactivées.
Ses tests de cycle de vie et de périmètre sont dans `tests/owner-transport.test.js`.

### Preuves et limites

- `tests/browser-gateway.test.js` : faux relais sans extension, refus de chaque étape de protection, aucun repli
  partagé silencieux, précontrôle HTTP sans WebSocket ; documents réseau srcdoc/data/blob/javascript,
  cache préchauffé, CSP meta permissive et contre-épreuve JS active ; worker fictif hostile et bypass réel.
- Le bouton sensible existant de la page locale est testé sur Chrome isolé par la suite : refus humain,
  aucune soumission, puis accord explicite. Ce test ne prétend pas fonctionner via l'extension refusée.
- `PLAYWRITER_TELEMETRY=0 node scripts/playwriter-smoke.js` et le test optionnel `PLAYWRITER_LIVE=1` :
  relais réel 0.7.0, refus des deux modes, liste complète des identifiants d'onglets macOS identique avant/après.
  Aucun titre, URL, cookie ou session d'onglet existant n'est lu. Aucune navigation n'est exécutée.
- Les sorties brutes et erreurs intermédiaires sont dans `.manager/reports/playwriter-01-evidence/` ;
  journal et état final dans `.manager/reports/playwriter-01.md`. Un smoke vert valide une incompatibilité
  traitée sûrement ; **le statut extension sécurisé reste INCOMPLET (incompatible), tandis que le propriétaire a une preuve réelle historique distincte**.
