// cartes-14-11 : une simple recherche d'offres (« ne postule à rien ») ne doit demander aucune carte
// d'envoi. Trois causes vues le 14/11 : (A) un formulaire caché posté par le script publicitaire
// vers un autre site, dans un cadre caché, après un clic ordinaire ; (B) Entrée dans un champ de
// zone de recherche classée comme un geste d'envoi ; (C) la règle des écritures de plus de 100 ko
// déclenchée par la seule saisie de la recherche. Chrome headless isolé, deux serveurs FICTIFS
// locaux (127.0.0.1 = le site, localhost = un autre site), aucun site réel, aucun agent. `approve`
// répond « refusé » : toute écriture reçue par un serveur FICTIF serait partie sans accord.
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

async function site(t, html, host = '127.0.0.1') {
  const writes = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        writes.push({ line: `${req.method} ${req.url}`, body: Buffer.concat(chunks).toString() });
        res.writeHead(200, { 'content-type': 'text/html', 'access-control-allow-origin': '*' });
        res.end('<p>ok</p>');
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
  const origin = `http://${host}:${server.address().port}`;
  return { origin, host: new URL(origin).host, writes, lines: () => writes.map((w) => w.line) };
}

async function owner(t, origins) {
  const folder = mkdtempSync(join(tmpdir(), 'cartes-14-11-FICTIF-'));
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
      runId: 'FICTIF-cartes-14-11',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: [origins].flat(),
      allowJavaScript: true,
    }),
    approve: async (request) => {
      asked.push(request);
      return false;
    },
    onAutoSend: (entry) => traced.push(entry.host),
  });
  t.after(async () => {
    await provider.close().catch(() => {});
    rmSync(folder, { recursive: true, force: true });
  });
  return { gateway, provider, traced, sends: () => asked.filter((r) => r.actionClass === 'send') };
}

const settle = async (lines, n = 1, ms = 1500) => {
  for (let i = 0; i < ms / 25 && lines().length < n; i++) await sleep(25);
};

// ---------------------------------------------------------------------------------------------
// A : formulaire caché posté vers un autre site, dans un cadre caché, après un clic
// ---------------------------------------------------------------------------------------------

// Page FICTIVE : un bouton de filtre (aria-expanded, widget), un bouton ordinaire (plain), un champ
// et un bouton d'envoi. Chaque clic fait poster par « le script publicitaire » un formulaire caché
// vers le traceur d'un autre site, dans un iframe caché ; `withQuery` y recopie la saisie du champ.
const trackerPage = (tracker) => `
  <input id="mot" aria-label="Note FICTIVE">
  <button id="filtre" aria-expanded="false">Type de contrat</button>
  <button id="plus">Afficher plus</button>
  <button id="envoyer">Envoyer ma candidature</button>
  <iframe name="trk" style="display:none"></iframe>
  <script>
    const post = (withQuery) => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '${tracker}/tr/';
      form.target = window.topFrame === true ? '_self' : 'trk';
      form.style.display = 'none';
      const add = (name, value) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.append(input);
      };
      add('ev', 'PageView');
      if (withQuery) add('cd', document.getElementById('mot').value);
      document.body.append(form);
      form.submit();
      form.remove();
    };
    for (const id of ['filtre', 'plus', 'envoyer'])
      document.getElementById(id).addEventListener('click', () => post(window.withQuery === true));
  </script>`;

for (const id of ['#filtre', '#plus'])
  test(
    `A : clic ${id === '#filtre' ? 'widget' : 'plain'} puis formulaire caché posté vers un autre site sans saisie de l'agent : aucune carte, hôte bloqué`,
    { skip },
    async (t) => {
      const tracker = await site(t, '<p>traceur FICTIF</p>', 'localhost');
      const page = await site(t, trackerPage(tracker.origin));
      const { gateway, provider, sends } = await owner(t, [page.origin, tracker.origin]);
      await gateway.call('browser.navigate', { url: page.origin });
      const result = await gateway.call('browser.click', { ref: await refFor(gateway, id) });
      await sleep(800);
      assert.deepEqual(sends(), [], 'aucune carte d’envoi pour un traceur');
      assert.deepEqual(tracker.lines(), [], 'rien n’est parti vers le traceur');
      const blocked = [...(result.blockedThirdPartyPosts ?? []), ...provider.blockedThirdParty];
      assert.ok(blocked.includes(tracker.host), 'l’hôte du traceur est dit bloqué');
    },
  );

