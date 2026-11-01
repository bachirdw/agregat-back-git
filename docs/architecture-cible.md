# Architecture cible de Relay

**Statut : version 2, révisée le 01/11/2026 dans `astra-01`.** Astra (`gpt-6-astra`) a relu la version 1 le 31 octobre 2026 : **validé avec changements** (`.manager/reports/review-arch-01.md`). Cette version intègre ses changements. Sa relecture est statique et ne vaut pas preuve d'exécution. **Le propriétaire a autorisé `tour-01`, puis `ref-02`, et la suite selon le budget.** Les numéros de ligne peuvent bouger, car d'autres sessions modifient le code.

## 1. L'essentiel

- **Pas besoin de tout réécrire.** Les bonnes briques existent : ACP, passerelle MCP, moteur de DAG, registre de
  capacités, registre de Skills, ledger. Aucun microservice ni nouvelle infrastructure n'est nécessaire.
- **Le problème est concentré, sans être la seule cause.** Mesure historique : trois fichiers sont touchés par 112 des 177 commits hors supervision,
  et le moteur connaît le métier et les particularités de chaque agent.
- **Le plus grave pour votre objectif :** les deux chemins d'exécution ont divergé. `astra-01` ajoute des gardes au DAG, mais la parité et les parcours multi-agents réels restent à prouver.
- **Le plus urgent :** la fidélité. Un historique rejoué ne doit jamais compter comme du travail, et un effet incertain ne doit jamais être rejoué. Cela passe avant tout déplacement de fichiers.
- **« Scalable » veut dire ici :** ajouter un agent, un métier, un logiciel ou une interface sans toucher au moteur.

| Pour ajouter | Aujourd'hui | Cible |
|---|---|---|
| Un agent | profil, plus des branches dans l'orchestrateur et le suivi | un normalisateur ACP versionné, testé sur des transcriptions réelles |
| Un métier | des `if` dans l'orchestrateur, le serveur et la passerelle | un dossier dans `domain-packs/` |
| Un Skill | chemin normal, sauf career-ops qui a son chemin à part | un dossier `SKILL.md`, et sa fiche est produite seule |
| Un logiciel (Premiere, CapCut…) | le runtime accepte une liste de MCP, mais l'appelant n'en transmet qu'un | une entrée de configuration MCP, après qualification de ses effets |
| Une interface | à brancher sur des routes en partie métier | consommer l'API et le flux d'événements |

### L'idée en un schéma

```text
Interface web
    │  API et flux d'événements, sans route métier dans le moteur
    ▼
Moteur : conversation · mission · DAG, sur un seul tour d'agent · accords · Bilan
    │  ne connaît ni un métier ni un agent par son nom
    ├──► Tour d'agent ──► Normalisateur (Codex, Claude, Gemini, OpenCode) ──► ACP ──► CLI
    │                                                                               │
    │                         Passerelle MCP : navigateur, outils du pack, MCP externes
    ├──► Packs métier branchés par un contrat : career-ops, najah, vidéo…
    ├──► Skills lus, résumés en fiche pour l'utilisateur, suivis sans imposer de méthode
    └──► Dossier de mission : travail par étape, livrables communs, liens dans le Bilan
```

## 2. Ce qui se passe mal, et pourquoi

**Audit du 01/11, `astra-01`.** Les sept hypothèses ont été confirmées dans l'arbre initial, y compris les changements non commités d'un autre auteur. Elles ne sont pas toutes encore présentes après les corrections ci-dessous. Preuves détaillées, échecs et limites : `.manager/reports/astra-01.md`. Les comptages de lignes/commits et les repères de ligne hérités ci-dessous sont des **mesures historiques à `3fa09a5`**, pas des mesures du code courant. La taille d'un fichier n'explique pas à elle seule une panne.

