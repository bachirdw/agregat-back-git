import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

// E70 : the longest wait for the closing of one of our tabs at the end of a mission.
const CLOSE_MS = 1000;

// E65, E69, E70 (sondes du 06/11 sur le relais réel) : Playwriter keeps its clients by id
// (cdp-relay.ts, « /cdp/:clientId? », « default » without one). It refuses a second client with the
// same id (4004) but, closing it, removes the FIRST one from its table : that client stays connected
// and is never answered again (snapshots and navigations time out, tabs are never closed). Every
// connection of the platform therefore takes its own id ; another client (another mission, a tool,
// a probe) no longer cuts it. Other CDP endpoints (a plain Chrome) keep their address.
function clientUrl(url, info) {
  const own = new URL(url);
  if (/^Playwriter\//.test(info?.Browser ?? '') && /^\/cdp\/?$/.test(own.pathname))
    own.pathname = `/cdp/relay-${randomUUID()}`;
  return own;
}

// E70 (essai V3, 06/11) : if the relay dropped the gateway's connection, the mission's tabs would
// stay open in the owner's Chrome. Target identifiers do not change : a short new connection, with
// its own client id, closes them by id, all at once, settled within `ms`; a relay gone is ignored.
async function closeThrough(url, ids, ms) {
  const socket = new WebSocket(url, { maxPayload: 1024 * 1024 });
  socket.on('error', () => {});
  let timer;
  await Promise.race([
    new Promise((resolve) => {
      let left = ids.length;
      socket.once('close', resolve);
      socket.on('message', (raw) => {
        try {
          if (JSON.parse(raw.toString()).id && --left === 0) resolve();
        } catch {
          resolve();
        }
      });
      socket.once('open', () =>
        ids.forEach((targetId, index) =>
          socket.send(
            JSON.stringify({ id: index + 1, method: 'Target.closeTarget', params: { targetId } }),
          ),
        ),
      );
    }),
    new Promise((resolve) => {
      timer = setTimeout(resolve, ms);
    }),
  ]);
  clearTimeout(timer);
  socket.terminate();
}

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
  const upstream = new WebSocket(clientUrl(url, info), { maxPayload: 16 * 1024 * 1024 });
  const pending = new Map(),
    targets = new Set(),
    sessions = new Set();
  let seq = 0,
    downstream,
    targetInfo,
    targetSession,
    openedWindow = null,
    windowWaiter = null;
  const marker = `about:blank#relay-${randomUUID()}`;
  const send = (message) => {
    if (downstream?.readyState === WebSocket.OPEN) downstream.send(JSON.stringify(message));
  };
  const rpc = (method, params = {}, sessionId, ms = timeoutMs) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`Délai CDP : ${method}`));
      }, ms);
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
      // The extension does not attach a tab opened by the site: keep its address for the provider.
      if (m.method === 'Page.windowOpen') {
        openedWindow = m.params?.url ?? '';
        const wake = windowWaiter;
        windowWaiter = null;
        wake?.();
      }
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
    // Cleanup only our created targets and their popups, never the user inventory. E70 : all at
    // once, each bounded to 1 s : at the end of a mission the gateway gets SIGTERM, then SIGKILL
    // after a short grace, and a slow relay or a frozen tab used to keep the next tabs open.
    if (upstream.readyState === WebSocket.OPEN)
      await Promise.all(
        [...targets].map((targetId) =>
          rpc('Target.closeTarget', { targetId }, undefined, CLOSE_MS).catch(() => {}),
        ),
      );
    else if (targets.size) await closeThrough(clientUrl(url, info), [...targets], CLOSE_MS);
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
          if (m.sessionId && !sessions.has(m.sessionId)) throw new Error('Session hors périmètre');
          if (m.sessionId && !m.method.startsWith('Target.')) {
            if (m.method.startsWith('Browser.')) throw new Error('Commande globale refusée');
            if (m.params?.targetId && !targets.has(m.params.targetId))
              throw new Error('Cible hors périmètre');
            result = await rpc(m.method, m.params, m.sessionId);
          } else if (m.method === 'Target.setAutoAttach') {
            if (!m.sessionId)
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
    return {
      endpoint: `ws://127.0.0.1:${server.address().port}/${marker.split('#')[1]}`,
      close,
      takeOpenedWindow() {
        const url = openedWindow;
        openedWindow = null;
        return url;
      },
      async waitOpenedWindow(ms) {
        if (openedWindow !== null) return;
        let timer;
        await new Promise((resolve) => {
          windowWaiter = resolve;
          timer = setTimeout(resolve, ms);
        });
        clearTimeout(timer);
        windowWaiter = null;
      },
    };
  } catch (e) {
    await close();
    throw e;
  }
}
