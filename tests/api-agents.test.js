import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, publicAgents } from '../apps/api/server.js';
import { inputSchema } from '../packages/orchestrator/index.js';
import { saveProbe } from '../packages/agent-runtime/index.js';

const temporary = () => mkdtempSync(join(tmpdir(), 'relay-api-agents-'));
async function call(app, path, body) {
  const port = app.server.address().port;
  const r = await fetch(`http://127.0.0.1:${port}/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json', 'x-platform-request': '1' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
async function withApp(options, fn) {
  const app = createApp({ dataDir: temporary(), ...options });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}

test('publicAgents : ni commande, ni chemins, ni environnement ; résumé de sonde', () => {
  const out = publicAgents(
    [
      {
        id: 'gemini',
        name: 'Gemini',
        command: '/x',
        args: ['--acp'],
        cliPath: '/bin/gemini',
        env: ['GEMINI_API_KEY'],
        installed: true,
      },
    ],
    {
      gemini: {
        at: 't',
        handshake: true,
        session: true,
        inference: false,
        inferenceError: 'Authentification refusée',
        models: { current: 'a', options: [{ id: 'a' }] },
        modes: { current: 'default' },
        capabilities: { x: 1 },
      },
    },
  );
  const text = JSON.stringify(out);
  for (const leak of ['/bin/gemini', '--acp', 'GEMINI_API_KEY', '"/x"'])
    assert.ok(!text.includes(leak), leak);
  assert.deepEqual(out[0].probe, {
    at: 't',
    sessionAt: null,
    inferenceAt: null,
    handshake: true,
    session: true,
    inference: false,
    inferenceError: 'Authentification refusée',
    error: null,
    models: [{ id: 'a' }],
    currentModel: 'a',
    mode: 'default',
    modes: [],
  });
  assert.equal(publicAgents([{ id: 'codex', name: 'Codex' }], {})[0].probe, null);
});

test('catalogue HTTP : agents publics, sondes du dataDir', async () => {
  await withApp({}, async (app) => {
    const { status, data } = await call(app, '/catalog');
    assert.equal(status, 200);
    assert.ok(data.agents.some((a) => a.id === 'fixture'));
    assert.ok(!JSON.stringify(data.agents).includes('cliPath'));
  });
});

test('plan Auto en démonstration : fixture, raisons et rejets visibles', async () => {
  await withApp({}, async (app) => {
    const { status, data } = await call(app, '/plan', { prompt: 'Analyse simple', agent: 'auto' });
    assert.equal(status, 200);
    assert.equal(data.agent, 'Démonstrateur ACP');
    assert.match(data.routing.reasons[0], /démonstration/);
    assert.ok(data.routing.rejected.length >= 1);
  });
});

test('API sans agent : Auto explicite, démonstration signalée hors mode réel', async () => {
  assert.equal(inputSchema.parse({ prompt: 'Analyse simple' }).agent, 'auto');
  await withApp({}, async (app) => {
    const { status, data } = await call(app, '/plan', { prompt: 'Analyse simple' });
    assert.equal(status, 200);
    assert.equal(data.simulated, true);
    assert.equal(data.routing.id, 'fixture');
    assert.match(data.routing.reasons[0], /démonstration/);
  });
});

test('navigateur choisi pour le run : plan et MCP utilisent le même fournisseur', async () => {
  await withApp({ ownerMode: true }, async (app) => {
    const plan = await app.engine.plan({
      prompt: 'FICTIF',
      agent: 'fixture',
      browser: 'isolated',
      browserDomains: ['Example.COM'],
    });
    assert.equal(plan.input.browser, 'isolated');
    assert.deepEqual(plan.input.browserDomains, ['example.com']);
    const mcp = app.engine.mcpServerFor(
      {
        id: '11111111-1111-4111-8111-111111111111',
        cwd: '/tmp',
        browser: 'isolated',
        browserDomains: ['example.com'],
      },
      plan.pack,
    );
    assert.equal(mcp.env.find((item) => item.name === 'RELAY_BROWSER').value, 'isolated');
    const policy = JSON.parse(mcp.env.find((item) => item.name === 'RELAY_POLICY').value);
    assert.deepEqual(policy.allowedDomains, ['example.com']);
    const response = await call(app, '/plan', {
      prompt: 'FICTIF',
      agent: 'fixture',
      browser: 'isolated',
    });
    assert.equal(response.status, 200);
    assert.equal(response.data.browser, 'isolated');
    const invalid = await call(app, '/plan', {
      prompt: 'FICTIF',
      agent: 'fixture',
      browser: 'remote',
    });
    assert.equal(invalid.status, 400);
    const badDomain = await call(app, '/plan', {
      prompt: 'FICTIF',
      agent: 'fixture',
      browserDomains: ['localhost'],
    });
    assert.equal(badDomain.status, 400);
  });
});

test('plan manuel : raisons « choisi manuellement »', async () => {
  await withApp({}, async (app) => {
    const { data } = await call(app, '/plan', { prompt: 'x', agent: 'fixture' });
    assert.deepEqual(data.routing.reasons, ['Agent choisi manuellement']);
  });
});

test('plan : agent réel refusé hors mode live', async () => {
  await withApp({}, async (app) => {
    const { status, data } = await call(app, '/plan', { prompt: 'x', agent: 'codex' });
    assert.equal(status, 400);
    assert.match(data.error, /Mode réel désactivé|non détecté|Adaptateur/);
  });
});

test('plan : agent inconnu rejeté par le schéma', async () => {
  await withApp({}, async (app) => {
    const { status } = await call(app, '/plan', { prompt: 'x', agent: 'rm -rf' });
    assert.equal(status, 400);
  });
});

test('plan live : modèle non annoncé au dernier test refusé', async () => {
  const dataDir = temporary();
  saveProbe(dataDir, 'fixture', {
    session: true,
    models: { options: [{ id: 'm1' }] },
    modes: { options: ['default'] },
  });
  const app = createApp({ dataDir });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  try {
    const bad = await call(app, '/plan', { prompt: 'x', agent: 'fixture', model: 'inconnu' });
    assert.equal(bad.status, 400);
    assert.match(bad.data.error, /Modèle non annoncé/);
    const ok = await call(app, '/plan', { prompt: 'x', agent: 'fixture', model: 'm1' });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.data.models.options, [{ id: 'm1' }]);
    const unknownMode = await call(app, '/plan', {
      prompt: 'x',
      agent: 'fixture',
      agentMode: 'ghost',
    });
    assert.equal(unknownMode.status, 400);
    assert.match(unknownMode.data.error, /Mode ACP non annoncé/);
  } finally {
    await app.close();
  }
});

test('régression live : la permission exposée décrit l’outil demandé', async () => {
  await withApp({}, async (app) => {
    app.store.create({ id: 'run', state: 'running', budgetCents: 0 });
    const pending = app.engine.permission(
      'run',
      {
        toolCall: { toolCallId: 'mcp_platform_x', title: 'opportunities_rank(query: x)' },
        options: [{ kind: 'allow_once', optionId: 'one' }],
      },
      false,
      new AbortController().signal,
    );
    const [entry] = [...app.engine.permissions.values()];
    assert.equal(entry.tool.title, 'opportunities_rank(query: x)');
    app.engine.decide(entry.id, 'one');
    await pending;
  });
});

test('régression live : Gemini reçoit la confiance de l’espace de run, pas les autres agents', async () => {
  const { getProfile, AcpRuntime } = await import('../packages/agent-runtime/index.js');
  const envOf = (id) =>
    new AcpRuntime({
      definition: { ...getProfile(id), cliPath: '/x' },
      cwd: '/tmp',
      env: { PATH: '/bin', GEMINI_API_KEY: 'k' },
    }).childEnv();
  assert.equal(envOf('gemini').GEMINI_CLI_TRUST_WORKSPACE, 'true');
  assert.equal(envOf('gemini').GEMINI_API_KEY, 'k');
  for (const id of ['codex', 'claude', 'opencode']) {
    assert.equal(envOf(id).GEMINI_CLI_TRUST_WORKSPACE, undefined);
    assert.equal(envOf(id).GEMINI_API_KEY, undefined);
  }
  assert.equal(envOf('codex').CODEX_PATH, '/x');
  assert.equal(envOf('claude').CLAUDE_CODE_EXECUTABLE, '/x');
});

test('erreurs de validation lisibles, pas de JSON zod brut', async () => {
  await withApp({}, async (app) => {
    const { status, data } = await call(app, '/plan', { prompt: 'x', pack: 'inconnu' });
    assert.equal(status, 400);
    assert.match(data.error, /^Requête invalide : pack — /);
    assert.ok(!data.error.includes('"code"'));
  });
});
