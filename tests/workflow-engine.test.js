import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../packages/storage/index.js';
import { WorkflowEngine, validateWorkflow, levels } from '../packages/workflow-engine/index.js';

const temporary = () => mkdtempSync(join(tmpdir(), 'relay-wf-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function setup(executors, file = join(temporary(), 'db')) {
  const store = new Store(file);
  store.create({ id: 'run', state: 'running', budgetCents: 0 });
  return { store, engine: new WorkflowEngine({ store, executors }), file };
}
const tool = (id, dependsOn = [], extra = {}) => ({
  id,
  title: id,
  kind: 'tool',
  tool: 't',
  dependsOn,
  ...extra,
});
const wf = (steps, extra = {}) => ({ id: 'wf', title: 'WF', steps, ...extra });
async function run(engine, workflow, ctx, signal) {
  engine.init('run', workflow);
  return engine.drive('run', workflow, ctx, signal);
}

test('définition : schéma, doublons, dépendances inconnues, cycles, ordre et niveaux', () => {
  assert.throws(() => validateWorkflow(wf([tool('a'), tool('a')])), /dupliquée/);
  assert.throws(() => validateWorkflow(wf([tool('a', ['zz'])])), /inconnue/);
  assert.throws(() => validateWorkflow(wf([tool('a', ['b']), tool('b', ['a'])])), /circulaire/);
  assert.throws(() => validateWorkflow(wf([tool('a', ['a'])])), /circulaire/);
  assert.throws(() => validateWorkflow(wf([{ id: 'a', title: 'a', kind: 'tool' }])), /tool requis/);
  assert.throws(
    () => validateWorkflow(wf([{ id: 'a', title: 'a', kind: 'agent' }])),
    /prompt requis/,
  );
  assert.throws(() => validateWorkflow(wf([{ ...tool('a'), extra: 1 }])));
  assert.throws(() => validateWorkflow(wf([tool('A B')])));
  assert.throws(() => validateWorkflow(wf([])));
  const v = validateWorkflow(wf([tool('c', ['a', 'b']), tool('a'), tool('b'), tool('d', ['c'])]));
  assert.deepEqual(v.order, ['a', 'b', 'c', 'd']);
  assert.deepEqual(levels(v), [['a', 'b'], ['c'], ['d']]);
});

test('exécution séquentielle avec passage des sorties de dépendances', async () => {
  const seen = {};
  const { engine, store } = setup({
    tool: async (step, { inputs }) => {
      seen[step.id] = inputs;
      return { from: step.id };
    },
  });
  try {
    const out = await run(engine, wf([tool('a'), tool('b', ['a'])]));
    assert.equal(out.state, 'completed');
    assert.deepEqual(seen.b, { a: { from: 'a' } });
    assert.deepEqual(out.outputs.b, { from: 'b' });
    assert.ok(store.events('run').some((e) => e.type === 'workflow'));
  } finally {
    store.close();
  }
});

test('parallélisme réel borné par concurrency (fan-out / fan-in)', async () => {
  let active = 0,
    peak = 0;
  const { engine, store } = setup({
    tool: async () => {
      active++;
      peak = Math.max(peak, active);
      await sleep(80);
      active--;
      return 1;
    },
  });
  try {
    const steps = [tool('a'), tool('b'), tool('c'), tool('d'), tool('join', ['a', 'b', 'c', 'd'])];
    const t0 = Date.now();
    const out = await run(engine, wf(steps, { concurrency: 2 }));
    assert.equal(out.state, 'completed');
    assert.equal(peak, 2);
    assert.ok(Date.now() - t0 < 80 * 5, 'les branches doivent se chevaucher');
  } finally {
    store.close();
  }
});

test('échec : dépendants ignorés, run en échec avec détail', async () => {
  const { engine, store } = setup({
    tool: async (step) => {
      if (step.id === 'b') throw new Error('panne b');
      return step.id;
    },
  });
  try {
    const out = await run(
      engine,
      wf([tool('a'), tool('b', ['a']), tool('c', ['b']), tool('d', ['a'])]),
    );
    assert.equal(out.state, 'failed');
    const states = Object.fromEntries(engine.steps('run').map((r) => [r.step_id, r.state]));
    assert.deepEqual(states, { a: 'succeeded', b: 'failed', c: 'skipped', d: 'succeeded' });
    assert.equal(out.failed.find((f) => f.id === 'b').error, 'panne b');
  } finally {
    store.close();
  }
});

test('étape optionnelle en échec : le workflow continue et réussit', async () => {
  const { engine, store } = setup({
    tool: async (step) => {
      if (step.id === 'opt') throw new Error('non critique');
      return step.id;
    },
  });
  try {
    const out = await run(engine, wf([tool('opt', [], { optional: true }), tool('next', ['opt'])]));
    assert.equal(out.state, 'completed');
    assert.equal(engine.row('run', 'next').state, 'succeeded');
  } finally {
    store.close();
  }
});

test('tentatives : réussite après deux échecs, compteur persistant', async () => {
  let calls = 0;
  const { engine, store } = setup({
    tool: async () => {
      if (++calls < 3) throw new Error('transitoire');
      return 'ok';
    },
  });
  try {
    const out = await run(engine, wf([tool('a', [], { retries: 2 })]));
    assert.equal(out.state, 'completed');
    assert.equal(engine.row('run', 'a').attempt, 3);
  } finally {
    store.close();
  }
});

test('tentatives épuisées → échec', async () => {
  const { engine, store } = setup({
    tool: async () => {
      throw new Error('toujours');
    },
  });
  try {
    const out = await run(engine, wf([tool('a', [], { retries: 1 })]));
    assert.equal(out.state, 'failed');
    assert.equal(engine.row('run', 'a').attempt, 2);
  } finally {
    store.close();
  }
});

test('délai d’étape : lecture en échec, écriture incertaine (jamais relancée seule)', async () => {
  const { engine, store } = setup({ tool: () => new Promise(() => {}) });
  try {
    engine.init(
      'run',
      wf([
        tool('r', [], { timeoutMs: 100 }),
        tool('w', [], { timeoutMs: 100, effect: 'write', retries: 3 }),
      ]),
    );
    const ac = new AbortController();
    const drive = engine.drive(
      'run',
      wf([
        tool('r', [], { timeoutMs: 100 }),
        tool('w', [], { timeoutMs: 100, effect: 'write', retries: 3 }),
      ]),
      {},
      ac.signal,
    );
    await sleep(400);
    assert.equal(engine.row('run', 'r').state, 'failed');
    assert.equal(engine.row('run', 'w').state, 'uncertain');
    assert.equal(engine.row('run', 'w').attempt, 1, 'pas de nouvelle tentative automatique');
    engine.resolveUncertain('run', 'w', 'fail');
    const out = await drive;
    assert.equal(out.state, 'failed');
  } finally {
    store.close();
  }
});

test('approbation humaine : attente, approbation, suite du workflow', async () => {
  const { engine, store } = setup({ tool: async (s) => s.id });
  try {
    const def = wf([
      tool('a'),
      { id: 'ok', title: 'Valider', kind: 'approval', dependsOn: ['a'] },
      tool('b', ['ok']),
    ]);
    engine.init('run', def);
    const drive = engine.drive('run', def);
    await sleep(100);
    assert.equal(engine.row('run', 'ok').state, 'waiting_approval');
    assert.equal(engine.row('run', 'b').state, 'pending');
    assert.throws(() => engine.approve('run', 'b', true), /Aucune approbation/);
    engine.approve('run', 'ok', true, 'vu');
    const out = await drive;
    assert.equal(out.state, 'completed');
    assert.deepEqual(out.outputs.ok, { approved: true, note: 'vu' });
  } finally {
    store.close();
  }
});

test('approbation refusée : dépendants ignorés', async () => {
  const { engine, store } = setup({ tool: async (s) => s.id });
  try {
    const def = wf([{ id: 'ok', title: 'Valider', kind: 'approval' }, tool('b', ['ok'])]);
    engine.init('run', def);
    const drive = engine.drive('run', def);
    await sleep(50);
    engine.approve('run', 'ok', false);
    const out = await drive;
    assert.equal(out.state, 'failed');
    assert.equal(engine.row('run', 'b').state, 'skipped');
  } finally {
    store.close();
  }
});

test('annulation : étapes en cours et en attente annulées, écriture en cours incertaine', async () => {
  const { engine, store } = setup({
    tool: (step, { signal }) =>
      new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('stop')))),
  });
  try {
    const def = wf([tool('r'), tool('w', [], { effect: 'write' }), tool('after', ['r'])]);
    engine.init('run', def);
    const ac = new AbortController();
    const drive = engine.drive('run', def, {}, ac.signal);
    await sleep(50);
    ac.abort();
    const out = await drive;
    assert.equal(out.state, 'cancelled');
    const states = Object.fromEntries(engine.steps('run').map((r) => [r.step_id, r.state]));
    assert.deepEqual(states, { r: 'cancelled', w: 'uncertain', after: 'cancelled' });
  } finally {
    store.close();
  }
});

