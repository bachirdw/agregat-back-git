import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';
import { listSkillProviders, resetSkillProvidersCache } from '../packages/career-ops/providers.js';

// Espace FICTIF : faux fournisseurs (fichiers vides), faux scan.mjs qui écrit l'environnement reçu.
const PROVIDERS = [
  'greenhouse',
  'lever',
  'workday',
  'jobstreet',
  'arbeitnow',
  'ashby',
  'local-parser',
  '_registry',
  '_http',
];
function workspace(t, { providers = PROVIDERS } = {}) {
  resetSkillProvidersCache();
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'providers-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  if (providers) {
    mkdirSync(join(root, 'providers'));
    for (const name of providers) writeFileSync(join(root, 'providers', `${name}.mjs`), '');
  }
  writeFileSync(join(root, 'scan.mjs'), 'console.log(JSON.stringify(process.env))');
  const portals = (text) => {
    writeFileSync(join(root, 'portals.yml'), text);
    writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  };
  return { root, portals, tools: new CareerTools({ path: () => root }) };
}
const entry = (extra) => `tracked_companies:\n  - name: Société FICTIVE\n${extra}\n`;

test('scan : tous les fournisseurs du Skill sont acceptés, sans liste codée en dur', async (t) => {
  const { portals, tools } = workspace(t);
  for (const provider of ['greenhouse', 'lever', 'workday', 'jobstreet', 'arbeitnow']) {
    portals(entry(`    provider: ${provider}\n    careers_url: https://jobs.example.test/x`));
    assert.equal((await tools.script({ command: 'scan' })).exitCode, 0, provider);
  }
});

test('scan : un fournisseur absent du Skill est refusé avec son nom', async (t) => {
  const { portals, tools } = workspace(t);
  portals(entry('    provider: inconnu-fictif'));
  await assert.rejects(tools.script({ command: 'scan' }), /inconnu-fictif.*inconnu du Skill/);
  // Les fichiers à préfixe _ (aides du Skill) ne sont pas des fournisseurs.
  portals(entry('    provider: _registry'));
  await assert.rejects(tools.script({ command: 'scan' }), /_registry/);
});

test('scan : local-parser est refusé avec la raison', async (t) => {
  const { portals, tools } = workspace(t);
  portals(entry('    provider: local-parser'));
  await assert.rejects(tools.script({ command: 'scan' }), /local-parser.*clone revu/);
  portals(entry('    parser:\n      command: ./mon-script'));
  await assert.rejects(tools.script({ command: 'scan' }), /non autorisé/);
});

test('scan : dossier des fournisseurs absent, refus explicite', async (t) => {
  const { portals, tools } = workspace(t, { providers: null });
  portals(entry('    provider: greenhouse'));
  await assert.rejects(tools.script({ command: 'scan' }), /fournisseurs du Skill introuvables/);
});

test('listSkillProviders : noms sans préfixe _ ni extension, triés', (t) => {
  const { root } = workspace(t);
  assert.deepEqual(listSkillProviders(root), [
    'arbeitnow',
    'ashby',
    'greenhouse',
    'jobstreet',
    'lever',
    'local-parser',
    'workday',
  ]);
});

test('scan : hôte https public accepté dans careers_url, sans provider', async (t) => {
  const { portals, tools } = workspace(t);
  portals(entry('    careers_url: https://careers.example.test/jobs'));
  assert.equal((await tools.script({ command: 'scan' })).exitCode, 0);
});

test('scan : careers_url http, locale ou privée refusée avec l’hôte dans le message', async (t) => {
  const { portals, tools } = workspace(t);
  for (const [url, host] of [
    ['http://jobs.example.test/x', 'jobs.example.test'],
    ['https://localhost/x', 'localhost'],
    ['https://127.0.0.1/x', '127.0.0.1'],
    ['https://10.1.2.3/x', '10.1.2.3'],
    ['https://192.168.0.5/x', '192.168.0.5'],
    ['https://[::1]/x', '::1'],
    ['https://imprimante.local/x', 'imprimante.local'],
    ['https://intranet/x', 'intranet'],
    ['not a url', 'not a url'],
  ]) {
    portals(entry(`    careers_url: ${JSON.stringify(url)}`));
    await assert.rejects(
      tools.script({ command: 'scan' }),
      (e) => e.message.includes(host) && /Scanner/.test(e.message),
      url,
    );
  }
});

test('scan : les secrets et variables du Skill désactivés ne sont pas transmis', async (t) => {
  const { portals, tools } = workspace(t);
  portals(entry('    provider: greenhouse'));
  const names = [
    'APIFY_TOKEN',
    'PRIVACY_FICTIF',
    'CAREER_OPS_PDF_SHARED',
    'CAREER_OPS_BROWSER_AUTODETECT',
    'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH',
    'CLAUDE_PLUGIN_ROOT',
    'GEMINI_API_KEY',
  ];
  const saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  t.after(() => {
    for (const n of names)
      if (saved[n] === undefined) delete process.env[n];
      else process.env[n] = saved[n];
  });
  for (const n of names) process.env[n] = 'FICTIF-valeur';
  const env = JSON.parse((await tools.script({ command: 'scan' })).text);
  for (const n of names) assert.equal(env[n], undefined, n);
  assert.equal(typeof env.CAREER_OPS_ROOT, 'string');
});
