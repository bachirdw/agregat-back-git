import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';

async function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'fix-browser-FICTIF-'));
  const app = createApp({ dataDir: root, ownerMode: true });
  t.after(async () => {
    app.engine.active.clear();
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'FICTIF',
    model: '',
    mode: 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  app.engine.active.set(run.id, { abort: new AbortController(), runtime: null });
  app.engine.approvalTokens.set(run.id, 'FICTIF-token');
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  return { app, run, origin };
}

async function finishFixture(t, fallback) {
  const { app, run } = await setup(t);
  if (fallback)
    app.store.event(run.id, 'browser_fallback', {
      run: run.id,
      reason: 'Extension Playwriter indisponible',
      connected: false,
    });
  const plan = {
    simulated: true,
    skills: [],
    browserWorkflow: false,
    agent: {
      id: 'fixture',
      simulated: true,
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({
          result: { simulated: true, summary: 'Résumé FICTIF.', evidence: [] },
        }),
      },
    },
    pack: { id: 'core', workflow: { steps: [] } },
  };
  await app.engine.execute(run, plan, app.engine.active.get(run.id));
  return app.store.get(run.id);
}

test('résumé final FICTIF indique le profil isolé après repli', async (t) => {
  const done = await finishFixture(t, true);
  assert.equal(done.state, 'completed', done.error);
  assert.match(
    done.result.summary,
    /Navigateur : Chrome isolé, non connecté à vos comptes \(extension Playwriter indisponible\)\./,
  );
});

test('résumé final FICTIF sans repli ne mentionne pas Chrome isolé', async (t) => {
  const done = await finishFixture(t, false);
  assert.equal(done.state, 'completed', done.error);
  assert.equal(done.result.summary, 'Résumé FICTIF.');
});
