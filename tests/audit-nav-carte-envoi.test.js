// Audit du 10/11 (navigateur-mcp.md, constats 1, 2 et 5), Chrome headless isolé, pages FICTIVES
// locales : en mode propriétaire, seul l'envoi final attend le clic du propriétaire. Ouvrir le
// formulaire, choisir une option, répondre « Oui » ou ajouter une expérience passe sans carte ;
// l'envoi final, quel que soit son libellé et même hors <form>, a une carte et une seule.
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Page FICTIVE servie en local ; `writes` garde les écritures reçues (méthode et chemin).
async function site(t, html, { status = () => 200 } = {}) {
  const writes = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      req.resume();
      req.on('end', () => {
        writes.push(`${req.method} ${req.url}`);
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
  return { origin: `http://127.0.0.1:${server.address().port}`, writes };
}

async function owner(t, origin, decide = () => false) {
  const folder = mkdtempSync(join(tmpdir(), 'audit-nav-FICTIF-'));
  const provider = new CdpBrowser({
    launch: { executablePath: CHROME },
    navigationTimeoutMs: 8000,
  });
  const asked = [];
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-audit-nav',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: [origin],
    }),
    approve: async (request) => {
      asked.push(request);
      return decide(request);
    },
  });
  t.after(async () => {
    await provider.close().catch(() => {});
    rmSync(folder, { recursive: true, force: true });
  });
  return { gateway, provider, asked, sends: () => asked.filter((r) => r.actionClass === 'send') };
}

test(
  'Constat 1 : ouvrir le formulaire, une liste, « Oui » et « Ajouter une expérience » passent sans carte ; « Envoyer » en a une',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, writes } = await site(
      t,
      `<button onclick="document.querySelector('form').hidden=false">Postuler</button>
      <form action="/candidature" method="post" hidden>
        <label>Nom <input name="nom"></label>
        <div role="combobox" aria-label="Pays" aria-expanded="false" tabindex="0" onclick="this.dataset.o=1">Choisir un pays</div>
        <button type="button" aria-haspopup="listbox" onclick="this.dataset.o=1">Ville</button>
        <button type="button" onclick="this.dataset.o=1">Oui</button>
        <button type="button" onclick="this.dataset.o=1">Ajouter une expérience</button>
        <button type="button" onclick="this.dataset.o=1">Étape suivante</button>
        <button type="submit">Envoyer ma candidature</button>
      </form>`,
    );
    const { gateway, sends } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    await gateway.call('browser.click', { ref: await refFor(gateway, 'body > button') });
    for (const selector of [
      '[role=combobox]',
      '[aria-haspopup]',
      'form button:nth-of-type(2)',
      'form button:nth-of-type(3)',
      'form button:nth-of-type(4)',
    ])
      await gateway.call('browser.click', { ref: await refFor(gateway, selector) });
    assert.deepEqual(
      sends().map((r) => r.element?.text),
      [],
      'aucune carte d’envoi avant l’envoi final',
    );
    await assert.rejects(
      gateway.call('browser.click', { ref: await refFor(gateway, 'button[type=submit]') }),
      /Action refusée/,
    );
    assert.deepEqual(
      sends().map((r) => r.element?.text),
      ['Envoyer ma candidature'],
    );
    assert.deepEqual(writes, [], 'rien n’est parti sans accord');
  },
);

