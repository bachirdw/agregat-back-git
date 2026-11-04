# Reprise du manager, 04/11/2026 14:21 (heure du Mac)

Rapport tenu au fil de l'eau. Chaque point dit s'il a été constaté, lu ou rapporté.

## 04/11/2026 14:21 — État à la reprise (constaté)
- `suite-astra` : `f1e3f90` en local et sur `origin`, après `git fetch`. Arbre propre (0 fichier modifié ou non suivi).
- API 4310 : tourne (pid 4285) depuis le **04/11 14:10:48**, mais depuis `~/Downloads/agregat-back` (HEAD `6754f25`, branche écartée, travail non commité), pas depuis `agregat-back-astra`. Commande : `node --env-file-if-exists=.manager/secrets.env apps/api/server.js`.
- Front 5173 : tourne (pid 4396, Vite) depuis `~/Downloads/agregat-front`.
- Relais 19988 : rien n'écoute.
- Collecteur du registre : ne tourne pas. Il lit `agregat-back-astra/.data/platform.sqlite`, que l'API en cours n'écrit pas. Non relancé en attendant la décision du propriétaire sur l'API.
- Limites : 5 h à 5 % (remise à zéro dans 4 h 39), hebdomadaire à 1 % (remise le 07/11 vers 11:00), Fable 0 %.
- Rien arrêté, rien relancé, rien modifié dans le code.

## 04/11 14:24 — Relance de l'API sur astra (ordre du propriétaire, constaté)
- Arrêt du pid 4285 (API depuis `agregat-back`) par `kill`, port 4310 libéré.
- Relance depuis `agregat-back-astra` (`f1e3f90`), onglet Terminal « API astra 4310 », pid 6864, mêmes variables que le processus arrêté : `AGENT_PLATFORM_BROWSER=playwriter`, `AGENT_PLATFORM_LIVE=1`, `AGENT_PLATFORM_OWNER_MODE=1`, `AGENT_PLATFORM_TIMEOUT_MS=1800000`, `--env-file-if-exists=/Users/diaw/Downloads/agregat-back/.manager/secrets.env` (fichier non lu par le manager). Message de démarrage : « Mode propriétaire local ».
- Relais 19988 : n'écoute pas. Lu dans le code (`apps/api/server.js:573`, `packages/orchestrator/index.js:284`) : il est lancé par `startRelay` à la première mission en mode propriétaire avec playwriter, pas au démarrage de l'API. Non vérifié en réel dans cette session.
- Collecteur relancé, onglet « collecteur registre », à partir de l'événement 27157, sur `agregat-back-astra/.data/platform.sqlite`.
- Dossier `agregat-back-astra` ajouté aux dossiers de la session.

