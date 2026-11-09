# Audit orchestrateur — 10/11 (lecture seule)

Périmètre : `packages/orchestrator/*`, partie mission de `apps/api/server.js`. Aucun fichier de code
modifié. Preuves : lecture du code, petits scripts `node` sur `parseAgentResult`, `decisionRequest`,
`getPack`, `selectSkillIntents` (dans le scratchpad), et agrégats en lecture seule des bases locales
(`.data/platform.sqlite` : causes d'échec et nombres d'événements, sans contenu privé).

Légende : gravité **C** critique / **I** important / **m** mineur ; certitude certain / probable / doute.

---

## Critiques

### 1. [C · certain] Sans Skill, une mission a 3 minutes en tout
`packages/orchestrator/index.js:197` (`timeoutMs ?? 180000`), `:231-233`, `:1018` (`timeouts.prompt`).
Hors career-ops (donc toute mission `browser-agent` du mode propriétaire), le délai de la mission
**et** celui du tour ACP valent 180 s. Il ne se met en pause que pendant une question ou l'attente du
clic d'envoi.
*Scénario* : « candidate à cette offre <url> » sans Skill. L'agent navigue, capture, lit, remplit un
formulaire en deux étapes et téléverse le CV. Au bout de 3 min, la mission s'arrête avec
« Délai maximal dépassé » avant même la demande d'envoi.
Career-ops a 15 min (`:198`) : c'est juste pour la chaîne complète du Skill (évaluation, rapport,
CV adapté, PDF, suivi, formulaire). `AGENT_PLATFORM_TIMEOUT_MS` impose une seule valeur aux deux cas.
*Correctif* : prendre la valeur de career-ops (ou plus) pour `browserWorkflow`. Prévoir deux
variables séparées (cœur et career).

### 2. [C · certain] Le format de question que la plateforme demande fait échouer la mission
`index.js:1156` (consigne `browserWorkflow`), `result.js:11-19` et `:48-90`.
La consigne sans Skill dit « termine ta réponse par un objet JSON {"question":{…}} », puis
« Réponds uniquement en JSON {simulated,summary,evidence} ». `parseAgentResult` ne lit que le
**dernier** objet. S'il n'a pas `simulated/summary/evidence`, la réponse est déclarée « hors
contrat ». Vérifié : `texte + {"question":{…}}` donne `ok:false`, « Réponse hors contrat ».
*Scénario sans Skill* : l'agent demande « Quelle adresse e-mail utiliser ? » comme on le lui a dit.
La mission passe en `failed` et la question n'est jamais posée.
*Avec Skill* : le repli en prose (`:1203-1208`) prend le JSON brut comme résumé. `decisionRequest`
ne voit pas de question dans un paragraphe qui finit par `}`. La mission se termine `completed`,
l'agent attend une réponse qui ne viendra jamais, et le Bilan affiche du JSON brut.
*Correctif* : accepter un objet `{question}` seul (résumé = message de la question), ou fusionner
les deux derniers objets. Aligner la consigne sur le champ `question` de la réponse unique, comme le
font `DOUBT_RULE` et `CAREER_INSTRUCTIONS`.

### 3. [C · certain] Sans Skill, la preuve de navigation exigée après coup jette le travail fait
`index.js:1273-1285`, `:1453-1466`.
La vérification « Navigation non prouvée » se fait **après** la fin de l'agent. Si elle échoue, la
mission passe en `failed` et `result.summary` est remplacé par « Bilan\n- Cause : … ». La réponse de
l'agent est perdue, et le nombre d'envois approuvés n'est jamais dit (voir n° 8).
*Scénario* : reprise « oui, envoie ». L'agent ne fait qu'un `browser_click` sur « Envoyer », que le
propriétaire approuve, sans nouvelle capture. Comme `observed` contient l'événement du clic,
`answeredWithoutNavigation` est faux, et aucune capture n'est lisible. La mission échoue alors
qu'une candidature est peut-être partie. On compte 7 échecs « Navigation non prouvée » de ce type
dans `.data` (pack core).
*Correctif* : ne pas lever d'exception. Ajouter au Bilan une ligne « navigation non prouvée » et
garder le résumé. Ne pas exiger de capture dans un tour de reprise qui n'a fait qu'agir (clic, envoi).

