// Regressions de revue : tous les agents et résultats sont FICTIFS, aucun modèle appelé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { executeWorkflow } from '../packages/orchestrator/workflow-run.js';

async function fixture(t, config = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'relay-review-'));
  const app = createApp({ dataDir: dir, ownerMode: false });
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const run = {
    id: crypto.randomUUID(),
    state: 'running',
    cwd: dir,
    prompt: 'FICTIF',
    model: '',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    agent: {
      id: 'fixture',
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      simulated: true,
      env: [],
      safeModes: [],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({
          result: { simulated: true, summary: 'FICTIF', evidence: [] },
          ...config,
        }),
      },
    },
    pack: { id: 'core' },
    skills: [],
    dag: {
      id: 'fictif',
      title: 'FICTIF',
      steps: [
        { id: 'analysis', title: 'FICTIF', kind: 'agent', prompt: 'FICTIF' },
        { id: 'verify', title: 'FICTIF', kind: 'verify', dependsOn: ['analysis'] },
        { id: 'report', title: 'FICTIF', kind: 'aggregate', dependsOn: ['verify'] },
      ],
    },
  };
  return { app, run, plan, control: { abort: new AbortController() } };
}

test('DAG : sortie ACP cumulée trop volumineuse arrêtée même si le JSON final est petit', async (t) => {
  const { app, run, plan, control } = await fixture(t, { chunkSize: 200000, chunkCount: 6 });
  await assert.rejects(executeWorkflow(app.engine, run, plan, control), /annulé/i);
  assert.match(control.abort.signal.reason.message, /Résultat trop volumineux/);
  assert.ok(!app.engine.workflows.steps(run.id).some((s) => s.state === 'running'));
});

test('DAG : excès de notifications ACP arrête le run au lieu de perdre silencieusement la suite', async (t) => {
  const { app, run, plan, control } = await fixture(t, { chunkSize: 1, chunkCount: 4001 });
  await assert.rejects(executeWorkflow(app.engine, run, plan, control), /annulé/i);
  assert.match(control.abort.signal.reason.message, /Trop d’événements/);
});

test('DAG : fragments proches des limites restent acceptés et donnent un résultat vérifié', async (t) => {
  for (const config of [
    { chunkSize: 199000, chunkCount: 5 },
    { chunkSize: 1, chunkCount: 3999 },
  ]) {
    const { app, run, plan, control } = await fixture(t, config);
    const result = await executeWorkflow(app.engine, run, plan, control);
    assert.equal(control.abort.signal.aborted, false);
    assert.equal(result.summary, 'FICTIF');
    assert.ok(app.engine.workflows.steps(run.id).every((s) => s.state === 'succeeded'));
  }
});

test('DAG : résultat final identique quand les étapes sont déclarées dans un autre ordre valide', async (t) => {
  const { app, run, plan, control } = await fixture(t);
  // Le DAG déclare le rapport avant ses dépendances ; cet ordre est valide.
  plan.dag.steps.reverse();
  const result = await executeWorkflow(app.engine, run, plan, control);
  const report = app.engine.workflows.row(run.id, 'report').output;
  assert.deepEqual(result, report);
  assert.ok(
    result.evidence.some((e) => e.verification === 'Structure seulement ; faits non vérifiés'),
  );
});
