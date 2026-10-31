# essai-reel-01 — contrôle sur le Mac, API relancée, une mission réelle Gemini et une Claude (recherche d'emploi)

> **BRANCHE** : `codex/browser-audit-31-10` dans `~/Downloads/agregat-back` et `~/Downloads/agregat-front`. Ce brief ne change
> **aucun code** : il contrôle, relance l'API, lance deux missions réelles et rend compte. Aucun push, aucun merge. Ne touche
> ni au CV, ni au Skill, ni à la bibliothèque career-ops. Le stash « brouillons front avant audit » d'`agregat-front` n'est
> pas à toi : ne le ressors pas.

Lis `AGENTS.md`, `CLAUDE.md`, `.manager/HANDOFF.md` (§ « Relancer l'API ») et `.manager/reports/audit-claude-cloud.md`.

## Décision de l'utilisateur (31/10)
Exception à la règle « tests réels rares et minimes » : l'utilisateur demande **deux** missions réelles complètes de recherche
d'emploi, une avec Gemini, une avec Claude, dans son Chrome via Playwriter. Une seule relance par agent, et seulement si
l'échec ne vient pas de l'agent (relais absent, API arrêtée). Aucun envoi : ni candidature, ni e-mail, ni message.

## 0. Avant tout
- Dans les deux dépôts, `git status` et `git log -1 --format=%h` : au moins back `918afdf` et front `85d6352`. Sinon
  `git pull --no-edit origin codex/browser-audit-31-10`. Si une autre session Codex écrit (`pgrep -fl "codex exec"`,
  `pgrep -fl run-until-done`) : arrête-toi et écris-le dans le rapport.
- Modifications non commitées déjà présentes (brouillons d'autres sessions) : ne les lis pas, ne les modifie pas, ne les
  mets pas de côté, ne les commite pas ; ne lis jamais `.envforme`. Décision de l'utilisateur (31/10) : elles ne t'arrêtent
  que si l'une touche `apps/`, `packages/`, `domain-packs/`, `tests/`, `scripts/`, `package.json` ou `package-lock.json`,
  car elle changerait ce qui est testé. Dans ce cas, liste ces fichiers sans les ouvrir et arrête-toi.
- Lance hors bac à sable (escalade) les commandes qui démarrent Chrome, l'API ou un agent : dans le bac à sable, Chrome
  avorte (`SIGABRT`).
- CV : vérifie seulement que `~/Downloads/agregat-career-ops/cv.md` existe, sans l'ouvrir. S'il manque, arrête-toi et
  demande à l'utilisateur de le déposer dans « Candidatures ».

## 1. Contrôle du back
Dans `~/Downloads/agregat-back` : `mkdir -p .manager/reports/essai-reel-01-evidence`,
`npm test > .manager/reports/essai-reel-01-evidence/npm-test.log 2>&1`, puis
`npm run check` et `npm run format:check`, avec leurs codes de sortie. Attendu : principal 400/401 (1 ignoré), phase Chrome
sans échec. Si un fichier est coupé par un délai sous charge, relance-le seul avant de conclure. Le front a déjà été vérifié
par l'utilisateur sur `85d6352` (137/137, E2E 14/14) : ne le relance pas.

## 2. Relancer l'API
1. `curl -s http://127.0.0.1:4310/api/runs` : aucune mission `queued`, `running` ni `waiting_permission`. Sinon, attends ou
   arrête-toi et écris-le ; n'annule jamais une mission de l'utilisateur.
2. `kill $(lsof -ti tcp:4310 -sTCP:LISTEN)`, puis vérifie que le port est libre.
3. Hors bac à sable, lance la commande de la passation en arrière-plan, journal dans `.manager/logs/` (non versionné) :
   `AGENT_PLATFORM_OWNER_MODE=1 AGENT_PLATFORM_LIVE=1 AGENT_PLATFORM_TIMEOUT_MS=1800000 AGENT_PLATFORM_BROWSER=playwriter PLAYWRITER_TELEMETRY=0 nohup node --env-file-if-exists=.manager/secrets.env apps/api/server.js > .manager/logs/api-essai-reel-01.log 2>&1 &`
   Ne lis ni n'affiche jamais `.manager/secrets.env`.
4. `GET /api/catalog` répond, avec Gemini et Claude dans `agents`. Relais Playwriter : port 19988 à l'écoute
   (`lsof -ti tcp:19988 -sTCP:LISTEN`), sinon `playwriter session new`. Si l'extension n'est pas connectée dans Chrome,
   demande-le à l'utilisateur ; ne clique pas à sa place.
5. Laisse l'API tourner à la fin : l'utilisateur s'en sert ensuite.

## 3. Deux missions réelles, l'une après l'autre
Même prompt pour les deux : « À partir de mon CV, trouve des offres de stage ou de CDD Software / AI engineer à Sydney,
ouvre chaque lien pour vérifier qu'il fonctionne, et classe les 5 meilleures. Ne postule pas et n'envoie rien. »
- `POST /api/plan`, puis `POST /api/runs`, avec les en-têtes `content-type: application/json` et `x-platform-request: 1`, et
  le corps `{"prompt": "…", "agent": "gemini", "pack": "career-ops", "browser": "playwriter"}`. Ensuite, la même chose avec
  `"agent": "claude"`. Si la mission est refusée pour le budget, mets l'estimation de `/api/plan` dans `budgetCents` et note-le.
- Attends l'état final (`completed`, `failed`, `cancelled` ou `interrupted`, 35 min au plus) avec une seule boucle shell sur
  `GET /api/runs/<id>` (`until …; do sleep 30; done`), pas des appels répétés. Ensuite, enregistre les événements :
  `curl -sN http://127.0.0.1:4310/api/runs/<id>/events > .manager/logs/essai-reel-01-<agent>-events.txt`
  (non versionné : ils contiennent des données privées).
- **Ne réponds jamais à une demande d'accord d'envoi** : elle attend le clic de l'utilisateur. Laisse-la expirer et note ce
  qu'en dit le Bilan.
- Après chaque mission, ajoute une ligne à `.manager/api-usage.md` (heure, brief, agent, modèle, but, `usage` de la mission).

## 4. À vérifier pour chaque mission (preuves : événements et `GET /api/runs/<id>`)
| Critère | Attendu |
|---|---|
| Accords | aucun événement `permission`, sauf pour un envoi (titre « Envoi : aperçu privé… », visible aussi dans `GET /api/career/pending`) ; tout le reste en `permission_auto` |
| Libellés | les `permission_auto` portent le vrai nom de l'outil (`career_read`, `jobs_search_live`…), jamais « Envoi » |
| Navigateur | des `browser_evidence` ; pas de `browser_fallback` (sinon : Chrome isolé sans les comptes, le noter) |
| Résultat | état `completed` ; nombre d'offres et domaines de leurs liens ; liens réellement ouverts selon les preuves |
| Échec éventuel | `error` donne la vraie cause (limite d'usage et heure de reprise, délai, serveur arrêté ; un accord expiré s'ajoute après la cause) ; compare-la au journal de l'API |
| Durée et coût | `createdAt` → `finishedAt` ; `usage` de la mission |

## Rapport `.manager/reports/essai-reel-01.md` (au fil de l'eau, heures relevées par `date +%H:%M`)
Commandes et codes de sortie, résultats du § 1, PID et commande de l'API (sans secret), puis pour chaque mission :
identifiant, agent, modèle servi s'il est connu, état, durée, tableau du § 4 rempli avec ses preuves (types et nombres
d'événements). **Jamais** le CV, le profil, le texte du Bilan ni de paramètres d'URL : seulement des états, des nombres, des
noms d'outils, des causes, le nombre d'offres et les domaines. Un défaut trouvé est décrit avec sa preuve, pas corrigé.
Commit local `[essai-reel-01]` du rapport, de ses preuves et de `api-usage.md` seulement ; si `api-usage.md` contenait déjà
des lignes non commitées, laisse-le hors du commit et dis-le.
Dernier message ≤ 12 lignes : CONTRÔLE · API · GEMINI · CLAUDE · DÉFAUTS · RESTE.
