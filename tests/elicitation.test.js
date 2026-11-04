import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AcpRuntime } from '../packages/agent-runtime/index.js';

const FAKE = resolve('tests/fixtures/fake-acp.js');

test('initialize annonce elicitation.form (et pas url)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'elicitation-FICTIF-'));
  const capsFile = join(root, 'caps.json');
  const runtime = new AcpRuntime({
    definition: {
      id: 'fake',
      name: 'Fake',
      command: process.execPath,
      args: [FAKE],
      env: ['FAKE_ACP'],
    },
    cwd: root,
    env: { ...process.env, FAKE_ACP: JSON.stringify({ capsFile }) },
    timeouts: { initialize: 3000, session: 3000, request: 3000, prompt: 3000 },
  });
  try {
    await runtime.start();
    const caps = JSON.parse(readFileSync(capsFile, 'utf8'));
    assert.deepEqual(caps.elicitation, { form: {} });
    assert.equal(caps.elicitation.url, undefined);
  } finally {
    runtime.close();
    rmSync(root, { recursive: true, force: true });
  }
});
