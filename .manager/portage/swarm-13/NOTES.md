# Portage swarm-13 — Tour de rattrapage sur un verdict négatif (copieur, 21/11/2026 05:38)

Base `a8660a4`. Seul ce dossier est écrit. `node --check dettes.js` passe. Essais par `node --input-type=module -e`
(cas réel `f419245a`, suite approuvée, suite non revérifiée, vérificateur relisant une ancienne tentative, verdict
illisible, vivante, `nonRemises` liste/nombre, lignes du store et lignes aplaties du Bilan, boucle x↔y, entrées
`undefined`/`null`/chaîne/nombre/`[null,1,'a',{}]`) : résultats attendus, aucune levée.

## 1. Copié de swarm (lecture seule ; passages confirmés)

| Origine | Lignes du plan → trouvées | Porté en |
| --- | --- | --- |
| `src/workflows/validation.ts` (fin de `runStepValidation`) | 99-116 → 99-116 (exact ; `if (validation.mustPass)` l. 101, commentaire « advisory » l. 115) | règle de `dettes` : un verdict négatif ne passe jamais en silence ; le tour reçoit le verdict (`verdictsEnAttente`) comme leur `retryContext { previousOutput, validationResult }` |
| `src/workflows/engine.ts` (étape 7, validation) | 1228-1262 → 1228-1262 (exact ; « Bug 7 fix » l. 1243-1249) | commentaire de `dettes` : l'historique s'ajoute, n'est jamais écrasé ; chez Relay chaque verdict reste dans le dossier de son vérificateur, seul le dernier par tâche fait foi |
| `specs/tla/workflows/FINDINGS.md` « Root causes » | 255-283 → 255-268 (les cinq causes) ; 270-282 = « Fix-model iterations » | § 2 ci-dessous ; cause 5 citée dans `dettes` |

Écarté : `halt` (Relay n'arrête pas la mission : le chef décide, le Bilan dit), le compteur de rejeux et la
politique de reprise (`retryPolicy`, `checkpointStepFailure` : la borne est le `familyTurn` du moteur, un tour),
le routage par port (`resolveValidationPort`), toute base (`ctx[historyKey]`), `async`.
Piège lu (engine.ts:1243) : un rejeu qui ÉCRASE le contexte du verdict précédent perd l'historique ; chez Relay
ne rien réécrire dans les verdicts, les relire (`verdictOf`) à chaque fois.

## 2. Les cinq causes racines de leur analyse (FINDINGS.md:255-268), citées et traduites

1. l. 257-259 « **Dead dedup.** `executeStep` keys the step on `COUNT(*)` of the node's rows, so the key is always
   new and the memo branch never fires. » → *Déduplication morte : la clé d'étape vient du nombre de lignes du nœud,
   elle est toujours neuve et la mémoire ne sert jamais ; un second parcours crée une seconde exécution.*
2. l. 260-262 « **Guards that are process-local or read outside the write.** » → *Gardes locales au processus ou lues
   hors de l'écriture : `activeWalks` ne couvre ni le rejeu, ni les gestionnaires entre la prise et le parcours ; la
   porte d'amorçage est lue hors de la transaction.*
3. l. 263-264 « **"Not completed" used as "ready".** » → *« Pas fini » pris pour « prêt » : on ignore les nœuds en
   cours, en attente de rejeu ou pas encore atteints.*
4. l. 265-266 « **Retry-pending rows look terminal.** » → *Une ligne en attente de rejeu a l'air finie : finie pour
   l'annulation, vivante pour le rejeu.*
5. l. 267-268 « **Finalizers that ignore `running` rows.** » → *Des finaliseurs qui ignorent les lignes en cours :
   ils traitent comme réglée une étape qu'on exécute encore (le run est marqué fini alors qu'il doit encore).*

