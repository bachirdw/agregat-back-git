import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { parseAgentResult, unreadQuestionOptions } from '../packages/orchestrator/result.js';
import { OWNER_QUESTION_RULE } from '../packages/orchestrator/owner-question-rule.js';
import { profiles } from '../packages/agent-runtime/profiles.js';
import { terminal } from '../packages/storage/index.js';

// questions-18-11 (E126, E127). Textes FICTIFS, aucune donnée personnelle. Aucun test ne dépend du
// nom d'un agent : la consigne est vérifiée sur tous les profils, le filet par l'agent factice.
const FAKE = resolve('tests/fixtures/fake-acp.js');
const FORMAT = '{"question":{"message":"…","options":["…","…"]}}';
const ASKING = 'Lettre FICTIVE prête en deux langues.\n\nDans quelle langue veux-tu la lettre ?';
const NOT_ASKING = 'Lettre FICTIVE écrite en anglais, enregistrée dans output.';
const LINE =
  'Question de l’agent non posée : l’agent a joint une question que la plateforme n’a pas pu lire ; elle n’a pas été posée au propriétaire.';

// ---- Contrôle de la réponse (packages/orchestrator/result.js) ----

test('E127 : forme de l’essai réel, question dans summary et choix sous une autre clé : réponse gardée', () => {
  const out = parseAgentResult(
    JSON.stringify({
      simulated: false,
      summary: ASKING,
      evidence: [],
      question: { choices: ['Anglais', 'Français'] },
    }),
  );
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.value, { simulated: false, summary: ASKING, evidence: [] });
  assert.deepEqual(out.unreadQuestion, { options: ['Anglais', 'Français'] });
});

test('question illisible : les choix sont la première liste de courtes chaînes, quel que soit le nom de sa clé', () => {
  assert.deepEqual(unreadQuestionOptions({ items: ['a', 'b'] }), ['a', 'b']);
  assert.deepEqual(unreadQuestionOptions({ titre: 'x', labels: [' a ', 'b'] }), ['a', 'b']);
  assert.deepEqual(unreadQuestionOptions(['oui', 'non']), ['oui', 'non']);
  assert.deepEqual(unreadQuestionOptions({ n: [1, 2], ok: ['c'] }), ['c']);
  // Hors des bornes d'une question (8 choix, 200 caractères), vide ou mauvais type : aucun choix.
  assert.deepEqual(
    unreadQuestionOptions({ choices: Array.from({ length: 9 }, (_, i) => `o${i}`) }),
    [],
  );
  assert.deepEqual(unreadQuestionOptions({ choices: ['x'.repeat(201)] }), []);
  assert.deepEqual(unreadQuestionOptions({ choices: ['a', ''] }), []);
  assert.deepEqual(unreadQuestionOptions({ choices: [{ label: 'a' }] }), []);
  assert.deepEqual(unreadQuestionOptions({ deep: { choices: ['a'] } }), []);
  assert.deepEqual(unreadQuestionOptions(5), []);
  assert.deepEqual(unreadQuestionOptions(true), []);
  assert.deepEqual(unreadQuestionOptions({}), []);
  // Exactement aux bornes : gardé.
  const eight = Array.from({ length: 8 }, (_, i) => `${i}`.padEnd(200, 'x'));
  assert.deepEqual(unreadQuestionOptions({ c: eight }), eight);
});

test('question illisible de tout type : la réponse est gardée et signalée', () => {
  const base = { simulated: false, summary: NOT_ASKING, evidence: ['FICTIF'] };
  for (const question of [5, true, ['a', 'b'], {}, { options: ['a'] }, { message: 7 }]) {
    const out = parseAgentResult(JSON.stringify({ ...base, question }));
    assert.equal(out.ok, true, JSON.stringify(question));
    assert.deepEqual(out.value, base);
    assert.ok(out.unreadQuestion, JSON.stringify(question));
  }
  // summary vide : la réponse n'est plus refusée pour autant (le Bilan dira la question non posée).
  const empty = parseAgentResult(
    JSON.stringify({ simulated: false, summary: '', evidence: [], question: { choices: ['a'] } }),
  );
  assert.equal(empty.ok, true);
  assert.equal(empty.value.summary, '');
  assert.deepEqual(empty.unreadQuestion, { options: ['a'] });
});

