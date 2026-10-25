import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';

// End-to-end through the real web UI in an isolated headless Chrome (throwaway profile).
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const temporary = () => mkdtempSync(join(tmpdir(), 'relay-e2e-'));

async function open(t) {
  const { chromium } = await import('playwright-core');
  const app = createApp({ dataDir: temporary() });
  let browser;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      await app.close();
    }
  });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  browser = await chromium.launch({ executablePath: CHROME, headless: true, timeout: 30000 });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${app.server.address().port}/`);
  await page.waitForSelector('body[data-ready="1"]', { state: 'attached' });
  return { app, page, errors };
}

test(
  'E2E interface : workflow Najah, étapes en direct, résultats fictifs étiquetés, coût',
  { skip: !existsSync(CHROME) && 'Chrome absent' },
  async (t) => {
    const { page, errors } = await open(t);
    // Each install re-renders the list: always re-query the first remaining button.
    for (let i = 0; i < 10; i++) {
      const next = page.locator('#skill-list button', { hasText: 'Installer' }).first();
      if (!(await next.count())) break;
      await next.click();
      await page.waitForTimeout(150);
    }
    assert.equal(await page.locator('#skill-list button', { hasText: 'Installer' }).count(), 0);
    await page.selectOption('#pack', 'najah');
    await page.selectOption('#mode-select', 'workflow');
    await page.selectOption('#workflow-select', 'opportunity-discovery-dag');
    await page.click('#plan-button');
    await page.waitForSelector('#plan-panel:not([hidden])');
    const plan = await page.locator('#plan').innerText();
    assert.match(plan, /Analyser le classement · Démonstrateur ACP \(optionnelle\)/);
    assert.match(plan, /Coût plateforme estimé : 0,00/);
    await page.click('#launch');
    await page.waitForFunction(
      () => document.getElementById('run-state').textContent === 'Terminée',
      null,
      { timeout: 30000 },
    );
    const steps = await page.locator('#steps').innerText();
    assert.equal((steps.match(/Réussie/g) ?? []).length, 6);
    const result = await page.locator('#result').innerText();
    assert.match(result, /DONNÉES FICTIVES/);
    assert.match(result, /Software Engineer — Python/);
    assert.match(result, /Registre de consommation : intègre/);
    assert.deepEqual(errors, []);
  },
);

test(
  'E2E interface : brouillon de candidature, approbation humaine dans l’interface',
  { skip: !existsSync(CHROME) && 'Chrome absent' },
  async (t) => {
    const { page, errors } = await open(t);
    await page.fill('#prompt', 'Lettre pour un poste de data engineer (offre fictive)');
    await page.selectOption('#pack', 'najah');
    await page.selectOption('#mode-select', 'workflow');
    await page.selectOption('#workflow-select', 'application-draft');
    await page.click('#plan-button');
    await page.waitForSelector('#plan-panel:not([hidden])');
    await page.click('#launch');
    const approve = page.locator('#steps button', { hasText: 'Approuver' });
    await approve.waitFor({ timeout: 30000 });
    assert.match(await page.locator('#steps').innerText(), /Approbation requise/);
    await approve.click();
    await page.waitForFunction(
      () => document.getElementById('run-state').textContent === 'Terminée',
      null,
      { timeout: 30000 },
    );
    assert.equal((await page.locator('#steps').innerText()).match(/Réussie/g)?.length, 4);
    assert.deepEqual(errors, []);
  },
);

test(
  'E2E interface : estimation au-dessus du budget signalée puis lancement refusé',
  { skip: !existsSync(CHROME) && 'Chrome absent' },
  async (t) => {
    const { app, page } = await open(t);
    app.engine.pricing.centsPerUnit.tool_call = 50;
    await page.selectOption('#pack', 'najah');
    await page.selectOption('#mode-select', 'workflow');
    await page.fill('#budget', '0.10');
    await page.click('#plan-button');
    await page.waitForSelector('#plan-panel:not([hidden])');
    assert.match(await page.locator('#plan').innerText(), /Estimation supérieure au budget/);
    await page.click('#launch');
    await page.waitForSelector('#error:not([hidden])');
    assert.match(await page.locator('#error').innerText(), /Budget insuffisant/);
    assert.equal(app.store.list().length, 0);
  },
);

test(
  'E2E interface : saisie avant chargement du catalogue sans erreur',
  { skip: !existsSync(CHROME) && 'Chrome absent' },
  async (t) => {
    const { chromium } = await import('playwright-core');
    const app = createApp({ dataDir: temporary() });
    let browser;
    t.after(async () => {
      try {
        await browser?.close();
      } finally {
        await app.close();
      }
    });
    await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
    browser = await chromium.launch({
      executablePath: CHROME,
      headless: true,
      timeout: 30000,
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route('**/api/catalog', async (route) => {
      await new Promise((r) => setTimeout(r, 500)); // slow catalog
      await route.continue();
    });
    await page.goto(`http://127.0.0.1:${app.server.address().port}/`);
    await page.fill('#prompt', 'Saisie rapide avant chargement');
    await page.waitForSelector('body[data-ready="1"]', { state: 'attached' });
    assert.deepEqual(errors, []);
  },
);

test(
  'E2E interface : édition pendant le calcul du plan conserve le plan invalidé',
  { skip: !existsSync(CHROME) && 'Chrome absent' },
  async (t) => {
    const { app, page, errors } = await open(t);
    let release;
    const gate = new Promise((r) => {
      release = r;
    });
    t.after(() => release());
    let requested;
    const seen = new Promise((r) => {
      requested = r;
    });
    await page.route('**/api/plan', async (route) => {
      const response = await route.fetch();
      requested();
      await gate;
      await route.fulfill({ response });
    });
    await page.click('#plan-button');
    await seen;
    await page.fill('#prompt', 'Objectif FICTIF modifié pendant le calcul');
    const response = page.waitForResponse((r) => r.url().endsWith('/api/plan'));
    release();
    await response;
    await page.waitForFunction(() => !document.getElementById('plan-button').disabled);
    assert.equal(await page.locator('#plan-panel').isHidden(), true);
    assert.equal(app.store.list().length, 0);
    assert.deepEqual(errors, []);
  },
);
