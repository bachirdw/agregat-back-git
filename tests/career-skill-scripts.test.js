import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
  // production-01 : chaîne CV/lettre de modes/pdf.md et modes/cover.md.
  'build-cv-html',
  'verify-cv-facts',
  'verify-cv-structure',
  'generate-pdf',
  'generate-cover-letter',
  'mark-pdf-ready',
  'cv-templates',
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
  // bilan-04 (E45) : une clé que le script ne prend pas est nommée, avec la forme attendue.
  await assert.rejects(
    tools.script({ command: 'merge-tracker', query: 'FICTIF' }),
    /args: \[\].*clé inconnue pour ce script : query/,
  );
  await assert.rejects(
    tools.script({ command: 'merge-tracker', path: 'data/applications.md' }),
    /clé inconnue pour ce script : path/,
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

// production-01, point 1 : chaîne CV/lettre du Skill (modes/pdf.md étapes 17b–21, modes/cover.md étape 9,
// mark-pdf-ready en fin de mode pdf). Grammaires fermées tirées de l'analyse d'arguments de chaque script.
const CV_JSON = 'output/cv-candidat-fictif-042-entreprise-fictive.json';
const CV_HTML = 'output/cv-candidat-fictif-042-entreprise-fictive.html';
const CV_PDF = 'output/cv-candidat-fictif-042-entreprise-fictive-2026-11-05.pdf';
test('career_script : chaîne CV/lettre du Skill admise avec les arguments de modes/pdf.md et cover.md', async (t) => {
  const { root, tools } = workspace(t);
  const args = async (command, list) => (await run(tools, command, list)).args;
  assert.deepEqual(await args('build-cv-html', [CV_JSON, CV_HTML]), [CV_JSON, CV_HTML]);
  assert.deepEqual(await args('build-cv-html', [CV_JSON, CV_HTML, 'templates/cv-template.html']), [
    CV_JSON,
    CV_HTML,
    'templates/cv-template.html',
  ]);
  // Chemin absolu tel que « cv-templates resolve cv » l'imprime, dans l'espace seulement.
  const resolved = `${root}/data/templates/cv-template-moderne.html`;
  assert.deepEqual(await args('build-cv-html', [CV_JSON, CV_HTML, resolved]), [
    CV_JSON,
    CV_HTML,
    resolved,
  ]);
  assert.deepEqual(await args('build-cv-html', ['--preview', CV_JSON]), ['--preview', CV_JSON]);
  assert.deepEqual(await args('build-cv-html', [CV_JSON, '--markdown', 'output/cv-fictif.md']), [
    CV_JSON,
    '--markdown',
    'output/cv-fictif.md',
  ]);
  assert.deepEqual(await args('verify-cv-facts', [CV_HTML]), [CV_HTML]);
  assert.deepEqual(await args('verify-cv-facts', [CV_HTML, '--json']), [CV_HTML, '--json']);
  assert.deepEqual(await args('verify-cv-structure', [CV_JSON]), [CV_JSON]);
  assert.deepEqual(await args('generate-pdf', [CV_HTML, CV_PDF, '--format=a4', '--report=042']), [
    CV_HTML,
    CV_PDF,
    '--format=a4',
    '--report=042',
  ]);
  assert.deepEqual(
    await args('generate-pdf', [
      CV_HTML,
      CV_PDF,
      '--country=DE',
      '--kind=cv',
      '--max-pages=1',
      '--strict-pages',
      '--allow-nonchronological',
      '--allow-reorder',
    ]),
    [
      CV_HTML,
      CV_PDF,
      '--country=DE',
      '--kind=cv',
      '--max-pages=1',
      '--strict-pages',
      '--allow-nonchronological',
      '--allow-reorder',
    ],
  );
  assert.deepEqual(
    await args('generate-cover-letter', [
      '--payload',
      'output/cover-payload-entreprise-fictive.json',
      '--out',
      'output/entreprise-fictive-poste-fictif-cover.pdf',
      '--format',
      'a4',
      '--country',
      'DE',
      '--report',
      '042',
    ]),
    [
      '--payload',
      'output/cover-payload-entreprise-fictive.json',
      '--out',
      'output/entreprise-fictive-poste-fictif-cover.pdf',
      '--format',
      'a4',
      '--country',
      'DE',
      '--report',
      '042',
    ],
  );
  assert.deepEqual(await args('mark-pdf-ready', ['042']), ['042']);
  assert.deepEqual(await args('mark-pdf-ready', ['42', '--dry-run', '--json']), [
    '42',
    '--dry-run',
    '--json',
  ]);
  assert.deepEqual(await args('cv-templates', ['resolve', 'cv']), ['resolve', 'cv']);
  assert.deepEqual(await args('cv-templates', ['list', 'cover', '--format=html']), [
    'list',
    'cover',
    '--format=html',
  ]);
  assert.deepEqual(await args('cv-templates', ['resolve', 'cv', 'Modele FICTIF', '--fallback']), [
    'resolve',
    'cv',
    'Modele FICTIF',
    '--fallback',
  ]);
  assert.deepEqual(await args('cv-templates', ['lint', 'cover']), ['lint', 'cover']);
});

test('career_script : chaîne CV/lettre, chemins hors output/, portes désactivées et drapeaux hors liste refusés', async (t) => {
  const { tools } = workspace(t);
  for (const [command, args] of [
    ['build-cv-html', []],
    ['build-cv-html', [CV_JSON]],
    ['build-cv-html', ['cv.json', CV_HTML]],
    ['build-cv-html', [CV_JSON, 'reports/cv.html']],
    ['build-cv-html', [CV_JSON, 'output/cv.txt']],
    ['build-cv-html', [CV_JSON, CV_HTML, '../cv-template.html']],
    ['build-cv-html', [CV_JSON, CV_HTML, '/etc/passwd']],
    ['build-cv-html', [CV_JSON, CV_HTML, 'templates/cv-template.html', 'x']],
    ['build-cv-html', ['--test']],
    ['build-cv-html', ['--preview']],
    ['build-cv-html', [CV_JSON, '--markdown', CV_HTML]],
    ['verify-cv-facts', []],
    ['verify-cv-facts', ['cv.md']],
    ['verify-cv-facts', [CV_HTML, '--source', CV_HTML]],
    ['verify-cv-facts', [CV_HTML, '--config', 'output/x.json']],
    ['verify-cv-facts', ['--self-test']],
    ['verify-cv-facts', [CV_HTML, CV_JSON]],
    ['verify-cv-structure', [CV_HTML]],
    ['verify-cv-structure', [CV_JSON, '--source', 'cv.md']],
    ['generate-pdf', [CV_HTML]],
    ['generate-pdf', [CV_HTML, '../cv.pdf']],
    ['generate-pdf', [CV_HTML, CV_PDF, '--skip-fact-check']],
    ['generate-pdf', ['--batch=output/manifest.json']],
    ['generate-pdf', [CV_HTML, CV_PDF, '--format', 'a4']],
    ['generate-pdf', [CV_HTML, CV_PDF, '--format=pdf']],
    ['generate-pdf', [CV_HTML, CV_PDF, '--report=abc']],
    ['generate-pdf', [CV_HTML, CV_PDF, '--report=']],
    ['generate-pdf', [CV_HTML, CV_PDF, '--country=Allemagne']],
    ['generate-pdf', [CV_HTML, CV_PDF, '--kind=letter']],
    ['generate-pdf', [CV_HTML, CV_PDF, '--max-pages=0']],
    ['generate-pdf', [CV_HTML, CV_PDF, '--format=a4', '--format=letter']],
    ['generate-cover-letter', []],
    ['generate-cover-letter', ['--out', 'output/x-cover.pdf']],
    ['generate-cover-letter', ['--payload', '/tmp/cover-payload.json']],
    ['generate-cover-letter', ['--payload', 'output/p.json', '--out', 'drafts/x.pdf']],
    ['generate-cover-letter', ['--payload=output/p.json']],
    ['generate-cover-letter', ['--payload', 'output/p.json', '--format', 'pdf']],
    ['mark-pdf-ready', []],
    ['mark-pdf-ready', ['abc']],
    ['mark-pdf-ready', ['042', '--force']],
    ['mark-pdf-ready', ['042', '43']],
    ['cv-templates', []],
    ['cv-templates', ['list']],
    ['cv-templates', ['delete', 'cv']],
    ['cv-templates', ['list', 'latex']],
    ['cv-templates', ['resolve', 'cv', '../x']],
    ['cv-templates', ['list', 'cv', '--format=pdf']],
  ])
    await assert.rejects(
      tools.script({ command, args }),
      /Arguments|argument/i,
      `${command} ${JSON.stringify(args)}`,
    );
});

test('career_script : les contrôles CV du Skill tournent isolés (sans réseau, sans écriture)', async (t) => {
  const { root, tools } = workspace(t);
  mkdirSync(join(root, 'output'));
  writeFileSync(join(root, CV_HTML), '<p>CV FICTIF</p>');
  writeFileSync(join(root, 'verify-cv-facts.mjs'), 'await fetch("http://127.0.0.1:4321/fictif")');
  writeFileSync(
    join(root, 'cv-templates.mjs'),
    'import { writeFileSync } from "node:fs"; writeFileSync("output/escape.txt", "FICTIF")',
  );
  // build-cv-html écrit son HTML : il n'est pas isolé.
  writeFileSync(
    join(root, 'build-cv-html.mjs'),
    'import { writeFileSync } from "node:fs"; writeFileSync(process.argv[3], "<p>FICTIF</p>"); console.log("ok")',
  );
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  const network = await tools.script({ command: 'verify-cv-facts', args: [CV_HTML] });
  assert.equal(network.exitCode, 1);
  assert.match(network.text, /Réseau interdit/);
  const write = await tools.script({ command: 'cv-templates', args: ['list', 'cv'] });
  assert.equal(write.exitCode, 1);
  assert.match(write.text, /ERR_ACCESS_DENIED/);
  const built = await tools.script({ command: 'build-cv-html', args: [CV_JSON, CV_HTML] });
  assert.equal(built.exitCode, 0);
  assert.equal(readFileSync(join(root, CV_HTML), 'utf8'), '<p>FICTIF</p>');
  // La forme « contrôle » (path) de verify-cv-facts reste admise.
  writeFileSync(
    join(root, 'verify-cv-facts.mjs'),
    'console.log(JSON.stringify(process.argv.slice(2)))',
  );
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  writeFileSync(join(root, 'output/cv-fictif.md'), 'CV FICTIF');
  const control = await tools.script({ command: 'verify-cv-facts', path: 'output/cv-fictif.md' });
  assert.deepEqual(JSON.parse(control.text), ['output/cv-fictif.md', '--json']);
});
