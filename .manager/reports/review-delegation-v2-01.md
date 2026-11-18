# Rapport `review-delegation-v2-01` — relecture indépendante du sprint `delegation-v2-01`

Session de relecture (Opus), seul écrivain de `~/Downloads/agregat-back-delegation`, branche `delegation-v2-01`, tête
de départ `cfdeb46`. Lu d'abord : le brief (`agregat-back-essai-13-11/.manager/briefs/delegation-v2-01.md`), le plan v2
(`agregat-back-chef/.manager/reports/delegation-conception-v2-18-11.md`), le rapport du sprint (parties A et B). Relu :
tout `git diff 48a2f4e..HEAD` (code, tests, docs). Fin de la relecture le 19/11/2026 à 01:17 (heure lue par `date`).

Aucun agent réel, aucun navigateur, aucune API sur un port fixe (tests sur `127.0.0.1:0`), aucun accès au port 19988,
aucun réseau, aucun secret lu, aucune commande refusée, aucune lecture de `~/Downloads/agregat-back`.

Conventions : **constaté** = lu dans le code ou observé par un test ; **hypothèse** = déduit, non vérifié.

## Angle principal : « rien d'existant ne change »

Méthode : chaque branchement ajouté dans `packages/orchestrator/index.js` et `apps/api/server.js` suivi pour une mission
qui ne lance aucune sous-mission ; puis, pour chaque doute, un test qui joue la même mission sur le code de la base
`48a2f4e` (extrait par `git archive`, comme le test 1 de la partie B) et sur le code relu.

Branchements relus, sans effet pour une mission qui ne délègue pas (constaté par lecture) : schéma `delegation` (absent :
rien), `create(…, family)` (tous les ajouts gardés par `family` ou `previous.estMere`), `activeSlots` (`famille` absent),
`cancel` (`cancelHeld` faux, puis même erreur ; `cascade` ne lit rien), `close` (aucune famille), observation des appels
(`familyObserve`, `familyOutcome` absents), Bilan (`bilanSection`, `failureSection` : chaîne vide, aucune lecture), vue
`GET /api/runs/:id` (`{}`), reprise (`delegation` recopié seulement s'il existe). Le `await synthesis(…)` de fin de boucle
ajoute quelques micro-tâches avant la sortie : aucune entrée-sortie ne peut s'y glisser (hypothèse sans effet
observable ; les comparaisons à la base passent).

### Constats confirmés et corrigés

**C1. Annulation arrivée après le dernier tour : `cancelled` au lieu de `completed` (gravité faible, corrigé).**
Trace : après la boucle des tours, `index.js` ajoutait `if (control.abort.signal.aborted) throw …` derrière
`await this.delegation.settle(…)`, pour **toute** mission. La base ne regardait pas l'abandon à cet endroit : une
annulation (ou un arrêt du serveur) arrivée pendant le dernier `await` de la boucle (une demande d'orientation encore en
vol, `control.ownerMessages.steering`) laissait la mission finir `completed` avec la réponse de l'agent ; le code relu la
finissait `cancelled` sans réponse, **même avec `AGENT_PLATFORM_DELEGATION=0`**. Test `R1` (annulation simulée au moment
exact où la boucle se ferme, jouée sur la base, sur le code sans réglage et avec le réglage `0`) : échouait (`cancelled`
contre `completed` de la base). Correction (une ligne) : `if (control.mere && control.abort.signal.aborted)` — seule une
mère a pu attendre là. Contrôle négatif : le test échouait avant, passe après.

**C2. Réglage `0` : le champ `delegation` forçait encore le mode agent (gravité faible, corrigé).**
Trace : `plan()` forçait `mode: 'agent'` et retirait `workflow` dès `delegation.accepted`, réglage ou non. Avec le
réglage de retrait, la case cochée changeait donc encore le parcours (un DAG devenait une mission d'agent sans outils de
délégation). Test `R2` : échouait (`agent` au lieu de `workflow`). Correction (un mot) : `v.delegation?.accepted &&
this.delegation.lent`. `docs/api-delegation.md` le dit (deux phrases).

