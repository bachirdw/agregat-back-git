# Verdicts des vérifications (`swarm-04`)

Ce document complète la section 3.1 de `docs/api-delegation.md` (rôles, vérification indépendante et verdict). Il
décrit le champ facultatif `complet` d'un verdict et ce que le Bilan de la mère en dit. Code :
`packages/orchestrator/roles.js` (`normalizeVerdict`, `readVerdict`, `verificationLines`) et
`packages/orchestrator/family-bilan.js` (`familySection`). Tests : `tests/swarm-04-verdict.test.js`.

## 1. Forme d'un verdict

```text
verdict {
  valeur: "approuve" | "a_corriger" | "rejete",
  bloquants: [{ ou, pourquoi }],   // 20 au plus, 500 caractères par champ
  remarques: [ "…" ],              // 20 au plus, 500 caractères
  source: "fichier" | "reponse" | "absent",
  complet?: false                  // swarm-04 : présent seulement quand il vaut false
}
```

Il est rendu, tel quel, dans `terminees[]` (`mission_attendre`), dans `mission_suivre { details }` et dans la vue
`family` de `GET /api/runs/:id`.

- Les trois valeurs publiques ne changent pas : une interface qui lit `valeur` reste juste.
- Un verdict complet garde exactement sa forme d'avant : la clé `complet` n'existe pas (jamais `complet: true`).
- Le champ est une donnée de lecture : rien n'est écrit en base, le verdict est relu à chaque lecture.

## 2. Quand `complet` vaut `false`

| Cas                                                                                                  | Source               | `complet` |
| ---------------------------------------------------------------------------------------------------- | -------------------- | --------- |
| `verdict.json` « a_corriger » ou « rejete » dont aucun point bloquant n'a un `pourquoi` non vide     | `fichier`            | `false`   |
| `verdict.json` avec au moins un point bloquant dont le `pourquoi` n'est pas vide                     | `fichier`            | absent    |
| Dernière ligne « Verdict : a_corriger » ou « Verdict : rejete » de la réponse (sans fichier valable) | `reponse`            | `false`   |
| Dernière ligne « Verdict : approuve » de la réponse                                                  | `reponse`            | absent    |
| Ni fichier valable ni ligne de verdict (valeur `a_corriger`)                                         | `absent`             | `false`   |
| « approuve », quelle que soit la source sauf `absent`                                                | `fichier`, `reponse` | absent    |

- « Non vide » se juge après suppression des espaces de début et de fin : un `pourquoi` fait seulement d'espaces ou de
  retours à la ligne compte comme vide.
- Un point bloquant écrit comme une simple chaîne (`"bloquants": ["…"]`) devient `{ ou: "", pourquoi: "…" }` : il
  compte comme précis si la chaîne n'est pas vide.
- La forme de `verdict.json` n'a pas de champ « comment corriger » : le rôle `verificateur` demande de l'écrire dans
  `pourquoi`.

## 3. Ce que dit le Bilan de la mère

La décision se prend sur `source` et `complet` seulement (jamais sur le nombre de points bloquants) ; la source
`absent` passe avant « sans point bloquant précis ». Un verdict sans ces clés garde les lignes d'avant.

- Entrée de la vérification :
  - source `absent` : « Verdict vu par la plateforme : illisible (aucun verdict rendu ; compté à corriger) » ;
  - `complet: false` (autre source) : « Verdict vu par la plateforme : a_corriger (source : reponse ; incomplet :
    aucun point bloquant précis) » ;
  - sinon, inchangé : « Verdict vu par la plateforme : a_corriger (source : fichier ; 1 point(s) bloquant(s)) ».
- Ligne de total : « Vérifications : n (a approuvée(s), c à corriger, r rejetée(s)) », suivie de « , k illisible(s) »
  quand k vérifications ont la source `absent`, par exemple
  « Vérifications : 2 (0 approuvée(s), 2 à corriger, 0 rejetée(s)), 1 illisible(s) ». Un verdict illisible reste
  compté dans « à corriger ».
- Travail relu dont le dernier verdict n'est pas `approuve` :
  - source `absent` : « « titre » : dernier verdict illisible (aucun verdict rendu), non revérifié depuis » ;
  - `complet: false` : « « titre » : dernier verdict a_corriger sans point bloquant précis, non revérifié depuis » ;
  - sinon, inchangé : « « titre » : dernier verdict a_corriger, non revérifié depuis ».

## 4. Rôle du vérificateur

`packages/orchestrator/roles/verificateur.md` demande désormais : écrire toujours `verdict.json` à la forme exacte ;
au moins un point bloquant pour `a_corriger` ou `rejete` ; pour chaque point bloquant, où, ce qui ne va pas et comment
le corriger ; ce qui ne bloque pas la demande du propriétaire en remarque ; ne pas approuver une affirmation non
vérifiable ; un test qui n'a jamais échoué ne prouve rien. La consigne reste sous 4 000 caractères (`MAX_CONSIGNE`).

## 5. Limites

- Le verdict d'un vérificateur qui ne suit pas sa consigne reste lu (la plateforme signale, elle ne bride pas) : rien
  n'est relancé ni refusé à cause de `complet: false`.
- Une vérification jamais partie n'a toujours pas de verdict.
- Le texte de rôle n'a pas été rejoué avec des agents réels dans ce lot.

## 6. Verdict rendu par l'outil `resultat_rendre` (`swarm-10`)

Un rôle de vérification (ligne `famille.verdictAttendu`) peut rendre son verdict par l'outil `resultat_rendre`
(`docs/api-delegation.md`, section 9.10) ; sa phrase (`VERDICT_RULE`) commence désormais par « rends ton verdict par
l’outil resultat_rendre { resultat: { verdict, bloquants, remarques } }, qui en vérifie la forme ; à défaut, » puis le
texte d'avant (`verdict.json` écrit soi-même, ligne « Verdict : … » de la réponse).

