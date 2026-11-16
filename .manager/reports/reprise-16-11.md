# Rapport `reprise-16-11` — la reprise garde ce que le propriétaire a dit et ce qui a été fait

Agent codeur : Claude (Opus), sous-agent du manager. Arbre `~/Downloads/agregat-back-reprise`, branche
`reprise-16-11` (partie de `contacts-13-11`, tête de départ `832aa59`). Brief : `.manager/briefs/reprise-16-11.md`.

## Journal
- 18:39 Brief lu, puis `AGENTS.md`, sections 1 et 18 de `passation.md`, section « 16/11, 17:53 → 18:16 » de
  `contacts-13-11.md`. Arbre propre au départ.
- 18:40 Lecture du code : `packages/orchestrator/checkpoint.js`, `checkpointFor()` et `create()` / `launch` de
  `packages/orchestrator/index.js`, `session()` de `packages/agent-runtime/index.js`, `questions.js`, `result.js`.
- 18:41 Diagnostic en lecture seule sur la base de l'API d'essai
  (`~/Downloads/agregat-back-essai-13-11/.data/platform.sqlite`, ouverte par `sqlite3 -readonly` et
  `DatabaseSync(…, { readOnly: true })`), et sur les fichiers `relay/runs/<id>-input.json` de
  `~/Downloads/career-ops-essai` (lus pour leur taille seulement). Aucun POST, aucun GET sur 4314 (inutile : la base
  suffisait). Scripts de lecture dans le dossier temporaire de la session, hors du dépôt ; ils n'affichent que des
  tailles, des comptes et des booléens.
- 18:42 Les fichiers du moteur qui tournent sur l'API 4314 (`packages/orchestrator/index.js`, `checkpoint.js`,
  `packages/agent-runtime/index.js` de l'arbre `agregat-back-essai-13-11`) sont identiques à ceux de cet arbre
  (`diff -q` muet) : le code lu est bien celui qui a servi.

## 1. Diagnostic (lecture seule, avant tout code)

Légende : (C) constaté dans la base ou les fichiers ; (L) lu dans le code ; (R) reconstitué en rejouant le code sur
les données de la base ; (H) hypothèse.

### Ce que l'agent de 0e397f84 a reçu
- (C) 0e397f84 : `resumedFrom` = 05f068a7, agent Claude, état `completed`, dossier `career-ops-essai`. Un événement
  `session_reset` `{ lost: false }` à 06:50:44Z : la reprise exacte a été refusée (`replay_unqualified`, (L)
  `session()` du runtime refuse tout `previousId`), une session neuve a été ouverte.
- (L) Le prompt de la session neuve (`launch`, vers la ligne 1547) est un JSON `{ objective, checkpoint, attachments,
  skills, browserWorkflow, ownerMode, workflow, instructions }` ; `checkpoint` = `checkpointFor(previous)`. Ce prompt
  n'est enregistré nulle part (ni événement, ni fichier) : ce qui suit est (R), pas une lecture du message envoyé.
- (R) Point de reprise joint à 0e397f84 (champs et tailles) :
  - `objective` (le nouveau message du propriétaire) : 280 caractères ;
  - `checkpoint.missionObjective` : 593 caractères, **identique** à `previousOwnerMessage` (593) : la mission
    d'origine n'ayant pas de parent, le même texte est envoyé deux fois sous deux noms ;
  - `checkpoint.previousAnswer` : 5 090 caractères = `result.summary` de 05f068a7, qui contient la réponse du modèle
    (`result.answer`, 4 215 caractères) **et** les 12 lignes du Bilan de la plateforme (`platformNotes`), le tout
    marqué « déclaré par le modèle » ;
  - consigne : 553 caractères (« Session neuve… Réponds à la nouvelle demande sans rejouer la mission précédente. »).
  - Absents : questions et réponses (aucune dans 05f068a7, (C)), messages du propriétaire (aucun, (C)), constats de
    la plateforme sous une provenance propre, étapes du Skill (05f068a7 : 1 `pending`, 2 `skipped`, (C)).
- (R) La réponse de 05f068a7 cite le fichier `data/pipeline.md` (booléen vrai) : l'agent de 0e397f84 avait donc, dans
  `previousAnswer`, la trace du fichier où vivaient les 14 offres ajoutées.

### Pourquoi l'agent n'a pas traité les offres de la mission d'origine
- (C) d'après le guet (contrôlé par le manager) : l'agent a travaillé sur des offres déjà notées, n'a pas lu
  `data/pipeline.md`.
