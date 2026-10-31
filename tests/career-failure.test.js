import { usageLimitMessage } from '../packages/orchestrator/failure.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { careerFailureMessage } from '../packages/orchestrator/failure.js';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

test('échec privé : délai, annulation et arrêt de l’agent sont nommés sans détail privé', () => {
  assert.equal(
    careerFailureMessage({ reason: new Error('Délai maximal dépassé') }),
    'Délai maximal dépassé',
  );
  assert.equal(
    careerFailureMessage({ error: { code: 'timeout', message: 'CV privé' } }),
    'Délai de réponse de l’agent dépassé',
  );
  assert.equal(careerFailureMessage({ cancelled: true }), 'Annulée par l’utilisateur');
  assert.equal(
    careerFailureMessage({ reason: { code: 'tool_stalled', afterMs: 120000 } }),
    'Outil sans mise à jour depuis 120 s ; relancer.',
  );
  assert.equal(
    careerFailureMessage({ error: { code: 'exited', message: 'CV privé' } }),
    'Agent arrêté',
  );
  assert.equal(
    careerFailureMessage({ error: new Error('CV et secret privé') }),
    'Exécution privée échouée ; consulter les détails techniques.',
  );
});

test('échec privé : navigation non prouvée et réponse non structurée visibles sans extrait', () => {
  assert.equal(
    careerFailureMessage({
      error: new Error('Navigation non prouvée : CV SECRET FICTIF'),
    }),
    'Navigation non prouvée : aucune page ouverte puis observée.',
  );
  assert.equal(
    careerFailureMessage({
      error: new Error(
        'Réponse non structurée de l’agent (refus ou texte libre) : CV SECRET FICTIF',
      ),
    }),
    'Réponse non structurée de l’agent.',
  );
});

test('échec privé intégré : le délai du run est visible dans le fil sans donnée privée', async () => {
  const root = mkdtempSync(join(tmpdir(), 'career-failure-FICTIF-'));
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, timeoutMs: 1 });
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'CV SECRET FICTIF',
    model: '',
    mode: 'agent',
    budgetCents: 0,
    workspace: 'career-ops',
  };
  app.store.create({ ...run, prompt: 'Mission privée dans l’espace de candidature' });
  const plan = {
    simulated: true,
    skills: [],
    agent: {
      id: 'fixture',
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: '{}' },
    },
    pack: { id: 'career-ops', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  try {
    await app.engine.execute(run, plan, control, null);
    assert.equal(app.store.get(run.id).state, 'failed');
    assert.equal(app.store.get(run.id).error, 'Délai maximal dépassé');
    assert.doesNotMatch(JSON.stringify(app.store.get(run.id)), /CV SECRET/);
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('échec privé intégré : navigation non prouvée nommée sans prompt privé', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-navigation-FICTIF-')));
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode: true });
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'CV SECRET FICTIF https://exemple.invalid',
    model: '',
    mode: 'agent',
    budgetCents: 0,
    workspace: 'career-ops',
  };
  app.store.create({ ...run, prompt: 'Mission privée dans l’espace de candidature' });
  const plan = {
    simulated: true,
    skills: [],
    browserWorkflow: true,
    agent: {
      id: 'fixture',
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({ result: { simulated: true, summary: 'FICTIF', evidence: [] } }),
      },
    },
    pack: { id: 'career-ops', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  try {
    await app.engine.execute(run, plan, control, null);
    const done = app.store.get(run.id);
    assert.equal(done.state, 'failed');
    assert.equal(done.error, 'Navigation non prouvée : aucune page ouverte puis observée.');
    assert.doesNotMatch(JSON.stringify(done), /CV SECRET/);
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('limite d’usage : seule la cause sort, jamais le texte privé de l’agent', () => {
  const error = new Error('Internal error');
  assert.equal(
    usageLimitMessage(
      'Codex',
      'CV SECRET FICTIF. You’ve hit your usage limit, try again at 3:57 PM.',
      error,
    ),
    'Limite d’usage de Codex atteinte : réessayer à 3:57 PM. Choisir un autre agent ou attendre.',
  );
  assert.equal(usageLimitMessage('Codex', 'CV SECRET FICTIF', error), null);
  // A page quoting a limit must not disguise another failure.
  assert.equal(
    usageLimitMessage('Codex', 'rate limit cité par une page', new Error('Navigation non prouvée')),
    null,
  );
  assert.match(
    usageLimitMessage('Gemini', '', new Error('Quota exceeded for model')),
    /^Limite d’usage de Gemini/,
  );
});
