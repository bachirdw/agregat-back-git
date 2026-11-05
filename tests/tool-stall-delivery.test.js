// stall-01 (E49) : la garde « outil figé » s'arme à la remise de l'appel à la plateforme (décision
// de permission ACP ou entrée dans la passerelle MCP), pas à l'ouverture ACP du tool_call : un
// agent qui compose encore le texte d'un long rapport n'est pas un outil figé. Horloge simulée :
// aucune attente réelle de 120 s. Faux agent ACP : tests/fixtures/fake-acp.js (composeTool).
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';

const FAKE = resolve('tests/fixtures/fake-acp.js');
const REPORT = 'reports/001-entreprise-fictive-2026-11-05.md';
const STALL_MESSAGE = 'Outil sans mise à jour depuis 120 s ; relancer.';

// Horloge simulée des gardes du moteur : un délai ne s'écoule que lorsque le test l'avance.
function fakeTimers() {
  let now = 0;
  let seq = 0;
  const due = new Map();
  return {
    setTimeout(fn, ms) {
      const id = ++seq;
      due.set(id, { at: now + Math.max(0, Number(ms) || 0), fn });
      return id;
    },
    clearTimeout(id) {
      due.delete(id);
    },
    now: () => now,
    tick(ms) {
      const until = now + ms;
      for (;;) {
        const next = [...due.entries()]
          .filter(([, timer]) => timer.at <= until)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        due.delete(next[0]);
        next[1].fn();
      }
      now = until;
    },
  };
}

// Mission career-ops en mode propriétaire (accords automatiques, événements ACP conservés), faux
// agent configuré par `fake` (FAKE_ACP). wait : la composition attend goFile.
async function startMission(fake, { wait = false } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'tool-stall-remise-FICTIF-')));
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode: true });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  const timers = fakeTimers();
  app.engine.timers = timers;
  const files = {
    goFile: join(root, 'go-FICTIF'),
    doneFile: join(root, 'remis-FICTIF'),
    cancelFile: join(root, 'cancel-observed'),
  };
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'Rédige le rapport FICTIF de cette offre',
    model: '',
    mode: 'agent',
    budgetCents: 0,
    workspace: 'career-ops',
  };
  app.store.create({ ...run, prompt: 'Mission privée dans l’espace de candidature' });
  const plan = {
    simulated: false,
    skills: [],
    skillSelection: [],
    agent: {
      id: 'fixture',
      name: 'Agent FICTIF',
      command: process.execPath,
      args: [FAKE],
      env: [],
      safeModes: [],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({
          ...fake,
          ...(fake.composeTool
            ? {
                composeTool: {
                  path: REPORT,
                  doneFile: files.doneFile,
                  ...(wait ? { goFile: files.goFile } : {}),
                  ...fake.composeTool,
                },
              }
            : {}),
          cancelFile: files.cancelFile,
          loadSession: true,
        }),
      },
    },
    pack: { id: 'career-ops', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  const done = app.engine.execute(run, plan, control, null);
  const events = () => app.store.events(run.id);
  const types = () => events().map((event) => event.type);
  const toolUpdate = (predicate) =>
    events().find((event) => event.type === 'agent' && predicate(event.data));
  const waitFor = async (check, ms = 10000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const value = check();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(
      'Attente dépassée : ' + JSON.stringify({ run: app.store.get(run.id), types: types() }),
    );
  };
  // Fermer d'abord : une mission encore active (test rouge) est arrêtée par le moteur.
  const finish = async () => {
    await app.close();
    await done.catch(() => {});
    rmSync(root, { recursive: true, force: true });
  };
  return {
    app,
    run,
    control,
    done,
    files,
    timers,
    events,
    types,
    toolUpdate,
    waitFor,
    finish,
    root,
  };
}

const composed = (m) =>
  m.toolUpdate(
    (d) =>
      d.sessionUpdate === 'tool_call_update' &&
      d.toolCallId === 'FICTIF-compose' &&
      d.rawInput?.path === REPORT &&
      d.rawInput.text === undefined,
  );

