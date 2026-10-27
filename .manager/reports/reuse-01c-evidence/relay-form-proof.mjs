// Preuve manager reuse-01c : formulaire FICTIF parcouru par le gateway dans l'onglet caché de Playwriter.
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
const folder = mkdtempSync(join(tmpdir(), 'relay-form-proof-'));
writeFileSync(join(folder, 'cv.txt'), 'FICTIF');
let posts = 0;
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  if (req.method === 'POST') {
    posts++;
    return res.end('<title>FICTIF envoyé</title>');
  }
  res.end(`<title>FICTIF formulaire</title><form method="post">
  <label>Nom <input id="name"></label>
  <label>Ville <input id="city" onkeydown="document.body.dataset.key=event.key"></label>
  <label>Pays <select id="country"><option value="fr">France</option><option value="au">Australie</option></select></label>
  <label>Accord <input id="ok" type="checkbox"></label>
  <input id="cv" type="file" style="display:none">
  <button type="button" onclick="document.getElementById('cv').click()">Joindre</button>
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
    runId: 'FICTIF-reuse-01c',
    workspace: folder,
    capabilities: capabilityIds,
    allowLocalOrigins: [origin],
  }),
  approve: async () => true,
});
try {
  const t0 = Date.now();
  await gateway.call('browser.navigate', { url: origin });
  const page = provider.page;
  console.log(JSON.stringify({ step: 'visibility', visibilityState: await page.evaluate(() => document.visibilityState) }));
  console.log(JSON.stringify({ step: 'snapshot-start' }));
  const snapshot = (await gateway.call('browser.snapshot')).snapshot;
  console.log(JSON.stringify({ step: 'snapshot-done', lines: snapshot.split('\n').length }));
  const ref = (name) =>
    snapshot.split('\n').find((l) => l.includes(`"${name}"`) && l.includes('[ref='))?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
  const steps = {};
  const timed = async (name, fn) => {
    const s = Date.now();
    console.log(JSON.stringify({ step: 'start', name }));
    const out = await fn();
    steps[name] = { ms: Date.now() - s, ...out };
    console.log(JSON.stringify({ step: 'done', name, ms: steps[name].ms }));
  };
  await timed('type', () => gateway.call('browser.type', { ref: ref('Nom'), text: 'FICTIF Nom' }));
  await timed('press', () => gateway.call('browser.press', { ref: ref('Ville'), key: 'ArrowDown' }));
  await timed('select', () => gateway.call('browser.select', { ref: ref('Pays'), values: ['Australie'] }));
  await timed('check', () => gateway.call('browser.check', { ref: ref('Accord'), checked: true }));
  await timed('upload', () => gateway.call('browser.upload', { ref: ref('Joindre'), path: 'cv.txt' }));
  const state = await page.evaluate(() => ({
    name: document.querySelector('#name').value,
    key: document.body.dataset.key ?? null,
    country: document.querySelector('#country').value,
    ok: document.querySelector('#ok').checked,
    cv: Array.from(document.querySelector('#cv').files, (f) => f.name),
  }));
  console.log(JSON.stringify({ step: 'actions', steps }));
  console.log(JSON.stringify({ step: 'state', ...state, posts, totalMs: Date.now() - t0 }));
  const ok =
    state.name === 'FICTIF Nom' && state.key === 'ArrowDown' && state.country === 'au' && state.ok && state.cv[0] === 'cv.txt' && posts === 0;
  if (!ok) throw new Error('État final inattendu');
} finally {
  await provider.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  rmSync(folder, { recursive: true, force: true });
}
