import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync } from 'node:fs';
import { CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

test(
  'Chrome FICTIF : formulaire groupé visible et caché, erreurs partielles et secret',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const server = http.createServer((_request, response) => {
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(`<title>FICTIF formulaire</title><form onsubmit="window.submits++ ; return false">
      <label>Nom <input id="name"></label>
      <label>Accord <input id="box" type="checkbox"></label>
      <label>Choix <input id="radio" name="choice" type="radio"></label>
      <label>Région <select id="single"><option value="a">Alpha</option><option value="b">Bêta</option></select></label>
      <label>Langues <select id="multi" multiple><option value="x">X</option><option value="y">Y</option></select></label>
      <label>Secret <input id="secret" type="password"></label>
      <button type="submit">Envoyer</button></form>
      <script>window.submits = 0; window.events = {}; for (const el of document.querySelectorAll('input,select')) {
        window.events[el.id] = { input: 0, change: 0 };
        for (const type of ['input', 'change']) el.addEventListener(type, () => window.events[el.id][type]++);
      }</script>`);
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
    const policy = new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-fill-form',
      capabilities: capabilityIds,
      allowLocalOrigins: [origin],
    });
    await provider.prepare(policy, async () => true);
    const perform = (id, args) => provider.perform(id, args, policy);
    const setup = async () => {
      await perform('browser.navigate', { url: origin });
      const snapshot = (await perform('browser.snapshot', {})).snapshot;
      const ref = (name) =>
        snapshot
          .split('\n')
          .find((line) => line.includes(`"${name}"`) && line.includes('[ref='))
          ?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
      const names = ['Nom', 'Accord', 'Choix', 'Région', 'Langues', 'Secret'];
      const refs = Object.fromEntries(names.map((name) => [name, ref(name)]));
      for (const name of names) assert.ok(refs[name], `${name} absent du snapshot`);
      return refs;
    };
    const fields = (refs) => [
      { ref: refs.Nom, kind: 'text', value: 'Ada' },
      { ref: refs.Accord, kind: 'checkbox', value: true },
      { ref: refs.Choix, kind: 'radio', value: true },
      { ref: refs.Région, kind: 'select', value: ['Bêta'] },
      { ref: refs.Langues, kind: 'select', value: ['x', 'Y'] },
    ];
    for (const hidden of [false, true]) {
      if (hidden) {
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
      }
      const refs = await setup();
      const result = await perform('browser.fillForm', { fields: fields(refs) });
      assert.equal(result.url, origin + '/');
      assert.equal(result.hidden, hidden);
      assert.deepEqual(
        result.filled.map(({ ref, kind }) => ({ ref, kind })),
        fields(refs).map(({ ref, kind }) => ({ ref, kind })),
      );
      assert.deepEqual(
        await provider.page.evaluate(() => ({
          name: document.querySelector('#name').value,
          box: document.querySelector('#box').checked,
          radio: document.querySelector('#radio').checked,
          single: document.querySelector('#single').value,
          multi: Array.from(
            document.querySelector('#multi').selectedOptions,
            (option) => option.value,
          ),
          submits: window.submits,
        })),
        { name: 'Ada', box: true, radio: true, single: 'b', multi: ['x', 'y'], submits: 0 },
      );
      // A text input emits change on blur; fill() itself emits input only.
      await provider.page.locator('#name').evaluate((el) => el.blur());
      const events = await provider.page.evaluate(() => window.events);
      for (const id of ['name', 'box', 'radio', 'single', 'multi'])
        assert.deepEqual(events[id], { input: 1, change: 1 }, id);
      const again = await perform('browser.fillForm', {
        fields: [{ ref: refs.Accord, kind: 'checkbox', value: true }],
      });
      assert.equal(again.filled[0].changed, false);
      assert.deepEqual(await provider.page.evaluate(() => window.events.box), {
        input: 1,
        change: 1,
      });
    }
    let refs = await setup();
    await assert.rejects(
      perform('browser.fillForm', {
        fields: [
          ...fields(refs).slice(0, 2),
          { ref: refs.Région, kind: 'select', value: ['Tasmanie'] },
          ...fields(refs).slice(3),
        ],
      }),
      (error) => {
        assert.match(
          error.message,
          new RegExp(`Champ 3 \\(${refs.Région}\\).*Option introuvable.*Tasmanie`),
        );
        assert.match(error.message, new RegExp(`déjà remplis.*${refs.Nom}.*${refs.Accord}`));
        return true;
      },
    );
    assert.equal(await provider.page.locator('#name').inputValue(), 'Ada');
    assert.equal(await provider.page.locator('#box').isChecked(), true);
    assert.equal(
      await provider.page.locator('#multi').evaluate((el) => el.selectedOptions.length),
      0,
    );
    refs = await setup();
    await provider.page
      .locator('#name')
      .evaluate((el) =>
        el.addEventListener('input', () => document.querySelector('#box').remove(), { once: true }),
      );
    await assert.rejects(
      perform('browser.fillForm', {
        fields: fields(refs),
      }),
      (error) => {
        assert.match(error.message, new RegExp(`Champ 2 \\(${refs.Accord}\\)`));
        assert.match(error.message, /référence|ref/i);
        return true;
      },
    );
    assert.equal(await provider.page.locator('#name').inputValue(), 'Ada');
    assert.equal(await provider.page.locator('#radio').isChecked(), false);
    // Fields after the stale ref stay untouched (select fields included).
    assert.deepEqual(
      await provider.page.evaluate(() => [
        document.querySelector('#single').value,
        document.querySelector('#multi').selectedOptions.length,
      ]),
      ['a', 0],
    );
    refs = await setup();
    // A kind that does not match the element fails on that field and changes nothing.
    await assert.rejects(
      perform('browser.fillForm', { fields: [{ ref: refs.Accord, kind: 'text', value: 'x' }] }),
      new RegExp(`Champ 1 \\(${refs.Accord}\\)`),
    );
    await assert.rejects(
      perform('browser.fillForm', {
        fields: [{ ref: refs.Région, kind: 'checkbox', value: true }],
      }),
      new RegExp(`Champ 1 \\(${refs.Région}\\)`),
    );
    assert.equal(await provider.page.locator('#box').isChecked(), false);
    assert.equal(await provider.page.locator('#single').inputValue(), 'a');
    refs = await setup();
    const secret = 'FICTIF-secret-unique-973';
    const password = await perform('browser.fillForm', {
      fields: [{ ref: refs.Secret, kind: 'text', value: secret }],
    });
    assert.equal(password.filled[0].typed, secret.length);
    assert.ok(!JSON.stringify(password).includes(secret));
    await provider.page.locator('#secret').evaluate((el) =>
      el.addEventListener('input', () => {
        el.value = '';
      }),
    );
    await assert.rejects(
      perform('browser.fillForm', { fields: [{ ref: refs.Secret, kind: 'text', value: secret }] }),
      (error) => {
        assert.ok(!error.message.includes(secret));
        assert.match(error.message, /Champ 1/);
        return true;
      },
    );
  },
);

