// captures-18-11 : plus de coupe silencieuse d'une capture (E131), pagination dite en clair à chaque
// tranche, liste de tous les éléments d'une page avec l'adresse de leurs liens (E132). Sans navigateur :
// fonctions pures, fournisseur de pages de test, et la passerelle MCP réelle pour ce que l'agent voit
// (liste des outils seulement : aucun appel n'atteint un navigateur).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BrowserGateway,
  FixturePageProvider,
  redactPageText,
} from '../packages/browser-gateway/index.js';
import { paginateItems, paginateText } from '../packages/browser-gateway/paginate.js';
import * as paginate from '../packages/browser-gateway/paginate.js';
import { listedElements } from '../packages/browser-gateway/cdp.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import {
  EXTRACT_MAX_ITEMS,
  PAGE_TEXT_DEFAULT_CHARS,
  PAGE_TEXT_MAX_CHARS,
  capabilityIds,
  getCapability,
} from '../packages/capability-registry/index.js';
import { connectMcp } from '../packages/mcp-gateway/client.js';

const PAGE = 'https://jobs.example.com/resultats';
// A FICTIVE results page as long as a real one (about 115 000 characters), every character traceable.
const LONG = Array.from({ length: 11500 }, (_, i) => `l${String(i).padStart(5, '0')}....`).join('');
const CARDS = Array.from({ length: 300 }, (_, i) => ({
  text: `Offre FICTIVE ${i}\nLieu FICTIF`,
  href: `https://jobs.example.com/offre/${i}`,
}));

function gateway(pages) {
  return new BrowserGateway({
    provider: new FixturePageProvider(pages),
    policy: new RunPolicy({
      ownerMode: true,
      allowedDomains: ['example.com'],
      capabilities: capabilityIds,
      workspace: mkdtempSync(join(tmpdir(), 'relay-captures-')),
      resolveHost: async () => ['93.184.216.34'],
    }),
    approve: async () => false,
    meter: () => {},
  });
}

test('E131 : une seule borne, définie dans le registre ; la constante morte a disparu', () => {
  assert.equal(PAGE_TEXT_MAX_CHARS, 200000);
  assert.equal(PAGE_TEXT_DEFAULT_CHARS, 24000);
  assert.equal('SNAPSHOT_MAX_CHARS' in paginate, false);
  assert.equal('SNAPSHOT_DEFAULT_CHARS' in paginate, false);
  const snapshot = getCapability('browser.snapshot').schema;
  assert.equal(snapshot.parse({}).maxChars, PAGE_TEXT_DEFAULT_CHARS);
  assert.equal(snapshot.parse({ maxChars: PAGE_TEXT_MAX_CHARS }).maxChars, PAGE_TEXT_MAX_CHARS);
  assert.equal(snapshot.safeParse({ maxChars: PAGE_TEXT_MAX_CHARS + 1 }).success, false);
});

test('E131 : le masquage ne coupe plus le texte', () => {
  const out = redactPageText('k AIzaSyABCDEFGHIJKLMNOPQRSTUVWX ' + 'x'.repeat(PAGE_TEXT_MAX_CHARS));
  assert.ok(!out.includes('AIza'));
  assert.ok(!out.includes('[tronqué]'));
  assert.ok(out.endsWith('x'.repeat(PAGE_TEXT_MAX_CHARS)));
});

test('E131 FICTIF : une tranche de 200 000 est rendue en entière par la passerelle', async () => {
  const gw = gateway({ [PAGE]: { title: 'Résultats', text: LONG } });
  const all = await gw.call('browser.snapshot', { url: PAGE, maxChars: PAGE_TEXT_MAX_CHARS });
  assert.equal(all.snapshot, LONG);
  assert.equal(all.totalChars, LONG.length);
  assert.equal(all.truncated, false);
  assert.equal(all.nextOffset, null);
  assert.equal(all.pagesLeft, 0);
  assert.ok(!all.snapshot.includes('[tronqué]'));
  // A 60 000 page (above the former 50 000 cut) : rendered in full, the next offset is its end.
  const page = await gw.call('browser.snapshot', { maxChars: 60000 });
  assert.equal(page.snapshot, LONG.slice(0, 60000));
  assert.equal(page.nextOffset, 60000);
  const rest = await gw.call('browser.snapshot', { offset: page.nextOffset, maxChars: 60000 });
  assert.equal(page.snapshot + rest.snapshot, LONG);
  assert.equal(rest.truncated, false);
});

