# swarm-16 — Niveaux de modèle par rôle (leger, standard, fort) : rapport du codeur

Codeur, 21/11/2026 (heure lue : 09:51 AEDT au début). Arbre `agregat-back-swarm-16`, branche `swarm-16`, base `e7f4964`,
portage du copieur `f395c75`. Aucun sous-agent, aucun modèle, aucun réseau, aucun fichier `.data` lu.

## Fait

- `packages/agent-runtime/niveaux.js` : le portage installé (deux lignes d'en-tête de licence gardées). Une adaptation :
  le texte de la note n'est plus dans ce fichier ; `choisirModele` rend, pour un niveau qui ne se résout pas,
  `{ modele: <règle d'aujourd'hui>, source: 'defaut', nonReconnu: <niveau>, depuis: 'niveau'|'role' }`, et la phrase
  est dans `delegation-rule.js` (règle 4.0 : les textes donnés aux agents sont dans `DR`).
- `packages/agent-runtime/profiles.js` : `niveaux` sur `codex` (`leger: ['luna']`, `standard: ['terra']`,
  `fort: ['-sol', 'astra']`) et sur `claude` (`leger: ['haiku']`, `standard: ['sonnet']`, `fort: ['opus', 'fable']`).
  Rien sur `fixture`, `gemini`, `opencode` (aucune liste de modèles de la machine donnée pour eux).
- `packages/orchestrator/roles.js` : `parseRole` lit `niveau` (par `parseNiveau` ; toute autre valeur : pas de clé) ;
  `roleList` le rend quand il existe. Fiches : `niveau: standard` pour `chercheur`, `redacteur`, `verificateur`,
  `niveau: fort` pour `developpeur`.
- `packages/orchestrator/delegation-rule.js` : `niveau: z.enum(['leger','standard','fort']).optional()` dans
  `mission_lancer` ; la phrase du plan, mot pour mot, insérée après « agent et modele : … voir mission_suivre) ; » ;
  `niveauNonReconnu(niveau)` = « niveau <n> non reconnu chez cet agent : modèle par défaut ».
- `packages/orchestrator/delegation.js` : dans `launch()`, seul le choix du modèle (avant les compteurs, après le
  calcul de `planned`) ; `niveau` sur la ligne (`link.link`, avant `engine.create`) et dans le résultat, note ajoutée
  à la liste `note([...])` du résultat ; dans `agentsNow()`, `niveau` sur chaque modèle connu (`avecNiveaux`). Aucune
  des fonctions réservées à swarm-14/15 (`ended`, `doneOf`, `wait`, `familyBilan`, constructeur, `promptParts`, `call`),
  ni compteurs, `pump`, `wake`, `prerequisite`, `settle`, `stopFamily`, `waitLiving` touchés. `index.js` non touché.
- `docs/api-delegation.md` : une puce « Niveau de modèle » dans 3.1 (rôles et `mission_lancer`), avant « Mère finie
  pendant le choix de l'agent » ; ni à la fin, ni dans la partie Bilan.
- `tests/swarm-16-niveaux.test.js` : 13 tests (voir Tests).

### Diff exact de `delegation.js` (commit 6f1d1d1)

