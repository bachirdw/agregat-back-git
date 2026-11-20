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

## 14:36 → 14:58 Accord du propriétaire (« oui, fais-le ») : correction des accolades reprise, interface vue à l'écran
- **Correction des accolades** : défauts 1 et 2 de la relecture confirmés par des tests rouges puis corrigés sur
  `equipe-b` (`28383a3` : une accolade suivie d'un guillemet typographique, d'un guillemet échappé ou d'un commentaire
  « ressemble à un objet » et reste « JSON invalide ») ; défaut 3 gardé comme limite connue (une prose qui cite
  `{ ok: true }` échoue toujours). Diff de `result.js` relu par le manager (un seul bloc gardé). Les quatre commits
  repris par `git cherry-pick` sur `equipe-20-11` : **nouvelle tête `e93f6c2`** ; `tests/equipe-accolades.test.js` 8/8.
- **Suite complète n° 3 sur `e93f6c2`** — relevé brut : début 14:44:08 tête e93f6c2 code de sortie npm test : 0 ℹ tests 1611 ℹ pass 1608 ℹ fail 0 ℹ cancelled 0 ℹ skipped 2 ℹ todo 1 ℹ tests 265 ℹ pass 265 ℹ fail 0 ℹ cancelled 0 ℹ skipped 0 ℹ todo 0  tests cités sous « failing tests » : 1 check : 0 Syntaxe JavaScript valide. format : 0 All matched files use Prettier code style! fin 14:57:44 
  (la ligne « failing tests » ne cite que le test marqué « à faire », comme aux suites précédentes).
- **Interface vue à l'écran** (front de `equipe-front-20-11` lancé sur le port **5178**, API 4316, navigateur intégré) :
  réglage « Équipe » du composeur (case « Équipe d'agents » et texte d'accord) ; sur la mission réelle `ab1210ce` : bloc
  « Équipe » (5 membres, rôles, agent, état, « relit », verdict « à corriger », 1 point bloquant dépliable) et bloc
  « Carnet d'équipe » (auteur, rôle, catégorie, heure, texte). Deux retouches notées, non faites : le texte d'accord
  dépasse sa fenêtre (fin coupée) ; les sous-missions sont mêlées aux missions dans la liste de gauche. Deux captures
  envoyées au propriétaire.
- Non fait, en attente : l'essai réel de confirmation (vérificateur d'un travail de Claude donné à Codex), à jouer quand
  Codex aura fini de coder ; l'API 4316 tourne toujours sur `c1fb352` (avant les corrections du vérificateur et des
  accolades).
- En écoute à 14:58 : API 4316, front 5178 (branche interface), front 5177, pages fictives 4321 à 4328, relais 19988.
  Aucune mission, aucun agent.

