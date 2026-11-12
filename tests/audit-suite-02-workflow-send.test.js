// audit-suite-02 (audit du 12/11, A10) : en mode workflow (DAG), l'attente du clic d'envoi du
// propriétaire suspend la garde de l'étape (outil, silence) et les délais du tour ACP de l'étape,
// comme en mode agent (E64). Faux agent ACP (tests/fixtures/fake-acp.js), aucune page ni envoi réel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';

const temporary = () => mkdtempSync(join(tmpdir(), 'relay-a10-'));

function setup(fake) {
  const app = createApp({ dataDir: temporary() });
  app.engine.ownerMode = true;
  app.engine.silentMs = 300;
  app.engine.toolIdleMs = 300;
  const root = temporary();
  const goFile = join(root, 'go-FICTIF');
  const run = {
    id: crypto.randomUUID(),
    state: 'running',
    cwd: root,
    prompt: 'FICTIF',
    model: '',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    agent: {
      id: 'fictif-real',
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({
          composeTool: { path: 'rapport-FICTIF.md', permission: false, goFile, ...fake },
        }),
      },
    },
    pack: { id: 'core' },
    skills: [],
    dag: {
      id: 'fictif',
      title: 'FICTIF',
      steps: [{ id: 'envoi', title: 'FICTIF', kind: 'agent', prompt: 'FICTIF' }],
    },
  };
  const pauses = { suspended: 0, resumed: 0 };
  const control = {
    abort: new AbortController(),
    suspendTimers: () => pauses.suspended++,
    resumeTimers: () => pauses.resumed++,
  };
  // gatewayApproval passe par bridgeControl, qui exige une mission active.
  app.engine.active.set(run.id, control);
  return { app, run, plan, control, pauses, goFile };
}

const waitFor = async (check, label, ms = 10000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('Attente dépassée : ' + label);
};

test('A10 : carte d’envoi de la passerelle dans une étape DAG → garde de l’étape suspendue jusqu’au clic, puis étape terminée', async () => {
  const { executeWorkflow } = await import('../packages/orchestrator/workflow-run.js');
  const { app, run, plan, control, pauses, goFile } = setup({});
  try {
    const done = executeWorkflow(app.engine, run, plan, control);
    done.catch(() => {});
    // L'outil de l'étape est ouvert (tool_call en attente) : la garde d'outil est armée.
    await waitFor(
      () =>
        app.store
          .events(run.id)
          .some((e) => e.type === 'agent' && e.data.toolCallId === 'FICTIF-compose'),
      'outil de l’étape observé',
    );
    const scope = [...app.engine.attemptTokens.values()].find((s) => s.runId === run.id);
    assert.ok(scope, 'tentative de l’étape ouverte');
    const pending = app.engine.gatewayApproval(run.id, scope.token, {
      capability: 'browser.click',
      actionClass: 'send',
      element: { text: 'Envoyer FICTIF' },
    });
    await waitFor(() => app.engine.permissions.size === 1, 'carte d’envoi posée');
    await new Promise((r) => setTimeout(r, 1000)); // > délais d'outil et de silence de l'étape
    const types = app.store.events(run.id).map((e) => e.type);
    assert.ok(!types.includes('tool_stalled'), 'outil de l’étape non coupé pendant l’attente');
    assert.ok(!types.includes('agent_silent'), 'silence de l’étape non coupé pendant l’attente');
    assert.equal(control.abort.signal.aborted, false, 'mission non arrêtée avant le clic');
    assert.equal(app.engine.permissions.size, 1, 'carte toujours présente');
    const [entry] = app.engine.permissions.values();
    app.engine.decide(entry.id, 'allow');
    assert.equal((await pending).approved, true);
    writeFileSync(goFile, 'go');
    await done;
    const step = app.engine.workflows.steps(run.id).find((s) => s.step_id === 'envoi');
    assert.equal(step.state, 'succeeded', JSON.stringify(step));
    // Le contrôle de mission reste suspendu et repris une fois, comme avant.
    assert.deepEqual(pauses, { suspended: 1, resumed: 1 });
  } finally {
    await app.close();
  }
});

// Une permission ACP ne porte pas `actionClass` (le SDK ACP ne transmet que les champs du schéma) :
// seule la carte de la passerelle attend le clic du propriétaire, d'où ce chemin seul ci-dessus.
test('A10 : après le clic, la garde de l’étape reprend (un outil muet est encore coupé)', async () => {
  const { executeWorkflow } = await import('../packages/orchestrator/workflow-run.js');
  const { app, run, plan, control, pauses } = setup({});
  try {
    const done = executeWorkflow(app.engine, run, plan, control);
    done.catch(() => {});
    await waitFor(
      () =>
        app.store
          .events(run.id)
          .some((e) => e.type === 'agent' && e.data.toolCallId === 'FICTIF-compose'),
      'outil de l’étape observé',
    );
    const scope = [...app.engine.attemptTokens.values()].find((s) => s.runId === run.id);
    const pending = app.engine.gatewayApproval(run.id, scope.token, {
      capability: 'browser.click',
      actionClass: 'send',
      element: { text: 'Envoyer FICTIF' },
    });
    await waitFor(() => app.engine.permissions.size === 1, 'carte d’envoi posée');
    await new Promise((r) => setTimeout(r, 600)); // > délais de l'étape : rien ne coupe avant le clic
    const before = app.store.events(run.id).length;
    const [entry] = app.engine.permissions.values();
    assert.ok(entry, 'carte toujours présente avant le clic');
    app.engine.decide(entry.id, 'allow');
    assert.equal((await pending).approved, true);
    // L'outil reste muet (pas de fichier go) : la garde reprise le coupe après ses délais.
    const stops = ['tool_stalled', 'agent_silent'];
    await waitFor(
      () =>
        app.store
          .events(run.id)
          .slice(before)
          .some((e) => stops.includes(e.type)),
      'garde reprise après le clic',
    );
    await waitFor(() => control.abort.signal.aborted, 'mission arrêtée par la garde reprise');
    await done.catch(() => {});
    assert.deepEqual(pauses, { suspended: 1, resumed: 1 });
  } finally {
    await app.close();
  }
});
