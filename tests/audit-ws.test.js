// Audit du 10/11, correctif WebSocket (audit-ws). Chrome headless isolé, pages et serveur WebSocket
// FICTIFS locaux, aucun site réel, aucun agent. Règle du propriétaire : un envoi final (un message
// composé par l'agent) ne part jamais sans la carte, même par WebSocket ; le trafic ordinaire
// (présence, frappe en cours, accusés, battements) passe sans carte. `approve` répond « refusé »
// sauf mention contraire : tout message reçu par le serveur FICTIF serait parti sans accord.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';
import { refFor } from './support/click-ref.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const skip = !existsSync(CHROME);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TEXT = 'Bonjour FICTIF, voici ma candidature';

// Messagerie FICTIVE : la page ouvre un WebSocket vers son propre serveur, envoie un battement de
// présence (toutes les 150 ms), un indicateur de frappe à chaque saisie, et le message composé au
// clic du bouton « Envoyer » (hors formulaire), d'un bouton icône, ou à Entrée dans la zone.
const page = `
  <textarea id="ta" aria-label="Message"></textarea>
  <button id="send" type="button">Envoyer</button>
  <button id="icon" type="button" aria-label="Envoyer le message">➤</button>
  <button id="other" type="button">Marquer comme lu</button>
  <script>
    const ws = new WebSocket('ws://' + location.host + '/socket');
    window.ws = ws;
    ws.onopen = () => setInterval(() => ws.send(JSON.stringify({ type: 'presence' })), 150);
    const ta = document.getElementById('ta');
    ta.addEventListener('input', () => ws.send(JSON.stringify({ type: 'typing' })));
    const post = () => ws.send(JSON.stringify({ type: 'message', text: ta.value }));
    document.getElementById('send').onclick = post;
    document.getElementById('icon').onclick = post;
    document.getElementById('other').onclick = () => ws.send(JSON.stringify({ type: 'read', id: 7 }));
    ws.onmessage = (e) => { document.title = 'reçu ' + e.data; };
  </script>`;

