import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';

async function runFixture(
  t,
  { previous = null, config = {}, browserWorkflow = true, observedEvidence = null } = {},
) {
  const root = mkdtempSync(join(tmpdir(), 'fix-resume-FICTIF-'));
  const app = createApp({ dataDir: root, ownerMode: true });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'Montre les liens FICTIFS',
    model: '',
    mode: 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    simulated: true,
    skills: [],
    browserWorkflow,
    agent: {
      id: 'fixture',
      simulated: true,
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify({ loadSession: true, ...config }) },
    },
    pack: { id: 'core', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  const evidenceTimer = observedEvidence
    ? setInterval(() => {
        if (!control.promptStarted) return;
        app.store.event(run.id, 'browser_evidence', observedEvidence);
        clearInterval(evidenceTimer);
      }, 5)
    : null;
  try {
    await app.engine.execute(run, plan, control, previous);
  } finally {
    if (evidenceTimer) clearInterval(evidenceTimer);
  }
  return {
    ...app.store.get(run.id),
    testEvents: app.store.events(run.id),
    testUsage: app.store.usage(run.id),
  };
}

const answer = { simulated: true, summary: 'Voici cinq liens FICTIFS.', evidence: [] };

test('reprise ACP : outils navigateur rejoués, réponse sans navigation acceptée', async (t) => {
  const done = await runFixture(t, {
    previous: { sessionId: 'fake-session-1' },
    config: {
      replayOnLoad: true,
      replayBrowserToolOnLoad: true,
      expectBrowserResumeGuidance: true,
      result: answer,
    },
  });
  assert.equal(done.state, 'completed', done.error);
  assert.match(done.result.summary, /réponse sans nouvelle navigation/i);
  assert.match(done.result.summary, /cinq liens FICTIFS/);
  assert.deepEqual(done.result.evidence, []);
  assert.equal(
    done.testEvents.filter(
      (event) => event.type === 'agent' && event.data?.toolCallId === 'FICTIF-history-browser',
    ).length,
    0,
    'les appels ACP rejoués ne sont pas présentés comme du travail de ce tour',
  );
  assert.equal(
    done.testUsage.entries.filter((entry) => entry.dimension === 'tool_observed').length,
    0,
    'les appels ACP rejoués ne sont pas comptés comme usage actuel',
  );
});

test('reprise ACP : nouvel appel navigateur sans preuve reste refusé', async (t) => {
  const done = await runFixture(t, {
    previous: { sessionId: 'fake-session-1' },
    config: { promptBrowserTool: 'browser.navigate', result: answer },
  });
  assert.equal(done.state, 'failed');
  assert.match(done.error, /Navigation non prouvée/);
});

test('nouvelle mission navigateur sans navigation reste refusée', async (t) => {
  const done = await runFixture(t, { config: { result: answer } });
  assert.equal(done.state, 'failed');
  assert.match(done.error, /Navigation non prouvée/);
});

test('capture lisible du tour : preuve même sans navigate séparé', async (t) => {
  const done = await runFixture(t, {
    config: { lateMs: 100, result: answer },
    observedEvidence: {
      capability: 'browser.snapshot',
      url: 'https://example.test/resultats',
      snapshot: '- heading "FICTIF"',
      loading: false,
    },
  });
  assert.equal(done.state, 'completed', done.error);
  assert.equal(done.result.evidence.length, 1);
  assert.equal(done.result.simulated, true);
  assert.equal(done.result.provenance.data, 'navigateur simulé');
  assert.equal(
    done.testEvents.find((event) => event.type === 'verification')?.data.scope,
    'Structure seulement ; faits non vérifiés',
  );
});

test('capture about:blank du tour : refus précis sans résultat inventé', async (t) => {
  const done = await runFixture(t, {
    previous: { sessionId: 'fake-session-1' },
    config: { lateMs: 100, result: answer },
    observedEvidence: {
      capability: 'browser.snapshot',
      url: 'about:blank',
      snapshot: '',
      loading: false,
    },
  });
  assert.equal(done.state, 'failed');
  assert.match(done.error, /about:blank/);
  assert.doesNotMatch(done.result.summary, /cinq liens FICTIFS/);
});

test('résumé vide : le texte final utile de l’agent est repris et borné', async (t) => {
  const done = await runFixture(t, {
    browserWorkflow: false,
    config: {
      eventText: `Voici les liens FICTIFS. ${'détail '.repeat(500)}`,
      result: { ...answer, summary: '' },
    },
  });
  assert.equal(done.state, 'completed', done.error);
  assert.match(done.result.summary, /^Voici les liens FICTIFS/);
  assert.ok(done.result.summary.length <= 2000);
});
