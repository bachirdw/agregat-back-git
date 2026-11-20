# Journal du manager — 20/11/2026

Suite de `nuit-18-11.md`. Heures lues par `date`. « Constaté » sauf mention. Aucune fusion, aucun push, aucune carte
d'envoi accordée, formulaires seulement sur les pages FICTIVES locales, Skill et bibliothèque career-ops intouchés.

## 07:06 Reprise
- Passation du 19/11 22:25 lue (HANDOFF section 0). État vérifié : `contacts-13-11` `b5db9ff` et `delegation-v2-01`
  `c6c2e9f`, arbres propres ; API 4314 et 4315 arrêtées ; pages fictives 4321 à 4324, relais 19988 et front 5177 en écoute.
- Décision du propriétaire (07:07) : jouer d'abord l'essai décisif (même agent, 8 formulaires fictifs, mode éteint puis
  allumé).
- 07:09 : pages fictives 4325 à 4328 lancées (`node tests/support/apply-page.js <port>`, arbre `-delegation`) ; API 4315
  relancée sur `c6c2e9f` avec les huit origines locales admises (commande de `api-branche.sh`, espace
  `~/Downloads/career-ops-essai`). Compteurs d'envoi des huit pages : 0.

## 07:10 → 07:31 Essai décisif : 8 formulaires FICTIFS, Claude `sonnet`, même consigne neutre (c4 étendue à 8 pages)
| | Mode éteint (`4d1faf0d`) | Mode allumé, enveloppe 8 / 8 (`993577b5`) |
|---|---|---|
| Durée de la mission | **6,6 min** | **7,7 min** |
| 8e formulaire à l'étape 3 | 6,1 min | 4,2 min |
| Organisation | seul, l'un après l'autre (≈ 35 s par formulaire après le premier) | 8 sous-missions lancées par le chef de lui-même entre 2,4 et 3,3 min ; finies entre 4,1 et 7,1 min |
| Envois | 0 sur les huit pages | 0 sur les huit pages |
Lecture : les formulaires sont remplis plus tôt avec le mode (4,2 min contre 6,1), mais la mission finit plus tard (une
sous-mission traîne jusqu'à 7,1 min, puis la synthèse). **Aucun gain pour le propriétaire sur des tâches courtes** :
lancer des copies du chef ne suffit pas. Limite d'usage Claude : 3 % à 07:10, 14 % à 07:23 (lecteurs compris).

## 07:11 Nouvel objectif du propriétaire (message de 07:11, réponses de 07:22)
- « Plusieurs agents qui collaborent sur des tâches complexes pour arriver à un résultat » ; première idée : un agent chef
  avec des sous-agents. Il demande des propositions, ce qui est flou, puis du code en autonomie jusqu'à midi.
- Ses réponses : **s'inspirer de la méthode de Claude Code** ; épreuves sur **trois types de projet** (code, candidature,
  étude de marché complexe) ; échanges par **carnet partagé + chef** (pas de messages directs) ; essais réels avec
  **Claude et Codex** admis (jamais d'envoi).
- Relevé préalable : quatre lecteurs Opus en lecture seule (besoin et décisions, code de délégation, moteur et
  orchestrateur, dépôts de référence), 865 000 jetons, 6,5 min. Rendus gardés dans le bloc-notes de la discussion.
  Points retenus : rien n'existe entre sous-missions sœurs ; pas de rôles ; `mission_preciser` jamais fait ; une reprise
  repart de zéro ; le chef attend par tranches de 50 s ; les gains réels ailleurs sont la relecture par un autre
  fournisseur avec verdict, plusieurs abonnements, les ressources qu'un agent ne dédouble pas, la reprise d'une partie.

## 07:29 Branche d'essai `equipe-20-11` (partie de `delegation-v2-01` `c6c2e9f`)
- Arbres : `~/Downloads/agregat-back-equipe` (lots E1 et E2) et `~/Downloads/agregat-back-equipe-carnet` (lot E3,
  branche `equipe-carnet`). Brief `.manager/briefs/equipe-01.md` (commit `334d3a6`).
- Proposition faite au propriétaire (méthode de Claude Code → Relay) : (1) rôles décrits en texte ; (2) vérificateur
  indépendant, par défaut un autre agent que l'auteur, avec verdict ; (3) `mission_continuer` (suite d'un travail au lieu
  de repartir de zéro) ; (4) carnet d'équipe ; (5) réveil du chef, seulement si le temps le permet (non lancé).
