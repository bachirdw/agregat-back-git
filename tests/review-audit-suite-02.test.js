// review-audit-suite-02 : relecture d'A10 (mode workflow). Deux cartes d'envoi ouvertes en même
// temps dans la même étape DAG : le clic sur la première ne doit pas relancer la garde de l'étape
// tant que la seconde attend encore le propriétaire (la garde de l'étape, booléenne, n'était pas
// comptée). Faux agent ACP (tests/fixtures/fake-acp.js), aucune page ni envoi réel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';

const temporary = () => mkdtempSync(join(tmpdir(), 'relay-review-a10-'));

function setup() {
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
          composeTool: { path: 'rapport-FICTIF.md', permission: false, goFile },
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

test('A10 relu : deux cartes d’envoi dans une étape, la garde reste suspendue jusqu’au dernier clic', async () => {
  const { executeWorkflow } = await import('../packages/orchestrator/workflow-run.js');
  const { app, run, plan, control, pauses, goFile } = setup();
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
    const ask = (text) =>
      app.engine.gatewayApproval(run.id, scope.token, {
        capability: 'browser.click',
        actionClass: 'send',
        element: { text },
      });
    const first = ask('Envoyer FICTIF 1');
    const second = ask('Envoyer FICTIF 2');
    await waitFor(() => app.engine.permissions.size === 2, 'deux cartes posées');
    const [one] = app.engine.permissions.values();
    app.engine.decide(one.id, 'allow');
    assert.equal((await first).approved, true);
    await new Promise((r) => setTimeout(r, 1000)); // > délais d'outil et de silence de l'étape
    const types = app.store.events(run.id).map((e) => e.type);
    assert.ok(!types.includes('tool_stalled'), 'outil non coupé pendant la seconde carte');
    assert.ok(!types.includes('agent_silent'), 'silence non coupé pendant la seconde carte');
    assert.equal(control.abort.signal.aborted, false, 'mission non arrêtée avant le second clic');
    assert.equal(app.engine.permissions.size, 1, 'seconde carte toujours présente');
    const [two] = app.engine.permissions.values();
    app.engine.decide(two.id, 'allow');
    assert.equal((await second).approved, true);
    writeFileSync(goFile, 'go');
    await done;
    const step = app.engine.workflows.steps(run.id).find((s) => s.step_id === 'envoi');
    assert.equal(step.state, 'succeeded', JSON.stringify(step));
    assert.deepEqual(pauses, { suspended: 2, resumed: 2 });
  } finally {
    await app.close();
  }
});

// review-audit-suite-02 (2c relu, non-régression : déjà vert avant 044fefa, une navigation hors
// de la fenêtre du clic posait déjà la carte) : un formulaire posté par navigation vers un chemin
// de soumission, plus de 8 s après un clic `candidate`, attend toujours la carte avec la nouvelle
// règle. Contexte Playwright FICTIF, aucun Chrome lancé, carte refusée : rien ne part.
test('2c relu (non-régression) : navigation POST tardive vers un chemin de soumission → carte', async () => {
  const { CdpBrowser } = await import('../packages/browser-gateway/cdp.js');
  const { RunPolicy } = await import('../packages/policy-engine/run-policy.js');
  const PAGE = 'https://emplois.fictif.test/offre/1';
  let pageUrl = 'about:blank';
  const page = {
    url: () => pageUrl,
    isClosed: () => false,
    opener: async () => null,
    on() {},
    goto: async () => {},
  };
  let handler;
  const context = {
    pages: () => [page],
    on() {},
    browser: () => ({}),
    route: async (_pattern, h) => {
      handler = h;
    },
    routeWebSocket: async () => {},
    close: async () => {},
  };
  const provider = new CdpBrowser({
    launch: {},
    chromium: { launchPersistentContext: async () => context },
  });
  const policy = new RunPolicy({ ownerMode: true });
  const cards = [];
  try {
    await provider.prepare(policy, async (request) => {
      cards.push(request.args?.url);
      return false;
    });
    await provider.ensure(policy);
    pageUrl = PAGE;
    Object.assign(provider, {
      sendClick: true,
      clickKind: 'candidate',
      formStep: false,
      clickPage: 'https://emplois.fictif.test/offre/1',
      writeInProgress: false,
      lastClickEnd: Date.now() - 9000,
      cover: null,
      sendDecision: null,
    });
    let outcome = 'en attente';
    await handler({
      request: () => ({
        frame: () => ({ page: () => page, url: () => pageUrl }),
        method: () => 'POST',
        postData: () => 'fictif=1',
        url: () => 'https://emplois.fictif.test/api/applications/submit',
        resourceType: () => 'document',
        isNavigationRequest: () => true,
      }),
      continue: async () => {
        outcome = 'partie';
      },
      abort: async () => {
        outcome = 'bloquée';
      },
      fallback: async () => {
        outcome = 'fallback';
      },
    });
    assert.equal(outcome, 'bloquée');
    assert.equal(cards.length, 1);
  } finally {
    await provider.close().catch(() => {});
  }
});
