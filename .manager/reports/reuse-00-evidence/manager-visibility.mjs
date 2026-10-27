// Sonde du manager : l'onglet agent créé via Playwriter est-il caché, et un screencast CDP le rend-il visible ?
// Page FICTIVE locale uniquement.
import http from 'node:http';
import { chromium } from '/Users/diaw/Downloads/agregat-back/node_modules/playwright-core/index.mjs';
import { ownerTransport } from '/Users/diaw/Downloads/agregat-back/packages/browser-gateway/owner-transport.js';
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><title>FICTIF</title><button id="go">FICTIF cliquez</button><output id="n">0</output><script>window.c=0;go.onclick=()=>{window.c++;document.querySelector('output').textContent=String(window.c)}</script>`);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/fictif`;
const log = (step, extra) => console.log(JSON.stringify({ step, ...extra }));
let browser, transport;
try {
  transport = await ownerTransport('http://127.0.0.1:19988');
  browser = await chromium.connectOverCDP(transport.endpoint, { noDefaults: true, isLocal: true });
  const page = await browser.contexts()[0].newPage();
  await page.goto(url);
  const state = () => page.evaluate(() => ({ vis: document.visibilityState, focus: document.hasFocus(), count: document.querySelector('output').textContent }));
  const click = async (name, opts) => {
    const t = Date.now();
    try { await page.locator('#go').click({ timeout: 3000, ...opts }); log(name, { ok: true, ms: Date.now() - t, ...(await state()) }); }
    catch (e) { log(name, { ok: false, ms: Date.now() - t, err: e.message.split('\n')[0].slice(0, 90), ...(await state()) }); }
  };
  log('initial', await state());
  await click('force-sans-screencast', { force: true });
  await click('normal-sans-screencast', {});
  const cdp = await page.context().newCDPSession(page);
  try { await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 10, everyNthFrame: 30 }); log('screencast', { ok: true }); }
  catch (e) { log('screencast', { ok: false, err: e.message.slice(0, 120) }); }
  cdp.on('Page.screencastFrame', (f) => cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}));
  await page.waitForTimeout(1000);
  log('apres-screencast', await state());
  await click('force-avec-screencast', { force: true });
  await click('normal-avec-screencast', {});
  await cdp.send('Page.stopScreencast').catch(() => {});
  await page.close();
} catch (e) { log('erreur', { err: e.message.slice(0, 200) }); }
finally { await browser?.close().catch(() => {}); await transport?.close().catch(() => {}); server.closeAllConnections(); await new Promise((r) => server.close(r)); }
