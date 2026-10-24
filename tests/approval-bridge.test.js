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

async function setup(t) {
  const { server: siteServer, hits, origin } = await site();
  const saved = { ...process.env };
  Object.assign(process.env, {
    AGENT_PLATFORM_BROWSER: 'isolated',
    AGENT_PLATFORM_CHROME_PATH: CHROME,
    AGENT_PLATFORM_BROWSER_LOCAL_ORIGINS: origin,
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
