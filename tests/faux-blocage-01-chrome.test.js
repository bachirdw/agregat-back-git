// faux-blocage-01 (D7) : reproduction du faux blocage de la sous-mission 7468032c (essai réel du
// 18/11) sur des pages FICTIVES. Une saisie dans le champ d'une zone de recherche déclarée par la
// page (<search>), puis un clic sur le bouton de son formulaire (GET) : le script de la page poste
// son journal vers un sous-domaine du même site, puis la recherche part. Aucune carte d'envoi ne
// doit être demandée. Contre-épreuves où la carte DOIT rester : même page sans zone de recherche,
// écriture vers un chemin de soumission, bouton « Envoyer », formulaire en POST. Chrome headless
// isolé, un serveur FICTIF local (127.0.0.1), aucun site réel, aucun agent. Le journal part vers la
// même origine : RunPolicy n'admet comme origine locale que 127.0.0.1, localhost ou [::1] (pas de
// sous-domaine en *.localhost) ; le « même site » de deux sous-domaines est vérifié sans navigateur
// (tests/faux-blocage-01.test.js). `approve` répond « refusé » : toute écriture reçue par le serveur serait partie sans accord.
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

// Page FICTIVE : `zone` entoure le formulaire d'un <search> ; `log` est le chemin où le script
// poste son journal ; `label` et `method` décrivent le bouton et le formulaire.
const searchPage = ({
  logOrigin,
  zone = true,
  log = '/api/v0/log',
  label = 'Find jobs',
  method,
}) => {
  const form = `<form id="f" action="/jobs" method="${method ?? 'get'}">
      <input id="q" role="combobox" name="q" aria-label="search: Job title, keywords, or company">
      <button id="go" type="submit">${label}</button>
    </form>`;
  return `<main>${zone ? `<search>${form}</search>` : form}</main>
  <script>
    const f = document.getElementById('f');
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      fetch('${logOrigin}${log}', { method: 'POST', body: '{"ev":"FICTIF"}' })
        .catch(() => {})
        .finally(() => f.submit());
    });
  </script>`;
};

async function site(t) {
  const writes = [];
  const pages = new Map();
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      req.resume();
      req.on('end', () => {
        writes.push(`${req.method} ${req.url}`);
        res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
        res.end('ok');
      });
      return;
    }
    const path = new URL(req.url, 'http://x').pathname;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    const body = path === '/jobs' ? '<p>Résultats FICTIFS</p>' : (pages.get(path) ?? '<p>vide</p>');
    res.end(`<!doctype html><meta charset="utf-8"><title>FICTIF</title>${body}`);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  return { origin, logOrigin: origin, pages, writes };
}

async function owner(t, origins) {
  const folder = mkdtempSync(join(tmpdir(), 'faux-blocage-01-FICTIF-'));
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
      runId: 'FICTIF-faux-blocage-01',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: origins,
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

// Le geste de l'agent : saisie « developer » dans le champ, clic sur le bouton du formulaire.
async function search(t, path, options = {}) {
  const s = await site(t);
  s.pages.set(path, searchPage({ logOrigin: s.logOrigin, ...options }));
  const o = await owner(t, [s.origin]);
  await o.gateway.call('browser.navigate', { url: s.origin + path });
  await o.gateway.call('browser.type', { ref: await refFor(o.gateway, '#q'), text: 'developer' });
  const ref = await refFor(o.gateway, '#go');
  const outcome = await o.gateway.call('browser.click', { ref }).then(
    () => 'fait',
    () => 'refusé',
  );
  return { ...s, ...o, outcome };
}
const until = async (check, ms = 3000) => {
  for (let i = 0; i < ms / 25 && !check(); i++) await sleep(25);
};

test(
  'faux-blocage-01 : bouton « Find jobs » d’une zone <search>, journal de la page : aucune carte, journal tracé, recherche faite',
  { skip },
  async (t) => {
    const r = await search(t, '/');
    await until(() => r.provider.page.url().includes('/jobs?'));
    await sleep(300);
    assert.equal(r.outcome, 'fait');
    assert.deepEqual(r.sends(), [], 'aucune carte d’envoi pour une recherche');
    assert.deepEqual(r.writes, ['POST /api/v0/log']);
    assert.ok(
      r.traced.some((host) => String(host).startsWith('127.0.0.1')),
      `journal tracé par son hôte : ${JSON.stringify(r.traced)}`,
    );
    const url = new URL(r.provider.page.url());
    assert.equal(url.pathname, '/jobs');
    assert.equal(url.searchParams.get('q'), 'developer');
  },
);

test(
  'faux-blocage-01 contre-épreuve : même page sans zone de recherche : carte pour le journal (inchangé)',
  { skip },
  async (t) => {
    const r = await search(t, '/sans-zone', { zone: false });
    await until(() => r.sends().length > 0);
    await sleep(300);
    assert.equal(r.sends().length, 1, 'le bouton d’un formulaire hors zone garde la carte');
    assert.match(r.sends()[0].args.url, /127\.0\.0\.1.*\/api\/v0\/log/);
    assert.equal(r.sends()[0].args.method, 'POST');
    assert.deepEqual(r.writes, [], 'refusée : rien n’est parti');
  },
);

test(
  'faux-blocage-01 contre-épreuve : dans la zone, écriture vers un chemin de soumission : carte',
  { skip },
  async (t) => {
    const r = await search(t, '/soumission', { log: '/api/apply/submit' });
    await until(() => r.sends().length > 0);
    await sleep(300);
    assert.equal(r.sends().length, 1, 'l’écriture vers /api/apply/submit attend la carte');
    assert.match(r.sends()[0].args.url, /\/api\/apply\/submit/);
    assert.deepEqual(r.writes, [], 'refusée : rien n’est parti');
  },
);

for (const [name, options] of [
  ['bouton « Envoyer » dans la zone', { label: 'Envoyer' }],
  ['formulaire de la zone en POST', { method: 'post' }],
])
  test(
    `faux-blocage-01 contre-épreuve : ${name} : carte avant le clic (inchangé)`,
    { skip },
    async (t) => {
      const r = await search(t, '/envoi', options);
      await sleep(500);
      assert.equal(r.outcome, 'refusé', 'le clic attend l’accord du propriétaire');
      assert.equal(r.sends().length, 1, 'une carte d’envoi');
      assert.deepEqual(r.writes, [], 'rien n’est parti');
      assert.ok(!r.provider.page.url().includes('/jobs'), 'la page n’a pas changé');
    },
  );
