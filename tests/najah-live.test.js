import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../packages/orchestrator/packs.js';
import { DataGateway } from '../packages/data-gateway/index.js';
import {
  buildRegister,
  checkSponsors,
  keywords,
  normalizeArbeitnow,
  normalizeCompany,
  normalizeRemotive,
  parseCsv,
  rankLive,
  searchJobs,
  verifyLive,
} from '../domain-packs/najah/live.js';
import { toolArguments } from '../packages/orchestrator/workflow-run.js';
import { createApp } from '../apps/api/server.js';
import { terminal } from '../packages/storage/index.js';

const REC = resolve(ROOT, 'tests/fixtures/najah-recorded');
const arbeitnow = JSON.parse(readFileSync(join(REC, 'arbeitnow.json'), 'utf8'));
const remotive = JSON.parse(readFileSync(join(REC, 'remotive.json'), 'utf8'));
const ukCsv = readFileSync(join(REC, 'uk-sponsors-sample.csv'), 'utf8');
const temporary = () => mkdtempSync(join(tmpdir(), 'relay-najah-'));
const REPLAY = {
  'https://www.arbeitnow.com/api/job-board-api?page=1': join(REC, 'arbeitnow.json'),
  'https://remotive.com/api/remote-jobs?search=python&limit=50': join(REC, 'remotive.json'),
  'https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers':
    join(REC, 'govuk-register-page.json'),
  'https://assets.publishing.service.gov.uk/media/6adb1b5ab62d80a107bc5c29/SP_-_Worker_and_Temporary_Worker_Web_Register_-_2026-10-23.csv':
    join(REC, 'uk-sponsors-sample.csv'),
};
const HOSTS = [
  'www.arbeitnow.com',
  'remotive.com',
  'www.gov.uk',
  'assets.publishing.service.gov.uk',
];

test('mots-clés : mots vides retirés, langages conservés', () => {
  assert.deepEqual(keywords('Rechercher des offres Python et SQL en Australie'), [
    'python',
    'sql',
    'australie',
  ]);
  assert.deepEqual(keywords('C++ / C# remote jobs'), ['c++', 'c#']);
});

