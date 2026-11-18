import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { CareerTools } from '../packages/career-ops/tools.js';
import { gatewayProgress } from '../packages/career-ops/truth.js';

// ecriture-18-11 : E133 (append mode, per-call bound) and E129 (tracker TSV refusal). FICTIVE data only.
function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ecriture-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, tools: new CareerTools({ path: () => root }) };
}
const entry = (n) =>
  `- [ ] https://jobs.example.test/offre/${n} | Entreprise FICTIVE | Poste FICTIF ${n}\n`;
const HEADER = 'num\tdate\tcompany\trole\tstatus\tscore\tpdf\treport\tnotes\turl';
const ROW =
  '042\t2026-11-05\tEntreprise FICTIVE\tPoste FICTIF\tEvaluated\t4.2/5\t❌\t[042](reports/042-entreprise-fictive-2026-11-05.md)\tNote FICTIVE\thttps://jobs.example.test/offre/42';

async function gateway(t, root) {
  const client = await connectMcp({
    command: process.execPath,
    args: [resolve('packages/mcp-gateway/server.js'), 'career-ops'],
    env: [{ name: 'RELAY_CAREER_WORKSPACE', value: root }],
  });
  t.after(() => client.close());
  return client;
}
const text = (answer) => answer.content.map((part) => part.text).join('\n');

test('E133 : career_write annonce le mode append et la borne par appel dans son schéma', async (t) => {
  const { root } = workspace(t);
  const client = await gateway(t, root);
  const tool = (await client.listTools()).tools.find((item) => item.name === 'career_write');
  assert.deepEqual(tool.inputSchema.properties.mode.enum, ['replace', 'append']);
  assert.equal(tool.inputSchema.required.includes('mode'), false);
  assert.match(tool.description, /append/);
  assert.match(tool.description, /par appel/);
  // No hidden per-file ceiling left in the schema.
  assert.equal(tool.inputSchema.properties.text.maxLength, undefined);
});

test('E133 : par la passerelle MCP, des ajouts portent un fichier au-delà de 200 000 octets', async (t) => {
  const { root } = workspace(t);
  const client = await gateway(t, root);
  const path = 'jds/offres-FICTIVES.md';
  const chunk = (letter) => `${letter.repeat(149999)}\n`;
  let answer = await client.callTool({
    name: 'career_write',
    arguments: { path, text: chunk('a') },
  });
  assert.equal(answer.isError, undefined, text(answer));
  for (const letter of ['b', 'c']) {
    answer = await client.callTool({
      name: 'career_write',
      arguments: { path, text: chunk(letter), mode: 'append' },
    });
    assert.equal(answer.isError, undefined, text(answer));
  }
  const result = JSON.parse(text(answer));
  assert.equal(result.saved, true);
  assert.equal(result.appended, true);
  assert.equal(result.fileBytes, 450000);
  assert.equal(readFileSync(join(root, path), 'utf8'), chunk('a') + chunk('b') + chunk('c'));
  // Per call, the bound stays, and the refusal says how to go on.
  const big = await client.callTool({
    name: 'career_write',
    arguments: { path, text: 'x'.repeat(200001) },
  });
  assert.equal(big.isError, true);
  assert.match(text(big), /200001 octets, 200000 au plus/);
  assert.match(text(big), /par tranches avec mode « append »/);
  assert.equal(readFileSync(join(root, path), 'utf8').length, 450000);
});

