# swarm-14 — Mesure du coût réel d'une équipe (codeur)

Codeur, 21/11/2026, début 09:36 (horloge lue). Arbre `/Users/diaw/Downloads/agregat-back-swarm-14`, branche `swarm-14`,
base `e7f4964`, portage du copieur `15178ef`.

## Journal

- 09:36 Lecture : brief commun (en-tête, 1-5, 7, 9), plan (13-19, 309-345, 1075-1124, partie 3 sur `usage`),
  `NOTES.md` et `usage-swarm.js` du portage, puis les fichiers à modifier autour des endroits nommés.
- Installé `packages/agent-runtime/usage.js` (en-tête de licence en première ligne, lectures du portage reprises).
- Branchements : `RT` (`prompt()`, `handleUpdate()`, `usage()`), `IX` (une instruction dans le `finally`), `DJ`
  (`ended()`, `doneOf()`, `wait()`, `familyBilan()`), `FB` (ligne « Consommation »), `CHEF` (option `usage`).
- Premier passage des tests du lot : 2 rouges, tous deux dans le test lui-même ou le faux agent : (1) le
  `usage_update` produit, comme avant ce lot, un événement `agent` (la mise à jour part vers la mission) : la
  comparaison « mission identique » l'écarte désormais ; (2) le membre « A » n'annonçait rien : le faux agent cherchait
  « MUET » dans tout le prompt, où figure la part de la sœur « B » (`membres`, swarm-05) ; il le cherche maintenant
  dans la seule consigne (`objective`). Ensuite 10/10 verts.
- Contrôles négatifs faits (puis code remis, vérifié par `git diff --stat`) : retirer `usage` de `this.finals` dans
  `ended()` → le test de la vue d'équipe rougit (0/1) ; retirer `addPromptUsage` de `prompt()` → 3 tests rougissent
  (7/10).
- 09:47 Garde ajoutée dans `wait()` : la lecture de l'horloge passe par `sur()` (une horloge injectée qui lèverait ne
  sauterait plus `family.waiting--`). Tests du lot et de la délégation relancés : 104/104. Phase unitaire relancée
  sur le code final.

## Fait

- `packages/agent-runtime/usage.js` : `coutAnnonce`, `contexteAnnonce`, `jetonsDuTour` (portage, plus `thoughtTokens`
  → `reflexion`), `createUsage()`, `addPromptUsage(u, response)`, `addUpdate(u, update)`, `publicUsage(u)`. Aucune ne
  lève (gardes `try/catch`, Proxy hostile testé). Cumul : par tour, additionné ; `usage` absent/null/forme inconnue :
  tour ignoré ; nombre non fini ou négatif : ignoré ; coût : le dernier valide est gardé, une mise à jour sans coût ne
  l'efface pas ; jauge `{ used, size }` gardée à part, hors total et hors Bilan.
- `RT` : `this.usageTotal = createUsage()` dans le constructeur ; `handleUpdate()` compte un `usage_update` en tête
  (avant `if (this.stopped) return;`, pour ne pas perdre un coût publié après la fermeture ; la mise à jour part
  toujours vers `onEvent` comme avant) ; `prompt()` garde la réponse, `addPromptUsage`, la rend telle quelle ; méthode
  `usage()` → `publicUsage(this.usageTotal)`. Le tour `steer()` n'est pas compté (non nommé par le plan).
- `IX` : une instruction, en tête du `finally` de l'exécution (après tous les tours et le dernier état, avant le
  nettoyage). Diff exact :

  ```diff
  @@ -2318,6 +2318,13 @@ export class Orchestrator {
           finishedAt: new Date().toISOString(),
         });
       } finally {
  +      // swarm-14 : consommation annoncée par l'agent sur tous les tours ; jamais d'effet sur l'issue.
  +      try {
  +        const usage = control.runtime?.usage?.();
  +        if (usage && typeof usage === 'object') this.store.event(run.id, 'usage', usage);
  +      } catch {
  +        /* sans effet */
  +      }
         this.timers.clearTimeout(timer);
         clearSilence();
         toolGuard.clear();
  ```

  `usage()` ne lève pas (garde interne) ; une levée de `usage()` ou de `store.event` est prise par le `try` et le
  nettoyage qui suit s'exécute (test : `usage()` qui lève, qui rend une chaîne, qui rend 42, écriture de l'événement
  qui lève → même état, même erreur, même Bilan, mêmes types d'événements, mission sortie de `engine.active`).

