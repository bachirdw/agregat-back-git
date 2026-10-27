# Audit 01 — Agent Runtime (ACP)

## Journal

- 23:49 — Lecture de `AGENTS.md`, du brief `audit-01`, des règles communes, de `MISSION.md` et de `PLAN.md`. `git status --short` vide ; dernier commit `c6baeae`. Aucun rapport antérieur `audit-01.md` : début de l'audit. Lancement de `npm test`, sortie vers `audit-01-evidence/npm-test-initial.log`.
- 23:52 — `npm test` initial : ÉCHEC hors périmètre runtime, lancement Chrome refusé (`SIGABRT`, `kill EPERM`) dans les tests navigateur ; journal complet dans `audit-01-evidence/npm-test-initial.log`. Tests ciblés runtime/liveness/owner-mode : 68/68 réussis (`part-tests-initial.log`). Lecture des huit modules runtime, des tests et des sections de plan pertinentes. Défaut du routeur Auto reproduit : une sonde absente laisse gagner un agent dont la capacité obligatoire n'est pas annoncée, devant un agent prouvé compatible. Test rouge (`router-red.log`, attendu `claude`, obtenu `codex`) puis correction de `router.js` ; `tests/runtime.test.js` 47/47 verts (`runtime-green.log`).
- 23:53 — Défaut de découverte reproduit : un dossier avec droit de traversée est accepté comme exécutable par `findCli` (`discovery-red.log`, attendu `null`, obtenu chemin du dossier). Correction `statSync(...).isFile()` dans `discovery.js`, conforme au contrôle d'acpx `spawn-command-options.ts:257-272`. Test runtime relancé (`runtime-final.log`).
- 23:55 — `npm run check` et `npm run format:check` verts (`check-precommit.log`, `format-precommit.log`). Suite complète relancée hors bac à sable (autorisation automatique accordée), 290 tests non-navigateur réussis, 1 ignoré ; phase Chrome en cours (`npm-test-precommit.log`). En relisant `inspect`, constat que `execFile(--version/--help)` héritait de l'environnement parent et que sa sortie/erreur était renvoyée au catalogue sans masquage. Test rouge (`detection-secret-red.log`), correction via `buildChildEnv(profile, env)` et `redact` avant troncature ; 50/50 tests runtime verts (`runtime-secret-green.log`).
- 23:57 — Lecture de `tests/process-liveness.test.js`, des tests owner-mode concernés et des sources SDK/agents. Nouvelle vérification runtime après secret fictif long : 50/50 (`runtime-final-2.log`). Recherche `rg` dans `node_modules/@agentclientprotocol/sdk/dist/schema` : chemin inexistant, erreur bénigne ; la preuve `cancellationSignal` est dans `dist/core/jsonrpc.js`.
- 23:58 — Nouveau défaut de masquage reproduit : `session()` ne masquait un environnement MCP que si son nom ressemblait à un secret ; un jeton fictif sous `HEADER` réapparaissait dans un événement. Test rouge (`mcp-secret-red.log`), correction dans `index.js` : valeurs MCP chaînes de huit caractères ou plus ajoutées à la liste de masquage. Test runtime relancé (`runtime-final-3.log`).
- 23:59 — Suite complète hors bac à sable terminée sur une version intermédiaire : 290/290 tests non-navigateur réussis + 1 ignoré, 136/136 Chrome réussis (`npm-test-precommit.log`). Après la dernière correction MCP, `tests/runtime.test.js` 51/51 verts (`runtime-final-3.log`) ; `npm run check` et `npm run format:check` verts (`check-final.log`, `format-final.log`). Suite complète finale relancée (`npm-test-final.log`) avant commit ; `git diff --check` vert.
- 00:00 — Lecture du clone OpenCode `anomalyco__opencode@6806c6e` : les options ACP de modèle et mode viennent de `packages/cli/src/acp/config-option.ts:22-68` et `session/cancel` est routé dans `agent.ts:117-118`. Première recherche sous `packages/opencode/src/acp` : chemin inexistant, corrigée vers `packages/cli/src/acp`. Suite complète finale : 293/293 non-navigateur verts, 1 ignoré ; phase Chrome en cours.
- 00:03 — Suite complète finale VERTE : 294 tests non-navigateur (293 réussis, 1 ignoré, 0 échec) et 136/136 Chrome, 0 échec (`npm-test-final.log`). `npm run check` et `npm run format:check` verts (`check-final.log`, `format-final.log`). Aucun appel fournisseur réel. Préparation du commit local `[audit-01] Corriger routage, découverte et masquage ACP`.
- 00:03 — Premier `git add -A && git commit` ÉCHEC : création de `.git/index.lock` refusée (`Operation not permitted`) par le bac à sable, sans modification de l'index ; demande d'exécution autorisée pour le commit local imposé par `AGENTS.md`.

