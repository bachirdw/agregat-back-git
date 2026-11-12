# carte-envoi-etude-01 — Étude chiffrée : comment décider la carte d'envoi (E100, A7)

Analyste Opus, lecture seule. Aucun code modifié, aucun test, aucun navigateur, aucune requête HTTP. Fichier non commité.

## Journal
- **23:30** Lecture d'AGENTS.md et du brief.
- **23:32** Lecture de `nuit-12-11.md` (« Audit », « Diagnostic »), du registre (E26, E28, E42, E43, E66, E89, E93, E100),
  de `audit-10-11/SYNTHESE.md`, `navigateur-mcp.md`, `relecture-nav.md`, `relecture-ws.md` (constats touchant la carte).
- **23:36** Code lu par extraits : `policy-engine/run-policy.js:1-30, 205-300` (`isFormStep`, `ownerClickKind`, listes de mots) ;
  `browser-gateway/cdp.js:75-265` (`sendsFile`, `carriesAgentData`, `isSubmitPath`), `cdp.js:965-1030` (`#takeCover`),
  `cdp.js:1240-1440` (garde des écritures), `cdp.js:1705-1716` (`#rememberAgentValue`) ; `browser-gateway/index.js:280-300` ;
  `tests/support/apply-page.js:15-50, 88-106` (page FICTIVE).
- **23:40** Base `.data/platform.sqlite` ouverte en `sqlite3 -readonly` : événements `permission`, `permission_resolved`,
  `permission_auto` (hôtes seulement), `browser_evidence.submissions` (hôte, statut).
- **23:43** Dépôts de référence lus par extraits (cinq dépôts du brief).
- **23:46** Rédaction.

Convention : **[fait]** = lu dans le code, un rapport ou la base ; **[jugement]** = avis de l'analyste.

## 1. Corpus des cas réels

### 1.1 Événements `permission` de la base (lecture seule)
[fait] 41 cartes « Approuver l'envoi » du 09/11 au 12/11 (heures UTC dans la base). 41 résolues. Aucune donnée personnelle
relevée : seuls la mission (8 premiers caractères), l'hôte et le chemin aléatoire figurent ci-dessous.