- `DJ` : `ended()` lit `control?.runtime?.usage?.()` (par `sur`) et le met dans `this.finals` et `child_done` quand
  c'est un objet ; `doneOf()` relit `done.data.usage` ; `wait()` : `family.attente = { appels, ms }` (chaque appel
  validé compte ; `ms` = temps de l'attente réelle, horloge `this.now`) ; `familyBilan()` passe `usage` par enfant et
  `chef: { agent, usage, attente }`. Aucune zone interdite touchée (`launch()`, `pump()`, `wake()`, `prerequisite()`,
  `settle()`, `stopFamily()`, `waitLiving()` intacts).
- `FB` : `formatNumber()` (espace des milliers, virgule décimale, 4 décimales au plus pour la lecture) et
  `announcedLine()` ajoutée à la fin de la ligne « Consommation » ; vide quand aucun agent n'a annoncé de jetons ni de
  coût → ligne d'avant à l'octet.
- `CHEF` : option `usage: { chef?, membre? }`, chaque `{ tour?, maj? }` ; « MUET » dans la consigne : rien d'annoncé.
- `DOC` : §5 (Bilan, `child_done.usage?`), §5.1 (« Jamais de jetons » limité à la ligne des sous-agents internes),
  nouvelle section 9.14.

### Point 6 (vue d'équipe)

Constaté : `store.update(state)` émet l'événement `state` de façon synchrone et `watch()` appelle `ended()` dans cet
écouteur ; aucune lecture HTTP ne peut s'intercaler. Le test lit `?equipe=1` pendant que « A » tourne (pas de
`usage`, entrée gardée en mémoire non finie), puis en boucle serrée : à la première lecture où « A » est fini, `usage`
y est. `team-view.js` n'a pas été modifié.

### Point 7 (mission privée)

`doneOf()` lit pour un membre privé : `fichiers` dans son espace privé (`engine.privateRunFile(child, 'fichiers')`),
`envois`, `echec` et désormais `usage` dans `child_done` (en base). `usage` ne porte que des nombres et une devise
(chaîne de 1 à 10 lettres ou symbole monétaire) : aucun texte de l'agent. Rien d'autre n'a changé pour le privé.

## Écarts au plan

- Devise : swarm ne garde que l'USD ; ici toute devise valide est gardée telle qu'annoncée (précision 3 du manager),
  jamais convertie, jamais additionnée (le Bilan n'additionne aucun coût).
- La ligne `IX` du plan est écrite dans un `try { … } catch {}` avec une garde `typeof usage === 'object'`
  (précision 5 du manager) : une instruction, plus longue que la ligne du plan.
- La phrase neuve est ajoutée à la fin de la même ligne « Consommation » (après la phrase des durées, une espace).
- `wait()` : `this.family(mother.id)` est appelé en tête (après la validation des ids) pour tenir le compteur ; il
  crée la famille en mémoire même pour un appel sans sous-mission (avant : seulement quand il y avait des cibles).

## Tests

- `tests/swarm-14-cout.test.js` : 10/10. Cas : cumul de deux tours ; `usage_update` (dernier coût gardé, sans coût
  n'efface pas, devise, texte non devise) ; forme inconnue → `null` (NaN, négatifs, chaînes, tableaux, Proxy hostile) ;
  runtime réel avec faux agent (deux tours) ; ligne de Bilan mot pour mot ; aucun agent n'annonce → ligne identique à
  l'octet ; mission seule (événement `usage` / aucun, Bilan identique) ; point 5 (quatre pannes) ; mère avec deux
  membres (un annonce, un MUET) : `child_done.usage`, relecture après `finals` vidé, vue `?equipe=1` pendant/après,
  ligne de Bilan avec « non annoncé », total connu, « 3 appels de mission_attendre, 4 min 20 s » (horloge injectée) ;
  équipe muette (ligne d'aujourd'hui, aucun `usage`).
- Tests existants nommés, non modifiés : `runtime`, `runtime-onevent`, `chef-01`, `billing`, `equipe-01-roles`,
  `delegation-v2-01-b`, `swarm-07-*`, `swarm-12-*`, `swarm-13-*`, plus `swarm-02-limites`, `fix-resume`, `natifs-01`
  (faux agents qui publient un `usage_update`) : 262/262.
- Phase unitaire entière (outil du brief), trois passages :
  - 09:43, avant la garde de `wait()` : `ℹ tests 1883`, `ℹ pass 1880`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 2`,
    `ℹ todo 1`, « FIN phase unitaire : code 0 (durée 220 s) ».
  - 09:51, code final : `ℹ tests 1883`, `ℹ pass 1879`, `ℹ fail 1`, `ℹ cancelled 0`, `ℹ skipped 2`, `ℹ todo 1`,
    « FIN phase unitaire : code 1 (durée 224 s) ». Le journal a été supprimé avant que je relève le nom du test en
    échec (erreur de ma part) : non identifié.
  - 09:55, code final inchangé, relancé : `ℹ tests 1883`, `ℹ pass 1880`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 2`,
    `ℹ todo 1`, « FIN phase unitaire : code 0 (durée 231 s) ». Seul élément listé : le « à faire » connu de
    `tests/review2-lecture-18-11.test.js`. Référence 1 873 + 10 tests du lot = 1 883.
  - L'échec isolé du passage de 09:51 est tenu pour un échec sous charge non identifié (même code, vert avant et
    après) : à surveiller par le manager lors de sa suite complète.
- `npm run check` : « Syntaxe JavaScript valide. », code 0. `npm run format:check` : « All matched files use Prettier
  code style! ».

## Points à trancher par le manager

1. Noms ajoutés à la forme publique du plan : `jetons.cacheLu`, `jetons.cacheEcrit`, `jetons.reflexion` (présents
   seulement quand annoncés) ; `tours` = tours dont le `usage` a été compté ; `jetons.total` = `null` si un tour compté
   n'a pas annoncé `totalTokens` (jamais recalculé). Documentés en 9.14.
2. Une jauge de contexte seule (codex sans `usage`) donne un `publicUsage` non nul et donc un événement `usage`, mais
   « non annoncé » au Bilan.
3. Sans aucun chiffre annoncé, la phrase « Attente du chef » n'est pas écrite non plus (précision 9 : ligne
   identique) : le compteur reste alors invisible au Bilan.
