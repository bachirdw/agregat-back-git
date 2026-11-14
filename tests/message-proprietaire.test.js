// orienter-14-11 : messages du propriétaire pendant une mission (« orienter l'IA »), avec le faux
// agent ACP. Aucun modèle, aucun navigateur, aucun relais : tout est FICTIF.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { formatOwnerMessageLines } from '../packages/orchestrator/index.js';

const FAKE = resolve('tests/fixtures/fake-acp.js');
const RESULT = { simulated: true, summary: 'Travail FICTIF terminé', evidence: [] };

async function startMission(cfg = {}, { prompt, workspace, browserWorkflow, ownerMode } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orienter-FICTIF-')));
  const files = {
    goFile: join(root, 'go'),
    ownerGo: join(root, 'owner-go'),
    steerFile: join(root, 'steer.json'),
    promptsFile: join(root, 'prompts.json'),
    callsFile: join(root, 'calls.json'),
  };
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode: !!ownerMode });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: prompt ?? 'Prépare un résumé FICTIF de cette offre.',
    model: '',
    mode: 'agent',
    budgetCents: 0,
    ...(workspace ? { workspace } : {}),
  };
  app.store.create(
    workspace === 'career-ops'
      ? { ...run, prompt: 'Mission privée dans l’espace de candidature' }
      : run,
  );
  const plan = {
    simulated: true,
    skills: [],
    skillSelection: [],
    browserWorkflow: !!browserWorkflow,
    agent: {
      id: 'fixture',
      command: process.execPath,
      args: [FAKE],
      env: [],
      safeModes: [],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({
          result: RESULT,
          steerFile: files.steerFile,
          promptsFile: files.promptsFile,
          callsFile: files.callsFile,
          ...cfg,
          ...(cfg.holdTurn ? { holdTurn: { goFile: files.goFile, ...cfg.holdTurn } } : {}),
          ...(cfg.ownerTurn?.hold
            ? { ownerTurn: { ...cfg.ownerTurn, holdFile: files.ownerGo } }
            : {}),
        }),
      },
    },
    pack: { id: 'core', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  const done = app.engine.execute(run, plan, control, null);
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const api = async (path, body) => {
    const res = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  const waitFor = async (check, ms = 8000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const value = check();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('Attente dépassée : ' + JSON.stringify(app.store.get(run.id)));
  };
  // The turn is running and the agent has shown it (thought chunk).
  const turnShown = () =>
    waitFor(() => control.turnActive && (control.lastUpdateAt ?? 0) >= control.turnStartedAt);
  const release = () => writeFileSync(files.goFile, 'go');
  const read = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null);
  const messageEvents = () =>
    app.store
      .events(run.id)
      .filter((e) => e.type === 'owner_message')
      .map((e) => e.data);
  const say = (text) => api(`/api/runs/${run.id}/message`, { text });
  const finish = async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  };
  return {
    app,
    run,
    files,
    control,
    done,
    api,
    waitFor,
    turnShown,
    release,
    read,
    messageEvents,
    say,
    finish,
  };
}
const count = (list, value) => list.filter((x) => x === value).length;

test('1. agent sans steering : message pendant le tour → tour de plus dans la même session, remis en fin de tour', async () => {
  const m = await startMission({ holdTurn: {} });
  try {
    await m.turnShown();
    const res = await m.say('Ajoute aussi le salaire FICTIF.');
    assert.equal(res.status, 202);
    assert.equal(res.body.state, 'pending');
    assert.match(res.body.id, /^[a-f0-9-]{36}$/);
    m.release();
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    const calls = m.read(m.files.callsFile);
    assert.equal(count(calls, 'session/prompt'), 2);
    assert.equal(count(calls, 'session/new'), 1);
    assert.ok(!calls.includes('session/load'));
    assert.ok(!calls.includes('_session/steering'), 'aucun steering sans annonce');
    const prompts = m.read(m.files.promptsFile);
    const extra = JSON.parse(prompts[1]);
    assert.equal(extra.platform.turnKind, 'owner_message');
    assert.match(
      extra.ownerMessage,
      /Message du propriétaire pendant la mission \(\d\d:\d\d\) : Ajoute aussi le salaire FICTIF\./,
    );
    assert.match(extra.instructions, /tiens-en compte pour la suite de la même mission/);
    const events = m.messageEvents();
    assert.deepEqual(
      events.map((e) => e.state),
      ['pending', 'delivered'],
    );
    const last = events.at(-1);
    assert.equal(last.via, 'turn_end');
    assert.equal(last.id, res.body.id);
    assert.ok(last.deliveredAt && last.at);
    assert.equal(last.text, 'Ajoute aussi le salaire FICTIF.');
    assert.match(row.result.summary, /Message reçu FICTIF/);
    const line = row.result.platformNotes.find((l) => l.startsWith('Message du propriétaire'));
    assert.match(
      line,
      /^Message du propriétaire reçu à \d\d:\d\d, remis à \d\d:\d\d \(en fin de tour\)\.$/,
    );
    // After the mission : 409.
    const late = await m.say('Encore une chose');
    assert.equal(late.status, 409);
  } finally {
    await m.finish();
  }
});

