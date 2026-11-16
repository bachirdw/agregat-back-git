# Relecture `review-reprise-16-11` — reprise qui garde ce que le propriétaire a dit

Relecteur indépendant : Claude (Opus), sous-agent du manager. Arbre `~/Downloads/agregat-back-reprise`, branche
`reprise-16-11`. Diff relu : `git diff 832aa59..HEAD` (commits `4ba5f3d`, `cbe066a`, `db0815c`, `edf2095`).
Début 16/11/2026 18:59, fin 19:08 (heures lues par `date`). Légende : (C) constaté (exécuté ou lu dans un fichier
installé), (L) lu dans le code, (H) hypothèse.

## Verdict
Intégrable après les deux corrections ci-dessous (commit `19019e7`). Le correctif fait ce que le brief demande : le
point de reprise porte, pour les cinq dernières exécutions de la chaîne, les questions et réponses, les messages du
propriétaire, les constats de la plateforme et la réponse du modèle à part du Bilan, chacun avec sa provenance. Les
tests du codeur passent par le même chemin que l'agent réel (agent factice ACP, `replay_unqualified`, session neuve)
et échouent quand on retire le correctif (vérifié). Rien n'est vérifié en réel.

## Défauts trouvés, par gravité

### Moyen — corrigé : le texte des questions des formulaires Claude était perdu
`packages/orchestrator/resume-history.js`, `questionsOf()` (ligne 132 avant correction). (C) L'adaptateur Claude
installé (`@agentclientprotocol/claude-agent-acp` 0.95.0, `dist/elicitation.js`, `askUserQuestionsToCreateRequest`)
met plusieurs questions dans **un** formulaire : message « Please answer the following questions. », champ
`question_<n>` dont le `title` est l'en-tête court et la `description` le texte de la question, puis un champ libre
`question_<n>_custom` intitulé « Other ». C'est la forme du cas réel 0e397f84 (formulaires de 4 et 8 champs). Le
point de reprise ne gardait que le `title` : l'agent recevait « Other : <réponse libre> » sans savoir à quelle
question elle répondait. Les tests du codeur n'avaient qu'un champ par formulaire. Correction : chaque champ garde
sa `description` (bornée à 1 000 caractères, masquée), provenance « déclaré par le modèle (question posée) » pour
`title` et `description` (`checkpoint.js`).

### Moyen — corrigé : le Bilan pouvait passer pour la réponse du modèle
`packages/orchestrator/index.js`, `modelAnswerOf()` (ligne 1003 du commit `cbe066a`). Un résultat récent dont le
champ `answer` existe mais est vide (la plateforme n'a pas retrouvé de réponse du modèle : mission privée dont le
fichier privé manque, résumé remplacé par la plateforme) retombait sur `summary`, c'est-à-dire sur les lignes du
Bilan, envoyées sous « déclaré par le modèle ». Correction : un champ `answer` présent fait foi, même vide ; le
repli sur `summary` reste pour les résultats d'avant le 11/11 (sans `answer`), comme avant le sprint ; pour une
mission privée d'avant ce sprint (fichier sans `answer`), la réponse publique non vide passe d'abord (cas 0e397f84,
mode propriétaire), puis le `summary` privé.

### Faible — laissé, dit au rapport
1. Doublon à la première reprise : le même message part trois fois (`missionObjective`, `previousOwnerMessage`,
   `history.executions[0].ownerMessage`), au plus 4 000 + 4 000 + 2 000 caractères. Pas gênant pour la justesse
   (même texte, même provenance) ; coût de quelques milliers de caractères. Non retiré : `memoire-fil.test.js` et
   `fix-resume` lisent `missionObjective` / `previousOwnerMessage`, et la consigne les nomme ; le retrait serait un
   changement de forme du prompt, à décider par le propriétaire.
