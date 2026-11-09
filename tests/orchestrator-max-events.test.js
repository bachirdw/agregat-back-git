import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { loadSkillManifest, selectSkillIntents } from '../packages/orchestrator/skill-router.js';

// Audit misc3 (constat orchestrateur 11) : plafond de mises à jour ACP réglable, et dit au Bilan.
test('plafond par défaut relevé (20 000) et réglable par AGENT_PLATFORM_MAX_EVENTS', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'max-events-env-FICTIF-')));
  const apps = [];
  try {
    const first = createApp({ dataDir: join(root, 'a') });
    apps.push(first);
    assert.equal(first.engine.maxEvents, 20000);
    process.env.AGENT_PLATFORM_MAX_EVENTS = '123';
    const second = createApp({ dataDir: join(root, 'b') });
    apps.push(second);
    assert.equal(second.engine.maxEvents, 123);
  } finally {
    delete process.env.AGENT_PLATFORM_MAX_EVENTS;
    for (const app of apps) await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('dépassement du plafond : cause explicite dans la mission career-ops, pas un échec muet', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'max-events-FICTIF-')));
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  app.engine.careerTimeoutMs = 20000;
  app.engine.maxEvents = 50;
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'Mode oferta. Ouvre cette annonce FICTIVE et dis-moi ses exigences.',
    model: '',
    mode: 'agent',
    budgetCents: 0,
    workspace: 'career-ops',
  };
  app.store.create({ ...run, prompt: 'Mission privée dans l’espace de candidature' });
  const plan = {
    simulated: true,
    skills: [],
    skillSelection: selectSkillIntents(run.prompt, [loadSkillManifest('career-ops')]),
    agent: {
      id: 'fixture',
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify({ chunkCount: 200, loadSession: true }) },
    },
    pack: { id: 'career-ops', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  try {
    await app.engine.execute(run, plan, control, null);
    const done = app.store.get(run.id);
    assert.equal(done.state, 'failed');
    assert.match(done.error, /Trop de mises à jour de l’agent.*50.*AGENT_PLATFORM_MAX_EVENTS/);
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});