test('pagination : chaque tranche dit la taille, la tranche rendue, la suite et les tranches restantes', async () => {
  const gw = gateway({ [PAGE]: { title: 'Résultats', text: LONG } });
  const first = await gw.call('browser.snapshot', { url: PAGE });
  assert.equal(first.totalChars, 115000);
  assert.equal(first.offset, 0);
  assert.equal(first.endOffset, 24000);
  assert.equal(first.nextOffset, 24000);
  assert.equal(first.pagesLeft, 4);
  assert.equal(
    first.paging,
    'Capture de 115000 caractères : caractères 0 à 24000 rendus en entier ; suite : offset=24000, 91000 caractères restants, soit 4 tranche(s) de 24000.',
  );
  // Reading the whole page : exactly 1 + pagesLeft calls, no gap and no overlap.
  let read = first.snapshot;
  let calls = 1;
  let next = first;
  while (next.truncated) {
    next = await gw.call('browser.snapshot', { offset: next.nextOffset });
    read += next.snapshot;
    calls++;
  }
  assert.equal(read, LONG);
  assert.equal(calls, 1 + first.pagesLeft);
  assert.equal(next.pagesLeft, 0);
  assert.match(next.paging, /caractères 96000 à 115000 rendus en entier ; fin de la capture\.$/);
  assert.equal(next.truncation, undefined);
});

test('pagination : offset au-delà de la fin dit qu’il n’y a rien à rendre', () => {
  const out = paginateText('abc', { offset: 10, maxChars: 2 });
  assert.equal(out.page, '');
  assert.equal(out.truncated, false);
  assert.equal(out.nextOffset, null);
  assert.match(out.paging, /au-delà de la fin/);
  const end = paginateText('abc', { offset: 2, maxChars: 2 });
  assert.equal(end.page, 'c');
  assert.equal(end.endOffset, 3);
  assert.equal(end.pagesLeft, 0);
});

test('E132 : liste bornée par limit, total toujours donné, suite sans trou', () => {
  // review2-captures-18-11 : chaque texte compte une fois dans maxChars ; count reste, comme avant le
  // sprint, le nombre d'éléments lus (min(trouvés, limit)) ; un élément coupé est relu à la suite.
  const all = paginateItems(CARDS, { limit: EXTRACT_MAX_ITEMS, maxChars: 3000 });
  assert.equal(all.total, 300);
  assert.equal(all.count, 300);
  assert.ok(all.items.length < 300, 'maxChars borne la réponse');
  assert.equal(all.text.length, 3000);
  const whole = all.items.filter((item) => !item.textTruncated);
  assert.equal(all.nextOffset, whole.length);
  assert.equal(all.remaining, 300 - whole.length);
  const seen = [...whole];
  let page = all;
  while (page.truncated) {
    page = paginateItems(CARDS, {
      offset: page.nextOffset,
      limit: EXTRACT_MAX_ITEMS,
      maxChars: 50000,
    });
    assert.equal(page.total, 300);
    seen.push(...page.items);
  }
  assert.deepEqual(seen, CARDS);
  assert.match(page.paging, /fin de la liste\.$/);
  const few = paginateItems(CARDS, { limit: 5, maxChars: 50000 });
  assert.equal(few.count, 5);
  assert.equal(few.total, 300);
  assert.equal(few.nextOffset, 5);
  assert.equal(
    few.text,
    CARDS.slice(0, 5)
      .map((card) => card.text)
      .join('\n'),
  );
  assert.match(few.paging, /^300 élément\(s\) trouvé\(s\) : rangs 0 à 5 rendus ; suite : offset=5/);
});

test('E132 : un élément seul plus long que maxChars est coupé en le disant, jamais en silence', () => {
  const big = [{ text: 'y'.repeat(1000), href: 'https://jobs.example.com/a' }, CARDS[0]];
  const out = paginateItems(big, { limit: 10, maxChars: 226 });
  // review2-captures-18-11 : le texte compte une fois, le lien jamais à ses dépens (226, plus 100) ;
  // count reste le nombre d'éléments lus, comme avant le sprint.
  assert.equal(out.count, 2);
  assert.equal(out.items.length, 1);
  assert.equal(out.items[0].textTruncated, true);
  assert.equal(out.items[0].textChars, 1000);
  assert.equal(out.items[0].text.length, 226);
  assert.equal(out.items[0].href, 'https://jobs.example.com/a');
  assert.equal(out.nextOffset, 1);
  assert.match(out.paging, /coupé à maxChars/);
});

test('E132 : le schéma accepte une page de résultats entière', () => {
  const schema = getCapability('browser.extract').schema;
  assert.equal(EXTRACT_MAX_ITEMS, 1000);
  const args = schema.parse({ selector: 'article', limit: EXTRACT_MAX_ITEMS, offset: 40 });
  assert.equal(args.limit, 1000);
  assert.equal(args.offset, 40);
  assert.equal(schema.parse({ selector: 'article' }).offset, 0);
  assert.equal(schema.safeParse({ selector: 'article', limit: 1001 }).success, false);
  assert.equal(schema.safeParse({ selector: 'article', offset: -1 }).success, false);
});

