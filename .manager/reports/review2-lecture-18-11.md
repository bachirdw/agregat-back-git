# review2-lecture-18-11 : seconde relecture du sprint lecture-18-11 (E128)

Session de correction du 18/11/2026, rapport écrit à 19:35 (heure lue par `date`). Arbre :
`agregat-back-lecture`, branche `lecture-18-11`. Tête avant la correction : `e9c60c3`. Aucun push,
aucun merge.

## Principe appliqué

Une lecture par script (clé `scriptReads` du manifeste) ne rend « lue » que l'annonce exacte qu'elle a
lue. Dans le doute, elle ne compte pas, et le comportement d'avant le sprint reste. Tout le code
ajouté est dans `packages/orchestrator/skill-router.js` et ne joue que lorsqu'une lecture par script a
eu lieu.

## Constat par constat

- **L1 (segment commun du site) : corrigé.** Nouvelle fonction `ownIdentifiers` : l'identifiant d'une
  annonce lue par script vient seulement du dernier segment du chemin (jeton de 6 caractères ou plus
  contenant un chiffre) ou d'un paramètre d'identifiant (`QUERY_ITEM`). L'annonce notée est comparée
  de la même manière, par ses propres identifiants. Sans identifiant, seule l'adresse exacte normalisée
  compte (`itemKey`). L'ancien `itemIdentifiers(url).slice(-1)` est retiré.
- **L2 (identifiant dans la requête) : corrigé.** Les lectures par script ne passent plus par `pageKey`
  (hôte et chemin), ce qui retire `this.scriptReads` de l'ensemble `read`. Leur clé est `itemKey` :
  hôte sans « www. », chemin sans barre finale, paramètres triés, ce qui garde l'identifiant de
  requête. Les paramètres `utm_*` et le fragment sont écartés. Deux annonces du même chemin forment une
  seule « page » pour le compte. Une page notée ne passe pour lue par script que si **chaque** adresse
  notée sous elle est couverte.
