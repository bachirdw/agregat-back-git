import http from 'node:http';
import { writeFileSync } from 'node:fs';
import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';
const server = http.createServer((_req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end('<title>FICTIF local</title><button id="counter" onclick="document.body.dataset.count = (+document.body.dataset.count || 0) + 1">Compter</button>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 5000 });
const gateway = new BrowserGateway({
  provider,
  policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'FICTIF-local-click', capabilities: ['browser.navigate', 'browser.click'], allowLocalOrigins: [origin] }),
  approve: async () => false,
});
const result = { fixture: 'FICTIF local', origin: '127.0.0.1', connected: false };
try {
  const status = await (await fetch('http://127.0.0.1:19988/extension/status')).json();
  result.connected = status.connected === true;
  if (!result.connected) throw new Error('Playwriter non connecté');
  await gateway.call('browser.navigate', { url: origin });
  result.visibility = await provider.page.evaluate(() => document.visibilityState);
  result.onclickInstalled = await provider.page.locator('#counter').evaluate((el) => typeof el.onclick === 'function');
  await provider.page.bringToFront();
  result.focusAfterFront = await provider.page.evaluate(() => document.hasFocus());
  result.visibilityAfterFront = await provider.page.evaluate(() => document.visibilityState);
  const start = Date.now();
  const clicked = await gateway.call('browser.click', { selector: '#counter' });
  result.clickMode = clicked.clickMode;
  result.durationMs = Date.now() - start;
  await new Promise((resolve) => setTimeout(resolve, 500));
  result.count = await provider.page.locator('body').getAttribute('data-count');
  result.afterUrl = new URL(provider.page.url()).pathname;
  if (result.count !== '1') {
    const box = await provider.page.locator('#counter').boundingBox();
    await provider.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    result.mouseCount = await provider.page.locator('body').getAttribute('data-count');
    await provider.page.locator('#counter').evaluate((el) => el.click());
    result.syntheticDomCount = await provider.page.locator('body').getAttribute('data-count');
    throw new Error('Le clic forcé n’a pas incrémenté le compteur local');
  }
} catch (error) {
  result.error = { name: error.name, message: error.message };
  process.exitCode = 1;
} finally {
  await provider.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  writeFileSync(new URL('./local-playwriter-result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
