# Registre des erreurs Relay

Ouvert le 03/11/2026 à 18:32 (heure du Mac). Dossier `~/Downloads/agregat-back-astra`, branche `suite-astra`.

Deux parties :
- **Erreurs analysées** : une ligne par défaut, avec sa preuve et son degré de certitude. Tenue par le manager.
- **Relevé automatique** : ajouté par `.manager/registre-erreurs.py`, qui lit `.data/platform.sqlite` en lecture seule. Chaque ligne reprend le message tel que Relay l'a enregistré, sans interprétation. Les adresses sont réduites à leur domaine. Le relevé peut contenir des requêtes de recherche : à relire avant tout commit.

Degrés de certitude :
- **Constaté** : vu dans la base ou en direct, avec le numéro de mission.
- **Lu dans le code** : déduit de la lecture du code, pas encore reproduit.
- **Rapporté** : vient d'une passation ou d'un rapport, non revérifié ici.

## Erreurs analysées

| N° | Défaut | Degré | Preuve | Cause | État |
|---|---|---|---|---|---|
| E1 | Faux « offre notée sans lecture » sur SEEK | Constaté | 337bc659 (Claude) : 3 offres lues sous `au.seek.com/job/<n>`, enregistrées sous `www.seek.com.au/job/<n>`, mêmes numéros. | Relay compare domaine et chemin, et la même offre a deux adresses. Que ce soit une redirection est déduit, pas observé. | Ouvert |
| E2 | Date `fetchedAt` inventée, dans le futur | Constaté pour Claude | 337bc659 : `fetchedAt` de 10:00 à 10:10 UTC pour des enregistrements faits à 07:15-07:16 UTC, soit 3 h d'avance. Gemini : non revérifié. | L'agent fournit la date. Que Relay ne la contrôle pas vient de la lecture du code. | Ouvert |
| E3 | Bilan contradictoire | Constaté | 337bc659, **e85f255e (04/11)** (« Non exécuté : aucune action demandée identifiable comme manquante » puis « Mission incomplète ») : « Actions échouées : aucune observée » et « Non exécuté : aucune action demandée », alors que la mission échoue en « Mission incomplète ». | Découle en partie d'E1. Le Bilan ne reprend pas le contrôle de fin de mission (déduit). | Ouvert |
| E4 | Mission « terminée » alors que l'agent attend une réponse | Constaté | 3e8d6eab (Claude) : état `completed`, et le résumé dit « je préfère vérifier avec toi ». | Relay n'a pas d'état « attend une réponse », et l'elicitation ACP n'est pas implémentée. | Ouvert |
| E5 | Commande native lancée hors du dossier de mission | Constaté | 0c7664fe (Gemini, dossier career-ops) : `git merge` exécuté et terminé dans `agregat-back-astra`, puis `npm test` lancé. Le prompt est masqué (mission privée) : on ne sait pas s'il demandait ces commandes. | Les commandes natives ne sont pas confinées au dossier de mission. | Ouvert, votre accord est requis |
| E6 | Appels `google_web_search` de Gemini sans fin | Constaté en partie | Sur toutes les missions, 33 appels, dont 6 sans état final et 0 en échec. La part due à des missions annulées n'est pas vérifiée. | Inconnue | À reproduire |
| E7 | `career_read` trop volumineux pour Claude | Constaté | 3e8d6eab, 337bc659 : « result (58 704 / 84 103 characters) exceeds maximum allowed tokens ». Claude enregistre la sortie dans un fichier et doit la relire. | Le résultat de l'outil n'est ni découpé ni paginé (déduit). | Ouvert, trouvé par le relevé |
| E8 | Outils de Gemini refusés | Constaté | 0c7664fe : « Path not in workspace » sur un rapport d'`agregat-back-astra`. 7c7edcfb : « params must have required property 'url' ». f5eccbce : `data/pipeline.md` « ignored by configured ignore patterns ». | Restrictions de Gemini CLI et appels mal formés. Effet sur la mission non mesuré. | À analyser |
| E9 | Mission arrêtée par le délai de 120 s pendant une commande longue | Constaté | 0c7664fe : « Outil sans mise à jour depuis 120 s ; relancer. » pendant `npm test`. | Le délai s'applique aux commandes longues qui n'émettent rien. | Ouvert |
| E10 | Point de reprise sans l'objectif de départ | Rapporté | Passation du 02/11. Non reproduit. | — | À reproduire |
| E11 | Téléchargement chargé entièrement en mémoire | Rapporté, lu dans le code | Passation du 02/11. Non reproduit. | — | À reproduire |
| E12 | Erreur DNS « incertaine » sur la démo | Constaté par le propriétaire | Collage du 02/11 (`jobs.example.test`). Non revérifié dans la base. | — | À reproduire |
| E13 | `career_read` échoue sur `data/blacklist.md` absent | Constaté | e85f255e (Claude, 04/11 14:46) : « ENOENT: no such file or directory, open '…/data/blacklist.md' ». Effet sur la mission non mesuré. | Le fichier n'existe pas dans le dépôt career-ops ; que `career_read` doive le tolérer est à décider (non lu dans le code). | Ouvert, trouvé par le relevé |
| E14 | Scan obligatoire sauté sur un prompt qui ne dit pas « sans scan » | Constaté | e85f255e (Claude sonnet, P1) : prompt « Va voir les offres sur Remotive… », 0 appel navigateur, 2 `jobs_search_live`, aucun `career_script scan`, aucune question posée ; Relay termine `failed` « Mission incomplète : Scanner les portails du Skill (non exécutée) ». L'agent justifie : Remotive est servi par `jobs_search_live`, « tu as explicitement demandé Remotive ». | Couche en cours d'analyse (étape 3 du cycle 1). | Ouvert |
| — | Codex bloqué jusqu'au 06/11 à 12:54 | Constaté | 61c537c8, ff434d28, 17336e55 : « Limite d'usage de Codex atteinte ». | Limite du compte, pas un défaut de Relay. | Hors Relay |

