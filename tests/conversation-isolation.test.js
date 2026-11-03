import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { AcpRuntime, getProfile } from '../packages/agent-runtime/index.js';
import {
  agentHomeFor,
  removeRunHomes,
  workspacesRoot,
} from '../packages/orchestrator/isolation.js';

const temporary = (t) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'relay-isolation-FICTIF-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

for (const marker of ['.git', 'CLAUDE.md', 'AGENTS.md', 'GEMINI.md'])
  test(`dossier de mission hors d'un projet marqué par ${marker}`, (t) => {
    const repo = temporary(t);
    const home = temporary(t);
    if (marker === '.git') mkdirSync(join(repo, marker));
    else writeFileSync(join(repo, marker), 'FICTIF');
    const root = workspacesRoot(join(repo, 'a/.data'), { env: {}, home });
    assert.equal(root, join(home, '.relay/workspaces'));
    assert.equal(root.startsWith(repo), false);
  });

test('dossier de mission conservé dans les données hors de tout projet', (t) => {
  const dataDir = join(temporary(t), '.data');
  assert.equal(workspacesRoot(dataDir, { env: {} }), join(dataDir, 'workspaces'));
});

test('le dossier de mission peut être imposé', (t) => {
  const forced = temporary(t);
  const env = { AGENT_PLATFORM_WORKSPACES_DIR: forced };
  assert.equal(workspacesRoot('/repo/.data', { env }), forced);
});

test('mission réelle du moteur : dossier neuf, hors du dépôt, différent à chaque mission', async (t) => {
  const repo = temporary(t);
  const workspaces = temporary(t);
  mkdirSync(join(repo, '.git'));
  writeFileSync(join(repo, 'CLAUDE.md'), 'FICTIF');
  const saved = process.env.AGENT_PLATFORM_WORKSPACES_DIR;
  process.env.AGENT_PLATFORM_WORKSPACES_DIR = workspaces;
  const app = createApp({ dataDir: join(repo, '.data') });
  t.after(async () => {
    await app.close();
    if (saved === undefined) delete process.env.AGENT_PLATFORM_WORKSPACES_DIR;
    else process.env.AGENT_PLATFORM_WORKSPACES_DIR = saved;
  });
  const start = () =>
    app.engine.create({ prompt: 'FICTIF : dis bonjour', agent: 'fixture', pack: 'core' });
  const [a, b] = [await start(), await start()];
  assert.notEqual(a.cwd, b.cwd);
  for (const run of [a, b]) {
    assert.equal(run.cwd.startsWith(workspaces), true);
    assert.equal(run.cwd.startsWith(repo), false);
    assert.equal(existsSync(run.cwd), true);
  }
});

test('Claude : mémoire automatique coupée dans son environnement réel', (t) => {
  const runtime = new AcpRuntime({
    definition: { ...getProfile('claude'), command: process.execPath },
    cwd: temporary(t),
    env: { PATH: process.env.PATH },
  });
  assert.equal(runtime.childEnv().CLAUDE_CODE_DISABLE_AUTO_MEMORY, '1');
});

test('Gemini : une maison par mission, supprimée à la fin', (t) => {
  const base = temporary(t);
  const homeOf = (runId) => {
    const runtime = new AcpRuntime({
      definition: { ...getProfile('gemini'), command: process.execPath },
      cwd: base,
      agentHome: agentHomeFor(base, runId, 'gemini'),
      env: { PATH: process.env.PATH, GEMINI_API_KEY: 'FICTIF-12345678' },
    });
    return runtime.childEnv().GEMINI_CLI_HOME;
  };
  const a = homeOf('mission-a');
  const b = homeOf('mission-b');
  assert.notEqual(a, b);
  assert.equal(existsSync(a), true);
  removeRunHomes(base, 'mission-a');
  assert.equal(existsSync(a), false);
  assert.equal(existsSync(b), true);
});