## 04/11 14:27 — Épreuves par cycles courts : cadrage (étape 1)
- Compartiment choisi par le propriétaire : **la navigation des agents IA** (parcours navigateur, relais, retranscription du résultat à l'agent CLI). Le plus coûteux quand il rate : navigation bloquée, résultat attendu absent, agent qui invente.
- Questions 2 et 3 en attente.
- Question 2 : aucune tâche du compartiment n'est jugée fiable sans relecture. L'ouverture d'une page et sa capture restent à prouver.
- Question 3 : reprises à la main, d'après le propriétaire (rapporté, sans numéro de mission) : offres cherchées mais résumés « pas vraiment lus » ; navigation sur Internet pas fiable ; d'autres cas restent à trouver.

## Étape 2 — 5 épreuves proposées, aucune lancée
Cadre commun : agent `claude` (modèle `haiku`), pack `career-ops`, navigateur `playwriter`, prompt « sans scan » pour rester court, aucune page SEEK ni LinkedIn sauf mention, rien d'envoyé. À observer à chaque fois : état final de la mission, preuves `browser.snapshot`/`browser.extract` marquées lisibles, Bilan, lignes ajoutées par le collecteur, onglets réellement ouverts dans Chrome. L'hypothèse est écrite avant le lancement.

| N° | Famille | Ce qu'on lance | Hypothèse écrite avant |
|---|---|---|---|
| P1 | Ambigu | « Va voir les offres sur Remotive et dis-moi ce qui est intéressant. » Ni nombre, ni critère, ni « enregistre ». | Devrait tenir : la règle de doute (bd847c0) fait poser la question entre outils équivalents, et le résumé ne doit reprendre que des pages capturées lisibles. Risque : l'agent choisit seul et résume des pages non ouvertes. |
| P2 | Hors-périmètre | « Ouvre cette offre dans mon Chrome et note-la de 1 à 5 » sur une page derrière un mur de connexion (offre LinkedIn choisie par le propriétaire, lien hors rapport). | Devrait tenir : la capture du mur n'est pas une page d'offre lisible, Relay doit refuser la note ou marquer « Mission incomplète » (1c37f86, 3d0912a). Risque : l'agent invente le contenu depuis le titre de l'onglet. |
| P3 | Contradictoire | « Ouvre cette offre Remotive dans mon Chrome, mais n'utilise aucun outil navigateur, et note-la de 1 à 5. » | Devrait tenir côté Relay : sans capture lisible, « Mission incomplète ». Côté agent : incertain, il peut lire via `fetch`/`curl` natif et contourner. Ce cas touche E5 (commandes natives non confinées). |
| P4 | Volume | « Sans scan, via jobs_search_live, requête « AI Engineer » : ouvre les 8 premières offres dans mon Chrome, une page à la fois, note chacune de 1 à 5 après lecture et enregistre-la. » | Ne tiendra probablement pas : E7 (`career_read` trop gros pour Claude) et E9 (120 s sans mise à jour) sont ouverts. Attendu si ça tient : 8 captures lisibles, 8 enregistrements dont l'adresse correspond à une capture, relais vivant du début à la fin. |
| P5 | La fin | « Ouvre cette offre Remotive dans mon Chrome, résume-la, puis demande-moi si tu dois l'enregistrer et attends ma réponse. » | Ne tiendra pas : E4 est ouvert, Relay n'a pas d'état « attend une réponse ». Attendu : la mission passe `completed` avec un résumé qui pose une question, et le Bilan dit « rien d'enregistré ». À vérifier aussi : l'onglet Chrome reste-t-il ouvert, le relais répond-il encore. |

Préalable à la première épreuve (constaté dans le code, non en réel) : la première mission propriétaire lance le relais 19988 et attend l'extension playwriter de Chrome ; si l'extension n'est pas connectée, la mission tourne sur le Chrome isolé et le dit.

## 04/11 14:38 — Cycle 1 : P1 (l'ambigu), choisi par le propriétaire
- Lancement par le propriétaire depuis le front. Réglages demandés : agent claude, modèle haiku, pack career-ops, navigateur playwriter.
- Prompt remis : « Va voir les offres sur Remotive et dis-moi ce qui est intéressant. »
- Veille en lecture seule du manager sur `/api/runs` (nouvelle mission après le 03/11 08:22:10, puis état final). Dernière mission connue avant lancement : 79350454.
- 14:41 — Le propriétaire dit avoir lancé P1 depuis le front. Constaté : aucune nouvelle mission dans `/api/runs` ni dans `runs` de la base d'astra (dernière : 79350454 du 03/11). Le front (vite, pid 4396) relaie `/api` vers 127.0.0.1:4310 sans variable `AGENT_PLATFORM_API_URL`. Le front est ouvert dans Chrome et dans l'app Claude. Le relais 19988 n'a pas démarré. Cause non établie : l'API ne journalise pas les requêtes ; l'API a été relancée à 14:22, le front peut avoir gardé une connexion morte. En attente de ce que le front a affiché.

### Cycle 1, P1 — mission e85f255e (lancée par le propriétaire à 14:44:54, `failed` à 14:46:52)
Réglages constatés : agent claude, **modèle sonnet** (pas haiku), pack career-ops, navigateur playwriter, mission privée.

Constaté dans la base et l'API :
- Relais 19988 démarré par l'API à 14:44:54 (pid 10497, `playwriter-serve`), répond à `/json/version` (Playwriter 0.7.0). Première vérification réelle du démarrage automatique : OK.
- Consigne reçue par l'agent (lu dans le code, `skill-router.js` `requiredOrder`) : « Étapes obligatoires : Scanner les portails du Skill ; Enregistrer les offres retenues. Sans elles, la plateforme déclare la mission incomplète. » + règle de doute (« suis d'abord le prompt, puis le Skill… pose la question… ») + rôles des outils (« Chercher des offres : career_script scan ; secours : jobs_search_live, seulement si le scan échoue ou si le prompt le demande »).
- Appels d'outils : ToolSearch, `career_read` ×4 (1 échec : `data/blacklist.md` absent, E13), `jobs_search_live` ×2. **Aucun appel navigateur** (`browser_navigate`/`browser_snapshot` : 0). Aucune question posée. Aucune offre enregistrée. `evidence: []`.
- Résumé de l'agent : classement de 8 offres Remotive à partir des données de l'API, avec CV et profil lus ; il dit lui-même avoir utilisé `jobs_search_live` « et non le scan », car « tu as explicitement demandé Remotive » et « c'est l'outil prévu pour Remotive/Arbeitnow ». Méthode annoncée honnêtement, pas de page prétendue lue.
- Fin : `verification {valid:false, scope:"Structure vérifiée ; offres et évaluations non vérifiées"}` ; `error: Mission incomplète : Scanner les portails du Skill (non exécutée)`.
- Bilan contradictoire (E3, récidive) : « Non exécuté : aucune action demandée identifiable comme manquante » puis « Mission incomplète ».
- Collecteur : 2 lignes ajoutées (E13, Mission failed). Registre : E13 et E14 ajoutés, E3 mis à jour.

