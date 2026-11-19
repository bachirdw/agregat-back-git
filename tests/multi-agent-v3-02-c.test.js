// multi-agent-v3-02 (C) : le moteur de workflow donne aussi le modèle choisi à la création de la
// session de l'étape (comme demarrage-01 pour une mission, E141, E142), quand le profil déclare
// `modelEnv` ; l'appel selectModel reste le filet. Faux agent ACP (tests/fixtures/modele-acp.js)
// dont la requête de modèle ne répond jamais ; aucun CLI réel, aucun modèle. Textes FICTIFS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { executeWorkflow } from '../packages/orchestrator/workflow-run.js';

const MODELE = resolve('tests/fixtures/modele-acp.js');
const MODEL_ENV = 'MODELE_ACP_MODELE_FICTIF';
const temporary = (t, prefix) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

async function workflowStep(t, { model }) {
  const app = createApp({ dataDir: temporary(t, 'mav3-02-c-data-FICTIF-') });
  t.after(() => app.close());
  const root = temporary(t, 'mav3-02-c-FICTIF-');
  const run = {
    id: crypto.randomUUID(),
    state: 'running',
    cwd: root,
    prompt: 'Une tâche FICTIVE.',
    model,
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    agent: {
      id: 'modele-fictif',
      command: process.execPath,
      args: [MODELE],
      env: [],
      safeModes: ['default'],
      modelEnv: MODEL_ENV,
      fixedEnv: { MODELE_ACP: JSON.stringify({ dir: root, modelEnv: MODEL_ENV, hangModel: true }) },
    },
    pack: { id: 'core' },
    skills: [],
    dag: {
      id: 'fictif',
      title: 'FICTIF',
      steps: [{ id: 'etape', title: 'FICTIF', kind: 'agent', prompt: 'Une étape FICTIVE.' }],
    },
  };
  const control = { abort: new AbortController() };
  app.engine.active.set(run.id, control);
  await executeWorkflow(app.engine, run, plan, control).catch(() => {});
  const step = app.engine.workflows.steps(run.id).find((s) => s.step_id === 'etape');
  const calls = existsSync(join(root, 'calls.json')) ? readJson(join(root, 'calls.json')) : [];
  return {
    step,
    env: readJson(join(root, 'env.json')),
    configCalls: calls.filter((c) => c.method === 'session/set_config_option'),
    session: app.store.events(run.id).find((e) => e.type === 'session'),
  };
}

test('C. étape agent d’un workflow : modèle donné à la création, aucune requête de modèle, étape réussie', async (t) => {
  const r = await workflowStep(t, { model: 'modele-b' });
  assert.deepEqual(r.env, { present: true, value: 'modele-b' });
  assert.deepEqual(r.configCalls, []);
  assert.equal(r.session.data.models.current, 'modele-b');
  assert.equal(r.step.state, 'succeeded', JSON.stringify(r.step));
});

test('C. contrôle : aucun modèle demandé, la variable n’est pas posée', async (t) => {
  const r = await workflowStep(t, { model: '' });
  assert.equal(r.env.present, false);
  assert.deepEqual(r.configCalls, []);
});
