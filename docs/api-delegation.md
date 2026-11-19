# Sous-agents d'une mission : contrat de l'API et des outils (`delegation-v2-01`, `multi-agent-v3-01`)

Délégation à des sous-missions, étape 1 du plan v2 du 18/11/2026
(`.manager/reports/delegation-conception-v2-18-11.md` de l'arbre `agregat-back-chef`), qui remplace le contrat du sprint
`chef-01`. L'agent de la mission, **le chef**, **peut** confier des parties délimitées du travail à des
**sous-missions**, missions Relay ordinaires, et en reçoit les résultats ; il reste celui qui décide et qui écrit la
réponse finale. **Autoriser n'oblige jamais** : Relay ne lit pas le prompt, ne compte pas les étapes et ne pousse pas à
déléguer. Ce document est le contrat que le front peut suivre ; ce qui n'existe pas encore est dit en fin de page.

Sprint `multi-agent-v3-01` (19/11/2026, branche de test `delegation-v2-01`) : interrupteur « Mode multi-agent »
(`multiAgent`, éteint par défaut), arrêt des sous-missions quand la mère échoue, durée comptée depuis le départ réel,
prérequis (`apres`), reprises reliées (`reprend`), tâche structurée, dossier de résultats par sous-mission, textes qui
disent que les limites ne portent que sur les sous-missions Relay.

## 1. Qui reçoit les outils : l'interrupteur `multiAgent`

- **Champ `multiAgent` de `POST /api/runs`** (booléen, absent = éteint ; c'est l'interrupteur « Mode multi-agent » du
  front, distinct de l'accord de consommation de la section 2). Avec `multiAgent: true`, la mission part en mode agent
  (un `mode: "workflow"` envoyé par défaut n'en fait pas un DAG) et, dès l'ouverture de la session de son agent, reçoit
  un second serveur MCP `relay-missions` (après le serveur de capacités, qui reste en tête) et, à la fin de ses
  consignes, la phrase du chef (section 5). Une valeur qui n'est pas un booléen rend la requête invalide.
- **Sans `multiAgent`** (ou `false`) : ni second serveur, ni phrase du chef, la route interne rend 403 ; la mission est
  identique à la base `48a2f4e` (consigne envoyée mot pour mot, serveurs `['platform']`, suite d'événements, état,
  réponse, clés de la ligne), prouvé **sans aucune variable d'environnement** par `tests/delegation-v2-01-b.test.js`,
  qui fait tourner le code de la base extrait par `git archive`. Le champ `delegation` seul (accord sans le mode) n'a
  **aucun effet** : ni outils, ni mode agent forcé.
- **Le front doit envoyer `multiAgent: true` quand l'interrupteur est allumé** : sans lui, aucune mission ne peut
  déléguer par Relay, même si son prompt le demande.
- La reprise d'une mission (`POST /api/runs/:id/resume`) recopie `multiAgent: true` (jamais pour une sous-mission).
- **Jamais** une sous-mission (un seul niveau) ; **jamais** un parcours qui n'est pas mené par un agent.
- **Réglage de retrait** : `AGENT_PLATFORM_DELEGATION=0` dans l'environnement de l'API, lu au démarrage comme les autres
  réglages `AGENT_PLATFORM_*`, retire outils et phrase à toutes les missions, même avec `multiAgent` (mission alors
  identique à la base, hors la clé `multiAgent` de sa ligne).
- **Une mission avec `multiAgent` qui ne délègue pas ne change pas** : tant que le chef n'a appelé aucun
  `mission_lancer`, aucun événement, aucune lecture de plus, aucune ligne de Bilan, aucun tour de plus, aucune carte.
  Seuls changent la phrase et le second serveur.

## 2. L'accord du propriétaire : trois voies

Avant la première sous-mission, le propriétaire a été informé de la consommation et a donné son accord, par l'une de
trois voies. Un accord vaut pour la mission et son enveloppe ; il n'est plus redemandé, et la reprise de la mission le
garde (`POST /api/runs/:id/resume`). L'accord d'**envoi** n'est jamais concerné : chaque carte d'envoi reste au clic.

| Voie                          | Ce que fait le propriétaire                                                                                                 | Ce qui se passe                                                                                                                                                                                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Bouton                     | il coche « Autoriser les sous-agents » (texte de la section 6) avant l'envoi ; la requête porte `delegation.accepted: true` | aucune question ; au premier `mission_lancer`, événement `delegation_accepted`                                                                                                                                                                                  |
| 2. Demande dans le prompt     | il écrit qu'il veut des sous-agents                                                                                         | Relay ne lit rien : le chef lance avec `demandeDuProprietaire: true` ; **pas de carte** ; événement `delegation_accepted { via: "prompt", message }`, dont `message` est la ligne du fil (section 6) ; Bilan : « demande écrite dans le prompt, selon l'agent » |
| 3. Carte au premier lancement | rien                                                                                                                        | le premier `mission_lancer` crée la sous-mission **en attente** et rend `etat: "attend_accord"` ; la carte (question à choix) s'ouvre dans la file de questions de la mère ; le chef n'est pas bloqué                                                           |

### 2.1 Champ `delegation` de `POST /api/runs`

```json
{
  "prompt": "…",
  "delegation": {
    "accepted": true,
    "via": "bouton",
    "total": 6,
    "parallel": 3,
    "acceptedAt": "2026-11-19T00:40:00+11:00"
  }
}
```

| Champ        | Type                                     | Défaut | Sens                                                                                                        |
| ------------ | ---------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `accepted`   | booléen                                  | requis | `true` : accord donné ; `false` : refus (tout `mission_lancer` rend `refus_proprietaire`, aucune question)  |
| `via`        | `bouton` \| `prompt` \| `carte` \| `api` | `api`  | voie de l'accord ; `prompt` et `carte` sont écrits par la plateforme (et repris tels quels par une reprise) |
| `total`      | entier 1 à 200                           | **6**  | sous-missions au plus pour la mission                                                                       |
| `parallel`   | entier 1 à 8                             | **3**  | sous-missions en même temps au plus                                                                         |
| `acceptedAt` | date ISO avec fuseau                     | absent | heure de l'accord                                                                                           |

- **Case non cochée : ne pas envoyer le champ.** Sans champ (et avec `multiAgent: true`), l'accord est demandé par la
  carte au premier lancement (voie 3), ou donné par la demande écrite dans le prompt (voie 2).
- Les anciennes valeurs `case`, `mot` et `proposition` de `chef-01` sont refusées (requête invalide).
- `delegation` sans `multiAgent` : aucun effet (section 1). C'est `multiAgent`, et non plus l'accord, qui fait partir
  la mission en mode agent.
- Rien n'est écrit à la création : l'événement `delegation_accepted` n'arrive qu'au premier `mission_lancer` de
  l'exécution (voies 1 et 2) ou à l'accord sur la carte (voie 3).

### 2.2 La carte d'accord (voie 3)

Question de la plateforme, placée dans la file de questions de la mère (carte « Demandes » existante ; la mère passe
`awaiting_owner` tant qu'elle est ouverte), répondue par la route existante `POST /api/runs/:id/answer`
(`docs/api-questions.md`) :

```json
{
  "kind": "form",
  "message": "Autoriser les sous-agents\nL’agent de ta mission pourra, s’il le juge utile, … Les envois restent à ton clic.",
  "requestedSchema": {
    "type": "object",
    "properties": {
      "choix": {
        "type": "string",
        "title": "Choix",
        "oneOf": [
          { "const": "autoriser", "title": "Autoriser pour cette mission" },
          { "const": "continuer_seul", "title": "Non, continue seul" }
        ]
      }
    },
    "required": ["choix"]
  }
}
```

- Une seule carte par mission ; les `mission_lancer` suivants avant la réponse créent aussi des sous-missions en
  attente (`attend_accord`), sans nouvelle question.
- `{ "action": "accept", "content": { "choix": "autoriser" } }` : `delegation = { accepted: true, via: "carte", total,
parallel, acceptedAt }` sur la mission, événement `delegation_accepted { via: "carte" }`, les sous-missions en
  attente démarrent (dans la limite de `parallel`).
- `{ "choix": "continuer_seul" }` ou `{ "action": "decline" }` : `delegation = { accepted: false, via: "carte", total,
parallel }`, événement `delegation_declined { via: "carte" }`, les sous-missions en attente sont annulées (erreur
  « Sous-agents refusés par le propriétaire »), tout `mission_lancer` suivant rend `refus_proprietaire`, **aucune
  nouvelle question** dans la mission ; Bilan : « Sous-agents proposés par l'agent, refusés : mission menée par un seul
  agent. »
- Question fermée sans réponse (fin de la mission, ou délai `AGENT_PLATFORM_QUESTION_TIMEOUT_MS` s'il est configuré) :
  rien n'est décidé, les sous-missions en attente sont annulées, un lancement suivant redemande.

## 3. Les outils du chef

Serveur `relay-missions` (`packages/mission-gateway/server.js`). Les mêmes outils et les mêmes textes pour tous les
agents (`packages/orchestrator/delegation-rule.js`). Chaque outil rend du JSON en texte ; une erreur rend
`isError: true` et `{ "erreur": "<code>", "message": "…" }`. Un appel ne voit et ne touche que les sous-missions de la
mission qui appelle (et de ses exécutions reprises).

| Outil              | Paramètres                                                                                                                                                                                                                                                         | Résultat                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mission_lancer`   | `consigne` (1 à 8 000 car.), `titre` (≤ 80), `agent`, `modele`, `fichiers` (≤ 20 chemins relatifs), `demandeDuProprietaire` (booléen), `objectif`, `perimetre`, `resultatAttendu` (≤ 2 000 chacun), `informations` (≤ 4 000), `apres` (1 à 20 ids), `reprend` (id) | `{ id, titre, etat: "en_cours"\|"en_file"\|"attend_accord"\|"attend_prerequis"\|"cancelled", agent, modele, dossierResultats?, famille: { lancees, taches, reprises, dansEnveloppe, enCours, total, parallel } }`                                                                                                                                                                                                |
| `mission_suivre`   | `id` (facultatif), `details` (défaut `false`)                                                                                                                                                                                                                      | `{ missions: [{ id, titre, agent, modele, etat, depuis, inactiveDepuis, attend, outils, dernierOutil }], agents: [{ id, disponible, modeles: [{ id, nom }], modeleParDefaut }], activite: { agents, enAttenteDuProprietaire, texte }, famille: { lancees, taches, reprises, dansEnveloppe, enCours, total, parallel }, nature }` ; avec `details` et une sous-mission finie, les champs de `terminees[]` en plus |
| `mission_attendre` | `ids` (facultatif), `toutes` (défaut `false`), `delaiSecondes` (entier ≥ 1, défaut 50 ; attente réelle `min(delaiSecondes, 50)`)                                                                                                                                   | `{ terminees: [{ id, titre, etat, reponse, bilan, fichiers, envois, cause } ou, déjà remise, { id, titre, etat, dejaRemise }], enCours: [{ id, titre, etat, attend }], delaiAtteint, nature }`                                                                                                                                                                                                                   |
| `mission_annuler`  | `id`, `raison` (≤ 500)                                                                                                                                                                                                                                             | `{ id, etat: "cancelled" }` ; une sous-mission déjà finie rend son état                                                                                                                                                                                                                                                                                                                                          |

Erreurs : `refus_proprietaire`, `enveloppe_atteinte`, `enveloppe_refusee`, `reprise_en_cours` (`reprend` d'une tâche dont une tentative vit encore : en cours, en file, en attente d'accord ou de prérequis, ou en création ; multi-agent-v3-02, F), `agent_indisponible`, `modele_inconnu`, `fichier_hors_espace`,
`introuvable` (aussi pour un id de `apres` ou de `reprend` qui n'est pas une sous-mission de cette mission),
`mission_terminee`, `parametres_invalides` (champ inconnu, borne dépassée, `reprend` d'une sous-mission en cours ou
réussie). Le refus `boucle` de `chef-01` est supprimé (un seul niveau). Un paramètre hors schéma est d'abord refusé par
le serveur MCP lui-même (erreur de validation de l'outil, l'appel n'atteint pas la plateforme) ; la plateforme refait
le contrôle et rend `parametres_invalides` à un appel direct de la route interne.

Message de `enveloppe_atteinte` (D10, `envelopeReached`) : « Enveloppe acceptée par le propriétaire atteinte (T
sous-missions comptées) : la plateforme consulte le propriétaire (ne lui pose pas la question toi-même) ; relance le même
appel après sa réponse (mission_suivre donne l'enveloppe : famille.total et famille.dansEnveloppe). »
Sans accord des sous-agents encore donné, aucune carte d'extension n'est posée et le message est celui de
`envelopeReachedNoConsent` (multi-agent-v3-02, E) : il le dit, sans prétendre consulter le propriétaire.
Après un « Non » (ou la carte refusée) à la carte d'extension, le refus est retenu pour ce total (événement
`delegation_extension_declined { total }`) : les lancements suivants au même total rendent `enveloppe_refusee`
(`ENVELOPE_DECLINED` : « Le propriétaire a refusé d'élargir l'enveloppe : continue avec les sous-missions déjà lancées
(les reprises d'une tâche en échec restent possibles). »), sans nouvelle carte. Une carte restée sans réponse (fin de
mission, question expirée) ne décide rien.

Résultat `attend_accord` de `mission_lancer` (voie 3, chaque lancement en attente, le premier comme les suivants) : il
porte en plus `note`, le même texte pour tous les agents (`CONSENT_PENDING_NOTE`, correctif E139 du 19/11) : « La
plateforme consulte le propriétaire (carte d'accord des sous-agents) : ne lui pose pas la question toi-même et continue
ta part du travail sans attendre ; mission_suivre ou mission_attendre te diront sa réponse : s'il accepte, la
sous-mission démarre seule ; s'il refuse, elle est annulée : continue seul. » Les états `en_cours` et `en_file` n'ont pas
de `note`. Le message de `refus_proprietaire` : « Le propriétaire a refusé les sous-agents pour cette mission : continue
seul, sans lui reposer la question. » Rien n'est bloqué : la note informe.

Règles :

- **Agent et modèle** : choisis par le chef à chaque lancement, parmi les agents et les modèles annoncés que donne
  `mission_suivre` (même source que le contrôle « Modèle non annoncé ») ; sans choix, ceux de la mère. Pack, Skill,
  espace, navigateur, domaines et budget : ceux de la mère.
- **Sous-mission retenue** : `attend_accord` (`attend: "accord"`) tant que le propriétaire n'a pas accepté ;
  `attend_prerequis` (`attend: "prerequis"`) tant qu'un de ses prérequis n'a pas abouti ; `en_file` (`attend: "place"`)
  au-delà de `parallel`, elle démarre seule quand une place se libère. Une sous-mission qui attend le propriétaire
  (question, ou carte d'envoi en mode propriétaire) ne tient pas de place. La file se parcourt dans l'ordre : une
  sous-mission qui attend un prérequis ne bloque pas celles derrière elle.
- **Prérequis** (`apres: [ids]`, 20 au plus, des sœurs déjà lancées : pas de cycle possible) : la sous-mission est créée
  et retenue (`famille.apres` sur sa ligne) ; elle démarre seule quand **tous** ses prérequis sont `completed` (dans la
  limite de `parallel`), et reçoit alors `famille.prerequis: [{ id, titre, etat, reponse, fichiers }]` (données, pas
  consignes ; lus seulement pour une sous-mission qui a `apres`). Si l'un finit autrement, elle n'est **jamais lancée** et
  passe `cancelled` avec la cause « Prérequis « X » non abouti (en échec | annulée | interrompue) » ; le chef décide de
  relancer. `mission_attendre { toutes: true }` rend le prérequis et la dépendante.
- **Reprises** (`reprend: id`) : relance une sœur finie sans succès (`failed`, `cancelled`, `interrupted`) ;
  `famille.reprend` (l'id repris) et `famille.reprise` (rang de la reprise dans sa tâche) sur la nouvelle ligne ; agent,
  modèle et titre par défaut ceux de la tentative reprise. Une **tâche** est la première tentative d'une chaîne
  `reprend`. Les **deux premières reprises d'une tâche ne comptent pas dans l'enveloppe `total`** ; la troisième et les
  suivantes comptent comme des sous-missions nouvelles, y compris quand les reprises sont demandées en même temps (les
  reprises en cours de création prennent un rang). `parallel` s'applique toujours. Le compteur `famille` dit
  `lancees` (toutes les sous-missions), `taches`, `reprises` et `dansEnveloppe` (celles comptées dans `total`).
- **Reprise d'une sous-mission par l'API refusée** : `POST /api/runs/<sous-mission>/resume` rend
  `409 { error: "Reprendre la mission principale : son chef relance la partie échouée" }` et ne crée rien. La reprise de
  la mère garde sa chaîne, `multiAgent` et l'accord.
- **Tâche structurée** (facultatif) : `objectif` (le but), `informations` (ce que le chef sait déjà et qui évite au
  spécialiste de le redécouvrir : méthode trouvée, outils qui marchent, pièges), `perimetre`, `resultatAttendu`. Ceux
  donnés arrivent à la sous-mission dans `famille.tache` (absent si aucun n'est donné) ; ils ne sont écrits ni sur la
  ligne ni dans un événement. `consigne` reste obligatoire ; `fichiers` reste « les chemins à lire d'abord ».
- **Dossier de résultats** : au lancement, la plateforme crée pour chaque sous-mission, dans le dossier de travail de la
  mission (fonctions de chemin confiné, aucun lien suivi, rien hors de ce dossier), le dossier
  `relay/missions/<8 premiers caractères de l'id de la première exécution de la mère>/<n>-<titre réduit à [a-z0-9-], 40
car. au plus>/` (`n` : rang de la sous-mission dans la chaîne de la mère ; titre vide une fois réduit :
  `sous-mission`). Son chemin relatif est rendu par `mission_lancer` (`dossierResultats`), écrit sur la ligne
  (`famille.dossierResultats`), donné à la sous-mission (`famille.dossierResultats`) et cité dans sa phrase (section 5).
  **Si le dossier ne peut pas être créé** (dossier de travail non inscriptible, un fichier à la place d'un dossier),
  rien n'est créé et le champ est absent partout ; la phrase de la sous-mission est alors celle d'avant. Si la création
  de la sous-mission échoue, son dossier vide est retiré.
- **Champ `espace`** (multi-agent-v3-02, K) : quand une sous-mission a un dossier de résultats, les résultats de
  `mission_lancer`, `mission_suivre` et `mission_attendre` portent à leur racine `espace`, le chemin absolu du dossier
  de travail de la mission (celui du chef, où la plateforme crée le dossier et où une sous-mission travaille et lit ses
  fichiers, pour un pack ordinaire comme pour career-ops) ; `dossierResultats` et `fichiers[].chemin` lui sont
  relatifs. Absent sans dossier de résultats ; rien d'autre ne change dans la forme des résultats.
- **Enveloppe** : au-delà de `total` (sous-missions comptées), l'appel rend `enveloppe_atteinte` et, si l'accord est
  donné, la plateforme pose
  une question **à choix** (`choix` : `oui` « Oui, 5 de plus », ou `non`) : « Le chef veut lancer une Ne sous-mission ;
  l'enveloppe acceptée est de T. En autoriser 5 de plus ? » (N : rang dans l'enveloppe, `dansEnveloppe + 1`) ; si des
  reprises hors enveloppe ont déjà été lancées : « Le chef veut lancer une sous-mission de plus : ce serait la Ne
  comptée dans l'enveloppe acceptée de T (L déjà lancées, reprises comprises). En autoriser 5 de plus ? »
  (`delegation_envelope_reached { total, asked: N, lancees: L }`) ; sur `oui`, `delegation.total` augmente de 5
  (`delegation.extensions`) et l'appel suivant passe.
- **Résultat remis une fois** (multi-agent-v3-02) : `mission_attendre` rend l'état de toutes les sous-missions
  demandées (`terminees` = toutes celles finies), mais le résultat complet d'une sous-mission finie (réponse,
  Bilan, fichiers, envois) n'est donné qu'une fois au chef (par `mission_attendre`, `mission_suivre` avec `details`
  ou le tour de synthèse) ; ensuite `mission_attendre` en donne une ligne courte `{ id, titre, etat, dejaRemise: true }`.
  Un appel abandonné en route (réponse jamais parvenue) ne marque rien. La relecture complète reste possible par
  `mission_suivre { id, details: true }`, autant de fois que voulu, y compris après la fin de la mère et après un
  redémarrage. Le tour de synthèse joint aussi les sous-missions finies dont le résultat n'a jamais été remis
  (sauf celles annulées par le refus du propriétaire, jamais lancées) ; sans tour possible, le Bilan les nomme. Sans `toutes`,
  l'appel rend la main dès qu'une des sous-missions en cours au début de l'appel a fini. Avec `toutes`, il rend la
  main quand toutes ont fini, ou dès qu'une de celles en cours au début de l'appel finit sans succès (état final
  autre que `completed`), pour la reprendre sans attendre ; un échec déjà rendu ne fait pas revenir l'appel
  suivant. Pendant l'attente, les
  minuteurs du chef (silence, outil figé, délai de mission, délai du tour ACP) sont en pause.
- `reponse` : la réponse finale de la sous-mission (50 000 caractères au plus, données) ; `bilan` : son Bilan tel que la
  plateforme l'a écrit ; `fichiers` : les fichiers nommés par **ses** appels d'outils terminés (chemins, chaînes), puis
  les fichiers présents dans son dossier de résultats à sa fin, lus sur le disque sans suivre de lien
  (`{ chemin, taille }`, chemin relatif au dossier de la mission, taille en octets ; un fichier du dossier n'est cité
  qu'une fois) ; 200 au plus en tout ; relus de l'événement `child_done` (pour une mission de l'espace privé :
  `relay/runs/<id>-fichiers.json` de l'espace, jamais la base) ;
  `envois = { approuves, parAccord, refuses, incertains, ligne, nonVerifies? }` : `ligne` est la ligne « Envoi par la
  plateforme : … » de son Bilan mot pour mot ; sans cette ligne (sous-mission interrompue, en échec ou annulée),
  `nonVerifies: { note: "non vérifié ; ne pas répéter avant vérification", evenements }` ; `cause` d'un échec :
  `{ type: "limite_usage"|"erreur", agent, reprise, message }`.
- **Tour de synthèse** : si des sous-missions vivent encore quand le chef termine son tour, la mère reste `running`
  (événement `family_waiting`), ses minuteurs en pause, jusqu'à leur fin ; puis la même session reçoit **un seul** tour
  `{ familyResults: { nature, terminees: [...] }, instructions, platform: { turnKind: "family_results" } }` avec leurs
  résultats (mêmes champs que `terminees[]`) et la consigne « compare, retire les doublons, écris ta réponse finale » ;
  sa réponse remplace la précédente. Si la session de l'agent est fermée, ou si la mission se clôt avant (question
  refusée), la mère attend la fin des sous-missions puis écrit son Bilan avec la ligne « Synthèse finale non faite : la
  réponse du chef a été écrite avant la fin de « … » ; leurs résultats ne lui ont pas été remis. » Le tour de rappel de
  `chef-01` est supprimé.

## 4. Route interne (passerelle → plateforme)

`POST /api/internal/missions/<mère>`, en-têtes `x-platform-request: 1` et `x-relay-token: <jeton de la mère>` (le même
que sa passerelle de capacités), corps `{ "tool": "mission_…", "args": { … } }`. Réponses : `200 { result }` ou
`200 { erreur, message }` ; `403` pour un jeton invalide, une mission inactive, une sous-mission, une mission sans
`multiAgent`, ou des outils retirés par le réglage. La requête de `mission_attendre` reste ouverte au plus 50 s ; si la passerelle la quitte, l'attente
s'arrête.

## 5. Ce que la plateforme écrit

- **Phrase du chef** (fin des consignes, une seule pour tous les agents ; donnée seulement quand le mode multi-agent est
  allumé, `run.multiAgent`, car les outils de mission ne sont prêtés qu'alors) : depuis `multi-agent-v3-02` (I2), elle
  dit que le propriétaire a allumé le mode et ce qu'il attend : quand la mission contient plusieurs parties
  indépendantes de plusieurs minutes chacune (plusieurs sites ou formulaires dans le navigateur, le même long
  traitement pour plusieurs éléments, plusieurs sources), les lancer en sous-missions en même temps plutôt que les
  enchaîner seul (chaque sous-mission a son onglet, ses cartes d'envoi, son suivi et sa reprise ; les sous-agents
  internes d'un agent partagent sa session de navigateur et ne sont ni suivis ni repris) ; travailler seul pour une
  demande simple, une petite étape ou des étapes dépendantes ; éviter deux sous-missions en même temps sur le même site ;
  le chef décide, choisit agent et modèle selon la difficulté ; dossier de résultats (chemin relatif au dossier de
  travail), fichiers rassemblés par un script ; pour un travail répétitif, la méthode écrite une fois dans un fichier de
  l'espace donné à chaque sous-mission (`fichiers`), avec dans `informations` ce qui est propre à sa part ; chaque
  sous-mission consomme l'abonnement. Sa fin suit l'accord : « le propriétaire l'a autorisé : jusqu'à N sous-missions,
  M à la fois », ou « … indique-le en lançant (demandeDuProprietaire) ; sinon la plateforme consultera le propriétaire
  avant la première sous-mission (ne lui pose pas la question toi-même) ; s'il refuse, continue seul ». Sous-agents
  refusés : la phrase entière est seulement « Le propriétaire a refusé les sous-agents pour cette mission : travaille
  seul, sans lui reposer la question. » (`CHIEF_REFUSED`). Aucune recette, aucun nom de site, de Skill ou d'agent.
- **Phrase de la sous-mission** (`daughterRule`) : la demande du propriétaire, jointe, prime ; avec un dossier de
  résultats, elle le nomme : y écrire les résultats détaillés (listes, tableaux, données, documents), dans des fichiers
  au format que demande la consigne, et garder une **réponse finale courte** (ce qui est fait, chiffres clés, chemins
  des fichiers, ce qui manque ou a échoué) ; sans dossier, rendre ses résultats dans sa réponse finale (phrase
  d'avant, `DAUGHTER_RULE`) ; d'autres sous-missions peuvent travailler dans le même espace : n'écrire que dans son
  dossier ou des fichiers propres à sa part et laisser à l'agent principal les fichiers communs. Elle ne nomme aucun
  fichier ni script d'un Skill ; ce qui est propre à un Skill se dit dans son pack.
- **Ce que reçoit la sous-mission** (champ `famille` de son prompt) : `demandeDuProprietaire`, `mere`, `soeurs`,
  `fichiers`, et selon le cas `tache`, `dossierResultats`, `prerequis`.
- **Lien** : chaque sous-mission porte `famille: { racine, mere, titre }` (plus de `profondeur`), et selon le cas
  `apres`, `reprend`, `reprise`, `dossierResultats` ; `startedAt` (heure de son premier état `running`) est écrit sur
  sa ligne à son départ ; la mère porte
  `estMere: true` dès son premier lancement (recopié par une reprise). La liste des sous-missions se lit dans la base
  (`store.children`), jamais par `store.list()`. En mode non propriétaire, une sous-mission d'une mission de l'espace
  privé est titrée « Sous-mission N ».
- **Événements de la mère** (aucun avant le premier `mission_lancer`) : `delegation_accepted { via, total, parallel,
acceptedAt, message? }`, `delegation_declined { via }`, `child_launched { childId, titre, agent, modele }`,
  `child_state { childId, state }`, `child_done { childId, state, envois, fichiers? }`,
  `delegation_envelope_reached`, `delegation_extended`, `family_waiting { enCours }`, et les événements `question` /
  `answer` de la carte.
- **`GET /api/runs/:id`** d'une mère qui a des sous-missions : `family: [{ id, titre, agent, state, attend,
pendingQuestion, pendingPermission }]` et `activity: { agents, awaitingOwner }` (absents sinon).
- **Bilan de la mère** : après les lignes habituelles, la ligne d'accord (« Accord des sous-agents : case « Autoriser les
  sous-agents » cochée avant l'envoi » / « donné avec la requête de la mission » / « demande écrite dans le prompt,
  selon l'agent » / « donné sur la carte au premier lancement »), puis « Sous-missions (n) » : une entrée par
  sous-mission (titre, agent, modèle, état, durée, identifiant) suivie de **son Bilan cité mot pour mot** ; la ligne
  « Synthèse finale non faite » le cas échéant ; les totaux vus par la plateforme ; la confrontation des envois
  annoncés ; la consommation (« N sous-mission(s), D de durée des sous-missions Relay (par agent) »). Refus sur la
  carte : la seule ligne « Sous-agents proposés par l'agent, refusés : mission menée par un seul agent. »
  - **Durée** d'une sous-mission : de son premier état `running` (`startedAt`) à sa fin ; l'attente de place, d'accord
    ou de prérequis n'est pas comptée. Une sous-mission jamais partie : « jamais démarrée » (0 dans la consommation).
    Limite : une sous-mission enregistrée avant `multi-agent-v3-01` n'a pas `startedAt` et s'affiche « jamais
    démarrée » au Bilan d'une mère reprise (pas de repli sur sa création, pour ne jamais compter l'attente).
  - **Reprises** : l'entrée d'une reprise dit « (reprise de « X ») » ; s'il y a au moins une reprise, une ligne compte
    les tâches par leur dernière tentative : « Par tâche (dernière tentative) : N tâche(s) : a aboutie(s), b en échec,
    c annulée(s), d interrompue(s), dont k après r reprise(s). » (sans reprise, rien de plus).
  - **Échec de la mère** : ses sous-missions encore vivantes (en cours, en file, en attente d'accord ou de prérequis)
    sont arrêtées avec la cause « Arrêtée : la mission principale a échoué » (`MOTHER_FAILED`), plus aucun lancement
    n'est accepté, la plateforme attend au plus 10 s leur fin et celle des créations en cours (une sous-mission en
    création est alors annulée et nommée au Bilan ; multi-agent-v3-02, G), puis écrit le Bilan de la mère avec la ligne « n
    sous-mission(s) arrêtée(s) avec l'échec de la mission principale. » (seulement si n > 0). Jamais pour une mission
    ordinaire ; l'annulation et l'arrêt du serveur gardent leur comportement (section 7). L'arrêt vise les
    sous-missions de l'exécution qui échoue (comme l'annulation).

### 5.1 Sous-agents internes de l'agent (`natifs-01`)

Les sous-agents qu'un agent lance de lui-même avec sa propre CLI ne sont pas des sous-missions de la plateforme : ils
ne sont ni comptés ni bornés par l'enveloppe, et ne passent pas par les outils de délégation. Quand le flux ACP de
l'agent les montre, le Bilan de la mission a **une** ligne de plus (aucune sinon, au caractère près) :
« Sous-agents internes de l'agent (lancés par l'agent lui-même, hors enveloppe de la plateforme) : n — … ».

- La forme reconnue se déclare dans le profil de l'adaptateur (`nativeSubagents` dans
  `packages/agent-runtime/profiles.js`) ; le moteur (`packages/orchestrator/native-subagents.js`) ne nomme aucun agent.
  Un adaptateur sans déclaration n'a jamais cette ligne.
- Forme « activité » (vue avec codex-acp 2.2.2) : nom du sous-agent, nombre d'échanges (départ et relances), fins de
  tour vues, durée du premier départ à la dernière fin **vue par la plateforme** ; la ligne dit « modèle et
  consommation non rapportés par l'agent ». Ses propres commandes ne sont pas dans le flux.
- Forme « outil » (vue avec claude-agent-acp 0.95.0) : type du sous-agent, appels d'outils vus, état vu par la
  plateforme (« sans fin vue » sinon), durée vue par la plateforme, puis, « selon l'agent », l'état qu'il déclare
  quand la plateforme n'a vu aucune fin, le modèle tel qu'il le donne, le nombre d'outils et la durée qu'il déclare (non mesurés par la
  plateforme). La ligne « Actions natives » ajoute « dont n de ses sous-agents internes » pour les actions faites par
  ces sous-agents.
- Jamais de jetons ni de conversion en part d'abonnement ; aucune décision de la plateforme ne dépend de cette ligne.
  Non observé à ce jour : sous-agent en arrière-plan, Gemini, OpenCode.

## 6. Textes montrés au propriétaire

Bouton et carte (texte 3.4 du plan, tel quel ; N et M = l'enveloppe) :

> Autoriser les sous-agents
> L'agent de ta mission pourra, s'il le juge utile, confier des parties du travail à d'autres agents qui travaillent en
> même temps. Chacun consomme ton abonnement comme une mission ordinaire : avec plusieurs agents à la fois, ta limite
> d'usage peut être atteinte plus vite. Autoriser n'oblige pas : pour une demande simple, un seul agent travaillera.
> Au plus N sous-missions Relay pour cette mission, M en même temps (modifiables) ; une sous-mission en échec peut en
> plus être reprise deux fois hors de cette limite ; les sous-agents internes que les agents lancent d'eux-mêmes ne sont ni comptés ni bornés par cette limite. Les envois restent à ton clic.

Ligne du fil de la voie 2 (`delegation_accepted.message`) : « Sous-agents lancés à ta demande : chacun consomme ton
abonnement comme une mission ordinaire ; enveloppe : N au plus, M en même temps (plus deux reprises au plus par
sous-mission en échec). »

Aucun pourcentage d'abonnement ni promesse d'économie ou de précision.

## 7. Famille et espace

- Les sous-missions ne prennent aucune des trois places de la plateforme : l'enveloppe de leur mission les borne, et le
  compteur « N exécution(s) Relay en activité (missions et sous-missions), dont K en attente du propriétaire »
  (`activite` de `mission_suivre`, `activity` de `GET /api/runs/:id`) les compte. Pas de plafond pour toute la machine
  (3 missions qui délèguent chacune 3 sous-missions = 12 exécutions). Les sous-agents internes qu'un agent lance de
  lui-même ne sont ni comptés ni bornés par Relay, et le Bilan n'en dit encore rien (lot `natifs-01`).
- Les membres d'une famille partagent l'espace career-ops ; toute autre mission y reste refusée tant que la famille vit.
- Annuler une mission annule ses sous-missions (un niveau) : en cours (questions fermées, carte d'envoi refusée), en file
  et en attente d'accord. Avant d'écrire le Bilan d'une mère annulée, la plateforme attend la fin de ses sous-missions
  (au plus 10 s, sans nouvelle annulation ; multi-agent-v3-02, H) : le Bilan les dit annulées, pas « en cours ». Une
  mission sans sous-mission n'attend rien.
- Au redémarrage de l'API, toute la famille non finie passe `interrupted` ; un arrêt propre interrompt aussi les
  sous-missions retenues. Rien n'est relancé automatiquement.
- Les cartes d'envoi restent au clic du propriétaire, sous-mission par sous-mission.

## 8. Pas encore fait

Front : interrupteur « Mode multi-agent » (`multiAgent`), case « Autoriser les sous-agents » avec l'enveloppe
modifiable, compteur, liste des sous-missions (`delegation-v2-02`) ; `mission_preciser` ; sous-agents internes des
agents au Bilan (`natifs-01`) ; arrêt et annulation sur toute la chaîne d'une mère reprise ; reprise de la session de
l'agent par `reprend` (la reprise repart de zéro) ; identifiant d'appel dans `send_auto`. Les essais réels du 18 et du
19/11 ont été faits avant `multi-agent-v3-01` ; ce lot n'a été prouvé que par faux agents.
