import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { existsSync } from 'node:fs';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../packages/capability-registry/index.js';

const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const median = (items) => [...items].sort((a, b) => a - b)[Math.floor(items.length / 2)];

test(
  'Chrome FICTIF : clic par ref, onglet caché SIMULÉ, navigation et cible retirée',
  { skip: !existsSync(CHROME) },
  async (t) => {
    const server = http.createServer((req, res) => {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      if (req.url === '/next')
        return res.end('<title>FICTIF suite</title><p id="arrival">Arrivée</p>');
      res.end(`<title>FICTIF clic</title><style>
      @keyframes sway { from { transform: translateX(-20px) } to { transform: translateX(20px) } }
      #moving { animation: sway .08s linear infinite alternate; margin: 40px }
      #cover { position: fixed; inset: 0; display: none; z-index: 2 }
      </style><button id="normal" onclick="document.body.dataset.normal = (+document.body.dataset.normal || 0) + 1">Normal</button>
      <button id="moving" onclick="document.body.dataset.moving = (+document.body.dataset.moving || 0) + 1">Mobile</button>
      <button id="remove" onclick="document.body.dataset.removed = 1; this.remove()">Retirer</button>
      <button id="replace" onclick="document.body.dataset.replace = (+document.body.dataset.replace || 0) + 1">Réécriture</button>
      <label>Case <input id="check" type="checkbox"></label>
      <button id="menu" onmousedown="document.body.dataset.menu = 1">Menu</button>
      <button id="disabled" disabled onclick="document.body.dataset.disabled = 1">Désactivé</button>
      <button id="covered" onclick="document.body.dataset.covered = 1">Couvert</button><div id="cover"></div>
      <a id="link" href="/next">Lien</a>
      <script>setInterval(() => history.replaceState({}, '', location.href), 100)</script>`);
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
        runId: 'FICTIF-click-ref',
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
    const click = (name) => gateway.call('browser.click', { ref: ref(name) });
    for (const name of [
      'Normal',
      'Mobile',
      'Retirer',
      'Réécriture',
      'Case',
      'Menu',
      'Désactivé',
      'Couvert',
      'Lien',
    ])
      assert.ok(ref(name), name);
    const normal = await click('Normal');
    assert.equal(normal.clickMode, 'mouse');
    assert.equal(normal.hidden, false);
    assert.equal(await provider.page.locator('body').getAttribute('data-normal'), '1');
    const originalTargetLocator = provider.targetLocator.bind(provider);
    provider.targetLocator = async (...args) => {
      const target = await originalTargetLocator(...args);
      target.click = async () => {
        await target.evaluate((el) => el.click());
        const error = new Error('FICTIF délai après livraison');
        error.name = 'TimeoutError';
        throw error;
      };
      return target;
    };
    const uncertain = await click('Normal');
    provider.targetLocator = originalTargetLocator;
    assert.equal(uncertain.clickMode, 'mouse');
    assert.equal(await provider.page.locator('body').getAttribute('data-normal'), '2');
    const moving = await click('Mobile');
    assert.equal(moving.clickMode, 'dom');
    assert.equal(moving.hidden, false);
    assert.equal(await provider.page.locator('body').getAttribute('data-moving'), '1');
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
    const times = [];
    for (let i = 0; i < 10; i++) {
      const start = Date.now();
      const result = await click('Réécriture');
      times.push(Date.now() - start);
      assert.equal(result.clickMode, 'dom');
      assert.equal(result.hidden, true);
    }
    assert.equal(await provider.page.locator('body').getAttribute('data-replace'), '10');
    assert.ok(median(times) < 900, `clic caché médian ${median(times)} ms`);
    console.log(`FICTIF onglet caché simulé : médiane de 10 clics ${median(times)} ms`);
    const start = Date.now();
    assert.equal((await click('Retirer')).clickMode, 'dom');
    assert.ok(Date.now() - start < 1500, 'aucune attente du locator après retrait');
    assert.equal(await provider.page.locator('body').getAttribute('data-removed'), '1');
    await click('Case');
    assert.equal(await provider.page.locator('#check').isChecked(), true);
    await click('Menu');
    assert.equal(await provider.page.locator('body').getAttribute('data-menu'), '1');
    await assert.rejects(click('Désactivé'), /invisible ou désactivé/);
    assert.equal(await provider.page.locator('body').getAttribute('data-disabled'), null);
    await provider.page.locator('#normal').evaluate((el) => {
      el.hidden = true;
    });
    await assert.rejects(click('Normal'), /invisible ou désactivé/);
    assert.equal(await provider.page.locator('body').getAttribute('data-normal'), null);
    await provider.page.locator('#cover').evaluate((el) => {
      el.style.display = 'block';
    });
    await assert.rejects(click('Couvert'), /masqué par div/);
    assert.equal(await provider.page.locator('body').getAttribute('data-covered'), null);
    await provider.page.locator('#cover').evaluate((el) => {
      el.style.display = 'none';
    });
    const linked = await click('Lien');
    assert.equal(linked.clickMode, 'dom');
    assert.equal(linked.hidden, true);
    assert.equal(await provider.page.locator('#arrival').count(), 1);
  },
);