test('sortie tardive d’une tentative abandonnée ignorée (génération)', async () => {
  let first = true;
  let release;
  const { engine, store } = setup({
    tool: () => {
      if (first) {
        first = false;
        return new Promise((r) => (release = r));
      }
      return Promise.resolve('nouvelle');
    },
  });
  try {
    const def = wf([tool('a', [], { timeoutMs: 100, retries: 1 })]);
    const out = await run(engine, def);
    assert.equal(out.state, 'completed');
    assert.equal(engine.row('run', 'a').output, 'nouvelle');
    release('ancienne');
    await sleep(20);
    assert.equal(engine.row('run', 'a').output, 'nouvelle');
    assert.equal(engine.row('run', 'a').generation, 2);
  } finally {
    store.close();
  }
});

test('reprise après crash : étapes terminées conservées, lecture relancée, écriture incertaine', async () => {
  const dir = join(temporary(), 'db');
  const def = wf([
    tool('done'),
    tool('read', ['done']),
    tool('write', ['done'], { effect: 'write' }),
  ]);
  {
    const { store, engine } = setup({}, dir);
    engine.init('run', def);
    engine.set('run', 'done', { state: 'succeeded', output: 'D' });
    engine.set('run', 'read', { state: 'running', attempt: 1, generation: 1 });
    engine.set('run', 'write', { state: 'running', attempt: 1, generation: 1 });
    store.close(); // simulated crash
  }
  const calls = [];
  const store = new Store(dir);
  try {
    const engine = new WorkflowEngine({
      store,
      executors: { tool: async (s, { inputs }) => (calls.push([s.id, inputs]), s.id) },
    });
    engine.recover('run', def);
    assert.equal(engine.row('run', 'read').state, 'pending');
    assert.equal(engine.row('run', 'write').state, 'uncertain');
    const drive = engine.drive('run', def);
    await sleep(100);
    assert.deepEqual(calls, [['read', { done: 'D' }]], 'done non rejouée, write non relancée');
    engine.resolveUncertain('run', 'write', 'done');
    const out = await drive;
    assert.equal(out.state, 'completed');
    assert.equal(engine.row('run', 'read').attempt, 2);
  } finally {
    store.close();
  }
});

test('exécuteur absent, sortie trop volumineuse, actions invalides', async () => {
  const { engine, store } = setup({ tool: async () => 'x'.repeat(300000) });
  try {
    const out = await run(
      engine,
      wf([tool('big'), { id: 'agg', title: 'agg', kind: 'aggregate' }]),
    );
    assert.equal(out.state, 'failed');
    assert.match(engine.row('run', 'big').error, /trop volumineuse/);
    assert.match(engine.row('run', 'agg').error, /Aucun exécuteur/);
    assert.throws(() => engine.resolveUncertain('run', 'big', 'retry'), /non incertaine/);
    assert.throws(() => engine.recover('run', wf([tool('inconnue')])), /inconnue/);
  } finally {
    store.close();
  }
});

test('événements d’étape émis et persistés pour le streaming', async () => {
  const { engine, store } = setup({ tool: async () => 1 });
  try {
    await run(engine, wf([tool('a')]));
    const steps = store.events('run').filter((e) => e.type === 'step');
    assert.deepEqual(
      steps.map((e) => e.data.state),
      ['running', 'succeeded'],
    );
  } finally {
    store.close();
  }
});