test('question null ou vide : rien à poser, rien à signaler ; bon format et simple chaîne inchangés', () => {
  const base = { simulated: false, summary: NOT_ASKING, evidence: [] };
  for (const question of [null, '', '   ']) {
    const out = parseAgentResult(JSON.stringify({ ...base, question }));
    assert.equal(out.ok, true, JSON.stringify(question));
    assert.deepEqual(out.value, base);
    assert.equal(out.unreadQuestion, undefined);
  }
  const good = parseAgentResult(
    JSON.stringify({ ...base, question: { message: 'Q FICTIVE ?', options: ['a', 'b'] } }),
  );
  assert.deepEqual(good.value.question, { message: 'Q FICTIVE ?', options: ['a', 'b'] });
  assert.equal(good.unreadQuestion, undefined);
  const text = parseAgentResult(JSON.stringify({ ...base, question: ' Q FICTIVE ? ' }));
  assert.deepEqual(text.value.question, { message: 'Q FICTIVE ?' });
  assert.equal(text.unreadQuestion, undefined);
  const none = parseAgentResult(JSON.stringify(base));
  assert.deepEqual(none.value, base);
  assert.equal(none.unreadQuestion, undefined);
});

// ---- Par le même chemin que l'agent réel : orchestrateur + agent ACP factice ----

