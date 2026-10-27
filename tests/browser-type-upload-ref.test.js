import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { snapshotRefs } from '../packages/browser-gateway/cdp.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds, getCapability } from '../packages/capability-registry/index.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

test('contrats FICTIFS : saisie, touche, upload et téléchargement par ref seulement', () => {
  for (const [id, args, message] of [
    ['browser.type', { selector: '#x', text: 'a' }, /Unrecognized key/],
    ['browser.upload', { selector: '#x', path: 'a' }, /Unrecognized key/],
    ['browser.download', { selector: '#x' }, /Unrecognized key/],
    ['browser.press', { ref: 'e1', key: 'Enter' }, /Touche non autorisée/],
    ['browser.press', { ref: 'e1', key: ' ' }, /Touche non autorisée/],
    ['browser.extract', { ref: 'e1', limit: 3 }, /limit > 1 exige un sélecteur/],
  ])
    assert.throws(() => getCapability(id).schema.parse(args), message);
  assert.ok(getCapability('browser.extract').schema.parse({ selector: 'h3', limit: 3 }));
  assert.equal(getCapability('browser.press').effect, 'write');
});

test('refs FICTIVES : seules les refs de la structure du snapshot sont retenues', () => {
  const refs = snapshotRefs(
    [
      '- button "Annuler [ref=e7]" [ref=e2] [cursor=pointer]',
      '- paragraph [ref=e3]: texte de page [ref=e9]',
      '- generic [ref=f1e4]:',
      '  - /url: /x',
    ].join('\n'),
  );
  assert.deepEqual([...refs], ['e2', 'e3', 'f1e4']);
});

test(
  'Chrome FICTIF : saisie, touche et fichiers par ref, onglet caché SIMULÉ',
  { skip: !existsSync(CHROME) },
  async (t) => {
    let submits = 0;
    const server = http.createServer((req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      if (req.method === 'POST') {
        submits++;
        return res.end('<title>FICTIF envoyé</title>');
      }
      // The fixed band mimics Playwriter's toolbar drawn over the agent tab (real proof: it covers
      // the top of the page and made the reachability check refuse a checkbox).
      res.end(`<title>FICTIF champs</title>
      <div data-playwriter-toolbar="1" style="position:fixed;top:0;left:0;right:0;height:80px;z-index:9"></div>
      <form method="post">
        <label>Accord <input id="ok" type="checkbox"></label>
        <label>Nom <input id="name"></label>
        <label>Téléphone <input id="phone" oninput="this.value=this.value.replace(/(\\d{4})(\\d{3})(\\d{3})/, '$1 $2 $3')"></label>
        <label>Ville <input id="city" onkeydown="window.keys=(window.keys||[]).concat(event.key)"></label>
        <label>Pièce <input id="file" type="file"></label>
        <input id="hidden-file" type="file" style="display:none">
        <button type="button" onclick="document.getElementById('hidden-file').click()">Joindre</button>
        <button id="send">Envoyer</button>
      </form>`);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const folder = mkdtempSync(join(tmpdir(), 'relay-type-upload-'));
    writeFileSync(join(folder, 'cv.txt'), 'FICTIF');
    t.after(() => rmSync(folder, { recursive: true, force: true }));
    const provider = new CdpBrowser({
      launch: { executablePath: CHROME },
      navigationTimeoutMs: 5000,
    });
    t.after(() => provider.close());
    const gateway = new BrowserGateway({
      provider,
      policy: new RunPolicy({
        ownerMode: true,
        runId: 'FICTIF-type-upload',
        workspace: folder,
        capabilities: capabilityIds,
        allowLocalOrigins: [origin],
      }),
      approve: async () => true,
    });
    await gateway.call('browser.navigate', { url: origin });
    const snapshot = (await gateway.call('browser.snapshot')).snapshot;
    const ref = (name) =>
      snapshot
        .split('\n')
        .find((line) => line.includes(`"${name}"`) && line.includes('[ref='))
        ?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
    for (const name of ['Nom', 'Téléphone', 'Ville', 'Pièce', 'Joindre', 'Envoyer'])
      assert.ok(ref(name), `${name} absent du snapshot :\n${snapshot}`);
    const value = (id) => provider.page.locator(`#${id}`).inputValue();
    const files = (id) =>
      provider.page.locator(`#${id}`).evaluate((el) => Array.from(el.files, (f) => f.name));

    // Visible tab: real keyboard input.
    assert.equal(
      (await gateway.call('browser.press', { ref: ref('Ville'), key: 'ArrowDown' })).mode,
      'keyboard',
    );
    // SIMULATION of Playwriter's background tab: only visibilityState is forced here.
    await provider.page.evaluate(() =>
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      }),
    );
    const typed = await gateway.call('browser.type', { ref: ref('Nom'), text: 'FICTIF Nom' });
    assert.equal(await value('name'), 'FICTIF Nom');
    assert.equal(typed.value, undefined);
    const phone = await gateway.call('browser.type', { ref: ref('Téléphone'), text: '0412345678' });
    assert.equal(phone.value, '0412 345 678');
    const pressed = await gateway.call('browser.press', { ref: ref('Ville'), key: 'Escape' });
    assert.deepEqual([pressed.mode, pressed.hidden], ['dom', true]);
    assert.deepEqual(await provider.page.evaluate(() => window.keys), ['ArrowDown', 'Escape']);

    const direct = await gateway.call('browser.upload', { ref: ref('Pièce'), path: 'cv.txt' });
    assert.equal(direct.via, 'input');
    assert.deepEqual(await files('file'), ['cv.txt']);
    const chooser = await gateway.call('browser.upload', { ref: ref('Joindre'), path: 'cv.txt' });
    assert.equal(chooser.via, 'chooser');
    assert.deepEqual(await files('hidden-file'), ['cv.txt']);
    await assert.rejects(
      gateway.call('browser.upload', { ref: ref('Envoyer'), path: 'cv.txt' }),
      /ce bouton soumet le formulaire/,
    );
    assert.equal(submits, 0);
    // Under the Playwriter band and in the hidden tab: the DOM path still reaches the checkbox.
    const checked = await gateway.call('browser.check', { ref: ref('Accord'), checked: true });
    assert.deepEqual([checked.checked, checked.clickMode], [true, 'dom']);
    assert.equal(await provider.page.locator('#ok').isChecked(), true);
  },
);
