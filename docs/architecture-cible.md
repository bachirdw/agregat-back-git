# Architecture cible de Relay

**Statut : proposition non validée, gelée.** Décision du propriétaire du 31 octobre 2026 : ce document part d'abord en
validation auprès d'un modèle externe. **Rien n'est appliqué avant son retour et un ordre explicite du propriétaire.**
Les constats ont été relevés dans le code et l'historique Git le même jour, sur un arbre de travail où une autre
session modifiait encore l'orchestrateur. Les numéros de ligne peuvent donc bouger légèrement.

## 1. L'essentiel

- **Pas besoin de tout réécrire.** Les bonnes briques existent : ACP, passerelle MCP, moteur de DAG, registre de
  capacités, registre de Skills, ledger. Aucun microservice ni nouvelle infrastructure n'est nécessaire.
- **Le problème est concentré.** Trois fichiers portent presque tous les changements, et le moteur connaît le métier et
  les particularités de chaque agent.
- **Le plus grave pour votre objectif :** le multi-agents passe par le chemin d'exécution le moins protégé. Toutes les
  corrections issues des missions réelles sont allées dans l'autre chemin.
- **« Scalable » veut dire ici :** ajouter un agent, un métier, un logiciel ou une interface sans toucher au moteur.

| Pour ajouter | Aujourd'hui | Cible |
|---|---|---|
| Un agent | profil, plus des branches dans l'orchestrateur et le suivi | un adaptateur |
| Un métier | des `if` dans l'orchestrateur, le serveur et la passerelle | un dossier dans `domain-packs/` |
| Un Skill | chemin normal, sauf career-ops qui a son chemin à part | un dossier `SKILL.md`, et sa fiche est produite seule |
| Un logiciel (Premiere, CapCut…) | impossible : un seul serveur MCP est transmis | une entrée de configuration MCP |
| Une interface | à brancher sur des routes en partie métier | consommer l'API et le flux d'événements |

### L'idée en un schéma

```text
Interface web
    │  API et flux d'événements, sans route métier dans le moteur
    ▼
Moteur : missions · planificateur · exécuteur de workflow · accords · Bilan
    │  ne connaît ni un métier ni un agent par son nom
    ├──► Étape d'agent ──► Adaptateur (Codex, Claude, Gemini, OpenCode) ──► ACP ──► CLI
    │                                                                               │
    │                         Passerelle MCP : navigateur, outils du pack, MCP externes
    ├──► Packs métier branchés par un contrat : career-ops, najah, vidéo…
    ├──► Skills lus, résumés en fiche pour l'utilisateur, suivis sans imposer de méthode
    └──► Dossier de mission : travail par étape, livrables communs, liens dans le Bilan
```

## 2. Ce qui se passe mal, et pourquoi

