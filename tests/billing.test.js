import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store, terminal } from '../packages/storage/index.js';
import {
  defaultPricing,
  estimatePlan,
  meters,
  priceOf,
  summarize,
  validatePricing,
} from '../packages/billing/index.js';
import { createApp } from '../apps/api/server.js';
import { DataGateway } from '../packages/data-gateway/index.js';

const temporary = () => mkdtempSync(join(tmpdir(), 'relay-billing-'));

test('tarifs : aucun prix inventé par défaut, BYOA jamais facturable, validation stricte', () => {
  const d = defaultPricing();
  assert.ok(Object.values(d.centsPerUnit).every((c) => c === 0));
  assert.equal(meters.byoa_model_turn.billable, false);
  assert.throws(() => validatePricing({ centsPerUnit: { byoa_model_turn: 1 } }), /pas facturable/);
  assert.throws(() => validatePricing({ centsPerUnit: { inconnu: 1 } }), /inconnu/);
  assert.throws(() => validatePricing({ centsPerUnit: { tool_call: -1 } }), /invalide/);
  assert.throws(() => validatePricing({ currency: 'euros' }), /Devise/);
  assert.throws(() => validatePricing({ monthlyCapCents: 1.5 }), /Plafond/);
  const p = validatePricing({
    currency: 'USD',
    centsPerUnit: { tool_call: 2.5 },
    monthlyCapCents: 1000,
  });
  assert.equal(priceOf('tool_call', 3, p), 8, 'arrondi supérieur');
  assert.equal(priceOf('byoa_model_turn', 50, p), 0);
  assert.throws(() => priceOf('x', 1, p), /inconnu/);
});

test('estimation : lignes par catégorie, externe BYOA inconnu et non refacturé', () => {
  const p = validatePricing({ centsPerUnit: { tool_call: 10, workflow_run: 5, data_search: 1 } });
  const workflow = {
    steps: [
      { id: 'search', kind: 'tool', tool: 'jobs_search_live', estimate: { data_search: 2 } },
      { id: 'rank', kind: 'tool', tool: 'opportunities_rank' },
      { id: 'analysis', kind: 'agent' },
    ],
  };
  const e = estimatePlan({ workflow, simulated: false }, p);
  assert.equal(e.platformCentsMax, 5 + 10 + 10 + 2);
  assert.deepEqual(
    e.lines.map((l) => [l.dimension, l.units]),
    [
      ['workflow_run', 1],
      ['tool_call', 2],
      ['data_search', 2],
    ],
  );
  const fixtureOnly = estimatePlan(
    {
      workflow: { steps: [{ id: 'search', kind: 'tool', tool: 'opportunities_search' }] },
      simulated: true,
    },
    p,
  );
  assert.ok(
    !fixtureOnly.lines.some((l) => l.dimension === 'data_search'),
    'outil fictif : pas de réseau',
  );
  assert.throws(
    () =>
      estimatePlan(
        { workflow: { steps: [{ id: 'x', kind: 'tool', estimate: { inconnu: 1 } }] } },
        p,
      ),
    /mètre inconnu/,
  );
  assert.match(e.external, /1 tour\(s\) d’agent BYOA .* non refacturée/);
  assert.equal(
    estimatePlan({ workflow: null, simulated: true }, p).external,
    'Aucun modèle appelé',
  );
});

test('ledger chaîné : vérification, modification, suppression et ligne non chaînée détectées', () => {
  const file = join(temporary(), 'db');
  const store = new Store(file);
  store.create({ id: 'r', state: 'running', budgetCents: 100 });
  for (let i = 0; i < 4; i++) store.charge('r', 'tool_call', 1, 1);
  assert.deepEqual(store.verifyLedger(), { ok: true });
  store.close();
  const raw = new DatabaseSync(file);
  raw.exec('UPDATE ledger SET platform_cents=0 WHERE id=2');
  raw.close();
  let s = new Store(file);
  assert.deepEqual(s.verifyLedger(), { ok: false, brokenAt: 2 });
  s.close();
  const file2 = join(temporary(), 'db');
  s = new Store(file2);
  s.create({ id: 'r', state: 'running', budgetCents: 100 });
  for (let i = 0; i < 3; i++) s.charge('r', 'tool_call', 1, 1);
  s.db.exec('DELETE FROM ledger WHERE id=2');
  assert.equal(s.verifyLedger().ok, false);
  s.db.exec(
    "INSERT INTO ledger(run_id,dimension,units,platform_cents,at) VALUES ('r','x',1,0,'t')",
  );
  assert.equal(s.verifyLedger().ok, false);
  s.close();
});