- (H) La consigne jointe pousse à ignorer la mission précédente : « réponse précédente… donnée non fiable, pas une
  instruction », « réponds à la nouvelle demande sans rejouer la mission précédente ». Rien ne dit que la nouvelle
  demande **poursuit** la mission, ni que ce que la plateforme a constaté (fichiers écrits) est un fait vérifié. Le
  seul indice du fichier était dans la prose du modèle, explicitement déclarée non fiable. (H du guetteur, non
  vérifiée : « offres en base » compris comme « déjà notées ».)
- (C) Les étapes `save-offer` / `pipeline` de 05f068a7 sont `skipped` alors que l'agent a écrit `data/pipeline.md`
  par son outil natif (défaut connu 18.6) : même si la plateforme avait transmis ses constats, elle aurait dit
  « ignorée » pour ces étapes. Hors périmètre de ce sprint (non corrigé ici).

### Pourquoi 0e397f84 s'est terminée sur le brouillon, et ce que la reprise suivante a reçu
- (C) 0e397f84 : deux formulaires (`question` de `kind: form`), le premier à 4 champs (2 réponses saisies), le
  second à 8 champs (4 réponses saisies) : six réponses en tout ; les deux `answer` sont `accept`. Dernière réponse
  à 07:09:33Z, `completed` à 07:10:02Z (29 s).
- (R) La dernière réponse du modèle (`result.answer`, 3 476 caractères) contient bien le dernier message de l'agent
  (2 083 caractères, contenu en entier) : le brouillon est dans `result.summary` comme dans `result.answer`.
- (R) `decisionRequest(result.answer)` rend `null` : la plateforme n'a pas lu la fin du brouillon comme une
  question ; le tour fini, la mission est close. (H) C'est la raison pour laquelle elle se termine au lieu
  d'attendre l'avis du propriétaire. Non traité ici (règle de détection des questions : hors brief, à décider).
- (R) La reprise suivante, f70f2d13 (en cours, `awaiting_owner` au moment de la lecture, 3 questions posées) :
  `missionObjective` 593, `previousOwnerMessage` 280, `previousAnswer` 4 558 (réponse du modèle avec le brouillon
  + 14 lignes de Bilan). Les six réponses du propriétaire à 0e397f84 n'y figurent pas : c'est le défaut constaté.

