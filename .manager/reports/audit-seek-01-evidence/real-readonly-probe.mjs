// Audit read-only: values from the Seek form never leave the browser.
import { writeFileSync } from 'node:fs';
import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';

const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988' });
const url = 'https://www.seek.com.au/job/95484078/apply';
const gateway = new BrowserGateway({
  provider,
  policy: new RunPolicy({
    ownerMode: true,
    allowSharedContext: true,
    runId: 'audit-seek-01-read-only',
    capabilities: ['browser.navigate', 'browser.snapshot'],
  }),
  approve: async () => false,
});
const result = { url, actions: ['navigate', 'snapshot', 'click trial', 'bringToFront', 'click trial'] };
try {
  const start = Date.now();
  await gateway.call('browser.navigate', { url });
  const snapshot = await gateway.call('browser.snapshot', {});
  result.snapshotMs = Date.now() - start;
  result.loading = snapshot.loading;
  result.finalPath = new URL(snapshot.url).pathname;
  result.formVisible = /Choose documents|Resumé|Resume|Cover letter|Continue/i.test(snapshot.snapshot);
  result.genericLabels = snapshot.snapshot.split('\n').filter((line) =>
    /^\s*- (?:heading|button|radio|checkbox) "(?:Choose documents|Resumé|Resume|Cover letter|Continue)"(?: \[.*\])?$/.test(line),
  );
  const page = provider.page;
  const state = async () => page.evaluate(() => ({ visibility: document.visibilityState, focus: document.hasFocus() }));
  const trial = async () => {
    const started = Date.now();
    try {
      await page.locator('[data-testid="continue-button"]').click({ trial: true, timeout: 20000 });
      return { success: true, ms: Date.now() - started };
    } catch (error) {
      return { success: false, ms: Date.now() - started, errorName: error.name };
    }
  };
  result.before = { state: await state(), trial: await trial() };
  await page.bringToFront();
  result.after = { state: await state(), trial: await trial() };
} catch (error) {
  result.errorName = error.name;
  process.exitCode = 1;
} finally {
  await provider.close();
  writeFileSync(new URL('./real-readonly-result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}