- **L3 (contenu et adresse atteinte) : corrigé en partie.** Nouvelle fonction `scriptOutput` :
  - Une sortie standard qui tient en une ligne JSON (cas de l'extracteur `{ url, title, text }`) est
    séparée de ce qui la suit. Les lignes suivantes sont la sortie d'erreur et ne comptent pas pour le
    seuil, pas plus que le champ `url`.
  - Quand le script donne l'adresse atteinte, c'est elle qui compte. Une page de liste (même règle
    `listPage` que pour une capture) ne vaut pas lecture, ni une adresse dont la clé exacte diffère de
    l'annonce demandée (redirection, page de connexion, autre annonce).
  - **Limite :** quand la sortie standard est du texte simple (cas de fetch-jd), le routeur ne peut pas
    la séparer de la sortie d'erreur. `packages/career-ops/tools.js` (l.1433-1437) rend en un seul
    texte `stdout + "\n" + stderr` pour un script du Skill. Pour une séparation exacte, ce fichier
    devrait rendre la sortie d'erreur à part. Il est hors de mon périmètre et je ne l'ai pas touché.
    D'après son code lu (lecture seule, l.55-61), fetch-jd n'écrit rien sur la sortie d'erreur quand il
    réussit et sort avec le code 1 quand il échoue.
- **Inertie : prouvée.**
  - Le test `review2 inertie` compare, pour 5 scénarios, le manifeste réel au même manifeste privé de
    `scriptReads`, c'est-à-dire tel qu'avant le sprint. Les scénarios couvrent des captures, des
    sélections, des annonces identifiées par requête ou par segment, et des appels de script qui ne
    lisent rien (échec, mode liste, autre script). Dans chaque scénario, `incomplete`, `current()` et le
    Bilan sont identiques. Le test vérifie aussi le message « 2 offre(s) notée(s) sans lecture de leur
    page » mot pour mot.
  - Contrôle ponctuel, hors dépôt : la version `a79a747` de `skill-router.js` (avant le sprint) a été
    chargée depuis le dossier de travail temporaire et comparée au code corrigé sur 5 550 combinaisons
    sans lecture par script (prompts, appels, captures, offres notées). Les résultats sont identiques
    dans tous les cas.
- **Généricité : un écart trouvé et corrigé.** Le sprint n'a ajouté en dur dans `skill-router.js` aucun
  nom de script ni de site : les scripts ne viennent que de `scriptReads`. Il avait en revanche ajouté
  « texte de l'annonce rendu » dans `formatSkillOrder`, un code du moteur commun à tous les packs. Ce
  texte devient « texte rendu », et l'attendu du test du sprint suit. La phrase `READ_BEFORE_SCORE`
  parlait déjà d'« offre » avant le sprint, qui y a ajouté « le texte de son annonce » : je ne l'ai pas
  touchée, et c'est à décider (voir plus bas).
- **Manifeste : inchangé.** La déclaration `scriptReads` n'a pas besoin de précision.

## Tests (résultats exacts, un fichier à la fois)

- `tests/review2-lecture-18-11.test.js` (nouveau) : 6/6. Avant la correction, 5 tests sur 6 étaient
  rouges (L1, L2, les deux tests L3 et la généricité) ; le test d'inertie était déjà vert.
- `tests/lecture-18-11.test.js` : 11/11, après l'attendu « texte rendu ». Ce fichier contient deux
  tests de chaîne par `createApp` avec un agent ACP factice : ni port, ni navigateur, ni réseau.
- `tests/review-lecture-18-11.test.js` : 3/3.
- Fichiers voisins qui importent le routeur, sans navigateur :
  - skill-router 41/41, contrat-agents 14/14, audit-suite-02-negation-intention 2/2,
    audit-suite-02-bilan-cv-joint 3/3, bilan-evaluer-puis-postuler 8/8, career-script-usage 4/4 ;
  - contacts-courriel 26/26, ecart-ordre-nomme 3/3, intention-candidature 2/2, etape-reprise-echec 6/6,
    lecture-liste-acp 2/2, intention-50-prompts 5/5, intention-anglais-sonde 44/44, intention-anglais 2/2 ;
  - intention-par-phrase 5/5, lecture-page-liste 12/12, lecture-page-resultats 4/4, lecture-dossier
    12/12, open-sans-mot-cle 9/9, note-sans-lecture 11/11, ouvrir-formulaire-clic 3/3 ;
  - orchestrator-max-events 2/2, preuve-effet 7/7, platform 11/11, release-report-num 10/10,
    preuves-entre-tours 14/14, review-freins-01 9/9, tool-watchdog 1/1, browser-proof 5/5.
- Non lancés par prudence : apply-01-bilan, career-integration et doubt-tools. Ils exécutent des
  scripts ou une passerelle et je ne les ai pas lus en entier.
- `npm run check` : « Syntaxe JavaScript valide. »
- `npx prettier --check` sur les trois fichiers touchés : conforme.

## Non vérifié

- Je n'ai lancé aucune mission réelle, aucun agent réel et aucune API.
- Je n'ai pas vérifié la forme réelle des réponses de `career_script` chez chaque agent (Codex, Gemini,
  OpenCode). Les tests reprennent les formes ACP déjà utilisées par le sprint.
- Sortie d'erreur avec une sortie standard en texte simple : non séparable côté routeur (voir L3).
- Une adresse atteinte qui ne diffère de l'annonce que par un paramètre ajouté (par exemple une
  langue) fait maintenant échouer la lecture par script : c'est voulu (« dans le doute »). Je n'ai pas
  mesuré combien de vraies annonces en sont touchées.

## Limites connues (non corrigées, sur consigne)

- Une lecture par script n'est pas transmise à une reprise de mission, alors qu'une capture l'est
  (`index.js`, `missionProof`).
- Le Bilan peut dire à la fois « étape de lecture faite » et « aucune annonce lue ».
- Une lecture par script faite avant le balayage ajoute au Bilan une ligne « écart d'ordre ». Cette
  ligne est exacte.
- Un lien lu par script reste compté parmi les « liens cités sans lecture prouvée » dans le Bilan.

## Reste à décider par le propriétaire

1. Faire séparer la sortie standard et la sortie d'erreur dans `packages/career-ops/tools.js`, pour
   appliquer exactement le seuil de L3 aux scripts qui écrivent du texte simple. C'est un changement
   hors du périmètre de cette session.