| Ce que vous constatez | Cause | Preuve |
|---|---|---|
| Une correction en casse une autre, les agents se marchent dessus | Tout passe par un seul fichier | `orchestrator/index.js` : 1 218 lignes, modifié par 61 commits sur 347. `execute()` fait environ 475 lignes. 76 lignes y citent un pack ou un site par son nom (recherche textuelle) |
| Le multi-agents n'est pas fiable | Deux chemins d'exécution | Le chemin simple (`execute`) a les gardes de silence, d'outil figé et la preuve de navigation. Le chemin DAG (`workflow-run.js`) borne le délai, les événements et le texte, et nomme la limite d'usage, mais n'a ni garde de silence, ni garde d'outil figé, ni preuve de navigation. Aucun manifeste livré n'assigne d'agent à une étape |
| `fix-router-02`, `fix-router-03`, prompt Halcyon mal classé | La méthode du Skill est recopiée côté plateforme | `skill-manifest.yaml` est écrit à la main (phrases, mots-clés, étapes) alors que `SKILL.md` a déjà son routeur de modes. Cela contredit « le Skill décide comment » |
| Difficile de savoir ce qu'une mission va faire | Quatre façons de la décrire | `workflow` du manifeste, `dag`/`dags`, parcours `browser-agent` construit dans le code, intentions de `skill-manifest` |
| 10 accords en 2 min 36, tous marqués « Envoi » | Accords et confidentialité mélangés, deux canaux | Permissions ACP et demandes de passerelle ; `privatePreview` forcé par pack. Symptôme corrigé par `fix-perms-01` : 0 demande manuelle sur `03deaf51` et `17edb02d`. La cause de structure reste |
| Le scan du Skill refusé depuis le 30/10 avec « Code tiers modifié », alors que la bibliothèque n'a pas changé | La plateforme a changé sa mesure sans refaire la revue | `a16cb96` ajoute `.sh` à l'empreinte. `relay/source-review.json` date du 26/10. Seuls écarts : `batch/batch-runner.sh` et `scripts/followup-sweep.sh`, suivis et inchangés depuis les 23 et 24/10. Le message ne nomme aucun fichier, et un rapport a attribué le blocage à la bibliothèque ou à sa revue |
| Une mission reprise affiche un travail qu'elle n'a pas fait | L'ordre de la relecture dépend de l'agent, et le moteur le suppose fixe | `537e112b`, Gemini, 6 s : 42 appels d'outil rejoués en 0,3 s, après la garde `promptStarted`, puis comptés au Bilan. Aucun document de sortie daté du jour |
| Le Bilan valide une mission dont l'agent affirme un fait faux | Le Bilan compte des actions, il ne confronte pas les affirmations aux pages lues | `03deaf51` : « chaque offre ouverte » alors qu'un lien sur 5 n'a jamais été ouvert ; « pas ton Chrome » alors que le fournisseur est `playwriter-owner`. Les faits de ce lien étaient justes : ils venaient de la page de liste |
| Un agent marche, les autres coincent | Les formats de chaque agent sont lus dans le moteur | Titres, identifiants, `rawInput` et options lus dans `orchestrator/index.js:98-107` et `:1116-1190` ; expression régulière sur le titre dans `skill-router.js` ; environnement Gemini dans `execute`. Les anciennes lectures de `_meta.is_mcp_tool_call` et de `mcp_platform_…` ont disparu du code le 31/10, mais la logique reste au même endroit |
| Chaque besoin métier ajoute un `if` | Un pack n'a presque aucun contrat | Seuls `register`, `registerLive` et `verify` existent. Le `register()` de career-ops est vide : ses outils sont branchés en dur dans la passerelle. career-ops réexporte du code de Najah |
| Rien n'est prêt pour la vidéo | Pas de notion de livrable ni d'étape riche | Un dossier isolé par étape, sans dossier commun. Zéro mention d'artefact. Un seul serveur MCP. Tous les Skills sont donnés à toutes les étapes. Le modèle n'est choisi que pour l'agent principal. Un seul pack par mission |
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

## 3. Les six principes

1. **Le moteur ne connaît aucun métier.** Aucun nom de pack, d'outil métier ni de site. Un test le vérifie à chaque `npm test`.
2. **Une seule façon d'exécuter.** Toute mission est un DAG. Une mission à un agent est un DAG d'une étape. Le
   multi-agents hérite alors de toutes les protections.
3. **Le Skill reste la seule source de méthode.** La plateforme lit, résume, vérifie et suit. Elle ne recopie pas.
4. **Le moteur ne connaît aucun agent.** Tout ce qui diffère d'un CLI à l'autre vit dans son adaptateur.
5. **Un résultat est un fichier ou un lien vérifié.** Le Bilan liste les livrables, et la plateforme contrôle qu'ils existent.
6. **Une seule règle d'accord.** L'envoi final attend le clic, tout le reste passe. La confidentialité est un sujet séparé.

## 4. Arborescence cible

