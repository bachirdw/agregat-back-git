// Preuve manager des corrections de la relecture reuse-01c : onglet caché RÉEL de Playwriter, page FICTIVE.
// Chaque cas est indépendant : ROUGE/VERT par constat, pour comparer ancien et nouveau code.
import http from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../../packages/capability-registry/index.js';

const status = await fetch('http://127.0.0.1:19988/extension/status', {
  signal: AbortSignal.timeout(3000),
}).then((r) => r.json());
console.log(JSON.stringify({ step: 'extension/status', connected: status.connected === true }));
if (status.connected !== true) process.exit(2);
const folder = mkdtempSync(join(tmpdir(), 'relay-review-proof-'));
writeFileSync(join(folder, 'cv.txt'), 'FICTIF');
let posts = 0;
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  if (req.method === 'POST') {
    posts++;
    return res.end('<title>FICTIF envoyé</title>');
  }
  res.end(`<title>FICTIF relecture</title><form method="post">
  <label>Ville <input id="city" value="Sydnee"></label>
  <label>Liste <select id="list"><option value="Non">Oui</option><option value="Oui">Non</option></select></label>
  <label style="position:relative;display:inline-block">Stylée
    <input id="styled" type="checkbox" style="position:absolute;left:0;top:0;opacity:0">
    <span style="position:absolute;left:0;top:0;width:20px;height:20px;background:#ccc"></span>
  </label>
  <label>Recherche <input id="search" onkeydown="document.body.dataset.code=event.keyCode"></label>
  <label>Dépôt <input id="drop" type="file" onchange="document.body.dataset.dropped=this.files[0].name;this.value=''"></label>
  <button id="send">Envoyer</button></form>`);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 5000 });
const gateway = new BrowserGateway({
  provider,
  policy: new RunPolicy({
    ownerMode: true,
    allowSharedContext: true,
    runId: 'FICTIF-review-reuse-01c',
    workspace: folder,
    capabilities: capabilityIds,
    allowLocalOrigins: [origin],
  }),
  approve: async () => true,
});
let red = 0;
try {
  const t0 = Date.now();
  await gateway.call('browser.navigate', { url: origin });
  const page = provider.page;
  const visibilityState = await page.evaluate(() => document.visibilityState);
  console.log(JSON.stringify({ step: 'visibility', visibilityState }));
  if (visibilityState !== 'hidden') throw new Error('Onglet visible : preuve non probante');
  const snapshot = (await gateway.call('browser.snapshot')).snapshot;
  const ref = (name) =>
    snapshot
      .split('\n')
      .find((l) => l.includes(`"${name}"`) && l.includes('[ref='))
      ?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
  const read = (fn) => page.evaluate(fn);
  const cases = [
    ['n° 3 effacer', () => gateway.call('browser.type', { ref: ref('Ville'), text: '' }),
      () => read(() => document.querySelector('#city').value === '')],
    ['n° 11 valeur exacte', () => gateway.call('browser.select', { ref: ref('Liste'), values: ['Oui'] }),
      () => read(() => document.querySelector('#list').value === 'Oui')],
    ['n° 10 case stylée', () => gateway.call('browser.check', { ref: ref('Stylée'), checked: true }),
      () => read(() => document.querySelector('#styled').checked)],
    ['n° 9 keyCode', () => gateway.call('browser.press', { ref: ref('Recherche'), key: 'ArrowDown' }),
      () => read(() => document.body.dataset.code === '40')],
    ['n° 4 dépôt vidé', () => gateway.call('browser.upload', { ref: ref('Dépôt'), path: 'cv.txt' }),
      () => read(() => document.body.dataset.dropped === 'cv.txt')],
  ];
  for (const [name, act, effect] of cases) {
    const s = Date.now();
    let error = null;
    try {
      await act();
    } catch (e) {
      error = e.message.split('\n')[0].slice(0, 120);
    }
    const ok = !error && (await effect());
    if (!ok) red++;
    console.log(JSON.stringify({ case: name, verdict: ok ? 'VERT' : 'ROUGE', ms: Date.now() - s, error }));
  }
  console.log(JSON.stringify({ step: 'end', posts, totalMs: Date.now() - t0 }));
  if (posts) red++;
} finally {
  await provider.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  rmSync(folder, { recursive: true, force: true });
}
process.exitCode = red ? 1 : 0;
