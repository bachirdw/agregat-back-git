// Preuve manager de l'étape 4 : browser.fillForm par le gateway dans l'onglet caché RÉEL de Playwriter,
// page FICTIVE. Compare un appel groupé aux six appels unitaires équivalents (tours d'agent économisés).
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../../packages/capability-registry/index.js';

const status = await fetch('http://127.0.0.1:19988/extension/status', {
  signal: AbortSignal.timeout(3000),
}).then((r) => r.json());
console.log(JSON.stringify({ step: 'extension/status', connected: status.connected === true }));
if (status.connected !== true) process.exit(2);
const folder = mkdtempSync(join(tmpdir(), 'relay-fill-form-proof-'));
let posts = 0;
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html; charset=utf-8');
  if (req.method === 'POST') {
    posts++;
    return res.end('<title>FICTIF envoyé</title>');
  }
  res.end(`<title>FICTIF étape 1</title><form method="post">
  <label>Nom <input id="name"></label>
  <label>Téléphone <input id="phone" value="0000"></label>
  <label>Code <input id="code" type="password"></label>
  <label>Accord <input id="ok" type="checkbox"></label>
  <fieldset><legend>Visa</legend><label>Oui <input id="yes" type="radio" name="visa"></label><label>Non <input id="no" type="radio" name="visa"></label></fieldset>
  <label>Pays <select id="country"><option value="fr">France</option><option value="au">Australie</option></select></label>
  <button id="send">Envoyer</button></form>`);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 5000 });
const gateway = new BrowserGateway({
  provider,
  policy: new RunPolicy({
    ownerMode: true,
    allowSharedContext: true,
    runId: 'FICTIF-reuse-02',
    workspace: folder,
    capabilities: capabilityIds,
    allowLocalOrigins: [origin],
  }),
  approve: async () => true,
});
let failed = false;
try {
  await gateway.call('browser.navigate', { url: origin });
  const page = provider.page;
  const visibilityState = await page.evaluate(() => document.visibilityState);
  console.log(JSON.stringify({ step: 'visibility', visibilityState }));
  if (visibilityState !== 'hidden') throw new Error('Onglet visible : preuve non probante');
  const snapshot = (await gateway.call('browser.snapshot')).snapshot;
  const ref = (name) =>
    snapshot
      .split('\n')
      .find((l) => l.includes(`"${name}"`) && l.includes('[ref='))
      ?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
  const fields = [
    { ref: ref('Nom'), kind: 'text', text: 'FICTIF Nom' },
    { ref: ref('Téléphone'), kind: 'text', text: '' },
    { ref: ref('Code'), kind: 'text', text: 'FICTIF-secret' },
    { ref: ref('Accord'), kind: 'checkbox', checked: true },
    { ref: ref('Non'), kind: 'radio' },
    { ref: ref('Pays'), kind: 'select', values: ['Australie'] },
  ];
  const state = () =>
    page.evaluate(() => ({
      name: document.querySelector('#name').value,
      phone: document.querySelector('#phone').value,
      code: document.querySelector('#code').value === 'FICTIF-secret',
      ok: document.querySelector('#ok').checked,
      no: document.querySelector('#no').checked,
      country: document.querySelector('#country').value,
    }));
  let t = Date.now();
  const output = await gateway.call('browser.fillForm', { fields });
  const groupedMs = Date.now() - t;
  const grouped = await state();
  console.log(JSON.stringify({ step: 'fillForm', ms: groupedMs, hidden: output.hidden, filled: output.filled.length, state: grouped }));
  console.log(JSON.stringify({ step: 'secret-absent-du-resultat', ok: !JSON.stringify(output).includes('FICTIF-secret') }));
  // Same form, reloaded, through six unit calls (six agent turns in a real mission).
  await gateway.call('browser.navigate', { url: origin });
  const again = (await gateway.call('browser.snapshot')).snapshot;
  const ref2 = (name) =>
    again.split('\n').find((l) => l.includes(`"${name}"`) && l.includes('[ref='))?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
  t = Date.now();
  await gateway.call('browser.type', { ref: ref2('Nom'), text: 'FICTIF Nom' });
  await gateway.call('browser.type', { ref: ref2('Téléphone'), text: '' });
  await gateway.call('browser.type', { ref: ref2('Code'), text: 'FICTIF-secret' });
  await gateway.call('browser.check', { ref: ref2('Accord'), checked: true });
  await gateway.call('browser.check', { ref: ref2('Non'), checked: true });
  await gateway.call('browser.select', { ref: ref2('Pays'), values: ['Australie'] });
  console.log(JSON.stringify({ step: 'six-appels-unitaires', ms: Date.now() - t, calls: 6 }));
  // Second grouped call, after warm-up, to separate the first-call cost from the grouped path.
  await gateway.call('browser.navigate', { url: origin });
  const warm = (await gateway.call('browser.snapshot')).snapshot;
  const refW = (name) =>
    warm.split('\n').find((l) => l.includes(`"${name}"`) && l.includes('[ref='))?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
  t = Date.now();
  await gateway.call('browser.fillForm', {
    fields: fields.map((field, i) => ({ ...field, ref: refW(['Nom', 'Téléphone', 'Code', 'Accord', 'Non', 'Pays'][i]) })),
  });
  console.log(JSON.stringify({ step: 'fillForm-2e-appel', ms: Date.now() - t }));
  // Failure in the middle: option absent at field 3, fields 1-2 filled, field 4 untouched.
  await gateway.call('browser.navigate', { url: origin });
  const third = (await gateway.call('browser.snapshot')).snapshot;
  const ref3 = (name) =>
    third.split('\n').find((l) => l.includes(`"${name}"`) && l.includes('[ref='))?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
  let error = null;
  try {
    await gateway.call('browser.fillForm', {
      fields: [
        { ref: ref3('Nom'), kind: 'text', text: 'FICTIF Nom' },
        { ref: ref3('Accord'), kind: 'checkbox', checked: true },
        { ref: ref3('Pays'), kind: 'select', values: ['Tasmanie'] },
        { ref: ref3('Non'), kind: 'radio' },
      ],
    });
  } catch (e) {
    error = e.message;
  }
  const partial = await state();
  console.log(JSON.stringify({ step: 'echec-champ-3', error, state: partial }));
  const expected =
    grouped.name === 'FICTIF Nom' && grouped.phone === '' && grouped.code && grouped.ok && grouped.no && grouped.country === 'au' &&
    /^Champ 3 \(.+\), déjà remplis : .+ — Option introuvable : Tasmanie$/.test(error ?? '') &&
    partial.name === 'FICTIF Nom' && partial.ok && !partial.no && partial.country === 'fr' && posts === 0;
  console.log(JSON.stringify({ step: 'verdict', ok: expected, posts }));
  failed = !expected;
} finally {
  await provider.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  rmSync(folder, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;