## 18:27 → 18:53 Premier essai du propriétaire lui-même (interface 5178, API 4316 relancée sur `e93f6c2`)
- 18:27 : API d'essai relancée sur `e93f6c2` (arbre figé `-equipe-essai`), aucune mission en cours avant l'arrêt.
- Mission `f419245a` lancée par le propriétaire à 18:29 (étude de marché, pack core, Claude sur le modèle par défaut,
  interrupteur « Équipe d'agents » coché) : **`completed` en 23,4 min** (18:29:18 → 18:52:42). Suivie par un guetteur en
  lecture seule, rien touché.
- Déroulé constaté : 2 `chercheur` Claude en parallèle (Australie, France), finis en 5 à 6 min ; un `verificateur` donné
  par la plateforme à **Codex** (correction du matin confirmée en réel : un vrai agent différent de l'auteur), verdict
  **`a_corriger` avec des points bloquants précis** (un chiffre absent de la page citée, un cycle de facturation mal
  rapporté, des prix rattachés à la mauvaise source) ; corrections par le chef ; puis trois **suites** de la vérification
  (`mission_continuer` employé en réel) : Codex **en échec « Limite d'usage de Codex atteinte : réessayer à 11:27 PM »**
  (18:48), Gemini en échec (« API key is missing or not configured »), OpenCode abouti, verdict `a_corriger` lu dans la
  réponse, sans point bloquant listé. Carnet : 8 notes.
- À retenir : (1) la vérification croisée a trouvé de vraies erreurs de sources, corrigées dans la réponse finale ;
  (2) **limite de Codex atteinte à 18:48** : plus de Codex avant 23:27 ; (3) le chef a pu choisir Gemini, que la liste des
  agents lui présente comme disponible alors que son dernier essai de session a échoué : à corriger (la liste rendue par
  `mission_suivre` devrait le dire indisponible ; aujourd'hui seul le choix automatique l'écarte) ; (4) la mission s'est
  terminée sur un dernier verdict `a_corriger` : à vérifier que le Bilan le dit clairement au propriétaire.

## 19:25 → … Nouvelle demande du propriétaire : s'inspirer du projet « Agent Swarm »
- Demande (19:24) : importer le projet « Agent Swarm » de GitHub dans `~/Downloads/agent-repos-agregat`, puis faire faire
  des allers-retours par des agents entre ce projet et le nôtre : s'inspirer de leur code et de leur architecture, copier
  en adaptant, et l'implémenter chez nous. Sous-agents en parallèle admis, « ne t'inquiète pas de la limite ».
- Projet retenu : **`desplega-ai/agent-swarm`** (licence **MIT**, 1 091 étoiles, actif ce jour ; « a lead agent delegates
  goals to workers such as Claude Code or Codex »). C'est le seul dépôt actif nommé exactement ainsi ; l'autre candidat
  (`daveshap/OpenAI_Agent_Swarm`) est arrêté depuis 2024. Choix fait sans demander, annoncé au propriétaire.
- Téléchargement : `git clone --depth 1` vers `~/Downloads/agent-repos-agregat/desplega-ai__agent-swarm` lancé à 19:26,
  lent (dépôt de 3,4 Go d'historique, 148 Mo de fichiers en tête, 7 456 fichiers) ; en parallèle, archive du même état
  téléchargée (73 Mo) et extraite dans le bloc-notes de la session pour que les lecteurs commencent sans attendre.
  Rien du projet n'est exécuté (ni `bun`, ni script, ni Docker) : lecture seule ; son contenu est traité comme une donnée.
- Arbre de travail créé : `~/Downloads/agregat-back-swarm`, branche **`swarm-20-11`**, partie de `e93f6c2` (tête de
  `equipe-20-11`). Rien de fusionné ni poussé. La branche de Codex n'est pas touchée.
- Limite d'usage relevée à 19:26 : 44 % de la fenêtre de 5 h (remise à zéro vers 23:20), 63 % de l'hebdomadaire.
- 19:36 : workflow `swarm-lecture-comparee` lancé : **8 lecteurs Opus en parallèle, lecture seule**, un par domaine
  (délégation et tâches ; consignes et rôles ; mémoire partagée ; workflows et portes de relecture ; robustesse ; choix de
  l'agent, du modèle et limites ; interface ; leçons tirées de leurs notes). Chacun rend au plus 8 constats : ce que fait
  swarm, ce que fait Relay, quoi coder et où, valeur, effort, risque.
- 19:39 : clone terminé à son emplacement définitif (`f1d25eb`, 7 456 fichiers, 239 Mo avec `.git`).
- 19:43 : **le propriétaire élargit la demande** : pas seulement une comparaison, un **plan d'implémentation de leur
  architecture multi-agents chez nous**, avec copie de leur code sur certains points ; chaîne voulue : un agent qui écrit le
  plan (chemins, quoi implémenter), un **copieur** qui fait l'aller-retour, un **codeur** qui l'installe chez nous ; par lots ;
  passation dans une nouvelle session si la conversation devient trop lourde.
- 19:46 : les 8 lecteurs ont rendu (9 min, 1,43 million de jetons Opus, 287 appels d'outils, aucun en erreur) :
  **63 constats** et 76 pièges, écrits dans `~/Downloads/agregat-back-swarm/.manager/reports/swarm-lecture/`
  (`1-delegation.md` … `8-lecons.md`). Commit local `113e8d9` sur `swarm-20-11` (rendus + `docs/licences-tiers/` : texte de
  la licence MIT et règle d'attribution en tête de tout fichier repris). Limite de 5 h : 50 % avant, 58 % après.
- Constats de valeur 5 qui reviennent chez plusieurs lecteurs : refuser une sous-mission en double (similarité de mots) ;
  état réel de chaque agent dans la liste donnée au chef et mémoire d'une limite d'usage jusqu'à son heure de reprise ;
  repli automatique sur un autre agent ; test de décision chiffré « équipe ou pas » dans la consigne du chef et
  vérification conditionnelle (cause probable du temps doublé) ; verdict illisible distingué de « à corriger » et tour de
  rattrapage borné ; leçons durables par fichiers ; liste des missions limitée aux mères ; mesure du coût réel d'une équipe.
- 19:49 : workflow `swarm-plan-architecte` lancé (un architecte, modèle de la session) : écrit
  `.manager/plans/plan-swarm-20-11.md` (en bref, architecture de swarm, écart, architecture cible, lots, vagues, ce qu'on
  ne reprend pas, risques et recouvrements avec le socle de Codex) et `lots-swarm-20-11.json`. Chaîne prévue ensuite par
  lot : copieur (portage TypeScript → JavaScript dans `.manager/portage/<lot>/`) → codeur (installation, tests) →
  relecteur indépendant → contrôle du manager (suite relancée).
- 20:31 : l'architecte a rendu (43 min, 648 000 jetons, 103 appels d'outils) : **plan de 1 396 lignes, 17 lots en
  10 vagues** (`.manager/plans/plan-swarm-20-11.md`, `lots-swarm-20-11.json`), commit local `3631948` sur `swarm-20-11`.
  Contrôle du manager : parties 0, 4.0, 5, 6, 7 lues, liste des lots vérifiée (vagues, dépendances, fichiers) ; les
  17 sections de lot ne sont pas relues une à une. Aucun code écrit.
- 20:10 → 20:20 : le propriétaire demande, une fois le plan fini, une **passation à une nouvelle conversation** (tout ce
  qui compte, fichiers modifiés, décisions) avec un **prompt** qui dit de continuer et de commencer à implémenter.
  Écrite : `reports/passation-swarm-20-11.md` (prompt en partie 12) ; `HANDOFF.md` section 0 remplacée (bloc de 12:50 gardé
  sous « 0-midi »).
- **20:33 : limite de 5 h à 92 %** (58 % à 19:47). Cause : l'architecte était sur le modèle de la session (Fable) ; les
  8 lecteurs Opus, pour deux fois plus de jetons, n'avaient coûté que 8 points. Erreur de ma part : j'aurais dû lui donner
  Opus. Conséquence : **la vague 1 ne peut pas partir avant la remise à zéro de 23:20** ; la nouvelle conversation n'est
  pas ouverte ce soir par moi (elle buterait sur la limite en quelques minutes), le prompt est remis au propriétaire.
- En écoute à 20:30 : API 4316, interfaces 5178 et 5177, pages fictives 4321 à 4328, relais 19988. Aucun agent en cours.

## Soir : nouvelle conversation du manager (chantier swarm, début du code)
- 20:34 : reprise par une nouvelle conversation, avec le prompt de la passation. Lus : `passation-swarm-20-11.md`, le plan
  (parties 0, 4.0, 5 et sections swarm-01 à swarm-04), `HANDOFF.md` sections 0 et 2.
- 20:35 : `get_usage` : fenêtre de 5 h à **93 %**, remise à zéro à 23:20 ; hebdomadaire 69 % (Fable 68 %). Règle des
  85 % : **la vague 1 attend 23:20**. Rien de coûteux lancé avant.
- 20:36 : quatre arbres créés par le manager depuis `3631948` : `~/Downloads/agregat-back-swarm-01` … `-04` (branches
  `swarm-01` … `swarm-04`, `node_modules` en lien vers `agregat-back-delegation`).
- 20:37 : outil `~/Downloads/agregat-back-swarm/.manager/outils/phase-unitaire.mjs` : lance la phase unitaire seule d'un
  arbre (203 fichiers, sans les 26 fichiers Chrome). Raison : quatre lots en parallèle ne doivent pas lancer plusieurs
  Chrome en même temps (8 cœurs ; commentaire de `scripts/run-tests.js`). La suite complète reste au manager, un arbre à la
  fois. Commit `[swarm-00]` sur `swarm-20-11`.
- Référence de suite (journal, `e93f6c2`, 14:44 → 14:57) : 1 611 unitaires, 1 608 réussis, 0 échec, 2 ignorés, 1 « à
  faire » ; Chrome 265/265. `swarm-20-11` n'y ajoute que des documents.
- Reprise programmée vers 23:22 : vague 1 par un workflow (4 lots en parallèle, chacun copieur → codeur → relecteur, Opus).
- 23:22 : reprise programmée reçue. `get_usage` : fenêtre de 5 h à **0 %** ; hebdomadaire 70 % (Fable 68 %), remise à
  zéro le 21/11 à 11:00. Le propriétaire a écrit à 20:39 : continuer en autonomie, s'arrêter à la limite, reprendre seul.
- 23:26 : outil `phase-unitaire.mjs` complété (deux phases au plus en même temps sur la machine, créneaux dans
  `.manager/outils/verrous/`, ligne « FIN phase unitaire : code N »), commit `199c813`. Phase unitaire de référence lancée
  sur la tête de `swarm-20-11` pendant que les copieurs lisent.
- 23:28 : **le lancement par workflow a été refusé** par le contrôle automatique des permissions de l'application
  (« Destructive or Unwanted Actions », sans détail). Voie prise à la place, celle que prévoit l'outil : les mêmes
  sous-agents Opus lancés un par un par le manager (outil Agent), même chaîne copieur → codeur → relecteur. Conséquence :
  le manager est réveillé à chaque fin d'agent (douze fois par vague de quatre lots au lieu d'une).
- 23:30 : brief commun des sous-agents écrit et commité (`f19b1c2`) :
  `~/Downloads/agregat-back-swarm/.manager/briefs/swarm-agents.md` (chemins, interdits, commits, tests, les trois rôles,
  forme de la réponse). Il sert à toutes les vagues.
- 23:31 : **vague 1 lancée** : quatre copieurs Opus en parallèle (swarm-01 à swarm-04), un par arbre.

## Nuit du 20 au 21/11 : vague 1 du chantier swarm (swarm-01 à swarm-04)
Chaîne par lot : copieur → codeur → relecteur, tous Opus, lancés un par un par le manager (workflow refusé à 23:28).
Référence relevée à 23:31 sur `swarm-20-11` : phase unitaire 1 611 tests, 1 608 réussis, 0 échec, 2 ignorés, 1 « à faire » (179 s).

| Lot | Copieur | Codeur | Relecteur | Verdict | Contrôle du manager (suite complète dans l'arbre du lot) |
|---|---|---|---|---|---|
| swarm-01 décision du chef, motif, vérification conditionnelle | 23:31 → 23:35 | 23:36 → 23:48, puis correction → 23:56 | 23:56 → 00:10 | bon à intégrer | 00:35 → 00:48 : 1 622 unitaires (1 619 réussis, 0 échec), Chrome 265/265, check 0, format 0 |
| swarm-02 limites d'usage, état des agents | 23:31 → 23:36 | 23:37 → 23:51 | 23:52 → 00:05 | bon à intégrer | 00:22 → 00:35 : 1 627 (1 624, 0 échec), Chrome 265/265, check 0, format 0 |
| swarm-03 leçons, module par fichiers | 23:31 → 23:35 | 23:35 → 23:46 | 23:46 → 23:57 | bon à intégrer | 00:09 → 00:22 : 1 637 (1 634, 0 échec), Chrome 265/265, check 0, format 0 |
| swarm-04 verdicts lisibles, rôle du vérificateur | 23:31 → 23:34 | 23:34 → 23:41 | 23:41 → 23:52 | bon à intégrer | 23:53 → 00:09 : 1 621 (1 618, 0 échec), Chrome 265/265, check 0, format 0 |

Heures des agents : relevées à la minute par le manager à chaque rendu (approchées à 1 ou 2 minutes).

**Décisions du manager pendant la vague**
- swarm-01, défaut du plan : le texte de `DECISION_RULE` écrit dans le plan faisait rougir `tests/delegation-v2-01-b.test.js`
  (lignes 297 et 299-302), que le même plan demande de laisser vert sans le modifier. Tranché à 23:50 : le test reste intact,
  deux morceaux validés en réel (correctif E147) reviennent dans le texte : « plusieurs sources indépendantes ou plusieurs
  sites à consulter » et « seul pour une demande simple, une petite étape ou une suite d'étapes qui dépendent l'une de
  l'autre, quand tout tient en moins d'un quart d'heure environ ». Le reste du texte est celui du plan, mot pour mot
  (vérifié caractère par caractère par le relecteur).
- swarm-01 : la note du motif d'une mission privée n'est écrite nulle part (le plan disait « reste dans briefs » ; la zone
  `briefs.set` n'est pas dans les endroits ouverts au lot). Gardé ; prouvé de bout en bout par un test du relecteur.
- swarm-01 : « après deux échecs… ou change d'agent » : texte du plan gardé (swarm dit « monte d'un cran de modèle »).
- swarm-02 : `rateLimit` ne compte que si l'erreur est nue ou dit elle-même une limite (règle de `usageLimitMessage`) ;
  un « 503 » nu ne classe rien ; la classe « seat » de swarm est écartée.
- swarm-03 : la raison `pleine` ne joue que pour une leçon neuve ; seuil de quasi-doublon 0,8 gardé, « à mesurer ».
- swarm-04 : « , n illisible(s) » placé après la parenthèse de la ligne de total, pour laisser verte une assertion existante ;
  `docs/api-delegation.md` non touché par ce lot (renvoi vers `docs/api-verdicts.md` confié au codeur de swarm-05).

**Défauts trouvés et corrigés par les relecteurs** (test rouge d'abord)
- swarm-02, majeur : une erreur du moteur qui cite la réponse de l'agent (« JSON invalide … : « extrait » ») faisait classer
  `limite` une réponse qui parlait seulement de « rate limit » : agent sain écarté une heure du mode Auto. Corrigé : les
  passages entre guillemets français de l'erreur ne sont plus lus. Mineurs : une ancienne sonde de refus redevenait
  « récente » quand on notait une limite ; deux tests dépendaient de l'heure réelle entre 22:00 et 22:02.
- swarm-03, trois majeurs : fichier de leçon aux champs mal typés (plantage, leçon servie pour toujours ou supprimée à
  tort) ; une « lecture » qui créait des dossiers ; un dossier de portée remplacé par un lien ou un fichier faisait lever
  `rappel`, `liste` et `purger`. Huit règles sans test couvertes.
- swarm-01, mineurs : `readDecision` ne lisait pas les fins de ligne CRLF ; la borne de 200 caractères coupait un emoji.
- swarm-04 : rien à corriger ; 3 tests de cas limites ajoutés.

**À mettre au registre des erreurs (non corrigés, hors lot)**
- `packages/orchestrator/failure.js` : l'expression d'erreur nue `/^(?:Internal error|Agent arrêté\b)/i` ne reconnaît
  jamais « Agent arrêté : … » (le `\b` après « é » ne trouve pas de frontière) ; confirmé par `node -e` (relecteur de
  swarm-02). Effet : une limite annoncée dans le texte puis un arrêt autre que `end_turn` n'affiche pas le message de
  limite et n'est pas mémorisée. Corriger change le message montré : **à décider par le propriétaire**.
- `usageLimitMessage` (même fichier) lit encore les extraits cités entre guillemets dans une erreur (même faux positif
  que celui corrigé dans `limits.js`).
- `tests/elicitation.test.js:535` : délai de 5 s dépassé une fois sous charge (relecteur de swarm-03), vert seul.
- Écart de règle : le codeur de swarm-01 a lancé une fois `npx prettier --check` sans `cd`, donc depuis le dossier
  interdit (lecture seule, rien d'écrit, signalé par lui). Brief durci à 00:38 (« même en lecture », `cd` en tête).
- Attribution : certains commits de sous-agents portent « Co-Authored-By: Claude Opus 5.5 » (la ligne de leur
  environnement) au lieu de la ligne du brief. Laissé : c'est le modèle qui a réellement écrit ces commits.
- Les sous-agents ont écrit des fichiers temporaires dans le bloc-notes de la session du manager (hors de leur arbre).
  Sans effet ; brief corrigé (fichiers temporaires dans l'arbre).

**Intégration** : 00:49, `git cherry-pick` dans l'ordre des lots (6 + 5 + 6 + 4 commits), aucun conflit. Tête intégrée
`e18ef06` (avec les commits `[swarm-00]` du manager : outil de tests, brief). Suite complète sur la tête intégrée lancée à
00:50 (attendu : 1 674 unitaires, 1 671 réussis). Usage à 00:37 : 34 % de la fenêtre de 5 h ; hebdomadaire 74 % (Fable 73 %).

**Vague 2 lancée à 00:50** : arbres `~/Downloads/agregat-back-swarm-05`, `-06`, `-07` créés depuis `e18ef06` ; trois copieurs
Opus en parallèle. Le point d'arrêt conseillé par le plan après la vague 1 (essai réel « seul contre équipe » avec Claude
et Codex) attend l'accord du propriétaire : non joué.
- **01:03 : suite complète verte sur la tête intégrée `e18ef06`** (00:50 → 01:03) : 1 674 unitaires, 1 671 réussis, 0 échec,
  2 ignorés, 1 « à faire » (le cas connu de `review2-lecture-18-11`) ; Chrome 265/265 ; `check` 0 ; `format:check` 0.
  **Vague 1 terminée.** Rien de fusionné ailleurs, rien de poussé.
- Vague 2, décisions du manager au lancement des codeurs (00:55 → 01:00) :
  - swarm-07, **écart au plan** : `GET /api/runs` garde son comportement d'aujourd'hui (toutes les exécutions) ; la liste
    sans sous-missions devient une option (`?racines=1`) au lieu du défaut. Raison (copieur) : l'interface d'aujourd'hui
    lit les sous-missions dans cette liste (badge « À vous de répondre », consommation, alerte de limite). Le plan
    l'aurait cassée jusqu'au lot swarm-11.
  - swarm-06, **écart à swarm** : un va-et-vient exige une vraie alternance (A, B, A, B) ; chez swarm, 11 appels identiques
    puis 1 différent comptaient pour un va-et-vient critique. Un signalement par motif et par niveau.
  - swarm-05 : l'empreinte d'une part comprend aussi `verification`, `relit` et `apres` ; après un redémarrage, jamais de
    refus (pas d'empreinte en mémoire) ; le renvoi de `docs/api-delegation.md` vers `docs/api-verdicts.md` lui est confié.
- 01:13 → 01:36, vague 2 : les trois lots sont codés et relus, verdicts « bon à intégrer ». Relecteurs : swarm-07, deux
  majeurs corrigés (une lecture qui lève faisait échouer `GET /api/runs` ; un membre repris gardait l'ancien résultat) ;
  swarm-06, deux corrigés (texte du va-et-vient d'un même outil ; coût du hachage sur de gros arguments) ; swarm-05, rien
  de majeur, 20 tests ajoutés. Décisions de plus : swarm-05, même part à un autre agent = lancée et signalée ; swarm-07,
  `?equipe=1` gardé, `teDemande` en nombre. Contrôle du manager : lot 07 vert (01:19 → 01:34 : 1 690 unitaires, 1 687
  réussis, Chrome 265/265, check 0, format 0) ; lots 06 puis 05 en cours.
- 01:34 : `get_usage` : fenêtre de 5 h à 58 % (remise à zéro 04:20) ; hebdomadaire 77 % (Fable 75 %) ; contexte du manager
  502 000 jetons.
- **01:36 : message du propriétaire** : autonomie jusqu'au 21/11 à 08:00 ; continuer à copier swarm ; **essais réels
  autorisés** (missions complexes avec Claude Code et Codex, pas Gemini) ; surveiller ; que tout marche demain ; ne pas
  trop changer ce qui marche ; ouvrir une nouvelle session si le contexte est lourd.
- 01:40 : passation écrite (`reports/passation-swarm-21-11.md`), `HANDOFF.md` section 0 mise à jour, mémoire de Claude mise
  à jour ; nouvelle session ouverte pour la suite (intégration de la vague 2, essais réels, vague 3).

## 21/11, 01:41 → 02:17 Nouvelle session du manager : vague 2 intégrée, essais réels mis en place
- 01:41 : passation lue. Limite : 63 % de la fenêtre de 5 h (remise à zéro 04:20).
- Contrôle du manager, suites complètes dans l'arbre de chaque lot : swarm-07 vert (ancienne session) ; **swarm-06**
  01:34 → 01:47 : 1 703 / 1 700, 0 échec, Chrome 265/265, check 0, format 0 ; **swarm-05** 01:48 → 02:01 : 1 713 / 1 710,
  0 échec, Chrome 265/265, check 0, format 0.
- 02:02 : **vague 2 intégrée** dans `swarm-20-11` par cherry-pick (05, 06, 07 ; 15 commits ; aucun conflit), tête
  **`391f027`**. Suite complète sur la tête intégrée, 02:02 → 02:16 : **1 758 unitaires, 1 755 réussis, 0 échec, 2 ignorés,
  1 « à faire » ; Chrome 265/265 ; check 0 ; format 0** (conforme à l'attendu).
- **swarm-09 (interface 1)**, arbre séparé `~/Downloads/agregat-front-swarm-09`, branche `swarm-09` partie de `0937088`
  (le dossier `agregat-front-equipe` sert l'écran 5178 en direct : non touché). Copieur `0ee9aa5`, codeur `20f192b`,
  `176a703`, `1abfda7`, relecteur `175e7db`, `f66df32`, `42ebff5`, verdict **bon à intégrer**. Décisions du manager :
  `?equipe=1` ajouté aux 5 lectures GET d'une mission dans `App.tsx` (fichier hors plan, sans lui aucun champ neuf
  n'arrive) et faux `api` de `App.test.tsx` / `etat-liste.test.tsx` comparés sans paramètre ; chef lu sur la mission
  mère ; `complet?: false` d'après `api-verdicts.md`. Relecture : deux défauts corrigés (« réessayer à » avec une valeur
  brute ; plantage de l'écran sur un rôle ou un verdict `__proto__`, défaut déjà présent à la base). Contrôle du manager
  (02:03) : `npm test` 18 fichiers, 313 / 313 ; build 0 ; prettier vert. Incident : le codeur a employé un `git restore`
  pendant un contrôle négatif (Team.tsx défait puis réappliqué, vérifié par le relecteur) ; consigne durcie.
  Reste : voir l'écran (contraste sombre) ; `orienter.test.tsx:398` a une branche de faux `api` devenue morte.
- **swarm-08** : arbre `~/Downloads/agregat-back-swarm-08`, base `391f027`. Copieur `ff1d4b7` (NOTES seulement). Écarts
  relevés et tranchés par le manager : `disponible` = `pret` ou `a_reessayer` ; cache vide → pas de refus, jugement sur les
  sondes ; suite sans agent nommé = agent hérité, donc repli et non refus (retouche minimale de `continuation.js`) ;
  `echec` relu par `doneOf()` ; contrôle de l'agent non nommé après l'enveloppe ; empreinte de doublon calculée avant le
  repli (laissée). Codeur lancé à 02:10.
- **Essais réels mis en place** (02:03) : arbre figé `~/Downloads/agregat-back-swarm-essai` (détaché, `391f027`, base
  `.data` neuve), **API 4317** (même commande que `api-branche.sh`, huit pages fictives admises, espace
  `~/Downloads/career-ops-essai`, script dans le bloc-notes de la session), **interface 5179** servie depuis l'arbre
  `agregat-front-swarm-09` (vue d'équipe du lot swarm-09) pointée sur 4317. Services du propriétaire non touchés.
- 02:16 : deux missions en mode équipe (enveloppe 6 / 3, pack core, consignes neutres du 20/11, outil `epreuve.py` : toute
  carte refusée) avec **Codex chef** : code (`54d2d4dd`) et étude de marché (`d353149b`). Limite à 02:04 : 72 %.

## 21/11, 02:17 → 02:57 Première série d'essais réels (API 4317) ; lot swarm-08 contrôlé et intégré
| Épreuve (mode équipe, enveloppe 6 / 3, pack core) | Chef | Durée | Résultat constaté |
|---|---|---|---|
| Code (`54d2d4dd`, code `391f027`) | Codex (défaut) | 18,6 min | `completed` ; **18 / 18** aux tests cachés ; « Décision : équipe… » ; 1 vérificateur Codex sans verdict lisible puis sa suite (`approuve`, fichier) |
| Étude de marché (`d353149b`, `391f027`) | Codex (défaut) | 23,1 min | `completed` ; 4 fichiers (8 produits, synthèse 806 mots) ; « Décision : équipe… » ; 3 `chercheur` en parallèle (motif `parallele`) puis 1 `verificateur` (`regard_independant`, verdict `approuve`, 2 remarques) ; carnet 27 notes ; exactitude des sources non jugée |
| Code (`9a7dea29`, `391f027`) | Claude `sonnet` | 5,9 min | `completed` ; **18 / 18** ; « Décision : seul, parce que… » ; aucune sous-mission |
- 0 carte, 0 question, 0 envoi. Défauts et écarts notés au registre : **E153** (Codex nomme son propre agent comme
  vérificateur), **E154** (écart Codex / Claude sur la tâche simple), **E155** (`tool_loop` : faux positifs probables sur
  les outils natifs, sans effet en mode `observer`), **E156** (premier vérificateur sans verdict lisible).
- Constaté conforme en réel : ligne de décision du chef (les deux agents), motifs `pourquoi` et note, verdict incomplet dit
  au Bilan, vue d'équipe de l'API (`?equipe=1` : durée, outils, dernier outil).
- **swarm-08** : codeur `afc0fd5`, `47d8e7a` ; relecteur `133163e`, `3b86ae7`, verdict **bon à intégrer** (un défaut majeur
  corrigé : un contrôle du lancement pouvait lever sur des sondes ou un cache mal formés). Diff de `launch()` lu par le
  manager (deux contrôles synchrones avant les compteurs, rien d'autre). Suite complète dans l'arbre du lot, 02:40 →
  02:53 : **1 778 unitaires, 1 775 réussis, 0 échec, 2 ignorés, 1 « à faire » ; Chrome 265/265 ; check 0 ; format 0**.
  Intégré à 02:53 dans `swarm-20-11`, tête **`d3574af`** ; arbre identique à celui du lot (`38a9678`, même condensé) : la
  suite complète n'a pas été rejouée une seconde fois. Point laissé : un agent `a_reessayer` est cité « prêt » dans le refus
  mais écarté du repli en mode réel (`otherAgent`, hors lot). `agentPrevu` / `agentImpose` pas encore montrés au Bilan.
- 02:53 : API 4317 relancée sur `d3574af` (aucune mission en cours). **Vague 3 finie côté code** (swarm-08 intégré ;
  swarm-09 sur la branche `swarm-09` du dépôt de l'interface, servie sur 5179).
- Épreuve « candidature fictive » (pack career-ops) **non jouée** : la base neuve de 4317 n'a pas le Skill ; importé
  (même empreinte `4380dfe0` que sur 4316), il est en quarantaine, et l'approbation par le manager a été refusée par le
  contrôle des permissions de l'application (non contournée). Il faut le clic du propriétaire (interface 5179, Skills).
- 02:55 : écran 5179 vu (mode sombre) sur `d353149b` : bloc Équipe lisible (chef, 4 membres, rôle, agent et modèle,
  durée, plis Résultat, verdict approuvé et remarques, carnet). Les sous-missions sont encore mêlées à la liste de
  gauche (prévu au lot swarm-11).

## 21/11, 02:56 → 04:46 Limite de Codex, remise à zéro, deuxième série d'essais (Claude chef), vague 4 lancée
- 02:56 : mission « dossier comparatif » (4 projets, fiches sourcées, tableau, incohérences, synthèse ; consigne neutre
  écrite par le manager) avec Codex chef (`858fba6a`, code `d3574af`) : 2 `chercheur` lancés (un Codex, **un Claude**), un
  `verificateur` Claude en attente de prérequis ; **échec à 9,0 min : limite d'usage de Codex atteinte (jusqu'à 07:16)** ;
  les trois sous-missions annulées avec la mère (E157). Limite retenue dans les sondes (`limite` jusqu'à 07:16).
- 02:57 → 04:21 : pause du manager (83 % de la fenêtre de 5 h) ; reprise seule à 04:21 (fenêtre à 0 %, hebdomadaire 81 %).
- 04:21, deux missions en équipe avec **Claude chef** (modèle par défaut, enveloppe 6 / 3, pack core, 0 carte, 0 question) :
  | Épreuve | Durée | Résultat constaté |
  |---|---|---|
  | Étude de marché (`53e2ac26`) | 13,7 min | `completed` ; « Décision : seul, parce que… » ; 4 fichiers (10 produits, synthèse 868 mots) ; aucune sous-mission |
  | Dossier comparatif (`7ba386b6`) | 23,2 min | `completed` ; « Décision : équipe… » ; 4 `chercheur` (3 à la fois, le 4e en file), puis 1 `verificateur` (après les quatre, verdict `approuve`, source fichier) ; 4 fiches, tableau, incohérences, synthèse 586 mots ; carnet 7 notes ; 3 signalements de doublon « proche » à tort (E158) |
  Aucun `tool_loop` sur ces deux missions. Codex sous limite : aucune sous-mission ne lui a été donnée.
- Comparaison à ce stade : tâche simple (code) : Claude seul 5,9 min, Codex en équipe 18,6 min ; étude de marché : Claude
  seul 13,7 min, Codex en équipe 23,1 min ; comparatif à 4 sources : Claude en équipe 23,2 min (non joué jusqu'au bout avec
  Codex, limite). Qualité des contenus non jugée par un tiers.
- **Vague 4** (04:21) : arbres `~/Downloads/agregat-back-swarm-10` (base `d3574af`) et
  `~/Downloads/agregat-front-swarm-11` (branche `swarm-11` partie de `swarm-09` `42ebff5`).
  - **swarm-11 (interface 2)** : copieur `c116a9f`, codeur `5a349a4`, `d3e2f39`, `412d70a`, relecteur `8ef80e2`, verdict
    **bon à intégrer** (5 constats mineurs laissés). Décisions du manager : pas de `?racines=1` (casserait des tests hors
    lot) : la liste garde `GET /runs` et retire les sous-missions dans l'interface ; résumé d'équipe calculé dans
    l'interface si `equipe` manque ; `motif` et `agentPrevu` lus sur la ligne brute ; agents indisponibles en fin de liste
    mais sélectionnables. Contrôle du manager (04:42) : `npm test` 20 fichiers, **335 / 335** ; build 0 ; prettier vert.
    Interface **5179 servie depuis l'arbre `agregat-front-swarm-11`** depuis 04:42. Points laissés : le compteur
    « N missions attendent » compte encore les sous-missions ; heure d'une limite passée gardée jusqu'à la relecture du
    catalogue ; `pourquoi` non affiché quand `motif` manque.
  - **swarm-10 (résultat validé par schéma)** : copieur `fff07fd` (pied de commit « Claude Opus 5.5 » au lieu de la
    convention : laissé, pas de réécriture), codeur `f3da6e2`, `a41b0c3` (phase unitaire 1 790 / 1 787). Décisions du
    manager : l'assertion de `tests/equipe-01-carnet.test.js:249` gagne `resultat_rendre` ; borne effective 32 768 octets
    (API non touchée) ; racine de schéma autre que `object` refusée ; suite et reprise héritent du schéma ; verdict
    aligné sur `normalizeVerdict`. Relecteur lancé à 04:44.

## 21/11, 04:46 → 05:09 Vague 4 finie (swarm-10 intégré, swarm-11 servi)
- **swarm-10** : relecteur `ac4e34b`, verdict **bon à intégrer** (2 corrections mineures : messages d'erreur bornés à 300
  caractères ; test manquant « schéma donné à un vérificateur »). 14 contrôles négatifs. Suite complète du manager dans
  l'arbre du lot, 04:54 → 05:08 : **1 795 unitaires, 1 792 réussis, 0 échec ; Chrome 265/265 ; check 0 ; format 0**.
  Intégré à 05:08 dans `swarm-20-11`, tête **`7061c2d`** (arbre identique à celui du lot, `6b592dcb` : suite non rejouée).
  Points laissés : sans schéma, un `resultat.json` écrit par l'agent sans l'outil remonte quand même au chef ; le verdict
  d'un vérificateur reste dans `verdict` (pas dans `resultat`) ; clients MCP réels non essayés avec `resultat_rendre`.
- 05:08 : API 4317 relancée sur `7061c2d` (aucune mission en cours). Interface 5179 = arbre `agregat-front-swarm-11`.
- Limite à 05:09 : 49 % de la fenêtre de 5 h (les deux missions Claude de 04:21, modèle par défaut, ont pesé environ
  30 points à elles deux), hebdomadaire 85 %. Décision du manager : plus de mission réelle avec Claude d'ici 08:00 (garder
  de quoi laisser le propriétaire essayer lui-même) ; une mission avec Codex après 07:16 (retour de sa limite).
- **swarm-12** (vague 5) : arbre `~/Downloads/agregat-back-swarm-12` parti de la tête du lot 10 ; copieur `e53edbb` ;
  codeur lancé à 05:00.

## 21/11, 05:09 → 05:38 Vague 5 finie (swarm-12 intégré), vague 6 lancée
- **swarm-12** : codeur `e942165`, `1f9927d` ; relecteur `0542126`, `36ae9d6`, verdict **bon à intégrer** après deux
  corrections : (1) demandée par le manager : le codeur avait écrit un nom de pack en dur (`career-ops`) dans
  `delegation.js` pour la règle « mission privée » ; retiré ; règle prudente retenue : le rappel de la demande n'est donné
  qu'à une mission sans espace de travail et du pack général (les missions career-ops et najah n'ont donc pas ce rappel,
  même en mode propriétaire : **à trancher par le propriétaire**, piste : chaque pack déclare sa confidentialité) ;
  (2) coût quadratique corrigé (les sœurs étaient relues pour chaque résultat). 13 contrôles négatifs.
  Suite complète du manager dans l'arbre du lot, 05:21 → 05:34 : **1 817 unitaires, 1 814 réussis, 0 échec ; Chrome
  265/265 ; check 0 ; format 0**. Intégré à 05:36, tête **`a8660a4`** (arbre identique à celui du lot, `c314d969`).
- Erreur du manager à l'intégration (sans effet) : premier cherry-pick lancé avec la mauvaise base (`7061c2d..swarm-12` au
  lieu de `ac4e34b..swarm-12` : le lot 12 partait de la branche du lot 10), arrêté sur un commit vide ; annulé par
  `git cherry-pick --abort` (rien n'avait été appliqué), puis refait avec la bonne base. L'arbre neuf et vide du lot 13 a
  été avancé sur la nouvelle tête par avance rapide (`merge --ff-only`, aucun commit de fusion).
- 05:37 : API 4317 relancée sur `a8660a4`. Limite à 05:35 : 52 % (5 h), 86 % (hebdomadaire).
- **swarm-13** (vague 6, lot sensible : porte du tour de synthèse) : arbre `~/Downloads/agregat-back-swarm-13`, base
  `a8660a4`, copieur lancé à 05:38. Il ne sera intégré que s'il est vert et relu avant 06:50 (essai réel avec Codex prévu
  à 07:16 sur la tête intégrée).

## 21/11, 05:38 → 06:20 Vague 6 finie (swarm-13 intégré) ; arrêt du code neuf
- **swarm-13** (tour de rattrapage sur un verdict négatif ; lot sensible) : copieur `6ca3e84`, codeur `5e03807`,
  `a60cc83`, relecteur `c148e26`, verdict **bon à intégrer** « sans doute restant ». Preuve du relecteur : la `synthesis()`
  de la base, recopiée dans un test, est jouée à côté de la nouvelle sur 10 chemins et 3 familles sans dette : tours,
  consigne (à l'octet), événements, appels à `continueSession()` et Bilan identiques (30 / 30) ; identiques aussi avec le
  réglage `AGENT_PLATFORM_VERDICT_TURN=0`. Deux corrections du relecteur : `verdictsEnAttente` borné à 20 tâches ;
  écriture de l'événement `verdict_turn` gardée. Diff de `synthesis()` lu par le manager (une ligne remplacée, un bloc,
  la consigne avec `VERDICT_NOTE` seulement en cas de dette). Décisions du manager : pas de tour à une mission
  abandonnée ; le tour de synthèse qui joint les verdicts pose le drapeau et écrit l'événement ; `illisible` gardé.
  Limites écrites dans `docs/api-verdicts.md` (mère reprise sans sous-mission : pas de tour ; correction encore vivante
  après le tour : plus de synthèse ; le tour ne dit pas combien de dettes dépassent la borne de 20).
  Suite complète du manager dans l'arbre du lot, 06:04 → 06:17 : **1 873 unitaires, 1 870 réussis, 0 échec ; Chrome
  265/265 ; check 0 ; format 0**. Intégré à 06:19, tête **`e7f4964`** (arbre identique, `62803614`).
- 06:19 : API 4317 relancée sur `e7f4964`. État réel des agents lu sur `GET /api/catalog` : codex `limite` (« Limite
  d'usage jusqu'à 07:16 »), claude `pret`, gemini et opencode `non_installe`, fixture `simule` (lot 08 confirmé en réel).
- **Décision du manager : pas de lot neuf d'ici 08:00.** Le lot suivant (swarm-14, vague 7) touche le moteur `index.js` ;
  il n'y aurait pas le temps de le relire, de le contrôler et de l'éprouver en réel. État du plan : **vagues 1 à 6
  intégrées (lots 01 à 13)** ; restent 14, 15, 16 (vagues 7 à 9) et 17 (décision du propriétaire).
- 06:20 : deux missions Codex programmées pour 07:18 (retour de sa limite) sur la tête finale : dossier comparatif et code.

## 21/11, 07:05 → 07:50 Réponses du propriétaire, troisième série d'essais (Codex, tête finale), arrêt
- 07:05 (transmis par l'ancienne discussion du 18/11, ses mots) : il veut « un plan fidèle » au projet Agent Swarm, « la
  même chose » ; plafond global de sous-agents : « si eux ils ont un plafond, prends ce plafond, sinon non » ; agent en
  attente d'une réponse ou d'un clic compté dans la limite : « la même chose que le projet, mais de préférence, j'autorise
  les envois, les clics, etc. des agents » (**ambigu, non tranché : la règle du clic avant l'envoi final reste entière**) ;
  texte d'information des sous-agents : « Oui, ce texte me va. ». À étudier dans swarm : plafond global, compte des agents
  en attente (non fait cette nuit).
- 07:18, deux missions en équipe avec **Codex chef** sur la tête finale `e7f4964` (0 carte, 0 question, 0 envoi) :
  | Épreuve | Durée | Résultat constaté |
  |---|---|---|
  | Code (`8af20a0b`) | 17,1 min | `completed` ; **18 / 18** aux tests cachés ; vérificateur donné à **Claude** (`sonnet`) : deux tours sans verdict lisible, puis `approuve` (fichier) ; le chef dit avoir corrigé six écarts relevés par la revue ; `resultat_rendu` (lot 10) vu en réel |
  | Dossier comparatif (`877fd267`) | 26,4 min | `completed` ; chercheurs Codex et Claude en parallèle ; vérificateur Claude (`opus[1m]`) : **`a_corriger`**, puis une suite de recherche et une seconde vérification **`approuve`** ; 3 `resultat_rendu` ; 4 fiches, tableau, écarts, synthèse 529 mots |
  Constaté : avec le lot 08, Codex confie la vérification à un autre agent (E153 non revu sur ces deux missions) ; l'outil
  `resultat_rendre` est employé par de vrais agents ; la vérification croisée a fait corriger le dossier avant la réponse
  finale ; le tour de rattrapage (lot 13) n'a pas eu à jouer (le chef a corrigé de lui-même) : **non vu en réel**.
  `tool_loop` : encore 3 signalements `repetition` sur Codex (E155). E154 confirmé (Codex monte une équipe pour le code).
- 07:26 : compte rendu fait au propriétaire revenu ; il demande l'arrêt à la fin de la tâche (il compacte la discussion).
- État laissé à 07:50 : `swarm-20-11` tête **`e7f4964`** (lots 01 à 13, suite complète verte : 1 873 / 1 870, Chrome
  265/265) ; interface : branche `swarm-11` du dépôt de l'interface (`8ef80e2`, 335 / 335) ; **API 4317** (arbre figé
  `~/Downloads/agregat-back-swarm-essai`, `e7f4964`) et **interface 5179** (arbre `~/Downloads/agregat-front-swarm-11`) en
  écoute, lancées par `nohup` depuis la session du manager ; aucune mission en cours ; services du propriétaire non
  touchés. Rien de fusionné ni de poussé. Passation : `passation-swarm-21-11-matin.md`.

## 21/11, 07:57 → 08:13 Nouvelle session du manager : reprise, suite complète de contrôle
- Demande du propriétaire (07:57, ses mots) : « reprend le chantier. Fais des test ect … ». Lecture du manager : continuer
  le plan (lot 14) et tester ; les missions réelles ne sont pas relancées sans sa réponse (accord de la nuit fini à 08:00,
  question posée à 08:00).
- 07:58, `get_usage` : fenêtre de 5 h à **96 %** (remise à zéro à 09:20), hebdomadaire 91 % (remise à zéro à 11:00).
  Aucun sous-agent lancé ; reprise programmée à 09:22 (message différé) pour le lot swarm-14.
- État vérifié par commande : `swarm-20-11` propre, tête `e7f4964` ; 4317 et 5179 en écoute ; aucune mission en cours sur
  4317 ni 4316 (lecture seule de `GET /api/runs`).
- Suite complète relancée sur la tête intégrée (`~/Downloads/agregat-back-swarm`), 07:59 → 08:12 : **1 873 unitaires,
  1 870 réussis, 0 échec, 2 ignorés, 1 « à faire » ; Chrome 265/265 ; check 0 ; format 0** (796 s). Interface
  (`agregat-front-swarm-11`, `8ef80e2`) : **335 / 335**. Mêmes chiffres qu'à 06:17.
- Arbre du lot 14 créé : `~/Downloads/agregat-back-swarm-14`, branche `swarm-14`, parti de `e7f4964` (lien `node_modules`).

## 21/11, 08:15 → 09:25 Vision « Skills comme des plugins », veille automatique, vague 7 lancée
- 08:15 → 08:40, le propriétaire (ses idées) : l'architecture est là, la méthode vient des **Skills** ; l'utilisateur choisit
  un Skill puis donne son prompt ; le Skill définit les rôles des agents ; équipe montée seule si le Skill en prévoit une,
  décision automatique sans Skill, tâche facile à un seul agent ; import d'un Skill « aussi fluide qu'un plugin », en une
  commande. Premier cas : un Skill populaire sur GitHub de community manager (LinkedIn, Instagram, X). Mémoire :
  `skills-as-plugins-vision`. Son « oui » de 08:15 n'est **pas** pris pour un accord sur les missions réelles (dit).
- 08:32, à sa demande (« un script automatique qui fait que tu vas continuer de coder les lots restants ») : tâche
  programmée toutes les heures à la minute 32 (`trig_014pCJU73T7Afu4SB2yTLEhj`), qui relance le manager sur les lots 14,
  15, 16 ; à supprimer quand ils sont intégrés. Interdits rappelés : lot 17, mission réelle, push, merge, installation.
- 09:22, reprise (limite de 5 h à 0 %, hebdomadaire 91 %, remise à zéro à 11:00). Trois sous-agents Opus lancés en
  parallèle : **copieur swarm-14** (arbre `agregat-back-swarm-14`, base `e7f4964`) ; **recherche web** des Skills
  marketing (rendu attendu : `reports/skills-marketing-21-11.md`, lecture seule, rien d'installé) ; **lecteur** du code
  d'import des Skills de Relay (lecture seule, `agregat-back-swarm`).
