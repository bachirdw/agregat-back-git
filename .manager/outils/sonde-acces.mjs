// Sonde d'accès : ouvre une URL dans le Chrome du propriétaire via le relais (onglet caché) et dit si la page
// est lisible : hôte final (pas le chemin complet), redirection, longueur de texte, mots attendus, marqueurs
// de refus (403, CAPTCHA, mur de connexion). Lecture seule, aucun clic, aucun texte de page imprimé. Usage :
//   node .manager/outils/sonde-acces.mjs <url> [mots,attendus]
import { BrowserGateway, CdpBrowser } from '../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../packages/capability-registry/index.js';
const url = process.argv[2];
const words = (process.argv[3] ?? 'Apply,Quick apply,Postuler').split(',');
if (!url) throw new Error('url manquante');
const status = await fetch('http://127.0.0.1:19988/extension/status', { signal: AbortSignal.timeout(3000) }).then((r) => r.json());
if (status.connected !== true) throw new Error('Playwriter non connecté');
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 20000 });
const gateway = new BrowserGateway({ provider, policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'SONDE-acces', capabilities: capabilityIds }), approve: async () => false });
const host = (u) => { try { const x = new URL(u); return x.host + x.pathname.replace(/\d{5,}/g, '<n>').slice(0, 40); } catch { return '?'; } };
const measure = async (label) => {
  const m = await provider.page.evaluate((words) => {
    const text = document.body?.innerText ?? '';
    const low = text.toLowerCase();
    const nav = performance.getEntriesByType('navigation')[0];
    return { visibility: document.visibilityState, ready: document.readyState, textChars: text.length, title: (document.title || '').length,
      httpStatus: nav?.responseStatus ?? null, redirected: nav ? nav.redirectCount : null,
      wordsInText: Object.fromEntries(words.map((w) => [w, low.includes(w.toLowerCase())])),
      refusal: { forbidden: /403|access denied|forbidden|accès refusé/i.test(text.slice(0, 2000)), captcha: !!document.querySelector('iframe[src*="captcha"], [class*="captcha"], #challenge-form, [id*="cf-chl"]') || /verify you are human|are you a robot|captcha/i.test(low),
        loginWall: /sign in to continue|log in to continue|connectez-vous pour/i.test(low) } };
  }, words);
  console.log(label, 'hôte final :', host(provider.page.url()), JSON.stringify(m));
};
try {
  const result = await gateway.call('browser.navigate', { url });
  console.log('navigate : requestedUrl →', host(url), '; url →', host(result?.url ?? provider.page.url()));
  await measure('t+0s ');
  await new Promise((r) => setTimeout(r, 8000));
  await measure('t+8s ');
} finally {
  await provider.close();
}