| Groupe | Missions | Cartes | Réponse | Hôte de l'écriture | Nature |
|---|---|---|---|---|---|
| Page FICTIVE, envoi final | 23 missions (f2c6d66b … 32638afc) | 23 (une par mission) | allow | `127.0.0.1:4321` (HTTP 200 relevé dans 12 `submissions` ; les 11 autres déduites des mentions d'hôte dans les événements) | carte juste |
| E89 | 2768fb23 | 1 | deny | `www.linkedin.com` (cible non gardée à l'époque) | fausse carte |
| E93 | 92b0313b | 8 | allow (propriétaire) | `www.linkedin.com` | fausse carte |
| E93 reproduit | 6e620a10 | 7 | deny | `POST www.linkedin.com/<jeton>` (3 jetons distincts) | fausse carte |
| E100 | 43d36353 | 2 | deny | `POST www.linkedin.com/<jeton>` | fausse carte |

Totaux réels : **23 cartes justes, 18 fausses cartes (44 %), 0 envoi réel**. Une carte manquante ne laisse aucun
événement : la base ne peut pas en compter.

[fait] Écritures accordées automatiquement (`permission_auto` `browser.send`, 539) : `www.linkedin.com` 363 (8 missions),
`t.indeed.com` 79, `collector-…protechts.net` 44, `www.youtube.com` 27, `s.indeed.com` 12, `apis.indeed.com` 7,
`au.indeed.com` 4, `au.seek.com` 2, un hôte S3 de dépôt de CV 1. C'est le trafic qu'une règle trop large transformerait
en cartes.

[fait] Page FICTIVE (`tests/support/apply-page.js`) : trois formulaires POST par navigation, même site ; étape 1
(`/step2`, champs saisis, bouton « Suivant ») ; étape 2 (`/step3`, multipart avec le CV) ; étape 3 (`/submit`, bouton
« Envoyer »). Les deux premières portent une saisie ou le fichier de l'agent.

### 1.2 Cas du registre et des audits
Colonnes : geste ; ce qui part (méthode, site, navigation, corps porteur d'une saisie/fichier de l'agent, délai) ;
décision actuelle (code d'aujourd'hui) ; décision juste. Source et nature de la preuve entre crochets.

| # | Source | Geste de l'agent | Ce qui part | Actuelle | Juste |
|---|---|---|---|---|---|
| C1 | E26 [réel, 04/11] | clic « Envoyer » du formulaire final | POST navigation, même site, champs saisis, 0 s | carte | carte |
| C2 | E28 [réel, 04/11] | lecture de résultats LinkedIn/SEEK | POST XHR même site au chargement ou au clic, rien de l'agent | aucune (avant le 05/11 : 4 cartes) | aucune |
| C3 | E42 [réel, 05/11] | « Suivant » étape 2/3 | POST navigation multipart, même site, porte le CV | aucune (étape) | aucune |
| C4 | E43 [réel, 06/11] | `browser_upload` du CV | PUT/POST XHR vers un stockage d'un autre site (S3), porte le fichier, sans clic | aucune (fenêtre de téléversement) | aucune |
| C5 | E66 [réel, 06/11] | clic « Envoyer » accordé, puis le clic échoue | rien | carte | carte |
| C6 | E89 [réel, 11/11] | lecture d'une offre | POST compressé > 100 ko, même site, rien de l'agent | aucune (avant : carte) | aucune |
| C7 | A6 / E89 bis [lu, 12/11] | recherche saisie sur une page, puis clics sur d'autres pages | télémétrie même site après des clics ; peut répéter les mots tapés [jugement] | aucune | aucune |
| C8 | E93 [réel, 11/11] | clic sur une offre de la liste (libellé de toute la carte, « Publication … ») | 8 POST XHR même site, chemin aléatoire, rien de l'agent, < 8 s | aucune (avant : 8 cartes) | aucune |
| C9 | E100 [réel, 12/11] | clic du filtre « Date de publication » | 2 POST XHR même site, chemin aléatoire, rien de l'agent, 4 s | **2 cartes** | aucune |
| C10a | A7 [sonde + lu, 12/11] | « Oui » d'une modale hors formulaire, après une saisie | POST XHR `/api/applications`, même site, porte les réponses saisies | **sans carte** | carte |
| C10b | A7 variante [jugement] | « Oui » / « OK » d'une candidature en un clic, sans aucune saisie | POST XHR même site, rien de l'agent | **sans carte** | carte |
| C11 | nav-mcp n° 1 [sonde, 10/11] | « Postuler » (ouvre le formulaire), combobox, « Oui », « Ajouter une expérience » | aucune écriture d'envoi | aucune (avant : 4 cartes) | aucune |
| C12 | nav-mcp n° 2 [sonde] | « Je postule », « Terminer », « Finish » hors formulaire | fetch POST `/api/candidature/…`, même site | carte (corrigé) | carte |
| C13 | nav-mcp n° 5 [sonde] | clic d'envoi accordé, soumission React différée de 400 ms | POST XHR même site | 1 carte (corrigé ; avant : 2) | 1 carte |
| C14 | relecture-nav n° 1 [sonde] | Entrée dans une zone de message ; Entrée sur la case CGU | POST XHR messagerie (porte le texte) ; POST navigation du formulaire | carte (corrigé) | carte |
| C15 | relecture-nav n° 2 [sonde] | bouton submit « Envoyer » avec `aria-haspopup` | POST `/api/candidature/submit` | carte (corrigé) | carte |
| C16 | relecture-nav n° 3 [sonde] | « Publier » `type=button`, icône, « Ajouter un message » submit | POST `/api/messages`, porte le texte | carte (corrigé) | carte |
| C17 | relecture-nav n° 4 [sonde] | rien ; une iframe d'un autre site relaie des données de la page | POST vers l'origine de l'iframe, porte le CV | carte (décision 4 du 10/11, à confirmer) | carte |
| C18 | relecture-nav n° 5 [sonde] | clic accordé ; la page poste à +3 s et +6 s vers un autre site | POST navigation d'un formulaire caché, autre site | carte ou blocage (corrigé) | carte ou blocage |
| C19 | relecture-nav n° 7 [sonde] | « Je postule » qui écrit deux fois | 2 POST même site | 1 carte (corrigé) | 1 carte |
| C20 | relecture-nav n° 8 [sonde] | « Apply filters », recherche GET, « Supprimer cette expérience » | POST de recherche même site ; peut porter les mots tapés [jugement] | aucune (corrigé) | aucune |
| C21 | relecture-nav n° 9 [lu, probable] | rien ; la page poste le CV seul vers `/apply/<id>/submit` 15 s après le dépôt | POST XHR même site, porte le fichier | carte (chemin) | carte |
| C22 | relecture-ws n° 1 [sonde] | clic « Envoyer » ; message WebSocket chiffré, compressé ou pièce seule | trame WebSocket sans le texte tapé | carte avant le clic si un socket est ouvert et le libellé dit l'envoi | carte |
| C23 | relecture-ws n° 3 [sonde] | clic quelconque ; battement ou brouillon WebSocket horodaté portant une saisie | trames WebSocket répétées | aucune (relais désactivé par défaut) ; 10 cartes en 1,5 s s'il est activé | aucune |
| C24 | relecture-ws n° 8 [lu, probable] | clic « Envoyer » dans une iframe d'un autre site, à travers le vrai relais | trame WebSocket invisible | **sans carte** | carte |
| C25 | nuit-12-11, « non contredit » [non établi] | clic `candidate` ; la page écrit plus de 8 s après, vers un chemin sans mot d'envoi | POST XHR même site | **sans carte** | carte |

Non retenus pour le tableau : A8, A9 (issue d'un envoi accordé, pas la décision de carte).

## 2. Trois règles candidates

### R1 — L'existant resserré
Ce qu'elle dit. On garde la décision par le libellé du contrôle cliqué et par le chemin de la requête. Les listes ne
gardent que des verbes (« publier », pas « publication » ; « soumettre », pas « soumission » ; « apply » reste un verbe,
donc l'exception « filtres » reste). Un bouton à menu (`aria-haspopup`, `aria-expanded`, `menuitem`) n'est jamais un
envoi, **sauf** s'il est le bouton de soumission d'un formulaire (sinon C15 revient).
Code [jugement] : `run-policy.js` seulement (listes, ordre des tests de `ownerClickKind`), environ 30 à 60 lignes, 15 à
25 tests. Une demi-journée.
Ce qu'elle retire : les noms d'action des listes (cause d'E93 et d'E100).
Angles morts : tout libellé inconnu (« Oui », « OK », icône) qui envoie par XHR vers un chemin sans mot (A7) ;
candidature en un clic ; écriture tardive (C25) ; WebSocket dans une iframe d'un autre site. Brouillon à chaque étape et
télémétrie : pas de carte en plus (rien ne regarde le corps). La liste reste ouverte : chaque site réel peut ajouter un
libellé (trois cycles E89, E93, E100) [fait pour l'historique, jugement pour la suite].

### R2 — La carte décidée par ce qui part
Ce qu'elle dit. Pendant la fenêtre d'un geste de l'agent (clic, Entrée), une écriture vers le site de la page demande
la carte si : (a) c'est la soumission d'un formulaire par navigation ; (b) le geste est le contrôle de soumission d'un
formulaire ; ou (c) le corps porte une valeur saisie par l'agent ou le fichier qu'il a joint (`carriesAgentData`,
`cdp.js:131`, existe déjà ; `agentValues` garde les 40 dernières saisies de 3 caractères ou plus, `cdp.js:1711-1715`).
Les mots ne servent plus qu'à deux choses : **retirer** une carte à un passage d'étape dont le libellé entier en est un
(`STRICT_STEP_LABEL`, à garder) et **ajouter** une carte en filet (chemin `isSubmitPath`, libellé d'envoi sur un onglet
à WebSocket). La fenêtre de téléversement reste (CV seul vers un stockage : pas de carte).
Point lu dans le corpus [fait] : sans l'exception d'étape, la page FICTIVE donnerait deux fausses cartes par
candidature (étapes 1 et 2 portent une saisie ou le fichier), soit 46 fausses cartes sur les 23 missions réelles.
L'exception d'étape a une propriété utile [jugement] : un mot d'étape manqué donne une carte de trop, pas un envoi sans
carte. Le sens de l'erreur s'inverse par rapport à aujourd'hui.
Code [jugement] : `cdp.js` (garde des écritures, environ 1310-1400 : remplacer `afterSendClick` fondé sur `clickKind`
par le critère du corps), `index.js` (carte avant le clic réservée au contrôle de soumission), `run-policy.js`
(`ownerClickKind` réduit à étape / widget / soumission). 300 à 500 lignes avec les tests ; `rg` relève 5 fichiers de tests
qui citent `clickKind`, `sendApproved` ou la garde (relevé partiel, d'autres tests passent par la page). Deux à trois jours avec relecture.
Ce qu'elle retire : `SEND_LABEL_WORDS` comme décideur, le classement `candidate`, la règle « écriture tardive d'un
clic `candidate` ».
Angles morts : candidature en un clic sans saisie (C10b) ; corps compressé ou chiffré (la base montre de la télémétrie
LinkedIn compressée > 100 ko ; `carriesAgentData` ne décompresse pas, `cdp.js` ne contient ni `zlib` ni `gunzip`)
[fait] ; télémétrie ou filtre qui répète des mots tapés (C7, C20) [jugement] ; valeurs courtes et banales saisies par
l'agent (« Oui », un pays) retrouvées dans n'importe quel corps [jugement] ; brouillon enregistré par XHR après un clic
qui n'est pas une étape (« Ajouter une expérience » qui sauve tout le formulaire) [jugement] ; WebSocket (le relais est
désactivé par défaut) ; iframe d'un autre site à travers le relais (invisible).

### R3 — Un outil explicite `browser_submit`
Ce qu'elle dit. L'agent appelle `browser_submit` pour le geste final (clic ou Entrée) : carte toujours, avant le geste,
quel que soit le canal (HTTP, WebSocket, iframe). Un `browser_click` ou `browser_press` dont une écriture porte une
saisie ou le fichier de l'agent (critère de R2, exception d'étape et fenêtre de téléversement gardées) est **retenu**,
rien ne part, et l'agent reçoit : « ce geste envoie vos données : s'il s'agit de l'envoi final, utilisez
browser_submit ». Les mots restent en filet comme en R2.
Code [jugement] : nouvelle capacité dans `capability-registry/index.js`, exposition dans `mcp-gateway/server.js`, outil
dans `index.js` et `cdp.js` (carte, couverture), retenue dans la garde, lecture de l'outil dans `orchestrator`
(`tool-call.js`, `browser-proof.js`, `mcp-gateway/outcome.js` listent `browser_click`) et au Bilan. 500 à 800 lignes avec
les tests ; trois à quatre jours.
Ce qu'elle retire : la devinette sur le geste final ; l'agent le déclare, comme dans les projets de référence (section 4).
Angles morts : l'agent doit appeler l'outil. Le Skill career-ops est intouchable : la consigne doit venir de la
description de l'outil et du cadre de la plateforme, que des agents ont déjà pris pour une injection (E20, E39) [fait
pour E20/E39, jugement pour l'effet]. Un agent qui clique « Envoyer » par `browser_click` sans saisie (C10b) envoie sans
carte. La retenue casse un filtre ou un brouillon qui porte une saisie (C7, C20, brouillon à chaque étape). WebSocket
et iframe d'un autre site : couverts seulement si l'agent passe par l'outil.

## 3. Tableau de décision
J = décision juste (carte quand il faut, aucune sinon) ; F = fausse carte (ou fausse retenue en R3) ; S = envoi sans carte.
R3 est noté en supposant que l'agent appelle `browser_submit` pour le geste final.

| # | Actuelle | R1 | R2 | R3 | Remarque |
|---|---|---|---|---|---|
| C1 E26 | J | J | J | J | |
| C2 E28 | J | J | J | J | |
| C3 E42 | J | J | J | J | R2/R3 grâce à l'exception d'étape |
| C4 E43 | J | J | J | J | fenêtre de téléversement gardée |
| C5 E66 | J | J | J | J | |
| C6 E89 | J | J | J | J | |
| C7 A6 | J | J | F | F | jugement : télémétrie qui répète la recherche |
| C8 E93 | J | J | J | J | |
| C9 E100 | **F** | J | J | J | |
| C10a A7 | **S** | S | J | J | |
| C10b un clic | **S** | S | S | J | R3 : seulement si l'agent appelle l'outil |
| C11 | J | J | J | J | |
| C12 | J | J | J | J | |
| C13 | J | J | J | J | |
| C14 | J | J | J | J | R3 : retenue puis `browser_submit` |
| C15 | J | J | J | J | R1 : à condition de garder la priorité du bouton de soumission |
| C16 | J | J | J | J | |
| C17 | J | J | J | J | |
| C18 | J | J | J | J | |
| C19 | J | J | J | J | |
| C20 | J | J | F | F | jugement : filtre qui porte les mots tapés |
| C21 | J | J | J | J | filet du chemin |
| C22 | J | J | J | J | R2 par le filet du libellé ; S si icône sans indice |
| C23 | J | J | J | J | relais WebSocket désactivé (sinon R2/R3 : F) |
| C24 | **S** | S | S | J | R3 : seulement si l'agent appelle l'outil |
| C25 | **S** | S | J | J | |
| **Totaux (26 cas)** | **21 J, 1 F, 4 S** | **22 J, 0 F, 4 S** | **22 J, 2 F, 2 S** | **24 J, 2 F, 0 S** | |

Sur les 41 cartes réelles de la base : R1, R2 et R3 garderaient les 23 cartes justes et retireraient les 18 fausses
(aucune de ces missions n'avait de saisie ni de fichier : registre E89, E93, E100) [fait pour les données, jugement pour
la projection]. R2 et R3 sans l'exception d'étape en ajouteraient 46.
Si l'agent n'appelle pas `browser_submit` en R3, C10b et C24 repassent en S, et C22 aussi pour un bouton icône : R3
tombe alors à 21 J, 2 F, 3 S [jugement].

Lecture [jugement] : R1 supprime les fausses cartes connues mais laisse les quatre envois sans carte ; c'est le seul
résultat contraire à la règle intouchable. R2 en ferme deux sans aide de l'agent. R3 les ferme tous, au prix d'une
dépendance à l'obéissance de l'agent. Les F de R2/R3 sont des jugements non mesurés ; les S de R1 sont prouvés par
sonde (A7) ou lus.

## 4. Ce que font les références
[fait] Aucune ne devine un envoi d'après le contenu de la page. Toutes décident sur l'identité déclarée de l'outil ou
sur une déclaration humaine.
- `openclaw__acpx/src/permissions.ts:85-101` : le genre de l'outil vient de `toolCall.kind` déclaré par l'agent ; le
  premier mot du titre ne sert qu'en repli. `:103-105` : seules lecture et recherche passent seules. `:175-217` :
  règles par nom ou genre d'outil, refus avant accord avant escalade.
- `agentgateway__agentgateway/crates/agentgateway/src/mcp/rbac.rs:15-99` : règles CEL par outil, invite ou ressource ;
  `mcp/mcp_tests.rs:2469-2474` : une question à l'humain (élicitation) au milieu d'un `tools/call`. Rien sur le contenu
  d'une page.
- `microsoft__playwright-mcp/README.md:898` : le paramètre `element` des outils est une description lisible
  « utilisée pour obtenir la permission » d'agir sur l'élément (fournie par l'agent) ; `README.md:410-412` et
  `config.d.ts:183-198` : listes d'origines, explicitement « pas une frontière de sécurité » ; `config.d.ts:19-30` :
  capacités par groupe d'outils.
- `remorses__playwriter/extension/src/background.ts:296-312` : le consentement se donne une fois, au partage de
  l'onglet (dialogue de la barre d'outils) ; aucun accord par action.
- `awslabs__cli-agent-orchestrator/src/cli_agent_orchestrator/models/workflow.py:121-136` : une étape `MANUAL` est
  « une déclaration, jamais une permission et jamais déduite » ; ligne 125 : CAO n'a aucun moyen de prouver les effets
  externes d'une étape. `services/approval_gate.py:175` : accord du plan avant lancement.
[jugement] Ces choix vont dans le sens de R3 (geste final déclaré par un outil) ; aucun ne fait le filet réseau de R2.

## 5. Recommandation
1. Ne pas poursuivre R1 seule : elle ne ferme aucun envoi sans carte (A7 reste ouvert) et garde une liste qui grandit.
2. Viser R3 avec R2 comme filet : `browser_submit` toujours carté, et le critère « ce qui part » pour les gestes ordinaires.
3. Garder l'exception d'étape par libellé entier et la fenêtre de téléversement, sinon 46 fausses cartes rien que sur la page FICTIVE.
4. Pour un geste ordinaire qui porte une saisie, préférer la carte à la retenue tant que l'obéissance des agents n'est pas mesurée.
5. À mesurer en réel avant de décider : part des envois finaux réels (SEEK, Greenhouse, LinkedIn) dont le corps porte une saisie ou le CV.
6. Mesurer aussi : nombre d'écritures porteuses hors envoi par mission (brouillons, télémétrie, filtres), et part des corps compressés.
7. Mesurer enfin : Claude et Codex appellent-ils `browser_submit` sur la page FICTIVE avec une modale « Oui » (A7) et en un clic ?
8. Premier pas réversible : un mode d'observation derrière `AGENT_PLATFORM_CARD_SHADOW=1`, désactivé par défaut.
9. Il calcule la décision R2 à côté de l'actuelle et journalise seulement les désaccords (hôte, chemin, critère), sans rien changer.
10. Après une semaine de missions réelles, le propriétaire tranche sur ces chiffres ; l'architecture reste gelée d'ici là.

## 6. Ce que je n'ai pas pu établir
- La forme réelle d'un envoi final sur SEEK, LinkedIn, Greenhouse ou Workday (corps, compression, WebSocket) : aucun
  envoi réel n'a eu lieu ; les C7, C10b, C20 et les F de R2/R3 restent des jugements.
- L'hôte exact de 11 des 23 cartes justes : déduit des mentions de `127.0.0.1:4321` dans les événements, pas d'une
  `submission` journalisée.
- Les heures du geste pour E89 et E93 dans la base : la carte ne garde pas l'heure du clic ; le délai de 4 s d'E100 vient
  du registre.
- Si C25 (écriture plus de 8 s après) arrive sur un vrai site : constat « non contredit », donc non établi.
- Si le relais Playwriter rend visibles les WebSocket des iframes d'un autre site (C24) : lu seulement, jamais rejoué.
- L'obéissance réelle des agents à un outil `browser_submit` : jamais essayé.
- Les ordres de grandeur de code (lignes, jours) sont des estimations, pas des mesures.
