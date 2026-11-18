# Mode workflow à agent chef : conception détaillée et découpage en sprints (18/11/2026, 18:23)

Session `workflow-18-11`, en lecture seule sur tout le code : rien n'est codé, ce document propose. Il fait suite à
l'étude `workflows-etude-18-11.md` (non suivie par Git, lue dans `~/Downloads/agregat-back-essai-13-11/.manager/reports/` :
elle n'est pas dans cet arbre) et aux décisions du propriétaire de 18:14 (étude, section 7) : trois voies
d'activation, toujours **prévenu puis accord** avant l'activation ; plusieurs abonnements consommés en même temps à
cette condition ; navigateur à plusieurs onglets à essayer, repli à un seul ; **un agent chef** écrit et conduit la
chaîne d'étapes (option B) ; architecture cible dégelée sur ce seul point.

Conventions. Chemins relatifs à la racine du dépôt (code au commit `4b7b3b6` de `contacts-13-11`). **Constaté** = lu,
avec fichier et ligne. **Hypothèse** = déduit, non vérifié. **Proposé** = ce que ce document recommande. Le front est
un autre dépôt (`~/Downloads/agregat-front-cto`, `7b2716c`), cité « front : ». Le Skill career-ops est cité
« Skill : » (`~/Downloads/agregat-career-ops`, `35b7c531`, lu sans rien toucher). Les deux dépôts de référence ont été
relus par deux sous-agents en lecture seule (relevés repris en section 2.6 et 5.1).

## Lexique (une demi-phrase par mot)
- **Agent chef** : l'agent de la mission que le propriétaire lance ; il découpe le travail et le confie à d'autres.
- **Sous-mission** (ou « fille ») : une mission Relay ordinaire, lancée par le chef et non par le propriétaire.
- **Mission mère** : la mission du chef ; avec ses sous-missions elle forme une **famille**.
- **Outil MCP** : une fonction que Relay prête à l'agent (lire un fichier, piloter le navigateur…) ; MCP est le protocole.
- **ACP** : le protocole par lequel Relay lance un agent (Claude Code, Codex…) et lui parle.
- **Carte d'envoi** : la fenêtre « Approuver l'envoi » qui attend ton clic avant tout envoi final.
- **Bilan** : le compte rendu que Relay écrit à la fin d'une mission, d'après ce qu'il a vu, pas d'après ce que l'agent dit.
- **Enveloppe** : ce que tu acceptes d'avance : au plus N sous-missions, dont M en même temps.
- **Bail** (navigateur) : un tour de parole ; une seule sous-mission pilote le navigateur à la fois.
- **Relais Playwriter** : le programme externe (port 19988) qui laisse Relay piloter ton Chrome ; jamais modifié.

## 0. L'essentiel
1. Le chef reçoit cinq outils de plus, les mêmes quel que soit l'agent : `mission_lancer`, `mission_suivre`,
   `mission_attendre`, `mission_preciser`, `mission_annuler`. Chaque sous-mission est une mission Relay complète, avec
   ses questions, ses cartes d'envoi et son Bilan, créée par la fonction qui crée déjà les missions.
2. Rien ne s'active sans toi : une carte d'avertissement (texte en 1.3) s'affiche avant le lancement, quelle que soit
   la voie (case cochée, mot dans le prompt, proposition de Relay). Refuser = la mission part avec un seul agent, comme
   aujourd'hui.
3. Les outils sont prêtés par un **nouveau petit serveur MCP** (`packages/mission-gateway/`), pas par la passerelle
   existante : aucun fichier des quatre sprints en cours n'est touché par le premier sprint.
4. Le Bilan de la mère **cite** les Bilans des filles mot pour mot et les compte ; il ne les réécrit pas.
5. Navigateur : chaque sous-mission a déjà, par construction, son propre onglet et sa propre connexion au relais
   (constaté, 5.1). L'essai mesure si cela tient en parallèle ; sinon, repli par bail.
6. Le Skill career-ops sait déjà travailler en parallèle (réservation des numéros de rapport, une ligne de suivi par
   fichier puis fusion, un navigateur isolé par ouvrier) : Relay le laisse faire et vérifie.
7. Cinq sprints, le premier le plus petit : un chef, des filles sans navigateur, un résultat et un Bilan (section 9).

## 1. Ce que vit le propriétaire, pas à pas

### 1.1 Son exemple
Il écrit dans le champ de mission, par exemple : « Cherche des offres de <métier> sur SEEK et LinkedIn, génère le CV
et la lettre pour les 5 meilleures, trouve les décideurs de chaque entreprise et leurs e-mails, puis envoie-leur mon
CV et un message (e-mail, LinkedIn). »

Aujourd'hui (constaté) : la mission part dès l'envoi, sans plan à confirmer (front : `src/App.tsx:71`) ; un seul agent
fait tout, l'une après l'autre ; une seule mission privée à la fois dans l'espace career-ops
(`packages/orchestrator/index.js:1108`). Le menu « Exécution » du front propose déjà « Workflow DAG » (front :
`src/Composer.tsx:561-579`) et le front l'envoie même par défaut (front : `src/App.tsx:61-62`), mais en mode propriétaire
une mission career-ops est remise en `mode = 'agent'` et son workflow effacé (`packages/orchestrator/index.js:775-776`) :
ce menu n'a donc aucun effet sur ses missions. **Proposé** : le nouveau mode a son propre champ (`delegation`, 2.1),
distinct de `mode`, pour que ce réglage par défaut du front n'active jamais le chef par mégarde.

### 1.2 Les trois voies d'activation
| Voie | Ce qu'il fait | Ce qui se passe |
|---|---|---|
| 1. Case à cocher | sous le champ de mission, il coche « Plusieurs agents (mode workflow) », puis Envoyer | la carte d'avertissement s'ouvre avant tout lancement |
| 2. Mot dans le prompt | il écrit par exemple « en parallèle », « mode workflow », « plusieurs agents », « équipe d'agents », « sous-missions » | à l'envoi, Relay repère le mot ; la même carte s'ouvre, titrée « Tu as demandé le mode workflow » |
| 3. Proposition de Relay | ni case ni mot ; son prompt enchaîne au moins trois étapes (« → », « puis », « ensuite », liste numérotée…) | à l'envoi, la carte s'ouvre, titrée « Relay propose le mode workflow », avec les étapes repérées |

Le repérage des voies 2 et 3 est fait par l'API (nouvelle route `POST /api/delegation/check`, 2.1), pas par le front,
pour qu'un seul endroit décide. Il est volontairement simple : une fausse alerte coûte un clic, jamais une activation.

### 1.3 L'avertissement et l'accord
**Où** : une fenêtre par-dessus le champ de mission, avant que quoi que ce soit parte (front, nouveau composant
`src/Delegation.tsx`). **Texte proposé** (le même pour les trois voies, seul le titre change) :

> **Mode workflow : plusieurs agents en même temps**
> Plusieurs agents vont travailler en parallèle sur ta mission : un agent chef découpe le travail et lance des
> sous-missions. **Cela consomme davantage tes abonnements** (Claude, Codex…) : jusqu'à **10** sous-missions, dont
> **3** en même temps ; compte à peu près une mission ordinaire par sous-mission, et une consommation plus rapide.
> Ta limite d'usage peut être atteinte plus tôt. Dernière mission en mode workflow : 7 sous-missions, 1 h 10 d'agents
> cumulée. Les envois restent à ton clic, comme d'habitude.
> [Activer (consomme davantage)]  [Continuer avec un seul agent]  [Annuler]

