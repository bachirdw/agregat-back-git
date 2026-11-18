# État des lieux du mode multi-agent de Relay — 19/11/2026

Arbre `~/Downloads/agregat-back-delegation`, branche `delegation-v2-01`, tête `84fedff` (inchangée, rien commité).
Lecture seule : aucun fichier de code touché, aucune API, mission, agent réel ni navigateur lancés, aucun secret lu,
aucune lecture de `~/Downloads/agregat-back`. Bases lues en `mode=ro&immutable=1`. Rédigé le 19/11/2026 à 07:07 (heure
lue par `date`).

Conventions : **constaté** = lu dans le code, vu dans une base ou observé par un test ; **hypothèse** = déduit, non vérifié.
Les numéros de ligne renvoient à la tête `84fedff`.

## En bref (pour le propriétaire)

- **Ce qui marche déjà, prouvé par de vrais essais** : un agent principal (le « chef ») lance des sous-missions,
  choisit l'agent et le modèle de chacune, en fait tourner 3 à la fois, attend leurs résultats, les rassemble et écrit
  la réponse finale ; les cartes d'envoi restent à ton clic ; annuler la mission principale arrête ses sous-missions.
  Exemple réel : mission `c32ab22d` (Claude, 18/11 au soir) : 9 sous-missions, 708 offres rassemblées, doublons retirés.
