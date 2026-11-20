# swarm-10 — Notes du copieur (portage depuis swarm)

Écrit le 21/11/2026 vers 04:25. Swarm lu en lecture seule à l'état `f1d25eb` ; rien n'en a été exécuté. Base de l'arbre :
`d3574af`. Seuls fichiers écrits : ce dossier.

## 1. Ce qui est copié

| Origine (swarm) | Lignes vérifiées | Porté dans `schema-resultat.js` |
|---|---|---|
| `src/workflows/json-schema-validator.ts` | 1-177 (fichier entier, conforme au plan) | `validateJsonSchema(schema, data)` (+ `validate`, `matchesType`, `typeOf`, `isPlainObject` internes) ; `findJsonSchemaShapeErrors` → `findShapeErrors(schema, path = 'schemaResultat', depth = 0)` |
| `src/utils/output-schema.ts` | 1-23 (conforme) | `isEffectiveOutputSchema` → `isEffectiveSchema` ; `normalizeOutputSchema` → `normalizeSchema` |
| `src/tasks/terminal-result-guard.ts` | 26-60 (conforme) | `getTaskOutputValidationError` → `validationError(schema, value)`, avec `invalidMessage(errors, schema)` et `MALFORMED_SCHEMA(detail)` |
| `src/tools/send-task.ts` | 61-69 (`checkOutputSchemaShape`) et 213-218 (texte du paramètre `outputSchema`) ; l'appel est ligne 245 (`superRefine`) | pas de code : décrit en 4 (contrôle au lancement, phrase du paramètre) |

Ordre des cas conservé : type (et arrêt si faux) → `required` → `enum` (arrêt) → `const` (arrêt) → `properties` → `items`.
Constantes : aucune dans swarm ; Relay ajoute `MAX_SCHEMA_DEPTH = 32`, `MAX_ERRORS = 20`, `MAX_VALUE_CHARS = 200`,
`MAX_SCHEMA_CHARS = 4000`.

Messages traduits (chemin racine : `racine` ; chemin par défaut du contrôle de forme : `schemaResultat`) :
- `<chemin> : type attendu « number », reçu string` ; `<chemin> : propriété requise absente « n »` ;
  `<chemin> : valeur "z" hors des valeurs permises ["a", "b"]` ; `<chemin> : valeur 4 différente de la valeur imposée 3`.
- Forme : `… : doit être un schéma JSON (un objet), reçu null` ; `.type : doit être un texte` ; `.required : doit être une
  liste de textes` ; `.enum : doit être une liste` ; `.properties : doit être un objet qui donne le schéma de chaque propriété`.
