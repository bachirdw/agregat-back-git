// Sonde du manager : un onglet agent montré une fois (Target.activateTarget) puis remis en arrière-plan
// reste-t-il visible et cliquable ? Deux onglets agents FICTIFS locaux, aucun onglet utilisateur touché.
import http from 'node:http';
import { ownerTransport } from '/Users/diaw/Downloads/agregat-back/packages/browser-gateway/owner-transport.js';
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><title>FICTIF ${req.url}</title><button id="go" style="position:absolute;left:20px;top:20px;width:200px;height:60px">FICTIF</button><script>window.c=0;go.onclick=()=>window.c++;window.raf=0;(function f(){window.raf++;requestAnimationFrame(f)})()</script>`);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const log = (step, extra) => console.log(JSON.stringify({ step, ...extra }));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function agent(name) {
  const transport = await ownerTransport('http://127.0.0.1:19988');
  const ws = new WebSocket(transport.endpoint);
  let id = 0, session; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
    if (m.method === 'Target.attachedToTarget') session = m.params.sessionId;
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } };
  const send = (method, params = {}, sid = session) => new Promise((resolve, reject) => { const mid = ++id; pending.set(mid, { resolve, reject }); ws.send(JSON.stringify({ id: mid, method, params, ...(sid ? { sessionId: sid } : {}) })); });
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, null);
  for (let i = 0; i < 20 && !session; i++) await sleep(50);
  const { targetInfos } = await send('Target.getTargets', {}, null);
  await send('Page.enable'); await send('Page.navigate', { url: `${base}/${name}` }); await sleep(1200);
  const state = async () => JSON.parse((await send('Runtime.evaluate', { expression: 'JSON.stringify({vis:document.visibilityState,count:window.c,raf:window.raf})', returnByValue: true })).result.value);
  const click = async () => { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: 120, y: 50, button: 'left', clickCount: 1 }); await sleep(300); };
  return { send, state, click, targetId: targetInfos[0].targetId, close: async () => { ws.close(); await transport.close().catch(() => {}); } };
}
let a, b;
try {
  a = await agent('A');
  log('A-cree-en-arriere-plan', await a.state());
  await a.send('Page.bringToFront'); await sleep(1000);
  log('A-active', await a.state()); await a.click(); log('A-active-apres-clic', await a.state());
  await a.send('Runtime.evaluate', { expression: "window.open('/B-popup')", userGesture: true }); await sleep(1500);
  log('A-remis-en-arriere-plan', await a.state()); await a.click(); log('A-arriere-plan-apres-clic', await a.state());
} catch (e) { log('erreur', { err: e.message.slice(0, 200) }); }
finally { await a?.close(); server.closeAllConnections(); await new Promise((r) => server.close(r)); }
