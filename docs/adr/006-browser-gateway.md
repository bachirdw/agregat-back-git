# ADR 006 — Browser Gateway : capacités typées, politique imposée par le code, Playwriter comme simple transport

Date : 25 octobre 2026 (sprint 04). Statut : accepté.

## Contexte
Le serveur MCP de Playwriter (`remorses/playwriter`, `MCP.md`) expose un outil `execute` qui exécute du
**code Playwright arbitraire** dans le Chrome de l'utilisateur, avec ses sessions authentifiées. Le relais
local écoute sur `127.0.0.1:19988` et accepte `chromium.connectOverCDP('http://127.0.0.1:19988')` (README,
section « Playwright API »). Le relais envoie par défaut une télémétrie anonyme (désactivable par
`PLAYWRITER_TELEMETRY=0` ou `DO_NOT_TRACK=1`, `playwriter/src/telemetry.ts`).

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
  humaine, même pré-autorisée. Le texte saisi n'est jamais montré ni stocké.
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
  Même code que le mode « Chrome partagé via CDP », testé avec un Chrome lancé en débogage distant sur un
  profil temporaire ; **non testé avec l'extension Playwriter elle-même** (non installée, choix de
  l'utilisateur requis).

## Alternatives rejetées
- Donner `execute` de Playwriter aux agents : contrôle impossible des effets et des données.
- Playwright MCP (Microsoft) en mode extension : bon candidat, mais même problème de granularité côté
  politique ; reste une alternative de transport.
- Confirmations par consignes de prompt : contournables ; ici la décision est imposée par la gateway.

## Limites connues
- Les ressources sont satisfaites par le transport HTTP de la plateforme, avec IP DNS validée épinglée ;
  les cookies proviennent uniquement du contexte dédié de la plateforme.
- La détection d'élément sensible est heuristique (mots-clés FR/EN, types de champ) : en cas de doute, une
  action `write` demande déjà une décision humaine par défaut.
- Pas encore de liste blanche par onglet existant (accès aux onglets de l'utilisateur volontairement exclu).

## Durcissement de la relecture review-night

Par défaut, le contexte CDP est propre à la plateforme, y compris en connexion à Chrome partagé : aucun
cookie ni worker du contexte utilisateur n’est réutilisé. JavaScript et service workers sont désactivés.
Le sprint 09 ajoute les exceptions explicites ci-dessous pour les sites nécessitant des scripts ou une session utilisateur. Toutes les ressources et
iframes passent par le filtre du contexte installé avant la page ; nouveaux onglets et WebSockets refusés.
Les redirections sont suivies manuellement avec contrôle à chaque saut et limite de cinq ; les changements
d’origine sont refusés (le document satisfait par route.fetch garderait sinon l’origine initiale).
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
au run, annulation pendant le consentement). L'extension Playwriter reste non validée dans cette session.

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