test('2. agent avec steering : _session/steering reçu avec le texte, aucun tour de plus, remis pendant le tour', async () => {
  const m = await startMission({ steering: 'injected', holdTurn: { releaseOnSteer: true } });
  try {
    await m.turnShown();
    const res = await m.say('Concentre-toi sur la ville FICTIVE.');
    assert.equal(res.status, 202);
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    const steers = m.read(m.files.steerFile);
    assert.equal(steers.length, 1);
    assert.equal(steers[0].sessionId, 'fake-session-1');
    assert.deepEqual(steers[0]._meta, { steering: { idleBehavior: 'promptRequired' } });
    assert.equal(steers[0].prompt[0].type, 'text');
    assert.match(
      steers[0].prompt[0].text,
      /^Message du propriétaire pendant la mission : Concentre-toi sur la ville FICTIVE\.\n\nTiens-en compte pour la suite de la même mission/,
    );
    const calls = m.read(m.files.callsFile);
    assert.equal(count(calls, 'session/prompt'), 1);
    assert.equal(count(calls, 'session/new'), 1);
    const last = m.messageEvents().at(-1);
    assert.equal(last.state, 'delivered');
    assert.equal(last.via, 'steering');
    assert.match(row.result.summary, /orienté : Message du propriétaire pendant la mission/);
    assert.ok(
      row.result.platformNotes.some((l) => /remis à \d\d:\d\d \(pendant le tour\)\.$/.test(l)),
      JSON.stringify(row.result.platformNotes),
    );
  } finally {
    await m.finish();
  }
});

test('3. réponse promptRequired : repli sur la fin de tour', async () => {
  const m = await startMission({ steering: 'promptRequired', holdTurn: {} });
  try {
    await m.turnShown();
    const res = await m.say('Vérifie la date FICTIVE.');
    assert.equal(res.status, 202);
    assert.equal(res.body.state, 'pending');
    await m.waitFor(() => m.read(m.files.steerFile)?.length === 1);
    m.release();
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    assert.equal(m.read(m.files.steerFile).length, 1, 'un seul essai de steering');
    const calls = m.read(m.files.callsFile);
    assert.equal(count(calls, 'session/prompt'), 2);
    assert.equal(count(calls, 'session/new'), 1);
    const last = m.messageEvents().at(-1);
    assert.equal(last.state, 'delivered');
    assert.equal(last.via, 'turn_end');
  } finally {
    await m.finish();
  }
});

test('3 bis. steering en échec (erreur de l’adaptateur) : repli sur la fin de tour, mission intacte', async () => {
  const m = await startMission({ steering: 'error', holdTurn: {} });
  try {
    await m.turnShown();
    await m.say('Message FICTIF malgré l’erreur.');
    await m.waitFor(() => m.read(m.files.steerFile)?.length === 1);
    m.release();
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    assert.equal(m.messageEvents().at(-1).via, 'turn_end');
  } finally {
    await m.finish();
  }
});

