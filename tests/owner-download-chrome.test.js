import { refFor } from './support/click-ref.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LIMIT = 1024 * 1024;

// The relay itself is out of scope: a real Chrome with the owner transport's flag set exercises
// the branch, its real cookie store and the real connection teardown.
async function setup(t) {
  const state = {
    cookie: null,
    sent: 0,
    closed: Promise.withResolvers(),
    started: Promise.withResolvers(),
  };
  const server = http.createServer((req, res) => {
    if (req.url === '/session.txt') {
      state.cookie = req.headers.cookie ?? null;
      return res.end('FICTIF session');
    }
    if (req.url === '/big.bin') {
      const pump = () => {
        while (state.sent < 500 * 1024 * 1024) {
          state.sent += 65536;
          if (!res.write(Buffer.alloc(65536))) return res.once('drain', pump);
        }
        res.end();
      };
      res.on('close', state.closed.resolve);
      return pump();
    }
    if (req.url === '/hang.txt') {
      res.write('FICTIF début');
      return state.started.resolve();
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('set-cookie', 'jeton=FICTIF; HttpOnly; Path=/');
    res.end(`<title>FICTIF</title>
      <a id="session" href="/session.txt">a</a>
      <a id="big" href="/big.bin">b</a>
      <a id="hang" href="/hang.txt">c</a>`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const workspace = mkdtempSync(join(tmpdir(), 'relay-owner-download-'));
  const provider = new CdpBrowser({ launch: { executablePath: CHROME } });
  const policy = new RunPolicy({
    ownerMode: true,
    runId: 'FICTIF',
    capabilities: capabilityIds,
    workspace,
    allowLocalOrigins: [origin],
    maxDownloadBytes: LIMIT,
  });
  const gateway = new BrowserGateway({ provider, policy, approve: async () => true });
  t.after(async () => {
    await provider.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    rmSync(workspace, { recursive: true, force: true });
  });
  await gateway.call('browser.navigate', { url: `${origin}/` });
  provider.ownerConnection = { close: async () => {}, takeOpenedWindow: () => null };
  return { state, provider, gateway, downloads: join(workspace, 'downloads') };
}

test(
  'propriétaire Chrome réel : le lien téléchargé garde la session, même HttpOnly',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { state, gateway, downloads } = await setup(t);
    const result = await gateway.call('browser.download', {
      ref: await refFor(gateway, '#session'),
    });
    assert.equal(result.method, 'session-http-link');
    assert.equal(state.cookie, 'jeton=FICTIF');
    assert.equal(readFileSync(join(downloads, 'session.txt'), 'utf8'), 'FICTIF session');
  },
);

test(
  'propriétaire Chrome réel : un corps sans taille annoncée est coupé au plafond',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { state, gateway, downloads } = await setup(t);
    await assert.rejects(
      gateway.call('browser.download', { ref: await refFor(gateway, '#big') }),
      /trop volumineux/,
    );
    await state.closed.promise;
    assert.ok(state.sent < 250 * 1024 * 1024, `octets envoyés : ${state.sent}`);
    assert.deepEqual(readdirSync(downloads), []);
  },
);

test(
  'propriétaire Chrome réel : couper la connexion annule le téléchargement en cours',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { state, provider, gateway, downloads } = await setup(t);
    const pending = gateway.call('browser.download', { ref: await refFor(gateway, '#hang') });
    await state.started.promise;
    await provider.dropConnection();
    await assert.rejects(pending, /Navigateur fermé/);
    assert.deepEqual(readdirSync(downloads), []);
  },
);
