// Tours FICTIFS : aucun modèle, aucun service externe, aucun navigateur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import { assessBrowserClaims, lastReadablePage } from '../packages/orchestrator/browser-proof.js';
import { attemptCheckpoint, resumeCheckpoint } from '../packages/orchestrator/checkpoint.js';

async function setup(t, { config = {}, workflow = false, astra = false, retries } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tour-reprise-FICTIF-'));
  const app = createApp({ dataDir: root, ownerMode: true, silentMs: 500 });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'FICTIF réponse courte',
    model: '',
    mode: workflow ? 'workflow' : 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    simulated: true,
    skills: [],
    pack: { id: 'core', workflow: { steps: [] } },
    agent: {
      id: 'fixture',
      simulated: true,
      command: process.execPath,
      args: [resolve(astra ? 'tests/fixtures/astra-acp.js' : 'tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify(config) },
    },
    dag: {
      id: 'fictif',
      title: 'FICTIF',
      steps: [
        {
          id: 'agent',
          title: 'FICTIF',
          kind: 'agent',
          prompt: 'FICTIF',
          ...(retries ? { retries } : {}),
        },
      ],
    },
  };
  const control = { abort: new AbortController() };
  app.engine.active.set(run.id, control);
  return { app, run, plan, control, root };
}

const stored = (app, fields) => {
  const run = {
    id: randomUUID(),
    state: 'completed',
    cwd: '/tmp',
    prompt: 'FICTIF',
    model: '',
    mode: 'agent',
    budgetCents: 0,
    ...fields,
  };
  app.store.create(run);
  return app.store.get(run.id);
};

test('session neuve : l’objectif d’origine et les tours antérieurs restent connus', async (t) => {
  const { app, run, plan, control } = await setup(t, { astra: true });
  const first = stored(app, {
    prompt: 'FICTIF objectif d’origine',
    result: { summary: 'FICTIF réponse 1' },
  });
  const second = stored(app, {
    prompt: 'FICTIF précision',
    resumedFrom: first.id,
    sessionId: 'FICTIF-old',
    result: { summary: 'FICTIF réponse 2', lastPage: 'https://fictif.test/offre' },
  });
  await app.engine.execute(run, plan, control, second);
  const done = app.store.get(run.id);
  assert.equal(done.state, 'completed', done.error);
  const { checkpoint } = done.result;
  assert.equal(checkpoint.schemaVersion, 1);
  assert.equal(checkpoint.previousObjective, 'FICTIF précision');
  assert.equal(checkpoint.previousAnswer, 'FICTIF réponse 2');
  assert.deepEqual(checkpoint.earlierTurns, [
    { objective: 'FICTIF objectif d’origine', answer: 'FICTIF réponse 1' },
  ]);
  assert.deepEqual(checkpoint.observed, { lastPage: 'https://fictif.test/offre' });
  assert.equal(checkpoint.untrusted, true);
  assert.equal(checkpoint.effects, 'unverified');
});

test('une longue mission garde son premier objectif et ses derniers tours, bornés', async (t) => {
  const { app, run } = await setup(t);
  app.engine.active.delete(run.id);
  let previous = null;
  for (let turn = 1; turn <= 9; turn++)
    previous = stored(app, {
      prompt: `FICTIF tour ${turn}`,
      resumedFrom: previous?.id ?? null,
      result: { summary: 'x'.repeat(20000) },
    });
  const checkpoint = app.engine.checkpointFor(previous);
  assert.deepEqual(
    checkpoint.earlierTurns.map((turn) => turn.objective),
    ['FICTIF tour 1', 'FICTIF tour 5', 'FICTIF tour 6', 'FICTIF tour 7', 'FICTIF tour 8'],
  );
  assert.ok(checkpoint.earlierTurns.every((turn) => turn.answer.length === 1500));
  assert.equal(checkpoint.previousAnswer.length, 12000);
});

test('mission privée : l’objectif vient du fichier privé, jamais de la ligne publique', async (t) => {
  const { app, run, root } = await setup(t);
  app.engine.active.delete(run.id);
  app.engine.career = { path: () => root };
  mkdirSync(join(root, 'relay/runs'), { recursive: true });
  const id = randomUUID();
  writeFileSync(
    join(root, `relay/runs/${id}-input.json`),
    JSON.stringify({ prompt: 'FICTIF privé' }),
  );
  const checkpoint = app.engine.checkpointFor({
    id,
    workspace: 'career-ops',
    prompt: 'Mission privée dans l’espace de candidature',
    result: { summary: 'FICTIF' },
  });
  assert.equal(checkpoint.previousObjective, 'FICTIF privé');
  const missing = app.engine.checkpointFor({
    id: randomUUID(),
    workspace: 'career-ops',
    prompt: 'Mission privée dans l’espace de candidature',
  });
  assert.equal(missing.previousObjective, null);
});

test('dernière page observée : sans paramètres, ignorée si non lue', () => {
  assert.equal(
    lastReadablePage([
      {
        capability: 'browser.snapshot',
        url: 'https://fictif.test/a?jeton=1#x',
        snapshot: 'FICTIF',
      },
      {
        capability: 'browser.snapshot',
        url: 'https://fictif.test/charge',
        snapshot: 'x',
        loading: true,
      },
      { capability: 'browser.navigate', url: 'https://fictif.test/jamais-lue' },
    ]),
    'https://fictif.test/a',
  );
  assert.equal(
    lastReadablePage([{ capability: 'browser.navigate', url: 'https://fictif.test/' }]),
    null,
  );
  assert.equal(lastReadablePage(), null);
  assert.equal(resumeCheckpoint({}).observed.lastPage, null);
  assert.equal(attemptCheckpoint(2).previousAttempt, 1);
});

test('citations : une variante d’adresse reste « non prouvée », une casse différente est comptée', () => {
  const evidence = [
    { capability: 'browser.snapshot', url: 'https://www.fictif.test/a', snapshot: 'FICTIF' },
  ];
  evidence[0].sourceId = undefined;
  const status = (text) => assessBrowserClaims(text, evidence).citations.map((c) => c.status);
  assert.deepEqual(status('https://www.fictif.test/a'), ['read']);
  assert.deepEqual(status('HTTPS://www.fictif.test/z'), ['cited']);
  for (const variant of ['https://fictif.test/a', 'https://www.fictif.test/a/'])
    assert.deepEqual(status(variant), ['cited']);
});

test('MCP mal configuré, mission simple : échec nommé, sans doute sur un effet', async (t) => {
  const { app, run, plan, control } = await setup(t);
  app.engine.mcpServerFor = () => {
    throw new Error('Configuration MCP FICTIVE invalide');
  };
  await app.engine.execute(run, plan, control, null);
  const done = app.store.get(run.id);
  assert.equal(done.state, 'failed');
  assert.match(done.error, /Configuration MCP FICTIVE invalide/);
  assert.equal(app.engine.attemptTokens.size, 0);
});

test('MCP mal configuré, étape agent : échec sans décision demandée, ni jeton restant', async (t) => {
  const { app, run, plan, control } = await setup(t, { workflow: true });
  app.engine.mcpServerFor = () => {
    throw new Error('Configuration MCP FICTIVE invalide');
  };
  await app.engine.execute(run, plan, control, null);
  const row = app.engine.workflows.row(run.id, 'agent');
  assert.equal(row.state, 'failed');
  assert.match(row.error, /Configuration MCP FICTIVE invalide/);
  assert.deepEqual(row.output, { beforeEffect: true });
  assert.equal(app.engine.attemptTokens.size, 0);
  assert.equal(app.store.get(run.id).state, 'failed');
});

test('MCP mal configuré, étape outil d’écriture : aucun jeton restant, aucun doute', async (t) => {
  const { app, run, plan, control } = await setup(t, { workflow: true });
  plan.dag.steps = [
    { id: 'outil', title: 'FICTIF', kind: 'tool', tool: 'fictif.ecrire', effect: 'write' },
  ];
  app.engine.mcpServerFor = () => {
    throw new Error('Configuration MCP FICTIVE invalide');
  };
  await app.engine.execute(run, plan, control, null);
  const row = app.engine.workflows.row(run.id, 'outil');
  assert.equal(row.state, 'failed');
  assert.equal(app.engine.attemptTokens.size, 0);
});

test('agent coupé à la création de session : relancé selon ses essais, jamais « incertain »', async (t) => {
  const { app, run, plan, control } = await setup(t, {
    workflow: true,
    retries: 1,
    config: { crashOn: 'session/new' },
  });
  await app.engine.execute(run, plan, control, null);
  const row = app.engine.workflows.row(run.id, 'agent');
  assert.equal(row.state, 'failed');
  assert.equal(row.attempt, 2);
});

test('un échec après l’envoi du prompt reste incertain', async (t) => {
  const { app, run, plan, control } = await setup(t, {
    workflow: true,
    config: { crashOn: 'session/prompt' },
  });
  const finished = app.engine.execute(run, plan, control, null);
  for (let i = 0; i < 200 && app.engine.workflows?.row(run.id, 'agent')?.state !== 'uncertain'; i++)
    await new Promise((r) => setTimeout(r, 20));
  const row = app.engine.workflows.row(run.id, 'agent');
  assert.equal(row.state, 'uncertain');
  assert.equal(row.output, null);
  control.engine.resolveUncertain(run.id, 'agent', 'fail');
  await finished;
});

test('relancer une étape incertaine prévient l’agent et donne la dernière page lue', async (t) => {
  const seen = join(mkdtempSync(join(tmpdir(), 'tour-prompt-')), 'prompts.jsonl');
  t.after(() => rmSync(join(seen, '..'), { recursive: true, force: true }));
  const { app, run, plan, control } = await setup(t, {
    workflow: true,
    config: { crashOn: 'session/prompt' },
  });
  const finished = app.engine.execute(run, plan, control, null);
  for (let i = 0; i < 200 && app.engine.workflows?.row(run.id, 'agent')?.state !== 'uncertain'; i++)
    await new Promise((r) => setTimeout(r, 20));
  app.store.event(run.id, 'browser_evidence', {
    capability: 'browser.snapshot',
    url: 'https://fictif.test/page?jeton=1',
    snapshot: 'FICTIF',
    stepId: 'agent',
  });
  app.store.event(run.id, 'browser_evidence', {
    capability: 'browser.snapshot',
    url: 'https://fictif.test/autre-etape',
    snapshot: 'FICTIF',
    stepId: 'autre',
  });
  plan.agent.args = [resolve('tests/fixtures/astra-acp.js')];
  control.engine.resolveUncertain(run.id, 'agent', 'retry');
  await finished;
  const row = app.engine.workflows.row(run.id, 'agent');
  assert.equal(row.state, 'succeeded', row.error);
  assert.equal(row.attempt, 2);
  assert.equal(row.output.checkpoint.previousAttempt, 1);
  assert.deepEqual(row.output.checkpoint.observed, { lastPage: 'https://fictif.test/page' });
  assert.equal(row.output.checkpoint.effects, 'unverified');
});

test('reprise explicite : un échec sans effet repart directement, sans décision', async (t) => {
  const { app, run, plan, control } = await setup(t, { workflow: true });
  app.engine.mcpServerFor = () => {
    throw new Error('Configuration MCP FICTIVE invalide');
  };
  await app.engine.execute(run, plan, control, null);
  const engine = app.engine.workflows;
  engine.recover(run.id, plan.dag, { retryFailed: true });
  assert.equal(engine.row(run.id, 'agent').state, 'pending');
  engine.set(run.id, 'agent', { state: 'failed', output: null });
  engine.recover(run.id, plan.dag, { retryFailed: true });
  assert.equal(engine.row(run.id, 'agent').state, 'uncertain');
});