- 07:30 : workflow de code lancé (codeurs Opus : E1 puis E2 dans un arbre, E3 en parallèle dans l'autre ; un relecteur
  indépendant par lot ; intégrateur ; correcteur qui prouve chaque défaut par un test qui échoue).

## 07:33 Épreuves « agent seul » (API 4315, code `c6c2e9f`, mode éteint, Claude `sonnet`, consignes neutres)
- Code (`a639cf4d`) : outil `fusion-offres.js` (fusion de trois exports d'offres, doublons retirés), noté par 18 tests
  cachés du manager (`juge-code.mjs`, données fictives).
- Étude de marché (`598f1366`) : outils d'IA d'aide à la candidature, Australie et France ; quatre fichiers attendus,
  chaque chiffre avec sa source.
- Candidature (`e343f1dc`) : offres 025 et 051 (sans document existant), CV et lettre en PDF puis formulaires FICTIFS
  4321 et 4322, arrêt devant Envoyer.
- Suivi : `epreuve.py` (toute carte d'envoi est refusée ; une question reçoit une réponse neutre « décide toi-même, aucun
  envoi »).

## 07:37 Précision du propriétaire et travail de Codex en parallèle
- Message de 07:36 : les formulaires en parallèle ne sont pas un cas complexe. Le cas visé est **une équipe d'agents IA**
  menée par un chef sur un modèle fort : collecte sur plusieurs sites en parallèle, fusion, détection de ce qui est
  incohérent ou raté, résultats qui passent d'un agent à d'autres pendant que la mission avance (exemple : 3 000 offres,
  400 postulables, Sydney et Melbourne avec une réponse différente sur les formulaires, CV et lettres, e-mails et profils
  LinkedIn des entreprises notées plus de 5 sur 10, le tout en parallèle). La plateforme doit **reconnaître seule** quand
  une équipe est utile. Ordre : coder en autonomie jusqu'à midi sur ma branche, compte rendu, **ne pas interrompre ni
  toucher la branche de Codex**.
- Codex (constaté en lecture seule, rien modifié) : branche `codex/equipes-plateforme-20-11`, arbre
  `/private/tmp/agregat-equipes-plateforme-20261120`, base `c6c2e9f`, plan `docs/plan-equipes-agents.md` (191 lignes,
  discuté avec le propriétaire) : tableau de mission durable, tâches et résultats versionnés, déclenchement progressif,
  choix automatique agent / lot / équipe, cas career-ops et étude de marché. Son brief dit ne pas refaire les chantiers
  « rôles, carnet, suites » de mes arbres.
- Conséquence : je ne code ni le choix automatique ni le réveil progressif du chef (dans le plan de Codex). Mon lot reste
  rôles, vérificateur avec verdict, `mission_continuer`, carnet. Usage de Codex lu dans son rapport : 79 % de sa fenêtre
  hebdomadaire : mes essais n'emploient Codex que pour la vérification, au plus juste, pour ne pas couper son travail.
- Limite Claude : 34 % de la fenêtre de 5 h à 07:36 (remise à zéro à 12:00). Deux codeurs Opus et trois missions en même
  temps coûtent environ 1,5 point par minute : pas de lot supplémentaire, moins de relevés du manager.

## 07:46 Résultats des épreuves « Claude seul » (`sonnet`, mode éteint, aucune carte, aucune question, 0 envoi)
| Épreuve | Durée | Résultat constaté |
|---|---|---|
| Code (`a639cf4d`) | 5,5 min | **18 / 18 aux tests cachés du manager** ; ses propres tests : 14 réussis, 0 échec ; LISEZMOI présent |
| Étude de marché (`598f1366`) | 12,2 min | 4 fichiers rendus (8 concurrents, synthèse de 887 mots) ; exactitude des sources **non encore jugée** |
| Candidature (`e343f1dc`, offres 025 et 051) | 7,5 min | CV adaptés joints au bon formulaire (4321 : offre 025 ; 4322 : offre 051), 0 envoi ; qualité des documents non jugée |
Lecture : sur ces trois tâches, un agent seul aboutit en 5 à 12 min ; l'épreuve de code est au plafond (aucune marge de
qualité pour une équipe). L'épreuve qui ressemble le plus au cas visé par le propriétaire (plusieurs sources en parallèle,
fusion, contrôle de cohérence) est l'étude de marché : c'est elle qui sera jouée en équipe en priorité.
Limite Claude : 44 % à 07:46 (≈ 1 point par minute depuis 07:36). Décision : relectures, intégration et corrections du
workflow passées sur un modèle plus léger dès que les trois codeurs ont rendu ; une ou deux épreuves en équipe seulement.

