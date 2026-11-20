# swarm-01 — Textes d'origine (swarm) et textes posés dans Relay

Copieur, 20/11/2026 23:32 (heure lue par `date`). Origine : `/Users/diaw/Downloads/agent-repos-agregat/desplega-ai__agent-swarm`
(MIT, © desplega.sh), lu en lecture seule. Chaque phrase est citée telle quelle (anglais), avec son fichier et sa ligne, puis
traduite en français. Les traductions sont neutres : là où l'original nomme un outil, un modèle, un Skill ou un service, la
traduction dit « l'exécutant », « un script », etc. La colonne « Dans Relay » dit à quel texte du plan elle sert :
`DECISION_RULE`, `TEAM_RULE`, `ANTI_RELANCE` (phrase de `SYNTHESIS_TURN` et de `mission_attendre`), `SCHEMA` (description et
schéma de `mission_lancer`), ou « non porté ».

Marques : **[appui]** le texte de Relay en vient ; **[contredit]** swarm dit l'inverse du plan ; **[complète]** swarm dit
quelque chose que le plan ne pose pas (à trancher par le manager, rien n'est ajouté par ce lot).

## 1. `templates/skills/delegate-work/content.md`

| Ligne | Texte d'origine | Traduction | Dans Relay |
| --- | --- | --- | --- |
| 52 | « **Keep in Claude regardless of matrix**: tasks where writing the spec IS the work (ambiguity = design); » | Garde chez toi, quoi qu'en dise le tableau : les tâches où écrire la consigne EST le travail (ambiguïté = conception) ; | **[appui]** `DECISION_RULE` : « quand écrire la consigne t’oblige à prendre toi-même les décisions (c’est de la conception : garde-la) » |
| 52 | « tiny edits (<~20 lines) where delegation overhead loses; » | les toutes petites retouches (moins de 20 lignes environ), où le coût de la délégation l'emporte ; | **[appui]** `DECISION_RULE` : « quand la retouche est petite » ; le seuil de 20 lignes n'est pas repris (le plan parle en durée) |
| 52 | « anything needing session tools (MCP, browser, secrets); » | tout ce qui demande les outils de ta session (serveurs d'outils, navigateur, secrets) ; | **[contredit]** dans Relay, une sous-mission a son propre onglet de navigateur et ses cartes d'envoi : le navigateur est une raison de déléguer, pas de garder (`DECISION_RULE`, phrase des onglets). Non porté. |
| 52 | « destructive/irreversible ops, pushes, GitHub mutations; » | les opérations destructrices ou irréversibles, les publications de code ; | **[complète]** non porté (dans Relay, l'envoi final reste au clic du propriétaire, quel que soit l'agent) |
| 52 | « judging delegated output — executors may contribute reviews, but the join and final verdict are never delegated, never skipped. » | juger le travail délégué : les exécutants peuvent apporter des relectures, mais l'assemblage et le verdict final ne se délèguent jamais et ne se sautent jamais. | **[appui]** déjà dans `CHIEF_METHOD` (« tu restes celui qui décide, compare les résultats et écrit la réponse finale ») et `TEAM_RULE` (« le compte rendu d’une sous-mission est un rapport, pas une preuve ») |
| 54 | « Heuristic: if the prompt reads as a work order → delegate; if writing it forces decisions → it's design, keep it. » | Repère : si la consigne se lit comme un bon de commande, délègue ; si l'écrire t'oblige à décider, c'est de la conception : garde-la. | **[appui]** `DECISION_RULE` : « une consigne qui se lit comme un bon de commande se délègue » |
| 85 | « After **2 failed rounds** on the same task: stop delegating, take over directly (or escalate the model one rung). » | Après deux tours en échec sur la même tâche : arrête de déléguer, fais-la toi-même (ou monte d'un cran de modèle). | **[appui]** `DECISION_RULE` : « après deux échecs d’une sous-mission sur la même part, fais cette part toi-même ou change d’agent ». Écart : swarm dit « monte d'un cran de modèle », le plan dit « change d'agent » (voir NOTES.md) |
| 89 | « Codex starts with zero session context. » | L'exécutant démarre sans rien du contexte de ta session. | **[appui]** déjà dans Relay (`CHIEF_RULE` : « repart sans ta mémoire de travail » ; `TEAM_RULE` : « elle repart sans ta mémoire ») |
| 89 | « Every prompt: goal, exact repo/paths (…), scope fence ("ONLY Phase N / step-N, don't touch X"), non-goals, verification commands to run, the standards line (…), and the report shape (status completed/blocked/failed, files changed, verification output, notes). » | Chaque consigne donne : le but, le dépôt et les chemins exacts, la clôture du périmètre (« SEULEMENT telle étape, ne touche pas à X »), ce qui est hors du but, les commandes de vérification à lancer, la règle de qualité, et la forme du rapport (état fini / bloqué / en échec, fichiers changés, sortie de la vérification, remarques). | **[appui]** `SCHEMA` : but → `objectif` (existant) ; chemins → `fichiers` (existant) ; clôture → `perimetre` (existant) ; hors du but / ne touche pas → `horsPerimetre` (neuf) ; commandes de vérification → `verification` (neuf) ; forme du rapport → `resultatAttendu` (existant). **[complète]** la « règle de qualité » (plus petit changement, pas d'abstraction spéculative) n'est pas portée |

Lignes voisines lues (contexte, non citées par le plan) : ligne 40 « bulk mechanical call-sequences (~10+ similar tool/API
calls, any fan-out over a list) | **a script** » (une suite mécanique d'une dizaine d'appels semblables ou plus : un script)
**[appui]** de la phrase déjà dans `CHIEF_METHOD` (« rassemble les fichiers par un script ») ; ligne 50 « Parallelism is the
orchestrator's job » (le parallélisme est l'affaire de l'orchestrateur) **[appui]** de « tu restes celui qui décide ».

## 2. `src/prompts/session-templates.ts`

| Ligne | Texte d'origine | Traduction | Dans Relay |
| --- | --- | --- | --- |
| 75 | « Store progress with `store-progress` at each milestone. A milestone is a result the lead could act on. » | Note ton avancement à chaque jalon. Un jalon est un résultat dont le chef pourrait se servir. | **[complète]** non porté par ce lot (Relay suit les sous-missions par `mission_suivre` ; le carnet tient les découvertes) |
| 76 | « Complete with `store-progress`: status `completed`, and `output` naming the result and every artifact link. On failure: status `failed`, with `failureReason` naming what you tried. » | Termine en état « fini », avec un compte rendu qui nomme le résultat et chaque lien produit. En cas d'échec : état « en échec », avec une cause qui dit ce que tu as essayé. | **[complète]** proche de la phrase de fille existante (« ce qui est fait, les chiffres clés, les chemins de tes fichiers, ce qui manque ou a échoué ») ; « dire ce qu'on a essayé » n'y est pas |
| 77 | « Free-text `output`: under 120 words by default, with the exceptions in How you write. Link documents instead of inlining them; omit process narration. » | Compte rendu libre : moins de 120 mots par défaut. Renvoie aux documents au lieu de les recopier ; ne raconte pas le déroulé. | **[appui]** déjà dans `daughterRule(folder)` (réponse finale courte, chemins des fichiers) ; le seuil de 120 mots n'est pas repris |
| 79 | « When you are blocked after real effort, store the blocker with `store-progress` and keep working on what you can. » | Bloqué après un vrai effort : note ce qui bloque et continue ce que tu peux faire. | **[complète]** non porté |
| 80 | « The task has four endings. When you are done: `completed`. When the answer needs time (a build, a deploy, a reply): `defer-task` with a summary, `delayMs` or `runAt`, and checks. It completes the task now; the wake-up task continues it. When a person must decide: `request-human-input`. When nothing else is possible: `failed` with the blocker. » | La tâche a quatre fins. Fini : « fini ». La réponse demande du temps (une construction, un déploiement, une réponse) : « différer », avec un résumé, un délai ou une heure, et des contrôles ; la tâche se termine maintenant et une tâche de réveil la continue. Une personne doit décider : « demander à une personne ». Rien d'autre n'est possible : « en échec », avec ce qui bloque. | **[complète]** Relay a trois de ces fins (réponse finale, question au propriétaire, échec) ; « différer » n'existe pas dans Relay. Aucun texte du plan ne la pose |
| 81 | « For task waits, add `wakeOn:{…}`; the displayed time is a ceiling, not a fixed wake-up. » | Pour attendre une tâche, ajoute une condition de réveil ; le temps affiché est un plafond, pas une heure fixe. | **[appui]** même idée que `mission_attendre` (« attend au plus 50 secondes … rappelle-le ») |
| 93 | « Your output is delegation and review. Workers implement, research, analyze, and write. Data gathering, even a quick query, goes to a worker. You answer simple factual questions yourself. » | Ton travail, c'est déléguer et relire. Les membres réalisent, cherchent, analysent et écrivent. Même une collecte rapide de données va à un membre. Tu réponds toi-même aux questions simples. | **[contredit]** le plan est symétrique : « seul quand tout tient en moins d’un quart d’heure environ » ; une collecte rapide reste au chef dans Relay. Non porté |
| 95 | « `get-swarm` is the roster. Route by capability and load. » | La liste des agents est donnée par l'outil d'état. Répartis selon les capacités et la charge. | **[appui]** déjà dans `CHIEF_METHOD` (« choisis l’agent et le modèle selon la difficulté de la partie … parmi ceux que donne mission_suivre ») ; motifs `specialite` (capacité) et `parallele` (charge) |
| 96 | « `send-task`: include `routingReason` and `routingNote` (at least 10 characters after trim, maximum 200) with `agentId`. » | En lançant une tâche vers un agent nommé, donne le motif et une note (au moins 10 caractères sans les espaces des bords, au plus 200). | **[appui]** `SCHEMA` : `pourquoi` et `note` (10 à 200). Écart : facultatifs dans Relay, obligatoires avec un agent nommé dans swarm |
| 97 | « A task states the goal, the repo URL when there is one, and the constraints. » | Une tâche dit le but, le dépôt s'il y en a un, et les contraintes. | **[appui]** `SCHEMA` (objectif, fichiers, horsPerimetre) |
| 98 | « Delegate by the shape of the work: a workflow for multi-step or fan-out work, a schedule for recurring work, a script for bulk data, an inline `script-run` for a one-off bulk job you can run yourself. » | Délègue selon la forme du travail : un enchaînement pour un travail en plusieurs étapes ou en éventail, une planification pour un travail qui revient, un script pour une masse de données, un script ponctuel pour un gros travail unique que tu peux lancer toi-même. | **[appui]** `DECISION_RULE` (« la forme du travail décide » : parties indépendantes, même long traitement pour plusieurs éléments) ; planification et enchaînement non portés (autres lots) |
| 99 | « A large feature: a task for the `planning` skill first, then a task for the `implementing` skill with `parentTaskId`. A small fix: direct implementation. » | Une grosse fonctionnalité : d'abord une tâche de planification, puis une tâche de réalisation liée à la première. Une petite correction : réalisation directe. | **[appui]** `DECISION_RULE` (« quand la retouche est petite » → seul ; étapes dépendantes) ; Relay a `apres` pour lier |
| 100 | « A follow-up that continues earlier work carries `parentTaskId`. The worker receives the prior context. » | Une suite qui continue un travail antérieur porte le lien vers lui ; le membre reçoit le contexte précédent. | **[appui]** `ANTI_RELANCE` : « pour le corriger ou le compléter, mission_continuer » |
| 102 | « Worker completion/failure triggers a follow-up, or only wakes your deferred wait; review and complete it. Escalate only failures needing a person. » | La fin ou l'échec d'un membre déclenche une suite, ou réveille seulement ton attente ; relis et termine-la. Ne fais remonter que les échecs qui demandent une personne. | **[complète]** « ne remonter que les échecs qui demandent une personne » non porté |
| 104 | « For an essential result expected within ~1 minute, set `send-task.followUpConfig.disabled=true` and use `wait-for-task` for at most ~1 minute total, then `defer-task` with `wakeOn` if still running. » | Pour un résultat essentiel attendu en une minute environ, attends au plus une minute en tout, puis diffère avec une condition de réveil s'il tourne encore. | **[appui]** même borne courte que `mission_attendre` (50 s par appel) ; « différer » n'existe pas dans Relay |

## 3. `templates/official/lead/SOUL.md` (lignes 33-40, « Hard Rules »)

| Ligne | Texte d'origine | Traduction | Dans Relay |
| --- | --- | --- | --- |
| 35 | « **No blind retries.** After 2 instant failures on a worker, stop. Check infra health. Report it. » | Pas de relance à l'aveugle. Après deux échecs immédiats d'un membre, arrête. Vérifie l'état de la plateforme. Signale-le. | **[appui]** `DECISION_RULE` (« après deux échecs … fais cette part toi-même ou change d’agent ») ; « vérifie l'état de la plateforme, signale-le » non porté |
| 36 | « **No duplicate tasks.** Check `get-tasks` before creating. One piece of work = one task. » | Pas de tâche en double. Regarde les tâches existantes avant d'en créer. Un travail = une tâche. | **[appui]** `ANTI_RELANCE` (« un travail rendu ne se relance pas ») et `SUITE_RULE` existant |
| 37 | « **Always use `dependsOn`.** Sequential workflows (plan -> implement -> review) must be chained. Never fire them in parallel. » | Lie toujours les étapes : un enchaînement (planifier → réaliser → relire) se chaîne ; ne le lance jamais en parallèle. | **[appui]** `DECISION_RULE` (« seul … quand les étapes dépendent l’une de l’autre ») ; Relay a `apres` et `relit` |
| 38 | « **Recovery protocol.** After crashes: pause, assess what survived, clean up, re-create one at a time. » | Reprise : après un plantage, fais une pause, regarde ce qui a survécu, nettoie, recrée une tâche à la fois. | **[complète]** non porté (reprise : autre lot) |
| 39 | « **Stay responsive.** Acknowledge quickly. Don't go silent on blockers. » | Reste joignable : accuse réception vite ; ne te tais pas sur un blocage. | **[complète]** non porté |
| 40 | « **One review per PR.** Don't stack multiple reviewers unless explicitly asked. » | Une seule relecture par livrable. N'empile pas plusieurs relecteurs sauf demande explicite. | **[appui]** `TEAM_RULE` : « une seule vérification par livrable à la fois » et « ou ce que la demande du propriétaire demande de vérifier » |

## 4. `templates/official/lead/IDENTITY.md` (lignes 20-26, « Working Style »)

| Ligne | Texte d'origine | Traduction | Dans Relay |
| --- | --- | --- | --- |
| 20 | « **Delegation-first.** I don't do implementation work. I find the right agent and give them clear context. » | D'abord déléguer. Je ne réalise pas moi-même ; je trouve le bon agent et je lui donne un contexte clair. | **[contredit]** le plan est symétrique (le chef travaille seul sur une tâche courte). Seule la 2e moitié (contexte clair) est reprise, déjà dans `TEAM_RULE` (« une consigne complète ») |
| 23 | « **Honest about gaps.** If I don't know something, I say so and delegate research rather than guessing. » | Honnête sur ses lacunes : ce que je ne sais pas, je le dis et je fais chercher plutôt que de deviner. | **[complète]** non porté |
| 24 | « **Check before creating.** Always run `get-tasks` before dispatching new work. Duplicates are my #1 coordination failure. » | Regarde avant de créer : consulte toujours les tâches avant d'en lancer une. Les doublons sont mon premier échec de coordination. | **[appui]** `ANTI_RELANCE` |
| 25 | « **Chain dependencies.** Use `dependsOn` for all sequential workflows. No parallel plan+implement. » | Chaîne les dépendances ; jamais planifier et réaliser en parallèle. | **[appui]** `DECISION_RULE` (étapes dépendantes) |
| 26 | « **Fail gracefully.** After 2 instant worker failures, stop retrying and assess infra. After crashes, do structured recovery — don't spam tasks. » | Échoue proprement : après deux échecs immédiats d'un membre, cesse de relancer et regarde la plateforme ; après un plantage, reprends avec méthode, sans multiplier les tâches. | **[appui]** `DECISION_RULE` (deux échecs) et `ANTI_RELANCE` |

## 5. `src/tools/send-task.ts` et `src/types.ts`

| Fichier:ligne | Texte d'origine | Traduction | Dans Relay |
| --- | --- | --- | --- |
| send-task.ts:80 | « Why this agent was selected. Required when agentId is supplied; omit for pool routing. » | Pourquoi cet agent a été choisi. Requis quand un agent est nommé ; à omettre pour une file commune. | **[appui]** `SCHEMA` : `pourquoi` ; **écart** : facultatif dans Relay, et le motif dit « ce que la sous-mission fait gagner », pas « pourquoi cet agent » |
| send-task.ts:87 | « Why this worker fits the task. Required when agentId is supplied: at least 10 characters after trimming whitespace, maximum 200 characters. Optional for implicit parent or pool routing. » | Pourquoi ce membre convient à la tâche. Requis quand un agent est nommé : au moins 10 caractères une fois les espaces des bords retirés, au plus 200. Facultatif sinon. | **[appui]** `SCHEMA` : `note` 10 à 200 ; porté dans `motif.js` (`checkMotif`) |
| send-task.ts:233 | « routingReason is required when agentId is supplied. » | Le motif est requis quand un agent est nommé. | porté dans `checkMotif(args, { exiger: true })`, éteint par défaut |
| send-task.ts:241 | « routingNote is required when agentId is supplied (at least 10 characters after trim). » | La note est requise quand un agent est nommé (au moins 10 caractères, espaces retirés). | porté dans `checkMotif(args, { exiger: true })`, éteint par défaut |
| types.ts:501-507 | `"skill"`, `"continuity"`, `"overflow"`, `"human_pinned"`, `"reroute_fault"` | compétence, continuité, débordement (charge), imposé par une personne, reroutage après panne | **remplacé** par la liste du plan (voir NOTES.md, table de correspondance) |

## 6. `src/tools/templates.ts` (lignes 53-83, modèle `task.worker.completed`)

| Ligne | Texte d'origine | Traduction | Dans Relay |
| --- | --- | --- | --- |
| 56 | « Worker task completed — review needed. » | Tâche d'un membre terminée : relecture attendue. | contexte |
| 65 | « IMPORTANT: Do NOT re-delegate or re-answer the original request. The worker has already handled it. Your job is ONLY to: » | IMPORTANT : ne relance pas et ne refais pas la demande d'origine. Le membre l'a déjà traitée. Ton travail est SEULEMENT de : | **[appui]** `ANTI_RELANCE` : « Un travail rendu ne se relance pas : pour le corriger ou le compléter, mission_continuer ; pour un échec, reprend. » |
| 66 | « 1. Review the output above » | 1. Relire le résultat ci-dessus | **[appui]** déjà dans `SYNTHESIS_TURN` (« Compare-les, retire les doublons ») |
| 67 | « 2. Do not relay the worker's raw output to Slack; the engine owns the thread tree and outcome card » | 2. Ne pas recopier le résultat brut du membre dans le fil ; la plateforme tient le fil et la carte de résultat | non porté (messagerie écartée) |
| 68 | « 3. Complete this follow-up task » | 3. Terminer cette tâche de suite | contexte |

**[complète]** Swarm ne s'appuie pas sur le texte seul : `src/tasks/follow-up-redelegation-guard.ts:1-23` décrit un garde-fou
de code (même travail déjà rendu dans les 48 h, et plafond de lancements par fil) qui laisse passer « a distinct next step (step 2
of a chain, a fix round, a retry) » (une étape suivante distincte : 2e étape, tour de correction, reprise). Le plan de swarm-01 ne
pose que la phrase ; ce garde-fou n'est pas porté (à trancher par le manager, sans doute un autre lot).

## 7. Correspondance avec les textes du plan

- `DECISION_RULE` : seuils « dix minutes » et « un quart d’heure » : **aucune origine dans swarm** (swarm compte en lignes,
  « <~20 lines », et en appels, « ~10+ similar calls ») : ce sont des choix de Relay. « bon de commande » ← content.md:54 ;
  « conception : garde-la » ← content.md:52 ; « retouche petite » ← content.md:52 et session-templates.ts:99 ; « étapes
  dépendantes » ← SOUL.md:37, IDENTITY.md:25 ; « après deux échecs » ← content.md:85, SOUL.md:35, IDENTITY.md:26 ; « équipe aussi
  quand un livrable long ou risqué mérite un regard indépendant » ← content.md:52 (relectures apportées par les exécutants) ;
  « il attend que tu les lances en sous-missions en même temps », onglets et sous-agents internes, ligne « Décision : » : propres à
  Relay (E147, pas de source swarm).
- `TEAM_RULE` (vérification conditionnelle) : « une seule vérification par livrable à la fois » ← SOUL.md:40 ; « livrable long
  ou risqué … un livrable court, contrôle-le toi-même » : propre à Relay (swarm n'a pas de critère de taille pour la relecture).
- `ANTI_RELANCE` ← templates.ts:65, SOUL.md:36, IDENTITY.md:24 ; la voie « mission_continuer » ← session-templates.ts:100.
- `SCHEMA` (`pourquoi`, `note`, `horsPerimetre`, `verification`) ← send-task.ts:79-88, :230-244, types.ts:501-508, content.md:89.
