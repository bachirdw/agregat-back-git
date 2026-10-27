# Audit 04 — MCP Gateway, Skill Registry, facturation

## Journal horodaté et commandes

- 01:32 — `git status --short` vide ; `git log -5 --oneline` : dernier commit `8e30d56`. Lecture de `AGENTS.md`, `.manager/briefs/audit-04.md`, `_audit-common.md` ; aucun rapport `audit-04.md` préexistant. Création de ce rapport et de `audit-04-evidence/`.
- 01:33 — Lecture ciblée des exigences (Mission, Plan, ADR 004/007, reuse-06/07), de tous les fichiers des trois packages, des trois tests dédiés et des tests connexes repérés avec `rg -l`. Suite initiale lancée : `npm test`, `npm run check`, `npm run format:check` → journaux `*-initial.log`.
- 01:34 — Deux tests rouges ajoutés (`tests/mcp-contract.test.js`, `tests/skill-registry.test.js`) : `node --test tests/mcp-contract.test.js tests/skill-registry.test.js` → **sortie 1, 26 tests, 2 échecs attendus** ; schéma `evidence_echo` sans `additionalProperties: false`, agent inconnu exporté. Preuve `red-contracts.log`. Corrections dans `packages/mcp-gateway/server.js` et `packages/skill-registry/index.js` ; même commande → **sortie 0, 26/26** (`green-contracts.log`).
- 01:35 — `npx prettier --write` → sortie 0. Tests dédiés `node --test tests/mcp-contract.test.js tests/skill-registry.test.js tests/billing.test.js` → **sortie 0, 41/41** (`targeted.log`). Suite initiale achevée : `npm test` sortie 1 à cause de Chrome dans le bac à sable (`SIGABRT`, `kill EPERM`) ; `check` sortie 0 ; `format:check` sortie 1 parce que la commande a vu le test modifié avant reformatage. Preuves `*-initial.log`.
- 01:36 — Première garde avant commit : `npm test` → sortie 1 ; phase sans Chrome **298 réussis, 0 échec, 1 ignoré** ; phase Chrome **61 réussis, 75 échecs** dus au lancement avorté de Chrome dans ce bac à sable. `npm run check` et `npm run format:check` → sorties 0. Preuves `precommit-*.log`. Aucune tentative sur le Chrome du propriétaire ni sur les ports réservés.
- 01:36 — Défaut de confinement Git confirmé avec faux exécutable local, URL FICTIVE et Skill FICTIF : `node --test tests/skill-registry.test.js` → **sortie 1, 21 tests, 1 échec attendu** : `subdir=linked/skill` traverse un lien symbolique du clone et importe le Skill extérieur. Preuve `red-git-symlink.log`. Correction dans `packages/skill-registry/index.js` avec `safeDirectory` avant import ; Prettier sortie 0 et test ciblé **sortie 0, 21/21** (`green-git-symlink.log`).

- 01:39 — Spécification officielle suivie depuis le pointeur `anthropics__skills/spec` : https://agentskills.io/specification, sections `name` et `description`. Test rouge `node --test tests/skill-registry.test.js` → sortie 1, 22 tests, 1 échec attendu (`red-spec.log`) ; correction de `parseFrontMatter` dans `packages/skill-registry/scan.js` (nom sans `--` ni tiret final, description de 1 à 1 024 caractères). Prettier sortie 0 ; même fichier → sortie 0, 22/22 (`green-spec.log`).

Les journaux détaillés sont sous `.manager/reports/audit-04-evidence/` et sont ignorés par Git ; les résultats ci-dessus sont les sorties réelles, sans appel de modèle, service payant, site réel ni serveur hors 127.0.0.1.

## Écarts au plan

