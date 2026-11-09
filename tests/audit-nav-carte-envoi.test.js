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