Les deux nombres sont modifiables dans la carte (champs « jusqu'à … sous-missions, … en même temps ») ; la ligne
« Dernière mission » n'apparaît que si une famille a déjà tourné (chiffres réels relevés par Relay, section 7).

**S'il refuse** :
- « Continuer avec un seul agent » : la mission part comme aujourd'hui ; les outils du chef ne sont pas prêtés ; le
  Bilan porte la ligne « Mode workflow proposé (voie : …), refusé : mission menée par un seul agent ».
- « Annuler » : rien ne part, son prompt reste dans le champ.
- Après un refus, la même mission ne le lui redemande jamais.

**S'il accepte** : la requête de création porte `delegation: { accepted: true, via: "case"|"mot"|"proposition",
total: 10, parallel: 3, acceptedAt }` ; l'événement `delegation_accepted` est écrit ; le fil affiche « Mode workflow
activé à 18:40 (jusqu'à 10 sous-missions, 3 à la fois) ». Au-delà de l'enveloppe, Relay ne bloque pas en silence : il
lui pose une question dans le fil (« Le chef veut lancer une 11e sous-mission. En autoriser 5 de plus ? »), par la file
de questions existante.

### 1.4 Pendant la mission
- Le fil de la mère montre le message du chef (son découpage), puis un bloc **Sous-missions** : une ligne par fille
  (titre court donné par le chef, agent, état : « en file », « en cours », « attend ta réponse », « attend ton clic »,
  « attend le navigateur », « terminée », « en échec »). Un clic sur une ligne ouvre le fil de la fille, identique à
  celui d'une mission d'aujourd'hui.
- Exemple de découpage que pourrait faire le chef (c'est lui qui décide, pas Relay) : deux filles « Recherche SEEK » et
  « Recherche LinkedIn » (navigateur) ; puis une fille par offre retenue « CV et lettre — offre 0NN » (sans navigateur,
  trois à la fois) ; puis une fille par entreprise « Décideurs et e-mails » (navigateur) ; enfin une fille par décideur
  « Message » (e-mail et LinkedIn, avec cartes d'envoi).
- **Questions** : une question d'une fille arrive dans le panneau « Demandes » de la mère, avec le titre de la fille ;
  y répondre répond à la fille (même formulaire qu'aujourd'hui).
- **Cartes d'envoi** : elles s'affichent de même, préfixées « Sous-mission « Message — décideur 2 » ». Rappel de la
  règle : l'envoi final attend ton clic ; « Autoriser tous les envois de cette mission » vaut pour les envois suivants
  de la même mission par le navigateur, jamais de façon permanente, une reprise redemande le clic, l'e-mail SMTP garde
  une carte par envoi. Ce que « la même mission » veut dire dans une famille est la question 1 (section 10).

### 1.5 À la fin
Le Bilan de la mère : la réponse du chef ; puis « Sous-missions (12) » avec, pour chacune, titre, agent, état, durée et
son propre Bilan cité ; puis les totaux vus par Relay (envois réellement approuvés, refusés, échecs) ; puis la
consommation (section 7). Détail en section 4.

## 2. Le contrat des outils prêtés à l'agent chef

### 2.1 Où vivent les outils, et pourquoi là
**Constaté** : l'agent reçoit ses outils d'un processus « passerelle MCP » lancé par mission
(`packages/orchestrator/index.js:518-593`, `packages/orchestrator/workflow-run.js:24-31`) ; ce processus ne touche pas
la base : il rappelle l'API par des routes internes protégées par un jeton propre à la mission
(`RELAY_APPROVAL_TOKEN`, `index.js:577-588` ; routes `apps/api/server.js:473-494` pour les accords, `726-736` pour
l'usage). La session ACP accepte déjà une **liste** de serveurs MCP (`packages/agent-runtime/index.js:355-380`), mais
une seule est passée aujourd'hui (`index.js:1566`).

**Proposé** : un second serveur MCP, `packages/mission-gateway/server.js` (nouveau), nommé `relay-missions`, ajouté à
cette liste **seulement** quand `delegation.accepted` est vrai. Il ne fait que relayer chaque appel vers une route
interne nouvelle, `POST /api/internal/missions/<runId>` (`apps/api/server.js`), avec le même jeton. Raisons : même
protocole pour tous les agents ; aucune modification de `packages/mcp-gateway/server.js` (occupé par `ecriture-18-11`) ;
un processus distinct se coupe proprement avec la mission.

Côté API : `POST /api/delegation/check { prompt }` rend `{ voie: "mot"|"proposition"|null, mots: [...], etapes: n,
enveloppe: { total, parallel }, derniereFois: {...}|null }` (1.2) ; `POST /api/runs` accepte le champ `delegation` ;
`GET /api/runs/:id` ajoute `family` (2.3, 3.3).

### 2.2 Les cinq outils
Tous rendent du JSON en texte. Une erreur rend `isError: true` et `{ "erreur": "<code>", "message": "…" }`. Un appel ne
voit et ne touche que les descendants de la mission qui l'appelle (le jeton identifie la mission).

**`mission_lancer`** — confie une partie de la mission à une sous-mission ; rend la main tout de suite.
| Paramètre | Type | Défaut | Sens |
|---|---|---|---|
| `consigne` | texte, 1 à 8 000 car. | requis | ce que la sous-mission doit faire (sa « mission ») |
| `titre` | texte, 1 à 80 car. | 60 premiers car. de la consigne | libellé montré au propriétaire |
| `agent` | identifiant d'agent installé | le même que l'appelant | quel agent fait la sous-mission |
| `modele` | texte | celui de l'appelant si même agent, sinon le défaut | modèle annoncé par cet agent |
| `fichiers` | liste de 20 chemins de l'espace au plus | aucun | fichiers que la sous-mission lit d'abord (données) |
| `reprendre` | identifiant d'une sous-mission | aucun | reprend une sous-mission interrompue ou en échec (nouvelle mission « reprise de ») |

Résultat : `{ "id", "titre", "etat": "en_file"|"en_cours", "agent", "modele", "famille": { "lancees", "enCours",
"total", "parallel" } }`. Au-delà de `parallel`, la sous-mission est **mise en file** (`en_file`) et démarre d'elle-même
quand une place se libère : pas d'erreur à gérer, pas de boucle de relance (le moteur de DAG fait déjà de même,
`packages/workflow-engine/index.js:247-248`).
Erreurs : `enveloppe_atteinte` (total atteint : Relay pose aussi la question au propriétaire, 1.3 ; si oui, l'appel
suivant passe), `agent_indisponible` (non installé, ou limite d'usage atteinte : `{ agent, reprise: "22:00" }`),
`modele_inconnu` (même contrôle qu'aujourd'hui, `index.js:833`), `boucle` (consigne identique, au blanc près, à
celle d'une mission ancêtre, 2.4), `mission_terminee` (la mère se termine ou est annulée), `reprise_impossible`.

**`mission_suivre`** — où en sont les sous-missions.
Paramètres : `id` (facultatif ; sans `id`, toutes les filles de l'appelant), `details` (booléen, défaut `false`).
Résultat : `{ "missions": [ { "id", "titre", "agent", "etat", "depuis": s, "inactiveDepuis": s, "attend":
null|"question"|"carte_envoi"|"navigateur"|"place", "outils": n, "dernierOutil": "career_read" } ] }` ; avec
`details: true` et une sous-mission finie, le même contenu que `mission_attendre` pour elle (réponse, Bilan, fichiers).
Erreur : `introuvable`.

**`mission_attendre`** — attend la fin d'une ou de toutes les sous-missions, sans rien perdre.
| Paramètre | Type | Défaut | Sens |
|---|---|---|---|
| `ids` | liste d'identifiants | toutes les filles en cours de l'appelant | lesquelles attendre |
| `toutes` | booléen | `false` | `false` : rend la main dès qu'une finit ; `true` : quand toutes ont fini |
| `delaiSecondes` | entier, 1 à 600 | 50 | au-delà, rend la main avec ce qui est fini et ce qui tourne encore |

Résultat : `{ "terminees": [ { "id", "titre", "etat": "completed"|"failed"|"cancelled"|"interrupted", "reponse": "…",
"bilan": "…", "fichiers": [...], "envois": { "approuves": n, "refuses": n }, "cause": null|{ "type":
"limite_usage"|"erreur", "agent", "reprise", "message" } } ], "enCours": [ { "id", "titre", "etat", "attend" } ],
"delaiAtteint": bool }`. `reponse` est la réponse finale de la fille (50 000 caractères au plus, marquée « données ») ;
`bilan` est son Bilan tel que Relay l'a écrit. Chaque fille finie est rendue **une fois** par `mission_attendre`, mais
reste lisible ensuite par `mission_suivre { id, details: true }` : un délai atteint ne perd jamais un résultat (leçon de
CAO, 2.6). Pendant l'attente, les minuteurs propres au chef (silence, outil figé, délai de mission) sont mis en pause,
comme pendant une question (`index.js:1422`, `2398`) : c'est Relay qui attend, pas l'agent qui se tait.
Pourquoi 50 s par défaut : chaque CLI coupe peut-être un appel d'outil MCP trop long (hypothèse ; aucun délai mesuré
ici, CAO note qu'un délai de fournisseur d'environ 600 s tombe avant le sien, 2.6) ; un appel court et répété marche
partout. Le premier essai réel le mesure avec Claude et Codex (section 9).

**`mission_preciser`** — envoie une précision à une sous-mission en cours.
Paramètres : `id` (requis), `texte` (1 à 8 000 car.). Résultat : `{ "id", "etat": "remis"|"en_attente" }`. Erreurs :
`introuvable`, `mission_terminee`. Il passe par le chemin des messages du propriétaire en cours de mission
(`index.js:2482-2523`), avec **un libellé à lui** (« Précision de la mission mère ») : il ne doit jamais apparaître comme
venant du propriétaire (`OWNER_MESSAGE_LABEL`, `index.js:290`).

**`mission_annuler`** — arrête une sous-mission et toute sa descendance.
Paramètres : `id` (requis), `raison` (500 car. au plus). Résultat : `{ "id", "etat": "cancelled", "descendants": n }`.
Une sous-mission déjà finie rend son état sans erreur. Erreur : `introuvable`. Même chemin que l'annulation par le
propriétaire (`index.js:2470-2477`) : questions ouvertes fermées, carte d'envoi ouverte refusée.

### 2.3 Ce qu'une sous-mission reçoit, et ce qu'elle rend
**Reçoit** : une mission Relay créée par la fonction existante `create()` (`index.js:1055`), avec :
- prompt = `consigne` du chef ; pour une famille career-ops, rangé dans l'espace privé comme celui d'une mission
  (`index.js:1170-1173`), jamais en base ;
- agent et modèle : ceux de l'appel, contrôlés comme aujourd'hui (`index.js:818-834`) ;
- pack, Skill et espace de travail : ceux de la famille (career-ops pour l'exemple), sans choix possible au premier
  sprint ;
- les mêmes consignes de pack que toute mission (`CAREER_INSTRUCTIONS`, `packages/career-ops/integration.js:26`, via
  `index.js:1626`), plus une phrase commune nouvelle, définie à un seul endroit (`packages/orchestrator/delegation-rule.js`),
  la même pour tous les agents, sans nom d'agent : « Tu es une sous-mission lancée par l'agent chef d'une mission du
  propriétaire. La demande du propriétaire, jointe, prime ; ta consigne est la partie qui t'est confiée. Ta réponse
  finale est rendue au chef. Tes questions au propriétaire et tes cartes d'envoi lui arrivent directement. D'autres
  sous-missions peuvent travailler en même temps dans le même espace. » ;
- dans le JSON du prompt, à côté de `objective`, un champ `famille`: `{ demandeDuProprietaire: <prompt de la mère>,
  mere: <id>, soeurs: [titres], fichiers: [...] }`, donné comme donnée.
Le chef, lui, reçoit une autre phrase du même fichier : « Mode workflow accepté par le propriétaire : tu peux confier
des parties de la mission à des sous-missions avec les outils mission_… ; chacune est une mission complète, avec ses
questions au propriétaire et ses cartes d'envoi ; tu reçois sa réponse et son Bilan ; jusqu'à N sous-missions, M à la
fois. » Elle informe, n'oblige à rien : le chef peut tout faire lui-même.

**Rend** (dans `mission_attendre`) : sa réponse finale, son Bilan écrit par Relay, la liste des fichiers qu'**elle** a
produits (d'après ses propres appels d'outils, voir 4 et 6 : pas d'après la date), ses envois approuvés et refusés, et la
cause d'un échec (limite d'usage avec heure de reprise, erreur).

### 2.4 Plafonds, profondeur, boucles
- **En parallèle** : `parallel` de l'enveloppe (défaut 3, 8 au plus comme le moteur de DAG,
  `packages/workflow-engine/definition.js:40`). Au-delà : file d'attente, pas d'erreur.
- **Au total** : `total` (défaut 10) ; au-delà, Relay te demande (1.3).
- **Plafond global** : aujourd'hui « Trois exécutions maximum » (`index.js:1056`, `1071`, `1106`). **Proposé** : une
  famille compte pour **une** place ; à l'intérieur, `parallel` décide. Sans cela, chef + 3 filles = 4 > 3.
- **Profondeur** : au sprint 1, seules les mères reçoivent les outils. **Proposé** ensuite (sprint 4) : mêmes outils
  pour tous les membres de la famille (rien de propre à un rôle), dans la **même** enveloppe. Pour career-ops, le Skill
  dit déjà qu'un ouvrier ne relance pas d'autres agents (Skill : `modes/_shared.md:279-286`, « single-pass worker ») ;
  c'est le Skill qui décide du comment, Relay n'ajoute pas d'interdiction.
- **Éviter une boucle sans brider** : (1) l'enveloppe, qui compte toute la descendance ; (2) le refus `boucle` d'une
  consigne identique à celle d'un ancêtre (c'est la seule vraie boucle : se redéléguer la même tâche) ; (3) aucune
  limite de profondeur fixe. subagent-mcp fait autrement (profondeur 2 au plus et un marqueur ajouté au prompt,
  `src/index.ts:1525`, `src/launch-prompt.ts:8-30`) : ce marqueur serait un texte imposé à l'agent, on ne le reprend pas.

### 2.5 Autres règles du contrat
- **Mêmes outils, même texte, pour tous les agents** : aucune branche sur l'identité de l'agent. Un point à trancher par
  le manager : la liste des agents installés (avec leur état, par exemple « limite atteinte jusqu'à 22:00 ») ne figure
  dans aucune consigne ; elle n'apparaît que dans le **résultat** de `mission_suivre` (donnée de la machine), sinon le
  chef ne pourrait pas choisir un autre agent.
- **Seules les filles directes** sont rendues à un appelant ; une petite-fille est rendue à sa mère.
- **Fin du tour du chef avec des filles en cours** : Relay envoie au chef **un** tour de plus (« Tes sous-missions X, Y
  sont encore en cours : attends-les avec mission_attendre ou annule-les, puis termine »), sur le modèle du tour
  supplémentaire des messages du propriétaire (`index.js:2478-2481`). Si le chef termine encore, la mère passe « attend
  ses sous-missions » et Relay écrit son Bilan quand la dernière fille finit.

### 2.6 Ce qu'on prend des dépôts de référence (lecture seule, licences Apache-2.0 toutes deux)
| Idée | Où (constaté par le relevé) | Repris ? |
|---|---|---|
| Lancer sans attendre, puis suivre / attendre / tuer | subagent-mcp `launch_agent`, `poll_agent`, `wait`, `kill_agent` (`src/index.ts:1507`, `1859`, `2352`, `1971`) | oui : `mission_lancer`, `mission_suivre`, `mission_attendre`, `mission_annuler` |
| Une attente bornée qui rend la liste de ce qui tourne, chaque fini rapporté une fois | `wait` (15 min fixes, `src/index.ts:2359`, `2497-2508` ; `wait-helpers.ts:21-25`) | oui, délai réglable et court |
| Identifiant connu **avant** l'attente, résultat écrit durablement et relisible | CAO `job_id` et table `handoff_results` (`clients/database.py:665-700`) ; faille : sans `job_id` si le délai du fournisseur tombe d'abord (`utils/orchestration.py:1626-1633`) | oui : l'`id` est rendu par `mission_lancer`, le résultat est la mission en base |
| Message à un agent en cours | subagent-mcp `send_message` (`2125`), CAO `send_message` (`mcp_server/server.py:923`) | oui : `mission_preciser` |
| État en mémoire seulement | subagent-mcp (`get_status` : pas de fichier d'état) | non : Relay garde tout en base |
| Profondeur fixe et marqueur dans le prompt | subagent-mcp (`1525`, `launch-prompt.ts`) | non (2.4) |
| Plafond de délégation hérité par droits | CAO `delegate_tools` (`utils/orchestration.py:621`, `763`) | non : enveloppe acceptée par le propriétaire à la place |

## 3. Le lien entre mission mère et sous-missions

### 3.1 Stockage
**Constaté** : une mission est une ligne JSON libre (`packages/storage/index.js:15`, `81-100`) ; ajouter des champs ne
demande aucune migration. Un seul processus écrit dans la base : les passerelles rappellent l'API par HTTP
(`packages/mcp-gateway/server.js:97-142`) et aucune n'importe le stockage (recherche négative dans `mcp-gateway`,
`browser-gateway`, `career-ops`) ; WAL et `busy_timeout=5000` (`storage/index.js:14`) suffisent donc.
**Proposé**, champs nouveaux d'une mission : `famille: { racine, mere, profondeur, titre }` sur une fille ;
`delegation: { accepted, via, total, parallel, acceptedAt, extensions: [...] }` sur la racine. La liste des filles se
déduit (`store.list()` filtré par `famille.mere`), sans table nouvelle. Événements nouveaux, écrits sur la mère :
`delegation_accepted`, `delegation_declined`, `child_launched { childId, titre, agent, modele }`,
`child_state { childId, state }`, `child_done { childId, state }`.

### 3.2 États
Une fille a les états de toute mission (`queued`, `running`, `awaiting_owner`, `waiting_permission`, `completed`,
`failed`, `cancelled`, `interrupted`) ; « en file » = `queued` en attente d'une place de la famille. La mère reste
`running` tant qu'une fille vit ; le fil le dit (« attend ses sous-missions »). Les missions en attente du propriétaire
ne comptent pas comme places occupées (règle actuelle, `index.js:2322-2333`) ; la même règle vaut dans la famille.

### 3.3 Affichage dans le fil
`GET /api/runs/:id` ajoute `family: [{ id, titre, agent, state, attend, pendingQuestion, pendingPermission }]`
(`apps/api/server.js:248-270`, à étendre). Front : nouveau bloc `src/Family.tsx` dans `src/Mission.tsx` ; le panneau
des demandes (`src/OwnerRequests.tsx`) liste aussi celles des filles, chacune répondue par la route existante de la
fille. Le fil de chaque fille reste son flux d'événements à elle (`apps/api/server.js:217-246`).

### 3.4 Reprise après un arrêt
**Constaté** : au redémarrage de l'API, toute mission non finie passe `interrupted` (`storage/index.js:53-70`) ; une
mission ordinaire se reprend en une **nouvelle** mission avec un point de reprise (`apps/api/server.js:419-444`,
`index.js:1018`) ; l'accord d'envoi de mission ne survit pas à une reprise (`index.js:703-707`).
**Proposé** : toute la famille passe `interrupted`. Reprendre la mère crée un nouveau chef dont le point de reprise
liste les filles : finies (avec réponse et Bilan, jamais refaites), interrompues (reprenables). Le chef relance une fille
interrompue par `mission_lancer { reprendre: <id> }`, ce qui appelle la reprise existante (`create(input, previous)`).
Rien n'est rejoué à l'aveugle : un envoi d'une fille interrompue reste à confirmer, comme aujourd'hui.

### 3.5 Annulation en cascade
Annuler la mère (bouton du propriétaire, `apps/api/server.js:415-418`, `index.js:2470`) annule toutes les filles non
finies, puis leurs descendantes ; chaque annulation ferme ses questions et refuse sa carte d'envoi ouverte, comme
aujourd'hui. Annuler une fille (par toi depuis son fil, ou par `mission_annuler`) n'arrête qu'elle et sa descendance ;
le chef l'apprend par `mission_attendre` (`cancelled`).

### 3.6 Les questions d'une sous-mission
Elles empruntent la file existante : formulaire ACP ou champ `question` en JSON (`index.js:2367-2410`,
`docs/api-questions.md`), état `awaiting_owner` **de la fille**, réponse par `POST /api/runs/<fille>/answer`. Elles ne
passent pas par le chef : il ne peut pas répondre à ta place. Il voit `attend: "question"` dans `mission_suivre`. Défaut
connu qui s'appliquera aussi aux filles : E130 (question de Codex perdue), en cours de correction (`precision-18-11`).

### 3.7 Les cartes d'envoi restent à ton clic
**Constaté** : la carte naît dans la passerelle (clic ou écriture réseau d'envoi), remonte par
`/api/internal/approvals/<mission>` (`apps/api/server.js:473-494`) vers `gatewayApproval` (`index.js:595-723`) puis la
file d'accords (`index.js:2202-2320`) ; ton clic revient par `POST /api/permissions/:id`. « Autoriser tous les envois de
cette mission » pose `sendGrant` sur la mission (`index.js:704-707`), seulement pour les canaux que le pack déclare
(`index.js:725-728` ; career-ops : `browser`, donc l'e-mail SMTP garde une carte par envoi) ; l'accord meurt avec la
mission et ne survit pas à une reprise ; un autre envoi encore en vol fait revenir la carte (`index.js:179-187`).
**Proposé** : chaque fille étant une mission, la règle s'applique **telle quelle, sous-mission par sous-mission**, tant
que tu n'en décides pas autrement (question 1) : la première carte de chaque fille propose « Autoriser tous les envois
de cette mission » pour elle seule. Variante si tu le choisis : l'accord cliqué sur n'importe quelle carte de la
famille vaut pour toute la famille (une seule mission à tes yeux, puisque tu n'as écrit qu'un prompt), toujours jamais
permanent, perdu à la reprise, et l'e-mail SMTP garde sa carte par envoi. Dans les deux cas : chaque envoi est tracé
(`send_auto`, `send_grant`) et dit au Bilan de la fille, puis cité par celui de la mère.

## 4. Le Bilan
**Constaté** : le Bilan d'une mission career-ops est assemblé à la fin d'`execute` (`index.js:1935-1964`,
`formatCareerBilan` à `packages/career-ops/truth.js:981`, ligne d'envoi `formatSendLine` à `index.js:235`) et rangé
dans `result.summary` ; le Bilan d'un DAG reprend seulement la sortie de la dernière étape
(`packages/orchestrator/workflow-run.js:405-407`) et ne sert pas ici. Les fichiers « observés » d'une mission sont
attribués **par date** depuis son début (`index.js:993-1002`, défaut E124).

**Proposé** (`packages/orchestrator/family-bilan.js`, nouveau) : le Bilan de la mère se compose de
1. la réponse du chef, telle quelle ;
2. une section écrite par Relay, « Sous-missions (n) », une entrée par fille : titre, agent et modèle, état, durée,
   lien, puis **son Bilan cité mot pour mot** (en bloc de citation ; s'il dépasse 3 000 caractères, ses lignes « Envois »
   et « Actions échouées » sont citées entières et le reste renvoie à la fille) ;
3. les totaux vus par Relay sur toute la famille : filles réussies, en échec, annulées ; envois approuvés, refusés,
   par carte ou par accord de mission (comptés depuis les événements des filles, pas depuis leurs textes) ;
4. une ligne de confrontation quand le chef annonce un nombre d'envois ou de fichiers différent de ces totaux (« Le chef
   annonce 4 e-mails envoyés ; Relay a vu 2 envois approuvés »), sur le modèle de la confrontation des liens
   (`assessBrowserClaims`, `workflow-run.js:348`) ;
5. la consommation (section 7).
La mère ne réécrit, ne résume ni ne corrige jamais le Bilan d'une fille. **Fichiers** : dans une famille, la date ne
dit plus qui a écrit quoi (deux sœurs travaillent en même temps). Le Bilan d'une fille ne liste que les fichiers nommés
par **ses** appels d'outils (`produced`, `rendered`, chemins écrits, rapportés par
`packages/mcp-gateway/server.js:78-92`, `117-119`) ; la liste par date n'est donnée qu'au niveau de la mère, pour toute
la famille, et un même fichier écrit par deux sœurs y est signalé.

## 5. Le navigateur

### 5.1 État actuel (constaté, relevé du sous-agent)
- Un processus passerelle par mission crée **un** `CdpBrowser` vers le relais (`packages/mcp-gateway/server.js:228-245`),
  donc **un onglet par mission** : une page unique par instance (`packages/browser-gateway/cdp.js:658`, `674-675`).
- Chaque connexion a son identifiant propre `/cdp/relay-<uuid>` (`packages/browser-gateway/owner-transport.js:8-19`) :
  sans lui, le relais refusait un doublon et coupait le premier client. Deux missions = deux connexions = deux onglets,
  chacun créé avec un marqueur `about:blank#relay-<uuid>` (`owner-transport.js:93`, `212`) ; une connexion ne voit que
  ses propres onglets (`owner-transport.js:262`, `276-280`).