test('E132 FICTIF : la passerelle rend chaque élément avec son texte, son lien et le total', async () => {
  const cards = [
    ...CARDS.slice(0, 2),
    { text: 'Offre FICTIVE clé AIzaSyABCDEFGHIJKLMNOPQRSTUVWX', href: null },
  ];
  const gw = gateway({
    [PAGE]: { title: 'Résultats', text: 'Résultats FICTIFS', lists: { article: cards } },
  });
  await gw.call('browser.navigate', { url: PAGE });
  const out = await gw.call('browser.extract', { selector: 'article', limit: 1000 });
  assert.equal(out.untrusted, true);
  assert.equal(out.total, 3);
  assert.equal(out.count, 3);
  assert.deepEqual(out.items.slice(0, 2), CARDS.slice(0, 2));
  assert.equal(out.items[2].href, undefined);
  assert.ok(!JSON.stringify(out).includes('AIza'), 'masquage appliqué aux éléments aussi');
  assert.match(out.text, /^Offre FICTIVE 0/);
  const second = await gw.call('browser.extract', { selector: 'article', limit: 2, offset: 2 });
  assert.equal(second.count, 1);
  assert.equal(second.total, 3);
  assert.equal(second.truncated, false);
});

test('E131 FICTIF : le texte d’un élément est paginé, plus coupé à maxChars en silence', async () => {
  const gw = gateway({ [PAGE]: { title: 'Résultats', text: LONG } });
  await gw.call('browser.navigate', { url: PAGE });
  const first = await gw.call('browser.extract', { maxChars: 50000 });
  assert.equal(first.text, LONG.slice(0, 50000));
  assert.equal(first.nextOffset, 50000);
  assert.equal(first.totalChars, LONG.length);
  const second = await gw.call('browser.extract', { maxChars: 50000, offset: first.nextOffset });
  assert.equal(second.text, LONG.slice(50000, 100000));
  assert.equal(second.pagesLeft, 1);
});

test('E132 : l’élément, le lien qui le contient ou le premier lien qu’il contient', () => {
  const link = (href) => ({ href });
  const element = (text, { closest = null, inner = null } = {}) => ({
    innerText: text,
    closest: (selector) => (selector === 'a[href]' ? closest : null),
    querySelector: (selector) => (selector === 'a[href]' ? inner : null),
  });
  const out = listedElements([
    element('Carte FICTIVE', { inner: link('https://jobs.example.com/offre/1') }),
    element('Lien FICTIF', { closest: link('https://jobs.example.com/offre/2') }),
    element('Sans lien FICTIF'),
  ]);
  assert.deepEqual(out, [
    { text: 'Carte FICTIVE', href: 'https://jobs.example.com/offre/1' },
    { text: 'Lien FICTIF', href: 'https://jobs.example.com/offre/2' },
    { text: 'Sans lien FICTIF', href: null },
  ]);
});

test('MCP réel : l’agent voit comment lire une page entière et lister les liens', async (t) => {
  const client = await connectMcp({
    command: process.execPath,
    args: [fileURLToPath(new URL('../packages/mcp-gateway/server.js', import.meta.url)), 'core'],
    env: [
      { name: 'RELAY_BROWSER', value: 'isolated' },
      {
        name: 'RELAY_POLICY',
        value: JSON.stringify({
          capabilities: ['browser.navigate', 'browser.snapshot', 'browser.extract'],
          allowLocalOrigins: ['http://127.0.0.1:1'],
        }),
      },
    ],
  });
  t.after(() => client.close());
  const tools = (await client.listTools()).tools;
  const snapshot = tools.find((tool) => tool.name === 'browser_snapshot');
  const extract = tools.find((tool) => tool.name === 'browser_extract');
  assert.equal(snapshot.inputSchema.properties.maxChars.maximum, 200000);
  assert.match(snapshot.description, /offset=nextOffset jusqu’à truncated faux/);
  assert.match(snapshot.description, /pagesLeft/);
  assert.match(snapshot.description, /browser_extract/);
  assert.equal(extract.inputSchema.properties.limit.maximum, 1000);
  assert.equal(extract.inputSchema.properties.offset.minimum, 0);
  assert.match(extract.description, /l’adresse de son lien/);
  assert.match(extract.description, /total donne le nombre d’éléments trouvés/);
  assert.match(extract.description, /limit=1000, puis offset=nextOffset/);
  for (const description of [snapshot.description, extract.description])
    assert.doesNotMatch(description, /Claude|Codex|Gemini|OpenCode/);
  // Out of bounds : refused by the schema before any handler (no browser started).
  const refused = await client.callTool({
    name: 'browser_extract',
    arguments: { selector: 'article', limit: 1001 },
  });
  assert.equal(refused.isError, true);
  assert.match(refused.content[0].text, /validation/i);
});