**C3. Mémoire : la famille d'une mère finie n'était jamais oubliée (gravité faible, corrigé) — point ouvert « fuite
`forget()` ».** Constaté : `forget()` n'était appelé qu'au changement d'état d'une **fille** ; dans le cas ordinaire (la
mère finit après sa dernière fille, puisque `settle` l'attend), la famille restait dans `families` jusqu'à l'arrêt, et
`finals` et `briefs` (une entrée par fille) n'étaient jamais vidés. De plus `call()` (`this.family(id).closing`) et
`wait()` créaient une famille pour une mission qui ne faisait que lire (`mission_suivre`, `mission_attendre` sans fille).
Test `R3` : échouait (`families.size` 1 après la fin). Corrections dans `delegation.js` seulement : une famille écoute la
fin de sa mère et s'oublie alors (si aucune fille ne vit, sinon la dernière fille le fait comme avant) ; `forget` vide
aussi `finals` et `briefs` de ses filles (la base les garde : `doneOf` les relit, vérifié par le test) ; `call()` ne crée
plus de famille et refuse `mission_terminee` à une mère déjà finie (ce que garantissait jusque-là le drapeau `closing`
de la famille gardée) ; `wait()` ne crée la famille que s'il attend vraiment.

Commit `94698eb` : `index.js` (2 lignes), `delegation.js`, `docs/api-delegation.md`, `tests/review-delegation-v2-01.test.js`
(neuf). Diff relu en entier avant le commit.

### Les six vérifications demandées

1. **Réglage `AGENT_PLATFORM_DELEGATION=0` = base** : constaté par le test 1 de la partie B (relancé : consigne, serveurs
   `['platform']`, suite des événements, état, réponse, champs de la ligne identiques à la base, mission simple et mission
   avec question) ; complété par `R1` (annulation tardive, défaut C1 corrigé) et `R2` (champ de la requête, défaut C2
   corrigé). Par lecture : `servers()` rend `[]` avant tout événement, `call()` rend 403, `view()` `{}`, Bilan vide, la
   reprise ne recopie `delegation` que s'il existe. Non joué contre la base : une reprise (`POST /api/runs/:id/resume`)
   avec le réglage `0` (trace seulement).
2. **Mêmes textes et outils pour tous les agents** : constaté par recherche (`claude|codex|gemini|opencode`, `agent.id`,
   `plan.agent`) dans `delegation.js`, `delegation-rule.js`, `family-bilan.js`, `mission-gateway/server.js` et les lignes
   touchées d'`index.js` : aucun branchement sur l'identité ni le modèle de l'agent (seul `agents()` lit les modèles
   annoncés de **tous** les agents) ; test B « phrase du chef » (aucun nom d'agent dans les textes) et `chef-01 :763`
   (même texte pour tous les profils) relancés.
3. **Rien qui nomme career-ops dans le moteur** : constaté, un seul reste : `observe()` reconnaît l'outil `career_write`
   (`delegation.js`, gardé tel quel par 8.1). Le remplacer exige une déclaration dans le pack (`packs.js`,
   `skill-router.js`, `domain-packs/` interdits ici) ; la passerelle ne rapporte pas les fichiers de `career_write`
   (`mcp-gateway/server.js:90-92`), donc le retirer perdrait les fichiers des filles career-ops. **Non corrigé, noté.**
   Les lignes d'`index.js` qui citent `'career-ops'` sont celles de la base (exclusivité de l'espace), seulement gardées
   par `!family`.
4. **Accord, refus, enveloppe 6/3, `via`** : constatés par les tests B (voie 1, voie 2 sans carte, voie 3 accord et
   refus, extension par choix, `via` et refus des anciennes valeurs) et `chef-01` (enveloppe, file), relancés. Par
   lecture : la carte n'est posée qu'une fois par exécution (`consentAsked`), un refus est définitif pour l'exécution, et
   un accord par prompt après une carte posée est ignoré (les lancements attendent la carte).
