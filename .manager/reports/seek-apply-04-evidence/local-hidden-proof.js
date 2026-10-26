import http from 'node:http';
import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../../packages/capability-registry/index.js';

const status = await fetch('http://127.0.0.1:19988/extension/status', { signal: AbortSignal.timeout(3000) }).then((r) => r.json());
if (status.connected !== true) throw new Error('Playwriter non connecté');
const server = http.createServer((_req, res) => {
  res.setHeader('content-type', 'text/html');
  res.end('<title>FICTIF clic local</title><style>@keyframes move{from{transform:translateX(-20px)}to{transform:translateX(20px)}}button{animation:move .12s linear infinite alternate;margin:80px}</style><button id="moving" onclick="document.body.dataset.hits=(+document.body.dataset.hits||0)+1">FICTIF cliquer</button>');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 5000 });
const gateway = new BrowserGateway({ provider, policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'FICTIF-hidden-proof', capabilities: capabilityIds, allowLocalOrigins: [origin] }), approve: async () => false, autoApprove: ['browser.click'] });
const result = { fixture: 'FICTIF local', connected: true };
try {
  await gateway.call('browser.navigate', { url: origin });
  result.visibilityBefore = await provider.page.evaluate(() => document.visibilityState);
  result.clickMode = (await gateway.call('browser.click', { selector: '#moving' })).clickMode;
  result.hitsBefore = Number(await provider.page.locator('body').getAttribute('data-hits') ?? 0);
  await provider.page.bringToFront();
  await new Promise((r) => setTimeout(r, 5000));
  result.visibilityAfter = await provider.page.evaluate(() => document.visibilityState);
  result.hitsAfter = Number(await provider.page.locator('body').getAttribute('data-hits') ?? 0);
  if (result.visibilityBefore !== 'hidden' || result.clickMode !== 'dom-hidden-tab' || result.hitsBefore !== 1 || result.hitsAfter !== 1) process.exitCode = 1;
} catch (error) {
  result.error = { name: error.name, message: error.message };
  process.exitCode = 1;
} finally {
  await provider.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  console.log(JSON.stringify(result));
}
