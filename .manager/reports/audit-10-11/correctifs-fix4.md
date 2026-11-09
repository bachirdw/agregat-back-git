# Correctifs fix4 — régressions de la nuit (relecture-orch.md)

Branche `audit-fix4`, worktree `agregat-back-audit-fix4`. Il y a un commit par constat, et chaque commit a un test rouge avant et vert après. Les gains de la nuit sont gardés ; seules les régressions sont retirées. Les dossiers `packages/browser-gateway/` et `packages/mcp-gateway/` n'ont pas été touchés, pas plus que la bibliothèque career-ops (ses scripts ont été lus, jamais modifiés). Aucun agent réel, aucun réseau, aucun processus existant arrêté.

| # | Constat | Commit | Tests |
|---|---|---|---|
| 1 | Navigation non prouvée devenue un succès muet | `6306286` | `fix-resume.test.js`, `astra-turn.test.js` |
| 2 | Vraies questions de décision filtrées comme de la courtoisie | `9779588` | `question-finale.test.js` |
| 3 | Échec effacé par un succès ultérieur du même outil | `0112e29` | `career-bilan-requested.test.js` |
| 4 | Panne d'un script de contrôle lue comme un verdict | `3c860c5` | `career-integration.test.js`, `career-skill-production.test.js` |
| 5 | Renfort `apply` trop large (10 prompts sur 50) | `ae7edf4` | `intention-50-prompts.test.js` (nouveau), `intention-candidature.test.js` |
| 6 | Regex de reprise courte trop large | `a80e3bb` | `career-truth.test.js` |
| 7 | Ledger : falsification ancienne et budget dépassé | `69719a7` | `billing.test.js` |
| 8 | `ps` en locale française | `b8aa3c5` | `orphan-agents.test.js` |
| 9 | `AUTH_REFUSAL` trop étroit | `e1d4601` | `probe-routing.test.js` |
| 10 | Garde à 8 s avant le nettoyage forcé à 10 s | `b474f29` | `global-guards.test.js` |
| 11 | Mode DAG : plafond fixe de 4 000 | `0aa8aba`, `e52da20` (test DAG existant aligné) | `astra-turn.test.js` |
| 12 | Délai d'attente humaine non réglable | `ca9d965` | `astra-turn.test.js` |

## Détail

1. **Navigation non prouvée.** On garde le gain de la nuit : la réponse de l'agent n'est plus jetée. Le changement porte sur une demande d'action (un impératif d'envoi, de candidature ou de clic sur Envoyer, ou « remplis le formulaire ») faite alors qu'aucune page n'a été prouvée et qu'aucun envoi n'a été approuvé.
   - Le Bilan s'ouvre sur « Avertissement — navigation non prouvée : aucun envoi constaté par la plateforme. »
   - Il porte « Envoi par la plateforme : aucun approuvé. » quand le prompt demandait un envoi.
   - La mission finit **`failed`**, avec le résultat conservé et l'erreur « Navigation non prouvée : action demandée … sans page observée ni envoi approuvé ».

   **Pourquoi `failed`.** L'état est la première chose que voit le propriétaire. `completed` affirmerait que l'action a eu lieu, alors que rien de ce qu'a vu la plateforme ne le montre. La règle « jamais plus indulgent que la réalité » l'emporte.

   Le cas réel de la nuit (« oui, envoie » réduit à un clic **approuvé** par le propriétaire) reste `completed`, avec l'avertissement habituel et la ligne « 1 approuvé(s) ». Une simple lecture non prouvée reste `completed` avec l'avertissement. Dans tous les cas où la navigation n'est pas prouvée, la vérification vaut `valid:false` et sa portée comporte « ; navigation non prouvée ».

   La même règle s'applique en mode workflow : l'étape marque `control.unprovenAction`, l'étape `verify` passe à `valid:false`, et `index.js` termine la mission `failed` en gardant le résultat.