- `validationError` : texte du plan, parties fixes mot pour mot :
  `Le résultat ne respecte pas la forme demandée. Erreurs : <e1 ; e2 …>. Forme attendue : <JSON du schéma>. Corrige et rappelle resultat_rendre.`
  Les trois cas de swarm donnent ce même gabarit pour les deux premiers (« aucun résultat rendu », « le résultat n’est pas
  un JSON lisible » quand la valeur est un texte qui ne s'analyse pas) ; le troisième (schéma mal formé) donne
  `MALFORMED_SCHEMA` : « La forme demandée pour ton résultat est mal écrite et ne peut pas être vérifiée (…) : rends ton
  résultat dans ta réponse finale ; l’agent principal le recevra sans vérification. » (le levier ; swarm disait « demande à
  un opérateur ou force-complete », sans équivalent chez nous). Ce texte-là n'est pas dans le plan : au codeur de le garder
  ou de le faire trancher.

## 2. Ce qui est écarté

- `guardTerminalTaskResultWrite` (`terminal-result-guard.ts:62-135`), comme le plan le demande : chez nous un seul écrivain.
- `overwriteTerminalTaskResultText`, `scrubSecrets`, les types `TerminalResultWrite` et `AgentTask` (base de swarm).
- Le reste de `send-task.ts` (zod, Slack, `agentId`, `followUpConfig`, héritage du schéma de la tâche mère) : chez nous pas
  d'héritage ; `{}` reste « pas de schéma ».

## 3. Pièges lus dans swarm, et ce que fait le portage

1. **Schéma mal formé `{ properties: { a: null } }`** (piège nommé par le plan). Chez swarm : `validateJsonSchema` lit
   `schema.type` du sous-schéma `null` et **lève** (`TypeError`, lecture de `null.type`) dès que la valeur a la propriété
   `a` ; si la valeur n'a pas `a`, il ne lève pas et **accepte en silence**. Swarm s'en garde à deux endroits : le contrôle
   de forme à l'entrée de `send-task` (`checkOutputSchemaShape` → `findJsonSchemaShapeErrors`, erreur zod sur
   `outputSchema`), puis un `try/catch` dans `getTaskOutputValidationError` (une tâche créée avant ce contrôle ne doit pas
   rester bloquée hors d'un état terminal). Dans le portage : `findShapeErrors` le refuse (`schemaResultat.properties.a :
   doit être un schéma JSON (un objet), reçu null`) ; `validate` ne lève plus (un sous-schéma qui n'est pas un objet devient
   une erreur `a : forme mal écrite …`) ; `validationError` passe d'abord par `findShapeErrors` puis garde le `try/catch` :
   il rend `MALFORMED_SCHEMA(…)` et ne lève jamais. Essayé (voir 6).
2. **`{}` = pas de schéma** (`output-schema.ts`) : un agent à qui l'on dit « rends un JSON conforme à `{}` » finit avec le
   texte littéral `{}` et perd son vrai résultat. `isEffectiveSchema({})` est faux ; `validationError({}, x)` rend
   `undefined` ; le codeur ne doit ni écrire `famille.schemaResultat`, ni la phrase, ni `schema-resultat.json` pour `{}`.
3. Les mots-clés non gérés (`oneOf`, `anyOf`, `$ref`, `pattern`, `format`, `additionalProperties`…) sont ignorés sans
   rien dire : la phrase du paramètre (plan) ne cite que type, required, properties, enum, const, items. Un `type` inconnu
   (`"integer"`, `"null"`) n'est pas contrôlé non plus (cas `default` de swarm).

Adaptations de Relay (pas dans swarm), à garder ou retirer en connaissance de cause :
- `required` et `properties` regardent les propriétés **propres** (`hasOwnProperty`) : chez swarm `key in obj` tient
  `toString` ou `constructor` pour présents sur tout objet.
- Profondeur bornée (32) dans `findShapeErrors` : un schéma de milliers de niveaux ferait déborder la pile (essayé : 5 000
  niveaux → une erreur « schéma trop profond », rien ne lève). Le validateur n'est appelé que sur un schéma déjà contrôlé.
- Textes bornés : 20 erreurs au plus (« ; et N autre(s) »), chaque valeur citée à 200 caractères, le schéma cité à
  4 000 caractères (un tableau de 50 000 éléments faux ne fait pas un message de plusieurs Mo).
- `JSON.stringify` protégé (`same`, `json`, `shown`) : rien ne lève sur une valeur non sérialisable.

## 4. Ce que le codeur doit savoir — endroits de Relay (repérés par nom et texte à `d3574af`)

`schema-resultat.js` est pur (aucun import) : le copier tel quel en `packages/orchestrator/schema-resultat.js`, l'en-tête
de licence (4 lignes, une par origine) en tête. `VERDICT_SCHEMA`, `verdictErrors` et la classe `ResultatValide` vont dans
`packages/orchestrator/resultat-valide.js` (non portés : rien de swarm à copier ; ils dépendent de Relay).

**`packages/orchestrator/delegation.js`**
- Constructeur `constructor(engine)` : la dernière ligne est `this.carnet = new Carnet(this); // equipe-carnet` ; ajouter
  après `this.resultats = new ResultatValide(this)`. Import voisin : `import { CARNET_TOOLS } from './delegation-rule.js';`.
- `async call(motherId, token, body, signal)` : après le contrôle du jeton, la ligne
  `if (CARNET_TOOLS[body?.tool]) return this.carnet.call(mother, control, body);` est **avant** le refus 403 « Outils de
  mission non prêtés à cette mission » : y mettre juste après la ligne `RESULT_TOOLS` du plan (sinon une sous-mission
  serait refusée par ce 403). `mother` y est bien l'exécution qui appelle (la sous-mission, quand c'est elle).
  `Carnet.call(run, control, body)` (carnet.js) est le modèle à suivre : `safeParse` du schéma zod, erreur
  `parametres_invalides` (5 premières issues), `control.toolDelivered?.(null, 'gateway')`, réponses `{ status, body }`.
