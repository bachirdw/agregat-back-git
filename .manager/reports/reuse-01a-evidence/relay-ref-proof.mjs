import http from 'node:http';
import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../../packages/capability-registry/index.js';

const status = await fetch('http://127.0.0.1:19988/extension/status', { signal: AbortSignal.timeout(3000) }).then((response) => response.json());
console.log(JSON.stringify({ step: 'extension/status', connected: status.connected === true }));
if (status.connected !== true) process.exit(2);
const server = http.createServer((_request, response) => {
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.end('<title>FICTIF preuve ref</title><iframe title="Cadre FICTIF" srcdoc="<button onclick=&quot;document.body.dataset.hits=(+document.body.dataset.hits||0)+1&quot;>FICTIF compteur</button>"></iframe>');
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 5000 });
const gateway = new BrowserGateway({
  provider,
  policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'FICTIF-relay-ref-proof', capabilities: capabilityIds, allowLocalOrigins: [origin] }),
  approve: async () => true,
});
try {
  await gateway.call('browser.navigate', { url: origin });
  const visibilityState = await provider.page.evaluate(() => document.visibilityState);
  const snapshot = (await gateway.call('browser.snapshot')).snapshot;
  const ref = snapshot.match(/button "FICTIF compteur" \[ref=(f\d+e\d+)\]/)?.[1];
  console.log(JSON.stringify({ step: 'snapshot', visibilityState, ref, hasFrameRef: !!ref }));
  if (!ref) throw new Error('Référence iframe absente');
  const clicked = await gateway.call('browser.click', { ref });
  const count = await provider.page.frameLocator('iframe').locator('body').getAttribute('data-hits');
  console.log(JSON.stringify({ step: 'click', mode: clicked.clickMode, count }));
  if (count !== '1') throw new Error(`Compteur incorrect : ${count}`);
} finally {
  await provider.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
