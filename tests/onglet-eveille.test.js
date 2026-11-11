// Essai réel du 11/11 (mission 8f365fd4, Chrome du propriétaire), Chrome headless isolé, pages
// FICTIVES locales : une navigation dont le document n'a pas fini au délai mais qui est arrivée
// n'est pas un échec ; un texte présent est dit trouvé même quand l'attente du chargement a pris
// tout le budget de la capture.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function site(t) {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    if (req.url === '/lente') {
      // The document never ends : « domcontentloaded » does not come, the body is there.
      res.write(
        '<!doctype html><meta charset="utf-8"><title>Offre lente FICTIVE</title><body><h1>Offre FICTIVE</h1>' +
          '<p>Responsibilities : poste FICTIF.</p>' +
          ' '.repeat(4096),
      );
      return;
    }
    if (req.url === '/muette') return; // nothing ever arrives : a real failure
    if (req.url === '/occupee')
      return res.end(
        '<!doctype html><meta charset="utf-8"><title>Occupée FICTIVE</title>' +
          '<div aria-busy="true">en cours</div><p>Minimum Qualifications : FICTIF.</p>',
      );
    res.end('<!doctype html><meta charset="utf-8"><title>Accueil FICTIF</title><h1>FICTIF</h1>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return `http://127.0.0.1:${server.address().port}`;
}

function gatewayFor(t, provider, origin) {
  const folder = mkdtempSync(join(tmpdir(), 'onglet-eveille-FICTIF-'));
  t.after(async () => {
    await provider.close().catch(() => {});
    rmSync(folder, { recursive: true, force: true });
  });
  return new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-eveille',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: [origin],
    }),
    approve: async () => true,
  });
}

test(
  'navigation arrivée mais document inachevé au délai : arrivée lente, pas un échec (Chrome isolé)',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const origin = await site(t);
    const provider = new CdpBrowser({
      launch: { executablePath: CHROME },
      navigationTimeoutMs: 1500,
    });
    const gateway = gatewayFor(t, provider, origin);
    await gateway.call('browser.navigate', { url: origin });
    const slow = await gateway.call('browser.navigate', { url: `${origin}/lente` });
    assert.equal(slow.url, `${origin}/lente`);
    assert.match(slow.slowLoad, /capturer/);
    const shot = await gateway.call('browser.snapshot', { waitForText: 'Responsibilities' });
    assert.match(shot.snapshot, /Offre FICTIVE/);
    assert.equal(shot.waitedFor.found, true);
    // A page that never answers stays a failure, and a fast one says nothing of slowness.
    await assert.rejects(gateway.call('browser.navigate', { url: `${origin}/muette` }), /Timeout/);
    const fast = await gateway.call('browser.navigate', { url: origin });
    assert.equal(fast.slowLoad, undefined);
  },
);

test(
  'texte attendu présent sur une page restée « en chargement » : dit trouvé (Chrome isolé)',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const origin = await site(t);
    const provider = new CdpBrowser({ launch: { executablePath: CHROME } });
    const gateway = gatewayFor(t, provider, origin);
    await gateway.call('browser.navigate', { url: `${origin}/occupee` });
    const shot = await gateway.call('browser.snapshot', { waitForText: 'Minimum Qualifications' });
    assert.equal(shot.loading, true);
    assert.deepEqual(shot.waitedFor, { text: 'Minimum Qualifications', found: true });
    const absent = await gateway.call('browser.snapshot', { waitForText: 'texte absent FICTIF' });
    assert.equal(absent.waitedFor.found, false);
  },
);