2. Liste des fichiers modifiés : (C) sur l'espace réel `career-ops-essai` (métadonnées seules, aucun nom affiché),
   `changedFiles` rend `truncated: true` même sans borne de nombre, parce qu'un dossier dépasse la profondeur 6 ; la
   liste y sera donc toujours dite « incomplète » (`complete: false`). C'est honnête, mais l'information est
   affaiblie. 3 276 fichiers visibles, 57 ms au premier passage, 13 ms ensuite. (H) Un fichier copié avec sa date
   d'origine (copie qui garde `mtime`) n'apparaît pas ; un fichier supprimé non plus ; une autre mission simultanée
   dans le même espace ajoute les siens (le codeur le dit).
3. Messages du propriétaire d'une mission `pack: career-ops` hors espace `career-ops` en mode privé : le texte n'est
   ni dans l'événement ni dans un fichier (`message()` n'écrit le fichier que pour `workspace === 'career-ops'`) ;
   le point de reprise dit alors `text: null`. Défaut d'avant ce sprint, cas non rencontré (H).
4. Les messages non remis sont transmis (état « non remis à l’agent ») alors que le brief parlait des messages
   remis. Je le juge juste : c'est la parole du propriétaire, son état est dit.
5. `checkpointLine()` compte les questions transmises, pas celles retirées par les bornes ; la ligne reste vraie
   (« ce qui a été envoyé »).
6. Le fichier privé `relay/runs/<id>-result.json` grossit de la taille de la réponse (champ `answer` en plus du
   `summary` qui la contient déjà) ; lecture bornée à 2 Mo (`server.js` ligne 281, `modelAnswerOf`).