test(
  "A : même scène, mais le formulaire caché porte une valeur saisie par l'agent : carte",
  { skip },
  async (t) => {
    const tracker = await site(t, '<p>traceur FICTIF</p>', 'localhost');
    const page = await site(t, trackerPage(tracker.origin));
    const { gateway, provider, sends } = await owner(t, [page.origin, tracker.origin]);
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway.call('browser.type', {
      ref: await refFor(gateway, '#mot'),
      text: 'Texte FICTIF saisi',
    });
    await provider.page.evaluate(() => (window.withQuery = true));
    await gateway.call('browser.click', { ref: await refFor(gateway, '#filtre') }).catch(() => {});
    for (let i = 0; i < 80 && !sends().length; i++) await sleep(25);
    await sleep(300);
    assert.equal(sends().length, 1, 'la saisie de l’agent vers un autre site attend la carte');
    assert.deepEqual(tracker.lines(), [], 'refusée : rien n’est parti');
  },
);

test(
  'A (variante étroite) : clic plain puis formulaire posté vers un autre site dans l’onglet lui-même : carte (inchangé)',
  { skip },
  async (t) => {
    const tracker = await site(t, '<p>traceur FICTIF</p>', 'localhost');
    const page = await site(t, trackerPage(tracker.origin));
    const { gateway, provider, sends } = await owner(t, [page.origin, tracker.origin]);
    await gateway.call('browser.navigate', { url: page.origin });
    await provider.page.evaluate(() => (window.topFrame = true));
    await gateway.call('browser.click', { ref: await refFor(gateway, '#plus') }).catch(() => {});
    for (let i = 0; i < 80 && !sends().length; i++) await sleep(25);
    await sleep(300);
    assert.equal(sends().length, 1, 'une navigation de l’onglet vers un autre site garde sa carte');
    assert.deepEqual(tracker.lines(), []);
  },
);

test(
  "A : même scène après un clic d'envoi (« Envoyer ma candidature ») : carte",
  { skip },
  async (t) => {
    const tracker = await site(t, '<p>traceur FICTIF</p>', 'localhost');
    const page = await site(t, trackerPage(tracker.origin));
    const { gateway, sends } = await owner(t, [page.origin, tracker.origin]);
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway.call('browser.click', { ref: await refFor(gateway, '#envoyer') }).catch(() => {});
    for (let i = 0; i < 80 && !sends().length; i++) await sleep(25);
    await sleep(300);
    assert.equal(
      sends().length,
      1,
      'après un clic d’envoi, le formulaire vers un autre site attend',
    );
    assert.deepEqual(tracker.lines(), []);
  },
);

// ---------------------------------------------------------------------------------------------
// B : Entrée dans un champ de zone de recherche
// ---------------------------------------------------------------------------------------------

// Site d'emploi FICTIF : un champ dans un repère role="search" (hors <form>), un formulaire de
// recherche (role="search", bouton « Rechercher »), un champ hors zone et un textarea dans la zone.
// Entrée y fait poster par script vers `window.cible` (chemin de résultats par défaut) et la
// télémétrie du site.
const searchPage = `
  <div role="search"><input id="q" aria-label="Mots-clés FICTIFS"></div>
  <form role="search" id="f" onsubmit="event.preventDefault()">
    <input id="lieu" name="lieu" aria-label="Lieu FICTIF"><button type="submit">Rechercher</button>
  </form>
  <search><input id="type" type="search" aria-label="Recherche FICTIVE"></search>
  <input id="hors" aria-label="Champ FICTIF">
  <div role="search"><textarea id="ta" aria-label="Zone FICTIVE"></textarea></div>
  <script>
    window.cible = '/api/jobs/results';
    for (const id of ['q', 'lieu', 'type', 'hors', 'ta'])
      document.getElementById(id).addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        fetch(window.cible, { method: 'POST', body: '{"q":"FICTIF"}' });
        fetch('/api/telemetry/events', { method: 'POST', body: '{"e":"search"}' });
      });
  </script>`;

