import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { testPhaseTimeoutMs } from '../scripts/test-phase-timeout.js';

test('runner : la phase Chrome garde une marge distincte sous charge', () => {
  assert.equal(testPhaseTimeoutMs('parallel', null), 240000);
  assert.equal(testPhaseTimeoutMs('browser', null), 480000);
  assert.equal(testPhaseTimeoutMs('browser', '100'), 100);
  assert.equal(testPhaseTimeoutMs('browser', '-1'), 480000);
});

test('runner : une phase bloquée expire sans attendre le délai de quinze minutes', () => {
  const root = mkdtempSync(join(tmpdir(), 'relay-test-runner-'));
  try {
    mkdirSync(join(root, 'tests'));
    writeFileSync(
      join(root, 'tests', 'hang.test.js'),
      "const test = require('node:test'); test('FICTIF bloqué', () => new Promise(() => setInterval(() => {}, 1000)));",
    );
    const { NODE_TEST_CONTEXT: _nested, ...env } = process.env;
    const result = spawnSync(process.execPath, [resolve('scripts/run-tests.js')], {
      cwd: root,
      env: { ...env, AGENT_PLATFORM_TEST_PHASE_TIMEOUT_MS: '100' },
      encoding: 'utf8',
      timeout: 2000,
    });
    assert.equal(result.error, undefined, 'le runner lui-même doit sortir avant le délai externe');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /phase expirée/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
