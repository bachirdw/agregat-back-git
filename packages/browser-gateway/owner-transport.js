import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

// A local CDP view containing ONLY targets created by this connection. In particular never
// forward root auto-attach or browser-wide settings to the user's existing tabs.
export async function ownerTransport(endpoint, timeoutMs = 10000) {
  const base = new URL(endpoint);
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname)
  )
    throw new Error('Relais local HTTP/HTTPS requis');
  const metadata = await fetch(new URL('/json/version', endpoint), {
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!metadata.ok) throw new Error(`Relais indisponible : HTTP ${metadata.status}`);
  const info = await metadata.json();
  const url = new URL(info.webSocketDebuggerUrl);
  if (
    !['ws:', 'wss:'].includes(url.protocol) ||
    url.hostname !== base.hostname ||
    url.username ||
    url.password
  )
    throw new Error('WebSocket du relais non local');
  const upstream = new WebSocket(url, { maxPayload: 16 * 1024 * 1024 });
  const pending = new Map(),
    targets = new Set(),
    sessions = new Set();
  let seq = 0,
    downstream,
    targetInfo,
    targetSession;
  const marker = `about:blank#relay-${randomUUID()}`;
  const send = (message) => {
    if (downstream?.readyState === WebSocket.OPEN) downstream.send(JSON.stringify(message));
  };
  const rpc = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Délai CDP : ${method}`));
      }, timeoutMs);
      pending.set(id, { method, resolve, reject, timer });
      upstream.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  upstream.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(raw.toString());
    } catch {
      upstream.terminate();
      return;
    }
    if (m.id) {
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      clearTimeout(p.timer);
      if (p.method === 'Target.createTarget' && m.result?.targetId) targets.add(m.result.targetId);
      if (p.method === 'Target.attachToTarget' && m.result?.sessionId)
        sessions.add(m.result.sessionId);
      if (m.error) p.reject(new Error(m.error.message));
      else p.resolve(m.result ?? {});
      return;
    }
    const ti = m.params?.targetInfo;
    if (ti?.url === marker || (ti?.openerId && targets.has(ti.openerId))) targets.add(ti.targetId);
    if (m.method === 'Target.attachedToTarget') {
      if (!targets.has(ti?.targetId) && !sessions.has(m.sessionId)) return;
      sessions.add(m.params.sessionId);
      if (ti?.type === 'page' && (!targetInfo || ti.url === marker)) {
        targetInfo = ti;
        targetSession = m.params.sessionId;
      }
    } else if (m.sessionId) {
      if (!sessions.has(m.sessionId)) return;
    } else if (!targets.has(ti?.targetId ?? m.params?.targetId)) return;
    send(m);
  });
  const rejectPending = () => {
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error('Transport CDP fermé'));
    }
    pending.clear();
  };
  upstream.on('close', () => {
    rejectPending();
    downstream?.close();
  });
  upstream.on('error', () => {});
  const server = http.createServer();
  const wss = new WebSocketServer({
    server,
    path: '/' + marker.split('#')[1],
    maxPayload: 16 * 1024 * 1024,
  });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    // Cleanup only our created targets and their popups, never the user inventory.
    for (const targetId of targets)
      if (upstream.readyState === WebSocket.OPEN)
        await rpc('Target.closeTarget', { targetId }).catch(() => {});
    downstream?.terminate();
    upstream.terminate();
    rejectPending();
    wss.close();
    if (server.listening) await new Promise((r) => server.close(r));
  };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Délai connexion relais')), timeoutMs);
      upstream.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
      upstream.once('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
    const created = await rpc('Target.createTarget', { url: marker });
    if (typeof created.targetId !== 'string')
      throw new Error('Relais : identifiant de cible absent');
    targets.add(created.targetId);
    const attached = await rpc('Target.attachToTarget', {
      targetId: created.targetId,
      flatten: true,
    });
    if (typeof attached.sessionId !== 'string')
      throw new Error('Relais : identifiant de session absent');
    targetSession = attached.sessionId;
    sessions.add(targetSession);
    targetInfo ??= (await rpc('Target.getTargetInfo', { targetId: created.targetId })).targetInfo;
    wss.on('connection', (socket) => {
      if (downstream) return socket.close();
      downstream = socket;
      socket.on('message', async (raw) => {
        let m;
        try {
          m = JSON.parse(raw.toString());
        } catch {
          socket.close(1003, 'JSON invalide');
          return;
        }
        try {
          let result;
          if (m.sessionId) {
            if (!sessions.has(m.sessionId)) throw new Error('Session hors périmètre');
            if (m.method.startsWith('Browser.')) throw new Error('Commande globale refusée');
            if (m.params?.targetId && !targets.has(m.params.targetId))
              throw new Error('Cible hors périmètre');
            result = await rpc(m.method, m.params, m.sessionId);
          } else if (m.method === 'Target.setAutoAttach') {
            send({
              method: 'Target.attachedToTarget',
              params: { sessionId: targetSession, targetInfo, waitingForDebugger: false },
            });
            result = {};
          } else if (m.method === 'Target.getTargets') result = { targetInfos: [targetInfo] };
          else if (m.method === 'Target.getTargetInfo') {
            if (m.params?.targetId && !targets.has(m.params.targetId))
              throw new Error('Cible hors périmètre');
            result = { targetInfo };
          } else if (m.method === 'Target.setDiscoverTargets') result = {};
          else if (m.method === 'Browser.setDownloadBehavior') {
            throw new Error(
              'Réglage global des téléchargements refusé ; utiliser les liens HTTP du gateway',
            );
          } else if (m.method === 'Browser.getVersion') result = await rpc(m.method, m.params);
          else if (m.method === 'Target.createTarget')
            result = await rpc(m.method, { ...m.params, url: marker });
          else if (
            ['Target.closeTarget', 'Target.attachToTarget', 'Target.activateTarget'].includes(
              m.method,
            )
          ) {
            if (!targets.has(m.params?.targetId)) throw new Error('Cible hors périmètre');
            result = await rpc(m.method, m.params);
          } else throw new Error(`Commande globale refusée : ${m.method}`);
          send({ id: m.id, result, ...(m.sessionId ? { sessionId: m.sessionId } : {}) });
        } catch (e) {
          send({
            id: m.id,
            error: { message: e.message },
            ...(m.sessionId ? { sessionId: m.sessionId } : {}),
          });
        }
      });
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    return { endpoint: `ws://127.0.0.1:${server.address().port}/${marker.split('#')[1]}`, close };
  } catch (e) {
    await close();
    throw e;
  }
}