async function mission(reply, { pack = { id: 'core', workflow: { steps: [] } } } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'question-mal-formee-FICTIF-')));
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'Écris la lettre FICTIVE et demande-moi la langue.',
    model: '',
    mode: 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    simulated: true,
    skills: [],
    skillSelection: [],
    agent: {
      id: 'fixture',
      command: process.execPath,
      args: [FAKE],
      env: [],
      safeModes: [],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({ proseQuestion: { reply }, callsFile: 'calls.json' }),
      },
    },
    pack,
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  const done = app.engine.execute(run, plan, control, null);
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const answer = async (body) => {
    const res = await fetch(`${base}/api/runs/${run.id}/answer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const row = () => app.store.get(run.id);
  const waitFor = async (check, ms = 8000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (check()) return;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('Attente dépassée : ' + JSON.stringify(row()));
  };
  const events = (type) => app.store.events(run.id).filter((event) => event.type === type);
  const calls = () => JSON.parse(readFileSync(join(root, 'calls.json'), 'utf8'));
  const finish = async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  };
  return { app, run, done, answer, row, waitFor, events, calls, finish };
}

test('E127 FICTIF : choix sous une autre clé et question dans summary → question ouverte, puis suite dans la même session', async () => {
  const m = await mission({
    simulated: false,
    summary: ASKING,
    evidence: [],
    question: { choices: ['Anglais', 'Français'] },
  });
  try {
    await m.waitFor(() => m.row().state === 'awaiting_owner');
    const asked = m.row().pendingQuestion;
    assert.equal(asked.kind, 'prose');
    assert.equal(asked.message, 'Dans quelle langue veux-tu la lettre ?');
    assert.deepEqual(asked.options, ['Anglais', 'Français']);
    assert.deepEqual(asked.requestedSchema.properties.reponse.examples, ['Anglais', 'Français']);
    assert.deepEqual(
      m.events('question_unreadable').map((event) => event.data),
      [{ asked: true, options: 2 }],
    );
    const res = await m.answer({ action: 'accept', content: { reponse: 'Anglais' } });
    assert.deepEqual(res, { status: 200, body: { ok: true } });
    await m.done;
    const done = m.row();
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.equal(done.sessionId, 'fake-session-1');
    assert.match(done.result.summary, /Réponse reçue : Anglais/);
    assert.match(done.result.summary, /Questions : 1 posée\(s\), 1 répondue\(s\)/);
    assert.ok(!done.result.summary.includes('non posée'), done.result.summary);
    const calls = m.calls();
    assert.equal(calls.filter((c) => c === 'session/prompt').length, 2);
    assert.equal(calls.filter((c) => c === 'session/new').length, 1);
    assert.ok(!calls.includes('session/load'));
  } finally {
    await m.finish();
  }
});

test('question illisible et summary sans question → completed, texte de l’agent gardé, ligne au Bilan, événement', async () => {
  const m = await mission({
    simulated: false,
    summary: NOT_ASKING,
    evidence: [],
    question: { choices: ['Anglais', 'Français'] },
  });
  try {
    await m.done;
    const done = m.row();
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.ok(!done.pendingQuestion);
    assert.ok(done.result.summary.startsWith(NOT_ASKING), done.result.summary);
    assert.equal(done.result.answer, NOT_ASKING);
    assert.ok(!/[{}]|"question"|choices/.test(done.result.summary), done.result.summary);
    assert.ok(done.result.summary.includes(LINE), done.result.summary);
    assert.ok(done.result.platformNotes.includes(LINE), JSON.stringify(done.result.platformNotes));
    assert.equal(m.events('question').length, 0);
    assert.equal(m.events('agent_output_rejected').length, 0);
    assert.deepEqual(
      m.events('question_unreadable').map((event) => event.data),
      [{ asked: false, options: 0 }],
    );
  } finally {
    await m.finish();
  }
});

test('question illisible et summary vide → completed, aucune donnée brute, la ligne de la plateforme seule', async () => {
  const m = await mission({ simulated: false, summary: '', evidence: [], question: 42 });
  try {
    await m.done;
    const done = m.row();
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.ok(!/[{}]|"question"/.test(done.result.summary), done.result.summary);
    assert.ok(done.result.summary.includes(LINE), done.result.summary);
    assert.equal(m.events('question_unreadable').length, 1);
  } finally {
    await m.finish();
  }
});

test('question en simple chaîne (11/11) : toujours posée', async () => {
  const m = await mission({
    simulated: false,
    summary: NOT_ASKING,
    evidence: [],
    question: 'Quelle langue FICTIVE ?',
  });
  try {
    await m.waitFor(() => m.row().state === 'awaiting_owner');
    assert.equal(m.row().pendingQuestion.message, 'Quelle langue FICTIVE ?');
    assert.equal(m.events('question_unreadable').length, 0);
    await m.answer({ action: 'accept', content: { reponse: 'Français' } });
    await m.done;
    assert.equal(m.row().state, 'completed');
    assert.match(m.row().result.summary, /Réponse reçue : Français/);
  } finally {
    await m.finish();
  }
});

test('question au bon format : posée avec ses choix, sans événement ni ligne nouvelle', async () => {
  const m = await mission({
    simulated: false,
    summary: '',
    evidence: [],
    question: { message: 'Quelle langue FICTIVE ?', options: ['Anglais', 'Français'] },
  });
  try {
    await m.waitFor(() => m.row().state === 'awaiting_owner');
    assert.deepEqual(m.row().pendingQuestion.options, ['Anglais', 'Français']);
    await m.answer({ action: 'accept', content: { reponse: 'Anglais' } });
    await m.done;
    assert.equal(m.row().state, 'completed');
    assert.equal(m.events('question_unreadable').length, 0);
    assert.ok(!m.row().result.summary.includes('non posée'));
  } finally {
    await m.finish();
  }
});

test('réponse sans champ question : completed, sans événement ni ligne nouvelle', async () => {
  const m = await mission({ simulated: false, summary: NOT_ASKING, evidence: [] });
  try {
    await m.done;
    const done = m.row();
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.ok(done.result.summary.startsWith(NOT_ASKING));
    assert.equal(m.events('question').length, 0);
    assert.equal(m.events('question_unreadable').length, 0);
    assert.ok(!done.result.summary.includes('non posée'));
  } finally {
    await m.finish();
  }
});

// ---- Pack career-ops et consigne envoyée, par le chemin réel create() → plan() → prompt ----

function careerFixture(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'question-consigne-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root, roots: [root] });
  return { root, career };
}
// The plan's agent takes the identity (id, name) of `profile` ; the process is the fake agent.
async function sent(t, input, { ownerMode = false, profile = null, fake = {} } = {}) {
  const { root, career } = careerFixture(t);
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  reviewCareer(career, app.skills);
  const promptFile = join(root, 'sent-prompt.json');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      ...(profile ? { id: profile.id, name: profile.name } : {}),
      command: process.execPath,
      args: [FAKE],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({
          promptFile,
          result: { simulated: true, summary: 'Réponse FICTIVE', evidence: [] },
          ...fake,
        }),
      },
    };
    return plan;
  };
  const run = await app.engine.create({ agent: 'fixture', ...input });
  for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
    await new Promise((done) => setTimeout(done, 20));
  return {
    ...JSON.parse(readFileSync(promptFile, 'utf8')),
    row: app.store.get(run.id),
    events: app.store.events(run.id),
  };
}

const CONSIGNES = [
  ['career-ops', { prompt: 'Écris une lettre FICTIVE', pack: 'career-ops' }, {}],
  [
    'mission navigateur',
    { prompt: 'Ouvre https://jobs.example.test et résume la page', pack: 'core' },
    { ownerMode: true },
  ],
];
for (const [name, input, options] of CONSIGNES)
  test(`consigne commune (${name}) : phrase et format, identiques pour tous les profils d’agents`, async (t) => {
    const seen = new Set();
    for (const profile of profiles) {
      const { instructions } = await sent(t, input, { ...options, profile });
      assert.equal(instructions.split(OWNER_QUESTION_RULE).length - 1, 1, profile.id);
      assert.ok(instructions.includes(FORMAT), profile.id);
      assert.match(instructions, /pose ta question par l’une de ces deux voies/);
      seen.add(instructions);
    }
    assert.equal(seen.size, 1, 'consigne différente selon l’agent');
  });

test('consigne commune : définie dans un seul fichier du code', async () => {
  const { readdirSync } = await import('node:fs');
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(?:js|cjs)$/.test(entry.name) && readFileSync(path, 'utf8').includes(FORMAT))
        found.push(path);
    }
  };
  for (const dir of ['packages', 'apps', 'domain-packs']) walk(resolve(dir));
  assert.deepEqual(found, [resolve('packages/orchestrator/owner-question-rule.js')]);
});

test('career-ops FICTIF : question illisible sans question dans summary → texte de l’agent, pas de JSON brut, ligne au Bilan', async (t) => {
  const { row, events } = await sent(
    t,
    { prompt: 'Écris une lettre FICTIVE', pack: 'career-ops' },
    {
      ownerMode: true,
      fake: {
        proseQuestion: {
          reply: {
            simulated: false,
            summary: NOT_ASKING,
            evidence: [],
            question: { choices: ['Anglais', 'Français'] },
          },
        },
      },
    },
  );
  assert.equal(row.state, 'completed', JSON.stringify(row));
  assert.ok(row.result.summary.startsWith(NOT_ASKING), row.result.summary);
  assert.ok(!row.result.summary.includes('"question"'), row.result.summary);
  assert.ok(!row.result.summary.includes('choices'), row.result.summary);
  assert.ok(row.result.summary.includes(LINE), row.result.summary);
  assert.equal(events.filter((event) => event.type === 'question_unreadable').length, 1);
  assert.equal(events.filter((event) => event.type === 'agent_output_rejected').length, 0);
});
