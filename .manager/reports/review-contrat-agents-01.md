# review-contrat-agents-01 — Relecture indépendante de contrat-agents-01

Relecteur : Opus (sous-agent), seul écrivain de l'arbre `~/Downloads/agregat-back-cto`, branche `cto-11-11`.
Commits relus : `5648a21` (code, tests, fixtures) et `03e7102` (rapport). Arbre propre au départ.

## Journal

- 23:25 — Lecture d'`AGENTS.md`, du brief, du rapport du codeur, puis du diff complet de `5648a21`.
- 23:26 — Contrôle des interdits : seuls `packages/orchestrator/*`, `packages/career-ops/{truth,attachments}.js`
  (côté plateforme) et des fichiers de test NOUVEAUX sont touchés. `run-policy.js` (listes de mots) intact,
  bibliothèque career-ops intacte, aucun test existant modifié, aucun garde-fou ni demande d'accord ajouté.
  Fixtures : jetons passés en revue, rien de personnel (valeurs `FICTIF`, `offres.example.test`, `exec-0000…`).
- 23:27 — Preuve que les tests sont rouges sans le correctif : copie de l'arbre dans le bloc-notes, remise de
  l'ancienne version de chaque module, `node --test tests/contrat-agents.test.js` :
  ancien `truth.js` → 1 rouge (vérité), ancien `attachments.js` → 1 rouge (vérité/CV joint), ancien
  `native-actions.js` → 1 rouge (NativeActions), `permissionToolName` sans la nouvelle ligne → 1 rouge.
  Anciens `tool-guard.js` et `skill-router.js` → 0 rouge : ce sont des refontes sans changement d'issue sur
  les fixtures, ce que le codeur annonçait.
- 23:28 — Défaut trouvé (ci-dessous, M1), test écrit d'abord : rouge (`failures: 2` au lieu d'aucun compte).
  Correctif dans `truth.js`, test vert ; sous-ensemble vérité (4 fichiers) 30/30.
- 23:29 à 23:39 — Suite complète, une fois (fichier `missions-finies` présent).
- 23:40 — Commit `d5a8c46`.

## Constats par gravité

### M1 (moyen, corrigé) — Codex : un échec de la passerelle compté deux fois au Bilan
Le correctif (a) du codeur fait enfin voir les appels Codex au canal ACP de `createTurnTruth`. Mais la
passerelle rapporte le même appel avec son propre identifiant (`randomUUID`, `mcp-gateway/server.js:162`),
jamais égal à l'id ACP (`exec-…`). `markFailed` gardait les deux ids dans un même ensemble : un seul
`browser_click` échoué donnait « browser_click — échec signalé par l'outil (2 échecs) », et un échec suivi d'une
réussite « 2 échoués puis réussi ». Les journaux réels (lecture seule, comptes seulement) montrent que Codex
rapporte bien `failed` sur ses appels de la passerelle (10 cas : browser_click, career_write, browser_navigate…).
Avant le commit, le Bilan Codex disait juste (ACP aveugle) : c'est une régression introduite par le correctif.
Le même double compte existait déjà pour Claude (35 échecs MCP Claude dans les journaux).
Correctif : ids gardés par canal (`acp:` / `gateway:`), nombre d'échecs = maximum des deux canaux, jamais la
somme. Deux échecs distincts vus par un seul canal restent deux (test). Les tests existants de
`failedActions` (canal unique) restent verts sans modification.
Test : `contrat FICTIF : un échec vu par les deux canaux compte une fois, pour les deux agents`.

### Faible, laissé — `permissionToolName` pour un serveur MCP qui n'est pas la plateforme
Le nom préfixé est réduit au nom nu quel que soit le serveur : un `mcp__autre__browser_navigate` serait tracé
`browser.navigate`, comme une capacité de la plateforme. Même comportement déjà présent côté Codex
(`rawInput.tool` d'un serveur quelconque). Sans effet constaté : les agents sont isolés, le seul serveur fourni
s'appelle `platform` (`workflow-run.js:26`). La décision d'accord ne dépend pas de ce nom (`p.actionClass`,
fixé par la passerelle) : aucun envoi final ne peut passer sans carte par ce chemin. `formatAutoSendLine`
compte `browser.send`, qui ne vient que de `rawInput.capability` de la passerelle (aucun outil `browser_send`).

### Faible, laissé — `attachments.answerOf` ne lit pas la réponse des formes réelles
Point ouvert 2 du codeur, plus large qu'annoncé : pour Claude aussi (rawOutput = tableau MCP), `answerOf` ne
trouve pas `uploaded`. Sans effet : la passerelle répond toujours le nom du fichier demandé
(`browser-gateway/cdp.js:2750`, `basename(args.path)`) et `career_document` rend `output/<name>.pdf`, ce que
donne le repli sur l'entrée ; le canal passerelle transmet aussi `uploaded`/`rendered`.

### Vérifié, sans défaut
- Point ouvert 1 du codeur : l'outil hors arbre `.manager/outils/bilan-vs-events.mjs` accepte `career_read` et
  `browser.navigate` (son motif admet le nom nu et le point) : il compte le même nom qu'avant.
- `isGatewayToolCall` rend désormais `true`/`false` sur les mises à jour Claude sans titre (`_meta` seul) au lieu
  de `null` : sans effet sur `ToolGuard` (l'appel avait déjà son statut au `tool_call`).
- Lecture Codex détectée par `rawInput.{server,tool}` : aucun outil de la passerelle n'a ces deux arguments.
- `readToolCall` est pure ; aucun état partagé ajouté ; `trackAttachments` et la vérité restent par tour.
- Envoi final : aucune ligne touchée ne participe à la décision `actionClass === 'send'`.

## Laissé ouvert (pour le manager)
- Points 3 et 4 du codeur inchangés (ordre `title` avant `rawInput.name` pour un adaptateur inconnu ; Gemini et
  OpenCode sans fixture faute de mission réelle journalisée).
- `bilan-vs-events.mjs` lit les appels ACP par `title ?? rawInput.name` : les titres Codex `mcp.platform.*` n'y
  sont pas reconnus (hors dépôt, hors périmètre, non modifié).

## Suite complète (une fois, 23:29 à 23:39, avec le correctif)
- `npm test` : unitaires 1116 tests, 1114 réussis, 0 échec, 2 ignorés ; Chrome 225/225. Le test fragile
  « Chrome isolé : délai du faux exécutable muet » est passé.
- `npm run check` : « Syntaxe JavaScript valide. »
- `npm run format:check` : « All matched files use Prettier code style! »

## Non vérifié en réel
Aucune mission réelle Claude ni Codex relancée : le double compte et son correctif sont prouvés sur fixtures et
par les comptes des journaux, pas par un Bilan réel. Aucun envoi, aucun site, ni Chrome du propriétaire ni relais,
aucune requête vers 4310 / 4313, aucun `.env*` lu ; base `.data/platform.sqlite` lue en `mode=ro`, comptes seulement.

## Commits
- `d5a8c46` [review-contrat-agents-01] Un échec vu par l'ACP et par la passerelle compte une fois (Codex et Claude)
- (ce rapport, commit suivant)
