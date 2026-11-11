// Sonde brute du relais Playwriter (identifiant de client propre, jamais /cdp nu) : l'onglet qu'il
// ouvre pour une mission est-il caché, ses minuteries bridées, et quelle commande CDP y remédie ?
// Ouvre un onglet sur la page donnée (défaut : page FICTIVE locale), puis le referme.
//   node .manager/outils/sonde-visibilite.mjs [url]
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
const ws = new WebSocket(`ws://127.0.0.1:19988/cdp/sonde-${randomUUID()}`);
await new Promise((r, j) => (ws.once('open', r), ws.once('error', j)));
let id = 0;
const replies = new Map();
ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  if (m.id) replies.get(m.id)?.(m);
});
const rpc = (method, params = {}, sessionId) =>
  Promise.race([
    new Promise((resolve) => {
      const n = ++id;
      replies.set(n, (m) => resolve(m.error ? { error: m.error.message ?? m.error } : m.result));
      ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
    }),
    new Promise((r) => setTimeout(() => r({ error: `délai ${method}` }), 20000)),
  ]);
const { targetId } = await rpc('Target.createTarget', { url: process.argv[2] ?? 'http://127.0.0.1:4321/' });
const { sessionId } = await rpc('Target.attachToTarget', { targetId, flatten: true });
const measure = `(async () => { const t0 = performance.now(); let n = 0;
  await new Promise((done) => { const tick = () => (++n >= 5 ? done() : setTimeout(tick, 100)); setTimeout(tick, 100); });
  return JSON.stringify({ visibility: document.visibilityState, focus: document.hasFocus(), fiveTimers100ms: Math.round(performance.now() - t0) }); })()`;
const state = async (label) => {
  const r = await rpc('Runtime.evaluate', { expression: measure, awaitPromise: true, returnByValue: true }, sessionId);
  console.log(label.padEnd(40), r.error ?? r.result?.value);
};
try {
  await new Promise((r) => setTimeout(r, 1500));
  await state('départ');
  for (const [method, params] of [
    ['Emulation.setFocusEmulationEnabled', { enabled: true }],
    ['Page.setWebLifecycleState', { state: 'active' }],
    ['Emulation.setFocusEmulationEnabled', { enabled: false }],
    ['Page.startScreencast', { format: 'jpeg', quality: 1, maxWidth: 16, maxHeight: 16, everyNthFrame: 1000 }],
    ['Page.stopScreencast', {}],
  ]) {
    const r = await rpc(method, params, sessionId);
    await state(`${method} ${JSON.stringify(params).slice(0, 18)}${r?.error ? ' REFUSÉ ' + r.error : ''}`);
  }
} finally {
  console.log('fermeture :', JSON.stringify(await rpc('Target.closeTarget', { targetId })));
  ws.close();
}