| Hypothèse | État après `astra-01` |
|---|---|
| Rejeu tardif compté comme travail | Corrigé par refus de `session/load` sans frontière causale qualifiée ; session neuve annoncée avec checkpoint. Le bundle installé Gemini CLI 0.65.0 confirme streamHistory sans await avant return response. Aucun délai de silence pris pour barrière. Deux tours réels Claude haiku sans outil confirment le repli minimal ; les autres agents restent non vérifiés en réel |
| DAG moins protégé | Début de prompt par tentative, gardes silence/outil figé et preuve de lecture ajoutés. Le prompt interdit toujours les fichiers ; pas encore de livrables ni de tour partagé avec le chemin simple |
| Effet read implicite | Corrigé : effet absent `unknown`, agent non rejouable même déclaré read, incertitude conservée lors d'annulation/reprise. La déclaration read d'un outil exige encore la qualification du pack ; un DAG non fiable ne doit pas atteindre l'exécuteur |
| MCP tiers publiant sans clic | Risque confirmé par lecture de permission(), jamais observé en réel. Aucun MCP tiers branché dans cette session. Qualification obligatoire avant exposition, pas une liste de noms supposés sûrs |
| Empreinte non versionnée, refus muet | Code corrigé : schéma 1, périmètre explicite inchangé, noms des fichiers ajoutés/modifiés/supprimés. Le reçu réel ancien (414 entrées) n'est pas modifié : revue versionnée requise avant le prochain scan, référence réelle encore incomplète |
| Téléchargement en mémoire avant borne | Confirmé, correction encore à faire : la branche propriétaire utilise response.body() avant la limite. Content-Length seul ne suffirait pas ; prévoir une lecture bornée en flux et un test sans en-tête |
| Dernière paire navigateur et affirmations non confrontées | Toutes les paires du tour conservées ; liens lus/visités/cités distingués, affirmations marquées non vérifiées. Empreinte d'URL complète pour éviter de confondre les paramètres, parties privées absentes du rapport. Ceci ne certifie pas la vérité du texte |

Les ponts du DAG étaient effectivement partagés par mission : ils sont désormais révoqués à la fin de chaque tentative. Les envois natifs, le Chrome partagé entre agents, la vidéo et les anciennes affirmations de missions restent non vérifiés ici. La mission ancienne `537e112b` conserve 42 appels comptés et aucune preuve navigateur en base ; ces totaux ne prouvent pas seuls la nature du rejeu.