- Les actions d'une mission passent une à une (`packages/browser-gateway/index.js:163-166`) ; **aucun verrou entre
  missions** (recherche négative).
- L'onglet s'ouvre en arrière-plan ; Relay l'empêche de se croire caché (`owner-transport.js:107-117`), mais
  `bringToFront` le met devant après une carte d'envoi (`cdp.js:1822-1824`, appel `index.js:477`) : avec plusieurs
  missions, ton onglet visible changerait à chaque carte (hypothèse).
- Fin de mission : l'onglet et ses fenêtres surgissantes sont **fermés**, tes onglets jamais touchés
  (`owner-transport.js:55-80`, `cdp.js:3176-3190`).
- Le relais est lancé à la demande de chaque mission, sans attendre (`index.js:575` ; `relay-start.js:20-42`) : deux
  lancements simultanés pourraient démarrer deux `playwriter serve` (hypothèse, aucun verrou vu).
- Le Skill pose la même règle que ce découpage : des ouvriers en parallèle ne partagent jamais une session de navigateur
  ; chacun a la sienne, sinon l'étape qui navigue passe en série (Skill : `modes/_shared.md:272`, `284`).
Donc l'isolement par sous-mission existe déjà sur le papier ; **personne ne l'a éprouvé à deux en même temps**.

