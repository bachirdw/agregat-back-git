# Portage swarm-12 — Suivi par tâche et retours au chef (copieur, 21/11/2026 04:56)

Base `ac4e34b`. Seul ce dossier est écrit. `node --check taches.js` passe ; un essai par
`node --input-type=module -e` (agrégat, reprise, suite, prérequis, boucle x↔y, entrées `null`/chaîne/nombre,
messages, rappel 300 car., verdicts) passe sans levée.

## 1. Copié de swarm (passages confirmés dans le dépôt de swarm, lecture seule)

| Origine | Lignes trouvées | Porté en |
| --- | --- | --- |
| `src/workflows/foreach-join.ts` `isRetryPending`, `isForeachChildSettled` | 31-45 (exact) | commentaire d'`agregat` : en Relay une seule tentative d'une tâche vit à la fois (`reprise_en_cours` dans `launch()`), la dernière tentative suffit à dire « vivante » |
| `foreach-join.ts` `buildForeachAggregate`, `resultStatus` | 137-177 (exact ; `latestForeachChildren` 125-135) | `parTache` (dernière ligne par élément, ordre d'insertion), `agregat` |
| `src/tasks/worker-follow-up.ts` « Cascade impact » | 653-662 (exact) | `dependantesAnnulees` |
| `src/prompts/session-templates.ts` `system.agent.compaction.goal_reminder` | 413-423 (le texte 417-421) | `demandeCourte` (+ `RAPPEL_MAX = 300`) |
| `src/be/steering.ts` `promoteSteeringToTask`, `promotePendingSteeringForTask` | 170-222 (exact) | `messagesDuChef` (+ `MESSAGE_NON_REMIS`) |
| Relay `roles.js` `verificationLines` (règle du dernier verdict) | — | `dernierVerdictParTache` (copie de la règle, `roles.js` intouché) |

Pièges gardés de leurs commentaires : l'échec se lit dans l'état, jamais dans le texte (une réponse qui
« commence par [FAILED: » est du texte de l'agent) ; une tentative en attente de reprise n'est pas réglée ;
seule la dernière ligne d'un élément compte (ordre d'insertion) ; une promotion de message est idempotente et une
ligne malformée ne doit pas empêcher les autres (ici : aucune levée, entrées filtrées).

Écarté : accès base (`getDependentTasks`, `createTaskExtended`, `getPendingSteeringForTask`), `async`, Slack,
`scrubSecrets`, le tri par `input.index` (`childIndex` : nos lignes sont déjà dans l'ordre de lancement,
`store.children` trie par `rowid`), `okCount/failedCount/cancelledCount` (remplacés par les comptes du Bilan, § 3),
la promotion automatique d'un message en tâche (Relay ne lance rien de lui-même : le chef est prévenu par
« message non remis : mission_continuer pour une suite »), la cascade transitive (swarm suit un seul niveau).

## 2. Signatures (taches.js, JavaScript ESM sans import)

- `tacheDe(id, byId)` → id de la première tentative ; `byId` : `Map` id → ligne ; ≤ 200 pas (`MAX_PAS`).
  Une ligne précédente = `famille.reprend ?? famille.continue` (ligne du store) ou `reprend ?? suiteDe` (ligne
  aplatie du Bilan) : les deux formes sont lues.
- `parTache(children)` → `Map` tâche → `{ premiere, derniere, tentatives, suites }` (lignes entières).
- `agregat(children)` → `{ taches, abouties, enEchec, annulees, interrompues, enCours, parTache: [{ tache, titre,
  etat, tentatives, suites?, derniere }] }` (`suites` absent à 0 ; `etat` = `state` brut de la dernière tentative).
- `dependantesAnnulees(child, children)` → `[{ id, titre }]` : sœurs avec `famille.apres` contenant `child.id`,
  `state === 'cancelled'` et `error` commençant par « Prérequis » ; vide si `child` est `completed` ou vivant.
- `dernierVerdictParTache(children)` → `Map` tâche → verdict ; lignes avec `verdict` déjà lu (`verdictOf`) et
  `relit` (ou `famille.relit`).
- `messagesDuChef(events)` → `[{ id (8 car.), etat: 'undelivered', via }]` ; `MESSAGE_NON_REMIS` (texte du plan).
- `demandeCourte(objectif, { prive })` → texte coupé à 300 caractères, `null` si privé ou vide.
  `messagesDuChef`, `demandeCourte` et les deux constantes sont en plus des cinq fonctions nommées par le plan.

## 3. Les endroits de Relay (repérés par nom ; les numéros du plan ont bougé)

- `delegation.js` `wait(mother, control, { ids, toutes, delaiSecondes }, signal)` (≈ l. 1666, plan 1382-1402) :
  `over(id) = terminal.has(state) && !this.held(id)`. Retour : `{ terminees: [outcome | { id, titre, etat,
  dejaRemise: true }], enCours: [{ id, titre, etat, attend }], delaiAtteint, ...space ({ espace }), nature }`.
  « Plus rien ne tourne » : `targets.every(over)` ; mais `targets` peut être un sous-ensemble (`ids`) : pour
  l'agrégat, prendre `this.childrenOf(mother)` entier et vérifier qu'aucun n'est vivant ni `held`.
- `outcome(child)` (≈ l. 1525, plan 1269-1290) : `{ id, titre, etat, reponse, bilan, fichiers, envois, cause,
  verdict?, resultat? }` ; `cause` null si `completed`. Autres appelants qui ne lisent que des clés choisies :
  `promptParts` (prérequis : `titre, etat, reponse, fichiers`), `continuation.js` (`id, titre, etat, reponse,
  fichiers, verdict`), `team-view.js` (`.cause`). Les champs neufs ne s'y propagent pas.
- `line(child)` (≈ l. 1482, plan 1239-1267) : `{ id, titre, agent, modele, etat, depuis, inactiveDepuis, attend,
  outils, dernierOutil, role?, relit?, pourquoi?, motif? }`. `this.engine.active.get(id)?.loop` = `guard.etat()`
  de loop-guard.js = `{ avertissements, dernier: { … } | null }` ; posé par `toolLoop()` d'index.js seulement
  quand le garde-boucle est allumé (`AGENT_PLATFORM_LOOP_GUARD`) ; absent après la fin (contrôle retiré de
  `active`).
- `synthesis()` (≈ l. 319, plan 273-280) : rend `{ familyResults: { nature, terminees: given.map(deliver),
  ...this.carnet.forChief(mother) }, instructions: SYNTHESIS_TURN }` ; `given` = vivantes + `undelivered`.
- `launch()` : `famille.reprend` ou `famille.continue` = id de la tentative précédente, avec `reprise` (rang) ;
  `famille.apres` = union de `args.apres` et `args.relit` (une relecture est donc aussi un prérequis) ; `taskOf`
  local remonte `reprend ?? continue` sur `sisters` (≤ 200 pas). `counter()` donne déjà `taches` et `reprises`
  (compte des lignes, pas des états) : ne pas dédoubler.
- Erreur d'une annulée par prérequis : `prerequisiteFailed(titre, state)` de delegation-rule.js =
  `Prérequis « ${titre} » non abouti (${stateLabel(state)})`, posée par `cancelHeld` (état `cancelled`) depuis
  `pump()`. Elle nomme UN prérequis (le premier non abouti de `prerequisite()`).
- roles.js `verificationLines(children)` : `taskOf` sur `reprend ?? suiteDe` (lignes aplaties), `latestBefore`.
- family-bilan.js `taskLine(children, byId)`, ligne « Par tâche (dernière tentative) : N tâche(s) : a aboutie(s),
  f en échec, c annulée(s), i interrompue(s)[, v encore en cours][, dont …] » : tâche = première tentative de la
  chaîne `reprend ?? suiteDe` (au plus `children.length` pas), état = dernière tentative dans l'ordre des lignes ;
  « en cours » = état hors `completed/failed/cancelled/interrupted`. Elle n'est écrite que s'il y a une reprise ou
  une suite. Lignes données par `familyBilan()` : `childrenOf(mother)` SANS les lignes d'erreur `REFUSED_CHILD`
  (« Sous-agents refusés par le propriétaire »), et `state: 'queued'` pour une ligne `held`. `agregat` donne les
  mêmes nombres si le codeur lui passe ces mêmes lignes (même filtre, même état `queued` pour une tenue).
- `engine.turnObjective(run)` (index.js) : `run.prompt` ; pour `workspace === 'career-ops'`, lit le fichier privé
  `relay/runs/<id>-input.json`. Privé : deux règles dans le code — `privateTitle = !!mother.workspace &&
  !engine.ownerMode` (launch) et `box.private = (workspace|pack === 'career-ops') && !ownerMode` (messages).
- `owner_message` : événement `{ type, at, data: { id, at, state, via, deliveredAt, de?, text? } }`, réémis à
  chaque changement (`pending` → `delivered` avec `via` `steering` / `turn_end` / `with_answer`, ou →
  `undelivered` par `closeOwnerMessages`, `via: null`). Le chef écrit avec `de: 'chef'` (continuation.js). Le
  dernier événement par id fait foi (comme `ownerMessagesOf` de resume-history.js).

## 4. Écarts entre le plan et le code intégré (à trancher ou à savoir)

1. `DR:241` : la description de `mission_attendre` est dans `MISSION_TOOLS.mission_attendre` (≈ l. 306).
2. `rappel.enCours` : le plan ne dit pas sa forme ; `wait()` a déjà une clé `enCours` (liste). Proposition : un
   nombre (tâches vivantes) ou la reprise de cette liste — à fixer par le manager.
3. « Mission privée » pour `rappel.demande` : choisir la règle (`privateTitle` ou celle de `box.private`) ;
   à noter : `promptParts` donne déjà `demandeDuProprietaire` en entier aux sous-missions, même privées.
4. `dependantesAnnulees` : une sœur à plusieurs prérequis annulée par B est aussi listée pour A si A a aussi
   échoué (l'erreur ne nomme qu'un titre ; lire le titre serait lire le texte). Cascade indirecte non suivie.
5. `agregat` vs Bilan : borne de remontée 200 contre `children.length` (même résultat sans boucle) ; filtre
   `REFUSED_CHILD` et `queued` pour les tenues à reproduire au branchement. Une reprise « en cours de création »
   (`family.resuming`) n'a pas encore de ligne : la tâche compte selon sa dernière ligne (finie) jusque-là.
6. Tests qui comparent des clés : `equipe-01-roles` (`launched`, `row.famille`, `view.family[0]`, absence de
   `verdict` dans `terminees[0]`), `swarm-01-decision` (clés de `line()` sans champ neuf : `boucle` doit être
   absent sans garde-boucle), `swarm-07-vue-equipe` (`cause`), `chef-01` et `delegation-v2-01-a` (`deepEqual` sur
   la ligne `dejaRemise` : n'y rien ajouter), `delegation-v2-01-b` (clés de la ligne du store). Aucun test ne
   compare toutes les clés de `wait()` ou de `familyResults`.
7. `messagesDuChef` lit `store.events(child.id)` ; un message `undelivered` n'existe qu'après la fin de la
   sous-mission (`closeOwnerMessages`).

## 5. Non vérifié

Le branchement réel (aucun test de Relay lancé ; rôle copieur) ; l'ordre exact de `store.children` au-delà de
`ORDER BY rowid` pour une famille reprise sur plusieurs mères (`childrenOf` concatène la chaîne des mères).
