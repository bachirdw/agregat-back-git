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

async function askThroughRuntime(answerWith) {
  const root = mkdtempSync(join(tmpdir(), 'elicitation-FICTIF-'));
  const answerFile = join(root, 'answer.json');
  const asked = [];
  let text = '';
  const runtime = new AcpRuntime({
    definition: {
      id: 'fake',
      name: 'Fake',
      command: process.execPath,
      args: [FAKE],
      env: ['FAKE_ACP'],
      safeModes: [],
    },
    cwd: root,
    env: { ...process.env, FAKE_ACP: JSON.stringify({ askQuestion: true, answerFile }) },
    timeouts: { initialize: 3000, session: 3000, request: 3000, prompt: 5000 },
    onEvent: (u) => {
      if (u.sessionUpdate === 'agent_message_chunk') text += u.content.text;
    },
    onElicitation: async (params) => {
      asked.push(params);
      return answerWith;
    },
  });
  try {
    await runtime.start();
    await runtime.session([]);
    await runtime.prompt('Bonjour');
    return { asked, text, answer: JSON.parse(readFileSync(answerFile, 'utf8')) };
  } finally {
    runtime.close();
    rmSync(root, { recursive: true, force: true });
  }
}

test('le faux agent pose une question de formulaire et cite la réponse acceptée', async () => {
  const out = await askThroughRuntime({
    action: 'accept',
    content: { reponse: 'oui, enregistre' },
  });
  assert.equal(out.asked.length, 1);
  assert.equal(out.asked[0].mode, 'form');
  assert.equal(out.asked[0].requestedSchema.properties.reponse.type, 'string');
  assert.deepEqual(out.answer, { action: 'accept', content: { reponse: 'oui, enregistre' } });
  assert.match(out.text, /oui, enregistre/);
});

test('le faux agent termine en disant que la question est déclinée ou annulée', async () => {
  const declined = await askThroughRuntime({ action: 'decline' });
  assert.equal(declined.answer.action, 'decline');
  assert.match(declined.text, /déclinée/);
  const cancelled = await askThroughRuntime({ action: 'cancel' });
  assert.equal(cancelled.answer.action, 'cancel');
  assert.match(cancelled.text, /annulée/);
});
