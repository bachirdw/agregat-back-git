# Correctifs de l'audit orchestrateur — 10/11 (branche `audit-orch`)

Source : `.manager/reports/audit-10-11/orchestrateur.md`. Un commit par correctif. Chaque correctif a
un test qui échouait avant et passe après (vérifié en retirant le correctif, sauf mention). Aucun
agent réel, aucune clé, aucun réseau externe. `packages/browser-gateway/`, `packages/mcp-gateway/`,
`packages/career-ops/` et la bibliothèque career-ops ne sont pas touchés. Le manifeste de la
plateforme `domain-packs/career-ops/skill-manifest.yaml` a changé (point 1).

| #   | Constat                                            | État                   | Commit    | Test                                                      |
| --- | -------------------------------------------------- | ---------------------- | --------- | --------------------------------------------------------- |
| 1   | Essai réel : « Postule … CV adapté » → `documents` | corrigé                | `81b6b61` | `tests/intention-candidature.test.js`                     |
| 2   | n° 1 : 3 min hors career-ops                       | corrigé                | `69fd1ea` | `tests/delai-navigation-libre.test.js`                    |
| 3   | n° 2 : `{"question":…}` sans Skill                 | corrigé                | `97a5968` | `tests/agent-result.test.js`, `tests/elicitation.test.js` |
| 4   | n° 3 : « Navigation non prouvée » jette le travail | corrigé                | `6706e12` | `tests/fix-resume.test.js`                                |
| 5   | n° 4 : politesse prise pour une question           | corrigé                | `f3c74b3` | `tests/question-finale.test.js`                           |
| 6   | n° 6 : parseur fragile                             | corrigé                | `b60339d` | `tests/agent-result.test.js`                              |
| 7   | n° 8 : ligne des envois sans Skill                 | corrigé                | `5b932a6` | `tests/fix-resume.test.js`                                |
| 8   | n° 9 : `execute()` sans garde                      | corrigé                | `6c0c28d` | `tests/execution-rattrapee.test.js`                       |
| 9   | n° 12 : `\bbrowser` et `mcp__platform__browser_*`  | corrigé (en partie)    | `cc58a98` | `tests/career-integration.test.js`                        |
| 10a | n° 10 : garde d'outil réglable                     | corrigé (réglage seul) | `013274a` | `tests/garde-outil-env.test.js`                           |
| 10b | n° 13 : une seule intention                        | non corrigé            | —         | —                                                         |
| 10c | n° 7 : CV joint sans Skill                         | non corrigé            | —         | —                                                         |

## Détail

1. **Intention `apply`.** `apply` a désormais un renfort (`boost`, priorité 80) sur les verbes de
   candidature : postule, postuler, postulez, postulons, candidate, candidater, candidatez, « envoie
   / envoyer / soumets / dépose ma candidature », apply to/for/on, submit my/the application, send
   my application. Il passe donc devant `documents` (70), LinkedIn (66) et l'e-mail (65). Il reste
   derrière l'évaluation (90), la recherche (100) et la boîte d'entrée (110). Le nom « candidature »
   seul n'appuie pas. « pour postuler », « pour candidater », « avant de postuler » et « avant de
   candidater » annulent le renfort, si bien que « Adapte mon CV pour ma candidature » et « … pour
   postuler » restent `documents`. Le prompt réel du soir donne `apply`. « Candidate à cette offre
   https://example.com/careers/123 » donne `apply` et le pack `career-ops` (le choix du pack suit
   `selectSkillIntents`). Les tests d'intention existants passent sans changement.
   _Reste_ (constat 5) : le choix du pack par mots-clés compare toujours des sous-chaînes, URL
   comprise (`posted` ⊃ `poste`).
2. **Délais.** La navigation libre du propriétaire (`plan.browserWorkflow`) prend le délai de
   career-ops (15 min) pour la mission et pour le tour ACP. Deux variables sont ajoutées :
   `AGENT_PLATFORM_BROWSER_TIMEOUT_MS` (navigation libre) et `AGENT_PLATFORM_CAREER_TIMEOUT_MS`
   (career-ops). Sans elles, `AGENT_PLATFORM_TIMEOUT_MS` reste la valeur commune, et les autres
   missions `core` gardent 3 min. `timeoutFor` accepte un plan ou un identifiant de pack.
3. **Question JSON.** `parseAgentResult` accepte l'objet `{"question":{…}}` seul ; le résumé est
   alors la prose qui l'entoure. Si cet objet suit directement une réponse au contrat (sans rien
   entre eux, hormis des blancs ou des balises de bloc), les deux sont fusionnés. La question est
   posée au propriétaire, avec ou sans Skill : le repli en prose de career-ops ne s'applique plus,
   puisque l'analyse réussit. La consigne ajoute que le champ `question` peut aussi aller dans la
   réponse JSON finale. Le faux agent a reçu une option `proseQuestion.bare`.
