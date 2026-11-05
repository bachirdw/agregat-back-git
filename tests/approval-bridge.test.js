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

const PAGE =
  '<title>Site</title><form method="post" action="/a"><button id="apply">Postuler</button></form>';
// Troisième relecture : une page FICTIVE qui se remplace d'elle-même quand le test le demande
// (interrogation espacée d'une seconde : la navigation doit pouvoir atteindre le repos réseau).
const CHANGING_PAGE = `${PAGE}<script>setInterval(() => fetch('/state').then((r) => r.text()).then((s) => { if (s === 'changed') location.replace('/autre'); }), 1000);</script>`;
function site(page = PAGE) {
  const hits = { posts: 0, changed: false };
  const server = http.createServer((req, res) => {
    if (req.method === 'POST') hits.posts++;
    if (req.url === '/state') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(hits.changed ? 'changed' : 'same');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(req.url === '/autre' ? '<title>Autre</title><p>Page FICTIVE remplacée</p>' : page);
  });
  return new Promise((r) =>
    server.listen(0, '127.0.0.1', () =>
      r({ server, hits, origin: `http://127.0.0.1:${server.address().port}` }),
    ),
  );
}

async function setup(t, options = {}) {
  const { server: siteServer, hits, origin } = await site(options.page);
  const saved = { ...process.env };
  Object.assign(process.env, {
    AGENT_PLATFORM_BROWSER: 'isolated',
    AGENT_PLATFORM_CHROME_PATH: CHROME,
    AGENT_PLATFORM_BROWSER_LOCAL_ORIGINS: origin,
    AGENT_PLATFORM_BROWSER_JAVASCRIPT: options.allowJavaScript ? '1' : '0',
    AGENT_PLATFORM_BROWSER_SHARED_CONTEXT: '0',
  });
  const app = createApp({
    dataDir: temporary(),
    ...(options.ownerMode ? { ownerMode: true } : {}),
  });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  // Revue Opus du 06/11 : sans navigateur nommé, une mission du mode propriétaire prend le Chrome
  // du propriétaire par le relais Playwriter (moteur, mcpServerFor) : ces tests pilotaient son vrai
  // navigateur et, en client « default », coupaient toute mission en cours. Chrome isolé, toujours.
  const run = {
    id: crypto.randomUUID(),
    state: 'running',
    budgetCents: 0,
    cwd: temporary(),
    browser: 'isolated',
  };
  mkdirSync(run.cwd, { recursive: true });
  app.store.create(run);
  app.engine.active.set(run.id, { abort: new AbortController() });
  const pack = {
    ...getPack('core'),
    policies: {
      browser: { capabilities: ['browser.navigate', 'browser.snapshot', 'browser.click'] },
    },
  };
  const mcp = await connectMcp(app.engine.mcpServerFor(run, pack));
  t.after(async () => {
    await mcp.close();
    app.engine.active.delete(run.id);
    await app.close();
    // Chrome ouvre parfois une connexion d'avance au site, jamais utilisée : sans la fermer, le
    // processus de test survivait plusieurs minutes et la phase Chrome de la suite débordait.
    siteServer.closeAllConnections();
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
    assert.deepEqual(names, [
      'browser_click',
      'browser_navigate',
      'browser_snapshot',
      'evidence_echo',
    ]);
  },
);

test(
  'pont d’approbation : « Postuler » refusé dans l’interface → aucun envoi',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { app, run, mcp, hits, origin } = await setup(t);
    await mcp.callTool({ name: 'browser_navigate', arguments: { url: origin + '/' } });
    const snapshot = await mcp.callTool({ name: 'browser_snapshot', arguments: {} });
    const ref = JSON.stringify(snapshot).match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
    assert.ok(ref, JSON.stringify(snapshot).slice(0, 400));
    const [result, asked] = await Promise.all([
      mcp.callTool({ name: 'browser_click', arguments: { ref } }, undefined, {
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
    const snapshot = await mcp.callTool({ name: 'browser_snapshot', arguments: {} });
    const ref = JSON.stringify(snapshot).match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
    assert.ok(ref, JSON.stringify(snapshot).slice(0, 400));
    const [result] = await Promise.all([
      mcp.callTool({ name: 'browser_click', arguments: { ref } }, undefined, {
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

// Fictitious run; all approvals are exercised through the local API, never a real model.
test('consentement MCP : arguments forgés et faux outil ne remplacent pas la décision', async (t) => {
  const { app, run, mcp, origin } = await setup(t, { allowJavaScript: true });
  const names = (await mcp.listTools()).tools.map((tool) => tool.name);
  assert.ok(!names.includes('browser_enableJavaScript'));
  const forgedTool = await mcp.callTool({
    name: 'browser_enableJavaScript',
    arguments: { approved: true },
  });
  assert.equal(forgedTool.isError, true);
  const task = mcp.callTool({
    name: 'browser_navigate',
    arguments: {
      url: origin,
      allowJavaScript: true,
      allowSharedContext: true,
      approved: true,
      runId: 'FICTIF-autre-run',
    },
  });
  let response;
  task.then((result) => {
    response = result;
  });
  for (let i = 0; i < 200 && !response && !app.engine.permissions.size; i++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  if (app.engine.permissions.size) {
    const asked = await decideWhenAsked(app, run.id, 'deny');
    assert.equal(asked.tool.rawInput.args.runId, run.id);
  }
  const result = await task;
  assert.equal(result.isError, true);
  assert.equal(
    app.store
      .events(run.id)
      .filter((event) => event.type === 'permission_resolved' && event.data.optionId === 'allow')
      .length,
    0,
  );
  app.store.update(run.id, { state: 'completed' });
  const terminal = await mcp.callTool({ name: 'browser_navigate', arguments: { url: origin } });
  assert.equal(terminal.isError, true);
  assert.match(terminal.content[0].text, /inactif|annulé/);
});

test('frontière humaine : Origin web refusée, appel natif local non authentifié accepté (limite connue)', async (t) => {
  const app = createApp({ dataDir: temporary() });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const id = crypto.randomUUID();
  app.store.create({ id, state: 'running', budgetCents: 0 });
  const controller = new AbortController();
  const request = app.engine.permission(
    id,
    {
      toolCall: { title: 'FICTIF · browser.enableJavaScript' },
      options: [{ optionId: 'allow', kind: 'allow_once', name: 'Autoriser' }],
    },
    false,
    controller.signal,
  );
  t.after(() => controller.abort());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const pending = (await (await fetch(`${base}/api/runs/${id}`)).json()).permissions[0];
  const decide = (origin) =>
    fetch(`${base}/api/permissions/${pending.id}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-platform-request': '1',
        ...(origin ? { origin } : {}),
      },
      body: JSON.stringify({ optionId: 'allow' }),
    });
  assert.equal((await decide('https://page-hostile.example')).status, 403);
  assert.equal((await decide('null')).status, 403);
  assert.equal(app.engine.permissions.size, 1);
  // This proves the residual boundary, not human authenticity: a native CLI can omit Origin.
  assert.equal((await decide()).status, 200);
  assert.equal((await request).outcome.optionId, 'allow');
});

// E64, suite (nuit du 05 au 06/11) : la demande d'accord meurt avec l'appel de l'agent. L'agent
// abandonne son browser_click pendant que la carte d'envoi attend : la carte disparaît, un accord
// donné ensuite est impossible et aucun envoi ne part.
test(
  'pont d’approbation : appel abandonné par l’agent → carte retirée, aucun envoi',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { app, run, mcp, hits, origin } = await setup(t);
    await mcp.callTool({ name: 'browser_navigate', arguments: { url: origin + '/' } });
    const snapshot = await mcp.callTool({ name: 'browser_snapshot', arguments: {} });
    const ref = JSON.stringify(snapshot).match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
    assert.ok(ref, JSON.stringify(snapshot).slice(0, 400));
    const call = new AbortController();
    const clicked = mcp
      .callTool({ name: 'browser_click', arguments: { ref } }, undefined, {
        timeout: 90000,
        signal: call.signal,
      })
      .catch((error) => error);
    let card;
    for (let i = 0; i < 400 && !card; i++) {
      card = [...app.engine.permissions.values()].find((p) => p.runId === run.id);
      if (!card) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(card, 'carte d’envoi attendue');
    call.abort();
    assert.ok((await clicked) instanceof Error);
    for (let i = 0; i < 200 && app.engine.permissions.has(card.id); i++)
      await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(app.engine.permissions.has(card.id), false, 'carte toujours affichée');
    assert.throws(() => app.engine.decide(card.id, 'allow'), /expirée/);
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(hits.posts, 0);
  },
);

// Troisième relecture de nuit (E66) : de bout en bout, à travers la vraie passerelle MCP. Le
// propriétaire approuve « Postuler », mais la page s'est remplacée pendant l'attente : rien ne part,
// et l'issue parvient à la plateforme sur l'appel même de l'accord, marquée « non effectuée » ; le
// Bilan dira « 1 approuvé(s), dont 1 sans effet » et non « issue incertaine ».
test(
  'pont d’approbation : page remplacée pendant l’accord → rien ne part, la plateforme le sait',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { app, run, mcp, hits, origin } = await setup(t, {
      allowJavaScript: true,
      ownerMode: true,
      page: CHANGING_PAGE,
    });
    // Le tour de l'agent est lancé : la plateforme accepte les issues d'outil de la passerelle.
    const control = app.engine.active.get(run.id);
    control.promptStarted = true;
    await mcp.callTool({ name: 'browser_navigate', arguments: { url: origin + '/' } });
    const snapshot = await mcp.callTool({ name: 'browser_snapshot', arguments: {} });
    const ref = JSON.stringify(snapshot).match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
    assert.ok(ref, JSON.stringify(snapshot).slice(0, 400));
    const clicked = mcp.callTool({ name: 'browser_click', arguments: { ref } }, undefined, {
      timeout: 90000,
    });
    let card;
    for (let i = 0; i < 400 && !card; i++) {
      card = [...app.engine.permissions.values()].find((p) => p.runId === run.id);
      if (!card) await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(card, 'carte d’envoi attendue');
    hits.changed = true;
    await new Promise((resolve) => setTimeout(resolve, 2500));
    app.engine.decide(card.id, 'allow');
    const result = await clicked;
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /action non effectuée, rien n’a été envoyé/);
    for (let i = 0; i < 100 && !control.sendsFailed; i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(control.sendsApproved, 1);
    assert.equal(control.sendsFailed, 1);
    assert.equal(control.sendsUncertain ?? 0, 0);
    assert.equal(control.sendCalls?.size ?? 0, 0);
    assert.equal(hits.posts, 0);
  },
);

// Revue Opus du 06/11 : la trace d'une écriture réseau accordée d'office en mode propriétaire
// (onAutoSend) passait par le signal de l'appel en cours ; un appel abandonné par l'agent la faisait
// perdre, alors que la requête du site partait quand même : le Bilan la taisait.
test(
  'pont d’approbation : écriture du site pendant un appel abandonné → partie et tracée',
  { skip: !existsSync(CHROME) },
  async (t) => {
    // Un clic hors envoi, puis l'écriture du site 2,5 s après (dans la fenêtre de 8 s du clic) :
    // accordée d'office et tracée en mode propriétaire.
    const page =
      '<!doctype html><title>Site FICTIF</title><p>Page FICTIVE</p>' +
      "<button onclick=\"setTimeout(() => fetch('/stats', { method: 'POST', body: 'FICTIF' }), 2500)\">" +
      'Plus d’infos</button>';
    const { app, run, mcp, hits, origin } = await setup(t, {
      ownerMode: true,
      allowJavaScript: true,
      page,
    });
    await mcp.callTool({ name: 'browser_navigate', arguments: { url: origin + '/' } });
    const snapshot = await mcp.callTool({ name: 'browser_snapshot', arguments: {} });
    const ref = JSON.parse(snapshot.content[0].text).snapshot.match(
      /button "Plus d’infos" \[ref=((?:f\d+)?e\d+)\]/,
    )?.[1];
    assert.ok(ref, JSON.stringify(snapshot).slice(0, 400));
    const clicked = await mcp.callTool({ name: 'browser_click', arguments: { ref } });
    assert.notEqual(clicked.isError, true, JSON.stringify(clicked).slice(0, 300));
    assert.doesNotMatch(JSON.stringify(clicked), /playwriter/, 'jamais le Chrome du propriétaire');
    // Une capture qui attend un texte absent (8 s au plus), abandonnée aussitôt par l'agent.
    const call = new AbortController();
    const waiting = mcp
      .callTool(
        { name: 'browser_snapshot', arguments: { waitForText: 'jamais FICTIF' } },
        undefined,
        { signal: call.signal, timeout: 30000 },
      )
      .catch(() => null);
    await new Promise((r) => setTimeout(r, 300));
    call.abort();
    await waiting;
    for (let i = 0; i < 100 && hits.posts === 0; i++) await new Promise((r) => setTimeout(r, 100));
    await new Promise((r) => setTimeout(r, 1500));
    assert.equal(hits.posts, 1);
    assert.ok(
      app.store
        .events(run.id)
        .some((e) => e.type === 'permission_auto' && e.data?.capability === 'browser.send'),
      'écriture partie mais non tracée',
    );
  },
);
