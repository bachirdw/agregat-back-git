# Rapport `review-precision-18-11` — relecture et correction du sprint `precision-18-11` (E130)

Arbre `~/Downloads/agregat-back-precision`, branche `precision-18-11`. Seul écrivain de l'arbre pendant la relecture.
Rapport écrit le 18/11/2026 à 17:53 (heure lue par `date`).

Lu : le brief `.manager/briefs/precision-18-11.md`, le diff `contacts-13-11..precision-18-11`, les deux relectures
(angle « consigne », angle « tests ») et le compte rendu du codeur.

## Défauts, par gravité, et leur sort

| Gravité | Défaut | Sort |
| --- | --- | --- |
| moyen | La phrase envoyée à tous les agents nommait l'outil de question d'un seul agent : « (AskUserQuestion / elicitation ACP) ». Constaté (le texte de `OWNER_QUESTION_RULE`). Antérieur au sprint. | **Corrigé** : « (elicitation ACP) », le protocole commun. La règle du propriétaire (aucun nom d'agent ni d'outil d'un agent dans un texte envoyé aux agents) prime sur « le reste de la phrase ne change pas » du brief. Code, citation de `docs/api-questions.md` et commentaire du fichier mis à jour. |
| faible | Le test de `tests/review-questions-18-11.test.js` ne cherchait que les noms de l'outil d'un agent (`/_async\|request_user_input\|codex/i`) ; il passait avec « AskUserQuestion » dans la phrase. Constaté. | **Corrigé** : motif élargi à tous les agents et à leurs outils (`/askuserquestion\|request_user_input\|_async\|claude\|codex\|gemini\|opencode/i`). Contre-épreuve : il échoue si « AskUserQuestion » revient. |
| faible | La précision avait perdu « de ta réponse » par rapport aux mots essayés en réel (e5a4d8a6). Constaté (écart venu du brief). | **Corrigé** : « …pose ta question par le champ JSON question de ta réponse. », dans le code, la documentation et les trois fichiers de tests qui figent le texte. |
| faible | « Dans les deux cas » suit désormais la phrase sur l'outil qui n'attend pas ; un agent pourrait le lire comme « l'outil qui n'attend pas ou le champ JSON ». Hypothèse, non essayée ; l'essai réel e5a4d8a6 ne montre pas cette lecture. | **Laissé au propriétaire / manager** : la place est celle que fixe le brief, et toute reformulation serait un texte non essayé en réel. À regarder à l'épreuve 3 rejouée. |
| faible | `doubt-rule.js` dit « …comme le dit la règle des questions, et attends : … ». Peut pousser un agent sans formulaire à attendre pendant son tour. Hypothèse, non essayée, hors du brief. | **Laissé au propriétaire / manager** : fichier hors du périmètre du sprint. Piste du relecteur notée : « …comme le dit la règle des questions : la mission reste ouverte dans la même session et attend sa réponse ; ne choisis pas au hasard. » |

Test manquant signalé par les deux relecteurs (la troisième branche, `withDoubtRule`, sans vérification du texte de la
précision) : **ajouté** (voir plus bas).

Non changé : `docs/api-questions.md` ligne 7 (« AskUserQuestion côté Claude ») est de la documentation pour le
propriétaire, jamais envoyée aux agents ; hors de la règle.

## Tests ajoutés — `tests/review-precision-18-11.test.js`

Par le même chemin que l'agent réel : `createApp` → `engine.create` → `plan` → agent factice
`tests/fixtures/fake-acp.js`, qui enregistre la consigne réellement reçue ; chaque profil de
`packages/agent-runtime/profiles.js` prête son identité à l'agent du plan.

1. Phrase commune : la précision, mots exacts de l'essai réel, une seule fois ; aucun nom d'agent ni d'outil d'agent ;
   le formulaire nommé « (elicitation ACP) ».
2. `docs/api-questions.md` cite la phrase commune à l'identique.
3. à 6. Consigne réellement envoyée, pour quatre parcours — général (core) et Najah (branche `withDoubtRule`),
   career-ops, navigateur en mode propriétaire : la précision une fois, la phrase commune une fois, aucun nom d'agent ni
   d'outil d'agent dans toute la consigne, et une consigne identique pour tous les profils.

Fichiers de tests existants adaptés au texte corrigé : `tests/fix-resume.test.js`, `tests/question-mal-formee.test.js`,
`tests/review-questions-18-11.test.js` (« de ta réponse », motif élargi).

## Contre-épreuve (constatée)

Copie de `packages/orchestrator/owner-question-rule.js` dans le dossier de travail temporaire, et du `git diff` avant
essai ; chaque modification annulée par recopie du fichier.

- A — « (AskUserQuestion / elicitation ACP) » remis : `review-precision-18-11` 0/6 (6 échecs) ;
  `review-questions-18-11` 13/14 (« la précision sur l'outil qui n'attend pas, à sa place » échoue, ce qu'il ne faisait
  pas avec l'ancien motif).
- B — précision retirée : `review-precision-18-11` 0/6.
- C — « de ta réponse » retiré : `review-precision-18-11` 0/6.
- Après chaque essai, `git diff` comparé octet par octet (`cmp`) au `git diff` d'avant : identique.

Le test 2 (documentation) échoue aussi dans A, B et C : la documentation n'était pas modifiée en même temps que le code,
c'est ce qu'il doit voir.

## Résultats exacts (un fichier à la fois, après correction)

- `node --test tests/review-precision-18-11.test.js` : tests 6, pass 6, fail 0
- `node --test tests/question-mal-formee.test.js` : tests 14, pass 14, fail 0
- `node --test tests/review-questions-18-11.test.js` : tests 14, pass 14, fail 0
- `node --test tests/fix-resume.test.js` : tests 28, pass 28, fail 0
- `node --test tests/doubt-tools.test.js` : tests 19, pass 19, fail 0
- `node --test tests/agent-result.test.js` : tests 13, pass 13, fail 0
- `node --test tests/elicitation.test.js` : tests 26, pass 26, fail 0
- `node --test tests/question-finale.test.js` : tests 8, pass 8, fail 0
- `node --test tests/bilan-questions.test.js` : tests 2, pass 2, fail 0
- `node --test tests/reponse-prose.test.js` : tests 6, pass 6, fail 0
- `node --test tests/career-integration.test.js` : tests 50, pass 50, fail 0
- `npm run check` : « Syntaxe JavaScript valide. »
- `npx prettier --check` sur les six fichiers touchés (code, documentation, quatre fichiers de tests) : « All matched
  files use Prettier code style! »

## Non vérifié

- Aucun essai réel avec un agent. En particulier : l'effet du retrait de « AskUserQuestion » sur l'agent qui a ce
  formulaire (garde-t-il son formulaire avec « formulaire de question de ton agent (elicitation ACP) » seul ?) et l'effet
  de la phrase complète, intégrée à la consigne, sur l'agent qui n'a qu'un outil qui n'attend pas. L'essai du 18/11 à
  17:33 portait sur l'ancienne phrase commune (avec le nom de l'outil) plus la précision ajoutée au prompt.
- Pas de `npm test` complet (laissé au manager).

## Reste à décider (propriétaire / manager)

- Garder « Dans les deux cas » ou lever l'ambiguïté possible (hypothèse) ; à juger après l'épreuve 3 rejouée.
- « et attends » dans la règle de doute (hypothèse, hors du brief).
- Rejouer en réel l'épreuve 3 avec chaque agent sur la phrase corrigée, sans nom d'outil.
