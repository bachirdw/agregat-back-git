import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { AcpRuntime } from '../packages/agent-runtime/index.js';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';

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

// ---- Orchestrateur : état awaiting_owner, réponse, annulation, délais suspendus ----

async function startMission(extraCfg = {}, { toolIdleMs, silentMs, missionMs } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'elicitation-FICTIF-')));
  const files = { answerFile: join(root, 'answer.json'), cancelFile: join(root, 'cancel') };
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  if (toolIdleMs) app.engine.toolIdleMs = toolIdleMs;
  if (silentMs) app.engine.silentMs = silentMs;
  if (missionMs) app.engine.timeoutMs = missionMs;
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'Ouvre cette offre FICTIVE puis demande-moi QUESTION: dois-je l’enregistrer ?',
    model: '',
    mode: 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    simulated: true,
    skills: [],
    skillSelection: [],
    agent: {
      id: 'fixture',
      command: process.execPath,
      args: [FAKE],
      env: [],
      safeModes: [],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({ askQuestion: true, ...files, ...extraCfg }),
      },
    },
    pack: { id: 'core', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  const done = app.engine.execute(run, plan, control, null);
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const api = async (path, body) => {
    const res = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  const waitFor = async (check, ms = 5000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const value = check();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('Attente dépassée : ' + JSON.stringify(app.store.get(run.id)));
  };
  const finish = async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  };
  return { app, run, files, control, done, api, waitFor, finish };
}

test('question ouverte : awaiting_owner, événement question, pendingQuestion exposé par l’API', async () => {
  const m = await startMission();
  try {
    await m.waitFor(() => m.app.store.get(m.run.id).state === 'awaiting_owner');
    const row = m.app.store.get(m.run.id);
    assert.equal(row.pendingQuestion.message, 'Dois-je enregistrer cette offre ?');
    assert.equal(row.pendingQuestion.requestedSchema.properties.reponse.type, 'string');
    assert.equal(row.pendingQuestion.toolCallId, 'FICTIF-ask');
    assert.equal(row.resumable, false);
    const events = m.app.store.events(m.run.id);
    assert.equal(events.filter((e) => e.type === 'question').length, 1);
    const read = await m.api(`/api/runs/${m.run.id}`);
    assert.equal(read.body.state, 'awaiting_owner');
    assert.equal(read.body.pendingQuestion.id, row.pendingQuestion.id);
    m.app.engine.cancel(m.run.id);
    await m.done;
  } finally {
    await m.finish();
  }
});

test('réponse acceptée : l’agent poursuit dans la même session, état completed, pendingQuestion effacé', async () => {
  const m = await startMission();
  try {
    await m.waitFor(() => m.app.store.get(m.run.id).state === 'awaiting_owner');
    m.app.engine.answer(m.run.id, { action: 'accept', content: { reponse: 'oui, enregistre' } });
    assert.equal(m.app.store.get(m.run.id).state, 'running');
    assert.equal(m.app.store.get(m.run.id).pendingQuestion, null);
    await m.done;
    const done = m.app.store.get(m.run.id);
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.equal(done.pendingQuestion, null);
    assert.match(done.result.summary, /oui, enregistre/);
    assert.equal(done.resumable, true);
    const answer = m.app.store.events(m.run.id).find((e) => e.type === 'answer');
    assert.deepEqual(answer.data.content, { reponse: 'oui, enregistre' });
    assert.equal(answer.data.action, 'accept');
  } finally {
    await m.finish();
  }
});

test('réponse déclinée : l’agent est prévenu et termine', async () => {
  const m = await startMission();
  try {
    await m.waitFor(() => m.app.store.get(m.run.id).state === 'awaiting_owner');
    m.app.engine.answer(m.run.id, { action: 'decline' });
    await m.done;
    const done = m.app.store.get(m.run.id);
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.match(done.result.summary, /déclinée/);
    assert.equal(JSON.parse(readFileSync(m.files.answerFile, 'utf8')).action, 'decline');
  } finally {
    await m.finish();
  }
});

test('annulation de la mission pendant la question : l’agent reçoit cancel, état cancelled', async () => {
  const m = await startMission();
  try {
    await m.waitFor(() => m.app.store.get(m.run.id).state === 'awaiting_owner');
    m.app.engine.cancel(m.run.id);
    await m.done;
    const done = m.app.store.get(m.run.id);
    assert.equal(done.state, 'cancelled', JSON.stringify(done));
    assert.equal(done.pendingQuestion, null);
    await m.waitFor(() => existsSync(m.files.answerFile));
    assert.equal(JSON.parse(readFileSync(m.files.answerFile, 'utf8')).action, 'cancel');
  } finally {
    await m.finish();
  }
});

