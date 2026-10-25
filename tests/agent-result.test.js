import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentResult } from '../packages/orchestrator/index.js';

const valid = { simulated: true, summary: 's', evidence: [] };
test('résultat agent : JSON brut, clôturé, entouré de prose', () => {
  assert.deepEqual(parseAgentResult(JSON.stringify(valid)).value, valid);
  assert.deepEqual(parseAgentResult('```json\n' + JSON.stringify(valid) + '\n```').value, valid);
  assert.deepEqual(parseAgentResult('Voici :\n' + JSON.stringify(valid) + '\nFin.').value, valid);
});
test('résultat agent : refus en texte libre rapporté avec extrait', () => {
  const r = parseAgentResult('Free OpenCode models can’t be used as a backend for other services.');
  assert.equal(r.ok, false);
  assert.match(r.reason, /non structurée/);
  assert.match(r.excerpt, /Free OpenCode/);
});
test('résultat agent : vide, JSON invalide, hors contrat', () => {
  assert.equal(parseAgentResult('').excerpt, '(réponse vide)');
  assert.match(parseAgentResult('{ pas du json }').reason, /JSON invalide/);
  assert.match(parseAgentResult('{"summary":"x"}').reason, /hors contrat/);
  assert.match(parseAgentResult(JSON.stringify({ ...valid, summary: '' })).reason, /hors contrat/);
});
test('résultat agent : extrait borné à 300 caractères', () => {
  assert.ok(parseAgentResult('x'.repeat(5000)).excerpt.length <= 300);
});

test('provenance : runtime fait autorité et données Najah restent fictives', async () => {
  const { executionResult } = await import('../packages/orchestrator/result.js');
  for (const simulated of [true, false]) {
    const definition = { id: simulated ? 'fixture' : 'faux-reel', simulated };
    const value = executionResult(
      { ...valid, simulated: !simulated, provenance: { analysis: 'mensonge' } },
      definition,
    );
    assert.equal(value.simulated, simulated);
    assert.equal(value.provenance.analysis, simulated ? 'démonstrateur' : 'faux-reel');
  }
  const najah = executionResult(valid, { id: 'faux-reel' }, { fixtureData: true });
  assert.equal(najah.simulated, true);
  assert.deepEqual(najah.provenance, { data: 'fictives', analysis: 'faux-reel' });
});

test('mode agent core : exécution faux ACP sans modèle, provenance réelle imposée', async () => {
  const { createApp } = await import('../apps/api/server.js');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const app = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'review-provenance-')) });
  const run = {
    id: crypto.randomUUID(),
    state: 'queued',
    cwd: app.engine.dataDir,
    prompt: 'FICTIF',
    model: '',
    mode: 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    simulated: false,
    skills: [],
    agent: {
      id: 'faux-reel',
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify({ result: valid }) },
    },
    pack: { id: 'core', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  try {
    await app.engine.execute(run, plan, control, null);
    const done = app.store.get(run.id);
    assert.equal(done.state, 'completed', done.error);
    assert.equal(done.result.simulated, false);
    assert.equal(done.result.provenance.analysis, 'faux-reel');
  } finally {
    await app.close();
  }
});