test('(a) appel en composition : 150 s simulées sans mise à jour, puis remise (accord + passerelle) → aucun tool_stalled, la mission continue', async () => {
  const m = await startMission({ composeTool: { mcp: true } }, { wait: true });
  try {
    await m.waitFor(() => composed(m));
    m.timers.tick(150000);
    assert.ok(
      !m.types().includes('tool_stalled'),
      'garde armée à l’ouverture du tool_call : ' + JSON.stringify(m.types()),
    );
    assert.equal(m.control.abort.signal.aborted, false);
    assert.equal(m.app.store.get(m.run.id).state, 'running');
    writeFileSync(m.files.goFile, 'go');
    await m.done;
    const done = m.app.store.get(m.run.id);
    assert.equal(done.state, 'completed', done.error);
    assert.ok(!m.types().includes('tool_stalled'));
    assert.ok(m.types().includes('permission_auto'), JSON.stringify(m.types()));
    assert.ok(existsSync(join(m.root, REPORT)), 'rapport FICTIF écrit par la passerelle');
    assert.equal(existsSync(m.files.cancelFile), false, 'aucun session/cancel');
    const armed = m.events().filter((event) => event.type === 'tool_armed');
    assert.deepEqual(
      armed.map((event) => [event.data.toolCallId, event.data.via]),
      [['FICTIF-compose', 'permission']],
    );
  } finally {
    await m.finish();
  }
});

test('(a bis) remise par la passerelle seule (aucun accord demandé) : 150 s de composition puis entrée dans le handler MCP → armé via gateway, mission terminée', async () => {
  const m = await startMission({ composeTool: { mcp: true, permission: false } }, { wait: true });
  try {
    await m.waitFor(() => composed(m));
    m.timers.tick(150000);
    assert.ok(!m.types().includes('tool_stalled'), JSON.stringify(m.types()));
    writeFileSync(m.files.goFile, 'go');
    await m.done;
    const done = m.app.store.get(m.run.id);
    assert.equal(done.state, 'completed', done.error);
    assert.ok(!m.types().includes('permission_auto'));
    const armed = m.events().filter((event) => event.type === 'tool_armed');
    assert.deepEqual(
      armed.map((event) => [event.data.toolCallId, event.data.via]),
      [['FICTIF-compose', 'gateway']],
    );
  } finally {
    await m.finish();
  }
});

test('(b) appel remis (accord) puis sans réponse : tool_stalled à 120 s simulées, mission failed, message inchangé', async () => {
  const m = await startMission({ composeTool: { stall: true } });
  try {
    await m.waitFor(() => m.types().includes('permission_auto'));
    await m.waitFor(() => existsSync(m.files.doneFile));
    m.timers.tick(119999);
    assert.ok(!m.types().includes('tool_stalled'), 'coupé avant 120 s');
    m.timers.tick(1);
    await m.waitFor(() => m.types().includes('tool_stalled'));
    await m.done;
    const done = m.app.store.get(m.run.id);
    assert.equal(done.state, 'failed');
    assert.equal(done.error, STALL_MESSAGE);
    assert.equal(done.resumable, true);
    assert.match(done.result.summary, /Cause : Outil sans mise à jour depuis 120 s ; relancer\./);
    const stalled = m.events().find((event) => event.type === 'tool_stalled');
    assert.deepEqual(stalled.data, { toolCallId: 'FICTIF-compose', afterMs: 120000 });
    assert.ok(existsSync(m.files.cancelFile), 'session/cancel livré au faux agent');
  } finally {
    await m.finish();
  }
});

test('(b bis) appel remis à la passerelle (aucun accord) puis jamais clos par l’agent : tool_stalled à 120 s', async () => {
  const m = await startMission({ composeTool: { mcp: true, permission: false, stall: true } });
  try {
    await m.waitFor(() => m.types().includes('tool_armed'));
    // The gateway arms the call before running it: wait for its answer before advancing the clock.
    await m.waitFor(() => existsSync(m.files.doneFile));
    assert.ok(existsSync(join(m.root, REPORT)), 'la passerelle a bien reçu l’appel');
    m.timers.tick(119999);
    assert.ok(!m.types().includes('tool_stalled'));
    m.timers.tick(1);
    await m.waitFor(() => m.types().includes('tool_stalled'));
    await m.done;
    const done = m.app.store.get(m.run.id);
    assert.equal(done.state, 'failed');
    assert.equal(done.error, STALL_MESSAGE);
  } finally {
    await m.finish();
  }
});

test('(c) outil natif hors passerelle (in_progress, aucune remise observable) : règle inchangée, armé dès le tool_call', async () => {
  const m = await startMission({ stallTool: true, stallToolTitle: 'Searching the web' });
  try {
    await m.waitFor(() =>
      m.toolUpdate((d) => d.sessionUpdate === 'tool_call' && d.toolCallId === 'FICTIF-stalled'),
    );
    m.timers.tick(119999);
    assert.ok(!m.types().includes('tool_stalled'));
    m.timers.tick(1);
    await m.waitFor(() => m.types().includes('tool_stalled'));
    await m.done;
    const done = m.app.store.get(m.run.id);
    assert.equal(done.state, 'failed');
    assert.equal(done.error, 'Outil sans mise à jour depuis 120 s : Searching the web ; relancer.');
  } finally {
    await m.finish();
  }
});