5. **Tour de synthèse, minuteurs, reprise, annulation** : un seul tour (`familyTurn`), attente avec minuteurs suspendus,
   ligne « Synthèse finale non faite » (tests B) ; délai du tour ACP suspendu pendant `mission_attendre` (test A) ;
   redémarrage (`chef-01 :692` ; au démarrage le stockage met `interrupted` toute ligne non terminée, y compris une fille
   retenue jamais partie, `storage/index.js:60-62`) ; annulation de la mère pendant la carte (test B) et en cascade
   (`chef-01 :615`). **Carte en cours pendant que le chef travaille** : test `R4` (constat) — la mère passe
   `awaiting_owner` et le chef continue (son `mission_suivre` aboutit pendant la carte, avec `attend: 'accord'`). Constaté
   par lecture d'`openNext` : pendant ce temps ses minuteurs sont suspendus (silence, outil figé, délai de mission) alors
   que l'agent travaille, et la mère ne compte plus parmi les trois places (`activeSlots` saute `awaiting_owner`) ni
   comme agent actif non en attente (`activity()`). Même chose qu'`askExtension` déjà dans chef-01. **Non corrigé** : le
   changer touche la file de questions commune (`index.js`, code sensible) ; à décider (voir plus bas).
6. **Points ouverts du rapport** :
   - *Refus donné dans la requête, sans ligne de Bilan* : **pas un défaut**. Le plan (3.2) ne prévoit la ligne
     « Sous-agents proposés par l'agent, refusés » que pour le refus sur la carte ; avec un refus déjà dans la requête,
     `launch` rend `refus_proprietaire` avant tout effet (rien créé, rien écrit). À décider si le propriétaire veut la ligne.
   - *Sous-mission annulée par le refus restée dans `family`* : **pas un défaut**. La vue montre l'état réel
     (`cancelled`, erreur « Sous-agents refusés par le propriétaire ») ; le Bilan la remplace par la ligne de refus.
     Constaté au passage : elle compte dans `famille.lancees` et dans le total de l'enveloppe (sans effet après un refus,
     qui clôt les lancements ; après une carte restée sans réponse, la fille annulée compte dans le total).
   - *Fuite `forget()`* : **défaut, corrigé** (C3).
   - *Événement d'accord écrit au premier lancement et non à la création* : **pas un défaut**. Écart voulu à 8.1 ; la
     décision 6 du brief (« aucun événement tant qu'aucune sous-mission n'est lancée ») prime ; testé (B, règle d'or).
   - *`accepted: false` lu comme refus* : **pas un défaut prouvé**. Le plan ne donne aucun sens à `accepted: false` dans
     la requête ; dans chef-01 il voulait dire « mission seule » ; le contrat dit au front de ne pas envoyer le champ
     quand la case n'est pas cochée. Risque : un client qui enverrait `accepted: false` pour une case non cochée
     supprimerait la voie 3 et la phrase dirait au chef que le propriétaire a refusé, ce qu'il n'a pas fait. **À décider**
     (piste : ne lire comme refus que `{ accepted: false, via: 'carte' }`, valeur écrite par la plateforme et gardée par
     la reprise).
   - *Membre d'une famille* (`member()`, exception d'exclusivité de l'espace privé) : **identique à la base** pour une
     mission qui ne délègue pas (`member` faux, aucune lecture de la famille). Écart mineur, non corrigé (cas de mère) :
     une mère **reprise** (`estMere` recopié) sans fille vivante reste « membre » ; sa question en prose n'est alors pas
     close par une nouvelle mission privée, qui est refusée (« Une seule mission privée à la fois »).

### Autres constats, non corrigés (hors de l'angle, ou à décider)
- **Mère en échec (non annulée)** : `cascade` n'est appelée que par `cancel()` ; une mère qui échoue (agent arrêté,
  silence, délai) laisse ses filles vivantes travailler seules ; leurs résultats n'atteignent aucun chef, le Bilan de la
  mère les dit « encore en cours » (constaté par lecture d'`index.js`, chemin d'échec). À décider.
- **`cascade` d'une mère reprise** : ne lit que ses propres filles (`store.children(id)`, pas la chaîne) et seulement si
  elle a lancé dans cette exécution ; des filles vivantes d'une exécution précédente (possible après le cas précédent)
  ne sont pas annulées avec elle (lecture).
