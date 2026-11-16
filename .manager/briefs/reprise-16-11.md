# Brief `reprise-16-11` — la reprise d'une mission garde ce que le propriétaire a déjà dit et ce qui a été fait

Écrit par le manager le 16/11/2026 (18:35), sur l'accord du propriétaire (« Oui, corrige »).
Arbre : `~/Downloads/agregat-back-reprise`, branche `reprise-16-11` (partie de `contacts-13-11`).
Rapport à tenir au fil de l'eau : `.manager/reports/reprise-16-11.md`. Commits locaux `[reprise-16-11]`, par chemins
explicites (`git commit -m … -- <fichiers>`, `git add` seulement pour un fichier nouveau). Aucun push, aucun merge.

Avant de coder, lire : `AGENTS.md`, puis la section 1 de `.manager/reports/passation.md` (règles permanentes), puis sa
section 18 (état), puis la section « 16/11, 17:53 → 18:16 » de `.manager/reports/contacts-13-11.md`.

## Le problème, vu par le propriétaire
Mission 0e397f84 (16/11, reprise de 05f068a7, Claude) : il demande de noter les offres trouvées puis de produire CV et
lettres. L'agent ne traite pas les 14 offres ajoutées par la mission d'origine. Il pose six questions en deux
formulaires ; le propriétaire répond ; la mission se termine 29 secondes après la dernière réponse, sans lettre (le
Skill demande un brouillon dans la conversation puis un accord avant le PDF). S'il relance par une reprise, la session
est neuve : ses quatre réponses et le brouillon ne sont plus là, et le Skill repose des questions.
Même défaut le 15/11 (mission bcbedbb6). La reprise suivante, f70f2d13 (16/11, 18:21), a de nouveau posé trois
formulaires.

## Ce que le manager a lu dans le code (à vérifier, pas à croire)
- `packages/agent-runtime/index.js`, `session()` : le rechargement exact d'une session (`session/load`) est refusé
  exprès (« Reprise exacte non qualifiée : frontière de rejeu inconnue », `replay_unqualified`, commit `651a4a0`).
  L'appelant ouvre une session neuve avec un point de reprise applicatif.
- `packages/orchestrator/checkpoint.js`, `resumeCheckpoint()` : ce point de reprise porte l'objectif de départ, le
  message précédent du propriétaire et la réponse précédente du modèle (12 000 caractères au plus), avec une consigne
  « session neuve… ». Il est construit par `checkpointFor()` et joint vers la ligne 1549 de
  `packages/orchestrator/index.js`.
- Il ne porte ni les questions posées au propriétaire, ni ses réponses (événements `question` / `answer`), ni ses
  messages en cours de mission (`owner_message`), ni ce que la plateforme a constaté (fichiers écrits, documents
  produits, étapes du Skill faites ou non, état de fin).
- Le fichier `relay/runs/<id>-input.json` de l'espace ne garde que le prompt : il ne dit pas ce que l'agent a reçu.

## Travail demandé

### 1. Diagnostic d'abord (lecture seule, à écrire dans le rapport avant tout code)
Établir ce que l'agent de la mission 0e397f84 a réellement reçu : le point de reprise était-il joint, avec quels
champs, de quelles tailles, et la consigne qui l'accompagne. Dire pourquoi, d'après les faits, l'agent n'a pas traité
les offres de la mission d'origine (constaté ou hypothèse, sans mélanger). Sources : la base de l'API d'essai (voir
`.manager/outils/api-branche.sh` pour son emplacement) ouverte en lecture seule, ou `GET` sur
`http://127.0.0.1:4314` (en-tête `x-platform-request: 1` ; les événements sont un flux SSE). Aucun POST. Ne recopier
aucun prompt, aucune réponse, aucun nom, aucune URL d'offre dans le rapport : formes, tailles et comptes seulement.

### 2. Correctif : enrichir le point de reprise applicatif
Sans rouvrir le rechargement exact de session (voir point 4), faire que la session neuve d'une reprise reçoive, pour
toute la chaîne des missions reprises (bornée) :
- les questions posées au propriétaire et ses réponses (titre de la question, réponse choisie ou saisie), provenance
  « propriétaire » ; une question refusée ou restée sans réponse est dite telle ;
- les messages du propriétaire remis en cours de mission (`owner_message` remis), provenance « propriétaire » ;
- ce que la plateforme a constaté de la mission précédente : fichiers écrits et documents produits, étapes du Skill
  faites / ignorées, état de fin, provenance « constaté par la plateforme » (jamais la prose du modèle présentée comme
  un fait) ;
