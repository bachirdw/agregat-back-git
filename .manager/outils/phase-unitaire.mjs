#!/usr/bin/env node
// Lance seulement la phase « unitaires et intégration » de scripts/run-tests.js (sans la phase Chrome réel),
// dans l'arbre git donné. Sert aux lots parallèles du chantier swarm : plusieurs phases Chrome en même temps
// font expirer les tests du navigateur ; la suite complète (npm test) est relancée par le manager, un arbre à la fois.
// Deux phases au plus tournent en même temps sur la machine (créneaux dans ./verrous) : les autres attendent leur tour.
// Usage : node phase-unitaire.mjs <arbre> [--liste]
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SLOTS = 2;
const WAIT_MS = 10_000;
const MAX_WAIT_MS = 60 * 60_000;
const PHASE_TIMEOUT_MS = Number(process.env.AGENT_PLATFORM_TEST_PHASE_TIMEOUT_MS) || 20 * 60_000;
const LOCKS = join(dirname(fileURLToPath(import.meta.url)), 'verrous');

const tree = resolve(process.argv[2] || '');
const src = readFileSync(join(tree, 'scripts/run-tests.js'), 'utf8');
const m = src.match(/const BROWSER = new Set\(\[([\s\S]*?)\]\);/);
if (!m) {
  console.error('Liste BROWSER introuvable dans scripts/run-tests.js');
  process.exit(2);
}
const browser = new Set([...m[1].matchAll(/'([^']+\.test\.js)'/g)].map((x) => x[1]));
const files = readdirSync(join(tree, 'tests'))
  .filter((f) => f.endsWith('.test.js') && !browser.has(f))
  .sort();
console.log(
  `▶ phase unitaire seule : ${files.length} fichier(s), ${browser.size} fichier(s) Chrome écartés, arbre ${tree}`,
);
if (process.argv.includes('--liste')) process.exit(0);

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
// Un créneau est un dossier créé de façon atomique ; il porte le pid de son détenteur. Un créneau dont le
// détenteur est mort (ou sans pid depuis plus d'une heure) est repris au passage suivant.
function take() {
  for (let i = 1; i <= SLOTS; i++) {
    const dir = join(LOCKS, `creneau-${i}`);
    try {
      mkdirSync(dir);
      writeFileSync(join(dir, 'pid'), `${process.pid}\n${tree}\n`);
      return dir;
    } catch (e) {
      if (e.code !== 'EEXIST') return 'sans-verrou';
      let pid = 0;
      try {
        pid = Number(readFileSync(join(dir, 'pid'), 'utf8').split('\n')[0]);
      } catch {
        // pid pas encore écrit : créneau tenu
      }
      let old = false;
      try {
        old = Date.now() - statSync(dir).mtimeMs > 60 * 60_000;
      } catch {
        // créneau disparu entre-temps
      }
      if ((pid && !alive(pid)) || (!pid && old)) {
        try {
          rmSync(dir, { recursive: true, force: true });
        } catch {
          // un autre l'a repris
        }
      }
    }
  }
  return null;
}
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

let slot = null;
const started = Date.now();
let told = false;
for (;;) {
  slot = take();
  if (slot) break;
  if (Date.now() - started > MAX_WAIT_MS) {
    console.error('Aucun créneau libre après une heure : la phase part sans créneau.');
    slot = 'sans-verrou';
    break;
  }
  if (!told) console.log('… deux phases tournent déjà sur la machine : attente d’un créneau');
  told = true;
  sleep(WAIT_MS);
}
if (slot === 'sans-verrou') console.log('(créneaux indisponibles : phase lancée sans attendre)');
else if (told) console.log(`… créneau obtenu après ${Math.round((Date.now() - started) / 1000)} s`);
const release = () => {
  if (slot && slot !== 'sans-verrou') {
    try {
      rmSync(slot, { recursive: true, force: true });
    } catch {
      // rien à rendre
    }
  }
  slot = null;
};
process.on('exit', release);

const t0 = Date.now();
const child = spawn(
  process.execPath,
  ['--test', '--test-concurrency=4', '--test-timeout=120000', ...files.map((f) => 'tests/' + f)],
  { cwd: tree, stdio: 'inherit' },
);
const timer = setTimeout(() => {
  console.error(`Phase expirée après ${PHASE_TIMEOUT_MS} ms`);
  child.kill('SIGKILL');
}, PHASE_TIMEOUT_MS);
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(s, () => {
    child.kill('SIGTERM');
    release();
    process.exit(1);
  });
}
child.on('error', (e) => {
  clearTimeout(timer);
  console.error(`Runner de tests : ${e.message}`);
  console.log('FIN phase unitaire : code 1');
  process.exit(1);
});
child.on('exit', (code) => {
  clearTimeout(timer);
  const c = code === 0 ? 0 : 1;
  console.log(`FIN phase unitaire : code ${c} (durée ${Math.round((Date.now() - t0) / 1000)} s)`);
  process.exit(c);
});
