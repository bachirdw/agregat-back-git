// Tours FICTIFS de bout en bout : aucun modèle ni service externe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';

async function setup(t, { config = {}, workflow = false, astra = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'astra-turn-FICTIF-'));
  const app = createApp({ dataDir: root, ownerMode: true, silentMs: 300 });
  app.engine.toolIdleMs = 80;
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'FICTIF',
    model: '',
    mode: workflow ? 'workflow' : 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    simulated: true,
    skills: [],
    pack: { id: 'core', workflow: { steps: [] } },
    agent: {
      id: 'fixture',
      simulated: true,
      command: process.execPath,
      args: [resolve(astra ? 'tests/fixtures/astra-acp.js' : 'tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify(config) },
    },
    dag: {
      id: 'fictif',
      title: 'FICTIF',
      steps: [{ id: 'agent', title: 'FICTIF', kind: 'agent', prompt: 'FICTIF' }],
    },
  };
  const control = { abort: new AbortController() };
  app.engine.active.set(run.id, control);
  return { app, run, plan, control };
}
test('reprise vers session neuve : contexte non fiable, zéro historique mesuré, doublon compté une fois', async (t) => {
  const { app, run, plan, control } = await setup(t, {
    astra: true,
    config: { duplicates: true, foreign: true },
  });
  const previous = {
    id: randomUUID(),
    sessionId: 'FICTIF-old',
    state: 'completed',
    result: { summary: 'Contexte FICTIF antérieur' },
  };
  await app.engine.execute(run, plan, control, previous);
  const done = app.store.get(run.id);
  assert.equal(done.state, 'completed', done.error);
  assert.deepEqual(done.result.calls, ['session/new', 'session/prompt']);
  assert.equal(done.result.checkpoint.previousAnswer, previous.result.summary);
  assert.equal(done.result.checkpoint.untrusted, true);
  assert.equal(done.result.checkpoint.effects, 'unverified');
  assert.match(done.result.summary, /session neuve depuis un point de reprise/);
  assert.equal(
    app.store.usage(run.id).entries.filter((e) => e.dimension === 'tool_observed').length,
    1,
  );
});
for (const [kind, config] of [
  ['agent_silent', { mute: 'session/prompt' }],
  ['tool_stalled', { stallTool: true }],
]) {
  test(`DAG : garde ${kind}, processus libéré et tentative non rejouée`, async (t) => {
    const { app, run, plan, control } = await setup(t, { workflow: true, config });
    await app.engine.execute(run, plan, control, null);
    assert.ok(app.store.events(run.id).some((e) => e.type === kind));
    const row = app.engine.workflows.row(run.id, 'agent');
    assert.equal(row.state, 'uncertain');
    assert.equal(row.attempt, 1);
    assert.equal(app.engine.attemptTokens.size, 0);
  });
}
test('DAG : outil navigateur déclaré sans observation ne certifie pas un résultat', async (t) => {
  const { app, run, plan, control } = await setup(t, {
    workflow: true,
    config: {
      promptBrowserTool: 'browser.navigate',
      result: { simulated: true, summary: 'Tout lu FICTIF', evidence: [] },
    },
  });
  const pending = app.engine.execute(run, plan, control, null);
  const until = Date.now() + 3000;
  while (app.engine.workflows.row(run.id, 'agent')?.state !== 'uncertain') {
    assert.ok(Date.now() < until, 'refus de preuve attendu');
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.match(app.engine.workflows.row(run.id, 'agent').error, /Navigation non prouvée/);
  control.engine.resolveUncertain(run.id, 'agent', 'fail');
  await pending;
  assert.equal(app.store.get(run.id).state, 'failed');
  assert.equal(app.engine.attemptTokens.size, 0);
});