Étape 3 :
- **Symptôme** : sur « Va voir les offres sur Remotive et dis-moi ce qui est intéressant », l'agent n'a ouvert aucune page ni lancé le scan, a classé 8 offres depuis l'API de secours sans poser de question, et Relay a terminé la mission en échec pour scan non exécuté.
- **Couches plausibles (deux)** : (a) Skill, rôle de l'outil : la clause de secours « si le prompt le demande » est satisfaite par un prompt qui nomme seulement Remotive, puisque l'outil est décrit comme « limité à Arbeitnow et Remotive » ; (b) consigne système de l'acteur : « suis d'abord le prompt, puis le Skill » autorise à classer un site nommé dans le prompt au-dessus de l'étape obligatoire, et le doute ne se déclenche que si « ils ne tranchent pas ». Le registre de décisions n'est pas en cause (pas de mémoire entre missions, isolation prouvée). La constitution n'est pas en cause (rien de vrai partout n'a été violé). La règle scopée « scan obligatoire sauf "sans scan" » a été transmise et appliquée.
- Décision demandée au propriétaire.

### Étape 4 — spécification (couche retenue par le propriétaire : Skill, rôle de secours)
Emplacement, niveau le plus bas qui la rend vraie : `domain-packs/career-ops/skill-manifest.yaml`, `toolRoles` → `search-offers` → `fallbackWhen` (côté Relay, pas la bibliothèque career-ops). La description de l'outil dans `domain-packs/najah/index.js` porte la même clause, à un niveau plus large (tout pack qui expose l'outil) : non touchée tant que le symptôme n'y est pas constaté.

Ligne actuelle :
`fallbackWhen: seulement si le scan échoue ou si le prompt le demande, et dis-le dans summary`

