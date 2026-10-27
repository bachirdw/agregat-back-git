# reuse-04 réduit — Étape 5 : liveness des processus d'après acpx (codée par Claude)

Codex indisponible : la session Claude a codé (décision de l'utilisateur, 27/10). Cahier des charges :
`briefs/reuse-04a.md` et HANDOFF § 0000. Source : `openclaw/acpx@c0b9dfd:src/process-liveness.ts` (MIT,
24 lignes), licence vérifiée (`LICENSE`, © 2025 OpenClaw Team).

## Journal (heures relevées avec `date`)
- 20:21 — Reprise : passation lue, modification de HANDOFF commitée (`6ac412f`).
- 20:23 — Étape 4 soldée avant l'étape 5 (`1aa2b78`) : constats n° 7, 8, 10 de sa relecture, horodatage estimé
  corrigé (voir `reuse-02.md` § Reprise).
- 20:29:53 — Tests rouges `tests/process-liveness.test.js` : module absent (`reuse-04-evidence/red-module.log`).
- 20:30:07 — Module seul écrit : 5 tests du module verts, 5 tests de `close()` rouges sur l'ancien code (il ne
  renvoie rien et tue à l'aveugle) — `red-close.log`.
- 20:30:37 — Nouveau `close()` : 1 rouge restant, `unknown` au lieu de `dead` en 1,8 ms pour un groupe qui sort
  sur SIGTERM. Cause mesurée (`zombie-probe.mjs/.log`, Darwin, Node 24.14.1) : tant que le leader tué n'est pas
  récolté, `kill(-pgid, 0)` répond **EPERM** (groupe de zombies), puis ESRCH. Correction : on sonde jusqu'à
  `dead` ou la borne ; SIGKILL seulement si le dernier état est `alive`.
- 20:31:35 — Défaut repéré en relisant : `events.once` rejette sur `error` → `close()` (sans `await`) aurait pu
  produire un rejet non géré sous Windows ; remplacé par une écoute de `exit`. Deux cas ajoutés (EPERM dès le
  départ : aucun signal ; attente EPERM bornée). 11/11 verts (`green.log`).
- 20:32 — Sondes de liveness maison des tests (`alive`/`waitDead` de `runtime.test.js`, boucle de
  `workflow-run.test.js`, qui prenaient EPERM pour « mort ») remplacées par le module ; 70/70.
- 20:32:27 → 20:37:08 — Suite complète : 287 + 1 ignoré, Chrome 136/136, check et format verts
  (`precommit-test.log`, `check.log`, `format-check.log`). Commit `d102e04`.

## Livré
- `packages/agent-runtime/process-liveness.js` : `isProcessAlive`, `isProcessDefinitelyDead` (ESRCH seul = mort ;
  pid invalide, non sûr ou le nôtre → faux pour les deux), `processGroupState(pgid)` → `alive|dead|unknown`
  (win32 → `unknown`). Écart à la source, documenté dans `THIRD_PARTY_NOTICES.md` : acpx renvoie `false` sur
  EPERM dans `isProcessAlive` ; ici EPERM = vivant mais pas à nous (exigence du brief).
- `AcpRuntime.close()` : idempotent (même promesse), appelable sans `await`, ne rejette jamais. POSIX : sonde ;
  `unknown` initial → attente ≤ 1 s (zombies) ; SIGTERM ; sonde 100 ms pendant 1,5 s ; SIGKILL **seulement si
  `alive`** ; attente ≤ 1 s ; état renvoyé `dead|alive|unknown|none`. Windows : `child.kill` + événement `exit`
  (non testable ici). Timers normaux (choix initial `unref` abandonné après relecture, voir plus bas).
- Écart au plan : l'état `alive` est renvoyé si le groupe survit à SIGKILL dans la borne (plutôt que de le masquer
  en `unknown`).

## Bilan des lignes
Après relecture (`1aa2b78..5b45990`) : produit +59/−10 (`index.js`), +35 (module), script d'audit +3/−11 (SIGKILL
aveugle maison supprimé). Tests : `process-liveness` +239, `runtime` +38/−13, `workflow-run` +3/−10 (sondes
maison retirées). Notice : +30 (relevé `git diff --numstat`).

## Relecture indépendante — `review-reuse-04-claude.md` (agent Claude sonnet, lecture seule, fichier écrit à 20:43:10 selon `stat`)
Aucun défaut haut. Tri et corrections (`5b45990`, commits `[review-reuse-04]`) :
- **n° 1 (moyenne) corrigé** : un groupe déjà vide à la sortie du leader recevait SIGTERM puis SIGKILL si son
  identifiant était réutilisé par un groupe du même utilisateur (EPERM ne protège que d'un autre utilisateur).
  Test rouge à 20:44:13 (`red-reuse.log` : `alive`, 2 signaux) → état du groupe relevé à l'événement `exit` ;
  vide → `close()` renvoie `dead` sans aucun signal. Reste possible : groupe vidé *après* la sortie du leader
  (petits-enfants morts plus tard) puis identifiant réutilisé avant `close()` — fenêtre étroite, non couverte.
- **n° 3 / n° 4 → changement de conception** : les attentes `unref` faisaient qu'un `close()` attendu dans un script
  autonome ne se résolvait jamais (le script sortait avant) et que SIGKILL était perdu si l'hôte sortait.
  Preuve `await-close-probe.mjs/.log` : `unref` → « JAMAIS (promesse non résolue) » ; timers normaux → `dead`.
  Coût borné : 3,5 s au pire, seulement pour un groupe qui ignore SIGTERM. Constat honnête : sous `node:test`,
  la version `unref` passait quand même (`red-unref.log`, le lanceur garde la boucle) ; l'aide `awaitClose` des
  tests était donc inutile et a été retirée.
- n° 2 corrigé (kill de nettoyage protégé contre EPERM) ; n° 5 corrigé (`scripts/acp-audit-probe.js` utilise
  `stopProcessGroup`, exporté par le runtime) ; n° 6 corrigé (`isSafeInteger` documenté) ; n° 7 corrigé (borne
  `< 2500`).
- n° 4, volet restant : la promesse d'état n'est lue par aucun appelant de production (orchestrateur, API) ; elle
  sert aux scripts et aux tests. Pas de régression ; à brancher si un journal d'arrêt devient utile.

## Limites
- Windows non exécuté (simulation de `process.platform` seulement).

## Contrôle du manager (Claude) — 27/10, 20:54
- Diff relu (`1aa2b78..5b45990`) : aucun SIGKILL possible sur `unknown` ; promesse sans rejet, bornée à 3,5 s ;
  aucune modification de career-ops ; aucun processus de test restant (`ps`).
- Rouge → vert : module absent, ancien `close()` (5 échecs), zombie macOS, réutilisation de groupe (n° 1).
- Suite sur copie figée `5b45990` (`git archive`, `node_modules` lié) de 20:50:40 à 20:54:30 : 288 + 1 ignoré,
  Chrome 136/136, check et format verts — `reuse-04-evidence/manager-control-suite.log`.

**Verdict** : étape 5 VALIDÉE.
