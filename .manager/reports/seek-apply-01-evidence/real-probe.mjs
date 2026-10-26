// Sonde en lecture seule ; aucune valeur personnelle du formulaire n'est persistée.
import { writeFileSync } from 'node:fs';
import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988' });
const policy = new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'seek-apply-01-read-only', capabilities: ['browser.navigate', 'browser.snapshot'] });
const gateway = new BrowserGateway({ provider, policy, approve: async () => false });
const result = { at: new Date().toISOString(), url: 'https://www.seek.com.au/job/95484078/apply', actions: ['browser.navigate', 'browser.snapshot'], privacy: 'Libellés génériques seulement ; valeurs personnelles exclues.' };
try {
  await gateway.call('browser.navigate', { url: result.url });
  const start = Date.now();
  const snapshot = await gateway.call('browser.snapshot', {});
  result.elapsedMs = Date.now() - start;
  result.loading = snapshot.loading;
  result.finalUrl = new URL(snapshot.url).origin + new URL(snapshot.url).pathname;
  result.provider = snapshot.provider;
  result.loadingAlert = /alert[^\n]*Loading|progressbar[^\n]*Loading/i.test(snapshot.snapshot);
  const generic = /^(Choose documents|Resumé|Resume|Cover letter|Continue|Next|Upload resumé|Upload resume|Upload a resumé|Select a resumé|Select a resume|Don't include a cover letter|Write a cover letter|Upload a cover letter|Review and submit|Answer employer questions|Update SEEK Profile|Sign in|Sign in to SEEK)$/i;
  result.snapshot = snapshot.snapshot.split('\n').filter((line) => {
    const quoted = line.match(/^\s*- (?:heading|button|radio|checkbox|link) "([^"]+)"(?: \[.*\])?:?$/);
    return quoted && generic.test(quoted[1]);
  }).join('\n');
  result.formControls = (snapshot.snapshot.match(/^\s*- (?:textbox|radio|combobox|checkbox|button)\b/gm) ?? []).length;
} catch (error) {
  result.error = error.message.replace(/https?:\/\/[^\s]+/g, '[URL masquée]');
  process.exitCode = 1;
} finally {
  await provider.close();
  writeFileSync(new URL('./real-snapshot.txt', import.meta.url), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
}