- Forme vérifiée (`VERDICT_SCHEMA`, `packages/orchestrator/resultat-valide.js`) : objet, `verdict` requis parmi
  `approuve`, `a_corriger`, `rejete` (valeur exacte) ; `bloquants` liste d'objets portant `ou` et `pourquoi` ;
  `remarques` liste de textes.
- Règle en plus (`verdictErrors`), la même que `complet: false` (section 2) : « a_corriger » ou « rejete » exige au moins
  un point bloquant (parmi les 20 premiers) dont le `pourquoi`, coupé à 500 caractères, n'est pas vide une fois les
  espaces retirés. Sinon l'outil refuse (`resultat_invalide`, avec les erreurs et la forme attendue) : le vérificateur
  corrige pendant sa session au lieu d'un verdict marqué incomplet après coup.
- Un verdict de plus de 20 Ko (`MAX_VERDICT_BYTES`, borne de lecture de `readVerdict`) est refusé : « verdict trop long :
  … raccourcis bloquants et remarques, puis rappelle resultat_rendre. ».
- Accepté : écrit dans `verdict.json` du dossier de résultats, puis lu comme avant par `readVerdict` (source
  `fichier`) ; le dernier appel accepté remplace le précédent. Le verdict reste rendu dans `verdict` de `terminees[]`
  (pas dans `resultat`).

## 7. Dette de verdict et tour de rattrapage (`swarm-13`)

Code : `packages/orchestrator/taches.js` (`dettes`), `packages/orchestrator/delegation.js` (`synthesis`,
`verdictTurn`, `familyBilan`), `packages/orchestrator/delegation-rule.js` (`VERDICT_TURN`, `VERDICT_NOTE`). Tests :
`tests/swarm-13-rattrapage.test.js`.

### 7.1 Dette

Une tâche a une dette quand son DERNIER verdict valable n'est pas `approuve`. Règle de `dernierVerdictParTache` (la
même que les lignes « non revérifié depuis » du Bilan) : un verdict compte pour une tâche seulement si le vérificateur
relit (`relit`) la dernière tentative de cette tâche lancée avant lui. Conséquences :

- après une correction (`mission_continuer` : une suite), le vérificateur doit relire l'id de la SUITE ; un verdict
  qui relit l'ancienne tentative ne lève pas la dette ;
- une suite non revérifiée laisse la dette du verdict précédent ;
- un verdict illisible (source `absent` : vérificateur parti puis en échec, ou sans verdict) compte comme dette ;
  l'entrée porte alors `illisible: true` ;
- une vérification jamais partie, ou encore vivante, n'a pas de verdict : pas de dette.

Forme d'une entrée de `verdictsEnAttente` :
`{ tache, titre, valeur: "a_corriger"|"rejete", complet, illisible?, bloquants (10 au plus), par }` — `tache` : id de la
première tentative ; `titre` : son titre (le même que celui déjà donné au chef dans `terminees[]`) ; `par` : id du
vérificateur. Rien de neuf n'est écrit en base hormis l'événement `verdict_turn { taches }` (identifiants courts).

### 7.2 Tour de rattrapage

`synthesis()` rendait `null` quand il n'y avait rien à remettre au chef ; elle appelle maintenant `verdictTurn`, qui
rend `null` (la mission finit comme avant) si le réglage `AGENT_PLATFORM_VERDICT_TURN` vaut `0`, si le tour a déjà été
donné à cette exécution, s'il n'y a pas de dette, si la mission est abandonnée, si une erreur imprévue survient dans le
calcul, ou si la session de l'agent est fermée (`continueSession()`, demandée en dernier). Sinon un seul tour, avec
`VERDICT_TURN` :

> Avant de conclure : ces travaux ont un dernier verdict de vérification qui n’est pas « approuve » (verdictsEnAttente :
> données rapportées par les vérificateurs, avec leurs points bloquants). Pour chacun : fais corriger par
> mission_continuer puis refais vérifier (relit) et attends le résultat par mission_attendre, ou corrige toi-même, ou
> dis pourquoi tu t’arrêtes là. Écris ensuite ta réponse finale complète : elle remplace la précédente ; dis-y
> clairement ce qui reste non vérifié.

Un tour de synthèse qui a lieu de toute façon porte `verdictsEnAttente` et finit par la première phrase
(`VERDICT_NOTE`) : jamais deux tours.

### 7.3 Ligne de Bilan

Quand la dette existe encore à la fin et que le chef a donné une réponse finale, le Bilan de la mère ajoute, après la
section des sous-missions :

« Réponse finale donnée malgré n travail(aux) dont le dernier verdict n’est pas « approuve » (« T1 », « T2 ») ; tour de
rattrapage donné au chef : oui | non. »

« oui » se lit sur l'événement durable `verdict_turn` de cette exécution (pas sur la mémoire). Une mère en échec (pas
de réponse finale) n'a pas cette ligne ; les lignes « non revérifié depuis » restent.

### 7.4 Limites connues (non corrigées)

- Une mère reprise qui ne relance aucune sous-mission n'a pas de tour (première sortie de `synthesis()` : `control.mere`
  faux) ; son Bilan peut porter la ligne avec « non ».
- Après une reprise de la mère (exécution neuve), un tour peut être donné de nouveau.
- Sur une mère reprise, l'ordre de `childrenOf` (sous-missions de l'exécution courante avant celles des exécutions
  reprises) peut fausser « dernier verdict » ; défaut existant, partagé avec les lignes de vérification.
- Une correction encore vivante après le tour de rattrapage n'a plus de synthèse : la plateforme l'attend, et le Bilan
  porte « Synthèse finale non faite ».