| Ce que vous constatez | Cause | Preuve |
|---|---|---|
| Une correction en casse une autre, les agents se marchent dessus | Couplages concentrés dans execute(), coordination des auteurs et différences de transport | Les mesures de taille historiques signalent une concentration ; elles ne prouvent pas une cause unique. Les pannes navigateur et CLI demandent leurs propres preuves |
| Le multi-agents reste à qualifier | Deux chemins d'exécution, malgré les nouvelles gardes du DAG | `workflow-run.js` a désormais silence, outil figé, début de prompt et preuve navigateur par tentative. Le tour partagé et les livrables restent à faire ; aucun essai multi-agent Chrome réel dans astra-01 |
| `fix-router-02`, `fix-router-03`, prompt Halcyon mal classé | La méthode du Skill est recopiée côté plateforme | `skill-manifest.yaml` est écrit à la main (phrases, mots-clés, étapes) alors que `SKILL.md` a déjà son routeur de modes. Cela contredit « le Skill décide comment » |
| Difficile de savoir ce qu'une mission va faire | Quatre façons de la décrire | `workflow` du manifeste, `dag`/`dags`, parcours `browser-agent` construit dans le code, intentions de `skill-manifest` |
| 10 accords en 2 min 36, tous marqués « Envoi » | Accords et confidentialité mélangés, deux canaux | Permissions ACP et demandes de passerelle ; `privatePreview` forcé par pack. Symptôme corrigé par `fix-perms-01` : 0 demande manuelle sur `03deaf51` et `17edb02d`. La cause de structure reste |
| Le scan pouvait être refusé sans que la bibliothèque change | Mesure non versionnée ; .sh ajouté dans a16cb96 | Revue historique refaite et scan rapporté réussi e1f1481d. astra-01 versionne la mesure et nomme les différences ; le reçu réel non versionné reste à renouveler explicitement |
| Une mission reprise affichait un travail non effectué | loadSession ne garantit pas la fin causale du rejeu | 537e112b : 42 appels comptés en base. astra-01 refuse le load ambigu et annonce une session neuve depuis checkpoint ; aucune reprise exacte qualifiée à ce jour |
| Le Bilan pouvait laisser passer une affirmation fausse | Lecture de page et vérité du texte confondues | astra-01 conserve les observations, distingue les liens et marque les affirmations non vérifiées. Les anciens récits de 03deaf51 et 253328bb ne sont pas reproduits ici ; aucune certification automatique de vérité |
| Un agent marche, les autres coincent | Les formats de chaque agent sont lus dans le moteur | Titres, identifiants, `rawInput` et options lus dans `orchestrator/index.js:98-107` et `:1116-1190` ; expression régulière sur le titre dans `skill-router.js` ; environnement Gemini dans `execute`. Les anciennes lectures de `_meta.is_mcp_tool_call` et de `mcp_platform_…` ont disparu du code le 31/10, mais la logique reste au même endroit |
| Chaque besoin métier ajoute un `if` | Un pack n'a presque aucun contrat | Seuls `register`, `registerLive` et `verify` existent. Le `register()` de career-ops est vide : ses outils sont branchés en dur dans la passerelle. career-ops réexporte du code de Najah |
| Rien n'est prêt pour la vidéo | Pas de notion de livrable ni d'étape riche | Un dossier isolé par étape, sans dossier commun. Aucun contrat générique de livrable, même si téléchargements et résultats privés existent. L'appelant ne transmet qu'un serveur MCP. Tous les Skills sont donnés à toutes les étapes. Le modèle n'est choisi que pour l'agent principal. Un seul pack par mission |
| Passations fausses, travaux mélangés | Plusieurs auteurs dans le même dossier et la même branche | Trois fils Codex, puis deux sessions Claude. À 13:03 la chaîne annoncée par la passation n'existait déjà plus, et la passation n'a été corrigée qu'à 13:20 |
| Les fichiers énormes grossissent encore | Une consigne pousse dans ce sens | Les briefs demandent « moins de fichiers possible » : chaque correction va donc dans le fichier déjà trop gros |
| Dépôt illisible | Le produit et sa supervision sont mêlés | 899 fichiers suivis sur 1 097 sont dans `.manager` (73 Mo), contre 40 dans `packages`. 171 commits sur 347 ne touchent que `.manager`. `docs/architecture.md` date du 26/10 et `PLAN.md` du 25/10 |

**Ce que l'architecture n'explique pas.** Toutes les pannes ne viennent pas de la structure, et ce rangement ne les supprimerait pas :
- **Outil natif d'un CLI :** `google_web_search` de Gemini reste sans mise à jour pendant 120 s. La garde a fonctionné.
- **Navigateur :** clic sans effet dans un onglet caché, Chrome ralenti sous charge.
- **Coordination :** passations périmées, plusieurs sessions sur la même branche, tests sensibles à la charge.
- **Logique fautive :** les Bilans incomplets de `fix-router-02` et `fix-router-03` pourraient survivre à un découpage.

**Point rassurant :** 13 598 lignes de tests pour 10 361 lignes de code. Le rangement peut donc se faire à comportement
constant, avec un filet réel. 23 fichiers de tests sur 57 citent career ou najah et devront suivre le déplacement.

## 3. Les sept principes

