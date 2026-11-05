import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';

// E60 (constaté le 05/11, mission f336641e) : le Bilan disait « Questions : 1 posée(s), 1
// répondue(s) » alors que deux questions avaient été posées et répondues — un formulaire pendant le
// tour (élicitation ACP) et une question en prose à la fin du tour. Seule la question de fin de
// tour était comptée. Toutes les questions de la mission comptent désormais, d'après ses
// événements `question` et `answer`. Agent et données FICTIFS.
const FAKE = resolve('tests/fixtures/fake-acp.js');

async function mission(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bilan-questions-FICTIF-')));
  const app = createApp({
    dataDir: join(root, 'platform'),
    career: new CareerWorkspace({ root, roots: [root] }),
  });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt: 'Ouvre cette offre FICTIVE puis demande-moi QUESTION: dois-je l’enregistrer ?',
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
      fixedEnv: { FAKE_ACP: JSON.stringify({ askQuestion: true }) },
    },
    pack: { id: 'core', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  const done = app.engine.execute(run, plan, control, null);
  for (let i = 0; i < 250 && app.store.get(run.id).state !== 'awaiting_owner'; i++)
    await new Promise((r) => setTimeout(r, 20));
  assert.equal(app.store.get(run.id).state, 'awaiting_owner');
  return { app, run, done };
}

test('E60 FICTIF : un formulaire répondu pendant le tour compte au Bilan', async (t) => {
  const { app, run, done } = await mission(t);
  app.engine.answer(run.id, { action: 'accept', content: { reponse: 'oui' } });
  await done;
  const row = app.store.get(run.id);
  assert.equal(row.state, 'completed', JSON.stringify(row));
  assert.match(row.result.summary, /Questions : 1 posée\(s\), 1 répondue\(s\)\./);
});

test('E60 FICTIF : un formulaire refusé compte comme posé, non répondu', async (t) => {
  const { app, run, done } = await mission(t);
  app.engine.answer(run.id, { action: 'decline' });
  await done;
  const row = app.store.get(run.id);
  assert.equal(row.state, 'completed', JSON.stringify(row));
  assert.match(row.result.summary, /Questions : 1 posée\(s\), 0 répondue\(s\)\./);
});
