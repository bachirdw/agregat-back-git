// review-cartes-14-11 : relecture indépendante de cartes-14-11 (A, B, C). Scènes où un vrai envoi
// pourrait partir sans carte, et cas réel du 14/11 (pixel qui recopie l'adresse de la page avec la
// recherche tapée). Chrome headless isolé, serveurs FICTIFS locaux (127.0.0.1 = le site,
// localhost et [::1] = d'autres sites), aucun site réel, aucun agent. `approve` répond « refusé » : toute
// écriture reçue par un serveur FICTIF serait partie sans accord.
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
    const url = new URL(req.url, 'http://x');
    const body = typeof html === 'function' ? html(url.pathname, url) : html;
    res.end(`<!doctype html><meta charset="utf-8"><title>FICTIF</title>${body}`);
  });
  await new Promise((resolve) => server.listen(0, host === '[::1]' ? '::1' : '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const origin = `http://${host}:${server.address().port}`;
  return { origin, host: new URL(origin).host, writes, lines: () => writes.map((w) => w.line) };
}

async function owner(t, origins, allow = () => false) {
  const folder = mkdtempSync(join(tmpdir(), 'review-cartes-14-11-FICTIF-'));
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
      runId: 'FICTIF-review-cartes-14-11',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: [origins].flat(),
      allowJavaScript: true,
    }),
    approve: async (request) => {
      asked.push(request);
      return allow(request);
    },
    onAutoSend: (entry) => traced.push(entry),
  });
  t.after(async () => {
    await provider.close().catch(() => {});
    rmSync(folder, { recursive: true, force: true });
  });
  return { gateway, provider, traced, sends: () => asked.filter((r) => r.actionClass === 'send') };
}

const waitFor = async (check, ms = 2000) => {
  for (let i = 0; i < ms / 25 && !check(); i++) await sleep(25);
};

