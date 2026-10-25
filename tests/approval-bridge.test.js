import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { connectMcp } from '../packages/mcp-gateway/client.js';
import { getPack } from '../packages/orchestrator/packs.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const temporary = () => mkdtempSync(join(tmpdir(), 'relay-bridge-'));

function site() {
  const hits = { posts: 0 };
  const server = http.createServer((req, res) => {
    if (req.method === 'POST') hits.posts++;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      '<title>Site</title><form method="post" action="/a"><button id="apply">Postuler</button></form>',
    );
  });
  return new Promise((r) =>
    server.listen(0, '127.0.0.1', () =>
      r({ server, hits, origin: `http://127.0.0.1:${server.address().port}` }),
    ),
  );
}

async function setup(t, options = {}) {
  const { server: siteServer, hits, origin } = await site();
  const saved = { ...process.env };
  Object.assign(process.env, {
    AGENT_PLATFORM_BROWSER: 'isolated',
    AGENT_PLATFORM_CHROME_PATH: CHROME,
    AGENT_PLATFORM_BROWSER_LOCAL_ORIGINS: origin,
    AGENT_PLATFORM_BROWSER_JAVASCRIPT: options.allowJavaScript ? '1' : '0',
    AGENT_PLATFORM_BROWSER_SHARED_CONTEXT: '0',
  });
  const app = createApp({ dataDir: temporary() });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const run = { id: crypto.randomUUID(), state: 'running', budgetCents: 0, cwd: temporary() };
  mkdirSync(run.cwd, { recursive: true });
  app.store.create(run);
  app.engine.active.set(run.id, { abort: new AbortController() });
  const pack = {
    ...getPack('core'),
    policies: { browser: { capabilities: ['browser.navigate', 'browser.click'] } },
  };
  const mcp = await connectMcp(app.engine.mcpServerFor(run, pack));
  t.after(async () => {
    await mcp.close();
    app.engine.active.delete(run.id);
    await app.close();
    siteServer.close();
    process.env = saved;
  });
  return { app, run, mcp, hits, origin };
}
async function decideWhenAsked(app, runId, optionId) {
  for (let i = 0; i < 800; i++) {
    const p = [...app.engine.permissions.values()].find((x) => x.runId === runId);
    if (p) {
      app.engine.decide(p.id, optionId);
      return p;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Aucune demande de permission reçue');
}

test(
  'pont d’approbation : seules les capacités accordées sont listées',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { mcp } = await setup(t);
    const names = (await mcp.listTools()).tools.map((x) => x.name).sort();
    assert.deepEqual(names, ['browser_click', 'browser_navigate', 'evidence_echo']);
  },
);

test(
  'pont d’approbation : « Postuler » refusé dans l’interface → aucun envoi',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { app, run, mcp, hits, origin } = await setup(t);
    await mcp.callTool({ name: 'browser_navigate', arguments: { url: origin + '/' } });
    const [result, asked] = await Promise.all([
      mcp.callTool({ name: 'browser_click', arguments: { selector: '#apply' } }, undefined, {
        timeout: 90000,
      }),
      decideWhenAsked(app, run.id, 'deny'),
    ]);
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /refusée par l’utilisateur/);
    assert.match(asked.tool.title, /ACTION SENSIBLE · browser.click « Postuler »/);
    assert.equal(hits.posts, 0);
  },
);

test(
  'pont d’approbation : « Postuler » autorisé une fois → un envoi',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { app, run, mcp, hits, origin } = await setup(t);
    await mcp.callTool({ name: 'browser_navigate', arguments: { url: origin + '/' } });
    const [result] = await Promise.all([
      mcp.callTool({ name: 'browser_click', arguments: { selector: '#apply' } }, undefined, {
        timeout: 90000,
      }),
      decideWhenAsked(app, run.id, 'allow'),
    ]);
    assert.equal(result.isError, undefined);
    assert.equal(hits.posts, 1);
  },
);

