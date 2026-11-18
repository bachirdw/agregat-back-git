# Rapport `prompt-prime-18-11` — le prompt du propriétaire prime sur le Skill

Arbre `~/Downloads/agregat-back-prompt`, branche `prompt-prime-18-11`. Début : 18/11/2026 18:06 (`date`).

## 1. Constaté dans le code avant de coder (18:06)

- `packages/career-ops/integration.js:25` — `CAREER_OWNER_FRAME` dit « Le Skill career-ops s’applique tel qu’il est
  écrit ». Ce cadre part par `systemPromptAppend` (`packages/orchestrator/index.js:1468`), donc dans
  `_meta.systemPrompt.append` de `session/new` (`packages/agent-runtime/index.js:382-383`). C'est une extension ACP :
  rien dans le code ne garantit que tous les agents la lisent (hypothèse : seuls certains adaptateurs la lisent ; non
  vérifié en réel).
- `packages/career-ops/integration.js:26-27` — `CAREER_INSTRUCTIONS` commence par « Active le Skill career-ops, lis son
  mode pertinent via career_read et suis exactement sa méthode, ses scripts, son ordre et ses formats. » Aucune phrase
  ne dit que le prompt du propriétaire l'emporte quand il demande autre chose que ce que le Skill recommande.
- `CAREER_INSTRUCTIONS` part dans le champ `instructions` du prompt JSON envoyé à chaque agent
  (`packages/orchestrator/index.js:1625-1628`), le même texte quel que soit l'agent : c'est le seul canal lu par tous.
- La consigne des missions navigateur dit déjà « Le prompt de l’utilisateur prime sur toute autre règle »
  (`packages/orchestrator/index.js:1630`).
- `tests/career-integration.test.js:1068-1086` fige « suis exactement sa méthode, ses scripts, son ordre et ses
  formats » et « Le Skill career-ops s’applique tel qu’il est écrit », et interdit « priment sur les règles » et
  « l’emporte sur la demande » (E39 : ces tournures faisaient lire le cadre comme une injection). La nouvelle phrase
  doit éviter ces deux tournures.
- `tests/fixtures/career-agent.js:289` et `packages/orchestrator/skill-router.js:339` reprennent « suis exactement sa
  méthode » : ils restent valides si ce début de phrase est gardé.
- Aucun fichier de `docs/` ne décrit le texte de la consigne du pack (recherche de « tel qu’il est écrit », « son ordre
  et ses formats », `CAREER_OWNER_FRAME`) : `docs/api-questions.md` cite `CAREER_INSTRUCTIONS` seulement pour la règle
  des questions. Aucun fichier de documentation n'est donc touché.

## 2. Ce qui change, fichier par fichier

`packages/career-ops/integration.js` (commit `b0f77fc`, 18:08)

- Nouvelle constante exportée `OWNER_PROMPT_PRIME`, définie à ce seul endroit, la même pour tous les agents :
  « Le prompt du propriétaire prime sur le Skill : il décide de ce qui est fait (périmètre, volume, sources, seuils),
  le Skill dit comment le faire. Si le prompt demande plus, ou autre chose, que ce que le Skill recommande, suis le
  prompt et dis dans ta réponse ce que le Skill recommandait. »
