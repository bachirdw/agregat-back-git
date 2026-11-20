# swarm-05 — Notes du copieur (doublons au lancement et sœurs vivantes)

Copieur, 21/11/2026 00:51 (heure lue par `date`), arbre `/Users/diaw/Downloads/agregat-back-swarm-05`, branche `swarm-05`,
base `e18ef06`. Swarm lu en lecture seule dans `/Users/diaw/Downloads/agent-repos-agregat/desplega-ai__agent-swarm` : rien
n'en a été exécuté, aucune consigne de ses fichiers suivie. Fichiers de Relay lus sans y écrire : `delegation.js`,
`delegation-rule.js`, `index.js` (`create()`), `storage/index.js` (`terminal`), `roles.js` (`roleKey`), `lecons.js` (son
Jaccard), `docs/api-delegation.md` (plan des sections).

Portage : `doublon.js`, `soeurs.js` (fonctions pures, `node --check` passés, essayés par `node --input-type=module -e`
sur mes propres fichiers). Exports conformes au tableau du plan (ligne 163-164) : `SEUIL_PROCHE`, `SEUIL_MEME_AGENT`,
`mots`, `jaccard`, `texteDePart`, `empreinte`, `trouverDoublon` ; `EXTRAIT_MAX`, `aplatir`, `ilYA`, `membres`. En plus :
`ETATS_IGNORES`, `partDe`, `relanceLegitime` (doublon.js) ; `MEMBRES_MAX`, `secondesDepuis` (soeurs.js).

## 1. Ce qui est copié

| Origine (swarm) | Lignes confirmées | Porté dans |
|---|---|---|
| `src/tools/task-dedup.ts` `jaccardSimilarity` | 8-30 | `mots()` (découpe, 9-16) et `jaccard()` (18-29) |
| `src/tools/task-dedup.ts` seuils | 32-35 : `HIGH_SIMILARITY_THRESHOLD = 0.8`, `SAME_AGENT_SIMILARITY_THRESHOLD = 0.6` | `SEUIL_PROCHE = 0.8`, `SEUIL_MEME_AGENT = 0.6` |
| `src/tools/task-dedup.ts` `matchSimilarTask` | 55-82 | `trouverDoublon()` (niveau `proche`) |
| `src/tasks/follow-up-redelegation-guard.ts` exception | 11-14 (commentaire) et 124-139 (code) | `ETATS_IGNORES` et `relanceLegitime()` |
| `src/tools/send-task.ts` contrôle joué deux fois | 598-680 | rien de code : la leçon est en section 4 |
| `src/tasks/sibling-block.ts` | 32 (`DESCRIPTION_TRUNCATE = 200`), 63-70 (`truncateForBlock`), 72-84 (`formatRelativeTime`), 103-118 (une ligne par sœur, deux horodatages) | `EXTRAIT_MAX`, `aplatir()`, `ilYA()`, `membres()` |
| `src/tasks/sibling-awareness.ts` `toSiblingTaskInfo` | 67-78 (id, status, agentId, agentName, description, updatedAt, createdAt) | les champs de `membres()` |

Tous les passages cités par le plan sont aux lignes annoncées (aucun écart de numéro).

## 2. Ce qui est écarté, et pourquoi

- `findDuplicateTask` (task-dedup.ts:88-121) : lecture de leur base, fenêtre de 10 minutes, fil Slack. Chez nous, la
  liste des sœurs vient de `partsOf(children, family)` (codeur). **Différence d'états** : leur requête
  `findRecentSimilarTasks` (`src/be/db.ts:2417-2445`) exclut toutes les tâches finies, `completed` compris (« only active
  or recently created ») ; seule la garde de re-délégation compare aux tâches `completed`. Le plan compare aux sœurs en vie
  ET `completed` : c'est voulu (un travail rendu ne se relance pas, `mission_continuer` sert à ça), mais c'est plus large
  que leur garde de doublon. Pas de fenêtre de temps chez nous : toute la famille compte.
