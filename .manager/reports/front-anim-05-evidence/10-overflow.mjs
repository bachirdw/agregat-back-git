import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from '/Users/diaw/Downloads/agregat-front/node_modules/playwright-core/index.mjs';
import { createApp } from '/Users/diaw/Downloads/agregat-back/apps/api/server.js';
import { CareerWorkspace } from '/Users/diaw/Downloads/agregat-back/packages/career-ops/workspace.js';

const root = mkdtempSync(join(tmpdir(), 'front-overflow-FICTIF-'));
const career = new CareerWorkspace({ root, roots: [root] });
const app = createApp({ dataDir: join(root, 'platform'), career, webDir: '/Users/diaw/Downloads/agregat-front/dist' });
const id = randomUUID();
mkdirSync(join(root, 'relay/runs'), { recursive: true });
writeFileSync(join(root, `relay/runs/${id}-input.json`), JSON.stringify({ prompt: 'Mission FICTIVE avec longue ligne d’outil' }));
app.store.create({ id, createdAt: new Date().toISOString(), state: 'running', prompt: 'Mission privée dans l’espace de candidature', pack: 'career-ops', agent: 'fixture', mode: 'agent', workspace: 'career-ops', plan: { steps: [], workflow: null }, resumable: true, sessionId: randomUUID(), simulated: true });
app.store.event(id, 'agent', { sessionUpdate: 'tool_call', toolCallId: 'FICTIF-long', title: 'X'.repeat(5000), status: 'in_progress', rawInput: { arguments: { text: 'Y'.repeat(5000) } } });
app.store.event(id, 'agent', { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Z'.repeat(5000) } });
let browser;
try {
  await new Promise((resolve) => app.server.listen(4325, '127.0.0.1', resolve));
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  for (const [width, height] of [[1550, 810], [375, 812]]) {
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:4325/');
    await page.locator('.app[data-ready=true]').waitFor();
    if (width < 760) await page.getByRole('button', { name: 'Afficher la barre latérale' }).click();
    await page.locator('.mission-link').first().click();
    await page.locator('.fold.tool').first().waitFor();
    await page.evaluate(() => {
      const md = document.createElement('div');
      md.className = 'markdown';
      const block = document.createElement('div');
      block.className = 'code-block';
      const code = document.createElement('code');
      code.textContent = 'C'.repeat(5000);
      block.append(code);
      const table = document.createElement('table');
      table.innerHTML = '<tbody><tr><td>FICTIF</td><td></td></tr></tbody>';
      table.querySelector('td:last-child').textContent = 'T'.repeat(5000);
      md.append(block, table);
      document.querySelector('.career-thread').append(md);
    });
    for (const expanded of [false, true]) {
      if (expanded) await page.locator('.fold.tool > summary').first().click();
      const result = await page.evaluate(() => {
        const selectors = ['html', 'body', '.app', '.main', '.scroll-content', '.thread', '.career-thread', '.agent-turn', '.activity', '.fold.tool', '.fold.tool > summary', '.tool-details', '.tool-details pre', '.markdown'];
        const rows = selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(element => ({ selector, client: element.clientWidth, scroll: element.scrollWidth, left: element.scrollLeft })));
        return { documentLeft: document.scrollingElement.scrollLeft, rows, overflow: rows.filter(row => row.scroll > row.client + 1 || row.left !== 0) };
      });
      console.log(JSON.stringify({ width, height, expanded, ...result }));
      assert.equal(result.documentLeft, 0);
      assert.deepEqual(result.overflow, []);
    }
    await page.close();
  }
} finally {
  await browser?.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
