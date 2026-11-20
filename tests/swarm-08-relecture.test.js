// swarm-08 (relecture indépendante) : ce que les tests du lot ne couvraient pas. Un contrôle du lancement
// qui lève une erreur inattendue (sondes mal formées, cache mal formé) laisse passer le lancement ; le
// levier sans agent nommé lance l'agent prévu ; une cause d'échec mal typée ne lève pas. Faux moteur
// FICTIF (repris de tests/swarm-08-agents.test.js), sondes fictives, horloge injectée, aucun CLI lancé.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const AGENTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'swarm-08-relecture-FICTIF-'));
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

const { Delegation } = await import('../packages/orchestrator/delegation.js');

const IDS = ['claude', 'codex', 'gemini', 'opencode'];
const NOW = Date.parse('2026-11-20T18:48:00.000Z');
const LIMIT = new Date(NOW + 39 * 60 * 1000).toISOString();
const detected = (ids) =>
  ids.map((id) => ({ id, installed: true, compatible: true, simulated: false }));

function fakeEngine(t, { ids = IDS, motherAgent = IDS[1] } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'swarm-08-relecture-FICTIF-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const dataDir = join(cwd, 'platform');
  const rows = new Map();
  const events = [];
  const store = {
    get: (id) => rows.get(id),
    children: (id) => [...rows.values()].filter((r) => r.famille?.mere === id),
    update: (id, p) => rows.set(id, { ...rows.get(id), ...p }),
    on: () => {},
    off: () => {},
    event: (id, type, data, at = new Date().toISOString()) => events.push({ id, type, data, at }),
    events: (id) => events.filter((e) => e.id === id),
    usage: () => ({ entries: [] }),
  };
  const created = [];
  const engine = {
    store,
    dataDir,
    live: true,
    active: new Map(),
    approvalTokens: new Map(),
    permissions: new Map(),
    ownerMode: false,
    pendingPermission: () => null,
    turnObjective: (run) => run.prompt ?? null,
    modelAnswerOf: () => '',
    enqueueQuestion: () => new Promise(() => {}),
    async create(input, prev, link) {
      const id = randomUUID();
      created.push({ id, agent: input.agent, model: input.model });
      rows.set(id, {
        id,
        state: 'queued',
        agent: input.agent,
        model: input.model,
        prompt: input.prompt,
        cwd: link.cwd,
        famille: link.link,
        createdAt: new Date().toISOString(),
      });
      link.held = { run: rows.get(id), plan: {}, control: {} };
      return { id, cwd: link.cwd };
    },
    launch() {},
    cancel(id, reason) {
      store.update(id, { state: 'cancelled', error: reason });
    },
  };
  const delegation = new Delegation(engine);
  delegation.now = () => NOW;
  delegation.agentsCache = { at: Date.now(), list: detected(ids) };
  const mother = {
    id: randomUUID(),
    state: 'running',
    agent: motherAgent,
    cwd,
    multiAgent: true,
    delegation: { accepted: true, total: 10, parallel: 5 },
  };
  rows.set(mother.id, mother);
  const control = { abort: new AbortController(), mere: false };
  engine.active.set(mother.id, control);
  const probes = (value) => {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'agent-probes.json'), JSON.stringify(value));
  };
  const launch = (args) => delegation.launch(rows.get(mother.id), control, args);
  return { rows, events, created, delegation, mother, probes, launch, engine };
}

test('swarm-08 relecture : sondes mal formées (models.options non tableau) : le lancement passe', async (t) => {
  const [a, b, c] = IDS;
  const f = fakeEngine(t, { motherAgent: b });
  // The planned agent is under limit ; another agent's probe is malformed.
  f.probes({
    [b]: { limite: { classe: 'limite', jusqua: LIMIT } },
    [c]: { models: { options: { id: 'pas-un-tableau' } } },
    [a]: { models: { options: [null, 'texte'] } },
  });
  const launched = await f.launch({ consigne: 'Partie FICTIVE' });
  assert.equal(f.created.length, 1);
  assert.equal(typeof launched.agent, 'string');
  // mission_suivre still answers.
  const list = await f.delegation.agents();
  assert.equal(list.length, IDS.length);
  // A named agent under limit with the same malformed probes : the refusal (or a launch), never a TypeError.
  try {
    await f.launch({ consigne: 'Autre partie FICTIVE', agent: b });
  } catch (error) {
    assert.equal(error.erreur, 'agent_indisponible');
  }
});

