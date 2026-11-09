// Audit du 10/11, relecture indépendante (relecture-nav.md) puis correctifs fix5. Chrome headless
// isolé, pages FICTIVES locales, aucun site réel, aucun agent. Règle du propriétaire : un envoi
// final ne part jamais sans sa carte (dans le doute, une carte) ; hors envoi final, rien ne demande
// de clic quand c'est sûr. Dans ces tests, `approve` répond « refusé » sauf mention contraire : toute
// écriture reçue par le serveur FICTIF serait partie sans accord.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';
import { refFor } from './support/click-ref.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const skip = !existsSync(CHROME);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Site FICTIF servi en local (127.0.0.1, ou « localhost » pour un autre site) ; `lines()` rend les
// écritures reçues (méthode et chemin), `bodies` leur corps.
async function site(t, html, { status = () => 200, host = '127.0.0.1' } = {}) {
  const writes = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        writes.push({ line: `${req.method} ${req.url}`, body: Buffer.concat(chunks).toString() });
        res.writeHead(status(req), { 'content-type': 'application/json' });
        res.end('{}');
      });
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    const body = typeof html === 'function' ? html(new URL(req.url, 'http://x').pathname) : html;
    res.end(`<!doctype html><meta charset="utf-8"><title>FICTIF</title>${body}`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  return {
    origin: `http://${host}:${server.address().port}`,
    writes,
    lines: () => writes.map((w) => w.line),
  };
}

async function owner(t, origins, decide = () => false) {
  const folder = mkdtempSync(join(tmpdir(), 'audit-fix5-FICTIF-'));
  const provider = new CdpBrowser({
    launch: { executablePath: CHROME },
    navigationTimeoutMs: 8000,
  });
  const asked = [];
  const traced = [];
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-audit-fix5',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: [origins].flat(),
      allowJavaScript: true,
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
    folder,
    asked,
    traced,
    sends: () => asked.filter((r) => r.actionClass === 'send'),
  };
}

const hide = (provider) =>
  provider.page.evaluate(() =>
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }),
  );
const settle = async (lines, n = 1, ms = 1500) => {
  for (let i = 0; i < ms / 25 && lines().length < n; i++) await sleep(25);
};

// ---------------------------------------------------------------------------------------------
// Constat 1 : Entrée
// ---------------------------------------------------------------------------------------------

// Messagerie FICTIVE : Entrée dans la zone de message (textarea, contenteditable, champ hors
// <form>) poste le message par script.
const messaging = `
  <textarea id="ta" aria-label="Message"></textarea>
  <div id="ce" contenteditable="true" aria-label="Message riche" role="textbox"></div>
  <input id="hors" aria-label="Message court">
  <script>
    for (const id of ['ta', 'ce', 'hors'])
      document.getElementById(id).addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        fetch('/voyager/api/messaging/conversations?id=' + id, { method: 'POST', body: '{"t":"FICTIF"}' });
      });
  </script>`;

test(
  'Constat 1 : Entrée dans un textarea, un contenteditable ou un champ hors <form> qui envoie un message attend la carte',
  { skip },
  async (t) => {
    const { origin, lines } = await site(t, messaging);
    const { gateway, sends } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    for (const id of ['#ta', '#ce', '#hors']) {
      const before = sends().length;
      await gateway
        .call('browser.press', { ref: await refFor(gateway, id), key: 'Enter' })
        .catch(() => {});
      await sleep(400);
      assert.equal(sends().length, before + 1, `une carte pour Entrée dans ${id}`);
    }
    assert.deepEqual(lines(), [], 'aucun message n’est parti sans accord');
  },
);

// Formulaire FICTIF d'envoi final avec une case à cocher (CGU) : Entrée sur la case soumet le
// formulaire (soumission implicite de Chrome).
const cguForm = `<form onsubmit="event.preventDefault(); fetch('/api/candidatures', { method: 'POST', body: '{}' })">
  <input id="nom" name="nom" aria-label="Nom">
  <input id="mail" name="mail" aria-label="Courriel">
  <label><input type="checkbox" id="cgu" name="cgu"> J’accepte les conditions</label>
  <input id="ville" name="ville" aria-label="Ville" role="combobox" aria-expanded="false">
  <button type="submit">Envoyer ma candidature</button>
</form>`;

for (const hidden of [false, true])
  test(
    `Constat 1 : Entrée sur la case à cocher ou un champ du formulaire final attend la carte (onglet ${hidden ? 'caché' : 'visible'})`,
    { skip },
    async (t) => {
      const { origin, lines } = await site(t, cguForm);
      let answer = false;
      const { gateway, provider, sends } = await owner(t, origin, () => answer);
      await gateway.call('browser.navigate', { url: origin });
      if (hidden) await hide(provider);
      for (const id of ['#cgu', '#nom']) {
        await assert.rejects(
          gateway.call('browser.press', { ref: await refFor(gateway, id), key: 'Enter' }),
          /Action refusée/,
          id,
        );
        assert.equal(sends().at(-1)?.submitter?.text, 'Envoyer ma candidature');
      }
      await sleep(400);
      assert.deepEqual(lines(), [], 'rien n’est parti sans accord');
      // Autocomplétion : la soumission est retenue, aucune carte.
      const before = sends().length;
      const kept = await gateway.call('browser.press', {
        ref: await refFor(gateway, '#ville'),
        key: 'Enter',
      });
      assert.match(kept.submitBlocked ?? '', /rien n’a été envoyé/);
      assert.equal(sends().length, before);
      await sleep(300);
      assert.deepEqual(lines(), []);
      // Accordé : l'envoi part, une fois.
      answer = true;
      const sent = await gateway.call('browser.press', {
        ref: await refFor(gateway, '#nom'),
        key: 'Enter',
      });
      assert.equal(sent.mode, hidden ? 'dom' : 'keyboard');
      await settle(lines);
      await sleep(300);
      assert.deepEqual(lines(), ['POST /api/candidatures']);
    },
  );