2. Garder ou non la mention « le texte de son annonce rendu par un script du Skill » dans
   `READ_BEFORE_SCORE`. Elle est envoyée à toutes les missions d'un pack qui demande de lire avant de
   noter.
3. Transmettre ou non les lectures par script à la reprise de mission.

## Commits

- `e8c600f` : correction L1, L2, L3, tests neufs, attendu du test du sprint.
- `bec6da8` : ce rapport (première passe).

## Seconde passe (19:41, heure lue par `date`)

Le vérificateur indépendant a signalé un seul reste, sur L3 : quand la sortie standard est du texte
simple, la sortie d'erreur compte encore pour le seuil. Son exemple : `fetch-jd` sur
`https://p.example.test/job/R100001`, sortie standard « court » et 1 000 caractères sur la sortie
d'erreur. L'étape passe à `done` et `incomplete` renvoie `[]`.

- **Constaté :** pour un script du Skill, `packages/career-ops/tools.js` (l.1433-1437) rend un seul
  champ `text`, égal à `stdout + "\n" + stderr`. La réponse ne contient aucune autre trace de la
  frontière. Le routeur ne peut donc pas retrouver la sortie standard seule quand elle est du texte
  simple. Une correction exacte demande de toucher `tools.js`, qui est hors de mon périmètre. Je n'y
  ai pas touché.
- **Fait dans `skill-router.js` (`scriptOutput`), au plus étroit :** un champ `stderr` présent dans
  la réponse n'est jamais compté comme texte rendu. Aujourd'hui, aucune réponse ne porte ce champ :
  le changement est inerte. Il prépare la correction : il suffira que `tools.js` rende
  `{ text: stdout, stderr, exitCode }` pour un script du Skill, et le seuil portera alors sur la
  sortie standard seule, sans autre changement du routeur.
- **Non fait, par choix :** compter pour rien toute sortie en texte simple. Ce serait « dans le
  doute, ne compte pas », mais cela retirerait aussi la lecture par `fetch-jd`, le cas réel qui a
  motivé le sprint. `fetch-jd` écrit en texte simple et, d'après son code lu en lecture seule,
  n'écrit rien sur la sortie d'erreur quand il réussit. Le sprint serait alors sans effet. Ce choix
  revient au propriétaire (voir plus bas).
- **Tests ajoutés** (`tests/review2-lecture-18-11.test.js`) :
  - « une sortie d'erreur rendue à part ne compte pas pour le seuil » : rouge avant la correction,
    vert après. Avec la sortie standard « court » et un `stderr` de 1 000 caractères, l'étape reste
    `pending` et le message « 1 offre(s) notée(s) sans lecture de leur page » apparaît. Avec la
    sortie standard longue, l'étape est `done`.
  - Cas fusionné du vérificateur, rejoué tel quel et marqué `todo` : il échoue tant que `tools.js`
    fusionne les deux sorties. Il devra passer quand `tools.js` les séparera.

Tests de la seconde passe (un fichier à la fois, résultats exacts) :

- review2-lecture-18-11 : 7 réussis, 0 échec, 1 todo. Le todo est le cas fusionné, qui échoue comme
  prévu.
- lecture-18-11 11/11, review-lecture-18-11 3/3, skill-router 41/41, note-sans-lecture 11/11,
  lecture-page-liste 12/12, lecture-page-resultats 4/4, career-script-usage 4/4, preuve-effet 7/7,
  bilan-evaluer-puis-postuler 8/8, contrat-agents 14/14.
- `npm run check` : « Syntaxe JavaScript valide. »
- `npx prettier --check` sur `skill-router.js` et le fichier de tests : conforme.

Reste à décider par le propriétaire, en complément du point 1 ci-dessus : choisir entre (a) faire
rendre à `tools.js` la sortie d'erreur à part, dans le champ `stderr`, déjà ignoré par le routeur, et
(b) ne compter aucune lecture par script en texte simple, ce qui retire `fetch-jd` du sprint. Tant
que rien n'est décidé, un script qui écrit peu sur sa sortie standard mais beaucoup sur sa sortie
d'erreur peut encore faire passer une annonce pour lue.

Commit de la seconde passe : `382a498` (code et tests), puis ce rapport.
