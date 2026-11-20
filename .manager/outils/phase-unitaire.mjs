#!/usr/bin/env node
// Lance seulement la phase « unitaires et intégration » de scripts/run-tests.js (sans la phase Chrome réel),
// dans l'arbre git donné. Sert aux lots parallèles du chantier swarm : plusieurs phases Chrome en même temps
// font expirer les tests du navigateur ; la suite complète (npm test) est relancée par le manager, un arbre à la fois.
// Usage : node phase-unitaire.mjs <arbre> [--liste]
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

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
const r = spawnSync(
  process.execPath,
  ['--test', '--test-concurrency=4', '--test-timeout=120000', ...files.map((f) => 'tests/' + f)],
  { cwd: tree, stdio: 'inherit', timeout: 900000, killSignal: 'SIGKILL' },
);
if (r.error?.code === 'ETIMEDOUT') console.error('Phase expirée après 900000 ms');
else if (r.error) console.error(`Runner de tests : ${r.error.message}`);
process.exit(r.status === 0 ? 0 : 1);