test(
  'Constat 1 : Entrée d’autocomplétion qui écrit par script vers le site attend la carte ; celle qui ne fait que choisir passe',
  { skip },
  async (t) => {
    const { origin, lines } = await site(
      t,
      `<input id="ac" role="combobox" aria-autocomplete="list" aria-label="Poste"
         onkeydown="if (event.key === 'Enter') fetch('/api/candidatures', { method: 'POST', body: '{}' })">
       <input id="choix" list="villes" aria-label="Ville"
         onkeydown="if (event.key === 'Enter') this.value = 'Ville FICTIVE'">
       <datalist id="villes"><option value="Ville FICTIVE"></datalist>`,
    );
    const { gateway, provider, sends } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    await gateway.call('browser.press', { ref: await refFor(gateway, '#choix'), key: 'Enter' });
    assert.equal(await provider.page.locator('#choix').inputValue(), 'Ville FICTIVE');
    assert.deepEqual(sends(), [], 'choisir une suggestion ne demande rien');
    await gateway.call('browser.press', { ref: await refFor(gateway, '#ac'), key: 'Enter' });
    for (let i = 0; i < 60 && !sends().length; i++) await sleep(25);
    await sleep(300);
    assert.deepEqual(
      sends().map((r) => r.capability),
      ['browser.send'],
    );
    assert.deepEqual(lines(), [], 'l’écriture refusée n’est pas partie');
  },
);

test(
  'Constat 1 : Entrée dans une étape (« Suivant ») et dans une recherche GET passe sans carte',
  { skip },
  async (t) => {
    const { origin, lines } = await site(t, (path) =>
      path === '/resultats'
        ? '<p>Résultats FICTIFS</p>'
        : `<form onsubmit="event.preventDefault(); fetch('/api/etape', { method: 'POST', body: '{}' })">
             <textarea id="lettre" name="lettre" aria-label="Lettre"></textarea>
             <input id="nom" name="nom" aria-label="Nom"><button type="submit">Suivant</button></form>
           <form action="/resultats" method="get"><input id="q" name="q" aria-label="Recherche"></form>`,
    );
    const { gateway, provider, sends } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    await gateway.call('browser.press', { ref: await refFor(gateway, '#nom'), key: 'Enter' });
    await settle(lines);
    await gateway.call('browser.press', { ref: await refFor(gateway, '#lettre'), key: 'Enter' });
    assert.deepEqual(lines(), ['POST /api/etape']);
    await gateway.call('browser.press', { ref: await refFor(gateway, '#q'), key: 'Enter' });
    for (let i = 0; i < 60 && !provider.page.url().includes('/resultats'); i++) await sleep(25);
    assert.match(provider.page.url(), /\/resultats\?q=/);
    assert.deepEqual(sends(), []);
  },
);

// ---------------------------------------------------------------------------------------------
// Constat 2 : aria-haspopup / aria-expanded ne font pas d'un bouton d'envoi un « widget »
// ---------------------------------------------------------------------------------------------

test(
  'Constat 2 : un bouton d’envoi qui porte aria-haspopup ou aria-expanded garde sa carte ; un vrai menu passe',
  { skip },
  async (t) => {
    const { origin, lines } = await site(
      t,
      `<form onsubmit="event.preventDefault(); fetch('/api/candidature/submit', { method: 'POST', body: '{}' })">
         <input name="nom" aria-label="Nom">
         <button type="submit" id="popup" aria-haspopup="dialog">Envoyer</button>
         <button type="submit" id="plie" aria-expanded="false">OK</button>
       </form>
       <button type="button" id="menu" aria-haspopup="menu" aria-expanded="false"
         onclick="fetch('/api/candidature/submit', { method: 'POST', body: '{}' })">Plus d’options</button>
       <button type="button" id="liste" aria-haspopup="listbox" onclick="this.dataset.o = 1">Ville</button>`,
    );
    const { gateway, sends } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    for (const id of ['#popup', '#plie'])
      await assert.rejects(
        gateway.call('browser.click', { ref: await refFor(gateway, id) }),
        /Action refusée/,
        id,
      );
    assert.deepEqual(
      sends().map((r) => r.capability),
      ['browser.click', 'browser.click'],
    );
    // Un vrai menu qui ne fait qu'ouvrir une liste : aucune carte.
    await gateway.call('browser.click', { ref: await refFor(gateway, '#liste') });
    assert.equal(sends().length, 2);
    // Un « menu » dont le clic écrit vers un point de soumission : le garde réseau demande la carte.
    await gateway.call('browser.click', { ref: await refFor(gateway, '#menu') });
    for (let i = 0; i < 60 && sends().length < 3; i++) await sleep(25);
    assert.equal(sends().at(-1)?.capability, 'browser.send');
    await sleep(300);
    assert.deepEqual(lines(), [], 'rien n’est parti sans accord');
  },
);
