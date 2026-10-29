import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';

async function runFixture(t, { previous = null, config = {}, browserWorkflow = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'fix-resume-FICTIF-'));
  const app = createApp({ dataDir: root, ownerMode: true });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'Montre les liens FICTIFS',
    model: '',
    mode: 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    simulated: true,
    skills: [],
    browserWorkflow,
    agent: {
      id: 'fixture',
      simulated: true,
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify({ loadSession: true, ...config }) },
    },
    pack: { id: 'core', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  await app.engine.execute(run, plan, control, previous);
  return app.store.get(run.id);
}

const answer = { simulated: true, summary: 'Voici cinq liens FICTIFS.', evidence: [] };

test('reprise ACP : outils navigateur rejoués, réponse sans navigation acceptée', async (t) => {
  const done = await runFixture(t, {
    previous: { sessionId: 'fake-session-1' },
    config: { replayOnLoad: true, replayBrowserToolOnLoad: true, result: answer },
  });
  assert.equal(done.state, 'completed', done.error);
  assert.match(done.result.summary, /réponse sans nouvelle navigation/i);
  assert.match(done.result.summary, /cinq liens FICTIFS/);
  assert.deepEqual(done.result.evidence, []);
});

test('reprise ACP : nouvel appel navigateur sans preuve reste refusé', async (t) => {
  const done = await runFixture(t, {
    previous: { sessionId: 'fake-session-1' },
    config: { promptBrowserTool: 'browser.navigate', result: answer },
  });
  assert.equal(done.state, 'failed');
  assert.match(done.error, /Navigation non prouvée/);
});

test('nouvelle mission navigateur sans navigation reste refusée', async (t) => {
  const done = await runFixture(t, { config: { result: answer } });
  assert.equal(done.state, 'failed');
  assert.match(done.error, /Navigation non prouvée/);
});

test('résumé vide : le texte final utile de l’agent est repris et borné', async (t) => {
  const done = await runFixture(t, {
    browserWorkflow: false,
    config: {
      eventText: `Voici les liens FICTIFS. ${'détail '.repeat(500)}`,
      result: { ...answer, summary: '' },
    },
  });
  assert.equal(done.state, 'completed', done.error);
  assert.match(done.result.summary, /^Voici les liens FICTIFS/);
  assert.ok(done.result.summary.length <= 2000);
});