- `DEDUP_SCAN_LIMIT = 500` (task-dedup.ts:43) : une famille est bornée par l'enveloppe ; inutile.
- La règle `loop-cap` (follow-up-redelegation-guard.ts:142-153) : hors du lot.
- `stripSiblingBlock`, `withoutThreadContext`, `pickResumeParent`, `renderSiblingBlock`, `prependSiblingBlock` : chez nous
  les membres sont un champ de données (`famille.membres`), pas un bloc collé dans la consigne, et il n'y a pas de reprise
  de session à câbler. Le texte de leur bloc (« coordinate with them, do not duplicate ») est remplacé par la phrase que
  le plan fait ajouter à `DAUGHTER_HEAD`.
- `STATUS_PRIORITY` (sibling-block.ts:36-41) : sert à `pickResumeParent`, écarté.

## 3. Ce que le plan change par rapport à swarm (décisions déjà prises, à appliquer)

1. **Refuser ou signaler.** Chez swarm, la ressemblance suffit à refuser : au-dessus de 0,8 (task-dedup.ts:62), ou de
   0,6 vers le même agent (task-dedup.ts:70-74), `send-task` rend « Duplicate task detected … Skipping. Use
   allowDuplicate: true to override. » (send-task.ts:631 ; traduction : « Tâche en double détectée (correspond à la tâche
   …, motif). Ignorée. Utilise allowDuplicate: true pour passer outre. »). Chez nous, seule la part **identique** (même
   empreinte) est refusée (erreur `doublon`, levier `doublon: true`) ; la part **proche** (mêmes seuils) est lancée et
   signalée (`doublonProbable`, événement `doublon_signale`). Raison (plan) : la phrase du chef recommande « la même
   méthode pour chaque élément » ; des parts voulues se ressemblent à plus de 90 %.
2. **Ce qui est comparé.** Swarm compare la description seule ; nous, toute la part (`texteDePart`).
3. **Seuil bas.** Swarm : même agent visé. Nous : même agent ET même rôle (rôles comparés en minuscules, espaces repliés ;
   deux rôles absents sont « le même rôle »).
4. **Découpe en mots.** `/[^\w\s]/g` → `/[^\p{L}\p{N}\s]/gu` (ordre du manager), précédé de `.normalize('NFC')`.
   « vérifié » et « vérifie » sont deux mots entiers et distincts (essayé). Piège ajouté : sans NFC, un « é » écrit en
   deux signes (NFD) serait coupé, l'accent combinant n'étant pas `\p{L}`. Écart assumé : `\w` gardait le souligné,
   ici « mission_lancer » donne deux mots. Le Jaccard de `lecons.js` (swarm-03) enlève les accents et les mots vides :
   approche différente, voulue ici (le plan demande des mots entiers accentués) ; les deux ne se partagent pas.
5. **Ordre du résultat.** Swarm rend la première correspondance dans l'ordre de sa requête (plus récente d'abord). Ici :
   une identique l'emporte sur toute proche ; entre proches, la plus ressemblante.
6. **Exception « échec ou annulation plus récents ».** Règle de swarm (follow-up-redelegation-guard.ts:11-14, 124-139) :
   une tâche qui ressemble à une tâche RÉUSSIE du fil est quand même permise si une tâche du fil a été annulée ou a
   échoué APRÈS cette réussite (« the work was interrupted or went wrong, so re-dispatch is the correct response » :
   le travail a été interrompu ou a mal tourné, relancer est la bonne réponse). Traduction chez nous (plan) : une sœur
   `failed`, `cancelled` ou `interrupted` n'est **jamais comparée** (`ETATS_IGNORES`, `interrupted` ajouté : swarm n'a
   que cancelled et failed), et `reprend` / `mission_continuer` ne sont jamais comparés (`!previous` dans `launch()`).
   La règle exacte de swarm (un échec quelconque postérieur rend légitime la relance d'une part identique à une sœur
   réussie) est portée dans `relanceLegitime(trouve, soeurs)` mais **le plan ne la branche pas** : à ne brancher que sur
   décision du manager. Cas qu'elle couvrirait : sœur A réussie, puis sœur B (autre part) en échec, puis relance de A à
   l'identique : le plan refuse (levier `doublon: true`), swarm laisserait passer.