## 07:54 → 08:21 Lots E1, E2, E3 rendus, relus, réunis et corrigés (branche `equipe-20-11`, tête `c1fb352`)
- Codeurs Opus : E1 `1b62a46` (rôles en texte, vérificateur d'un autre agent, verdict lu par la plateforme, Bilan), E2
  `eacec3f` (`mission_continuer`), E3 `ad7d57e` puis reprise par `git cherry-pick` (`a64e9f4`, carnet d'équipe : outils
  `carnet_noter` / `carnet_lire` pour le chef et chaque sous-mission, serveur restreint `relay-equipe`). 23 fichiers,
  +3 429 lignes dont 1 931 de tests ; logique neuve dans `roles.js`, `continuation.js`, `carnet.js` ; `index.js` : 29
  lignes (message du chef non étiqueté « propriétaire »), relues par le manager.
- Intégration (3 fichiers en conflit, les deux apports gardés) : un vrai défaut trouvé et corrigé (`e057b95` : le carnet
  ne lisait pas le rôle de l'auteur d'une note).
- Trois relecteurs indépendants (lecture seule) : 9 défauts bloquants ou importants. Correcteur : 7 confirmés par un test
  rouge puis vert, **6 corrigés** (`45df698` : verdict propre à chaque vérification, aucun verdict inventé pour une
  vérification jamais partie, « non revérifié » fidèle, ligne du carnet seulement dans le Bilan de la mère, notes non
  perdues sur une attente abandonnée, rôle libre non écrit en base pour une mission privée, message du chef non étiqueté
  propriétaire), 0 réfuté, **3 à décider** : course entre la lecture des agents et l'arrêt de la famille au lancement ;
  rôles de l'espace relus à chaque appel (une sous-mission pourrait réécrire le rôle du vérificateur) ; libellé du tour
  de plus pour un message du chef.
- Tests ciblés (un fichier à la fois) : `equipe-01-roles` 13/13, `-continuer` 6/6, `-carnet` 12/12, `-relecture` 6/6, 17
  fichiers voisins verts, `check` et prettier verts. Suite complète lancée à 08:22 dans l'arbre `-equipe`.
- Juge indépendant de l'étude « Claude seul » (un agent, sources relues une à une) : 8 produits réels, 7 prix confirmés
  sur 8, 10 chiffres de marché confirmés sur 11, rien d'inventé ; défauts : un prix (LoopCV) déclaré « confirmé » par
  l'auteur alors que la page citée ne le montre pas, une adresse de source en erreur 404, un produit mal classé, 3
  chiffres de la synthèse absents des fichiers.
- 08:22 : API 4315 arrêtée (aucune mission active). Arbre figé pour les essais réels : `~/Downloads/agregat-back-equipe-essai`
  (détaché sur `c1fb352`, copie de `.data` de l'arbre `-delegation`). Limite Claude : 47 % à 07:54, 53 % à 08:22.

## 08:35 Suite complète n° 1, essais réels en équipe, lots supplémentaires
- Suite complète sur `c1fb352` (08:21:54 → 08:35:10) : phase Chrome **265 / 265**, `check` et `format:check` verts.
  **Total de la phase unitaire non relevé** (erreur du manager : seule la fin du relevé a été gardée, et le code de
  sortie de `npm test` n'a pas été lu). À rejouer avec le relevé complet (suite n° 2).
- 08:35 : API d'essai **4316** lancée depuis l'arbre figé `-equipe-essai` (`c1fb352`). Épreuve « étude de marché » en
  équipe (`ab1210ce`, chef Claude `opus[1m]`, mode allumé, enveloppe 6 / 3, même consigne neutre) : à 2,2 min le chef a
  lancé de lui-même trois sous-missions de rôle `chercheur` (prix groupe A, prix groupe B, chiffres de marché).
- 08:36 : lot de corrections décidées par le manager (codeur Opus, arbre `-equipe`) : contrôle de fin de mission refait
  après la lecture des agents dans `launch()` ; rôles de l'espace figés au premier emploi ; précisions de doc. Le libellé
  du tour de plus pour un message du chef reste tel quel (boucle de tours, zone fragile) : limite connue.
- 08:44 Message du propriétaire : ne pas s'inquiéter de l'abonnement, déléguer largement, avancer.
- 08:46 : épreuves « code » (`844a24b4`) et « candidature » offres 037 et 052 (`2d04c997`) lancées en équipe sur 4316,
  chef Claude `opus[1m]`.
- 08:47 : deux lots en parallèle (workflow, codeur → relecteur indépendant → correcteur, Opus) :
  **interface** (dépôt du front, arbre `~/Downloads/agregat-front-equipe`, branche `equipe-front-20-11` partie de
  `e104-13-11` `7b2716c` : interrupteur « Équipe d'agents », bloc « Équipe », carnet) et **E152** (arbre
  `~/Downloads/agregat-back-equipe-e152`, branche `equipe-e152` : tour de plus quand l'agent finit son tour avec des
  sous-agents internes encore en arrière-plan).
- Note pour Codex : `coordination-codex-20-11.md` (même dossier). Sa branche n'a été que lue.

## 08:50 → 09:03 Épreuves en équipe (API 4316, code `c1fb352`, mode allumé, consignes neutres, 0 envoi, 0 carte, 0 question)
| Épreuve | Agent seul (`sonnet`) | Équipe (chef Claude `opus[1m]`) | Ce que le chef a fait |
|---|---|---|---|
| Code | 5,5 min, 18 / 18 | **4,2 min, 18 / 18** (`844a24b4`) | **aucune sous-mission** : il a jugé la tâche simple et l'a faite seul (« pas besoin de sous-missions ») |
| Candidature (2 offres) | 7,5 min | **14,9 min** (`2d04c997`) | 2 sous-missions en parallèle, rôle libre « candidature », une par offre (CV, lettre, formulaire) ; bons CV joints (4324 : offre 037 ; 4325 : offre 052) ; **aucune vérification demandée** |
| Étude de marché | 12,2 min, 8 produits | **26,6 min**, 10 produits (`ab1210ce`) | 3 `chercheur` en parallèle (finis à 4,8 / 11,6 / 13,7 min), **carnet employé (11 notes)**, puis un `verificateur` qui relit les trois ; rédaction et corrections par le chef |
- **Défaut réel n° 1 (bloquant, en correction)** : le vérificateur de l'étude a reçu l'agent **simulé** de la plateforme
  (`fixture`, premier agent « disponible » différent de l'auteur) et a échoué (`5b3d24a8`). Le chef l'a relancé sur Claude.
- **Défaut réel n° 2** : ce second vérificateur (`efd922c9`) a bien rendu son verdict par fichier (`a_corriger`, 1 point
  bloquant : un nombre de la synthèse absent des données), mais la sous-mission est marquée **en échec** « JSON invalide
  dans la réponse de l'agent » (réponse avec des accolades sans objet au contrat : même cause que la correction B du lot
  E152, en cours).
- Épreuve de code avec **Codex chef** (`adfde003`, lancée 08:50) : à 0,8 min une sous-mission `developpeur` (Codex), à
  3,5 min un `verificateur` donné à **Claude** par la plateforme (autre agent que l'auteur : choix correct ici) qui attend
  la fin du développeur ; en cours à 09:03.
- Lot E5 (rôles de pack, `72a8ccc`) : rendu et relu. Relecture : la garde « pack connu » n'était pas prouvée par un test ;
  les rôles `collecteur` et `evaluateur` imposaient un format et une découpe que la méthode du Skill ne prévoit pas.
  Décision du manager : **retirer ces deux rôles** (non essayés en réel), garder `redacteur-candidature`, `contacts`,
  `formulaire`. Corrections lancées à 09:04 (un codeur) avec le défaut n° 1 ; juge indépendant lancé sur l'étude en équipe.

## 09:04 → 09:25 Derniers rendus avant la limite d'usage
- Corrections après l'essai réel (`a26399a`, tête de `equipe-20-11`) : le choix d'un autre agent écarte l'agent simulé
  en mode réel et un agent dont le dernier essai de session a échoué (rouge 4/17 puis 17/17) ; garde « pack connu »
  prouvée par un test ; rôles `collecteur` et `evaluateur` retirés, phrase d'arrêt ajoutée à `contacts` et `formulaire`.
  17 fichiers de tests rejoués un par un : 0 échec ; `check` et prettier verts.
- **Épreuve de code avec Codex chef** (`adfde003`) : `completed` en **16,3 min**, **18 / 18** aux tests cachés ; un
  `developpeur` (Codex), puis un `verificateur` donné à **Claude** par la plateforme, verdict **`approuve`** lu par la
  plateforme (remarques : tests relancés par le vérificateur, 68 / 68). Vérification croisée prouvée en réel dans ce sens.
- **Juge de l'étude en équipe** (même juge, `sonnet`) : 10 produits réels ; prix : 5 confirmés, 1 différent (LoopCV :
  29 AUD écrit, « dès 9,99 € » lu), 4 invérifiables (pages protégées contre les robots pour ce juge) ; chiffres de marché :
  10 confirmés sur 12 ; **0 chiffre de la synthèse absent des données** (3 pour l'agent seul : le point relevé par le
  vérificateur a été corrigé) ; l'erreur LoopCV reste déclarée « confirmée » à tort, comme chez l'agent seul.
  **Pas de gain net de qualité** ; 26,6 min contre 12,2. Comparaison des prix incomplète (le premier juge avait pu lire
  deux pages de plus par le navigateur).
- **Interface** (`equipe-front-20-11`, tête `0937088`, dépôt du front) : interrupteur « Équipe d'agents » (éteint par
  défaut, case d'accord avec le texte du contrat), bloc « Équipe » (rôle, agent, état, attente, relit, verdict et points
  bloquants), bloc « Carnet d'équipe ». Relecture : 3 défauts confirmés et corrigés (accord sans son texte, workflow écarté
  en silence, compteur « en cours » faux). 270 tests verts (242 avant), `tsc`, build et prettier verts. **Rien n'a été vu
  à l'écran.** L'API ne rend pas encore le modèle d'un membre ni le lien « suite de ».
- **E152** (`equipe-e152`) : le codeur a relu les événements de 334492d0 : **le diagnostic du 19/11 était faux**. L'agent
  avait attendu ses sous-agents dans le même tour ; l'échec vient d'accolades dans une réponse en prose
  (`fiches/{vitest,jest,node-test}.json`). Correction B (`6f2ce3b`, la vraie cause) : accolades sans rien qui ressemble à
  un objet → reprise en texte libre, contre-épreuves gardées « JSON invalide ». Correction A (`0df4736`, tour de plus) :
  cas jamais observé ; sa relecture a trouvé 3 défauts importants ; le correcteur a commencé (`76abe40`) puis a été coupé.
- **09:25 environ : limite d'usage de 5 h atteinte** (« resets 12pm »). Le correcteur du lot E152 a échoué sur cette
  limite ; la discussion du manager est restée figée jusqu'à la remise à zéro.

## 12:48 Reprise après la remise à zéro
- État constaté : `equipe-20-11` `a26399a`, `equipe-e152` `76abe40`, `equipe-front-20-11` `0937088`, arbres propres ;
  API 4316, pages fictives 4321 à 4328, relais 19988 et front 5177 en écoute ; aucune mission active.
- Le défaut réel n° 2 du matin (vérificateur `efd922c9` marqué en échec) a la **même cause que E152** : une accolade en
  prose (« dans {mois, an, unique, semaine, jour} »). La correction B le couvre. Registre corrigé (ligne E152).
- Décision du manager : reprendre **seulement la correction B** sur `equipe-20-11` ; ne pas reprendre le tour de plus (A).
- 12:50 : suite complète n° 2 lancée sur `a26399a`, relevé complet et codes de sortie gardés.

## 13:01 Reprise de la correction des accolades, relue ; consigne du propriétaire sur la limite
- 12:55 Message du propriétaire : attention à sa limite d'usage. Relevé : 11 % de la fenêtre de 5 h, 53 % de la semaine
  (tous modèles), 48 % (Fable). Décision : plus aucune mission réelle sans son accord, un seul agent à la fois, pas
  d'essai de confirmation aujourd'hui.
- Branche **`equipe-b`** (arbre `~/Downloads/agregat-back-equipe-b`, partie de `a26399a`, tête `a063e15`, code `6fb4d80`) :
  la seule correction B du lot E152, reprise à l'identique dans `result.js`, tests neufs `tests/equipe-accolades.test.js`
  (rouge 1/3 avant, 3/3 après ; les deux exemples réels ; cas de bout en bout : une réponse en prose avec « dans {mois, an,
  unique} » aboutit), 19 fichiers voisins verts un par un, `check` et prettier verts. Rien du « tour de plus ».
- Relecture indépendante de cette reprise : **2 défauts importants, non corrigés** : (1) une réponse au contrat abîmée
  écrite avec des guillemets typographiques, des guillemets échappés ou un commentaire en tête passe désormais pour du
  texte libre et son bloc disparaît du résumé (avant : échec visible « JSON invalide ») ; (2) une question de l'agent
  écrite ainsi n'est plus posée. Et la correction reste incomplète : une prose qui cite un objet de code non JSON
  (`{ ok: true }`) échoue toujours. **Décision du manager : ne pas reprendre `equipe-b` sur `equipe-20-11` en l'état** (le
  changement touche toutes les missions) ; à corriger d'abord (élargir « ressemble à un objet » aux guillemets
  typographiques et échappés et au commentaire en tête, avec les tests proposés par le relecteur).