1. **Le moteur ne connaît aucun métier.** Des contraintes d'imports et des tests de contrats le vérifient. Un compteur de mentions n'est qu'un indicateur.
2. **Un seul tour d'agent.** Conversation, mission et DAG restent trois formes distinctes, mais elles partagent la même exécution d'un tour et ses gardes. Le DAG converge progressivement, avec des tests de parité.
3. **Le Skill reste la seule source de méthode.** La plateforme lit, résume et vérifie. Elle peut suivre des critères déclaratifs, sans imposer de méthode.
4. **Le moteur ne lit aucun format de CLI.** Ces différences vivent dans des normalisateurs versionnés. ACP, son SDK et les adaptateurs amont restent en place.
5. **Un résultat est un livrable identifié ou une observation datée.** Le Bilan distingue une URL citée, une page visitée et une affirmation étayée. Sans preuve, il affiche « non vérifié ».
6. **Une seule règle d'accord.** L'envoi final attend le clic, tout le reste passe. Un outil tiers est qualifié avant d'être exposé. La confidentialité est un sujet séparé.
7. **Tout est attribué.** Preuves, accords et mesures portent mission, tour, étape, tentative et appel. L'historique ne compte jamais comme du travail, et un effet incertain n'est jamais rejoué automatiquement.

## 4. Arborescence cible

```text
apps/
  api/                   HTTP et SSE seulement
    server.js            démarrage, contrôles Host/Origin
    routes/              runs, skills, catalog, files, packs
  companion/             diagnostic local
packages/
  orchestrator/          découpé sur place, sans métier ni agent nommé
    missions.js          créer, reprendre, annuler
    planner.js           pack, Skills, agents, DAG, estimation
    executor.js          branche le moteur DAG sur les étapes
    agent-turn.js        un tour ACP commun : barrière, gardes, événements, preuves
    permissions.js       file unique d'accords
    privacy.js           masquage des événements et des erreurs
    report.js            Bilan et livrables
    pack-host.js         découverte des packs et contrat (ex-packs.js)
  agent-runtime/         client ACP et normalizers/{codex,claude,gemini,opencode}.js
  skill-registry/        registre actuel + brief.js (fiche de Skill)
  mcp-gateway/           capacités, outils des packs
  browser-gateway/       cdp.js découpé : connexion, snapshot, actions ; route d'envoi gardée atomique
  workflow-engine/       inchangé, schéma d'étape étendu
  capability-registry/  policy-engine/  data-gateway/  storage/  billing/    inchangés
domain-packs/
  core/                  général + parcours navigateur (devenu un DAG)
  career-ops/            manifest, index.js, tools/, workspace.js, sends.js, truth.js, tests/
  najah/
tests/                   moteur et architecture.test.js
docs/                    architecture.md à jour, adr/
```

**Aucun déplacement massif n'est prévu.** `kernel` est abandonné. `packages/career-ops` ne bouge que si le contrat de pack le justifie une fois prouvé. **La bibliothèque career-ops, son
Skill et le CV ne sont jamais touchés.** La supervision n'est ni supprimée ni réécrite.

## 5. Les contrats

### 5.1 Contrat de pack

Un pack déclare ce qui est statique dans `manifest.yaml` : `timeoutMs`, `privacy: private`, DAG, politiques, prérequis.
Le reste tient en quatre entrées facultatives dans `index.js` :

```js
export default {
  tools(server, ctx) {},    // outils MCP, chacun décrit avec ses effets et son résultat
  routes(router, ctx) {},   // montées sous /api/packs/<id>/
  prepare(mission, ctx) {}, // entrée, prérequis, environnement, instructions et espace de travail, via les services communs
  verify(result, ctx) {},   // règles de vérification propres au métier
};
```

Les treize crochets de la version 1 figeaient les couplages actuels. Le suivi devient générique, et résumé et erreurs deviennent de simples projections.
Ce code de pack est approuvé : il n'est jamais généré à partir d'un Skill tiers. Le front utilise `/career/offers`, `/career/runs/:id/input` et `/career/runs/:id/result` : ces chemins restent servis.

### 5.2 Normalisateurs ACP et barrière de tour

ACP reste le seul protocole d'exécution (ADR 001 et 003). Un normalisateur, versionné par agent, traduit ce qu'ACP laisse libre ou que l'agent ne respecte pas : formats d'outils, environnement, limites d'usage et ordre de la relecture.

**La barrière de tour doit être causale.** Elle vient du protocole, ou d'une implémentation vérifiée et testée pour cette version. Un délai de silence ne suffit jamais. Sans barrière fiable, la plateforme ouvre une session neuve depuis un point de reprise, et les événements ambigus ne comptent pas.

