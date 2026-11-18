# Brief `questions-18-11` — la question d'un agent arrive au propriétaire, quel que soit l'agent

Écrit par le manager le 18/11/2026 sur l'accord du propriétaire (« Oui, lance »).
Arbre : `~/Downloads/agregat-back-questions`, branche `questions-18-11` (partie de `contacts-13-11`).
Rapport au fil de l'eau : `.manager/reports/questions-18-11.md`. Commits locaux `[questions-18-11]` par chemins
explicites (`git commit -m … -- <fichiers>`, `git add` seulement pour un fichier nouveau). Aucun push, aucun merge.

À lire d'abord : `.manager/HANDOFF.md` (sections 2, 5 et 9), `.manager/reports/questions-agents-18-11.md` (les faits et
les essais réels), les lignes E126 et E127 de `.manager/reports/registre-erreurs.md`, `docs/api-questions.md`.

## Le problème, établi par des faits
- Claude ouvre un formulaire (elicitation ACP) quand il a une question ; Codex n'en ouvre pas : il n'a un formulaire
  qu'en mode de collaboration « plan », où il refuse d'écrire. La voie commune à tous les agents est donc le champ
  JSON `question` de la réponse.
- La consigne du pack career-ops (`CAREER_INSTRUCTIONS`, `packages/career-ops/integration.js`) cite ce champ sans son
  format. La consigne des missions navigateur (`packages/orchestrator/index.js`) le donne. Sans format, Codex en
  invente un (`{"question":{"choices":[…]}}`, la question étant dans `summary`) ou n'en met aucun et écrit « j'attends
  vos réponses » (E126).
- Un champ `question` mal formé fait refuser toute la réponse (`parseAgentResult`, `packages/orchestrator/result.js`) :
  le JSON brut est affiché comme réponse, aucune question n'est ouverte, la mission finit `completed` (E127).
- Essai réel : avec le format écrit dans le prompt, la question de Codex s'ouvre (`prose`) et la mission attend.

## Règle du propriétaire qui cadre ce sprint
Mêmes autorisations et mêmes permissions pour tous les agents (Claude, Codex, Gemini, OpenCode). **Aucune particularité
d'un agent codée en dur** : pas de branche sur l'identité de l'agent (`definition.id === 'codex'` et équivalents), pas
de consigne propre à un agent. Ce qui est écrit vaut pour tous.

## Travail demandé

### 1. Une consigne commune, la même pour tous les agents et tous les packs
Une seule phrase, définie à un seul endroit et reprise par toutes les consignes qui parlent de question au
propriétaire (pack career-ops, missions navigateur, et tout autre endroit que tu trouves par `grep`). Elle dit, en
substance : pour poser une question au propriétaire, utilise le formulaire de question de ton agent s'il t'en offre
un ; sinon termine ta réponse par le champ `question` au format exact `{"question":{"message":"…","options":["…","…"]}}`
(options facultatives) ; dans les deux cas la mission attend la réponse dans la même session ; n'écris jamais que tu
attends une réponse sans avoir fait l'un des deux. Ne retire rien d'autre des consignes existantes. Si un test fige le
texte actuel d'une consigne, adapte-le en le disant au rapport.

### 2. Filet : une question mal formée n'est plus avalée en silence
Dans le contrôle de la réponse (`packages/orchestrator/result.js`) et sa suite dans l'orchestrateur, sans rien de
propre à un agent :
- un champ `question` présent mais mal formé (objet sans `message`, mauvais type) ne fait plus refuser toute la
  réponse : le reste de la réponse (`simulated`, `summary`, `evidence`) est gardé ;
- si la fin de `summary` se lit comme une question (la fonction existante `decisionRequest`), la question est ouverte
  avec ce texte, et les choix sont repris d'une liste de courtes chaînes trouvée dans le champ mal formé, quel que soit
  le nom de sa clé, dans les bornes existantes (8 choix, 200 caractères) ;
- sinon la réponse est gardée telle quelle et le Bilan dit, en une ligne de la plateforme, que l'agent a joint une
  question que la plateforme n'a pas pu lire et qui n'a pas été posée ; un événement le trace ;
- le JSON brut de l'agent n'est jamais affiché comme réponse dans ces cas.
Le cas déjà traité le 11/11 (question en simple chaîne) continue de marcher.

### 3. Documentation
`docs/api-questions.md` : la phrase commune, le format, et le comportement sur une question mal formée.

## Tests attendus (par le même chemin que l'agent réel : agent factice `tests/fixtures/fake-acp.js`)
- la consigne envoyée à l'agent contient la phrase commune et le format, pour le pack career-ops et pour une mission
  navigateur, et elle est identique quel que soit l'agent (boucle sur tous les profils d'agents) ;
- réponse `{"simulated":false,"summary":"<une question ?>","evidence":[],"question":{"choices":["a","b"]}}` : une
  question s'ouvre (`awaiting_owner`) avec le texte de `summary` et les deux choix ; après la réponse du propriétaire,
  la mission continue dans la même session ;
- champ `question` mal formé et `summary` sans question : mission `completed`, résumé = le texte de l'agent (pas de JSON
  brut), ligne de la plateforme au Bilan, événement tracé ;
- question au bon format, question en simple chaîne, réponse sans champ `question` : comportements inchangés ;
- aucun test ne dépend du nom d'un agent.
Tout nouveau test hors Chrome est pris par `scripts/run-tests.js` dans la phase sans navigateur.

## Limites (ne pas dépasser)
- Aucune règle métier dans le moteur ; aucune garde, demande d'accord, liste de blocage ni restriction de l'agent
  ajoutée ; cartes d'envoi, permissions et reprise (`checkpoint.js`, `resume-history.js`) intactes.
- Ne pas basculer Codex en mode « plan », ne pas toucher aux modes ni aux profils des agents.
- Ne pas détecter « j'attends vos réponses » par des phrases : la leçon du projet est que la lecture par libellés rate.
- Intouchables : le Skill, la bibliothèque career-ops, les CV, `~/Downloads/career-ops-essai` (lecture seule),
  `~/Downloads/agregat-back` (ne jamais y aller), `~/Downloads/agregat-back-essai-13-11` (arbre de l'API en marche :
  lecture seule), le front (autre dépôt : si un changement d'affichage est utile, le dire au rapport).
- Aucun secret lu. Dépôt public : aucune donnée personnelle dans le code, les tests, les fixtures ni les rapports.

## Vérification (le propriétaire teste sur l'API 4314)
Interdits : `npm test`, `npm run test:browser`, `npm run test:live`, tout essai avec un vrai agent, tout serveur sur
4313, 4314, 4321, 5176, 5177, toute sonde du relais Playwriter, tout POST vers `http://127.0.0.1:4314`.
À lancer : `node --test tests/<fichier>.test.js` sur les tests touchés et voisins (questions, résultat, Bilan,
reprise, message du propriétaire, career-ops), puis `npm run check` et `npm run format:check`.
La suite complète et les essais réels (Codex et Claude) seront faits par le manager.

## Rapport attendu
Français, horodaté (`date` avant chaque heure). Ce qui est changé fichier par fichier ; tests ajoutés et résultat
exact ; ce qui n'est pas vérifié (rien en réel : le dire) ; ce qui reste à décider par le propriétaire.
