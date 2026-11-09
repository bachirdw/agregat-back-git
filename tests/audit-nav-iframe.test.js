// Audit du 10/11 (navigateur-mcp.md, constats 3 et 4), pages FICTIVES locales, Chrome headless
// jetable (jamais le Chrome du propriétaire) : le formulaire d'un ATS intégré dans une iframe d'une
// autre origine est lisible avec le transport propriétaire, et une iframe peut écrire vers sa propre
// origine (jeton d'un widget) sans que l'envoi final cesse d'attendre la carte.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function serve(t, handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return server.address().port;
}

// Site carrière FICTIF (127.0.0.1) avec l'iframe d'un ATS FICTIF d'un autre site (localhost).
async function careerSite(t) {
  const writes = [];
  const atsPort = await serve(t, (req, res) => {
    if (req.method !== 'GET') {
      req.resume();
      req.on('end', () => {
        writes.push(`${req.method} ${req.url}`);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>ATS FICTIF</title>
<script>
  fetch('/recaptcha/api2/reload', { method: 'POST', body: 'x' })
    .then(() => (document.body.dataset.token = 'ok'))
    .catch(() => (document.body.dataset.token = 'bloque'));
</script>
<form onsubmit="event.preventDefault(); fetch('/api/candidatures', { method: 'POST', body: '{}' })">
  <label>Prenom <input name="prenom" aria-label="Prenom"></label>
  <button type="submit">Envoyer ma candidature</button>
</form>`);
  });
  const ats = `http://localhost:${atsPort}`;
  const outerPort = await serve(t, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><meta charset="utf-8"><title>Carrieres FICTIVES</title><h1>Offre FICTIVE</h1><iframe title="ATS" src="${ats}/" width="600" height="300"></iframe>`,
    );
  });
  return { origin: `http://127.0.0.1:${outerPort}`, ats, writes };
}

function gatewayFor(t, provider, origins, decide, extra = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'audit-nav-iframe-FICTIF-'));
  const asked = [];
  t.after(async () => {
    await provider.close().catch(() => {});
    rmSync(folder, { recursive: true, force: true });
  });
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-iframe',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: origins,
      ...extra,
    }),
    approve: async (request) => {
      asked.push(request);
      return decide(request);
    },
  });
  return { gateway, asked };
}

async function disposableChrome(t) {
  const profile = mkdtempSync(join(tmpdir(), 'audit-nav-cdp-FICTIF-'));
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--site-per-process',
      '--no-first-run',
      '--no-default-browser-check',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  t.after(async () => {
    chrome.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true });
  });
  for (let i = 0; i < 100; i++) {
    try {
      const port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
      if (port && port !== 19988) return `http://127.0.0.1:${port}`;
    } catch {
      /* not written yet */
    }
    await sleep(100);
  }
  throw new Error('FICTIF : Chrome jetable sans port CDP');
}

test(
  'Constat 3 : avec le transport propriétaire, le formulaire d’une iframe d’une autre origine est lisible',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, ats } = await careerSite(t);
    const provider = new CdpBrowser({
      endpoint: await disposableChrome(t),
      startupTimeoutMs: 12000,
    });
    const { gateway } = gatewayFor(t, provider, [origin, ats], () => true, {
      allowSharedContext: true,
    });
    await gateway.call('browser.navigate', { url: origin });
    assert.equal(provider.name, 'playwriter-owner');
    let snapshot = '';
    for (let i = 0; i < 20 && !/Prenom/.test(snapshot); i++) {
      snapshot = (await gateway.call('browser.snapshot', {})).snapshot;
      if (!/Prenom/.test(snapshot)) await sleep(250);
    }
    assert.match(snapshot, /textbox "Prenom" \[ref=f\d+e\d+\]/);
  },
);

test(
  'Constat 4 : une iframe d’une autre origine écrit vers sa propre origine ; son envoi final garde sa carte',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, ats, writes } = await careerSite(t);
    const provider = new CdpBrowser({ launch: { executablePath: CHROME } });
    let allow = false;
    const { gateway, asked } = gatewayFor(t, provider, [origin, ats], () => allow);
    await gateway.call('browser.navigate', { url: origin });
    for (let i = 0; i < 100 && !writes.length; i++) await sleep(20);
    assert.deepEqual(writes, ['POST /recaptcha/api2/reload'], 'le jeton du widget est obtenu');
    const frame = provider.page.frames().find((f) => f.url().startsWith(ats));
    assert.equal(await frame.evaluate(() => document.body.dataset.token), 'ok');
    const snapshot = (await gateway.call('browser.snapshot', {})).snapshot;
    const ref = snapshot
      .split('\n')
      .find((line) => line.includes('Envoyer ma candidature'))
      ?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
    assert.ok(ref, 'bouton de l’iframe visible');
    await assert.rejects(gateway.call('browser.click', { ref }), /Action refusée/);
    assert.deepEqual(
      asked.filter((r) => r.actionClass === 'send').map((r) => r.capability),
      ['browser.click'],
    );
    await sleep(500);
    assert.deepEqual(writes, ['POST /recaptcha/api2/reload'], 'rien d’autre ne part sans accord');
    // Accordé : la soumission de l'iframe vers sa propre origine part, sans deuxième carte.
    allow = true;
    await gateway.call('browser.click', { ref });
    for (let i = 0; i < 100 && writes.length < 2; i++) await sleep(20);
    assert.deepEqual(writes, ['POST /recaptcha/api2/reload', 'POST /api/candidatures']);
    assert.equal(asked.filter((r) => r.actionClass === 'send').length, 2);
  },
);