// A ref of the snapshot (iframes included) whose line names `label`.
async function refByName(gateway, label) {
  for (let i = 0; i < 20; i++) {
    const { snapshot } = await gateway.call('browser.snapshot', {});
    const line = snapshot.split('\n').find((l) => l.includes(`"${label}"`) && /\[ref=/.test(l));
    if (line) return line.match(/\[ref=((?:f\d+)?e\d+)\]/)[1];
    await sleep(250);
  }
  throw new Error(`FICTIF : référence absente pour ${label}`);
}

// ---------------------------------------------------------------------------------------------
// 1. ATS embarqué dans un cadre d'un autre site, qui poste vers un troisième site
// ---------------------------------------------------------------------------------------------

async function embeddedAts(t) {
  const api = await site(t, '<p>API FICTIVE</p>', '[::1]');
  const ats = await site(
    t,
    `<form id="f" method="post" action="${api.origin}/apply">
      <input type="hidden" name="profil" value="pre-rempli-FICTIF">
      <input name="nom" aria-label="Nom FICTIF">
    </form>
    <button type="button" id="go">➜</button>
    <button type="button" id="env">Envoyer ma candidature</button>
    <script>
      for (const id of ['go', 'env'])
        document.getElementById(id).addEventListener('click', () => document.getElementById('f').submit());
    </script>`,
    'localhost',
  );
  const page = await site(
    t,
    `<h1>Offre FICTIVE</h1><iframe title="ATS" src="${ats.origin}/" width="600" height="300"></iframe>`,
  );
  return { api, ats, page, origins: [page.origin, ats.origin, api.origin] };
}

test(
  'ATS en cadre : clic ordinaire (icône) qui poste le formulaire pré-rempli vers un autre site : rien ne part (bloqué, hôte dit), aucune carte',
  { skip },
  async (t) => {
    const { api, page, origins } = await embeddedAts(t);
    const { gateway, provider, sends } = await owner(t, origins);
    await gateway.call('browser.navigate', { url: page.origin });
    const result = await gateway.call('browser.click', { ref: await refByName(gateway, '➜') });
    await sleep(800);
    assert.deepEqual(api.lines(), [], 'aucun envoi sans carte');
    assert.deepEqual(sends(), []);
    const blocked = [...(result.blockedThirdPartyPosts ?? []), ...provider.blockedThirdParty];
    assert.ok(blocked.includes(api.host), 'l’hôte bloqué est dit à l’agent');
  },
);

test(
  "ATS en cadre : même clic ordinaire après une saisie de l'agent dans le formulaire : carte, rien ne part",
  { skip },
  async (t) => {
    const { api, page, origins } = await embeddedAts(t);
    // La saisie dans le formulaire d'un autre site demande déjà son accord (règle antérieure) :
    // accordée ici, seul l'envoi reste refusé.
    const { gateway, sends } = await owner(
      t,
      origins,
      (request) => request.capability === 'browser.type',
    );
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway.call('browser.type', {
      ref: await refByName(gateway, 'Nom FICTIF'),
      text: 'Nom FICTIF Saisi',
    });
    await gateway.call('browser.click', { ref: await refByName(gateway, '➜') }).catch(() => {});
    await waitFor(() => sends().length > 0);
    await sleep(300);
    assert.equal(sends().length, 1, 'la saisie de l’agent vers un autre site attend la carte');
    assert.deepEqual(api.lines(), []);
  },
);

test(
  'ATS en cadre : clic « Envoyer ma candidature » (formulaire pré-rempli, sans saisie) : carte, rien ne part',
  { skip },
  async (t) => {
    const { api, page, origins } = await embeddedAts(t);
    const { gateway, sends } = await owner(t, origins);
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway
      .call('browser.click', { ref: await refByName(gateway, 'Envoyer ma candidature') })
      .catch(() => {});
    await waitFor(() => sends().length > 0);
    await sleep(300);
    assert.equal(sends().length, 1);
    assert.deepEqual(api.lines(), []);
  },
);

// ---------------------------------------------------------------------------------------------
// 2. Cas réel : le pixel recopie l'adresse de la page, qui porte la recherche tapée
// ---------------------------------------------------------------------------------------------

// Site d'emploi FICTIF : un champ dans un repère role="search" (Entrée met la requête dans
// l'adresse, comme un site à page unique), un champ ordinaire, un bouton de filtre. Chaque clic sur
// le filtre fait poster par « le script publicitaire » un formulaire caché vers le traceur d'un
// autre site, dans un iframe caché, avec l'adresse de la page (dl).
const pixelPage = (tracker) => `
  <div role="search"><input id="q" aria-label="Mots-clés FICTIFS"></div>
  <input id="note" name="note" aria-label="Note FICTIVE">
  <button id="filtre" aria-expanded="false">Type de contrat</button>
  <iframe name="trk" style="display:none"></iframe>
  <script>
    document.getElementById('q').addEventListener('input', (e) =>
      history.replaceState(null, '', '/emplois?q=' + encodeURIComponent(e.target.value)));
    document.getElementById('filtre').addEventListener('click', () => {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '${tracker}/tr/';
      form.target = 'trk';
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'dl';
      input.value = location.href;
      form.append(input);
      document.body.append(form);
      form.submit();
      form.remove();
    });
  </script>`;

test(
  'Cas réel : recherche tapée dans une zone de recherche, clic sur un filtre, le pixel d’un cadre poste l’adresse de la page avec la requête : aucune carte, rien ne part',
  { skip },
  async (t) => {
    const tracker = await site(t, '<p>traceur FICTIF</p>', 'localhost');
    const page = await site(t, pixelPage(tracker.origin));
    const { gateway, provider, sends } = await owner(t, [page.origin, tracker.origin]);
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway.call('browser.type', {
      ref: await refFor(gateway, '#q'),
      text: 'developpeur FICTIF',
    });
    assert.match(provider.page.url(), /q=developpeur%20FICTIF/, 'la requête est dans l’adresse');
    const result = await gateway.call('browser.click', { ref: await refFor(gateway, '#filtre') });
    await sleep(800);
    assert.deepEqual(sends(), [], 'aucune carte pour le pixel');
    assert.deepEqual(tracker.lines(), []);
    const blocked = [...(result.blockedThirdPartyPosts ?? []), ...provider.blockedThirdParty];
    assert.ok(blocked.includes(tracker.host));
  },
);

test(
  'Cas réel, requête passée par l’adresse de browser.navigate (non saisie) : aucune carte',
  { skip },
  async (t) => {
    const tracker = await site(t, '<p>traceur FICTIF</p>', 'localhost');
    const page = await site(t, pixelPage(tracker.origin));
    const { gateway, sends } = await owner(t, [page.origin, tracker.origin]);
    await gateway.call('browser.navigate', { url: `${page.origin}/emplois?q=developpeur+FICTIF` });
    await gateway.call('browser.click', { ref: await refFor(gateway, '#filtre') });
    await sleep(800);
    assert.deepEqual(sends(), []);
    assert.deepEqual(tracker.lines(), []);
  },
);

test(
  'Cas réel, la même valeur saisie aussi dans un champ ordinaire : elle reste une donnée de l’agent, carte',
  { skip },
  async (t) => {
    const tracker = await site(t, '<p>traceur FICTIF</p>', 'localhost');
    const page = await site(t, pixelPage(tracker.origin));
    const { gateway, sends } = await owner(t, [page.origin, tracker.origin]);
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway.call('browser.type', {
      ref: await refFor(gateway, '#note'),
      text: 'valeur FICTIVE',
    });
    await gateway.call('browser.type', {
      ref: await refFor(gateway, '#q'),
      text: 'valeur FICTIVE',
    });
    await gateway.call('browser.click', { ref: await refFor(gateway, '#filtre') }).catch(() => {});
    await waitFor(() => sends().length > 0);
    await sleep(300);
    assert.equal(sends().length, 1);
    assert.deepEqual(tracker.lines(), []);
  },
);

// ---------------------------------------------------------------------------------------------
// 3. Entrée de recherche : les écritures du site passent, tracées, la page de résultats se charge
// ---------------------------------------------------------------------------------------------

test(
  'Entrée dans un formulaire de recherche (GET) : la page de résultats se charge et ses 12 écritures passent, tracées browser.send, sans carte',
  { skip },
  async (t) => {
    const page = await site(t, (path) =>
      path === '/resultats'
        ? `<h1 id="ok">Résultats FICTIFS</h1><script>
            for (let i = 0; i < 6; i++) {
              fetch('/api/jobs/results', { method: 'POST', body: '{"page":' + i + '}' });
              fetch('/api/telemetry/events', { method: 'POST', body: '{"e":' + i + '}' });
            }</script>`
        : `<form role="search" action="/resultats">
             <input id="q" name="q" aria-label="Mots-clés FICTIFS"><button>Rechercher</button>
           </form>`,
    );
    const { gateway, provider, sends, traced } = await owner(t, page.origin);
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway.call('browser.type', { ref: await refFor(gateway, '#q'), text: 'FICTIF' });
    await gateway.call('browser.press', { ref: await refFor(gateway, '#q'), key: 'Enter' });
    await waitFor(() => page.lines().length >= 12, 4000);
    await sleep(300);
    assert.match(provider.page.url(), /\/resultats\?q=FICTIF$/);
    assert.equal(await provider.page.locator('#ok').count(), 1, 'la page de résultats est chargée');
    assert.equal(page.lines().length, 12);
    assert.deepEqual(sends(), []);
    assert.equal(traced.length, 12);
    assert.ok(traced.every((entry) => entry.capability === 'browser.send'));
  },
);

test(
  'Entrée dans un champ de zone de recherche d’une page unique : 12 écritures du site vers lui-même passent, tracées, sans carte',
  { skip },
  async (t) => {
    const page = await site(
      t,
      `<div role="search"><input id="q" aria-label="Mots-clés FICTIFS"></div><script>
        document.getElementById('q').addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          for (let i = 0; i < 6; i++) {
            fetch('/api/jobs/search', { method: 'POST', body: '{"q":"FICTIF","p":' + i + '}' });
            fetch('/api/telemetry/events', { method: 'POST', body: '{"e":' + i + '}' });
          }
        });</script>`,
    );
    const { gateway, sends, traced } = await owner(t, page.origin);
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway.call('browser.type', { ref: await refFor(gateway, '#q'), text: 'FICTIF' });
    await gateway.call('browser.press', { ref: await refFor(gateway, '#q'), key: 'Enter' });
    await waitFor(() => page.lines().length >= 12, 4000);
    await sleep(300);
    assert.equal(page.lines().length, 12);
    assert.deepEqual(sends(), []);
    assert.equal(traced.length, 12);
  },
);

// ---------------------------------------------------------------------------------------------
// 4. Envois possibles autour d'une zone de recherche
// ---------------------------------------------------------------------------------------------

test(
  'Entrée dans un champ de recherche d’un <form method=post> (bouton « Rechercher ») : carte avant la touche, rien ne part',
  { skip },
  async (t) => {
    const page = await site(
      t,
      `<form role="search" method="post" action="/recherche">
         <input id="q" name="q" aria-label="Mots-clés FICTIFS"><button>Rechercher</button>
       </form>`,
    );
    const { gateway, sends } = await owner(t, page.origin);
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway
      .call('browser.press', { ref: await refFor(gateway, '#q'), key: 'Enter' })
      .catch(() => {});
    await sleep(500);
    assert.ok(sends().length >= 1, 'un formulaire POST garde sa carte');
    assert.deepEqual(page.lines(), []);
  },
);

test(
  'Messagerie avec recherche : champ d’une ligne dans role=search qui poste vers un chemin de message : carte',
  { skip },
  async (t) => {
    const page = await site(
      t,
      `<div role="search"><input id="m" aria-label="Écrire FICTIF"></div><script>
        document.getElementById('m').addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          fetch('/api/messages', { method: 'POST', body: JSON.stringify({ text: e.target.value }) });
        });</script>`,
    );
    const { gateway, sends } = await owner(t, page.origin);
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway.call('browser.type', {
      ref: await refFor(gateway, '#m'),
      text: 'Bonjour FICTIF',
    });
    await gateway
      .call('browser.press', { ref: await refFor(gateway, '#m'), key: 'Enter' })
      .catch(() => {});
    await waitFor(() => sends().length > 0);
    await sleep(300);
    assert.equal(sends().length, 1);
    assert.deepEqual(page.lines(), []);
  },
);

// Limite connue de B, épinglée pour qu'elle reste visible : une page qui déclare son champ de
// message comme une zone de recherche (role=search) et l'écrit vers un chemin qui ne nomme pas
// l'envoi passe sans carte (tracée). Si un correctif la ferme, ce test doit être inversé.
test(
  'Limite connue : champ de message déclaré role=search, écrit vers /api/conversations/42 : passe sans carte, tracé',
  { skip },
  async (t) => {
    const page = await site(
      t,
      `<div role="search"><input id="m" aria-label="Écrire FICTIF"></div><script>
        document.getElementById('m').addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          fetch('/api/conversations/42', { method: 'POST', body: JSON.stringify({ text: e.target.value }) });
        });</script>`,
    );
    const { gateway, sends, traced } = await owner(t, page.origin);
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway.call('browser.type', {
      ref: await refFor(gateway, '#m'),
      text: 'Bonjour FICTIF',
    });
    await gateway.call('browser.press', { ref: await refFor(gateway, '#m'), key: 'Enter' });
    await waitFor(() => page.lines().length > 0);
    await sleep(300);
    assert.deepEqual(page.lines(), ['POST /api/conversations/42']);
    assert.deepEqual(sends(), []);
    assert.equal(traced.length, 1);
  },
);

test(
  'C : saisie de recherche puis texte long saisi dans un textarea : la grosse écriture garde sa carte',
  { skip },
  async (t) => {
    const page = await site(
      t,
      `<div role="search"><input id="q" name="q" aria-label="Mots-clés FICTIFS"></div>
       <textarea id="lettre" name="lettre" aria-label="Lettre FICTIVE"></textarea>`,
    );
    const { gateway, provider, sends } = await owner(t, page.origin);
    await gateway.call('browser.navigate', { url: page.origin });
    await gateway.call('browser.type', { ref: await refFor(gateway, '#q'), text: 'FICTIF' });
    await gateway.call('browser.type', {
      ref: await refFor(gateway, '#lettre'),
      text: 'Lettre FICTIVE. '.repeat(50),
    });
    await sleep(9000); // hors de toute fenêtre de geste
    await provider.page.evaluate(() => {
      fetch('/api/telemetry/batch', { method: 'POST', body: 'x'.repeat(150_000) }).catch(() => {});
    });
    await waitFor(() => sends().length > 0);
    await sleep(300);
    assert.equal(sends().length, 1);
    assert.deepEqual(page.lines(), []);
  },
);
