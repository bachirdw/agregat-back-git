import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { installGlobalGuards } from '../packages/agent-runtime/guards.js';

test('rejection non rattrapée : journalisée redactée, serveur non arrêté', () => {
  const target = new EventEmitter();
  const lines = [];
  let exited = null;
  let closed = 0;
  process.env.RELAY_TEST_SECRET_TOKEN = 'valeur-secrete-xyz-123456';
  installGlobalGuards({
    target,
    close: async () => closed++,
    log: (l) => lines.push(l),
    exit: (c) => (exited = c),
  });
  target.emit('unhandledRejection', new Error('boom valeur-secrete-xyz-123456'));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /unhandledRejection/);
  assert.ok(!lines[0].includes('valeur-secrete-xyz-123456'));
  assert.equal(exited, null);
  assert.equal(closed, 0);
  delete process.env.RELAY_TEST_SECRET_TOKEN;
});

test('exception non rattrapée : moteur fermé puis sortie, même si la fermeture est figée', async () => {
  const target = new EventEmitter();
  const codes = [];
  installGlobalGuards({
    target,
    close: () => new Promise(() => {}),
    log: () => {},
    exit: (c) => codes.push(c),
    closeTimeoutMs: 50,
  });
  target.emit('uncaughtException', new Error('x'));
  target.emit('uncaughtException', new Error('y'));
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(codes, [1]);
});

test('délais : la garde attend plus longtemps que le nettoyage forcé de l’orchestrateur (constat 10)', async () => {
  const { guardCloseTimeoutMs } = await import('../packages/agent-runtime/guards.js');
  const { createApp } = await import('../apps/api/server.js');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const saved = process.env.AGENT_PLATFORM_CLOSE_MS;
  try {
    for (const value of [undefined, '30000']) {
      if (value === undefined) delete process.env.AGENT_PLATFORM_CLOSE_MS;
      else process.env.AGENT_PLATFORM_CLOSE_MS = value;
      const app = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'relay-guards-')) });
      try {
        assert.ok(
          guardCloseTimeoutMs(process.env) >= app.engine.closeTimeoutMs + 2000,
          `garde ${guardCloseTimeoutMs(process.env)} ms, moteur ${app.engine.closeTimeoutMs} ms`,
        );
      } finally {
        await app.close();
      }
    }
  } finally {
    if (saved === undefined) delete process.env.AGENT_PLATFORM_CLOSE_MS;
    else process.env.AGENT_PLATFORM_CLOSE_MS = saved;
  }
});
