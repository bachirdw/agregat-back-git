// Audit EN du 10/11 (point 2) : en mission réelle l'agent a écrit /tmp/apply-answers-005.json (réponses
// du formulaire, nom et e-mail) par son outil natif. Sans rien interdire, la consigne envoyée à
// l'agent demande de garder ses fichiers de travail dans la mission ou sous output/. Agent fixture,
// espace career-ops FICTIF, sans Chrome, aucun réseau.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { terminal } from '../packages/storage/index.js';

const RULE = /Fichiers de travail \(brouillons, JSON intermédiaires\).*jamais dans \/tmp/s;

async function launch(t, body) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'consigne-travail-FICTIF-')));
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

test('consigne : fichiers de travail dans la mission, jamais /tmp, sans Skill (pack core)', async (t) => {
  const prompt = await launch(t, { prompt: 'Remplis le formulaire FICTIF', pack: 'core' });
  assert.match(prompt.instructions, RULE);
  assert.match(prompt.instructions, /dossier de la mission ou sous `output\/`/);
});

test('consigne : fichiers de travail dans la mission, jamais /tmp, avec le Skill career-ops', async (t) => {
  const prompt = await launch(t, { prompt: 'Cherche des jobs FICTIFS', skills: ['career-ops'] });
  assert.match(prompt.instructions, RULE);
});
