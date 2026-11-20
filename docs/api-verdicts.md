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
