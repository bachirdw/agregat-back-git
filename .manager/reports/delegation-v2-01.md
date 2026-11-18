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

## Partie B — « activation, accord, synthèse »

Session de code Opus, démarrée le 19/11/2026 à 00:26 (heure lue par `date`), seul écrivain dans l'arbre, tête de
départ `fdd2272`. Aucun agent réel, aucun navigateur, aucune API sur un port fixe (les tests ouvrent l'API sur
`127.0.0.1:0`), aucun accès au port 19988, aucun réseau, aucun secret lu, aucune commande refusée. Aucune lecture de
`~/Downloads/agregat-back`.

Conventions : **constaté** = lu dans le code ou observé par un test ; **hypothèse** = déduit, non vérifié.

### Journal
- 00:26 : lecture du brief, du plan v2, du besoin, de la section « Partie A » et de `a72adcd`, puis du code
  (`delegation.js`, `delegation-rule.js`, `family-bilan.js`, branchements d'`index.js`, file de questions,
  `questions.js`, reprise d'`apps/api/server.js`, `agent-runtime` `continueSession`, faux agent).
- 00:35 : textes d'abord (`delegation-rule.js`), puis le faux agent, puis `tests/delegation-v2-01-b.test.js`
  (11 tests). Lancé sur le code de la partie A (règles d'origine remises le temps du lancement, puis restaurées) :
  **11 échecs**, chacun pour la cause attendue (second serveur absent, faux agent sans rôle de chef, enveloppe 10,
  valeurs `via` refusées, carte absente, refus absent, extension en texte libre, rappel au lieu de synthèse). La
  comparaison à la base passait déjà sur sa première moitié (réglage retiré = base), comme attendu sur la partie A.
- Code (`delegation.js`, `family-bilan.js`, `index.js`), puis `chef-01.test.js` adapté (5 échecs attendus : `:138`,
  `:210` enveloppe 6, `:484` extension par choix, `:763` phrase, `:967` synthèse), contrôles négatifs, docs, Prettier,
  relecture du diff entier, un 12e test (annulation pendant la carte).

### Tableau 8.2, lignes de la partie B
| Ligne de 8.2 | Fait ? | Comment (fichier, fonction) |
|---|---|---|
| `index.js` tour de rappel et `delegation.reminder` | **fait** | `reminder` et `familyReminder` supprimés. `Delegation.synthesis(motherId, control, runtime)` : sans `control.mere`, rien (aucune lecture) ; sinon, si des filles vivent à la fin du tour du chef et que la session continue, attente de leur fin (`waitLiving` : événement `family_waiting`, minuteurs suspendus, même attente que `settle`), puis rend `{ familyResults: { nature, terminees }, instructions: SYNTHESIS_TURN }` ; `index.js` remplace le bloc du rappel par **un** tour `turnKind: 'family_results'` (même branchement, mêmes lignes). Session fermée (ou fermée pendant l'attente) : rien, et `missed()` note les titres ; `settle` note aussi les filles encore vivantes quand la mission se clôt (sortie par question refusée, filles lancées pendant le tour de synthèse). `bilanSection` écrit alors « Synthèse finale non faite : la réponse du chef a été écrite avant la fin de « … » ; leurs résultats ne lui ont pas été remis. » |
| `delegation.js` `accepted`, `servers`, `promptParts` | **fait** | `accepted()` supprimé. `servers(run)` : prêté si `this.lent` (réglage) et `!run.famille` ; appelé seulement à l'ouverture d'une session d'agent (`execute`, mode agent) ; jamais par le DAG (`workflow-run.js:264` ouvre sa session avec le seul serveur de capacités, constaté par lecture). Pont absent : l'événement `delegation_unavailable` n'est plus écrit que pour une mission dont la requête porte l'accord. `promptParts(run, servers)` : phrase du chef seulement si `relay-missions` est dans la liste prêtée, lue sur `run.delegation` tel que créé (**plus aucune lecture**, reste laissé par la partie A). Accord : `launch` (voir lignes suivantes). |
| `delegation.js` `askExtension` (et accord par carte) | **fait** | `choiceQuestion(message, choices)` : question `form` (`publicQuestion`) à un champ `choix` avec `oneOf`. Extension : `choix: 'oui' \| 'non'` ; un texte libre est refusé par la validation de la file (testé). Carte d'accord : `askConsent(mother, control)`, une fois par mission (`family.consentAsked`), dans la file de la mère (`enqueueQuestion`). Réponse `autoriser` → `accept(id, 'carte')` ; `continuer_seul` ou `decline` → `delegation = { accepted: false, via: 'carte', total, parallel }`, `delegation_declined`, filles retenues annulées par `cancelHeld` (erreur `REFUSED_CHILD`) ; `cancel` (fin de mission, délai configuré) → filles retenues annulées, rien décidé. |
| `delegation-rule.js` `chiefRule`, `DAUGHTER_RULE`, `DEFAULT_ENVELOPE`, schéma de `mission_lancer` | **fait** | `chiefRule(delegation)` : texte de la section 2 du plan, une seule phrase, fin selon l'accord (autorisé avec N et M / à demander avec `demandeDuProprietaire` / refusé). Ajout voulu par le manager : « (par exemple plusieurs sources indépendantes à consulter) » après « des parties indépendantes qui peuvent avancer en même temps ». `DAUGHTER_RULE` : texte de la section 6, sans fichier ni script d'un Skill. `DEFAULT_ENVELOPE = { total: 6, parallel: 3 }`. `mission_lancer` : champ `demandeDuProprietaire` (booléen) et description (`attend_accord`, `refus_proprietaire`). Textes du propriétaire au même endroit : `consentMessage` (3.4 tel quel), `CONSENT_CHOICES`, `promptNotice`, `extensionMessage`, `EXTENSION_CHOICES`, `consentLine`, `REFUSED_MESSAGE`, `REFUSED_CHILD`, `synthesisMissed`, `SYNTHESIS_TURN`. |
| `index.js` schéma `delegation` (`via`) | **fait** | `z.enum(['bouton', 'prompt', 'carte', 'api'])`, défaut `api` ; `case`, `mot`, `proposition` refusés (testé). |
| `index.js` mode forcé | **fait (code inchangé)** | La condition était déjà `v.delegation?.accepted` (accord porté par la requête) : rien ne la déclenche du seul fait des outils prêtés. Commentaire précisé ; testé : `mode: 'workflow'` sans champ, ou avec `accepted: false`, reste un DAG ; avec `accepted: true`, mode agent. |
| `docs/api-delegation.md` ; note du 18/11 de `docs/architecture-cible.md` | **fait** | Contrat réécrit (outils prêtés, réglage, trois voies, carte, schéma, outils, erreurs, synthèse, événements, Bilan, textes, famille) avec les changements de contrat de la partie A (relecture, 50 s, `envois` complets, modèles, compteur, `estMere`, plus de `profondeur` ni `descendants` ni `boucle`). Note du 18/11 réécrite (elle disait « une famille tient une seule des trois places »). Seule cette note est touchée dans `architecture-cible.md` (le fichier n'était déjà pas conforme à Prettier hors de la note, à la base comme à `fdd2272` : rien reformaté ailleurs). |
| `tests/chef-01.test.js` | **fait pour la partie B** | `:138` réécrit (outils et phrase présents, rien d'autre tant que rien n'est lancé ; refus et accord donnés à la requête : même consigne, seule la fin de la phrase change, aucun événement) ; `:967` réécrit (attente puis un seul tour de synthèse avec les résultats joints) ; `:210` enveloppe 6 ; `:484` extension par choix ; `:763` `chiefRule(ACCEPTED(…))` et `SYNTHESIS_TURN`. Le réglage de retrait = prompt de la base : `tests/delegation-v2-01-b.test.js`. |

### Sections 2, 3, 4 et 6 du plan, ce qui relève de B
- **3.1 voie 1 (bouton)** : fait. Rien n'est écrit à la création (`Delegation.created` supprimé, appel retiré
  d'`index.js`) ; au premier `mission_lancer` de l'exécution, `acceptedEvent` écrit `delegation_accepted { via, total,
  parallel, acceptedAt }`. Aucune question tant que l'enveloppe suffit.
- **3.1 voie 2 (prompt)** : fait. `demandeDuProprietaire: true` sans accord → `accept(id, 'prompt', promptNotice(…))` :
  `delegation` écrite sur la mission, `delegation_accepted { via: 'prompt', …, message }` dont `message` est la ligne du
  fil (texte du plan) ; pas de carte ; Bilan « demande écrite dans le prompt, selon l'agent ». Ignoré si la carte est
  déjà posée (les lancements suivants attendent la carte).
- **3.2 voie 3 (carte)** : fait. Fille créée par `create()` et retenue (`family.held`) ; `pump` ne démarre rien tant
  que `delegation.accepted !== true` ; `mission_lancer` rend `etat: 'attend_accord'`, `mission_suivre` `attend:
  'accord'` (`heldState`). Accord, refus, réponse par choix : ligne `askExtension` ci-dessus. Annuler la mère pendant la
  carte annule la fille retenue et ferme la carte (testé).
- **3.3 outils prêtés à toutes les missions, réglage de retrait** : fait. `AGENT_PLATFORM_DELEGATION` lu dans le
  constructeur de `Delegation` (créé au démarrage de l'orchestrateur), `'0'` → `this.lent = false` : ni serveur, ni
  phrase, et la route interne rend 403. Serveur de capacités toujours en tête.
- **3.4 textes** : fait, tels quels (`consentMessage`, `promptNotice`), aucun pourcentage ni promesse.
- **4 contrat** : `demandeDuProprietaire`, `attend_accord`, `refus_proprietaire` ajoutés ; enveloppe 6 et 3 ; le reste
  par la partie A.
- **6** : phrase de la fille (fait) ; l'accord est gardé par la reprise (code existant d'`apps/api/server.js`, qui
  recopie `accepted`, `via`, `total`, `parallel`, `acceptedAt` : les nouvelles valeurs de `via` passent le schéma, un
  refus `{ accepted: false, via: 'carte' }` aussi) ; **`apps/api/server.js` n'a pas eu à changer**.
- **2 (phrase du chef)** : fait ; elle dit de ne déléguer que si c'est vraiment utile, cite les cas où seul est mieux,
  dit que rien n'oblige ; sans nom d'agent (testé, et `:763` la compare pour tous les profils).

### Écarts au plan, voulus
- **8.1 garde `created` (événements d'accord à la création)** : retiré, parce que la décision 6 du brief et la consigne
  du manager exigent « aucun événement tant qu'aucune sous-mission n'est lancée ». L'événement est écrit au premier
  lancement (voies 1 et 2) ou à l'accord (voie 3).
- **`accepted: false` dans la requête** : lu comme un refus déjà donné (outils prêtés quand même, phrase « le
  propriétaire a refusé… », `refus_proprietaire`, aucune question, aucun événement). Le contrat dit au front de **ne
  pas envoyer le champ** quand la case n'est pas cochée (sinon la voie 3 ne serait jamais proposée).
- **Faux agent** (`tests/fixtures/chef-agent.js`) : il ne joue le chef que s'il a des étapes (`CHEF_AGENT.steps`) ;
  sans étapes, il répond comme une mission ordinaire bien que le serveur lui soit prêté. Sans ce changement, toute
  mission de test serait devenue un chef.

### Preuve du réglage de retrait (test 1 de `tests/delegation-v2-01-b.test.js`)
Le test extrait la base par `git archive 48a2f4e apps packages domain-packs package.json | tar -x` dans un dossier
temporaire (lien vers `node_modules` de l'arbre : `package.json` et `package-lock.json` sont inchangés depuis la base,
constaté par `git diff --stat 48a2f4e -- package.json package-lock.json`, vide), puis joue **les mêmes missions** sur la
base, sur le code avec `AGENT_PLATFORM_DELEGATION=0`, et sur le code sans réglage : une mission simple et une mission
qui pose une question au propriétaire (pack `core`, même faux agent). Constaté :
- réglage `0` = base : prompt reçu par l'agent (chaque champ, chaque mot), serveurs `['platform']`, suite complète des
  types d'événements, état, réponse, champs de la ligne : **identiques** (`deepEqual`) ;
- sans réglage : seuls changent la phrase ajoutée en fin de consignes et le second serveur ; événements, état, réponse
  et champs identiques à la base.
Si le commit `48a2f4e` n'est pas dans le dépôt, le test est sauté (dit dans son nom de saut).

### Preuve de la règle d'or (test 2)
Faux chef qui a les outils et n'en appelle aucun, sans champ `delegation` puis avec le bouton coché : un seul tour,
aucun événement `delegation_*` / `child_*` / `family_*`, aucune question, pas d'`estMere`, rien au Bilan, et **aucune
lecture de la base** venue de `delegation.js` ou `family-bilan.js` (lectures espionnées par la pile d'appel).

### Contrôles négatifs (modification temporaire, fichier restauré, vérifié par `cmp`)
- Outils prêtés aussi aux sous-missions : 4 tests échouent (voie 2, voie 3, les deux synthèses).
- Garde d'accord retirée de `pump` : les deux tests de la carte échouent.
- Réglage ignoré : le test de la base échoue.
- `promptParts` relisant la ligne de la mère : le test de la règle d'or échoue (« lecture de la base par la délégation »).

### Résultats des tests (un fichier à la fois, `AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier absent)
| Fichier | Résultat |
|---|---|
| `tests/delegation-v2-01-b.test.js` (neuf) | 12 passés, 0 échoué |
| `tests/delegation-v2-01-a.test.js` | 10 passés, 0 échoué |
| `tests/chef-01.test.js` (adapté) | 16 passés, 0 échoué |
| `tests/generique-01.test.js` | 15 passés, 0 échoué |
| `tests/review-generique-01.test.js` | 5 passés, 0 échoué |
| `tests/fix-resume.test.js` | 28 passés, 0 échoué |
| `tests/reprise-memoire.test.js` | 8 passés, 0 échoué |
| `tests/reprise-memoire-relecture.test.js` | 8 passés, 0 échoué |
| `tests/career-integration.test.js` | 50 passés, 0 échoué |
| `tests/career-failure.test.js` | 11 passés, 0 échoué |
| `tests/career-pipeline-flow.test.js` | 7 passés, 0 échoué |
| `tests/elicitation.test.js` | 26 passés, 0 échoué |
| `tests/message-proprietaire.test.js` | 25 passés, 0 échoué |
| `tests/platform.test.js` | 11 passés, 0 échoué |
| `tests/arret-borne.test.js` | 1 passés, 0 échoué |
| `tests/bilan-questions.test.js` | 2 passés, 0 échoué |
| `tests/prompt-prime-18-11.test.js` | 3 passés, 0 échoué |
| `tests/review-prompt-prime-18-11.test.js` | 1 passés, 0 échoué |
| `tests/question-mal-formee.test.js` | 14 passés, 0 échoué |
| `tests/review-precision-18-11.test.js` | 6 passés, 0 échoué |
| `tests/consigne-fichiers-travail.test.js` | 2 passés, 0 échoué |
| `tests/lecture-18-11.test.js` | 11 passés, 0 échoué |
| `tests/memoire-fil.test.js` | 4 passés, 0 échoué |
| `tests/mission-pieces-jointes.test.js` | 3 passés, 0 échoué |
| `tests/owner-mode.test.js` | 14 passés, 0 échoué |
| `tests/career-sends.test.js` | 21 passés, 0 échoué |
| `tests/bilan-mixtes.test.js` | 3 passés, 0 échoué |
| `tests/skill-registry.test.js` | 22 passés, 0 échoué |
| `tests/question-finale.test.js` | 8 passés, 0 échoué |
| `tests/review-questions-18-11.test.js` | 14 passés, 0 échoué |
| `tests/resume-probe.test.js` | 3 passés, 0 échoué |
| `tests/workflow-resume.test.js` | 8 passés, 0 échoué |

`npm run check` : « Syntaxe JavaScript valide. » `npx prettier --check` sur les fichiers touchés : conformes, sauf
`docs/architecture-cible.md`, non conforme avant ce sprint (tableaux hors de la note ; la note elle-même est conforme).

Non lancés (consigne) : `npm test` complet, `npm run format:check` complet, tout test qui démarre un navigateur ou touche
au relais (`owner-browser`, `browser-*`, `captures-*`…) ; `doubt-tools` non lancé (il ouvre la passerelle avec
`RELAY_BROWSER=isolated` : prudence).

### Non vérifié
- Aucun essai réel (Claude, Codex, Gemini, OpenCode) : au manager. En particulier, hypothèse : chaque CLI ouvre sans
  dommage une session avec deux serveurs MCP (plan 10, essai 1 (a)) ; c'est désormais **toutes** les missions.
- Hypothèse : un agent réel n'appelle `mission_lancer` qu'à bon escient et ne déclare `demandeDuProprietaire` que si le
  prompt le demande (Relay ne le vérifie pas ; le Bilan le cite).
- Hypothèse : pendant la carte, la mère passe `awaiting_owner` et ses minuteurs sont suspendus alors que le chef
  continue de travailler (constaté par lecture d'`openNext` ; jamais observé avec un agent réel ; même chose
  qu'`askExtension`).
- Hypothèse : une session d'agent réelle reste vivante pendant l'attente du tour de synthèse ; sinon la ligne
  « Synthèse finale non faite » le dit (testé en fermant la session du faux agent).
- Coût d'un second processus MCP par mission (mémoire, démarrage) : non mesuré. Le faux agent n'ouvre le serveur que
  s'il joue le chef ; un vrai CLI l'ouvrira probablement pour chaque mission (hypothèse).

### Constaté, non corrigé
- `observe()` nomme encore `career_write` (déjà signalé par la partie A).
- Un refus donné à la requête (`accepted: false`) n'écrit aucune ligne au Bilan si le chef tente quand même un
  lancement (il reçoit `refus_proprietaire`, rien n'est créé) ; seul le refus sur la carte a sa ligne.
- Une fille annulée par le refus apparaît dans `family` de `GET /api/runs/:id` (état `cancelled`) et donne un
  `child_done`, mais pas dans la liste du Bilan (remplacée par la ligne de refus).
- `forget()` : petite rétention en mémoire déjà signalée par la partie A (inchangée).

### À décider
- Le manager ou le propriétaire : `accepted: false` dans la requête = refus (choix fait ici) plutôt que « pas encore
  d'accord » ; le front ne doit pas envoyer le champ quand la case n'est pas cochée.
- Le propriétaire : l'ajout « (par exemple plusieurs sources indépendantes à consulter) » dans la phrase du chef.
- Le manager : l'événement `delegation_accepted` déplacé de la création au premier lancement (écart à 8.1, pour la
  règle d'or).
- Le propriétaire : le texte 3.4 dit « (modifiables) » aussi sur la carte, où l'enveloppe ne se modifie pas.

### Fichiers touchés par la partie B
`packages/orchestrator/delegation.js`, `delegation-rule.js`, `family-bilan.js`, `index.js` (25 lignes : schéma `via`,
deux commentaires, appel `created` retiré, `promptParts(run, mcpServers)`, bloc du rappel remplacé par la synthèse),
`docs/api-delegation.md`, `docs/architecture-cible.md` (la note du 18/11), `tests/chef-01.test.js`,
`tests/fixtures/chef-agent.js`, `tests/delegation-v2-01-b.test.js` (neuf), ce rapport. Non touchés :
`apps/api/server.js`, `packages/mission-gateway/`, `packages/storage/`, `packages/agent-runtime/`, `packages/career-ops/`,
`domain-packs/`, `packages/browser-gateway/`, `packages/mcp-gateway/`, `tests/fixtures/fake-acp.js`, `skill-router.js`,
`packs.js`, `tool-guard.js`, `package.json`, `package-lock.json`.

### Commits (partie B)
- `43ed94f` [delegation-v2-01] Partie B : code (`delegation.js`, `delegation-rule.js`, `family-bilan.js`, `index.js`),
  tests (`tests/delegation-v2-01-b.test.js` neuf, `tests/chef-01.test.js`, `tests/fixtures/chef-agent.js`), docs
  (`docs/api-delegation.md`, note du 18/11 de `docs/architecture-cible.md`).
- Ce rapport : commit suivant. Fin de la partie B le 19/11/2026 à 00:59 (heure lue par `date`).

## Correctif E139 (essai réel du 19/11)

Session `essai-delegation-01` (Opus), seul écrivain de l'arbre, tête de départ `c44f134`. Fin le 19/11/2026 à 01:51
(heure lue par `date`).

**Constat (essai réel du manager, 01:40, mission menée par Codex, voie 3).** `mission_lancer` rendait seulement
`{ id, titre, etat: "attend_accord", agent, modele, famille }`, sans un mot sur la carte d'accord ouverte par la
plateforme. Le chef a reposé lui-même la question au propriétaire (question `prose` derrière la carte : deux questions
pour une décision) et a fini son tour au lieu de continuer sa part. Après les deux refus, il a terminé seul, Bilan juste.

**Changement (mêmes textes pour tous les agents, aucune garde, rien de bloqué).**
- `packages/orchestrator/delegation-rule.js` : nouveau texte `CONSENT_PENDING_NOTE` ; `REFUSED_MESSAGE` (message de
  `refus_proprietaire`) finit par « continue seul, sans lui reposer la question. » (la phrase du chef pour un refus
  reste celle d'avant) ; fin de la phrase du chef pour la voie 3 : « sinon la plateforme consultera le propriétaire avant
  la première sous-mission (ne lui pose pas la question toi-même) ; s'il refuse, continue seul. »
- `packages/orchestrator/delegation.js` (`launch`) : un résultat `etat: "attend_accord"` porte `note` (premier lancement
  comme suivants) ; `en_cours` et `en_file` inchangés, sans `note`.
- `docs/api-delegation.md` : section 3 (champ `note`, texte du refus), section 5 (fin de la phrase du chef).

**Tests.** Test `E139` ajouté à `tests/review-delegation-v2-01.test.js`, rouge avant le changement (`note` absente),
vert après : deux lancements en attente portent la même note ; refus « continuer seul » : `refus_proprietaire` avec le
nouveau message, une seule question ; accord par le bouton : `en_cours`, sans `note` ; aucun nom d'agent dans les textes.
Test de la phrase mis à jour dans `tests/delegation-v2-01-b.test.js`. Résultats (un fichier à la fois,
`AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier absent) : review-delegation-v2-01 5/5, delegation-v2-01-a 10/10,
delegation-v2-01-b 12/12 (dont la comparaison à la base avec `AGENT_PLATFORM_DELEGATION=0`), chef-01 16/16,
generique-01 15/15, career-integration 50/50, elicitation 26/26 ; `npm run check` vert ; `npx prettier --check` vert sur
les fichiers touchés. Non vérifié : l'effet sur un agent réel (essai à rejouer par le manager avec Claude et Codex).
