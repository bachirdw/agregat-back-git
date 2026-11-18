// faux-blocage-02 (cas T) : reproduction du faux blocage de la mission c9e0aa0d (essai réel du 18/11,
// recherche d'offres, aucune candidature) sur des pages FICTIVES. Sur une page de résultats, l'agent
// clique le lien « Next » de la pagination (un lien hors formulaire, étape par son seul libellé) ;
// le script publicitaire de la page poste alors un formulaire caché vers le traceur d'un autre site,
// dans un cadre caché (`POST <traceur>/tr/`). Aucune carte d'envoi ne doit être demandée ; le
// traceur est bloqué en silence et son hôte dit, comme après un clic ordinaire (cartes-14-11 A).
// Contre-épreuves où la carte DOIT rester : bouton « Next » (étape d'un formulaire), lien dans un
// formulaire, lien sans adresse (`#`), formulaire caché qui emporte une valeur saisie par l'agent,
// navigation de l'onglet lui-même, écriture du site vers un chemin de soumission après le lien.
// Chrome headless isolé, deux serveurs FICTIFS locaux (127.0.0.1 = le site, localhost = un autre
// site), aucun site réel, aucun agent. `approve` répond « refusé » : toute écriture reçue par un
// serveur FICTIF serait partie sans accord.
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
    res.end(`<!doctype html><meta charset="utf-8"><title>FICTIF</title>${html}`);
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
  const folder = mkdtempSync(join(tmpdir(), 'faux-blocage-02-FICTIF-'));
  const provider = new CdpBrowser({
    launch: { executablePath: CHROME },
    navigationTimeoutMs: 8000,
  });
  const asked = [];
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-faux-blocage-02',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: origins,
      allowJavaScript: true,
    }),
    approve: async (request) => {
      asked.push(request);
      return false;
    },
  });
  t.after(async () => {
    await provider.close().catch(() => {});
    rmSync(folder, { recursive: true, force: true });
  });
  return { gateway, provider, sends: () => asked.filter((r) => r.actionClass === 'send') };
}

// Page de résultats FICTIVE : une pagination (lien « Next » vers une vraie adresse), un bouton
// « Next », un lien « Next » dans un formulaire, un lien « Next » sans adresse. Chaque clic affiche
// la page suivante sans recharger (comme une application d'une page) et fait poster par « le
// script publicitaire » un formulaire caché vers le traceur d'un autre site, dans un iframe caché.
// `withQuery` y recopie la saisie du champ ; `topFrame` le poste dans l'onglet lui-même ;
// `submitWrite` fait aussi écrire le site vers un chemin de soumission.
const resultsPage = (tracker) => `
  <input id="mot" aria-label="Note FICTIVE">
  <ul><li>Offre FICTIVE 1</li><li>Offre FICTIVE 2</li></ul>
  <nav aria-label="Pagination">
    <a id="next" href="/resultats?page=2">Next</a>
    <a id="vide" href="#">Next</a>
  </nav>
  <button id="bouton" type="button">Next</button>
  <form id="f" action="/etape" method="post"><a id="lienform" href="/resultats?page=2">Next</a></form>
  <iframe name="trk" style="display:none"></iframe>
  <script>
    const post = () => {
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
      if (window.withQuery === true) add('cd', document.getElementById('mot').value);
      document.body.append(form);
      form.submit();
      form.remove();
    };
    for (const id of ['next', 'vide', 'bouton', 'lienform'])
      document.getElementById(id).addEventListener('click', (event) => {
        event.preventDefault();
        history.pushState({}, '', '/resultats?page=2');
        if (window.submitWrite === true)
          fetch('/api/apply/submit', { method: 'POST', body: '{"FICTIF":1}' }).catch(() => {});
        post();
      });
  </script>`;

async function scene(t, id, setup = {}) {
  const tracker = await site(t, '<p>traceur FICTIF</p>', 'localhost');
  const page = await site(t, resultsPage(tracker.origin));
  const o = await owner(t, [page.origin, tracker.origin]);
  await o.gateway.call('browser.navigate', { url: page.origin + '/resultats' });
  if (setup.typed)
    await o.gateway.call('browser.type', {
      ref: await refFor(o.gateway, '#mot'),
      text: 'Texte FICTIF saisi',
    });
  await o.provider.page.evaluate((flags) => Object.assign(window, flags), setup.flags ?? {});
  let result = null;
  const outcome = await o.gateway.call('browser.click', { ref: await refFor(o.gateway, id) }).then(
    (value) => {
      result = value;
      return 'fait';
    },
    () => 'refusé',
  );
  return { tracker, page, ...o, outcome, result };
}
const waitCard = async (sends) => {
  for (let i = 0; i < 80 && !sends().length; i++) await sleep(25);
  await sleep(300);
};

test(
  'faux-blocage-02 T : lien « Next » de la pagination, traceur d’un autre site en cadre caché : aucune carte, hôte bloqué',
  { skip },
  async (t) => {
    const r = await scene(t, '#next');
    await sleep(800);
    assert.equal(r.outcome, 'fait');
    assert.deepEqual(r.sends(), [], 'aucune carte d’envoi pour un traceur après « Next »');
    assert.deepEqual(r.tracker.lines(), [], 'rien n’est parti vers le traceur');
    const blocked = [...(r.result?.blockedThirdPartyPosts ?? []), ...r.provider.blockedThirdParty];
    assert.ok(blocked.includes(r.tracker.host), 'l’hôte du traceur est dit bloqué');
    assert.ok(r.provider.page.url().endsWith('/resultats?page=2'), 'page suivante affichée');
  },
);

for (const [name, id, setup] of [
  ['bouton « Next » (étape d’un formulaire)', '#bouton', {}],
  ['lien « Next » dans un formulaire', '#lienform', {}],
  ['lien « Next » sans adresse (#)', '#vide', {}],
  [
    'lien « Next », formulaire caché avec la saisie de l’agent',
    '#next',
    {
      typed: true,
      flags: { withQuery: true },
    },
  ],
  [
    'lien « Next », formulaire posté dans l’onglet lui-même',
    '#next',
    {
      flags: { topFrame: true },
    },
  ],
])
  test(`faux-blocage-02 T contre-épreuve : ${name} : carte`, { skip }, async (t) => {
    const r = await scene(t, id, setup);
    await waitCard(r.sends);
    assert.equal(r.sends().length, 1, 'le formulaire vers un autre site attend la carte');
    assert.match(r.sends()[0].args.url, /localhost.*\/tr\//);
    assert.deepEqual(r.tracker.lines(), [], 'refusée : rien n’est parti');
  });

test(
  'faux-blocage-02 T contre-épreuve : lien « Next » puis écriture du site vers un chemin de soumission : carte (inchangé)',
  { skip },
  async (t) => {
    const r = await scene(t, '#next', { flags: { submitWrite: true } });
    await waitCard(r.sends);
    const urls = r.sends().map((s) => s.args.url);
    assert.ok(
      urls.some((url) => /127\.0\.0\.1.*\/api\/apply\/submit/.test(url)),
      JSON.stringify(urls),
    );
    assert.ok(!r.page.lines().includes('POST /api/apply/submit'), 'refusée : rien n’est parti');
    assert.deepEqual(r.tracker.lines(), [], 'rien n’est parti vers le traceur');
  },
);