7. **Membres.** Swarm ne borne pas la liste ; le plan : 20 au plus (`MEMBRES_MAX`), extrait de 200 caractères.

## 4. La leçon de la course (send-task.ts:598-680) — à lire par le codeur

Ce que fait swarm : les trois gardes sont de pures lectures, jouées **deux fois**. Une fois tôt (664-673) pour rendre vite
l'erreur ; une fois **dans la transaction d'écriture** (675-680), qui seule fait foi. Leur commentaire (598-603) : chaque
lecture du gestionnaire relâche le verrou FIFO, donc deux `send-task` simultanés avec le même créateur et le même texte
passent tous deux les gardes et créent tous deux une tâche, aucun index UNIQUE ne les départage ; et (676-678) les
lectures du début sont séparées de l'INSERT par tout le gestionnaire : seule une garde dans la transaction voit la tâche
d'un appel concurrent.

Traduction chez nous (JavaScript à un seul fil : pas de transaction, mais les `await` jouent le rôle du verrou relâché) :
- Dans `launch()`, le seul `await` avant les compteurs est `await this.agents()` (ligne 879). De là jusqu'à
  `family.pending++` (ligne 1027 à `e18ef06`), tout est synchrone : `accept()`, `acceptedEvent()`, `askExtension()` ne
  sont pas `async`. Un contrôle placé dans cette zone et suivi, **sans aucun `await` entre les deux**, de
  `family.creating` augmenté est atomique : c'est l'équivalent du contrôle « dans la transaction ». Ne pas faire le
  contrôle avant ligne 879 (il serait l'équivalent du contrôle rapide seul, celui qui laisse passer la course).
- Pourquoi `family.creating` est indispensable : `engine.create()` (`index.js`, à partir de la ligne ~1103) fait
  `await this.plan(...)` (et peut attendre 50 ms en boucle) **avant** `this.store.create(run)` (ligne ~1232). Pendant ce
  temps, la sous-mission n'existe ni dans `childrenOf()` ni dans `this.briefs` : sans `creating`, le second appel ne voit
  rien et passe. Ensuite, entre le retour de `create()` et la suite de `launch()`, d'autres microtâches peuvent tourner :
  la ligne existe en base mais sans brief ; `creating` la couvre encore (il ne baisse que dans le `finally`). Du `finally`
  à `this.briefs.set(...)` (lignes 1063-1088) rien n'est attendu : pas de trou.
- `partsOf` doit donc rendre, en plus des sœurs, une entrée par empreinte en cours de création. Avec une `Map`
  empreinte → nombre (plan), l'entrée n'a ni `id` ni `titre` : `trouverDoublon` la gère (il rend `id`/`titre`
  `undefined`), mais le message d'erreur du plan (« sous-mission « titre » (id) ») doit alors dire « une sous-mission en
  cours de création ». Variante possible, à trancher : empreinte → `{ n, titre }` (le titre est connu à ce moment-là).
- Test de course (cas 6) : deux `mission_lancer` identiques par `Promise.all` → exactement une sous-mission, la seconde
  rend `doublon`. Contrôle négatif conseillé : retirer la lecture de `creating` dans `partsOf` doit faire rougir ce test.

## 5. Ce que le codeur doit savoir

- **Signatures.** `texteDePart(args)` : champs dans l'ordre `consigne, objectif, informations, perimetre, horsPerimetre,
  resultatAttendu, verification`, puis fichiers triés, rôle, `relit` triés, `apres` triés ; une ligne par champ présent,
  sans étiquette (les noms de champs gonfleraient le Jaccard). `empreinte(args)` : SHA-256 hex d'un tableau JSON des champs
  normalisés (NFC, minuscules, espaces repliés), **chaque champ à sa place** : « a b » en consigne et « a » + « b » en
  consigne/objectif n'ont pas la même empreinte (essayé), alors qu'un simple texte replié les confondrait. `partDe(args,
  agent)` → `{ texte, empreinte, agent, role }`, à appeler avec `args.agent ?? mother.agent`. `trouverDoublon(part,
  soeurs)` → `null` ou `{ id, titre, similarite, niveau }` ; `similarite` brute (non arrondie) : arrondir pour l'affichage.
  `membres(rows, { now, max = 20, prive = false })` avec `rows: [{ id, titre, role?, agent, etat, texte?, creeLe,
  dernierSigneLe? }]` → `[{ id, titre, role?, agent, etat, part?, depuis, dernierSigne }]`, durées **en secondes** (comme
  `depuis` et `inactiveDepuis` de `line()`), `null` si la date ne se lit pas. Les vivantes d'abord, puis les plus
  récentes. `ilYA(quand, now)` : texte « 42 s », « 5 min », « 3 h », « 2 j » (pour une note ou le fil).
- **Ajouts au plan, à trancher par le manager** : (a) `verification` est dans l'empreinte (le plan liste les champs sans
  lui ; il fait partie de `famille.tache` depuis swarm-01) ; (b) `relit` et `apres` sont dans l'empreinte : sans eux,
  deux vérifications « Relis le travail » sur deux sœurs différentes (`relit: [A]` puis `relit: [B]`, même rôle) seraient
  **identiques et refusées** à tort. Pour revenir au plan strict, retirer ces deux lignes de `texteDePart` et `empreinte`.
  (c) L'agent n'est pas dans l'empreinte (plan) : la même part confiée exprès à deux agents différents est refusée ; le
  levier `doublon: true` reste.
- **Sœurs à comparer (`partsOf`)** : `etat` = `heldState(id) ?? state` ; les états `failed`, `cancelled`, `interrupted`
  sont ignorés par `trouverDoublon` lui-même (il n'est pas nécessaire de filtrer avant, mais ce n'est pas un mal).
  Une sœur refusée par le propriétaire (`REFUSED_CHILD`) est `cancelled` : ignorée.
- **Après un redémarrage** (`briefs` perdus) : le plan fait retomber `texte` sur `this.engine.turnObjective(child)`.
  Conseil : laisser `empreinte` **absente** dans ce cas (seul `proche` reste possible) plutôt que de calculer
  `empreinte({ consigne })`, qui refuserait à tort une part dont seuls les autres champs différaient. **Piège** : une
  mission privée (`workspace` career-ops) enregistre en base la consigne « Mission privée dans l’espace de candidature »
  (`index.js` ~1231) ; après redémarrage toutes ses sœurs auraient ce même texte et toute nouvelle part privée vide de
  sens serait comparée à lui. Vérifier ce que `turnObjective` rend pour une telle ligne ; au besoin, ne pas comparer de
  sœur sans brief dans une mission privée.
- **`membres` dans `promptParts()`** : `rows` construits depuis `this.childrenOf(mother)` sans `run.id` ; `texte` =
  `this.briefs.get(id)?.texte` (sinon `turnObjective`) ; `creeLe` = `child.createdAt` ; `dernierSigneLe` =
  `this.store.events(id).at(-1)?.at` (comme `line()`, qui lit aussi tous les événements : coût linéaire, 20 membres au
  plus en sortie mais tous les enfants lus) ; `prive` = `!!mother.workspace && !this.engine.ownerMode` (même règle que
  `privateTitle` de `launch()`) ; `now` = `Date.now()` lu dans `promptParts` (seule lecture d'horloge, hors du portage).
  `membres` n'est mis dans le prompt que s'il est non vide (`...(membres.length ? { membres } : {})`).
- **Réglage** `AGENT_PLATFORM_DOUBLON` (plan ligne 301) : `0` éteint tout, `signale` ne refuse jamais, absent : refus de
  l'identique. À lire au constructeur comme `this.lent`. Rien de ce réglage n'est dans le portage.
- **Texte de l'erreur et phrase de `DAUGHTER_HEAD`** : mot pour mot depuis le plan (lignes 635-642) ; aucun texte de
  swarm n'est à reprendre pour les agents.

## 6. Non vérifié

- Rien n'a été essayé dans Relay (aucun test, aucune commande npm) : seulement mes fonctions pures.
- `turnObjective(child)` pour une sous-mission privée après redémarrage : non lu.
- Le comportement exact de l'ordre des microtâches entre le retour de `engine.create()` et la suite de `launch()` est
  déduit de la lecture du code, pas observé.