Conséquence probable pour Gemini CLI 0.65 : il rend la main à `session/load` avant la fin de sa relecture, et Astra n'a trouvé aucun identifiant de tour obligatoire dans le schéma ACP v1. Sa reprise exacte passerait donc par une session neuve, sous réserve de la décision du propriétaire et d'une preuve sur transcription.

**Attribution :** les ponts du DAG étaient liés à la mission ; `astra-01` leur donne un jeton révocable par tour, étape et tentative. Le chemin simple crée une mission distincte par tour. La cible exige mission, tour, étape, tentative et appel sur chaque preuve, accord et mesure ; l'attribution n'est pas encore uniforme sur tous les résultats et événements. Le résultat renvoyé par la passerelle fait autorité, et le texte ACP reste qualifié comme tel.

**Passerelle MCP :** le modèle processus enfant et HTTP local reste en place, avec une configuration typée et versionnée, un cycle de vie et une corrélation.

**Matrice de preuve par agent :** elle distingue la déclaration, la négociation ACP et un essai daté par agent, version, modèle et transport.

### 5.3 Fiche de Skill : ce que vous avez demandé

Elle explique le Skill à l'utilisateur, en texte, et remplace la méthode recopiée.

- **Fiche de base, sans modèle :** les métadonnées réellement disponibles dans `SKILL.md`. Les modes et arguments ne sont pas garantis. Toujours disponible, gratuite.
- **Fiche enrichie :** un agent lit le Skill une fois, sans outils ni secrets, et rend un format validé : à quoi il sert,
  ce qu'il faut remplir, par quoi commencer. Le cache couvre le Skill, ses dépendances, le schéma et la recette.
- **Prérequis déclaratifs et revus :** `absent`, `vide`, `identique au modèle` ou `rempli`. Le contrôle est confiné et n'affiche jamais le contenu du fichier.
  Ce que propose le modèle n'est jamais exécutoire, et « rempli » ne prouve pas « suffisant ».
- **Plan de mission :** au lancement, l'agent croise la fiche et le prompt, et le fil affiche l'ordre prévu.
- **Suivi :** des critères déclaratifs, indépendants du résumé, sans imposer de méthode. `skill-manifest.yaml` n'est retiré qu'après une équivalence prouvée.

Exemple fictif de fiche cible, sans nouveau diagnostic de l'espace privé :

> **Skill career-ops.** Cherche, évalue et prépare des candidatures.
> **À compléter :** dans `portals.yml`, `tracked_companies` est vide. Les recherches seraient à contrôler sans afficher le profil privé.
> Le mode `discover` du Skill peut compléter `portals.yml` à partir de noms d'entreprises.
> **Ordre prévu pour votre demande :** lire le CV et le profil, scanner, évaluer les offres retenues, préparer les documents.
> **Avant envoi :** chaque envoi final attendra votre clic.

L'effet de cette liste vide sur le scan n'a pas été relu par l'auteur.

**Nouvel état `en attente`.** La mission enregistre la question, le contexte et les effets déjà produits, puis libère le processus.
La réponse ne reprend exactement une session que si un normalisateur/version prouve la fin du rejeu. Actuellement aucun n'est qualifié : une session neuve repart d'un point de reprise borné et non fiable, et le résultat l'annonce. Ce checkpoint textuel ne prouve ni les effets passés ni une mémoire complète.

### 5.4 Étape de workflow étendue

Le moteur sait déjà faire le parallèle, les dépendances, la reprise et nommer un agent par étape. Il manque les champs marqués
`nouveau` ci-dessous. Ce DAG est une illustration : **je n'ai pas vérifié quels agents lisent une vidéo, ni qu'un MCP fiable
existe pour Premiere Pro ou CapCut.** Le sprint `mcp-01` commence par ce contrôle.

