# Passation — 04/11/2026, 20:20 (heure du Mac, UTC+11)

Pour la conversation suivante. Lire dans l'ordre : ce fichier, puis `.manager/PLAN-04-11.md` (plan de nuit, 15 chantiers, §6 questions au propriétaire, §7 non vérifié), puis le tableau « Erreurs analysées » de `.manager/reports/registre-erreurs.md`, puis le journal `.manager/reports/reprise-04-11.md` (sections « 19:20 » à « 20:18 » pour la soirée). La passation précédente, `.manager/reports/passation-04-11.md` (14:15), reste valable pour tout ce qui n'est pas repris ici.

## 1. Cadre

- Projet Relay : plateforme universelle d'agents CLI (Claude Code, Codex, Gemini CLI, OpenCode) par ACP/MCP, Skills, workflows ; priorité Career Ops (pack `career-ops`) et chantier candidature.
- Propriétaire : seul utilisateur ; moi : « CTO » / manager. Il donne les directives, je les suis.
- Dossier de travail : `~/Downloads/agregat-back-astra` (worktree), branche `suite-astra`. Dépôt GitHub public : aucune donnée personnelle (CV, profil, liens d'offres, lieu) dans Git ni dans les rapports.
- Autres dossiers : `~/Downloads/agregat-back` (checkout principal, travail non commité à ne pas toucher), `~/Downloads/agregat-front` (front, sessions Claude séparées), `~/Downloads/agent-repos-agregat` (dépôts d'inspiration, cartographiés dans `.manager/CARTE.md`), `~/Downloads/agregat-career-ops` (bibliothèque career-ops, intouchable).
- Codex (`gpt-6-sol`) bloqué par sa limite jusqu'au 06/11 12:54 : tout le code passe par des sous-agents Claude.

## 2. Règles permanentes du propriétaire (verbatim ou presque)

- « Ne touche pas au travail non commité de ~/Downloads/agregat-back. Jamais de git add -A, de stash, de reset ni de réécriture d'historique. »
- « Aucun push ni merge sans mon ordre, sauf la branche propre à une session cloud que je t'ai demandé de lancer. » Ordre permanent donné le 04/11 : commit local puis push de `suite-astra` à chaque étape ; `main` avancé seulement sur `npm test` complet vert.
- « La bibliothèque career-ops, le Skill et le CV restent intouchés. Ne lis aucun secret (.manager/secrets.env, .envforme, ~/.codex/auth.json, ~/.claude*, trousseau). »
- « Des tests verts ne suffisent pas à prouver l'absence de régression : pour chaque changement, dis ce qui a été vérifié réellement et ce qui ne l'a pas été. »
- « Tiens un rapport français horodaté dans .manager/reports/. » Lire `date` avant chaque horodatage (dérive de +1 h constatée ce soir, corrigée).
- Ne pas arrêter ni relancer API, front, relais sans le dire.
- Registre d'erreurs avec degré de certitude (constaté avec n° de mission / lu dans le code / rapporté) ; jamais une déduction présentée comme un fait.
- Protocole d'épreuves : étape 3 = symptôme + UNE couche (constitution, règle scopée, skill, prompt système de l'acteur, registre de décisions) ; étape 4 = ligne exacte vérifiée par 3 tests au niveau le plus bas ; étape 5 = rejeu, pas de 2e ligne par-dessus, arrêt après 3 cycles sans progrès. Leçon du soir : le test le plus bas doit passer par le même chemin que l'agent (passerelle MCP), pas seulement par la classe (E13).
- Ne pas brider ni restreindre l'agent : laisser contourner tant que la mission aboutit ; seule exception, le clic humain avant un envoi final. E5 abandonné. Aucune règle métier en dur dans le moteur : tout passe par le manifeste du pack ou un champ générique.
- E14 (secours Remotive/Arbeitnow) mis de côté : ne plus nommer ces sites dans les prompts ; najah reste.
- Modèles : Sonnet/Haiku pour le courant ; Opus pour les sous-agents sur chantiers complexes (directive du 04/11 soir) ; Fable pour réflexion, débogage, architecture, briefs, relectures. Un sous-agent à la fois ; relever `get_usage` avant chaque lancement ; arrêt des nouveaux chantiers au-delà de 70 % de la limite 5 h, arrêt complet à 85 %.
- Pendant une mission navigateur réelle : aucune suite Chrome (`npm test`) en parallèle (E23).
- Deux écrivains dans le même arbre : commits par chemins explicites (`git commit -m … -- <fichiers>`), `git add` seulement pour un fichier nouveau.

## 3. État au moment de la passation (constaté 20:19)

- `suite-astra` = `main` = `origin/main` = **d759b30** ; arbre propre.
- Dernière suite complète : 569 + 138 Chrome, EXIT 0, sur l'arbre de 9caec0c (C6), lancée par le sous-agent sans mission en cours ; les commits suivants sont des rapports.
- Processus laissés en marche : API 4310 pid 86576 (lancée depuis `agregat-back-astra`, onglet terminal c1, code complet de la soirée), relais Playwriter 19988 pid 10497 (connecté, extension Chrome), front 5173 pid 4396 (lancé par une autre session), collecteur du registre `python3 .manager/registre-erreurs.py` dans l'onglet c2.
- Commande de l'API (onglet c1) : `AGENT_PLATFORM_BROWSER=playwriter AGENT_PLATFORM_LIVE=1 AGENT_PLATFORM_OWNER_MODE=1 AGENT_PLATFORM_TIMEOUT_MS=1800000 node --env-file-if-exists=~/Downloads/agregat-back/.manager/secrets.env apps/api/server.js` (ne pas lire le fichier de secrets ; seulement le passer).
- Limite Pro 5 h : 67 % à 20:19, remise à zéro à 00:00 locale (13:00 UTC) ; hebdo 22 %, Fable 35 %.
- Sous-agents : aucun en cours. Sessions front : à relire au besoin (`agregat-front`, `main` à d842e35 d'après la passation de 14:15).

## 4. Ce qui a été fait ce soir (19:00 → 20:18), avec degré

| Chantier | Commits | Vérifié | Non vérifié |
|---|---|---|---|
| E19 sondes | 7864484 | 3 sondes par le relais : description LinkedIn absente du DOM en onglet caché, snapshot fidèle (constaté) | rendu au premier plan (propriétaire) |
| E22 | ba9d0ca | test unitaire ; script bilan-vs-events retrouve la contradiction sur 5e493fd3 et 0 sur 1bd8fea6 | mission réelle avec outil nommé dans une question |
| E18 + E16 (sous-agent Sonnet, brief `e18-note-sans-lecture-01`) | eccba9c…55a64f1 | suite complète 538+137 ; fixture bout en bout « note sans lecture » → `failed` incomplète | en réel : P3 rejouée (1bd8fea6) n'a rien noté (consigne citée), contrôle non exercé |
| C0 (manager) | bfe3d6d | `readsBeforeScore(manifest)` remplace les 2 règles `pack.id` d'E18 ; 85 tests ciblés ; suite 538+137 | — |
| PLAN-04-11 | c5e8986 | workflow 10 agents (4 lecteurs, 3 ébauches, 2 jurés, synthèse) | numéros de ligne des dépôts d'inspiration non relus (§7 du plan) |
| C3 question en prose (sous-agent Opus, brief `c3-question-prose-01`) | 4ac1af0, e284f8d, 5be4ce9, 38891cc, 2fc45d0, ea6907b | suite 559+138 ; en réel b009997b : question **par formulaire** → `awaiting_owner` → `POST /answer` → reprise **même session** (constaté) | voie `question` JSON en prose avec un vrai agent ; front |
| C3 suite (manager) | 8a48c67 | règle de doute et `CAREER_INSTRUCTIONS` alignées sur le formulaire (`grep "dans summary"` vide dans packages/) ; 86 tests | second rejeu réel concordant |
| C2 E13/E2/E17 (manager) | d6ea2e4, 89aeccc | E13 tenu en réel 163dfe2d après le 2e correctif (passerelle) ; test par client MCP | `fetchedAt` ≤ fin de mission sur 3 fiches réelles |
| C1 partie 3 script | 7b59533 | `.manager/outils/bilan-vs-events.mjs <mission>` + 4 tests | les bilans d'outils de la passerelle ne sont pas persistés (seuls `permission_auto` en témoignent) |
| C5 a-b (manager) | 6145279 | `scroll` défile le conteneur interne (test Chrome réel), preuve avec `hidden`/`textLength` ; 40 Chrome, 86 unitaires | LinkedIn réel ; C5 c (ligne de Bilan) non fait |
| C8 note du pack | 14539a1 | test de formatage | ligne de Bilan « Scan : n portail(s) en échec » (moteur) non faite ; mission SEEK réelle non faite |
| E24 (manager) | c62e58e | `unlessPhrases` étendues (« ne lance aucun script »…) ; test | rejeu réel |
| C6 (sous-agent Sonnet, brief `c6-accord-envoi-01`) | 9caec0c | suite 569+138 ; 8 tests (faux contrôle pour les délais) | vrai agent avec accord `send` ouvert (nécessite C7) |

Missions réelles de la soirée (base `.data/platform.sqlite`) : 5bc9a43f (E19), 1bd8fea6 (P3), 59c54cf9 (E13 KO), 163dfe2d (E13 OK), 5679eafd (E23 + prose), b009997b (formulaire OK, E24).

## 5. Fichiers modifiés depuis 1729d31 (hors rapports)

- Orchestrateur : `packages/orchestrator/index.js` (questions prose, tour de réponse même session, `readsBeforeScore`, `activeSlots`, `pendingPermission`, accord `send` sans expiration, délais suspendus), `questions.js` (`proseQuestion`), `result.js` (`question`), `skill-router.js` (`exempt`, `READ_BEFORE_SCORE`, `readsBeforeScore`, `incomplete(..., scoredOffers)`), `doubt-rule.js`, `workflow-run.js` + `turn-guard.js` (elicitation DAG), `packs.js` (`optionalFiles`), `browser-proof.js` (`hidden`, `textLength`, `waitedFor`, `scrolled`).
- Runtime : `packages/agent-runtime/index.js` (`continueSession`, elicitation), `packages/storage/index.js` (question au redémarrage).
- Career-ops côté Relay : `packages/career-ops/tools.js` (`optionalFiles`, `fetchedAtFor`, descriptions), `truth.js` (`scoredOffers`, titre = nom exact), `integration.js` (consigne formulaire).
- Passerelles : `packages/mcp-gateway/server.js` (`scoredUrl`, `optionalFiles`), `packages/browser-gateway/cdp.js` (conteneur interne, `hidden`, `textLength`), `apps/api/server.js` (`scoredUrl`, `pendingPermission`).
- Packs : `domain-packs/career-ops/manifest.yaml` (`optionalFiles`), `skill-manifest.yaml` (notes des rôles, `unlessPhrases`).
- Docs : `docs/api-questions.md`, `docs/api-sends.md`, `docs/api-career-ops.md`.
- Tests nouveaux : `tests/note-sans-lecture.test.js`, `tests/truth-tool-names.test.js`, `tests/career-optional-files.test.js`, `tests/bilan-vs-events.test.js` ; étendus : `elicitation`, `owner-permissions`, `owner-browser`, `browser-proof`, `doubt-tools`, `agent-result`, `fix-resume`, `workflow-run`, fixtures `fake-acp.js` (`proseQuestion`, `callsFile`, `askQuestion`), `career-agent.js`.
- Outils : `.manager/outils/bilan-vs-events.mjs`, `sonde-e19*.mjs`. Briefs : `e18-note-sans-lecture-01`, `c3-question-prose-01`, `c6-accord-envoi-01`.

## 6. Registre : où en est chaque erreur (04/11 20:19)

- Corrigés et tenus en réel : E4 formulaire (2/2), E7, E10, E13 (1/1).
- Corrigés, tests seulement : E2, E15, E16, E18 (non reproduit en réel 1/1), E22, E24, E17 (description).
- Ouverts : E1 (`requestedUrl`, C4), E3 (Bilan assemblé avant `incomplete`, C1), E6, E8, E9, E11, E12 (à reproduire, C12-C14), E19 (attend le propriétaire : premier plan), E20 (C10), E21 (SEEK 403, structurel, C8), E23 (captures en échec pendant la suite Chrome, déduit).
- Abandonné : E5. Mis de côté : E14.

## 7. Plan : prochaines étapes dans l'ordre

1. Avec le propriétaire (questions §6 du PLAN-04-11) : E19 au premier plan dans son Chrome (sonde `node .manager/outils/sonde-e19.mjs <url> <mots>`) ; plafond d'attente de l'accord d'envoi et des questions (aucun par défaut) ; lien SEEK pour C8 ; confirmation que C15 n'est pas la refonte gelée ; E14 ; phrases de l'intent `evaluate`.
2. C7 fictif : brief à écrire (page fictive à 3 étapes, `browser.dialog`/`browser.verify`, `urlPattern`, mission réelle sur page fictive jusqu'à `waiting_permission` puis `POST /cancel` ; le manager n'approuve jamais un envoi). Sous-agent Opus.
3. C5 c (ligne de Bilan « texte attendu non apparu ») et C8 moteur (ligne « Scan : n portail(s) en échec ») : petits, `index.js`/`truth.js`.
4. C1 reste : E3 (calculer `incomplete` avant le Bilan), tests inter-adaptateurs des titres d'outils.
5. C4 (`requestedUrl`, `pageIdentity`, retrait des règles `pack.id` restantes : 21 occurrences dans `index.js`), puis C9, C10, C11, C12-C14, C15.
6. Second rejeu réel d'une mission à question avec navigateur, sans suite Chrome en parallèle, pour confirmer la voie formulaire et isoler E23.
7. Front `agregat-front` : afficher `awaiting_owner` + formulaire (`docs/api-questions.md`) et `waiting_permission` + `pendingPermission` (`docs/api-sends.md`) ; à confier à une session front.

## 8. Procédures utiles

- Mission réelle par l'API : `POST /api/runs` avec `{prompt, agent:'claude', pack:'career-ops', workspace:'career-ops', model:'sonnet', browser:'playwriter'}`, en-tête `x-platform-request: 1` ; veille : `GET /api/runs/:id` (`state`, `pendingQuestion`, `pendingPermission`) ; réponse : `POST /api/runs/:id/answer {action:'accept', content:{…selon requestedSchema}}` ; annulation : `POST /api/runs/:id/cancel`. Scripts du soir dans le scratchpad de la session précédente (non versionnés) : `lancer-*.py`, `attendre-mission.py`, `repondre-c3.py`.
- Relancer l'API : annoncer, Ctrl-C dans l'onglet c1, relancer la commande du §3, attendre `GET /api/runs` 200. Le relais survit à l'API.
- Vérifier une mission : `node .manager/outils/bilan-vs-events.mjs <préfixe d'id>` (lecture seule, hôtes seulement).
- Suite complète : `npm test && npm run check && npm run format:check` (4-5 min, 138 tests Chrome locaux) ; jamais pendant une mission navigateur.
- Heures : `date +%H:%M` ; base en UTC (+11 h).

## 9. Pièges rencontrés ce soir

- Test unitaire vert mais défaut réel (E13) : la passerelle MCP ne transmettait pas l'option ; tester par `connectMcp` (voir `tests/career-optional-files.test.js`).
- Trois consignes de Relay se contredisaient sur la façon de poser une question (navigateur, règle de doute, instructions career-ops) : vérifier `grep -rn "dans summary" packages/` après toute modification de consigne.
- Le sous-agent commite dans le même arbre : ses `git add` + `commit` peuvent emporter un fichier que le manager vient d'indexer ; commits par chemins explicites des deux côtés.
- Mission navigateur pendant la suite Chrome : 11 captures en échec d'affilée (E23).
- `.manager/reports/registre-erreurs.md` est aussi écrit par le collecteur (relevé automatique) : le commiter régulièrement avec les rapports.
