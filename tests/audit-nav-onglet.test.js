// Audit du 10/11 (navigateur-mcp.md, constat 6), Chrome headless isolé, page FICTIVE locale : en
// mode propriétaire, un onglet de mission fermé ou une ouverture échouée ne rend pas le navigateur
// « fermé » jusqu'à la fin de la mission ; la prochaine action rouvre un onglet.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function site(t) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><title>Offre FICTIVE</title><h1>FICTIF</h1>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

function gatewayFor(t, provider, origin, extra = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'audit-nav-onglet-FICTIF-'));
  t.after(async () => {
    await provider.close().catch(() => {});
    rmSync(folder, { recursive: true, force: true });
  });
  return new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-onglet',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: [origin],
      ...extra,
    }),
    approve: async () => true,
  });
}

test(
  'Constat 6 (Chrome isolé) : onglet de mission fermé, la prochaine action en rouvre un',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const origin = await site(t);
    const provider = new CdpBrowser({ launch: { executablePath: CHROME } });
    const gateway = gatewayFor(t, provider, origin);
    await gateway.call('browser.navigate', { url: origin });
    await provider.page.close();
    const again = await gateway.call('browser.navigate', { url: origin });
    assert.equal(again.title, 'Offre FICTIVE');
    assert.match((await gateway.call('browser.snapshot', {})).snapshot, /FICTIF/);
  },
);

test(
  'Constat 6 (Chrome par CDP, transport propriétaire) : onglet fermé, la prochaine action en rouvre un',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const origin = await site(t);
    // Chrome headless jetable sur un port choisi par Chrome (jamais 19988).
    const profile = mkdtempSync(join(tmpdir(), 'audit-nav-cdp-FICTIF-'));
    const chrome = spawn(
      CHROME,
      [
        '--headless=new',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
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
    let port = null;
    for (let i = 0; i < 100 && !port; i++) {
      try {
        port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
      } catch {
        await sleep(100);
      }
    }
    assert.ok(port && port !== 19988, 'port CDP jetable');
    const provider = new CdpBrowser({
      endpoint: `http://127.0.0.1:${port}`,
      startupTimeoutMs: 12000,
    });
    // Comme la plateforme en mode propriétaire : le contexte du Chrome est partagé.
    const gateway = gatewayFor(t, provider, origin, { allowSharedContext: true });
    await gateway.call('browser.navigate', { url: origin });
    assert.equal(provider.name, 'playwriter-owner');
    await provider.page.close();
    const again = await gateway.call('browser.navigate', { url: origin });
    assert.equal(again.title, 'Offre FICTIVE');
    assert.match((await gateway.call('browser.snapshot', {})).snapshot, /FICTIF/);
  },
);

test(
  'Constat 6 : une ouverture échouée une fois ne ferme pas le navigateur pour la mission',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const origin = await site(t);
    let attempts = 0;
    const flaky = {
      launchPersistentContext: (...args) => {
        attempts++;
        if (attempts === 1) return Promise.reject(new Error('Démarrage FICTIF interrompu'));
        return chromium.launchPersistentContext(...args);
      },
    };
    const provider = new CdpBrowser({ launch: { executablePath: CHROME }, chromium: flaky });
    const gateway = gatewayFor(t, provider, origin);
    await assert.rejects(
      gateway.call('browser.navigate', { url: origin }),
      /Démarrage FICTIF interrompu/,
    );
    const again = await gateway.call('browser.navigate', { url: origin });
    assert.equal(again.title, 'Offre FICTIVE');
    assert.equal(attempts, 2);
  },
);
