# Audit socle (10/11) — agent-runtime, storage, policy-engine, skill-registry, capability-registry, workflow-engine, data-gateway, billing, routes API

Lecture seule. Tests ciblés relancés : billing, workflow-engine, policy-files, skill-registry (57/57 verts). Une mesure ad hoc du ledger (script dans le scratchpad, base temporaire).

## Constats (triés par gravité)

### 1. IMPORTANT / certain — Le ledger est revérifié en entier à chaque `charge()` (coût quadratique, bloquant)
- `packages/storage/index.js:175` (`verifyLedger()` dans `charge`), `:219-244`. Aussi `apps/api/server.js:251` (chaque GET d'un run).
- `charge()` relit et re-hache toute la table `ledger` (chaîne globale, tous runs confondus) dans une transaction `BEGIN IMMEDIATE`, de façon synchrone (`DatabaseSync`) donc en bloquant la boucle d'événements. Chaque appel d'outil natif observé (`tool_observed`, orchestrator:1085) déclenche une charge.
- Mesure : 1 000 charges = 1,6 s ; passage de 1 000 à 5 000 entrées = 34 s ; une charge à 5 000 entrées = 20 ms. Extrapolé : ~400 ms par appel d'outil vers 100 000 entrées, pendant lesquelles SSE, heartbeats et réponses API sont gelés.
- Scénario : après quelques semaines d'essais, les missions ralentissent puis semblent figées ; le silence-guard déclenche, les cartes d'accord arrivent en retard. Le GET `/api/runs/:id` (poll de l'interface) paie aussi la vérification complète.
- Correctif : ne vérifier que la queue (dernière ligne + ancre) dans `charge`, la vérification complète seulement à la demande (endpoint/diagnostic) ou au démarrage ; mémoriser le dernier hash en mémoire.

### 2. IMPORTANT / probable — Aucun nettoyage des agents orphelins après un crash/kill -9 de l'API
- `packages/agent-runtime/index.js:168-174` (spawn `detached` = groupe propre), pas de persistance du pid/pgid ; aucun `unhandledRejection`/`uncaughtException` dans `apps/api/server.js:676-687`.
- Les agents sont détachés exprès ; seul `close()` les tue. Si l'API meurt (exception non rattrapée, kill -9, plantage Node), l'agent et sa passerelle MCP/navigateur survivent, continuent à consommer des jetons et peuvent encore agir (onglets, envois). Au redémarrage `Store` marque le run `interrupted` (storage:36-57) sans jamais retrouver ni tuer le groupe.
- Correctif : écrire `pgid` + date de démarrage dans le run (ou un fichier `.data/agent-pids.json`) au `spawn`, et au démarrage tuer (SIGTERM puis SIGKILL) les groupes encore vivants dont le pid correspond ; ajouter des gestionnaires `unhandledRejection`/`uncaughtException` qui appellent `engine.close()`.

### 3. IMPORTANT / probable — Arrêt propre de l'API pouvant ne jamais finir
- `packages/orchestrator/index.js:1786-1789` (`close()`: `while (this.active.size) await 20 ms`, sans borne), appelé par `apps/api/server.js:668,686`.
- Si un run actif ne se termine pas après l'abort (runtime figé, promesse jamais résolue), SIGINT/SIGTERM n'aboutit jamais ; `process.once` n'est plus armé, le port reste pris. Un second Ctrl-C tue brutalement, ce qui retombe sur le constat 2 (agents orphelins).
- Correctif : borne (ex. 10 s) puis `runtime.close()` forcé pour chaque run actif, puis exit.

### 4. IMPORTANT / probable — Un message ACP > 1 Mio tue la connexion, donc la mission
- `packages/agent-runtime/index.js:214-216` (`maxMessageBytes: 1048576`). Le SDK lève `MessageTooLargeError` sur la ligne NDJSON, le flux se ferme (`core/line-buffer.js:96`, `core/stream.js:87-92`).
- Scénario : un outil d'agent renvoie une capture d'écran en base64 (1-3 Mo) ou un gros fichier lu, relayé en `tool_call_update` : la connexion est coupée, la mission échoue en « Processus agent terminé / connection closed ». Le stockage des événements plafonne déjà à 256 Ko (storage:91), donc la limite de 1 Mio n'apporte rien côté sécurité mémoire.
- Correctif : monter à 16-32 Mio et laisser le plafond d'événements gérer la persistance ; ne pas échouer la mission pour un message gros.

### 5. IMPORTANT / probable — Exception dans `onEvent` : mise à jour perdue et trace brute dans la console
- `packages/agent-runtime/index.js:164` (`this.onEvent(...)` sans try/catch) appelé depuis le handler de notification (`:196-198`). L'orchestrateur y fait `store.event` (lève « Événement trop volumineux » > 256 Ko, storage:91) et `meter` (lève sur budget/intégrité).
- Le SDK attrape l'exception, journalise `console.error("Error handling notification", message.raw, …)` (`core/jsonrpc.js:781-790`) : le message brut de l'agent (contenu de CV, éventuels secrets non redactés) part dans la sortie standard de l'API, contournant `redactValue`. L'update est perdue, `text +=` a déjà eu lieu mais `meter('tool_observed')` est sauté.
- Correctif : envelopper `onEvent` dans un try/catch dans `handleUpdate` (journal `agent_event_dropped` redacté, sans payload), tronquer plutôt que lever pour les gros événements.

### 6. IMPORTANT / probable — Routage auto : un échec ponctuel exclut un agent « à vie »
- `packages/orchestrator/index.js:1177-1186` (regex `/auth|login|credential|api key/i` sur le message d'erreur) + `packages/agent-runtime/router.js:26-35`.
- Toute erreur dont le message contient « auth » (ex. « author », « authorized », une page de connexion citée dans un échec navigateur) écrit `inference:false` dans `agent-probes.json`. `chooseAgent` rejette ensuite l'agent tant qu'un prompt réussi ne le réécrit pas, ce qui n'arrive jamais puisqu'il n'est plus choisi en `auto`. Idem `session:false` sur une panne réseau ponctuelle. Si tous les agents sont rejetés : « Aucun agent réel compatible », plus aucune mission en auto.
- Correctif : n'enregistrer que sur motif d'authentification précis (code d'erreur ACP `auth_required`, ou la regex stricte de `failure.js:45`), et expirer un échec après N minutes ; permettre de tenter un agent rejeté si c'est le seul.

### 7. IMPORTANT / doute — Gemini avec clé API : `authenticate` n'est jamais appelé
- `packages/agent-runtime/profiles.js:52-56` (`apiKeyAuth.methodId: 'gemini-api-key'` jamais lu) ; `capabilities.js:54` expose `authMethods` mais aucun appel `authenticate` dans le dépôt.
- Le commentaire du profil explique que le CLI exige `authenticate` pour persister le type d'auth dans le home isolé ; avec un home vide et la seule variable d'environnement, `session/new` peut répondre « auth required » selon la version de Gemini CLI. Non testable ici (pas de clé, règle du mandat).
- Correctif : après `initialize`, si `usesApiKeyAuth()` et `authMethods` contient `methodId`, appeler `authenticate({ methodId })` avant `session/new` ; sinon supprimer la configuration morte.

### 8. IMPORTANT / probable — Étape workflow `agent` en échec : état `uncertain` qui fige le run
- `packages/workflow-engine/index.js:21-24,280-287`, `:228-231`.
- Un échec d'une étape `agent` (non rejouable par construction), même un simple démarrage raté ou délai, passe en `uncertain`. `drive()` considère `uncertain` comme « en attente humaine » et dort indéfiniment tant que personne ne répond via `/api/runs/:id/steps/:step`. En mode non supervisé la mission n'est « jamais terminée ».
- Correctif : distinguer « l'agent n'a jamais démarré / refus avant tout effet » (échec franc, retry possible) de « effet incertain » ; ou délai d'attente humaine avec bascule en `failed`. Au minimum, événement d'alerte visible.

### 9. IMPORTANT / probable — Budget 0 par défaut + tarif non nul : toute action facturable stoppe la mission
- `packages/orchestrator/index.js:100` (`budgetCents` défaut 0), `packages/storage/index.js:179`, `orchestrator:239-243` (regex `/Budget|Plafond/` aussi sur « Budget invalide »).
- Dès que `pricing.json` donne un prix > 0, une mission créée sans budget explicite est annulée à la première action facturable. Le message « Budget invalide » (budgetCents absent sur d'anciens runs) déclenche aussi `budget_exceeded` + abort. Contraire à la décision « aucun plafond en phase de tests » si un prix est configuré.
- Correctif : budget par défaut `null` = illimité (seul le plafond mensuel s'applique), ou refus explicite à la création ; ne mapper en 402/abort que les vrais dépassements.

### 10. MINEUR / certain — Toute erreur serveur renvoyée en 400 avec message brut
- `apps/api/server.js:643-646`. Une erreur SQLite, un `TypeError` ou « Run introuvable » partagent le code 400 et `publicError` renvoie `e.message` (peut contenir des chemins locaux). Le front ne peut pas distinguer entrée invalide et panne.
- Correctif : classes d'erreur (`ValidationError` → 400, introuvable → 404, autre → 500 avec message générique et journal redacté).

### 11. MINEUR / probable — Corps JSON limité à 32 Ko pour `/api/runs`, `/api/plan`, etc.
- `apps/api/server.js:351`. Un prompt long (offre d'emploi collée, CV) ou beaucoup de pièces jointes déclenche « Requête trop volumineuse » ; l'erreur interrompt la lecture sans drainer le corps.
- Correctif : 256 Ko pour les routes de mission, message clair (413).

### 12. MINEUR / certain — Fichiers `.env*` non ignorés par git
- `.gitignore` ne contient que `.env` ; `.envforme` (non suivi, vu dans `git status` du dépôt principal) peut être commité par `git add -A`. Je ne l'ai pas lu.
- Correctif : ajouter `.env*` et `*.env` (hors exemples) au `.gitignore`.

### 13. MINEUR / probable — Écriture du cache `DataGateway` : une erreur disque fait échouer une requête réussie
- `packages/data-gateway/index.js:212-226`. `writeConfined` lève (disque plein, droits) après un fetch valide et facturé (meter ligne 143) : la requête échoue et sera refacturée au retry. Une entrée de cache trop grosse lève aussi `Réponse trop volumineuse` (`:138`) au lieu de compter comme un miss.
- Correctif : try/catch autour de l'écriture du cache ; traiter `entry.bytes > maxBytes` comme un miss.

### 14. MINEUR / probable — `loadPricing`/`loadAgentConfig`/`loadProbes` : JSON corrompu
- `packages/billing/index.js:58-62` : un `pricing.json` invalide (ou `null`) fait lever `JSON.parse`/`TypeError` à la construction de l'orchestrateur, donc l'API ne démarre pas. `loadAgentConfig` (`discovery.js:15`) lève, mais `detectAgents` l'attrape (OK). `saveProbe` écrit via `.tmp` + rename mais sans verrou : deux sauvegardes concurrentes se perdent mutuellement (lecture-modification-écriture).
- Correctif : démarrer avec le tarif par défaut et un avertissement visible ; sérialiser `saveProbe`.

### 15. MINEUR / certain — `Store` : aucun `busy_timeout`, pas de purge, `JSON.parse` fatal au démarrage
- `packages/storage/index.js:13-14,36-37`. Un second processus (script d'audit, `acp-audit-probe`) ouvrant la même base recevra `SQLITE_BUSY` immédiat (timeout 0) ; la table `events` ne se purge jamais ; une ligne `runs.data` corrompue empêche tout démarrage (la boucle de réconciliation n'a pas de try/catch).
- Correctif : `PRAGMA busy_timeout=5000`, try/catch par run au démarrage (marquer `interrupted`/ignorer), politique de rétention des événements.

### 16. MINEUR / probable — `store.event` : un écouteur SSE qui lève remonte chez l'appelant
- `packages/storage/index.js:96`, `apps/api/server.js:225-233`. `this.emit` est synchrone ; si `res.write` lève (socket détruite entre `open()` et le write), l'exception remonte dans `store.event` après l'INSERT, donc dans le code de mission (par ex. `update` d'état), pouvant faire échouer un run à cause d'un client web déconnecté.
- Correctif : try/catch dans l'écouteur SSE (`listener`) ou dans `emit`.

### 17. MINEUR / probable — Timeouts : une requête ACP expirée tue tout l'agent
- `packages/agent-runtime/index.js:270-279`. Tout dépassement de délai (`request` par défaut 30 s, ex. `setMode`, `setConfigOption`, `set_model`) appelle `this.close()` : le groupe de processus est tué pour une simple lenteur de configuration. Le prompt de 10 min est le seul à vraiment justifier cela.
- Correctif : pour les requêtes de configuration, tenter d'abord `session/cancel` / une erreur de session, et ne fermer qu'à l'échec de l'`initialize`/`session`.

### 18. MINEUR / doute — Bout de secret dans le diagnostic tronqué
- `packages/agent-runtime/index.js:178`. `redact(diagnostic + chunk).slice(-4000)` : un secret à cheval sur la coupure de 4000 caractères peut garder son suffixe en clair ; `redact` ne connaît que `AIza…`/`sk-…` plus les valeurs d'environnement dont le nom contient KEY/TOKEN/SECRET/PASSWORD/CREDENTIAL (un jeton nommé autrement, ex. `AUTH`, `COOKIE`, n'est pas masqué).
- Correctif : redacter après troncature en gardant 4000 + longueur du plus long secret de marge ; élargir la regex de noms.

### 19. MINEUR / certain — Code mort ou résiduel
- `packages/policy-engine/index.js:1-14` : `browserPolicy` (domaine figé `jobs.example.test`) n'est utilisé que par `FixtureBrowser` (`browser-gateway/index.js:15`) et les tests ; `allowedPermission` est utilisé. `packages/agent-runtime/process-liveness.js:5-24` : `isProcessAlive`/`isProcessDefinitelyDead` non utilisés dans le périmètre. `profiles.js:52` `methodId` (cf. 7). `billing` : dimensions « legacy » `workflow`/`search` conservées.
- Correctif : documenter ou retirer ; ajouter les usages ou supprimer `isProcess*`.

### 20. MINEUR / probable — Réimport d'un Skill tiers : retour en quarantaine même à contenu identique
- `packages/skill-registry/index.js:143-160`. Un réimport (même hash) remet `state: 'quarantined'`, `reviewedHash: null`, effaçant revue et activation ; une mission qui demande ce Skill échoue (« Skill désactivé, non revu ou modifié ») jusqu'à nouvelle revue. Pour career-ops, `reviewCareer` refait import+revue+install de façon synchrone, donc sans fenêtre visible, mais un import manuel casserait les missions.
- Correctif : si `previous?.hash === scan.hash`, conserver l'état et la revue.

## Ce qui bloque une mission de bout en bout (par ordre de risque)
1. Ledger quadratique (1) : ralentissement progressif puis gel de la boucle d'événements.
2. Message ACP > 1 Mio (4) : mission tuée par un outil renvoyant une capture ou un gros fichier.
3. Routage auto qui exclut un agent à cause d'un faux positif d'authentification (6).
4. Étape d'agent d'un workflow passant en `uncertain` (8) : run en attente humaine sans fin.
5. Budget 0 avec un tarif non nul (9).
6. Crash de l'API : agents orphelins qui continuent d'agir (2) et arrêt propre qui peut ne jamais finir (3).
7. Gemini par clé API sans `authenticate` (7), à vérifier avec une vraie clé hors de cet audit.

## Ce qui semble solide
- `AcpRuntime` : délais pausables pendant l'attente du propriétaire, arrêt du groupe de processus en SIGTERM puis SIGKILL avec sondes (EPERM/zombies macOS traités, pas de SIGKILL sur un pgid réutilisable), environnement enfant en liste blanche, secrets redactés dans messages, erreurs, événements et diagnostics, refus d'un mode non sûr, une seule session active par tour.
- `policy-engine/files.js` (lecture/écriture confinées sans symlink, inode neuf) et `http.js` (connexion épinglée sur l'adresse DNS validée, limites de taille avant et après décompression, pas de redirection suivie) ; `run-policy.js` (SSRF IPv4/IPv6 y compris `::ffff:`).
- `workflow-engine` : générations pour ignorer les réponses tardives, reprise après arrêt (écritures en `uncertain`, lectures rejouées), détection de blocage, annulation propre ; 57 tests ciblés verts.
- `Store` : réconciliation des runs non terminaux au redémarrage (état `interrupted`, question ouverte close et citée), migrations de ledger additives et idempotentes, ledger chaîné avec ancre.
- Frontière HTTP : contrôle Host/Origin, en-tête applicatif obligatoire pour les POST, corps borné et décodé en UTF-8 strict, écoute 127.0.0.1 imposée en mode propriétaire, service des fichiers web confiné par `realpath`, SSE sans écriture après fermeture.
- `skill-registry` : revue liée au hash exact, scan sans exécution ni suivi de lien symbolique, import git limité à github.com en https.