Lecture pour Relay : 5 = ce que le lot corrige (la mère finit alors qu'elle doit un verdict) ; 2 = notre drapeau doit
être là où on écrit (dans `synthesis()`, au moment de rendre le tour), pas lu ailleurs ; 4 = un verdict illisible
(vérificateur en échec) ne doit pas passer pour « réglé » : il compte comme dette ; 1 = un tour ne doit pas se
dupliquer (synthèse + rattrapage) ; 3 = « pas de vivante » n'est pas « rien à devoir ».

## 3. `dettes({ children, nonRemises })` (à verser dans `taches.js`, sous `dernierVerdictParTache`)

Rend `{ vivantes, nonRemises, verdictsNegatifs: [{ tache, titre, valeur, complet, illisible?, bloquants, par }] }`.
- `vivantes` : NOMBRE de lignes dont l'état n'est pas fini (`completed|failed|cancelled|interrupted`) ; une ligne
  sans état compte vivante (même règle que `agregat().enCours`). `nonRemises` : nombre (tableau → sa longueur ;
  entier > 0 gardé ; sinon 0). Choix du copieur : des nombres, la décision « rien d'autre à remettre » suffit.
- `tache` : id de la 1re tentative ; `titre` : celui de la 1re tentative (`parTache().premiere`) ; `valeur` :
  `a_corriger` | `rejete` ; `complet` : `verdict.complet !== false` ; `bloquants` : 10 au plus (`MAX_BLOQUANTS`,
  chacun `{ ou, pourquoi }` déjà borné à 500 car. par `normalizeVerdict`) ; `par` : id du vérificateur (la ligne
  qui porte cet objet verdict, même référence : passer les lignes une seule fois par `verdictOf`).
- `illisible: true` (champ ajouté par le copieur, absent sinon) quand `source === 'absent'` : le texte doit le dire
  (plan, « Risques »). À garder ou retirer par le codeur ; il ne change pas la forme sans illisible.
- Versement : supprimer l'import et les aides recopiées (`objet`, `liste`, `texte`, `etatDe`, `titreDe`, `FINIS`
  existent déjà dans `taches.js`, mêmes règles).

**Ce qu'est une dette, sur les données réelles.** Lignes en ordre de lancement, `verdict` lu par `verdictOf(child)`
(null tant que le vérificateur n'est pas fini ou n'a jamais démarré), `relit` = `famille.relit`. Pour chaque
vérificateur et chaque id relu, le verdict compte pour la tâche de cet id SEULEMENT si cet id est la dernière
tentative de la tâche lancée avant le vérificateur ; le dernier tel verdict de la tâche fait foi
(`dernierVerdictParTache`, même règle que `verificationLines` de `roles.js`). Dette = ce dernier verdict ≠ `approuve`.
- Cas `f419245a` : `T1 completed` ; `V1 completed relit [T1]`, verdict `a_corriger` → dette `{ tache: T1, par: V1 }`.
- `T1`, `V1 a_corriger`, `S1 (famille.continue: T1) completed`, `V2 relit [S1] approuve` → aucune dette.
- Même chose mais `V2 relit [T1]` (ancienne tentative) → `V2` ignoré, dette `V1` reste. Le vérificateur doit relire
  l'id de la SUITE ; à dire dans `docs/api-verdicts.md`.