async function site(t, html = page) {
  const frames = [];
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>FICTIF</title>${html}`);
  });
  const wss = new WebSocketServer({ server });
  wss.on('connection', (socket) =>
    socket.on('message', (data) => {
      const frame = JSON.parse(String(data));
      frames.push(frame);
      if (frame.type === 'message') socket.send('accusé');
    }),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    for (const client of wss.clients) client.terminate();
    wss.close();
    server.closeAllConnections();
    server.close();
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    frames,
    messages: () => frames.filter((f) => f.type === 'message'),
    count: (type) => frames.filter((f) => f.type === type).length,
  };
}

async function owner(t, origin, decide = () => false, options = null) {
  const folder = mkdtempSync(join(tmpdir(), 'audit-ws-FICTIF-'));
  const provider = new CdpBrowser(
    options ?? { launch: { executablePath: CHROME }, navigationTimeoutMs: 8000 },
  );
  const asked = [];
  const traced = [];
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-audit-ws',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: [origin],
      allowJavaScript: true,
      ...(options ? { allowSharedContext: true } : {}),
    }),
    approve: async (request) => {
      asked.push(request);
      return decide(request);
    },
    onAutoSend: (entry) => traced.push(entry.host),
  });
  t.after(async () => {
    await provider.close().catch(() => {});
    rmSync(folder, { recursive: true, force: true });
  });
  return {
    gateway,
    provider,
    asked,
    traced,
    sends: () => asked.filter((r) => r.actionClass === 'send'),
  };
}

async function ready(gateway, provider, s) {
  await gateway.call('browser.navigate', { url: s.origin });
  for (let i = 0; i < 80 && s.count('presence') < 1; i++) await sleep(25);
  assert.ok(s.count('presence') >= 1, 'la présence passe dès l’ouverture');
  await gateway.call('browser.type', { ref: await refFor(gateway, '#ta'), text: TEXT });
}

test(
  'WebSocket : le message composé par l’agent ne part pas sans carte (bouton « Envoyer » hors formulaire), la présence et la frappe passent',
  { skip },
  async (t) => {
    const s = await site(t);
    const { gateway, provider, sends } = await owner(t, s.origin);
    await ready(gateway, provider, s);
    assert.ok(s.count('typing') >= 1, 'l’indicateur de frappe passe sans carte');
    assert.equal(sends().length, 0, 'aucune carte pour la frappe');
    await gateway.call('browser.click', { ref: await refFor(gateway, '#send') }).catch(() => {});
    const presence = s.count('presence');
    await sleep(800);
    assert.ok(s.count('presence') > presence, 'la présence continue pendant la carte');
    assert.equal(sends().length, 1, 'une carte pour le message');
    assert.match(sends()[0].args.body, /FICTIF/);
    assert.deepEqual(s.messages(), [], 'refus : aucun message n’est parti');
  },
);

test('WebSocket : bouton icône d’envoi, refus → rien ne part', { skip }, async (t) => {
  const s = await site(t);
  const { gateway, provider, sends } = await owner(t, s.origin);
  await ready(gateway, provider, s);
  await gateway.call('browser.click', { ref: await refFor(gateway, '#icon') }).catch(() => {});
  await sleep(600);
  assert.equal(sends().length, 1, 'une carte');
  assert.deepEqual(s.messages(), []);
});

test(
  'WebSocket : accord de la carte → le message part une fois, compté au Bilan',
  { skip },
  async (t) => {
    const s = await site(t);
    const { gateway, provider, sends, traced } = await owner(t, s.origin, () => true);
    await ready(gateway, provider, s);
    const result = await gateway.call('browser.click', { ref: await refFor(gateway, '#send') });
    for (let i = 0; i < 60 && s.messages().length < 1; i++) await sleep(25);
    await sleep(300);
    assert.equal(sends().length, 1, 'une carte');
    assert.equal(s.messages().length, 1, 'le message part une fois');
    assert.equal(s.messages()[0].text, TEXT);
    // Compté une fois au Bilan : une soumission (sans statut HTTP), sur ce clic ou l'appel suivant.
    const next = await gateway.call('browser.snapshot', {});
    const counted = [...(result.submissions ?? []), ...(next.lateSubmissions ?? [])];
    assert.equal(counted.length, 1, 'l’envoi est compté une fois');
    assert.equal(counted[0].status, null);
    assert.deepEqual(traced, [], 'aucune écriture automatique en plus');
    // La réponse du serveur revient à la page.
    for (let i = 0; i < 40 && !(await provider.page.title()).startsWith('reçu'); i++)
      await sleep(25);
    assert.equal(await provider.page.title(), 'reçu accusé');
  },
);

test(
  'WebSocket : Entrée dans la zone de message demande la carte avant la touche',
  { skip },
  async (t) => {
    const html = page.replace(
      "ta.addEventListener('input'",
      "ta.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); post(); } });\n    ta.addEventListener('input'",
    );
    const s = await site(t, html);
    const { gateway, provider, sends } = await owner(t, s.origin);
    await ready(gateway, provider, s);
    await gateway
      .call('browser.press', { ref: await refFor(gateway, '#ta'), key: 'Enter' })
      .catch(() => {});
    await sleep(500);
    assert.equal(sends().length, 1, 'une carte');
    assert.deepEqual(s.messages(), []);
  },
);

test(
  'WebSocket : un clic ordinaire dont la trame ne porte aucune saisie de l’agent passe sans carte',
  { skip },
  async (t) => {
    const s = await site(t);
    const { gateway, provider, sends } = await owner(t, s.origin);
    await ready(gateway, provider, s);
    await gateway.call('browser.click', { ref: await refFor(gateway, '#other') });
    for (let i = 0; i < 40 && s.count('read') < 1; i++) await sleep(25);
    assert.equal(s.count('read'), 1, 'l’accusé de lecture passe');
    assert.equal(sends().length, 0, 'aucune carte');
  },
);

test(
  'WebSocket : un brouillon envoyé pendant la frappe et un battement qui répète la saisie passent sans carte',
  { skip },
  async (t) => {
    // La page synchronise le brouillon à chaque saisie, et son battement de présence porte le nom
    // saisi par l'agent (FICTIF) : il se répète, ce n'est pas un envoi.
    const html = page
      .replace(
        "ta.addEventListener('input', () => ws.send(JSON.stringify({ type: 'typing' })));",
        "ta.addEventListener('input', () => ws.send(JSON.stringify({ type: 'draft', text: ta.value })));",
      )
      .replace(
        "setInterval(() => ws.send(JSON.stringify({ type: 'presence' })), 150)",
        "setInterval(() => ws.send(JSON.stringify({ type: 'presence', who: document.getElementById('nom').value })), 150)",
      )
      .replace('<textarea', '<input id="nom" aria-label="Nom">\n  <textarea');
    const s = await site(t, html);
    const { gateway, provider, sends } = await owner(t, s.origin);
    await ready(gateway, provider, s);
    assert.ok(s.count('draft') >= 1, 'le brouillon passe pendant la frappe');
    await gateway.call('browser.type', {
      ref: await refFor(gateway, '#nom'),
      text: 'Camille FICTIF',
    });
    await sleep(400);
    await gateway.call('browser.click', { ref: await refFor(gateway, '#other') });
    const presence = s.frames.filter(
      (f) => f.type === 'presence' && f.who === 'Camille FICTIF',
    ).length;
    await sleep(600);
    assert.ok(
      s.frames.filter((f) => f.type === 'presence' && f.who === 'Camille FICTIF').length > presence,
      'le battement qui porte le nom continue après le clic',
    );
    assert.equal(s.count('read'), 1);
    assert.equal(sends().length, 0, 'aucune carte');
  },
);

test(
  'WebSocket : Entrée accordée (carte avant la touche) → le message part une fois, sans seconde carte',
  { skip },
  async (t) => {
    const html = page.replace(
      "ta.addEventListener('input'",
      "ta.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); post(); } });\n    ta.addEventListener('input'",
    );
    const s = await site(t, html);
    const { gateway, provider, asked } = await owner(t, s.origin, () => true);
    await ready(gateway, provider, s);
    const before = asked.length;
    const result = await gateway.call('browser.press', {
      ref: await refFor(gateway, '#ta'),
      key: 'Enter',
    });
    for (let i = 0; i < 40 && s.messages().length < 1; i++) await sleep(25);
    await sleep(300);
    assert.equal(asked.length - before, 1, 'une seule carte (avant la touche)');
    assert.equal(s.messages().length, 1, 'le message part une fois');
    assert.equal((result.submissions ?? []).length, 1, 'compté une fois sur l’appel');
  },
);

test(
  'WebSocket : transport incapable de retenir les trames → carte avant le clic « Envoyer »',
  { skip },
  async (t) => {
    const s = await site(t);
    const { gateway, provider, asked } = await owner(t, s.origin);
    await ready(gateway, provider, s);
    provider.socketGuardFailed = 'FICTIF : routeWebSocket indisponible';
    await assert.rejects(
      gateway.call('browser.click', { ref: await refFor(gateway, '#send') }),
      /refusée/,
    );
    assert.equal(asked.at(-1).capability, 'browser.click', 'la carte vient avant le clic');
    await sleep(300);
    assert.deepEqual(s.messages(), [], 'refus : le clic n’a pas eu lieu');
  },
);

test(
  'WebSocket (transport propriétaire, Chrome jetable par CDP) : message retenu jusqu’à la carte, présence libre',
  { skip },
  async (t) => {
    const s = await site(t);
    // Chrome headless jetable sur un port choisi par Chrome (jamais 19988) : le transport
    // propriétaire, sans le vrai relais.
    const profile = mkdtempSync(join(tmpdir(), 'audit-ws-cdp-FICTIF-'));
    const chrome = spawn(
      CHROME,
      [
        '--headless=new',
        '--remote-debugging-port=0',
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank',
      ],
      { stdio: 'ignore' },
    );
    t.after(async () => {
      chrome.kill();
      await sleep(500);
      rmSync(profile, { recursive: true, force: true });
    });
    let port = null;
    for (let i = 0; i < 100 && !port; i++) {
      try {
        port = Number(readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]);
      } catch {
        await sleep(100);
      }
    }
    assert.ok(port && port !== 19988, 'port CDP jetable');
    let decide = () => false;
    const { gateway, provider, sends } = await owner(t, s.origin, (r) => decide(r), {
      endpoint: `http://127.0.0.1:${port}`,
      startupTimeoutMs: 12000,
    });
    await ready(gateway, provider, s);
    assert.equal(provider.name, 'playwriter-owner');
    assert.equal(provider.socketGuardFailed, null, 'les trames sont retenues par ce transport');
    await gateway.call('browser.click', { ref: await refFor(gateway, '#send') }).catch(() => {});
    const presence = s.count('presence');
    await sleep(600);
    assert.ok(s.count('presence') > presence, 'la présence continue');
    assert.equal(sends().length, 1, 'une carte');
    assert.deepEqual(s.messages(), [], 'refus : rien ne part');
    decide = () => true;
    await gateway.call('browser.click', { ref: await refFor(gateway, '#icon') });
    for (let i = 0; i < 60 && s.messages().length < 1; i++) await sleep(25);
    assert.equal(sends().length, 2);
    assert.equal(s.messages().length, 1, 'accord : le message part une fois');
  },
);