test('4. question ouverte : le message ne la résout pas et part avec le tour de réponse', async () => {
  const m = await startMission({ steering: 'injected', proseQuestion: true });
  try {
    await m.waitFor(() => m.app.store.get(m.run.id).state === 'awaiting_owner');
    const res = await m.say('Envoie FICTIF plutôt demain.');
    assert.equal(res.status, 202);
    assert.equal(res.body.state, 'pending');
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'awaiting_owner', 'la question reste ouverte');
    assert.ok(row.pendingQuestion);
    assert.ok(m.app.engine.openQuestion(m.run.id));
    assert.equal(m.read(m.files.steerFile), null, 'aucun steering hors tour');
    const answered = await m.api(`/api/runs/${m.run.id}/answer`, {
      action: 'accept',
      content: { reponse: 'oui' },
    });
    assert.equal(answered.status, 200);
    await m.done;
    const done = m.app.store.get(m.run.id);
    assert.equal(done.state, 'completed', JSON.stringify(done));
    const prompts = m.read(m.files.promptsFile);
    assert.equal(prompts.length, 2);
    const turn = JSON.parse(prompts[1]);
    assert.equal(turn.platform.turnKind, 'answer');
    assert.deepEqual(turn.answer, { reponse: 'oui' }, 'la réponse est celle du propriétaire seule');
    assert.match(
      turn.ownerMessage,
      /Message du propriétaire pendant la mission \(\d\d:\d\d\) : Envoie FICTIF plutôt demain\./,
    );
    assert.match(turn.instructions, /n’est pas la réponse à ta question/);
    const last = m.messageEvents().at(-1);
    assert.equal(last.state, 'delivered');
    assert.equal(last.via, 'with_answer');
    assert.ok(done.result.platformNotes.some((l) => /\(avec la réponse\)\.$/.test(l)));
    assert.match(done.result.summary, /Questions : 1 posée\(s\), 1 répondue\(s\)/);
  } finally {
    await m.finish();
  }
});

test('5. carte d’envoi ouverte : aucun steering, la carte reste à décider, le message part ensuite', async () => {
  const m = await startMission({ steering: 'injected', holdTurn: {} });
  try {
    await m.turnShown();
    m.app.engine.approvalTokens.set(m.run.id, 'jeton-FICTIF');
    const approval = m.app.engine.gatewayApproval(m.run.id, 'jeton-FICTIF', {
      actionClass: 'send',
      capability: 'browser.click',
      element: { text: 'Envoyer FICTIF' },
    });
    await m.waitFor(() => m.app.engine.pendingPermission(m.run.id));
    const res = await m.say('envoie la candidature FICTIVE');
    assert.equal(res.status, 202);
    assert.equal(res.body.state, 'pending');
    assert.equal(m.read(m.files.steerFile), null, 'aucun steering pendant la carte');
    const pending = m.app.engine.pendingPermission(m.run.id);
    assert.ok(pending, 'la carte reste à décider');
    assert.equal(m.app.store.get(m.run.id).state, 'waiting_permission');
    m.app.engine.decide(pending.id, 'deny');
    assert.deepEqual(await approval, { approved: false });
    m.release();
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    assert.equal(m.read(m.files.steerFile), null, 'toujours aucun steering');
    const last = m.messageEvents().at(-1);
    assert.equal(last.state, 'delivered');
    assert.equal(last.via, 'turn_end');
    assert.equal(count(m.read(m.files.callsFile), 'session/prompt'), 2);
    assert.match(row.result.summary, /Envoi par la plateforme : aucun approuvé\./);
  } finally {
    await m.finish();
  }
});

test('6. annulation avant la remise : non remis, ligne au Bilan', async () => {
  const m = await startMission({ holdTurn: {} });
  try {
    await m.turnShown();
    await m.say('Message FICTIF jamais remis.');
    m.app.engine.cancel(m.run.id);
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'cancelled');
    const events = m.messageEvents();
    assert.deepEqual(
      events.map((e) => e.state),
      ['pending', 'undelivered'],
    );
    assert.equal(events.at(-1).via, null);
    assert.equal(events.at(-1).deliveredAt, null);
    assert.match(row.result.summary, /Message du propriétaire reçu à \d\d:\d\d, non remis\./);
    assert.equal((await m.say('trop tard')).status, 409);
  } finally {
    await m.finish();
  }
});

test('6 bis. échec de l’agent avant la remise : non remis', async () => {
  const m = await startMission({ holdTurn: {}, errorText: 'Erreur FICTIVE de l’agent' });
  try {
    await m.turnShown();
    await m.say('Message FICTIF avant l’échec.');
    m.release();
    await m.done;
    assert.equal(m.app.store.get(m.run.id).state, 'failed');
    assert.equal(m.messageEvents().at(-1).state, 'undelivered');
  } finally {
    await m.finish();
  }
});

