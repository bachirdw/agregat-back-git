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
  (non testable ici). Timers `unref` (la fermeture ne retarde jamais la sortie de la plateforme).
- Écart au plan : l'état `alive` est renvoyé si le groupe survit à SIGKILL dans la borne (plutôt que de le masquer
  en `unknown`).

## Bilan des lignes
Produit : +55/−10 (`index.js`), +35 (module). Tests : +249 (nouveau), +13/−23 (sondes maison retirées). Notice : +29.

## Limites
- Windows non exécuté (simulation de `process.platform` pour la sonde seulement).
- `scripts/acp-audit-probe.js` garde son propre SIGTERM/SIGKILL : script d'audit autonome, hors runtime, laissé tel quel.
