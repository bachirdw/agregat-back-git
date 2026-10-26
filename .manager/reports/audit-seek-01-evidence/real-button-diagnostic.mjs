// Read-only diagnostic; no form values or private text are collected.
import { writeFileSync } from 'node:fs';
import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988' });
const gateway = new BrowserGateway({
  provider,
  policy: new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'audit-seek-01-button-diagnostic', capabilities: ['browser.navigate','browser.snapshot'] }),
  approve: async () => false,
});
const result = {};
try {
  await gateway.call('browser.navigate', { url: 'https://www.seek.com.au/job/95484078/apply' });
  await gateway.call('browser.snapshot', {});
  const locator = provider.page.locator('[data-testid="continue-button"]');
  result.count = await locator.count();
  if (result.count) {
    result.visible = await locator.first().isVisible();
    result.enabled = await locator.first().isEnabled();
    result.tag = await locator.first().evaluate((el) => el.tagName.toLowerCase());
    result.disabledAttribute = await locator.first().getAttribute('disabled') !== null;
  }
} catch (error) { result.errorName = error.name; process.exitCode = 1; }
finally {
  await provider.close();
  writeFileSync(new URL('./real-button-state.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