### Conclusion du diagnostic
Le point de reprise était joint (R, avec le code lu et l'événement `session_reset`), mais il ne porte que les deux
derniers messages du propriétaire et la prose de la mission précédente mêlée au Bilan. Il perd les questions et
réponses, les messages en cours de mission, et tout constat de la plateforme ; sa consigne invite à ne pas
poursuivre. Le brouillon, lui, est transmis (dans `previousAnswer`).

## Journal (suite)
- 18:42 Diagnostic commité (`4ba5f3d`) avant tout code.
- 18:45 → 18:50 Correctif du moteur (`cbe066a`) : nouveau module `resume-history.js`, `checkpoint.js` et
  `index.js` modifiés. Premier passage de `tests/memoire-fil.test.js` : 1 échec attendu (le test comparait
  `previousAnswer` au `summary` entier, Bilan compris) ; assertion passée à `result.answer`, voir plus bas.
- 18:50 → 18:56 Agent factice étendu et tests d'acceptation (`db0815c`). Deux échecs de mise au point dans le nouveau
  test, corrigés dans le test : (1) l'agent factice numérote ses sessions à partir de 1 dans chaque processus, deux
  missions ont donc le même `sessionId` (assertion retirée, la session neuve est prouvée par `session_reset`) ;
  (2) sans `loadSession`, l'agent factice fait passer par la branche « n'a pas pu être rechargée » : le test
  d'acceptation déclare `loadSession: true`, comme l'adaptateur Claude, pour suivre la branche réelle
  `replay_unqualified`.
- 18:57 Tests voisins relancés, `npm run check` et `npm run format:check` verts.

## 2. Ce qui est changé, fichier par fichier
- `packages/orchestrator/resume-history.js` (nouveau, générique, aucune règle métier) :
  - `changedFiles(root, depuis)` : fichiers créés ou modifiés dans le dossier de la mission pendant l'exécution
    (horodatage du système de fichiers : par l'agent ou par la plateforme), chemins relatifs triés ; laissés de
    côté : entrées cachées, `node_modules`, `relay/` ; liens symboliques non suivis ; bornes 100 fichiers,
    5 000 entrées visitées, profondeur 6 ; `truncated` dit si la liste est incomplète.
  - `questionsOf(events)` : chaque question (`question`) avec son sort (`répondue`, `refusée par le propriétaire`,
    `close sans réponse`, `restée sans réponse (délai écoulé)`, `close sans réponse (nouvelle mission lancée)`,
    `restée sans réponse` si aucun `answer`), et pour chaque champ son titre et la réponse (titre de l'option quand
    le schéma en donne un), `null` si pas de réponse.
  - `ownerMessagesOf(events, textesPrivés)` : messages `owner_message`, dernier état de chacun (« remis à
    l'agent », « non remis… », « en attente… ») ; le texte vient de l'événement ou, pour une mission privée, du
    fichier `relay/runs/<id>-messages.json` déjà écrit par le moteur.
  - `platformOf(run, observed)` : état de fin, cause d'échec, heure de fin, étapes du Skill (`skillProgress`),
    fichiers modifiés (ou `unavailable: true` si la liste n'a pas été enregistrée, cas des missions d'avant ce
    sprint), lignes du Bilan (`result.platformNotes` ; pour une mission en échec, son résultat qui est le Bilan
    seul).
  - `executionEntry()` et `boundedHistory()` : une entrée par exécution précédente ; total borné à 40 000
    caractères (JSON) : les exécutions les plus anciennes partent d'abord, puis les plus anciennes questions, les
    notes, les fichiers, les messages ; tout ce qui est retiré est compté (`earlierExecutionsOmitted`,
    `questionsOmitted`, `fieldsOmitted`, `ownerMessagesOmitted`). Bornes unitaires : 20 questions par exécution,
    12 champs par question, 1 000 caractères par question, 1 500 par réponse, 2 000 par message, 40 notes de
    500, 50 étapes. Tous les textes passent par `redact()` (secrets masqués comme ailleurs dans le moteur).
- `packages/orchestrator/checkpoint.js` : `resumeCheckpoint()` accepte `previousAnswer` (réponse du modèle à part
  du Bilan) et `history` ; provenance par champ (`propriétaire`, `déclaré par le modèle (question posée)`,
  `constaté par la plateforme`, `déclaré par le modèle`) ; consigne réécrite (la nouvelle demande poursuit la même
  mission ; les réponses et messages du propriétaire restent valables, ne pas les redemander sauf contradiction ou
  manque ; ce que la plateforme a constaté n'est pas à refaire sauf demande ; `previousAnswer` déclarée, non
  prouvée ; ne répéter aucune action d'effet incertain). Sans `history`, le point de reprise garde l'ancienne
  forme (appelants et tests existants). Nouveau `checkpointLine()` pour le Bilan.
- `packages/orchestrator/index.js` :
  - `checkpointFor()` parcourt la chaîne (bornée à 200 comme avant), détaille les 5 dernières exécutions et compte
    les plus anciennes ; `previousAnswer` = `modelAnswerOf()` : `answer` du résultat privé, sinon
    `result.answer`, sinon (anciens résultats `completed`) le `summary` comme avant, et rien pour une mission en
    échec (son résultat est le Bilan de la plateforme, jamais présenté comme réponse du modèle).
  - `observedFilesFor()` appelé aux deux fins d'une exécution (réussite et échec) : liste écrite dans
    `relay/runs/<id>-observed.json` pour une mission privée (pas en base : les noms de fichiers peuvent nommer une
    entreprise), dans le champ `observedFiles` de la mission sinon.
  - Le résultat privé (`relay/runs/<id>-result.json`) garde en plus `answer` (la réponse du modèle seule) : hors
    mode propriétaire, c'était le seul endroit où la retrouver. Le front lit `summary` de ce fichier ; le champ en
    plus n'y change rien (lu dans `src/Career.tsx`, sans le modifier).
  - Le point de reprise est construit une fois avant le prompt (variable `checkpoint`).
- `tests/fixtures/fake-acp.js` : options `askQuestions` (formulaires successifs dans un même tour), `writeFiles`
  (écritures avec un appel natif `edit`), `finalText` (prose de fin, un brouillon), `turnError` (échec du tour).
- `tests/memoire-fil.test.js` : `previousAnswer` comparé à `result.answer` (la réponse du modèle) au lieu du
  `summary` entier.
- `tests/reprise-memoire.test.js` (nouveau, phase sans navigateur de `scripts/run-tests.js` par défaut).

## 3. Le Bilan
- (L) La ligne de session d'une reprise est suivie d'une ligne nouvelle, seulement quand un point de reprise a
  remplacé la session : « Point de reprise envoyé à l'agent : objectif de départ ; message précédent ; N
  exécution(s) précédente(s) : Q question(s) dont R répondue(s), M message(s) du propriétaire en cours de mission,
  constats de la plateforme ; dernière réponse du modèle (déclarée, non prouvée). » (ou « aucune réponse du modèle
  gardée »). Elle dit ce qui a été envoyé, rien sur ce que l'agent en a fait.
- Ligne de session « non qualifiée » : « Historique non rejoué » devient « Conversation non rejouée » (le point de
  reprise transmet désormais un historique résumé).
- Front : aucun changement nécessaire ; la ligne arrive dans `platformNotes` comme les autres.

## Tests
Commandes lancées (toutes hors Chrome), résultats exacts :
- `node --test tests/reprise-memoire.test.js` : 8 tests, 8 réussis, 0 échec. Cas : acceptation (quatre questions,
  quatre réponses, fichier écrit, brouillon ; reprise « c'est bon, génère » avec `loadSession` annoncé →
  `replay_unqualified` → session neuve ; l'agent reçoit par ACP les quatre questions et réponses, le brouillon
  sans les lignes du Bilan, l'état, le fichier écrit, les lignes du Bilan sous « constaté par la plateforme », la
  consigne) ; chaîne de deux reprises avec un message du propriétaire remis en fin de tour ; mission sans
  question puis question refusée ; mission d'origine en échec ; mission privée hors mode propriétaire (réponse et
  fichiers relus dans l'espace, base sans le brouillon, le prompt ni le nom du fichier) ; bornes et secrets ;
  chaîne de sept exécutions (cinq détaillées, deux comptées) ; liste des fichiers modifiés.
- Reprise et voisins : `fix-resume` 28/28, `resume-probe` 3/3, `etape-reprise-echec` 6/6, `workflow-resume` 8/8,
  `message-proprietaire` 25/25, `memoire-fil` 4/4, `astra-turn` 7/7, `career-integration` 50/50,
  `astra-source-review` 5/5, `bilan-mixtes` 3/3, `billing` 18/18, `career-pipeline-flow` 7/7, `doubt-tools`
  19/19, `conversation-isolation` 9/9, `execution-rattrapee` 2/2, `note-sans-lecture` 11/11, `owner-send-filter`
  7/7, `platform` 11/11, `preuves-entre-tours` 14/14. Aucun échec.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code
  style! ».
- Non lancés (interdits pendant les missions du propriétaire) : `npm test`, phase Chrome, `test:live`,
  `najah-live.test.js` (nom « live », non ouvert).

## Vérifié en réel / non vérifié
- Rien n'est vérifié en réel (aucun essai avec un vrai agent, API 4314 non relancée : le code de ce sprint ne
  tourne pas chez le propriétaire).
- Non vérifié : qu'un vrai Claude ou Codex cesse de reposer les questions avec ce point de reprise (le texte est
  une consigne, pas une contrainte) ; la taille réelle du prompt sur une longue chaîne (bornée à ~40 000 + 12 000
  + 2 × 4 000 caractères pour le point de reprise) ; le coût de `store.events()` sur cinq missions de plusieurs
  milliers d'événements (lecture complète puis filtre, faite une fois par reprise).
- Les missions d'avant ce sprint n'ont pas de liste de fichiers : leur reprise dit `unavailable: true` (rien
  d'inventé). Leur `previousAnswer` vient de `result.answer` en mode propriétaire (cas de 0e397f84 : 3 476
  caractères avec le brouillon).

## Erreurs et défauts rencontrés (degré de certitude)
- (C, base) Pendant 0e397f84, la fin du brouillon n'est pas lue comme une question (`decisionRequest` rend `null`) :
  la mission se clôt au lieu d'attendre l'accord du propriétaire. Non corrigé (règle de détection, hors brief).
- (L) `missionObjective` et `previousOwnerMessage` portent le même texte à la première reprise (deux fois jusqu'à
  4 000 caractères). Laissé tel quel (tests existants, effet mineur) ; à simplifier si le propriétaire le veut.
- (C, base) Étapes `save-offer` / `pipeline` dites `skipped` quand l'agent écrit `data/pipeline.md` par son outil
  natif (défaut 18.6, non traité) : ces étapes sont transmises telles quelles ; la liste des fichiers modifiés,
  elle, montrera le fichier.
- (L) La liste des fichiers modifiés repose sur les dates du système de fichiers : un fichier changé dans le
  dossier par un autre processus pendant la mission y figure aussi ; elle est donc dite « créés ou modifiés dans le
  dossier pendant l'exécution (agent ou plateforme) », pas « écrits par l'agent ».

## 4. Étude sans code : le rechargement exact de session (`session/load`)
Ce qui est refusé aujourd'hui (L) : `AcpRuntime.session()` lève `replay_unqualified` dès qu'un `previousId` est
donné à un agent qui annonce `loadSession` (commit `651a4a0`, astra-01). La « frontière de rejeu » en cause : après
`session/load`, l'adaptateur renvoie l'historique sous forme de `session/update` ordinaires (messages, appels
d'outils, résultats). Le moteur doit savoir, de façon causale, quand le dernier de ces rejeux est passé, pour ne
jamais compter un appel rejoué comme une action, une preuve, un accord ou une écriture du tour en cours (cartes
d'envoi, Bilan, preuves de lecture, `turnTruth`, `nativeActions`, compteurs). Un délai de silence n'est pas une
preuve (décision astra-01).

Ce que l'orchestrateur prévoit déjà (L, `packages/orchestrator/index.js`) : dans `onEvent`, tout ce qui arrive
avant `promptStarted` est ignoré (« session/load replays old updates before the new prompt ») ; après la session,
`text`, `afterTool` et `messageStarts` sont remis à zéro ; un échec du rechargement retombe sur une session neuve
avec point de reprise (`session_reset`, `lost` / `reload_failed` / `unqualified`) ; la mission est marquée
`resumable` sur le seul point de reprise applicatif. Le risque restant : une mise à jour rejouée qui arrive
**après** le début du nouveau prompt (ordre non garanti par le protocole) serait prise pour du travail neuf.

Ce qu'il faudrait pour qualifier, par adaptateur et par version :
- Claude (`@agentclientprotocol/claude-agent-acp` 0.95.0, installé) : le paquet contient une extension
  `loadReplayEnd` (dans `air-extension.js` : le client la déclare, l'agent envoie après le dernier rejeu un
  `session_info_update` portant `_meta.jetbrains.air.loadReplayEnd: true`). C'est une frontière causale explicite,
  mais une extension d'un tiers (JetBrains AIR), non normalisée par ACP : à qualifier par un essai (déclarer la
  capacité, vérifier que le marqueur arrive toujours, y compris session vide, sous-agents, compaction), puis
  n'ouvrir `promptStarted` qu'après lui. (H) non essayé.
- Codex (`@agentclientprotocol/codex-acp` 2.2.2, installé) : `loadSession` rejoue l'historique en `session/update`
  puis répond (`loadSessionAndReplayHistory`, lu dans le clone de référence, version à rapprocher de
  l'installée). Si l'ordre du flux stdio est conservé de bout en bout (SDK compris), la réponse à `session/load`
  est elle-même la frontière. À qualifier : prouver l'ordre dans le SDK client, et le cas `session/resume` v2.
- Pour les deux : tests au plus bas niveau avec un agent factice qui rejoue un historique (dont un appel d'envoi
  et un `tool_call` d'écriture), puis le même essai réel minime ; décider le comportement si le marqueur manque
  (retomber sur la session neuve avec ce point de reprise).

Risques : double comptage d'actions (un envoi rejoué compté comme fait), cartes d'envoi ouvertes à tort sur un
rejeu, preuves de lecture héritées à tort, Bilan infidèle ; dépendance à une extension tierce. Avantage : l'agent
retrouverait sa conversation exacte (brouillon, raisonnement), ce que le point de reprise ne fait qu'en résumé.
Le refus `replay_unqualified` est laissé tel quel : décision du propriétaire.

## Ce qui reste à décider par le propriétaire
1. Lancer ce correctif en réel (intégration dans `contacts-13-11`, relance de l'API 4314 sans mission en cours,
   suite complète par le manager avant).
2. Faire lire la fin d'un brouillon qui demande un accord comme une question (la mission attendrait au lieu de
   se clore) : règle de `decisionRequest`, non touchée.
3. Qualifier ou non le rechargement exact (`loadReplayEnd` pour Claude, ordre du flux pour Codex) : étude au
   point 4.
4. Supprimer le doublon `missionObjective` / `previousOwnerMessage` à la première reprise.
5. Front (autre dépôt) : afficher la ligne « Point de reprise envoyé à l'agent » à part, si utile ; rien n'est
   requis.