```yaml
id: montage-video
steps:
  - id: comprendre
    kind: agent
    title: Comprendre les extraits
    requires: [video]          # nouveau : une capacité plutôt qu'un nom d'agent
    skills: [analyse-video]    # nouveau : Skills de cette étape
    prompt: Décris chaque extrait et écris artifacts/analyse.json
  - id: recherche
    kind: agent
    title: Chercher des références de montage
    requires: [web]
    prompt: Trouve des références et écris artifacts/references.md
  - id: montage
    kind: agent
    title: Monter la vidéo
    dependsOn: [comprendre, recherche]
    mcp: [premiere]            # nouveau : serveurs MCP externes de l'étape
    model: auto                # nouveau : modèle par étape
    prompt: Monte d'après artifacts/ et exporte artifacts/final.mp4
  - id: verifier
    kind: verify
    dependsOn: [montage]
    artifacts: [final.mp4]     # nouveau : ce fichier doit exister
  - id: livrer
    kind: aggregate
    dependsOn: [verifier]
```

- **Dossier de mission :** `runs/<id>/steps/<étape>/` pour le travail, `runs/<id>/artifacts/` en commun. Le Bilan donne les liens.
- **Livrables :** producteur et tentative, chemin confiné, taille, type, empreinte, publication atomique, rétention. Les gros fichiers restent hors SQLite. Le prompt d'étape du DAG doit cesser d'interdire les fichiers.
- **Agent absent :** le routeur en choisit un autre qui a la capacité et le signale. Les capacités sont revérifiées au lancement, car une limite peut survenir plus tard. Le repli repart d'un point de reprise et ne répète jamais un effet à l'aveugle.
- **Navigateur :** un bail d'abord exclusif par session de travail, en gardant la file et les cibles existantes. Le parallèle ne vient qu'après preuve.
- **MCP externes :** déclarés par pack ou par l'utilisateur, qualifiés avant exposition, secrets passés par référence. `runtime.session()` accepte déjà une liste. Une annotation du serveur ne prouve pas ce que fait l'outil.
- **Workflow généré :** plus tard, un agent planificateur écrit le DAG depuis le prompt. `validateWorkflow` ne contrôle que la syntaxe : il faut aussi valider capacités, effets, reprises et ressources, car une déclaration `read` générée ne prouve aucun effet. Depuis `astra-01`, l'effet absent vaut `unknown`, et une étape agent interrompue reste incertaine même déclarée `read`. Le fil l'affiche en texte, sans clic.

### 5.5 Trous connus de cette proposition

- **Navigateur partagé :** cookies, focus et coordination entre processus restent à tester, sur des pages locales fictives.
- **Clic d'envoi et MCP externes :** seuls nos outils portent `actionClass: 'send'`. Un outil tiers qui publie ne serait pas reconnu. Le risque accepté pour les commandes natives ne couvre pas automatiquement ce cas : question 10.
- **État `en attente` :** il repose sur la reprise de session, dont la preuve réelle n'est pas renouvelée sur les quatre CLI.
- **Gros fichiers :** rétention acceptée jusqu’à suppression par le propriétaire, alerte au-delà de 50 Go ; stockage et alerte pas encore implémentés. Un téléchargement est aujourd'hui lu en mémoire avant le contrôle de sa taille (`cdp.js`).
- **Commandes natives :** un envoi par une commande native passe sans clic. Ce risque est accepté par le propriétaire, mais aucune frontière de la cible ne le couvre.
- **Repli de navigateur :** le Chrome isolé perd les comptes de l'utilisateur, ce qui peut faire réussir une mission différente de celle demandée.
- **Identité d'un outil :** le titre est un texte libre. Il peut contenir un argument privé et ne prouve pas quel outil a tourné.
- **Session par étape :** le DAG ouvre une session neuve à chaque étape et perd donc le contexte de l'agent.
- **Affirmations de l'agent :** les liens sont maintenant confrontés aux observations du tour et le texte marqué non vérifié. Lire une page ne suffit pas à étayer toutes les affirmations ; aucun vérificateur sémantique n'est livré.
- **Vidéo :** aucun MCP de montage sérieux n'est vérifié pour Premiere Pro ni pour CapCut, et l'entrée vidéo de bout en bout n'est prouvée sur aucun des quatre CLI.
- **Hébergement :** les conditions fournisseur du BYOA (ADR 005) et l'isolation multi-utilisateur restent hors de cette proposition.

