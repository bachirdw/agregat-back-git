import http from 'node:http';
import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../../packages/capability-registry/index.js';

const baseline = process.env.FICTIF_BASELINE === '1';
const status = await fetch('http://127.0.0.1:19988/extension/status', { signal: AbortSignal.timeout(3000) }).then((res) => res.json());
console.log(JSON.stringify({ step: 'extension/status', connected: status.connected === true }));
if (status.connected !== true) process.exit(2);
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  if (req.url === '/next') return res.end('<title>FICTIF suite</title><p id="arrived">Arrivé</p>');
  res.end(`<title>FICTIF relais</title>
    <button onclick="document.body.dataset.hits=(+document.body.dataset.hits||0)+1">Compter</button>
    <label>Case <input type="checkbox"></label>
    <button onmousedown="document.body.dataset.menu=1">Menu</button>
    <a href="/next">Suivant</a>
    <script>setInterval(() => history.replaceState({}, '', location.href), 100)</script>`);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 5000 });
const gateway = new BrowserGateway({
  provider,
  policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'FICTIF-reuse-01b', capabilities: capabilityIds, allowLocalOrigins: [origin] }),
  approve: async () => true,
});
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const getRef = async (name) => {
  const snapshot = (await gateway.call('browser.snapshot')).snapshot;
  const ref = snapshot.split('\n').find((line) => line.includes(`"${name}"`) && line.includes('[ref='))?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
  if (!ref) throw new Error(`Référence absente : ${name}`);
  return ref;
};
try {
  await gateway.call('browser.navigate', { url: origin });
  const visibilityState = await provider.page.evaluate(() => document.visibilityState);
  console.log(JSON.stringify({ step: 'visibility', visibilityState }));
  if (visibilityState !== 'hidden') throw new Error('Onglet du relais non caché');
  const times = [];
  let successes = 0;
  let lastMode;
  for (let i = 0; i < 10; i++) {
    const ref = await getRef('Compter');
    const start = Date.now();
    try {
      const result = await gateway.call('browser.click', { ref });
      lastMode = result.clickMode;
      successes++;
    } catch (error) {
      console.log(JSON.stringify({ step: 'click-error', iteration: i + 1, message: error.message.slice(0, 120) }));
    }
    times.push(Date.now() - start);
  }
  const count = await provider.page.locator('body').getAttribute('data-hits');
  console.log(JSON.stringify({ step: 'counter', successes, count: Number(count ?? 0), clickMode: lastMode, medianMs: median(times), timesMs: times }));
  if (!baseline) {
  if (successes !== 10 || count !== '10' || lastMode !== 'dom') throw new Error('Compteur ou mode du clic incorrect');
  const checkbox = await gateway.call('browser.click', { ref: await getRef('Case') });
  const checked = await provider.page.locator('input[type=checkbox]').isChecked();
  const menu = await gateway.call('browser.click', { ref: await getRef('Menu') });
  const opened = await provider.page.locator('body').getAttribute('data-menu');
  const link = await gateway.call('browser.click', { ref: await getRef('Suivant') });
  const arrived = await provider.page.locator('#arrived').count();
  console.log(JSON.stringify({ step: 'other', checked, opened, arrived, modes: [checkbox.clickMode, menu.clickMode, link.clickMode], hidden: [checkbox.hidden, menu.hidden, link.hidden] }));
  if (!checked || opened !== '1' || arrived !== 1 || [checkbox, menu, link].some((r) => r.clickMode !== 'dom' || r.hidden !== true)) throw new Error('Effet caché incorrect');
  }
} finally {
  await provider.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
