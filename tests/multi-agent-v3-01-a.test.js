// multi-agent-v3-01, lot 1a (brief du 19/11, décisions D1, D2 et D6) : interrupteur `multiAgent`
// éteint par défaut (sans lui : ni outils de mission, ni phrase du chef, route interne 403, l'accord
// `delegation` seul sans effet ; la reprise le recopie), l'échec de la mère arrête ses sous-missions
// (une ligne au Bilan), la durée d'une sous-mission comptée depuis son premier état `running`
// (« jamais démarrée » sinon). Faux agent ACP (tests/fixtures/chef-agent.js), pack `core` sans Skill.
// Aucun modèle, aucun navigateur, aucun relais, aucun CLI réel (la détection des agents pointe vers
// des chemins inexistants). FICTIF.
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
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'mav3-a-agents-FICTIF-')));
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
delete process.env.AGENT_PLATFORM_DELEGATION;
test.after(() => rmSync(AGENTS_CONFIG_DIR, { recursive: true, force: true }));

const { createApp } = await import('../apps/api/server.js');
const { CareerWorkspace } = await import('../packages/career-ops/workspace.js');
const { terminal } = await import('../packages/storage/index.js');
const rule = await import('../packages/orchestrator/delegation-rule.js');
const { formatDuration } = await import('../packages/orchestrator/family-bilan.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const ACCEPTED = (envelope = {}) => ({ accepted: true, via: 'api', ...envelope });
const FAMILY_EVENT = /^(delegation|child|family)_/;

async function platform(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'mav3-a-FICTIF-')));
  const logs = join(root, 'logs');
  const hold = join(root, 'hold');
  mkdirSync(logs);
  mkdirSync(hold);
  const app = createApp({
    dataDir: join(root, 'platform'),
    career: new CareerWorkspace({ root, roots: [root] }),
  });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  let config = () => ({});
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (input, options) => {
    const plan = await originalPlan(input, options);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [CHEF],
      fixedEnv: {
        ...plan.agent.fixedEnv,
        CHEF_AGENT: JSON.stringify({ dir: logs, holdDir: hold, ...config(input) }),
      },
    };
    return plan;
  };
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const waitFor = async (check, ms = 15000, what = '') => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const value = check();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('Attente dépassée ' + what);
  };
  return {
    app,
    hold,
    waitFor,
    setConfig: (fn) => (config = fn),
    touch: (name) => writeFileSync(join(hold, name), 'go'),
    ended: (id, ms) =>
      waitFor(() => terminal.has(app.store.get(id)?.state), ms ?? 15000, `fin de ${id}`),
    results: () => {
      const file = join(logs, 'chef-results.json');
      return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    },
    prompts: () =>
      readdirSync(logs)
        .filter((name) => name.startsWith('prompt-'))
        .sort()
        .map((name) => JSON.parse(readFileSync(join(logs, name), 'utf8'))),
    types: (id) => app.store.events(id).map((event) => event.type),
    api: async (path, body, headers = {}) => {
      const res = await fetch(base + path, {
        method: body ? 'POST' : 'GET',
        headers: { 'content-type': 'application/json', 'x-platform-request': '1', ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, body: await res.json() };
    },
  };
}
const daughterPrompts = (p) => p.prompts().filter((entry) => entry.prompt?.famille);
const states = (p, id) =>
  p.app.store
    .events(id)
    .filter((event) => event.type === 'state')
    .map((event) => event.data.state);

// ---- D1 (C1) : interrupteur `multiAgent`, éteint par défaut

test('D1. sans multiAgent : ni second serveur ni phrase du chef, même avec des étapes de chef et l’accord ; route interne 403 ; avec multiAgent : les deux', async (t) => {
  const p = await platform(t);
  // The fake agent would play the chief if the server were lent : here it answers its consigne.
  p.setConfig(() => ({ steps: [{ call: 'mission_suivre', args: {} }] }));
  for (const delegation of [undefined, ACCEPTED()]) {
    const before = p.prompts().length;
    const run = await p.app.engine.create({
      prompt: 'Tâche FICTIVE ATTENDRE:d1',
      agent: 'fixture',
      pack: 'core',
      ...(delegation ? { delegation } : {}),
    });
    await p.waitFor(() => p.prompts().length > before, 15000, 'prompt');
    const [sent] = p.prompts().slice(before);
    assert.deepEqual(sent.servers, ['platform']);
    assert.doesNotMatch(JSON.stringify(sent.prompt), /mission_lancer|sous-mission/);
    // The internal route of the mission tools, called with the mission's own token : refused.
    const token = p.app.engine.approvalTokens.get(run.id);
    assert.ok(token);
    const refused = await p.api(
      `/api/internal/missions/${run.id}`,
      { tool: 'mission_suivre', args: {} },
      { 'x-relay-token': token },
    );
    assert.equal(refused.status, 403);
    p.touch('d1');
    await p.ended(run.id);
    const row = p.app.store.get(run.id);
    assert.equal(row.state, 'completed', row.error);
    assert.equal('multiAgent' in row, false);
    assert.ok(!p.types(run.id).some((type) => FAMILY_EVENT.test(type)), p.types(run.id).join());
    assert.equal(p.results().length, 0, 'aucun appel d’outil de mission');
    rmSync(join(p.hold, 'd1'));
  }
  // With the switch : the second server and the chief's sentence, the route answers.
  const before = p.prompts().length;
  const chief = await p.app.engine.create({
    prompt: 'Mission FICTIVE du chef.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
  });
  await p.ended(chief.id);
  const row = p.app.store.get(chief.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal(row.multiAgent, true);
  const [sent] = p.prompts().slice(before);
  assert.deepEqual(sent.servers, ['platform', rule.MISSION_SERVER]);
  assert.ok(sent.prompt.instructions.endsWith('\n' + rule.chiefRule(undefined)));
  assert.equal(p.results().length, 1);
  assert.equal(p.results()[0].isError, false, JSON.stringify(p.results()[0].result));
});

test('D1. l’accord sans multiAgent ne force pas le mode agent (un DAG reste un DAG) ; multiAgent le force ; multiAgent n’est qu’un booléen', async (t) => {
  const p = await platform(t);
  const ask = (fields) =>
    p.app.engine.plan({ prompt: 'Mission FICTIVE.', agent: 'fixture', pack: 'core', ...fields });
  const accordOnly = await ask({ mode: 'workflow', delegation: ACCEPTED() });
  assert.equal(accordOnly.input.mode, 'workflow');
  assert.ok(accordOnly.dag);
  const switched = await ask({ mode: 'workflow', multiAgent: true });
  assert.equal(switched.input.mode, 'agent');
  const off = await ask({ mode: 'workflow', multiAgent: false });
  assert.equal(off.input.mode, 'workflow');
  await assert.rejects(ask({ multiAgent: 'oui' }));
});

test('D1. reprise : multiAgent recopié (outils et phrase gardés) ; une mission sans le mode reprise sans lui', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({ steps: [] }));
  for (const multiAgent of [true, undefined]) {
    const first = await p.app.engine.create({
      prompt: 'Première exécution FICTIVE.',
      agent: 'fixture',
      pack: 'core',
      ...(multiAgent ? { multiAgent } : {}),
    });
    await p.ended(first.id);
    await p.waitFor(() => !p.app.engine.active.has(first.id));
    const before = p.prompts().length;
    const resumed = await p.api(`/api/runs/${first.id}/resume`, { prompt: 'Suite FICTIVE.' });
    assert.equal(resumed.status, 201, JSON.stringify(resumed.body));
    await p.ended(resumed.body.id);
    const row = p.app.store.get(resumed.body.id);
    assert.equal(row.state, 'completed', row.error);
    assert.equal(row.resumedFrom, first.id);
    const [sent] = p.prompts().slice(before);
    if (multiAgent) {
      assert.equal(row.multiAgent, true);
      assert.deepEqual(sent.servers, ['platform', rule.MISSION_SERVER]);
    } else {
      assert.equal('multiAgent' in row, false);
      assert.deepEqual(sent.servers, ['platform']);
    }
  }
});