4. Textes de cas limites non cités par le plan : « jetons non annoncés » (coût seul), « total connu : aucun jeton
   annoncé », « 1 appel » au singulier, « chef <agent> : non annoncé ».
5. Le faux agent publie ses `usage_update` pendant le tour : ils partent aussi vers la mission en événement `agent`,
   comme avant ce lot (rien de changé, mais un événement de plus dans une mission qui annonce).

## Relecture indépendante

Relecteur indépendant, 21/11/2026, 09:59-10:15 (horloge lue). Base `e7f4964`, commits relus `15178ef`, `e237dbe`,
`49ee8f3`. Commit de relecture : `f9a9f69`.

### Constats

- **Mineur, corrigé** (`f9a9f69`, test rouge d'abord) : dans le `finally` du moteur, un `usage()` qui rendait un
  tableau écrivait un événement `usage` (`typeof [] === 'object'`) ; `delegation.js` écarte déjà les tableaux. Garde
  `!Array.isArray(usage)` ajoutée sur la même instruction. Rouge constaté : types d'événements
  `[…, 'state', 'usage']` au lieu de `[…, 'state']`.
- **Point 1 (`wait()` crée la famille plus tôt), vérifié, rien à corriger** : la seule différence avec la base est
  l'appel sans aucune cible (aucune sous-mission, ou `ids: []`) ; avec des cibles, la base créait déjà la famille
  (attente ou `terminees`). Lecteurs relus : `held()`, `counter()` (`occupied` d'une famille vide = 0), `accept()`
  (`pump`/`wake` sur une famille vide : rien), contrôles `closing` (non posé), `unsynthesized`, `close()`, `forget()`
  (famille vide oubliée à la fin de la mère), `stopFamily()`/`waitStopped()` (créaient déjà la famille). Preuve par
  différence : une même sonde jouée sur un export de la base et sur HEAD (chef qui attend sans sous-mission ; puis qui
  échoue → `stopFamily` ; `ids: []` après un lancement ; attente d'une sous-mission déjà finie), avec Bilan, réponse de
  `mission_attendre`, événements, `GET /runs/:id`, `?equipe=1`, puis redémarrage (API, vue, `familyBilan`) : identiques
  (seules différences : la présence de la famille en mémoire juste après l'appel, et les noms aléatoires des dossiers
  de résultats). La famille est oubliée à la fin dans les deux cas. Le compteur est en mémoire : perdu au
  redémarrage, propre à chaque exécution (un chef repris repart de 0).
- **Point 2** : aucun délai, valeur rendue ni ordre ne change ; une attente qui rend tout de suite compte un appel et
  0 ms. Deux attentes qui se chevauchent : chaque appel compte et les durées s'additionnent (30 s d'horloge, deux
  attentes → 60 s) : somme des attentes, pas temps mur ; au plus n fois le temps mur (test ajouté).
- **Point 3** : diff de `IX` = la seule instruction du `finally` ; `usage()` qui lève, chaîne, 42 (tests du codeur),
  tableau (corrigé), `store.event` qui lève (test du codeur) : même issue.
- **Point 4** : relu dans `node_modules/@agentclientprotocol/` : claude-agent-acp 0.95.0 remet
  `accumulatedUsage` à zéro à chaque tour (`resetTurnScratch`, l. 2958-2986, appelée à l'activation l. 3028) ;
  codex-acp 2.2.2 `beginPromptTokenUsage`/`PromptTokenUsage.usage()` (l. 45377-45385, 27979-28019) : part du prompt.
  `addPromptUsage` n'est appelé qu'une fois par réponse résolue ; un tour en erreur (rejeté) n'est pas compté (test
  ajouté) ; Relay ne recharge jamais une session ACP (`replay_unqualified`), donc pas de coût cumulé repris d'une
  exécution précédente ; `steer()` n'est pas un tour (ses jetons sont dans le tour actif). Une mise à jour sans coût
  n'efface pas le dernier coût (test du codeur, contrôle N9).
- **Point 5** : `child_done.usage` hostile (chaîne, tableau, nombre, `null`, objet de 5 000 clés, champs mal typés,
  devise en texte libre) relu par `doneOf()` sans `finals` : aucune exception, ligne de Bilan identique à celle sans
  annonce (test ajouté).
- **Point 6** : seuls des nombres et une devise (`/^[\p{L}\p{Sc}]{1,10}$/u`) sortent. Mineur, laissé : un mot unique
  de 10 lettres au plus passerait pour une devise ; le champ vient de l'adaptateur, pas du texte de l'agent.
- **Point 7** : texte du plan mot pour mot (test du codeur) ; comparaison avec la fonction `familySection` de la base
  (export de `e7f4964`) sur 1 200 cas sans annonce (états, rôles, accord, synthèse, chef absent / `null` / avec
  attente) : 0 différence. Mineur, laissé : un chef sans `agent` s'écrirait « chef undefined » (le moteur pose
  toujours `agent`).
- **Point 8** : aucun test existant ne fixe l'option `usage` ni ne contient « MUET » ; sans `usage`, `announce()`
  rend la réponse inchangée.
- **Point 9** : phase unitaire de relecture verte ; la seule entrée de la liste « failing tests » est le « à faire »
  connu de `tests/review2-lecture-18-11.test.js:248` (⚠, non compté en échec). L'échec isolé du codeur (09:51) reste
  non identifié : non reproduit.
- **Point 10** : `usage.js` reprend `coutAnnonce`, `contexteAnnonce`, `jetonsDuTour` du portage (seuls écarts : la
  devise gardée, décision du manager ; `thoughtTokens`) ; portage fidèle à `acp-swarm-events.ts:124-136, 98-108` et
  `acp-adapter.ts:413-437` ; deux lignes d'en-tête de licence en tête de fichier.

### Contrôles négatifs (tests du lot + relecture, code remis par `git show HEAD:`)

Retirer `attente.appels += 1` → 2 rouges ; neutraliser `attente.ms` → 2 ; `usage` hors de `child_done` → 1 ; `doneOf`
ne relit plus `usage` → 1 ; `handleUpdate` ne compte plus → 3 ; instruction `IX` retirée → 2 ; chef sans `usage` dans
`familyBilan` → 1 ; garde « aucun chiffre → ligne d'avant » retirée → 3 ; coût effacé par une mise à jour sans coût → 1 ;
`total` recalculé au lieu de `null` → 1 ; garde tableau de `IX` retirée → 1 ; « MUET » ignoré → 1.

### Tests ajoutés

`tests/swarm-14-relecture.test.js` (5) : `usage()` tableau ; chef qui attend sans sous-mission (même Bilan qu'un chef
sans appel, réponse vide, famille oubliée) ; attentes chevauchées ; tour en erreur non compté ; `child_done.usage`
hostile. Fichiers du lot + relecture : 15/15 ; tests nommés par le plan (`runtime`, `runtime-onevent`, `chef-01`,
`billing`, `equipe-01-roles`, `delegation-v2-01-b`) : verts, non modifiés.

### Totaux

Phase unitaire (10:09-10:13) : `ℹ tests 1888`, `ℹ pass 1885`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 2`,
`ℹ todo 1`, « FIN phase unitaire : code 0 (durée 229 s) » (1 883 + 5). `npm run check` : « Syntaxe JavaScript
valide. » ; `npm run format:check` : « All matched files use Prettier code style! ».

### Points à trancher par le manager

1. Attentes chevauchées : `ms` est la somme des attentes, pas le temps mur (garder, ou compter le temps mur).
2. Le compteur d'attente est par exécution et en mémoire : un chef repris ou un redémarrage repart de 0.
3. Les points 1 à 5 du codeur restent à trancher tels qu'écrits plus haut.

Verdict : `bon_a_integrer`.
