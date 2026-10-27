import http from 'node:http';
import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../../packages/capability-registry/index.js';
const status = await fetch('http://127.0.0.1:19988/extension/status', { signal: AbortSignal.timeout(3000) }).then((r) => r.json());
console.log(JSON.stringify({ connected: status.connected === true }));
if (status.connected !== true) process.exit(2);
const server = http.createServer((_req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end('<title>FICTIF retrait</title><button onclick="document.body.dataset.hits=1;this.remove()">Retirer</button>');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 5000 });
const gateway = new BrowserGateway({ provider, policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'FICTIF-detach', capabilities: capabilityIds, allowLocalOrigins: [origin] }), approve: async () => true });
try {
  await gateway.call('browser.navigate', { url: origin });
  const hidden = await provider.page.evaluate(() => document.visibilityState === 'hidden');
  const snapshot = (await gateway.call('browser.snapshot')).snapshot;
  const ref = snapshot.match(/button "Retirer" \[ref=((?:f\d+)?e\d+)\]/)?.[1];
  if (!hidden || !ref) throw new Error('Prérequis caché/ref absent');
  const start = Date.now();
  const result = await gateway.call('browser.click', { ref });
  console.log(JSON.stringify({ hidden, clickMode: result.clickMode, durationMs: Date.now() - start, hits: await provider.page.locator('body').getAttribute('data-hits') }));
} finally {
  await provider.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
