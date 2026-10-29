import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';

test('agent silencieux : avertissement, arrêt reprenable et diagnostic conservé', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'agent-silence-FICTIF-')));
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode: true });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  app.engine.careerTimeoutMs = 5000;
  app.engine.silentMs = 200;
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'Agent FICTIF silencieux',
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
      fixedEnv: {
        FAKE_ACP: JSON.stringify({
          mute: 'session/prompt',
          diagnosticText: 'Diagnostic Gemini FICTIF : attente outil\n',
          loadSession: true,
        }),
      },
    },
    pack: { id: 'career-ops', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  try {
    await app.engine.execute(run, plan, control, null);
    const done = app.store.get(run.id);
    assert.equal(done.state, 'failed');
    assert.match(done.error, /Agent inactif/);
    assert.match(done.result.summary, /Bilan\n- Actions réussies : aucune observée/);
    assert.match(done.result.summary, /Cause : Agent inactif depuis 1 s/);
    assert.equal(done.resumable, true);
    const events = app.store.events(run.id);
    assert.ok(events.some((event) => event.type === 'agent_silent'));
    assert.ok(
      events.some(
        (event) =>
          event.type === 'agent_diagnostic' && /Diagnostic Gemini FICTIF/.test(event.data.text),
      ),
    );
    assert.match(
      readFileSync(join(root, `relay/runs/${run.id}-diagnostic.txt`), 'utf8'),
      /Diagnostic Gemini FICTIF/,
    );
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('délai et annulation après début du tour gardent un Bilan et une cause privés', async () => {
  for (const mode of ['timeout', 'cancel']) {
    const root = realpathSync(mkdtempSync(join(tmpdir(), `agent-${mode}-FICTIF-`)));
    const career = new CareerWorkspace({ root, roots: [root] });
    const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode: true });
    await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
    app.engine.careerTimeoutMs = mode === 'timeout' ? 2000 : 5000;
    app.engine.silentMs = 5000;
    const run = {
      id: randomUUID(),
      state: 'queued',
      cwd: root,
      prompt: 'Annonce FICTIVE à lire',
      model: '',
      mode: 'agent',
      budgetCents: 0,
      workspace: 'career-ops',
    };
    app.store.create(run);
    const plan = {
      simulated: true,
      skills: [],
      agent: {
        id: 'fixture',
        command: process.execPath,
        args: [resolve('tests/fixtures/fake-acp.js')],
        env: [],
        safeModes: [],
        fixedEnv: { FAKE_ACP: JSON.stringify({ mute: 'session/prompt' }) },
      },
      pack: { id: 'career-ops', workflow: { steps: [] } },
    };
    const control = { abort: new AbortController(), runtime: null };
    app.engine.active.set(run.id, control);
    try {
      const task = app.engine.execute(run, plan, control, null);
      if (mode === 'cancel') {
        const deadline = Date.now() + 3000;
        while (!control.promptStarted && Date.now() < deadline)
          await new Promise((resolve) => setTimeout(resolve, 10));
        assert.equal(control.promptStarted, true, 'tour FICTIF démarré avant annulation');
        app.engine.cancel(run.id);
      }
      await task;
      const done = app.store.get(run.id);
      assert.equal(done.state, mode === 'timeout' ? 'failed' : 'cancelled');
      assert.match(done.result.summary, /Bilan\n- Actions réussies : aucune observée/);
      assert.match(
        done.result.summary,
        mode === 'timeout' ? /Cause : Délai maximal dépassé/ : /Cause : Annulée par l’utilisateur/,
      );
    } finally {
      await app.close();
      rmSync(root, { recursive: true, force: true });
    }
  }
});
