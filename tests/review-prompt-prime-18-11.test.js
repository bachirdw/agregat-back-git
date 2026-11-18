// Relecture du sprint prompt-prime-18-11 : par le chemin réel du moteur (pack career-ops, mode
// propriétaire), chaque profil d'agent reçoit le cadre système accordé EN ENTIER, et la consigne reçue
// garde la phrase « le prompt prime » cohérente avec la règle de doute qui la suit. Agent factice
// fake-acp, espace career-ops FICTIF, navigateur fixture, relais remplacé par un témoin, aucun réseau.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import {
  reviewCareer,
  CAREER_OWNER_FRAME,
  OWNER_PROMPT_PRIME,
} from '../packages/career-ops/integration.js';
import { DOUBT_RULE } from '../packages/orchestrator/doubt-rule.js';
import { agentIds } from '../packages/agent-runtime/profiles.js';
import { terminal } from '../packages/storage/index.js';

// The fake agent refuses session/new unless the system frame it receives contains `expectSystemPrompt`:
// here the whole frame, so a profile that got another frame (or none) never writes its prompt file.
async function missionFor(t, agentId) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'review-prompt-prime-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root, roots: [root], converter: async () => 'CV FICTIF' });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode: true });
  reviewCareer(career, app.skills);
  let relayStarted = false;
  app.engine.startRelay = () => {
    relayStarted = true;
  };
  const promptFile = join(root, 'prompt-FICTIF.json');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      id: agentId,
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({
          loadSession: true,
          promptFile,
          expectSystemPrompt: CAREER_OWNER_FRAME,
        }),
      },
    };
    return plan;
  };
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const run = await app.engine.create({
    prompt: 'Évalue toutes les offres FICTIVES, même celles que le Skill déconseille',
    agent: 'fixture',
    pack: 'career-ops',
    browser: 'fixture',
  });
  for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
    await new Promise((r) => setTimeout(r, 20));
  assert.ok(terminal.has(app.store.get(run.id).state), app.store.get(run.id).state);
  assert.equal(relayStarted, false);
  return JSON.parse(readFileSync(promptFile, 'utf8'));
}

test('relecture prompt prime : chaque profil reçoit le cadre accordé en entier et une consigne cohérente', async (t) => {
  assert.match(CAREER_OWNER_FRAME, /c’est le prompt du candidat qui le décide/);
  for (const id of agentIds) {
    const { instructions } = await missionFor(t, id);
    const prime = instructions.indexOf(OWNER_PROMPT_PRIME);
    assert.ok(prime >= 0, id);
    // The doubt rule that follows says the same order (prompt first, then the Skill).
    assert.ok(instructions.indexOf(DOUBT_RULE) > prime, id);
    assert.match(DOUBT_RULE, /suis d’abord le prompt, puis le Skill/);
    // The frame stays in the system channel: the instructions never repeat its unqualified wording.
    assert.doesNotMatch(instructions, /s’applique tel qu’il est écrit/, id);
  }
});
