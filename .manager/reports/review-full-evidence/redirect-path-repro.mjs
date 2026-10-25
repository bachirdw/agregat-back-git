// Défaut connu NON CORRIGÉ : reproduction rouge explicite, hors de la suite npm test.
// node --test .manager/reports/review-full-evidence/redirect-path-repro.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';
test('redirection de chemin FICTIVE : URL et lien relatif doivent refléter la cible', async (t) => {
  const site = http.createServer((req,res) => {
    if (req.url === '/redirect') { res.writeHead(302, { location: '/nested/page' }); return res.end(); }
    res.setHeader('content-type','text/html'); res.end('<title>FICTIF</title><a href="child">FICTIF</a>');
  });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${site.address().port}`;
  const provider = new CdpBrowser({ launch: { executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' } });
  t.after(async () => { await provider.close(); site.closeAllConnections(); await new Promise((r) => site.close(r)); });
  const gateway = new BrowserGateway({ provider, policy: new RunPolicy({ allowLocalOrigins: [origin] }) });
  const result = await gateway.call('browser.navigate', { url: origin + '/redirect' });
  const href = await provider.page.locator('a').evaluate((a) => a.href);
  console.log('FICTIF', JSON.stringify({ url: result.url, href }));
  assert.equal(result.url, origin + '/nested/page');
  assert.equal(href, origin + '/nested/child');
});
