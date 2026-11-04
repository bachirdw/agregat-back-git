// Sonde E19 bis : section « À propos », conteneurs à défilement interne, puis clic sur le premier bouton
// « plus » et nouvelle mesure. Aucun texte de page imprimé, seulement des longueurs et des booléens.
import { BrowserGateway, CdpBrowser } from '../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../packages/capability-registry/index.js';
const url = process.argv[2];
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 15000 });
const gateway = new BrowserGateway({ provider, policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'SONDE-e19b', capabilities: capabilityIds }), approve: async () => false });
const measure = (label) => provider.page.evaluate(() => {
  const text = document.body?.innerText ?? '';
  const i = text.indexOf('À propos');
  const section = i >= 0 ? text.slice(i, i + 4000) : '';
  const scrollers = [...document.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight + 50 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)).map((el) => ({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 40), sh: el.scrollHeight, ch: el.clientHeight }));
  const plus = [...document.querySelectorAll('button')].filter((b) => /^(…|\.\.\.)?\s*(plus|more|afficher plus|show more|see more)$/i.test((b.innerText || '').trim()));
  return { textChars: text.length, aboutAt: i, sectionChars: section.length, sectionEndsWithPlus: /plus\s*$/i.test(section.slice(0, 1200).trim()), sectionLines: section.split('\n').filter(Boolean).length, scrollers: scrollers.slice(0, 4), plusButtons: plus.length };
}).then((m) => console.log(label, JSON.stringify(m)));
try {
  await gateway.call('browser.navigate', { url });
  await new Promise((r) => setTimeout(r, 6000));
  await measure('avant ');
  const clicked = await provider.page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((b) => /^(…|\.\.\.)?\s*(plus|more|afficher plus|show more|see more)$/i.test((b.innerText || '').trim()));
    if (!b) return false; b.scrollIntoView(); b.click(); return true;
  });
  console.log('clic plus :', clicked);
  await new Promise((r) => setTimeout(r, 3000));
  await measure('après ');
  const snap = await gateway.call('browser.snapshot', {});
  const s = JSON.stringify(snap);
  console.log('snapshot : chars', s.length, '| contient À propos :', s.includes('À propos'), '| contient le mot Responsibilities/Requirements/exigences :', /responsibilit|requirement|exigence|missions/i.test(s));
} finally { await provider.close(); }
