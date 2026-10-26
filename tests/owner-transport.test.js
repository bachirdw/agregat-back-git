import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { ownerTransport } from '../packages/browser-gateway/owner-transport.js';

async function relay(t, options = {}) {
  const commands = [];
  let marker;
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        Browser: 'Playwriter/FICTIF',
        webSocketDebuggerUrl: `ws://127.0.0.1:${server.address().port}/cdp`,
      }),
    );
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', (socket) =>
    socket.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      commands.push(m);
      const emit = (message) => socket.send(JSON.stringify(message));
      let result = {};
      if (m.method === 'Target.createTarget') {
        if (options.mute) return;
        marker = m.params.url;
        result = { targetId: 'owned' };
        // Relay broadcasts user inventory before our createTarget response. It must stay invisible.
        emit({
          method: 'Target.attachedToTarget',
          params: {
            sessionId: 'USER-SESSION',
            targetInfo: { targetId: 'USER', url: 'https://private.example/', type: 'page' },
          },
        });
        emit({
          method: 'Target.attachedToTarget',
          params: {
            sessionId: 'own-session',
            targetInfo: { targetId: 'owned', url: marker, type: 'page' },
          },
        });
      } else if (m.method === 'Target.attachToTarget') result = { sessionId: 'own-session' };
      else if (m.method === 'Target.getTargetInfo')
        result = { targetInfo: { targetId: 'owned', url: marker, type: 'page' } };
      else if (m.method === 'Browser.getVersion')
        result = { product: 'Chrome/FICTIF', userAgent: 'FICTIF' };
      emit({ id: m.id, result });
    }),
  );
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    for (const socket of wss.clients) socket.terminate();
    wss.close();
    await new Promise((r) => server.close(r));
  });
  return { endpoint: `http://127.0.0.1:${server.address().port}`, commands };
}

test('transport propriétaire : inventaire filtré, pas d’auto-attachement global, aucune commande sur onglet utilisateur', async (t) => {
  const fake = await relay(t);
  const transport = await ownerTransport(fake.endpoint, 500);
  t.after(() => transport.close());
  const socket = new WebSocket(transport.endpoint);
  const received = [];
  socket.on('message', (raw) => received.push(JSON.parse(raw.toString())));
  await new Promise((r) => socket.once('open', r));
  let seq = 0;
  async function call(method, params = {}, sessionId) {
    const id = ++seq;
    socket.send(JSON.stringify({ id, method, params, sessionId }));
    const until = Date.now() + 1500;
    while (!received.some((m) => m.id === id) && Date.now() < until)
      await new Promise((r) => setTimeout(r, 5));
    const m = received.find((m) => m.id === id);
    assert.ok(m, 'réponse CDP attendue');
    return m;
  }
  assert.equal((await call('Target.setAutoAttach', { autoAttach: true })).error, undefined);
  assert.equal(
    fake.commands.some((m) => m.method === 'Target.setAutoAttach'),
    false,
  );
  const inventory = await call('Target.getTargets');
  assert.deepEqual(
    inventory.result.targetInfos.map((i) => i.targetId),
    ['owned'],
  );
  assert.equal(
    received.some((m) => m.params?.sessionId === 'USER-SESSION'),
    false,
  );
  for (const method of [
    'Target.closeTarget',
    'Target.attachToTarget',
    'Target.activateTarget',
    'Target.getTargetInfo',
  ])
    assert.match((await call(method, { targetId: 'USER' })).error.message, /périmètre/);
  assert.match((await call('Runtime.evaluate', {}, 'USER-SESSION')).error.message, /périmètre/);
  assert.match((await call('Browser.close')).error.message, /globale refusée/);
  // FICTIF : a page session must not turn a browser-scoped Target command into a bypass.
  for (const method of ['Target.getTargets', 'Target.setDiscoverTargets']) {
    const before = fake.commands.length;
    const response = await call(method, {}, 'own-session');
    if (method === 'Target.getTargets')
      assert.deepEqual(
        response.result.targetInfos.map((i) => i.targetId),
        ['owned'],
      );
    assert.equal(fake.commands.length, before, 'commande globale interceptée localement');
  }
  for (const method of ['Target.detachFromTarget', 'Target.sendMessageToTarget'])
    assert.ok((await call(method, { sessionId: 'USER-SESSION' }, 'own-session')).error);

  await call('Runtime.enable', {}, 'own-session');
  assert.ok(
    fake.commands.some((m) => m.method === 'Runtime.enable' && m.sessionId === 'own-session'),
  );
  await transport.close();
  socket.terminate();
  assert.deepEqual(
    fake.commands.filter((m) => m.method === 'Target.closeTarget').map((m) => m.params.targetId),
    ['owned'],
  );
});

test('transport propriétaire : relais muet, délai borné et fermeture sans onglet étranger', async (t) => {
  const fake = await relay(t, { mute: true });
  await assert.rejects(ownerTransport(fake.endpoint, 50), /Délai CDP/);
  assert.equal(
    fake.commands.some((m) => m.method === 'Target.closeTarget'),
    false,
  );
});

test('transport propriétaire : relais absent et métadonnées invalides refusés', async (t) => {
  await assert.rejects(ownerTransport('http://127.0.0.1:1', 100));
  const server = http.createServer((req, res) => {
    res.end(JSON.stringify({ webSocketDebuggerUrl: 'ws://external.example/cdp' }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  await assert.rejects(
    ownerTransport(`http://127.0.0.1:${server.address().port}`, 100),
    /non local/,
  );
});
