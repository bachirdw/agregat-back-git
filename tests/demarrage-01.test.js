// demarrage-01 : le modèle demandé est donné à la session dès sa création quand le profil de
// l'adaptateur le déclare (`modelEnv`), au lieu d'être changé après coup par
// session/set_config_option. Constats du 18/11 (agent Claude) : E142, un set_config_option du
// modèle sans réponse en 30 s fait échouer le démarrage ; E141, le changement de modèle laisse dans
// la session une note de « commande locale » et la consigne JSON qui suit n'est pas traitée. Faux
// agent ACP (tests/fixtures/modele-acp.js) qui reproduit les deux ; aucun CLI réel, aucun modèle,
// aucun réseau. Textes FICTIFS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// No real CLI is ever run by the detection of agents (`--version`) : every path is absent.
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'demarrage-01-agents-FICTIF-')));
writeFileSync(
  join(AGENTS_CONFIG_DIR, 'agents.json'),
  JSON.stringify({
    cliDirs: [],
    paths: Object.fromEntries(
      ['codex', 'claude', 'gemini', 'opencode'].map((cli) => [
        cli,
        join(AGENTS_CONFIG_DIR, 'absent', cli),
      ]),
    ),
  }),
);
process.env.AGENT_PLATFORM_AGENTS_CONFIG = join(AGENTS_CONFIG_DIR, 'agents.json');
test.after(() => rmSync(AGENTS_CONFIG_DIR, { recursive: true, force: true }));

const { AcpRuntime, AgentTimeoutError, profiles } = await import(
  '../packages/agent-runtime/index.js'
);
const { createApp } = await import('../apps/api/server.js');
const { CareerWorkspace } = await import('../packages/career-ops/workspace.js');
const { terminal } = await import('../packages/storage/index.js');

const MODELE = resolve('tests/fixtures/modele-acp.js');
const MODEL_ENV = 'MODELE_ACP_MODELE_FICTIF';
const fast = { initialize: 1500, session: 1500, request: 800, prompt: 3000 };
const temporary = (t, prefix) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// One runtime on the fake agent ; `modelEnv` is what a profile declares, `model` what the mission asks.
function runtime(t, { modelEnv, model, hangModel = false } = {}) {
  const dir = temporary(t, 'demarrage-01-FICTIF-');
  let text = '';
  const r = new AcpRuntime({
    definition: {
      id: 'modele-fictif',
      name: 'Modèle FICTIF',
      command: process.execPath,
      args: [MODELE],
      env: [],
      safeModes: ['default'],
      ...(modelEnv ? { modelEnv } : {}),
      fixedEnv: { MODELE_ACP: JSON.stringify({ dir, modelEnv: MODEL_ENV, hangModel }) },
    },
    cwd: dir,
    timeouts: fast,
    ...(model !== undefined ? { model } : {}),
    onEvent: (update) => {
      if (update.sessionUpdate === 'agent_message_chunk') text += update.content.text;
    },
  });
  t.after(() => r.close());
  return {
    r,
    dir,
    text: () => text,
    calls: () => readJson(join(dir, 'calls.json')),
    env: () => readJson(join(dir, 'env.json')),
    configCalls: () =>
      readJson(join(dir, 'calls.json')).filter((c) => c.method === 'session/set_config_option'),
  };
}

test('profils : seul l’adaptateur Claude déclare la variable de son modèle, sans branchement sur son nom', () => {
  const declared = Object.fromEntries(
    profiles.filter((p) => p.modelEnv).map((p) => [p.id, p.modelEnv]),
  );
  assert.deepEqual(declared, { claude: 'ANTHROPIC_MODEL' });
  const source = readFileSync(resolve('packages/agent-runtime/index.js'), 'utf8');
  assert.doesNotMatch(source, /ANTHROPIC_MODEL/);
});

test('modèle déclaré au profil : donné à la création, aucun set_config_option, consigne traitée', async (t) => {
  const f = runtime(t, { modelEnv: MODEL_ENV, model: 'modele-b' });
  await f.r.start();
  await f.r.session([]);
  assert.equal(f.r.models.current, 'modele-b');
  assert.equal(await f.r.selectModel('modele-b'), 'modele-b');
  await f.r.prompt('{"objective":"Tâche FICTIVE"}');
  assert.deepEqual(f.configCalls(), []);
  assert.deepEqual(f.env(), { present: true, value: 'modele-b' });
  assert.equal(JSON.parse(f.text()).summary, 'Fait FICTIF (modele-b)');
});

test('E142 : la requête du modèle qui ne répond pas n’est plus envoyée quand le profil le déclare', async (t) => {
  const f = runtime(t, { modelEnv: MODEL_ENV, model: 'modele-b', hangModel: true });
  await f.r.start();
  await f.r.session([]);
  assert.equal(await f.r.selectModel('modele-b'), 'modele-b');
  assert.deepEqual(f.configCalls(), []);
});

