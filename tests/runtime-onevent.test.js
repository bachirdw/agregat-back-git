import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT } from '../packages/orchestrator/packs.js';
import { AcpRuntime } from '../packages/agent-runtime/index.js';

const FAKE = resolve(ROOT, 'tests/fixtures/fake-acp.js');
const fast = { initialize: 1500, session: 1500, request: 1500, prompt: 4000 };

function runtimeWith(onEvent, cfg = {}) {
  return new AcpRuntime({
    definition: {
      id: 'fake',
      name: 'Fake',
      command: process.execPath,
      args: [FAKE],
      env: ['FAKE_ACP'],
    },
    cwd: mkdtempSync(join(tmpdir(), 'relay-onevent-')),
    timeouts: fast,
    env: { ...process.env, FAKE_ACP: JSON.stringify(cfg) },
    onEvent,
  });
}

test('onEvent qui lève : pas de trace brute du SDK, mise à jour signalée, tour mené à terme', async () => {
  const nativeTools = [
    {
      sessionUpdate: 'tool_call',
      toolCallId: 't1',
      title: 'LireFichier',
      rawInput: { secret: 'CONTENU-BRUT-SECRET-42' },
    },
  ];
  const seen = [];
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args.map(String).join(' '));
  let first = true;
  const r = runtimeWith(
    (u) => {
      seen.push(u);
      if (first && u.sessionUpdate === 'tool_call') {
        first = false;
        throw new Error('Événement trop volumineux');
      }
    },
    { nativeTools },
  );
  try {
    await r.start();
    await r.session([]);
    await r.prompt('x');
    const dropped = seen.find((u) => u.sessionUpdate === 'platform_event_dropped');
    assert.ok(dropped, 'la mission doit être informée de la mise à jour perdue');
    assert.match(dropped.error, /trop volumineux/);
    assert.equal(dropped.originalType, 'tool_call');
    assert.ok(!JSON.stringify(dropped).includes('CONTENU-BRUT-SECRET-42'));
    assert.ok(
      !logged.join('\n').includes('CONTENU-BRUT-SECRET-42'),
      'le message brut ne doit pas partir dans la console',
    );
    assert.ok(logged.some((l) => /agent_event_dropped/.test(l)));
  } finally {
    console.error = originalError;
    r.close();
  }
});

test('message ACP de 3 Mio (capture base64) : la connexion reste ouverte', async () => {
  const nativeTools = [
    {
      sessionUpdate: 'tool_call_update',
      toolCallId: 't1',
      status: 'completed',
      padBytes: 3 * 1024 * 1024,
    },
  ];
  let received = 0;
  const r = runtimeWith(
    (u) => {
      if (u.sessionUpdate === 'tool_call_update') received = JSON.stringify(u).length;
    },
    { nativeTools },
  );
  try {
    await r.start();
    await r.session([]);
    await r.prompt('x');
    assert.ok(received > 3 * 1024 * 1024);
  } finally {
    r.close();
  }
});
