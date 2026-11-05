import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { CareerTools, OFFERS_PAGE_CHARS, OFFERS_MAX_CHARS } from '../packages/career-ops/tools.js';
import { createApp } from '../apps/api/server.js';

// E34 : 300 fiches FICTIVES dans relay/offers. Aucune donnée personnelle : noms numérotés.
const SECTIONS = 'ABCDEFG'.split('');
const at = (i) => new Date(Date.UTC(2026, 0, 1) + i * 3600 * 1000).toISOString();
function fiche(i, { report = 'Bloc {K} FICTIF de la fiche ' + i } = {}) {
  const evaluated = i % 3 !== 0;
  return {
    id: randomUUID(),
    contractVersion: 2,
    title: `Poste FICTIF ${String(i).padStart(3, '0')}${i % 7 === 0 ? ' Kubernetes' : ''}`,
    company: `Entreprise FICTIVE ${i % 10 === 0 ? 'Alpha' : 'Beta'} ${i}`,
    url: `https://jobs.example.test/fictif/${i}`,
    source: 'Source FICTIVE',
    fetchedAt: at(i),
    score: evaluated ? Math.round(((i % 40) / 10 + 1) * 10) / 10 : null,
    report: evaluated
      ? Object.fromEntries(SECTIONS.map((key) => [key, report.replaceAll('{K}', key)]))
      : null,
    simulated: true,
  };
}
function space(t, count = 300, options) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-offers-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay/offers'), { recursive: true });
  const fiches = Array.from({ length: count }, (_, i) => fiche(i + 1, options));
  for (const offer of fiches)
    writeFileSync(join(root, `relay/offers/${offer.id}.json`), JSON.stringify(offer));
  // Most recent first: the expected order of every page.
  const byDate = [...fiches].sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt));
  return {
    root,
    fiches,
    byDate,
    tools: new CareerTools(new CareerWorkspace({ root, roots: [root] })),
  };
}
async function mcp(t, root) {
  const client = await connectMcp({
    command: process.execPath,
    args: [resolve('packages/mcp-gateway/server.js'), 'career-ops'],
    env: [{ name: 'RELAY_CAREER_WORKSPACE', value: root }],
  });
  t.after(() => client.close());
  return client;
}
const call = async (client, args) => {
  const response = await client.callTool({ name: 'career_offers', arguments: args });
  const text = response.content[0].text;
  return { response, text, body: response.isError ? null : JSON.parse(text) };
};

test('E34 : career_offers sans argument rend une page résumée sous la borne, plus récentes d’abord', async (t) => {
  const { root, byDate } = space(t);
  const client = await mcp(t, root);
  const { response, text, body } = await call(client, {});
  assert.equal(response.isError, undefined, text);
  assert.ok(text.length < OFFERS_PAGE_CHARS, `réponse de ${text.length} caractères`);
  assert.equal(body.total, 300);
  assert.equal(body.offset, 0);
  assert.equal(body.limit, 20);
  assert.equal(body.next, 20);
  assert.equal(body.view, 'summary');
  assert.equal(body.untrusted, true);
  assert.equal(body.opportunities.length, 20);
  assert.deepEqual(
    body.opportunities.map((item) => item.id),
    byDate.slice(0, 20).map((item) => item.id),
  );
  for (const [i, item] of body.opportunities.entries()) {
    assert.deepEqual(Object.keys(item).sort(), [
      'company',
      'date',
      'id',
      'score',
      'simulated',
      'status',
      'title',
    ]);
    const full = byDate[i];
    assert.equal(item.title, full.title);
    assert.equal(item.company, full.company);
    assert.equal(item.score, full.score);
    assert.equal(item.date, full.fetchedAt);
    assert.equal(item.status, full.report ? 'évaluée' : 'repérée');
    assert.equal(item.simulated, true);
    assert.equal('report' in item, false);
    assert.equal('url' in item, false);
  }
  assert.match(body.notice, /offset=20/);
});

