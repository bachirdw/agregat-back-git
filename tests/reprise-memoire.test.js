// reprise-16-11 : la reprise d'une mission garde ce que le propriétaire a déjà dit et ce qui a été
// fait. Données FICTIVES, agent factice (tests/fixtures/fake-acp.js) lancé par le même chemin que
// l'agent réel (ACP, session neuve, point de reprise dans le prompt) : aucun modèle, aucun réseau.
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
import { checkpointLine, resumeCheckpoint } from '../packages/orchestrator/checkpoint.js';
import {
  HISTORY_LIMITS,
  boundedHistory,
  changedFiles,
  executionEntry,
} from '../packages/orchestrator/resume-history.js';

async function until(check, label, ms = 20000) {
  const end = Date.now() + ms;
  while (!check()) {
    assert.ok(Date.now() < end, `délai dépassé : ${label}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

// One question per form, as the agent's question tool asks them.
const form = (message, title, extra = {}) => ({
  message,
  requestedSchema: {
    type: 'object',
    properties: { choix: { type: 'string', title, ...extra } },
    required: ['choix'],
  },
});
const FOUR_FORMS = [
  form('FICTIF Q1 : ton de la lettre ?', 'Ton', {
    oneOf: [
      { const: 'formel', title: 'Formel FICTIF' },
      { const: 'direct', title: 'Direct FICTIF' },
    ],
  }),
  form('FICTIF Q2 : longueur ?', 'Longueur'),
  form('FICTIF Q3 : projet à citer ?', 'Projet'),
  form('FICTIF Q4 : langue ?', 'Langue'),
];
const FOUR_ANSWERS = ['formel', 'une page FICTIVE', 'projet FICTIF A', 'français FICTIF'];
const DRAFT =
  'BROUILLON_FICTIF de lettre pour l’offre FICTIVE 005.\n\nMadame, Monsieur, ' +
  'ceci est un texte FICTIF de test, sans aucune donnée réelle. '.repeat(4) +
  '\n\nFin du brouillon FICTIF ; j’attends ton accord avant le PDF.';

async function platform(t, { ownerMode = true } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reprise-memoire-FICTIF-')));
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
  // The fake agent's behaviour of the next mission, and where it writes the prompt it received.
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
  // A mission : `answers` answers its questions in order (an answer object, or a decline), `during`
  // runs while the first question is open.
  const mission = async (prompt, previous = null, { config = {}, answers = [], during } = {}) => {
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
      if (index === 0 && during) await during(created.id);
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
  return { app, root, mission };
}

const accept = (choix) => ({ action: 'accept', content: { choix } });

test('acceptation : quatre réponses et un brouillon, puis « c’est bon, génère » dans une session neuve', async (t) => {
  const { app, mission } = await platform(t);
  const first = await mission('FICTIF prépare une lettre pour l’offre FICTIVE 005', null, {
    config: {
      askQuestions: FOUR_FORMS,
      writeFiles: [{ path: 'output/cv-FICTIF.pdf', text: 'PDF FICTIF' }],
      finalText: DRAFT,
    },
    answers: FOUR_ANSWERS.map(accept),
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  assert.match(first.run.result.summary, /Questions : 4 posée\(s\), 4 répondue\(s\)/);

  const second = await mission('FICTIF c’est bon, génère', first.run, {
    // As Claude's adapter : it can load a session, the platform refuses the unqualified replay.
    config: { finalText: 'Lettre FICTIVE générée.', loadSession: true },
  });
  assert.equal(second.run.state, 'completed', second.run.error);
  // A new agent process and a new session (the fake agent numbers its sessions from 1 again).
  assert.ok(app.store.events(second.run.id).some((e) => e.type === 'session_reset'));
  // What the agent received through ACP, its very first prompt.
  const prompt = second.received[0];
  assert.equal(prompt.objective, 'FICTIF c’est bon, génère');
  const checkpoint = prompt.checkpoint;
  assert.equal(checkpoint.sourceRunId, first.run.id);
  assert.equal(checkpoint.missionObjective, 'FICTIF prépare une lettre pour l’offre FICTIVE 005');
  // The draft is there, as the model's declared answer, without the platform's Bilan lines.
  assert.match(checkpoint.previousAnswer, /BROUILLON_FICTIF/);
  assert.match(checkpoint.previousAnswer, /Fin du brouillon FICTIF/);
  assert.doesNotMatch(checkpoint.previousAnswer, /Questions : 4 posée/);
  assert.equal(checkpoint.provenance.previousAnswer, 'déclaré par le modèle');
  // The four questions and the four answers of the owner.
  const [entry] = checkpoint.history.executions;
  assert.equal(checkpoint.history.executions.length, 1);
  assert.equal(entry.runId, first.run.id);
  assert.equal(entry.ownerMessage, 'FICTIF prépare une lettre pour l’offre FICTIVE 005');
  assert.deepEqual(
    entry.questions.map((q) => q.question),
    FOUR_FORMS.map((f) => f.message),
  );
  assert.deepEqual(
    entry.questions.map((q) => q.outcome),
    ['répondue', 'répondue', 'répondue', 'répondue'],
  );
  assert.deepEqual(
    entry.questions.map((q) => [q.fields[0].title, q.fields[0].answer]),
    [
      ['Ton', 'Formel FICTIF'],
      ['Longueur', 'une page FICTIVE'],
      ['Projet', 'projet FICTIF A'],
      ['Langue', 'français FICTIF'],
    ],
  );
  assert.equal(
    checkpoint.provenance['history.executions[].questions[].fields[].answer'],
    'propriétaire',
  );
  // What the platform observed, under its own provenance.
  assert.equal(
    checkpoint.provenance['history.executions[].platform'],
    'constaté par la plateforme',
  );
  assert.equal(entry.platform.state, 'completed');
  assert.ok(entry.platform.filesChanged.files.includes('output/cv-FICTIF.pdf'));
  assert.ok(entry.platform.filesChanged.files.every((f) => !f.startsWith('relay/')));
  assert.ok(entry.platform.notes.some((n) => /Questions : 4 posée\(s\), 4 répondue\(s\)/.test(n)));
  assert.ok(entry.platform.notes.every((n) => !n.includes('BROUILLON_FICTIF')));
  // The instruction : the mission goes on, the answers stand, the prose stays unproven.
  assert.match(checkpoint.instructions, /poursuit la même mission/);
  assert.match(checkpoint.instructions, /ne les redemande pas/);
  assert.match(checkpoint.instructions, /n’est pas à refaire/);
  assert.match(checkpoint.instructions, /déclarée, non prouvée/);
  // The Bilan says what was sent, nothing more.
  assert.match(
    second.run.result.summary,
    /Point de reprise envoyé à l’agent : objectif de départ ; message précédent ; 1 exécution\(s\) précédente\(s\) : 4 question\(s\) dont 4 répondue\(s\), 0 message\(s\) du propriétaire en cours de mission, constats de la plateforme ; dernière réponse du modèle \(déclarée, non prouvée\)\./,
  );
  assert.match(
    second.run.result.summary,
    /reprise exacte non qualifiée ; session neuve depuis un point de reprise/,
  );
});

test('chaîne de deux reprises : chaque exécution garde ses réponses et les messages remis', async (t) => {
  const { app, mission } = await platform(t);
  const first = await mission('FICTIF objectif de départ', null, {
    config: { askQuestions: FOUR_FORMS.slice(0, 2), finalText: 'Premier tour FICTIF.' },
    answers: [accept('direct'), accept('courte FICTIVE')],
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  const second = await mission('FICTIF précision du propriétaire', first.run, {
    config: { askQuestions: [FOUR_FORMS[2]], finalText: 'Deuxième tour FICTIF.' },
    answers: [accept('projet FICTIF B')],
    // A message of the owner while the question is open : delivered at the end of the turn.
    during: (id) => app.engine.message(id, 'FICTIF message en cours de mission'),
  });
  assert.equal(second.run.state, 'completed', second.run.error);
  const third = await mission('FICTIF troisième message', second.run, {
    config: { finalText: 'Troisième tour FICTIF.' },
  });
  assert.equal(third.run.state, 'completed', third.run.error);
  const checkpoint = third.received[0].checkpoint;
  assert.equal(checkpoint.missionObjective, 'FICTIF objectif de départ');
  assert.equal(checkpoint.previousOwnerMessage, 'FICTIF précision du propriétaire');
  const [one, two] = checkpoint.history.executions;
  assert.equal(checkpoint.history.executions.length, 2);
  assert.equal(checkpoint.history.earlierExecutionsOmitted, undefined);
  assert.deepEqual([one.runId, two.runId], [first.run.id, second.run.id]);
  assert.deepEqual(
    one.questions.map((q) => q.fields[0].answer),
    ['Direct FICTIF', 'courte FICTIVE'],
  );
  assert.deepEqual(
    two.questions.map((q) => q.fields[0].answer),
    ['projet FICTIF B'],
  );
  assert.equal(two.ownerMessage, 'FICTIF précision du propriétaire');
  assert.deepEqual(two.ownerMessages, [
    { text: 'FICTIF message en cours de mission', state: 'remis à l’agent' },
  ]);
  assert.equal(checkpoint.provenance['history.executions[].ownerMessages'], 'propriétaire');
  assert.match(
    third.run.result.summary,
    /2 exécution\(s\) précédente\(s\) : 3 question\(s\) dont 3 répondue\(s\), 1 message\(s\) du propriétaire en cours de mission/,
  );
});

test('mission sans question, puis question refusée : dites telles quelles', async (t) => {
  const { mission } = await platform(t);
  const first = await mission('FICTIF sans question', null, {
    config: { finalText: 'Réponse FICTIVE sans question.' },
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  const second = await mission('FICTIF suite', first.run, {
    config: { askQuestions: [FOUR_FORMS[0]], finalText: 'Tour FICTIF après refus.' },
    answers: [{ action: 'decline' }],
  });
  assert.equal(second.run.state, 'completed', second.run.error);
  const noQuestion = second.received[0].checkpoint;
  assert.deepEqual(noQuestion.history.executions[0].questions, []);
  assert.deepEqual(noQuestion.history.executions[0].ownerMessages, []);
  assert.match(noQuestion.previousAnswer, /Réponse FICTIVE sans question/);
  const third = await mission('FICTIF encore', second.run, {
    config: { finalText: 'Tour FICTIF final.' },
  });
  const refused = third.received[0].checkpoint.history.executions[1].questions[0];
  assert.equal(refused.outcome, 'refusée par le propriétaire');
  assert.deepEqual(refused.fields, [{ title: 'Ton', answer: null }]);
  assert.match(
    third.run.result.summary,
    /2 exécution\(s\) précédente\(s\) : 1 question\(s\) dont 0 répondue\(s\)/,
  );
});

test('mission d’origine en échec : état, cause et réponses gardés, aucune prose donnée pour une réponse', async (t) => {
  const { mission } = await platform(t);
  const first = await mission('FICTIF mission qui échoue', null, {
    config: { askQuestions: [FOUR_FORMS[1]], turnError: 'Panne FICTIVE de l’agent' },
    answers: [accept('deux pages FICTIVES')],
  });
  assert.equal(first.run.state, 'failed');
  assert.equal(first.run.resumable, true);
  const second = await mission('FICTIF reprends', first.run, {
    config: { finalText: 'Reprise FICTIVE.' },
  });
  assert.equal(second.run.state, 'completed', second.run.error);
  const checkpoint = second.received[0].checkpoint;
  assert.equal(checkpoint.state, 'failed');
  // The failed result is the platform's Bilan : never handed over as the model's answer.
  assert.equal(checkpoint.previousAnswer, '');
  const [entry] = checkpoint.history.executions;
  assert.equal(entry.platform.state, 'failed');
  assert.ok(entry.platform.error);
  assert.equal(entry.questions[0].fields[0].answer, 'deux pages FICTIVES');
  assert.match(second.run.result.summary, /aucune réponse du modèle gardée/);
});

test('mission privée hors mode propriétaire : réponse et constats relus dans l’espace, rien de plus en base', async (t) => {
  const { app, root, mission } = await platform(t, { ownerMode: false });
  const first = await mission('FICTIF_PRIVE prépare la lettre', null, {
    config: {
      askQuestions: [FOUR_FORMS[3]],
      writeFiles: [{ path: 'output/lettre-FICTIVE.md', text: 'FICTIF' }],
      finalText: DRAFT,
    },
    answers: [accept('anglais FICTIF')],
  });
  assert.equal(first.run.state, 'completed', first.run.error);
  // The public result hides the answer ; the private files keep it and the observed files.
  assert.doesNotMatch(first.run.result.summary, /BROUILLON_FICTIF/);
  assert.ok(existsSync(join(root, `relay/runs/${first.run.id}-observed.json`)));
  assert.equal(first.run.observedFiles, undefined);
  const second = await mission('FICTIF_PRIVE c’est bon', first.run, {
    config: { finalText: 'Lettre FICTIVE.' },
  });
  assert.equal(second.run.state, 'completed', second.run.error);
  const checkpoint = second.received[0].checkpoint;
  assert.match(checkpoint.previousAnswer, /BROUILLON_FICTIF/);
  assert.ok(
    checkpoint.history.executions[0].platform.filesChanged.files.includes(
      'output/lettre-FICTIVE.md',
    ),
  );
  assert.equal(checkpoint.history.executions[0].ownerMessage, 'FICTIF_PRIVE prépare la lettre');
  const database = ['platform.sqlite', 'platform.sqlite-wal']
    .map((name) => join(root, 'platform', name))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file).toString('utf8'))
    .join('\n');
  assert.ok(database.includes(second.run.id));
  assert.doesNotMatch(database, /BROUILLON_FICTIF|FICTIF_PRIVE|lettre-FICTIVE/);
});

test('bornes : questions, réponses, fichiers et notes tronqués, total sous la limite, secrets masqués', () => {
  const long = 'x'.repeat(10000);
  const events = [];
  for (let i = 0; i < 30; i++) {
    events.push({
      type: 'question',
      data: {
        id: `q${i}`,
        message: `FICTIF ${i} ${long}`,
        requestedSchema: {
          type: 'object',
          properties: Object.fromEntries(
            Array.from({ length: 15 }, (_, k) => [`f${k}`, { type: 'string', title: long }]),
          ),
        },
      },
    });
    events.push({
      type: 'answer',
      data: {
        id: `q${i}`,
        action: 'accept',
        content: { f0: `sk-FICTIFFICTIFFICTIF${i}abcdef ${long}` },
      },
    });
  }
  const entry = executionEntry(
    {
      id: 'FICTIF',
      state: 'completed',
      result: { platformNotes: Array.from({ length: 60 }, () => long) },
      skillProgress: {
        steps: Array.from({ length: 70 }, (_, i) => ({ id: `s${i}`, state: 'done' })),
      },
    },
    {
      events,
      ownerMessage: long,
      observed: { files: Array.from({ length: 150 }, (_, i) => `f${i}`), truncated: false },
    },
  );
  assert.equal(entry.questions.length, HISTORY_LIMITS.questions);
  assert.equal(entry.questionsOmitted, 10);
  assert.equal(entry.questions[0].fields.length, HISTORY_LIMITS.fields);
  assert.equal(entry.questions[0].fieldsOmitted, 3);
  assert.ok(entry.questions[0].question.length <= HISTORY_LIMITS.question);
  assert.match(entry.questions[0].question, /\[tronqué\]$/);
  assert.ok(entry.questions[0].fields[0].answer.length <= HISTORY_LIMITS.answer);
  assert.match(entry.questions[0].fields[0].answer, /^\[secret masqué\]/);
  assert.ok(entry.ownerMessage.length <= HISTORY_LIMITS.ownerMessage);
  assert.equal(entry.platform.notes.length, HISTORY_LIMITS.notes);
  assert.equal(entry.platform.skillSteps.length, HISTORY_LIMITS.steps);
  assert.equal(entry.platform.filesChanged.files.length, HISTORY_LIMITS.files);
  // Seven executions : the oldest go first, then what is left is cut down to the total.
  const history = boundedHistory(
    Array.from({ length: 5 }, () => entry),
    2,
  );
  assert.ok(JSON.stringify(history.executions).length <= HISTORY_LIMITS.total);
  assert.ok(history.earlierExecutionsOmitted >= 2);
  assert.ok(history.executions.length >= 1);
  const checkpoint = resumeCheckpoint(
    { id: 'FICTIF', state: 'completed', result: { summary: 'FICTIF' } },
    { previousAnswer: long + long, history },
  );
  assert.ok(checkpoint.previousAnswer.length <= 12000);
  assert.match(checkpoint.previousAnswer, /\[tronqué\]$/);
  assert.match(checkpointLine(checkpoint), /plus ancienne\(s\) non détaillée\(s\)/);
});

test('chaîne longue : cinq exécutions détaillées au plus, les plus anciennes comptées', async (t) => {
  const { app } = await platform(t);
  let parent = null;
  const ids = [];
  for (let i = 0; i < 7; i++) {
    const id = `00000000-0000-4000-8000-00000000000${i}`;
    app.store.create({
      id,
      createdAt: new Date().toISOString(),
      state: 'completed',
      prompt: `FICTIF ${i}`,
      resumedFrom: parent,
      result: {
        summary: `Réponse FICTIVE ${i}`,
        answer: `Réponse FICTIVE ${i}`,
        platformNotes: [],
      },
    });
    ids.push(id);
    parent = id;
  }
  const checkpoint = app.engine.checkpointFor(app.store.get(parent));
  assert.equal(checkpoint.missionObjective, 'FICTIF 0');
  assert.equal(checkpoint.history.executions.length, 5);
  assert.equal(checkpoint.history.earlierExecutionsOmitted, 2);
  assert.deepEqual(
    checkpoint.history.executions.map((e) => e.runId),
    ids.slice(2),
  );
  assert.equal(checkpoint.previousAnswer, 'Réponse FICTIVE 6');
  // No list of files recorded for these executions : said, not invented.
  assert.equal(checkpoint.history.executions[0].platform.filesChanged.unavailable, true);
});

test('fichiers modifiés : dossier relay, entrées cachées et node_modules laissés de côté', () => {
  const root = mkdtempSync(join(tmpdir(), 'reprise-fichiers-FICTIF-'));
  try {
    const since = Date.now() - 1000;
    for (const path of [
      'a.md',
      'output/b.pdf',
      'relay/runs/x.json',
      '.git/HEAD',
      'node_modules/m.js',
    ]) {
      mkdirSync(join(root, path, '..'), { recursive: true });
      writeFileSync(join(root, path), 'FICTIF');
    }
    const { files, truncated } = changedFiles(root, since);
    assert.deepEqual(files, ['a.md', 'output/b.pdf']);
    assert.equal(truncated, false);
    assert.deepEqual(changedFiles(root, Date.now() + 60000).files, []);
    const few = changedFiles(root, since, Infinity, { maxFiles: 1 });
    assert.deepEqual(few, { files: ['a.md'], truncated: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
