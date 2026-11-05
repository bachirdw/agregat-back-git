import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';

test('AGENT_PLATFORM_SILENT_MS relève la garde de silence de l’agent (FICTIF)', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'silent-ms-FICTIF-'));
  const before = process.env.AGENT_PLATFORM_SILENT_MS;
  process.env.AGENT_PLATFORM_SILENT_MS = '900000';
  const app = createApp({ dataDir: root });
  t.after(async () => {
    if (before === undefined) delete process.env.AGENT_PLATFORM_SILENT_MS;
    else process.env.AGENT_PLATFORM_SILENT_MS = before;
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  assert.equal(app.engine.silentMs, 900000);
});
test('sans variable, la garde de silence garde 180 s (FICTIF)', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'silent-ms-FICTIF-'));
  const before = process.env.AGENT_PLATFORM_SILENT_MS;
  delete process.env.AGENT_PLATFORM_SILENT_MS;
  const app = createApp({ dataDir: root });
  t.after(async () => {
    if (before !== undefined) process.env.AGENT_PLATFORM_SILENT_MS = before;
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  assert.equal(app.engine.silentMs, 180000);
});