## Relevé automatique

| Heure (Mac) | Mission | Agent | Nature | Outil ou commande | Message enregistré |
|---|---|---|---|---|---|
| 03/11 13:51:40 | 0c7664fe | gemini | Outil en échec | "" | Path not in workspace: Attempted path "/Users/diaw/Downloads/agregat-back-astra/.manager/reports/passation-02-11.md" resolves outside the allowed workspace directories: [secret masqué] or the project temp directory: [sec… |
| 03/11 13:52:57 | 0c7664fe | gemini | Événement agent_silent |  | {"elapsedMs":60000,"stopped":false} |
| 03/11 13:53:57 | 0c7664fe | gemini | Mission failed |  | Outil sans mise à jour depuis 120 s ; relancer. |
| 03/11 13:53:57 | 0c7664fe | gemini | Outil sans état final | cd /Users/diaw/Downloads/agregat-back-astra && npm test && npm run check && npm run format:check | mission failed |
| 03/11 14:03:43 | 17336e55 | codex | Événement agent_diagnostic |  | {"text":"[SYSTEM_ERROR] Prompt for session 01a19f5c-c564-78b2-81a5-a98c6d8bdb61 failed: RequestError: Internal error\nRequestError: Internal error\n at _RequestError.internalError (file:///Users/diaw/Downloads/agregat-ba… |
| 03/11 14:03:43 | 17336e55 | codex | Mission failed |  | Limite d’usage de Codex atteinte : réessayer à Nov 6th, 2026 12:54 PM. Choisir un autre agent ou attendre. |
| 03/11 14:05:01 | 7c7edcfb | gemini | Outil en échec | scan | MCP tool 'career_script' reported tool error for function call: {"name":"career_script","args":{"command":"scan"}} with response: [{"functionResponse":{"name":"career_script","response":{"content":[{"type":"text","text":… |
| 03/11 14:05:21 | 7c7edcfb | gemini | Outil en échec | "" | params must have required property 'url' |
| 03/11 14:06:08 | 7c7edcfb | gemini | Mission failed |  | Mission incomplète : Scanner les portails du Skill (échouée) |
| 03/11 15:42:02 | f5eccbce | gemini | Outil en échec | "" | File path '[secret masqué]/data/pipeline.md' is ignored by configured ignore patterns. |
| 03/11 15:55:50 | bc5e0d4e | gemini | Événement agent_silent |  | {"elapsedMs":60000,"stopped":false} |
| 03/11 18:05:29 | 3e8d6eab | claude | Outil terminé avec erreur | mcp__platform__career_read | Error: result (84,103 characters across 1 line) exceeds maximum allowed tokens. Output has been saved to /Users/diaw/.claude/projects/-Users-diaw-Downloads-agregat-career-ops/5ce6b5d7-820b-466a-b4a8-a2b32e4f51a9/tool-res… |
| 03/11 18:12:49 | 337bc659 | claude | Événement agent_silent |  | {"elapsedMs":60000,"stopped":false} |
| 03/11 18:13:24 | 337bc659 | claude | Outil terminé avec erreur | mcp__platform__career_read | Error: result (58,704 characters across 1 line) exceeds maximum allowed tokens. Output has been saved to /Users/diaw/.claude/projects/-Users-diaw-Downloads-agregat-career-ops/0104f69a-00c5-48bf-827b-d5f2d131e744/tool-res… |
| 03/11 18:14:17 | 337bc659 | claude | Outil terminé avec erreur | mcp__platform__career_read | Error: result (84,103 characters across 1 line) exceeds maximum allowed tokens. Output has been saved to /Users/diaw/.claude/projects/-Users-diaw-Downloads-agregat-career-ops/0104f69a-00c5-48bf-827b-d5f2d131e744/tool-res… |
| 03/11 18:16:54 | 337bc659 | claude | Mission failed |  | Mission incomplète : 3 offre(s) notée(s) sans lecture de leur page |
| 03/11 19:16:54 | b8a90e96 | gemini | Outil en échec | "" | File path '[secret masqué]/data/pipeline.md' is ignored by configured ignore patterns. |
| 03/11 19:17:02 | b8a90e96 | gemini | Outil en échec | "" | File path '[secret masqué]/portals.yml' is ignored by configured ignore patterns. |
| 03/11 19:17:25 | b8a90e96 | gemini | Outil en échec | "" | params must NOT have additional properties |
| 03/11 19:19:25 | e4ca455c | gemini | Mission failed |  | Mission incomplète : Scanner les portails du Skill (non exécutée) |
| 03/11 19:19:55 | aed2c28a | gemini | Outil en échec | "" | File path '[secret masqué]/data/pipeline.md' is ignored by configured ignore patterns. |
| 03/11 19:22:03 | fe12d570 | gemini | Mission failed |  | Mission incomplète : Scanner les portails du Skill (non exécutée) |
| 04/11 14:46:17 | e85f255e | claude | Outil en échec | mcp__platform__career_read | ``` ENOENT: no such file or directory, open '[secret masqué]/data/blacklist.md' ``` |
| 04/11 14:46:52 | e85f255e | claude | Mission failed |  | Mission incomplète : Scanner les portails du Skill (non exécutée) |