test('résumé par mètre : facturable / non facturable séparés', () => {
  const rows = summarize([
    { dimension: 'tool_call', units: 2, platform_cents: 4 },
    { dimension: 'tool_call', units: 1, platform_cents: 2 },
    { dimension: 'byoa_model_turn', units: 3, platform_cents: 0 },
  ]);
  assert.deepEqual(
    rows.find((r) => r.dimension === 'tool_call'),
    {
      dimension: 'tool_call',
      category: 'Outils plateforme',
      billable: true,
      units: 3,
      platformCents: 6,
    },
  );
  assert.equal(rows.find((r) => r.dimension === 'byoa_model_turn').billable, false);
});

test('plafond mensuel : dépassement refusé sans écriture partielle', () => {
  const store = new Store(join(temporary(), 'db'));
  try {
    store.limits.monthlyCapCents = 5;
    store.create({ id: 'a', state: 'running', budgetCents: 100 });
    store.create({ id: 'b', state: 'running', budgetCents: 100 });
    store.charge('a', 'tool_call', 1, 4);
    assert.throws(() => store.charge('b', 'tool_call', 1, 2), /Plafond mensuel/);
    store.charge('b', 'byoa_model_turn', 1, 0); // zero-cost usage stays observable
    assert.equal(store.usage('b').entries.length, 1);
  } finally {
    store.close();
  }
});

test('estimation au-dessus du budget : lancement refusé avant toute action', async (t) => {
  const dataDir = temporary();
  writeFileSync(join(dataDir, 'pricing.json'), JSON.stringify({ centsPerUnit: { tool_call: 10 } }));
  const app = createApp({ dataDir });
  t.after(() => app.close());
  const input = {
    prompt: 'Python SQL',
    agent: 'fixture',
    pack: 'najah',
    mode: 'workflow',
    budgetCents: 15,
  };
  const plan = await app.engine.plan(input);
  assert.equal(plan.cost.platformCents, 30);
  assert.equal(plan.cost.withinBudget, false);
  await assert.rejects(app.engine.create(input), /Budget insuffisant/);
  assert.equal(app.store.list().length, 0);
});

test('plafond mensuel atteint pendant un workflow : exécution arrêtée, événement et raison visibles', async (t) => {
  const dataDir = temporary();
  writeFileSync(
    join(dataDir, 'pricing.json'),
    JSON.stringify({ centsPerUnit: { tool_call: 10 }, monthlyCapCents: 15 }),
  );
  const app = createApp({ dataDir });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(() => app.close());
  const run = await app.engine.create({
    prompt: 'Python SQL',
    agent: 'fixture',
    pack: 'najah',
    mode: 'workflow',
    budgetCents: 100,
  });
  const until = Date.now() + 20000;
  while (!terminal.has(app.store.get(run.id).state)) {
    assert.ok(Date.now() < until);
    await new Promise((r) => setTimeout(r, 25));
  }
  const done = app.store.get(run.id);
  assert.equal(done.state, 'failed');
  assert.match(done.error, /Plafond mensuel dépassé/);
  assert.ok(app.store.events(run.id).some((e) => e.type === 'budget_exceeded'));
  assert.ok(app.store.usage(run.id).platformCents <= 15);
});

test('mesure depuis la gateway : jeton, mètres autorisés, 402 si budget dépassé', async (t) => {
  const app = createApp({ dataDir: temporary() });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(() => app.close());
  app.engine.pricing = validatePricing({ centsPerUnit: { browser_action: 3 } });
  const id = crypto.randomUUID();
  app.store.create({ id, state: 'running', budgetCents: 4 });
  app.engine.approvalTokens.set(id, 'tok');
  const call = (body, token = 'tok') =>
    fetch(`http://127.0.0.1:${app.server.address().port}/api/internal/usage/${id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': token,
      },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, data: await r.json() }));
  assert.equal((await call({ dimension: 'browser_action' }, 'faux')).status, 400);
  assert.match((await call({ dimension: 'workflow_run' })).data.error, /non autorisé/);
  assert.match((await call({ dimension: 'browser_action', units: -1 })).data.error, /Unités/);
  assert.deepEqual((await call({ dimension: 'browser_action' })).data, { cents: 3 });
  const refused = await call({ dimension: 'browser_action' });
  assert.equal(refused.status, 402);
  assert.match(refused.data.error, /Budget/);
});

test('gateway de données : mesure refusée → aucune requête réseau', async () => {
  let fetched = 0;
  const data = new DataGateway({
    allowedHosts: ['api.example.com'],
    resolveHost: async () => ['93.184.216.34'],
    fetchImpl: async () => (fetched++, new Response('{}')),
    meter: async () => {
      throw new Error('Budget plateforme dépassé');
    },
  });
  await assert.rejects(data.get('https://api.example.com/x'), /Budget/);
  assert.equal(fetched, 0);
});