test('7. mission terminée ou workflow : 409 ; texte vide : 400', async () => {
  const m = await startMission({ holdTurn: {} });
  try {
    await m.turnShown();
    assert.equal((await m.say('   ')).status, 400);
    assert.equal((await m.say('')).status, 400);
    assert.equal((await m.api(`/api/runs/${m.run.id}/message`, {})).status, 400);
    assert.equal((await m.say('x'.repeat(8001))).status, 400);
    m.release();
    await m.done;
    const late = await m.say('Mission finie FICTIVE');
    assert.equal(late.status, 409);
    assert.match(late.body.error, /terminée/);
    const workflow = {
      id: randomUUID(),
      state: 'running',
      cwd: m.run.cwd,
      prompt: 'Workflow FICTIF',
      mode: 'workflow',
    };
    m.app.store.create(workflow);
    const res = await m.api(`/api/runs/${workflow.id}/message`, { text: 'oriente' });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /workflow/);
    // Without the platform header : refused like the neighbour routes.
    const port = m.app.server.address().port;
    const bare = await fetch(`http://127.0.0.1:${port}/api/runs/${m.run.id}/message`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'sans en-tête' }),
    });
    assert.equal(bare.status, 403);
    assert.equal((await m.api(`/api/runs/${randomUUID()}/message`, { text: 'x' })).status, 404);
  } finally {
    await m.finish();
  }
});

test('8. mission privée hors mode propriétaire : le texte n’est pas en base, il reste dans l’espace', async () => {
  const secret = 'Texte privé FICTIF 7f3a';
  const m = await startMission({ holdTurn: {} }, { workspace: 'career-ops' });
  try {
    assert.equal(m.app.engine.ownerMode, false);
    await m.turnShown();
    const res = await m.say(secret);
    assert.equal(res.status, 202);
    m.release();
    await m.done;
    const events = m.messageEvents();
    assert.ok(events.length >= 2);
    for (const e of events) assert.equal(e.text, undefined);
    const stored = JSON.stringify(
      m.app.store.events(m.run.id).filter((e) => e.type === 'owner_message'),
    );
    assert.ok(!stored.includes(secret));
    const file = JSON.parse(
      readFileSync(join(m.run.cwd, `relay/runs/${m.run.id}-messages.json`), 'utf8'),
    );
    assert.equal(file[0].text, secret);
    assert.equal(file[0].id, res.body.id);
  } finally {
    await m.finish();
  }
});

