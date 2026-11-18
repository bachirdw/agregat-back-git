# Rapport du sprint `multi-agent-v3-01`

Brief : `.manager/briefs/multi-agent-v3-01.md`. Spécification : `.manager/reports/etat-des-lieux-multi-agent-19-11.md`.
Arbre `~/Downloads/agregat-back-delegation`, branche `delegation-v2-01`. Une section par lot.

## Lot 1a (D1, D2, D6)

Codeur : sous-agent du manager, seul écrivain de l'arbre pendant le lot. Départ de la tête `75881f7`.

### Journal
- 07:14 Lecture entière du brief, de la spécification (sections 2 et 3) et d'`AGENTS.md`.
- 07:20 Base des tests de la délégation, avant tout changement (`AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier
  absent, un fichier à la fois) : `chef-01` 16/16, `delegation-v2-01-a` 10/10, `delegation-v2-01-b` 12/12,
  `review-delegation-v2-01` 5/5.
- 07:21 Tests neufs `tests/multi-agent-v3-01-a.test.js` écrits d'abord : 6/6 rouges avant tout changement (D1 : second
  serveur prêté sans le mode ; D2 et D6 : `multiAgent` refusé par le schéma strict).
- 07:23 D1 fait : les trois tests D1 verts. D2 : sans l'étape `{ fail }` du faux agent, la mère ne finissait jamais
  (attente dépassée, raison attendue) ; étape ajoutée (`tests/fixtures/chef-agent.js`, 1 ligne) : la sous-mission A
  restait `running` après l'échec de la mère (le défaut C2 reproduit). D2 fait : vert. D6 : `startedAt` absent (rouge),
  puis fait : vert.
- 07:26 Une assertion trop stricte corrigée dans mon test D2 : juste après `cancelled`, l'exécution de A est encore dans
  `active` (sortie de son agent en cours) ; le test attend maintenant sa sortie au lieu de l'exiger tout de suite.
- 07:27-07:31 Tests existants adaptés (voir plus bas) ; contrôles négatifs ; un 7e test neuf (arrêt du serveur).
- 07:33 Lancement des 16 fichiers de tests du « Fini quand », un à la fois (`multi-agent-v3-01-b` est celui du lot 1b, pas encore écrit).

### Fait comment (décision par décision)
- **D1 (C1), interrupteur `multiAgent`** :
  - `packages/orchestrator/index.js` : schéma `inputSchema`, `multiAgent: z.boolean().optional()` (pas de valeur par
    défaut écrite : sans le champ, la ligne de la mission n'a aucune clé de plus, condition de l'identité à `48a2f4e`) ;
    `plan()` : le mode agent est forcé par `multiAgent === true` (et plus par `delegation.accepted`).
  - `packages/orchestrator/delegation.js` : `servers()` rend `[]` si `run.multiAgent !== true` (donc ni second serveur
    ni phrase du chef : `promptParts` la donne seulement si le serveur est prêté) ; `call()` rend 403 si
    `mother.multiAgent !== true`. Sans le mode, l'accord `delegation` n'a aucun effet (rien ne le lit hors famille).
  - `apps/api/server.js` (reprise) : une ligne recopie `multiAgent: true` pour une mission qui l'avait (jamais une
    sous-mission). `AGENT_PLATFORM_DELEGATION=0` reste le retrait global (vérifié par le test de comparaison).
- **D2 (C2), l'échec de la mère arrête ses sous-missions** :
  - `delegation.js` : `stopFamily(run, control)` : rien si `!control.mere` (aucune lecture pour une mission ordinaire) ;
    sinon famille fermée aux lancements (`closing`), `cascade(id, MOTHER_FAILED)` (nombre arrêté gardé sur le contrôle),
    puis attente bornée à 10 s que toutes soient finies. `failureSection` ajoute la ligne `motherFailedLine(n)` quand
    n > 0.
  - `delegation-rule.js` : `MOTHER_FAILED` = « Arrêtée : la mission principale a échoué » ; `motherFailedLine(n)` =
    « n sous-mission(s) arrêtée(s) avec l’échec de la mission principale. »
  - `index.js`, chemin d'échec, juste avant `failureSection` : appel seulement si `!control.cancelled` et la raison
    n'est pas `SERVER_STOPPED` (annulation et arrêt du serveur inchangés).
- **D6 (C6), durée depuis le premier `running`** :
  - `delegation.js` `watch()` : au premier état `running` d'une sous-mission, `startedAt` (heure de cet événement) est
    écrit sur sa ligne ; `bilanSection` : durée = fin (ou maintenant) − `startedAt`, `null` sans `startedAt`.
  - `family-bilan.js` : `null` s'écrit « jamais démarrée » ; la consommation cumulée compte 0 pour elle.
- `tests/fixtures/chef-agent.js` : étape `{ fail }` du chef (son tour finit sur cette erreur), 1 ligne + commentaire.

### Tests existants adaptés (sans affaiblir ce qu'ils prouvent)
- Chaque mission de chef (avec `delegation` acceptée, ou qui attend la carte, ou lit seulement) passe
  `multiAgent: true` (lignes ajoutées : `chef-01` 19, `delegation-v2-01-a` 8, `delegation-v2-01-b` 15 dont les appels
  à `plan()` du test « via », `review-delegation-v2-01` 7 dont les deux `plan()` de R2) : voies 1 à 3, refus,
  annulation pendant la carte, extension, synthèse, « outils prêtés mais rien lancé », R3 mère et lecteur, R4, E139.
- `delegation-v2-01-b`, test 1 (comparaison à `48a2f4e`, base extraite et jouée, pas sautée) : maintenant **sans
  aucune variable d'environnement** (vérifié dans le test : `AGENT_PLATFORM_DELEGATION` absente), une mission sans
  `multiAgent` est identique à la base (consigne mot pour mot, serveurs `['platform']`, suite d'événements, état,
  réponse, clés de la ligne) ; avec `multiAgent` : seuls la phrase et le second serveur changent (et la clé
  `multiAgent` de la ligne, vérifiée présente) ; avec `AGENT_PLATFORM_DELEGATION=0` **et** `multiAgent` : identique à la
  base (hors la clé). Test « via » : le DAG reste un DAG aussi avec l'accord coché sans le mode ; titre ajusté.
- `review-delegation-v2-01` R2 : commentaire ajusté (c'est le mode qui force l'agent) ; R1 inchangé (mission sans le
  mode, identique à la base, avec et sans le réglage).

### Contrôles négatifs (changement retiré, test rouge, changement remis ; restauration par copie de sauvegarde)
1. `servers()` sans la condition `multiAgent` : `multi-agent-v3-01-a` 2 rouges (D1 sans le mode, D1 reprise) et
   `delegation-v2-01-b` test 1 rouge.
2. `call()` sans la condition : D1 « route interne 403 » rouge.
3. `plan()` forcé de nouveau par l'accord : D1 « un DAG reste un DAG » rouge.
4. Reprise sans la recopie : D1 reprise rouge.
5. Sans l'appel `stopFamily` : D2 rouge.
6. Durée depuis `createdAt` : D6 rouge.
7. Condition « ni annulation ni arrêt du serveur » remplacée par `true` : le test neuf « arrêt du serveur » rouge (A
   passait `cancelled` avec la cause d'échec de la mère). Constaté : `chef-01` « redémarrage » et « annulation en
   cascade » restent verts même sans cette condition (hypothèse, non vérifiée : le premier relit la base par un second
   `Store` sans fermer la plateforme ; le second voit déjà la cause d'annulation écrite par `cancel`) : ils ne prouvent
   donc pas cette condition, d'où le test neuf.

### Résultats exacts (constaté, 07:33-07:36, `AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier absent, un fichier à la fois)
`multi-agent-v3-01-a` 7/7 · `delegation-v2-01-a` 10/10 · `delegation-v2-01-b` 12/12 (comparaison à `48a2f4e` jouée,
0 sautée) · `review-delegation-v2-01` 5/5 · `chef-01` 16/16 · `generique-01` 15/15 · `review-generique-01` 5/5 ·
`fix-resume` 28/28 · `reprise-memoire` 8/8 · `career-integration` 50/50 · `career-failure` 11/11 · `elicitation` 26/26 ·
`message-proprietaire` 25/25 · `platform` 11/11 · `owner-mode` 14/14 · `workflow-resume` 8/8. `npm run check` : syntaxe
valide. `npx prettier --check` sur les 12 fichiers touchés : conforme. Pas de `npm test` complet (règle du brief).
Commit du code et des tests : `e7af974`.

