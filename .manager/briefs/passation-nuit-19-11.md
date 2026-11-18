PASSATION — projet Relay, manager de nuit (rédigée le 18/11/2026 à 22:00 par le manager précédent)

Tu reprends le rôle de MANAGER du projet Relay, en autonomie jusqu'à 5 h du matin le 19/11/2026. Je suis le propriétaire et je dors. La discussion du manager précédent était devenue trop lourde ; ce texte est sa passation. Réponds et écris toujours en français, avec les accents, simplement : je suis peu technique, dis quoi, pourquoi, quel effet, quelle brique.

=== 1. À FAIRE EN PREMIER ===
Le dossier où tu démarres, ~/Downloads/agregat-back, est INTERDIT (ancien code, ancien CLAUDE.md périmé, mon travail) : n'y écris rien, n'y lis rien comme source de vérité, travaille par chemins absolus.
Lis dans cet ordre :
1. /Users/diaw/Downloads/agregat-back-essai-13-11/.manager/HANDOFF.md en entier. La section 0 commence par mon mandat de nuit et le plan ; elle donne la « marche d'une intégration ». Sections 2 (règles), 4 (lancer et vérifier), 9 (méthode).
2. /Users/diaw/Downloads/agregat-back-essai-13-11/.manager/reports/nuit-18-11.md : le journal de la nuit, que tu continues.
3. /Users/diaw/Downloads/agregat-back-essai-13-11/.manager/briefs/delegation-v2-01.md : le brief du sprint à lancer.
4. /Users/diaw/Downloads/agregat-back-chef/.manager/reports/delegation-conception-v2-18-11.md : le plan v2 de la délégation à des sous-agents (la spécification).
5. Au besoin : .manager/reports/registre-erreurs.md (défauts E1 à E138), genericite-moteur-18-11.md, guet-18-11.md.
Ta toute première action, après avoir vérifié l'état réel par des commandes en lecture seule : ajoute en tête du journal de la nuit la ligne « RELAIS PRIS par la nouvelle discussion à HH:MM » (heure lue par date). L'ancienne discussion lit cette ligne et s'arrête ; sans elle, elle continue le plan à minuit et vous seriez deux.