test('9. un « envoie » ajouté par message est vu par la détection d’ordre d’envoi, sans aucun envoi', async () => {
  const m = await startMission({ holdTurn: {} }, { browserWorkflow: true });
  try {
    await m.turnShown();
    await m.say('Oui, envoie la candidature FICTIVE.');
    m.release();
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    // The prompt alone orders nothing : the send line comes from the message.
    assert.match(row.result.summary, /Envoi par la plateforme : aucun approuvé\./);
    const types = m.app.store.events(m.run.id).map((e) => e.type);
    assert.ok(!types.includes('permission'), 'aucune carte');
    assert.ok(!types.includes('send_auto'), 'aucun envoi');
  } finally {
    await m.finish();
  }
  // Same mission without the message : no send line.
  const n = await startMission({}, { browserWorkflow: true });
  try {
    await n.done;
    const row = n.app.store.get(n.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    assert.doesNotMatch(row.result.summary, /Envoi par la plateforme/);
  } finally {
    await n.finish();
  }
});

test('10. deux messages à la suite : ordre gardé, une ligne de Bilan chacun', async () => {
  const m = await startMission({ holdTurn: {} });
  try {
    await m.turnShown();
    const first = await m.say('Premier message FICTIF.');
    const second = await m.say('Second message FICTIF.');
    m.release();
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    const prompts = m.read(m.files.promptsFile);
    assert.equal(prompts.length, 2, 'un seul tour de plus pour les deux');
    const extra = JSON.parse(prompts[1]).ownerMessage;
    assert.ok(extra.indexOf('Premier message FICTIF.') < extra.indexOf('Second message FICTIF.'));
    const delivered = m.messageEvents().filter((e) => e.state === 'delivered');
    assert.deepEqual(
      delivered.map((e) => e.id),
      [first.body.id, second.body.id],
    );
    const lines = row.result.platformNotes.filter((l) => l.startsWith('Message du propriétaire'));
    assert.equal(lines.length, 2);
  } finally {
    await m.finish();
  }
});

test('10 bis. deux messages orientés : ordre gardé dans le tour', async () => {
  const m = await startMission({ steering: 'injected', holdTurn: {} });
  try {
    await m.turnShown();
    await m.say('Orientation A FICTIVE.');
    await m.say('Orientation B FICTIVE.');
    await m.waitFor(() => m.read(m.files.steerFile)?.length === 2);
    m.release();
    await m.done;
    const steers = m.read(m.files.steerFile).map((s) => s.prompt[0].text);
    assert.match(steers[0], /Orientation A/);
    assert.match(steers[1], /Orientation B/);
    assert.equal(count(m.read(m.files.callsFile), 'session/prompt'), 1);
    assert.deepEqual(
      m
        .messageEvents()
        .filter((e) => e.state === 'delivered')
        .map((e) => e.via),
      ['steering', 'steering'],
    );
  } finally {
    await m.finish();
  }
});

test('codex startedNewTurn : tour détaché arrêté, plus de steering, message remis en fin de tour', async () => {
  const m = await startMission({ steering: 'startedNewTurn', holdTurn: {} });
  try {
    await m.turnShown();
    await m.say('Message FICTIF arrivé trop tard.');
    await m.waitFor(() => m.control.steerUnsafe);
    await m.say('Second message FICTIF.');
    m.release();
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    assert.equal(m.read(m.files.steerFile).length, 1, 'plus aucun steering après startedNewTurn');
    const calls = m.read(m.files.callsFile);
    assert.ok(calls.includes('session/cancel'), 'le tour détaché est arrêté');
    assert.equal(count(calls, 'session/prompt'), 2);
    assert.deepEqual(
      m
        .messageEvents()
        .filter((e) => e.state === 'delivered')
        .map((e) => e.via),
      ['turn_end', 'turn_end'],
    );
  } finally {
    await m.finish();
  }
});

test('Bilan : lignes bornées quand les messages sont nombreux', () => {
  const at = new Date().toISOString();
  const list = Array.from({ length: 13 }, (_, i) => ({
    at,
    state: i % 2 ? 'undelivered' : 'delivered',
    via: 'turn_end',
    deliveredAt: at,
  }));
  const lines = formatOwnerMessageLines(list);
  assert.equal(lines.length, 11);
  assert.match(
    lines.at(-1),
    /^… et 3 autre\(s\) message\(s\) du propriétaire \(remis : 2, non remis : 1\)\.$/,
  );
});

// review-orienter-14-11 : cas ajoutés par la relecture indépendante.
const ownerLines = (row) =>
  (row.result?.platformNotes ?? []).filter((l) => l.startsWith('Message du propriétaire'));

test('R1. aucun message : un seul tour, aucun steering même annoncé, aucune ligne ni événement', async () => {
  const m = await startMission({ steering: 'injected' });
  try {
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    const calls = m.read(m.files.callsFile);
    assert.equal(count(calls, 'session/prompt'), 1);
    assert.ok(!calls.includes('_session/steering'));
    assert.equal(m.messageEvents().length, 0);
    assert.doesNotMatch(row.result.summary, /Message du propriétaire/);
    assert.equal(ownerLines(row).length, 0);
    assert.doesNotMatch(m.read(m.files.promptsFile)[0], /ownerMessage|owner_message/);
    assert.equal((await m.say('après coup')).status, 409);
  } finally {
    await m.finish();
  }
});

test('R2. question posée par l’agent pendant un tour owner_message : traitée comme toute question', async () => {
  const m = await startMission({
    holdTurn: {},
    ownerTurn: {
      result: {
        simulated: true,
        summary: '',
        evidence: [],
        question: { message: 'Quelle ville FICTIVE ?', options: ['Lyon', 'Lille'] },
      },
    },
  });
  try {
    await m.turnShown();
    await m.say('Change de ville FICTIVE.');
    m.release();
    await m.waitFor(() => m.app.store.get(m.run.id).state === 'awaiting_owner');
    assert.match(m.app.store.get(m.run.id).pendingQuestion.message, /Quelle ville FICTIVE/);
    const answered = await m.api(`/api/runs/${m.run.id}/answer`, {
      action: 'accept',
      content: { reponse: 'Lyon' },
    });
    assert.equal(answered.status, 200);
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    const prompts = m.read(m.files.promptsFile).map((p) => {
      try {
        return JSON.parse(p).platform?.turnKind ?? null;
      } catch {
        return null;
      }
    });
    assert.deepEqual(prompts, [null, 'owner_message', 'answer']);
    // The final answer is the last turn's (the answer turn), not the owner_message turn's.
    assert.match(row.result.summary, /^Travail FICTIF terminé/);
    assert.match(row.result.summary, /Questions : 1 posée\(s\), 1 répondue\(s\)/);
    assert.equal(m.messageEvents().at(-1).via, 'turn_end');
    assert.equal(ownerLines(row).length, 1);
  } finally {
    await m.finish();
  }
});

test('R3. message pendant une question, puis question refusée : non remis, dit au Bilan', async () => {
  const m = await startMission({ proseQuestion: true });
  try {
    await m.waitFor(() => m.app.store.get(m.run.id).state === 'awaiting_owner');
    assert.equal((await m.say('Message FICTIF avant le refus.')).status, 202);
    const declined = await m.api(`/api/runs/${m.run.id}/answer`, { action: 'decline' });
    assert.equal(declined.status, 200);
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    assert.equal(
      count(m.read(m.files.callsFile), 'session/prompt'),
      1,
      'aucun tour après le refus',
    );
    assert.deepEqual(
      m.messageEvents().map((e) => e.state),
      ['pending', 'undelivered'],
    );
    assert.match(row.result.summary, /Question refusée par le propriétaire/);
    assert.equal(ownerLines(row).length, 1);
    assert.match(ownerLines(row)[0], /^Message du propriétaire reçu à \d\d:\d\d, non remis\.$/);
  } finally {
    await m.finish();
  }
});

test('R4. annulation pendant le tour owner_message : message remis (envoyé), mission annulée', async () => {
  const m = await startMission({ holdTurn: {}, ownerTurn: { hold: true } });
  try {
    await m.turnShown();
    await m.say('Message FICTIF remis puis annulé.');
    m.release();
    await m.waitFor(() => m.messageEvents().some((e) => e.state === 'delivered'));
    await m.waitFor(() => m.control.turnActive);
    m.app.engine.cancel(m.run.id);
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'cancelled');
    assert.deepEqual(
      m.messageEvents().map((e) => e.state),
      ['pending', 'delivered'],
      'aucun événement de plus après la remise',
    );
    assert.match(row.result.summary, /remis à \d\d:\d\d \(en fin de tour\)\./);
  } finally {
    await m.finish();
  }
});

