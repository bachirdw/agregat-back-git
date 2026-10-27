import { chromium } from '/Users/diaw/Downloads/agregat-back/node_modules/playwright-core/index.mjs';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
let bad = 0;
for (const [w, h] of [[1360, 900], [1280, 720], [1440, 800], [1024, 640], [375, 812]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto('http://127.0.0.1:5173/');
  await page.locator('.suggestions button:last-child').waitFor();
  await page.locator('.loading').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  for (const long of [false, true]) {
    if (long) await page.fill('#prompt', 'ligne\n'.repeat(12));
    const b = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.suggestions button')].map((c) => c.getBoundingClientRect());
      const dock = document.querySelector('.composer-dock').getBoundingClientRect();
      const sc = document.querySelector('.scroll-content');
      return { cardBottom: Math.round(Math.max(...cards.map((c) => c.bottom))), dockTop: Math.round(dock.top), dockBottom: Math.round(dock.bottom), vh: innerHeight, hscroll: document.documentElement.scrollWidth > innerWidth, scrolls: sc.scrollHeight > sc.clientHeight };
    });
    // Cards may scroll inside the content area, but the visible part must never sit under the dock.
    const visibleOverlap = await page.evaluate(() => {
      const dock = document.querySelector('.composer-dock').getBoundingClientRect();
      const sc = document.querySelector('.scroll-content').getBoundingClientRect();
      return sc.bottom > dock.top + 1;
    });
    const ok = !visibleOverlap && b.dockBottom <= b.vh && !b.hscroll;
    if (!ok) bad++;
    console.log(`${w}x${h}${long ? ' texte long' : ''}`, ok ? 'OK' : 'KO', JSON.stringify(b));
    await page.screenshot({ path: `/Users/diaw/Downloads/agregat-back/.manager/reports/diag-01-evidence/home-${w}x${h}${long ? '-long' : ''}.png` });
  }
  await page.close();
}
await browser.close();
process.exitCode = bad ? 1 : 0;
