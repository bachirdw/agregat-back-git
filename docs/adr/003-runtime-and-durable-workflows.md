# ADR 003 — ACP v1 conservé et workflow durable distinct des sessions

Statut : accepté pour la direction des sprints 02–03 ; implémentation à réaliser.
Date : 25 octobre 2026. Précise et corrige la réserve acpx de l’[ADR 001](001-local-acp.md).

## Contexte vérifié

Relay possède déjà un client ACP SDK 2.0.2, des adaptateurs Codex 2.2.2/Claude 0.95.0 et des profils Gemini/OpenCode. Son `Orchestrator.execute()` transmet aujourd’hui une recette entière dans un prompt : l’ordre des étapes est demandé à l’agent, pas exécuté par un ordonnanceur. SQLite conserve runs/événements ; les opérations non terminales deviennent `interrupted` au redémarrage. `loadSession` restaure une conversation fournisseur, pas l’avancement transactionnel d’un workflow.

L’[audit à SHA fixe](../open-source-research.md) établit :

- Gemini `--acp` et OpenCode `acp` sont natifs. Handshake v1 réussi sur les deux versions publiées testées ; seul OpenCode a créé une session sans authentification. Gemini utilise encore `models`/`unstable_setSessionModel`, tandis que le client Relay ne lit que `configOptions`.
- acpx expose un runtime réutilisable (sessions/reconnexion/queue/callbacks), mais ses flows suivent un seul curseur (`src/flows/runtime.ts:345–374`) et refusent plusieurs sorties par nœud (`graph.ts:24–29`). Le stockage écrit des traces/artefacts ; aucune API de reprise d’un flow sauvegardé n’a été trouvée dans les surfaces inspectées. Un checkpoint `waiting` ne suffit pas à établir un moteur durable.
- CAO reprend réellement un workflow journalisé (`workflow_service.py:1573–1647`), avec plafond du lanceur initial ; ses branches parallel/pipeline lèvent encore `NotBuiltYetError`.
- DBOS cache les résultats d’étapes et réenfile les workflows interrompus (`dbos-executor.ts:961–1004,1274–1294`), avec stockage PostgreSQL (`system_database.ts:2`). Ce n’est pas une dépendance SQLite légère interchangeable.

Les liens immuables et empreintes des fichiers sont dans l’étude et l’index de preuves. Aucune de ces bibliothèques n’a été ajoutée à Relay pendant ce sprint.

## Décision

Conserver le SDK ACP et le protocole **v1 négocié**, sans réécrire JSON-RPC ni les adaptateurs fournisseurs. Le numéro majeur du SDK n’est pas celui du protocole. Garder les versions verrouillées ; ne pas assimiler le HEAD codex-acp au paquet 2.2.2 publié, malgré le même numéro de version déclaré (gitHead distinct, diff important).

Au sprint 02, corriger en priorité `AcpRuntime.request()` : il passe actuellement `signal` alors que le SDK 2.0.2 attend `cancellationSignal` ; cette annulation reste coopérative, donc imposer aussi une deadline locale et un arrêt des enfants pour un pair muet. Un test déterministe du script d’audit couvre désormais ce cas, sans prétendre corriger le runtime produit. Puis normaliser les profils natifs et les capacités : présence du CLI, handshake, session, modèles annoncés, modes et transports MCP. Préférer Gemini `--acp` ; utiliser l’ancien chemin de sélection du modèle uniquement quand la réponse de session l’annonce. Conserver la preuve brute et sa version. Une capacité inconnue reste inconnue ; Auto filtre les exigences obligatoires et explique un agent indisponible au lieu de masquer un échec par une fixture.

Au sprint 03, développer dans le monolithe un **ordonnanceur DAG déclaratif borné**, adossé au SQLite existant :

- dépendances explicites entre étapes, validation du graphe, limites de concurrence et politique de conflits de workspace ;
- tables d’étapes et de tentatives avec états/horodatages, entrées et sorties vérifiées, identifiant fournisseur séparé ;
- admission et changement d’état atomiques, identifiant de tentative/génération pour refuser les publications tardives d’un processus annulé ;
- arrêt réel des processus, permissions en attente annulées, reprise explicite après crash ;
- conservation des résultats terminés ; classification des effets pour choisir reprise idempotente, réconciliation ou décision humaine ;
- vérification/agrégation imposées par le moteur, indépendantes du texte produit par l’agent.

Les noms exacts d’états et migrations seront fixés au sprint 03. Une étape dont l’effet externe est incertain ne doit pas être réexécutée automatiquement. Un prompt modèle peut consommer même si sa réponse n’a pas été journalisée : tracer cet état, ne pas prétendre à l’exactly-once.

## Alternatives et conséquences

**acpx runtime** reste candidat si ses queues/reconnexions apportent un bénéfice mesuré. Il exigerait un spike de compatibilité (callback qui refuse, annulation, fermeture, stockage, modèles/MCP), une épingle et une stratégie de migration des sessions. L’adopter maintenant ajouterait un second propriétaire de sessions, sans fournir notre DAG. **acpx flows** n’est pas retenu pour le fan-out/fan-in durable demandé.

**CAO** reste une référence pour les journaux et la reprise ; Python/tmux et parsing terminal augmenteraient notre surface sans fournir le parallélisme recherché sur le chemin inspecté. **DBOS** est à réévaluer lorsque PostgreSQL et plusieurs workers seront justifiés. Le développement local choisi ne doit pas dériver vers un moteur distribué généraliste.

La contrepartie est de devoir prouver les comportements de crash et les conflits nous-mêmes. Critères de validation du sprint 03 : DAG parallèle réel sur fixtures marquées, interruption au milieu d’une étape, redémarrage sans rejouer une étape terminée, refus d’une sortie d’ancienne génération, annulation avec permission en attente, agrégation qui échoue si une preuve manque. Aucune nouvelle suite de tests de ce moteur n’est prétendue opérationnelle dans ce sprint d’analyse.
