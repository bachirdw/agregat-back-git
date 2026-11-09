import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools, scriptLimits, sourceSnapshot } from '../packages/career-ops/tools.js';
import { gatewayProgress, createTurnTruth } from '../packages/career-ops/truth.js';

// Audit misc3 (constat career 3) : délai et tampon par script, sortie partielle au dépassement.
function workspace(t, find) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'script-limits-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  writeFileSync(join(root, 'find.mjs'), find);
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  return root;
}

test('délais : 60 s par défaut, scripts longs plus larges, variables d’environnement', () => {
  assert.equal(scriptLimits('find', { env: {} }).timeout, 60000);
  assert.equal(scriptLimits('check-liveness', { env: {} }).timeout, 60000);
  assert.ok(scriptLimits('scan', { env: {} }).timeout >= 300000);
  assert.ok(scriptLimits('generate-pdf', { env: {} }).timeout >= 120000);
  assert.ok(scriptLimits('batch-runner', { env: {} }).timeout >= 300000);
  assert.equal(
    scriptLimits('scripts/scan.mjs', { env: {} }).timeout,
    scriptLimits('scan', { env: {} }).timeout,
  );
  assert.equal(
    scriptLimits('find', { env: { RELAY_CAREER_SCRIPT_TIMEOUT_MS: '90000' } }).timeout,
    90000,
  );
  assert.equal(
    scriptLimits('scan', { env: { RELAY_CAREER_SCRIPT_TIMEOUTS: 'scan=1234, generate-pdf=99' } })
      .timeout,
    1234,
  );
  assert.equal(
    scriptLimits('find', { env: { RELAY_CAREER_SCRIPT_TIMEOUT_MS: 'abc' } }).timeout,
    60000,
  );
  assert.equal(scriptLimits('find', { timeoutMs: 50, env: {} }).timeout, 50);
  assert.equal(scriptLimits('find', { env: {} }).maxBuffer, 200000);
  assert.equal(
    scriptLimits('find', { env: { RELAY_CAREER_SCRIPT_MAX_BUFFER: '5000000' } }).maxBuffer,
    5000000,
  );
});

test('délai dépassé : sortie partielle, timedOut, message clair (pas d’erreur générique)', async (t) => {
  const root = workspace(t, `console.log('début du scan'); setTimeout(() => {}, 5000);`);
  const tools = new CareerTools({ path: () => root }, { scriptTimeoutMs: 400 });
  const answer = await tools.script({ command: 'find', query: 'FICTIF' });
  assert.equal(answer.timedOut, true);
  assert.equal(answer.exitCode, null);
  assert.match(answer.text, /début du scan/);
  assert.match(answer.text, /Délai dépassé/);
});

test('tampon dépassé : sortie partielle, truncated, message clair', async (t) => {
  const root = workspace(t, `process.stdout.write('x'.repeat(3000)); setTimeout(() => {}, 5000);`);
  const tools = new CareerTools({ path: () => root }, { scriptMaxBuffer: 1000 });
  const answer = await tools.script({ command: 'find', query: 'FICTIF' });
  assert.equal(answer.truncated, true);
  assert.equal(answer.exitCode, null);
  assert.match(answer.text, /^x+/);
  assert.match(answer.text, /Sortie tronquée/);
});

test('Bilan : « délai dépassé » distinct d’un échec du script', () => {
  const timeout = JSON.stringify({ text: '…', exitCode: null, timedOut: true });
  const progress = gatewayProgress(
    'career_script',
    'failed',
    { command: 'scan' },
    {
      content: [{ type: 'text', text: timeout }],
    },
  );
  assert.equal(progress.exitCode, 124);
  const truth = createTurnTruth({ root: null });
  truth.recordGatewayTool('career_script', 'failed', {
    toolCallId: 'a',
    argument: 'scan',
    exitCode: 124,
  });
  truth.recordGatewayTool('career_script', 'failed', {
    toolCallId: 'b',
    argument: 'merge-tracker',
    exitCode: 2,
  });
  const [first, second] = truth.toolOutcomes();
  assert.equal(first.cause, 'délai dépassé');
  assert.equal(second.cause, 'échec signalé par l’outil');
});
