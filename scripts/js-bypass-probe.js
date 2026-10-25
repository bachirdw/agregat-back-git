// Sonde manuelle : JavaScript reste-t-il bloqué quand JS est désactivé par la politique ?
// Chaque page locale FICTIVE tente d'exécuter du script par un vecteur différent ; un script exécuté
// envoie une balise /hit?v=<vecteur> au serveur local, qui la compte. Attendu : 0 balise partout.
// Usage : PLAYWRITER_TELEMETRY=0 node scripts/js-bypass-probe.js            (relais Playwriter, consentement)
//         PROBE_ISOLATED=1 CHROME_PATH=... node scripts/js-bypass-probe.js   (Chrome isolé)
import http from 'node:http';
import assert from 'node:assert/strict';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';

if (process.env.PROBE_ISOLATED !== '1')
  assert.equal(process.env.PLAYWRITER_TELEMETRY, '0', 'PLAYWRITER_TELEMETRY=0 requis');
const hits = [];
const beacon = (v) => `new Image().src='/hit?v=${v}&t='+Date.now();document.title='JS ${v}'`;
const html = (body) => `<!doctype html><title>FICTIF ${body.length}</title>${body}`;
const pages = {
  '/inline': html(`<script>${beacon('inline')}</script>`),
  '/external': html(`<script src="/x.js"></script>`),
  '/handler': html(`<img src="/nope.png" onerror="${beacon('handler')}">`),
  '/srcdoc': html(
    `<iframe srcdoc="<script>parent.${beacon('srcdoc')}</script><script>${beacon('srcdoc2')}</script>"></iframe>`,
  ),
  '/data-iframe': html(
    `<iframe src="data:text/html,<script>${encodeURIComponent(beacon('data').replace("'/hit", `'${'ORIGIN'}/hit`))}</script>"></iframe>`,
  ),
  '/subframe': html(`<iframe src="/inline"></iframe>`),
  '/meta-csp': html(
    `<meta http-equiv="Content-Security-Policy" content="script-src * 'unsafe-inline'"><script>${beacon('meta')}</script>`,
  ),
  '/object': html(
    `<object data="data:text/html,<script>${encodeURIComponent(beacon('object'))}</script>"></object>`,
  ),
  '/svg': html(`<iframe src="/s.svg"></iframe>`),
  '/js-href': html(`<iframe src="javascript:${encodeURIComponent(beacon('jsurl'))}"></iframe>`),
};
const site = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/hit') {
    hits.push(url.searchParams.get('v'));
    return res.end();
  }
  if (url.pathname === '/x.js') return res.end(beacon('external'));
  if (url.pathname === '/s.svg') {
    res.setHeader('content-type', 'image/svg+xml');
    return res.end(
      `<svg xmlns="http://www.w3.org/2000/svg"><script>${beacon('svg')}</script></svg>`,
    );
  }
  const page = pages[url.pathname];
  if (!page) return res.writeHead(404).end();
  res.setHeader('content-type', 'text/html');
  res.end(page.replaceAll('ORIGIN', origin));
});
await new Promise((r) => site.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${site.address().port}`;

const isolated = process.env.PROBE_ISOLATED === '1';
const provider = isolated
  ? new CdpBrowser({ launch: { executablePath: process.env.CHROME_PATH } })
  : new CdpBrowser({ endpoint: process.env.RELAY_CDP_ENDPOINT ?? 'http://127.0.0.1:19988' });
const gw = new BrowserGateway({
  provider,
  policy: new RunPolicy({
    runId: 'PROBE-js',
    allowLocalOrigins: [origin],
    capabilities: ['browser.navigate'],
    allowSharedContext: !isolated,
    // Contre-épreuve : PROBE_JS=1 autorise JS ; la sonde DOIT alors détecter des exécutions.
    allowJavaScript: process.env.PROBE_JS === '1',
  }),
  approve: async (request) =>
    ['browser.shareContext', 'browser.enableJavaScript'].includes(request.capability),
});
let failures = 0;
let executions = 0;
try {
  const only = process.env.PROBE_ONLY?.split(',');
  for (const path of Object.keys(pages).filter((p) => !only || only.includes(p))) {
    const before = hits.length;
    let outcome;
    try {
      const out = await gw.call('browser.navigate', { url: origin + path });
      outcome = `titre « ${out.title} »`;
    } catch (e) {
      failures++; // Un refus ne prouve jamais que la page a été lue sans scripts.
      outcome = `ÉCHEC navigation refusée : ${e.message.slice(0, 120)}`;
    }
    await new Promise((r) => setTimeout(r, 1200));
    const fresh = hits.slice(before);
    const executed = fresh.length > 0 || /JS /.test(outcome);
    if (executed) {
      executions++;
      if (process.env.PROBE_JS !== '1') failures++;
    }
    console.log(
      `${executed ? (process.env.PROBE_JS === '1' ? 'EXÉCUTÉ (contre-épreuve)' : 'ÉCHEC') : 'OK   '} ${path.padEnd(13)} balises=${JSON.stringify(fresh)} ${outcome}`,
    );
  }
  try {
    await gw.call('browser.navigate', { url: `javascript:${beacon('direct')}` });
    failures++;
    console.log('ÉCHEC navigate javascript: accepté');
  } catch (e) {
    console.log(`OK    navigate javascript: refusé (${e.message.slice(0, 80)})`);
  }
} finally {
  const closing = provider.close();
  const timer = setTimeout(() => console.log('ÉCHEC fermeture bloquée > 15 s'), 15000);
  await closing;
  clearTimeout(timer);
  site.closeAllConnections();
  site.close();
}
if (process.env.PROBE_JS === '1' && executions === 0) failures++;
console.log(`${isolated ? 'Chrome isolé' : 'relais Playwriter'} : ${failures} échec(s)`);
process.exitCode = failures ? 1 : 0;
