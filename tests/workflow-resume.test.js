import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { terminal } from '../packages/storage/index.js';
import { rank } from '../domain-packs/najah/index.js';

const temporary = () => mkdtempSync(join(tmpdir(), 'relay-resume-'));
async function setup(t, dataDir = temporary()) {
  const app = createApp({ dataDir });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(() => app.close());
  return app;
}
async function until(app, id, states, ms = 20000) {
  const end = Date.now() + ms;
  for (;;) {
    const s = app.store.get(id).state;
    if (states.includes(s)) return app.store.get(id);
    assert.ok(Date.now() < end, `état attendu ${states} (actuel ${s})`);
    await new Promise((r) => setTimeout(r, 25));
  }
}
const post = (app, path, body = {}) =>
  fetch(`http://127.0.0.1:${app.server.address().port}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, data: await r.json() }));
const objective = 'Rechercher des offres Python et SQL';

test('reprise après redémarrage du serveur : étapes réussies conservées, run terminé en place', async (t) => {
  const dataDir = temporary();
  let runId;
  {
    const app = createApp({ dataDir });
    const run = await app.engine.create({
      prompt: objective,
      agent: 'fixture',
      pack: 'najah',
      mode: 'workflow',
    });
    runId = run.id;
    await until(app, runId, ['completed']);
    // Simulate a crash in the middle: rewind two steps as if the server died while they ran.
    app.engine.workflows.set(runId, 'verify', { state: 'running' }, false);
    app.engine.workflows.set(runId, 'report', { state: 'pending', output: null }, false);
    app.store.update(runId, { state: 'running', result: null });
    app.store.close(); // no graceful shutdown
  }
  const app = await setup(t, dataDir);
  assert.equal(app.store.get(runId).state, 'interrupted');
  const attemptsBefore = Object.fromEntries(
    app.engine.workflows.steps(runId).map((s) => [s.step_id, s.attempt]),
  );
  const r = await post(app, `/runs/${runId}/resume`);
  assert.equal(r.status, 200);
  assert.equal(r.data.id, runId, 'reprise en place, même identifiant');
  const done = await until(app, runId, ['completed', 'failed']);
  assert.equal(done.state, 'completed', done.error);
  assert.deepEqual(done.result.opportunities, rank(objective));
  const after = Object.fromEntries(
    app.engine.workflows.steps(runId).map((s) => [s.step_id, s.attempt]),
  );
  for (const id of ['snapshot', 'search', 'rank', 'analysis'])
    assert.equal(after[id], attemptsBefore[id], `${id} non rejouée`);
  assert.equal(after.verify, attemptsBefore.verify + 1);
  assert.ok(app.store.events(runId).some((e) => e.type === 'workflow_resumed'));
  assert.equal(
    app.store.usage(runId).entries.filter((e) => e.dimension === 'workflow_run').length,
    1,
    'pas de double facturation',
  );
});

test('reprise refusée : run terminé, actif, ou mode agent', async (t) => {
  const app = await setup(t);
  const run = await app.engine.create({
    prompt: objective,
    agent: 'fixture',
    pack: 'najah',
    mode: 'workflow',
  });
  await until(app, run.id, ['completed']);
  await assert.rejects(app.engine.resumeWorkflow(run.id), /interrompu, en échec ou annulé/);
  const agentRun = await app.engine.create({ prompt: objective, agent: 'fixture', pack: 'najah' });
  await until(app, agentRun.id, ['completed']);
  await assert.rejects(app.engine.resumeWorkflow(agentRun.id), /réservée aux workflows/);
  await assert.rejects(
    app.engine.resumeWorkflow('00000000-0000-0000-0000-000000000000'),
    /introuvable/,
  );
});

test('brouillon de candidature : attente d’approbation, approbation via l’API, aucun envoi', async (t) => {
  const app = await setup(t);
  const run = await app.engine.create({
    prompt: 'Lettre pour un poste de data engineer chez Exemple GmbH (offre fictive)',
    agent: 'fixture',
    pack: 'najah',
    mode: 'workflow',
    workflow: 'application-draft',
  });
  const end = Date.now() + 20000;
  while (app.engine.workflows.row(run.id, 'review')?.state !== 'waiting_approval') {
    assert.ok(Date.now() < end, 'l’étape de relecture doit attendre');
    await new Promise((r) => setTimeout(r, 25));
  }
  assert.equal(app.store.get(run.id).state, 'running');
  const bad = await post(app, `/runs/${run.id}/steps/draft`, { approved: true });
  assert.equal(bad.status, 400);
  const ok = await post(app, `/runs/${run.id}/steps/review`, { approved: true, note: 'relu' });
  assert.equal(ok.status, 200);
  const done = await until(app, run.id, ['completed', 'failed']);
  assert.equal(done.state, 'completed', done.error);
  assert.ok(done.result.summary.length > 0);
  const tools = app.store
    .events(run.id)
    .filter((e) => e.type === 'agent' && e.data.sessionUpdate === 'tool_call')
    .map((e) => e.data.title);
  assert.ok(!tools.some((x) => /send|mail|apply|postuler/i.test(x)), 'aucune action d’envoi');
});

test('brouillon refusé à la relecture : workflow en échec, reprise possible', async (t) => {
  const app = await setup(t);
  const run = await app.engine.create({
    prompt: 'Lettre (offre fictive)',
    agent: 'fixture',
    pack: 'najah',
    mode: 'workflow',
    workflow: 'application-draft',
  });
  const end = Date.now() + 20000;
  while (app.engine.workflows.row(run.id, 'review')?.state !== 'waiting_approval') {
    assert.ok(Date.now() < end);
    await new Promise((r) => setTimeout(r, 25));
  }
  await post(app, `/runs/${run.id}/steps/review`, { approved: false });
  const done = await until(app, run.id, ['failed', 'completed']);
  assert.equal(done.state, 'failed');
  assert.match(done.error, /review/);
  const resumed = await app.engine.resumeWorkflow(run.id);
  assert.equal(resumed.id, run.id);
  while (app.engine.workflows.row(run.id, 'review')?.state !== 'waiting_approval') {
    assert.ok(Date.now() < end + 10000);
    await new Promise((r) => setTimeout(r, 25));
  }
  app.engine.stepDecision(run.id, 'review', { approved: true });
  assert.equal((await until(app, run.id, ['completed', 'failed'])).state, 'completed');
});

test('reprise concurrente : un seul contrôle et une seule exécution', async (t) => {
  const app = await setup(t);
  const { getPack } = await import('../packages/orchestrator/packs.js');
  const dag = getPack('core').dag;
  const run = {
    id: crypto.randomUUID(),
    state: 'interrupted',
    mode: 'workflow',
    agent: 'fixture',
    pack: 'core',
    prompt: 'FICTIF',
    skills: [],
    model: '',
    budgetCents: 0,
    workflow: dag.id,
    workflowDefinition: dag,
  };
  app.store.create(run);
  app.engine.plan = async () => {
    await new Promise((r) => setTimeout(r, 10));
    return { dag };
  };
  let executions = 0;
  app.engine.execute = async () => {
    executions++;
    app.engine.active.delete(run.id);
  };
  const outcomes = await Promise.allSettled([
    app.engine.resumeWorkflow(run.id),
    app.engine.resumeWorkflow(run.id),
  ]);
  await new Promise((r) => setImmediate(r));
  assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(executions, 1);
});

test('redémarrage : les runs anciens au-delà de la liste UI sont tous interrompus', () => {
  const { store } = createApp({ dataDir: temporary() });
  const file = store.db.location();
  for (let i = 0; i < 205; i++)
    store.create({ id: 'FICTIF-' + i, state: 'running', budgetCents: 0 });
  store.close();
  // sqlite location() is absolute on the supported Node runtime.
  return import('../packages/storage/index.js').then(({ Store }) => {
    const reopened = new Store(file);
    try {
      assert.equal(reopened.get('FICTIF-0').state, 'interrupted');
    } finally {
      reopened.close();
    }
  });
});

test('reprise : refus si la définition durable a été modifiée', async (t) => {
  const app = await setup(t);
  const run = await app.engine.create({
    prompt: 'FICTIF',
    agent: 'fixture',
    pack: 'core',
    mode: 'workflow',
  });
  await until(app, run.id, ['completed', 'failed']);
  app.store.update(run.id, {
    state: 'interrupted',
    workflowDefinition: { ...run.workflowDefinition, title: 'MODIFIÉ FICTIF' },
  });
  await assert.rejects(app.engine.resumeWorkflow(run.id), /Définition.*modifiée/);
  assert.equal(app.engine.active.has(run.id), false);
});
