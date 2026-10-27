// Mesure manager : quelles actions Playwright agissent dans l'onglet caché de Playwriter (page locale FICTIVE).
import http from 'node:http';
import { writeFileSync } from 'node:fs';
const R = '/private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/62314d27-478e-4cd9-88a7-f1034dbdd55d/scratchpad/wt-measure/packages';
const { BrowserGateway, CdpBrowser } = await import(`${R}/browser-gateway/index.js`);
const { RunPolicy } = await import(`${R}/policy-engine/run-policy.js`);
const { capabilityIds } = await import(`${R}/capability-registry/index.js`);

const status = await fetch('http://127.0.0.1:19988/extension/status', {
  signal: AbortSignal.timeout(3000),
}).then((r) => r.json());
console.log(JSON.stringify({ step: 'extension/status', connected: status.connected === true }));
if (status.connected !== true) process.exit(2);
const file = '/private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/62314d27-478e-4cd9-88a7-f1034dbdd55d/scratchpad/fictif.txt';
writeFileSync(file, 'FICTIF');
const server = http.createServer((_req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(`<title>FICTIF mesure</title>
  <script>window.ev=[];const log=(e)=>ev.push(e.type+':'+(e.target.id||e.target.tagName));
  for (const t of ['input','change','keydown','keyup','submit']) addEventListener(t, (e)=>{log(e); if(t==='submit') e.preventDefault();}, true);</script>
  <form id="f"><input id="t" aria-label="Texte"><input id="k" aria-label="Touches">
  <select id="s" aria-label="Liste"><option value="a">A</option><option value="b">B</option></select>
  <input id="c" type="checkbox" aria-label="Case"><input id="fi" type="file" aria-label="Fichier">
  <input id="hid" type="file" style="display:none"><button type="button" id="up" onclick="document.getElementById('hid').click()">Joindre</button></form>`);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 5000 });
const gateway = new BrowserGateway({
  provider,
  policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'FICTIF-mesure', capabilities: capabilityIds, allowLocalOrigins: [origin] }),
  approve: async () => true,
});
const rows = [];
try {
  await gateway.call('browser.navigate', { url: origin });
  const page = provider.page;
  const vis = await page.evaluate(() => document.visibilityState);
  console.log(JSON.stringify({ step: 'visibility', visibilityState: vis }));
  const run = async (name, action, effect) => {
    await page.evaluate(() => (window.ev = []));
    const t0 = Date.now();
    let error = null;
    try {
      await action();
    } catch (e) {
      error = String(e.message).split('\n')[0].slice(0, 120);
    }
    const ms = Date.now() - t0;
    const result = await effect().catch((e) => 'effet illisible: ' + e.message.slice(0, 60));
    const events = await page.evaluate(() => window.ev.join(' '));
    rows.push({ name, ms, error, result, events });
    console.log(JSON.stringify(rows.at(-1)));
  };
  const o = { timeout: 3000 };
  await run('fill', () => page.locator('#t').fill('FICTIF', o), () => page.locator('#t').inputValue());
  await run('pressSequentially', () => page.locator('#k').pressSequentially('ab', o), () => page.locator('#k').inputValue());
  await run('press Backspace', () => page.locator('#k').press('Backspace', o), () => page.locator('#k').inputValue());
  await run('press Enter', () => page.locator('#t').press('Enter', o), async () => 'voir événements');
  await run('selectOption', () => page.locator('#s').selectOption('b', o), () => page.locator('#s').inputValue());
  await run('setChecked', () => page.locator('#c').setChecked(true, o), () => page.locator('#c').isChecked());
  await run('setInputFiles', () => page.locator('#fi').setInputFiles(file, o), () => page.locator('#fi').evaluate((e) => e.files[0]?.name ?? null));
  await run('filechooser + clic DOM', async () => {
    const chooser = page.waitForEvent('filechooser', { timeout: 3000 });
    await page.locator('#up').evaluate((el) => el.click());
    await (await chooser).setFiles(file);
  }, () => page.locator('#hid').evaluate((e) => e.files[0]?.name ?? null));
} finally {
  await provider.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
}
