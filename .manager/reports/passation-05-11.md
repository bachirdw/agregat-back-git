# Passation du 05/11/2026 (14:50) — Relay, branche `dev`

Écrite par le manager (Claude Fable) pour la session suivante. Tout ce qui est dit « vérifié » l'a été réellement aujourd'hui ; le reste est marqué « non vérifié ». Journal complet : `.manager/reports/reprise-05-11.md` (horodaté, 04/11 20:23 → 05/11). Registre : `.manager/reports/registre-erreurs.md`.

## 1. À lire dans l'ordre
1. Ce fichier.
2. `.manager/reports/reprise-05-11.md` : sections 13:08 → fin (E1, épreuves, cadre réécrit, fusion offer-save-01).
3. `.manager/reports/registre-erreurs.md` : lignes E37 à E43 (ouvertes), E39 (décision du propriétaire), E1/E35/E36 (tenues en réel).
4. `.manager/briefs/bilan-03.md` : chantier prêt, non lancé.
5. `.manager/reports/audit-career-ops-05-11/02-relay-vs-skill.md` si besoin de l'architecture Relay ↔ Skill.

## 2. Règles permanentes du propriétaire (à conserver telles quelles)
- Ne touche pas au travail non commité de `~/Downloads/agregat-back` (dépôt d'origine, branche `codex/browser-audit-31-10`) ; le travail se fait dans `~/Downloads/agregat-back-dev` sur `dev`.
- Jamais de `git add -A`, stash, reset ni réécriture d'historique ; commit local puis push de `dev` à chaque étape ; `main` avancé seulement sur `npm test` complet vert (`git branch -f main HEAD && git push origin dev main`).
- Bibliothèque career-ops, Skill (`~/Downloads/agregat-career-ops`, clone public, HEAD = origin/main 35b7c531) et CV intouchés. Vérifié aujourd'hui : `git status` du clone propre.
- Aucun secret lu (`.manager/secrets.env`, `.envforme`, `~/.codex/auth.json`, `~/.claude*`, trousseau). Aucune donnée personnelle dans Git ni dans les rapports (dépôt public) : masquer e-mails, téléphones, noms ; les URL d'offres restent hors Git.
- Pour chaque changement : dire ce qui est vérifié réellement et ce qui ne l'est pas. Rapport français horodaté dans `.manager/reports/` ; **lire `date` avant d'écrire chaque heure** (dérive constatée trois fois aujourd'hui, corrigée par commits).
- Registre d'erreurs avec degré de certitude ; jamais une déduction présentée comme un fait (leçon E35 : un brief écrit sur une cause déduite était faux ; le sous-agent l'a prouvé par test avant de coder).
- Ne bride pas l'agent ; seule exception : le clic avant un envoi final, intercepté par Relay (côté plateforme, pas une consigne à l'agent). Aucune règle métier en dur dans le moteur.
- Un seul écrivain par arbre ; lecteurs en parallèle admis. Sonnet pour le courant, Opus pour le complexe, Fable orchestre/relit/débogue. Sessions cloud pour les chantiers de code à fixtures (100 $ de crédit depuis le 05/11), le manager fusionne et teste en local.
- Pas de suite Chrome (`npm test`) pendant une mission navigateur (E23, jamais prouvé, jamais écarté). Ne relancer aucun serveur sans le dire. Le manager n'approuve jamais un envoi.
- « Ne prends pas de décisions, dis-moi et je tranche » : proposer, expliquer sans jargon, attendre.