- `T1`, `V1 a_corriger`, `S1` suite non revérifiée → dette (c'est « non revérifié depuis » du Bilan).
- Vérificateur `failed` après démarrage → `readVerdict` rend `{ valeur: 'a_corriger', source: 'absent',
  complet: false }` → dette `illisible`. Vérificateur jamais démarré (annulé, retenu) → pas de verdict, rien.
- Vérificateur encore vivant → pas de verdict, mais `vivantes > 0` : c'est le tour de synthèse, pas le rattrapage.
- `approuve` suivi d'une suite non revérifiée → pas de dette (le plan ne vise que les verdicts non approuvés).

## 4. Le code intégré (`a8660a4`), par nom et texte

**`synthesis(motherId, control, runtime)`** (`delegation.js`, async) : `if (!control?.mere) return null;` →
`mother`, `living = this.living(mother)`, `family = this.family(motherId)`,
`given = [...living, ...this.undelivered(mother, family)]` ; **`if (!given.length) return null;`** (la ligne qui
devient `return this.verdictTurn(mother, family, runtime)`) ; puis `if (runtime.continueSession()) { if
(living.length) await this.waitLiving(...); if (!control.abort.signal.aborted && runtime.continueSession()) return
{ familyResults: { nature: 'données rapportées par les sous-missions', terminees: given.map(deliver),
...this.carnet.forChief(mother), ...this.retoursSynthese(mother) }, instructions: SYNTHESIS_TURN }; }` ;
sinon `this.missed(family, given); return null;`. swarm-12 a ajouté `...this.retoursSynthese(mother)` (`agregat`,
`demande`, chacun absent quand vide). `verdictsEnAttente` se joint après `retoursSynthese`, calculé APRÈS
`waitLiving` (les vérificateurs finis pendant l'attente comptent), et `instructions: SYNTHESIS_TURN + ' ' +
VERDICT_NOTE` seulement quand il y a une dette.
**`familyBilan(run, { chiefAnswer, motherSends })`** : `hasFamily(run)`, lignes `childrenOf(mother)` sans
`REFUSED_CHILD`, `familySection({ accord, synthese, chiefAnswer, motherSends, children: [... { id, titre, state,
reprend, suiteDe, role, relit, verdict: this.verdictOf(child) }] })` (lignes APLATIES : `dettes` les lit telles
quelles), puis `motifLine`. Ligne neuve : après `section` (avant ou après `motifs`, à décider), quand
`dettes({ children: lignes }).verdictsNegatifs.length`. `familySection` contient déjà `verificationLines` («
« T » : dernier verdict …, non revérifié depuis ») : même règle, donc la ligne neuve et ces lignes concordent.
**L'objet `family`** (`family(rootId)`, en mémoire, clé = id de l'EXÉCUTION de la mère) : `rootId, held, launched,
pending, asking, waiters`, puis `closing` (settle), `delivered`, `unsynthesized`, `consentAsked`. Oublié
(`forget`) seulement quand la mère est finie : le Bilan (`bilanSection`, index.js l. ~2183, après `settle`) le lit.
**`runtime.continueSession()`** (`agent-runtime/index.js`) : `false` si `stopped`, sans `sessionId` ou
`promptActive` ; sinon POSE `this.ready = true` et rend `true` : effet de bord, d'où « l'appeler en dernier ».
**Moteur (`index.js`, lecture seule)** : `let familyTurn = false;` avant la boucle des tours ; quand le tour n'a ni
question ni message du propriétaire en attente : `const results = familyTurn ? null : await
this.delegation.synthesis(run.id, control, runtime); if (!results) break; familyTurn = true;` puis
`nextTurn(JSON.stringify({ ...results, platform: { turnKind: 'family_results' } }))`, contrôle d'abandon et de
`stopReason`, `agentValue = readResult(); continue;`. La réponse de ce tour REMPLACE la réponse finale. Après la
boucle : `closeOwnerMessages`, `await this.delegation.settle(run.id, control)`, puis le Bilan.
**`taches.js`** : `parTache(children)` → Map tâche → `{ premiere, derniere, tentatives, suites }` ;
`dernierVerdictParTache(children)` → Map tâche → objet verdict (le dernier valable ; pas le vérificateur, d'où
`par` retrouvé par référence). **`roles.js`** : `normalizeVerdict(raw, source)` (valeur parmi `approuve |
a_corriger | rejete`, 20 bloquants/remarques au plus, 500 car. ; `complet: false` ajouté seulement à un
`a_corriger`/`rejete` sans `pourquoi`) ; `readVerdict` (fichier `verdict.json` écrit pendant l'exécution, sinon
dernière ligne « Verdict : … », sinon `{ a_corriger, source: 'absent', complet: false }`) ; `verdictWords` dit
« illisible (aucun verdict rendu) ». **`delegation-rule.js`** : `SYNTHESIS_TURN` (« Tes sous-missions encore en
cours … reprends-y l'essentiel. »), `synthesisMissed(titles)`, `VERDICT_RULE` ; `VERDICT_TURN` et `VERDICT_NOTE`
iront à côté de `SYNTHESIS_TURN`. **Réglages** : lus au constructeur de `Delegation`
(`this.lent = process.env.AGENT_PLATFORM_DELEGATION !== '0'`, `this.doublon = …AGENT_PLATFORM_DOUBLON…`) :
`AGENT_PLATFORM_VERDICT_TURN` se lira de même (`!== '0'`), d'où un test qui pose la variable AVANT `new
Orchestrator`.

## 5. Écarts entre le plan et le code, risques de boucle

- Lignes : `synthesis()` est à DJ ~336-357 (plan : 262-284), `familyBilan()` ~466-510 (plan : 375-410), l'appel du
  moteur à IX ~1842-1872 (plan : 1838-1840). FINDINGS : causes 255-268, pas 255-283.
- **`control.mere`** : la 1re ligne de `synthesis()` rend `null` pour une exécution qui n'a rien lancé ELLE-MÊME
  (une mère REPRISE qui ne relance rien : `estMere` sur la ligne, `control.mere` faux). Pas de rattrapage alors,
  mais `familyBilan` (via `hasFamily`/`estMere`) écrira la ligne « … tour de rattrapage donné au chef : non ».
  Le plan dit seulement « après une reprise, un tour peut être donné de nouveau » : c'est vrai seulement si la
  reprise relance une sous-mission.
- **Double tour** : impossible par le moteur (`familyTurn`, un tour de famille par exécution). Quand le tour de
  synthèse joint `verdictsEnAttente`, le plan ne dit pas de poser `family.verdictTurn = true` : il le faut pour
  que le Bilan dise « tour donné : oui » (cas 4) et pour l'événement `verdict_turn` (à décider : l'écrire aussi).
- **Boucle** : `verdictTurn` n'est appelé que par `synthesis()`, elle-même une fois par exécution ; après le tour
  de rattrapage, si le chef laisse vivre une correction ou une revérification, `synthesis` n'est plus appelée :
  `settle()` attend et le Bilan porte « Synthèse finale non faite » ; le verdict lu à la fin peut alors être
  `approuve` (pas de ligne « malgré ») alors que le chef ne l'a pas vu. Le texte VERDICT_TURN demande
  `mission_attendre` : bien.
- **Session fermée** : `continueSession()` en dernier dans `verdictTurn` ; si faux → `null`, pas d'événement, pas
  de drapeau → Bilan « non ». Abandon : `verdictTurn(mother, family, runtime)` ne reçoit pas `control` ; suggérer
  de tester `control.abort.signal.aborted` dans `synthesis()` avant l'appel (sinon le moteur part dans un
  `nextTurn` abandonné, puis lève l'abandon : sans dégât mais un tour inutile).
- **Mémoire seulement** : `family.verdictTurn` vit en mémoire ; l'événement `verdict_turn` est durable : pour le
  Bilan d'un échec ou après redémarrage, lire l'événement est plus sûr (au choix du codeur).
- **Ordre des lignes** : `childrenOf(mother)` met les sous-missions de l'exécution courante AVANT celles des
  exécutions reprises (`chain` remonte) : sur une mère reprise, « dernier verdict » et « dernière tentative avant »
  peuvent être faux. Défaut préexistant, partagé avec `verificationLines` ; non corrigé ici.
- Coût : `verdictOf` lit un fichier par vérificateur à chaque appel ; `verdictTurn` est appelé une fois.

## 6. Non vérifié

Rien n'est branché : ni `verdictTurn`, ni le Bilan, ni les textes ; aucun test Relay lancé (rôle copieur). Le
comportement d'un vérificateur `interrupted` au redémarrage (verdict `absent` ?) n'est pas essayé.