Tests neufs (`tests/multi-agent-v3-01-a.test.js`, 7) : D1 sans le mode (serveurs `['platform']`, aucune phrase, route
interne 403 avec le jeton de la mission, même avec des étapes de chef et l'accord `delegation`) puis avec le mode ;
D1 DAG gardé sans le mode, forcé avec, `multiAgent` booléen strict ; D1 reprise (recopié, et absent pour une mission
sans le mode) ; D2 mère en échec (`parallel: 1` : A en cours et B en file arrêtées, cause `MOTHER_FAILED`, finies avant
la fin de la mère, B jamais lancée, ligne du Bilan, « jamais démarrée ») ; D2 contrôles (mère dont la sous-mission avait
fini : pas de ligne ; mission ordinaire en échec : aucun `store.children`, aucun événement de famille) ; D2 arrêt du
serveur (rien n'est annulé pour cette cause, B `interrupted`) ; D6 (attente de place ≥ 2 s non comptée, `startedAt` =
heure du premier `running`).

### Non vérifié / limites
- Aucun agent réel, aucune API sur port fixe, aucun navigateur, aucun réseau : tout est prouvé par le faux agent.
- Front : il doit envoyer `multiAgent: true` quand l'interrupteur est allumé (sprint `delegation-v2-02`) ; sans cela,
  aucune mission ne peut plus déléguer par Relay. Non examiné ici.
- Une sous-mission créée **avant** ce lot (ligne sans `startedAt`) s'affiche « jamais démarrée » au Bilan d'une mère
  reprise, même si elle a tourné (cas d'anciennes bases seulement ; pas de repli sur `createdAt`, choisi pour ne jamais
  compter l'attente).
- D2 : l'arrêt vise `store.children(id)` (filles de cette exécution), comme l'annulation (F7 de la spécification pour la
  chaîne d'une mère reprise) ; l'attente de 10 s porte, elle, sur toute la chaîne (`living`).
- D2 : la condition « hors annulation » n'a pas de contrôle négatif dédié (l'annulation a déjà tout arrêté par
  `cascade` avant ; `stopFamily` n'y trouverait rien de vivant — hypothèse lue dans le code).
- `docs/api-delegation.md` non modifié : le lot 1b le met à jour pour tout le lot 1 (champ `multiAgent`, cause
  `MOTHER_FAILED`, « jamais démarrée »).

### Points pour le manager
- Fichiers touchés : tous dans la liste du brief (`index.js`, `delegation.js`, `delegation-rule.js`, `family-bilan.js`,
  `apps/api/server.js`, `tests/fixtures/chef-agent.js`, quatre tests existants de la délégation, le test neuf, ce
  rapport). Aucun autre fichier n'a eu besoin de changer.
- Le champ est `optional()` sans `.default(false)` : un défaut écrit ajouterait la clé `multiAgent: false` à chaque
  ligne et casserait l'identité à la base (clés de la ligne comparées par le test). Effet identique à « défaut false ».

## Lot 1b (D3, D4, D8, D9, D10, textes de D5, contrat de l'API du lot 1)

Codeur : sous-agent du manager, seul écrivain de l'arbre pendant le lot. Départ de la tête `d1c2da1` (lot 1a relu :
section ci-dessus et `git show e7af974`). Aucun test rouge ni point ouvert du lot 1a ne bloquait ce lot.

### Journal
- 07:38 Lecture entière du brief, de la spécification (sections 2 et 3), d'`AGENTS.md`, du rapport et du diff du lot 1a,
  de `delegation.js`, `delegation-rule.js`, `family-bilan.js`, `mission-gateway/server.js`, du faux agent et de la doc.
- 07:41 Faux agent : consigne « DEPOSER:<nom> » (écrit <nom> dans `famille.dossierResultats`, sans appel d'outil, comme
  une commande). Tests neufs `tests/multi-agent-v3-01-b.test.js` écrits d'abord : **8/8 rouges** avant tout changement.
- 07:45 Code écrit (détail plus bas) : 6/8 verts. Les 2 rouges venaient du test : un paramètre hors schéma est refusé par
  le serveur MCP lui-même (le SDK valide l'entrée de l'outil) avant d'atteindre la plateforme, donc pas de
  `parametres_invalides` dans la réponse. Test corrigé : `isError` côté outil, et `parametres_invalides` vérifié par un
  appel direct de la route interne avec le jeton de la mère. 8/8 verts.
- 07:47 Tests existants : `delegation-v2-01-a` 2 rouges, `delegation-v2-01-b` 3, `chef-01` 4 (puis 1), tous dus aux
  changements voulus (textes D5, compteur D4, dossier D9 sur la ligne et dans la phrase de la sous-mission). Adaptés
  (liste plus bas).
- 07:50 Contrôles négatifs (8), `npx prettier --write` puis `--check`, doc.
- 07:54-07:57 Liste « Fini quand » complète, un fichier à la fois : tout vert.

### Fait comment (décision par décision)
- **D3 (C3), prérequis `apres`** :
  - `delegation-rule.js` : `apres: z.array(id).min(1).max(20)` dans le schéma strict de `mission_lancer` ; description ;
    `prerequisiteFailed(titre, state)` = « Prérequis « X » non abouti (en échec | annulée | interrompue) ».
  - `delegation.js` `launch` : chaque id doit être une sœur (chaîne de la mère), sinon `introuvable` ;
    `famille.apres` (dédoublonné) sur la ligne. `pump` : la file est parcourue dans l'ordre (au lieu de prendre la
    première entrée) ; une fille dont un prérequis vit encore garde son tour sans bloquer celles derrière elle ; une
    fille dont un prérequis a fini autrement que `completed` est annulée (`cancelHeld`) avec la cause ; une fille sans
    `apres` suit le même chemin qu'avant (places comptées une fois, `free`). `prerequisite(run)` lit les lignes des
    prérequis (seulement pour une fille qui a `apres` : `entry.run.famille.apres`, en mémoire). `heldState` : nouvel
    état `attend_prerequis` (`attend: "prerequis"` dans `line`). `promptParts` : `famille.prerequis: [{ id, titre,
    etat, reponse, fichiers }]` (par `outcome`, lu seulement pour une fille qui a `apres`). Le résultat de
    `mission_lancer` rend `cancelled` si un prérequis avait déjà échoué (annulée tout de suite par `pump`).
- **D4 (C4), reprises** :
  - schéma `reprend: id` ; `launch` : sœur inconnue → `introuvable` ; sœur en cours ou réussie →
    `parametres_invalides` ; ligne neuve `famille.reprend` (id repris) et `famille.reprise` (rang dans la tâche, la
    tâche étant la première tentative de la chaîne `reprend`) ; agent, modèle et titre par défaut ceux de la tentative
    reprise. Enveloppe : les sous-missions comptées sont toutes sauf les reprises de rang 1 et 2 (`counts`) ; une reprise
    de rang 1 ou 2 passe même enveloppe pleine ; au-delà elle compte. `parallel` inchangé (même file).
  - Compteur rendu au chef (`counter`, dans `mission_lancer` **et** désormais `mission_suivre`) : `{ lancees, taches,
    reprises, dansEnveloppe, enCours, total, parallel }`.
  - `family-bilan.js` : l'entrée d'une reprise dit « (reprise de « X ») » ; s'il y a au moins une reprise, une ligne
    « Par tâche (dernière tentative) : N tâche(s) : a aboutie(s), b en échec, c annulée(s), d interrompue(s), dont k
    après r reprise(s). » (rien de plus sans reprise).
  - `apps/api/server.js` : `POST /api/runs/<id>/resume` d'une ligne qui porte `famille` → 409 « Reprendre la mission
    principale : son chef relance la partie échouée », rien de créé (3 lignes de code).
- **D8 (C8), tâche structurée** : schéma `objectif`, `perimetre`, `resultatAttendu` (2 000 car.), `informations`
  (4 000 car.) ; description de `mission_lancer` qui les demande (`informations` : méthode trouvée, outils qui marchent,
  pièges). `launch` les garde en mémoire (`briefs`, comme `fichiers` et `soeurs`), jamais sur la ligne ni dans un
  événement ; `promptParts` les rend dans `famille.tache` (absent sans aucun champ). Pas de citation au Bilan (D8 ne la
  demande pas ; C8 la proposait).
- **D9, dossier de résultats** :
  - `delegation.js` `resultsFolder` : `relay/missions/<8 premiers car. de la première exécution de la mère>/<n>-<titre
    réduit>/` créé par `safeDirectory` (fonction de chemin confiné existante, refuse tout lien symbolique) ; `n` = rang de
    la sous-mission dans la chaîne ; titre réduit à `[a-z0-9-]` (accents retirés), 40 car., `sous-mission` s'il est
    vide. Échec de création → `null` : champ absent partout. Création de la sous-mission en échec → dossier vide retiré
    (`rmdirSync`). Chemin rendu par `mission_lancer` (`dossierResultats`), sur la ligne (`famille.dossierResultats`),
    dans le prompt (`famille.dossierResultats`).
  - `delegation-rule.js` `daughterRule(dossier)` : avec dossier, la phrase le cite (résultats détaillés dans des
    fichiers de ce dossier au format de la consigne, réponse finale courte : fait, chiffres clés, chemins, manques) ;
    sans dossier, `DAUGHTER_RULE` inchangée mot pour mot.
  - `ended` + `folderFiles` : à la fin de la sous-mission, les fichiers présents dans le dossier (lus sur le disque,
    `readdir` sans suivre de lien, profondeur 8, triés) s'ajoutent à `fichiers` en `{ chemin, taille }` (un chemin déjà
    relevé par un appel d'outil n'est cité qu'une fois), 200 au plus en tout ; même stockage qu'avant (événement
    `child_done`, ou fichier privé `relay/runs/<id>-fichiers.json` pour l'espace privé, jamais la base).
  - Phrase du chef (`CHIEF_RULE`) : ajout « chaque sous-mission a son dossier de résultats (dossierResultats) : pour de
    gros résultats, demande-lui un fichier dans un format précis et rassemble les fichiers par un script ou un outil
    plutôt qu'en les recopiant ; pour un travail répétitif, trouve d'abord la méthode sur un exemple et donne-la dans
    informations ». Aucun nom de site, de Skill ou d'agent (vérifié par test).
- **D10** : le texte d'avant (« … la plateforme lui demande s'il en autorise davantage. ») ne disait ni de relancer le
  même appel ni où lire l'enveloppe : ajusté (`envelopeReached`) : « Enveloppe acceptée par le propriétaire atteinte
  (T sous-missions comptées) : la plateforme consulte le propriétaire (ne lui pose pas la question toi-même) ; relance
  le même appel après sa réponse (mission_suivre donne l'enveloppe : famille.total et famille.dansEnveloppe). » Comme
  `mission_suivre` ne donnait pas l'enveloppe, `famille` (le compteur) y a été ajouté.
- **D5 (textes seulement)** : compteur « N exécution(s) Relay en activité (missions et sous-missions), dont K en
  attente du propriétaire » ; Bilan « Consommation : N sous-mission(s), D de durée des sous-missions Relay (…) » ; carte
  « Au plus N sous-missions Relay pour cette mission, M en même temps (modifiables) ; les sous-agents internes que les
  agents lancent d'eux-mêmes ne sont ni comptés ni bornés par cette limite. » ; description de `mission_suivre` alignée.
- **Doc** `docs/api-delegation.md`, pour tout le lot 1 : section 1 réécrite autour de `multiAgent` (défaut éteint,
  identité à la base sans variable, `delegation` seul sans effet, reprise, retrait global, le front doit l'envoyer) ;
  2.1 ajustée ; outils, erreurs, `attend_prerequis`, prérequis, reprises, 409, tâche structurée, dossier de résultats,
  `fichiers` `{ chemin, taille }`, message D10 ; 403 sans le mode ; phrases du chef et de la sous-mission ; champs de
  `famille` ; Bilan : durée depuis `startedAt` et « jamais démarrée » (avec la limite des anciennes lignes), reprises,
  échec de la mère (`MOTHER_FAILED`, ligne, 10 s) ; textes D5 ; « pas encore fait » mis à jour.

### Tests existants adaptés (changements voulus, sans affaiblir ce qu'ils prouvent)
- `delegation-v2-01-a` : texte du compteur (D5) ; `famille` de la ligne d'une fille avec `dossierResultats` (D9).
- `delegation-v2-01-b` : texte de la carte (D5) ; `famille` du résultat avec `taches`, `reprises`, `dansEnveloppe`
  (D4) ; la phrase de la sous-mission est `daughterRule(dossier)` (D9). La comparaison à `48a2f4e` est inchangée et verte.
- `chef-01` : `famille` (D4) ; lignes des filles avec `dossierResultats` (D9) ; phrase de la sous-mission (D9) ;
  consommation « durée des sous-missions Relay » (D5) ; test « même consigne pour tous les profils » : le chemin du
  dossier (qui contient l'id de la mère) est remplacé par un repère avant comparaison, le reste reste mot pour mot.

### Tests neufs (`tests/multi-agent-v3-01-b.test.js`, 8)
D3 succès (`parallel: 2` : B attend A sans prompt, C indépendante prend la place, B part avec les résultats de A,
`attend: prerequis`) ; D3 échec (A échoue → B jamais lancée, `cancelled`, cause exacte, `mission_attendre` rend A et B ;
id étranger → `introuvable` ; id invalide refusé par le schéma) ; D4 (enveloppe `total: 1`, deux reprises passent, la
troisième rend `enveloppe_atteinte` avec le message D10, reprise d'une tentative réussie → `parametres_invalides`,
compteurs, lien et titre par défaut, Bilan « reprise de » et ligne par tâche) ; D4 409 (rien de créé ; la reprise de la
mère reste permise) ; D8 (`famille.tache` complet, partiel, absent ; champ inconnu et bornes refusés par l'outil et par la
route interne ; description) ; D9 (chemin exact, dossier créé, ligne, prompt, phrase, `{ chemin, taille }` d'un fichier
écrit sans appel d'outil, titre vide → `sous-mission`, phrase du chef sans nom propre) ; D9 dossier impossible (un fichier
`relay/missions`) : champ absent partout, phrase d'avant ; D5 (carte, Bilan, description).

### Contrôles négatifs (changement retiré, `multi-agent-v3-01-b` rouge, changement remis par copie de sauvegarde)
1. `pump` sans contrôle des prérequis : les 2 tests D3 rouges.
2. Prompt sans `prerequis` : D3 succès rouge.
3. Reprises comptées dans l'enveloppe : D4 rouge.
4. Sans le 409 : test 409 rouge.
5. Sans `tache` dans le brief : D8 rouge.
6. Fichiers du dossier non lus à la fin : D9 rouge.
7. Chemin rendu sans création du dossier : les 2 tests D9 rouges.
8. Ancien message de `enveloppe_atteinte` : D4 rouge.
Fichiers restaurés vérifiés identiques (`diff`).

### Résultats exacts (constaté, 07:54-07:57, `AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier absent, un fichier à la fois)
`multi-agent-v3-01-a` 7/7 · `multi-agent-v3-01-b` 8/8 · `delegation-v2-01-a` 10/10 · `delegation-v2-01-b` 12/12
(comparaison à `48a2f4e` jouée, 0 sautée) · `review-delegation-v2-01` 5/5 · `chef-01` 16/16 · `generique-01` 15/15 ·
`review-generique-01` 5/5 · `fix-resume` 28/28 · `reprise-memoire` 8/8 · `career-integration` 50/50 ·
`career-failure` 11/11 · `elicitation` 26/26 · `message-proprietaire` 25/25 · `platform` 11/11 · `owner-mode` 14/14 ·
`workflow-resume` 8/8. `npm run check` : syntaxe valide. `npx prettier --check` sur les 10 fichiers touchés : conforme.
Pas de `npm test` complet (règle du brief). Commit du code, des tests et de la doc : `2993e22`.

### Non vérifié / limites
- Aucun agent réel, aucune API sur port fixe, aucun navigateur, aucun réseau : tout est prouvé par le faux agent.
- Espace privé (career-ops) : les fichiers du dossier passent par le même fichier privé qu'avant (lecture du code) ;
  pas de test dédié du dossier de résultats dans l'espace privé ni en mode propriétaire (où le dossier est créé dans le
  dossier career-ops du propriétaire, sous `relay/`, à côté de `relay/runs/`).
- Le choix « agent et modèle de la tâche reprise par défaut » n'est prouvé que pour l'agent (un seul faux agent,
  `fixture`, sans modèle annoncé) : le modèle par défaut n'est pas testé.
- `family.pending` (lancements en cours de création) compte dans l'enveloppe même pour une reprise libre : deux appels
  simultanés pourraient compter une reprise libre une fois de trop pendant sa création (hypothèse, non testée).
- Un fichier écrit par une commande **hors** du dossier de résultats reste invisible (F3, inchangé).
- Le rang `n` du dossier et le préfixe viennent de la chaîne de la mère : une mère reprise continue la numérotation et
  garde le même préfixe (lu dans le code, non testé).

### Ce qui reste à décider (manager)
- Texte de la carte : la spécification proposait « … que Claude ou Codex lancent d'eux-mêmes » ; la règle du
  propriétaire interdit un nom d'agent dans le moteur, et le brief dit « les sous-agents internes des agents » : écrit
  « que les agents lancent d'eux-mêmes ». La spécification signalait que ce texte de carte demande l'accord du
  propriétaire.
- `fichiers` de `terminees[]` mêle désormais des chaînes (appels d'outils) et des objets `{ chemin, taille }` (dossier) ;
  une forme unique demanderait de changer l'existant (tests et front).
- Le Bilan ne cite pas la tâche structurée (C8 le proposait, D8 ne le demande pas).
- Front : il doit envoyer `multiAgent: true` (point du lot 1a, toujours ouvert) et peut lire `attend: "prerequis"`,
  `dossierResultats` et le compteur.
