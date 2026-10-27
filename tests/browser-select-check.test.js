import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync } from 'node:fs';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds, getCapability } from '../packages/capability-registry/index.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

test('contrats FICTIFS : schémas stricts et erreurs françaises', () => {
  for (const [id, args, message] of [
    ['browser.check', { ref: 'e1', checked: 'yes' }, /booléen/],
    ['browser.check', { ref: 'e1', checked: true, selector: '#x' }, /Unrecognized key/],
    ['browser.select', { ref: 'e1', values: [] }, /Au moins une option/],
    ['browser.select', { ref: 'e1', values: Array(21).fill('x') }, /Maximum 20/],
    ['browser.select', { ref: 'e1', values: [42] }, /chaîne/],
    ['browser.select', { ref: 'bad', values: ['x'] }, /Référence invalide/],
  ])
    assert.throws(() => getCapability(id).schema.parse(args), message);
  assert.equal(getCapability('browser.check').effect, 'write');
  assert.equal(getCapability('browser.select').effect, 'write');
});

test('gateway FICTIVE : check et select refusent un élément modifié pendant approbation', async () => {
  for (const [id, args] of [
    ['browser.check', { ref: 'e1', checked: true }],
    ['browser.select', { ref: 'e1', values: ['x'] }],
  ]) {
    let reads = 0;
    let performed = false;
    const provider = {
      name: 'fictif',
      currentUrl: async () => 'http://127.0.0.1:9999/',
      describe: async () => ({ tag: 'input', text: ++reads === 1 ? 'avant' : 'après' }),
      perform: async () => {
        performed = true;
        return {};
      },
    };
    const gateway = new BrowserGateway({
      provider,
      policy: new RunPolicy({
        capabilities: capabilityIds,
        allowLocalOrigins: ['http://127.0.0.1:9999'],
      }),
      approve: async () => true,
    });
    await assert.rejects(gateway.call(id, args), /modifié pendant l’approbation/);
    assert.equal(performed, false);
    assert.equal(reads, 2);
  }
});

test(
  'Chrome FICTIF : check et select par ref, y compris onglet caché SIMULÉ',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const server = http.createServer((_req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      if (_req.url === '/empty') return res.end('<title>FICTIF vide</title><p>Vide</p>');
      res.end(`<title>FICTIF contrôles</title>
      <label>Accord <input id="box" type="checkbox"></label>
      <fieldset><legend>Choix</legend><label>Un <input id="one" type="radio" name="choice" value="one"></label><label>Deux <input id="two" type="radio" name="choice" value="two"></label></fieldset>
      <label>Simple <select id="single"><option value="a">Alpha</option><option value="b">Bêta</option></select></label>
      <label>Multiple <select id="multi" multiple><option value="x">Xylophone</option><option value="y">Ypsilon</option><option value="z">Zèbre</option></select></label>`);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const provider = new CdpBrowser({
      launch: { executablePath: CHROME },
      navigationTimeoutMs: 5000,
    });
    t.after(() => provider.close());
    const gateway = new BrowserGateway({
      provider,
      policy: new RunPolicy({
        ownerMode: true,
        runId: 'FICTIF-select-check',
        capabilities: capabilityIds,
        allowLocalOrigins: [origin],
      }),
      approve: async () => true,
    });
    await gateway.call('browser.navigate', { url: origin });
    let snapshot = (await gateway.call('browser.snapshot')).snapshot;
    const ref = (name) =>
      snapshot
        .split('\n')
        .find((line) => line.includes(`"${name}"`) && line.includes('[ref='))
        ?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
    for (const name of ['Accord', 'Un', 'Deux', 'Simple', 'Multiple']) assert.ok(ref(name), name);
    await provider.page.evaluate(() => {
      window.events = { input: 0, change: 0 };
      for (const type of ['input', 'change'])
        document.querySelector('#box').addEventListener(type, () => window.events[type]++);
    });
    const check = (name, checked) => gateway.call('browser.check', { ref: ref(name), checked });
    const selected = (selector) =>
      provider.page
        .locator(selector)
        .evaluate((el) => Array.from(el.selectedOptions, (option) => option.value));
    assert.deepEqual(
      await check('Accord', true).then(({ checked, changed, clickMode }) => ({
        checked,
        changed,
        clickMode,
      })),
      { checked: true, changed: true, clickMode: 'mouse' },
    );
    assert.equal((await check('Accord', true)).changed, false);
    assert.deepEqual(await provider.page.evaluate(() => window.events), { input: 1, change: 1 });
    await check('Accord', false);
    assert.deepEqual(await provider.page.evaluate(() => window.events), { input: 2, change: 2 });
    assert.equal((await check('Deux', true)).checked, true);
    assert.equal(await provider.page.locator('#one').isChecked(), false);
    await assert.rejects(check('Deux', false), /impossible à décocher/);
    await assert.rejects(check('Simple', true), /case à cocher ou bouton radio/);
    assert.deepEqual(
      await gateway
        .call('browser.select', { ref: ref('Simple'), values: ['Bêta'] })
        .then(({ selected }) => selected),
      ['b'],
    );
    assert.deepEqual(
      await gateway
        .call('browser.select', { ref: ref('Multiple'), values: ['x', 'Ypsilon'] })
        .then(({ selected }) => selected),
      ['x', 'y'],
    );
    await assert.rejects(
      gateway.call('browser.select', { ref: ref('Simple'), values: ['absente'] }),
      /option.*introuvable|introuvable.*option/i,
    );
    assert.deepEqual(await selected('#single'), ['b']);
    await assert.rejects(
      gateway.call('browser.check', { ref: 'e99999', checked: true }),
      /référence|ref/i,
    );
    await assert.rejects(
      gateway.call('browser.select', { ref: ref('Simple'), values: [] }),
      /valeur|chaîne|array/i,
    );

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
    });
    await gateway.call('browser.navigate', { url: origin });
    snapshot = (await gateway.call('browser.snapshot')).snapshot;
    await provider.page.evaluate(() => {
      window.events = { input: 0, change: 0 };
      for (const type of ['input', 'change'])
        document.querySelector('#box').addEventListener(type, () => window.events[type]++);
    });
    const hiddenCheck = await check('Accord', true);
    assert.equal(hiddenCheck.clickMode, 'dom');
    assert.equal(hiddenCheck.hidden, true);
    assert.deepEqual(await provider.page.evaluate(() => window.events), { input: 1, change: 1 });
    await provider.page
      .locator('#box')
      .evaluate((el) => el.addEventListener('click', (event) => event.preventDefault()));
    await assert.rejects(check('Accord', false), /État coché différent/);
    assert.equal(await provider.page.locator('#box').isChecked(), true);
    assert.equal((await check('Accord', true)).changed, false);
    assert.deepEqual(await provider.page.evaluate(() => window.events), { input: 1, change: 1 });
    assert.deepEqual(
      await gateway
        .call('browser.select', { ref: ref('Multiple'), values: ['z', 'x'] })
        .then(({ selected }) => selected),
      ['x', 'z'],
    );
    const stale = ref('Accord');
    await gateway.call('browser.navigate', { url: `${origin}/empty` });
    await assert.rejects(
      gateway.call('browser.check', { ref: stale, checked: true }),
      /référence|ref/i,
    );
    await assert.rejects(
      gateway.call('browser.select', { ref: stale, values: ['x'] }),
      /référence|ref/i,
    );
  },
);