test('contrôle : sans déclaration au profil, comportement d’avant (E142 et E141 reproduits par le faux agent)', async (t) => {
  // E142 : the model request is sent and never answered.
  const hang = runtime(t, { model: 'modele-b', hangModel: true });
  await hang.r.start();
  await hang.r.session([]);
  assert.equal(hang.r.models.current, 'default');
  await assert.rejects(hang.r.selectModel('modele-b'), (e) => {
    assert.ok(e instanceof AgentTimeoutError);
    assert.match(e.message, /Délai dépassé \(800 ms\) pour session\/set_config_option/);
    return true;
  });
  assert.deepEqual(hang.env(), { present: false, value: null });
  // E141 : the change goes through, then the consigne is not carried out.
  const note = runtime(t, { model: 'modele-b' });
  await note.r.start();
  await note.r.session([]);
  assert.equal(await note.r.selectModel('modele-b'), 'modele-b');
  assert.deepEqual(note.configCalls(), [
    { method: 'session/set_config_option', configId: 'model', value: 'modele-b' },
  ]);
  await note.r.prompt('{"objective":"Tâche FICTIVE"}');
  assert.match(note.text(), /commande locale/);
});

test('aucun modèle demandé : la variable n’est pas posée, le défaut de l’agent reste', async (t) => {
  for (const model of [undefined, '']) {
    const f = runtime(t, { modelEnv: MODEL_ENV, model });
    await f.r.start();
    await f.r.session([]);
    assert.equal(await f.r.selectModel(model), 'default');
    assert.deepEqual(f.env(), { present: false, value: null });
    assert.deepEqual(f.configCalls(), []);
  }
});

test('modèle que l’agent ne reconnaît pas à la création : même refus qu’avant', async (t) => {
  const f = runtime(t, { modelEnv: MODEL_ENV, model: 'modele-inconnu-FICTIF' });
  await f.r.start();
  await f.r.session([]);
  assert.equal(f.r.models.current, 'default');
  await assert.rejects(f.r.selectModel('modele-inconnu-FICTIF'), /Modèle non annoncé/);
});

test('modèle repris par l’agent sous une autre valeur : le changement après coup reste le filet', async (t) => {
  // The fake agent ignores the variable (not its modelEnv) : current stays 'default'.
  const f = runtime(t, { modelEnv: 'AUTRE_VARIABLE_FICTIVE', model: 'modele-a' });
  await f.r.start();
  await f.r.session([]);
  assert.equal(await f.r.selectModel('modele-a'), 'modele-a');
  assert.deepEqual(f.configCalls(), [
    { method: 'session/set_config_option', configId: 'model', value: 'modele-a' },
  ]);
});

// Mission level : the platform's engine on the fake agent, by the same path as a real agent.
async function platform(t, { modelEnv, hangModel = false } = {}) {
  const root = temporary(t, 'demarrage-01-mission-FICTIF-');
  const logs = join(root, 'logs');
  const workspace = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career: workspace });
  mkdirSync(logs);
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (input, options) => {
    const plan = await originalPlan(input, options);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [MODELE],
      ...(modelEnv ? { modelEnv } : {}),
      fixedEnv: {
        ...plan.agent.fixedEnv,
        MODELE_ACP: JSON.stringify({ dir: logs, modelEnv: MODEL_ENV, hangModel }),
      },
    };
    return plan;
  };
  t.after(() => app.close());
  const ended = async (id, ms = 15000) => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      if (terminal.has(app.store.get(id)?.state)) return app.store.get(id);
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`fin de ${id} non atteinte`);
  };
  const prompt = () => {
    const name = readdirSync(logs).find((n) => n.startsWith('prompt-'));
    return name ? readJson(join(logs, name)).text : null;
  };
  const configCalls = () =>
    existsSync(join(logs, 'calls.json'))
      ? readJson(join(logs, 'calls.json')).filter((c) => c.method === 'session/set_config_option')
      : [];
  return { app, ended, prompt, configCalls };
}

const mission = { prompt: 'Une tâche FICTIVE.', agent: 'fixture', pack: 'core', model: 'modele-b' };

test('mission : modèle donné à la création, aucune requête de modèle, consigne identique au caractère près', async (t) => {
  const withProfile = await platform(t, { modelEnv: MODEL_ENV, hangModel: true });
  const run = await withProfile.app.engine.create(mission);
  const row = await withProfile.ended(run.id);
  assert.equal(row.state, 'completed', row.error);
  assert.deepEqual(withProfile.configCalls(), []);
  const session = withProfile.app.store.events(run.id).find((e) => e.type === 'session');
  assert.equal(session.data.models.current, 'modele-b');
  // The same mission by the former path (change after the fact, agent that answers) : the consigne
  // sent to the agent is the same, but for the mission's own id and folder.
  const before = await platform(t);
  const old = await before.app.engine.create(mission);
  await before.ended(old.id);
  assert.deepEqual(before.configCalls(), [
    { method: 'session/set_config_option', configId: 'model', value: 'modele-b' },
  ]);
  const normalise = (text, id, cwd) => text.split(id).join('<id>').split(cwd).join('<cwd>');
  assert.equal(
    normalise(withProfile.prompt(), run.id, row.cwd),
    normalise(before.prompt(), old.id, before.app.store.get(old.id).cwd),
  );
});

test('contrôle mission : sans déclaration, le changement après coup laisse la note et la consigne n’est pas traitée (E141)', async (t) => {
  const p = await platform(t);
  const run = await p.app.engine.create(mission);
  await p.ended(run.id);
  assert.equal(p.configCalls().length, 1);
  const answer = JSON.stringify(p.app.store.get(run.id).result ?? {});
  assert.match(answer, /commande locale/);
});
