// preuves-entre-tours-01 (E35) : une mission est une suite de tours dans la même session. Ce que
// l'agent a lu au tour 1 compte pour la note donnée au tour suivant ; le contrôle « note sans
// lecture » reste exercé sur toute la mission. Tout est FICTIF (agent, page, offre).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { terminal } from '../packages/storage/index.js';
import { analyseRun } from '../.manager/outils/bilan-vs-events.mjs';

async function ownerApp(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preuves-entre-tours-FICTIF-')));
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
  writeFileSync(join(career.path(), 'cv.md'), 'CV FICTIF');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/career-agent.js')],
    };
    return plan;
  };
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const api = (path, body) =>
    fetch(`http://127.0.0.1:${app.server.address().port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
      body: JSON.stringify(body),
    });
  const waitFor = async (predicate) => {
    for (let i = 0; i < 1500 && !predicate(); i++) await new Promise((r) => setTimeout(r, 20));
    assert.ok(predicate(), 'état attendu non atteint');
  };
  return { app, api, waitFor };
}

// Tour 1 : lecture + question ; réponse par l'API ; tour 2 (ou suite du formulaire) : note.
async function missionWithQuestion(t, prompt) {
  const { app, api, waitFor } = await ownerApp(t);
  const run = await app.engine.create({
    prompt,
    agent: 'fixture',
    pack: 'career-ops',
    browser: 'fixture',
  });
  await waitFor(() => ['awaiting_owner', ...terminal].includes(app.store.get(run.id).state));
  assert.equal(app.store.get(run.id).state, 'awaiting_owner', app.store.get(run.id).error);
  const response = await api(`/api/runs/${run.id}/answer`, {
    action: 'accept',
    content: { reponse: 'évaluer avec réserve FICTIVE' },
  });
  assert.equal(response.status, 200);
  await waitFor(() => terminal.has(app.store.get(run.id).state));
  return { app, run: app.store.get(run.id), events: app.store.events(run.id) };
}

for (const [label, marker] of [
  ['question en JSON (second tour de prompt)', ''],
  ['question par formulaire', ' FORMULAIRE'],
]) {
  test(`E35 FICTIF, ${label} : la page lue au tour 1 couvre la note donnée après la réponse`, async (t) => {
    const { run, events } = await missionWithQuestion(
      t,
      `FICTIF_ENTRE_TOURS${marker} Évalue cette offre FICTIVE https://jobs.example.test/entre-tours/42`,
    );
    assert.equal(run.state, 'completed', run.error);
    assert.doesNotMatch(run.result.summary, /notée\(s\) sans lecture/);
    assert.equal(events.find((event) => event.type === 'verification').data.valid, true);
    assert.equal(events.filter((event) => event.type === 'answer').length, 1);
    // Étapes du Skill : la ligne de suivi écrite au tour 1 reste faite, la fiche notée au tour 2 aussi.
    const steps = Object.fromEntries(run.skillProgress.steps.map((step) => [step.id, step.state]));
    assert.equal(steps.tsv, 'done');
    assert.equal(steps['save-evaluation'], 'done');
    // Bilan de la mission entière : l'action du tour 1 et celle du tour 2.
    assert.match(run.result.summary, /- Actions réussies : [^\n]*career_write/);
    assert.match(run.result.summary, /- Actions réussies : [^\n]*career_offer_save/);
    const audit = analyseRun(run, events);
    assert.deepEqual(
      audit.contradictions.filter((line) => /absent/.test(line)),
      [],
      audit.contradictions.join(' | '),
    );
  });

  test(`E35 FICTIF, ${label} : une note sur une URL jamais lue reste signalée`, async (t) => {
    const { run } = await missionWithQuestion(
      t,
      `FICTIF_ENTRE_TOURS${marker} URL_JAMAIS_LUE Évalue cette offre FICTIVE https://jobs.example.test/entre-tours/42`,
    );
    assert.equal(run.state, 'failed');
    assert.match(
      run.error,
      /^Mission incomplète : 1 offre\(s\) notée\(s\) sans lecture de leur page$/,
    );
  });
}

// Reprise depuis le point de reprise de la même mission : nouvelle exécution, même session.
async function missionThenResume(t, resumePrompt) {
  const { app, waitFor } = await ownerApp(t);
  const first = await app.engine.create({
    prompt:
      'FICTIF_ENTRE_TOURS SANS_QUESTION Lis cette offre FICTIVE https://jobs.example.test/entre-tours/42',
    agent: 'fixture',
    pack: 'career-ops',
    browser: 'fixture',
  });
  await waitFor(() => terminal.has(app.store.get(first.id).state));
  assert.equal(app.store.get(first.id).state, 'completed', app.store.get(first.id).error);
  const resumed = await app.engine.create(
    { prompt: resumePrompt, agent: 'fixture', pack: 'career-ops', browser: 'fixture' },
    app.store.get(first.id),
  );
  await waitFor(() => terminal.has(app.store.get(resumed.id).state));
  return { app, first: app.store.get(first.id), run: app.store.get(resumed.id) };
}

test('E35 FICTIF, reprise de la même mission : la page lue avant la reprise couvre la note', async (t) => {
  const { run } = await missionThenResume(t, 'FICTIF_ENTRE_TOURS_SUITE Note-la maintenant');
  assert.equal(run.state, 'completed', run.error);
  assert.doesNotMatch(run.result.summary, /notée\(s\) sans lecture/);
});

test('E35 FICTIF, reprise de la même mission : une URL jamais lue reste signalée', async (t) => {
  const { run } = await missionThenResume(
    t,
    'FICTIF_ENTRE_TOURS_SUITE URL_JAMAIS_LUE Note-la maintenant',
  );
  assert.equal(run.state, 'failed');
  assert.match(run.error, /1 offre\(s\) notée\(s\) sans lecture de leur page/);
});

test('E35 FICTIF, mission neuve : aucune preuve d’une autre mission n’est reprise', async (t) => {
  const { app, waitFor } = await ownerApp(t);
  const reader = await app.engine.create({
    prompt:
      'FICTIF_ENTRE_TOURS SANS_QUESTION Lis cette offre FICTIVE https://jobs.example.test/entre-tours/42',
    agent: 'fixture',
    pack: 'career-ops',
    browser: 'fixture',
  });
  await waitFor(() => terminal.has(app.store.get(reader.id).state));
  const fresh = await app.engine.create({
    prompt: 'FICTIF_ENTRE_TOURS_SUITE Note cette offre FICTIVE',
    agent: 'fixture',
    pack: 'career-ops',
    browser: 'fixture',
  });
  await waitFor(() => terminal.has(app.store.get(fresh.id).state));
  assert.equal(app.store.get(fresh.id).state, 'failed');
  assert.match(app.store.get(fresh.id).error, /1 offre\(s\) notée\(s\) sans lecture/);
});
