// review-questions-18-11 : relecture du filet des questions mal formées (E127). Textes FICTIFS,
// aucune donnée personnelle, aucun modèle, aucun réseau. Aucun test ne dépend du nom d'un agent :
// tout passe par l'agent ACP factice (tests/fixtures/fake-acp.js), le même chemin que l'agent réel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { parseAgentResult, unreadQuestionLine } from '../packages/orchestrator/result.js';
import { OWNER_QUESTION_RULE } from '../packages/orchestrator/owner-question-rule.js';
import { DOUBT_RULE } from '../packages/orchestrator/doubt-rule.js';
import { questionsOf } from '../packages/orchestrator/resume-history.js';
import { terminal } from '../packages/storage/index.js';

const FAKE = resolve('tests/fixtures/fake-acp.js');
const QUESTION = 'Dans quelle langue veux-tu la lettre ?';
const ASKING = `Lettre FICTIVE prête en deux langues.\n\n${QUESTION}`;
const NOT_ASKING = 'Lettre FICTIVE écrite en anglais, enregistrée dans output.';
const LINE = unreadQuestionLine();
const CHOICES = { choices: ['Anglais', 'Français'] };
const reply = (summary, question) => ({ simulated: false, summary, evidence: [], question });

async function mission(fake, { pack = { id: 'core', workflow: { steps: [] } } } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'review-questions-FICTIF-')));
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  const goFile = join(root, 'go');
  const promptsFile = join(root, 'prompts.json');
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
        FAKE_ACP: JSON.stringify({
          callsFile: join(root, 'calls.json'),
          promptsFile,
          ...fake,
          ...(fake.holdTurn ? { holdTurn: { goFile } } : {}),
        }),
      },
    },
    pack,
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  const done = app.engine.execute(run, plan, control, null);
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (path, body) => {
    const res = await fetch(`${base}/api/runs/${run.id}/${path}`, {
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
  const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
  const finish = async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  };
  return {
    app,
    run,
    control,
    done,
    post,
    row,
    waitFor,
    events,
    finish,
    go: () => writeFileSync(goFile, 'go'),
    calls: () => read(join(root, 'calls.json')),
    turnKinds: () =>
      read(promptsFile).map((p) => {
        try {
          return JSON.parse(p).platform?.turnKind ?? null;
        } catch {
          return null;
        }
      }),
  };
}
const unreadable = (m) => m.events('question_unreadable').map((event) => event.data);

// ---- Défaut 1 : au-delà de MAX_QUESTIONS, l'événement disait asked:true ----

test('question illisible au-delà de 10 questions : la 11e n’est pas posée et l’événement le dit', async () => {
  const m = await mission({ proseQuestion: { always: true, reply: reply(ASKING, CHOICES) } });
  try {
    for (let i = 1; i <= 10; i++) {
      await m.waitFor(
        () => m.row().state === 'awaiting_owner' && m.events('question').length === i,
      );
      const res = await m.post('answer', { action: 'accept', content: { reponse: 'Anglais' } });
      assert.equal(res.status, 200);
    }
    await m.done;
    const done = m.row();
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.equal(m.events('question').length, 10);
    const seen = unreadable(m);
    assert.equal(seen.length, 11);
    assert.deepEqual(seen.slice(0, 10), Array(10).fill({ asked: true, options: 2 }));
    assert.deepEqual(seen[10], { asked: false, options: 0 });
    assert.ok(
      done.result.summary.includes(
        `Questions trop nombreuses (10 au plus par mission) ; non posée : ${QUESTION}`,
      ),
      done.result.summary,
    );
    assert.match(done.result.summary, /Questions : 10 posée\(s\), 10 répondue\(s\)/);
    // Reprise : les questions posées par le chemin illisible sont celles du point de reprise.
    const history = questionsOf(m.app.store.events(m.run.id));
    assert.equal(history.list.length, 10);
    assert.ok(history.list.every((q) => q.question === QUESTION));
    assert.ok(history.list.every((q) => q.outcome !== 'restée sans réponse'));
  } finally {
    await m.finish();
  }
});

// ---- Défaut 2 : un objet {"question":…} mal formé écrit à part faisait refuser la réponse ----

test('contrat puis objet {"question"} mal formé à part, summary sans question : réponse gardée, ligne au Bilan', async () => {
  const m = await mission({ proseQuestion: { apart: true, reply: reply(NOT_ASKING, CHOICES) } });
  try {
    await m.done;
    const done = m.row();
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.ok(done.result.summary.startsWith(NOT_ASKING), done.result.summary);
    assert.ok(!/[{}]|"question"|choices/.test(done.result.summary), done.result.summary);
    assert.ok(done.result.platformNotes.includes(LINE), JSON.stringify(done.result));
    assert.equal(m.events('agent_output_rejected').length, 0);
    assert.deepEqual(unreadable(m), [{ asked: false, options: 0 }]);
  } finally {
    await m.finish();
  }
});

test('contrat puis objet {"question"} mal formé à part, summary qui demande : question ouverte, suite dans la même session', async () => {
  const m = await mission({ proseQuestion: { apart: true, reply: reply(ASKING, CHOICES) } });
  try {
    await m.waitFor(() => m.row().state === 'awaiting_owner');
    assert.equal(m.row().pendingQuestion.message, QUESTION);
    assert.deepEqual(m.row().pendingQuestion.options, ['Anglais', 'Français']);
    await m.post('answer', { action: 'accept', content: { reponse: 'Français' } });
    await m.done;
    const done = m.row();
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.match(done.result.summary, /Réponse reçue : Français/);
    assert.ok(!done.result.summary.includes('non posée'), done.result.summary);
    assert.equal(m.calls().filter((c) => c === 'session/new').length, 1);
    assert.deepEqual(unreadable(m), [{ asked: true, options: 2 }]);
  } finally {
    await m.finish();
  }
});

test('prose puis objet {"question"} seul et mal formé (bare) : réponse gardée sans JSON brut, ligne au Bilan', async () => {
  const m = await mission({ proseQuestion: { bare: true, reply: reply('', CHOICES) } });
  try {
    await m.done;
    const done = m.row();
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.ok(done.result.summary.startsWith('Il me manque une précision FICTIVE.'));
    assert.ok(!/[{}]|"question"|choices/.test(done.result.summary), done.result.summary);
    assert.ok(done.result.summary.includes(LINE), done.result.summary);
    assert.equal(m.events('agent_output_rejected').length, 0);
    assert.equal(unreadable(m).length, 1);
  } finally {
    await m.finish();
  }
});

test('contrôle : la citation d’un formulaire {"question","answer"} à part reste refusée', () => {
  const contract = JSON.stringify(reply(NOT_ASKING));
  const quoted = parseAgentResult(`${contract}\n{"question":"Âge FICTIF ?","answer":"5"}`);
  assert.equal(quoted.ok, false);
  const twoKeys = parseAgentResult(`${contract}\n{"question":{"choices":["a"]},"note":"x"}`);
  assert.equal(twoKeys.ok, false);
});

// ---- Message valide, options hors bornes (décision laissée au propriétaire : comportement figé) ----

const NINE = Array.from({ length: 9 }, (_, i) => `Choix FICTIF ${i}`);
test('message valide et 9 options, summary qui demande : la question vient de summary, sans choix', async () => {
  const m = await mission({
    proseQuestion: { reply: reply(ASKING, { message: 'Autre question FICTIVE ?', options: NINE }) },
  });
  try {
    await m.waitFor(() => m.row().state === 'awaiting_owner');
    assert.equal(m.row().pendingQuestion.message, QUESTION);
    assert.ok(!m.row().pendingQuestion.options?.length);
    assert.deepEqual(unreadable(m), [{ asked: true, options: 0 }]);
    await m.post('answer', { action: 'accept', content: { reponse: 'Anglais' } });
    await m.done;
    assert.equal(m.row().state, 'completed');
  } finally {
    await m.finish();
  }
});

test('message valide et 9 options, summary vide : non posée, ligne au Bilan (état actuel, à trancher)', async () => {
  const m = await mission({
    proseQuestion: { reply: reply('', { message: 'Autre question FICTIVE ?', options: NINE }) },
  });
  try {
    await m.done;
    const done = m.row();
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.ok(done.result.summary.includes(LINE), done.result.summary);
    assert.ok(!done.result.summary.includes('Autre question FICTIVE'), done.result.summary);
    assert.deepEqual(unreadable(m), [{ asked: false, options: 0 }]);
  } finally {
    await m.finish();
  }
});

// ---- Plusieurs tours ----

test('question illisible au 1er tour puis au bon format au 2e : un seul événement, aucune ligne « non posée »', async () => {
  const m = await mission({
    proseQuestion: {
      replies: [
        reply(ASKING, CHOICES),
        reply('', { message: 'Quel ton FICTIF ?', options: ['sobre', 'vif'] }),
      ],
    },
  });
  try {
    await m.waitFor(() => m.row().state === 'awaiting_owner');
    assert.equal(m.row().pendingQuestion.message, QUESTION);
    await m.post('answer', { action: 'accept', content: { reponse: 'Anglais' } });
    await m.waitFor(() => m.row().state === 'awaiting_owner' && m.events('question').length === 2);
    assert.equal(m.row().pendingQuestion.message, 'Quel ton FICTIF ?');
    await m.post('answer', { action: 'accept', content: { reponse: 'sobre' } });
    await m.done;
    const done = m.row();
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.match(done.result.summary, /Questions : 2 posée\(s\), 2 répondue\(s\)/);
    assert.ok(!done.result.summary.includes('non posée'), done.result.summary);
    assert.deepEqual(unreadable(m), [{ asked: true, options: 2 }]);
  } finally {
    await m.finish();
  }
});

test('summary qui demande et champ question au bon format : le champ structuré l’emporte', async () => {
  const m = await mission({
    proseQuestion: { reply: reply(ASKING, { message: 'Quel ton FICTIF ?', options: ['a', 'b'] }) },
  });
  try {
    await m.waitFor(() => m.row().state === 'awaiting_owner');
    assert.equal(m.row().pendingQuestion.message, 'Quel ton FICTIF ?');
    assert.deepEqual(m.row().pendingQuestion.options, ['a', 'b']);
    assert.equal(unreadable(m).length, 0);
    await m.post('answer', { action: 'accept', content: { reponse: 'a' } });
    await m.done;
  } finally {
    await m.finish();
  }
});

test('question illisible au tour de travail puis au tour du message du propriétaire : « (2 fois) » au Bilan', async () => {
  const m = await mission({
    holdTurn: true,
    proseQuestion: { reply: reply(NOT_ASKING, CHOICES) },
    ownerTurn: { result: reply('Message FICTIF pris en compte.', { items: ['x'] }) },
  });
  try {
    await m.waitFor(
      () => m.control.turnActive && (m.control.lastUpdateAt ?? 0) >= m.control.turnStartedAt,
    );
    const said = await m.post('message', { text: 'Ajoute un paragraphe FICTIF.' });
    assert.equal(said.status, 202);
    m.go();
    await m.done;
    const done = m.row();
    assert.equal(done.state, 'completed', JSON.stringify(done));
    assert.deepEqual(m.turnKinds(), [null, 'owner_message']);
    assert.ok(done.result.summary.includes(unreadQuestionLine(2)), done.result.summary);
    assert.ok(done.result.summary.includes('(2 fois)'));
    assert.deepEqual(unreadable(m), [
      { asked: false, options: 0 },
      { asked: false, options: 0 },
    ]);
  } finally {
    await m.finish();
  }
});

// ---- Défaut 3 : étape agent d'un workflow DAG ----

test('étape de workflow DAG avec un champ question illisible : étape gardée, événement et ligne', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'review-questions-dag-FICTIF-')));
  const app = createApp({ dataDir: join(root, 'platform') });
  try {
    const run = {
      id: randomUUID(),
      state: 'queued',
      cwd: root,
      prompt: 'Mission FICTIVE',
      model: '',
      mode: 'workflow',
      agent: 'fixture',
      pack: 'core',
      skills: [],
      browser: 'fixture',
      budgetCents: 0,
    };
    app.store.create(run);
    const plan = {
      simulated: true,
      agent: {
        id: 'fixture',
        name: 'Agent FICTIF',
        simulated: true,
        command: process.execPath,
        args: [FAKE],
        env: [],
        safeModes: [],
        fixedEnv: {
          FAKE_ACP: JSON.stringify({
            result: { simulated: true, summary: 'Étape FICTIVE faite.', evidence: [], question: 7 },
          }),
        },
      },
      pack: { id: 'core' },
      skills: [],
      dag: {
        id: 'fictif',
        title: 'FICTIF',
        steps: [
          { id: 'action', title: 'Action FICTIVE', kind: 'agent', prompt: 'FICTIF' },
          { id: 'report', title: 'Rapport FICTIF', kind: 'aggregate', dependsOn: ['action'] },
        ],
      },
    };
    const control = { abort: new AbortController() };
    app.engine.active.set(run.id, control);
    await app.engine.execute(run, plan, control, null);
    const row = app.store.get(run.id);
    assert.equal(row.state, 'completed', JSON.stringify(row));
    const events = app.store.events(run.id);
    assert.equal(events.filter((e) => e.type === 'agent_output_rejected').length, 0);
    assert.deepEqual(
      events.filter((e) => e.type === 'question_unreadable').map((e) => e.data),
      [{ stepId: 'action', asked: false, options: 0 }],
    );
    assert.ok(JSON.stringify(row.result).includes(LINE), JSON.stringify(row.result));
  } finally {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
});

