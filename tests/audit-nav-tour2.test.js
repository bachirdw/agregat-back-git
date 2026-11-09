// Audit du 10/11, second tour (correctifs-nav2.md), Chrome headless isolé, pages FICTIVES locales,
// aucun site réel. Mode propriétaire : tout ce qui automatise le navigateur passe sans carte, sauf
// l'envoi final ; aucune écriture n'est annulée sans le dire.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';
import { refFor } from './support/click-ref.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Page FICTIVE servie en local ; `writes` garde les écritures reçues (méthode, chemin, taille).
async function site(t, html, { status = () => 200, delay = () => 0 } = {}) {
  const writes = [];
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET') {
      let size = 0;
      req.on('data', (chunk) => (size += chunk.length));
      req.on('end', () => {
        writes.push({ line: `${req.method} ${req.url}`, size });
        setTimeout(() => {
          res.writeHead(status(req), { 'content-type': 'application/json' });
          res.end('{}');
        }, delay(req));
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
    origin: `http://127.0.0.1:${server.address().port}`,
    writes,
    lines: () => writes.map((w) => w.line),
  };
}

async function owner(t, origin, decide = () => true) {
  const folder = mkdtempSync(join(tmpdir(), 'audit-nav2-FICTIF-'));
  const provider = new CdpBrowser({
    launch: { executablePath: CHROME },
    navigationTimeoutMs: 8000,
  });
  const asked = [];
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-audit-nav2',
      workspace: folder,
      capabilities: capabilityIds,
      allowLocalOrigins: [origin],
      allowJavaScript: true,
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
  return {
    gateway,
    provider,
    folder,
    asked,
    sends: () => asked.filter((r) => r.actionClass === 'send'),
  };
}

// Un CV PDF FICTIF de 180 ko : un vrai CV dépasse souvent 100 ko.
const bigCv = (folder) =>
  writeFileSync(
    join(folder, 'cv-FICTIF.pdf'),
    `%PDF-1.4\n% CV FICTIF\n${'0'.repeat(180_000)}\n%%EOF\n`,
  );

test(
  'Constat 13 : un CV de 180 ko téléversé vers /apply/…/resume du même site part, sans carte',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, writes, lines } = await site(
      t,
      `<form><input type="file" name="cv" onchange="
        const body = new FormData(); body.append('cv', this.files[0]);
        fetch('/apply/123/resume', { method: 'POST', body });"></form>`,
    );
    const { gateway, folder, sends } = await owner(t, origin);
    bigCv(folder);
    await gateway.call('browser.navigate', { url: origin });
    const result = await gateway.call('browser.upload', {
      ref: await refFor(gateway, 'input[type=file]'),
      path: 'cv-FICTIF.pdf',
    });
    assert.equal(result.uploaded, 'cv-FICTIF.pdf');
    for (let i = 0; i < 100 && !writes.length; i++) await sleep(30);
    assert.deepEqual(lines(), ['POST /apply/123/resume'], 'le CV n’est jamais arrivé au site');
    assert.ok(writes[0].size > 100_000);
    assert.deepEqual(sends(), [], 'un téléversement de pièce n’est pas l’envoi final');
  },
);

test(
  'Constat 13 : une candidature de plus de 100 ko (CV et contact) postée par la page attend la carte, jamais une annulation muette',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { origin, writes, lines } = await site(
      t,
      `<form><input type="file" name="cv"><input name="email" value="candidat@example.test"></form>
      <button id="go" onclick="
        const body = new FormData(document.querySelector('form'));
        fetch('/apply/123/submit', { method: 'POST', body });">Je postule</button>`,
    );
    const { gateway, folder, sends } = await owner(t, origin);
    bigCv(folder);
    await gateway.call('browser.navigate', { url: origin });
    await gateway.call('browser.upload', {
      ref: await refFor(gateway, 'input[type=file]'),
      path: 'cv-FICTIF.pdf',
    });
    await gateway.call('browser.click', { ref: await refFor(gateway, '#go') });
    for (let i = 0; i < 100 && !writes.length; i++) await sleep(30);
    assert.deepEqual(
      sends().map((r) => r.capability),
      ['browser.send'],
      'l’envoi final de plus de 100 ko demande le clic du propriétaire',
    );
    assert.deepEqual(lines(), ['POST /apply/123/submit'], 'accordé, il part');
  },
);
