import { chromium } from "/Users/diaw/Downloads/agregat-front/node_modules/playwright-core/index.mjs";
import { writeFileSync } from "node:fs";

const base = "http://127.0.0.1:5176/";
const dir = "/Users/diaw/Downloads/agregat-back/.manager/reports/front-anim-03-evidence";
const sizes = [[1550, 810], [1360, 900], [1280, 720], [1024, 640], [375, 812]];
const results = [];
let failed = false;
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});

async function choose(page, name, value) {
  const select = page.getByLabel(name, { exact: true });
  const details = select.locator("xpath=ancestor::details");
  await details.locator("summary").click();
  await select.selectOption(value);
  await select.press("Escape");
}

async function measure(page, name) {
  await page.waitForFunction(() => {
    const main = document.querySelector(".main");
    const dock = document.querySelector(".composer-dock");
    return main && dock && Math.abs(parseFloat(main.style.getPropertyValue("--dock-h")) - dock.getBoundingClientRect().height) <= 2;
  });
  const metrics = await page.evaluate(() => {
    const main = document.querySelector(".main");
    const dock = document.querySelector(".composer-dock");
    const feed = document.querySelector(".scroll-content");
    const last = document.querySelector(".thread")?.lastElementChild;
    const launch = document.querySelector(".plan footer .primary");
    const dockBox = dock.getBoundingClientRect();
    const feedBox = feed.getBoundingClientRect();
    const visibleCardsUnderDock = [...document.querySelectorAll(".suggestions button")].some((card) => {
      const box = card.getBoundingClientRect();
      const visibleTop = Math.max(box.top, feedBox.top);
      const visibleBottom = Math.min(box.bottom, feedBox.bottom);
      return visibleBottom > visibleTop && visibleBottom > dockBox.top;
    });
    const rect = (el) => el ? el.getBoundingClientRect() : null;
    return {
      viewport: [innerWidth, innerHeight],
      dockTop: rect(dock)?.top ?? null,
      dockHeight: rect(dock)?.height ?? null,
      dockBottom: dockBox.bottom,
      bottomMargin: innerHeight - dockBox.bottom,
      measuredDockHeight: parseFloat(main.style.getPropertyValue("--dock-h")),
      launchBottom: rect(launch)?.bottom ?? null,
      lastBottom: rect(last)?.bottom ?? null,
      scrollTop: feed.scrollTop,
      scrollHeight: feed.scrollHeight,
      clientHeight: feed.clientHeight,
      paddingBottom: parseFloat(getComputedStyle(feed).paddingBottom),
      scrollPaddingBottom: parseFloat(getComputedStyle(feed).scrollPaddingBottom),
      compact: document.querySelector(".composer")?.getAttribute("data-compact"),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      visibleCardsUnderDock,
      homeScrolls: feed.scrollHeight > feed.clientHeight,
    };
  });
  results.push({ name, ...metrics });
  await page.screenshot({ path: `${dir}/${name}.png` });
  console.log(name, JSON.stringify(metrics));
  return metrics;
}

function check(metrics, { plan = false } = {}) {
  if (metrics.horizontalOverflow || metrics.measuredDockHeight < metrics.dockHeight - 2) failed = true;
  if (plan && (metrics.paddingBottom < metrics.dockHeight || metrics.scrollPaddingBottom < metrics.dockHeight)) failed = true;
  if (!plan && (metrics.paddingBottom !== 0 || metrics.scrollPaddingBottom > 24)) failed = true;
  if (metrics.lastBottom == null || metrics.lastBottom > metrics.dockTop - 1) failed = true;
  if (plan && (metrics.compact !== "true" || metrics.launchBottom == null || metrics.launchBottom > metrics.dockTop - 1)) failed = true;
}

function checkBottom(metrics) {
  if (metrics.bottomMargin < 0 || metrics.bottomMargin >= 32 || metrics.horizontalOverflow || metrics.visibleCardsUnderDock) failed = true;
}

try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: "dark" });
    const prefix = `${width}x${height}`;
    await page.goto(base);
    await page.locator('.app[data-ready="true"]').waitFor();
    for (const lines of [0, 12, 60]) {
      const draft = Array.from({ length: lines }, (_, i) => `Ligne FICTIVE ${i + 1} pour éprouver la hauteur du composeur.`).join("\n");
      await page.locator("#prompt").fill(draft);
      const home = await measure(page, `${prefix}-home-${lines}`);
      checkBottom(home);
    }
    const prompt = Array.from({ length: 4 }, (_, i) => `Ligne ${i + 1} FICTIVE pour mesurer le plan et sa lisibilité, sans donnée réelle ni appel de modèle.`).join("\n");
    await page.locator("#prompt").fill(prompt);
    await choose(page, "Agent", "fixture");
    await choose(page, "Pack", "najah");
    await choose(page, "Mode", "workflow");
    await choose(page, "Workflow", "opportunity-discovery-dag");
    await page.getByRole("button", { name: "Préparer le plan" }).click();
    await page.getByRole("region", { name: "Plan proposé" }).waitFor();
    await page.waitForTimeout(100);
    let metrics = await measure(page, `${prefix}-plan-initial`);
    check(metrics, { plan: true });
    checkBottom(metrics);
    await page.locator(".scroll-content").evaluate((el) => { el.scrollTop = el.scrollHeight; });
    metrics = await measure(page, `${prefix}-plan-bottom`);
    check(metrics, { plan: true });
    checkBottom(metrics);

    await page.getByRole("button", { name: "Lancer", exact: true }).click();
    await page.locator(".conversation-main").waitFor();
    // The badge is hidden at mobile width, so wait for its state without requiring visibility.
    await page.waitForFunction(() => /Terminée|Échec/.test(document.querySelector(".toolbar .badge")?.textContent ?? ""), null, { timeout: 45000 });
    // The deterministic fixture cannot resume, so this draft is a geometric stress fixture.
    // It tests ResizeObserver and the bottom reserve with the actual mission DOM and a 12-line dock.
    await page.locator("#prompt").evaluate((area) => {
      area.value = Array.from({ length: 12 }, (_, i) => `Ligne de brouillon FICTIVE ${i + 1}`).join("\n");
      area.style.height = "auto";
      area.style.height = `${Math.min(area.scrollHeight, Math.floor(innerHeight * 0.4))}px`;
    });
    // Scrolling while the fixture finishes can compact the composer. Open it as
    // a user would, then wait for ResizeObserver to publish its final height.
    await page.locator(".composer").evaluate((form) => form.click());
    await page.waitForFunction(() => document.querySelector(".composer")?.getAttribute("data-compact") === "false");
    await page.waitForFunction(() => {
      const main = document.querySelector(".main");
      const dock = document.querySelector(".composer-dock");
      return main && dock && Math.abs(parseFloat(main.style.getPropertyValue("--dock-h")) - dock.getBoundingClientRect().height) <= 2;
    });
    await page.locator(".scroll-content").evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await page.waitForTimeout(100);
    metrics = await measure(page, `${prefix}-mission-12-bottom`);
    check(metrics);
    checkBottom(metrics);
    if (metrics.compact !== "false") failed = true;
    await page.close();
  }
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  writeFileSync(`${dir}/measure.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
process.exitCode = failed ? 1 : 0;