## 6. Plan de migration

**Ordre autorisé par le propriétaire le 01/11.** La fidélité reste prioritaire ; aucun déplacement massif. Les preuves nouvelles sont dans astra-01, distinctes des rapports historiques. Les déplacements de fichiers sont retirés du plan.

Un seul auteur à la fois sur le moteur. Chaque sprint a sa relecture indépendante et le contrôle du manager.

| # | Sprint | Contenu | Preuve de sortie | Risque |
|---|---|---|---|---|
| 0 | `fix-perms-01` | **Fait** par d'autres sessions | Dernier rapport : principal 410/411 et 1 ignoré, Chrome 131/131, non rejoué par l'auteur | Faible |
| 1 | `ref-01` | **Fait avec Claude** (`03deaf51`, `17edb02d`) | Section 7 du dossier de validation | Faible |
| 2 | `tour-01` | Corrections astra-01 : load non qualifié refusé, checkpoint annoncé, effets incertains conservés, ponts par tentative, gardes DAG et liens non vérifiés | Fixtures et essai minimal Claude ; matrice réelle des quatre agents et parcours métier restent à qualifier. Le checkpoint textuel ne garantit pas à lui seul le comportement futur du modèle | Moyen |
| 3 | `ref-02` | Contrôle versionné et refus nommant les fichiers livrés dans astra-01 ; référence réelle incomplète | Renouveler explicitement le reçu ancien sans toucher au Skill/CV/code tiers, puis refaire un scan minimal ; pas de migration automatique | Faible |
| 4 | `skill-01` | Fiche de Skill minimale, préconditions revues | La fiche signale `tracked_companies` vide, sans modèle pour la base | Faible |
| 5 | `arch-01` | Contrat réduit à quatre entrées, faux pack, contraintes d'imports | Le faux pack ajoute outil et route sans toucher au moteur | Faible |
| 6 | `arch-02` | Tour d'agent partagé | Tests de parité entre les chemins | Moyen |
| 7 | `arch-03` | Convergence progressive du DAG | Gardes prouvées sur le DAG, mission navigateur réelle | Élevé |
| 8 | `multi-01` | Livrables identifiés, agent, modèle et Skills par étape | Deux agents produisent un fichier relié dans le Bilan | Moyen |
| 9 | `mcp-01` | MCP externes qualifiés, portée par étape | Un vrai MCP externe appelé par un agent | Moyen |
| 10 | `video-01` | Démonstration multi-agent, puis expérimentation `ffmpeg` | Prompt, DAG affiché, vidéo livrée avec son lien | Élevé |
| 11 | `plan-01` | Planificateur borné, validation des effets et des ressources | Un DAG généré avec envoi mal déclaré est refusé | Élevé |

**Garde du découplage :** contraintes d'imports et tests de contrats. Le compteur de mentions reste un simple indicateur.

**Organisation du travail, dès le premier sprint de migration :**
- Un worktree Git par auteur, et un seul auteur sur le moteur à la fois.
- La consigne « moins de fichiers possible » est levée pour les sprints `arch-*`, et remplacée par « un fichier, une responsabilité ».
- Une seule doc d'architecture à jour : ce fichier remplace `docs/architecture.md` à la fin de `arch-03`, et l'ADR 008 est révisé.
- Le lanceur de tests tue ses enfants : un test est resté vivant 40 minutes après la disparition de son lanceur.

## 7. Ce qui ne change pas

- L'envoi final attend le clic. Limite connue et acceptée le 31/10 : un envoi lancé par une commande native de l'agent échappe à cette règle.
- Aucun contournement de CAPTCHA ni de détection de robots, aucun secret exposé, un Bilan fidèle aux actions réelles.
- Chemins confinés, outil figé arrêté, aucun push ni merge sans ordre.
- Bibliothèque career-ops, Skill et CV intouchés. Codex code, le manager contrôle.