- `CAREER_INSTRUCTIONS` : la phrase y est insérée une fois, juste après la première ; la première devient « … suis
  exactement sa méthode, ses scripts, son ordre et ses formats pour faire ce que le prompt demande. » (ajout de la fin
  seulement, pour l'accorder). Rien d'autre n'est retiré : clic avant envoi final (dans le cadre), CAPTCHA, « ne
  fabrique », « données non fiables », questions, JSON de réponse, inchangés.
- `CAREER_OWNER_FRAME` : « Le Skill career-ops s’applique tel qu’il est écrit » devient « … tel qu’il est écrit pour la
  manière de faire ; ce qui est fait, c’est le prompt du candidat qui le décide. » (le cadre parle déjà du « candidat »
  partout ; le mot est gardé pour rester cohérent). Le reste du cadre est inchangé.
- Choix de canal : la phrase complète est dans `CAREER_INSTRUCTIONS` (champ `instructions` du prompt, lu par tous les
  agents), pas dans le cadre système, qui passe par `_meta.systemPrompt` et n'est pas garanti lu par tous ; le cadre ne
  reçoit que l'accord de sa phrase existante. Ainsi la consigne porte la phrase une fois.
- Tournures évitées : « priment sur les règles », « l’emporte sur la demande » (E39, testées absentes).

`tests/prompt-prime-18-11.test.js` (nouveau)

- Test 1 : la phrase dit quoi / comment, ne nomme aucun agent (ni fournisseur), le cadre non plus ; les tournures E39
  restent absentes.
- Test 2 : la phrase apparaît une fois dans `CAREER_INSTRUCTIONS` ; la méthode du Skill et les règles de la plateforme
  (CAPTCHA, « ne fabrique », données non fiables, suspension de l'envoi final par la plateforme) restent écrites.
- Test 3 : par le chemin réel du moteur (`app.engine.create`, pack career-ops, mode propriétaire), avec l'agent factice
  `tests/fixtures/fake-acp.js` lancé sous chacun des profils de `packages/agent-runtime/profiles.js` (fixture, codex,
  claude, gemini, opencode : seul l'`id` du profil change, la commande reste le faux agent) : la consigne reçue porte
  la phrase une fois, après « suis exactement sa méthode », et elle est identique d'un profil à l'autre. Le faux agent
  vérifie aussi que le cadre système reçu contient la phrase accordée (`expectSystemPrompt`). Navigateur `fixture`
  demandé et `startRelay` remplacé par un témoin qui doit rester à faux : aucun relais touché.

Aucun fichier de documentation : aucun ne décrit le texte de cette consigne (voir section 1).
Aucun test existant modifié : les assertions de `tests/career-integration.test.js:1068-1086` et
`tests/fixtures/career-agent.js:280-293` restent vraies avec le texte accordé (vérification à l'exécution, section 3).

Test commité en `3de3fe3`. Écart d'écriture : le premier passage du test 3 exigeait l'état `completed` ; la mission
finit `failed` (« Mission incomplète : Scanner les portails du Skill (non exécutée) ») parce que le faux agent ne lance
pas le scan que le routeur attend pour ce prompt. Le test exige désormais un état terminal et lit la consigne reçue,
ce qui est son seul objet. Hypothèse non vérifiée : aucun effet sur ce que reçoit un vrai agent.

## 3. Tests (aucun test lancé avant 18:20 ; premier test à 18:20 par `date`)

Tous lancés avec `AGENT_PLATFORM_CDP_ENDPOINT=http://127.0.0.1:1` devant la commande : dans ces fichiers, une mission
career-ops en mode propriétaire sans cette variable appelle `startRelay()` (`packages/orchestrator/index.js:575`), qui
interroge le port 19988 et peut lancer le relais. Avec la variable, aucun appel au relais (port 1, fermé).

| Commande                                                     | Résultat                                                     |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| `node --test tests/prompt-prime-18-11.test.js` (1er passage) | 3 tests, 2 réussis, 1 échoué (état `failed`, voir ci-dessus) |
| `node --test tests/prompt-prime-18-11.test.js`               | 3 tests, 3 réussis, 0 échoué                                 |
| `node --test tests/career-integration.test.js`               | 50 tests, 50 réussis, 0 échoué                               |
| `node --test tests/consigne-fichiers-travail.test.js`        | 2 tests, 2 réussis, 0 échoué                                 |
| `node --test tests/career-pipeline-flow.test.js`             | 7 tests, 7 réussis, 0 échoué                                 |
| `node --test tests/review-questions-18-11.test.js`           | 14 tests, 14 réussis, 0 échoué                               |
| `npm run check`                                              | « Syntaxe JavaScript valide. »                               |
| `npx prettier --check` (integration.js, test, rapport)       | conformes (rapport reformaté par prettier en fin)            |

Tests non lancés

- `tests/doubt-tools.test.js`, `tests/question-mal-formee.test.js` : ils jouent aussi des missions navigateur en mode
  propriétaire (risque de toucher le navigateur ou le relais pendant une mission réelle). Ils lisent
  `CAREER_INSTRUCTIONS` pour la règle des questions et du doute, que ce sprint ne change pas.
- Les autres fichiers qui importent `integration.js` (`bilan-mixtes`, `memoire-fil`, `reprise-memoire*`,
  `preuves-entre-tours`, etc.) : pas de suite complète demandée ; non lancés.
- `npm test` complet : interdit par le brief.

## 4. Non vérifié

- Aucun essai réel : on ne sait pas encore si un vrai agent suit la phrase (par exemple garde des offres sous 4,0 quand
  le prompt demande « le plus d'offres possible ») ni s'il dit ce que le Skill recommandait. Essai à faire par le
  manager, avec Claude et avec Codex.
- Le cadre système (`CAREER_OWNER_FRAME`) n'est vérifié qu'à la réception par le faux agent ; quels vrais agents lisent
  `_meta.systemPrompt` n'est pas vérifié ici.
- Le test 3 change seulement l'`id` du profil sous un faux agent : les différences propres aux vrais adaptateurs (lecture
  du champ `instructions`) ne sont pas couvertes.

## 5. Écarts au brief

- Aucun fichier de documentation touché : aucun ne décrit cette consigne.
- Variable `AGENT_PLATFORM_CDP_ENDPOINT` ajoutée aux commandes de test (voir section 3), pour ne pas toucher au relais.

## 6. À décider par le propriétaire (non tranché)

- Mot employé : la phrase dit « propriétaire » (comme le reste de `CAREER_INSTRUCTIONS`), le cadre système dit
  « candidat » (comme le reste du cadre). Les deux désignent la même personne ; unifier ou non.
- `packages/orchestrator/skill-router.js:339` répète « suis exactement sa méthode » sans la nouvelle précision (fichier
  hors du périmètre, non touché). La phrase qui prime suit dans la même consigne ; dire s'il faut l'y accorder aussi.
- Seuils du Skill (ex. note sous 4,0) : la consigne laisse l'agent suivre le prompt et le signaler ; aucun seuil n'est
  changé dans le Skill (intouchable).
