// Fixtures FICTIVES ; aucun modèle ni service externe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { AcpRuntime } from '../packages/agent-runtime/index.js';

function setup(t, config = {}) {
  const root = mkdtempSync(join(tmpdir(), 'astra-runtime-FICTIF-'));
  const events = [];
  const runtime = new AcpRuntime({
    cwd: root,
    timeouts: { prompt: 2000 },
    definition: {
      id: 'fixture',
      simulated: true,
      command: process.execPath,
      args: [resolve('tests/fixtures/astra-acp.js')],
      env: [],
      fixedEnv: { FAKE_ACP: JSON.stringify(config) },
    },
    onEvent: (update) => events.push(update),
  });
  t.after(async () => {
    await runtime.close();
    rmSync(root, { recursive: true, force: true });
  });
  return { runtime, events };
}
test('load sans frontière causale refusé avant tout rejeu, session neuve possible', async (t) => {
  const { runtime, events } = setup(t);
  await runtime.start();
  await assert.rejects(runtime.session([], 'FICTIF-old'), { code: 'replay_unqualified' });
  await runtime.session([]);
  await runtime.prompt('{}');
  await assert.rejects(runtime.prompt('{}'), /Session non prête/);
  assert.equal(events.filter((e) => e.sessionUpdate === 'tool_call').length, 0);
  const report = JSON.parse(
    events.find((e) => e.sessionUpdate === 'agent_message_chunk').content.text,
  );
  assert.deepEqual(report.calls, ['session/new', 'session/prompt']);
});
test('notifications hors tour, étrangères et après annulation ignorées', async (t) => {
  const { runtime, events } = setup(t, { foreign: true });
  await runtime.start();
  await runtime.session([]);
  runtime.handleUpdate({ sessionUpdate: 'tool_call', toolCallId: 'FICTIF-before' });
  await runtime.prompt('{}');
  runtime.handleUpdate({ sessionUpdate: 'tool_call', toolCallId: 'FICTIF-after' });
  runtime.cancel();
  runtime.handleUpdate({ sessionUpdate: 'tool_call', toolCallId: 'FICTIF-cancelled' });
  assert.deepEqual(
    events.filter((e) => e.sessionUpdate === 'tool_call'),
    [],
  );
});