### 5.2 L'essai à plusieurs onglets (décrit, non lancé)
**Quand** : un créneau où ton Chrome ne sert à aucune autre mission (environ 30 min), relais 19988 actif. **Où** : une
API temporaire sur l'arbre du sprint (port 4315, espace d'essai `~/Downloads/career-ops-essai`), jamais l'API 4314.
**Étape A, sans agent** (script `.manager/outils/essai-onglets.mjs`, nouveau) : il lance deux, puis trois passerelles
comme le fait Relay et les pilote en même temps sur des pages **fictives** locales (page de candidature 4321 et une page
de mesure nouvelle, `tests/support/onglets-page.js`, qui affiche un compteur par seconde et un marqueur saisi).
**Étape B, avec agents** : une famille réelle, chef + deux filles qui **lisent** chacune une page de résultats SEEK
(aucune écriture, aucun envoi), avec Claude puis avec Codex.

| Mesure | Comment | Ça marche si |
|---|---|---|
| Chaque mission garde son onglet | identifiants de cible et URL par passerelle, 20 paires d'actions simultanées | 0 action dans l'onglet d'un autre |
| Pas de mélange de saisie | un marqueur tapé dans A n'apparaît jamais dans B (capture de B) | 0 fuite |
| Onglet en arrière-plan vivant | compteur de la page de mesure : vitesse en arrière-plan / au premier plan ; clics suivis d'effet | rapport ≥ 0,5 ; 0 clic sans effet |
| Captures lisibles | pas de capture vide ni `about:blank` après une navigation | 0 capture vide |
| Connexion stable | pas d'événement « relais perdu » (`mcp-gateway/server.js:290-309`), pas de refus 4004 | 0 perte |
| Carte d'envoi au bon onglet | carte ouverte dans A pendant que B navigue ; après ton clic, le compteur `/count` de la page fictive monte d'**un** | +1 exactement |
| Ton onglet actif | l'onglet que tu regardes change-t-il sans carte ? | jamais hors carte |
| Lenteur | durée médiane d'une action à 1, 2, 3 onglets | moins du double à 3 |
| Un seul relais | nombre de processus `playwriter serve` après deux lancements au même instant | 1 |
| Fermeture | à la fin, onglets des missions fermés, les tiens intacts | tous fermés, aucun des tiens |