2. **Questions.** Une phrase n'est de la courtoisie que si elle ne propose ni action à conséquence (soumettre, envoyer, postuler, cliquer, joindre, remplir, publier, submit, send, apply, click, attach…) ni choix (« préfères / veux-tu / would you / should I … ou / or »). « autre chose » n'est ignoré qu'après « veux / souhaites / besoin d' / pour ». Ajouts à `ASKS` : « me dire si », « should I », « let me know if you want / whether I should ». Le test couvre 18 formules vides et 18 vraies questions, en français et en anglais. Il conserve aussi les cas de la nuit (« Veux-tu que je l'enregistre aussi ? » reste ignorée).

3. **Échecs effacés.** Les échecs sont indexés par appel (`toolCallId`). Seul le **même** appel qui réussit efface son échec. Sinon, l'échec reste avec `recovered:true`, et la ligne hors career-ops (`formatFailedActions`) dit par exemple « browser_click — échec signalé par l'outil, 1 échoué puis réussi » ou « (2 échecs) ». La portée « ; actions échouées » reste.

4. **Verdicts de script.** Un verdict exige un code de sortie de 1 à 125 **et** la sortie de verdict du script, lue dans le Skill sans le modifier :
   - check-liveness : « Results: … N expired / N uncertain » avec N > 0, sans « Fatal: » ;
   - precheck-duplicate : « Possible duplicate(s) in the tracker » ou des `candidates` en JSON ;
   - verify-cv-facts : « CV fact check failed: », ou le JSON `verdict:"block"` sans `errors` ;
   - find : « No application matches " » ou `[]`.

   Une erreur d'usage, une trace de pile ou une sortie vide restent une panne. C'est `gatewayProgress` (career-ops/truth.js) qui calcule `verdictOutput`, transmis tel quel par la passerelle. Seul `apps/api/server.js` le relaie (`verdictOutput: body.verdictOutput === true`).

   À noter : precheck-duplicate sort toujours en 0, doublon compris. Toute sortie non nulle de ce script est donc une erreur d'usage.

5. **Intentions.** Le renfort ne vaut que pour l'impératif (postule, postulez, candidatez, candidate à/au/chez/pour/sur, envoie ma candidature, apply to/for/on, submit my application…) ou pour un infinitif en **tête** de demande ou de phrase. Pour ce dernier cas, le routeur gagne la clé générique `boost.leadPhrases` : `postuler`, `candidater`, `apply`, `submit`. `unlessPhrases` reçoit « je postule », « j'ai postulé », « je candidate », « suis/es/est candidate », « to apply », « will apply », « before I apply ».

   Les 50 prompts de la sonde sont en test avec trois colonnes : avant la nuit, nuit, maintenant. Sur les 10 changements défavorables, 9 retrouvent leur intention d'avant. « Prépare mon CV adapté puis postule sur … » reste `apply`, car c'est un impératif. Les gains sont gardés : le cas réel « Postule à l'offre du rapport 005 … clique sur Envoyer », « Candidate chez Acme », « Submit my application ». Les écarts anglais antérieurs à la nuit ne sont pas traités (« Write a cover letter for this job » donne `search`, « … before I apply » donne `apply`).

6. **Reprise courte.** `withoutNegations` est partagé avec `formatCareerBilan`, puis `ordersAction` ne retient que les impératifs non niés et non dits d'un tiers (« je postule », « il m'envoie ») : envoie(-la), envoyez, soumets, postule, candidatez, candidate à/chez (pas après « suis / est »), candidate seul en tête, clique sur Envoyer, submit, apply, send it. Le nom « envoi » et l'adjectif « candidate » ne sont plus retenus.

   Changement assumé : l'infinitif seul (« tu peux envoyer ? ») n'est plus pris pour un ordre.

7. **Ledger.** Le gain de performance est gardé, et même amélioré. Le contrôle fonctionne ainsi :
   - à chaque charge et à chaque `GET`, vérification incrémentale : la dernière ligne vérifiée est inchangée, et les lignes ajoutées depuis s'y chaînent ;
   - contrôle complet au démarrage, à la **première charge de chaque mission**, puis toutes les 500 charges (`AGENT_PLATFORM_LEDGER_FULL_EVERY`) ;
   - pour un run avec budget, ses lignes sont rehachées et liées à leur vraie précédente avant le calcul de `spent`. La somme et le dernier id sont mis en cache, et revérifiés dès qu'ils changent ;
   - une rupture constatée reste constatée (`ledgerBroken`) ;
   - `GET /api/runs/:id` ajoute la vérification des lignes du run ;
   - nouvel index `ledger(run_id, id)`.

   La sonde du relecteur (120 pour un budget de 100) est maintenant refusée.

   Mesures sur 20 000 lignes (script `scratchpad/fix4/ledger-time.mjs`) :

   | Mesure | Avant | Après |
   |---|---|---|
   | Charge courante | 0,47 ms | 0,46 ms |
   | Charge d'un run à budget | 2,16 ms | 0,30 ms |
   | Contrôle complet | 55 ms | 66-73 ms |

   Le contrôle complet ne tourne qu'au démarrage, une fois par mission, et toutes les 500 charges.

8. **Orphelins.** `ps` reçoit `LC_ALL=C` et `LANG=C`. Le test vérifie qu'une date française simulée reste refusée et qu'une date C est acceptée. De plus, une ligne illisible dont le processus vit encore est gardée dans le registre au lieu d'être oubliée. Elle n'est jamais tuée.

9. **AUTH_REFUSAL.** Formes ajoutées (mots entiers) :
   - `(oauth|access|refresh) token (has) expired` ;
   - `authentication_error` ;
   - `(specify|set) the GEMINI_API_KEY` et `GEMINI_API_KEY (missing|not set|required)` ;
   - `set an auth method` ;
   - `error authenticating` ;
   - `please run /login`.

   « author », « login cité » et une simple mention de `GEMINI_API_KEY` restent sans effet.

10. **Délais.** `engineCloseTimeoutMs` (`AGENT_PLATFORM_CLOSE_MS`, 10 s par défaut) est partagé par l'orchestrateur et la garde. La garde attend ce délai plus 5 s, donc 15 s par défaut.

11. **DAG, plafond.** Le mode DAG utilise `orch.maxEvents` avec le même message que le mode agent.

    Test rouge : avant la correction, le test ne se termine pas. L'étape reste `uncertain` en attendant 30 minutes, sans cause explicite.

12. **DAG, attente humaine.** `AGENT_PLATFORM_HUMAN_WAIT_MS` règle l'attente (30 min par défaut). La cause écrite nomme la variable.

## Vérification
- Fichiers concernés : verts (voir les tests du tableau).
- Phase unitaire sans Chrome (`--test-concurrency=2`) : 968 tests, 966 réussis, 0 échec, 0 annulé (les 2 restants sont sautés). Le premier passage avait 1 échec : `workflow-review.test.js` attendait encore le plafond fixe de 4 000. Ce test est aligné dans `e52da20`.
- `npm run check` : OK. `npm run format:check` : OK.