- Suite complète n° 2 sur `a26399a` (début 12:49:25) : phase unitaire **1 603 tests, 1 600 réussis, 0 échec, 2 ignorés,
  1 « à faire »** ; phase Chrome en cours à 13:01.

## Suite complète n° 2 terminée (tête `a26399a` de `equipe-20-11`)
Relevé brut : code de sortie npm test : 0 ℹ tests 1603 ℹ pass 1600 ℹ fail 0 ℹ cancelled 0 ℹ skipped 2 ℹ todo 1 ℹ tests 265 ℹ pass 265 ℹ fail 0 ℹ cancelled 0 ℹ skipped 0 ℹ todo 0  check : 0 Syntaxe JavaScript valide. format : 0 All matched files use Prettier code style! fin 13:02:47 
Lecture (13:03) : 0 échec dans les deux phases, code de sortie 0. La ligne « failing tests » du relevé ne cite que le test
marqué « à faire » (`tests/review2-lecture-18-11.test.js:248`, cas connu de `lecture`, déjà présent dans les suites
précédentes) : le lanceur de tests l'affiche sans le compter comme un échec. Rectification : le message du commit
`16fefd4` dit « 13:10 » ; l'heure réelle était 13:02.

## État laissé à 13:03
- `equipe-20-11` `a26399a` (suite complète verte), `equipe-b` `a063e15` (à corriger avant reprise), `equipe-e152`
  `76abe40` (tour de plus : à laisser), `equipe-front-20-11` `0937088` (interface, jamais vue à l'écran). Arbres propres.
- En écoute : API 4316 (arbre figé `c1fb352`, donc sans les corrections du vérificateur), pages fictives 4321 à 4328,
  relais 19988, front 5177. Aucune mission active. Aucun agent en cours.
- En attente de l'accord du propriétaire (limite d'usage) : corriger `equipe-b` puis la reprendre ; un court essai réel de
  confirmation ; voir l'interface à l'écran.