test('normalisation des sources réelles enregistrées : provenance complète, sponsoring inconnu', () => {
  const a = normalizeArbeitnow(arbeitnow, '2026-10-25T00:00:00Z');
  const r = normalizeRemotive(remotive, '2026-10-25T00:00:00Z');
  assert.equal(a.length, arbeitnow.data.length);
  for (const o of [...a, ...r]) {
    assert.match(o.url, /^https:\/\//);
    assert.equal(o.sponsorship, 'unknown');
    assert.ok(o.attribution && o.fetchedAt && o.id.includes(':'));
    assert.ok(!/<[a-z]/i.test(o.excerpt), 'HTML retiré');
    assert.ok(o.excerpt.length <= 600);
  }
  assert.match(r[0].attribution, /Remotive/);
});

test('CSV : guillemets, virgules dans les champs, CRLF', () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","z ""q"""\n'), [
    ['a', 'b'],
    ['x, y', 'z "q"'],
  ]);
});

test('registre UK : noms normalisés, correspondance de nom ≠ identité confirmée, pas de faux positif', () => {
  const reg = buildRegister(ukCsv);
  assert.equal(normalizeCompany('Monzo Bank Ltd'), normalizeCompany('MONZO BANK LIMITED'));
  const [askable, mitre, monzo, unknown] = checkSponsors(
    reg,
    ['Askable', 'Mitre Media', 'Monzo Bank', 'Workist GmbH'],
    { url: 'x' },
  );
  assert.equal(askable.status, 'name_listed');
  assert.match(askable.caveat, /non confirmée/);
  assert.ok(askable.routes.includes('Skilled Worker'));
  assert.equal(mitre.status, 'not_listed', 'Mitre Media ≠ Mitre Maintenance Ltd');
  assert.equal(monzo.status, 'name_listed');
  assert.equal(unknown.status, 'not_listed');
  assert.match(unknown.caveat, /autres pays/);
  assert.throws(() => buildRegister('Nom,Ville\nX,Y\n'), /Format/);
});

test('classement explicable et déterministe ; lieux FR/EN ; bonus visa seulement si demandé', () => {
  const offers = [...normalizeArbeitnow(arbeitnow, 't'), ...normalizeRemotive(remotive, 't')];
  const sponsors = checkSponsors(
    buildRegister(ukCsv),
    [...new Set(offers.map((o) => o.company))],
    {},
  );
  const a = rankLive('Data engineer Python à Berlin avec sponsor visa', offers, sponsors);
  assert.deepEqual(
    a,
    rankLive('Data engineer Python à Berlin avec sponsor visa', offers, sponsors),
  );
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].score >= a[i].score);
  assert.ok(a.every((o) => o.reasons.length));
  const askable = a.find((o) => o.company === 'Askable');
  if (askable) {
    assert.equal(askable.sponsorship, 'uk_register_name_match');
    assert.ok(askable.reasons.some((r) => /registre UK/.test(r)));
  }
  const noVisa = rankLive('Python', offers, sponsors).find((o) => o.company === 'Askable');
  if (noVisa) assert.ok(!noVisa.reasons.some((r) => /registre UK/.test(r)));
  const au = rankLive(
    'Python en Australie',
    [{ ...offers[0], location: 'Sydney, Australia', id: 'x:1' }],
    [],
  );
  assert.ok(au[0].reasons.some((r) => /Lieu correspondant/.test(r)));
});

test('vérification live : classement altéré, provenance manquante, sponsoring inventé refusés', () => {
  const offers = normalizeRemotive(remotive, '2026-10-25');
  const inputs = { search: { live: true, offers }, sponsors: { results: [] } };
  const good = { opportunities: rankLive('python', offers, []) };
  assert.equal(verifyLive(good, 'python', inputs), good);
  const reordered = { opportunities: [...good.opportunities].reverse() };
  if (
    good.opportunities.length > 1 &&
    good.opportunities[0].score !== good.opportunities.at(-1).score
  )
    assert.throws(() => verifyLive(reordered, 'python', inputs), /recalcul/);
  const boosted = {
    opportunities: good.opportunities.map((o, i) => (i ? o : { ...o, score: 999 })),
  };
  assert.throws(() => verifyLive(boosted, 'python', inputs), /recalcul/);
  const sponsored = {
    ...inputs,
    search: {
      live: true,
      offers: offers.map((o, i) => (i ? o : { ...o, sponsorship: 'confirmed' })),
    },
  };
  assert.throws(
    () =>
      verifyLive(
        { opportunities: rankLive('python', sponsored.search.offers, []) },
        'python',
        sponsored,
      ),
    /non justifié/,
  );
  const noUrl = {
    ...inputs,
    search: { live: true, offers: offers.map((o, i) => (i ? o : { ...o, url: 'http://x' })) },
  };
  assert.throws(
    () =>
      verifyLive({ opportunities: rankLive('python', noUrl.search.offers, []) }, 'python', noUrl),
    /Provenance/,
  );
  assert.throws(() => verifyLive(good, 'python', {}), /absent/);
});

test('gateway de données : hôtes autorisés, HTTPS, redirections revérifiées, taille, cache, mesure', async () => {
  const calls = [];
  const meters = [];
  const respond = (status, body, headers = {}) => new Response(body, { status, headers });
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/redir')) return respond(302, null, { location: 'https://evil.net/x' });
    if (url.endsWith('/big')) return respond(200, 'x'.repeat(5000));
    if (url.endsWith('/500')) return respond(500, 'err');
    return respond(200, JSON.stringify({ ok: true }));
  };
  const data = new DataGateway({
    allowedHosts: ['api.example.com'],
    cacheDir: temporary(),
    fetchImpl,
    resolveHost: async () => ['93.184.216.34'],
    meter: (...m) => meters.push(m),
  });
  assert.deepEqual((await data.get('https://api.example.com/a')).body, { ok: true });
  assert.equal((await data.get('https://api.example.com/a')).cached, true);
  assert.equal(calls.length, 1, 'deuxième appel servi par le cache');
  assert.deepEqual(meters, [['data_search', 1, 'api.example.com']]);
  await assert.rejects(data.get('http://api.example.com/a'), /Protocole/);
  await assert.rejects(data.get('https://other.com/a'), /non autorisé/);
  await assert.rejects(data.get('https://api.example.com/redir'), /non autorisé/);
  await assert.rejects(
    data.get('https://api.example.com/big', { maxBytes: 100, as: 'text' }),
    /volumineuse/,
  );
  await assert.rejects(data.get('https://api.example.com/500'), /indisponible \(500\)/);
  const privateDns = new DataGateway({
    allowedHosts: ['api.example.com'],
    fetchImpl,
    resolveHost: async () => ['10.0.0.1'],
  });
  await assert.rejects(privateDns.get('https://api.example.com/a'), /réseau privé/);
});

test('rejeu : réponses réelles enregistrées, jamais de réseau, allowlist conservée', async () => {
  const data = new DataGateway({
    allowedHosts: HOSTS,
    replay: REPLAY,
    fetchImpl: () => assert.fail('réseau interdit'),
  });
  const out = await searchJobs(data, { query: 'Python data engineer', limit: 10 });
  assert.equal(out.live, true);
  assert.ok(out.offers.length > 0);
  assert.ok(out.offers.every((o) => o.fetchedAt.startsWith('enregistré')));
  assert.deepEqual(out.errors, []);
  const blocked = new DataGateway({ allowedHosts: ['remotive.com'], replay: REPLAY });
  const partial = await searchJobs(blocked, { query: 'python' });
  assert.equal(partial.errors[0].source, 'arbeitnow');
  assert.match(partial.errors[0].error, /non autorisé/);
});

test('toolArguments : $from relie les sorties, valeur absente omise', () => {
  const inputs = { search: { offers: [1, 2], companies: ['A'] }, sponsors: null };
  const step = {
    arguments: {
      query: '{{objective}}',
      offers: { $from: 'search.offers' },
      sponsors: { $from: 'sponsors.results' },
    },
  };
  const args = toolArguments(step, 'obj', inputs);
  assert.deepEqual(JSON.parse(JSON.stringify(args)), { query: 'obj', offers: [1, 2] });
  assert.deepEqual(toolArguments({ arguments: { x: { $from: 'a', y: 1 } } }, 'o', { a: 5 }), {
    x: { $from: 'a', y: 1 },
  });
});

test('DAG Najah réel complet via l’API, en rejeu hors ligne : recherche → registre → classement → vérification', async (t) => {
  const saved = { ...process.env };
  process.env.AGENT_PLATFORM_DATA_REPLAY = JSON.stringify(REPLAY);
  const app = createApp({ dataDir: temporary() });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await app.close();
    process.env = saved;
  });
  const run = await app.engine.create({
    prompt: 'Data engineer Python avec sponsor visa',
    agent: 'fixture',
    pack: 'najah',
    mode: 'workflow',
    workflow: 'opportunity-discovery-live',
  });
  const until = Date.now() + 30000;
  while (!terminal.has(app.store.get(run.id).state)) {
    assert.ok(Date.now() < until);
    await new Promise((r) => setTimeout(r, 50));
  }
  const done = app.store.get(run.id);
  assert.equal(done.state, 'completed', done.error);
  assert.equal(done.result.simulated, false);
  assert.ok(done.result.opportunities.length > 0);
  assert.ok(done.result.opportunities.every((o) => o.url && o.attribution));
  assert.ok(done.result.evidence.some((e) => /Remotive|Arbeitnow/.test(e.source ?? '')));
  const steps = Object.fromEntries(
    app.engine.workflows.steps(run.id).map((s) => [s.step_id, s.state]),
  );
  assert.deepEqual(steps, {
    search: 'succeeded',
    sponsors: 'succeeded',
    rank: 'succeeded',
    analysis: 'succeeded',
    verify: 'succeeded',
    report: 'succeeded',
  });
  assert.ok(readdirSync(join(app.engine.dataDir)).length);
});
