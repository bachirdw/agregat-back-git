# Nuit du 12 au 13/11 — suite (greffier-12-11)

Heures de Sydney (UTC+11). Aucune donnée personnelle ; hôtes et chemins génériques seulement. Aucun fichier de code ni de test modifié par le greffier.

## (a) Journal du greffier
- 23:48 Attente de `missions-finies` : la commande `timeout` n'existe pas sur ce Mac (code 127), remplacée par une boucle zsh bornée ; le fichier existait déjà.
- 23:48 `git status` : seul `carte-envoi-etude-01.md` non suivi. 12 commits de la nuit depuis eb421a0 (voir b).
- 23:48 -> 23:59 Suite complète lancée une fois (voir e).
- 23:59 API 4313 relancée sur le code final (9dacd5e), `/api/runs` = 200. Page fictive 4321 déjà en marche, compteur avant = 6 envois.
- 23:59:34 Essai fictif 1 (Claude, Skill) ; 00:03:18 essai fictif 2 (Codex, libre). Aucune carte approuvée par le greffier : l'outil n'accorde que vers 127.0.0.1.
- 00:05 Lecture de `essais-nuit.log` et de la base en lecture seule (mode=ro). Rédaction du rapport et de la section 12 de la passation.

## (b) Sprints
**audit-suite-02** (rapport `audit-suite-02.md`) : c38ef4b, e8c5207, d8bbb5a, 044fefa, 37c4ee0, 45b8a56.
- Corrigé : A10 (mode workflow : la carte d'envoi suspend la garde et le tour de l'étape jusqu'au clic) ; routeur du Skill (négation arrêtée à « et », « mais », « puis », ponctuation, deux-points) ; Bilan (avec intention choisie, rédaction due seulement si une étape obligatoire prouve un document) ; passerelle (écriture tardive vers un chemin de soumission après un clic `candidate`, même page, même site, attend la carte) ; test fragile du faux exécutable muet (attente bornée du fichier PID).
- Tests : audit-suite-02-workflow-send (2), -negation-intention (2), -bilan-cv-joint (3), -envoi-tardif (3, contexte Playwright fictif) ; un test existant modifié (browser-gateway, point 3, autorisé).
- Écarts au brief : `timeout` absent (boucle zsh) ; première approche A10 (`actionClass` dans la fixture ACP) abandonnée, SDK ACP retire les champs hors schéma ; rouge du point 3 montré par un fichier temporaire supprimé.
- Points ouverts : pause du délai `prompt` (600 s) non testée ; 2c prouvé sans vrai Chrome, trou identique pour clics `plain`/`widget` non établi ; `truth.js` n'arrête pas la négation aux deux-points ; ligne « CV du Skill : non produit » conservée (exacte).

**review-audit-suite-02** (`review-audit-suite-02.md`) : a8e4059, 017e8f2.
- Rouge du codeur rejoué : 5 échecs sur 10, ceux annoncés. Défaut moyen corrigé : la garde d'étape était suspendue par un drapeau sans compteur, deux attentes ouvertes (deux cartes) la relançaient au premier clic -> `agent_silent`. Désormais `stepControl` compte ses attentes.
- Tests : 2 (A10 deux cartes, rouge avant ; 2c non-régression, déjà vert avant 044fefa).
- Points ouverts : la règle tardive 2c dure jusqu'à la prochaine action qui remet le clic à zéro (peut ajouter des cartes /messages, /comments, côté sûr, non observé en réel) ; clics plain/widget non traités ; pause du délai `prompt` non testée. Rapport .md non formaté par prettier (hors périmètre de format:check).

**contrat-agents-01** (`contrat-agents-01.md`) : 5648a21, 03e7102.
- Corrigé : un seul lecteur des appels d'outils (`packages/orchestrator/tool-call.js`) pour Claude et Codex ; Codex : titres `mcp.platform.*` non reconnus par le canal ACP (issues, preuves, rapport reports/, note, CV joint), `NativeActions` comptait « 1 commande » par appel de passerelle ; `permissionToolName` aligné (Claude affiche maintenant le nom nu, comme Codex).
- Tests : `contrat-agents.test.js` (13), fixtures FICTIVES `acp-shapes/claude.json` et `codex.json` (8 cas chacune). Rouge 8/13 avant correctifs, 13/13 après.
- Écarts : 8e cas `gateway_upload` ajouté ; cas « construit » ou « reconstruit » signalés (natif jamais clos côté Claude, question côté Codex, forme de la demande de permission non journalisée) ; `permissionToolName` exporté ; pas de fixture Gemini ni OpenCode.
- Points ouverts : changement visible de `permissionToolName` pour Claude (outil hors dépôt `bilan-vs-events.mjs` non vérifié par le codeur) ; `answerOf` ne lit que `rawOutput.content` ; ordre de lecture titre avant `rawInput.name` (adaptateur inconnu non prouvé) ; Gemini n'émet aucun `rawInput`, noms OpenCode dépendants du registre.

**review-contrat-agents-01** (`review-contrat-agents-01.md`) : d5a8c46, 9dacd5e.
- Défaut moyen M1 corrigé dans `career-ops/truth.js` : un échec de la passerelle vu par l'ACP et par la passerelle comptait deux fois (Bilan Codex « 2 échecs » au lieu de 1). Maintenant maximum des deux canaux. Test : 1 (rouge avant, `failures: 2`).
- Points ouverts : `bilan-vs-events.mjs` reconnaît les noms nus mais pas les titres Codex `mcp.platform.*` (outil hors dépôt, non modifié) ; `permissionToolName` réduit au nom nu pour tout serveur MCP (sans effet, un seul serveur `platform`) ; `answerOf` sans effet (la passerelle répond `basename(args.path)`) ; points 3 et 4 du codeur toujours ouverts. Base lue en lecture seule, comptes seulement.

## (c) Étude `carte-envoi-etude-01.md` (non commitée avant ce commit ; RIEN N'EST APPLIQUÉ)
Corpus : 26 cas du registre et des audits (C1 à C25, A7 compté deux fois) ; 41 événements `permission` réels du 09 au 12/11 : 23 cartes justes (envoi final sur la page fictive 127.0.0.1:4321), 18 fausses cartes (toutes LinkedIn : E89, E93, E100), 0 envoi réel. Une carte manquante ne laisse aucun événement.

| Règle | Justes | Fausses cartes | Envois sans carte |
|---|---|---|---|
| Actuelle | 21 | 1 | 4 |
| R1 | 22 | 0 | 4 |
| R2 | 22 | 2 | 2 |
| R3 (l'agent appelle `browser_submit`) | 24 | 2 | 0 |
| R3 (l'agent n'appelle pas l'outil) | 21 | 2 | 3 |

Recommandation de l'étude : abandonner R1 seule ; viser R3 avec R2 en filet, en gardant l'exception d'étape par libellé entier et la fenêtre de téléversement ; préférer la carte à la retenue pour un geste portant une saisie tant que l'obéissance des agents n'est pas mesurée ; premier pas réversible : mode d'observation `AGENT_PLATFORM_CARD_SHADOW=1`, désactivé par défaut, qui journalise les désaccords sans rien changer ; mesurer en réel avant de trancher. Les fausses cartes de R2 et R3 (C7, C20) et les ordres de grandeur de code sont des jugements ou estimations.

## (d) Missions de la nuit (Sydney)
| Heure | Mission | Agent | Demande | Issue |
|---|---|---|---|---|
| 12/11 21:57 | a0337667 | Claude | SEEK, lecture seule, noter offres | completed, 617 s ; 0 carte (42 `permission_auto`) ; 3 `agent_silent` non arrêtés ; 0 `tool_stalled`/`tool_released` ; aucun outil échoué |
| 12/11 22:07 | 1e1aa894 | Claude | LinkedIn puis Indeed, lecture seule | completed, 698 s ; 0 carte (103 `permission_auto`) ; 2 `agent_silent` non arrêtés ; `browser_click` : 3 réussis, 1 échoué |
| 12/11 22:19 | eca196f2 | Codex | SEEK, lecture seule, noter offres | completed, 604 s ; 0 carte (80 `permission_auto`) ; 1 `agent_silent` non arrêté ; `career_write` : 14 réussis, 1 échoué |
| 12/11 23:59 | 8c073dbc | Claude (Skill) | candidature FICTIVE 3 étapes, CV joint | completed, 205 s ; 1 carte vers 127.0.0.1/<chemin> POST, 3 champs sur 3, accordée par l'outil fictif ; envoi : 1 approuvé ; compteur /count 6 -> 7 |
| 13/11 00:03 | 102a5ff9 | Codex (libre) | candidature FICTIVE sans CV | completed, 70 s ; 1 carte, même cible ; envoi : 1 approuvé ; /count 7 -> 8 |

Bilan, mission par mission (extraits recopiés) :
- a0337667 : « Étapes du Skill : Scanner les portails (non exécutée) ; Indexer les offres retenues dans Relay (facultatif) (faite) ; Ajouter à data/pipeline.md (ignorée) ». « Non exécuté : aucune action demandée identifiable comme manquante ». « Envoi par la plateforme : aucun approuvé. Requêtes réseau d'envoi : 8 accordées automatiquement (mode propriétaire). »
- 1e1aa894 : mêmes étapes du Skill ; « Envoi : aucun approuvé. Requêtes réseau d'envoi : 55 accordées automatiquement. »
- eca196f2 : étapes : scan (non exécutée), indexation (ignorée), pipeline (ignorée) ; « Envoi : aucun approuvé ».
- 8c073dbc : « Étapes du Skill : Ouvrir le formulaire (faite) ; Préparer les champs (faite) ; Produire le PDF du CV adapté (ignorée) ; Joindre le CV adapté (faite) ; Relire les valeurs saisies (faite) ; Relire avant soumission (faite). Écart d'ordre : aucun. Envoi par la plateforme : 1 approuvé(s) par le propriétaire. Actions natives : 2 commandes. »
- 102a5ff9 : « Affirmations de l'agent : non vérifiées. Envoi par la plateforme : 1 approuvé(s) par le propriétaire. » (pas de ligne d'étapes du Skill en mode libre).
Aucune erreur ni verdict « Mission incomplète » sur ces cinq missions. Toute carte des essais réels de lecture avait été refusée automatiquement ; il n'y en a eu aucune (0 `permission`).

## (e) Suite de contrôle (23:48 -> 23:59, code 9dacd5e)
- `npm test` : EXIT 0. Unitaires et intégration : tests 1116, pass 1114, fail 0, skipped 2. Chrome réel : tests 225, pass 225, fail 0, skipped 0.
- `npm run check` : « Syntaxe JavaScript valide ».
- `npm run format:check` : « All matched files use Prettier code style! ».
- Journal : scratchpad, `suite-greffier.log`.

## (f) À trancher par le propriétaire
- Étude de la carte d'envoi : abandonner R1 seule ? viser R3 + R2 ? activer d'abord le mode d'observation `AGENT_PLATFORM_CARD_SHADOW=1` ?
- Clics `plain`/`widget` suivis d'une écriture tardive vers un chemin de soumission : sans carte aujourd'hui ; étendre ferait pleuvoir les cartes.
- Règle 2c : durée jusqu'à la prochaine remise à zéro du clic plutôt que 8 s ; garder, resserrer ?
- A7 (« Oui » d'une modale hors formulaire) et écriture au-delà de 8 s : envois sans carte restant ouverts selon l'étude.
- `truth.js` n'arrête pas la négation aux deux-points (« Ne soumets pas : postule... ») ; non demandé, non touché.
- Ligne « CV du Skill : non produit » conservée dans le Bilan (exacte) ; la garder ?
- Pause du délai `prompt` (600 s) de l'étape workflow : aucun test.
- `permissionToolName` Claude change de forme (nom nu) ; l'outil hors dépôt `bilan-vs-events.mjs` ne reconnaît pas les titres Codex `mcp.platform.*`.
- Ordre de lecture titre / `rawInput.name` pour un adaptateur inconnu ; `answerOf` ne lit pas le résultat réel.
- Gemini et OpenCode : pas de fixtures, il faudrait une mission réelle journalisée de chacun.
- Jamais fait : clic réel du propriétaire sur un vrai site ; envoi réel mesuré sur SEEK, LinkedIn, Greenhouse, Workday.

## (g) Non vérifié
- Aucune des corrections de la nuit sur un vrai site ni avec le Chrome du propriétaire ; 2c prouvé seulement avec un contexte Playwright fictif.
- Forme réelle d'un envoi final (corps, compression, WebSocket) ; obéissance des agents à un outil `browser_submit` (jamais essayée) ; WebSocket en iframe via le vrai relais.
- Les durées des sprints, les rouges/verts des codeurs et relecteurs sont repris de leurs rapports ; le greffier n'a rejoué que la suite complète et les deux essais fictifs.
- Noms des outils échoués : repris du Bilan ; l'extraction par la base n'a pas isolé de nom d'outil échoué (cause non établie : structure des événements non explorée plus loin).
- Heures de `permission_auto` et cibles : seul le compte a été relevé.