4. **Navigation non prouvée.** La mission n'échoue plus. La réponse de l'agent est gardée, et le
   Bilan ajoute « Avertissement — Navigation non prouvée : … Réponse de l'agent gardée : à
   vérifier. ». La provenance indique « navigation non prouvée » et un événement `browser_unproven`
   est écrit. Quatre tests existants qui exigeaient l'échec ont été réécrits pour le nouveau
   comportement : 3 dans `fix-resume`, 1 dans `career-failure`. Un test s'y ajoute pour la reprise
   « oui, envoie » réduite à un `browser_click`.
   _Reste_ : le mode workflow (`workflow-run.js:288`, DAG) lève toujours l'exception.
   `tests/astra-turn.test.js` couvre ce cas, qui n'était pas demandé.
5. **Politesse.** Avant la lecture du dernier paragraphe, les phrases de courtoisie en sont
   retirées : « dis-moi / dites-moi si tu veux / as / souhaites… », « let me know if you »,
   « n'hésite pas », « autre chose », « anything else », « feel free », et « veux-tu / would you
   like / do you want … aussi / also / as well ». `lequel`, `laquelle` et `lesquel(le)s` n'interrogent
   plus qu'en tête de phrase. Le comportement est inchangé pour tous les cas E52 existants, ainsi que
   pour « Dis-moi si je dois cliquer sur Envoyer » et « Merci ! Veux-tu que je continue ? ».
   _Reste_ : l'option « question facultative » et la conservation du résumé en cas d'annulation
   pendant une question.
6. **Parseur.** Chaque `{` du texte est essayé (les 200 derniers, 256 Ko au plus par objet), dans
   un bloc ou non. La réponse est le dernier objet qui a la forme du contrat (le plus englobant s'il
   y a imbrication) ou un objet `question` seul. Le parseur refuse encore une réponse dans trois
   cas : un objet JSON écrit après elle, un `{"…` tronqué en fin de texte (test existant), ou un
   objet qui a la forme du contrat sans le respecter. Les cas réels (bloc ```json de charge utile,
   « Je vérifie la page {en cours… ») passent.
   _Reste_ : hors career-ops, seul « non structurée » se replie sur la prose (inchangé).
7. **Envois sans Skill.** `gatewayApproval` compte `sendsAsked`. Toute mission qui a demandé un
   accord d'envoi reçoit `formatSendLine` : « aucun approuvé » après un refus, sinon le nombre
   approuvé et l'issue. Une mission sans envoi n'a pas cette ligne.
8. **`execute()`.** Les deux lancements passent par `launch()`, qui rattrape toute exception.
   `executionCrashed` passe la mission en `failed`, avec « Erreur interne de la plateforme : … »
   (sans détail pour une mission privée), sauf si elle est déjà terminée. Il interrompt aussi
   l'agent et libère `active`, le jeton, les permissions et les questions. `removeRunHomes` ne lève
   plus dans le `finally`. Avant le correctif, le test bloquait : `close()` attendait sans fin.
9. **Regex navigateur.** `isBrowserToolName` (`browser-proof.js`, motif
   `(?:^|[^a-z0-9])browser[_.][a-z]`) sert l'agent et le workflow. Les preuves de
   `control.browserEvidence` comptent aussi pour `shortResumeWithoutBrowser`. Test : une reprise
   rapide « postule » par `mcp__platform__browser_click` n'est plus résumée « rien exécuté ».
   _Non corrigé, car situé dans `packages/career-ops/truth.js:300`, hors périmètre_ : la regex
   `envoy(?:e|er…)` ne reconnaît pas « envoie ». Une reprise « oui, envoie » sans aucune action n'est
   donc jamais signalée « rien exécuté » (faux négatif). Correctif proposé : `envo(?:i|y)\w*`.
10. **Constat 10.** Seul le réglage `AGENT_PLATFORM_TOOL_IDLE_MS` est fait ; la valeur par défaut
    reste 120 s. L'armement trop large par `deliver(null)` et le battement MCP restent à faire.
    **Constat 13, non corrigé à dessein.** Il suffirait de passer le renfort de `apply` au-dessus de
    `evaluate` (90). Mais « Évalue cette offre et postule si le score dépasse 4 » exigerait alors les
    étapes du formulaire. Quand la condition n'est pas remplie, la mission finirait « Mission
    incomplète », comme l'échec réel du point 1. Il faut d'abord plusieurs intentions par mission,
    avec des étapes de candidature conditionnelles. **Constat 7, non traité** : c'est un chantier
    plus large (pièces jointes copiées dans le dossier `core`, reprise sans changement de pack).

## Tests

- Fichiers concernés : tous verts (voir chaque commit).
- Phase unitaire complète sans Chrome
  (`node --test --test-concurrency=2 … | grep -v browser-|approval-bridge|…`) : 886 tests,
  884 réussis, 0 échec, 2 ignorés (ignorés déjà avant ce chantier).
- `npm run check` : syntaxe valide. `npm run format:check` : conforme.
