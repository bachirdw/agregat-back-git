import http from 'node:http';
import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../../packages/capability-registry/index.js';

const status = await fetch('http://127.0.0.1:19988/extension/status', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
if (status.connected !== true) throw new Error('Playwriter non connecté');
let posts = 0;
const server = http.createServer((req, res) => {
  if (req.method === 'POST') posts++;
  res.setHeader('content-type', 'text/html');
  if (req.url === '/form') res.end('<title>FICTIF formulaire</title><form method="post" action="/api/apply"><button>Submit application</button></form>');
  else res.end('<title>FICTIF clic local</title><style>@keyframes move {from{transform:translateX(-20px)}to{transform:translateX(20px)}} #moving{animation:move .12s linear infinite alternate;margin:80px}</style><button id="moving" onclick="document.body.dataset.hits=(+document.body.dataset.hits||0)+1">FICTIF cliquer</button>');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 5000 });
let approvals = 0;
const gateway = new BrowserGateway({ provider, policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'FICTIF-proof', capabilities: capabilityIds, allowLocalOrigins: [origin] }), approve: async request => { if (request.capability === 'browser.click') approvals++; return false; }, autoApprove: ['browser.click'] });
const result = { fixture: 'FICTIF local', connected: true };
try {
  await gateway.call('browser.navigate', { url: origin });
  result.visibility = await provider.page.evaluate(() => document.visibilityState);
  const start = Date.now();
  const click = await gateway.call('browser.click', { selector: '#moving' });
  result.durationMs = Date.now() - start;
  result.clickMode = click.clickMode;
  result.hits = Number(await provider.page.locator('body').getAttribute('data-hits') ?? 0);
  await gateway.call('browser.navigate', { url: origin + '/form' });
  try { await gateway.call('browser.click', { selector: 'button' }); result.formRefused = false; }
  catch (error) { result.formRefused = /Action refusée/.test(error.message); }
  result.approvals = approvals;
  result.posts = posts;
  if (result.visibility !== 'hidden' || result.hits !== 1 || !['forced','dom-hidden-tab'].includes(result.clickMode) || !result.formRefused || approvals !== 1 || posts !== 0) process.exitCode = 1;
} catch (error) {
  result.error = { name: error.name, message: error.message };
  process.exitCode = 1;
} finally {
  await provider.close();
  server.closeAllConnections();
  await new Promise(r => server.close(r));
  console.log(JSON.stringify(result));
}