=== 2. CE QUE J'AI DEMANDÉ (tout reste valable) ===
Mandat de nuit (21:30) :
- Implémenter le mode « sous-agents » dont on a parlé (workflows d'agents), et tout ce qui va avec.
- Ne pas trop modifier le code qui marchait déjà.
- Coder lentement : la qualité, pas la vitesse. Relire le code écrit, faire une série de tests, en ajouter pour le mode sous-agents.
- Tout ce qui est essayé avec Claude doit l'être aussi avec Codex et avec Gemini. Attention avec Gemini : API payante, très peu d'essais. Claude et Codex sont des abonnements : tu peux y aller.
- Essais réels dans mon Chrome autorisés. Éviter d'envoyer des données personnelles sur le net.
- Sous-agents autorisés, travail en parallèle autorisé, pas de limite de jetons, mais gère la limite d'usage : près de la limite, attends la fenêtre suivante.
- Résultat attendu : une mission normale → la plateforme n'utilise pas de sous-agents ; une mission du type « cherche sur LinkedIn, Indeed et SEEK » → l'agent peut lancer des sous-agents, après m'avoir demandé mon accord (cela consomme plus) ; rapide, efficace, pas d'agents pour rien ; les sous-agents se coordonnent.
- À la fin : un parcours complet rejoué (découverte sur le web, tri, CV et lettres de motivation, formulaire rempli) et la plateforme essayée SANS Skill (sans career-ops), sur plusieurs modèles.
- AUCUNE candidature envoyée en mon absence. AUCUN push (je n'ai pas donné l'ordre).
Mes consignes de la soirée du 18/11 :
- Aller doucement sur ce qui est sensible et qui marche (le moteur, l'orchestrateur) : changements additifs, intégration par petites étapes.
- Le code doit marcher avec tout type de Skill et toute tâche : rien dans le moteur ne suppose career-ops.
- Mêmes autorisations et même comportement pour tous les agents ; rien de propre à un agent ; ne rien ajouter qui restreigne l'agent ; le prompt prime sur le Skill.
- Des faits avant toute correction ; dire ce qui est vérifié en réel et ce qui ne l'est pas.
- Le manager a la priorité sur le code du serveur ; une autre discussion code l'interface (nouvel écran multi-agent), ce n'est pas ta priorité.
Mes quatre réponses sur le mode sous-agents (19:14, dans le plan v2) : les outils de délégation sont visibles dans toutes les missions ; une demande écrite dans le prompt vaut accord ; l'agent chef choisit l'agent et le modèle de chaque sous-agent ; au plus 6 sous-agents par mission, dont 3 en même temps. Autoriser n'oblige jamais.

=== 3. CE QUI A ÉTÉ FAIT LE 18/11 AU SOIR ===
Tout est dans la version unique ~/Downloads/agregat-back-essai-13-11 (branche contacts-13-11), intégré par étapes, chaque étape avec arrêt de l'API, suite complète verte et essai réel. Rien n'est poussé depuis 514c5c4 (une soixantaine de commits locaux).
Fichiers de code modifiés, par sprint :
- prompt-prime-18-11 : packages/career-ops/integration.js (phrase « le prompt du propriétaire prime sur le Skill »).
- ecriture-18-11 : packages/career-ops/tools.js, docs/api-career-ops.md (mode « append » de career_write, message de refus du TSV).
- captures-18-11 : packages/browser-gateway/cdp.js, index.js, paginate.js, packages/capability-registry/index.js (captures entières, extraction en liste jusqu'à 1 000 éléments).
- collecte-18-11 : packages/career-ops/truth.js (une collecte « sans ouvrir ni noter » ne finit plus en échec « boîte d'entrée non traitée », défaut E135).
- lecture-18-11 : packages/orchestrator/skill-router.js, domain-packs/career-ops/skill-manifest.yaml (annonce lue par un script comptée comme lue, E128).
- generique-01 : packages/orchestrator/index.js, packs.js, tool-guard.js, packages/mcp-gateway/server.js (un pack autre que career-ops garde son parcours, index.js de pack facultatif, délai d'outil déclaré par le pack).
- Chaque sprint a ses fichiers de tests (tests/<sprint>.test.js, review-…, review2-…) et ses rapports (.manager/reports/).
Dernière suite complète verte : 20:48 → 21:02, 1 428 tests unitaires (1 à faire), 253 tests navigateur.
Décisions prises :
- Intégration du moins sensible au plus sensible, avec une relecture contradictoire à plusieurs agents avant les sprints sensibles : elle a confirmé neuf défauts, tous corrigés avant intégration (restes connus dans le HANDOFF).
- E135 corrigé par la règle du Bilan du pack (option B), accord donné par moi.
- generique-01 intégré le soir même, accord donné par moi.
- Mesure à plusieurs onglets réussie à 21:35 : des sous-agents peuvent naviguer en même temps, pas de « tour de parole » à coder.
- Pour les essais de la nuit, le manager donne lui-même l'accord de délégation aux missions d'essai qu'il lance ; il ne répond à aucune autre question à ma place.
Essais réels joués (détail dans guet-18-11.md et le journal) : recherche SEEK cinq pages avant et après correctifs (terminée en 3 min 20 s à 3 min 48 s au lieu d'un échec en 5 min) ; recherche SEEK sans borne de pages (28f91e1b : 15 pages, 252 offres ajoutées, 502 en attente) ; évaluation avec Claude (08730a60) et avec Codex (676635e2 : trois offres notées, toutes les étapes faites) ; plateforme sans Skill avec Codex (7af65291, réussie en 51 s).
Pas encore vu en réel : le mode « append », la lecture d'annonce par script (E128), un autre Skill que career-ops. Défauts ouverts ce soir : E136, E137, E138.

=== 4. ÉTAT À 22:00 (à vérifier avant d'agir) ===
- API d'essai 4314 en marche (code intégré), page fictive 4321, interface 5177, relais Playwriter 19988. L'API tourne dans un onglet Terminal de l'ancienne discussion, que tu ne peux pas commander : pour l'arrêter, tue son processus (kill $(lsof -ti tcp:4314 -sTCP:LISTEN)), puis relance-la dans un onglet à toi : zsh /Users/diaw/Downloads/agregat-back-essai-13-11/.manager/outils/api-branche.sh 4314 /Users/diaw/Downloads/career-ops-essai
- Mission en cours : dac64668 (épreuve du CV, Codex, lancée à 21:53). Elle fait partie d'un parcours de référence « avant sous-agents » avec Codex : évaluation (faite), CV (en cours), puis formulaire de la page FICTIVE 4321 sans envoi (à faire).
- Sprint delegation-v2-01 préparé, pas encore codé : arbre ~/Downloads/agregat-back-delegation, branche delegation-v2-01, tête 74688e1 (code du sprint suspendu chef-01 repris sur la version unique 48a2f4e ; ses 17 tests passent).
- Limite d'usage : environ 92 % à 22:00, remise à zéro à MINUIT, puis fenêtre de 5 heures. Lis-la avant chaque lancement d'agents. Repère : environ 1 point pour 100 000 jetons de sous-agents. Avant minuit : seulement ce qui coûte peu (missions Codex, lectures). Près de 95 % : arrête-toi et attends la remise à zéro avec un réveil (une commande Python en tâche de fond qui dort jusqu'à l'heure voulue).
- Les derniers changements du journal et du HANDOFF ne sont peut-être pas commités (une mission tournait) : commite-les par chemins explicites quand aucune mission n'est en cours.

=== 5. PLAN DE LA NUIT (ajuste-le aux faits et dis pourquoi dans le journal) ===
1. Avant minuit : relever dac64668 ; jouer le formulaire fictif avec Codex ; préparer le sprint.
2. À minuit : sprint delegation-v2-01 dans son arbre : codeur de la partie A, puis codeur de la partie B (découpage du brief), relecteur indépendant avec l'angle « rien d'existant ne change », vérificateurs en lecture seule (mission qui ne délègue pas inchangée ; réglage de retrait = comportement de la base ; mêmes textes et outils pour tous les agents ; rien de career-ops dans le moteur ; accord, refus et enveloppe ; tour de synthèse et délais), corrections jusqu'à ce qu'il ne reste rien.
3. Ton contrôle (diff lu, tests relancés), puis des essais réels AVANT intégration sur une API temporaire lancée depuis l'arbre du sprint sur un autre port (4315, même script), avec Claude puis Codex : une mission simple donne le même résultat qu'aujourd'hui ; une recherche d'informations simple (zéro sous-agent attendu) ; une recherche sur trois sites avec accord donné ; l'accord refusé (l'agent continue seul) ; la même chose sans Skill (pack core). Une seule mission courte avec Gemini.
4. Corrections de ce que les essais montrent, puis intégration par la marche du HANDOFF (git cherry-pick 48a2f4e..delegation-v2-01, tests du sprint sur la version unique, suite complète en tâche de fond, relance de l'API). Si un test échoue : arrête-toi, établis par un fait si c'est le test ou le code.
5. Parcours complet sur la version intégrée, Codex puis Claude : découverte, tri ou évaluation, CV et lettre, formulaire fictif rempli, arrêt à la carte d'envoi.
6. Avant 5 h : registre, section 0 du HANDOFF réécrite, journal terminé par un compte rendu du matin (fait, vérifié en réel ou non, cassé, à décider), tout commité. Laisse l'API 4314 en marche sur une version dont la suite complète est verte. À 5 h, ne lance plus rien.
Si tout ne tient pas dans la nuit, préfère un morceau solide et vérifié à un ensemble fragile, et dis exactement où tu t'es arrêté.

=== 6. INTERDITS ===
- Aucun envoi (candidature, e-mail, message) : n'accorde jamais une carte d'envoi ; une mission qui s'arrête sur une carte d'envoi a réussi son essai. Formulaires : seulement la page FICTIVE locale 4321, jamais un vrai site avec mes données. Ne réponds jamais à ma place à une question personnelle d'une vraie mission.
- Aucun push ni merge. Git : jamais git add -A, stash, reset, rebase, amend ; commits par chemins explicites, préfixés, heure lue par date ; pas de commit de code dans le dossier d'une API en marche ; pas de suite complète pendant une mission dans le navigateur.
- Intouchables : le Skill et la bibliothèque career-ops, mes CV. Aucun secret lu (.env*, .envforme, .manager/secrets.env, ~/.codex/auth.json, ~/.claude*). Dépôt public : aucune donnée personnelle dans Git ni dans les rapports (ni adresse d'offre, ni nom d'entreprise, ni texte de prompt réel).
- Tu délègues le code à des sous-agents Opus (un seul écrivain par arbre), Sonnet pour le facile. Rien de propre à un agent, rien qui restreigne l'agent, pas de relecture orientée sécurité. Ne jamais sonder le relais en /cdp nu. Un sous-agent ne reformule jamais une commande refusée.

=== 7. FAÇONS DE FAIRE QUI ONT SERVI ===
- Guet : une boucle en tâche de fond sur python3 -I …/.manager/outils/attendre-mission.py 4314 …/.data/guet-etat.txt 560 jusqu'à MISSION_FINIE te prévient sans rien consommer ; un sous-agent Sonnet en lecture seule écrit ensuite la section de la mission dans .manager/reports/guet-18-11.md (ou guet-19-11.md après minuit), pendant que l'API tourne encore.
- Lancer une mission : python3 -I .manager/outils/lancer-mission.py <port> <agent> <modèle|-> playwriter <pack> "<prompt>" (packs career-ops ou core ; Claude avec le modèle sonnet). Les prompts des épreuves sont dans le HANDOFF ; un prompt réel se relit dans ~/Downloads/career-ops-essai/relay/runs/<id>-input.json et ne se recopie jamais dans Git.
- Base des missions en lecture seule : sqlite3 "file:<chemin>/.data/platform.sqlite?mode=ro&immutable=1".
- Dans un test, poser AGENT_PLATFORM_AGENTS_CONFIG vers un fichier absent, sinon il sonde les agents installés et devient très lent. Une empreinte de référence prise avant d'autres intégrations peut être périmée : le prouver en rejouant le test sur le code d'avant.
- Chaque intervention coûte : regroupe tes appels d'outils, confie les longs travaux à des workflows ou à des tâches de fond, évite de te réveiller pour rien.

Commence par vérifier l'état réel, écris la ligne « RELAIS PRIS » dans le journal, puis dis-moi en quelques lignes simples ce que tu as compris et ce que tu lances.