---

## Importants

### 4. [I · certain] Une phrase de politesse devient une question qui bloque la mission
`questions.js:70-87`, `index.js:1226-1249`.
`decisionRequest` traite comme question le dernier paragraphe s'il contient `laquelle`, `lequel`,
`dis-moi`, `would you like`, `do you want`, ou s'il finit par `?`. Vérifié : « …l'offre à laquelle
tu voulais candidater. », « Le poste pour lequel tu postules est ouvert. », « Dis-moi si tu veux
autre chose. » et « Would you like me to also save the offer? » sont tous pris pour des questions.
*Scénario* : la candidature est préparée et l'agent conclut par une formule de politesse. La mission
passe en `awaiting_owner` sans limite de temps (par défaut), et `resumable` vaut false. En
career-ops, aucune autre mission privée ne peut démarrer (« Une seule mission privée à la fois »,
`:728-731`). Si le propriétaire annule, le résumé de l'agent est remplacé par « Bilan… Cause :
Annulée » (`:1453`). S'il refuse la question, `asked !== answered` et le contrôle `inboxUnprocessed`
saute (`:1405-1408`).
*Correctif* : retirer `lequel`, `laquelle`, `lesquel(le)s` (ce sont surtout des relatifs). Ne pas
déclencher sur une simple proposition de suite. Option : marquer la question « facultative » pour
que la mission reste `completed` et qu'une réponse ouvre une reprise. En cas d'annulation pendant
une question en prose, garder `agentValue.summary` dans le résultat.

### 5. [I · certain] « Candidate à cette offre » : ni l'intention ni le pack ne sont fiables
`packs.js:104-113`, `skill-router.js:230-274`, `domain-packs/career-ops/skill-manifest.yaml:525-529`.
L'intention `apply` ne connaît que `postule`, `candidature`, `apply` et `postuler`. « Candidate » et
« candidater » ne la déclenchent pas. Le choix du pack compare les mots-clés par **sous-chaîne** sur
le prompt **URL comprise** (`jobs`, `job`, `cv`, `profil`, `poste`…). Vérifié :
- « Candidate à cette offre https://example.com/careers/123 » → `core` ;
- la même avec `…/acme/jobs/4012345` → `career-ops` **sans intention** ;
- « I posted my resume… » → `career-ops` (`poste` ⊂ `posted`) ;
- « Ne t'arrête pas avant d'avoir postulé » → `core` (la clause négative est effacée).
Avec ou sans Skill, le chemin dépend donc du texte de l'URL. Côté career-ops sans intention, aucune
étape de candidature n'est suivie et le Bilan n'exige rien.
*Correctif* : ajouter `candidate`, `candidater`, `candidatez` et `postuler` aux phrases. Comparer les
mots-clés du pack par mot entier, sans les URL (même `normalize` que `selectSkillIntents`). Dire
dans le plan pourquoi tel pack a été choisi.

