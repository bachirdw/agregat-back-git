// Captures the UI with REAL recorded data (replay mode, no network) into docs/screenshots/.
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { ROOT } from '../packages/orchestrator/packs.js';
const REC = resolve(ROOT, 'tests/fixtures/najah-recorded');
process.env.AGENT_PLATFORM_DATA_REPLAY = JSON.stringify({
  'https://www.arbeitnow.com/api/job-board-api?page=1': join(REC, 'arbeitnow.json'),
  'https://remotive.com/api/remote-jobs?search=python&limit=50': join(REC, 'remotive.json'),
  'https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers':
    join(REC, 'govuk-register-page.json'),
  'https://assets.publishing.service.gov.uk/media/6adb1b5ab62d80a107bc5c29/SP_-_Worker_and_Temporary_Worker_Web_Register_-_2026-10-23.csv':
    join(REC, 'uk-sponsors-sample.csv'),
});
const { createApp } = await import('../apps/api/server.js');
const app = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'relay-shots-')) });
let browser;
try {
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const out = resolve(ROOT, 'docs/screenshots');
  mkdirSync(out, { recursive: true });
  browser = await chromium.launch({
    executablePath:
      process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
  await page.goto(`http://127.0.0.1:${app.server.address().port}/`);
  await page.waitForSelector('body[data-ready="1"]', { state: 'attached' });
  for (let i = 0; i < 10; i++) {
    const b = page.locator('#skill-list button', { hasText: 'Installer' }).first();
    if (!(await b.count())) break;
    await b.click();
    await page.waitForTimeout(150);
  }
  await page.fill('#prompt', 'Data engineer Python avec sponsor visa (offres réelles)');
  await page.selectOption('#pack', 'najah');
  await page.selectOption('#mode-select', 'workflow');
  await page.selectOption('#workflow-select', 'auto');
  await page.click('#plan-button');
  await page.waitForSelector('#plan-panel:not([hidden])');
  await page.locator('#plan-panel').screenshot({ path: join(out, 'plan-workflow-auto.png') });
  await page.click('#launch');
  await page.waitForFunction(
    () => document.getElementById('run-state').textContent === 'Terminée',
    null,
    { timeout: 60000 },
  );
  await page.locator('#run-panel').screenshot({ path: join(out, 'najah-offres-reelles.png') });
  await page.fill(
    '#prompt',
    'Rédiger une lettre de motivation pour un poste de data engineer (offre fictive)',
  );
  await page.click('#plan-button');
  await page.waitForTimeout(800);
  await page.click('#launch');
  await page.locator('#steps button', { hasText: 'Approuver' }).waitFor({ timeout: 60000 });
  await page.locator('#run-panel').screenshot({ path: join(out, 'brouillon-approbation.png') });
  console.log('captures écrites dans docs/screenshots/');
} finally {
  try {
    await browser?.close();
  } finally {
    await app.close();
  }
}
