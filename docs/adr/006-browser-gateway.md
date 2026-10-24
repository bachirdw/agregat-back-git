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
- `route.fetch` pour les documents de navigation passe par la pile réseau de Playwright ; à revalider avec
  le relais Playwriter (cookies de session de l'utilisateur).
- La détection d'élément sensible est heuristique (mots-clés FR/EN, types de champ) : en cas de doute, une
  action `write` demande déjà une décision humaine par défaut.
- Pas encore de liste blanche par onglet existant (accès aux onglets de l'utilisateur volontairement exclu).
