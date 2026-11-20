# API — vue d'équipe pour l'interface (swarm-07)

Ajout pur sur trois réponses `GET` ; aucune route d'écriture n'est touchée, aucun champ existant n'est renommé ni
retiré. Code : `packages/orchestrator/team-view.js` (lecture seule, par les méthodes publiques de la délégation) ;
branchements dans `apps/api/server.js`. Idées et formes reprises de desplega-ai/agent-swarm (MIT, © desplega.sh),
sans code copié.

## GET /api/runs

- **Sans paramètre** : la même liste qu'avant (toutes les exécutions, sous-missions comprises, même ordre, mêmes
  champs), avec seulement la clé `equipe` en plus sur chaque mère. Une mission sans famille a exactement les mêmes clés
  qu'avant.
- **`?racines=1`** : la liste sans les sous-missions (exécutions qui portent `famille`), sauf une sous-mission dont la
  mère n'est plus dans la base (gardée), avec `equipe` sur chaque mère. C'est la liste prévue pour l'interface neuve.

`equipe` (présent seulement sur une mission qui a lancé au moins une sous-mission) :

```js
{
  (membres, enCours, finis, echecs, teDemande);
}
```

- `membres` : sous-missions de la mère et des exécutions qu'elle reprend ;
- `finis` : membres `completed` ; `echecs` : membres finis sans succès (`failed`, `cancelled`, `interrupted`) ;
  `enCours` : les autres, membres retenus compris (en file, en attente d'accord ou d'un prérequis) ;
- `teDemande` (booléen) : au moins un membre attend le propriétaire (`awaiting_owner`, `waiting_permission`, ou
  retenu en attente de l'accord des sous-agents).

**Limite connue** : `store.list()` s'arrête aux 200 dernières exécutions **avant** le filtre de `?racines=1`. Avec
beaucoup de sous-missions, moins de 200 missions sont donc listées.

## GET /api/runs/:id

- **Sans paramètre** : réponse identique à avant (mêmes clés, mêmes entrées de `family[]`).
- **`?equipe=1`** : chaque entrée de `family[]` (mère seulement) garde ses champs et gagne :

```js
{ modele, continue?, pourquoi?, debut, fin, dureeMs?, depuis, inactiveDepuis, outils, dernierOutil,
  resultat?, cause?, usage? }
```

| Champ                    | Sens                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modele`                 | modèle demandé pour le membre (`''` sans modèle)                                                                                                                                |
| `continue`               | tâche que ce membre poursuit (absent sinon)                                                                                                                                     |
| `pourquoi`               | motif donné par le chef au lancement (absent sinon)                                                                                                                             |
| `debut`, `fin`           | heures ISO de démarrage et de fin, `null` tant qu'elles n'existent pas                                                                                                          |
| `dureeMs`                | `fin − debut`, seulement pour un membre fini qui a démarré                                                                                                                      |
| `depuis`                 | secondes depuis la création du membre (recalculé à chaque appel)                                                                                                                |
| `inactiveDepuis`         | secondes depuis son dernier événement (recalculé à chaque appel)                                                                                                                |
| `outils`, `dernierOutil` | nombre d'outils observés ; nom du dernier (80 car.) ou `null`                                                                                                                   |
| `resultat`               | 600 premiers caractères de la réponse d'un membre `completed` (absent si vide)                                                                                                  |
| `cause`                  | membre fini sans succès : `{ type: 'limite_usage' \| 'erreur', message?, reprise }` ; `message` (300 car.) absent s'il est vide ; `reprise` = heure « réessayer à … » ou `null` |
| `usage`                  | consommation du membre, absent tant que le lot swarm-14 n'est pas posé                                                                                                          |

**Mission privée** (même règle que le titre privé d'une sous-mission : la mère, ou le membre, a un espace de travail
et le mode propriétaire est éteint) : ni `resultat` ni `cause.message`, et la réponse du membre n'est pas lue.

`resultat` et `cause.message` sont des données rapportées par un agent : l'interface les affiche en texte brut, sans
les interpréter.

Mémoire : le calcul d'un membre fini est gardé (ses champs fixes ne changent plus) ; celui d'un membre en cours est
gardé 2 secondes ; un changement d'état le recalcule aussitôt. La mémoire est bornée (2 000 entrées par moteur).

Une sous-mission s'ouvre toujours par `GET /api/runs/<id de la sous-mission>`.

## GET /api/catalog

Chaque agent gagne son état réel, calculé par `agentState` (swarm-02, voir `docs/api-agents-etat.md`) : `etat`, et
selon le cas `raison`, `jusqua` (fin d'une limite d'usage) et `modelesLimites` (`{ <modèle>: <jusqua> }`). Un champ que
`agentState` ne rend pas est absent. Les champs existants (`probe`, `reason`, …) sont inchangés.
