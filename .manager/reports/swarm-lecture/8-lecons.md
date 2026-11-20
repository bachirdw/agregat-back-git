# Lecture comparée swarm / Relay : Leçons : ce qui a mal tourné chez swarm et ce qu'ils ont décidé (orchestration multi-agents)

Rendu d'un lecteur Opus (lecture seule), 20/11/2026. Chemins swarm relatifs à la racine de desplega-ai/agent-swarm (f1d25eb).

## Résumé
Chez swarm, le chef ne fait que déléguer et relire. Toute collecte de données part chez un membre. Quand un membre finit, la plateforme réveille le chef par une tâche de suivi (follow-up). Le chef n'attend activement qu'une minute au plus, puis il rend la main avec une attente déclarée (wakeOn).
Leurs notes montrent quatre problèmes vécus :
- Des boucles « le membre finit → suivi → le chef relance le même travail ». Ils les ont bornées par une règle de similarité et un plafond de lancements.
- Des déclencheurs traités deux fois quand plusieurs sessions tournent en parallèle. Ils ont ajouté une prise atomique.
- Des coûts mal comptés : 19 % sous-évalués, les sous-agents internes oubliés, des coûts perdus quand une tâche se fermait en cours de session.
- Une grille d'évaluation de la délégation qui donnait 0,50 à tout le monde : elle punissait le livrable obligatoire et comptait deux fois la même faute.
Leur manière de décider revient partout. Un nouveau garde-fou passe d'abord en mode « observation » (shadow), qui note sans bloquer, puis en mode « appliqué » (enforce). En cas de doute il laisse passer (fail-open). Il peut toujours être contourné explicitement (allowDuplicate, allowRedelegation).
Pour le budget, ils ont renoncé au plafond strict : on refuse les nouvelles tâches une fois le plafond atteint, et on accepte qu'une tâche déjà lancée dépasse un peu.
Relay court plusieurs de ces risques aujourd'hui. Il ne compte aucun token. Le chef attend par tranches de 50 s en gardant sa session ouverte. Rien ne détecte deux sous-missions quasi identiques. La liste des agents donnée au chef ne signale ni une limite d'usage atteinte ni un échec au dernier essai. La réponse finale corrigée par le chef après un verdict « à corriger » n'est pas signalée comme non revérifiée.

## Constats

### 1. Mesurer le vrai coût d'une équipe (tokens du chef et des membres), pas seulement la durée
- **Mode** : s_inspirer · **valeur** 5/5 · **effort** moyen
- **Swarm** : Chaque session enregistre son coût (session_costs). Leur audit montre deux erreurs. (1) Le coût recalculé à partir des tokens et d'une table de prix était 19 % trop bas. (2) Le compteur lisait `usage`, qui ne couvre que le fil principal, au lieu de `modelUsage` / `total_cost_usd`, qui couvrent aussi les sous-agents internes. Ils ont aussi ajouté une grâce de 45 s quand une tâche se ferme en cours de session, pour ne pas perdre son coût (CHANGELOG #3179). La trace « ping » d'un chef Codex montre l'ordre de grandeur : 357 142 tokens lus par le chef contre 117 877 pour le membre, pour poster un simple « pong ». Le chef avait attendu avec sleep 3 puis sleep 6 en relisant la tâche à chaque fois.
- **Fichiers swarm** : thoughts/taras/research/2026-08-06-task-vs-session-cost-mismatch-audit.md:12-45, thoughts/taras/research/2026-04-09-codex-lead-ping-transcript.txt:1-45, CHANGELOG.md:134
- **Relay** : Aucune capture de tokens : aucune occurrence de usage_update, inputTokens ou totalTokens dans packages/. Le ledger ne compte que les outils de la plateforme (packages/storage/index.js:365-375 ; packages/orchestrator/index.js:476-506). La ligne « Consommation » du Bilan ne donne que des durées par agent, et pas celle du chef (packages/orchestrator/family-bilan.js:120-130). Le journal du 20/11 conclut « pas de gain net de qualité, 26,6 min contre 12,2 » sans chiffre de consommation.
- **Fichiers Relay** : 
- **Proposition** : Dans packages/agent-runtime (lecture des événements ACP), relever ce que l'agent annonce en fin de tour : le total s'il existe (coût ou tokens, sous-agents compris), sinon les tokens par tour. L'écrire dans le ledger sous une dimension `llm_tokens` à 0 centime. Ainsi il n'y a pas de facturation et le budget n'est pas touché. Dans family-bilan.js, ajouter à « Consommation » les tokens du chef et de chaque membre, avec le total de la famille. Préférer le chiffre de l'agent à tout recalcul (leçon de leur audit). Marquer « inconnu » quand un agent n'annonce rien.
- **Risque** : Les agents n'annoncent pas tous leurs tokens par ACP : il faut accepter des trous. Toucher la lecture des événements, zone sensible : changement additif seulement, sans rien changer à la boucle de tours.