test('E34 : offset et limit bornés, next juste jusqu’à la dernière page', async (t) => {
  const { root, byDate } = space(t);
  const client = await mcp(t, root);
  let page = (await call(client, { offset: 20 })).body;
  assert.equal(page.next, 40);
  assert.deepEqual(
    page.opportunities.map((item) => item.id),
    byDate.slice(20, 40).map((item) => item.id),
  );
  page = (await call(client, { offset: 280, limit: 20 })).body;
  assert.equal(page.opportunities.length, 20);
  assert.equal(page.next, null);
  assert.equal(page.notice, undefined);
  page = (await call(client, { offset: 290, limit: 50 })).body;
  assert.equal(page.opportunities.length, 10);
  assert.equal(page.next, null);
  assert.equal(page.total, 300);
  page = (await call(client, { offset: 300 })).body;
  assert.deepEqual(page.opportunities, []);
  assert.equal(page.next, null);
  page = (await call(client, { offset: 0, limit: 100 })).body;
  assert.equal(page.opportunities.length, 100);
  assert.equal(page.next, 100);
  // Every page of 100 of the whole index stays under the bound.
  let seen = 0;
  for (let offset = 0; offset !== null; ) {
    const { text, body } = await call(client, { offset, limit: 100 });
    assert.ok(text.length <= OFFERS_PAGE_CHARS, `page offset=${offset} : ${text.length}`);
    seen += body.opportunities.length;
    offset = body.next;
  }
  assert.equal(seen, 300);
  for (const args of [
    { offset: -1 },
    { offset: 1.5 },
    { limit: 0 },
    { limit: 101 },
    { maxChars: 0 },
    { maxChars: OFFERS_MAX_CHARS + 1 },
    { query: 'x'.repeat(201) },
    { id: '../hors-perimetre' },
    { id: 'relay/offers/x' },
    { ids: Array.from({ length: 101 }, () => randomUUID()) },
    { id: randomUUID(), ids: [randomUUID()] },
    { autre: 1 },
  ]) {
    const { response } = await call(client, args);
    assert.equal(response.isError, true, JSON.stringify(args));
  }
});

test('E34 : id ou ids rendent la fiche complète telle qu’écrite ; un id inconnu est dit manquant', async (t) => {
  const { root, fiches, byDate } = space(t);
  const client = await mcp(t, root);
  const one = fiches[42];
  let { body } = await call(client, { id: one.id });
  assert.equal(body.view, 'full');
  assert.equal(body.total, 1);
  assert.equal(body.offset, 0);
  assert.equal(body.next, null);
  assert.deepEqual(body.opportunities, [one]);
  assert.deepEqual(body.missing, []);
  const unknown = randomUUID();
  const wanted = [fiches[3].id, unknown, fiches[200].id, fiches[42].id];
  ({ body } = await call(client, { ids: wanted }));
  assert.equal(body.total, 3);
  // Requested order kept, not the date order.
  assert.deepEqual(body.opportunities, [fiches[3], fiches[200], fiches[42]]);
  assert.deepEqual(body.missing, [unknown]);
  ({ body } = await call(client, { ids: wanted, offset: 1, limit: 1 }));
  assert.deepEqual(body.opportunities, [fiches[200]]);
  assert.equal(body.next, 2);
  // Summary rows carry the exact id a full read needs.
  const first = (await call(client, { limit: 1 })).body.opportunities[0];
  ({ body } = await call(client, { id: first.id }));
  assert.deepEqual(body.opportunities, [byDate[0]]);
});

test('E34 : query filtre sur titre ou entreprise, sous-chaîne, sans égard à la casse', async (t) => {
  const { root, fiches, byDate } = space(t);
  const client = await mcp(t, root);
  let { body } = await call(client, { query: 'kubernetes' });
  const expected = byDate.filter((item) => /Kubernetes/.test(item.title));
  assert.equal(body.total, expected.length);
  assert.equal(body.query, 'kubernetes');
  assert.deepEqual(
    body.opportunities.map((item) => item.id),
    expected.slice(0, 20).map((item) => item.id),
  );
  assert.equal(body.next, expected.length > 20 ? 20 : null);
  ({ body } = await call(client, { query: 'ALPHA', limit: 100 }));
  assert.equal(body.total, fiches.filter((item) => item.company.includes('Alpha')).length);
  assert.ok(body.opportunities.every((item) => item.company.includes('Alpha')));
  ({ body } = await call(client, { query: 'introuvable FICTIF' }));
  assert.equal(body.total, 0);
  assert.deepEqual(body.opportunities, []);
  assert.equal(body.next, null);
  // Query never reads the report text.
  ({ body } = await call(client, { query: 'Bloc A FICTIF' }));
  assert.equal(body.total, 0);
});