test('R5. échec de l’agent pendant le tour owner_message : mission en échec, message remis', async () => {
  const m = await startMission({ holdTurn: {}, ownerTurn: { error: 'Erreur FICTIVE du tour' } });
  try {
    await m.turnShown();
    await m.say('Message FICTIF avant l’erreur.');
    m.release();
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'failed', JSON.stringify(row));
    assert.match(row.error, /Erreur FICTIVE du tour/);
    assert.equal(m.messageEvents().at(-1).state, 'delivered');
    assert.match(row.result.summary, /remis à \d\d:\d\d \(en fin de tour\)\.\n- Cause : /);
  } finally {
    await m.finish();
  }
});

test('R6. plafond : 20 tours owner_message au plus, les messages suivants non remis', async () => {
  const m = await startMission({ holdTurn: {}, ownerTurn: { delayMs: 60 } });
  try {
    await m.turnShown();
    assert.equal((await m.say('Message FICTIF 0')).status, 202);
    m.release();
    let i = 1;
    let refused = null;
    while (!refused) {
      const res = await m.say(`Message FICTIF ${i++}`);
      if (res.status !== 202) refused = res;
      else await new Promise((r) => setTimeout(r, 10));
    }
    assert.equal(refused.status, 409);
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    const kinds = m.read(m.files.promptsFile).filter((p) => /"owner_message"/.test(p));
    assert.equal(kinds.length, 20);
    const last = new Map();
    for (const e of m.messageEvents()) last.set(e.id, e.state);
    const states = [...last.values()];
    assert.ok(states.every((s) => s === 'delivered' || s === 'undelivered'));
    assert.ok(states.includes('undelivered'), 'les messages après le 20e tour ne sont pas remis');
    assert.equal(states.at(-1), 'undelivered');
    // Bilan : 10 lines at most plus the remainder line, counts true.
    const lines = row.result.platformNotes.filter((l) =>
      /^(?:Message du propriétaire|… et \d+ autre)/.test(l),
    );
    assert.equal(lines.length, Math.min(states.length, 10) + (states.length > 10 ? 1 : 0));
    if (states.length > 10) {
      const rest = states.slice(10);
      const delivered = rest.filter((s) => s === 'delivered').length;
      assert.equal(
        lines.at(-1),
        `… et ${rest.length} autre(s) message(s) du propriétaire (remis : ${delivered}, non remis : ${rest.length - delivered}).`,
      );
    }
  } finally {
    await m.finish();
  }
});

