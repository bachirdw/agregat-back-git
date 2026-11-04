import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { CareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';

// Espace career-ops FICTIF : chaque « script du Skill » est un faux qui renvoie ses arguments.
// Les vrais scripts du Skill ne sont pas lancés (lecture seule, dépendances de l'installation).
const ENTRIES = [
  'reserve-report-num',
  'merge-tracker',
  'set-status',
  'precheck-duplicate',
  'tracker',
  'verify-pipeline',
  'check-liveness',
];
function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'skill-scripts-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  for (const name of ENTRIES)
    writeFileSync(
      join(root, `${name}.mjs`),
      `console.log(JSON.stringify({ script: ${JSON.stringify(name)}, args: process.argv.slice(2), root: process.env.CAREER_OPS_ROOT }))`,
    );
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  return { root, tools: new CareerTools({ path: () => root }) };
}
const run = async (tools, command, args = []) =>
  JSON.parse((await tools.script({ command, args })).text);

test('career_script : les entrées auditées du Skill sont admises avec leurs arguments bornés', async (t) => {
  const { root, tools } = workspace(t);
  assert.deepEqual(await run(tools, 'reserve-report-num'), {
    script: 'reserve-report-num',
    args: [],
    root,
  });
  assert.deepEqual((await run(tools, 'reserve-report-num', ['--release', '042'])).args, [
    '--release',
    '042',
  ]);
  assert.deepEqual((await run(tools, 'merge-tracker', ['--dry-run'])).args, ['--dry-run']);
  assert.deepEqual(
    (await run(tools, 'set-status', ['--report', '42', 'Applied', '--note', 'Note FICTIVE'])).args,
    ['--report', '42', 'Applied', '--note', 'Note FICTIVE'],
  );
  assert.deepEqual(
    (
      await run(tools, 'precheck-duplicate', [
        '--company',
        'Entreprise FICTIVE',
        '--title',
        'Poste FICTIF',
        '--url',
        'https://jobs.example.test/offre/1?gh_jid=1&utm_source=x',
        '--json',
      ])
    ).args.length,
    7,
  );
  assert.deepEqual(
    (await run(tools, 'tracker', ['query', '--status', 'Evaluated', '--json'])).args,
    ['query', '--status', 'Evaluated', '--json'],
  );
  assert.deepEqual((await run(tools, 'verify-pipeline')).args, []);
  assert.deepEqual(
    (await run(tools, 'check-liveness', ['https://jobs.example.test/offre/1'])).args,
    ['https://jobs.example.test/offre/1'],
  );
});

test('career_script : commande hors liste, drapeau inconnu ou argument libre refusés', async (t) => {
  const { tools } = workspace(t);
  for (const command of ['dedup-tracker', 'node', 'merge-tracker.mjs', 'scripts/../merge-tracker'])
    await assert.rejects(tools.script({ command }), /non autorisée/, command);
  for (const [command, args] of [
    ['merge-tracker', ['--migrate']],
    ['merge-tracker', ['fichier.tsv']],
    ['reserve-report-num', ['--count', '8']],
    ['reserve-report-num', ['--release', '042;rm']],
    ['reserve-report-num', ['--release', '042', '--gc']],
    ['set-status', ['--report', '42', 'Applied', '--force']],
    ['set-status', ['--report', 'x', 'Applied']],
    ['set-status', ['--note=FICTIF', '--report', '42', 'Applied']],
    ['set-status', ['--report', '42', 'Applied', '--note', 'ligne\nsuivante']],
    ['set-status', ['a', 'b', 'c']],
    ['precheck-duplicate', ['--company', '--title']],
    ['precheck-duplicate', ['--url', 'javascript:alert(1)']],
    ['tracker', ['delete', '--num', '1']],
    ['tracker', ['export', '--out', '/tmp/x']],
    ['verify-pipeline', ['--fix']],
    ['check-liveness', ['--file', 'urls.txt']],
    ['check-liveness', ['file:///etc/passwd']],
    ['check-liveness', []],
    ['merge-tracker', ['--dry-run', '--dry-run']],
  ])
    await assert.rejects(
      tools.script({ command, args }),
      /Arguments|argument/i,
      `${command} ${args}`,
    );
  await assert.rejects(tools.script({ command: 'merge-tracker', query: 'FICTIF' }), /non attendu/);
  await assert.rejects(
    tools.script({ command: 'merge-tracker', path: 'data/applications.md' }),
    /non attendu/,
  );
});

test('career_script : reçu de revue et secret implicite exigés comme pour scan', async (t) => {
  const { root, tools } = workspace(t);
  writeFileSync(join(root, 'merge-tracker.mjs'), 'console.log("FICTIF modifié")');
  await assert.rejects(tools.script({ command: 'merge-tracker' }), /modifié/);
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  writeFileSync(join(root, '.env'), 'FICTIF=non-secret');
  await assert.rejects(tools.script({ command: 'merge-tracker' }), /configuration secrète/);
});

test('career_script : un code de sortie non nul du Skill est rendu, pas masqué', async (t) => {
  const { root, tools } = workspace(t);
  writeFileSync(
    join(root, 'check-liveness.mjs'),
    'console.log("uncertain FICTIF"); console.error("détail FICTIF"); process.exitCode = 1',
  );
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  const result = await tools.script({
    command: 'check-liveness',
    args: ['https://jobs.example.test/offre/1'],
  });
  assert.equal(result.exitCode, 1);
  assert.match(result.text, /uncertain FICTIF/);
  assert.match(result.text, /détail FICTIF/);
});

test('MCP career-ops : career_script publie les scripts du Skill et refuse une commande hors liste', async (t) => {
  const { root } = workspace(t);
  const client = await connectMcp({
    command: process.execPath,
    args: [
      fileURLToPath(new URL('../packages/mcp-gateway/server.js', import.meta.url)),
      'career-ops',
    ],
    env: [
      { name: 'RELAY_BROWSER', value: 'fixture' },
      { name: 'RELAY_CAREER_WORKSPACE', value: root },
      { name: 'RELAY_POLICY', value: JSON.stringify({ capabilities: [] }) },
    ],
  });
  t.after(() => client.close());
  const tool = (await client.listTools()).tools.find((entry) => entry.name === 'career_script');
  for (const name of ENTRIES) assert.match(tool.description, new RegExp(name));
  const admitted = await client.callTool({
    name: 'career_script',
    arguments: { command: 'merge-tracker', args: ['--dry-run'] },
  });
  assert.equal(admitted.isError, undefined, admitted.content[0].text);
  assert.deepEqual(JSON.parse(JSON.parse(admitted.content[0].text).text).args, ['--dry-run']);
  const refused = await client.callTool({
    name: 'career_script',
    arguments: { command: 'dedup-tracker' },
  });
  assert.equal(refused.isError, true);
  assert.match(refused.content[0].text, /non autorisée/);
});
