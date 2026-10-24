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
- En Chrome partagé, la plateforme ouvre **son propre onglet**, ne liste ni ne touche les onglets existants,
  ferme seulement le sien et ne ferme jamais le navigateur. Endpoint CDP non local refusé.

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

Le contexte CDP est désormais propre à la plateforme, y compris en connexion à Chrome partagé : aucun
cookie ni worker du contexte utilisateur n’est réutilisé. JavaScript et service workers sont désactivés ;
les sites qui en dépendent ne sont pas pris en charge par ce fournisseur sûr. Toutes les ressources et
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