- **Ce qui manque pour la première version** (8 corrections, environ 250 lignes de code au total) :
  1. l'interrupteur « Mode multi-agent » **éteint par défaut** (aujourd'hui les outils sont prêtés à **toutes** les
     missions) ;
  2. si la mission principale **échoue**, ses sous-missions continuent seules (rien ne les arrête) ;
  3. Relay ne gère pas les **prérequis** (« B attend A ») : seul le chef peut enchaîner à la main ;
  4. une relance n'est pas **reliée** à la tâche échouée, et reprendre une sous-mission à part lui fait perdre son lien ;
  5. le Bilan ne dit rien des **sous-agents internes** de Claude et Codex, et les textes laissent croire que les
     plafonds de Relay comptent tout ;
  6. la durée affichée des sous-missions compte aussi leur **attente de place** (consommation surestimée) ;
  7. le **faux blocage Indeed** (une simple recherche demandait une carte d'envoi) ;
  8. chaque tâche n'a pas de champs **objectif / périmètre / résultat attendu**.

## 1. Besoin → état

| # | Besoin | État | Preuve (constaté) | Ce qui manque exactement / hypothèses |
|---|---|---|---|---|
| 1 | Le chef comprend, décompose, choisit les spécialistes | **OPÉRATIONNEL** | Phrase du chef `delegation-rule.js:33-49` (`chiefRule`) ; agents et modèles annoncés rendus par `mission_suivre` (`delegation.js:887-925`, `agents()`). Missions réelles : `c32ab22d` (Claude, voie 2, 9 sous-missions), `400b5679` (Codex, voie 1, sous-missions en `gpt-6-luna`), `d4d2888a` (Codex, voie 3, 4 sous-missions en `gpt-6.1-terra`), `97bd7aa2` (Claude, voie 2, 3 sous-missions). `1bab6575` (Claude, accord coché) n'a rien délégué : autoriser n'oblige pas. | La qualité du découpage dépend de l'agent (hypothèse). |
| 2 | Relay crée et contrôle des missions ordinaires | **OPÉRATIONNEL** | `Orchestrator.create(input, null, family)` (`index.js:1089-1222`) ; une sous-mission est une mission complète (mêmes plans, questions, cartes, Bilan). | — |
| 3 | Relay contrôle les **dépendances** | **MANQUANT** | `mission_lancer` n'a aucun champ de prérequis (`delegation-rule.js:107-121`) ; `pump()` démarre dans l'ordre d'arrivée (`delegation.js:498-511`). | Le chef ne peut qu'attendre A (`mission_attendre`) puis lancer B lui-même. Correction C3. |
| 4 | Concurrence | **OPÉRATIONNEL** | Enveloppe `total`/`parallel` (6/3 par défaut), file `family.held`, `occupied()` (`delegation.js:478-511`) ; test `chef-01.test.js:325`. Réel `c32ab22d` : 6 lancées à 19:11, 3 en file (`queued`), parties seules à 19:13, 19:16, 19:18 quand une place s'est libérée. Extension par choix « 5 de plus » acceptée à 19:15:57 (`delegation_extended`). | Pas de plafond pour toute la machine (voulu, `docs/api-delegation.md` §7). |
| 5 | Permissions | **OPÉRATIONNEL** (avec un défaut) | Accord de consommation à trois voies (bouton, prompt, carte), distinct des cartes d'envoi ; chaque carte d'envoi reste au clic, sous-mission par sous-mission (tests B voies 1 à 3, `delegation-v2-01-b.test.js:306-528`). Réels : voie 1 `400b5679`, voie 2 `c32ab22d`, voie 3 accord `d4d2888a`, voie 3 refus `22d6cd51`. | Faux blocage Indeed (section 3). |
| 6 | Suivi | **OPÉRATIONNEL** pour l'agent et l'API ; **INCOMPLET** pour le propriétaire | `mission_suivre` (état, attente, outils, dernier outil, compteur d'activité), `GET /api/runs/:id` → `family` et `activity` (`delegation.js:527-563`, `server.js:271`). | Front (interrupteur, compteur, liste) : sprint `delegation-v2-02` prévu, non vérifié ici. |
| 7 | Annuler la mère arrête ses sous-missions | **OPÉRATIONNEL** | `cancel()` → `cascade()` (`index.js:2563-2576`, `delegation.js:983-1010`) ; tests `chef-01.test.js:608` (en cours et en file), `delegation-v2-01-b.test.js:502` (en attente d'accord). | Une mère **reprise** n'annule que les filles de sa propre exécution (`store.children(id)`, pas la chaîne) — cas rare, amélioration future. |
| 8 | L'**échec** de la mère ne laisse pas de travail continuer en silence | **MANQUANT** | `cascade()` n'est appelée que par `cancel()` (seul appel : `index.js:2575`) ; le chemin d'échec (`index.js:2195-2257`) écrit le Bilan (`failureSection`) sans arrêter les filles. Déjà signalé par la relecture (« Mère en échec »). | Correction C2. |
| 9 | Reprise sans refaire les tâches réussies, en gardant le lien | **INCOMPLET** | Fonctionne par le chef : `c32ab22d` a relancé « Indeed Sydney » deux fois (`933967bd` en échec, `809c26e6` réussie) sans refaire les 5 autres. Reprise de la mère : garde l'accord et voit les sous-missions de la chaîne (`chef-01.test.js:900`, `delegation.js:129-144`). | (a) La relance n'est pas reliée à la tâche échouée (seul le titre « (reprise 2) » le dit) : le Bilan compte « 1 en échec, 1 annulée » alors que la tâche a abouti. (b) `POST /api/runs/<sous-mission>/resume` perd `famille` (`create` ne la recopie pas ; `server.js:443` ne recopie l'accord que `!old.famille`) : la reprise devient une mission ordinaire **avec** les outils du chef. Correction C4. |
| 10 | Les spécialistes rendent des résultats exploitables et des fichiers | **OPÉRATIONNEL** (limite) | `outcome()` : réponse (50 000 car.), Bilan cité, fichiers, envois, cause (`delegation.js:864-884`) ; relisible sans consommation (test A `:192`). | Fichiers relevés seulement par les appels d'écriture (`edit`/`delete`/`move`) et `career_write` (`delegation.js:389-418`) : un fichier écrit par une commande (`Bash`) n'est pas listé. Dans `c32ab22d`, `fichiers: []` partout : les sous-missions n'ont rien écrit (constaté : 1 commande « Terminal » au plus chacune). |
| 11 | Le chef rassemble, traite les contradictions, vérifie que tout est fini | **OPÉRATIONNEL** | La mère attend sa dernière fille avant son Bilan (`settle`, `index.js:1926`) ; tour de synthèse unique avec la consigne « compare, retire les doublons » (`SYNTHESIS_TURN`, `index.js:1794-1835`) ; `mission_attendre { toutes: true }`. Réel : `c32ab22d` « 720 lignes brutes, 12 doublons retirés, 708 offres uniques ». | Traiter les contradictions reste le travail de l'agent (hypothèse). |
| 12 | Plus tard : découpages → workflows réutilisables | **MANQUANT** (prévu plus tard) | Le moteur DAG existe (`packages/workflow-engine/definition.js`, `dependsOn`). | Amélioration future F1. |
| 13 | Rien de spécialisé sur une recette fixe | **OPÉRATIONNEL** dans le code | Aucun nom d'agent, de site ou de ville dans `delegation.js`, `delegation-rule.js`, `family-bilan.js`, `mission-gateway/server.js` (recherche faite) ; seul reste : `career_write` dans `observe()` (`delegation.js:416`). | Dans `c32ab22d` le chef a choisi de lui-même « une sous-mission par site × ville ». Hypothèse : l'exemple de la phrase du chef « plusieurs sources indépendantes à consulter » y pousse. |
| 14 | Un chef, un seul niveau, pas de récursion | **OPÉRATIONNEL** | `servers()` rend `[]` pour une sous-mission (`delegation.js:155`) ; la route interne rend 403 (`delegation.js:573`) ; test A `:559`. | — |
| 15 | Chaque tâche a objectif, informations, périmètre, résultat attendu | **INCOMPLET** | `consigne` libre (8 000 car.), `titre`, `fichiers` (informations) (`delegation-rule.js:111-120`). | Pas de champs objectif / périmètre / résultat attendu, rien ne les demande. Correction C8. |
| 16 | Tâches indépendantes en parallèle ; les autres attendent leurs prérequis | parallèle **OPÉRATIONNEL** ; prérequis **MANQUANT** | voir lignes 3 et 4. | Correction C3. |
| 17 | Échanges par résultats, fichiers et chef ; pas de discussion entre agents | **OPÉRATIONNEL** | Aucun canal entre sous-missions ; une sous-mission reçoit seulement la demande du propriétaire, sa consigne, les titres de ses sœurs et les fichiers à lire (`promptParts`, `delegation.js:180-197`). | — |
| 18 | Chaque spécialiste écrit dans ses fichiers ; intégration des fichiers communs coordonnée | **INCOMPLET** | La phrase de la sous-mission le demande (`DAUGHTER_RULE`, `delegation-rule.js:52-53`) ; les fichiers de chaque fille sont relevés. | Rien ne signale deux sœurs qui écrivent le même fichier. Amélioration future F3. |
| 19 | Annuler la mère arrête ses sous-missions | **OPÉRATIONNEL** | ligne 7. | — |
| 20 | Pas de nouveau framework | **OPÉRATIONNEL** | Missions ordinaires, file de questions, stockage `famille` sur la ligne, 4 outils MCP. | — |
| 21 | Bouton « Mode multi-agent » **éteint par défaut** | **MANQUANT** | `servers(run)` prête les outils à **toute** mission menée par un agent tant que `AGENT_PLATFORM_DELEGATION` ≠ `0` (`delegation.js:88`, `154-177`) ; la phrase du chef est ajoutée à toutes ces missions (`promptParts`). Le seul retrait est global (variable d'environnement de l'API). | Correction C1. |
| 22 | Distinct de l'accord de consommation | **INCOMPLET** | L'accord existe (bouton « Autoriser les sous-agents », prompt, carte) mais il n'y a pas d'interrupteur de mode séparé. | Correction C1. |
| 23 | Désactivé = délégation réellement retirée **pour cette mission** | **OPÉRATIONNEL seulement en global** | Test `delegation-v2-01-b.test.js:195` : avec `AGENT_PLATFORM_DELEGATION=0`, consigne, serveurs et déroulement identiques à la base `48a2f4e`. | Pas de retrait mission par mission. Correction C1 (le même test sert de preuve). |
| 24 | Bilan : sous-agents Relay | **OPÉRATIONNEL** | Section « Sous-missions (n) » : Bilan de chacune cité mot pour mot, totaux, confrontation des envois annoncés (`family-bilan.js:71-114`) ; réel `c32ab22d`. | — |
| 25 | Bilan : sous-agents **natifs** Claude / Codex | **MANQUANT** | Aucun code ne lit les marques natives (recherche `parentToolUseId`, `agentThreadId`, `activityKind`, `Start subagent` : rien dans `packages`, `apps`, `tests`). Réels : `f89767fb`, `de62fa62` (Codex) et `a41e9279` (Claude) avaient l'accord coché, n'ont appelé **aucun** outil Relay, ont utilisé leurs sous-agents natifs, et leur Bilan n'en dit rien. Pire pour Claude : les 15 commandes de son sous-agent sont comptées dans « Actions natives de l'agent : 22 commandes » sans le dire (7 du chef + 15 du sous-agent). | Correction C5 ; détail section 4. |
| 26 | Les plafonds Relay ne sont pas présentés comme globaux | **INCOMPLET** | Textes : carte d'accord « Au plus N sous-agents pour cette mission, M en même temps » (`delegation-rule.js:65`) ; compteur « N agent(s) en activité (missions et sous-agents) » (`delegation.js:561`) ; Bilan « … d'agents cumulés » (`family-bilan.js:107`). Ils ne comptent que les exécutions Relay. | Correction C5 (textes ; celui de la carte demande ton accord, il avait été validé tel quel). |
| 27 | Aucune consommation inventée, aucune conversion jetons → quota | **INCOMPLET** | Aucun jeton ni pourcentage n'est affiché (bon point). Mais la durée d'une sous-mission va de sa **création** à sa fin (`delegation.js:300-302`) et compte donc l'attente de place : réel `c32ab22d`, « SEEK Sydney » affichée 7 min 57 s pour 3 min 34 s de travail (`running` 19:16:06 → fin 19:19:40), « SEEK Melbourne » 10 min 52 s pour 3 min 58 s. | Correction C6. |

### Autres constats des essais réels (hors tableau)
- **Le faux blocage a coûté une relance en cascade** (constaté, `c32ab22d`) : la carte d'envoi de `7468032c` est restée
  sans réponse 62 s ; le chef l'a vue par `mission_suivre` (`attend: carte_envoi`), a annulé la sous-mission « par
  précaution », puis l'a relancée deux fois. Une des relances (`933967bd`) a échoué pour une **autre** raison : Claude a
  écrit avoir changé de modèle (« Sonnet… est maintenant actif ») puis a refusé la consigne qu'il a prise pour un bloc
  joint à la sortie d'une commande locale, et n'a rien fait (« Navigation non prouvée »). Cause non analysée ici
  (hypothèse : l'ordre « changement de modèle puis consigne » dans le même tour) ; à suivre.
- Pendant la question d'extension, la mère est passée `awaiting_owner` (19:15:14 → 19:15:57) alors que le chef
  continuait (`mission_attendre` à 19:15:26) : c'est le constat R4 de la relecture (minuteurs suspendus et place libérée
  pendant que l'agent travaille). Non bloquant ; amélioration future F5.

## 2. Le plus petit ensemble de changements

Principe : réutiliser les missions ordinaires, la file `family.held`/`pump`, les quatre outils, la file de questions et
la persistance existantes (`famille` sur la ligne, événements). Aucun nouveau framework, aucune table nouvelle.

### CORRECTIONS INDISPENSABLES (première version)

**C1. Interrupteur « Mode multi-agent », éteint par défaut, distinct de l'accord.**
- Quoi : nouveau champ de requête `multiAgent` (booléen, défaut `false`). Sans lui : ni second serveur MCP, ni phrase du
  chef, route interne 403, comme le réglage `0` d'aujourd'hui mais mission par mission. Avec lui : comportement actuel
  (accord par bouton, prompt ou carte, inchangé). L'accord `delegation` sans le mode n'a aucun effet (ni outils, ni mode
  agent forcé). La reprise recopie `multiAgent`.
- Où : schéma `index.js:122-136` (1 ligne) ; `plan()` `index.js:810` (forcer le mode agent sur `multiAgent`, plus sur
  `delegation.accepted`) ; `delegation.js` `servers()` l.155 et `call()` l.573 (`run.multiAgent !== true` → rien / 403) ;
  reprise `server.js:442-455` (recopier) ; `docs/api-delegation.md` §1-2.
- Taille : environ 10 à 15 lignes de code ; 15 à 25 lignes de tests à adapter (les tests de chef-01, A, B et de relecture
  qui supposent les outils prêtés par défaut passent `multiAgent: true`).
- Risque : le défaut change (les missions ordinaires reviennent exactement au chemin de la base `48a2f4e`, déjà prouvé
  identique) ; le front doit envoyer `multiAgent: true` quand l'interrupteur est allumé. Une mission que le propriétaire
  n'a pas basculée ne peut plus déléguer par Relay même si son prompt le demande (c'est ce que dit le besoin).
- Test (faux agent) : reprendre `delegation-v2-01-b.test.js:195` **sans** variable d'environnement : une mission sans
  `multiAgent` = base `48a2f4e` (consigne mot pour mot, serveurs `['platform']`, suite d'événements, état, réponse) ; avec
  `multiAgent: true` : second serveur et phrase seulement ; `POST /api/internal/missions/<id>` → 403 sans le mode ;
  `delegation.accepted: true` sans le mode → `mode: 'workflow'` reste un DAG ; reprise → `multiAgent` gardé.

**C2. L'échec de la mère arrête ses sous-missions (et le Bilan le dit).**
- Quoi : dans le chemin d'échec, pour une mère seulement (`control.mere`), hors annulation (déjà faite par `cancel`) et
  hors arrêt du serveur (la famille doit rester `interrupted`) : `cascade(run.id, MOTHER_FAILED)` puis attente bornée
  (10 s) que les filles soient finies, avant `failureSection`. Texte `MOTHER_FAILED` = « Arrêtée : la mission principale
  a échoué » ; une ligne au Bilan de la mère « n sous-mission(s) arrêtée(s) avec l'échec de la mission principale ».
- Où : `index.js` juste avant `this.delegation.failureSection(run, control)` (l.2239) ; `delegation.js` (petite fonction
  `stopFamily` = `cascade` + `until(…, AbortSignal.timeout(10000))`) ; `delegation-rule.js` (texte).
- Taille : 15 à 20 lignes.
- Risque : faible ; n'agit que pour une mère (`control.mere`), jamais pour une mission ordinaire ; condition
  `!control.cancelled && reason !== SERVER_STOPPED` pour ne pas changer l'annulation (`chef-01:608`) ni le redémarrage
  (`chef-01:686`).
- Test (faux agent `tests/fixtures/chef-agent.js`, + une étape `{ fail: '…' }` de 3 lignes, ou `AGENT_PLATFORM_TIMEOUT_MS`
  court avec `sleepMs`) : `parallel: 1`, le chef lance A « ATTENDRE:a BATTEMENT » et B (en file), puis échoue → mère
  `failed`, A `cancelled` avec la cause, B jamais démarrée et `cancelled`, Bilan de la mère : les deux « annulée » et la
  ligne d'arrêt ; contrôles : annulation et redémarrage inchangés (`chef-01:608`, `:686` restent verts).

**C3. Prérequis : « cette sous-mission attend celles-ci ».**
- Quoi : champ facultatif `apres: [ids]` (20 au plus, comme `dependsOn` du moteur DAG) dans `mission_lancer`. Les ids
  doivent être des sœurs de la même mère (sinon `introuvable`) : pas de cycle possible. La sous-mission est créée et
  retenue (`family.held`, comme la file d'aujourd'hui) avec `etat: "attend_prerequis"` (`attend: "prerequis"` dans
  `mission_suivre`) ; elle démarre seule quand tous ses prérequis sont `completed` ; si l'un finit autrement, elle n'est
  jamais lancée et passe `cancelled` avec la cause « Prérequis « X » non abouti (état) » (le chef décide de relancer).
  À son départ, sa consigne reçoit `famille.prerequis: [{ titre, etat, reponse, fichiers }]` (données, pas consignes).
- Où : `delegation-rule.js` (schéma et description de `mission_lancer`, l.107-121) ; `delegation.js` `launch` (contrôle
  des ids, `famille.apres` sur la ligne), `pump` (l.498-511 : parcourir la file au lieu de prendre seulement la première
  entrée, sauter une fille dont un prérequis vit encore, annuler celle dont un prérequis a échoué), `heldState`/`line`
  (nouvel état), `promptParts` (résultats des prérequis, lus seulement pour une fille qui a `apres`) ;
  `docs/api-delegation.md` §3.
- Taille : 60 à 80 lignes.
- Risque : modéré-faible ; une fille sans `apres` suit le chemin d'aujourd'hui ; le seul point délicat est la boucle de
  `pump` (une fille qui attend un prérequis ne doit pas bloquer celles derrière elle).
- Test (faux agent) : A « ATTENDRE:a », B `{ apres: [A] }`, C indépendante, `parallel: 3` → B `attend_prerequis` sans
  prompt reçu, C part tout de suite ; on libère A → B part et son prompt contient la réponse de A ; second cas A
  « ECHEC » → B jamais lancée, `cancelled` avec la cause, `mission_attendre { toutes: true }` rend A et B ; `apres` avec
  un id étranger → `introuvable` ; `parallel` respecté ; une mission sans `apres` : suite d'événements inchangée.

**C4. Reprises reliées à la tâche échouée et à la mission principale.**
- Quoi : (a) champ facultatif `reprend: id` dans `mission_lancer` : id d'une sœur finie sans succès (sinon
  `parametres_invalides`) ; `famille.reprend` sur la nouvelle ligne ; agent et modèle par défaut ceux de la tâche
  reprise ; au Bilan, l'entrée dit « reprise de « X » » et les totaux comptent les tâches par leur dernière tentative
  (« 6 tâches : 6 abouties, dont 1 après 2 reprises »). (b) `POST /api/runs/<sous-mission>/resume` refusé (409 « Reprendre
  la mission principale : son chef relance la partie échouée ») : plus de sous-mission reprise qui devient une mission
  ordinaire avec les outils du chef. La reprise de la mère (déjà là) garde la chaîne et l'accord.
- Où : `delegation-rule.js` (schéma) ; `delegation.js` `launch`, `bilanSection` ; `family-bilan.js` (une ligne et les
  totaux) ; `apps/api/server.js:421` (refus).
- Taille : 30 à 40 lignes.
- Risque : faible ; aucun changement sans le champ ; le refus ne touche qu'une ligne qui porte `famille`.
- Test (faux agent) : A « ECHEC », puis `{ reprend: A }` → lien sur la ligne, Bilan « reprise de », totaux par tâche ;
  `reprend` sur une sœur `completed` → refusé ; `POST /resume` d'une sous-mission → 409 et rien de créé ; reprise de la
  mère : `chef-01:900` reste vert.

**C5. Sous-agents natifs au Bilan, avec leurs limites ; textes qui ne se disent pas globaux.**
- Quoi : un observateur en lecture seule, frère de `NativeActions` (`native-actions.js`), appelé au même endroit
  (`index.js:1563`) : il reconnaît les deux formes réellement vues (section 4) — déclarées par profil d'adaptateur, pour
  ne rien coder en dur dans le moteur — et écrit une ligne au Bilan **seulement s'il en a vu** :
  « Sous-agents internes de l'agent (lancés par l'agent lui-même, hors enveloppe Relay) : … ». Pour Claude : nom, type,
  état, nombre d'outils, durée et modèle **selon l'agent** ; pour Codex : nom, nombre d'échanges, premier départ et
  dernière fin vus, avec la limite « modèle et consommation non rapportés par Codex ». Pas de jetons par défaut (à
  décider ; jamais convertis). Textes : « exécutions Relay » au lieu de « agents » dans le compteur (`delegation.js:561`),
  « durée des sous-missions Relay » dans le Bilan (`family-bilan.js:107`), et pour la carte (texte validé par toi) :
  « Au plus N sous-missions Relay… ; les sous-agents internes que Claude ou Codex lancent d'eux-mêmes ne sont ni comptés
  ni bornés par cette limite. » La ligne « Actions natives » dit « dont n de ses sous-agents internes » quand c'est le
  cas (Claude).
- Où : `packages/orchestrator/native-subagents.js` (neuf), `packages/agent-runtime/profiles.js` (la forme de chaque
  adaptateur), `index.js` (2 lignes : observer, ajouter la ligne près de `nativeActions.line()` l.2112),
  `native-actions.js` (le « dont »), `delegation.js:561`, `family-bilan.js:107`, `delegation-rule.js:65`.
- Taille : 60 à 90 lignes.
- Risque : faible (lecture du flux ; aucune décision n'en dépend) ; une mission sans sous-agent natif n'a aucune ligne
  de plus.
- Test (faux agent `tests/fixtures/fake-acp.js`, données FICTIVES qui recopient les formes relevées dans `f89767fb` et
  `a41e9279`) : Codex start / interact / complete ×2 → une ligne, nom, 2 échanges, limite dite ; Claude `Agent` + 3
  appels enfants (`parentToolUseId`) + résultat final → une ligne avec « selon l'agent », et « dont 3 de ses sous-agents
  internes » ; sans ces formes : Bilan identique à aujourd'hui ; textes : aucune phrase qui présente l'enveloppe comme
  globale.

**C6. Durée des sous-missions comptée depuis leur départ réel.**
- Quoi : la durée d'une sous-mission part de son premier état `running`, pas de sa création (l'attente de place ou
  d'accord n'est pas du travail d'agent) ; une sous-mission jamais partie : « jamais démarrée ».
- Où : `delegation.js` `watch()` (noter l'heure du premier `running`, sur la ligne de la fille : `startedAt`) et
  `bilanSection` l.300-302.
- Taille : 6 à 10 lignes.
- Risque : très faible.
- Test (faux agent) : `parallel: 1`, deux filles « ATTENDRE » ; la seconde attend 1 s sa place : sa durée au Bilan
  n'inclut pas cette seconde ; une fille annulée en file : « jamais démarrée ».

**C7. Faux blocage Indeed** : section 3 (environ 12 lignes).

**C8. Tâche structurée : objectif, informations, périmètre, résultat attendu.**
- Quoi : champs facultatifs `objectif`, `perimetre`, `resultatAttendu` (2 000 car. chacun) dans `mission_lancer`,
  rendus à la sous-mission dans `famille.tache` et cités en une ligne dans son entrée du Bilan ; la description de
  l'outil les demande ; `fichiers` reste « les informations à lire d'abord ». Version minimale possible : seulement la
  description de l'outil (aucune ligne de code), si tu préfères.
- Où : `delegation-rule.js` (schéma, description), `delegation.js` `launch`/`promptParts`, `family-bilan.js`.
- Taille : 15 à 20 lignes.
- Risque : très faible (champs facultatifs, schéma strict gardé).
- Test (faux agent) : les trois champs arrivent dans le prompt de la fille (`prompt-<pid>-<n>.json`), absents s'ils ne
  sont pas donnés ; un champ inconnu reste refusé (`parametres_invalides`).

Total estimé : 210 à 290 lignes de code, sans compter les tests.

### AMÉLIORATIONS FUTURES
- **F1. Workflows réutilisables** : enregistrer le découpage d'une famille réussie (consignes, agents, modèles, `apres`)
  comme définition du moteur DAG existant (`dependsOn`), à relancer plus tard.
- **F2. Reprise de session** : `reprend` pourrait reprendre la session de l'agent de la tâche échouée (`create(…,
  previous)`, si `resumable`) au lieu de repartir de zéro.
- **F3. Fichiers communs** : signaler au chef et au Bilan un fichier écrit par deux sœurs ; relever aussi les fichiers
  écrits par commande (aujourd'hui invisibles).
- **F4. Contrôle des sous-agents natifs** : quand le mode multi-agent est éteint, couper aussi l'outil `Agent` de Claude
  ou les sous-agents de Codex (hypothèse : options des CLI, non vérifiées).
- **F5. Carte d'accord pendant que le chef travaille** (R4) : garder ses minuteurs et sa place parmi les trois.
- **F6. `accepted: false` dans la requête** : refus (aujourd'hui) ou « pas encore d'accord » ; moins important une fois C1
  fait.
- **F7. Cascade d'une mère reprise** sur toute la chaîne (`childrenOf` au lieu de `store.children`).
- **F8. `career_write` dans `observe()`** : à déclarer dans le pack (dernier nom propre au Skill dans le moteur).
- **F9. `mission_preciser`** (chef → sous-mission en cours) et le front (`delegation-v2-02`).
- **F10. Incident `933967bd`** (consigne ignorée après le changement de modèle) : à analyser à part.
- **F11. Jetons déclarés par Claude** (`totalTokens`) : affichables « selon l'agent » si tu le veux, jamais convertis.

## 3. Faux blocage Indeed (sous-mission `7468032c`)

### Ce qui s'est passé (constaté, base `agregat-back-essai-13-11`)
Sous-mission « Indeed Sydney » (Claude `sonnet`, fille de `c32ab22d`, mode propriétaire, relais `playwriter-owner`) :
1. 19:13:04 `browser_type` « developer » (9 caractères) dans `combobox "search: Job title, keywords, or company"`
   (ref `f1e88`), placé **dans** un repère `search` de la page (ref `f1e74`, lu dans l'instantané de 19:13:00).
2. 19:13:06.223 `browser_click` sur `button "Find jobs"` (ref `f1e104`), **dans le même repère `search`**.
3. 19:13:06.392 carte « Envoi : aperçu privé… », cible `POST autocomplete.indeed.com /api/v0/log` ; mission
   `waiting_permission`. Aucune réponse ; 19:14:08 annulée par le chef.

### Cause exacte (lecture du code ; une étape déduite)
1. En mode propriétaire, le clic est classé par `ownerClickKind(element)` (`browser-gateway/index.js:294-300`,
   `run-policy.js:261-319`). « Find jobs » est un bouton de formulaire **sans mot d'envoi** : il sort `candidate`, soit
   par la règle du formulaire de recherche (`run-policy.js:280-295`, dont le commentaire dit exactement « a search form
   … is a candidate (its GET passes, a write it triggers waits for the card) »), soit par « bouton d'un formulaire »
   (`run-policy.js:317`). *Déduit* : un classement `submit` aurait demandé la carte **avant** le clic, sans cible réseau ;
   la carte porte une cible réseau, donc c'est bien `candidate`.
2. `candidate` ouvre la « fenêtre d'envoi » du clic : `sendClick = true`, page du clic notée, 8 s
   (`cdp.js:2739-2742`, `CLICK_SEND_WINDOW_MS`).
3. La requête du journal est du **même site** (`registrableSite` : `indeed.com` des deux côtés, `cdp.js:330-343`), son
   chemin `/api/v0/log` ne contient ni mot sensible ni chemin de soumission (`isSubmitPath`, `cdp.js:279-290`), elle est
   petite, et la saisie dans une zone de recherche ne compte pas comme saisie (règle cartes-14-11 C). Mais elle part dans
   la fenêtre du clic, depuis la même page : `afterSendClick` est vrai (`cdp.js:1628-1640` : `sendClick === true &&
   (clickKind !== 'candidate' || samePage)`), donc elle ne passe pas par le passage automatique tracé (`cdp.js:1648-1651`)
   et reçoit la carte `browser.send` (`cdp.js:1658-1680`).

**En une phrase** : la requête est classée « envoi » seulement parce qu'elle suit un clic classé « geste d'envoi
possible » ; le bouton d'une zone de recherche était traité comme un « Postuler ». La règle cartes-14-11 (B) avait déjà
corrigé ce cas pour la touche Entrée dans le champ de recherche (`browser-gateway/index.js:374-389`, `pressKind = 'widget'`), pas pour
le clic sur le bouton de recherche.

### Ce qui distingue une requête technique d'un envoi engageant (déjà dans le code, à garder)
- **Engageant** (carte) : un geste d'envoi (libellé ou icône d'envoi, bouton d'un formulaire qui n'est pas une
  recherche déclarée par la page, Entrée dans un champ de message) ; une écriture vers un chemin de soumission (submit,
  send, postuler, message, reply, comment, publish…) ; un formulaire posté par navigation ; une écriture qui emporte une
  valeur tapée ou un fichier joint par l'agent (hors recherche) ; une grosse écriture (> 100 ko) après une saisie de
  l'agent.
- **Technique** (passe, tracée par son hôte) : une écriture de la page elle-même (journal, télémétrie, autocomplétion,
  entretien de session) après un geste qui n'est pas un envoi, sans donnée de l'agent autre que sa recherche, vers un
  chemin qui ne nomme pas une soumission.
- **Rejeté** : autoriser les POST sans distinction ; une liste de sites ; deviner d'après un mot de l'URL (« log ») ;
  ignorer les écritures sans donnée de l'agent (une candidature en un clic n'en porte pas).

### Changement le plus étroit proposé (environ 12 lignes, deux fichiers)
1. `cdp.js` `describeElement` (l.532-582) : ajouter `search: !!control.closest('[role="search" i], search')` — même
   lecture que `enterContext` (l.1917-1920) : la zone est **déclarée par la page**, jamais devinée d'un libellé.
2. `browser-gateway/index.js`, **après** la règle des WebSockets (l.306, qui reste prioritaire : un onglet à risque garde
   la carte avant le clic) :

```js
// Essai réel du 19/11 (sous-mission 7468032c, Indeed) : le bouton du formulaire d'une zone de recherche que la page
// déclare (role="search", <search>) choisit ce qu'on voit, comme Entrée dans son champ (cartes-14-11 B) : un widget.
if (
  clickKind === 'candidate' &&
  element?.search === true &&
  element.inForm &&
  element.tag !== 'a' &&
  element.role !== 'menuitem' &&
  (!element.ariaHasPopup || element.ariaHasPopup === 'false') &&
  element.ariaExpanded == null &&
  !element.formHasFile &&
  element.formCrossSite === false &&
  !sendHint(element)
)
  clickKind = 'widget';
```

Sous ces conditions, `candidate` ne peut venir que d'un « bouton de formulaire sans mot d'envoi » (`run-policy.js:295`
ou `:317`) : le menu ou bouton déroulant à libellé d'envoi (`:312`) et le lien sont exclus. **La carte reste** pour :
une écriture vers un chemin de soumission depuis la même page (règle du widget, `cdp.js:1636-1640`), un formulaire posté
par navigation, une grosse écriture après une saisie hors recherche, un cadre d'un autre site qui emporte une donnée de
l'agent, tout libellé d'envoi (`submit`, inchangé), un onglet à WebSocket ouvert (`submit`, inchangé).
Risque : limité aux clics en mode propriétaire sur un bouton de formulaire placé dans une zone de recherche déclarée.

### Test qui reproduit le cas exact
- **Sans navigateur** (rapide, dans `npm test`), même forme que `tests/review-carte-r1-01.test.js:228-269` (faux
  fournisseur dont `describe()` rend l'élément) : description exacte de « Find jobs » (`tag: 'button'`, `buttonType:
  'submit'`, `inForm: true`, `formMethod: 'get'`, `formHasFile: false`, `formCrossSite: false`, `text: 'Find jobs'`,
  `search: true`) → `args.clickKind === 'widget'` ; même élément avec `search: false` → `candidate` (inchangé) ; libellé
  « Envoyer » dans la zone → `submit` (inchangé).
- **Navigateur isolé** (Chrome sans tête, serveurs FICTIFS locaux, `approve` qui refuse tout), sur le modèle de
  `tests/cartes-recherche.test.js` : page FICTIVE `<main><search><form action="/jobs" method="get"><input
  role="combobox" aria-label="search: Job title, keywords, or company" name="q"><button type="submit">Find
  jobs</button></form></search></main>` dont le script, à l'envoi du formulaire, poste `POST /api/v0/log` ; page servie
  sur `au.fictif.localhost`, journal sur `autocomplete.fictif.localhost` (même site au sens de `registrableSite`, comme
  au.indeed.com / autocomplete.indeed.com ; hypothèse à vérifier en écrivant le test : Chrome résout `*.localhost` ; à
  défaut, même origine). L'agent : instantané, `browser.type` « developer » dans le champ, `browser.click` sur « Find
  jobs ». Attendu : **aucune** demande `actionClass: 'send'`, le serveur a reçu `POST /api/v0/log`, l'hôte est tracé,
  la page est sur `/jobs?q=developer`. Contrôle négatif : sans le changement, une carte avec la cible
  `POST …/api/v0/log`. Contre-épreuves (la carte reste) : même page sans `<search>` ; dans la zone, écriture vers
  `/api/apply/submit` ; bouton « Envoyer » dans la zone ; formulaire de recherche en `method="post"` posté par
  navigation.

## 4. Sous-agents natifs : ce qui est observable, par agent et version

Versions relevées (constaté) : événements `session` (`agentInfo`) des deux bases : `@agentclientprotocol/claude-agent-acp`
**0.95.0**, `@agentclientprotocol/codex-acp` **2.2.2**, `gemini-cli` **0.65.0** (une seule session, 13/11). CLI installées
(`--version`, sans réseau ni fichier de configuration) : `claude` **2.1.207** (`~/.local/bin`), `codex-cli` **0.163.0**
(`~/.local/bin`), `gemini` **0.65.0** et `opencode` **1.19.4** (`agent-repos-agregat/.cli/node_modules/.bin`). Les
adaptateurs du dépôt embarquent `@anthropic-ai/claude-agent-sdk` 0.3.309 (`claudeCodeVersion` 2.1.309) et
`@openai/codex` 0.160.1 ; Relay leur passe `CLAUDE_CODE_EXECUTABLE` / `CODEX_PATH` = la CLI détectée
(`agent-runtime/index.js:131-132`). Hypothèse : c'est donc la CLI installée qui a tourné.

| Agent (version) | Observable dans le flux ACP (constaté) | Non observable / limites |
|---|---|---|
| **Codex** (codex-acp 2.2.2, CLI 0.163.0) | Appels d'outil titrés « Start subagent <nom> », « Interact with subagent <nom> », « Complete subagent <nom> » (`kind: other`), avec `rawInput { agentThreadId, agentPath: "/root/<nom>", activityKind: started / interacted / completed }` ; un « Complete » à chaque fin de tour du sous-agent (id `subagent-completed-<uuid>`). D'où : nombre de sous-agents, noms, échanges, premier départ et dernière fin. Vu dans 17 missions de la base essai-13-11 (dont `de62fa62`, `4f1b3412`, `06a1e380`, `a1080e30`) et `f89767fb` (base délégation). Indice : des demandes d'autorisation `exec-…` (commandes) et un `career_write` **sans** appel d'outil correspondant dans le flux : 45 sur 46 tombent entre le départ et la dernière fin d'un sous-agent (`de62fa62` 17/18, `4f1b3412` 16/16, `06a1e380` 12/12). | Modèle du sous-agent ; sa consommation (`usage_update` ne donne que le contexte du fil principal : `used`/`size`) ; ses appels d'outils (aucun `tool_call`) ; son texte et son résultat (seul le chef le reprend) ; un échec distinct d'une fin (seul `completed` vu). Hypothèse forte : les demandes `exec-…` orphelines sont les commandes des sous-agents ; elles ne sont donc **pas** comptées dans « Actions natives ». |
| **Claude** (claude-agent-acp 0.95.0, Claude Code 2.1.207) | Outil `Agent` (`_meta.claudeCode.toolName`, titre « Task » puis la description), `rawInput { description, subagent_type, run_in_background }` ; **chaque** appel d'outil du sous-agent avec `_meta.claudeCode.parentToolUseId` = l'appel `Agent` (23 appels = `totalToolUseCount` 23) ; résultat final `_meta.claudeCode.toolResponse { status: completed, agentType: general-purpose, resolvedModel: claude-sonnet-5, totalDurationMs: 284803, totalToolUseCount: 23, totalTokens: 129720, usage, toolStats }`. Une seule utilisation dans les deux bases : `a41e9279` (aucune dans `157e4faa`, `1bab6575`, `c32ab22d`). | Chiffres **déclarés par l'agent** (durée, jetons), pas mesurés par Relay. Sous-agent en arrière-plan (`run_in_background: true`) : jamais observé. Aujourd'hui ses appels sont comptés dans « Actions natives de l'agent » sans être nommés (constaté : 15 des 22 commandes de `a41e9279`). |
| **Gemini** (0.65.0) | Rien d'observé : une seule session (13/11), aucune mission avec sous-agent. | Non évalué. |
| **OpenCode** (1.19.4) | Aucune session dans les deux bases. | Non évalué. |

Conséquence (constaté) : avec l'accord coché, Codex (`f89767fb`, `de62fa62`) et Claude (`a41e9279`) ont préféré leurs
sous-agents natifs aux sous-missions Relay ; l'enveloppe « 6 au plus, 3 en même temps » ne les a pas comptés et le Bilan
ne les cite pas. Que les outils Relay aient été prêtés à ces trois missions n'est pas lisible dans la base (hypothèse :
oui pour `f89767fb`, lancée sur la branche délégation).

## Commandes lancées et résultats
- Tests ciblés, un fichier à la fois, `AGENT_PLATFORM_AGENTS_CONFIG` vers un fichier absent du bloc-notes (faux agents,
  aucun navigateur : vérifié par recherche de `CdpBrowser`, `CHROME`, `19988`, `playwriter`, `RELAY_BROWSER`, 0
  occurrence) : `review-delegation-v2-01` 5/5, `delegation-v2-01-a` 10/10, `delegation-v2-01-b` 12/12 (comparaison à la
  base jouée), `chef-01` 16/16.
- `sqlite3` en lecture seule (`mode=ro&immutable=1`) sur les deux bases : événements de `7468032c`, `c32ab22d` et de
  ses filles, missions à sous-agents natifs, versions `agentInfo`.
- `--version` des quatre CLI (sans réseau) ; versions des paquets d'adaptateurs lues dans `node_modules/*/package.json`.
- Une relecture d'une longue sortie que l'outil avait mise de côté sous `~/.claude` a été **refusée** (zone interdite) :
  rien n'y a été lu ; le rapport du sprint a été relu directement dans l'arbre. Une seconde sortie mise de côté au même
  endroit n'a pas été ouverte.

## Limites de cet état des lieux
- Aucun essai réel joué : les comportements « réels » viennent des bases de la nuit, pas d'une nouvelle mission.
- Tailles en lignes : estimations, pas du code écrit.
- Le front n'a pas été examiné.