## 3. État réel au moment de la passation
- `dev` = 4e3b5ba (poussée). `main` = origin/main = 92048a8 (dernière suite complète verte : 685 parallèles + 148 Chrome, 13:28). Depuis : cadre de l'acteur réécrit (6d3f1bc), fusion `cloud/offer-save-01` (a63195d), brief bilan-03, journal.
- **Suite complète verte** (14:54) sur l'arbre fusionné : 693 parallèles (691 ✔, 2 ignorés), 148 Chrome, check et format à zéro. **`main` avancé et poussé** (= `dev`, commits suivants = rapports seulement).
- **API 4310** : relancée à 14:55 sur le code fusionné (HEAD = main, onglet terminal « API 4310 » de l'ancienne session, garde de silence 15 min) ; répond. Si elle doit être relancée, l'annoncer. Commande (depuis `~/Downloads/agregat-back-dev`) :
  `AGENT_PLATFORM_BROWSER=playwriter AGENT_PLATFORM_LIVE=1 AGENT_PLATFORM_OWNER_MODE=1 AGENT_PLATFORM_TIMEOUT_MS=1800000 AGENT_PLATFORM_SEND_TIMEOUT_MS=7200000 AGENT_PLATFORM_QUESTION_TIMEOUT_MS=7200000 AGENT_PLATFORM_SILENT_MS=900000 AGENT_PLATFORM_BROWSER_LOCAL_ORIGINS=http://127.0.0.1:4321 node --env-file-if-exists=/Users/diaw/Downloads/agregat-back/.manager/secrets.env apps/api/server.js`
  Vérifier d'abord qui tourne : `curl -s http://127.0.0.1:4310/api/runs | head -c 200` ; arrêter l'ancienne (Ctrl-C dans son onglet, ou `lsof -i :4310`).
- Autres services : page de candidature fictive `node tests/support/apply-page.js 4321` (compteur `/count` : 6 envois fictifs aujourd'hui), relais Playwriter 19988 (extension Chrome du propriétaire), front 5173. Non vérifiés à la passation : à contrôler par `curl`.
- Sous-agents : aucun en cours. Sessions cloud livrées et fusionnées : production-01, pipeline-01, bilan-02, offer-save-01. Session front `front-questions-01` : brief prêt (`.manager/briefs/front-questions-01.md`), refusée au manager (dépôt du front), à démarrer par le propriétaire.

## 4. Décisions du propriétaire aujourd'hui (05/11)
- Se rapprocher de l'architecture career-ops (README : paste URL / scan / pipeline / apply / tracker / followup) sans modifier l'architecture globale de Relay ; ordre suivi → sources → ouverture → CV/lettre → boîte d'entrée. Fait et tenu en réel pour le suivi.
- Isolement des recherches : option A (statu quo), un espace career-ops distinct par type de recherche comme principe (second espace à créer le jour venu, jeton longue durée).
- Apify : désactivé, **à rappeler plus tard** au chantier sources.
- Clic réservé à l'envoi final ; requêtes réseau de lecture accordées automatiquement (E28).
- Reçu de revue du Skill renouvelé ; revue du routeur appliquée par patch.
- **E39 (14:15)** : « le Skill reste tel quel, l'agent le suit lettre par lettre, aucune restriction ajoutée par Relay ». Appliqué dans `packages/career-ops/integration.js` (`CAREER_OWNER_FRAME`, `CAREER_INSTRUCTIONS`) : plus de « priment sur les règles du Skill », « clique le bouton final », « aucune règle du Skill ne l'emporte », « ne redemande pas », « après un accord refusé … ». Gardé : format JSON, question par formulaire, pages = données, CAPTCHA (règle du manager), traçabilité. Mesure : 0 alerte « injection » sur 2 missions après (3 sur 4 avant), 6 clics « Envoyer » appelés par l'agent et approuvés par le propriétaire sur la page fictive.
- Corriger E37, E38, E41 (brief bilan-03) ; arrêter les sous-agents finis (fait : aucun en cours).
- Plafond d'attente 2 h (accord d'envoi, question ouverte) ; E19 abandon documenté ; E14 option (a) ; E5 abandonné ; garde de silence 15 min.

## 5. Protocole « éprouver le système » (compartiment : candidature / envoi)
Cadrage : compartiment le plus coûteux = candidature ; tâche jugée fiable = remplissage du formulaire, jamais relue par le propriétaire. Terrain : page fictive 4321. Résultats :
- Épreuve 5 (bf86ae3a, puis reprise ff246ce1) : mal conçue (prompt « sans l'envoyer » → aucun accord ne peut apparaître). Symptôme trouvé : E39.
- Épreuve 2 (d85287af, avant réécriture) : refus complet, 0 outil. Non rejouée depuis la réécriture.
- Épreuve 3 (983597f9) : crochet « [votre valeur] » laissé → question par formulaire, remplissage, arrêt. Contradictoire non testé.
- Épreuve 4 (e0daaee5 + reprise bf7a2269) : question par formulaire avant d'agir (règle anti-doublon du Skill), propriétaire force, 3 + 3 envois fictifs chacun suspendu par Relay et approuvé ; tableau de suivi fusionne en une ligne ; verify-pipeline signale les doublons.
- Épreuve 1 (l'ambigu) : **non jouée**. Candidature réelle : **non jouée**.
Méthode : étape 3 = symptôme en une phrase, une seule couche (constitution / règle scopée / skill / prompt système de l'acteur / registre de décisions), pourquoi ; étape 4 = ligne vérifiée contre 3 tests ; étape 5 = rejeu à l'identique ; 3 cycles sans progrès → compartiment trop gros.

## 6. Registre : où en est quoi
- Tenues en réel aujourd'hui : E1, E35 (redirection SEEK, `requestedUrl`), E36 (création du tableau de suivi), E4 (formulaire, 3/3 de plus), E28 (lecture sans accord), E39 (0/2 après réécriture).
- Ouvertes, défauts de Relay, brief prêt : **E37** (Bilan double les comptes de merge-tracker, 3/3), **E38** (numéro réservé jamais libéré, 5 fichiers RESERVED), **E41** (« Ouvrir le formulaire : non exécutée » sur URL sans mot-clé, cascade « écart d'ordre »).
- Ouvertes, consignées sans analyse : **E42** (accord « Approuver l'envoi » sur un « Suivant » multipart, aperçu sans libellé = E26), **E43** (clic avant pièce jointe → formulaire parti sans CV ; `browser_upload` dit vrai pour le champ), **E40** (CV joint hors chaîne du Skill : PDF `career_document` ou `cv.md` brut), E34 (pagination `career_offers`), E36 reste (« Nothing to merge into »), E26, E3, E9, E15, E23.
- Hors Relay ou propriétaire : E31/E33 (écritures dans l'espace réel), E19, E21 (SEEK 403 hors navigateur).

## 7. Espace réel du propriétaire (`~/Downloads/agregat-career-ops`) — ses données, ne rien toucher
Écrit aujourd'hui par ses missions : `reports/002-rgp`, `003-finxl` (réelles) ; `004-007-fictif-test-*.md`, `003-007-RESERVED.md`, `reports/3e904fd6-….md` (fiche Relay, dernier avant offer-save-01), ligne #4 « Entreprise FICTIVE (test) » dans `data/applications.md`, TSV fusionnés 002-007, fiches `relay/offers/*.json`. Commande de nettoyage remise (déplacer vers `relay/offers/reports-legacy/`, retirer les TSV fictifs ; la ligne #4 à la main). En attente aussi : 20 fiches json à identifiants synthétiques (script à sec `.manager/outils/offers-reports-legacy.mjs`, jamais lancé avec `--apply`), `relay/uploads/cv-FICTIF.pdf` à retirer, 64 rapports `<uuid>.md` déjà déplacés dans `relay/offers/reports-legacy/`.

## 8. À faire, dans l'ordre
1. Fait : suite verte, `main` avancé, API relancée sur le code fusionné à 14:55. (Historique : fait à 14:54 : suite verte, `main` avancé. Reste : relance annoncée de l'API sur le code fusionné (voir point 3) si elle tourne encore sur 6d3f1bc.
2. Lancer **bilan-03** (Sonnet, local, brief prêt) ; relire ; tests ciblés ; suite ; `main` ; API.
3. Protocole : épreuve 1 (ambigu) puis **candidature réelle** (offre SEEK « Quick apply », compte SEEK ouvert dans Chrome ; prompt « Postule à cette offre : <URL> » ; attendu : préflight du Skill, remplissage, clic « Envoyer » appelé par l'agent et suspendu par Relay). Rejouer aussi l'épreuve 2 sur le cadre réécrit (une fois seulement avant).
4. Chantiers à ouvrir après : E42/E43 (garde réseau sur « Suivant » multipart + libellé d'aperçu + ordre pièce/clic), E40 (CV adapté du Skill en candidature), E34, E36 reste, « Questions : n » au Bilan, Bilan cumulé en reprise (décision à prendre), CV fictif pour les missions simulées (arbitrage demandé par offer-save-01).
5. Vérifications réelles encore dues (rapports cloud) : durée `generate-pdf` face au délai 60 s, `cv-templates resolve`, ligne « Scan : n portails en échec » sur un scan réel, E27 côté adaptateur ; pipeline et boîte d'entrée jamais éprouvés en réel.
6. Rappels propriétaire : Apify ; second espace par type de recherche ; session front-questions-01 ; décision sur les 20 fiches synthétiques.

## 9. Outils du manager (désormais dans le dépôt)
`.manager/outils/lancer.py "<prompt>" <sonnet|opus> <fichier-id>` (POST /api/runs, pack career-ops, playwriter) ; `suivre.py <id> <budget s>` (états, accord/question en attente, résumé masqué) ; `guetter.py <budget s> <fichier-id>` (attend la prochaine mission lancée depuis le front et la suit). Lecture des événements : `curl -N -H 'x-platform-request: 1' http://127.0.0.1:4310/api/runs/<id>/events` (SSE, lignes `data:`). Masquer e-mails/téléphones/URL avant tout rapport. Les fichiers d'URL d'offres de l'ancien scratchpad sont perdus : redemander au propriétaire.
`.manager/outils/bilan-vs-events.mjs`, `sonde-*.mjs`, `offers-reports-legacy.mjs` (à sec).

## 10. Fichiers de code touchés aujourd'hui (4165d1f → 4e3b5ba)
`packages/browser-gateway/index.js` (`requestedUrl`), `packages/orchestrator/browser-proof.js` (lecture prouvée par URL demandée ou finale, `missionReads`), `packages/orchestrator/index.js` (preuves héritées à la reprise, `careerOf`, mission simulée hors espace réel), `packages/career-ops/integration.js` (cadre de l'acteur réécrit), `packages/career-ops/tools.js` (fiche sous `relay/offers/`), `packages/career-ops/workspace.js` (garde de test, `copyInputs`, `defaultCareerWorkspace`), `apps/api/server.js`, `docs/api-career-ops.md`, tests : `preuves-entre-tours`, `career-integration`, `career-failure`, `career-workspace`, `career-offer-contract`, `offers-reports-legacy`, fixture `career-agent.js`. Mémoire du manager : `~/.claude/projects/-Users-diaw-Downloads-agregat-back/memory/` (index `MEMORY.md`).

## 11. Mise à jour 16:31 (manager Fable, session « cloud/offer-save-01 et suite »)
- Trois chantiers cloud (Fable) fusionnés dans l'ordre bilan-03 (E37, E38, E41) → offers-01 (E34) → apply-01 (E40, E42, E43), sans conflit : 7d4d2e8. Suite complète verte à 16:28 sur cet arbre : 731/733 unitaires (2 ignorés), **151/151 Chrome réel**, check et format à zéro. Registre : les sept passent à « corrigé, à vérifier en réel ».
- **Renommage décidé par le propriétaire** : branche `suite-astra` → `dev` (5efcb03), dossier `agregat-back-astra` → `agregat-back-dev`, `main` avancé à 5efcb03 en local. Reste à pousser par le propriétaire (push refusé au manager) : `git push origin dev main` puis `git push origin --delete suite-astra`.
- API 4310 relancée à 16:29 depuis `~/Downloads/agregat-back-dev` (onglet « API 4310 dev ») ; collecteur du registre relancé depuis le nouveau dossier (onglet « Collecteur registre »).
- Essais réels Indeed (commande du quotidien « Évalue cette offre : <URL> ») : 3a9ee734 (lecture d'une page de résultats : 15 offres lues en entier, mission déclarée failed à tort → **E44**) ; 751f7675 Accenture : évaluation complète 1,5/5 Skip, rapport 008, **CV adapté PDF produit par la chaîne du Skill (première fois en réel)**, 2 lignes de suivi ; trois questions du Skill au propriétaire sur `cv.md` (champ « Company » vide, « Île-de-France Formation » mal extraite, un poste sans employeur) ; défauts **E45** (verify-cv-structure refusé : `path` au lieu de `args`), **E46** (career_read refuse `batch/batch-prompt.md`, `config/cv-facts.json`), **E47** (`find` en échec). Offres 2 et 3 lancées à 16:30 sur le code fusionné (eval-2, eval-3 dans le scratchpad du manager).
- Front : le formulaire de question existe (commit 73170cb, branche `envoi-question` poussée à 16:19, non fusionnée dans `main` du front) ; confirmé par le propriétaire après rechargement. Brief `front-questions-01` : seul le point « état de la liste non rafraîchi » reste.
- À faire ensuite : E44-E47 (brief à écrire, cloud possible, fichiers : `skill-router.js`/manifeste `search`, `tools.js` lecture et messages d'erreur), `release` dans l'intent `pipeline`, candidature réelle `apply` sur une offre bien notée, correction de `cv.md` par le propriétaire.

## 12. Mise à jour 17:23 (manager Fable)
- Cinq chantiers cloud fusionnés dans `dev` aujourd'hui : bilan-03, offers-01, apply-01 (7d4d2e8), bilan-04, bilan-05 (fe5567c). **Suite complète verte à 17:22** sur fe5567c+ : 754 unitaires (752 ✔, 2 ignorés), 151/151 Chrome réel, check et format à zéro. `main` = `dev` en local. Registre : E34, E36, E37, E38, E40-E47 « corrigé, à vérifier en réel » ; ouverts : E48 (scan routé vers `pipeline`), E49 (pipeline réel arrêté sur `career_write` figé 120 s après 8 étapes sur 9).
- Essais réels du jour (commandes du README) : 3 évaluations Indeed (1,5 / 1,7 / 2,2 : Skip ; CV adapté PDF produit sur demande pour la première, étape `release` tenue sur les deux suivantes), scan réel (29 entreprises, 2 912 offres, 1 ajout Anthropic ; 3 portails SEEK injoignables, E19/E21), pipeline réel sur 3 entrées (rapport Anthropic écrit, suivi fusionné, arrêt E49). Le navigateur des missions était le **Chrome isolé** (extension Playwriter non jointe : `cdp.js:481`) : à vérifier avant une candidature avec compte.
- `cv.md` corrigé par le manager sur indication du propriétaire (noms d'entreprises perdus à l'extraction du PDF) ; copie d'avant dans `relay/cv.md.avant-2026-11-05-1650`.
- **Remise à zéro demandée par le propriétaire (17:16)** : `.data`, `relay/{runs,uploads,offers,agent-home,agent-homes}`, `data/`, `reports/`, `output/`, `batch/`, `jds/` déplacés dans `~/Downloads/relay-archive-2026-11-05-1716` (130 Mo, rien supprimé). Gardés : `cv.md`, `config/`, `portals.yml`, `inputs/`, `documents/`, `drafts/`. API relancée propre à 17:23 (onglet « API 4310 dev »).
- Front : `envoi-question` = 47cba5c (formulaire de question, liste à jour, compteur), poussé, non fusionné dans `main` du front.
- Suite : le propriétaire lance lui-même la candidature complète depuis le front ; le manager observe (`.manager/outils/suivre.py <id>`), consigne, et envoie chaque défaut en cloud. Puis E48/E49, et la fusion front `envoi-question` → `main`.

## 13. Mise à jour 20:04 (manager Fable) — passation demandée par le propriétaire

### Cadre de travail nouveau (19:3x, décision du propriétaire)
- Éprouver le système sur **un seul compartiment : `apply`** (le plus cher quand il rate), par cycles courts, en cinq étapes : cadrage (3 questions, une par une), 5 épreuves (ambigu, hors-périmètre, contradictoire, volume, fin) avec hypothèse écrite avant, lecture du symptôme (une phrase factuelle, **une seule** couche en cause parmi constitution / règle scopée / skill / prompt système de l'acteur / registre de décisions), spécification d'une ligne vérifiée par 3 tests et posée au niveau le plus bas, re-test à l'identique ; **jamais corriger une sortie** ; après 3 cycles sans progrès sur un symptôme, le compartiment est trop gros.
- Documentation officielle lue avant de commencer (Skill career-ops : README « everyday commands », `SKILL.md`, `modes/README.md`, `pipeline.md`, `auto-pipeline.md`, `scan.md`, `_shared.md`, `apply.md` (titres), `AGENTS.md`, `ARCHITECTURE.md`, `_custom.template.md` ; Relay : `skill-manifest.yaml`, `CAREER_INSTRUCTIONS`, `CAREER_OWNER_FRAME`, `formatToolRoles`, `formatSkillOrder`, `selectSkillIntents`). Faits utiles : le Skill prévoit `modes/_custom.md` (règles de maison, prioritaires, jamais écrasées) et il **n'existe pas** chez le propriétaire ; le mode `pipeline` traite toute la boîte d'entrée sans demander de périmètre ; le Skill sépare `pipeline` (évaluer) et `apply` (postuler).
- Cadrage : Q1 répondue (« apply ») ; Q2 (« quelle tâche d'apply ne relisez-vous plus ? ») **ouverte**, réponse factuelle proposée : aucune, aucune mission réelle n'a jamais atteint apply ; Q3 non posée. Le propriétaire a préféré lancer des missions pour observer.

### Missions du soir (toutes de l'agent Claude, intention suivie `pipeline`)
- **5e67e25a** (18:49-19:15, reprise de 3ea48d51) : lecture boîte (46), question **formulaire** 18:50 « Quelles offres évaluer ? » (4 choix) → `awaiting_owner` tenu (voie formulaire OK) ; réponse 18:54 « Les 6 pistes Sydney/agence » ; vivacité 6/6 actives ; relecture Skill, CV, profil ; `find` échoue (pas de tracker, E47 lisible) ; `article-digest.md` refusé hors périmètre (E46, nouveau chemin) ; 1 annonce lue ; puis **silence 17 min** → `failed` « Agent inactif depuis 15 min » (**E53**, cause inconnue : transcription ACP 60e9ea8a sans entrée entre 07:58:13Z et 08:15:46Z, aucun journal debug). Rien d'écrit.
- **ac743610** (19:43-19:56, mission neuve, même prompt) : scan 0 neuf (SEEK API « fetch failed », E21) ; 5 recherches web ; 3 pages SEEK lues ; vivacité 6/6 ; `portals.yml` réécrit (contenu conservé : 29 entreprises, 3 boards, 4 requêtes) ; +5 offres d'agences (RGP, Preacta, Rapid Global, Springtek, Citadel) → 53 en attente ; étape `mark` créditée à tort sur cet ajout (**E55**) ; question **formulaire** 19:50 « comment poursuivre ? » (écart d'ancienneté) → réponse 19:50:23 « Évaluer tout » ; `reserve-report-num` → 001 ; `career_write reports/001-rgp-2026-11-05.md` ouvert 19:54:11 → **`tool_stalled` 120 s → `failed`** (**E49 reproduit et expliqué** : la garde `toolIdleMs` est armée sur l'annonce ACP de l'appel, pendant la composition du texte, pas à la remise MCP ; `orchestrator/index.js:885-903`). `reports/001-RESERVED.md` laissé (sentinelle purgée par le Skill après 4 h ou `reserve-report-num --release 001`).
- Symptôme récurrent : **question de périmètre posée 3 fois en 3 missions** (17:51 prose, 18:50 et 19:50 formulaire), toujours après constitution de la boîte et avant toute écriture d'évaluation. Couche la plus plausible : prompt système de l'acteur (`CAREER_INSTRUCTIONS` « si une information manque, pose toutes les questions nécessaires » + règle du doute) ; seconde plausible : règle scopée (`modes/_custom.md` absent). Le texte exact des prompts du propriétaire est **masqué par l'API** (mission privée) : à lui de le coller pour trancher.
- **E54** (lu dans le code) : une mission ne suit qu'une intention, la plus prioritaire (`selectSkillIntents` … `.slice(0, 1)`) ; « évalue puis postule » = `pipeline` seul, aucune étape apply suivie ni exigible. À trancher par le propriétaire.
- 19:58 : le propriétaire annonce une mission lancée **sans le Skill career-ops coché** ; à 20:03 elle n'est pas encore dans l'API ; veille armée (`scratchpad/veille.py`, tâche de fond).

### Fichiers modifiés ce soir
- `.manager/reports/registre-erreurs.md` : E53, E54, E55 ajoutés ; E49 expliqué ; occurrences E38, E46, E47, E51, E52 (commits ef9e91e, 7e89a9b).
- `.manager/briefs/stall-01.md` (36af8f7) : armer la garde « outil figé » à la remise de l'appel, tests par fixture ACP, pas de variable d'environnement.
- Espace career-ops (par l'agent, couche utilisateur, hors Git) : `portals.yml` (19:48), `data/pipeline.md` (53 en attente), `reports/001-RESERVED.md`.
- Mémoire manager : `token-economy-no-free-cloud.md` (+ index).
- Scratchpad : `veille.py` (usage : `veille.py <ids connus,> <budget s> <curseur|latest|0> [run id]` ; s'arrête sur question, état d'attente ou terminal, incident ; `agent_silent` non bloquant ignoré).

### Sessions cloud
- `cloud/bilan-06` poussée (1878ea0 : E48, E51, E52) ; relue par un sous-agent Sonnet : conforme, aucune règle métier dans le moteur, 233 tests ciblés verts, check et format OK ; limites signalées (question suivie d'une conclusion non reconnue ; formules FR/EN de question dans le moteur pour tous les packs). **Non fusionnée** : décision d'attendre l'accord du propriétaire (changement du système sous épreuve).
- `cloud/stall-01` (E49) lancée par le propriétaire vers 20:00 depuis la carte ; brief complet dans l'énoncé ; rapport attendu dans `.manager/reports/stall-01.md`.

### Décisions prises
- Compartiment éprouvé : `apply` ; méthode en cinq étapes ci-dessus ; aucune correction de sortie.
- **Économie de tokens (20:00)** : session locale à 70 %, plus de crédit cloud gratuit → plus de session cloud ni de sous-agent sans demande explicite, Sonnet/Haiku sinon, lectures courtes, veilles par script.
- Fusion de bilan-06 (et de stall-01) seulement sur accord explicite, en une seule relance de l'API, suite complète avant (navigateur libre).
- Pushes à la charge du propriétaire (garde automatique) : `dev` local 36af8f7, `origin/dev` 547b5b7 à 20:03 ; `main` à avancer après suite verte.

### Suite à donner, dans l'ordre
1. Suivre la mission sans Skill (épreuve « hors-périmètre » de fait) ; consigner.
2. À la fin de stall-01 : fetch, relecture du diff par le manager (pas de sous-agent), tests ciblés, puis, sur accord, fusion bilan-06 + stall-01 dans `dev`, suite complète, relance de l'API (onglet « API 4310 dev », même commande qu'en section 12), push `dev` et `main` par le propriétaire.
3. Reprendre le cadrage (Q2, Q3), puis les 5 épreuves sur `apply` ; première épreuve probable : la « fin » (une mission qui doit se terminer sur le clic du propriétaire).
4. Ouverts : E53 (cause du silence), E54 (une intention par mission), E55 (crédit de `mark`), E21 (SEEK API), E46 (`article-digest.md`), E52 voie prose (bilan-06), CV fictif pour missions simulées, processus orphelin PID 90557, fusion front `envoi-question` → `main`.

## 14. Mise à jour 22:10 (manager Opus) — fusion de bilan-06 et stall-01, API relancée

- **Relecture de stall-01 (E49)** par le manager, sans sous-agent : diff du moteur et `packages/orchestrator/tool-guard.js`, confrontés à la séquence réelle d'ac743610 (`tool_call` pending nommé `mcp__platform__career_write`, puis mise à jour `rawInput {path}` sans statut, `tool_stalled` 120 s plus tard). Avec stall-01, ces deux mises à jour n'arment plus rien ; la garde part de la permission ou de la passerelle (`tool_armed`). Tests ciblés sur la branche : 13/13 nouveaux, 49/49 gardes existantes (`tool-watchdog`, `agent-silence`, `elicitation`, `fix-resume`).
- **Fusions dans `dev`** sur accord du propriétaire (« Fusionner d'abord ») : bilan-06 (bc8aa5f), stall-01 (e5bd591). Code fusionné sans conflit ; conflits seulement dans le registre (E48, E49, E51, E52), résolus en gardant les occurrences du manager et l'état « Corrigé, à vérifier en réel » des branches.
- **Suite complète verte à 22:06** sur e5bd591 : 782 unitaires (780 ✔, 2 ignorés), 151/151 Chrome réel, check et format à zéro.
- Processus orphelin **PID 90557** (`node --test tests/apply-flow.test.js`, lancé le 04/11 20:39, sans port ni enfant) arrêté à 21:59.
- **API relancée** sur e5bd591 (pid 95738, onglet « API 4310 dev » de cette session, commande de la section 3), vérifiée à 22:09 : `GET /api/runs` → 200. En écoute : relais 19988, page fictive 4321, front 5173. Aucune mission n'était en cours à l'arrêt de l'ancienne API.
- **Effets à attendre en réel** : un dernier paragraphe d'agent qui demande une décision (ou finit par « ? ») met la mission en `awaiting_owner`, tous packs ; une `pipeline` qui ne traite aucune entrée finit `failed` « boîte d'entrée non traitée (0 sur N) » ; un `career_write` long ne déclenche plus `tool_stalled` avant sa remise.
- **bilan-06, écarts « à trancher par le manager »** (rapport `bilan-06.md`) que la session précédente n'avait pas consignés : avis du manager = accepter (messages d'accueil de l'agent fictif reformulés en constats ; « which » reconnu seulement en forme de question ; `evaluate` sans étape `proves` donc non exigée ; prompt de 3ea48d51 cité au registre → reste `pipeline`, vérifié sur le routeur). Consignation comme décision : en attente de l'accord du propriétaire.
- **À faire par le propriétaire** : pousser (`git -C ~/Downloads/agregat-back-dev push origin dev main`) ; `main` local avancé sur `dev`.
- Suite inchangée : cadrage (Q2, Q3), puis les 5 épreuves sur `apply` ; mission sans Skill toujours absente de l'API (seule ac743610 porte `skills: []`, à confirmer par le propriétaire).
