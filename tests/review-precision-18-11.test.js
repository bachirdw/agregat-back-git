// review-precision-18-11 : relecture du sprint precision-18-11 (E130). Textes FICTIFS, aucune donnée
// personnelle, aucun modèle, aucun réseau. Tout passe par l'agent ACP factice
// (tests/fixtures/fake-acp.js), le même chemin que l'agent réel : on lit la consigne qu'il a reçue.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { OWNER_QUESTION_RULE } from '../packages/orchestrator/owner-question-rule.js';
import { profiles } from '../packages/agent-runtime/profiles.js';
import { terminal } from '../packages/storage/index.js';

const FAKE = resolve('tests/fixtures/fake-acp.js');
// Les mots de l'essai réel du 18/11 (e5a4d8a6), à l'identique.
const PRECISION =
  'Un outil de question qui rend la main tout de suite, sans attendre la réponse, n’est pas un formulaire de question : si c’est le seul que tu as, pose ta question par le champ JSON question de ta réponse.';
// Aucun nom d'agent ni d'outil d'un agent dans la phrase envoyée à tous les agents.
const AGENT_NAMES = /askuserquestion|request_user_input|_async|claude|codex|gemini|opencode/i;

// The plan's agent takes the identity (id, name) of `profile` ; the process is the fake agent.
async function sent(t, input, { ownerMode = false, reviewed = false, profile } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'review-precision-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  if (reviewed) reviewCareer(career, app.skills);
  const promptFile = join(root, 'sent-prompt.json');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      id: profile.id,
      name: profile.name,
      command: process.execPath,
      args: [FAKE],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({
          promptFile,
          result: { simulated: true, summary: 'Réponse FICTIVE', evidence: [] },
        }),
      },
    };
    return plan;
  };
  const run = await app.engine.create({ agent: 'fixture', ...input });
  for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
    await new Promise((done) => setTimeout(done, 20));
  return JSON.parse(readFileSync(promptFile, 'utf8'));
}

test('phrase commune : les mots exacts de l’essai réel, aucun nom d’agent ni d’outil d’agent', () => {
  assert.equal(OWNER_QUESTION_RULE.split(PRECISION).length - 1, 1, OWNER_QUESTION_RULE);
  assert.ok(!AGENT_NAMES.test(OWNER_QUESTION_RULE), OWNER_QUESTION_RULE);
  // Le formulaire est nommé par le protocole commun à tous les agents.
  assert.match(OWNER_QUESTION_RULE, /formulaire de question de ton agent \(elicitation ACP\)/);
});

test('docs/api-questions.md cite la phrase commune à l’identique', () => {
  const doc = readFileSync(resolve('docs/api-questions.md'), 'utf8');
  assert.ok(doc.includes(`> ${OWNER_QUESTION_RULE}\n`), 'citation différente du code');
});

// Les parcours qui ne sont ni career-ops ni navigateur reçoivent la phrase par withDoubtRule.
const PARCOURS = [
  ['général (core)', { prompt: 'Résume ce texte FICTIF', pack: 'core' }, {}],
  ['Najah', { prompt: 'Classe ces offres FICTIVES Python', pack: 'najah' }, {}],
  ['career-ops', { prompt: 'Écris une lettre FICTIVE', pack: 'career-ops' }, { reviewed: true }],
  [
    'navigateur (mode propriétaire)',
    { prompt: 'Ouvre https://jobs.example.test et résume la page', pack: 'core' },
    { ownerMode: true },
  ],
];
for (const [name, input, options] of PARCOURS)
  test(`consigne envoyée (${name}) : la précision une fois, sans nom d’agent, la même pour tous les profils`, async (t) => {
    const seen = new Set();
    for (const profile of profiles) {
      const { instructions } = await sent(t, input, { ...options, profile });
      assert.equal(instructions.split(PRECISION).length - 1, 1, profile.id);
      assert.equal(instructions.split(OWNER_QUESTION_RULE).length - 1, 1, profile.id);
      assert.ok(
        !AGENT_NAMES.test(instructions),
        `${profile.id} : ${AGENT_NAMES.exec(instructions)}`,
      );
      seen.add(instructions);
    }
    assert.equal(seen.size, 1, 'consigne différente selon l’agent');
  });
