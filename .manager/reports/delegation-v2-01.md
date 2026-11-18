# Rapport `delegation-v2-01` — la délégation, étape 1 du plan v2 (back seul)

Brief : `~/Downloads/agregat-back-essai-13-11/.manager/briefs/delegation-v2-01.md`. Spécification : plan v2
(`~/Downloads/agregat-back-chef/.manager/reports/delegation-conception-v2-18-11.md`), besoin
(`.../briefs/delegation-v2-besoin.md`), rapport du sprint suspendu (`.../reports/chef-01.md`), lus en entier avant
toute ligne de code. Arbre `~/Downloads/agregat-back-delegation`, branche `delegation-v2-01`, tête de départ `74688e1`.

## Partie A — « contrat et résultats »

Session de code Opus, démarrée le 19/11/2026 à 00:02 (heure lue par `date`), un seul écrivain dans l'arbre. Aucun agent
réel, aucun navigateur, aucune API sur un port fixe (les tests ouvrent l'API sur `127.0.0.1:0`), aucun accès au port
19988, aucun réseau, aucun secret lu, aucune commande refusée.

Conventions : **constaté** = lu dans le code ou observé par un test ; **hypothèse** = déduit, non vérifié.

### Journal
- 00:02 : lecture des quatre documents, puis du code (`delegation.js`, `delegation-rule.js`, `family-bilan.js`,
  `mission-gateway/server.js`, branchements de `index.js` et `apps/api/server.js`, `storage/index.js`, tests et faux
  agent de chef-01). Base : `tests/chef-01.test.js` 17 sur 17.
- Écriture d'abord de `tests/delegation-v2-01-a.test.js` (10 tests) : 9 échecs sur le code de départ, chacun pour la
  cause attendue (lectures de la délégation pour une mission ordinaire, réponse consommée, 600 au lieu de 50, fichiers
  absents de `child_done`, fichiers privés perdus, `incertains` absent, modèles absents, compteur absent, refus
  « boucle »). Le 10e (délai du tour ACP) passait déjà : la pause existait, le test la couvre désormais (contrôle négatif
  plus bas).
- Corrections les plus étroites, puis `chef-01.test.js` adapté (5 échecs attendus, tous prévus par 8.2), tests voisins,
  `npm run check`, Prettier, relecture du diff entier.
- 00:22 : commit `a72adcd` (code et tests). Rapport ensuite.

### Tableau 8.2, ligne par ligne (partie A)
| Ligne de 8.2 | Fait ? | Comment (fichier, fonction) |
|---|---|---|
| `delegation.js` `reported`, `wait` | **fait** | `reported` supprimé (constructeur, `forget`). `wait` rend à chaque appel l'état complet des filles demandées (ou de toutes) : `terminees` = toutes celles finies, `enCours` = les autres ; rien n'est consommé. Sans `toutes`, l'appel rend la main dès qu'une des filles **en cours au début de l'appel** finit ; si aucune ne tourne, il rend tout de suite. |
| `delegation.js` `finals`, `ended`, `outcome` (fichiers) | **fait** | `ended` met `fichiers` dans l'événement `child_done` ; `doneOf(child)` relit l'événement (et `finals` n'est plus qu'un cache) ; `outcome` lit `doneOf`. **Écart voulu** : pour une fille d'un espace privé (`run.workspace`), les noms de fichiers ne vont pas dans la base mais dans `relay/runs/<id>-fichiers.json` de l'espace, relus par `engine.privateRunFile` — même règle que `observedFilesFor` (constaté `index.js`, `observedFilesFor`) ; `child_done` n'a alors pas de champ `fichiers`. |
| `delegation.js` `outcome` (envois) | **fait** | `sendsGiven(child)` : compteurs `approuves`, `parAccord`, `refuses`, `incertains` (nouveau, compté dans `ended` comme la ligne d'envoi du Bilan : incertains + sans issue connue + écritures bloquées) et `ligne` = la ligne « Envoi par la plateforme : … » du Bilan de la fille, mot pour mot. Sans cette ligne (fille interrompue, en échec ou annulée : le chemin d'échec n'écrit pas de ligne d'envoi, constaté), `nonVerifies: { note: "non vérifié ; ne pas répéter avant vérification", evenements }` avec ses cartes d'envoi (`permission` marquées par le stockage, issue approuvée / refusée / sans réponse) et ses `send_auto` (`sendEvents`). |
| `delegation-rule.js` `MAX_WAIT_SECONDS` et description de `mission_attendre` | **fait** | `MAX_WAIT_SECONDS = 50` ; `waitSeconds(asked)` borne toute valeur ; le schéma accepte tout entier ≥ 1 (plus de refus au-delà) ; `wait` et la passerelle `mission-gateway/server.js` (son propre délai `fetch`) appliquent `waitSeconds`. Description réécrite : relisible, 50 s au plus par appel, rappeler pour attendre plus. |
| `index.js` tour de rappel et `delegation.reminder` | non (partie B) | Remplacement par le tour de synthèse : partie B. Seul ajout de la partie A : `reminder` ne lit plus rien pour une mission qui n'a rien lancé. |
| `index.js` `activeSlots` (commentaire) | **fait** | Commentaire corrigé (les filles ne prennent aucune des trois places, l'enveloppe les borne, `Delegation.activity()` les compte) ; même correction dans le commentaire de `create`. Code inchangé. |
| `delegation.js` `view`, `follow` (compteur) | **fait** | `activity()` : `agents` = exécutions en cours sur la machine (`engine.active`), `enAttenteDuProprietaire` = celles en `awaiting_owner` ou `waiting_permission`, `texte` = « N agent(s) en activité (missions et sous-agents), dont K en attente du propriétaire ». Dans `mission_suivre` : champ `activite`. Dans `GET /api/runs/:id` d'une mère : `activity: { agents, awaitingOwner }`. |
| `delegation.js` `agents()` (modèles) | **fait** | Chaque agent porte `modeles: [{ id, nom }]` et `modeleParDefaut`, lus dans les sondes (`loadProbes`), même source que le contrôle « Modèle non annoncé » de `plan()`. La détection reste en cache 60 s ; les sondes sont relues à chaque appel. |
| `delegation.js` `accepted`, `servers`, `promptParts` | non (partie B) | — |
| `delegation.js` `askExtension` | non (partie B) | — |
| `delegation-rule.js` `chiefRule`, `DAUGHTER_RULE`, `DEFAULT_ENVELOPE`, schéma de `mission_lancer` | non (partie B) | Seule la description de `mission_lancer` dit maintenant que `mission_suivre` donne les modèles annoncés ; descriptions de `mission_suivre` (modèles, compteur) et `mission_annuler` (plus de « descendance ») corrigées. |
| `index.js` schéma `delegation` (`via`) | non (partie B) | — |
| `index.js` mode forcé | non (partie B) | — |
| `index.js`, appels de `children()` | **fait** | `Delegation.hasFamily(run)` sans aucune lecture : `estMere` sur la ligne (écrit au premier `mission_lancer`, recopié par `create` à la reprise : une ligne dans `index.js`) ou `mere` sur le contrôle de l'exécution. Portes ajoutées à `settle`, `reminder`, `bilanSection`, `failureSection` (les deux appels d'`index.js` passent `run` au lieu de `run.id`), `cascade` (appelée par `cancel`) et `view`. `member` (exception d'exclusivité de l'espace privé) devient « fille, ou mission qui a lancé une fille » au lieu de « délégation acceptée ». |
| `docs/api-delegation.md`, note du 18/11 | non (partie B) | Le brief les met en partie B. Changements de contrat de la partie A à y reporter : liste plus bas. |
| `tests/chef-01.test.js` | **fait pour la partie A** | `:370` (relecture sans consommation : le second `mission_attendre` rend la même fille), `:309` (3 rendues au lieu de 2), `:210` (forme des `envois`, `famille` sans `profondeur`), `:656` (plus de `descendants`), commentaire du plafond ; `:521` (boucle) **retiré**. `:138` et `:967` : partie B. Tests ajoutés (fichier neuf) : abandon de l'appel puis relecture, plafond de 50 s, délai du tour ACP suspendu, fichiers après redémarrage (et espace privé), compteur d'agents, fille en attente du propriétaire qui laisse sa place, ligne d'envoi et envois non vérifiés, modèles annoncés, un seul niveau, mission qui ne délègue pas. Carte d'accord et voie 2 : partie B. |

Retraits de 8.3 relevant de la partie A : `famille.profondeur`, `descendants()`, `ancestors()`, refus `boucle` et
`sameWords` **retirés** ; `reported` **retiré** ; « une famille = une place » **remplacé** (commentaires et compteur).
`famille.racine` est gardé (vaut toujours la mère : un seul niveau).

Hors tableau, au passage : `launch` donnait un titre neutre seulement si `mother.workspace === 'career-ops'` ; devient
`!!mother.workspace` (même comportement : le schéma n'admet que cette valeur ; le moteur ne nomme plus le Skill ici).

### Preuve qu'une mission qui ne délègue pas ne change pas (test 1 du fichier neuf)
Toutes les lectures de la base (`get`, `children`, `events`, `list`) sont espionnées avec leur pile d'appel : pour une
mission sans `delegation` terminée, une en échec, une annulée et un `GET /api/runs/:id`, **aucune lecture** ne vient de
`delegation.js` ou `family-bilan.js`, aucun `children()`, aucun événement `delegation_*`, `child_*`, `family_*`, pas de
champ `estMere`, ni `family` ni `activity` dans la vue. Constaté : avant correction, ce test échouait (lectures de
`reminder`, `bilanSection`, `cascade`). Avec `delegation` acceptée mais rien lancé : aucun `children()`, aucun événement
`child_*` / `family_*`, pas de section « Sous-missions » ; en revanche `delegation_accepted` et la lecture de
`promptParts` restent (partie B).

### Contrôles négatifs (modification temporaire, fichier restauré, vérifié par `git diff --stat`)
- Pause du délai du tour ACP retirée de `wait` : le test « délai du tour ACP » échoue (la mère passe `failed` à 2 s au
  lieu de rester `running`). Remis.
- Ligne `estMere` retirée de `create` : le test « fichiers … après un redémarrage » échoue (ligne reprise sans
  `estMere`). Remise.

### Résultats des tests (lancés un fichier à la fois, `AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier absent)
| Fichier | Résultat |
|---|---|
| `tests/delegation-v2-01-a.test.js` (neuf) | 10 passés, 0 échoué |
| `tests/chef-01.test.js` (adapté) | 16 passés, 0 échoué (17 avant : le test « boucle » est retiré) |
| `tests/fix-resume.test.js` | 28 / 0 |
| `tests/reprise-memoire.test.js` | 8 / 0 |
| `tests/reprise-memoire-relecture.test.js` | 8 / 0 |
| `tests/career-failure.test.js` | 11 / 0 |
| `tests/career-pipeline-flow.test.js` | 7 / 0 |
| `tests/career-integration.test.js` | 50 / 0 |
| `tests/generique-01.test.js` | 15 / 0 |
| `tests/review-generique-01.test.js` | 5 / 0 |
| `tests/elicitation.test.js` | 26 / 0 |
| `tests/arret-borne.test.js` | 1 / 0 |
| `tests/message-proprietaire.test.js` | 25 / 0 |
| `tests/bilan-questions.test.js` | 2 / 0 |
| `tests/platform.test.js` | 11 / 0 |
| `npm run check` | « Syntaxe JavaScript valide. » |
| `npx prettier --check` (6 fichiers touchés) | conformes |

Non lancés (consigne) : `npm test` complet, `npm run format:check` complet, tout test qui démarre un navigateur ou
touche au relais.

### Contrat changé par la partie A (à documenter par la partie B dans `docs/api-delegation.md`)
- `mission_attendre` : plus de « rendue une fois » ; `terminees` = toutes les filles demandées finies ; `delaiSecondes`
  accepté sans maximum, attente réelle `min(delaiSecondes, 50)`.
- `terminees[]` / `mission_suivre { details }` : `envois = { approuves, parAccord, refuses, incertains, ligne,
  nonVerifies? }` ; `fichiers` relus après redémarrage.
- `mission_suivre` : `agents[].modeles`, `agents[].modeleParDefaut`, `activite { agents, enAttenteDuProprietaire, texte }`.
- `mission_annuler` : plus de champ `descendants`. Erreur `boucle` supprimée.
- Ligne d'une fille : `famille = { racine, mere, titre }` (plus de `profondeur`). Ligne d'une mère : `estMere: true`
  dès son premier lancement (visible dans `GET /api/runs/:id`), recopié à la reprise.
- Événement `child_done` : `envois.incertains`, et `fichiers` (sauf espace privé).
- `GET /api/runs/:id` d'une mère qui a des filles : `activity: { agents, awaitingOwner }` à côté de `family`.

### Non vérifié
- Aucun essai réel (Claude, Codex, Gemini, OpenCode) : au manager.
- Hypothèse : le délai réel d'appel d'outil MCP de chaque CLI tient 50 s plus le temps de réponse ; non mesuré.
- Hypothèse : `activity()` compte une exécution par entrée de `engine.active` ; un workflow DAG dont plusieurs étapes
  tournent à la fois compte pour un ; une mère qui attend ses filles (`settle`) compte pour un agent, que son
  processus soit encore vivant ou non (non vérifié).
- Taille des réponses : `mission_attendre` rend désormais à chaque appel toutes les filles finies (jusqu'à 50 000
  caractères de réponse chacune) ; poids réel pour un agent non mesuré.
- Les cartes d'envoi d'une fille interrompue sont reconnues par le titre que le stockage écrit
  (« Envoi : aperçu privé… ») : couplage de texte, couvert par le test qui passe par `store.event` réel.
- Les écritures réseau accordées en mode propriétaire (`permission_auto`, hors envoi final) ne sont pas listées dans
  `nonVerifies`.

### Constaté, non corrigé (hors partie A ou à décider)
- `observe()` nomme encore l'outil `career_write` (conservé tel quel par 8.1) : seul nom propre à un Skill restant dans
  le moteur de la délégation ; le remplacer demande une déclaration dans le pack (`packs.js`, `domain-packs/` interdits
  ici).
- Constaté par lecture : `forget()` n'est appelé que sur un changement d'état d'une fille ; une mère qui finit après sa
  dernière fille (cas ordinaire) laisse sa famille dans `families` jusqu'à l'arrêt (petite fuite mémoire, déjà dans
  chef-01).
- `promptParts` lit la ligne de la mère pour l'enveloppe de toute mission acceptée ; avec les outils prêtés partout
  (partie B), ce sera une lecture par mission menée par un agent : à porter par la partie B.

### À décider
- Le propriétaire ou le manager : garder les noms de fichiers d'une fille de l'espace privé dans l'espace (choix fait
  ici, comme `observedFilesFor`) plutôt que dans l'événement `child_done` comme le dit le plan.
- Le nom du champ `estMere` sur la ligne d'une mère.
- Sémantique de `mission_attendre` sans `toutes` : « dès qu'une des filles en cours au début de l'appel finit » (choix
  fait ici, sans état gardé entre deux appels).

### Commits
- `a72adcd` [delegation-v2-01] Partie A : code (`delegation.js`, `delegation-rule.js`, `index.js`,
  `mission-gateway/server.js`) et tests (`tests/delegation-v2-01-a.test.js`, `tests/chef-01.test.js`).
- Ce rapport : commit suivant.
