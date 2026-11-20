// reponse-04 (front, BRIEF-conversation-reponse-04) : la consigne envoyée à l'agent demande une réponse
// structurée (phrase d'ouverture, titres, listes, tableaux, section « À vérifier ») et la convention
// ```chart pour une série chiffrée de 4 valeurs ou plus. Même méthode que consigne-fichiers-travail :
// agent ACP factice qui écrit le prompt reçu, espace career-ops FICTIF, sans Chrome, aucun réseau.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { terminal } from '../packages/storage/index.js';
import { ANSWER_FORMAT_RULE } from '../packages/orchestrator/answer-format.js';

async function launch(t, body) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'reponse-04-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root, roots: [root], converter: async () => 'CV FICTIF' });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode: true });
  reviewCareer(career, app.skills);
  const promptFile = join(root, 'prompt-FICTIF.json');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      fixedEnv: { FAKE_ACP: JSON.stringify({ loadSession: true, promptFile }) },
    };
    return plan;
  };
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const response = await fetch(`http://127.0.0.1:${app.server.address().port}/api/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-platform-request': '1' },
    body: JSON.stringify({ agent: 'fixture', ...body }),
  });
  assert.equal(response.status, 201, await response.clone().text());
  const run = await response.json();
  for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
    await new Promise((r) => setTimeout(r, 20));
  return JSON.parse(readFileSync(promptFile, 'utf8'));
}

test('reponse-04 : la règle de forme demande la structure et la convention ```chart', () => {
  assert.match(ANSWER_FORMAT_RULE, /phrase d’ouverture/);
  assert.match(ANSWER_FORMAT_RULE, /titres \(###\), des listes et des tableaux markdown/);
  assert.match(ANSWER_FORMAT_RULE, /section « À vérifier »/);
  assert.match(ANSWER_FORMAT_RULE, /série chiffrée de 4 valeurs ou plus, émets un bloc ```chart/);
  assert.match(ANSWER_FORMAT_RULE, /"type":"bar" ou "line"/);
  assert.match(ANSWER_FORMAT_RULE, /pour une comparaison, un tableau markdown/);
});

test('reponse-04 : la règle part dans la consigne d’une mission sans Skill (pack core)', async (t) => {
  const prompt = await launch(t, { prompt: 'Compare deux offres FICTIVES', pack: 'core' });
  assert.ok(prompt.instructions.includes(ANSWER_FORMAT_RULE));
});

test('reponse-04 : la règle part aussi avec le Skill career-ops', async (t) => {
  const prompt = await launch(t, { prompt: 'Cherche des jobs FICTIFS', skills: ['career-ops'] });
  assert.ok(prompt.instructions.includes(ANSWER_FORMAT_RULE));
});
