# Sous-agents d'une mission : contrat de l'API et des outils (`delegation-v2-01`)

Délégation à des sous-missions, étape 1 du plan v2 du 18/11/2026
(`.manager/reports/delegation-conception-v2-18-11.md` de l'arbre `agregat-back-chef`), qui remplace le contrat du sprint
`chef-01`. L'agent de la mission, **le chef**, **peut** confier des parties délimitées du travail à des
**sous-missions**, missions Relay ordinaires, et en reçoit les résultats ; il reste celui qui décide et qui écrit la
réponse finale. **Autoriser n'oblige jamais** : Relay ne lit pas le prompt, ne compte pas les étapes et ne pousse pas à
déléguer. Ce document est le contrat que le front peut suivre ; ce qui n'existe pas encore est dit en fin de page.

## 1. Qui reçoit les outils

- **Toute mission menée par un agent** (mode agent : la session ACP de la mission) reçoit, dès l'ouverture de sa
  session, un second serveur MCP `relay-missions` (après le serveur de capacités, qui reste en tête) et, à la fin de ses
  consignes, la phrase du chef (section 5).
- **Jamais** une sous-mission (un seul niveau) ; **jamais** un parcours qui n'est pas mené par un agent (DAG d'un pack,
  `mode: "workflow"`).
- **Réglage de retrait** : `AGENT_PLATFORM_DELEGATION=0` dans l'environnement de l'API, lu au démarrage comme les autres
  réglages `AGENT_PLATFORM_*`, retire outils et phrase à toutes les missions. Avec ce réglage, la consigne envoyée à
  l'agent, la liste des serveurs MCP et le déroulement d'une mission sont identiques à la base `48a2f4e` (prouvé par
  `tests/delegation-v2-01-b.test.js`, qui fait tourner le code de la base extrait par `git archive`). Le champ
  `delegation` d'une requête est alors sans effet : il ne force plus le mode agent (`tests/review-delegation-v2-01.test.js`).
- **Une mission qui ne délègue pas ne change pas** : tant que le chef n'a appelé aucun `mission_lancer`, aucun événement,
  aucune lecture de plus, aucune ligne de Bilan, aucun tour de plus, aucune carte. Seuls changent la phrase et le second
  serveur.

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

- **Case non cochée : ne pas envoyer le champ.** Sans champ, les outils sont prêtés quand même et l'accord est demandé
  par la carte au premier lancement (voie 3), ou donné par la demande écrite dans le prompt (voie 2).
