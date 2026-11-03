// Données, agent et mission FICTIFS : aucun modèle, aucun réseau, aucun envoi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { terminal } from '../packages/storage/index.js';

const temporary = () => mkdtempSync(join(tmpdir(), 'relay-decision-FICTIF-'));

async function setup(t) {
  const app = createApp({ dataDir: temporary() });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(() => app.close());
  return app;
}
const post = (app, path, body = {}) =>
  fetch(`http://127.0.0.1:${app.server.address().port}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
    body: JSON.stringify(body),
  }).then(async (r) => ({ status: r.status, data: await r.json() }));
async function waitFor(check, message, ms = 10000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = check();
    if (value) return value;
    assert.ok(Date.now() < end, message);
    await new Promise((r) => setTimeout(r, 20));
  }
}

// Une vraie mission : l'agent FICTIF reçoit le prompt puis échoue, l'étape devient incertaine,
// le propriétaire annule. La mission est terminale, sans moteur actif, et sa reprise est refusée
// (définition absente : même refus qu'après une modification du pack).
async function stoppedMission(app) {
  const run = {
    id: crypto.randomUUID(),
    state: 'queued',
    cwd: temporary(),
    prompt: 'Mission FICTIVE',
    model: '',
    mode: 'workflow',
    agent: 'fixture',
    pack: 'core',
    skills: [],
    browser: 'fixture',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    agent: {
      id: 'fictif-reel',
      name: 'Agent FICTIF',
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify({ errorText: 'Coupure FICTIVE après le prompt' }) },
    },
    pack: { id: 'core' },
    skills: [],
    dag: {
      id: 'fictif',
      title: 'FICTIF',
      steps: [
        { id: 'action', title: 'Action FICTIVE', kind: 'agent', prompt: 'FICTIF' },
        { id: 'report', title: 'Rapport FICTIF', kind: 'aggregate', dependsOn: ['action'] },
      ],
    },
  };
  const control = { abort: new AbortController() };
  app.engine.active.set(run.id, control);
  const pending = app.engine.execute(run, plan, control, null);
  await waitFor(
    () => app.engine.workflows.row(run.id, 'action')?.state === 'uncertain',
    'l’étape FICTIVE doit devenir incertaine',
  );
  app.engine.cancel(run.id);
  await pending;
  assert.equal(app.store.get(run.id).state, 'cancelled');
  assert.equal(app.engine.active.has(run.id), false, 'plus aucun moteur actif');
  const resume = await post(app, `/runs/${run.id}/resume`);
  assert.equal(resume.status, 400);
  assert.match(resume.data.error, /reprise refusée/);
  assert.equal(app.engine.workflows.row(run.id, 'action').state, 'uncertain');
  return run;
}

test('mission terminée : « fait » appliqué à la seule étape incertaine, sans relancer le DAG', async (t) => {
  const app = await setup(t);
  const run = await stoppedMission(app);
  const before = app.engine.workflows.steps(run.id);
  const eventsBefore = app.store.events(run.id).length;
  const r = await post(app, `/runs/${run.id}/steps/action`, { action: 'done' });
  assert.equal(r.status, 200, r.data.error);
  const action = r.data.steps.find((s) => s.step_id === 'action');
  assert.equal(action.state, 'succeeded');
  assert.deepEqual(action.output, { confirmedByUser: true });
  assert.equal(action.attempt, before.find((s) => s.step_id === 'action').attempt, 'non rejouée');
  // Seule la décision change l'état : le reste du DAG et la mission ne bougent pas.
  const report = r.data.steps.find((s) => s.step_id === 'report');
  assert.deepEqual(
    report,
    before.find((s) => s.step_id === 'report'),
  );
  assert.equal(app.store.get(run.id).state, 'cancelled');
  assert.equal(app.engine.active.has(run.id), false, 'aucun moteur relancé');
  const added = app.store.events(run.id).slice(eventsBefore);
  assert.deepEqual(
    added.map((e) => [e.type, e.data.stepId, e.data.state]),
    [['step', 'action', 'succeeded']],
  );
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(app.store.events(run.id).length, eventsBefore + 1, 'rien ne s’exécute ensuite');
});

test('mission terminée : « échec » appliqué, l’erreur d’origine reste lisible', async (t) => {
  const app = await setup(t);
  const run = await stoppedMission(app);
  const r = await post(app, `/runs/${run.id}/steps/action`, { action: 'fail' });
  assert.equal(r.status, 200, r.data.error);
  const action = r.data.steps.find((s) => s.step_id === 'action');
  assert.equal(action.state, 'failed');
  assert.match(action.error, /^Marquée en échec par l’utilisateur : /);
  assert.equal(app.store.get(run.id).state, 'cancelled');
  assert.equal(app.engine.active.has(run.id), false);
  // Une seconde décision n'a plus d'étape incertaine à résoudre.
  const again = await post(app, `/runs/${run.id}/steps/action`, { action: 'done' });
  assert.equal(again.status, 400);
  assert.match(again.data.error, /non incertaine/);
  assert.equal(app.engine.workflows.row(run.id, 'action').state, 'failed');
});

test('mission terminée : « relancer » exige une reprise, message clair, rien ne change', async (t) => {
  const app = await setup(t);
  const run = await stoppedMission(app);
  const before = app.engine.workflows.steps(run.id);
  const r = await post(app, `/runs/${run.id}/steps/action`, { action: 'retry' });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /exige de reprendre la mission/);
  assert.match(r.data.error, /sans reprise possible, la marquer faite ou en échec/);
  assert.deepEqual(app.engine.workflows.steps(run.id), before);
  assert.equal(app.store.get(run.id).state, 'cancelled');
  assert.equal(app.engine.active.has(run.id), false);
});

test('mission terminée : action inconnue, approbation ou étape absente toujours refusées', async (t) => {
  const app = await setup(t);
  const run = await stoppedMission(app);
  const before = app.engine.workflows.steps(run.id);
  for (const [step, body, expected] of [
    ['action', { action: 'ignore' }, /Action inconnue/],
    ['action', { approved: true }, /Workflow annulé ou inactif/],
    ['report', { action: 'done' }, /non incertaine/],
    ['absente', { action: 'done' }, /non incertaine/],
  ]) {
    const r = await post(app, `/runs/${run.id}/steps/${step}`, body);
    assert.equal(r.status, 400, `${step} ${JSON.stringify(body)}`);
    assert.match(r.data.error, expected);
  }
  assert.deepEqual(app.engine.workflows.steps(run.id), before);
  const unknown = await post(app, `/runs/${crypto.randomUUID()}/steps/action`, { action: 'done' });
  assert.equal(unknown.status, 400);
  assert.match(unknown.data.error, /Aucun workflow actif/);
});

test('mission active : la décision passe toujours par son moteur, qui reprend le DAG', async (t) => {
  const app = await setup(t);
  const run = {
    id: crypto.randomUUID(),
    state: 'queued',
    cwd: temporary(),
    prompt: 'Mission FICTIVE',
    model: '',
    mode: 'workflow',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    agent: {
      id: 'fictif-reel',
      name: 'Agent FICTIF',
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify({ errorText: 'Coupure FICTIVE après le prompt' }) },
    },
    pack: { id: 'core' },
    skills: [],
    dag: {
      id: 'fictif',
      title: 'FICTIF',
      steps: [
        { id: 'action', title: 'Action FICTIVE', kind: 'agent', prompt: 'FICTIF' },
        { id: 'report', title: 'Rapport FICTIF', kind: 'aggregate', dependsOn: ['action'] },
      ],
    },
  };
  const control = { abort: new AbortController() };
  app.engine.active.set(run.id, control);
  const pending = app.engine.execute(run, plan, control, null);
  await waitFor(
    () => app.engine.workflows.row(run.id, 'action')?.state === 'uncertain',
    'l’étape FICTIVE doit devenir incertaine',
  );
  const r = await post(app, `/runs/${run.id}/steps/action`, { action: 'done' });
  assert.equal(r.status, 200, r.data.error);
  await pending;
  const done = await waitFor(
    () => terminal.has(app.store.get(run.id).state) && app.store.get(run.id),
    'la mission doit se terminer',
  );
  assert.equal(done.state, 'completed', done.error);
  assert.equal(app.engine.workflows.row(run.id, 'report').state, 'succeeded');
});