test('pont d’approbation : jeton invalide ou run inactif refusés', async () => {
  const app = createApp({ dataDir: temporary() });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  try {
    const id = crypto.randomUUID();
    const call = (token) =>
      fetch(`http://127.0.0.1:${app.server.address().port}/api/internal/approvals/${id}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-platform-request': '1',
          'x-relay-token': token,
        },
        body: '{}',
      }).then(async (r) => ({ status: r.status, data: await r.json() }));
    const r1 = await call('faux');
    assert.equal(r1.status, 400);
    assert.match(r1.data.error, /Jeton/);
    app.engine.approvalTokens.set(id, 'bon');
    const r2 = await call('bon');
    assert.equal(r2.status, 400);
    assert.match(r2.data.error, /inactif/);
  } finally {
    await app.close();
  }
});

test('pont : jeton lié au run et compteur refusé après abandon ou hors activité', async (t) => {
  const app = createApp({ dataDir: temporary() });
  t.after(() => app.close());
  const a = crypto.randomUUID(),
    b = crypto.randomUUID();
  for (const id of [a, b]) {
    app.store.create({ id, state: 'running', budgetCents: 10 });
    app.engine.approvalTokens.set(id, 'fictif-' + id);
  }
  await assert.rejects(
    app.engine.gatewayUsage(b, 'fictif-' + a, { dimension: 'browser_action' }),
    /Jeton/,
  );
  await assert.rejects(
    app.engine.gatewayUsage(a, 'fictif-' + a, { dimension: 'browser_action' }),
    /inactif/,
  );
  const control = { abort: new AbortController() };
  app.engine.active.set(a, control);
  control.abort.abort();
  await assert.rejects(
    app.engine.gatewayUsage(a, 'fictif-' + a, { dimension: 'browser_action' }),
    /inactif|annulé/,
  );
  app.engine.active.delete(a);
  assert.equal(app.store.usage(a).entries.length, 0);
});

test('permission : annulation locale résout immédiatement, conserve les autres demandes et ignore une réponse tardive', async (t) => {
  const app = createApp({ dataDir: temporary() });
  t.after(() => app.close());
  const id = crypto.randomUUID();
  app.store.create({ id, state: 'running', budgetCents: 0 });
  const one = new AbortController(),
    two = new AbortController();
  const args = {
    toolCall: { title: 'Action FICTIVE' },
    options: [{ optionId: 'allow', name: 'Oui', kind: 'allow_once' }],
  };
  const first = app.engine.permission(id, args, false, one.signal);
  const second = app.engine.permission(id, args, false, two.signal);
  const [firstId, secondId] = [...app.engine.permissions.keys()];
  one.abort();
  const outcome = await Promise.race([
    first,
    new Promise((r) => setTimeout(() => r('timeout'), 100)),
  ]);
  assert.notEqual(outcome, 'timeout');
  assert.equal(outcome.outcome.outcome, 'cancelled');
  assert.equal(app.engine.permissions.size, 1);
  assert.equal(app.store.get(id).state, 'waiting_permission');
  assert.throws(() => app.engine.decide(firstId, 'allow'), /expirée/);
  app.engine.decide(secondId, 'allow');
  await second;
  assert.equal(app.store.get(id).state, 'running');
});

test('gateway réelle sans pont de mesure : action refusée avant lancement de Chrome', async () => {
  const { platformMcp } = await import('../packages/orchestrator/workflow-run.js');
  const client = await connectMcp(
    platformMcp('core', {
      RELAY_BROWSER: 'isolated',
      RELAY_POLICY: JSON.stringify({ allowLocalOrigins: ['http://127.0.0.1:1'] }),
    }),
  );
  try {
    const response = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: 'http://127.0.0.1:1/' },
    });
    assert.equal(response.isError, true);
    assert.match(response.content[0].text, /Pont de mesure requis/);
  } finally {
    await client.close();
  }
});

for (const optionId of ['deny', 'allow']) {
  test(
    `options navigateur via MCP : JavaScript ${optionId}, décision humaine enregistrée par run`,
    { skip: !existsSync(CHROME) },
    async (t) => {
      const { app, run, mcp, origin } = await setup(t, { allowJavaScript: true });
      const [result, asked] = await Promise.all([
        mcp.callTool({ name: 'browser_navigate', arguments: { url: origin } }),
        decideWhenAsked(app, run.id, optionId),
      ]);
      assert.match(asked.tool.title, /ACTION SENSIBLE · browser.enableJavaScript/);
      assert.equal(asked.tool.rawInput.args.runId, run.id);
      if (optionId === 'deny') {
        assert.equal(result.isError, true);
        assert.match(result.content[0].text, /Consentement humain refusé/);
      } else assert.equal(result.isError, undefined);
      const events = app.store.events(run.id);
      const request = events.find((e) => e.type === 'permission' && e.data.id === asked.id);
      assert.equal(request.data.tool.rawInput.args.runId, run.id);
      assert.ok(
        events.some(
          (e) =>
            e.type === 'permission_resolved' &&
            e.data.id === asked.id &&
            e.data.optionId === optionId,
        ),
      );
      // Same approval token cannot even request consent for another run.
      await assert.rejects(
        app.engine.gatewayApproval('FICTIF-other', app.engine.approvalTokens.get(run.id), {
          capability: 'browser.enableJavaScript',
        }),
        /Jeton/,
      );
    },
  );
}

test(
  'options navigateur : annuler pendant le consentement interdit le lancement',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { app, run, mcp, origin } = await setup(t, { allowJavaScript: true });
    const task = mcp.callTool({ name: 'browser_navigate', arguments: { url: origin } });
    for (let i = 0; i < 200 && !app.engine.permissions.size; i++)
      await new Promise((r) => setTimeout(r, 10));
    assert.equal(app.engine.permissions.size, 1);
    app.engine.active.get(run.id).abort.abort();
    const result = await task;
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Consentement humain refusé/);
    assert.equal(app.engine.permissions.size, 0);
  },
);
