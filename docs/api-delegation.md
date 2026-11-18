# Mode workflow à agent chef : contrat de l'API et des outils (sprint `chef-01`)

Premier pas du mode workflow décidé par le propriétaire le 18/11/2026 (conception :
`.manager/reports/workflow-chef-conception-18-11.md`). L'agent de la mission, **le chef**, peut confier des parties de
la mission à des **sous-missions**, missions Relay ordinaires, et en reçoit la réponse et le Bilan. Ce document est le
contrat que le front (sprint `accord-02`) peut suivre ; ce qui n'existe pas encore est dit en fin de page.

## 1. Activation : champ `delegation` de `POST /api/runs`

Le front pose la carte d'avertissement et recueille l'accord **avant** d'envoyer la mission ; la requête porte cet
accord tel quel :

```json
{
  "prompt": "…",
  "delegation": {
    "accepted": true,
    "via": "case",
    "total": 10,
    "parallel": 3,
    "acceptedAt": "2026-11-18T18:40:00+11:00"
  }
}
```

| Champ        | Type                                      | Défaut | Sens                                                                                                       |
| ------------ | ----------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| `accepted`   | booléen                                   | requis | `true` : le propriétaire a accepté ; `false` : il a refusé (événement `delegation_declined`, rien d'autre) |
| `via`        | `case` \| `mot` \| `proposition` \| `api` | `api`  | la voie par laquelle l'accord a été recueilli                                                              |
| `total`      | entier 1 à 200                            | 10     | sous-missions au plus pour toute la mission                                                                |
| `parallel`   | entier 1 à 8                              | 3      | sous-missions en même temps au plus                                                                        |
| `acceptedAt` | date ISO avec fuseau                      | absent | heure de l'accord                                                                                          |

- **Sans ce champ, rien ne change** : aucun outil de mission n'est prêté, aucun texte n'est ajouté au prompt de l'agent,
  aucun champ nouveau n'est écrit sur la mission.
- Avec `accepted: true`, la mission part en mode agent (un `mode: "workflow"` envoyé par défaut par le front n'en fait
  pas un DAG), et la mission porte `delegation` sur sa ligne.
- La reprise d'une mère (`POST /api/runs/:id/resume`) garde son `delegation` : le nouveau chef retrouve ses outils et
  voit les sous-missions des exécutions précédentes.

## 2. Les outils prêtés au chef

Serveur MCP `relay-missions` (`packages/mission-gateway/server.js`), ajouté à la session ACP de la mère **seulement**
quand `delegation.accepted` est vrai ; les sous-missions ne l'ont pas. Les mêmes outils et les mêmes textes pour tous
les agents (`packages/orchestrator/delegation-rule.js`). Chaque outil rend du JSON en texte ; une erreur rend
`isError: true` et `{ "erreur": "<code>", "message": "…" }`. Un appel ne voit et ne touche que les sous-missions de la
mission qui appelle (et de ses exécutions reprises).

| Outil              | Paramètres                                                                                         | Résultat                                                                                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mission_lancer`   | `consigne` (1 à 8 000 car.), `titre` (≤ 80), `agent`, `modele`, `fichiers` (≤ 20 chemins relatifs) | `{ id, titre, etat: "en_cours"\|"en_file", agent, modele, famille: { lancees, enCours, total, parallel } }`                                                                                                                           |
| `mission_suivre`   | `id` (facultatif), `details` (défaut `false`)                                                      | `{ missions: [{ id, titre, agent, modele, etat, depuis, inactiveDepuis, attend, outils, dernierOutil }], agents: [{ id, disponible }], nature }` ; avec `details` et une sous-mission finie, les champs de `mission_attendre` en plus |
| `mission_attendre` | `ids` (facultatif), `toutes` (défaut `false`), `delaiSecondes` (1 à 600, défaut 50)                | `{ terminees: [{ id, titre, etat, reponse, bilan, fichiers, envois: { approuves, refuses }, cause }], enCours: [{ id, titre, etat, attend }], delaiAtteint, nature }`                                                                 |
| `mission_annuler`  | `id`, `raison` (≤ 500)                                                                             | `{ id, etat: "cancelled", descendants }` ; une sous-mission déjà finie rend son état                                                                                                                                                  |

Erreurs : `enveloppe_atteinte`, `agent_indisponible`, `modele_inconnu`, `boucle` (consigne identique, au blanc près, à
celle d'une mission ancêtre), `fichier_hors_espace`, `introuvable`, `mission_terminee`, `parametres_invalides`.

Règles :

- **Défauts d'une sous-mission** : agent, modèle, pack, Skill, navigateur, domaines, budget et dossier de la mère.
- **Place** : au-delà de `parallel`, la sous-mission est mise en file (`en_file`) et démarre seule quand une place se
  libère ; une sous-mission qui attend le propriétaire (question, ou carte d'envoi en mode propriétaire) ne tient pas
  de place, comme pour les trois exécutions de la plateforme.
- **Enveloppe** : au-delà de `total`, l'appel rend `enveloppe_atteinte` et la plateforme pose au propriétaire, dans la
  file de questions de la mère, « Le chef veut lancer une Ne sous-mission ; l'enveloppe acceptée est de T. En autoriser
  5 de plus ? » ; sur « oui », `delegation.total` augmente de 5 (`delegation.extensions`) et l'appel suivant passe.
- **Attente** : chaque sous-mission finie est rendue **une fois** par `mission_attendre` sans `ids` ; demandée par `ids`,
  elle est rendue à nouveau ; elle reste lisible par `mission_suivre { id, details: true }`. Pendant l'attente, les
  minuteurs du chef (silence, outil figé, délai de mission, délai du tour ACP) sont en pause.
- `reponse` est la réponse finale de la sous-mission (50 000 caractères au plus) ; `bilan` est son Bilan tel que la
  plateforme l'a écrit (ses lignes à elle, sans la réponse) ; `fichiers` les fichiers nommés par **ses** appels
  d'outils terminés (écritures, `career_write`, noms rapportés par sa passerelle), jamais par date ; `cause` d'un échec :
  `{ type: "limite_usage"|"erreur", agent, reprise, message }`.
- **Fin du tour du chef avec des sous-missions vivantes** : un tour de plus, une fois (« Tes sous-missions … sont encore
  en cours : attends-les avec mission_attendre ou annule-les avec mission_annuler, puis termine. ») ; si le chef termine
  encore, la mère reste `running` (événement `family_waiting`) jusqu'à la fin de la dernière, puis écrit son Bilan.

## 3. Route interne (passerelle → plateforme)

`POST /api/internal/missions/<mère>`, en-têtes `x-platform-request: 1` et `x-relay-token: <jeton de la mère>` (le même
que sa passerelle de capacités), corps `{ "tool": "mission_…", "args": { … } }`. Réponses : `200 { result }` ou
`200 { erreur, message }` ; `403` pour un jeton invalide, une mission inactive ou une mission sans accord. La requête de
`mission_attendre` reste ouverte jusqu'à `delaiSecondes` ; si la passerelle la quitte, l'attente s'arrête.

## 4. Ce que la plateforme écrit

- **Lien** : chaque sous-mission porte `famille: { racine, mere, profondeur, titre }` ; la liste des sous-missions d'une
  mère se lit dans la base (`store.children`). En mode non propriétaire, une sous-mission d'une mission career-ops est
  titrée « Sous-mission N » et sa consigne reste dans l'espace privé (`relay/runs/<id>-input.json`), comme un prompt.
- **Événements de la mère** : `delegation_accepted` / `delegation_declined`, `child_launched { childId, titre, agent,
modele }`, `child_state { childId, state }`, `child_done { childId, state, envois }`, `delegation_envelope_reached`,
  `delegation_extended`, `family_waiting`.
- **`GET /api/runs/:id`** d'une mère qui a des sous-missions : `family: [{ id, titre, agent, state, attend,
pendingQuestion, pendingPermission }]` (absent sinon).
- **Bilan de la mère** : après les lignes habituelles, une section « Sous-missions (n) » : une entrée par sous-mission
  (titre, agent, modèle, état, durée, identifiant) suivie de **son Bilan cité mot pour mot** (`> …` ; au-delà de 3 000
  caractères, ses lignes d'envoi et d'actions échouées entières et un renvoi à la sous-mission) ; les totaux vus par la
  plateforme (terminées, en échec, annulées, interrompues ; envois approuvés, dont par accord de mission, refusés,
  comptés par les compteurs de la plateforme et non dans les textes) ; une ligne « Confrontation » quand la réponse du
  chef annonce un nombre d'envois différent ; la consommation (durée cumulée des agents, par agent).

## 5. Famille et espace

- Une famille compte pour **une** des trois exécutions de la plateforme (celle de la mère).
- Les membres d'une famille partagent l'espace career-ops ; toute autre mission y reste refusée tant que la famille vit.
- Annuler une mission (bouton du propriétaire ou `mission_annuler`) annule sa descendance : en cours (questions fermées,
  carte d'envoi refusée) et en file.
- Au redémarrage de l'API, toute la famille non finie passe `interrupted` ; un arrêt propre interrompt aussi les
  sous-missions en file.
- Les cartes d'envoi restent au clic du propriétaire, sous-mission par sous-mission (règle inchangée).

## 6. Pas encore fait (sprints suivants)

Front (carte d'avertissement, trois voies, bloc des sous-missions) et `POST /api/delegation/check` (`accord-02`) ;
`mission_preciser` (`accord-02`) ; `mission_lancer { reprendre }` et reprise de famille détaillée, outils prêtés à toute
la famille, accord d'envoi de famille, agent épuisé noté jusqu'à l'heure de reprise, filet d'écriture de l'espace partagé
(`famille-04`) ; navigateur à plusieurs onglets ou bail (`onglets-03`, `bail-05`).
