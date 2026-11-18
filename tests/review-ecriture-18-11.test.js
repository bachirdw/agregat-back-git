import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { CareerTools } from '../packages/career-ops/tools.js';

// review-ecriture-18-11 : what the sprint's tests left open. FICTIVE data only.
function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'review-ecriture-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, tools: new CareerTools({ path: () => root }) };
}
const HEADER = 'num\tdate\tcompany\trole\tstatus\tscore\tpdf\treport\tnotes\turl';
const ROW =
  '042\t2026-11-05\tEntreprise FICTIVE\tPoste FICTIF\tEvaluated\t4.2/5\t❌\t[042](reports/042-entreprise-fictive-2026-11-05.md)\tNote FICTIVE\thttps://jobs.example.test/offre/42';
const TSV = 'batch/tracker-additions/042-entreprise-fictive.tsv';

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

test('review : un ajout est contrôlé sur le fichier reconstruit, pas sur le seul morceau envoyé', (t) => {
  // Discriminating: before the sprint, the row alone was checked (and refused as one line).
  const { root, tools } = workspace(t);
  mkdirSync(join(root, 'batch/tracker-additions'), { recursive: true });
  writeFileSync(join(root, TSV), `${HEADER}\n`);
  assert.equal(tools.write(TSV, `${ROW}\n`, 'append').saved, true);
  assert.equal(readFileSync(join(root, TSV), 'utf8'), `${HEADER}\n${ROW}\n`);
});

test('review : refus d’ajout exact, fichier trop gros ou chemin qui n’est pas un fichier', (t) => {
  const { root, tools } = workspace(t);
  mkdirSync(join(root, 'jds/dossier-FICTIF.md'), { recursive: true });
  assert.throws(
    () => tools.write('jds/dossier-FICTIF.md', 'ligne FICTIVE\n', 'append'),
    (e) => /n’est pas un fichier ordinaire/.test(e.message) && !/dépasse/.test(e.message),
  );
  const big = 'jds/gros-FICTIF.md';
  writeFileSync(join(root, big), 'x'.repeat(10 * 1024 * 1024 + 1));
  assert.throws(
    () => tools.write(big, 'ligne FICTIVE\n', 'append'),
    /ajout refusé, le fichier dépasse 10485760 octets/,
  );
  assert.equal(readFileSync(join(root, big)).length, 10 * 1024 * 1024 + 1);
});

test('review : le refus du TSV dit « lignes non vides », comme ce qu’il compte', (t) => {
  const { tools } = workspace(t);
  assert.throws(
    () => tools.write(TSV, `${HEADER}\n\n${ROW}\n${ROW}\n`),
    (e) =>
      e.message.includes('exactement 2 lignes non vides') &&
      e.message.includes('Reçu : 3 ligne(s) non vide(s)'),
  );
  // Blank lines are still accepted, as before.
  assert.equal(tools.write(TSV, `\n${HEADER}\n\n${ROW}\n`).saved, true);
});

test('review : par la passerelle MCP, mode absent = remplacement ; mode inconnu refusé ; tranche trop grosse en ajout sans effet', async (t) => {
  const { root } = workspace(t);
  const client = await gateway(t, root);
  const path = 'jds/offres-FICTIVES.md';
  const call = (args) => client.callTool({ name: 'career_write', arguments: { path, ...args } });
  assert.equal((await call({ text: 'un FICTIF\n' })).isError, undefined);
  assert.equal((await call({ text: 'deux FICTIF\n', mode: 'append' })).isError, undefined);
  let answer = await call({ text: 'trois FICTIF\n' });
  assert.deepEqual(JSON.parse(text(answer)), { path, saved: true });
  assert.equal(readFileSync(join(root, path), 'utf8'), 'trois FICTIF\n');
  answer = await call({ text: 'quatre FICTIF\n', mode: 'ajout' });
  assert.equal(answer.isError, true);
  assert.equal(readFileSync(join(root, path), 'utf8'), 'trois FICTIF\n');
  answer = await call({ text: 'y'.repeat(200001), mode: 'append' });
  assert.equal(answer.isError, true);
  assert.match(text(answer), /200001 octets, 200000 au plus/);
  assert.equal(readFileSync(join(root, path), 'utf8'), 'trois FICTIF\n');
});
