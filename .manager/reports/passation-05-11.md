# Passation du 05/11/2026 (14:50) — Relay, branche `suite-astra`

Écrite par le manager (Claude Fable) pour la session suivante. Tout ce qui est dit « vérifié » l'a été réellement aujourd'hui ; le reste est marqué « non vérifié ». Journal complet : `.manager/reports/reprise-05-11.md` (horodaté, 04/11 20:23 → 05/11). Registre : `.manager/reports/registre-erreurs.md`.

## 1. À lire dans l'ordre
1. Ce fichier.
2. `.manager/reports/reprise-05-11.md` : sections 13:08 → fin (E1, épreuves, cadre réécrit, fusion offer-save-01).
3. `.manager/reports/registre-erreurs.md` : lignes E37 à E43 (ouvertes), E39 (décision du propriétaire), E1/E35/E36 (tenues en réel).
4. `.manager/briefs/bilan-03.md` : chantier prêt, non lancé.
5. `.manager/reports/audit-career-ops-05-11/02-relay-vs-skill.md` si besoin de l'architecture Relay ↔ Skill.

## 2. Règles permanentes du propriétaire (à conserver telles quelles)
- Ne touche pas au travail non commité de `~/Downloads/agregat-back` (dépôt d'origine, branche `codex/browser-audit-31-10`) ; le travail se fait dans `~/Downloads/agregat-back-astra` sur `suite-astra`.
- Jamais de `git add -A`, stash, reset ni réécriture d'historique ; commit local puis push de `suite-astra` à chaque étape ; `main` avancé seulement sur `npm test` complet vert (`git branch -f main HEAD && git push origin suite-astra main`).
- Bibliothèque career-ops, Skill (`~/Downloads/agregat-career-ops`, clone public, HEAD = origin/main 35b7c531) et CV intouchés. Vérifié aujourd'hui : `git status` du clone propre.
- Aucun secret lu (`.manager/secrets.env`, `.envforme`, `~/.codex/auth.json`, `~/.claude*`, trousseau). Aucune donnée personnelle dans Git ni dans les rapports (dépôt public) : masquer e-mails, téléphones, noms ; les URL d'offres restent hors Git.
- Pour chaque changement : dire ce qui est vérifié réellement et ce qui ne l'est pas. Rapport français horodaté dans `.manager/reports/` ; **lire `date` avant d'écrire chaque heure** (dérive constatée trois fois aujourd'hui, corrigée par commits).
- Registre d'erreurs avec degré de certitude ; jamais une déduction présentée comme un fait (leçon E35 : un brief écrit sur une cause déduite était faux ; le sous-agent l'a prouvé par test avant de coder).
- Ne bride pas l'agent ; seule exception : le clic avant un envoi final, intercepté par Relay (côté plateforme, pas une consigne à l'agent). Aucune règle métier en dur dans le moteur.
- Un seul écrivain par arbre ; lecteurs en parallèle admis. Sonnet pour le courant, Opus pour le complexe, Fable orchestre/relit/débogue. Sessions cloud pour les chantiers de code à fixtures (100 $ de crédit depuis le 05/11), le manager fusionne et teste en local.
- Pas de suite Chrome (`npm test`) pendant une mission navigateur (E23, jamais prouvé, jamais écarté). Ne relancer aucun serveur sans le dire. Le manager n'approuve jamais un envoi.
- « Ne prends pas de décisions, dis-moi et je tranche » : proposer, expliquer sans jargon, attendre.

## 3. État réel au moment de la passation
- `suite-astra` = 4e3b5ba (poussée). `main` = origin/main = 92048a8 (dernière suite complète verte : 685 parallèles + 148 Chrome, 13:28). Depuis : cadre de l'acteur réécrit (6d3f1bc), fusion `cloud/offer-save-01` (a63195d), brief bilan-03, journal.
- **Suite complète verte** (14:54) sur l'arbre fusionné : 693 parallèles (691 ✔, 2 ignorés), 148 Chrome, check et format à zéro. **`main` avancé et poussé** (= `suite-astra`, commits suivants = rapports seulement).
- **API 4310** : tourne sur **6d3f1bc** (relancée 14:24, onglet terminal « API 4310 » de l'ancienne session, garde de silence 15 min). Le code fusionné (offer-save-01) n'est **pas** encore servi : relancer l'API après la suite verte, en l'annonçant. Commande (depuis `~/Downloads/agregat-back-astra`) :
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
1. Fait à 14:54 : suite verte, `main` avancé. Reste : relance annoncée de l'API sur le code fusionné (voir point 3) si elle tourne encore sur 6d3f1bc.
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
