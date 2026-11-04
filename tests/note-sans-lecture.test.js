import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { createTurnTruth } from '../packages/career-ops/truth.js';
import { getPack } from '../packages/orchestrator/packs.js';
import { SkillProgress, selectSkillIntents } from '../packages/orchestrator/skill-router.js';
import { terminal } from '../packages/storage/index.js';

test('Suivi du tour FICTIF : les offres enregistrées avec une note sont listées, sans note elles ne le sont pas', () => {
  const truth = createTurnTruth();
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'a',
    title: 'career_offer_save',
    rawInput: { url: 'https://offres.example.test/a', score: 2 },
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'a', status: 'completed' });
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'b',
    title: 'career_offer_save',
    rawInput: { arguments: { url: 'https://offres.example.test/b' } },
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'b', status: 'completed' });
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'c',
    title: 'career_offer_save',
    rawInput: { arguments: { url: 'https://offres.example.test/c', score: 5 } },
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'c', status: 'failed' });
  assert.deepEqual(truth.scoredOffers(), [
    { url: 'https://offres.example.test/a', toolCallId: 'a' },
  ]);
  assert.equal(truth.hasOfferSave(), true);
  assert.deepEqual(
    truth.toolOutcomes().map((item) => item.status),
    ['completed', 'completed', 'failed'],
  );
});

test('Suivi du tour FICTIF : le pont de la passerelle transmet l’URL notée, une fois par offre', () => {
  const truth = createTurnTruth();
  truth.recordGatewayTool('career_offer_save', 'completed', {
    toolCallId: '11111111-1111-1111-1111-111111111111',
    scoredUrl: 'https://offres.example.test/a',
  });
  truth.recordGatewayTool('career_offer_save', 'completed', {
    toolCallId: '22222222-2222-2222-2222-222222222222',
  });
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'acp-1',
    title: 'career_offer_save',
    rawInput: { url: 'https://offres.example.test/a', score: 3 },
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'acp-1', status: 'completed' });
  assert.equal(truth.scoredOffers().length, 1);
  assert.equal(truth.scoredOffers()[0].url, 'https://offres.example.test/a');
});

function fixtureApp(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'note-sans-lecture-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career });
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
  return app;
}
async function runMission(app, prompt) {
  const run = await app.engine.create({ prompt, agent: 'fixture', pack: 'career-ops' });
  for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
    await new Promise((r) => setTimeout(r, 20));
  return { run: app.store.get(run.id), events: app.store.events(run.id) };
}

test('Note hors intent FICTIVE : une note enregistrée sans aucune lecture rend la mission incomplète', async (t) => {
  const app = fixtureApp(t);
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const prompt = 'FICTIF_NOTE_HORS_INTENT Ouvre cette offre FICTIVE et note-la de 1 à 5';
  assert.deepEqual(selectSkillIntents(prompt, [getPack('career-ops').skillManifest]), []);
  const { run, events } = await runMission(app, prompt);
  assert.equal(run.state, 'failed');
  assert.match(
    run.error,
    /^Mission incomplète : 1 offre\(s\) notée\(s\) sans lecture de leur page$/,
  );
  assert.equal(events.find((event) => event.type === 'verification').data.valid, false);
  assert.match(run.result.summary, /Mission incomplète : 1 offre\(s\) notée\(s\) sans lecture/);
});

test('Note hors intent FICTIVE : sans note, aucune cause', async (t) => {
  const app = fixtureApp(t);
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const { run, events } = await runMission(
    app,
    'FICTIF_NOTE_HORS_INTENT SANS_NOTE_FICTIVE Ouvre cette offre FICTIVE',
  );
  assert.equal(run.state, 'completed', run.error);
  assert.equal(events.find((event) => event.type === 'verification').data.valid, true);
});

test('Note sans lecture FICTIVE : une capture lisible de la même URL, ou un compte déjà fait par l’intent, ne comptent pas deux fois', () => {
  const unscored = new SkillProgress([]);
  const offers = [{ url: 'https://offres.example.test/a/?x=1', toolCallId: 'a' }];
  assert.deepEqual(unscored.incomplete([], false, offers), [
    '1 offre(s) notée(s) sans lecture de leur page',
  ]);
  assert.deepEqual(unscored.incomplete(['https://offres.example.test/a'], false, offers), []);
  assert.deepEqual(unscored.incomplete([], true, offers), []);
  const search = new SkillProgress(
    selectSkillIntents('Trouve des offres FICTIVES sans scan', [
      getPack('career-ops').skillManifest,
    ]),
  );
  search.start();
  search.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'a',
    title: 'career_offer_save',
    rawInput: { url: 'https://offres.example.test/a', score: 4 },
    status: 'completed',
  });
  assert.deepEqual(search.incomplete([], false, offers), [
    '1 offre(s) notée(s) sans lecture de leur page',
  ]);
});
