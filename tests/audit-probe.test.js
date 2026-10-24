import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('probe audit : pair muet arrêté, puis session fictive sans authentification ni prompt', async () => {
  const cwd = mkdtempSync(join(tmpdir(), 'relay-audit-test-'));
  mkdirSync(join(cwd, 'docs/research'), { recursive: true });
  const silent = join(cwd, 'silent-fixture');
  const responsive = join(cwd, 'responsive-fixture');
  const header = `#!${process.execPath}
if (process.argv.includes('--version')) { console.log('FICTIF-audit-only'); process.exit(0); }
`;
  writeFileSync(silent, header + 'setInterval(() => {}, 1000);\n', { mode: 0o755 });
  writeFileSync(
    responsive,
    header +
      `require('node:readline').createInterface({ input: process.stdin }).on('line', line => {
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  const result = message.method === 'initialize'
    ? { protocolVersion: 1, agentInfo: { name: 'FICTIF', version: 'test' }, agentCapabilities: {} }
    : { sessionId: 'FICTIF' };
  if (!['initialize', 'session/new'].includes(message.method)) process.exit(2);
  console.log(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
});
`,
    { mode: 0o755 },
  );
  // Every peer is fictitious. Run outside the repo to preserve the real audit artifact.
  await promisify(execFile)(
    process.execPath,
    [resolve('scripts/acp-audit-probe.js'), silent, responsive],
    { cwd, timeout: 35000 },
  );
  const report = JSON.parse(readFileSync(join(cwd, 'docs/research/sprint-01-acp-probe.json')));
  const [unresponsive, successful] = report.reports;
  assert.equal(unresponsive.handshake, false);
  assert.match(unresponsive.error.message, /Délai maximal ACP/);
  assert.equal(successful.handshake, true);
  assert.equal(successful.session, true);
  assert.equal(successful.sessionResponse.sessionId, 'FICTIF');
  for (const peer of report.reports) {
    assert.equal(peer.version, 'FICTIF-audit-only');
    assert.equal(peer.authenticate, 'non exécuté');
    assert.equal(peer.prompt, 'non exécuté');
    assert.ok(peer.exit.signal || peer.exit.code === 0, 'Processus enfant arrêté');
  }
});
