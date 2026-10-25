// Runs the suite in two phases: non-browser tests in parallel, then real-Chrome tests serially.
// Several headless Chrome instances competing with ACP agents made browser tests time out under load.
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const BROWSER = new Set([
  'browser-gateway.test.js',
  'approval-bridge.test.js',
  'e2e-ui.test.js',
  'owner-browser.test.js',
]);
const files = readdirSync('tests')
  .filter((f) => f.endsWith('.test.js'))
  .sort();
const phases = [
  {
    name: 'unitaires et intégration (parallèle)',
    concurrency: 4,
    files: files.filter((f) => !BROWSER.has(f)),
  },
  { name: 'Chrome réel (série)', concurrency: 1, files: files.filter((f) => BROWSER.has(f)) },
];
let failed = false;
for (const p of phases) {
  if (!p.files.length) continue;
  console.log(`\n▶ ${p.name} : ${p.files.length} fichier(s)`);
  const r = spawnSync(
    process.execPath,
    [
      '--test',
      `--test-concurrency=${p.concurrency}`,
      '--test-timeout=120000',
      ...p.files.map((f) => 'tests/' + f),
    ],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