## Écarts au plan

| Exigence (source) | État réel | Preuve | Gravité |
|---|---|---|---|
| ACP v1, quatre profils interchangeables (`.manager/MISSION.md:7-11`, `docs/adr/001-local-acp.md:9-13`) | Fait sur fixtures ; accès fournisseurs dépendant de l'environnement | `profiles.js:6-70`, `index.js:119-171`, `runtime.test.js` | moyenne |
| Identifiants cohérents runtime, routeur et catalogue (`.manager/MISSION.md:7-11`) | Fait : `agentIds` dérive de `profiles`, schéma orchestration et catalogue consomment ces profils | `profiles.js:69-70`, `router.js:7-75`, `packages/orchestrator/index.js:34,247-265`, `apps/api/server.js:165-170` | faible |
| Annulation, délais, reprise (`docs/adr/003-runtime-and-durable-workflows.md:23-30`) | Fait sur fixtures | `index.js:174-248`, `runtime.test.js:60-157,303-314` | faible |
| Environnement enfant en liste blanche et modes sûrs (`.manager/HANDOFF.md:258-261`) | Fait sur fixtures | `env.js:5-27`, `index.js:249-266`, `runtime.test.js:165-265` | faible |
| Secrets masqués dans les diagnostics et catalogue (`.manager/HANDOFF.md:260`, `docs/adr/001-local-acp.md:13`) | Partiel puis corrigé pour découverte CLI | `discovery.js:44-99`, `detection-secret-red.log` | moyenne |
| Auto filtre les exigences obligatoires (`.manager/PLAN.md:45`, `docs/adr/003-runtime-and-durable-workflows.md:23`) | Partiel puis corrigé : sonde inconnue était admise | `router.js:21-52`, `router-red.log` | moyenne |
| CLI Windows et chemins persistants (`.manager/reuse-plan.md:70`, `docs/adr/003-runtime-and-durable-workflows.md:23`) | Partiel : `findCli` ne cherche pas les suffixes PATHEXT et `shell:false` ne lance pas un `.cmd` ; non testé sur Windows | `discovery.js:33-42`, `index.js:119-126` | moyenne |
| Reprise fournisseur réelle (`.manager/MISSION.md:66-68`, `docs/mvp-plan.md:29`) | Simulée ici ; `loadSession` testé avec faux ACP, preuve fournisseur à renouveler | `runtime.test.js:303-314,510-581` ; `docs/mvp-plan.md:29,52` | moyenne |

## Défauts