- `async launch(mother, control, args)` : les contrôles de paramètres sont, dans l'ordre : `introuvable` (ids de
  apres/relit/reprend/continue), `parametres_invalides` « reprend — une sous-mission finie sans succès », `doublon`
  (swarm-05), puis les **deux contrôles de swarm-08** : `agent_indisponible` pour un agent nommé par le chef (`chiefAgent &&
  !forced`, avant `taskOf`) et `agent_indisponible` quand l'agent choisi par la plateforme est indisponible sans remplaçant
  (`if (why && !instead)`, après le contrôle d'enveloppe). Le contrôle `findShapeErrors` de `schemaResultat` doit se
  placer **juste après le contrôle `reprend`** : avant `askExtension` (le contrôle d'enveloppe pose une carte au
  propriétaire), avant `this.resultsFolder(…)` (qui crée le dossier) et avant `family.pending++`. Ne le faire que si
  `isEffectiveSchema(args.schemaResultat)`.
- `briefs` : `this.briefs.set(run.id, { fichiers, soeurs, part, …tache, …role })` après la création ; ajouter
  `schemaResultat` (absent sans schéma effectif). L'écriture de `<folder>/schema-resultat.json` par `writeConfined(mother.cwd,
  …)` vient au même endroit ; `folder` peut être `null` (`resultsFolder` rend `null` si `safeDirectory` échoue) : alors pas de
  fichier, et le schéma ne survit pas à un redémarrage (à dire).
- `promptParts(run, servers)` : objet `famille` (ajouter `...(brief.schemaResultat ? { schemaResultat } : {})`) et la dernière
  ligne `daughterRule(dossierResultats, brief.role?.consigne ? brief.role : null, !!previous)` (trois arguments aujourd'hui :
  le quatrième du plan est donc bien le quatrième).
- `outcome(child)` : rend `{ id, titre, etat, reponse, bilan, fichiers, envois, cause, …verdict }` ; ajouter
  `...(of(child) ? { resultat: … } : {})` à la fin. `verdictOf(child)` y est appelé deux fois (lecture de fichier à chaque
  fois) : ne pas ajouter une troisième lecture pour le verdict.

**`packages/orchestrator/delegation-rule.js`**
- `mission_lancer` (dans `MISSION_TOOLS`) : schéma zod `.strict()`, champs commentés par lot ; ajouter
  `schemaResultat: z.record(z.string(), z.unknown()).optional()` et la phrase du plan à la fin de la `description`.
- `daughterRule = (folder, role = null, suite = false) => roleRule(role) || suite ? daughterRule(folder).replace(DAUGHTER_HEAD,
  …) : folder ? … : DAUGHTER_RULE` : **récursive** ; avec un rôle ou une suite elle se rappelle avec `folder` seul. Le
  quatrième argument doit traverser cet appel (sinon la phrase du schéma disparaît pour un membre qui a un rôle).
  `tests/equipe-01-roles.test.js` exige `daughterRule('x/') === daughterRule('x/', null)` et
  `daughterRule(undefined, null) === DAUGHTER_RULE` : sans schéma, rien ne doit changer.
- `VERDICT_RULE` : commence aujourd'hui par « écris ton verdict dans le fichier verdict.json de ton dossier de résultats : … ».
  Les tests lisent la constante (`rule.VERDICT_RULE`), pas son texte : le préfixe du plan ne casse rien.
- `CARNET_TOOLS = { carnet_noter, carnet_lire }`, chacun `{ description, schema: z.object(…).strict() }` : même forme pour
  `RESULT_TOOLS`. `CARNET_SERVER = 'relay-equipe'`.

**`packages/mission-gateway/server.js` (`GW`)** : ligne 14 `const TOOLS = onlyCarnet ? CARNET_TOOLS : { ...MISSION_TOOLS,
...CARNET_TOOLS };` ; ajouter `RESULT_TOOLS` à l'import de la ligne 12.

**`tests/fixtures/chef-agent.js` (`CHEF`)** : modèle à suivre, le bloc « equipe-carnet » (`NOTER[…]{…}`, `LIRE:`) :
`connectMcp(servers.find((s) => s.name === 'relay-equipe'))`, `callTool` qui note `{ name, args, isError, result }`, journal
`equipe-<pid>.json` avec `tools` (liste lue par `listTools`). Le marqueur existant `VERDICT_JSON:<json>` écrit `verdict.json`
directement : `RESULTAT:<json>` s'ajoute à côté (attention, `RESULTAT:` ne doit pas être reconnu dans `VERDICT_JSON:`).

**`packages/orchestrator/roles.js`** : `normalizeVerdict(raw, source)` (borne chaque champ, rend `null` hors des trois valeurs
après `roleKey`, marque `complet: false` un `a_corriger`/`rejete` sans point bloquant au `pourquoi` non vide — swarm-04) et
`readVerdict({ cwd, folder, answer, since, until })` (lit `<folder>/verdict.json` par `readConfined`, **20 Ko au plus**
(`MAX_VERDICT_BYTES`), seulement s'il a été écrit entre `since` et `until`, sinon la ligne « Verdict : » de la réponse).
`verdictErrors` devrait reprendre le même critère que `normalizeVerdict` (un point bloquant dont `pourquoi` n'est pas vide),
pour que l'outil refuse exactement ce que la plateforme marquerait incomplet.

**`writeConfined(root, path, data)`** (`packages/policy-engine/files.js`, déjà importé par delegation.js) : écriture
atomique (fichier temporaire puis `rename`), refuse un lien symbolique, `safeDirectory` contrôle le dossier ; elle lève en
cas de refus : l'appeler dans un `try`.

## 5. Écarts entre le plan et le code intégré (à trancher par le manager)

1. **Test existant cassé par `GW`** : `tests/equipe-01-carnet.test.js` (test E3, vers la ligne 249) exige
   `assert.deepEqual(log.tools, ['carnet_noter', 'carnet_lire'])` pour le serveur d'une sous-mission. Avec
   `{ ...CARNET_TOOLS, ...RESULT_TOOLS }`, la liste devient `[…, 'resultat_rendre']` : rouge, alors que le plan veut ce
   fichier vert sans modification.
2. **Taille** : la route `/api/internal/missions/<id>` (`apps/api/server.js`, lecture du corps) refuse tout corps de plus de
   **32 768 octets** (« Requête trop volumineuse » ; 300 000 seulement pour `evidence|approvals`). Le plafond de 200 000
   caractères du plan n'est donc jamais atteint : un résultat de plus de ~32 Ko échoue avant la plateforme. `SV` n'est pas
   dans les fichiers du lot.
3. **Verdict de plus de 20 Ko** : un `verdict.json` écrit par l'outil (jusqu'à 200 000 caractères selon le plan) dépasse
   `MAX_VERDICT_BYTES` ; `readVerdict` retombe alors sur la réponse. Borner le verdict à 20 Ko dans l'outil, ou lire le
   verdict par `of(child)` d'abord.
4. **Racine non objet** : `resultat` est un `z.record` (objet). Un `schemaResultat` dont la racine a `type: 'array'` (ou
   `string`…) ne peut jamais être satisfait ; le contrôle de forme de swarm ne le voit pas. À refuser au lancement (racine
   sans `type` ou `type: 'object'`) ou à dire dans la phrase.
5. **Suite (`mission_continuer`)** : elle n'a pas de `schemaResultat` et reprend le dossier de résultats de la précédente ;
   `schema-resultat.json` y reste. Si `schemaOf` lit ce fichier, la suite hérite du schéma alors que `briefs` ne l'a pas :
   choisir (hériter, ou ne lire le fichier qu'après un redémarrage).
6. **Numéros de ligne du plan** (commit `113e8d9`) : `daughterRule` est maintenant vers 139-147 (plan : 118-126),
   `VERDICT_RULE` vers 131-132 (plan : 110-111), `call()` vers 858, `launch()` vers 921, `briefs.set` vers 1177,
   `outcome()` vers 1506, constructeur vers 135. Lignes de swarm citées par le plan : toutes confirmées.
7. Le texte `MALFORMED_SCHEMA` (cas 3 de swarm) n'est pas cité par le plan ; le refus au lancement le rend rare.

## 6. Vérifications faites

- `node --check .manager/portage/swarm-10/schema-resultat.js` : sans erreur ; formaté par `npx prettier --write`.
- Essai par `node --input-type=module -e` (import du seul fichier porté) : type, `required`, `enum`, `const`, propriétés
  imbriquées, `items` donnent les messages attendus ; `required: ['toString']` sur `{}` → erreur ; `{}` et `undefined` →
  `undefined` ; `{ properties: { a: null } }` → une erreur de forme, `validationError` rend `MALFORMED_SCHEMA`,
  `validateJsonSchema` rend une erreur, rien ne lève ; texte non JSON → message « JSON lisible » ; schéma de 5 000 niveaux →
  une erreur « trop profond » ; tableau de 50 éléments faux → message borné (20 erreurs).
- Non vérifié : le comportement de zod et du SDK MCP avec `z.record(z.string(), z.unknown())` comme paramètre d'outil
  (rien lancé) ; aucun test de Relay lancé (rôle de copieur).