| Exigence (source) | État réel | Preuve | Gravité |
| --- | --- | --- | --- |
| MCP : découverte stdio, outils typés et filtrage (`.manager/MISSION.md:41-44`, `.manager/PLAN.md:21,47`) | Partiel : stdio interne opérationnel ; serveurs externes arbitraires incomplets | `packages/mcp-gateway/server.js:17-18,65-83,103-142` ; `docs/architecture.md:52-53` | moyenne |
| Arguments inconnus refusés par le contrat MCP (`.manager/reuse-plan.md:100-108`) | Corrigé pour les schémas bruts ; objets Zod déjà stricts conservés | test rouge→vert `red-contracts.log` / `green-contracts.log`, `packages/mcp-gateway/server.js:65-73` | moyenne |
| Hook générique de pack pour l’enregistrement MCP (`.manager/reuse-plan.md:100-107`) | Différent : branche explicite `career-ops` et import dynamique des autres packs ; `reuse-07` a été clos sans code dans le plan validé | `packages/mcp-gateway/server.js:156-183`, `.manager/reuse-plan.md:3` | faible / dette d’architecture |
| Format portable Agent Skills : nom et description conformes (https://agentskills.io/specification, sections front matter) | Corrigé : nom sans double tiret/tiret final, description ≤ 1 024 caractères | `packages/skill-registry/scan.js:57-79`, `red-spec.log` / `green-spec.log` | moyenne |
| Skills SKILL.md tiers en quarantaine, hash de tous les fichiers et revue liée au hash (`docs/adr/004-browser-and-skill-boundaries.md:26-30`, `.manager/PLAN.md:48`) | Fait ; chemin Git traversant un lien intermédiaire corrigé | `packages/skill-registry/scan.js:73-195`, `index.js:122-161,213-242` ; `red-git-symlink.log` | élevée avant correction |
| Export vers dossiers projet par agent, seulement snapshot revu (`docs/adr/004-browser-and-skill-boundaries.md:30`, `.manager/reuse-plan.md:89-98`) | Partiel : chemins connus corrects, agent inconnu désormais refusé ; fichiers obsolètes d’un export précédent non purgés | `packages/skill-registry/index.js:15-21,298-316` | moyenne |
| Mètres séparés, BYOA non facturable, prix à zéro par défaut, mesure avant action (`docs/adr/007-usage-and-billing.md:5-18,30-32`) | Fait pour les catégories instrumentées ; documents et infrastructure encore prévus | `packages/billing/index.js:6-37`, `packages/mcp-gateway/server.js:45-83`, `tests/billing.test.js:276-299` ; ADR 007:26 | faible pour compteurs prévus |
| Ledger SHA-256 chaîné et ancré, refus d’ajout si corrompu (`docs/adr/007-usage-and-billing.md:33-36`) | Fait, limite de l’ancre locale documentée | `packages/storage/index.js:119-125,150-225`, `tests/billing.test.js:85-110,258-275,318-330` | aucune constatée |

## Défauts

| N° | Fichier:ligne | Gravité | Défaut | Scénario | Corrigé ou proposé |
| --- | --- | --- | --- | --- | --- |
| 1 | `packages/mcp-gateway/server.js:65-73` | moyenne | Les schémas Zod bruts publiaient et acceptaient des propriétés inconnues | `evidence_echo` ou outil Najah avec `script` ajouté au payload | Corrigé, test rouge→vert ; commit `[audit-04]` de cette session |
| 2 | `packages/skill-registry/index.js:298-300` | moyenne | Agent inconnu exporté silencieusement comme Codex | `exportTo(workspace, 'agent-inconnu', ids)` écrivait `.agents/skills` | Corrigé, test rouge→vert ; commit `[audit-04]` de cette session |
| 3 | `packages/skill-registry/index.js:213-215` | élevée | `importGit` pouvait suivre un lien symbolique intermédiaire dans `subdir` et lire un Skill hors du clone | faux clone FICTIF : `linked/skill` pointait vers un répertoire extérieur | Corrigé, test rouge→vert ; commit `[audit-04]` de cette session |
| 4 | `packages/skill-registry/scan.js:66-78` | moyenne | Le parseur acceptait un nom non portable et une description hors limite | `name: double--dash` ou `trailing-`, 1 025 caractères | Corrigé, test rouge→vert ; commit `[audit-04]` de cette session |
| 5 | `packages/skill-registry/index.js:309-314` | moyenne | Un nouvel export écrit les fichiers courants sans effacer les anciens du même dossier | une référence retirée d’une version peut demeurer visible à l’agent dans le workspace | Proposé : décision de propriété du dossier et remplacement atomique ; ne pas supprimer silencieusement des fichiers du workspace utilisateur |

## Comparaison aux sources

| Mécanisme | Source inspectée (commit, fichier:lignes) | Comparaison et décision |
| --- | --- | --- |
| Outils MCP | `modelcontextprotocol__typescript-sdk@951fe560:packages/server/src/server/mcp.ts:263-285,1090-1118` (package Apache-2.0) | `McpServer.registerTool` est la bonne API ; le SDK normalise les formes brutes, sans imposer notre politique stricte. Correction locale du schéma à l’enregistrement, aucune copie de code. |
| Wrapper MCP | `modelcontextprotocol__servers@51b6382a:src/filesystem/server.ts:225-249` | Ce serveur enveloppe également `registerTool` pour appliquer un contrôle commun. Chez nous le wrapper mesure avant handler ; la validation des arguments est confiée au SDK, avec schéma strict. Étude seule. |
| Autorisation MCP | `agentgateway__agentgateway@eec64299:crates/agentgateway/src/mcp/rbac.rs:12-62` (Apache-2.0) | Règles par type de ressource et contexte ; notre MVP garde `RunPolicy`, accords et budget locaux. Aucun portage RBAC. |
| Layout Skills | `vercel-labs__skills@a80e4c9:src/agents.ts:155-164,224-231,361-365` (MIT) | Claude `.claude/skills`, Codex et Gemini `.agents/skills` correspondent déjà ; aucun agent supplémentaire réellement supporté à ajouter. Refus de l’identifiant inconnu ; pas de copie ni de chemins globaux. |
| Format Skills | `anthropics__skills@dbd4588:spec/agent-skills-spec.md:1-3` | Ce pointeur renvoie vers https://agentskills.io/specification (consulté le 28/10, lignes 47-55, 83-121) ; notre parseur exige `name`/`description` et applique désormais les bornes du format, inventorie fichiers et licences par Skill. Aucun Skill copié, licences hétérogènes maintenues. |

## Tests ajoutés

- `tests/mcp-contract.test.js` : schéma publié strict et refus d’argument inconnu pour outil cœur et outil de pack FICTIF.
- `tests/skill-registry.test.js` : agent inconnu refusé sans écrire ; clone Git FICTIF dont un sous-dossier traverse un lien symbolique intermédiaire refusé ; contraintes de nom et description du format Agent Skills.
- Suites dédiées : 41/41 avant le test Git ; 21/21 après correction Git ; 22/22 après correction du format. Garde finale à renseigner après exécution.

## Décisions, questions pour le manager et reste à faire

- Pas de refonte du pack MCP : le plan de réutilisation validé clôt `reuse-07` sans code. Le couplage `career-ops` reste un écart documenté demandant un brief dédié, comme `.manager/reuse-plan.md:109`.
- Pas de prix ni de licence supposés ; aucune dépendance ni copie open source ajoutée. Le ledger est dans `packages/storage`, hors périmètre de modification, mais ses tests d’intégrité ont été relus.
- **Question** : l’export d’un Skill doit-il être propriétaire de tout `.agents/skills/<id>` / `.claude/skills/<id>` ? Cela détermine comment retirer les fichiers périmés sans effacer des fichiers de l’utilisateur.
- Reste : commit local atomique, vérifier `git status`. Les neuf fichiers de la phase Chrome requièrent le contrôle hors bac à sable du manager prévu dans `_audit-common.md` : `approval-bridge`, `browser-click-ref`, `browser-type-upload-ref`, `browser-select-check`, `browser-fill-form`, `browser-field-review`, `browser-gateway`, `e2e-ui`, `owner-browser`.
- 01:39 — Garde intermédiaire (après correction Git, avant correction du format) : `npm test` sortie 1, phase sans Chrome 299 réussis / 0 échec / 1 ignoré ; Chrome 61 réussis / 75 échecs `SIGABRT`/`EPERM`. `npm run check` et `npm run format:check` sorties 0. Preuves `final-precommit-*.log`. Nouvelle garde lancée pour inclure `scan.js`.
- 05:34 — Reprise après interruption : `git status --short` montre cinq fichiers de code/tests modifiés et ce rapport non suivi ; dernier commit `4ba8000` (contrôle manager d'audit-03). La garde annoncée à 01:39 n'a pas de résultat final dans `precommit-final-test.log` (journal interrompu) ; relance nécessaire. `ps -axo ...` a échoué avec `operation not permitted` dans le bac à sable. Une modification transitoire de `.manager/run-until-done.sh` est apparue au premier `git status`, puis a disparu sans intervention ; elle n'est pas incluse dans l'audit.
- 05:35 — Garde avant commit relancée : `npm test` en cours (`precommit-resume-test.log`) ; `npm run check` sortie 0, « Syntaxe JavaScript valide » (`precommit-resume-check.log`) ; `npm run format:check` sortie 0, « All matched files use Prettier code style! » (`precommit-resume-format.log`).
- 05:36 — `npm test` sortie **1** : phase sans Chrome 301 tests, 300 réussis, 0 échec, 1 ignoré ; phase Chrome 136 tests, 61 réussis, 75 échecs. Diagnostics `browserType.launchPersistentContext`, Chrome `SIGABRT` et `kill EPERM`, identiques aux gardes précédentes ; preuve `precommit-resume-test.log`. Les tests Chrome restent **incomplets dans ce bac à sable** et seront relancés hors bac à sable par le manager. Les quatre corrections techniques et les nouveaux tests sont **opérationnels sur la phase sans Chrome** ; aucune validation Chrome n'est revendiquée.
- 05:36 — `git diff --check` sortie 0. Tentative de `git add` puis commit local : **échec sortie 128**, `.git/index.lock: Operation not permitted` ; aucun fichier n'a été stagé. Le bac à sable accorde lecture seule à `.git` ; tentative avec élévation de permission nécessaire.