// ---- D2 (C2) et D6 (C6) : échec de la mère ; durée depuis le départ réel

test('D2. la mère échoue : sa sous-mission en cours et celle en file sont arrêtées avec la cause, avant son Bilan, qui le dit ; D6 : « jamais démarrée »', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE A ATTENDRE:jamais BATTEMENT', titre: 'A' },
      },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE B ATTENDRE:jamais', titre: 'B' } },
      { touch: join(p.hold, 'launched') },
      { waitFile: join(p.hold, 'echouer') },
      { fail: 'Échec FICTIF du chef' },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Deux tâches FICTIVES, puis le chef échoue.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED({ parallel: 1 }),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')));
  const [a, b] = p.results().map((r) => r.result.id);
  await p.waitFor(() => p.app.store.get(a).state === 'running');
  await p.waitFor(() => daughterPrompts(p).length === 1);
  assert.equal(p.app.store.get(b).state, 'queued');
  p.touch('echouer');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'failed');
  assert.match(row.error, /Échec FICTIF du chef/);
  for (const id of [a, b]) {
    const child = p.app.store.get(id);
    assert.equal(child.state, 'cancelled', id);
    assert.equal(child.error, rule.MOTHER_FAILED);
    // Stopped before the mother's Bilan was written.
    assert.ok(Date.parse(child.finishedAt) <= Date.parse(row.finishedAt), id);
  }
  // The queued one never started : no agent launched for it.
  assert.deepEqual(states(p, b), ['queued', 'cancelled']);
  assert.equal(daughterPrompts(p).length, 1);
  // Its agent leaves (end of its execution).
  await p.waitFor(() => !p.app.engine.active.has(a), 15000, 'sortie de A');
  const summary = row.result.summary;
  assert.match(summary, /\n1\. « A » — agent fixture, annulée, \d+ s /);
  assert.match(summary, /\n2\. « B » — agent fixture, annulée, jamais démarrée \(sous-mission /);
  assert.match(summary, /0 terminée\(s\), 0 en échec, 2 annulée\(s\)/);
  assert.ok(summary.includes('\n' + rule.motherFailedLine(2)), summary);
});

