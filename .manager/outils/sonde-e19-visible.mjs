// Sonde E19 (suite) : même mesure que sonde-e19.mjs, mais en onglet caché avec une émulation de visibilité
// posée AVANT le chargement : document.visibilityState/hidden forcés, hasFocus vrai, requestAnimationFrame
// remplacé par un minuteur (les onglets cachés gèlent rAF), puis émulation de focus CDP si disponible.
// Aucun en-tête ni cookie modifié ; lecture seule, aucun texte de page imprimé. Usage :
//   node .manager/outils/sonde-e19-visible.mjs <url> [mots,attendus]
import { BrowserGateway, CdpBrowser } from '../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../packages/capability-registry/index.js';
const url = process.argv[2];
const words = (process.argv[3] ?? 'Responsibilities,À propos').split(',');
if (!url) throw new Error('url manquante');
const status = await fetch('http://127.0.0.1:19988/extension/status', { signal: AbortSignal.timeout(3000) }).then((r) => r.json());
if (status.connected !== true) throw new Error('Playwriter non connecté');
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 15000 });
const gateway = new BrowserGateway({ provider, policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'SONDE-e19-visible', capabilities: capabilityIds }), approve: async () => false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const measure = async (label) => {
  const m = await provider.page.evaluate((words) => {
    const text = document.body?.innerText ?? '';
    const low = text.toLowerCase();
    return { visibility: document.visibilityState, hidden: document.hidden, hasFocus: document.hasFocus(), ready: document.readyState, textChars: text.length,
      wordsInText: Object.fromEntries(words.map((w) => [w, low.includes(w.toLowerCase())])), height: document.documentElement.scrollHeight };
  }, words);
  console.log(label, JSON.stringify(m));
};
const override = () => {
  Object.defineProperty(Document.prototype, 'visibilityState', { get: () => 'visible', configurable: true });
  Object.defineProperty(Document.prototype, 'hidden', { get: () => false, configurable: true });
  Document.prototype.hasFocus = () => true;
  const raf = (cb) => setTimeout(() => cb(performance.now()), 16);
  window.requestAnimationFrame = raf;
  window.cancelAnimationFrame = (id) => clearTimeout(id);
};
try {
  await gateway.call('browser.navigate', { url });
  await sleep(8000);
  await measure('caché, sans émulation      ');
  await provider.page.addInitScript(override);
  await gateway.call('browser.navigate', { url });
  await sleep(10000);
  await measure('caché, émulation JS        ');
  let cdp = null;
  try {
    cdp = await provider.page.context().newCDPSession(provider.page);
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await gateway.call('browser.navigate', { url });
    await sleep(10000);
    await measure('caché, émulation JS + CDP  ');
  } catch (e) {
    console.log('émulation CDP indisponible :', e.message.split('\n')[0]);
  }
  await provider.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await sleep(5000);
  await measure('après visibilitychange     ');
} finally {
  await provider.close();
}