## 8. Incohérences relevées

1. **État réel des agents :** Claude a terminé deux fois la recherche d'offres réelle (`03deaf51`, `17edb02d`). Gemini échoue sur ce parcours : deux arrêts de `google_web_search` à 120 s (`5927e9a8`, `73e730b9`). Codex n'a terminé que des lectures, et sa mission career-ops a échoué sur sa limite d'usage (`c6128625`). OpenCode n'a reçu aucun prompt réel. Aucun agent n'a fait de candidature complète.
2. **Skills portables :** career-ops déclare `skills: []` et suit un chemin à part, exclu de l'export. Votre premier test métier ne prouve donc pas encore la promesse « un Skill s'installe et sert à n'importe quel agent ».
3. **Routeur de Skills :** présenté comme un simple constat, il choisit aussi une intention et retire une étape de sauvegarde selon le prompt.
4. **Najah et career-ops :** deux packs pour le même domaine, et l'un réexporte du code de l'autre.
5. **Qui code :** `CLAUDE.md` dit que Codex code. Depuis 13:20, la passation indique Codex écarté pour l'instant à la demande du propriétaire, et le manager a écrit lui-même la correction en cours.
6. **Documents de référence :** `MISSION.md` cite encore `agent-repos/`, renommé depuis, et `package.json` s'appelle `agent-platform` alors que le produit s'appelle Relay.

## 9. Réponses provisoires du propriétaire

Le propriétaire a accepté ces réponses par défaut le 31/10, puis a précisé : ne pas appliquer le changement d'architecture avant validation.
Elles orientent la migration autorisée dans le périmètre de la demande astra-01.

| # | Question | Réponse par défaut |
|---|---|---|
| 1 | Faire marcher career-ops avant le gros rangement ? | Oui : mission réelle de référence et fiche de Skill d'abord, car elles donnent la liste réelle des échecs |
| 2 | « Remplir le portail » était-il un exemple du message à envoyer, ou une tâche à faire maintenant ? | Un exemple : la plateforme le signale et `portals.yml` n'est pas modifié |
| 3 | Si un prérequis manque, continuer ou attendre ? | Continuer si la mission reste possible, sinon attendre la réponse dans le fil |
| 4 | Fusionner Najah et career-ops ? | Non : deux packs, sans dépendance directe entre eux |
| 5 | Retirer à terme `skill-manifest.yaml` ? | Oui, une fois prouvé que la fiche de Skill suit aussi bien les missions |
| 6 | Que faire de `.manager` ? | Sortir les dossiers de preuves du suivi Git, garder briefs et rapports, ne rien supprimer |
| 7 | La session parallèle qui corrige le moteur est-elle voulue ? | Elle termine et commite, puis Codex seul, un auteur à la fois, consigne « moins de fichiers » levée pour `arch-*` |
| 8 | Par quel logiciel commencer pour la vidéo ? | `ffmpeg` via MCP, gratuit et testable automatiquement, puis Premiere Pro ou CapCut |
| 9 | Qui écrit les workflows ? | Les packs d'abord, un agent planificateur ensuite, toujours affiché en texte et sans clic |

## 10. Réponses provisoires acceptées dans astra-01

| # | Question | Réponse acceptée, à implémenter |
|---|---|---|
| 10 | MCP tiers : intégrations qualifiées, ou extension du risque d'envoi sans clic ? | Intégrations qualifiées, sans clic ajouté aux actions ordinaires. Cela garde ta règle du clic avant l'envoi final |
| 11 | Quelle rétention et quel espace disque pour les livrables ? | Conservés jusqu'à suppression par toi, avec une alerte au-delà de 50 Go. Le seuil est à ajuster |
| 12 | Si la reprise exacte est impossible, accepter une session neuve depuis un point de reprise, signalée ? | Oui, sans jamais rejouer un effet incertain |