test('R7. steering sans réponse de l’adaptateur : 202 sans attendre, runtime intact, remis en fin de tour', async () => {
  const m = await startMission({ steering: 'hang', holdTurn: {} });
  try {
    await m.turnShown();
    const t0 = Date.now();
    const res = await m.say('Message FICTIF à un adaptateur muet.');
    assert.equal(res.status, 202);
    assert.equal(res.body.state, 'pending');
    assert.ok(Date.now() - t0 < 3000, 'la route n’attend que 1,5 s');
    // Another route answers meanwhile : the server is not blocked.
    assert.equal((await m.api(`/api/runs/${m.run.id}`)).status, 200);
    m.release();
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    assert.equal(m.messageEvents().at(-1).via, 'turn_end');
    assert.equal(count(m.read(m.files.callsFile), 'session/prompt'), 2);
  } finally {
    await m.finish();
  }
});

test('R8. codex startedNewTurn : le tour owner_message part après les dernières mises à jour du tour détaché', async () => {
  const m = await startMission({
    steering: 'startedNewTurn',
    holdTurn: {},
    detachedUpdates: { count: 8, everyMs: 150, afterTurn: true },
  });
  try {
    await m.turnShown();
    await m.say('Message FICTIF arrivé en fin de tour.');
    await m.waitFor(() => m.read(m.files.steerFile)?.length === 1);
    m.release();
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    const calls = m.read(m.files.callsFile);
    const lastDetached = calls.lastIndexOf('detached-update');
    const ownerPrompt = calls.lastIndexOf('session/prompt');
    assert.ok(lastDetached >= 0, JSON.stringify(calls));
    // The calls file is written when the owner_message turn arrives : every update of the detached
    // turn came before it.
    assert.ok(lastDetached < ownerPrompt, `ordre : ${JSON.stringify(calls)}`);
    assert.equal(count(calls, 'detached-update'), 8, `ordre : ${JSON.stringify(calls)}`);
    assert.ok(m.control.steerUnsafe);
    assert.equal(m.messageEvents().at(-1).via, 'turn_end');
  } finally {
    await m.finish();
  }
});

test('R9. négation du prompt et ordre du message : chacun garde sa phrase', async () => {
  const prompt = 'Prépare la candidature FICTIVE mais n’envoie rien pour l’instant';
  const m = await startMission({ holdTurn: {} }, { prompt, browserWorkflow: true });
  try {
    await m.turnShown();
    await m.say('Postule maintenant');
    m.release();
    await m.done;
    const row = m.app.store.get(m.run.id);
    assert.match(row.result.summary, /Envoi par la plateforme : aucun approuvé\./);
  } finally {
    await m.finish();
  }
  const n = await startMission({}, { prompt, browserWorkflow: true });
  try {
    await n.done;
    assert.doesNotMatch(n.app.store.get(n.run.id).result.summary, /Envoi par la plateforme/);
  } finally {
    await n.finish();
  }
});

test('R10. mission privée en mode propriétaire : le texte est dans les événements', async () => {
  const m = await startMission({ holdTurn: {} }, { workspace: 'career-ops', ownerMode: true });
  try {
    await m.turnShown();
    await m.say('Texte FICTIF visible du propriétaire');
    m.release();
    await m.done;
    const events = m.messageEvents();
    assert.ok(events.length >= 2);
    for (const e of events) assert.equal(e.text, 'Texte FICTIF visible du propriétaire');
  } finally {
    await m.finish();
  }
});