test('E34 : aucune réponse au-delà de la borne, même en fiches complètes ; maxChars jusqu’à 48 000', async (t) => {
  const { root, fiches } = space(t, 40, { report: 'Bloc {K} FICTIF '.repeat(60) });
  const client = await mcp(t, root);
  const ids = fiches.map((item) => item.id);
  let seen = 0;
  for (let offset = 0; offset !== null; ) {
    const { text, body } = await call(client, { ids, offset, limit: 20 });
    assert.ok(
      text.length <= OFFERS_PAGE_CHARS,
      `fiches complètes offset=${offset} : ${text.length}`,
    );
    assert.ok(body.opportunities.length >= 1);
    assert.equal(body.truncated, false);
    for (const item of body.opportunities) assert.deepEqual(item, fiches[ids.indexOf(item.id)]);
    seen += body.opportunities.length;
    offset = body.next;
  }
  assert.equal(seen, 40);
  // One record alone above the bound: its report is cut, said, and whole with a larger maxChars.
  const huge = space(t, 1, { report: 'Section {K} FICTIVE très longue. '.repeat(150) });
  const hugeClient = await mcp(t, huge.root);
  assert.ok(JSON.stringify(huge.fiches[0]).length > OFFERS_PAGE_CHARS);
  let { text, body } = await call(hugeClient, { id: huge.fiches[0].id });
  assert.ok(text.length <= OFFERS_PAGE_CHARS, `fiche coupée : ${text.length}`);
  assert.equal(body.truncated, true);
  assert.equal(body.opportunities.length, 1);
  assert.equal(body.opportunities[0].id, huge.fiches[0].id);
  assert.match(body.notice, /maxChars/);
  ({ text, body } = await call(hugeClient, { id: huge.fiches[0].id, maxChars: OFFERS_MAX_CHARS }));
  assert.ok(text.length <= OFFERS_MAX_CHARS);
  assert.equal(body.truncated, false);
  assert.deepEqual(body.opportunities, [huge.fiches[0]]);
});

test('E34 : la description MCP de career_offers dit comment paginer ; schéma borné', async (t) => {
  const { root } = space(t, 1);
  const client = await mcp(t, root);
  const tool = (await client.listTools()).tools.find((entry) => entry.name === 'career_offers');
  const { properties } = tool.inputSchema;
  assert.equal(properties.offset.default, 0);
  assert.equal(properties.offset.minimum, 0);
  assert.equal(properties.limit.default, 20);
  assert.equal(properties.limit.maximum, 100);
  assert.equal(properties.limit.minimum, 1);
  assert.equal(properties.maxChars.default, OFFERS_PAGE_CHARS);
  assert.equal(properties.maxChars.maximum, OFFERS_MAX_CHARS);
  assert.ok(properties.id && properties.ids && properties.query);
  assert.match(tool.description, /offset=next/);
  assert.match(tool.description, /\bid\b/);
  assert.match(tool.description, /query/);
  assert.match(tool.description, /24 000/);
});

test('E34 : GET /api/career/offers garde la liste complète pour le front ; les mêmes arguments paginent', async (t) => {
  const { root, fiches, byDate } = space(t);
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career });
  t.after(() => app.close());
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const whole = await (await fetch(`${base}/api/career/offers`)).json();
  assert.deepEqual(Object.keys(whole), ['opportunities']);
  assert.equal(whole.opportunities.length, 300);
  assert.ok(whole.opportunities.every((item) => 'url' in item));
  const page = await (await fetch(`${base}/api/career/offers?limit=5&offset=10`)).json();
  assert.equal(page.view, 'summary');
  assert.equal(page.total, 300);
  assert.equal(page.next, 15);
  assert.deepEqual(
    page.opportunities.map((item) => item.id),
    byDate.slice(10, 15).map((item) => item.id),
  );
  const found = await (await fetch(`${base}/api/career/offers?query=alpha`)).json();
  assert.equal(found.total, fiches.filter((item) => item.company.includes('Alpha')).length);
  const one = await (await fetch(`${base}/api/career/offers?id=${fiches[7].id}`)).json();
  assert.deepEqual(one.opportunities, [fiches[7]]);
  const two = await (
    await fetch(`${base}/api/career/offers?ids=${fiches[1].id},${fiches[2].id}`)
  ).json();
  assert.deepEqual(two.opportunities, [fiches[1], fiches[2]]);
  for (const bad of ['limit=0', 'limit=101', 'offset=-1', 'offset=abc', 'id=..%2Fx'])
    assert.equal((await fetch(`${base}/api/career/offers?${bad}`)).status, 400, bad);
});
