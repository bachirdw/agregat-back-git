// Mémoire d'une conversation reprise, de bout en bout et FICTIVE : aucun modèle, aucun service externe.
// Noms de champs alignés sur la conception de la branche reprise-objectif (missionObjective,
// previousOwnerMessage, resumedFrom), dont la partie navigateur reste hors de ce périmètre.
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
import { AcpRuntime } from '../packages/agent-runtime/index.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { terminal } from '../packages/storage/index.js';
import { resumeCheckpoint } from '../packages/orchestrator/checkpoint.js';

// What the platform really sends to the agent, turn after turn.
const sent = [];
const sendPrompt = AcpRuntime.prototype.prompt;
AcpRuntime.prototype.prompt = function (text, signal) {
  sent.push(JSON.parse(text));
  return sendPrompt.call(this, text, signal);
};

async function until(check, label, ms = 15000) {
  const end = Date.now() + ms;
  while (!check()) {
    assert.ok(Date.now() < end, `délai dépassé : ${label}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

async function platform(t, { career = false } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'memoire-fil-FICTIF-')));
  let workspace;
  if (career) {
    mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
    writeFileSync(
      join(root, '.agents/skills/career-ops/SKILL.md'),
      '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
    );
    writeFileSync(join(root, 'cv.md'), 'CV FICTIF');
    workspace = new CareerWorkspace({ root, roots: [root] });
  }
  const app = createApp({
    dataDir: join(root, 'platform'),
    ownerMode: true,
    ...(workspace ? { career: workspace } : {}),
  });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  if (workspace) reviewCareer(workspace, app.skills);
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  const plan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const chosen = await plan(...args);
    chosen.agent = {
      ...chosen.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      fixedEnv: {
        ...chosen.agent.fixedEnv,
        FAKE_ACP: JSON.stringify({
          result: { simulated: true, summary: 'Réponse FICTIVE', evidence: [] },
        }),
      },
    };
    return chosen;
  };
  const base = `http://127.0.0.1:${app.server.address().port}/api`;
  sent.length = 0;
  return { app, root, base };
}

async function turn({ app }, input, previous = null) {
  const before = sent.length;
  const created = await app.engine.create(
    {
      agent: 'fixture',
      browser: 'fixture',
      ...(previous ? { pack: previous.pack } : { pack: 'core' }),
      ...(previous?.workspace ? { workspace: previous.workspace } : {}),
      ...input,
    },
    previous,
  );
  await until(() => terminal.has(app.store.get(created.id).state), 'fin du tour');
  return { run: app.store.get(created.id), prompt: sent.length > before ? sent.at(-1) : null };
}

test('reprise : resumedFrom est enregistré et exposé par la liste des missions', async (t) => {
  const ctx = await platform(t);
  const first = await turn(ctx, { prompt: 'FICTIF objectif de départ' });
  assert.equal(first.run.state, 'completed', first.run.error);
  assert.equal(first.run.resumedFrom, null);
  const second = await turn(ctx, { prompt: 'FICTIF deuxième message' }, first.run);
  const third = await turn(ctx, { prompt: 'FICTIF troisième message' }, second.run);
  assert.equal(second.run.resumedFrom, first.run.id);
  assert.equal(third.run.resumedFrom, second.run.id);
  const list = await fetch(`${ctx.base}/runs`).then((r) => r.json());
  const byId = Object.fromEntries(list.map((r) => [r.id, r]));
  assert.equal(byId[third.run.id].resumedFrom, second.run.id);
  assert.equal(byId[second.run.id].resumedFrom, first.run.id);
});

test('reprise : l’agent reçoit l’objectif de départ et le dernier message du propriétaire', async (t) => {
  const ctx = await platform(t);
  const first = await turn(ctx, { prompt: 'FICTIF objectif de départ' });
  assert.equal(first.prompt.checkpoint, undefined);
  const second = await turn(ctx, { prompt: 'FICTIF deuxième message' }, first.run);
  const third = await turn(ctx, { prompt: 'FICTIF troisième message' }, second.run);
  assert.equal(second.prompt.checkpoint.missionObjective, 'FICTIF objectif de départ');
  assert.equal(second.prompt.checkpoint.previousOwnerMessage, 'FICTIF objectif de départ');
  const checkpoint = third.prompt.checkpoint;
  assert.equal(third.prompt.objective, 'FICTIF troisième message');
  assert.equal(checkpoint.missionObjective, 'FICTIF objectif de départ');
  assert.equal(checkpoint.previousOwnerMessage, 'FICTIF deuxième message');
  assert.equal(checkpoint.sourceRunId, second.run.id);
  assert.equal(checkpoint.previousAnswer, second.run.result.summary);
  assert.equal(checkpoint.untrusted, true);
  assert.equal(checkpoint.effects, 'unverified');
  assert.equal(checkpoint.provenance.missionObjective, 'propriétaire');
  assert.equal(checkpoint.provenance.previousAnswer, 'déclaré par le modèle');
  assert.match(checkpoint.instructions, /« objective » .*dernier message du propriétaire/);
});

test('reprise privée career-ops : messages relus dans l’espace privé, jamais écrits en base', async (t) => {
  const ctx = await platform(t, { career: true });
  const start = 'FICTIF_OBJECTIF_PRIVE trouver une offre fictive';
  const second = 'FICTIF_PRECISION_PRIVEE télétravail seulement';
  const first = await turn(ctx, { prompt: start, pack: 'career-ops' });
  assert.equal(first.run.workspace, 'career-ops');
  const next = await turn(ctx, { prompt: second }, first.run);
  const third = await turn(ctx, { prompt: 'FICTIF_TROISIEME_PRIVE continue' }, next.run);
  assert.equal(third.run.resumedFrom, next.run.id);
  assert.equal(third.prompt.checkpoint.missionObjective, start);
  assert.equal(third.prompt.checkpoint.previousOwnerMessage, second);
  // The database and its WAL journal: the private messages must be in neither.
  const database = ['platform.sqlite', 'platform.sqlite-wal']
    .map((name) => join(ctx.root, 'platform', name))
    .filter((file) => existsSync(file))
    .map((file) => readFileSync(file).toString('latin1'))
    .join('\n');
  assert.ok(database.includes(third.run.id), 'la lecture de la base voit bien les missions');
  assert.doesNotMatch(database, /FICTIF_OBJECTIF_PRIVE|FICTIF_PRECISION_PRIVEE/);
});

test('point de reprise : messages bornés à 4000 caractères et marqués tronqués', () => {
  const long = 'x'.repeat(5000);
  const checkpoint = resumeCheckpoint(
    { id: 'FICTIF', state: 'completed', result: { summary: 'FICTIF' } },
    { missionObjective: long, previousOwnerMessage: long },
  );
  for (const field of ['missionObjective', 'previousOwnerMessage']) {
    assert.ok(checkpoint[field].length <= 4000, field);
    assert.match(checkpoint[field], /\[tronqué\]$/);
  }
  // Without the owner's messages, the checkpoint stays what it was.
  const bare = resumeCheckpoint({ id: 'FICTIF', state: 'failed', result: null });
  assert.equal(bare.missionObjective, null);
  assert.equal(bare.previousOwnerMessage, null);
  assert.equal(bare.previousAnswer, '');
});