```text
apps/
  api/                   HTTP et SSE seulement
    server.js            démarrage, contrôles Host/Origin
    routes/              runs, skills, catalog, files, packs
  companion/             diagnostic local
packages/
  kernel/                ex-orchestrator, découpé, sans métier ni agent nommé
    missions.js          créer, reprendre, annuler
    planner.js           pack, Skills, agents, DAG, estimation
    executor.js          branche le moteur DAG sur les étapes
    agent-step.js        une session ACP : gardes, événements, preuves
    permissions.js       file unique d'accords
    privacy.js           masquage des événements et des erreurs
    report.js            Bilan et livrables
    pack-host.js         découverte des packs et contrat (ex-packs.js)
  agent-runtime/         client ACP et adapters/{codex,claude,gemini,opencode}.js
  skill-registry/        registre actuel + brief.js (fiche de Skill)
  mcp-gateway/           capacités, outils des packs
  browser-gateway/       cdp.js découpé : connexion, snapshot, actions
  workflow-engine/       inchangé, schéma d'étape étendu
  capability-registry/  policy-engine/  data-gateway/  storage/  billing/    inchangés
domain-packs/
  core/                  général + parcours navigateur (devenu un DAG)
  career-ops/            manifest, index.js, tools/, workspace.js, sends.js, truth.js, tests/
  najah/
tests/                   moteur et architecture.test.js
docs/                    architecture.md à jour, adr/
```

`packages/career-ops` est notre adaptateur : il part dans `domain-packs/career-ops/`. **La bibliothèque career-ops, son
Skill et le CV ne sont jamais touchés.** Le dossier `.manager` sort du produit selon votre réponse à la question 6.

## 5. Les contrats

### 5.1 Contrat de pack

Un pack déclare ce qui est statique dans `manifest.yaml` : `timeoutMs`, `privacy: private`, DAG, politiques, prérequis.
Le reste est facultatif et vit dans `index.js` :

```js
export default {
  tools(server, ctx) {},        // outils MCP ; ctx : approve, meter, browser, workspace, data
  routes(router, ctx) {},       // montées sous /api/packs/<id>/
  workspace(ctx) {},            // dossier privé : upload, attachments, busy, saveInput, saveResult
  input(value, ctx) {},         // normalise l'entrée
  preflight({ agent, probes }) {}, // refuse tôt, avec un message clair
  env({ run, agent, target }) {},  // variables pour l'agent ou la passerelle
  instructions({ run, plan }) {},
  tracker(run) {},              // suivi d'un tour (ex-turnTruth)
  toolOutcome(name, args, result) {},
  verify(result, ctx) {},
  aggregate(outputs) {},
  summarize(value, ctx) {},     // Bilan propre au pack
  failureMessage(ctx) {},
};
```

Chaque crochet correspond à un couplage réel relevé dans le moteur, aucun n'est spéculatif. Le front utilise
`/career/offers`, `/career/runs/:id/input` et `/career/runs/:id/result` : ces chemins restent servis en alias pendant la migration.

### 5.2 Adaptateur d'agent

```js
export default {
  id: 'gemini',
  toolCall(update) {},    // renvoie { id, server, tool, args } : seul endroit qui lit le format du CLI
  permission(request) {}, // renvoie { toolCallId, options }
  env({ run, home }) {},
  capabilities: [],       // ce que l'agent sait faire, utilisé par le routeur
};
```

**Ce n'est pas un nouveau protocole.** ACP reste le seul protocole d'exécution (ADR 001 et 003). L'adaptateur ne normalise que ce
qu'ACP laisse libre, ou que l'agent ne respecte pas : titres, `_meta`, `rawInput`, environnement et **barrière de tour**. Gemini CLI 0.65 rend la main à `session/load` avant la fin de sa relecture, alors que le code de Claude et d'OpenCode la termine avant. Il faut donc un moyen fiable de savoir où commence le nouveau tour. Cette frontière fait partie de ce qui est soumis à validation.

