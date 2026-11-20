# État réel des agents et limites d’usage (swarm-02)

La plateforme se souvient qu’un agent est à sa limite d’usage jusqu’à une heure, et sait dire l’état réel de
chaque agent. Modules : `packages/agent-runtime/limits.js` (classement pur, horloge passée en argument) et
`packages/agent-runtime/agent-state.js` (état d’un agent, mémoire dans le fichier des sondes). Une partie du
code est adaptée d’Agent Swarm (desplega-ai/agent-swarm, licence MIT).

## Classes d’échec : `classifyFailure({ message, announcement, rateLimit, models, model, cancelled, now })`

Rend `null` ou `{ classe, modele?, jusqua, source }`.

| `classe`        | Sens                                                                                   | `jusqua` quand aucune heure n’est lue |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------- |
| `limite`        | limite d’usage de l’agent entier                                                       | maintenant + 1 h                      |
| `limite_modele` | limite d’un seul modèle annoncé (`modele` = son identifiant)                           | maintenant + 24 h                     |
| `credits`       | crédits épuisés, plafond de dépense                                                    | maintenant + 2 h                      |
| `connexion`     | refus d’authentification (expression `AUTH_REFUSAL` de `probes.js`)                    | `null`                                |
| `surcharge`     | fournisseur surchargé (« overloaded », 529)                                            | `null`                                |
| `serveur`       | erreur serveur (« HTTP 503 », « 503 Service Unavailable », « Internal Server Error »…) | `null`                                |

- `jusqua` (ISO) est toujours borné entre maintenant + 1 minute et maintenant + 7 jours.
- `source` : `erreur` (le message d’erreur), `annonce` (dernier paragraphe du texte de l’agent) ou
  `evenement` (l’événement de limite du protocole, `rateLimit`).
- En cas de doute, `null` : c’est le comportement d’avant (rien n’est mémorisé).

### Règle de lecture (la même que le message montré, `packages/orchestrator/failure.js`)

- On lit `message` (l’erreur). Le texte de l’agent (`announcement`) n’est lu que si l’erreur est nue
  (`Internal error` ; l’expression `/^(?:Internal error|Agent arrêté\b)/i` est reprise telle quelle), et
  seulement son **dernier paragraphe** : plus haut, l’agent peut citer une limite comme contenu. Jamais un
  résultat d’outil.
- Dans l’erreur, un passage entre « » est un extrait de la réponse de l’agent cité par la plateforme
  (« JSON invalide dans la réponse de l’agent : « … » ») : il n’est pas lu.
- L’événement `rateLimit` (sortie de `rateLimitState`) ne compte que si l’erreur est nue ou dit elle-même
  une limite, comme pour `usageLimitMessage`. Quand une limite (ou un manque de crédits) est retenue,
  `rateLimit.resetsAt` (secondes) passe avant l’heure lue dans le texte.
- Ordre : mission annulée, ou fin propre à la tâche (contexte trop long, tours ou budget épuisés) → `null` ;
  crédits ; limite d’un modèle ; limite ; connexion ; surcharge ; erreur serveur.
- Un « 503 » nu au milieu d’un texte ne classe rien (il faut `HTTP`, `status`, `error` ou `code` devant, ou la
  phrase).

### Limite d’un modèle

La forme générique `reached your <X> limit` est lue ; `X` est comparé aux identifiants et aux noms des
modèles que l’agent a annoncés (`models`). Un seul modèle trouvé → `limite_modele` ; plusieurs, départagés
par le modèle de l’essai (`model`) ; aucun, ou ambigu → `limite` de l’agent entier. Aucun nom de modèle dans
le code.

### Heures de reprise lues (`parseResetTime(text, now)`)

- UTC : « resets 3pm (UTC) », « resets May 14, 5pm (UTC) ».
- Heure locale du processus, sans fuseau : « try again at May 26th, 2026 8:35 PM », « try again at 11:27 PM »,
  « try again at 22:00 », « resets 3pm », « resets at 3:30pm », « réessayer à 23:27 », « réessayez à 23h27 ».
  Une heure du jour déjà passée (de plus de 2 minutes) désigne le lendemain.
- Durées : « retry after 60 seconds », « wait 2 minutes ».

## Fichier des sondes (`<dataDir>/agent-probes.json`)

Deux champs de plus par agent, écrits par `saveProbe` (fusion des champs, `probes.js` inchangé). Absents tant
qu’aucune limite n’a été vue.

