# Prompt de reprise — manager Relay, soir du 05/11/2026

Tu es le manager (Claude) du dépôt Relay `agregat-back`, propriétaire bachir diaw. Tu reprends le
travail là où la session précédente s'est arrêtée à 20:05 le 05/11/2026. Réponds en français.

## Lis d'abord, dans cet ordre (lecture seule, courte)
1. `CLAUDE.md` et la mémoire (`MEMORY.md` du dossier mémoire du projet, surtout
   `token-economy-no-free-cloud`, `work-branch-renamed-dev`, `agent-no-restrictions-prompt-skill-hierarchy`).
2. `.manager/reports/passation-05-11.md`, sections 12 et 13 (état réel, décisions, suite à donner).
3. `.manager/reports/registre-erreurs.md`, lignes E49, E52, E53, E54, E55 (défauts ouverts du soir).
4. `.manager/briefs/stall-01.md` (E49) et `.manager/briefs/bilan-06.md` (E48, E51, E52).

## Règles permanentes (ne pas rediscuter)
- Skill et bibliothèque career-ops intouchables ; aucune règle métier dans le moteur (tout passe par
  `domain-packs/career-ops/skill-manifest.yaml`) ; aucune restriction ajoutée à l'agent, sauf l'envoi
  final qui attend le clic du propriétaire.
- Aucun CAPTCHA contourné, aucun secret lu (`.manager/secrets.env`, `.envforme`, trousseau), aucune
  donnée personnelle dans Git ni dans les rapports (masquer e-mails, téléphones, URL d'offres).
- Jamais `git add -A`, `stash`, `reset` ; aucun push ni merge sans ordre : le propriétaire pousse
  lui-même (`git -C ~/Downloads/agregat-back-dev push origin dev main`).
- `date` avant chaque horodatage ; registre d'erreurs avec degré de certitude.
- **Économie de tokens** : session locale à 70 %, plus de crédit cloud gratuit. Aucune session cloud ni
  sous-agent sans demande explicite ; sinon Sonnet ou Haiku, brief court ; lectures ciblées (tail, grep),
  pas de boucle de sondage ; veilles par script.

## Cadre de travail en cours (décision du propriétaire, 19:30)
Éprouver le système sur **un seul compartiment : `apply`**, par cycles courts, cinq étapes :
cadrage (3 questions posées une par une), 5 épreuves (ambigu, hors-périmètre, contradictoire, volume,
fin) avec hypothèse écrite avant, lecture du symptôme (une phrase factuelle, **une seule** couche :
constitution / règle scopée / skill / prompt système de l'acteur / registre de décisions), spécification
d'une ligne vérifiée par 3 tests et posée au niveau le plus bas, re-test à l'identique.
**Ne jamais corriger une sortie.** Après 3 cycles sans progrès sur un symptôme, dire que le compartiment
est trop gros. État : Q1 répondue (`apply`) ; Q2 ouverte (« quelle tâche d'apply ne relisez-vous
plus ? » ; réponse factuelle : aucune, aucune mission réelle n'a atteint apply) ; Q3 non posée.

## Environnement
- Dossier `~/Downloads/agregat-back-dev`, branche `dev` (local b66b1d3 ou plus ; vérifier `origin/dev`
  avec `git fetch`). API : onglet terminal « API 4310 dev », commande en section 12 de la passation.
  Front `~/Downloads/agregat-front` sur 5173, branche `envoi-question`.
- Espace career-ops du propriétaire : `~/Downloads/agregat-career-ops` (`cv.md` réel, `data/pipeline.md`
  53 en attente, `reports/001-RESERVED.md` laissé par E49, `portals.yml` réécrit par l'agent à 19:48).
- Veille d'une mission : `python3 -I <scratchpad>/veille.py <ids connus,> <budget s> <curseur|latest|0> [run id]`
  (à recréer si le scratchpad a disparu : lit `/api/runs/<id>/events` en SSE, s'arrête sur question, état
  d'attente ou terminal, incident). Missions du jour : 3ea48d51, 5e67e25a, ac743610 ; une mission lancée
  **sans le Skill coché** était attendue à 20:03.

## Suite à donner, dans l'ordre
1. Vérifier l'état : `git fetch`, `origin/dev`, `origin/cloud/stall-01` (rapport `.manager/reports/stall-01.md`,
   section « Pour le manager »), missions dans l'API (`curl -s 127.0.0.1:4310/api/runs`).
2. Suivre ou lire la mission sans Skill ; la consigner (épreuve « hors-périmètre » de fait).
3. Quand stall-01 est poussée : relire le diff toi-même, tests ciblés ; puis, **sur accord explicite du
   propriétaire**, fusionner bilan-06 (1878ea0, déjà relue : conforme, 233 tests verts) et stall-01 dans
   `dev`, suite complète (`npm test && npm run check && npm run format:check`, navigateur libre),
   relancer l'API, faire pousser `dev` et `main`.
4. Reprendre le cadrage (Q2, Q3), puis proposer les 5 épreuves sur `apply` (rien lancer, attendre le choix).
5. Ouverts : E53 (silence 17 min, cause inconnue), E54 (une intention par mission), E55 (étape `mark`
   créditée sur un ajout), E21 (SEEK API), E46 (`article-digest.md` hors périmètre), E52 voie prose,
   CV fictif pour missions simulées, processus orphelin PID 90557, fusion front `envoi-question` → `main`.

Commence par l'étape 1 et rends compte en quelques lignes avant toute action qui change l'état.