- **Sous-mission reprise par le propriétaire** (`POST /api/runs/:id/resume`) : la nouvelle exécution n'a plus de
  `famille` (non recopiée), devient une mission ordinaire et reçoit les outils (lecture de `create` et de la reprise
  d'`apps/api/server.js`). À décider (le plan reporte la reprise de famille).
- **Lectures de plus sans effet** : `activeSlots` lit `famille` de chaque exécution active (`store.get`, `index.js`) ;
  `member()` lit la ligne dans le chemin d'exclusivité de l'espace privé. Aucun changement de comportement ; la règle
  « aucune lecture de plus » vaut au sens strict pour `delegation.js` et `family-bilan.js` (test B), pas pour ces deux
  lignes d'`index.js`.
- **Commentaires périmés** : en-têtes de `mission-gateway/server.js` (« lent … to a mission whose owner accepted … and to
  no other ») et de `delegation.js`, commentaire du constructeur dans `index.js` (« families of missions whose owner
  accepted the workflow mode »). Cosmétique, non touché.
- Après le tour de synthèse impossible, `resumeTimers` réarme la garde de silence entre deux tours d'une mère (lecture) ;
  sans effet constaté (la fin de mission la coupe), noté seulement.

## Résultats des tests (un fichier à la fois, `AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier absent, après `94698eb`)
| Fichier | Résultat |
|---|---|
| `tests/review-delegation-v2-01.test.js` (neuf) | 4 passés, 0 échoué (avant correction : 3 échecs, R1 R2 R3) |
| `tests/delegation-v2-01-a.test.js` | 10 passés, 0 échoué |
| `tests/delegation-v2-01-b.test.js` | 12 passés, 0 échoué (comparaison à la base jouée, non sautée) |
| `tests/chef-01.test.js` | 16 passés, 0 échoué |
| `tests/generique-01.test.js` | 15 passés, 0 échoué |
| `tests/review-generique-01.test.js` | 5 passés, 0 échoué |
| `tests/fix-resume.test.js` | 28 passés, 0 échoué |
| `tests/reprise-memoire.test.js` | 8 passés, 0 échoué |
| `tests/career-integration.test.js` | 50 passés, 0 échoué |
| `tests/career-failure.test.js` | 11 passés, 0 échoué |
| `tests/elicitation.test.js` | 26 passés, 0 échoué |
| `tests/message-proprietaire.test.js` | 25 passés, 0 échoué |
| `tests/platform.test.js` | 11 passés, 0 échoué |
| `tests/owner-mode.test.js` | 14 passés, 0 échoué |
| `tests/workflow-resume.test.js` | 8 passés, 0 échoué |
| `npm run check` | « Syntaxe JavaScript valide. » |
| `npx prettier --check` (fichiers touchés) | conformes |

Non lancés (consigne) : `npm test` complet, `npm run format:check` complet, tout test avec navigateur ou relais.

## À vérifier par le manager en essai réel (non vérifiable ici)
- Essai 1 (a) du plan, avec Claude, Codex, Gemini et OpenCode : une mission simple s'ouvre avec les deux serveurs MCP et
  donne le même résultat qu'aujourd'hui ; puis la même avec `AGENT_PLATFORM_DELEGATION=0`.
- Carte d'accord pendant que le chef travaille (R4 le montre avec le faux agent) : comportement d'un vrai CLI dont la
  mère est `awaiting_owner`, minuteurs suspendus, pendant qu'il travaille ; et place libérée parmi les trois.
- Délai réel d'un appel d'outil MCP par CLI (50 s d'attente plus la réponse) ; session gardée vivante pendant l'attente
  du tour de synthèse.
- Mémoire après plusieurs missions qui délèguent sur une API qui reste en service (C3 corrigé, mesuré seulement en test).

## À décider par le propriétaire (ou le manager)
- `accepted: false` dans la requête : refus (choix du sprint) ou « pas encore d'accord » (voie 3) ?
- Pendant la carte d'accord, faut-il garder les minuteurs du chef qui travaille et sa place parmi les trois (changement
  de la file de questions commune, code sensible) ?
- Une mère qui **échoue** doit-elle annuler ses filles comme une mère annulée ?
- Une sous-mission reprise à part : mission ordinaire avec outils (aujourd'hui) ou sous-mission ?
- Une ligne de Bilan quand le chef tente de lancer malgré un refus donné dans la requête ?
- `career_write` dans `observe()` : déclarer l'outil d'écriture dans le pack (sprint qui peut toucher `packs.js` et le
  manifeste) ?

## Commits
- `94698eb` [review-delegation-v2-01] corrections C1, C2, C3, tests `R1` à `R4`, deux phrases de `docs/api-delegation.md`.
- Ce rapport : commit suivant.
