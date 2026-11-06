// Ferme, par le relais Playwriter, des onglets laissés par des missions, tests ou sondes : identifiants
// donnés par leur préfixe (node fermer-onglets-relais.mjs 8F7EC510 …). Jamais l'onglet du front Relay.
// Identifiant de client propre (/cdp/<id>) : un client « default » rendrait muette une mission en cours.
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
const wanted = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:19988/json/list')).json();
const targets = list.filter((t) => wanted.some((p) => t.id.startsWith(p)));
for (const t of targets) console.log('à fermer :', t.id.slice(0, 8), t.url.slice(0, 50));
if (targets.some((t) => /^http:\/\/127\.0\.0\.1:517\d/.test(t.url))) throw new Error('onglet du front Relay visé : arrêt');
const ws = new WebSocket(`ws://127.0.0.1:19988/cdp/fermeture-${randomUUID()}`);
await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); });
let id = 0; const replies = new Map();
ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.id) replies.get(m.id)?.(m); });
for (const t of targets) {
  const n = ++id;
  const reply = await Promise.race([new Promise((r) => { replies.set(n, r); ws.send(JSON.stringify({ id: n, method: 'Target.closeTarget', params: { targetId: t.id } })); }), new Promise((r) => setTimeout(() => r({ error: 'délai' }), 3000))]);
  console.log(t.id.slice(0, 8), JSON.stringify(reply.result ?? reply.error));
}
ws.close();
await new Promise((r) => setTimeout(r, 800));
console.log('restent :', (await (await fetch('http://127.0.0.1:19988/json/list')).json()).map((t) => t.id.slice(0, 8) + ' ' + t.url.slice(0, 40)));
