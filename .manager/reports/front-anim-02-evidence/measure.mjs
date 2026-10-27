import { chromium } from "/Users/diaw/Downloads/agregat-front/node_modules/playwright-core/index.mjs";
import { writeFileSync } from "node:fs";

const base = "http://127.0.0.1:5176/";
const dir = "/Users/diaw/Downloads/agregat-back/.manager/reports/front-anim-02-evidence";
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
    const rect = (el) => el ? el.getBoundingClientRect() : null;
    return {
      viewport: [innerWidth, innerHeight],
      dockTop: rect(dock)?.top ?? null,
      dockHeight: rect(dock)?.height ?? null,
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
    };
  });
  results.push({ name, ...metrics });
  await page.screenshot({ path: `${dir}/${name}.png` });
  console.log(name, JSON.stringify(metrics));
  return metrics;
}

function check(metrics, { plan = false } = {}) {
  if (metrics.horizontalOverflow || metrics.measuredDockHeight < metrics.dockHeight - 2 || metrics.paddingBottom < metrics.dockHeight || metrics.scrollPaddingBottom < metrics.dockHeight) failed = true;
  if (metrics.lastBottom == null || metrics.lastBottom > metrics.dockTop - 1) failed = true;
  if (plan && (metrics.compact !== "true" || metrics.launchBottom == null || metrics.launchBottom > metrics.dockTop - 1)) failed = true;
}

try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: "dark" });
    const prefix = `${width}x${height}`;
    await page.goto(base);
    await page.locator('.app[data-ready="true"]').waitFor();
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
    await page.locator(".scroll-content").evaluate((el) => { el.scrollTop = el.scrollHeight; });
    metrics = await measure(page, `${prefix}-plan-bottom`);
    check(metrics, { plan: true });

    await page.getByRole("button", { name: "Lancer", exact: true }).click();
    await page.locator(".conversation-main").waitFor();
    await page.locator(".toolbar .badge").filter({ hasText: /Terminée|Échec/ }).waitFor({ timeout: 45000 });
    // The deterministic fixture cannot resume, so this draft is a geometric stress fixture.
    // It tests ResizeObserver and the bottom reserve with the actual mission DOM and a 12-line dock.
    await page.locator("#prompt").evaluate((area) => {
      area.value = Array.from({ length: 12 }, (_, i) => `Ligne de brouillon FICTIVE ${i + 1}`).join("\n");
      area.style.height = "auto";
      area.style.height = `${Math.min(area.scrollHeight, Math.floor(innerHeight * 0.4))}px`;
    });
    await page.waitForTimeout(100);
    await page.locator(".scroll-content").evaluate((el) => { el.scrollTop = el.scrollHeight; });
    metrics = await measure(page, `${prefix}-mission-12-bottom`);
    check(metrics);
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
