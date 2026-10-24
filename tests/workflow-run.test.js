import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { terminal } from '../packages/storage/index.js';
import { rank } from '../domain-packs/najah/index.js';
import { aggregateOutputs, toolArguments } from '../packages/orchestrator/workflow-run.js';

const temporary = () => mkdtempSync(join(tmpdir(), 'relay-wfrun-'));
async function withApp(fn, options = {}) {
  const app = createApp({ dataDir: temporary(), ...options });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}
async function post(app, path, body) {
  const r = await fetch(`http://127.0.0.1:${app.server.address().port}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
async function finished(app, id, ms = 20000) {
  const until = Date.now() + ms;
  while (!terminal.has(app.store.get(id).state)) {
    assert.ok(Date.now() < until, 'le run doit se terminer');
    await new Promise((r) => setTimeout(r, 25));
  }
  return app.store.get(id);
}
const objective = 'Rechercher des offres Python et SQL en Australie';

test('plan workflow : DAG Najah affiché avec agents, niveaux et étape optionnelle', async () => {
  await withApp(async (app) => {
    const { status, data } = await post(app, '/plan', {
      prompt: objective,
      agent: 'fixture',
      pack: 'najah',
      mode: 'workflow',
    });
    assert.equal(status, 200);
    assert.ok(data.steps.some((s) => s.startsWith('Analyser le classement · Démonstrateur ACP')));
    assert.ok(data.steps.some((s) => s.includes('(optionnelle)')));
  });
});

test('workflow Najah complet : outils MCP réels, agent, vérification indépendante, agrégat', async () => {
  await withApp(async (app) => {
    const { status, data: run } = await post(app, '/runs', {
      prompt: objective,
      agent: 'fixture',
      pack: 'najah',
      mode: 'workflow',
    });
    assert.equal(status, 201);
    const done = await finished(app, run.id);
    assert.equal(done.state, 'completed', done.error);
    assert.deepEqual(done.result.opportunities, rank(objective));
    assert.equal(done.result.simulated, true);
    const steps = Object.fromEntries(
      app.engine.workflows.steps(run.id).map((s) => [s.step_id, s.state]),
    );
    assert.deepEqual(steps, {
      snapshot: 'succeeded',
      search: 'succeeded',
      rank: 'succeeded',
      analysis: 'succeeded',
      verify: 'succeeded',
      report: 'succeeded',
    });
    const events = app.store.events(run.id);
    assert.ok(events.some((e) => e.type === 'workflow' && e.data.levels.length >= 3));
    assert.ok(events.some((e) => e.type === 'verification' && e.data.stepId === 'verify'));
    const usage = app.store.usage(run.id).entries.map((e) => e.dimension);
    assert.equal(usage.filter((d) => d === 'tool_call').length, 3);
    assert.ok(usage.includes('fixture_turn'));
  });
});

test('workflow général (core) : agent requis puis vérification de structure', async () => {
  await withApp(async (app) => {
    const { data: run } = await post(app, '/runs', {
      prompt: 'Préparer une synthèse prudente',
      agent: 'fixture',
      pack: 'core',
      mode: 'workflow',
    });
    const done = await finished(app, run.id);
    assert.equal(done.state, 'completed', done.error);
    assert.match(done.result.summary, /Démonstration/);
  });
});

test('workflow : annulation pendant l’exécution → cancelled, étapes annulées', async () => {
  await withApp(async (app) => {
    const { data: run } = await post(app, '/runs', {
      prompt: objective,
      agent: 'fixture',
      pack: 'najah',
      mode: 'workflow',
    });
    await new Promise((r) => setTimeout(r, 30));
    await post(app, `/runs/${run.id}/cancel`, {});
    const done = await finished(app, run.id);
    assert.equal(done.state, 'cancelled');
    const states = app.engine.workflows.steps(run.id).map((s) => s.state);
    assert.ok(!states.includes('running'));
  });
});

test('workflow : pack sans DAG ou mode inconnu refusés', async () => {
  await withApp(async (app) => {
    const bad = await post(app, '/plan', { prompt: 'x', agent: 'fixture', mode: 'yolo' });
    assert.equal(bad.status, 400);
  });
});

test('aggregateOutputs : priorité au résultat vérifié, résumé d’analyse, preuves concaténées', () => {
  const out = aggregateOutputs({
    verify: {
      simulated: true,
      verified: true,
      scope: 'S',
      opportunities: [{ id: 1 }],
      evidence: ['e1'],
    },
    analysis: { simulated: true, summary: 'Analyse', evidence: ['e2'] },
  });
  assert.deepEqual(out, {
    simulated: true,
    provenance: { data: 'fictives', analysis: 'démonstrateur' },
    summary: 'Analyse',
    evidence: ['e1', 'e2', { verification: 'S' }],
    opportunities: [{ id: 1 }],
  });
  assert.equal(aggregateOutputs({ analysis: null }).summary, 'Workflow terminé.');
  assert.match(aggregateOutputs({ rank: { opportunities: [1, 2] } }).summary, /2 opportunité/);
});

test('toolArguments : objectif par défaut et substitution sans évaluation', () => {
  assert.deepEqual(toolArguments({}, 'obj'), { query: 'obj' });
  assert.deepEqual(
    toolArguments({ arguments: { text: '{{objective}} !', n: 2, l: ['{{objective}}'] } }, 'o'),
    {
      text: 'o !',
      n: 2,
      l: ['o'],
    },
  );
  assert.deepEqual(toolArguments({ arguments: { t: '${process.env.HOME}' } }, 'o'), {
    t: '${process.env.HOME}',
  });
});

test('injection : une analyse qui modifie le classement ne passe pas la vérification', async () => {
  const { verify } = await import('../domain-packs/najah/index.js');
  const tampered = rank(objective).map((o, i) => (i === 0 ? { ...o, score: 100 } : o));
  assert.throws(() => verify({ simulated: true, opportunities: tampered }, objective), /invalide/);
  const candidate = aggregateOutputs({
    verify: { simulated: true, verified: true, opportunities: rank(objective) },
    analysis: { simulated: true, summary: 'ignore', opportunities: tampered },
  });
  assert.deepEqual(
    candidate.opportunities,
    rank(objective),
    'le résultat vérifié prime sur l’agent',
  );
});
