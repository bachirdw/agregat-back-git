import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';

test('outil ACP sans mise à jour : tour annulé, cause visible et reprise possible', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'tool-stall-FICTIF-')));
  const cancelFile = join(root, 'cancel-observed');
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  app.engine.careerTimeoutMs = 5000;
  app.engine.toolIdleMs = 100;
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'Outil FICTIF bloqué',
    model: '',
    mode: 'agent',
    budgetCents: 0,
    workspace: 'career-ops',
  };
  app.store.create({ ...run, prompt: 'Mission privée dans l’espace de candidature' });
  const plan = {
    simulated: true,
    skills: [],
    agent: {
      id: 'fixture',
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify({ stallTool: true, cancelFile, loadSession: true }) },
    },
    pack: { id: 'career-ops', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  try {
    await app.engine.execute(run, plan, control, null);
    const done = app.store.get(run.id);
    assert.equal(done.state, 'failed');
    assert.match(done.error, /Outil.*sans mise à jour/, JSON.stringify(app.store.events(run.id)));
    assert.equal(done.resumable, true);
    assert.equal(existsSync(cancelFile), true, 'session/cancel livré au faux agent');
    assert.ok(app.store.events(run.id).some((event) => event.type === 'tool_stalled'));
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});
