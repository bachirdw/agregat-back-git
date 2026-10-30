import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Store, terminal } from '../packages/storage/index.js';
import { SkillRegistry } from '../packages/skill-registry/index.js';
import { browserPolicy, allowedPermission } from '../packages/policy-engine/index.js';
import { createApp } from '../apps/api/server.js';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { ROOT } from '../packages/orchestrator/packs.js';
import { AcpRuntime } from '../packages/agent-runtime/index.js';
const temporary = () => mkdtempSync(join(tmpdir(), 'relay-test-'));
async function completed(app, id) {
  const until = Date.now() + 15000;
  while (!terminal.has(app.store.get(id).state)) {
    assert.ok(Date.now() < until, 'Run doit terminer');
    await new Promise((r) => setTimeout(r, 20));
  }
  return app.store.get(id);
}

test('gateway refuse écriture, exfiltration et URLs ambiguës', () => {
  assert.equal(browserPolicy('browser.snapshot', 'https://jobs.example.test/demo'), true);
  for (const url of [
    'http://jobs.example.test',
    'https://jobs.example.test.evil.com',
    'https://user@jobs.example.test',
    'https://jobs.example.test:9000',
    'file:///etc/passwd',
    'https://127.0.0.1',
  ])
    assert.throws(() => browserPolicy('browser.snapshot', url));
  for (const action of [
    'browser.click',
    'browser.type',
    'browser.upload',
    'browser.download',
    'browser.execute',
    'email.send',
  ])
    assert.throws(() => browserPolicy(action, 'https://jobs.example.test'));
  assert.equal(allowedPermission([{ kind: 'allow_always', optionId: 'all' }], 'all'), false);
});
test('ledger refuse budget négatif/dépassement sans inscription partielle', () => {
  const store = new Store(join(temporary(), 'db'));
  try {
    store.create({ id: 'a', state: 'queued', budgetCents: 5 });
    store.charge('a', 'search', 1, 4);
    assert.throws(() => store.charge('a', 'search', 1, 2), /Budget/);
    assert.throws(() => store.charge('a', 'search', 1, -1));
    assert.equal(store.usage('a').entries.length, 1);
    assert.equal(store.usage('a').platformCents, 4);
    assert.equal(store.usage('a').externalCents, null);
  } finally {
    store.close();
  }
});
test('historique durable et interruption au redémarrage', () => {
  const file = join(temporary(), 'db');
  let s = new Store(file);
  s.create({ id: 'a', state: 'running', budgetCents: 0 });
  const event = s.event('a', 'text', { text: 'conservé' });
  s.close();
  s = new Store(file);
  try {
    assert.equal(s.get('a').state, 'interrupted');
    assert.ok(s.events('a').some((e) => e.seq === event.seq));
    assert.ok(s.events('a', event.seq).every((e) => e.seq > event.seq));
  } finally {
    s.close();
  }
});
test('Skill non revu, désactivé et modifié rejeté', () => {
  const dir = temporary(),
    path = join(dir, 'SKILL.md');
  writeFileSync(path, '---\nname: test\ndescription: Test\n---\nMéthode');
  const store = new Store(join(dir, 'db'));
  try {
    const registry = new SkillRegistry(store, [
      { id: 'test', path, version: '1', reviewed: true },
      { id: 'untrusted', path, version: '1', reviewed: false },
    ]);
    assert.throws(() => registry.install('untrusted'));
    assert.throws(() => registry.resolve(['test']));
    registry.install('test');
    assert.equal(registry.resolve(['test']).length, 1);
    registry.activate('test', false);
    assert.throws(() => registry.resolve(['test']));
    registry.activate('test', true);
    writeFileSync(path, readFileSync(path, 'utf8') + ' modifié');
    assert.throws(() => registry.resolve(['test']), /modifié/);
  } finally {
    store.close();
  }
});
test('vrai MCP : découverte, classement et refus navigateur', async () => {
  const client = await connectMcp({
    command: process.execPath,
    args: [resolve(ROOT, 'packages/mcp-gateway/server.js'), 'najah'],
  });
  try {
    const tools = await client.listTools();
    assert.ok(tools.tools.some((t) => t.name === 'opportunities_rank'));
    assert.ok(!tools.tools.some((t) => t.name === 'email_send'));
    const r = await client.callTool({ name: 'opportunities_rank', arguments: { query: 'react' } });
    const data = JSON.parse(r.content[0].text);
    assert.equal(data.opportunities[0].id, 'demo-002');
    assert.equal(data.simulated, true);
    const denied = await client.callTool({
      name: 'browser_snapshot',
      arguments: { url: 'https://evil.example' },
    });
    assert.equal(denied.isError, true);
  } finally {
    await client.close();
  }
});
test('API complète : plan → ACP → MCP → résultat, SSE replay et protections HTTP', async () => {
  const app = createApp({ dataDir: temporary() });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const post = (path, body, extra = {}) =>
    fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1', ...extra },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await post('/api/runs', {}, { origin: 'https://evil.example' })).status, 403);
    const hostStatus = await new Promise((ok, no) => {
      const req = http.get(base + '/api/runs', { headers: { host: 'evil.example' } }, (res) => {
        res.resume();
        ok(res.statusCode);
      });
      req.on('error', no);
    });
    assert.equal(hostStatus, 403);
    assert.equal((await fetch(base + '/api/runs', { method: 'POST', body: '{}' })).status, 403);
    assert.equal((await post('/api/runs', { prompt: 'x', command: 'sh' })).status, 400);
    assert.equal((await post('/api/runs', { prompt: 'x', agent: 'codex' })).status, 400);
    assert.equal((await post('/api/skills/opportunity-analysis/install', {})).status, 200);
    const input = {
      prompt: 'emploi python sql',
      agent: 'fixture',
      pack: 'auto',
      skills: ['opportunity-analysis'],
    };
    const plan = await (await post('/api/plan', input)).json();
    assert.equal(plan.pack, 'Najah AI');
    assert.equal(plan.simulated, true);
    assert.equal(plan.dataMode, 'fixture');
    const response = await post('/api/runs', input);
    assert.equal(response.status, 201);
    const run = await response.json();
    const done = await completed(app, run.id);
    assert.equal(done.state, 'completed', done.error);
    assert.equal(done.result.opportunities[0].score, 60);
    assert.equal(done.result.opportunities.length, 3);
    assert.equal(done.result.simulated, true);
    assert.ok(done.skillsSnapshot[0].hash);
    assert.ok(done.sessionId);
    const events = app.store.events(run.id);
    assert.ok(events.some((e) => e.type === 'agent' && e.data.sessionUpdate === 'tool_call'));
    assert.ok(events.some((e) => e.type === 'verification'));
    const cursor = events[1].seq;
    const sse = await (
      await fetch(base + `/api/runs/${run.id}/events`, {
        headers: { 'Last-Event-ID': String(cursor) },
      })
    ).text();
    assert.ok(sse.includes('event: end'));
    assert.ok(!sse.includes(`id: ${cursor}\n`));
    assert.ok(sse.includes('opportunities'));
    assert.equal((await post(`/api/runs/${run.id}/resume`, {})).status, 400);
  } finally {
    await app.close();
  }
});
test('core reste indépendant de Najah', async () => {
  const app = createApp({ dataDir: temporary() });
  try {
    const run = await app.engine.create({ prompt: 'Résumer une idée', pack: 'core' });
    const done = await completed(app, run.id);
    assert.equal(done.state, 'completed', done.error);
    assert.equal(done.result.opportunities, undefined);
    assert.equal(done.result.evidence[0].tool, 'evidence_echo');
  } finally {
    await app.engine.close();
    app.store.close();
  }
});
test('annulation et délai maximal ne produisent pas de faux succès', async () => {
  for (const timeoutMs of [180000, 1]) {
    const app = createApp({ dataDir: temporary(), timeoutMs });
    try {
      const run = await app.engine.create({ prompt: 'test' });
      if (timeoutMs > 1) app.engine.cancel(run.id);
      const done = await completed(app, run.id);
      assert.equal(done.state, timeoutMs === 1 ? 'failed' : 'cancelled');
      assert.equal(done.result, null);
    } finally {
      await app.engine.close();
      app.store.close();
    }
  }
});
test('permissions ponctuelles : réponse valide, expiration logique et annulation', async () => {
  const app = createApp({ dataDir: temporary() });
  try {
    app.store.create({ id: 'run', state: 'running', budgetCents: 0 });
    const request = {
      toolCall: { title: 'Test' },
      options: [
        { kind: 'allow_once', optionId: 'one' },
        { kind: 'allow_always', optionId: 'all' },
      ],
    };
    const p = app.engine.permission('run', request, false, new AbortController().signal);
    const id = [...app.engine.permissions.keys()][0];
    assert.throws(() => app.engine.decide(id, 'all'));
    app.engine.decide(id, 'one');
    assert.equal((await p).outcome.optionId, 'one');
    assert.throws(() => app.engine.decide(id, 'one'));
    const other = app.engine.permission('run', request, false, new AbortController().signal);
    app.engine.clearPermissions('run');
    assert.equal((await other).outcome.outcome, 'cancelled');
  } finally {
    app.store.close();
  }
});
test('runtime : handshake réel et rejet de reprise non supportée', async () => {
  const runtime = new AcpRuntime({
    definition: {
      id: 'fixture',
      command: process.execPath,
      args: [resolve(ROOT, 'tests/fixtures/agent.js')],
    },
    cwd: temporary(),
  });
  try {
    const info = await runtime.start();
    assert.equal(info.agentInfo.name, 'fixture-agent');
    await assert.rejects(runtime.session([], 'missing'), /non supportée/);
  } finally {
    runtime.close();
  }
});