### 2. Ne pas laisser le chef attendre activement : courte attente puis réveil par la plateforme
- **Mode** : s_inspirer · **valeur** 4/5 · **effort** grand
- **Swarm** : Le texte du chef demande d'attendre « au plus ~1 minute » (wait-for-task), puis de rendre la main avec defer-task et wakeOn:{event:'settled',taskIds,mode:'all'}. Sinon la fin d'un membre déclenche automatiquement un suivi chez le chef (createWorkerTaskFollowUp). Ce suivi n'est pas créé quand une attente déclarée réveille déjà le chef, pour éviter le doublon. Puis vient la porte de suivi : un vérificateur déterministe peut juger le réveil inutile. Elle a d'abord tourné en mode observation, puis en mode appliqué limité à une liste, et laisse passer en cas de doute (#3479).
- **Fichiers swarm** : src/prompts/session-templates.ts:100-104, src/tasks/worker-follow-up.ts:519-560, src/tasks/follow-up-gate.ts:1-80, CHANGELOG.md:13
- **Relay** : Le chef attend par mission_attendre, au plus 50 s par appel, et doit rappeler l'outil autant de fois que nécessaire (packages/orchestrator/delegation-rule.js:20-27). Sa session reste ouverte pendant tout le travail des membres, et chaque appel relit le contexte. Le « réveil du chef » est dans le plan de Codex (journal-20-11 07:36), pas chez nous.
- **Fichiers Relay** : 
- **Proposition** : Ne pas coder le réveil (c'est le chantier de Codex). Lui transmettre le mécanisme de swarm : réveil quand toutes les sous-missions attendues sont finies, aucun réveil en double si le chef attend déjà, porte d'abord en mode observation. Tout de suite, côté Relay, journaliser par mission le nombre d'appels mission_attendre du chef et leur durée cumulée, en événement et dans le Bilan. On saura combien coûte l'attente.
- **Risque** : Chevauchement avec la branche de Codex si on code le réveil. Changer la boucle de tours est la zone la plus fragile du moteur.

### 3. Détecter les sous-missions en double et les boucles de relance
- **Mode** : copier_adapter · **valeur** 4/5 · **effort** petit
- **Swarm** : task-dedup.ts mesure la similarité de Jaccard entre les ensembles de mots de deux consignes. Au-dessus de 0,8, c'est un doublon quel que soit l'agent visé. Au-dessus de 0,6, c'en est un si l'agent visé est le même. La recherche porte sur les 10 dernières minutes. Le lancement est refusé avec l'id du doublon, sauf si allowDuplicate:true. follow-up-redelegation-guard.ts ajoute deux règles. La règle « même travail » refuse une relance semblable à une tâche déjà finie, sauf si une tâche a échoué ou a été annulée depuis. Le plafond de boucle limite à 10 lancements par fil en 6 h, quel que soit le texte : une boucle qui reformule est donc arrêtée aussi. Les deux règles sont vérifiées dans la même transaction que la création, pour que deux lancements simultanés ne passent pas tous les deux.
- **Fichiers swarm** : src/tools/task-dedup.ts:5-98, src/tasks/follow-up-redelegation-guard.ts:1-60, src/tools/send-task.ts:598-635
- **Relay** : Une seule tentative à la fois pour une même tâche reprise (delegation.js:893-901, erreur reprise_en_cours). L'enveloppe borne le total : 6 par défaut, 3 en parallèle (delegation-rule.js:13-15). Mais deux appels mission_lancer avec une consigne presque identique passent tous les deux, et un nouveau lancement après une sous-mission finie n'est pas comparé à elle.
- **Fichiers Relay** : 
- **Proposition** : Dans delegation.js, fonction launch, avant le calcul de l'enveloppe et dans la même section synchrone que family.pending, comparer la consigne aux sœurs vivantes et aux sœurs finies avec succès de la même famille. Utiliser une fonction jaccard en local, dans un petit fichier packages/orchestrator/similarity.js, avec les mêmes seuils (0,8 ; 0,6 si même agent). En cas de doublon, refuser avec fail('doublon_probable', 'proche de <id> (<titre>) : utilise mission_continuer ou mission_suivre ; memeTravailVoulu:true pour forcer'). Ne pas compter les reprises et suites (args.reprend, args.continue), ni un lancement après une sœur en échec ou annulée. Ajouter memeTravailVoulu au schéma de mission_lancer dans packages/mission-gateway/server.js et dans docs/api-delegation.md.
- **Risque** : Faux positifs sur des parts volontairement semblables, par exemple la même consigne pour deux offres qui ne diffèrent que par l'URL. D'où le contournement explicite, et ne compter que la consigne, pas les fichiers ni les informations propres à chaque part.

### 4. Liste des agents : dire indisponible un agent à limite atteinte ou en échec au dernier essai, et basculer proprement
- **Mode** : copier_adapter · **valeur** 4/5 · **effort** petit
- **Swarm** : Le membre classe l'erreur du fournisseur : rate_limit, model_window, credits, seat… (classifyProviderError). Le serveur choisit alors la suite (nextFallback) : une autre clé d'abord, sinon le profil suivant d'une liste ordonnée, sans jamais revenir à un profil déjà essayé. Ce basculement ne consomme pas le budget de reprises après plantage (« a fallback resume keeps the crash budget », #2970). Sans solution, le motif d'échec dit le chemin essayé (« no fallback left (tried: a → b → c) »).
- **Fichiers swarm** : runbooks/model-tiers.md:148-160, src/tasks/worker-follow-up.ts:320-470, CHANGELOG.md:263
- **Relay** : agents() (delegation.js:1293-1318) déclare disponible tout agent installé et compatible. Seul le choix automatique d'un vérificateur (otherAgent, delegation.js:925-931) écarte un agent dont le dernier essai a échoué. Constaté le 20/11 à 18:48 : le chef a choisi Codex, à limite atteinte, puis Gemini, sans clé. Deux suites ont été gaspillées. L'échec « limite_usage » est pourtant déjà reconnu (delegation.js:1274).
- **Fichiers Relay** : 
- **Proposition** : Dans agents(), ajouter disponible:false et raison quand l'agent est dans l'un de ces cas : (a) son dernier essai de session a échoué (loadProbes, même source qu'otherAgent) ; (b) une exécution de cet agent s'est terminée en « limite_usage » dans les dernières heures, à lire dans le store. Joindre l'heure de reprise si le message la donne (« réessayer à 23:27 »). Dans launch, quand le chef nomme un agent indisponible pour l'une de ces raisons, refuser avec agent_indisponible et la raison, avant de créer la sous-mission. Ne pas consommer l'enveloppe.
- **Risque** : Écarter à tort un agent revenu disponible : limiter la mémoire de la limite à l'heure de reprise annoncée, ou à quelques heures. Même règle pour tous les agents (Claude, Codex, Gemini, OpenCode), rien de codé en dur pour l'un d'eux.

### 5. Ne pas présenter comme sûre une réponse finale corrigée par le chef après un verdict « à corriger »
- **Mode** : s_inspirer · **valeur** 4/5 · **effort** petit
- **Swarm** : Deux mécanismes. terminal-result-guard.ts refuse une fin de tâche dont la sortie ne respecte pas le contrat (outputSchema), avec un message qui redonne le schéma. La porte de suivi fait vérifier le résultat par un script déterministe et enregistre son verdict. En cas de doute, le chef est réveillé quand même, pour ne jamais conclure sans relecture.
- **Fichiers swarm** : src/tasks/terminal-result-guard.ts:1-60, src/tasks/follow-up-gate.ts:9-20
- **Relay** : verificationLines (packages/orchestrator/roles.js:217-252) écrit « dernier verdict X, non revérifié depuis » pour le travail d'une sous-mission. En revanche, quand le chef corrige lui-même la synthèse après un verdict à corriger, ce qui s'est passé le 20/11 sur ab1210ce et f419245a, rien ne dit que la réponse finale n'a pas été revérifiée. f419245a s'est terminée sur un dernier verdict « a_corriger » (journal-20-11, 18:27-18:53, point 4).
- **Fichiers Relay** : 
- **Proposition** : Dans family-bilan.js, après verificationLines, ajouter une ligne en tête du bloc dans deux cas : le dernier verdict de la famille n'est pas « approuve » et aucune vérification n'a suivi la dernière réponse du chef ; ou le chef a écrit sa réponse après le dernier verdict. Texte : « Réponse finale non approuvée par une vérification (dernier verdict : a_corriger) : corrections du chef non revérifiées ». Lecture seule des données existantes, aucun blocage.
- **Risque** : Il faut dater la réponse du chef par rapport au verdict. Si l'horodatage manque, mieux vaut écrire « non déterminé » que d'affirmer.

### 6. Exiger du chef une raison courte à chaque délégation, visible dans le Bilan
- **Mode** : copier_adapter · **valeur** 3/5 · **effort** petit
- **Swarm** : send-task impose routingReason et routingNote, de 10 à 200 caractères, quand le chef nomme un agent (session-templates.ts:91). Le texte du chef fixe aussi le partage des rôles : « Your output is delegation and review… You answer simple factual questions yourself ». Leur grille d'évaluation de la délégation avait un contrôle de sur-délégation : plus de 4 tâches pour un travail en 2 parts était suspect.
- **Fichiers swarm** : src/prompts/session-templates.ts:86-104, thoughts/taras/research/2026-06-16-delegation-eval-design-swarm.md:396-416
- **Relay** : mission_lancer ne demande aucune justification. Le 20/11, le chef a lancé une équipe sur l'épreuve « candidature » : 14,9 min contre 7,5 min pour un agent seul. Sur l'étude de marché, 26,6 min contre 12,2, sans gain net. Le propriétaire veut que la plateforme reconnaisse seule quand une équipe est utile.
- **Fichiers Relay** : 
- **Proposition** : Ajouter au schéma de mission_lancer un champ raison facultatif (10 à 200 caractères), en mode observation d'abord : ne rien refuser. Le stocker dans famille.raison, l'afficher dans le Bilan (teamLabel, family-bilan.js:134) et dans l'interface. Ajouter à CHIEF_RULE (delegation-rule.js:38) : « donne en raison ce que la sous-mission fait gagner (temps parallèle, regard indépendant) ». Ces raisons nourriront le choix automatique agent / équipe prévu par Codex.
- **Risque** : Allonge un peu le texte du chef. Un champ obligatoire ferait échouer des lancements : rester facultatif tant que ce n'est pas mesuré.

### 7. Évaluer l'équipe contre l'agent seul avec une grille qui ne se mord pas la queue
- **Mode** : s_inspirer · **valeur** 3/5 · **effort** moyen
- **Swarm** : Leur épreuve « delegation-probe » donnait 0,50 à tous les essais. Deux pénalités tombaient toujours. N2 punissait l'usage de Write par le chef, alors qu'écrire le rapport fusionné était le livrable obligatoire. N4 recomptait la même faute dès qu'un suivi existait. Un chef parfait et un chef sans rapport obtenaient donc la même note. Leurs corrections : punir seulement la collecte de données par le chef (pas l'écriture), ne jamais réutiliser le même signal dans deux pénalités, mesurer la qualité de la délégation et pas seulement son existence, et garder la trace complète des sous-tâches dans l'artefact.
- **Fichiers swarm** : thoughts/taras/research/2026-06-16-delegation-probe-050-rootcause.md:12-35, thoughts/taras/research/2026-06-16-delegation-probe-050-rootcause.md:124-191
- **Relay** : Les épreuves du 20/11 se comparent à la main : durée, tests cachés 18/18, juge indépendant pour l'étude. Il n'y a pas de grille fixe, et la consommation n'est pas mesurée (voir constat 1). Le CHIEF_RULE pousse à déléguer (« il attend que tu les lances en sous-missions ») et le TEAM_RULE à toujours faire vérifier (delegation-rule.js:38 et TEAM_RULE). Ce coût fixe pèse sur les petites tâches.
- **Fichiers Relay** : 
- **Proposition** : Écrire une grille fixe dans .manager (ou docs/) pour les épreuves « seul contre équipe » : durée, tokens (constat 1), justesse notée par un juge indépendant à partir des seules sources, nombre de sous-missions comparé au nombre de parts réelles, et collecte refaite par le chef après le retour des membres. Ne jamais punir le chef d'avoir écrit la synthèse. Rejouer les trois épreuves du 20/11 avec cette grille avant de toucher au texte du chef.
- **Risque** : Aucun pour le code (document et épreuves). Les épreuves réelles consomment la limite d'usage du propriétaire : à lancer seulement avec son accord.

### 8. Budget de famille : refuser au lancement, ne jamais couper en cours
- **Mode** : s_inspirer · **valeur** 2/5 · **effort** petit
- **Swarm** : Leur réflexion sur le budget par agent est partie d'un plafond strict « zéro dépassement ». Ils y ont renoncé : le refus se fait à la prise d'une nouvelle tâche, et une tâche lancée va jusqu'au bout. Le pire cas est donc le budget plus une tâche en cours. Le refus est conjonctif (global ET par agent). La tâche refusée reste en file, et le refus est signalé au chef comme une fin ou un échec.
- **Fichiers swarm** : thoughts/taras/brainstorms/2026-04-28-per-agent-daily-cost-budget.md:16-80
- **Relay** : Chaque sous-mission reçoit le budgetCents entier de la mère (delegation.js:1005). Le contrôle se fait exécution par exécution (packages/storage/index.js:217-232). Une famille de N membres peut donc dépenser (1+N) fois le budget prévu. Aujourd'hui budget 0 veut dire sans plafond, et pendant les tests le propriétaire ne veut aucun plafond bloquant.
- **Fichiers Relay** : 
- **Proposition** : Sans rien changer quand budgetCents vaut 0 : dans launch (delegation.js, près de la vérification de l'enveloppe), si la mère a un budget positif, sommer le ledger de la mère et de ses filles. Refuser le lancement (fail('budget_famille_atteint', …)) quand la somme atteint le budget, et donner à chaque fille le reste plutôt que le budget entier. Pas de coupure en cours : comme chez swarm, on ne contrôle qu'au lancement.
- **Risque** : Contredire la décision du propriétaire (pas de plafond bloquant en tests) si on l'active par défaut : ne jouer que pour un budget positif fixé par lui.

## Pièges (ce qui n'a pas marché chez eux)
- Grille d'évaluation de la délégation bloquée à 0,50 : elle punissait le rapport obligatoire écrit par le chef (N2), puis la même écriture une deuxième fois dès qu'un suivi existait (N4). Elle ne distinguait pas un bon chef d'un chef sans rapport (thoughts/taras/research/2026-06-16-delegation-probe-050-rootcause.md).
- Déclencheurs traités deux fois par le chef dès qu'il pouvait mener plusieurs sessions à la fois : messages et mentions n'étaient pas « pris » de façon atomique, contrairement aux tâches (startTask). Deux sessions répondaient au même message (thoughts/shared/research/2026-01-13-lead-duplicate-trigger-processing.md).
- Boucle « le membre finit → suivi → le chef relance le même travail » : bornée après coup par une règle de similarité et un plafond de 10 lancements par fil en 6 h, vérifiés dans la transaction de création (src/tasks/follow-up-redelegation-guard.ts:1-45).
- Chef qui attend en boucle : trace d'un chef Codex à 357 142 tokens lus pour un simple « ping » (sleep 3, sleep 6, relecture répétée), contre 117 877 pour le membre. D'où la consigne « attendre ~1 min au plus puis defer-task » (thoughts/taras/research/2026-04-09-codex-lead-ping-transcript.txt ; src/prompts/session-templates.ts:102-104).
- Coûts faux de 19 % (4 246 $ sous-évalués sur 8 996 tâches) : recalcul par table de prix au lieu du chiffre de l'agent, écritures de cache 1 h comptées au tarif 5 min, sous-agents internes exclus (thoughts/taras/research/2026-08-06-task-vs-session-cost-mismatch-audit.md).
- Coût perdu quand une tâche passait terminée en cours de session : ajout d'une grâce de 45 s (CHANGELOG.md:134, #3179).
- Reprise d'un workflow qui créait une deuxième tâche au lieu de reprendre l'étape orpheline (CHANGELOG.md:112, #3215).
- Plafond de budget strict abandonné pour un refus au lancement, avec un dépassement borné par une tâche en cours (thoughts/taras/brainstorms/2026-04-28-per-agent-daily-cost-budget.md:52-70).
- Seuils de blocage à 0 ou négatifs acceptés par erreur, corrigés après coup (thoughts/shared/plans-yolo/2026-11-15-heartbeat-stall-thresholds.md ; CHANGELOG.md:116, #3173, #3174 boucle serrée de l'ordonnanceur).
- Nouveaux garde-fous d'abord en mode observation (shadow), puis appliqués à une liste restreinte, et laissant passer en cas de doute : porte de suivi (src/tasks/follow-up-gate.ts:9-20 ; CHANGELOG.md:13, #3479).

## Non lu
- thoughts/taras/plans (la plupart), brainstorms 2026-08-21-work-on-task-turn-prompt.md et 2026-08-19-agent-communication-style.md
- thoughts/taras/research/2026-03-08-drive-loop-concept.md et 2026-03-30-budget-system-research.md
- thoughts/shared/plans/2026-05-28-graceful-pause-resume-via-followup.md et 2026-01-13-prevent-duplicate-trigger-processing.md (plan détaillé de la correction)
- BUSINESS_USE.md, SECURITY.md, specs/tla/README*
- runbooks autres que heartbeat-crash-recovery (titres) et model-tiers (section des basculements)
- src/tasks/sibling-awareness.ts et sibling-block.ts en détail
- Relay : .manager/reports/equipe-01.md lu par titres seulement ; registre-erreurs.md, seules les 25 dernières lignes (datées du 05/11)