### 6. [I · certain] Le parseur rejette une réponse valide si le texte du tour contient un bloc ou une accolade
`result.js:48-60`. `text` cumule tous les messages du tour, y compris ceux écrits entre deux outils
(`index.js:1073`). Or le **dernier bloc ```json** passe avant le JSON brut final, et une `{` jamais
refermée avale tout ce qui suit. Vérifié : un bloc ```json de charge utile, puis le JSON final, donne
« hors contrat ». « Je vérifie la page {en cours… » suivi du JSON final donne « JSON invalide ».
Hors career-ops, seul « non structurée » se rabat sur la prose (`:1210-1219`). Les autres cas font
échouer la mission après le travail. On trouve un « JSON invalide… {"simulated":false,"summary":"Je
vérifie la p » réel dans `.data`.
*Correctif* : chercher le dernier objet conforme au contrat (en essayant les candidats de la fin vers
le début, blocs et texte brut confondus). À défaut, se rabattre sur la prose pour toute raison, pas
seulement « non structurée ».

### 7. [I · certain] Sans Skill, impossible de joindre un CV
`index.js:482-495`, `:736-742`.
Toute pièce jointe force `pack=career-ops` et le Skill, et refuse tout autre Skill. Une mission
`core` travaille dans un dossier temporaire vide (`:748-750`) : `browser_upload` n'a aucun CV à
envoyer.
*Scénario* : « candidate à cette offre » sans Skill, puis le propriétaire joint son CV dans la
reprise. `plan` bascule en `career-ops`, `previous.pack !== plan.input.pack` est vrai, et la reprise
est refusée (« Session non reprenable »).
*Correctif* : permettre une pièce jointe sans forcer le pack. Copier les pièces jointes dans le
dossier de la mission `core`, ou les exposer en lecture seule.

### 8. [I · certain] Sans Skill, le Bilan ne dit rien des envois
`index.js:1371-1377`. `formatSendLine` (approuvés, sans effet, à l'issue incertaine, sans issue
connue) n'est ajouté que pour `career-ops`. Pourtant `gatewayApproval` compte bien
`sendsApproved` et `sendCalls` pour toutes les missions (`:434-441`).
*Scénario* : sans Skill, l'agent écrit « candidature envoyée » alors que l'envoi a été refusé ou
s'est arrêté avant d'agir. Le Bilan ne contredit pas l'agent.
*Correctif* : ajouter la ligne d'envoi à toutes les missions dès que `sendsApproved` ou une
approbation refusée existe.

### 9. [I · probable] `execute()` lancé sans garde : une exception tardive arrête le serveur et laisse la mission bloquée
`index.js:805`, `:852` (`setImmediate(() => this.execute(...))`, sans `.catch`), `:1479-1490`,
`:1511`.
Dans le `catch`, `saveProbe` (écriture de fichier) passe **avant** `store.update(state: failed)`.
Dans le `finally`, `removeRunHomes` (un `rmSync` qui peut lever ENOTEMPTY/EPERM pendant que le CLI
écrit encore) passe **avant** `this.active.delete`. Aucun gestionnaire `unhandledRejection` n'existe
dans le dépôt, et Node 24 s'arrête sur un rejet non géré.
*Scénario* : `rmSync` échoue sur le home d'un agent. Le serveur s'arrête, ou bien la mission reste
dans `active` : un des 3 emplacements est occupé, le verrou de l'espace privé reste pris, et
`close()` boucle sans fin.
*Correctif* : `this.execute(...).catch(log)`. Mettre `removeRunHomes` et `saveProbe` dans un
try/catch. Faire `active.delete` et `store.update` d'abord.

### 10. [I · probable] Garde d'outil à 120 s : vraie cause d'échec, et armement trop large
`tool-guard.js:44-49`, `index.js:177`, `:927-940`.
Toute activité de la passerelle sans identifiant (`deliver(null)`) arme **tous** les appels ouverts,
y compris ceux que l'agent compose encore. Aucune réglette d'environnement n'existe pour
`toolIdleMs`. On trouve 4 échecs « Outil sans mise à jour depuis 120 s » en career-ops dans les
bases locales.
*Correctif* : n'armer que l'appel nommé, ou le plus ancien appel en attente. Rendre `toolIdleMs`
réglable. Faire émettre par la passerelle un battement (notification de progrès MCP) pendant les
outils longs.

### 11. [I · probable] Plafond de 4 000 mises à jour ACP par exécution
`index.js:1069`. Le compteur couvre tous les tours de réponse : morceaux de message, pensées,
`usage_update`, `tool_call_update`. Le maximum observé en local est de 1 995 événements `agent` pour
une seule mission (base dev). Une longue chaîne du Skill avec des questions y arrive : arrêt
« Trop d'événements », puis en privé « Exécution privée échouée ».
*Correctif* : ne compter que les `tool_call`, ou plafonner par octets ou par tour plutôt que par
mise à jour.

### 12. [I · probable] « L'agent n'a rien exécuté » écrit à tort sur une reprise rapide
`index.js:1063-1068`, `:1323-1336`.
La regex `/\bbrowser[_\.][a-z]/` ne reconnaît pas `mcp__platform__browser_click` (`_` puis `b` ne
font pas de frontière de mot ; vérifié). Avec l'adaptateur Claude, `browserToolObserved` reste donc
toujours faux. En career-ops, les preuves navigateur ne sont pas écrites dans `store.events` (seulement
dans `control.browserEvidence`). Quand la reprise dure moins de 15 s, le résumé est **remplacé** par
« L'agent n'a rien exécuté… ».
Dans `truth.js:300`, la regex de mots ne reconnaît pas « envoie » (elle cherche `envoy(?:e|er…)`).
*Correctif* : `(?:^|[^a-z0-9])browser[_.]` ; passer `control.browserEvidence.length > 0` ; corriger
la regex vers `envo(?:i|y)`.

### 13. [I · certain] Une seule intention suivie par mission
`skill-router.js:271-273` (`.slice(0, 1)`).
« Évalue cette offre et postule si le score dépasse 4 » donne `evaluate` seule (vérifié). Les étapes
de candidature ne sont ni suivies ni exigées. Le Bilan ne dit pas que la candidature n'a pas été
faite.
*Correctif* : garder toutes les intentions nommées par une phrase, dans l'ordre de priorité.

---

## Mineurs

### 14. [m · certain] Le plan annonce une décision que la plateforme ne demande pas
`index.js:645` dit au propriétaire : « saisies sensibles, téléversements et envois soumis à votre
décision ». En mode propriétaire, `permission()` (`:1531-1543`) accorde automatiquement tout ce qui
n'est pas `actionClass:'send'`, y compris une saisie sensible demandée par `gatewayApproval`.
*Correctif* : écrire « seul l'envoi final attend votre clic ».

### 15. [m · probable] Sans Skill, la vérification des liens part des événements bruts
`index.js:1276-1302`. `value.evidence = observed` contient les corps complets de la passerelle :
texte des pages et valeurs des formulaires, recopiés dans `result`. Ces corps n'ont pas de
`sourceId`. Un lien cité avec paramètres (`?currentJobId=…`) est donc marqué « sans lecture
prouvée » alors qu'il a été lu.
*Correctif* : utiliser `control.browserEvidence` (compact) pour `assessBrowserClaims` et pour le
résultat.

### 16. [m · probable] Le registre de facturation est revérifié en entier à chaque outil observé
`index.js:236-247` puis `storage/index.js:172-175` : `verifyLedger()` recalcule toute la chaîne de
hachage, en synchrone, à chaque `meter`. Le coût grandit avec l'historique et bloque la boucle
d'événements (ACP et passerelle). Si l'intégrité casse, le `meter` final (`:1421`) échoue **après**
la fin du travail et la mission passe en `failed`.
*Correctif* : vérifier une fois au démarrage, puis chaîner de façon incrémentale. Pour le `meter`
final, ne pas faire échouer la mission en mode propriétaire.

### 17. [m · doute] Reprise de session : message trompeur et repli fragile
`isolation.js:20-24`, `index.js:1100-1113`. Avec une authentification par clé API, le home de
l'agent est supprimé à la fin de chaque exécution. `session/load` échoue donc toujours et le Bilan
dit « la session précédente était introuvable ». Si `session/load` **expire**, `request()` ferme le
runtime (`agent-runtime/index.js:270-279`) et le repli `runtime.session(mcpServers)` échoue
(« Runtime fermé »).
*Correctif* : ne pas tenter `load` quand le home a été supprimé. En cas d'échec, relancer un runtime
neuf.

### 18. [m · doute] Délai MCP côté agent pendant l'attente du clic
Aucun réglage `tool_timeout_sec` (Codex : 60 s par défaut) ni `MCP_TOOL_TIMEOUT` n'est transmis
(`agent-runtime`). La plateforme attend le clic sans limite, mais l'agent peut annuler l'appel
lui-même. L'approbation est alors abandonnée et rien n'est envoyé.
*Correctif* : fixer ces délais très haut à la création de la session.

### 19. [m · probable] « Notes non vérifiées » se déclenche sur des dates ou des étapes
`index.js:1314-1320`. `/\b\d+(?:[,.]\d+)?\s*\/\s*5\b/` reconnaît « étape 3/5 » ou « le 12/5 ».
*Correctif* : n'utiliser que les notes que relève `turnTruth`.

### 20. [m · probable] Deux reprises simultanées partent de la même session
`index.js:736-742`, `server.js:400-424`. Rien ne marque l'exécution précédente comme consommée.
Hors career-ops, deux POST `/resume` lancent deux agents sur la même `sessionId`.
*Correctif* : poser `resumedBy` sur `previous` de façon atomique avant `plan()`.

### 21. [m · certain] Une reprise sans prompt rejoue l'ancien objectif
`server.js:405` (`body.prompt ?? old.prompt`). La consigne du point de reprise dit qu'`objective`
est le dernier message du propriétaire. « Relancer » renvoie donc « candidate à cette offre » comme
un ordre neuf. Le clic d'envoi protège.
*Correctif* : sans prompt, envoyer un objectif « reprends là où tu t'étais arrêté ».

### 22. [m · doute] Questions perdues ou mal comptées
`questions.js:22-26`, `index.js:1677-1683`. Une élicitation sans `requestedSchema` reçoit `cancel`
sans aucun événement, donc sans trace au Bilan. `MAX_QUESTIONS` ne compte que les questions en
prose ; les formulaires ACP ne sont pas limités.

### 23. [m · certain] Réglages incohérents
- La silence se règle par `AGENT_PLATFORM_AGENT_SILENCE_MS` (`server.js:96`) et par
  `AGENT_PLATFORM_SILENT_MS` (`index.js:181`).
- Le délai de mission utilise `Date.now()` alors que l'horloge des gardes est injectable
  (`:960-972`).
- `permission()` utilise le vrai `setTimeout` (`:1578`).

### 24. [m · certain] Code mort ou redondant
- `if (!control || …)` après `if (!control) throw` (`:262`, `:396`).
- `if (this.ownerMode && input.agent === undefined) v.agent = 'auto'` alors que zod met déjà
  `'auto'` par défaut (`:481`).
- `if (promptStarted)` répété après `if (!promptStarted) return` (`:1058-1061`).
- Double appel à `rateLimitState` (`:1047-1048`).
- Second `bridgeControl` identique dans la route `evidence` (`server.js:576`).
- `TurnGuard` (workflow) et `ToolGuard` (agent) font la même chose différemment : le mode workflow
  n'a pas la correction stall-01 du report d'armement.

---

**Ce qui bloque une candidature de bout en bout avec Skill** :
- le routage (« candidate », URL sans `jobs`, une seule intention : n° 5 et n° 13) ;
- une politesse finale prise pour une question, qui bloque l'espace privé (n° 4) ;
- la question JSON perdue (n° 2) ;
- les gardes trop courtes (15 min de mission, 120 s par outil, 4 000 événements : n° 1, 10 et 11) ;
- le faux « rien exécuté » sur une reprise rapide (n° 12).

**… sans Skill** :
- 3 minutes de mission en tout (n° 1) ;
- `{"question":…}` qui fait échouer la mission (n° 2) ;
- « Navigation non prouvée » qui jette le travail, surtout sur la reprise « envoie » (n° 3) ;
- le parseur fragile (n° 6) ;
- aucun CV joignable (n° 7) ;
- aucun envoi dit au Bilan (n° 8).

**Ce qui semble solide** :
- la file des questions et la suspension et reprise des délais (`pauses`, `pauseDeadlines`) ;
- l'attente sans plafond du clic d'envoi et l'abandon propre côté passerelle (E64) ;
- le suivi des issues d'envoi (E66) ;
- les verrous `activeSlots` et « une mission privée » vérifiés de nouveau après `await plan` ;
- la remise en `interrupted` au redémarrage, avec `resumable` exact ;
- la preuve d'étape par la passerelle (`proofs`, `channel`).