Chaque adaptateur est testé sur des transcriptions réelles enregistrées. Le catalogue affiche une matrice de preuve par agent :
installé, connecté, a répondu, a appelé un outil MCP, a utilisé le navigateur. L'ambiguïté « bloqué ou pas » disparaît.

### 5.3 Fiche de Skill : ce que vous avez demandé

Elle explique le Skill à l'utilisateur, en texte, et remplace la méthode recopiée.

- **Fiche de base, sans modèle :** nom, description, arguments, modes, fichiers, lus dans `SKILL.md`. Toujours disponible, gratuite.
- **Fiche enrichie :** un agent lit le Skill une fois, sans outils d'écriture, et rend un format validé : à quoi il sert,
  ce qu'il faut remplir, par quoi commencer. Mise en cache par empreinte du Skill : aucun nouvel appel tant qu'il ne change pas.
- **Prérequis contrôlés par la plateforme, pas par le modèle :** `absent`, `vide`, `identique au modèle` ou `rempli`.
  Le contrôle est confiné et n'affiche jamais le contenu du fichier.
- **Plan de mission :** au lancement, l'agent croise la fiche et le prompt, et le fil affiche l'ordre prévu.
- **Suivi :** la plateforme compare ce plan aux outils réellement appelés, sans jamais imposer de méthode.

Exemple construit sur l'état réel de votre espace :

> **Skill career-ops.** Cherche, évalue et prépare des candidatures.
> **À compléter :** dans `portals.yml`, `tracked_companies` est vide. Les recherches et agrégateurs sont remplis, dont trois recherches pour Sydney.
> Le mode `discover` du Skill peut compléter `portals.yml` à partir de noms d'entreprises.
> **Ordre prévu pour votre demande :** lire le CV et le profil, scanner, évaluer les offres retenues, préparer les documents.
> **Avant envoi :** chaque envoi final attendra votre clic.

L'effet réel de cette liste vide sur le scan n'a pas été testé.

**Nouvel état `en attente`.** Si un prérequis indispensable manque ou si l'agent pose une question, la mission passe en attente.
Aucun processus ne reste bloqué : la réponse dans le fil reprend la session.

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
- **Agent absent :** le routeur en choisit un autre qui a la capacité et le signale. Si aucun ne convient, le refus arrive à la planification, jamais en plein milieu.
- **MCP externes :** déclarés par pack ou par l'utilisateur, vérifiés au diagnostic, secrets passés par référence. `runtime.session()` accepte déjà une liste.
- **Workflow généré :** plus tard, un agent planificateur écrit le DAG depuis le prompt. `validateWorkflow` le contrôle et le fil l'affiche en texte. Sans clic, car ce n'est pas un envoi.

### 5.5 Trous connus de cette proposition

- **Navigateur partagé :** deux étapes parallèles dans le même Chrome ne sont pas arbitrées.
- **Clic d'envoi et MCP externes :** seuls nos outils portent `actionClass: 'send'`. Un outil tiers qui publie ne serait pas reconnu.
- **État `en attente` :** il repose sur la reprise de session, dont la preuve réelle n'est pas renouvelée sur les quatre CLI.
- **Suites de conversation :** leur place dans un modèle « tout est un DAG » reste à préciser.
- **Gros fichiers :** ni quota, ni rétention, ni nettoyage ne sont définis pour les livrables vidéo.
- **Commandes natives :** un envoi par une commande native passe sans clic. Ce risque est accepté par le propriétaire, mais aucune frontière de la cible ne le couvre.
- **Repli de navigateur :** le Chrome isolé perd les comptes de l'utilisateur, ce qui peut faire réussir une mission différente de celle demandée.
- **Identité d'un outil :** le titre est un texte libre. Il peut contenir un argument privé et ne prouve pas quel outil a tourné.
- **Session par étape :** le DAG ouvre une session neuve à chaque étape et perd donc le contexte de l'agent.
- **Affirmations de l'agent :** le Bilan compte les actions, et rien ne confronte ce que dit l'agent aux pages lues.
- **Vidéo :** aucun MCP de montage sérieux n'est vérifié pour Premiere Pro ni pour CapCut, et l'entrée vidéo de bout en bout n'est prouvée sur aucun des quatre CLI.
- **Hébergement :** les conditions fournisseur du BYOA (ADR 005) et l'isolation multi-utilisateur restent hors de cette proposition.

