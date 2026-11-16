// review-reprise-16-11 : cas de la reprise que le sprint ne couvrait pas. Données FICTIVES, agent
// factice (tests/fixtures/fake-acp.js) lancé par le même chemin que l'agent réel quand il le faut.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { terminal } from '../packages/storage/index.js';
import { ownerMessagesOf, questionsOf } from '../packages/orchestrator/resume-history.js';

async function until(check, label, ms = 20000) {
  const end = Date.now() + ms;
  while (!check()) {
    assert.ok(Date.now() < end, `délai dépassé : ${label}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

async function platform(t, { ownerMode = true } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reprise-relecture-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  writeFileSync(join(root, 'cv.md'), 'CV FICTIF');
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), ownerMode, career });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  reviewCareer(career, app.skills);
  const files = join(root, 'platform-test');
  mkdirSync(files, { recursive: true });
  const next = { config: {} };
  const plan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const chosen = await plan(...args);
    chosen.agent = {
      ...chosen.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      fixedEnv: { ...chosen.agent.fixedEnv, FAKE_ACP: JSON.stringify(next.config) },
    };
    return chosen;
  };
  let count = 0;
  const mission = async (prompt, previous = null, { config = {}, answers = [] } = {}) => {
    const promptsFile = join(files, `prompts-${++count}.json`);
    next.config = { ...config, promptsFile };
    const created = await app.engine.create(
      { prompt, agent: 'fixture', pack: 'career-ops' },
      previous,
    );
    for (const [index, answer] of answers.entries()) {
      await until(
        () =>
          app.store.get(created.id).pendingQuestion ||
          terminal.has(app.store.get(created.id).state),
        `question ${index + 1}`,
      );
      app.engine.answer(created.id, answer);
    }
    await until(() => terminal.has(app.store.get(created.id).state), 'fin de la mission');
    const received = existsSync(promptsFile)
      ? JSON.parse(readFileSync(promptsFile, 'utf8')).map((text) => {
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        })
      : [];
    return { run: app.store.get(created.id), received };
  };
  return { app, mission };
}

// The form Claude's adapter builds from AskUserQuestion (claude-agent-acp, elicitation.js) : several
// questions in one form, the question's text in the description, a short header as the title, a
// free-text « Other » field after each question, a multi-select as an array of titled `anyOf`.
const CLAUDE_FORM = {
  message: 'Please answer the following questions.',
  requestedSchema: {
    type: 'object',
    properties: {
      question_0: {
        type: 'string',
        title: 'Ton',
        description: 'FICTIF quel ton pour la lettre ?',
        oneOf: [
          { const: 'Formel', title: 'Formel' },
          { const: 'Direct', title: 'Direct' },
        ],
      },
      question_0_custom: { type: 'string', title: 'Other', description: 'Type your own answer.' },
      question_1: {
        type: 'array',
        title: 'Pièces',
        description: 'FICTIF quelles pièces produire ?',
        items: {
          anyOf: [
            { const: 'cv', title: 'CV FICTIF' },
            { const: 'lettre', title: 'Lettre FICTIVE' },
            { const: 'mail', title: 'Mail FICTIF' },
          ],
        },
      },
      question_1_custom: { type: 'string', title: 'Other', description: 'Type your own answer.' },
    },
  },
};
const SECOND_FORM = {
  message: 'FICTIF dernière question ?',
  requestedSchema: {
    type: 'object',
    properties: { confirme: { type: 'boolean', title: 'Confirmer FICTIF' } },
  },
};

test('formulaire à la Claude : plusieurs questions par formulaire, réponse libre « Other », choix multiples, deux formulaires', async (t) => {
  const { mission } = await platform(t);
  const first = await mission('FICTIF prépare les pièces', null, {
    config: { askQuestions: [CLAUDE_FORM, SECOND_FORM], finalText: 'Brouillon FICTIF.' },
    answers: [
      {
        action: 'accept',
        content: {
          question_0_custom: 'texte libre FICTIF',
          question_1: ['cv', 'lettre'],
          question_1_custom: '',
        },
      },
      { action: 'accept', content: { confirme: false } },
    ],
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  const second = await mission('FICTIF c’est bon', first.run, {
    config: { finalText: 'Suite FICTIVE.', loadSession: true },
  });
  assert.equal(second.run.state, 'completed', second.run.error);
  const checkpoint = second.received[0].checkpoint;
  const [one, two] = checkpoint.history.executions[0].questions;
  assert.equal(one.outcome, 'répondue');
  // The question's own text is carried : without it, « Other » would answer nothing known.
  assert.deepEqual(one.fields, [
    { title: 'Ton', description: 'FICTIF quel ton pour la lettre ?', answer: null },
    { title: 'Other', description: 'Type your own answer.', answer: 'texte libre FICTIF' },
    {
      title: 'Pièces',
      description: 'FICTIF quelles pièces produire ?',
      answer: 'CV FICTIF, Lettre FICTIVE',
    },
    { title: 'Other', description: 'Type your own answer.', answer: null },
  ]);
  // A boolean « false » is an answer, not an empty field.
  assert.deepEqual(two.fields, [{ title: 'Confirmer FICTIF', answer: 'false' }]);
  assert.equal(
    checkpoint.provenance['history.executions[].questions[].fields[].description'],
    'déclaré par le modèle (question posée)',
  );
});

test('tour fini sans texte : mission en échec, sa cause passe en constat, aucune réponse du modèle', async (t) => {
  const { mission } = await platform(t);
  const first = await mission('FICTIF sans réponse', null, {
    // An empty askQuestions list takes the fake agent's scripted branch, which ends on an empty text.
    config: { askQuestions: [], finalText: '' },
  });
  assert.equal(first.run.state, 'failed');
  const second = await mission('FICTIF suite', first.run, { config: { finalText: 'Suite.' } });
  assert.equal(second.run.state, 'completed', second.run.error);
  const checkpoint = second.received[0].checkpoint;
  assert.equal(checkpoint.previousAnswer, '');
  assert.equal(checkpoint.history.executions[0].platform.error, first.run.error);
  assert.match(second.run.result.summary, /aucune réponse du modèle gardée/);
});

test('mission privée : la réponse du modèle passe sans les lignes du Bilan', async (t) => {
  const { mission } = await platform(t, { ownerMode: false });
  const first = await mission('FICTIF privé', null, {
    config: { askQuestions: [SECOND_FORM], finalText: 'Réponse privée FICTIVE.' },
    answers: [{ action: 'accept', content: { confirme: true } }],
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  const second = await mission('FICTIF suite privée', first.run, {
    config: { finalText: 'Suite.' },
  });
  const checkpoint = second.received[0].checkpoint;
  assert.equal(checkpoint.previousAnswer, 'Réponse privée FICTIVE.');
  assert.ok(
    checkpoint.history.executions[0].platform.notes.some((n) =>
      /Questions : 1 posée\(s\), 1 répondue\(s\)/.test(n),
    ),
  );
});

test('réponse du modèle : champ answer vide, ancien résultat, échec, interruption', async (t) => {
  const { app } = await platform(t);
  const make = (id, patch) =>
    app.store.create({
      id,
      createdAt: new Date().toISOString(),
      prompt: 'FICTIF',
      ...patch,
    });
  make('00000000-0000-4000-8000-0000000000a1', {
    state: 'completed',
    result: { summary: 'Bilan FICTIF', answer: '', platformNotes: ['Bilan FICTIF'] },
  });
  make('00000000-0000-4000-8000-0000000000a2', {
    state: 'completed',
    result: { summary: 'Ancienne réponse FICTIVE et son Bilan' },
  });
  make('00000000-0000-4000-8000-0000000000a3', {
    state: 'interrupted',
    error: 'Serveur arrêté FICTIF',
  });
  const answer = (id) => app.engine.checkpointFor(app.store.get(id)).previousAnswer;
  assert.equal(answer('00000000-0000-4000-8000-0000000000a1'), '');
  // Before 11/11 a result had no `answer` : the summary is passed on, as before this sprint.
  assert.equal(
    answer('00000000-0000-4000-8000-0000000000a2'),
    'Ancienne réponse FICTIVE et son Bilan',
  );
  const interrupted = app.engine.checkpointFor(
    app.store.get('00000000-0000-4000-8000-0000000000a3'),
  );
  assert.equal(interrupted.previousAnswer, '');
  assert.equal(interrupted.history.executions[0].platform.state, 'interrupted');
  assert.equal(interrupted.history.executions[0].platform.error, 'Serveur arrêté FICTIF');
});

test('chaîne : cycle dans resumedFrom et mission parente absente de la base', async (t) => {
  const { app } = await platform(t);
  const a = '00000000-0000-4000-8000-0000000000b1';
  const b = '00000000-0000-4000-8000-0000000000b2';
  const c = '00000000-0000-4000-8000-0000000000b3';
  for (const [id, parent, prompt] of [
    [a, b, 'FICTIF A'],
    [b, a, 'FICTIF B'],
    [c, '00000000-0000-4000-8000-0000000000ff', 'FICTIF C'],
  ])
    app.store.create({
      id,
      createdAt: new Date().toISOString(),
      state: 'completed',
      prompt,
      resumedFrom: parent,
      result: { summary: prompt, answer: prompt, platformNotes: [] },
    });
  const cycle = app.engine.checkpointFor(app.store.get(a));
  assert.deepEqual(
    cycle.history.executions.map((e) => e.runId),
    [b, a],
  );
  assert.equal(cycle.missionObjective, 'FICTIF B');
  const orphan = app.engine.checkpointFor(app.store.get(c));
  assert.deepEqual(
    orphan.history.executions.map((e) => e.runId),
    [c],
  );
  assert.equal(orphan.missionObjective, 'FICTIF C');
});

test('mission hors career-ops : la liste des fichiers vient de la fiche de la mission', async (t) => {
  const { app } = await platform(t);
  const id = '00000000-0000-4000-8000-0000000000c1';
  app.store.create({
    id,
    createdAt: new Date().toISOString(),
    state: 'completed',
    prompt: 'FICTIF hors career-ops',
    observedFiles: { files: ['notes-FICTIVES.md'], truncated: false },
    result: { summary: 'FICTIF', answer: 'FICTIF', platformNotes: [] },
  });
  const checkpoint = app.engine.checkpointFor(app.store.get(id));
  assert.deepEqual(checkpoint.history.executions[0].platform.filesChanged, {
    files: ['notes-FICTIVES.md'],
    complete: true,
  });
  assert.equal(checkpoint.history.executions[0].ownerMessage, 'FICTIF hors career-ops');
});

test('sort des questions : annulée, délai, nouvelle mission, sans réponse, champ facultatif vide', () => {
  const schema = {
    type: 'object',
    properties: {
      n: { type: 'number', title: 'Nombre' },
      libre: { type: 'string', title: 'Libre' },
      choix: { type: 'string', enum: ['a', 'b'], title: 'Choix' },
    },
  };
  const ask = (id) => ({
    type: 'question',
    data: { id, message: `FICTIF ${id}`, requestedSchema: schema },
  });
  const events = [
    ask('q1'),
    { type: 'answer', data: { id: 'q1', action: 'cancel' } },
    ask('q2'),
    { type: 'answer', data: { id: 'q2', action: 'expired' } },
    ask('q3'),
    { type: 'answer', data: { id: 'q3', action: 'superseded' } },
    ask('q4'),
    ask('q5'),
    { type: 'answer', data: { id: 'q5', action: 'accept', content: { n: 0, choix: 'b' } } },
  ];
  const { list } = questionsOf(events);
  assert.deepEqual(
    list.map((q) => q.outcome),
    [
      'close sans réponse',
      'restée sans réponse (délai écoulé)',
      'close sans réponse (nouvelle mission lancée)',
      'restée sans réponse',
      'répondue',
    ],
  );
  assert.deepEqual(list[4].fields, [
    { title: 'Nombre', answer: '0' },
    { title: 'Libre', answer: null },
    { title: 'Choix', answer: 'b' },
  ]);
  assert.ok(list.slice(0, 4).every((q) => q.fields.every((f) => f.answer === null)));
});

test('messages du propriétaire : remis, non remis, en attente, texte privé relu', () => {
  const events = [
    { type: 'owner_message', data: { id: 'm1', state: 'pending', text: 'FICTIF un' } },
    { type: 'owner_message', data: { id: 'm1', state: 'delivered', text: 'FICTIF un' } },
    { type: 'owner_message', data: { id: 'm2', state: 'pending' } },
    { type: 'owner_message', data: { id: 'm2', state: 'undelivered' } },
    { type: 'owner_message', data: { id: 'm3', state: 'pending', text: 'FICTIF trois' } },
  ];
  const { list } = ownerMessagesOf(events, new Map([['m2', 'FICTIF deux privé']]));
  assert.deepEqual(list, [
    { text: 'FICTIF un', state: 'remis à l’agent' },
    { text: 'FICTIF deux privé', state: 'non remis à l’agent (mission close avant)' },
    { text: 'FICTIF trois', state: 'en attente à la fin de la mission' },
  ]);
});
