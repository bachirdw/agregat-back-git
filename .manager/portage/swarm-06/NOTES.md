# swarm-06 — Portage du détecteur de boucles d'outils : notes du copieur

Écrit le 21/11/2026 (00:52 à l'horloge de la machine au début du travail). Origine : dépôt
`desplega-ai__agent-swarm` lu en lecture seule ; rien n'en a été exécuté.

## 1. Fichiers

- `loop-guard.js` : la classe `LoopGuard` et ses aides, à installer telle quelle en
  `packages/orchestrator/loop-guard.js` (ses deux imports, `./tool-call.js` et `./delegation-rule.js`,
  sont relatifs à ce dossier-là ; ils ne se résolvent pas depuis `.manager/portage/`).
- Vérifié : `node --check loop-guard.js` sans erreur. Essayé par un script qui importait une copie du
  fichier porté, une copie de `tool-call.js` et un faux `delegation-rule.js` (deux constantes), placés
  un temps dans `.manager/reports/swarm-06-preuves/` puis supprimés (résultats en 6).

## 2. Ce qui est copié (origine → portage)

| Origine | Portage |
| --- | --- |
| `src/hooks/tool-loop-detection.ts:22-30` (constantes) | `SEUILS` : `fenetre` 40 (l. 23), `repetitionAvertissement` 8 (l. 24), `repetitionCritique` 15 (l. 25), `repetitionCritiquePauvre` 24 (l. 26), `vaEtVientAvertissement` 6 (l. 27), `vaEtVientCritique` 12 (l. 28), `vaEtVientAvertissementPauvre` 12 (l. 29), `vaEtVientCritiquePauvre` 24 (l. 30). `HISTORY_DIR` (l. 22) écarté. |
| `:32-44` `deepSortKeys` | `deepSortKeys` (même logique ; ajouts de robustesse, voir 5) |
| `:46-66` `hashArgs` et son commentaire (le piège) | `hashArgs`, commentaire d'origine gardé en anglais tel quel + une phrase française |
| `:68-98` `isCodexFileChangeArgs` | `isPathOnlyArgs` (règle générique, voir 4) |
| `:168-270` `checkToolLoopUnserialized` (deux stratégies) | `LoopGuard.#detecter` (même ordre des cas, mêmes bornes, même règle des 80 %) |
| `:207, 217, 253, 261` (raisons) | `RAISONS` (traduites, voir 3) |
| `src/hooks/hook.ts:1262-1288` (avertissement, blocage, chef non surveillé) | `HOOK` (textes traduits, pour mémoire), `EXCLUS` (équivalent de « le chef n'est pas surveillé ») |

Écartés et pourquoi : `loadHistory`, `saveHistory`, `clearToolHistory` (l. 100-128, 272-281 : fichier
sous `/tmp`, utile seulement parce que leurs hooks sont des processus séparés ; chez Relay une instance
par exécution vit en mémoire) ; `sessionQueues` et `checkToolLoop` (l. 130-166 : file par session qui
ne protégeait que la lecture-écriture du fichier ; tout est synchrone ici) ; `timestamp` (jamais lu) ;
`readTaskFile`, `agentInfo`, `outputBlockResponse`, `outputToolContext` (mécanique de leurs hooks).

## 3. Textes destinés à l'agent : swarm en face de Relay

| swarm (origine) | Traduction portée | Texte que le plan pose dans Relay |
| --- | --- | --- |
| `hook.ts:1285` `Warning: ${reason}` | `Attention : <raison>` (`HOOK.avertissement`) | « Note de la plateforme : l’outil X vient d’être appelé N fois avec les mêmes arguments. Change d’approche, ou dis ce qui te bloque. » (mode `avertir`, `texteAvertissement`) |
| `hook.ts:1277-1279` `LOOP DETECTED: ${reason} Stop repeating this action and try a fundamentally different approach. If you're truly stuck, use store-progress to report the blocker.` | `BOUCLE DÉTECTÉE : <raison> Arrête de répéter cette action et essaie une approche fondamentalement différente. Si tu es vraiment bloqué, dis ce qui te bloque.` (`HOOK.blocage` ; « store-progress », un outil de swarm, retiré) | Pas de texte à l'agent : en mode `arreter`, la mission échoue avec « Boucle d’outils : X appelé N fois avec les mêmes arguments ; relancer autrement. » (`messageArret`, cause lue par le propriétaire) |
| `tool-loop-detection.ts:217` (répétition, avertissement) | `L’outil « X » a été appelé N fois avec les mêmes arguments. Envisage une autre approche.` | — (champ `raison`) |
| `:207` (répétition, critique) | `L’outil « X » a été appelé N fois avec les mêmes arguments dans les 40 derniers appels. Tu tournes en boucle. Essaie une approche entièrement différente.` | — (champ `raison`) |
| `:253` (va-et-vient, critique) | `Va-et-vient détecté : alternance entre « X » et « Y » sur N appels. Sors de ce schéma.` | — (champ `raison`) |
| `:261` (va-et-vient, avertissement) | `Va-et-vient possible entre deux appels d’outil. Envisage une autre approche.` | — (champ `raison`) |

Le plan ne cite de texte que pour la répétition. Pour le va-et-vient, `texteAvertissement` et
`messageArret` portent une **proposition** (« l’outil X alterne avec un autre appel, avec les mêmes
arguments, depuis N appels… ») : à trancher par le manager. Aucun nom d'agent, de modèle, de Skill ni de
site dans ces textes. La règle 4.0 met les textes donnés aux agents dans `DR`, mais `DR` n'est pas dans
les fichiers du lot : le plan place le texte dans la méthode `toolLoop` de `IX` ; le portage l'offre par
`texteAvertissement` dans `loop-guard.js`. Au codeur de suivre le plan (texte mot pour mot).

## 4. Adaptations demandées par le plan

- **Appel pauvre en arguments, générique** : `isPathOnlyArgs(input)` est vrai si les arguments ne
  contiennent que des clés `path`, `file_path`, `kind` (valeurs texte, au moins une clé autre que `kind`),
  ou une seule clé `changes`, liste non vide d'objets de ce genre. swarm exigeait en plus les noms
  d'outils `Edit`/`Write`/`Delete` et `kind ∈ {add, update, delete}` : retiré, aucun nom d'outil.
- **Arguments quel que soit l'agent** (`argumentsDe`) : `readToolCall` aplatit l'enveloppe
  `{ server, tool, arguments }` d'un agent dans `input`. Sans retrait, un appel de cet agent n'est jamais
  « pauvre » ni « vide » alors que le même appel chez l'autre agent l'est. Le portage ne garde que
  `arguments` quand `input.server`/`input.tool` sont ceux que `readToolCall` a lus.
- **Trois modes** : `loopGuardMode(process.env.AGENT_PLATFORM_LOOP_GUARD)` rend `null` pour `'0'`
  (pas de garde), sinon `observer` (défaut, et toute valeur inconnue), `avertir`, `arreter`. La classe
  ne connaît pas les modes : elle signale ; `IX` décide (événement, note, arrêt).
- **Exclus** : `EXCLUS = [MISSION_SERVER, CARNET_SERVER]` importés de `DR` ; un appel dont le serveur MCP
  (lu par `readToolCall`) est exclu n'entre pas dans l'historique (il ne coupe donc pas non plus une
  suite d'appels identiques). `new LoopGuard({ exclus })` remplace la liste.
- **Signatures** : `new LoopGuard({ seuils, exclus })` (seuils partiels admis ; une valeur non entière
  positive garde le défaut ; la fenêtre est relevée au plus haut seuil critique de va-et-vient, comme le
  demande le commentaire l. 23) ; `observe(update)` → `null` ou `{ niveau, motif, outil, n, raison }`
  (aucun argument dedans) ; `etat()` → `{ avertissements, dernier }` (`avertissements` = nombre de
  signalements rendus ; `dernier` = copie du dernier, ou `null`).

## 5. Écarts de comportement voulus (à connaître du codeur)

1. **Un compte par `toolCallId`, empreinte affinée.** L'appel compte au premier événement qui porte des
   arguments. Mais `tests/fixtures/acp-shapes/claude.json` (career_write) montre des arguments par
   morceaux : `{}` puis `{ path }` puis `{ path, text }`. Compter `{ path }` seul ferait un appel
   « pauvre » et une empreinte fausse (un agent atteindrait l'avertissement un appel plus tard que
   l'autre). Le portage compte l'appel une fois, puis met à jour son empreinte quand ses arguments
   changent, et réévalue (sans recompter). Vérifié : 9 écritures identiques par morceaux → avertissement
   au 8e appel, comme la même suite au format de l'autre agent.
2. **Appel sans argument** (capture de page) : compté à son statut terminal, avec `{}` comme chez swarm,
   s'il n'a jamais porté d'arguments ; avant, il attend (ses arguments peuvent venir).
3. **Un seul signalement par motif et par niveau** (au plus 4 par exécution). Lire « un par motif » au
   pied de la lettre empêcherait le critique de suivre l'avertissement, donc `arreter` n'arrêterait
   jamais. Un avertissement venu après le critique du même motif est tu. Les candidats sont rangés dans
   l'ordre de swarm (répétition critique, va-et-vient critique, avertissement de répétition, puis de
   va-et-vient) et le premier pas encore signalé est rendu.
4. **Nom montré sûr** : `readToolCall` garde un titre libre en entier, qui peut citer une commande
   (`exec_command` dont le titre est la commande). `outil` ne prend que un nom de la forme
   `/^[A-Za-z][\w.-]*$/` de 80 caractères au plus, sinon `outil natif (<kind>)`. L'identité d'un appel
   (clé de comparaison) garde le serveur, le nom lu et l'empreinte ; jamais les arguments en clair.
5. **Clé interne** : swarm composait `${toolName}:${argsHash}` puis relisait le nom par `split(":")` :
   un nom contenant `:` était tronqué dans le texte. Le portage garde le nom à part.
6. **Fenêtre** : swarm comptait sur 41 entrées (40 lues + l'appel courant) ; le portage sur 40.

## 6. Pièges et particularités lus chez swarm (portés tels quels sauf mention)

- **Le piège du lot** (l. 50-55) : l'ancien `JSON.stringify(args, Object.keys(args).sort())` passait
  les clés du premier niveau comme liste blanche et effaçait les clés imbriquées : tous les appels MCP au
  même outil (`{ server, tool, arguments: {…} }`) avaient la même empreinte → fausses boucles. Vérifié
  ici : l'ancien code confond `arguments: { name: 1 }` et `{ name: 2 }` ; `hashArgs` les distingue ; 20
  appels qui ne diffèrent que par une clé imbriquée ne signalent rien.
- **Va-et-vient = deux appels dominants, pas une alternance stricte** (l. 241-247) : deux empreintes
  font au moins 80 % des derniers `ppCritique` appels. Conséquence vérifiée : 11 appels identiques puis
  1 différent → **va-et-vient critique au 12e appel**, avant le critique de répétition à 15. En mode
  `arreter`, cela arrêterait la mission. Porté tel quel ; à trancher (exiger par exemple que le second
  appel compte au moins 2, ou une vraie alternance).
- **Seuil de va-et-vient effectif à 8, pas 6** : le retour anticipé `history.length < 8` (l. 186-189)
  passe avant la stratégie 2. Avec 8 appels alternés A/B : avertissement de va-et-vient au 8e, critique
  au 12e (vérifié). Le test « va-et-vient » du codeur doit l'attendre.
- **Seuils relevés des appels pauvres** : la répétition ne relève que le critique (24), l'avertissement
  reste à 8 (l. 193-195, vérifié : 8 → avertissement, 24 → critique). Pour le va-et-vient, le
  commentaire (l. 222-224) dit « quand l'un des deux appels dominants est pauvre », mais le code
  (l. 226) relève dès qu'un appel pauvre est dans la fenêtre : le code est porté.
- `pendingWarning ??=` (l. 257) : l'avertissement de répétition passe avant celui du va-et-vient.

## 7. observe() ne lève jamais : comment

- Tout le corps est dans `try { … } catch { return null; }` : un événement illisible ne compte pas.
- Sortie immédiate pour `null`, non-objet, `sessionUpdate` autre que `tool_call`/`tool_call_update`,
  `toolCallId` absent ou ni texte ni nombre.
- `deepSortKeys` : cycle → `'[cycle]'` (WeakSet des objets en cours), profondeur > 64 → `'[profond]'`
  (pas de pile épuisée), BigInt → texte (sinon `JSON.stringify` lève). `JSON.stringify(...) ?? ''`.
- Getter ou Proxy qui lève : attrapé par le `try` (l'appel est ignoré).
- Mémoire bornée : historique ≤ fenêtre ; ids comptés et ids en attente ≤ 1024 chacun (FIFO).
- Vérifié : `null`, `undefined`, nombre, texte, tableau, événement sans id, arguments cycliques,
  imbriqués sur 100 000 niveaux, de 5 Mo, avec BigInt, Proxy et getter qui lèvent, id objet, getter de
  `sessionUpdate` qui lève : aucune exception, 49 ms en tout.

## 8. Pour le codeur

- `IX` : `const mode = loopGuardMode(process.env.AGENT_PLATFORM_LOOP_GUARD)` ;
  `const loopGuard = mode ? new LoopGuard() : null` près de `new ToolGuard(` (repérer par le texte).
  La ligne d'observation est après `control.familyObserve?.(update);` dans `onEvent` (vers la l. 1582
  de la base) ; `observe` ne lève pas.
- L'événement `tool_loop` ne prend que `{ niveau, motif, outil, n }` (pas `raison`, qui est un texte).
- `onEvent` n'est appelé qu'après `promptStarted` : le rejeu de `session/load` n'est pas compté.

## 9. Écarts entre le plan et swarm, non vérifié

- Lignes citées par le plan : toutes confirmées (`tool-loop-detection.ts:9-30, 36-66, 68-98, 168-270`) ;
  le passage de `hook.ts` est aux lignes 1262-1288 (plan : 1263-1287), l'émission de l'avertissement
  aux lignes 1335 et 1340. Autres appelants de `checkToolLoop` vus, non portés :
  `src/providers/claude-managed-adapter.ts:493`, `pi-mono-extension.ts:669`, `swarm-events-shared.ts`.
- Non vérifié : le comportement dans le vrai moteur (aucun branchement fait, aucun test Relay lancé) ;
  la forme réelle des arguments par morceaux chez d'autres agents que les deux formats des fixtures.
