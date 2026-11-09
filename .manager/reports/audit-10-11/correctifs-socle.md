# Correctifs socle (audit du 10/11) — branche `audit-socle`

Tests finaux : phase unitaire sans Chrome 897 verts sur 899 (0 échec, 2 ignorés), `npm run check` et `format:check` verts. Tests rouge/vert : chaque correctif a son test (rouge constaté avant, ou fonction inexistante avant). Bases SQLite temporaires seulement ; aucun agent réel, aucun réseau, aucune clé.

## Points traités

| # | Constat | Statut | Commit | Test |
|---|---|---|---|---|
| 1 | Ledger quadratique | corrigé | 7085401 | `tests/billing.test.js` (queue / ancien / démarrage) |
| 2 | Agents orphelins | corrigé | 4b498e7 | `tests/orphan-agents.test.js`, `tests/global-guards.test.js` |
| 4 | Message ACP > 1 Mio | corrigé | 885561f | `tests/runtime-onevent.test.js` (3 Mio) |
| 5 | `onEvent` sans try/catch | corrigé | 6fdc700 | `tests/runtime-onevent.test.js` |
| 6 | Routage auto, faux positifs | corrigé (côté `agent-runtime`), reste côté orchestrateur | ab1a2fa | `tests/probe-routing.test.js` |
| 8 | Étape agent `uncertain` sans fin | corrigé | d01fa35 | `tests/astra-workflow.test.js` |
| 9 | Budget 0 / « Budget invalide » | corrigé | 18182de | `tests/billing.test.js` |
| 15/16 | busy_timeout, JSON de run, écouteur SSE | corrigé | ca66a82 | `tests/billing.test.js` |
| 13 | Cache DataGateway | corrigé | 78b9182 | `tests/data-gateway-cache.test.js` |
| 14 | `pricing.json` corrompu | corrigé ; `saveProbe` concurrent = faux constat | 9a31426 | `tests/data-gateway-cache.test.js` |
| 12 | `.env*` non ignoré | corrigé | d2eeaa2 | `git check-ignore` |