| N° | Fichier:ligne | Gravité | Défaut | Scénario | Corrigé ou proposé |
|---|---|---|---|---|---|
| 1 | `packages/agent-runtime/router.js:34-50` | moyenne | Auto admettait une capacité obligatoire inconnue | Codex sans sonde précède Claude avec reprise/modèle/HTTP annoncé | corrigé (`[audit-01] Corriger routage, découverte et masquage ACP`) |
| 2 | `packages/agent-runtime/discovery.js:24-32` | faible | Un dossier `X_OK` pouvait être sélectionné comme CLI | Configuration `paths.gemini` pointant vers un dossier | corrigé (même commit) |
| 3 | `packages/agent-runtime/discovery.js:56-100` | élevée | Les sondes CLI recevaient tout l'environnement parent ; version ou erreur pouvait exposer un secret | CLI factice imprimant un jeton fictif sur stdout/stderr ; catalogue le révélait | corrigé (même commit) |
| 4 | `packages/agent-runtime/discovery.js:33-42`, `index.js:119-126` | moyenne | Shim `.cmd` non découvert puis non lancé directement sous Windows | CLI npm installé sous forme de shim `.cmd` ; adaptation Windows non exécutée | proposé, conditionné à un environnement Windows de test |
| 5 | `packages/agent-runtime/index.js:220-230` | élevée | Un secret MCP sous un nom neutre n'était pas masqué dans les événements | `HEADER=FICTIF-...` reflété par le faux agent | corrigé (même commit) |

## Comparaison aux sources

| Mécanisme | Source inspectée | Comparaison |
|---|---|---|
| Découverte / identifiants | `openclaw__acpx@c0b9dfd:src/agent-registry.ts:265-305` | acpx normalise les alias et résout des commandes ; nos quatre ID canoniques (`profiles.js`) n'ont pas d'alias public. Éviter une fusion de registres sans besoin. |
| Vérification du CLI | `openclaw__acpx@c0b9dfd:src/spawn-command-options.ts:257-272` | acpx exige un fichier exécutable ; notre simple `X_OK` acceptait les dossiers POSIX, corrigé. |
| Lancement Windows | `openclaw__acpx@c0b9dfd:src/spawn-command-options.ts:194-235` | acpx traite les `.cmd` via `cmd.exe` et échappement ; notre lancement `shell:false` n'a pas cette compatibilité Windows. Écart à signaler, sans portage non vérifié sur Windows. |
| Permissions | `openclaw__acpx@c0b9dfd:src/permission-policy.ts:65-104` | acpx valide des règles déclaratives ; le runtime délègue les décisions ponctuelles à `onPermission`. Pas de substitution : accords humains gardés par l'orchestrateur. |
| Annulation ACP | SDK installé `@agentclientprotocol/sdk` 2.0.2, `dist/core/jsonrpc.js:476,568-572` | `cancellationSignal` est bien employé ; la deadline locale protège du pair muet. |
| Reprise Gemini | `google-gemini__gemini-cli@cd1b45c:packages/cli/src/acp/acpSessionManager.ts:204-286` | `loadSession` recharge l'historique et renvoie modes/modèles ; notre `session()` normalise ces deux formes et authentifie avant reprise par clé. |
| Reprise Codex | `agentclientprotocol__codex-acp@a77829f:src/CodexAcpServer.ts:1640-1675` | Adaptateur réouvre une session, rejoue l'historique et renvoie modèles/modes ; notre client ACP délègue cette restauration au fournisseur. HEAD étudié, paquet publié distinct. |
| Permissions/annulation Claude | `agentclientprotocol__claude-agent-acp@ebfbfbd:src/acp-agent.ts:9988-10027` | Adaptateur borne une permission en attente par signal ; notre client ferme le processus lors d'une annulation/délai local et refuse les réponses tardives. HEAD étudié, paquet publié distinct. |
| Vie du processus | `openclaw__acpx@c0b9dfd:src/process-liveness.ts:1-24` | `process-liveness.js` adapte la sonde ESRCH et traite EPERM comme état inconnu ; tests vérifient groupe, SIGTERM, SIGKILL et réutilisation d'ID. |
| Modes et modèles OpenCode | `anomalyco__opencode@6806c6e:packages/cli/src/acp/config-option.ts:22-68` | La source annonce bien `configOptions` catégories `model` et `mode`, compatibles avec `sessionModels`/`sessionModes`. HEAD étudié, exécutable installé à distinguer. |

## Tests ajoutés

