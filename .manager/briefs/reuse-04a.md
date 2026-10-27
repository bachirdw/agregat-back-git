# reuse-04a — Quart de l'étape 5 : liveness des processus d'après acpx (Codex, budget serré)

Il te reste peu de limite d'usage : **sois bref**. Rapport court `.manager/reports/reuse-04a.md` (journal de
10 lignes maximum, heures relevées avec `date +%H:%M`, jamais estimées, puis bilan), tests ciblés pendant le
travail et **une seule** suite complète à la fin. Lis seulement `AGENTS.md` (interdits), la source
`/Users/diaw/Downloads/agent-repos/openclaw__acpx/src/process-liveness.ts` (`@c0b9dfd`, MIT, 24 lignes) et
`AcpRuntime.close()` dans `packages/agent-runtime/index.js`. Commits `[reuse-04a]`. Jamais de push.

**Partage** : le manager branche ensuite ton module dans `AcpRuntime.close()` (SIGKILL seulement si le groupe n'est
pas mort à coup sûr, attente bornée, état d'arrêt renvoyé). **Ne modifie pas `packages/agent-runtime/index.js`** ;
seuls fichiers permis : le nouveau module, son test, `THIRD_PARTY_NOTICES.md`, ton rapport.

## À coder — `packages/agent-runtime/process-liveness.js` (copie adaptée, TS → JS ESM)
En-tête : `// Adapté de openclaw/acpx@c0b9dfd:src/process-liveness.ts — MIT`, et une ligne dans
`THIRD_PARTY_NOTICES.md` (licence MIT d'acpx, texte de copyright de son fichier `LICENSE`).
1. `isProcessAlive(pid)` et `isProcessDefinitelyDead(pid)` : même logique que la source (pid invalide, ≤ 0, non
   entier ou égal à `process.pid` → `false` pour les deux ; `ESRCH` seul = mort certaine ; `EPERM` = vivant mais
   pas à nous, donc **jamais** « mort »).
2. Une extension, commentée en une ligne : `processGroupState(pgid)` → `'alive' | 'dead' | 'unknown'` pour un groupe
   POSIX (`process.kill(-pgid, 0)`) : `ESRCH` → `dead`, succès → `alive`, toute autre erreur (`EPERM`…) →
   `unknown`. Sous Windows (`process.platform === 'win32'`) → `'unknown'` (pas de groupe POSIX).

## Tests (rouges avant, verts après) — `tests/process-liveness.test.js` (phase sans navigateur)
Sans faux succès : pids invalides (`undefined`, `0`, `-1`, `1.5`, `NaN`, `process.pid`) ; vrai processus enfant
(`spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'])`) vivant puis, après `kill` et événement `exit`,
mort à coup sûr ; groupe détaché (`detached: true`) : `alive` puis `dead` après `process.kill(-pid, 'SIGKILL')` ;
`EPERM` simulé en remplaçant `process.kill` le temps du test (restauré dans `finally`) → `isProcessAlive` vrai,
`isProcessDefinitelyDead` faux, `processGroupState` `unknown`. Arrête tous les processus créés. Fin : `npm test`,
`npm run check`, `npm run format:check`.

## Interdits (absolus)
Aucune modification de la bibliothèque career-ops ni de son Skill, aucune mission Gemini, aucun redémarrage/arrêt du
serveur 4310 ni du relais 19988, aucun `kill` d'un processus que tu n'as pas créé, aucune action sur un site réel,
pas de `.manager/secrets.env`, jamais de push.

## Fin : dernier message ≤ 12 lignes
MODIFICATIONS (lignes) · TESTS · LIMITES · CE QUI RESTE.
