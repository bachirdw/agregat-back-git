// Sonde E19 : ouvre une page dans le Chrome du propriétaire via le relais et mesure la visibilité et le rendu
// du corps de page (longueur de texte, présence de mots attendus, boutons « afficher plus »). Usage :
//   node .manager/outils/sonde-e19.mjs <url> [mots,attendus,séparés,par,virgules]
// Lecture seule, aucun clic, aucun texte de page imprimé.
import { BrowserGateway, CdpBrowser } from '../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../packages/capability-registry/index.js';
const url = process.argv[2];
const words = (process.argv[3] ?? 'About the job,À propos,Responsibilities,Requirements,Qualifications').split(',');
if (!url) throw new Error('url manquante');
const status = await fetch('http://127.0.0.1:19988/extension/status', { signal: AbortSignal.timeout(3000) }).then((r) => r.json());
if (status.connected !== true) throw new Error('Playwriter non connecté');
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 15000 });
const gateway = new BrowserGateway({ provider, policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'SONDE-e19', capabilities: capabilityIds }), approve: async () => false });
const measure = async (label) => {
  const m = await provider.page.evaluate((words) => {
    const text = document.body?.innerText ?? '';
    const html = document.documentElement.outerHTML;
    const low = text.toLowerCase();
    const btn = [...document.querySelectorAll('button')].map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim().toLowerCase()).filter((t) => /more|plus|voir/.test(t)).slice(0, 5);
    return {
      visibility: document.visibilityState, hasFocus: document.hasFocus(), ready: document.readyState,
      textChars: text.length, htmlChars: html.length,
      wordsInText: Object.fromEntries(words.map((w) => [w, low.includes(w.toLowerCase())])),
      wordsInHtml: Object.fromEntries(words.map((w) => [w, html.toLowerCase().includes(w.toLowerCase())])),
      descriptionNodes: document.querySelectorAll('[class*="description"], [id*="description"]').length,
      skeletons: document.querySelectorAll('[class*="skeleton"], [class*="placeholder"], [aria-busy="true"]').length,
      moreButtons: btn, scrollY: window.scrollY, height: document.documentElement.scrollHeight,
    };
  }, words);
  console.log(label, JSON.stringify(m));
};
try {
  await gateway.call('browser.navigate', { url });
  await measure('t+0s   ');
  await new Promise((r) => setTimeout(r, 10000));
  await measure('t+10s  ');
  await provider.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await new Promise((r) => setTimeout(r, 5000));
  await measure('scroll ');
  await provider.page.bringToFront().catch((e) => console.log('bringToFront refusé :', e.message));
  await new Promise((r) => setTimeout(r, 8000));
  await measure('front  ');
} finally {
  await provider.close();
}
