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

test('repli FICTIF : un seul événement public par run, motif sans URL privée', async (t) => {
  const { app, run, origin } = await setup(t);
  const url = origin + `/api/internal/browser-fallback/${run.id}`;
  for (let i = 0; i < 3; i++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        'x-relay-token': 'FICTIF-token',
      },
      body: JSON.stringify({
        reason: 'fetch failed at https://private.example/path?secret=FICTIF',
      }),
    });
    assert.equal(response.status, 200);
  }
  const events = app.store.events(run.id).filter((event) => event.type === 'browser_fallback');
  assert.equal(events.length, 1);
  assert.equal(events[0].data.run, run.id);
  assert.equal(events[0].data.connected, false);
  assert.doesNotMatch(JSON.stringify(events[0].data), /private.example|secret=FICTIF/);
  const denied = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-platform-request': '1',
      'x-relay-token': 'bad',
    },
    body: '{}',
  });
  assert.notEqual(denied.status, 200);
});