**Comment s'en apercevoir si ça ne marche pas**, même hors essai : les événements `browser_unproven`
(`workflow-run.js:341-344`), « relais perdu » et repli de navigateur (`mcp-gateway/server.js:267-309`), les captures
vides et les actions échouées des Bilans, tous attribués par mission ; le Bilan de la mère les additionne par famille.
**Règle de décision** : adopté si l'étape A passe toutes les lignes du tableau et l'étape B réussit avec Claude et avec
Codex ; sinon repli 5.3, et l'essai dit quelle ligne a cassé.

### 5.3 Le repli : un seul onglet actif à la fois, par bail
Chaque fille garde son onglet (rien à refaire dans `cdp.js`), mais **une seule à la fois** agit dans le navigateur :
- **Prise du bail** : avant chaque action navigateur, la passerelle fait déjà payer l'action à Relay
  (`packages/browser-gateway/index.js:519` → `packages/mcp-gateway/meter.js:7-27` → `gatewayUsage`, `index.js:458-476`,
  dimension `browser_action`). C'est le point d'accroche, côté Relay. Si une sœur tient le bail, la route répond
  « occupé » (HTTP 423 avec un délai) et `meter.js` réessaie jusqu'à son tour, au lieu d'échouer au bout de 15 s comme
  aujourd'hui (`meter.js:19`). Deux fichiers seulement : `meter.js` (aucun sprint en cours ne le touche) et
  l'orchestrateur (nouveau `packages/orchestrator/browser-lease.js`).
