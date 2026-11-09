import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';

test('arrêt : une mission qui ignore l’abandon n’empêche pas close() d’aboutir, elle passe interrupted', async () => {
  const app = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'relay-arret-')) });
  app.engine.closeTimeoutMs = 150;
  const run = {
    id: randomUUID(),
    state: 'running',
    cwd: tmpdir(),
    prompt: 'F',
    model: '',
    budgetCents: 0,
  };
  app.store.create(run);
  // Mission « bloquée » : personne ne retire jamais son entrée de `active`.
  app.engine.active.set(run.id, { abort: new AbortController() });
  const started = Date.now();
  await Promise.race([
    app.engine.close(),
    new Promise((_, no) => setTimeout(() => no(new Error('close() bloqué')), 5000)),
  ]);
  assert.ok(Date.now() - started < 4000);
  assert.equal(app.engine.active.size, 0);
  assert.equal(app.store.get(run.id).state, 'interrupted');
  await app.close();
});