- `tests/runtime.test.js` : Auto refuse les capacités obligatoires inconnues (reprise, modèle, MCP HTTP) au profit d'un agent dont la sonde les annonce. Rouge puis vert conservés dans les journaux de preuve.
- `tests/runtime.test.js` : un dossier exécutable n'est pas sélectionné comme CLI (`discovery-red.log`, puis `runtime-final.log`).
- `tests/runtime.test.js` : les sondes CLI n'héritent pas des secrets étrangers au profil ; stdout de version et erreur ne publient pas un jeton fictif (`detection-secret-red.log`, `runtime-secret-green.log`).
- `tests/runtime.test.js` : une valeur MCP opaque au nom neutre reste masquée dans les événements (`mcp-secret-red.log`, `runtime-final-3.log`).

## Décisions et alternatives

- Corrections limitées au filtre du routeur, à la découverte CLI et au masquage des événements MCP ; aucun appel réel de modèle, aucune dépendance ajoutée, aucun clone modifié.
- `.cmd` Windows signalé sans portage non testé ; politique d'autorisations acpx écartée car les décisions appartiennent à l'orchestrateur et aux accords humains.

## État final, questions et suite

- **État final** : corrections opérationnelles sur faux ACP ; reprise fournisseur réelle non renouvelée ; lancement Windows `.cmd` incomplet. Preuves : `npm-test-final.log` (293 + 136 tests réussis, 1 ignoré, 0 échec), `check-final.log` et `format-final.log` verts. Aucun test payant ni mission réelle.
- Manager : valider sur Windows le lancement des shims `.cmd` avant de promettre cette compatibilité ; renouveler séparément la preuve de reprise avec les versions fournisseurs réellement installées, sans appel payant dans cet audit.
- Question pour l'utilisateur : aucune décision nécessaire pour les corrections livrées. La compatibilité Windows et les validations fournisseurs réelles restent à planifier hors de cet audit.

## Contrôle du manager (Claude) — 28/10, 01:25
- Diff relu (`d6e3eae`) : `discovery.js` (fichier et non dossier, sondes `--version`/`--help` sur l'environnement en
  liste blanche du profil, sortie et erreur masquées), `router.js` (en Auto, reprise, modèle imposé ou MCP non stdio
  exigent désormais une sonde qui les annonce ; `mcpTransport` vaut `stdio` par défaut, donc sans effet sur les
  missions ordinaires ni sur career-ops, dont le modèle est vide), `index.js` (toute valeur MCP d'au moins 8 caractères
  masquée). Aucune modification de career-ops. Les corrections de masquage relèvent de la vérification demandée par
  le brief (« redaction des secrets ») ; les points d'envoi reportés n° 1, 2, 5, 7 n'ont pas été touchés.
- Vrais tests (copie `red-a01`, `--test-reporter=tap`) : sans le correctif `discovery` → 3 échecs ; sans `router` →
  1 ; sans `index` → 1 ; avec tous les correctifs → `runtime.test.js` 51/51.
- Suite sur copie figée `d6e3eae` (00:18:06 → 01:19:25) : check et format verts ; 4 + 4 échecs, **tous causés par la
  veille du Mac** (dépassements de 120 s mesurés à ~900 s, alignés sur les cycles de veille du journal `pmset`).
  Relance des 7 fichiers en échec une fois la machine réveillée : 18/18 (01:20:50 → 01:21:07) et 113/113
  (01:21:12 → 01:24:31).
- **Incident de la nuit** : à 00:04:57, le Mac (écran rabattu, sur secteur) est entré en veille « Dark Wake Thermal
  Emergency », puis a alterné ~15 min de veille et ~45 s de réveil jusqu'à 01:20. `caffeinate -i` n'empêche pas la
  veille écran rabattu. Correctif à 01:20:38 : `caffeinate -s -i -w <chaîne>` (assertion temporaire, aucun réglage
  modifié), réveil complet à 01:20:33. Le manager ne lance plus de suite complète en parallèle de celles de Codex
  (charge 24 observée, cause probable de la surchauffe). audit-02 a tourné pendant cette fenêtre : ses dépassements de
  délai sont à rejuger.

**Verdict** : audit-01 VALIDÉ. Restent ouverts : lancement Windows `.cmd`, reprise fournisseur réelle non renouvelée.
