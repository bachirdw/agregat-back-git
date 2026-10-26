import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';

// Regression (seen live): an event emitted after the SSE stream ended crashed the whole server
// with ERR_STREAM_WRITE_AFTER_END.
test('SSE : un événement après la fin du flux ne fait pas planter le serveur', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sse-FICTIF-'));
  const app = createApp({ dataDir: dir });
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const id = randomUUID();
  app.store.create({
    id,
    createdAt: new Date().toISOString(),
    state: 'running',
    prompt: 'FICTIF',
    agent: 'fixture',
    pack: 'core',
    skills: [],
    model: '',
    budgetCents: 0,
    mode: 'agent',
    cwd: dir,
    simulated: true,
  });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const response = await fetch(
    `http://127.0.0.1:${app.server.address().port}/api/runs/${id}/events`,
  );
  const reader = response.body.getReader();
  await reader.read();
  app.store.update(id, { state: 'completed' });
  app.store.event(id, 'state', { state: 'completed' });
  app.store.event(id, 'permission', { finished: true, FICTIF: 'événement tardif' });
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += new TextDecoder().decode(value);
  }
  assert.match(text, /event: end/);
  assert.doesNotMatch(text, /événement tardif/);
  assert.equal(app.server.listening, true, 'serveur toujours en écoute');
});
