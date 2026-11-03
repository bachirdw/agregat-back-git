# Rapport — etapes-incertaines

Base : `origin/cloud-base-suite-astra` (`caf7716`), branche locale `etapes-incertaines`.
Session Claude (cloud), conteneur Linux, Node 24.22.1 (`/opt/node24`, le Node 22 par défaut ne satisfait
pas `engines`). Dépendances installées par `npm ci` (lockfile inchangé, `node_modules/` non versionné).

## Journal

### 11:30 — Démarrage et lecture
- `git fetch origin cloud-base-suite-astra contre-verif-cloud codex/browser-audit-31-10` puis
  `git checkout -b etapes-incertaines origin/cloud-base-suite-astra`. Le suivi automatique vers
  `cloud-base-suite-astra` a été retiré (`git branch --unset-upstream`) pour qu'aucun push ne parte
  vers la base par erreur.
- Lus : `AGENTS.md`, `.manager/reports/suite-astra-effets.md`, constat 9 de
  `origin/contre-verif-cloud:.manager/reports/contre-verif-cloud.md`.
- Constat de départ : `beforeEffect`, cité par le brief comme « existant » dans
  `packages/orchestrator/workflow-run.js`, n'existe pas dans la base `caf7716`
  (`grep -rn beforeEffect` ne trouve rien). Il n'existe que dans `6754f25`, commit écarté.

### 11:45 — Ligne de base des tests ciblés (avant toute modification)
`node --test --test-concurrency=4 tests/workflow-engine.test.js tests/workflow-run.test.js
tests/workflow-resume.test.js tests/pack-effects.test.js tests/astra-workflow.test.js
tests/mcp-contract.test.js tests/workflow-review.test.js` : 64 tests, 64 réussis.

## Relecture critique de `6754f25` (défaut 2)
`git show 6754f25 -- packages/orchestrator/workflow-run.js packages/workflow-engine/index.js` :
1. **Ne couvre pas le cas vécu.** Pour une étape `tool`, seul l'échec de `connectMcp` est marqué.
   `scope.promptStarted = true` est posé avant `client.callTool`, donc un refus de la passerelle
   (« Résolution DNS impossible ») restait `uncertain`.
2. **Le marqueur est rangé dans `output`** (`{ beforeEffect: true }`). Une étape optionnelle en échec
   transmet son `output` aux étapes suivantes (`inputs`) et au résultat final : la métadonnée du moteur
   se mêle aux données.
3. **Signal par propriété libre** (`e?.beforeEffect === true`) : n'importe quel objet d'erreur portant
   ce champ passe, alors qu'une classe d'erreur de la plateforme ne se fabrique pas depuis un texte.
4. Aucun test des cas ambigus (délai, coupure après envoi, erreur inconnue).
Repris : l'idée qu'un échec avant le prompt d'un agent est sans effet, et le traitement de la reprise
(`recover`) pour qu'un tel échec ne redevienne pas `uncertain`.

### 12:05 — Défaut 1 corrigé (commit `6cc4591`)
- `stepDecision` (`packages/orchestrator/index.js`) : sur une mission terminale sans moteur actif,
  `done` et `fail` passent par `this.workflows.resolveUncertain` sur la seule ligne de l'étape ; aucun DAG
  relancé, état de la mission inchangé. `retry` est refusé : « Mission terminée : relancer cette étape exige
  de reprendre la mission ; sans reprise possible, la marquer faite ou en échec. »
- Test `tests/step-decision-terminal.test.js` : vraie mission (exécuteur, faux agent ACP FICTIF qui échoue
  après le prompt), annulation, reprise refusée (400, « reprise refusée »), puis route
  `POST /api/runs/:id/steps/:step`. Rouge avant : 4/5 en échec (« Workflow annulé ou inactif ») ; vert
  après : 5/5. `npm run check` OK ; Prettier OK sur les deux fichiers.
- Non vérifié : `npm test` complet ; front absent.
- Limite connue : après un arrêt brutal, une étape restée `running` sur une mission `interrupted` dont la
  reprise est refusée n'est pas `uncertain` ; elle reste sans décision possible (non traité).

## État final : PARTIEL (arrêt demandé, limite de session presque épuisée)
- Défaut 1 : fait et testé (voir ci-dessus).
- Défaut 2 (échec prouvé sans effet) : **non implémenté**. Conception retenue, à reprendre :
  classe `BeforeEffectError` dans `packages/workflow-engine/` ; levée par `BrowserGateway.execute` pour
  toute erreur avant `provider.prepare` (schéma, capacité, `assertUrl` dont DNS) ; marqueur
  `_meta['relay/before-effect']` posé seulement par le gestionnaire des outils navigateur de
  `packages/mcp-gateway/server.js` et pour un refus de validation du SDK (surcharge gardée de
  `validateToolInput`) ; l'exécuteur `workflow-run.js` convertit ce marqueur et l'échec de `connectMcp`
  en `BeforeEffectError` ; le moteur donne `failed` ou relance selon `retries`, et une colonne
  `failed_before_effect` (migration `ALTER TABLE`) évite le retour en `uncertain` à la reprise.
  Tests prévus : DNS réel `jobs.example.test` (ENOTFOUND vérifié en 14 ms dans ce conteneur), refus de
  politique, argument invalide, pack inexistant (connexion MCP impossible) ; restent `uncertain` : délai,
  coupure après envoi, même texte d'erreur sans marqueur, erreur inconnue.
- Défaut 3 (démo Najah) : **non implémenté**. Solution retenue : remplacer l'étape `snapshot`
  (`browser_snapshot`) par `evidence_echo` `effect: read` avec un texte FICTIF explicite ; adapter
  `tests/pack-effects.test.js`, `workflow-run.test.js:71` et `workflow-resume.test.js:67` ; signaler que la
  reprise des anciennes missions de ce DAG sera refusée.
- Tests non lancés : `npm test` complet, `npm run format:check` global.