test(
  'Constat 2 : l’envoi final hors <form> ou au libellé conjugué a sa carte, et une seule',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const post = (n) => `onclick="fetch('/api/c/${n}',{method:'POST',body:'{}'})"`;
    const labels = [
      'Je postule',
      'Soumettre ma candidature',
      'Terminer',
      'Finaliser ma candidature',
      'Submit application',
      'Send',
      'Finish application',
    ];
    const { origin, writes } = await site(
      t,
      labels.map((label, i) => `<button id="b${i}" ${post(i)}>${label}</button>`).join('') +
        `<div role="button" tabindex="0" id="d" ${post('d')}>Candidatez</div>` +
        `<input type="button" id="v" value="Envoyer" ${post('v')}>` +
        // Bouton sans libellé (icône) vers un chemin d'envoi explicite : le garde réseau demande.
        `<button id="icon" aria-label="" onclick="fetch('/api/application/submit',{method:'POST',body:'{}'})">→</button>` +
        // Un bouton ordinaire qui enregistre une réponse : passe sans carte (tracé).
        `<button id="oui" onclick="fetch('/api/answers',{method:'POST',body:'{}'})">Oui</button>` +
        `<form><button type="button" id="inform" ${post('f')}>Je postule</button></form>`,
    );
    const { gateway, sends } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    const ids = [...labels.map((_, i) => `#b${i}`), '#d', '#v', '#icon'];
    for (const id of ids) {
      const before = sends().length;
      await gateway.call('browser.click', { ref: await refFor(gateway, id) });
      for (let i = 0; i < 100 && sends().length === before; i++) await sleep(20);
      assert.equal(sends().length, before + 1, `une carte pour ${id}`);
    }
    await sleep(300);
    assert.equal(sends().length, ids.length, 'une seule carte par envoi');
    assert.deepEqual(writes, [], 'aucun envoi refusé n’est parti');
    const answered = await gateway.call('browser.click', { ref: await refFor(gateway, '#oui') });
    for (let i = 0; i < 100 && !writes.length; i++) await sleep(20);
    assert.deepEqual(writes, ['POST /api/answers']);
    assert.equal(sends().length, ids.length, '« Oui » ne demande rien');
    assert.ok(answered);
    await assert.rejects(
      gateway.call('browser.click', { ref: await refFor(gateway, '#inform') }),
      /Action refusée/,
    );
    assert.equal(
      sends().at(-1).capability,
      'browser.click',
      'dans un formulaire : carte avant le clic',
    );
    assert.deepEqual(writes, ['POST /api/answers']);
  },
);

test(
  'Constat 2 : « Postuler » qui mène au formulaire ne demande rien pour les écritures de la nouvelle page',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, writes } = await site(t, (path) =>
      path === '/form'
        ? `<script>fetch('/api/draft',{method:'POST',body:'{}'})</script><form><input name="nom"></form>`
        : `<button onclick="location.href='/form'">Postuler</button>`,
    );
    const { gateway, sends } = await owner(t, origin);
    await gateway.call('browser.navigate', { url: origin });
    await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    for (let i = 0; i < 100 && !writes.length; i++) await sleep(20);
    assert.deepEqual(writes, ['POST /api/draft']);
    assert.deepEqual(sends(), []);
  },
);

// Formulaire FICTIF dont la soumission est asynchrone (validation, jeton), comme une SPA React.
const asyncForm = `<script>
  async function go() {
    await new Promise((r) => setTimeout(r, 400));
    await fetch('/api/candidatures', { method: 'POST', body: JSON.stringify({ nom: 'FICTIF' }) });
    await fetch('/api/suivi', { method: 'POST', body: '{}' });
    document.body.dataset.sent = '1';
  }
</script>
<form onsubmit="event.preventDefault(); go()"><input name="nom"><button type="submit">Envoyer ma candidature</button></form>`;

test(
  'Constat 5 : l’accord du clic couvre la soumission asynchrone qu’il déclenche : une carte, un envoi',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, writes } = await site(t, asyncForm);
    const { gateway, asked, sends } = await owner(t, origin, () => true);
    await gateway.call('browser.navigate', { url: origin });
    await gateway.call('browser.click', { ref: await refFor(gateway, 'button') });
    for (let i = 0; i < 150 && writes.length < 2; i++) await sleep(20);
    await sleep(300);
    assert.deepEqual(writes, ['POST /api/candidatures', 'POST /api/suivi']);
    assert.deepEqual(
      sends().map((r) => r.capability),
      ['browser.click'],
      'une seule carte, celle du clic',
    );
    assert.equal(asked.length, 1);
  },
);
