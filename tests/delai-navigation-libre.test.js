import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';

// Audit du 10/11 (constat 1) : hors career-ops, la navigation libre du propriétaire (browser-agent)
// avait 3 min en tout, tour ACP compris ; une candidature sans Skill s'arrêtait avant la demande
// d'envoi. Elle prend désormais le délai de career-ops, ou sa propre variable.
const browsing = { pack: { id: 'core' }, browserWorkflow: true };

test('audit 10/11 FICTIF : la navigation libre a au moins le délai de career-ops', async () => {
  const root = mkdtempSync(join(tmpdir(), 'delai-navigation-FICTIF-'));
  const app = createApp({ dataDir: join(root, 'default') });
  const common = createApp({ dataDir: join(root, 'common'), timeoutMs: 1234 });
  try {
    assert.equal(app.engine.timeoutFor(browsing), 900000);
    assert.equal(app.engine.timeoutFor({ pack: { id: 'core' } }), 180000);
    assert.equal(app.engine.timeoutFor({ pack: { id: 'career-ops' } }), 900000);
    assert.equal(app.engine.timeoutFor('core'), 180000);
    // La valeur commune (AGENT_PLATFORM_TIMEOUT_MS) s'applique encore à tous.
    assert.equal(common.engine.timeoutFor(browsing), 1234);
  } finally {
    await app.close();
    await common.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('audit 10/11 FICTIF : variables propres à career-ops et à la navigation libre', async () => {
  const root = mkdtempSync(join(tmpdir(), 'delai-navigation-env-FICTIF-'));
  const saved = { ...process.env };
  process.env.AGENT_PLATFORM_CAREER_TIMEOUT_MS = '1200000';
  process.env.AGENT_PLATFORM_BROWSER_TIMEOUT_MS = '600000';
  const app = createApp({ dataDir: join(root, 'env'), timeoutMs: 1234 });
  delete process.env.AGENT_PLATFORM_BROWSER_TIMEOUT_MS;
  const followsCareer = createApp({ dataDir: join(root, 'career') });
  try {
    assert.equal(app.engine.timeoutFor('career-ops'), 1200000);
    assert.equal(app.engine.timeoutFor(browsing), 600000);
    assert.equal(app.engine.timeoutFor('core'), 1234);
    assert.equal(followsCareer.engine.timeoutFor(browsing), 1200000);
  } finally {
    process.env = saved;
    await app.close();
    await followsCareer.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('audit 10/11 FICTIF : le plan du mode propriétaire sans Skill est une navigation libre', async () => {
  const root = mkdtempSync(join(tmpdir(), 'delai-navigation-plan-FICTIF-'));
  const app = createApp({ dataDir: join(root, 'owner'), ownerMode: true });
  try {
    const plan = await app.engine.plan({
      prompt: 'Ouvre la page FICTIVE http://127.0.0.1:9/ et résume-la.',
    });
    assert.equal(plan.browserWorkflow, true);
    assert.equal(app.engine.timeoutFor(plan), 900000);
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});