test('D2. contrôles : une mère qui échoue sans sous-mission vivante n’a pas la ligne ; une mission ordinaire qui échoue ne lit rien de la famille', async (t) => {
  const p = await platform(t);
  p.setConfig((input) =>
    input.prompt.startsWith('Mère')
      ? {
          steps: [
            { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE courte', titre: 'C' } },
            { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
            { fail: 'Échec FICTIF du chef' },
          ],
        }
      : {},
  );
  const mother = await p.app.engine.create({
    prompt: 'Mère FICTIVE dont la sous-mission a fini.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'failed');
  const [child] = p.app.store.children(mother.id);
  assert.equal(child.state, 'completed');
  assert.match(row.result.summary, /Sous-missions \(1\) :/);
  assert.doesNotMatch(row.result.summary, /arrêtée\(s\) avec l’échec/);
  // An ordinary mission that fails : no family read, no family event.
  const children = [];
  const original = p.app.store.children.bind(p.app.store);
  p.app.store.children = (id) => (children.push(id), original(id));
  const failed = await p.app.engine.create({
    prompt: 'Tâche FICTIVE ECHEC',
    agent: 'fixture',
    pack: 'core',
  });
  await p.ended(failed.id);
  assert.equal(p.app.store.get(failed.id).state, 'failed');
  assert.deepEqual(children, []);
  assert.ok(!p.types(failed.id).some((type) => FAMILY_EVENT.test(type)));
});

test('D6. durée d’une sous-mission depuis son premier état running : l’attente de sa place n’est pas comptée', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE A ATTENDRE:a', titre: 'A' } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE B', titre: 'B' } },
      { touch: join(p.hold, 'launched') },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Deux tâches FICTIVES, une place.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED({ parallel: 1 }),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')));
  const [a, b] = p.results().map((r) => r.result.id);
  await p.waitFor(() => p.app.store.get(a).state === 'running');
  // B waits for its place at least 2 s.
  await new Promise((done) => setTimeout(done, 2000));
  assert.equal(p.app.store.get(b).state, 'queued');
  p.touch('a');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  const child = p.app.store.get(b);
  assert.equal(child.state, 'completed');
  // The first `running` of its own thread.
  const running = p.app.store
    .events(b)
    .find((event) => event.type === 'state' && event.data.state === 'running');
  assert.equal(child.startedAt, running.at);
  assert.ok(Date.parse(child.startedAt) - Date.parse(child.createdAt) >= 2000);
  const worked = formatDuration(Date.parse(child.finishedAt) - Date.parse(child.startedAt));
  const sinceCreated = formatDuration(Date.parse(child.finishedAt) - Date.parse(child.createdAt));
  assert.notEqual(worked, sinceCreated);
  assert.ok(
    row.result.summary.includes(
      `\n2. « B » — agent fixture, terminée, ${worked} (sous-mission ${b})`,
    ),
    row.result.summary,
  );
});

test('D2. contrôle : l’arrêt du serveur n’est pas un échec de la mère ; ses sous-missions ne sont pas annulées pour cette cause', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE A ATTENDRE:jamais', titre: 'A' } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE B ATTENDRE:jamais', titre: 'B' } },
      { touch: join(p.hold, 'launched') },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 50 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Deux tâches FICTIVES coupées par un arrêt.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED({ parallel: 1 }),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')));
  const [a, b] = p.results().map((r) => r.result.id);
  await p.waitFor(() => daughterPrompts(p).length === 1);
  await p.app.engine.close();
  for (const id of [mother.id, a, b]) {
    const row = p.app.store.get(id);
    assert.ok(terminal.has(row.state), id);
    assert.notEqual(row.error, rule.MOTHER_FAILED, id);
  }
  assert.equal(p.app.store.get(b).state, 'interrupted');
  assert.notEqual(p.app.store.get(a).state, 'cancelled');
  assert.doesNotMatch(
    p.app.store.get(mother.id).result?.summary ?? '',
    /arrêtée\(s\) avec l’échec/,
  );
});