```diff
@@ imports (après `import { membres } from './soeurs.js';`)
+// swarm-16 : the model tiers of a sub-mission (leger, standard, fort), resolved per agent.
+import { getProfile } from '../agent-runtime/index.js';
+import { avecNiveaux, choisirModele } from '../agent-runtime/niveaux.js';
+import { niveauNonReconnu } from './delegation-rule.js';
@@ launch()
     const planned = args.agent ?? reviewer ?? base.agent;
-    const plannedModel = args.modele ?? (planned === base.agent ? (base.model ?? '') : '');
+    // swarm-16 : the model : `modele` given ; then `niveau` ; then, for a resumption or a suite on the
+    // same agent, the previous attempt's ; then the role's tier ; then today's rule. A tier chooses
+    // among the models the agent announces (patterns of its profile) ; none matching : today's rule.
+    const probes = this.probes();
+    const choose = (id, given) =>
+      choisirModele({
+        ...given,
+        niveau: args.niveau,
+        niveauRole: team?.niveau,
+        profil: getProfile(id),
+        modelesAnnonces: optionsOf(probes[id]),
+      });
+    const planChoice = choose(planned, {
+      modele: args.modele,
+      precedent: previous && planned === previous.agent ? (previous.model ?? '') : undefined,
+      defaut: planned === base.agent ? (base.model ?? '') : '',
+    });
+    const plannedModel = planChoice.modele;
@@
     const agent = instead ?? planned;
-    const modele = instead ? '' : plannedModel;
+    // swarm-16 : another agent takes the part : a model given is left (as before), a tier (asked, or
+    // the role's) is resolved at that agent. The tier is written when it chose the model ; one that
+    // does not resolve is said in the note (the role's only for an agent with tiers announcing models).
+    const choice = instead ? choose(instead, { defaut: '' }) : planChoice;
+    const modele = choice.modele;
+    const niveau = ['niveau', 'role'].includes(choice.source) ? choice.niveau : null;
+    const niveauNote =
+      choice.nonReconnu &&
+      (choice.depuis === 'niveau' ||
+        (getProfile(agent)?.niveaux && optionsOf(probes[agent]).length))
+        ? niveauNonReconnu(choice.nonReconnu)
+        : null;
@@ link.link
         ...(chiefAgent ? { agentImpose: true } : {}),
+        ...(niveau ? { niveau } : {}), // swarm-16 : the tier that chose the model.
@@ résultat
       modele,
+      ...(niveau ? { niveau } : {}), // swarm-16
@@ note([...])
         instead && agentReplaced(planned, why.raison, instead),
+        niveauNote, // swarm-16
@@ agentsNow()
-        modeles: optionsOf(probes[agent.id]).map((model) => ({
-          id: model.id,
-          nom: model.name ?? model.id,
-          ...(modelesLimites?.[model.id] ? { limiteJusqua: modelesLimites[model.id] } : {}),
-        })),
+        // swarm-16 : with the tier of each model, when its profile knows it (avecNiveaux).
+        modeles: avecNiveaux(
+          optionsOf(probes[agent.id]).map((model) => ({ ...même objet qu'avant... })),
+          getProfile(agent.id),
+        ),
```

`plannedModel` garde son rôle d'avant (contrôle d'indisponibilité de swarm-08 : `this.unavailable(planned, plannedModel)`),
calculé maintenant par la priorité du lot. Le contrôle du chef sur un agent nommé (lignes `chiefAgent && !forced`) n'est
pas touché : il lit toujours `args.modele ?? règle d'aujourd'hui` (voir Points à trancher, 4).

## Écarts au plan

