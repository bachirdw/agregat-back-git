import { BrowserGateway, CdpBrowser } from '../../../packages/browser-gateway/index.js';
import { isGraphqlRead, isSensitiveRequest, sameSite } from '../../../packages/browser-gateway/cdp.js';
import { RunPolicy } from '../../../packages/policy-engine/run-policy.js';
import { capabilityIds } from '../../../packages/capability-registry/index.js';

const status = await fetch('http://127.0.0.1:19988/extension/status', { signal: AbortSignal.timeout(3000) }).then(r => r.json());
if (status.connected !== true) throw new Error('Playwriter non connecté');
const target = 'https://www.seek.com.au/job/95484078/apply';
const provider = new CdpBrowser({ endpoint: 'http://127.0.0.1:19988', navigationTimeoutMs: 20000 });
const policy = new RunPolicy({ ownerMode: true, allowSharedContext: true, runId: 'FICTIF-readonly-audit', capabilities: capabilityIds });
let approvals = 0;
const rows = [];
const requests = new Map();
const gateway = new BrowserGateway({ provider, policy, approve: async approval => {
  approvals++;
  if (approval.capability === 'browser.send') {
    for (const [request, row] of requests) if (request.url() === approval.args?.url) row.decision = 'accord';
  }
  return false;
} });
const cleanName = name => typeof name === 'string' && /^[A-Za-z_][A-Za-z_0-9]{0,79}$/.test(name) ? name : '-';
const result = { connected: true, requestedPath: '/job/95484078/apply', rows };
try {
  await provider.prepare(policy, gateway.approve);
  const page = await provider.ensure(policy);
  page.on('request', request => {
    if (request.method() !== 'POST' || !sameSite(request.url(), target)) return;
    let path;
    try { path = new URL(request.url()).pathname; } catch { path = '[invalid]'; }
    const body = request.postData() ?? '';
    let parsed;
    try { parsed = JSON.parse(body); } catch { parsed = null; }
    const ops = Array.isArray(parsed) ? parsed : [parsed];
    const kind = op => typeof op?.query !== 'string' ? 'non-GraphQL' : isGraphqlRead(JSON.stringify(op)) ? 'lecture' : 'mutation/autre';
    const operationName = ops.map(op => cleanName(op?.operationName)).join(',');
    const document = ops.map(kind).join(',');
    const sensitive = isSensitiveRequest(request.url(), body);
    const row = { path, operationName, document, decision: 'auto', classifiedSensitive: sensitive };
    rows.push(row);
    requests.set(request, row);
  });
  page.on('requestfailed', request => {
    const row = requests.get(request);
    if (row) {
      if (row.decision !== 'accord') row.decision = 'bloqué';
      const failure = request.failure();
      row.failure = String(failure).match(/ERR_[A-Z_]+|BLOCKED_BY_CLIENT|ABORTED|FAILED/)?.[0] ?? 'autre';
    }
  });
  await gateway.call('browser.navigate', { url: target });
  await gateway.call('browser.snapshot');
  await new Promise(r => setTimeout(r, 10000));
  result.finalPath = new URL(provider.page.url()).pathname;
  result.snapshotOk = true;
} catch (error) {
  result.error = { name: error.name, category: /timeout|délai/i.test(error.message) ? 'timeout' : 'navigation ou snapshot' };
  process.exitCode = 1;
} finally {
  result.approvals = approvals;
  await provider.close();
  console.log(JSON.stringify(result));
}
