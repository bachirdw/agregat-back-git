// Sonde du manager : peut-on reproduire un VRAI onglet caché en Chrome isolé (pour les tests) ?
import http from 'node:http';
import { chromium } from '/Users/diaw/Downloads/agregat-back/node_modules/playwright-core/index.mjs';
const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><button id="go" style="position:absolute;left:20px;top:20px;width:200px;height:60px">FICTIF</button><script>window.c=0;go.onclick=()=>window.c++;window.raf=0;(function f(){window.raf++;requestAnimationFrame(f)})()</script>`); });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const log = (step, extra) => console.log(JSON.stringify({ step, ...extra }));
const st = (p) => p.evaluate(() => ({ vis: document.visibilityState, raf: window.raf, c: window.c }));
const tryClick = async (p, name, opts = {}) => { try { await p.locator('#go').click({ timeout: 2000, ...opts }); } catch (e) { log(name + '-erreur', { err: e.message.split('\n')[0].slice(0, 60) }); } log(name, await st(p)); };
for (const headless of [true, false]) {
  const dir = (await import('node:fs')).mkdtempSync('/private/tmp/claude-501/-Users-diaw-Downloads-agregat-back/62314d27-478e-4cd9-88a7-f1034dbdd55d/scratchpad/probe/profil-');
  const context = await chromium.launchPersistentContext(dir, { executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless, ignoreDefaultArgs: ['--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'] });
  const browser = context;
  try {
    const a = await context.newPage(); await a.goto(url);
    const cdp = await context.newCDPSession(a);
    const [bg] = await Promise.all([context.waitForEvent('page'), cdp.send('Target.createTarget', { url: url + '?bg', background: true })]);
    await bg.waitForLoadState(); await bg.waitForTimeout(800);
    log(`headless=${headless} onglet-background`, await st(bg));
    await tryClick(bg, `headless=${headless} clic-normal`);
    await tryClick(bg, `headless=${headless} clic-force`, { force: true });
  } catch (e) { log('erreur', { headless, err: e.message.slice(0, 160) }); }
  finally { await browser.close(); }
}
server.closeAllConnections(); server.close();