1. Note d'un niveau de RÔLE qui ne se résout pas : écrite seulement chez un agent dont le profil a `niveaux` ET qui
   annonce au moins un modèle ; sinon silence (règle d'aujourd'hui sans note). Un `niveau` demandé par le chef qui ne se
   résout pas donne toujours la note (cas du plan). Raison : précision 7 (profil sans `niveaux` → exactement comme
   aujourd'hui) et le test existant `tests/equipe-01-roles.test.js` « vérificateur d'un travail de claude en mode réel »
   qui attend `review.note === undefined` alors que ses sondes `codex` n'annoncent aucun modèle : avec la note
   systématique, il deviendrait rouge sans qu'un modèle attendu change (donc non adaptable selon la consigne).
2. Texte de la note déplacé de `niveaux.js` (portage) vers `delegation-rule.js` (règle 4.0) ; `choisirModele` rend
   `nonReconnu` et `depuis` au lieu de `note`.
3. Pas de `niveau` dans l'événement `child_launched` (le plan ne le demande pas ; la ligne et le résultat le portent).
4. Comme le portage : un `niveau` demandé qui ne se résout pas va directement à la règle d'aujourd'hui (il ne tente pas
   le niveau du rôle), texte du plan ; swarm tenterait la couche suivante.

## Tests

- `node --test tests/swarm-16-niveaux.test.js` : 13 / 13 réussis (code 0). Cas : (1) tableau profil × niveau avec les
  listes de la machine en données fictives, `default` sans niveau, profils sans `niveaux`, entrées hostiles ;
  (2) ordre de priorité pur ; (3) clé `niveau` des fiches plateforme / pack (pack FICTIF dans un dossier temporaire par
  `AGENT_PLATFORM_TEST_PACKS_DIR`) / `roleList` ; (4) schéma et phrase mot pour mot de `mission_lancer` ; (5) `niveau`
  des modèles dans `agents()` ; (6) niveau demandé → modèle du niveau, écrit sur la ligne ; (7) niveau inconnu chez un
  agent → modèle par défaut et note (aussi pour l'agent simulé) ; (8) `modele` explicite l'emporte (et `''`) ; (9) une
  suite garde le modèle précédent, `''` compris, malgré le rôle `developpeur` (fort) ; une reprise aussi ; un niveau
  demandé l'emporte sur le précédent ; (10) rôle avec niveau → modèle du niveau (plus celui de la mère), rôle de pack
  et rôle de l'espace pareils ; (11) rôle sans niveau, nom libre, sans rôle → aujourd'hui, mêmes clés ; (12) même jeu
  avec `fixture`, `gemini`, `opencode` (sans `niveaux`) → aujourd'hui, sans note ; agent à niveaux sans modèle annoncé
  → silence ; annonçant d'autres modèles → note ; (13) agent de remplacement : niveau demandé et niveau du rôle résolus
  chez le remplaçant, modèle donné abandonné (`''`), niveau non résolu chez le remplaçant → `''` et note.
- Tests existants nommés, sans modification : `delegation-v2-01-b`, `equipe-01-*` (dont `roles` et `roles-pack`),
  `swarm-05-*`, `swarm-08-*`, `swarm-10-*`, `swarm-12-*`, `swarm-13-*` : 217 / 217 réussis ; plus
  `review-multi-agent-v3-01`, `api-agents`, `platform`, `multi-agent-*`, `delegation-*` : 86 / 86.
- Tests existants modifiés : aucun (`tests/equipe-01-roles.test.js` et `tests/equipe-01-roles-pack.test.js` verts tels
  quels : aucun modèle attendu n'y change).
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code
  style! ».
- Phase unitaire (`phase-unitaire.mjs`, sur le commit 6f1d1d1) : `ℹ tests 1886` · `ℹ pass 1883` · `ℹ fail 0` ·
  `ℹ cancelled 0` · `ℹ skipped 2` · `ℹ todo 1` · « FIN phase unitaire : code 0 (durée 267 s) ». Référence 1 873 /
  1 870 : + 13 tests du lot, rien d'autre ne bouge. Journal supprimé ensuite.

## Points à trancher par le manager

1. **Tableau des motifs à valider par le propriétaire** (vérifié par le test 1, listes de la machine en données
   fictives, ordre annoncé) :

   | profil | leger | standard | fort |
   | --- | --- | --- | --- |
   | claude | haiku | sonnet | opus[1m] |
   | codex | gpt-6-luna | gpt-6.1-terra | gpt-6.1-sol |
   | fixture, gemini, opencode | (aucun : règle d'aujourd'hui) | (aucun) | (aucun) |

   Niveau de chaque modèle annoncé : claude `default` → aucun, `opus[1m]` fort, `claude-fable-5[1m]` fort, `sonnet`
   standard, `haiku` leger ; codex `gpt-6.1-terra` standard, `gpt-6.1-sol` fort, `gpt-6-astra` fort, `gpt-6-sol` fort,
   `gpt-6-luna` leger, `gpt-5.6-sol` fort, `gpt-5.6-terra` standard, `gpt-5.6-luna` leger. `fort` prend le premier fort
   annoncé (`opus[1m]`, `gpt-6.1-sol`), pas le plus fort de swarm (`fable`, `astra` = ultra) : si le propriétaire veut
   `fort` = le plus puissant, il faut retirer `opus` / `-sol` des motifs (ou changer l'ordre annoncé, qui n'est pas à nous).
2. **Changement visible (voulu par le plan)** : une sous-mission lancée avec un rôle de la plateforme ne prend plus
   d'office le modèle de la mère : un chercheur, un rédacteur ou un vérificateur part sur le modèle moyen de son agent,
   un développeur sur le modèle fort. Dans une mission d'équipe réelle où la mère tourne sur un modèle fort, ses
   chercheurs et rédacteurs tourneront donc sur un modèle moyen, sauf si le chef donne `modele`. (Écrit aussi dans
   `docs/api-delegation.md`.)
3. Écart 1 ci-dessus (note silencieuse pour le niveau d'un rôle chez un agent sans motifs ou sans modèle annoncé) :
   à confirmer.
4. Le contrôle d'indisponibilité d'un agent NOMMÉ par le chef (swarm-08, avant les compteurs) vérifie la limite du
   modèle `args.modele ?? règle d'aujourd'hui`, pas celle du modèle qu'un niveau choisira : un modèle de niveau sous
   limite passe ce contrôle et serait jugé ensuite par l'agent. Laissé tel quel (hors du seul choix du modèle).
5. `mission_continuer` n'a pas de `niveau` (le plan n'en prévoit pas) : une suite garde toujours le modèle de la
   tentative précédente, sauf `modele` donné.
6. Aucun test existant hors des deux fichiers autorisés n'a dû changer.

## Relecture indépendante

Relecteur, 21/11/2026 (heure lue : 10:08 AEDT). Sans sous-agent, sans modèle, sans réseau. Base `e7f4964`, commits relus
`f395c75`, `6f1d1d1`, `b54398d`.

### Constats

- **Périmètre** : conforme. Seuls les fichiers du lot sont touchés (`git diff e7f4964..HEAD --stat`) ; aucun test
  existant modifié (`--stat -- tests/` : le seul fichier du lot). `index.js` non touché. Dans `delegation.js`, région
  par région : imports ; dans `launch()`, le calcul de `plannedModel` (remplacé par `choisirModele`) et de `modele`
  après le choix de l'agent de remplacement ; `niveau` sur `link.link` et dans le résultat ; `niveauNote` dans
  `note([...])` ; `avecNiveaux` dans `agentsNow()`. Rien dans les compteurs, `pump`, `wake`, `prerequisite`, `settle`,
  `stopFamily`, `waitLiving`, `ended`, `doneOf`, `wait`, `familyBilan`, le constructeur, `promptParts`, `call`,
  `carnet_noter`.
- **Conformité au plan** : priorité `modele` > `niveau` > précédent (suite, reprise, `''` compris) > niveau du rôle >
  règle d'avant, vérifiée cas par cas (tests du codeur 2, 6-13 et contrôles négatifs N1-N4, N17). Phrase de
  `mission_lancer` et note mot pour mot. Motifs seulement dans `profiles.js` ; aucun nom de modèle ni d'agent dans
  `niveaux.js` (hors commentaires d'origine), `delegation-rule.js`, `roles.js`, les fiches. Documentation dans 3.1
  (rôles et `mission_lancer`), changement visible dit clairement.
- **Fidélité à swarm** (fichiers ouverts en lecture seule) : `types.ts:91` (4 niveaux → 3, `ultra` fondu dans `fort`),
  `:121-141` (table codex/claude : mêmes familles de motifs), `:210-216` (`parseModelTier` : trim, minuscules ; les
  alias hérités `haiku→smol`… écartés, ce sont des noms de modèles), `model-tier-resolution.ts:8-23` et `:494-508`
  (un niveau ne refuse jamais). En-têtes de licence en première ligne.
- **Passerelle** (`packages/mission-gateway/server.js`, hors lot, lue) : `inputSchema: tool.schema` puis
  `JSON.stringify({ tool, args })` : `niveau` passe par le schéma de `MISSION_TOOLS` ; transmis sans changement.
- **Mineur, laissé** : `choisirModele` ignore un `defaut` ou un `precedent` non textuel (ligne corrompue avec un modèle
  nombre) → `''` ou couche suivante, là où la base passait la valeur telle quelle. Impossible par les chemins réels
  (schémas zod, lignes écrites par la plateforme). Laissé.
- **Mineur, laissé** : un agent à `niveaux` dont la sonde n'annonce que des entrées mal formées (objets sans `id`)
  « annonce des modèles » au sens de `optionsOf` : le niveau d'un rôle non résolu y donne la note. Même définition
  que `mission_suivre.agents[].modeles` (qui liste ces entrées depuis swarm-08). Laissé.
- **Limite décrite (décision du manager)** : le contrôle d'indisponibilité d'un agent NOMMÉ par le chef lit toujours
  `args.modele ?? règle d'avant` ; un modèle de niveau sous limite chez cet agent n'est pas vu par ce contrôle. Le
  contrôle d'un agent choisi par la plateforme, lui, lit maintenant le modèle du niveau (`plannedModel`).
- Aucun bloquant, aucun majeur.

### Point 12 du manager (sondes, agent inconnu, `team` nul, `previous` sans modèle)

Constaté : `this.probes()` attrape tout (rend `{}`), `getProfile` est un `find` (jamais d'exception, `undefined` pour
`__proto__`, `constructor`…), `optionsOf` rend `[]` pour toute forme inattendue, `choisirModele` ne lève sur aucune
entrée. Le code neuf ne lève pas et n'ajoute aucun refus ; il est placé après tous les refus existants qui le
précèdent dans la base et avant le contrôle de swarm-08, qui existait déjà au même endroit. Aucune correction
nécessaire. Preuve par différence : un script (supprimé ensuite) a rejoué 68 scénarios sans `niveau` contre une copie
de la base (`git archive e7f4964`) et contre HEAD — lancement simple, `modele`, agent nommé, agent nommé + rôle de la
plateforme sur un profil sans `niveaux`, nom libre, rôle de la plateforme sans sondes, vérification, remplacement
(avec et sans `modele`), suite (même agent, autre agent), reprise d'un `previous` sans modèle, mission privée,
`fixture`/`gemini`/`opencode` × trois rôles, agents `inconnu`, `__proto__`, `constructor`, `toString`,
`hasOwnProperty`, dix formes de sondes (absentes, JSON illisible, tableau, `null`, chaîne, sonde nulle, `models`
absent ou texte, `options` objet ou hostile, `__proto__` dans le JSON), `agents()` sur chacune, refus
`agent_indisponible` (agent nommé sous limite, aussi avec rôle) et `introuvable` : résultat, ligne (agent, modèle,
`famille`), événements, refus et messages identiques octet pour octet (après remplacement des UUID, dates et du
dossier `relay/missions/<8 car.>/` dérivé de l'id aléatoire de la mère). L'essentiel est fixé dans
`tests/swarm-16-relecture.test.js` (R2, R3).

### Contrôles négatifs (chacun retiré un instant, puis le fichier remis depuis une copie)

N1 `niveau` non passé à `choisirModele` → 4 rouges ; N2 niveau du rôle → 3 ; N3 précédent → 1 ; N4 niveau chez le
remplaçant → 1 ; N5 note jamais → 3 ; N6 note toujours → 1 ; N7 `niveau` sur la ligne → 2 ; N8 dans le résultat →
3 ; N9 `avecNiveaux` dans `agents()` → 1 ; N10 `parseRole` → 4 ; N11 `roleList` → 1 ; N12 schéma → 1 ; N13 `niveau`
écrit quelle que soit la source → 3 ; N16 ordre annoncé inversé → 6 ; N17 niveau après le précédent → 2 ; N18 niveau
non résolu qui tombe à la couche suivante → 4. **Trous trouvés** : N14 (motif le plus long → premier motif) et N15
(casse non ignorée) ne rougissaient aucun test du codeur → test R1 ajouté : 1 rouge chacun. Ajoutés aussi : N19
(`previous.model` absent non ramené à `''`) → 1 rouge (R2) ; N20 (note du rôle sans condition « annonce des
modèles ») → 3 rouges.

### Tests ajoutés

`tests/swarm-16-relecture.test.js`, 4 tests : R1 motif le plus long, casse, égalité, tables hostiles ; R2 preuve par
différence (valeurs de la base) sur les chemins listés ; R3 point 12 (agents piégés, dix formes de sondes, entrées
mal formées, refus inchangés avec rôle ou niveau) ; R4 `niveau` par `call()` : `ultra` et `3` refusés en
`parametres_invalides` (« niveau — … »), `fort` transmis jusqu'au résultat.

### Totaux

- `node --test tests/swarm-16-niveaux.test.js tests/swarm-16-relecture.test.js` : 17 / 17.
- Tests existants nommés (`equipe-01-*`, `delegation-v2-01-b`, `swarm-08-*`) avec le fichier du lot : 96 / 96.
- `npm run check` : « Syntaxe JavaScript valide. » ; `npm run format:check` : « All matched files use Prettier code
  style! ».
- Phase unitaire (`phase-unitaire.mjs`, arbre avec la relecture) : `ℹ tests 1890` · `ℹ pass 1886` · `ℹ fail 1` ·
  `ℹ cancelled 0` · `ℹ skipped 2` · `ℹ todo 1` · « FIN phase unitaire : code 1 (durée 390 s) ». 1 890 = 1 873 + 13
  (codeur) + 4 (relecture). Le seul échec : « question en JSON : délais suspendus pendant l’attente »
  (`tests/elicitation.test.js`, hors lot, aucune référence à la délégation, aux rôles ni aux niveaux). Relancé seul
  trois fois : 26/26, 25/26 (le même test), 26/26 : **échec intermittent du fichier lui-même, sous charge, non lié au
  lot**. Journal supprimé ensuite.

### Points à trancher par le manager

1. `tests/elicitation.test.js` « délais suspendus pendant l’attente » échoue par intermittence même seul (1 fois sur 3) :
   test temporel hors lot, à suivre à part.
2. Les deux mineurs laissés ci-dessus (valeur non textuelle de `defaut`/`precedent` ; entrées de sonde mal formées
   comptées comme modèles annoncés pour la note du rôle).
3. Le tableau des motifs (point 1 du codeur) et le changement visible (point 2) restent à valider par le propriétaire.

### Verdict

`bon_a_integrer` : conforme au plan, aucune régression constatée par différence avec la base, tests du lot et tests
nommés verts ; le seul échec de la phase unitaire est intermittent et hors lot.