test(
  'B : Entrée dans un champ de zone de recherche, la page poste vers ses résultats : aucune carte, écritures tracées',
  { skip },
  async (t) => {
    const page = await site(t, searchPage);
    const { gateway, sends, traced } = await owner(t, page.origin);
    await gateway.call('browser.navigate', { url: page.origin });
    let expected = 0;
    for (const id of ['#q', '#lieu', '#type']) {
      await gateway.call('browser.press', { ref: await refFor(gateway, id), key: 'Enter' });
      expected += 2;
      await settle(page.lines, expected);
      assert.deepEqual(sends(), [], `aucune carte pour Entrée dans ${id}`);
    }
    await sleep(300);
    assert.equal(page.lines().length, 6, 'résultats et télémétrie sont partis');
    assert.equal(traced.length, 6, 'chaque écriture est tracée');
  },
);

test(
  'B : même champ, mais la page écrit vers un chemin de soumission : carte',
  { skip },
  async (t) => {
    const page = await site(t, searchPage);
    const { gateway, provider, sends } = await owner(t, page.origin);
    await gateway.call('browser.navigate', { url: page.origin });
    await provider.page.evaluate(() => (window.cible = '/api/messages/send'));
    await gateway.call('browser.press', { ref: await refFor(gateway, '#q'), key: 'Enter' });
    for (let i = 0; i < 80 && !sends().length; i++) await sleep(25);
    await sleep(500);
    assert.equal(sends().length, 1, 'l’écriture vers /api/messages/send attend la carte');
    assert.ok(!page.lines().includes('POST /api/messages/send'), 'refusée : rien n’est parti');
  },
);

test(
  'B : Entrée dans un champ hors zone de recherche ou dans un textarea : carte (inchangé)',
  { skip },
  async (t) => {
    const page = await site(t, searchPage);
    const { gateway, sends } = await owner(t, page.origin);
    await gateway.call('browser.navigate', { url: page.origin });
    for (const id of ['#hors', '#ta']) {
      const before = sends().length;
      await gateway
        .call('browser.press', { ref: await refFor(gateway, id), key: 'Enter' })
        .catch(() => {});
      for (let i = 0; i < 80 && sends().length === before; i++) await sleep(25);
      assert.ok(sends().length > before, `une carte pour Entrée dans ${id}`);
      await sleep(9000); // hors de la fenêtre de la touche précédente
    }
    assert.ok(!page.lines().includes('POST /api/jobs/results'), 'rien n’est parti sans accord');
  },
);

// ---------------------------------------------------------------------------------------------
// C : grosse écriture après une saisie de recherche
// ---------------------------------------------------------------------------------------------

test(
  'C : écriture de plus de 100 ko après une saisie dans un champ de recherche : aucune carte ; après une saisie dans un autre champ : carte',
  { skip },
  async (t) => {
    const page = await site(t, searchPage);
    const { gateway, provider, sends } = await owner(t, page.origin);
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway.call('browser.type', { ref: await refFor(gateway, '#q'), text: 'FICTIF' });
    await sleep(9000); // hors de toute fenêtre de geste
    await provider.page.evaluate(() => {
      fetch('/api/telemetry/batch', { method: 'POST', body: 'x'.repeat(150_000) });
    });
    await settle(page.lines);
    await sleep(300);
    assert.deepEqual(page.lines(), ['POST /api/telemetry/batch'], 'la télémétrie passe');
    assert.deepEqual(sends(), [], 'aucune carte après une saisie de recherche');
    await gateway.call('browser.type', { ref: await refFor(gateway, '#hors'), text: 'FICTIF 2' });
    await sleep(9000);
    await provider.page.evaluate(() => {
      fetch('/api/brouillon', { method: 'POST', body: 'x'.repeat(150_000) }).catch(() => {});
    });
    for (let i = 0; i < 80 && !sends().length; i++) await sleep(25);
    await sleep(300);
    assert.equal(sends().length, 1, 'après une saisie dans un autre champ, la règle reste entière');
    assert.deepEqual(page.lines(), ['POST /api/telemetry/batch']);
  },
);