test(
  'Chrome FICTIF : fillForm efface un champ et garde un message d’erreur lisible',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const server = http.createServer((_request, response) => {
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(`<title>FICTIF erreurs</title>
      <label>Ville <input id="city" value="Sydnee"></label>
      <label>Bloqué <input id="stuck" oninput="this.value=''"></label>`);
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
    const policy = new RunPolicy({
      ownerMode: true,
      runId: 'FICTIF-fill-form-errors',
      capabilities: capabilityIds,
      allowLocalOrigins: [origin],
    });
    await provider.prepare(policy, async () => true);
    await provider.perform('browser.navigate', { url: origin }, policy);
    const snapshot = (await provider.perform('browser.snapshot', {}, policy)).snapshot;
    const ref = (name) =>
      snapshot
        .split('\n')
        .find((line) => line.includes(`"${name}"`) && line.includes('[ref='))
        ?.match(/\[ref=((?:f\d+)?e\d+)\]/)?.[1];
    // A one-letter text is not masked inside the French cause, and the progress comes first.
    await assert.rejects(
      provider.perform(
        'browser.fillForm',
        {
          fields: [
            { ref: ref('Ville'), kind: 'text', value: '' },
            { ref: ref('Bloqué'), kind: 'text', value: 'a' },
          ],
        },
        policy,
      ),
      (error) =>
        error.message ===
        `Champ 2 (${ref('Bloqué')}), déjà remplis : ${ref('Ville')} — Saisie sans effet : champ vide après saisie`,
    );
    assert.equal(await provider.page.locator('#city').inputValue(), '');
  },
);
