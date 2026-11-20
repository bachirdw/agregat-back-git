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
