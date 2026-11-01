import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CdpBrowser } from '../packages/browser-gateway/index.js';
import { startRelay, waitForExtension } from '../packages/browser-gateway/relay-start.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';

async function fakeRelay(t, respond) {
  const server = http.createServer(respond);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  return `http://127.0.0.1:${server.address().port}`;
}

function fakeSpawn() {
  const calls = [];
  const run = (command, args, options) => {
    const child = new EventEmitter();
    child.unref = () => calls.at(-1).push('unref');
    calls.push([command, args, options]);
    return child;
  };
  return { calls, run };
}

test('relais absent : démarré sur la boucle locale, détaché, sans les secrets de l’API', async (t) => {
  const saved = process.env.CAREER_SMTP_PASSWORD;
  process.env.CAREER_SMTP_PASSWORD = 'FICTIF';
  t.after(() => {
    if (saved === undefined) delete process.env.CAREER_SMTP_PASSWORD;
    else process.env.CAREER_SMTP_PASSWORD = saved;
  });
  const { calls, run } = fakeSpawn();
  assert.equal(
    await startRelay({ endpoint: 'http://127.0.0.1:1', run, command: '/fictif/playwriter' }),
    true,
  );
  assert.equal(calls.length, 1);
  const [command, args, options, unref] = calls[0];
  assert.equal(command, '/fictif/playwriter');
  assert.ok(options.env.PATH.startsWith(dirname(process.execPath) + ':'));
  assert.deepEqual(args, ['serve', '--host', '127.0.0.1']);
  assert.equal(options.detached, true);
  assert.equal(options.stdio, 'ignore');
  assert.equal(options.env.PLAYWRITER_TELEMETRY, '0');
  assert.equal(options.env.CAREER_SMTP_PASSWORD, undefined);
  assert.equal(unref, 'unref');
});

test('relais présent : rien n’est démarré, même sans extension connectée', async (t) => {
  const endpoint = await fakeRelay(t, (_req, res) => res.end('{"connected":false}'));
  const { calls, run } = fakeSpawn();
  assert.equal(await startRelay({ endpoint, run }), false);
  assert.equal(calls.length, 0);
});

test('commande playwriter introuvable : aucune erreur ne remonte à la mission', async () => {
  const child = new EventEmitter();
  child.unref = () => {};
  await startRelay({ endpoint: 'http://127.0.0.1:1', run: () => child });
  assert.doesNotThrow(() => child.emit('error', new Error('spawn playwriter ENOENT')));
});

test('attente de l’extension : vraie dès qu’elle se connecte, fausse au délai', async (t) => {
  let polls = 0;
  const endpoint = await fakeRelay(t, (_req, res) =>
    res.end(JSON.stringify({ connected: ++polls >= 3 })),
  );
  assert.equal(await waitForExtension(endpoint, 5000, 10), true);
  assert.equal(polls, 3);
  assert.equal(await waitForExtension('http://127.0.0.1:1', 60, 10), false);
});

test('propriétaire : le navigateur attend l’extension puis dit la vérité sur le Chrome isolé', async (t) => {
  let polls = 0;
  const endpoint = await fakeRelay(t, (req, res) => {
    if (req.url === '/extension/status') {
      polls += 1;
      return res.end('{"connected":false}');
    }
    res.statusCode = 503;
    res.end();
  });
  const provider = new CdpBrowser({
    endpoint,
    extensionWaitMs: 60,
    startupTimeoutMs: 5000,
    fallbackLaunch: { executablePath: '/nonexistent/chrome-FICTIF' },
  });
  const policy = new RunPolicy({
    ownerMode: true,
    allowedDomains: [],
    capabilities: [],
    workspace: tmpdir(),
    runId: 'relay-start-FICTIF',
  });
  await provider.prepare(policy);
  await assert.rejects(provider.ensure(policy));
  assert.ok(polls >= 1, 'statut de l’extension interrogé avant la bascule');
  assert.equal(provider.name, 'cdp-isolated-fallback');
  assert.match(provider.fallbackReason, /^Extension Playwriter indisponible/);
  assert.match(provider.fallbackReason, /invisible/);
  assert.match(provider.fallbackReason, /aucune connexion n’y est possible/);
  assert.match(provider.fallbackReason, /ouvrir Chrome avec l’extension, puis de relancer/);
});

test('mission : le relais est demandé pour Playwriter, jamais sur un autre point d’accès', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'relay-start-FICTIF-'));
  const saved = process.env.AGENT_PLATFORM_CDP_ENDPOINT;
  delete process.env.AGENT_PLATFORM_CDP_ENDPOINT;
  const app = createApp({ dataDir: root, ownerMode: true });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
    if (saved === undefined) delete process.env.AGENT_PLATFORM_CDP_ENDPOINT;
    else process.env.AGENT_PLATFORM_CDP_ENDPOINT = saved;
  });
  let started = 0;
  app.engine.startRelay = () => {
    started += 1;
  };
  const pack = { id: 'pack-FICTIF', policies: {} };
  const run = (browser) => ({ id: 'run-FICTIF', browser, cwd: root });
  app.engine.mcpServerFor(run('playwriter'), pack);
  assert.equal(started, 1);
  app.engine.mcpServerFor(run('isolated'), pack);
  assert.equal(started, 1);
  process.env.AGENT_PLATFORM_CDP_ENDPOINT = 'http://127.0.0.1:1';
  app.engine.mcpServerFor(run('playwriter'), pack);
  assert.equal(started, 1);
});
