// Toutes les données et tous les exécuteurs de ce fichier sont FICTIFS.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../packages/storage/index.js';
import { WorkflowEngine, validateWorkflow } from '../packages/workflow-engine/index.js';

const workflow = (extra = {}) => ({
  id: 'fictif',
  title: 'FICTIF',
  steps: [{ id: 'action', title: 'Action FICTIVE', kind: 'agent', prompt: 'FICTIF', ...extra }],
});
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'astra-workflow-FICTIF-'));
  const store = new Store(join(root, 'db'));
  store.create({ id: 'run', state: 'running', budgetCents: 0 });
  t.after(() => {
    store.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { store, engine: new WorkflowEngine({ store }) };
}

test('effet non déclaré : inconnu, jamais présumé lecture', () => {
  assert.equal(validateWorkflow(workflow()).steps[0].effect, 'unknown');
});
for (const extra of [{}, { effect: 'read' }, { effect: 'write' }]) {
  test(`agent interrompu ${JSON.stringify(extra)} : pas de reprise aveugle`, (t) => {
    const { engine } = setup(t);
    const wf = workflow(extra);
    engine.init('run', wf);
    engine.set('run', 'action', { state: 'running', attempt: 1 });
    engine.recover('run', wf, { retryFailed: true });
    assert.equal(engine.row('run', 'action').state, 'uncertain');
    engine.recover('run', wf, { retryFailed: true });
    assert.equal(engine.row('run', 'action').state, 'uncertain');
  });
}
for (const state of ['failed', 'cancelled']) {
  test(`agent ${state}, même déclaré read : reprise explicite conserve l'incertitude`, (t) => {
    const { engine } = setup(t);
    const wf = workflow({ effect: 'read' });
    engine.init('run', wf);
    engine.set('run', 'action', { state, attempt: 1 });
    engine.recover('run', wf, { retryFailed: true });
    assert.equal(engine.row('run', 'action').state, 'uncertain');
  });
}
test('annuler un effet déjà incertain ne permet pas de le rejouer ensuite', async (t) => {
  const { engine } = setup(t);
  const wf = workflow();
  engine.init('run', wf);
  engine.set('run', 'action', { state: 'uncertain', attempt: 1 });
  await engine.drive('run', wf, {}, AbortSignal.abort());
  assert.equal(engine.row('run', 'action').state, 'uncertain');
  engine.recover('run', wf, { retryFailed: true });
  assert.equal(engine.row('run', 'action').state, 'uncertain');
});
test('outil sans qualification interrompu : incertain ; lecture explicite rejouable', (t) => {
  const { engine } = setup(t);
  const wf = workflow({ kind: 'tool', prompt: undefined, tool: 'fictif' });
  engine.init('run', wf);
  engine.set('run', 'action', { state: 'running', attempt: 1 });
  engine.recover('run', wf);
  assert.equal(engine.row('run', 'action').state, 'uncertain');
});
