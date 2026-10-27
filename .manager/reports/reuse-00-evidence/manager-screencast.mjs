// Sonde du manager (CDP brut via notre ownerTransport) : un screencast rend-il l'onglet agent visible
// et les clics souris effectifs ? Page FICTIVE locale uniquement.
import http from 'node:http';
import { ownerTransport } from '/Users/diaw/Downloads/agregat-back/packages/browser-gateway/owner-transport.js';
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><title>FICTIF</title><button id="go" style="position:absolute;left:20px;top:20px;width:200px;height:60px">FICTIF</button><output>0</output><script>window.c=0;go.onclick=()=>{window.c++;document.querySelector('output').textContent=String(window.c)};window.raf=0;(function f(){window.raf++;requestAnimationFrame(f)})()</script>`);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/fictif`;
const log = (step, extra) => console.log(JSON.stringify({ step, ...extra }));
const transport = await ownerTransport('http://127.0.0.1:19988');
const ws = new WebSocket(transport.endpoint);
let id = 0, session;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Target.attachedToTarget') session = m.params.sessionId;
  if (m.method === 'Page.screencastFrame') send('Page.screencastFrameAck', { sessionId: m.params.sessionId }).catch(() => {});
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
};
const send = (method, params = {}, sid = session) => new Promise((resolve, reject) => {
  const mid = ++id; pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params, ...(sid ? { sessionId: sid } : {}) }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = async () => (await send('Runtime.evaluate', { expression: 'JSON.stringify({vis:document.visibilityState,count:window.c,raf:window.raf})', returnByValue: true })).result.value;
const click = async () => {
  for (const type of ['mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x: 120, y: 50, button: 'left', clickCount: 1 });
};
try {
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, null);
  for (let i = 0; i < 20 && !session; i++) await sleep(50);
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate', { url }); await sleep(1500);
  log('initial', JSON.parse(await state()));
  await sleep(1000); log('raf-1s-plus-tard', JSON.parse(await state()));
  await click(); await sleep(300); log('clic-souris-sans-screencast', JSON.parse(await state()));
  await send('Page.startScreencast', { format: 'jpeg', quality: 10, everyNthFrame: 1 });
  await sleep(1500); log('screencast-actif', JSON.parse(await state()));
  await sleep(1000); log('raf-1s-plus-tard', JSON.parse(await state()));
  await click(); await sleep(300); log('clic-souris-avec-screencast', JSON.parse(await state()));
  await send('Page.stopScreencast'); await sleep(1000);
  log('screencast-arrete', JSON.parse(await state()));
} catch (e) { log('erreur', { err: e.message.slice(0, 200) }); }
finally { ws.close(); await transport.close().catch(() => {}); server.closeAllConnections(); await new Promise((r) => server.close(r)); }