## 6. Plan de migration

**Gelé.** Seuls les sprints 0 et 1 continuent, car ils ne changent pas l'architecture. Tous les autres, ainsi que le déplacement de
`.manager`, attendent la validation externe puis un ordre explicite du propriétaire.

Un seul auteur à la fois sur le moteur. Chaque sprint a sa relecture indépendante et le contrôle du manager. Les quatre sprints `arch-*`
ne changent aucun comportement, sauf `arch-04`, annoncé comme tel.

| # | Sprint | Contenu | Preuve de sortie | Risque |
|---|---|---|---|---|
| 0 | `fix-perms-01` | **Fait** par d'autres sessions (`4b5ea21` à `3fa09a5`) | Dernier rapport : principal 410/411 et 1 ignoré, Chrome 131/131, `check` et `format:check` à 0, non rejoué par l'auteur | Faible |
| 1 | `ref-01` | **Fait avec Claude** (`03deaf51`, `17edb02d`). Codex n'a pas rejoué ce parcours | Section 7 du dossier de validation : liste réelle des échecs | Faible |
| 2 | `skill-01` | Fiche de Skill, prérequis, texte dans le fil | La fiche signale `tracked_companies` vide, sans modèle pour la base | Faible |
| 3 | `arch-01` | Contrat de pack, test de garde à cliquet, faux pack de test, premiers crochets | Le faux pack ajoute outil et route sans toucher au moteur | Faible |
| 4 | `arch-02` | Découper `Orchestrator` : permissions, confidentialité, Bilan, étape agent, planificateur | Tests existants verts sans modification de leur logique | Moyen |
| 5 | `arch-03` | Déplacer career-ops dans son pack, alias des routes, séparer Najah | Compteur de garde à zéro, tests du front inchangés, mission de référence rejouée | Moyen |
| 6 | `arch-04` | Un seul chemin : `agent-step` dans le DAG, `browser-agent` devient un DAG | Gardes prouvées sur le DAG, mission navigateur réelle | Élevé |
| 7 | `agents-01` | Adaptateurs, transcriptions réelles, matrice de preuve | Claude, Gemini et OpenCode : un appel d'outil MCP réel prouvé chacun | Moyen |
| 8 | `multi-01` | Dossier de mission, livrables, agent, modèle et Skills par étape | Deux agents différents produisent un fichier relié dans le Bilan | Moyen |
| 9 | `mcp-01` | MCP externes : contrôle de l'existant, configuration, portée par étape | Un vrai MCP externe appelé par un agent | Moyen |
| 10 | `video-01` | Pack vidéo de démonstration, puis planificateur | Prompt, DAG affiché, vidéo livrée avec son lien | Élevé |

**Le test de garde à cliquet :** `tests/architecture.test.js` compte les mentions de métier dans le moteur et échoue si ce nombre
augmente. Chaque sprint baisse le plafond jusqu'à zéro. Le découplage ne peut donc plus régresser, quel que soit l'auteur.

**Organisation du travail, dès le premier sprint de migration :**
- Un worktree Git par auteur, et un seul auteur sur le moteur à la fois.
- La consigne « moins de fichiers possible » est levée pour les sprints `arch-*`, et remplacée par « un fichier, une responsabilité ».
- Une seule doc d'architecture à jour : ce fichier remplace `docs/architecture.md` à la fin de `arch-04`, et l'ADR 008 est révisé.
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
Elles orientent la relecture et n'autorisent aucune migration.

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
