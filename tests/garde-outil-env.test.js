import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';

// Audit du 10/11 (constat 10) : la garde d'outil (120 s sans mise à jour) était la cause de 4 échecs
// career-ops et n'avait aucun réglage. AGENT_PLATFORM_TOOL_IDLE_MS la règle ; 120 s par défaut.
test('audit 10/11 FICTIF : garde d’outil réglable par variable, 120 s par défaut', async () => {
  const root = mkdtempSync(join(tmpdir(), 'garde-outil-FICTIF-'));
  const saved = process.env.AGENT_PLATFORM_TOOL_IDLE_MS;
  delete process.env.AGENT_PLATFORM_TOOL_IDLE_MS;
  const byDefault = createApp({ dataDir: join(root, 'default') });
  process.env.AGENT_PLATFORM_TOOL_IDLE_MS = '600000';
  const raised = createApp({ dataDir: join(root, 'raised') });
  process.env.AGENT_PLATFORM_TOOL_IDLE_MS = 'abc';
  const invalid = createApp({ dataDir: join(root, 'invalid') });
  try {
    assert.equal(byDefault.engine.toolIdleMs, 120000);
    assert.equal(raised.engine.toolIdleMs, 600000);
    assert.equal(invalid.engine.toolIdleMs, 120000);
  } finally {
    if (saved === undefined) delete process.env.AGENT_PLATFORM_TOOL_IDLE_MS;
    else process.env.AGENT_PLATFORM_TOOL_IDLE_MS = saved;
    await Promise.all([byDefault.close(), raised.close(), invalid.close()]);
    rmSync(root, { recursive: true, force: true });
  }
});
