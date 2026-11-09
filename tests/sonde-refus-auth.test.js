import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { loadProbes } from '../packages/agent-runtime/index.js';

async function failedRun(errorText, packId) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'sonde-auth-FICTIF-')));
  const career = new CareerWorkspace({ root, roots: [root] });
  const dataDir = join(root, 'platform');
  const app = createApp({ dataDir, career, ownerMode: true });
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'Mission FICTIVE',
    model: '',
    mode: 'agent',
    budgetCents: 0,
    workspace: 'career-ops',
  };
  app.store.create(run);
  const plan = {
    simulated: false,
    skills: [],
    agent: {
      id: 'fixture',
      name: 'Agent FICTIF',
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify({ errorText }) },
    },
    pack: { id: packId, workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  try {
    await app.engine.execute(run, plan, control, null);
    return loadProbes(dataDir).fixture;
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
}

test('sonde : un échec citant « author » n’écrit pas de refus d’authentification (career-ops)', async () => {
  const probe = await failedRun('Page introuvable : author inconnu, login cité', 'career-ops');
  assert.equal(probe?.inference, undefined);
});

test('sonde : un vrai refus d’authentification est enregistré (career-ops)', async () => {
  const probe = await failedRun('Failed to authenticate. API Error: 401', 'career-ops');
  assert.equal(probe.inference, false);
  assert.equal(probe.inferenceError, 'Authentification API refusée');
});
