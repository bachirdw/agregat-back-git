// E43, cause racine (lue dans le code la nuit du 05 au 06/11, après trois occurrences réelles sur
// SEEK : essai B, mission e42413d4 du propriétaire, et ff246ce1) : browser_upload répondait
// « uploaded » (le champ avait bien reçu le fichier) mais le CV n'arrivait jamais chez le site.
// Beaucoup de sites envoient le fichier choisi, dans le gestionnaire de changement du champ, vers un
// hôte d'un autre site (stockage, autre domaine du recruteur). Le filtre réseau du mode propriétaire
// annulait en silence tout POST vers un autre site hors d'un clic de l'agent : le téléversement
// lui-même. Désormais, pendant le téléversement de l'agent et peu après, l'envoi du fichier par la
// page passe, tracé (hôte seul) ; un POST vers un autre site hors de ce moment reste bloqué. Chrome
// réel, deux serveurs FICTIFS locaux (127.0.0.1 et localhost : deux sites), aucun site réel.
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
const remoteOf = (stored) => stored.remote;
const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

async function setup(t) {
  const root = mkdtempSync(join(tmpdir(), 'televersement-FICTIF-'));
  writeFileSync(join(root, 'cv-FICTIF.pdf'), '%PDF-1.4\n% CV FICTIF\n%%EOF\n');
  // Le stockage FICTIF, sur un autre site que la page.
  const stored = { uploads: 0, json: 0, telemetry: 0, beacons: 0 };
  const storage = http.createServer((req, res) => {
    let size = 0;
    req.on('data', (chunk) => (size += chunk.length));
    req.on('end', () => {
      if (req.method === 'POST' && req.url === '/upload' && size > 0) stored.uploads++;
      if (req.method === 'POST' && req.url === '/upload-json' && size > 0) stored.json++;
      if (req.method === 'POST' && req.url === '/beacon') stored.beacons++;
      if (req.method === 'POST' && req.url === '/telemetry') stored.telemetry++;
      res.writeHead(200, { 'access-control-allow-origin': '*' });
      res.end('ok');
    });
  });
  const storagePort = await listen(storage);
  const remote = `http://localhost:${storagePort}`;
  stored.remote = remote;
  const site = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><title>Candidature FICTIVE</title>
      <p>Site FICTIF de test.</p>
      <label>CV <input type="file" id="cv"></label>
      <button type="button" id="mesure">Afficher les détails</button>
      <script>
        fetch('${remote}/telemetry', { method: 'POST', mode: 'no-cors', body: 'mesure FICTIVE' });
        document.getElementById('cv').addEventListener('change', (event) => {
          const body = new FormData();
          body.append('cv', event.target.files[0]);
          fetch('${remote}/upload', { method: 'POST', mode: 'no-cors', body });
          // Le même fichier en JSON base64, et une balise sans corps pendant le téléversement.
          event.target.files[0].arrayBuffer().then((bytes) => {
            const file = btoa(String.fromCharCode(...new Uint8Array(bytes)));
            fetch('${remote}/upload-json', { method: 'POST', mode: 'no-cors', body: JSON.stringify({ file }) });
          });
          navigator.sendBeacon('${remote}/beacon');
        });
        document.getElementById('mesure').addEventListener('click', () =>
          fetch('${remote}/telemetry', { method: 'POST', mode: 'no-cors', body: 'clic FICTIF' }));
      </script>`);
  });
  const origin = `http://127.0.0.1:${await listen(site)}`;
  const provider = new CdpBrowser({
    launch: { executablePath: CHROME },
    navigationTimeoutMs: 8000,
  });
  t.after(async () => {
    await provider.close().catch(() => {});
    site.close();
    storage.close();
    rmSync(root, { recursive: true, force: true });
  });
  const gateway = new BrowserGateway({
    provider,
    policy: new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-televersement',
      capabilities: capabilityIds,
      allowLocalOrigins: [origin, remote],
      allowJavaScript: true,
      workspace: root,
    }),
    approve: async () => true,
  });
  return { gateway, origin, stored };
}

test(
  'E43 FICTIF : le fichier téléversé part vers le stockage d’un autre site',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const { gateway, origin, stored } = await setup(t);
    await gateway.call('browser.navigate', { url: origin });
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Hors du téléversement, un POST vers un autre site reste bloqué (mesure d'audience).
    assert.equal(stored.telemetry, 0, 'mesure vers un autre site bloquée');
    const result = await gateway.call('browser.upload', {
      ref: await refFor(gateway, '#cv'),
      path: 'cv-FICTIF.pdf',
    });
    assert.equal(result.uploaded, 'cv-FICTIF.pdf');
    for (let i = 0; i < 50 && !stored.uploads; i++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(stored.uploads, 1, 'le fichier n’est pas arrivé au stockage FICTIF');
    for (let i = 0; i < 30 && !stored.json; i++)
      await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(stored.json, 1, 'le fichier en base64 n’est pas arrivé');
    assert.equal(stored.beacons, 0, 'une balise sans corps vers un autre site reste bloquée');
    // Un clic de l'agent après le téléversement referme la fenêtre : ses règles reprennent, et un
    // POST vers un autre site qui le suit reste bloqué (et dit).
    const click = await gateway.call('browser.click', { ref: await refFor(gateway, '#mesure') });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(stored.telemetry, 0, 'POST vers un autre site après un clic bloqué');
    assert.deepEqual(click.blockedThirdPartyPosts, [new URL(remoteOf(stored)).host]);
  },
);