- Les anciennes valeurs `case`, `mot` et `proposition` de `chef-01` sont refusées (requête invalide).
- Avec `accepted: true` dans la requête, et seulement alors, la mission part en mode agent (un `mode: "workflow"` envoyé
  par défaut par le front n'en fait pas un DAG), sauf avec le réglage de retrait. Les outils prêtés à toutes les missions
  ne forcent rien.
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

| Outil              | Paramètres                                                                                                                            | Résultat                                                                                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mission_lancer`   | `consigne` (1 à 8 000 car.), `titre` (≤ 80), `agent`, `modele`, `fichiers` (≤ 20 chemins relatifs), `demandeDuProprietaire` (booléen) | `{ id, titre, etat: "en_cours"\|"en_file"\|"attend_accord", agent, modele, famille: { lancees, enCours, total, parallel } }`                                                                                                                                                                                                    |
| `mission_suivre`   | `id` (facultatif), `details` (défaut `false`)                                                                                         | `{ missions: [{ id, titre, agent, modele, etat, depuis, inactiveDepuis, attend, outils, dernierOutil }], agents: [{ id, disponible, modeles: [{ id, nom }], modeleParDefaut }], activite: { agents, enAttenteDuProprietaire, texte }, nature }` ; avec `details` et une sous-mission finie, les champs de `terminees[]` en plus |
| `mission_attendre` | `ids` (facultatif), `toutes` (défaut `false`), `delaiSecondes` (entier ≥ 1, défaut 50 ; attente réelle `min(delaiSecondes, 50)`)      | `{ terminees: [{ id, titre, etat, reponse, bilan, fichiers, envois, cause }], enCours: [{ id, titre, etat, attend }], delaiAtteint, nature }`                                                                                                                                                                                   |
| `mission_annuler`  | `id`, `raison` (≤ 500)                                                                                                                | `{ id, etat: "cancelled" }` ; une sous-mission déjà finie rend son état                                                                                                                                                                                                                                                         |

Erreurs : `refus_proprietaire`, `enveloppe_atteinte`, `agent_indisponible`, `modele_inconnu`, `fichier_hors_espace`,
`introuvable`, `mission_terminee`, `parametres_invalides`. Le refus `boucle` de `chef-01` est supprimé (un seul niveau).

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
- **Sous-mission retenue** : `attend_accord` (`attend: "accord"`) tant que le propriétaire n'a pas accepté ; `en_file`
  (`attend: "place"`) au-delà de `parallel`, elle démarre seule quand une place se libère. Une sous-mission qui attend le
  propriétaire (question, ou carte d'envoi en mode propriétaire) ne tient pas de place.
- **Enveloppe** : au-delà de `total`, l'appel rend `enveloppe_atteinte` et, si l'accord est donné, la plateforme pose
  une question **à choix** (`choix` : `oui` « Oui, 5 de plus », ou `non`) : « Le chef veut lancer une Ne sous-mission ;
  l'enveloppe acceptée est de T. En autoriser 5 de plus ? » ; sur `oui`, `delegation.total` augmente de 5
  (`delegation.extensions`) et l'appel suivant passe.
- **Attente relisible** : `mission_attendre` ne consomme rien ; chaque appel rend l'état complet des sous-missions
  demandées (`terminees` = toutes celles finies) ; une réponse perdue se relit à l'appel suivant ou par
  `mission_suivre { id, details: true }`, y compris après la fin de la mère et après un redémarrage. Sans `toutes`,
  l'appel rend la main dès qu'une des sous-missions en cours au début de l'appel a fini. Pendant l'attente, les
  minuteurs du chef (silence, outil figé, délai de mission, délai du tour ACP) sont en pause.
- `reponse` : la réponse finale de la sous-mission (50 000 caractères au plus, données) ; `bilan` : son Bilan tel que la
  plateforme l'a écrit ; `fichiers` : les fichiers nommés par **ses** appels d'outils terminés, relus de l'événement
  `child_done` (pour une mission de l'espace privé : `relay/runs/<id>-fichiers.json` de l'espace, jamais la base) ;
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
`200 { erreur, message }` ; `403` pour un jeton invalide, une mission inactive, une sous-mission, ou des outils retirés
par le réglage. La requête de `mission_attendre` reste ouverte au plus 50 s ; si la passerelle la quitte, l'attente
s'arrête.

## 5. Ce que la plateforme écrit

- **Phrase du chef** (fin des consignes, une seule pour tous les agents) : elle dit quand déléguer est utile (parties
  indépendantes, par exemple plusieurs sources ; gros volume ; long travail annexe) et quand travailler seul est souvent
  le mieux, que rien n'oblige à déléguer, que le chef choisit agent et modèle selon la difficulté, et que chaque
  sous-mission consomme l'abonnement ; sa fin suit l'accord : « le propriétaire l'a autorisé : jusqu'à N sous-missions,
  M à la fois », « … indique-le en lançant (demandeDuProprietaire) ; sinon la plateforme consultera le propriétaire
  avant la première sous-mission (ne lui pose pas la question toi-même) ; s'il refuse, continue seul », ou « le
  propriétaire a refusé les sous-agents pour cette mission : continue seul ».
- **Phrase de la sous-mission** : la demande du propriétaire, jointe, prime ; rendre ses résultats dans sa réponse
  finale ; d'autres sous-missions peuvent travailler dans le même espace : n'écrire que dans des fichiers propres à sa
  part et laisser à l'agent principal les fichiers communs. Elle ne nomme aucun fichier ni script d'un Skill ; ce qui
  est propre à un Skill se dit dans son pack.
- **Lien** : chaque sous-mission porte `famille: { racine, mere, titre }` (plus de `profondeur`) ; la mère porte
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
  annoncés ; la consommation (durée cumulée des agents). Refus sur la carte : la seule ligne « Sous-agents proposés par
  l'agent, refusés : mission menée par un seul agent. »

## 6. Textes montrés au propriétaire

Bouton et carte (texte 3.4 du plan, tel quel ; N et M = l'enveloppe) :

> Autoriser les sous-agents
> L'agent de ta mission pourra, s'il le juge utile, confier des parties du travail à d'autres agents qui travaillent en
> même temps. Chacun consomme ton abonnement comme une mission ordinaire : avec plusieurs agents à la fois, ta limite
> d'usage peut être atteinte plus vite. Autoriser n'oblige pas : pour une demande simple, un seul agent travaillera.
> Au plus N sous-agents pour cette mission, M en même temps (modifiables). Les envois restent à ton clic.

Ligne du fil de la voie 2 (`delegation_accepted.message`) : « Sous-agents lancés à ta demande : chacun consomme ton
abonnement comme une mission ordinaire ; enveloppe : N au plus, M en même temps. »

Aucun pourcentage d'abonnement ni promesse d'économie ou de précision.

## 7. Famille et espace

- Les sous-missions ne prennent aucune des trois places de la plateforme : l'enveloppe de leur mission les borne, et le
  compteur « N agent(s) en activité (missions et sous-agents), dont K en attente du propriétaire » (`activite` de
  `mission_suivre`, `activity` de `GET /api/runs/:id`) les compte. Pas de plafond pour toute la machine (3 missions qui
  délèguent chacune 3 sous-agents = 12 agents).
- Les membres d'une famille partagent l'espace career-ops ; toute autre mission y reste refusée tant que la famille vit.
- Annuler une mission annule ses sous-missions (un niveau) : en cours (questions fermées, carte d'envoi refusée), en file
  et en attente d'accord.
- Au redémarrage de l'API, toute la famille non finie passe `interrupted` ; un arrêt propre interrompt aussi les
  sous-missions retenues. Rien n'est relancé automatiquement.
- Les cartes d'envoi restent au clic du propriétaire, sous-mission par sous-mission.

## 8. Pas encore fait

Front : case « Autoriser les sous-agents » avec l'enveloppe modifiable, compteur, liste des sous-missions
(`delegation-v2-02`) ; `mission_preciser` ; `mission_lancer { reprendre }` et reprise de famille détaillée ; identifiant
d'appel dans `send_auto`. Aucun essai réel n'a encore été fait avec Claude, Codex, Gemini ou OpenCode.