// ---- Pack career-ops : l'objet seul mal formé n'affiche pas le texte brut du tour ----

test('career-ops FICTIF : prose puis objet {"question"} seul et mal formé → pas de JSON brut, ligne au Bilan', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'review-questions-career-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode: true });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  reviewCareer(career, app.skills);
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [FAKE],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({ proseQuestion: { bare: true, reply: reply('', CHOICES) } }),
      },
    };
    return plan;
  };
  const run = await app.engine.create({
    agent: 'fixture',
    prompt: 'Écris une lettre FICTIVE',
    pack: 'career-ops',
  });
  for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
    await new Promise((done) => setTimeout(done, 20));
  const row = app.store.get(run.id);
  const events = app.store.events(run.id);
  assert.equal(row.state, 'completed', JSON.stringify(row));
  assert.ok(!/[{}]|"question"|choices/.test(row.result.summary), row.result.summary);
  assert.ok(row.result.summary.includes(LINE), row.result.summary);
  assert.equal(events.filter((e) => e.type === 'agent_output_rejected').length, 0);
  assert.equal(events.filter((e) => e.type === 'question_unreadable').length, 1);
});

// ---- Défaut 9 : la règle de doute renvoie à une règle qui porte ce nom ----

test('la phrase commune porte le nom que la règle de doute lui donne', () => {
  assert.match(DOUBT_RULE, /la règle des questions/);
  assert.ok(OWNER_QUESTION_RULE.startsWith('Règle des questions : '), OWNER_QUESTION_RULE);
});

// precision-18-11 (E130) : la précision suit la phrase des deux voies et précède « Dans les deux cas » ;
// elle ne nomme aucun outil d’agent et n’interdit rien.
test('phrase commune : la précision sur l’outil qui n’attend pas, à sa place', () => {
  const precision =
    'Un outil de question qui rend la main tout de suite, sans attendre la réponse, n’est pas un formulaire de question : si c’est le seul que tu as, pose ta question par le champ JSON question.';
  const at = OWNER_QUESTION_RULE.indexOf(precision);
  assert.ok(at > 0, OWNER_QUESTION_RULE);
  assert.ok(at > OWNER_QUESTION_RULE.indexOf('(message obligatoire, options facultatives).'));
  assert.ok(at < OWNER_QUESTION_RULE.indexOf('Dans les deux cas'));
  assert.equal(OWNER_QUESTION_RULE.split(precision).length - 1, 1);
  assert.ok(!/_async|request_user_input|codex/i.test(OWNER_QUESTION_RULE), OWNER_QUESTION_RULE);
});