- **Rendu du bail** : 20 s après la dernière action de la fille, à la fin de sa mission, ou au plus tard après 3 min si
  une sœur attend (pour qu'aucune n'attende sans fin). Une carte d'envoi ouverte garde le bail jusqu'à ton clic : la page
  à envoyer ne doit pas bouger.
- **Ce que tu vois** : « attend le navigateur (occupé par « Recherche SEEK ») » sur la ligne de la fille.
- **Ce que l'agent voit** : rien de neuf, son action part simplement plus tard ; aucune action n'est refusée.
Le parallèle reste entier pour tout ce qui ne navigue pas (CV, lettres, lecture de fichiers).
Dans les deux cas, Relay lance le relais **une fois** avant la première fille qui navigue (fin de la course 5.1), côté
orchestrateur.

## 6. L'espace de travail partagé
**Constaté** : « Une seule mission privée à la fois dans cet espace » (`index.js:1088-1108`) ; une mission career-ops
travaille directement dans l'espace (`index.js:1113-1117`) ; l'API refuse de modifier les entrées pendant une mission
privée (`apps/api/server.js:123-128`) ; une écriture est atomique fichier par fichier (fichier temporaire puis
renommage, `packages/policy-engine/files.js:37-55`) mais **le dernier qui écrit gagne**, sans verrou.
**Le Skill a déjà sa méthode de travail en parallèle** (Skill : `AGENTS.md:593`) : avant N évaluations en parallèle,
réserver les numéros de rapport (`node reserve-report-num.mjs --count N`) et donner le sien à chaque ouvrier, « ne
jamais laisser des ouvriers calculer max+1 eux-mêmes » ; une ligne de suivi par fichier
`batch/tracker-additions/{num}-{entreprise}.tsv` (`AGENTS.md:636`), puis `node merge-tracker.mjs` une fois après le lot
(`AGENTS.md:602`).

**Proposé**, en trois niveaux :
1. **Partage dans la famille** (sprint 1) : l'exclusivité ne bloque plus les membres d'une même famille ; toute autre
   mission reste refusée tant que la famille vit. Les prompts et résultats de chaque fille restent dans
   `relay/runs/<id>-*.json`, déjà propres à chaque mission.
2. **Le Skill décide du comment** : Relay ne réécrit rien de cette méthode ; la phrase commune dit seulement que des
   sœurs écrivent en même temps (2.3). Le chef et les filles suivent le Skill (réservation, TSV, fusion unique).
3. **Filet de Relay** (sprint 4) : (a) un même chemin écrit par deux sœurs est signalé au Bilan (section 4) ; (b) deux
   écritures du même chemin par deux membres de la famille passent l'une après l'autre ; (c) un seul script du Skill à la
   fois par famille quand il réécrit le suivi (`merge-tracker`, `tracker sync`). (b) et (c) demandent que la passerelle
   dise à Relay quel outil et quel chemin elle va toucher : une ligne dans `packages/mcp-gateway/server.js`, donc
   **après** l'intégration d'`ecriture-18-11`. On n'ajoute (b) et (c) que si les essais montrent un écrasement : ils
   évitent un défaut, ils ne retirent aucune action à l'agent.

## 7. La limite d'usage
**Constaté** : Relay ne compte pas les jetons ; il compte des tours de modèle par mission (`byoa_model_turn`, registre
de facturation) et ne voit une limite qu'au moment où elle tombe, par l'annonce de l'agent ou par son état `rateLimit`
dans ACP (`packages/orchestrator/failure.js:8-14`, `27-42`), qui donne parfois l'heure de reprise. Les missions Claude
du propriétaire puisent dans la même limite que ses autres usages de Claude ; les missions Codex non (`.manager/HANDOFF.md`,
section 0). Le 18/11, la limite est passée de 74 % à 84 % sans mission (cause non établie).

**Ce que le mode consomme de plus** : à peu près une mission ordinaire par sous-mission, plus le chef ; avec 3 filles en
parallèle, trois fois plus vite. Le chef, pendant `mission_attendre`, ne consomme pas (il est en attente d'un outil).

**Le dire avant** : la carte d'avertissement (1.3) donne l'enveloppe et, dès qu'une famille a tourné, les chiffres réels
de la dernière (nombre de sous-missions, tours de modèle, durée cumulée des agents, par agent). Aucun pourcentage
d'abonnement inventé : Relay ne le connaît pas.

**Le dire après** : une ligne du Bilan de la mère, « Consommation : 12 sous-missions, 96 tours de modèle, 2 h 05
d'agents cumulés (Claude 1 h 40, Codex 25 min) ».

**Abonnement épuisé en cours de route** :
- une fille coupée finit `failed` avec la cause « Limite d'usage de X atteinte : réessayer à 22:00 » (déjà produite par
  `usageLimitMessage`) ; `mission_attendre` la rend au chef avec `cause.type = "limite_usage"` ;
- Relay note l'agent épuisé jusqu'à l'heure de reprise : `mission_lancer` vers cet agent rend `agent_indisponible` avec
  l'heure (un fait, pas une interdiction) ; les filles en file pour cet agent attendent l'heure de reprise ;
