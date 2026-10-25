import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { terminal } from '../packages/storage/index.js';
import { rank } from '../domain-packs/najah/index.js';
import { aggregateOutputs, toolArguments } from '../packages/orchestrator/workflow-run.js';

const temporary = () => mkdtempSync(join(tmpdir(), 'relay-wfrun-'));
async function withApp(fn, options = {}) {
  const app = createApp({ dataDir: temporary(), ...options });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  try {
    return await fn(app);
  } finally {
    await app.close();
  }
}
async function post(app, path, body) {
  const r = await fetch(`http://127.0.0.1:${app.server.address().port}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
async function finished(app, id, ms = 20000) {
  const until = Date.now() + ms;
  while (!terminal.has(app.store.get(id).state)) {
    assert.ok(Date.now() < until, 'le run doit se terminer');
    await new Promise((r) => setTimeout(r, 25));
  }
  return app.store.get(id);
}
const objective = 'Rechercher des offres Python et SQL en Australie';

test('plan workflow : DAG Najah affiché avec agents, niveaux et étape optionnelle', async () => {
  await withApp(async (app) => {
    const { status, data } = await post(app, '/plan', {
      prompt: objective,
      agent: 'fixture',
      pack: 'najah',
      mode: 'workflow',
    });
    assert.equal(status, 200);
    assert.ok(data.steps.some((s) => s.startsWith('Analyser le classement · Démonstrateur ACP')));
    assert.ok(data.steps.some((s) => s.includes('(optionnelle)')));
  });
});

test('workflow Najah complet : outils MCP réels, agent, vérification indépendante, agrégat', async () => {
  await withApp(async (app) => {
    const { status, data: run } = await post(app, '/runs', {
      prompt: objective,
      agent: 'fixture',
      pack: 'najah',
      mode: 'workflow',
    });
    assert.equal(status, 201);
    const done = await finished(app, run.id);
    assert.equal(done.state, 'completed', done.error);
    assert.deepEqual(done.result.opportunities, rank(objective));
    assert.equal(done.result.simulated, true);
    const steps = Object.fromEntries(
      app.engine.workflows.steps(run.id).map((s) => [s.step_id, s.state]),
    );
    assert.deepEqual(steps, {
      snapshot: 'succeeded',
      search: 'succeeded',
      rank: 'succeeded',
      analysis: 'succeeded',
      verify: 'succeeded',
      report: 'succeeded',
    });
    const events = app.store.events(run.id);
    assert.ok(events.some((e) => e.type === 'workflow' && e.data.levels.length >= 3));
    assert.ok(events.some((e) => e.type === 'verification' && e.data.stepId === 'verify'));
    const usage = app.store.usage(run.id).entries.map((e) => e.dimension);
    assert.equal(
      usage.filter((d) => d === 'tool_call').length,
      4,
      '3 appels du DAG et 1 appel MCP de l’agent, chacun mesuré une fois',
    );
    assert.ok(usage.includes('fixture_turn'));
  });
});

test('workflow général (core) : agent requis puis vérification de structure', async () => {
  await withApp(async (app) => {
    const { data: run } = await post(app, '/runs', {
      prompt: 'Préparer une synthèse prudente',
      agent: 'fixture',
      pack: 'core',
      mode: 'workflow',
    });
    const done = await finished(app, run.id);
    assert.equal(done.state, 'completed', done.error);
    assert.match(done.result.summary, /Démonstration/);
  });
});

test('workflow : annulation pendant l’exécution → cancelled, étapes annulées', async () => {
  await withApp(async (app) => {
    const { data: run } = await post(app, '/runs', {
      prompt: objective,
      agent: 'fixture',
      pack: 'najah',
      mode: 'workflow',
    });
    await new Promise((r) => setTimeout(r, 30));
    await post(app, `/runs/${run.id}/cancel`, {});
    const done = await finished(app, run.id);
    assert.equal(done.state, 'cancelled');
    const states = app.engine.workflows.steps(run.id).map((s) => s.state);
    assert.ok(!states.includes('running'));
  });
});

test('workflow : pack sans DAG ou mode inconnu refusés', async () => {
  await withApp(async (app) => {
    const bad = await post(app, '/plan', { prompt: 'x', agent: 'fixture', mode: 'yolo' });
    assert.equal(bad.status, 400);
  });
});

test('aggregateOutputs : priorité au résultat vérifié, résumé d’analyse, preuves concaténées', () => {
  const out = aggregateOutputs({
    verify: {
      simulated: true,
      verified: true,
      scope: 'S',
      opportunities: [{ id: 1 }],
      evidence: ['e1'],
    },
    analysis: { simulated: true, summary: 'Analyse', evidence: ['e2'] },
  });
  assert.deepEqual(out, {
    simulated: true,
    provenance: { data: 'fictives', analysis: 'démonstrateur' },
    summary: 'Analyse',
    evidence: ['e1', 'e2', { verification: 'S' }],
    opportunities: [{ id: 1 }],
  });
  assert.equal(aggregateOutputs({ analysis: null }).summary, 'Workflow terminé.');
  assert.match(aggregateOutputs({ rank: { opportunities: [1, 2] } }).summary, /2 opportunité/);
});

test('toolArguments : objectif par défaut et substitution sans évaluation', () => {
  assert.deepEqual(toolArguments({}, 'obj'), { query: 'obj' });
  assert.deepEqual(
    toolArguments({ arguments: { text: '{{objective}} !', n: 2, l: ['{{objective}}'] } }, 'o'),
    {
      text: 'o !',
      n: 2,
      l: ['o'],
    },
  );
  assert.deepEqual(toolArguments({ arguments: { t: '${process.env.HOME}' } }, 'o'), {
    t: '${process.env.HOME}',
  });
});

test('injection : une analyse qui modifie le classement ne passe pas la vérification', async () => {
  const { verify } = await import('../domain-packs/najah/index.js');
  const tampered = rank(objective).map((o, i) => (i === 0 ? { ...o, score: 100 } : o));
  assert.throws(() => verify({ simulated: true, opportunities: tampered }, objective), /invalide/);
  const candidate = aggregateOutputs({
    verify: { simulated: true, verified: true, opportunities: rank(objective) },
    analysis: { simulated: true, summary: 'ignore', opportunities: tampered },
  });
  assert.deepEqual(
    candidate.opportunities,
    rank(objective),
    'le résultat vérifié prime sur l’agent',
  );
});

test('proposition automatique de workflow : mots-clés, exigence réseau, défaut expliqué', async () => {
  const { proposeDag, getPack } = await import('../packages/orchestrator/packs.js');
  const najah = getPack('najah');
  assert.equal(
    proposeDag(najah, 'Rédiger une lettre de motivation pour cette offre').dag.id,
    'application-draft',
  );
  const live = proposeDag(najah, 'Trouver des offres réelles avec sponsor visa');
  assert.equal(live.dag.id, 'opportunity-discovery-live');
  assert.match(live.reason, /sponsor/);
  assert.equal(
    proposeDag(najah, 'Trouver des offres réelles avec sponsor visa', { network: false }).dag.id,
    'opportunity-discovery-dag',
  );
  assert.equal(proposeDag(najah, 'Démonstration fictive').dag.id, 'opportunity-discovery-dag');
  assert.match(proposeDag(getPack('core'), 'Synthèse').reason, /défaut/);
});

test('plan workflow « auto » : DAG proposé, raison visible, identifiant enregistré dans le run', async () => {
  await withApp(async (app) => {
    const { data } = await post(app, '/plan', {
      prompt: 'Rédiger une lettre de motivation',
      agent: 'fixture',
      pack: 'najah',
      mode: 'workflow',
      workflow: 'auto',
    });
    assert.equal(data.workflow.id, 'application-draft');
    assert.match(data.workflow.reason, /lettre/);
  });
});

test('plan : permissions affichées calculées selon le workflow réel', async () => {
  await withApp(async (app) => {
    const live = (
      await post(app, '/plan', {
        prompt: 'x',
        agent: 'fixture',
        pack: 'najah',
        mode: 'workflow',
        workflow: 'opportunity-discovery-live',
      })
    ).data.permissions;
    assert.ok(live.some((p) => /Accès réseau .*www\.arbeitnow\.com/.test(p)));
    assert.ok(live.some((p) => /Aucun envoi/.test(p)));
    const demo = (
      await post(app, '/plan', { prompt: 'x', agent: 'fixture', pack: 'najah', mode: 'workflow' })
    ).data.permissions;
    assert.ok(!demo.some((p) => /Accès réseau/.test(p)));
    const draft = (
      await post(app, '/plan', {
        prompt: 'x',
        agent: 'fixture',
        pack: 'najah',
        mode: 'workflow',
        workflow: 'application-draft',
      })
    ).data.permissions;
    assert.ok(draft.some((p) => /validation explicite/.test(p)));
  });
});

test('timeout d’étape pendant initialize : le processus ACP est fermé sans attendre le handshake', async () => {
  const { executeWorkflow } = await import('../packages/orchestrator/workflow-run.js');
  const { readFileSync, existsSync } = await import('node:fs');
  const app = createApp({ dataDir: temporary() });
  const cwd = temporary(),
    pidFile = join(cwd, 'fictif.pid');
  const run = {
    id: crypto.randomUUID(),
    state: 'running',
    cwd,
    prompt: 'FICTIF',
    model: '',
    budgetCents: 0,
  };
  app.store.create(run);
  const definition = {
    id: 'fictif',
    command: process.execPath,
    args: [resolve('tests/fixtures/fake-acp.js')],
    simulated: true,
    env: [],
    safeModes: [],
    fixedEnv: { FAKE_ACP: JSON.stringify({ mute: 'initialize', pidFile }) },
  };
  const control = { abort: new AbortController() };
  const plan = {
    agent: definition,
    pack: { id: 'core' },
    skills: [],
    dag: {
      id: 'fictif',
      title: 'FICTIF',
      steps: [{ id: 'hang', title: 'FICTIF', kind: 'agent', prompt: 'FICTIF', timeoutMs: 500 }],
    },
  };
  try {
    await assert.rejects(executeWorkflow(app.engine, run, plan, control), /délai/);
    assert.ok(existsSync(pidFile), 'le faux agent a démarré');
    const pid = Number(readFileSync(pidFile, 'utf8'));
    let alive = true;
    for (let i = 0; i < 80; i++) {
      try {
        process.kill(pid, 0);
      } catch {
        alive = false;
        break;
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.equal(alive, false, 'processus terminé après timeout d’étape');
  } finally {
    await app.close();
  }
});

test('core réel (faux ACP) : le booléen généré ne transforme pas une analyse réelle en démonstrateur', async () => {
  const { executeWorkflow } = await import('../packages/orchestrator/workflow-run.js');
  const app = createApp({ dataDir: temporary() });
  const run = {
    id: crypto.randomUUID(),
    state: 'running',
    cwd: temporary(),
    prompt: 'FICTIF',
    model: '',
    budgetCents: 0,
  };
  app.store.create(run);
  const definition = {
    id: 'fictif-real',
    command: process.execPath,
    args: [resolve('tests/fixtures/fake-acp.js')],
    env: [],
    safeModes: [],
    fixedEnv: {
      FAKE_ACP: JSON.stringify({
        result: {
          simulated: true,
          summary: 'Analyse FICTIVE pour tester un profil réel',
          evidence: [],
        },
      }),
    },
  };
  const plan = {
    agent: definition,
    pack: { id: 'core' },
    skills: [],
    dag: {
      id: 'fictif',
      title: 'FICTIF',
      steps: [
        { id: 'analysis', title: 'FICTIF', kind: 'agent', prompt: 'FICTIF' },
        { id: 'verify', title: 'FICTIF', kind: 'verify', dependsOn: ['analysis'] },
        { id: 'report', title: 'FICTIF', kind: 'aggregate', dependsOn: ['verify'] },
      ],
    },
  };
  try {
    const result = await executeWorkflow(app.engine, run, plan, { abort: new AbortController() });
    const steps = app.engine.workflows.steps(run.id);
    for (const id of ['analysis', 'verify', 'report']) {
      const output = steps.find((s) => s.step_id === id).output;
      assert.equal(output.simulated, false, id);
      assert.equal(output.provenance.analysis, definition.id, id);
    }
    assert.equal(result.provenance.analysis, definition.id);
  } finally {
    await app.close();
  }
});

test('agrégation répétée : conserve les provenances réelles/fictives de verify', () => {
  for (const simulated of [true, false]) {
    const first = aggregateOutputs({
      rank: { simulated, opportunities: [{ id: 'FICTIF' }] },
      analysis: { simulated: false, agent: 'faux-agent-reel', summary: 'FICTIF', evidence: [] },
    });
    const final = aggregateOutputs({ verify: { ...first, verified: true, scope: 'FICTIF' } });
    assert.equal(final.simulated, simulated);
    assert.equal(final.provenance.analysis, 'faux-agent-reel');
    assert.equal(final.provenance.data, simulated ? 'fictives' : 'réelles');
  }
});