- la dernière réponse du modèle, comme aujourd'hui, toujours marquée « déclaré par le modèle ». Vérifier qu'elle
  contient bien le dernier message de l'agent (le brouillon d'une lettre doit s'y trouver) et dire sinon ce qui manque.
Adapter la consigne jointe : le nouveau message poursuit la mission ; les réponses déjà données par le propriétaire
restent valables et n'ont pas à être redemandées ; ce qui est déjà fait n'est pas à refaire sauf demande ; la prose du
modèle reste non prouvée. Tailles bornées, secrets masqués comme ailleurs dans le moteur, rien de plus dans les
journaux.

Scénario d'acceptation (à jouer en test avec l'agent factice `tests/fixtures/fake-acp.js`, par le même chemin que
l'agent réel) : une mission pose quatre questions, reçoit quatre réponses et finit son tour sur un brouillon ; une
reprise « c'est bon, génère » ouvre une session neuve dont l'agent reçoit les quatre réponses, le brouillon et ce que
la plateforme a constaté. Autres cas : chaîne de deux reprises, mission sans question, question refusée, bornes de
taille, mission d'origine en échec.

### 3. Le Bilan reste fidèle
Si le Bilan ou ses notes parlent de la reprise, ils disent ce qui a été transmis, sans rien affirmer de plus.

### 4. Étude sans code : le rechargement exact
Dans le rapport, une demi-page : ce qu'il faudrait pour qualifier le rechargement exact de session (`session/load`)
avec les adaptateurs Claude et Codex installés (quelle est la « frontière de rejeu » en cause, ce que le code de
`packages/orchestrator/index.js` prévoit déjà vers les lignes 1432 et 1519, les risques). Ne pas l'activer : c'est une
décision du propriétaire.

## Limites (ne pas dépasser)
- Aucune règle métier codée en dur dans le moteur : rien de propre aux candidatures dans `packages/orchestrator` ni
  `packages/agent-runtime` ; ce qui est propre au pack passe par son manifeste.
- Aucune garde nouvelle, aucune demande d'accord nouvelle, aucune liste de blocage, aucune restriction de l'agent.
  Ne pas toucher aux cartes d'envoi ni à la règle « un clic par mission ».
- Intouchables : le Skill, la bibliothèque career-ops, les CV, `~/Downloads/career-ops-essai` (lecture seule),
  `~/Downloads/agregat-back` (ne jamais y aller), `~/Downloads/agregat-back-essai-13-11` (l'arbre du manager : lecture
  seule), `.manager/outils/api-branche.sh`, le refus `replay_unqualified`.
- Le front vit dans un autre dépôt : ne pas y toucher ; si un changement d'affichage est utile, le dire au rapport.
- Aucun secret lu (`.env*`, `.envforme`, `.manager/secrets.env`, `~/.codex/auth.json`, `~/.claude*`, trousseau).
- Dépôt public : aucune donnée personnelle dans le code, les tests, les fixtures ni le rapport (données fictives).

## Vérification (le propriétaire teste en ce moment sur l'API 4314)
- Interdits : `npm test` (il lance la phase Chrome, défaut E23 pendant une mission réelle), `npm run test:browser`,
  `npm run test:live`, tout essai avec un vrai agent, tout lancement de l'API ou d'un serveur sur les ports 4313, 4314,
  4321, 5176, 5177, toute sonde du relais Playwriter.
- À lancer : les tests unitaires touchés et voisins par `node --test tests/<fichier>.test.js` (ceux de la reprise :
  `fix-resume`, `resume-probe`, `etape-reprise-echec`, `workflow-resume`, `message-proprietaire`, et les nouveaux),
  puis `npm run check` et `npm run format:check`. Tout nouveau test hors Chrome doit être pris par
  `scripts/run-tests.js` dans la phase sans navigateur.
- La suite complète sera lancée par le manager, plus tard, sans mission en cours.

## Rapport attendu (`.manager/reports/reprise-16-11.md`)
Français, horodaté (`date` avant chaque heure écrite). Diagnostic ; ce qui est changé, fichier par fichier ; tests
ajoutés et leur résultat exact ; ce qui est vérifié en réel (rien n'est attendu : le dire) et ce qui ne l'est pas ;
erreurs rencontrées avec leur degré de certitude ; l'étude du point 4 ; ce qui reste à décider par le propriétaire.