- le fil te le dit tout de suite (« Limite d'usage de Claude atteinte, reprise 22:00 : 2 sous-missions arrêtées ») ;
- passer sur un autre agent consomme un autre abonnement : la question 3 décide si le chef le fait seul ;
- si c'est le chef qui est coupé, la mère s'arrête, ses filles continuent ; Relay écrit le Bilan de la famille quand
  elles finissent ; tu reprends la mère après la remise à zéro (3.4).

## 8. Ce qu'on réutilise, ce qui est neuf
**Réutilisé tel quel ou presque** :
| Brique | Où | Pour |
|---|---|---|
| Création d'une mission | `create()`, `index.js:1055-1179` | lancer une fille |
| Exécution d'une mission | `execute()`, `index.js:1270` | faire tourner une fille, sans changement de fond |
| Reprise | `create(input, previous)`, `apps/api/server.js:419-444` | `mission_lancer { reprendre }`, reprise de famille |
| Questions | `elicit`, `enqueueQuestion`, `answer` (`index.js:2367-2465`), `docs/api-questions.md` | questions des filles, question d'extension d'enveloppe |
| Cartes et accord de mission | `gatewayApproval`, `permission`, `sendGrant` (`index.js:595-728`, `2202-2320`) | cartes des filles, inchangées |
| Messages en cours de mission | `message()`, `index.js:2482-2523` | `mission_preciser`, avec son libellé |
| Annulation | `cancel()`, `index.js:2470-2477` | cascade |
| Pont interne à jeton | `mcpServerFor` (`index.js:518-593`), routes `/api/internal/*` | serveur `relay-missions` |
| Session à plusieurs serveurs MCP | `packages/agent-runtime/index.js:355-380` | prêter les outils du chef |
| Pause des minuteurs | `index.js:1422`, `2398` | pendant `mission_attendre` |
| Détection de limite | `packages/orchestrator/failure.js` | cause d'échec d'une fille |
| Compteur avant action navigateur | `packages/mcp-gateway/meter.js`, `gatewayUsage` | bail (repli seulement) |
**Non utilisé par l'option B** : le moteur de DAG (`packages/workflow-engine/`, `packages/orchestrator/workflow-run.js`)
reste pour les recettes déclarées par un pack (option A) ; l'interdiction du prompt d'étape (`workflow-run.js:290`) ne
concerne pas le chef et n'est pas à lever pour ce mode. Le chef pourra plus tard lui confier un plan déclaré.

**Neuf, fichier par fichier** :
| Fichier | Nouveau / modifié | Contenu |
|---|---|---|
| `packages/mission-gateway/server.js` | nouveau | serveur MCP `relay-missions` : les cinq outils, relais vers l'API |
| `packages/orchestrator/delegation.js` | nouveau | enveloppe, famille, file des filles, refus `boucle`, repérage des voies 2 et 3 |
| `packages/orchestrator/delegation-rule.js` | nouveau | les deux phrases communes (chef, sous-mission) |
| `packages/orchestrator/family-bilan.js` | nouveau | section « Sous-missions » du Bilan de la mère, totaux, confrontation |
| `packages/orchestrator/browser-lease.js` | nouveau (sprint 5, si besoin) | bail navigateur |
| `packages/orchestrator/index.js` | modifié | champ `delegation`, exception d'exclusivité, place unique par famille, serveur MCP en plus, phrase du chef, tour de fin, cascade, libellé de `mission_preciser`, fichiers par appels en famille |
| `apps/api/server.js` | modifié | `/api/internal/missions/:id`, `/api/delegation/check`, `family` dans `GET /api/runs/:id` |
| `packages/mcp-gateway/meter.js` | modifié (sprint 5) | attendre son tour sur « occupé » |
| `packages/mcp-gateway/server.js` | modifié (sprint 4, une ligne) | dire l'outil et le chemin à Relay avant l'appel |
| `docs/api-delegation.md` | nouveau | contrat des outils et des routes |
| `docs/architecture-cible.md` | modifié | §5.4 : délégation par agent chef (dégel accordé sur ce point) |
| `tests/fixtures/chef-agent.js` | nouveau | faux agent ACP qui appelle les outils du chef (on ne touche pas `tests/fixtures/fake-acp.js`, partagé par les sprints en cours) |
| `.manager/outils/essai-onglets.mjs`, `tests/support/onglets-page.js` | nouveaux | essai à plusieurs onglets |
| front : `src/Composer.tsx`, `src/App.tsx`, `src/Mission.tsx`, `src/OwnerRequests.tsx`, `src/types.ts`, `src/api.ts` | modifiés | case, appel de `/api/delegation/check`, carte, bloc famille, demandes des filles |
| front : `src/Delegation.tsx`, `src/Family.tsx` | nouveaux | carte d'avertissement, bloc des sous-missions |

## 9. Le découpage en sprints
Fichiers des sprints en cours (d'après leurs briefs, `.manager/briefs/`) : `captures-18-11` (`packages/browser-gateway/
cdp.js`, `index.js`, `paginate.js`, `packages/capability-registry/index.js`), `ecriture-18-11`
(`packages/capability-registry/index.js`, `packages/career-ops/tools.js`, `packages/mcp-gateway/server.js`),
`lecture-18-11` (`domain-packs/career-ops/skill-manifest.yaml`, `packages/orchestrator/skill-router.js`,
`browser-proof.js` ; son brief exclut `packages/orchestrator/index.js`), `prompt-prime-18-11`
(`packages/career-ops/integration.js` ; son brief exclut `packages/orchestrator/`), tous éventuellement
`tests/fixtures/fake-acp.js` ; `precision-18-11` (prêt, attend ton oui) : `owner-question-rule.js`,
`docs/api-questions.md`. Les sprints 1 à 3 ci-dessous n'en touchent **aucun**. Chaque sprint suit le cycle habituel :
codeur Opus dans un arbre isolé, relecteur indépendant, contrôle du manager, intégration sur ton accord.

### Sprint 1 — `chef-01` : un chef, des filles, un résultat (le plus petit pas utile)
- **But** : prouver la chaîne chef → filles → résultats → Bilan, sans navigateur et sans front. Activation par l'API
  seulement (`delegation` dans `POST /api/runs`) ; les essais sont lancés par le manager après ton accord dans le chat
  sur la consommation. Outils : `mission_lancer`, `mission_suivre`, `mission_attendre`, `mission_annuler`. Filles sans
  outils de délégation. Exception d'exclusivité de l'espace pour la famille ; une place par famille ; minuteurs du chef
  en pause pendant l'attente ; tour de fin si des filles vivent ; cascade d'annulation ; section « Sous-missions » du
  Bilan (citation des Bilans, totaux) ; fichiers d'une fille attribués par ses appels.
- **Fichiers** : nouveaux `packages/mission-gateway/server.js`, `packages/orchestrator/delegation.js`,
  `delegation-rule.js`, `family-bilan.js`, `docs/api-delegation.md`, `tests/chef-01.test.js`,
  `tests/fixtures/chef-agent.js` ; modifiés `packages/orchestrator/index.js`, `apps/api/server.js`,
  `docs/architecture-cible.md` (§5.4).
- **Tests** (faux agents, sans navigateur) : sans `delegation`, aucun outil `mission_*` prêté et rien ne change ; lancer
  deux filles et les attendre ; `parallel` = 2 avec 3 filles → la troisième « en file » puis démarre ; délai atteint →
  `delaiAtteint` puis résultat relu par `mission_suivre` (rien perdu) ; minuteurs du chef en pause pendant l'attente
  (horloge simulée) ; enveloppe atteinte → erreur et question au propriétaire ; consigne identique à la mère → `boucle` ;
  famille career-ops partage l'espace, une mission étrangère reste refusée ; annulation de la mère → filles annulées ;
  redémarrage → famille `interrupted` ; Bilan de la mère : Bilans cités à l'identique, totaux justes, confrontation ;
  phrase commune identique pour tous les profils d'agents et sans nom d'agent ; une fille ne voit pas les filles d'une
  autre mère.
- **Essai réel** (API temporaire 4315 sur l'arbre du sprint, espace d'essai, puis arrêtée), Claude puis Codex, même
  prompt : « Mode workflow : lance une sous-mission par rapport, pour les trois derniers rapports d'évaluation de mon
  espace ; chacune résume son rapport en cinq lignes ; puis donne-moi un tableau comparatif. N'écris rien, n'envoie
  rien. » On mesure : les deux CLI voient et appellent les outils ; trois filles tournent en même temps ; la plus longue
  attente rendue sans coupure par chaque CLI (règle le défaut de `delaiSecondes`) ; Bilan de la mère conforme aux Bilans
  des filles ; durée et tours.

### Sprint 2 — `accord-02` : prévenu, puis accord (front et trois voies)
- **But** : les trois voies, la carte d'avertissement, le refus, le bloc des sous-missions et les demandes des filles
  dans le fil ; `mission_preciser` ; question d'extension d'enveloppe dans le fil.
- **Fichiers** : back `packages/orchestrator/delegation.js` (repérage des voies), `apps/api/server.js`
  (`/api/delegation/check`, `family`), `packages/orchestrator/index.js` (libellé de la précision du chef, événements),
  `packages/mission-gateway/server.js` (cinquième outil), `tests/accord-02.test.js` ; front `src/Composer.tsx`,
  `src/App.tsx`, `src/Mission.tsx`, `src/OwnerRequests.tsx`, `src/types.ts`, `src/api.ts`, nouveaux `src/Delegation.tsx`,
  `src/Family.tsx` et leurs tests. **Ordre** : après l'intégration du sprint 1 (mêmes fichiers back). Le front peut
  commencer dès que `docs/api-delegation.md` du sprint 1 est figé.
- **Tests** : repérage (mots, enchaînements, aucun faux positif sur une phrase simple) ; la carte s'ouvre avant tout
  `POST /api/runs` pour les trois voies ; « Continuer avec un seul agent » → mission sans outils et ligne au Bilan ;
  « Annuler » → aucune requête ; le réglage par défaut `mode: "workflow"` du front n'active pas le chef ; précision du
  chef jamais libellée comme venant du propriétaire ; question d'une fille répondue depuis la mère.
- **Essai réel** (front temporaire 5178 sur l'API 4315) : toi, avec Claude puis Codex : voie 1 acceptée, voie 2 (« en
  parallèle ») acceptée, voie 3 refusée (mission à un agent), « Annuler » ; même prompt qu'au sprint 1.

### Sprint 3 — `onglets-03` : l'essai à plusieurs onglets (mesure, puis décision)
- **But** : l'essai décrit en 5.2, et la décision « plusieurs onglets » ou « bail ». Aucun code produit, sauf si une
  ligne du tableau casse pour une raison simple à corriger côté orchestrateur.
- **Fichiers** : nouveaux `.manager/outils/essai-onglets.mjs`, `tests/support/onglets-page.js`, rapport
  `.manager/reports/onglets-03.md`. Peut tourner **en même temps** que les sprints 1 et 2 (aucun fichier commun), mais
  l'étape B demande le code du sprint 1 et un créneau sans mission dans ton Chrome.
- **Tests** : la page de mesure (compteur, marqueur) en test unitaire sans navigateur ; le script lui-même n'est pas dans
  `npm test` (il touche le relais).
- **Essai réel** : étape A (sans agent) puis étape B : chef + deux filles qui lisent chacune une page de résultats SEEK,
  Claude puis Codex ; rien d'écrit, rien d'envoyé.

### Sprint 4 — `famille-04` : l'exemple complet (espace partagé, envois, profondeur)
- **But** : ton exemple de bout en bout ; filet de l'espace partagé (6, niveau 3) ; mêmes outils pour tous les membres de
  la famille dans la même enveloppe ; accord d'envoi selon ta réponse à la question 1 ; cause « limite d'usage » et
  agent épuisé (7) ; reprise de famille (3.4) ; relais lancé une fois par famille.
- **Fichiers** : `packages/orchestrator/index.js`, `delegation.js`, `family-bilan.js`, `packages/mission-gateway/server.js`
  (`reprendre`), `apps/api/server.js`, `tests/famille-04.test.js` ; `packages/mcp-gateway/server.js` (une ligne : outil
  et chemin avant l'appel) **seulement après l'intégration d'`ecriture-18-11`**, sinon ce point attend.
- **Tests** : même chemin écrit par deux sœurs → signalé au Bilan, écritures l'une après l'autre ; un seul
  `merge-tracker` à la fois par famille ; accord de famille (ou par fille) selon la question 1, toujours perdu à la
  reprise, e-mail SMTP toujours une carte par envoi ; petite-fille comptée dans l'enveloppe ; limite d'usage simulée →
  `agent_indisponible` avec heure ; reprise de famille sans refaire une fille finie.
- **Essai réel** : ton exemple sur des cibles fictives pour l'envoi : offres réelles lues sur SEEK ; CV et lettres
  (méthode du Skill : réservation des numéros, TSV, fusion) ; décideurs lus sur LinkedIn ; message par e-mail en
  brouillon vers une adresse d'essai et candidature sur la page **fictive** 4321 ; tu cliques les cartes. Claude puis
  Codex.

### Sprint 5 — `bail-05` : le repli à un seul onglet actif (seulement si le sprint 3 échoue)
- **But** : le bail de 5.3. **Fichiers** : nouveau `packages/orchestrator/browser-lease.js`, modifiés
  `packages/mcp-gateway/meter.js`, `packages/orchestrator/index.js` (`gatewayUsage`), `apps/api/server.js` (réponse 423),
  `tests/bail-05.test.js`. Si l'essai montre qu'il faut aussi éviter `bringToFront` hors carte, c'est
  `packages/browser-gateway/cdp.js`, **après** l'intégration de `captures-18-11`.
- **Tests** : deux filles qui naviguent → l'une attend sans erreur ; bail rendu après 20 s d'inactivité, à la fin, ou
  après 3 min si une sœur attend ; une carte ouverte garde le bail ; une fille sans navigateur n'attend jamais.
- **Essai réel** : l'étape B du sprint 3 et les parties navigateur du sprint 4 rejouées sous bail, Claude puis Codex.

## 10. Questions restantes pour le propriétaire, et risques

### Questions (cinq)
1. **Un clic par mission, dans une famille** : « Autoriser tous les envois de cette mission », cliqué sur une carte
   d'une sous-mission, vaut-il pour toute la famille (tu n'as écrit qu'un prompt) ou seulement pour cette
   sous-mission ? Proposé : toute la famille, jamais permanent, perdu à la reprise, e-mail SMTP toujours une carte par
   envoi.
2. **Enveloppe par défaut** proposée dans la carte : 10 sous-missions au total, 3 en même temps (modifiables à chaque
   fois). Ça te va ?
3. **Abonnement épuisé** : le chef peut-il passer seul une sous-mission sur un autre agent (par exemple Codex quand
   Claude est épuisé), ce qui consomme un autre abonnement, ou Relay doit-il te le demander à chaque fois ? Proposé : te
   le demander, par une question dans le fil avec l'heure de reprise.
4. **Proposition en cours de mission** : en plus de la carte avant lancement, veux-tu qu'une mission ordinaire puisse
   te proposer en cours de route de passer en mode workflow (même avertissement) ? Cela prêterait les outils du chef à
   toutes les missions. Proposé : non pour commencer.
5. **Le texte de l'avertissement** (1.3) te convient-il, ou veux-tu d'autres mots ?

### Risques
- **Délais d'appel d'outil propres à chaque CLI** : une attente trop longue peut être coupée par l'agent lui-même
  (hypothèse). Parade : attente courte répétée, mesurée au sprint 1.
- **Le chef peut mal déléguer** : tout faire lui-même, ou découper à l'excès. On le mesure, on ne l'oblige pas ; la
  phrase du chef informe sans prescrire.
- **Consommation** : trois filles en parallèle épuisent une limite trois fois plus vite ; constaté le 18/11 : la limite
  bouge même sans mission. L'enveloppe et la question d'extension sont le seul frein, et c'est toi qui le tiens.
- **Navigateur** : isolement jamais éprouvé à deux ; `bringToFront` peut te voler le premier plan ; double lancement
  possible du relais. D'où l'essai du sprint 3 avant toute famille qui navigue pour de vrai.
- **Espace partagé** : sans la méthode de réservation du Skill, deux filles peuvent écraser un rapport ou fusionner deux
  fois le suivi (dernier qui écrit gagne). Le filet du sprint 4 le voit ; les essais diront s'il faut plus.
- **Fidélité du Bilan** : l'attribution des fichiers par date (E124) devient fausse en famille ; corrigée par
  l'attribution par appels (section 4). Le texte du chef reste son texte ; seuls les faits de Relay font foi.
- **Défauts déjà ouverts qui touchent aussi les filles** : E130 (question de Codex perdue), E128 et E129 (lecture et
  écriture TSV), E134 (minuteur d'outil à 120 s), E118 (Bilan incomplet).
- **Fichier chaud** : `packages/orchestrator/index.js` fait 2 659 lignes ; le neuf va dans des fichiers à part, l'index
  ne reçoit que des branchements courts.
- **Noms d'agents** : ils n'apparaissent que dans les résultats de `mission_suivre` (2.5) ; à valider par le manager au
  regard de la règle « aucun nom d'agent dans un texte envoyé aux agents ».