```json
{
  "<agent>": {
    "limite": { "classe": "limite", "jusqua": "<ISO>", "source": "annonce", "at": "<ISO>" },
    "limitesModele": {
      "<id du modèle>": {
        "classe": "limite_modele",
        "jusqua": "<ISO>",
        "source": "erreur",
        "at": "<ISO>"
      }
    }
  }
}
```

- `limite.classe` vaut `limite` ou `credits`. Rien de privé n’est écrit : ni texte de l’agent, ni clé ;
  seulement la classe, l’heure de reprise, la source, l’heure d’écriture et l’identifiant du modèle.
- Une ancienne sonde de refus sans `sessionAt`/`inferenceAt` reçoit, à l’écriture d’une limite ou à son
  effacement, son ancien `at` comme date de refus : écrire une limite ne rend pas un vieux refus récent.
- Après un effacement : `limite: null` ; `limitesModele` perd l’entrée du modèle (`null` s’il n’en reste
  aucune).

### Écriture : `noteFailure(dataDir, agentId, { message, announcement, rateLimit, models, model, cancelled, simulated })`

Appelée dans le bloc d’échec d’une mission (`packages/orchestrator/index.js`, résultat dans
`control.echecAgent`) et d’une étape de workflow (`workflow-run.js`). Sans effet pour un agent simulé ou une
mission annulée ; écrit `limite` (classes `limite`, `credits`) ou `limitesModele[<id>]` (classe
`limite_modele`) ; rien pour `connexion`, `surcharge`, `serveur`. Synchrone, sans réseau ; ne lève jamais
(arguments absents ou mal typés, dossier illisible). Rend la classification ou `null`. Les messages montrés
(`usageLimitMessage`, `authFailureMessage`) ne changent pas.

### Effacement : `clearLimit(dataDir, agentId, modele)`

Appelée après chaque réponse réussie (`end_turn`) d’un agent réel : efface la limite de l’agent et celle de
ce modèle. N’écrit rien s’il n’y a rien à effacer. Ne lève jamais.

## États : `agentState(agent, probe, { now, live })`

Rend `{ etat, raison?, jusqua?, modelesLimites? }`, dans cet ordre :

| `etat`              | Condition                                                                 |
| ------------------- | ------------------------------------------------------------------------- |
| `simule` / `pret`   | agent simulé : `simule` en mode réel, `pret` sinon                        |
| `non_installe`      | CLI non détecté                                                           |
| `adaptateur_absent` | adaptateur ACP absent                                                     |
| `mode_reel_eteint`  | mode réel désactivé                                                       |
| `limite`            | `probe.limite.jusqua` à venir ; `raison` « Limite d’usage jusqu’à HH:MM » |
| `connexion_refusee` | session ou prompt refusé depuis moins de 10 minutes (`PROBE_TTL_MS`)      |
| `a_reessayer`       | refus plus ancien                                                         |
| `pret`              | sinon                                                                     |

`modelesLimites` (`{ <id du modèle>: <jusqua> }`) liste les limites de modèle encore à venir ; absent sinon.
Lecture seule : une limite passée rend `pret` sans rien écrire.

## Mode Auto (`chooseAgent`)

Un agent dont `probe.limite.jusqua` est à venir est écarté avec la raison « Limite d’usage jusqu’à HH:MM »
dans `rejected`. Il n’est jamais « réessayé » comme un agent écarté par une sonde négative. Sans champ
`limite`, ou avec une limite passée, le choix est exactement celui d’avant.

## Ce que voit le chef (swarm-08)

- `mission_suivre.agents[]` rend, pour chaque agent détecté, `etat`, `raison` et `jusqua` de `agentState` (avec
  l'horloge et le mode réel du moment), `disponible` (`pret` ou `a_reessayer`) et, par modèle, `limiteJusqua` (tiré de
  `modelesLimites`) ; agents prêts en tête.
- Au lancement d'une sous-mission, un agent en `limite` ou `connexion_refusee`, ou dont le modèle demandé est sous
  limite, est refusé s'il est nommé par le chef (`agent_indisponible`, avec la raison et les agents prêts), remplacé
  par le premier agent prêt sinon ; le levier `malgreIndisponible: true` passe outre.
- La cause d'un échec rendue au chef porte la classe notée par `noteFailure` (`classe`, `jusqua`) et `agentsPrets`.
- Détail : `docs/api-delegation.md`, 9.8.