test('E133 : ajout à data/pipeline.md sans renvoyer le fichier, mêmes contrôles', (t) => {
  const { root, tools } = workspace(t);
  mkdirSync(join(root, 'data'));
  const path = 'data/pipeline.md';
  // The owner's file may end without a newline: the appended line starts on its own line.
  writeFileSync(join(root, path), `# Pipeline\n\n${entry(1).trimEnd()}`);
  assert.deepEqual(tools.write(path, entry(2), 'append'), {
    path,
    saved: true,
    appended: true,
    appendedBytes: Buffer.byteLength(entry(2)),
    fileBytes: Buffer.byteLength(`# Pipeline\n\n${entry(1)}${entry(2)}`),
  });
  tools.write(path, entry(3), 'append');
  assert.equal(
    readFileSync(join(root, path), 'utf8'),
    `# Pipeline\n\n${entry(1)}${entry(2)}${entry(3)}`,
  );
  // A malformed new entry is refused as in a full write, and the file is left as it was.
  const before = readFileSync(join(root, path), 'utf8');
  assert.throws(
    () => tools.write(path, '- [ ] Poste FICTIF sans lien\n', 'append'),
    /pipeline\.md/,
  );
  assert.equal(readFileSync(join(root, path), 'utf8'), before);
  // The full write is unchanged: removing an entry is still refused.
  assert.throws(() => tools.write(path, `# Pipeline\n\n${entry(1)}`), /supprimée/);
  assert.equal(tools.write(path, `${before}${entry(4)}`).saved, true);
});

test('E133 : ajout à un fichier absent le crée ; périmètre et refus identiques à l’écriture', (t) => {
  const { root, tools } = workspace(t);
  assert.equal(tools.write('jds/nouveau-FICTIF.md', 'ligne FICTIVE\n', 'append').saved, true);
  assert.equal(readFileSync(join(root, 'jds/nouveau-FICTIF.md'), 'utf8'), 'ligne FICTIVE\n');
  for (const [path, why] of [
    ['../hors.md', /Chemin|périmètre|refus/i],
    ['data/applications.md', /applications\.md/],
    ['data/pdf-index.tsv', /pdf-index/],
    ['reports/sans-numero.md', /Rapport/],
    ['batch/autre.tsv', /périmètre/],
  ])
    assert.throws(() => tools.write(path, 'FICTIF\n', 'append'), why, path);
  // A tracker addition stays one header and one row: an append that adds a second row is refused.
  const tsv = 'batch/tracker-additions/042-entreprise-fictive.tsv';
  assert.equal(tools.write(tsv, `${HEADER}\n${ROW}\n`).saved, true);
  assert.throws(() => tools.write(tsv, `${ROW}\n`, 'append'), /TSV d’ajout refusé/);
  assert.equal(readFileSync(join(root, tsv), 'utf8'), `${HEADER}\n${ROW}\n`);
});

test('E133 : un ajout compte au Bilan comme une écriture réussie', () => {
  const args = { path: 'data/pipeline.md', text: entry(1), mode: 'append' };
  const result = { content: [{ type: 'text', text: '{"path":"data/pipeline.md","saved":true}' }] };
  assert.deepEqual(
    gatewayProgress('career_write', 'completed', args, result),
    gatewayProgress('career_write', 'completed', { path: args.path, text: args.text }, result),
  );
  assert.equal(
    gatewayProgress('career_write', 'completed', args, result).argument,
    'data/pipeline.md',
  );
});

test('E129 : le refus du TSV montre l’en-tête attendu, un exemple et ce qui a été reçu', (t) => {
  const { tools } = workspace(t);
  const tsv = 'batch/tracker-additions/042-entreprise-fictive.tsv';
  const wrongHeader = HEADER.replace('\tpdf', '');
  let message = '';
  try {
    tools.write(tsv, `${wrongHeader}\n${ROW}\n`);
  } catch (e) {
    message = e.message;
  }
  assert.match(message, /étiquettes manquantes : pdf/);
  assert.ok(message.includes(`« ${HEADER} »`), message);
  assert.ok(message.includes('Evaluated\t4.2/5'), message);
  assert.ok(message.includes(`Reçu : 2 ligne(s) non vide(s), première ligne « ${wrongHeader} »`));
  // What was received is bounded.
  try {
    tools.write(tsv, `${'z'.repeat(5000)}\n${ROW}\n`);
  } catch (e) {
    message = e.message;
  }
  assert.ok(message.includes(`« ${'z'.repeat(200)}… »`), message.slice(0, 300));
  assert.ok(!message.includes('z'.repeat(201)));
  // What is accepted does not change.
  assert.equal(tools.write(tsv, `${HEADER}\n${ROW}\n`).saved, true);
  assert.throws(() => tools.write(tsv, `${ROW}\n`), /Reçu : 1 ligne\(s\)/);
});
