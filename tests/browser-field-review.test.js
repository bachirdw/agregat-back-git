import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds, getCapability } from '../packages/capability-registry/index.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

test('contrats FICTIFS : erreurs françaises pour les erreurs probables du modèle', () => {
  for (const [id, args, message] of [
    ['browser.select', { ref: 'e1', values: 'Oui' }, /values doit être une liste/],
    ['browser.select', { ref: 'e1' }, /values doit être une liste/],
    ['browser.type', { ref: 'e1' }, /text requis/],
    ['browser.upload', { ref: 'e1' }, /path requis/],
    ['browser.click', {}, /ref requise/],
  ])
    assert.throws(() => getCapability(id).schema.parse(args), message);
});

test(
  'Chrome FICTIF : constats techniques de la relecture reuse-01c, onglet caché SIMULÉ',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const server = http.createServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(`<title>FICTIF relecture</title>
      <label>Ville <input id="city" value="Sydnee"></label>
      <label>Code <input id="code" type="password" value="ancien" oninput="this.value='ancien'"></label>
      <label>Liste <select id="list"><option value="Non">Oui</option><option value="Oui">Non</option></select></label>
      <label style="position:relative;display:inline-block">Stylée
        <input id="styled" type="checkbox" style="position:absolute;left:0;top:0;opacity:0">
        <span style="position:absolute;left:0;top:0;width:20px;height:20px;background:#ccc"></span>
      </label>
      <label>Recherche <input id="search" onkeydown="window.codes=(window.codes||[]).concat(event.keyCode)"></label>
      <label>Dépôt <input id="drop" type="file" onchange="window.dropped=this.files[0].name;this.value=''"></label>
      <a href="/suivant">Suivant</a>`);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const folder = mkdtempSync(join(tmpdir(), 'relay-field-review-'));
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
        runId: 'FICTIF-field-review',
        workspace: folder,
        capabilities: capabilityIds,
        allowLocalOrigins: [origin],
      }),
      approve: async () => true,
    });
    // SIMULATION of Playwriter's background tab: hidden state, trusted mouse events lost, and
    // trusted keys without their default action (measured: CDP keyboard input is dropped).
    await gateway.call('browser.navigate', { url: origin });
    await provider.page.addInitScript(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'])
        document.addEventListener(
          type,
          (event) => {
            if (event.isTrusted) event.stopImmediatePropagation();
          },
          true,
        );
      document.addEventListener(
        'keydown',
        (event) => {
          if (event.isTrusted) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        },
        true,
      );
    });
    await gateway.call('browser.navigate', { url: origin });
    const snapshot = (await gateway.call('browser.snapshot')).snapshot;
    const ref = (name) =>
      snapshot
        .split('\n')
        .find((line) => line.includes(`"${name}"`) && line.includes('[ref='))
        ?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
    for (const name of ['Ville', 'Code', 'Liste', 'Stylée', 'Recherche', 'Dépôt', 'Suivant'])
      assert.ok(ref(name), `${name} absent du snapshot :\n${snapshot}`);
    const value = (id) => provider.page.locator(`#${id}`).inputValue();

    // n° 3: clearing a field must not depend on the Delete key.
    await gateway.call('browser.type', { ref: ref('Ville'), text: '' });
    assert.equal(await value('city'), '');
    // n° 8: a secret field restored by the page is an error, without echoing the text.
    await assert.rejects(
      gateway.call('browser.type', { ref: ref('Code'), text: 'FICTIF-secret' }),
      (error) => /Saisie non appliquée/.test(error.message) && !/FICTIF-secret/.test(error.message),
    );
    // n° 11: an exact value wins over another option's label.
    assert.deepEqual(
      (await gateway.call('browser.select', { ref: ref('Liste'), values: ['Oui'] })).selected,
      ['Oui'],
    );
    // n° 10: a styled checkbox covered by its own label decoration is still reachable.
    const styled = await gateway.call('browser.check', { ref: ref('Stylée'), checked: true });
    assert.deepEqual([styled.checked, styled.clickMode], [true, 'dom']);
    // n° 9: legacy widgets read keyCode.
    await gateway.call('browser.press', { ref: ref('Recherche'), key: 'ArrowDown' });
    assert.deepEqual(await provider.page.evaluate(() => window.codes), [40]);
    // n° 4: the page empties the field in its change handler; the file was still received.
    const dropped = await gateway.call('browser.upload', { ref: ref('Dépôt'), path: 'cv.txt' });
    assert.equal(dropped.uploaded, 'cv.txt');
    assert.equal(await provider.page.evaluate(() => window.dropped), 'cv.txt');
    // n° 2 (navigation): a link is never a file chooser.
    await assert.rejects(
      gateway.call('browser.upload', { ref: ref('Suivant'), path: 'cv.txt' }),
      /Upload refusé : ce lien navigue/,
    );
    assert.equal(new URL(provider.page.url()).pathname, '/');
  },
);