test('délais d’outil, de silence et de mission suspendus tant que la question est ouverte', async () => {
  const m = await startMission(
    { askQuestion: { toolBefore: true } },
    { toolIdleMs: 300, silentMs: 300, missionMs: 2500 },
  );
  try {
    await m.waitFor(() => m.app.store.get(m.run.id).state === 'awaiting_owner');
    await new Promise((r) => setTimeout(r, 3000)); // 10 x le délai d’outil, plus que la mission
    assert.equal(m.app.store.get(m.run.id).state, 'awaiting_owner');
    const quiet = m.app.store.events(m.run.id).map((e) => e.type);
    assert.ok(!quiet.includes('tool_stalled'), 'pas de « sans mise à jour » pendant l’attente');
    assert.ok(!quiet.includes('agent_silent'), 'pas de silence pendant l’attente');
    m.app.engine.answer(m.run.id, { action: 'accept', content: { reponse: 'ok' } });
    await m.done;
    const done = m.app.store.get(m.run.id);
    assert.equal(done.state, 'completed', JSON.stringify(done));
  } finally {
    await m.finish();
  }
});

test('plusieurs questions : file FIFO, une seule ouverte à la fois', async () => {
  const m = await startMission();
  try {
    await m.waitFor(() => m.app.store.get(m.run.id).state === 'awaiting_owner');
    const first = m.app.store.get(m.run.id).pendingQuestion;
    const second = m.app.engine.elicit(
      m.run.id,
      { message: 'Seconde question', requestedSchema: { type: 'object', properties: {} } },
      m.control,
    );
    assert.equal(m.app.store.get(m.run.id).pendingQuestion.id, first.id);
    m.app.engine.answer(m.run.id, { action: 'accept', content: { reponse: 'un' } });
    const next = m.app.store.get(m.run.id);
    assert.equal(next.state, 'awaiting_owner');
    assert.equal(next.pendingQuestion.message, 'Seconde question');
    m.app.engine.answer(m.run.id, { action: 'accept', content: {} });
    assert.deepEqual(await second, { action: 'accept', content: {} });
    await m.done;
    assert.equal(m.app.store.get(m.run.id).state, 'completed');
  } finally {
    await m.finish();
  }
});

test('POST /answer : 409 sans question, 400 si le contenu viole le schéma, 200 sinon', async () => {
  const m = await startMission({
    askQuestion: {
      requestedSchema: {
        type: 'object',
        properties: {
          choix: {
            type: 'string',
            oneOf: [
              { const: 'oui', title: 'Oui' },
              { const: 'non', title: 'Non' },
            ],
          },
          note: { type: 'string', maxLength: 10 },
        },
        required: ['choix'],
      },
    },
  });
  try {
    // Mission inconnue : 404.
    const none = await m.api(`/api/runs/${randomUUID()}/answer`, { action: 'decline' });
    assert.equal(none.status, 404);
    await m.waitFor(() => m.app.store.get(m.run.id).state === 'awaiting_owner');
    const url = `/api/runs/${m.run.id}/answer`;
    for (const bad of [
      { action: 'accept', content: { choix: 'peut-être' } },
      { action: 'accept', content: {} },
      { action: 'accept', content: { choix: 'oui', note: 'trop long pour la limite' } },
      { action: 'accept', content: { choix: 'oui', inconnu: 1 } },
      { action: 'accept', content: 'oui' },
      { action: 'bizarre' },
    ]) {
      const res = await m.api(url, bad);
      assert.equal(res.status, 400, JSON.stringify(bad));
      assert.ok(res.body.error);
    }
    assert.equal(m.app.store.get(m.run.id).state, 'awaiting_owner', 'toujours ouverte');
    const ok = await m.api(url, { action: 'accept', content: { choix: 'oui' } });
    assert.deepEqual(ok, { status: 200, body: { ok: true } });
    await m.done;
    const done = m.app.store.get(m.run.id);
    assert.equal(done.state, 'completed');
    assert.match(done.result.summary, /"choix":"oui"/);
    assert.equal(done.pendingQuestion, null);
    const again = await m.api(url, { action: 'decline' });
    assert.equal(again.status, 409);
  } finally {
    await m.finish();
  }
});

test('POST /answer decline via l’API', async () => {
  const m = await startMission();
  try {
    await m.waitFor(() => m.app.store.get(m.run.id).state === 'awaiting_owner');
    const res = await m.api(`/api/runs/${m.run.id}/answer`, { action: 'decline' });
    assert.equal(res.status, 200);
    await m.done;
    assert.match(m.app.store.get(m.run.id).result.summary, /déclinée/);
  } finally {
    await m.finish();
  }
});

test('POST /cancel pendant la question : l’agent reçoit cancel, mission cancelled', async () => {
  const m = await startMission();
  try {
    await m.waitFor(() => m.app.store.get(m.run.id).state === 'awaiting_owner');
    const res = await m.api(`/api/runs/${m.run.id}/cancel`, {});
    assert.equal(res.status, 200);
    await m.done;
    assert.equal(m.app.store.get(m.run.id).state, 'cancelled');
    await m.waitFor(() => existsSync(m.files.answerFile));
    assert.equal(JSON.parse(readFileSync(m.files.answerFile, 'utf8')).action, 'cancel');
  } finally {
    await m.finish();
  }
});
