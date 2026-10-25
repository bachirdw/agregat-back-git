// Test manuel de la Browser Gateway via le relais Playwriter (extension dans le Chrome de l'utilisateur).
// Usage : PLAYWRITER_TELEMETRY=0 node scripts/playwriter-smoke.js
// Lecture seule sur example.com, puis vérifie deux refus : domaine non autorisé, clic sans approbation.
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import http from 'node:http';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';

// Page locale FICTIVE : un script inline et un script externe changeraient le titre si JS s'exécutait.
const site = http.createServer((req, res) => {
  if (req.url === '/x.js') return res.end("document.title = 'JS EXTERNE EXÉCUTÉ'");
  res.setHeader('content-type', 'text/html');
  res.end(
    "<title>FICTIF sans script</title><script>document.title='JS INLINE EXÉCUTÉ'</script><script src='/x.js'></script>",
  );
});
await new Promise((r) => site.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${site.address().port}`;
const endpoint = process.env.RELAY_CDP_ENDPOINT ?? 'http://127.0.0.1:19988';
const provider = new CdpBrowser({ endpoint });
const gw = new BrowserGateway({
  provider,
  policy: new RunPolicy({
    runId: 'SMOKE-playwriter',
    allowedDomains: ['example.com'],
    allowLocalOrigins: [origin],
    capabilities: ['browser.navigate', 'browser.snapshot', 'browser.extract', 'browser.click'],
    // Playwriter ne crée pas de contexte isolé : le contexte partagé exige un consentement (ci-dessous).
    allowSharedContext: process.env.SMOKE_SHARED === '1',
  }),
  // Consentement de l'opérateur humain qui lance ce script : accordé UNIQUEMENT pour le contexte partagé,
  // toute autre demande (clic, saisie…) est refusée.
  approve: async (request) => {
    const text = JSON.stringify(request);
    const shared = /shared|partag/i.test(text);
    console.log(`APPROBATION ${shared ? 'accordée' : 'refusée'} :`, text.slice(0, 300));
    return shared;
  },
});
const step = async (name, fn) => {
  try {
    const out = await fn();
    console.log(`OK   ${name}:`, JSON.stringify(out).slice(0, 300));
  } catch (e) {
    console.log(`REFUS ${name}: ${e.message}`);
  }
};
try {
  await step('navigate example.com', () =>
    gw.call('browser.navigate', { url: 'https://example.com/' }),
  );
  await step('snapshot', () => gw.call('browser.snapshot', {}));
  await step('extract', () => gw.call('browser.extract', {}));
  await step('page locale avec scripts (attendu : titre « FICTIF sans script »)', () =>
    gw.call('browser.navigate', { url: origin + '/' }),
  );
  await step('navigate domaine interdit (attendu : refus)', () =>
    gw.call('browser.navigate', { url: 'https://www.google.com/' }),
  );
  await step('clic sensible, approbation refusée (attendu : refus)', () =>
    gw.call('browser.click', { selector: 'a' }),
  );
} finally {
  await provider.close();
  site.close();
  console.log('fermé : onglet de la plateforme fermé, Chrome utilisateur laissé ouvert');
}