## Points du brief vérifiés
- Justesse (L, puis tests) : question refusée, annulée, délai écoulé, nouvelle mission, sans événement `answer`
  (mission interrompue) ; champ facultatif vide ; booléen `false` et nombre `0` gardés comme réponses ; choix
  multiples (`items.anyOf`, titres d'options) ; réponse libre « Other » ; deux formulaires ; mission d'origine en
  échec ; mission interrompue par un redémarrage ; tour fini sans texte (la mission échoue : « Réponse non
  structurée », cause transmise en constat) ; cycle dans `resumedFrom` (s'arrête, deux exécutions) ; parent absent
  de la base (chaîne partielle, objectif = plus ancienne trouvée) ; mode privé ; mission hors career-ops (liste des
  fichiers sur la fiche). Workflow : (L) la reprise d'un workflow se fait en place (`resumeWorkflow`), sans point de
  reprise : non concerné. Codex et tour détaché : (L) rien dans le correctif ne dépend de l'agent.
- Fidélité : provenances justes après correction ; la consigne ne dit plus « sans rejouer la mission précédente »
  mais « poursuit la même mission », « ne les redemande pas sauf contradiction ou manque », « n’est pas à refaire
  sauf demande », réponse du modèle « déclarée, non prouvée ». Rien de faux affirmé. Réserve (L) : les étapes du
  Skill dites `skipped` à tort (défaut 18.6) partent telles quelles sous « constaté ».
- Régressions : l'assertion de `memoire-fil.test.js` a changé parce que `previousAnswer` ne contient plus les lignes
  du Bilan (elles passent par `history.executions[].platform.notes`) : changement voulu, aucune perte. Lecteurs de
  `summary` : `.manager/outils/isolation-probe.mjs`, `bilan-vs-events.mjs` lisent `run.result.summary` (inchangé) ;
  le front (`agregat-front`, `src/Career.tsx` lignes 477 et 704, lu sans modifier) lit `summary` du résultat privé ;
  personne ne lisait `previousAnswer` hors du prompt. Ligne de session : « Historique non rejoué » devient
  « Conversation non rejouée » ; aucun test ni outil ne cherchait l'ancienne formule (recherche faite).
- Bornes : par champ (voir `HISTORY_LIMITS`), total de l'historique 40 000 caractères JSON (les étapes du Skill et
  les champs ne sont pas retirés par `boundedHistory`, une seule exécution peut donc dépasser un peu : au plus
  ~45 000 en théorie), réponse 12 000, secrets passés par `redact()`. Rien de plus dans les journaux : le point de
  reprise n'est écrit ni en événement ni en fichier (L).
- Coût mesuré (C, base SQLite fictive, script hors dépôt) : `checkpointFor` sur 5 missions de 1 000 événements :
  19 ms ; 5 × 5 000 petits événements : 72 ms ; 5 × 4 500 événements d'environ 1,7 Ko (taille du pire cas réel :
  4 473 événements et 7,5 Mo pour la plus grosse mission de la base d'essai, comptes lus en lecture seule) :
  132-135 ms ; 7 × 20 000 : 910 ms. Une fois par reprise, synchrone. Piste si besoin : filtrer par type en SQL
  (`packages/storage`, hors périmètre, non fait).
- Périmètre (L) : aucune règle métier dans `packages/orchestrator` (le module ne connaît ni candidature ni offre),
  rien dans `packages/agent-runtime`, aucune garde ni demande d'accord, cartes d'envoi et refus
  `replay_unqualified` (`agent-runtime/index.js` ligne 373) intacts, aucun fichier hors périmètre.

## Tests
- Preuve que les tests du codeur testent le correctif (code annulé localement par copie, puis rétabli, `git status`
  propre vérifié) : sans `history` ni `previousAnswer` séparée → acceptation, chaîne de deux reprises et mission
  privée échouent (3/3) ; `decline` lu « répondue » → test du refus échoue ; sans le champ `answer` du résultat
  privé → le test du codeur passait encore (le brouillon était aussi dans `summary`) : trou comblé par mon test
  « mission privée : la réponse du modèle passe sans les lignes du Bilan », qui échoue alors.
- Ajouté : `tests/reprise-memoire-relecture.test.js` (8 tests, phase sans navigateur de `scripts/run-tests.js` par
  défaut, il n'est pas dans la liste Chrome). Sans mes deux corrections, 2 de ces tests échouent (vérifié).
- Lancés : `node --test` sur `reprise-memoire`, `reprise-memoire-relecture`, `memoire-fil`, `fix-resume`,
  `resume-probe`, `etape-reprise-echec`, `workflow-resume`, `message-proprietaire`, `career-integration`,
  `bilan-mixtes`, `conversation-isolation` : 152 tests, 152 réussis, 0 échec. `npm run check` : « Syntaxe
  JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code style! ».
- Non lancés (interdits) : `npm test`, phase Chrome, `test:live`.

## Rapport du codeur
- Diagnostic : appuyé sur la base (lecture seule) et sur un rejeu du code (R), bien séparé des hypothèses. Je n'ai
  pas refait le rejeu ; j'ai seulement compté les événements par mission (aucun contenu lu).
- Étude du rechargement exact : (C) versions installées 0.95.0 (Claude) et 2.2.2 (Codex) ; (C) `loadReplayEnd`
  existe dans `claude-agent-acp/dist/air-extension.js` et `acp-agent.js` comme décrit. (C) `loadSessionAndReplayHistory`
  n'apparaît pas dans le paquet Codex installé (le codeur l'a lu dans un clone de référence, il le dit) ; le paquet
  installé dit en commentaire que `session/load` finit de rejouer avant de répondre, mais attend la génération du
  titre avec un délai (`waitForIdle(timeoutMs)`) : un `session_info_update` peut donc arriver après la réponse. La
  réponse à `session/load` n'est donc pas une frontière sûre pour toutes les mises à jour (H à qualifier).
- Aucune donnée personnelle trouvée dans le rapport, les tests, les fixtures ni le module (recherche d'adresses,
  d'URL, de noms) : données marquées FICTIF, identifiants de mission seulement.

## Ce qui reste (décisions du propriétaire)
1. Essai réel (une reprise après un formulaire Claude à plusieurs questions) : non fait.
2. Doublon du message à la première reprise (point faible 1).
3. Profondeur de `changedFiles` sur l'espace réel (toujours « incomplète ») : relever la borne ou l'accepter.
4. Lecture de la fin d'un brouillon comme une question, rechargement exact : hors brief, inchangés.

## Commits
- `19019e7` [review-reprise-16-11] Reprise : texte des questions des formulaires Claude, Bilan jamais donné pour la
  réponse du modèle ; tests des cas manquants.
- Ce rapport.