test('swarm-08 relecture : cache mal formé : le lancement d’un agent nommé passe', async (t) => {
  const [, b] = IDS;
  const f = fakeEngine(t);
  f.probes({});
  f.delegation.agentsCache = { at: Date.now(), list: { pas: 'une liste' } };
  const launched = await f.launch({ consigne: 'Partie FICTIVE', agent: b });
  assert.equal(launched.agent, b);
  assert.equal(f.created.length, 1);
});

test('swarm-08 relecture : levier sans agent nommé : l’agent prévu est lancé, sans repli ni note', async (t) => {
  const [, b] = IDS;
  const f = fakeEngine(t, { motherAgent: b });
  f.probes({ [b]: { limite: { classe: 'limite', jusqua: LIMIT } } });
  const launched = await f.launch({ consigne: 'Partie FICTIVE', malgreIndisponible: true });
  assert.equal(launched.agent, b);
  assert.equal(launched.note, undefined);
  const famille = f.rows.get(launched.id).famille;
  assert.equal('agentPrevu' in famille, false);
  assert.equal('agentImpose' in famille, false);
});

test('swarm-08 relecture : échec mal typé dans child_done : ni levée ni champ neuf', async (t) => {
  const f = fakeEngine(t);
  f.probes({});
  const launched = await f.launch({ consigne: 'Partie FICTIVE' });
  f.rows.set(launched.id, { ...f.rows.get(launched.id), state: 'failed', error: 'Erreur FICTIVE' });
  for (const echec of ['texte', 42, null, { classe: '' }, []]) {
    f.delegation.finals.clear();
    f.events.length = 0;
    f.events.push({
      id: launched.id,
      type: 'child_done',
      data: { childId: launched.id, state: 'failed', envois: {}, fichiers: [], echec },
      at: new Date().toISOString(),
    });
    const done = f.delegation.doneOf(f.rows.get(launched.id));
    assert.equal('echec' in done, false, JSON.stringify(echec));
    const cause = f.delegation.outcome(f.rows.get(launched.id)).cause;
    assert.deepEqual(Object.keys(cause).sort(), ['agent', 'message', 'reprise', 'type']);
  }
});

test('swarm-08 relecture : contrôle qui lève (horloge illisible) : l’agent nommé est lancé', async (t) => {
  const [, b] = IDS;
  const f = fakeEngine(t);
  f.probes({ [b]: { limite: { classe: 'limite', jusqua: LIMIT } } });
  f.delegation.now = () => {
    throw new Error('horloge FICTIVE illisible');
  };
  const launched = await f.launch({ consigne: 'Partie FICTIVE', agent: b });
  assert.equal(launched.agent, b);
  assert.equal(f.created.length, 1);
});

test('swarm-08 relecture : repli : le modèle prévu n’est pas passé à l’agent de repli', async (t) => {
  const [a, b] = IDS;
  const f = fakeEngine(t, { motherAgent: b });
  f.rows.set(f.mother.id, { ...f.rows.get(f.mother.id), model: 'modele-mere-FICTIF' });
  f.probes({ [b]: { limite: { classe: 'limite', jusqua: LIMIT } } });
  const launched = await f.launch({ consigne: 'Partie FICTIVE' });
  assert.equal(launched.agent, a);
  assert.equal(launched.modele, '');
  assert.equal(f.created[0].model || '', '');
  // Not under limit : the mother's model is kept (as before).
  const g = fakeEngine(t, { motherAgent: b });
  g.rows.set(g.mother.id, { ...g.rows.get(g.mother.id), model: 'modele-mere-FICTIF' });
  g.probes({});
  const same = await g.launch({ consigne: 'Partie FICTIVE' });
  assert.equal(same.agent, b);
  assert.equal(same.modele, 'modele-mere-FICTIF');
});
