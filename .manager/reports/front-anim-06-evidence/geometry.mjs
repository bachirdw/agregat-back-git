import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createApp } from '../../../apps/api/server.js';

process.env.AGENT_PLATFORM_NETWORK = '0';
process.env.AGENT_PLATFORM_BROWSER = 'fixture';
const front = '/Users/diaw/Downloads/agregat-front';
const require = createRequire(`${front}/package.json`);
const { chromium } = require('playwright-core');
const dataDir = mkdtempSync(join(tmpdir(), 'front-anim-06-'));
const app = createApp({ dataDir, live: false, webDir: `${front}/dist` });
let browser;
try {
  const long = 'X'.repeat(5000);
  const id = crypto.randomUUID();
  app.store.create({
    id, prompt: 'Mission FICTIVE : largeur du fil', state: 'completed', mode: 'agent',
    agent: 'fixture', pack: 'career-ops', model: '', simulated: true,
    budgetCents: 0, createdAt: new Date().toISOString(),
    plan: { steps: [], cost: { platformCents: 0, currency: 'EUR', budgetCents: 0, withinBudget: true, description: 'FICTIF', lines: [] } },
    result: { simulated: true, summary: `Résultat FICTIF\n\n${long}\n\n| Colonne | Valeur |\n| --- | --- |\n| ${long} | ${long} |\n\n\`\`\`txt\n${long}\n\`\`\``, evidence: [] },
  });
  app.store.event(id, 'agent', { sessionUpdate: 'tool_call', toolCallId: 'long-tool', title: long, status: 'completed', rawInput: { value: long }, rawOutput: long });
  await new Promise((resolve, reject) => app.server.listen(4320, '127.0.0.1', (error) => error ? reject(error) : resolve()));
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  for (const viewport of [{ width: 1550, height: 810 }, { width: 375, height: 812 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:4320');
    await page.locator('.app[data-ready=true]').waitFor();
    const showSide = page.getByRole('button', { name: 'Afficher la barre latérale' });
    if (await showSide.count()) await showSide.click();
    const refresh = page.getByRole('button', { name: 'Actualiser les missions' });
    if (await refresh.count()) await refresh.click();
    await page.locator('.mission-link').first().click();
    await page.locator('.career-thread').waitFor();
    await page.locator('.fold.tool').first().waitFor();
    const collapsed = await page.evaluate(() => {
      const code = document.querySelector('.fold.tool > summary code');
      const style = getComputedStyle(code);
      const rect = code.getBoundingClientRect();
      return { scrollWidth: code.scrollWidth, clientWidth: code.clientWidth, rectWidth: rect.width, overflow: style.overflow, ellipsis: style.textOverflow, whitespace: style.whiteSpace };
    });
    assert.equal(collapsed.ellipsis, 'ellipsis');
    assert.equal(collapsed.overflow, 'hidden');
    assert.equal(collapsed.whitespace, 'nowrap');
    assert.ok(collapsed.scrollWidth > collapsed.clientWidth, JSON.stringify(collapsed));
    await page.locator('.fold.tool').first().locator('summary').click();
    await page.evaluate((long) => {
      const parent = document.querySelector('.agent-turn');
      const markdown = document.createElement('div');
      markdown.className = 'markdown';
      const paragraph = document.createElement('p');
      const code = document.createElement('code');
      code.textContent = long;
      paragraph.append(code);
      const table = document.createElement('table');
      table.innerHTML = '<tbody><tr><td></td><td></td></tr></tbody>';
      table.querySelectorAll('td').forEach((cell) => { cell.textContent = long; });
      const pre = document.createElement('div');
      pre.className = 'code-block';
      pre.textContent = long;
      markdown.append(paragraph, table, pre);
      parent.append(markdown);
    }, long);
    const measured = await page.evaluate(() => {
      const names = ['.main', '.scroll-content', 'html', 'body'];
      const boxes = Object.fromEntries(names.map((name) => {
        const el = document.querySelector(name);
        return [name, { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, scrollLeft: el.scrollLeft }];
      }));
      const details = document.querySelector('.tool-details pre');
      return { boxes, detailsWrap: getComputedStyle(details).overflowWrap, markdownWrap: getComputedStyle(document.querySelector('.markdown')).overflowWrap, documentLeft: document.scrollingElement.scrollLeft };
    });
    for (const [name, box] of Object.entries(measured.boxes)) {
      assert.ok(box.scrollWidth <= box.clientWidth, `${name}: ${JSON.stringify(box)}`);
      assert.equal(box.scrollLeft, 0, name);
    }
    assert.equal(measured.documentLeft, 0);
    assert.equal(measured.detailsWrap, 'anywhere');
    assert.equal(measured.markdownWrap, 'anywhere');
    console.log(JSON.stringify({ viewport, collapsed, measured }));
    await page.close();
  }
} finally {
  await browser?.close();
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
