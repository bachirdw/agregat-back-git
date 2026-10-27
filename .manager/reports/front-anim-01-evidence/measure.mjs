import { chromium } from "/Users/diaw/Downloads/agregat-front-anim/node_modules/playwright-core/index.mjs";
import { writeFileSync } from "node:fs";

const base = "http://127.0.0.1:5176/";
const dir = "/Users/diaw/Downloads/agregat-back/.manager/reports/front-anim-01-evidence";
const sizes = [[1360, 900], [1280, 720], [1024, 640], [375, 812]];
const results = [];
const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
let failed = false;

async function measure(page, name) {
  const metrics = await page.evaluate(() => {
    const area = document.querySelector("#prompt");
    const dock = document.querySelector(".composer-dock");
    const scroll = document.querySelector(".scroll-content");
    const bubble = document.querySelector(".prompt-bubble");
    const cards = [...document.querySelectorAll(".suggestions button")];
    const box = (el) => el && {
      top: Math.round(el.getBoundingClientRect().top),
      bottom: Math.round(el.getBoundingClientRect().bottom),
      width: Math.round(el.getBoundingClientRect().width),
      height: Math.round(el.getBoundingClientRect().height),
    };
    return {
      viewport: [innerWidth, innerHeight],
      textarea: { ...box(area), scrollHeight: area.scrollHeight, clientHeight: area.clientHeight, overflowY: getComputedStyle(area).overflowY },
      dock: box(dock),
      scroll: { ...box(scroll), scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight },
      cardsBottom: cards.length ? Math.round(Math.max(...cards.map((c) => c.getBoundingClientRect().bottom))) : null,
      bubble: box(bubble),
      collapsed: !!bubble?.classList.contains("collapsed"),
      compact: document.querySelector(".composer")?.getAttribute("data-compact"),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      bubbleAnimation: bubble ? getComputedStyle(bubble).animationName : null,
      composerTransition: getComputedStyle(document.querySelector(".composer")).transitionDuration,
    };
  });
  results.push({ name, ...metrics });
  await page.screenshot({ path: `${dir}/${name}.png` });
  console.log(name, JSON.stringify(metrics));
  return metrics;
}

async function choose(page, name, value) {
  const select = page.getByLabel(name, { exact: true });
  const details = select.locator("xpath=ancestor::details");
  await details.locator("summary").click();
  await select.selectOption(value);
  await select.press("Escape");
}

try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: "light" });
    const prefix = `${width}x${height}`;
    await page.goto(base);
    await page.locator('.app[data-ready="true"]').waitFor();
    let m = await measure(page, `${prefix}-home-empty`);
    if (m.scroll.bottom > m.dock.top + 1 || m.dock.bottom > height || m.horizontalOverflow) failed = true;
    await page.locator("#prompt").fill(Array.from({ length: 12 }, (_, i) => `Ligne fictive ${i + 1}`).join("\n"));
    m = await measure(page, `${prefix}-home-12`);
    if (m.textarea.height > height * 0.4 + 2 || m.scroll.bottom > m.dock.top + 1 || m.horizontalOverflow) failed = true;
    await page.locator("#prompt").fill(Array.from({ length: 60 }, (_, i) => `Ligne fictive ${i + 1}`).join("\n"));
    m = await measure(page, `${prefix}-home-60`);
    if (m.textarea.scrollHeight <= m.textarea.clientHeight || m.textarea.height > height * 0.4 + 2 || m.horizontalOverflow) failed = true;

    if (width === 1360) {
      const long = "Mission FICTIVE de mesure. " + "Texte fictif de contrôle. ".repeat(35);
      await page.locator("#prompt").fill(long);
      await choose(page, "Agent", "fixture");
      await choose(page, "Pack", "najah");
      await choose(page, "Mode", "workflow");
      await choose(page, "Workflow", "opportunity-discovery-dag");
      await page.getByRole("button", { name: "Préparer le plan" }).click();
      await page.getByRole("region", { name: "Plan proposé" }).waitFor();
      await page.getByRole("button", { name: "Lancer", exact: true }).click();
      await page.locator(".conversation-main").waitFor();
      await page.locator(".toolbar .badge").filter({ hasText: "Terminée" }).waitFor({ timeout: 45000 });
    } else {
      if (width <= 760) await page.getByRole("button", { name: "Afficher la barre latérale" }).click();
      await page.locator(".mission-link").first().click();
      await page.locator(".conversation-main").waitFor();
    }
    m = await measure(page, `${prefix}-mission-long`);
    if (!m.collapsed || m.bubble.height > height * 0.4 || m.horizontalOverflow) failed = true;
    const heading = page.locator(".timeline-heading");
    if (await heading.count() && await heading.getAttribute("aria-expanded") === "false") await heading.click();
    await page.locator(".scroll-content").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await page.locator(".scroll-content").evaluate((el) => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    m = await measure(page, `${prefix}-mission-compact`);
    if (m.compact !== "true" || m.horizontalOverflow) failed = true;
    await page.locator(".scroll-content").evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    m = await measure(page, `${prefix}-mission-bottom`);
    if (m.compact !== "false" || m.horizontalOverflow) failed = true;
    await page.emulateMedia({ reducedMotion: "reduce" });
    m = await measure(page, `${prefix}-reduced-motion`);
    if (m.bubbleAnimation !== "none" || !m.composerTransition.split(",").every((s) => parseFloat(s) === 0)) failed = true;
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
