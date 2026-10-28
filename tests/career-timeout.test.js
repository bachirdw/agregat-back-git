import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';

test('délai par défaut : career-ops 15 min, autres packs 3 min ; surcharge explicite conservée', async () => {
  const root = mkdtempSync(join(tmpdir(), 'career-timeout-FICTIF-'));
  const app = createApp({ dataDir: join(root, 'default') });
  const overridden = createApp({ dataDir: join(root, 'overridden'), timeoutMs: 1234 });
  try {
    assert.equal(app.engine.timeoutFor('core'), 180000);
    assert.equal(app.engine.timeoutFor('career-ops'), 900000);
    assert.equal(overridden.engine.timeoutFor('core'), 1234);
    assert.equal(overridden.engine.timeoutFor('career-ops'), 1234);
  } finally {
    await app.close();
    await overridden.close();
    rmSync(root, { recursive: true, force: true });
  }
});
