import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '../../../node_modules/playwright-core/index.mjs';
import { createServer } from '../../../../agregat-front/node_modules/vite/dist/node/index.js';

const { createApp } = await import(pathToFileURL(process.env.DIAG_BACK_COPY + '/apps/api/server.js'));
const dataDir = mkdtempSync(join(tmpdir(), 'diag-01-visual-FICTIF-'));
const app = createApp({ dataDir, live: false, ownerMode: false });
let vite;
let browser;
try {
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(4320, '127.0.0.1', resolve);
  });
  process.env.AGENT_PLATFORM_API_URL = 'http://127.0.0.1:4320';
  vite = await createServer({
    configFile: '/Users/diaw/Downloads/agregat-front/vite.config.ts',
    server: { host: '127.0.0.1', port: 5175, strictPort: true },
    logLevel: 'silent',
  });
  await vite.listen();
  browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await page.goto('http://127.0.0.1:5175/');
  await page.locator('.suggestions button:last-child').waitFor();
  const boxes = await page.evaluate(() => {
    const card = document.querySelector('.suggestions button:last-child').getBoundingClientRect();
    const dock = document.querySelector('.composer-dock').getBoundingClientRect();
    return { cardBottom: card.bottom, dockTop: dock.top, gap: dock.top - card.bottom };
  });
  await page.screenshot({
    path: '/Users/diaw/Downloads/agregat-back/.manager/reports/diag-01-evidence/home-1360x900.png',
  });
  console.log(JSON.stringify(boxes));
  if (boxes.gap < 16) process.exitCode = 1;
} finally {
  await browser?.close();
  await vite?.close();
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
}
