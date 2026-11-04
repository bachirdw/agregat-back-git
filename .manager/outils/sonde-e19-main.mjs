// Sonde E19 ter : titre de la section « À propos », défilement du conteneur interne MAIN, et présence
// des lignes de la description dans le snapshot d'accessibilité. Longueurs et booléens seulement.
import { BrowserGateway, CdpBrowser } from '../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../packages/capability-registry/index.js';
const url = process.argv[2];
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 15000 });
const gateway = new BrowserGateway({ provider, policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'SONDE-e19c', capabilities: capabilityIds }), approve: async () => false });
const section = () => provider.page.evaluate(() => {
  const text = document.body?.innerText ?? '';
  const i = text.indexOf('À propos');
  const lines = text.slice(i).split('\n').map((l) => l.trim()).filter(Boolean);
  return { heading: lines[0]?.slice(0, 40), lines: lines.length, chars: text.length - i, probe: lines.slice(2, 6).map((l) => l.slice(0, 24)) };
});
try {
  await gateway.call('browser.navigate', { url });
  await new Promise((r) => setTimeout(r, 6000));
  const before = await section();
  console.log('avant  :', JSON.stringify({ heading: before.heading, lines: before.lines, chars: before.chars }));
  await provider.page.evaluate(() => { const m = document.querySelector('main'); if (m) m.scrollTo(0, m.scrollHeight); });
  await new Promise((r) => setTimeout(r, 5000));
  const after = await section();
  console.log('après scroll MAIN :', JSON.stringify({ heading: after.heading, lines: after.lines, chars: after.chars }));
  const snap = JSON.stringify(await gateway.call('browser.snapshot', {}));
  console.log('snapshot : chars', snap.length, '| lignes 3-6 de la section présentes dans le snapshot :', after.probe.map((p) => snap.includes(p)));
} finally { await provider.close(); }