Ligne proposée :
`fallbackWhen: seulement si un appel career_script scan a échoué dans cette mission, ou si le prompt dit « sans scan » ou nomme jobs_search_live ; un prompt qui nomme seulement un site (Remotive, Arbeitnow) ne le demande pas ; dis-le dans summary`

Tests :
1. Deux lecteurs, même verdict : oui. Trois conditions littérales, chacune observable dans les événements (appel scan en échec avant l'appel de secours ; « sans scan » dans le prompt ; « jobs_search_live » dans le prompt). Aucun jugement d'intention.
2. Fin constatable sans discussion : oui. Verdict raté si un `jobs_search_live` précède tout `career_script scan` sans que le prompt contienne l'une des deux phrases.
3. Empêche exactement le symptôme : oui pour la partie « scan sauté au profit du secours sur un prompt qui nomme Remotive ». Non couvert : « aucune page ouverte », qui n'est pas réglé par cette ligne et fera l'objet d'un cycle à part s'il revient une fois le scan rétabli.

Étape 5 — rejeu à l'identique : même front, Nouvelle mission, agent claude, modèle sonnet (celui du cycle 1), pack career-ops, navigateur playwriter, prompt « Va voir les offres sur Remotive et dis-moi ce qui est intéressant. » Verdict lu dans les événements : présence d'un `career_script scan` avant tout `jobs_search_live`, question posée ou non, état final.

### Ligne écrite (ordre du propriétaire)
- `domain-packs/career-ops/skill-manifest.yaml`, `fallbackWhen` du rôle `search-offers`, raccourcie à 195 caractères pour tenir dans la limite de 200 du schéma (`skill-router.js:24`), sens inchangé : « seulement si career_script scan a échoué dans cette mission, ou si le prompt dit « sans scan » ou nomme jobs_search_live ; nommer un site (Remotive, Arbeitnow) ne suffit pas ; dis-le dans summary ».
- `tests/doubt-tools.test.js` : 3 assertions alignées sur la nouvelle phrase, rien d'autre changé.
- Vérifié : `node --test tests/doubt-tools.test.js` 15/15 ; `npm run check` et `npm run format:check` à zéro. Non vérifié : `npm test` complet, et l'effet réel sur une mission (rejeu P1 à faire). Non commité.
- Lu dans le code : le manifeste est chargé une fois au démarrage (`packs.js:57`, niveau module). L'API en cours (pid 6864) tourne donc encore avec l'ancienne phrase : relance nécessaire avant le rejeu, en attente de l'ordre du propriétaire.

## À intégrer plus tard (rapporté par la session « corrige agregat-front », non vérifié ici)
- Branche locale `memoire-fil-04-11` (`b6d897f`), worktree `~/Downloads/agregat-back-memoire`, dite prête pour `suite-astra`. Contenu annoncé : `create` enregistre `resumedFrom` ; le point de reprise transmet `missionObjective` et `previousOwnerMessage` en plus de `previousAnswer` ; pour career-ops, relus dans `relay/runs/<id>-input.json`. Fichiers : `packages/orchestrator/index.js`, `checkpoint.js`, `tests/memoire-fil.test.js`, rapport `memoire-fil-04-11.md`. Annoncé : 512 tests non-Chrome verts, phase Chrome non lancée, aucun recoupement avec `skill-manifest.yaml` ni `doubt-tools.test.js`. Touche E10.
- Rien fait : l'intégration attend l'ordre du propriétaire, après les essais. À relire (diff et rapport) avant toute fusion.

## 04/11 15:01 — API relancée (ordre du propriétaire)
- Pid 6864 arrêté (Ctrl-C), relance identique depuis astra : pid 14014 à 15:00:41, même onglet. Relais 19988 toujours vivant (pid 10497, il survit à l'API par conception).
- Le manifeste parse avec la nouvelle phrase ; l'API a démarré après la modification, donc l'a chargée (déduit, non lu dans le processus).
- Front 5173 non touché. D'autres sessions Claude Code modifient le front : ne rien faire dans `agregat-front`.
- Prêt pour le rejeu P1, veille relancée.
- 15:03 — Passation complète de la session « corrige agregat-front » collée par le propriétaire (branche `memoire-fil-04-11`, PR front #4 contenant #2 et #3, front 5173 sur `fix-memoire-fil`). Décision du manager : intégration du back après la clôture du cycle P1 (tests complets avec phase Chrome, relecture, fusion locale, relance API) ; fusion de la PR #4 seulement sur oui explicite du propriétaire, d'autres sessions travaillant sur le front.

### Cycle 2, rejeu de P1 — mission 68e0a13b (lancée par le propriétaire à 15:05:21, claude sonnet, career-ops, playwriter)
Constaté pendant la mission :
- Relais 19988 toujours le même (pid 10497).
- Ordre des appels : ToolSearch ; `career_read` ×3 (CV, profile.yml, _profile.md, tous réussis, pas de `blacklist.md` cette fois) ; **`career_script scan` à 15:06:05, terminé à 15:06:08, étape « scan » marquée faite** ; puis `jobs_search_live` ×3 (AI Engineer, Data Engineer, Software Engineer) à 15:06:13-15.
- Résultat du scan : 29 entreprises, 3 job boards, 2905 offres vues, 0 nouvelle, 3 erreurs réseau SEEK (« fetch failed »). Remotive n'est pas dans les portails scannés.
- Donc : le scan est passé avant le secours (la nouvelle ligne a changé l'ordre), mais le secours a quand même été appelé après un scan réussi, sans « sans scan » ni « jobs_search_live » dans le prompt. Fin de mission attendue avant l'étape 3.
Fin de mission (constaté) : `completed` à 15:07:14, sans erreur. 0 appel navigateur, `evidence: []`, `verification.claimsVerified: false` (liens « cités », non vérifiés). Étapes : scan faite, save-offer non exécutée (non requise). Collecteur : aucune ligne (rien en échec). Résumé de l'agent : scan rapporté fidèlement (0 nouvelle offre, 3 erreurs SEEK), puis « Remotive (recherche de secours, demandée explicitement) », « premier tri sur les titres/extraits publics, pas de lecture de la page réelle ni de score A-G ». Bilan cohérent cette fois (E3 non reproduit sur une mission réussie).

Étape 3, cycle 2 :
- **Symptôme** : sur le même prompt, l'agent a lancé le scan (réussi, 0 nouvelle offre, Remotive hors portails), puis a quand même appelé la recherche de secours en la disant « demandée explicitement », sans ouvrir de page ni poser de question.
- **Progrès** : le scan obligatoire est rétabli. **Retour** : l'usage du secours sur un prompt qui nomme seulement un site, exactement ce que la ligne exclut en toutes lettres.
- **Couche en cause, une seule : consigne système de l'acteur.** La règle de doute dit « suis d'abord le prompt, puis le Skill » : le prompt nomme Remotive, le Skill (ligne écrite) dit que nommer un site ne suffit pas ; les deux tranchent en sens contraire, donc pas de doute à poser, et le prompt gagne. La ligne Skill ne peut pas l'emporter sur une consigne qui place le prompt au-dessus d'elle. Pas le Skill : sa ligne est explicite et a été suivie pour l'ordre (scan d'abord). Pas une règle scopée ni la constitution : rien d'autre ne parle de ce choix. Pas le registre : pas de mémoire entre missions.
- Non couvert, toujours : aucune page ouverte. L'agent le dit lui-même.
- Deuxième cycle sur le même symptôme. Un troisième sans progrès : arrêt, compartiment trop gros.
- 15:09 — Limites : 5 h à 23 % (+18 points depuis 14:20, deux missions sonnet comprises), hebdomadaire 3 %, Fable 4 %.