### 1. Ledger
`charge()` ne vérifie plus que la queue (dernière ligne contre son prédécesseur, plus l'ancre) : `verifyLedgerTail()`. Vérification complète au démarrage du `Store` (`startupLedger` ; si elle échoue, toute charge est refusée) et à la demande : `verifyLedger()` ; `GET /api/runs/:id?ledger=full` la renvoie, sinon le GET utilise la queue. Le total dépensé du run se calcule par `SUM` au lieu de relire toutes les lignes. Détection : falsification de la queue = à la charge ; falsification ancienne = démarrage suivant ou vérification complète (nouveau test). Les tests existants sont inchangés et verts.
Mesure (base temporaire, charges à 0 cent) : 0 → 1 000 entrées 1,55 s → 0,31 s ; 1 000 → 5 000 entrées 33,6 s → 1,3 s ; une charge à 5 000 entrées 13 ms → < 1 ms.
Reste : la vérification complète au démarrage est linéaire (une fois) ; le ledger n'a pas de rétention.

### 2. Agents orphelins
- `packages/agent-runtime/orphans.js` : `AgentRegistry` (`.data/agent-pids.json`, 0600) enregistre pid/pgid, pid de l'API, uid, date, noms de commande à chaque lancement (`AcpRuntime.registry`, renseigné par `apps/api/server.js` dans le bloc principal seulement, donc pas dans les tests) ; retiré à la mort du groupe/`close()`.
- Au démarrage `reapOrphanAgents` : n'agit que si l'API enregistrée est morte ; tue (SIGTERM puis SIGKILL) uniquement si le pid appartient au même uid, est chef de son groupe, a une date de démarrage proche de celle enregistrée (±15 s) et une commande contenant le nom enregistré. Sinon ignoré et journalisé. Testé : pid recyclé (commande autre, date autre), API encore vivante → jamais de kill.
- `packages/agent-runtime/guards.js` : `unhandledRejection` journalisée (redactée, bornée 800 car.) sans arrêt ; `uncaughtException` journalisée puis `app.close()` borné à 8 s, puis exit(1).
- Limite : si le chef du groupe est déjà mort mais pas ses descendants, ils ne sont pas retrouvés (pas de vérification possible du pid).
- Lien avec les « runs marqués `interrupted` » : on se base sur le registre (l'API morte), plus fiable que l'état du run, qui ne connaît pas le pgid.

### 4 / 5. ACP
`maxMessageBytes` = 16 Mio (la troncature d'événement à 256 Ko dans `Store.event` reste). `handleUpdate` passe par `deliverEvent` : exception d'`onEvent` attrapée, journal `agent_event_dropped <type> : <erreur redactée, 300 car.>` sans payload, et mise à jour de remplacement `platform_event_dropped {originalType, error}` transmise à la mission (le SDK ne voit plus l'exception, donc ne journalise plus le message brut). Un événement > 256 Ko est donc remplacé par cette note, la mission continue.

### 6. Routage
`saveProbe` (agent-runtime) n'enregistre plus `inference:false` que si l'erreur est un refus d'authentification précis (`AUTH_REFUSAL`, mots entiers : `auth_required`, `authentication failed`, `unauthorized`, `401`, `invalid api key`, « Authentification API refusée »…), ni `session:false` pour une panne réseau (ECONN…, timeout…). `chooseAgent` ignore un test négatif de plus de 10 min (`PROBE_TTL_MS`, `now` injectable) et, si tous les agents restants ne sont écartés que par une sonde négative, retente le meilleur (« réessayé »). Un test réussi réécrit la sonde (déjà le cas).
**À signaler (hors périmètre, `packages/orchestrator/`)** : `index.js:1177` et `workflow-run.js:259` gardent la regex `/auth|login|credential|api key/i` ; pour career-ops l'orchestrateur remplace le message par « Authentification API refusée » avant `saveProbe`, ce qui passe le filtre : le faux positif persiste pour ce pack (limité par l'expiration de 10 min et le réessai). Idéal : remplacer cette regex par `AUTH_REFUSAL` exporté de `agent-runtime/probes.js`.

### 8. Workflow
`WorkflowEngine({ unsupervised, humanWaitMs = 30 min, clock })` : une étape `agent` restée `uncertain` devient `failed` (cause conservée : « Échec de l'agent, sans réponse humaine … : <cause> ») immédiatement en `unsupervised`, sinon après `humanWaitMs`. La reprise explicite la remet en `uncertain` (pas de rejeu aveugle, testé). Les étapes `tool` d'écriture restent `uncertain` (risque de double effet).
**Orchestrateur non modifié** : il construit `new WorkflowEngine({store, executors:{}})` (`workflow-run.js:85`) sans `unsupervised` ; le délai par défaut de 30 min s'applique donc, et le mode non supervisé immédiat attend que l'orchestrateur passe l'option.

### 9. Budget
`Store.charge` : budget 0 ou absent = pas de plafond par run (le plafond mensuel s'applique) ; > 0 = plafond ; valeur illisible (négative, non entière) → « Valeur illisible : budgetCents du run », qui ne correspond plus à `/Budget|Plafond/` (pas de `budget_exceeded` ni d'abort sur une donnée abîmée). Le refus à la création (« Budget insuffisant », orchestrateur:735) n'est pas touché.

### 15 / 16 / 13 / 14 / 12
`PRAGMA busy_timeout=5000` ; une ligne `runs.data` illisible n'empêche plus le démarrage ; `Store.event` isole un écouteur qui lève (l'INSERT est déjà fait). DataGateway : erreur d'écriture du cache (ENOSPC, EACCES, EROFS…) ignorée, entrée en cache > `maxBytes` = miss ; les refus de politique (lien symbolique) restent des erreurs (test existant conservé). `loadPricing` : JSON invalide ou non-objet → tarif par défaut et message sur stderr (une valeur mal formée reste fatale). `.gitignore` : `.env*`, `*.env`, sauf `*.example`.
**Faux constat** : `saveProbe` concurrent — lecture-modification-écriture entièrement synchrone dans un seul processus, deux appels ne s'entrelacent pas ; non corrigé.

## Non traités
- 3 (arrêt propre sans borne) : `packages/orchestrator/` (interdit). Atténué : le garde `uncaughtException` borne `app.close()` à 8 s ; pas pour SIGINT/SIGTERM.
- 7 (Gemini `authenticate`), 10, 11, 17, 18, 19, 20 : hors liste demandée, non touchés.
- 15 : pas de rétention des événements.
