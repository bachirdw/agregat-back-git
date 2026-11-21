// swarm-14 (relecture indépendante) : cas que les tests du lot ne couvraient pas. Le compteur
// d'attente de `wait()` ne change rien pour un chef qui attend sans sous-mission ; deux attentes qui
// se chevauchent ; `usage()` qui rend un tableau ; un tour en erreur n'est pas compté ; un
// `child_done.usage` hostile relu après redémarrage. Faux agent ACP (tests/fixtures/chef-agent.js).
// Aucun modèle, aucun réseau, aucun CLI réel. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-14-rel-agents-FICTIF-')));
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
const { AcpRuntime } = await import('../packages/agent-runtime/index.js');
const { Delegation } = await import('../packages/orchestrator/delegation.js');
const { familySection } = await import('../packages/orchestrator/family-bilan.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const ACCEPTED = { accepted: true, via: 'api', total: 10, parallel: 3 };
const TOUR = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

async function platform(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-14-rel-FICTIF-')));
  const logs = join(root, 'logs');
  const hold = join(root, 'hold');
  mkdirSync(logs);
  mkdirSync(hold);
  const app = createApp({
    dataDir: join(root, 'platform'),
    career: new CareerWorkspace({ root, roots: [root] }),
  });
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  let config = {};
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (input, options) => {
    const plan = await originalPlan(input, options);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [CHEF],
      fixedEnv: {
        ...plan.agent.fixedEnv,
        CHEF_AGENT: JSON.stringify({ dir: logs, holdDir: hold, ...config }),
      },
    };
    return plan;
  };
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const waitFor = async (check, ms = 20000, what = '') => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const value = await check();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('Attente dépassée ' + what);
  };
  return {
    app,
    logs,
    hold,
    waitFor,
    configure: (value) => (config = value),
    ended: (id) => waitFor(() => terminal.has(app.store.get(id)?.state), 20000, `fin de ${id}`),
    team: () =>
      app.engine.create({
        prompt: 'Tâche FICTIVE en équipe.',
        agent: 'fixture',
        pack: 'core',
        multiAgent: true,
        delegation: ACCEPTED,
      }),
    types: (id) => app.store.events(id).map((e) => e.type),
  };
}

test('usage() qui rend un tableau : aucun événement `usage`, issue inchangée', async (t) => {
  const p = await platform(t);
  const alone = () =>
    p.app.engine.create({ prompt: 'Tâche FICTIVE seule.', agent: 'fixture', pack: 'core' });
  const base = await alone();
  await p.ended(base.id);
  const original = AcpRuntime.prototype.usage;
  t.after(() => (AcpRuntime.prototype.usage = original));
  AcpRuntime.prototype.usage = () => [{ tours: 1 }];
  const run = await alone();
  await p.ended(run.id);
  await p.waitFor(() => !p.app.engine.active.has(run.id), 5000, 'nettoyage');
  assert.deepEqual(p.types(run.id), p.types(base.id));
  assert.equal(p.app.store.get(run.id).result.summary, p.app.store.get(base.id).result.summary);
});

test('chef qui attend sans aucune sous-mission : même Bilan, même réponse, famille oubliée à la fin', async (t) => {
  const p = await platform(t);
  // Référence : un chef qui n'appelle rien.
  p.configure({ steps: [] });
  const ref = await p.team();
  await p.ended(ref.id);
  // Un chef qui appelle seulement mission_attendre (et qui annonce sa consommation).
  p.configure({
    steps: [{ call: 'mission_attendre', args: {} }],
    usage: { chef: { tour: TOUR } },
  });
  const run = await p.team();
  await p.ended(run.id);
  const delegation = p.app.engine.delegation;
  const summary = p.app.store.get(run.id).result.summary;
  assert.equal(summary, p.app.store.get(ref.id).result.summary);
  assert.ok(!summary.includes('Consommation'), 'sans sous-mission : aucune section');
  assert.ok(!summary.includes('Attente du chef'));
  const answers = JSON.parse(readFileSync(join(p.logs, 'chef-results.json'), 'utf8'));
  const attendre = answers.find((entry) => entry.call === 'mission_attendre');
  assert.deepEqual(
    { terminees: attendre.result.terminees, enCours: attendre.result.enCours },
    { terminees: [], enCours: [] },
  );
  assert.equal(attendre.result.delaiAtteint, false);
  // La famille créée pour le compteur est oubliée comme les autres à la fin de la mère.
  await p.waitFor(() => !delegation.families.has(run.id), 5000, 'famille oubliée');
  assert.equal(delegation.families.has(ref.id), false);
});

test('deux attentes qui se chevauchent : chaque appel compte, les durées s’additionnent', async (t) => {
  const p = await platform(t);
  const delegation = p.app.engine.delegation;
  let clock = Date.parse('2026-11-21T10:00:00Z');
  delegation.now = () => clock;
  const go = join(p.hold, 'go');
  p.configure({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Partie FICTIVE ATTENDRE:a', titre: 'A' },
        save: 'a',
      },
      { waitFile: go },
    ],
  });
  const mother = await p.team();
  const child = await p.waitFor(
    () => delegation.childrenOf(p.app.store.get(mother.id))[0],
    20000,
    'sous-mission',
  );
  const control = p.app.engine.active.get(mother.id);
  const row = p.app.store.get(mother.id);
  const args = { ids: [child.id], delaiSecondes: 60 };
  const first = delegation.wait(row, control, args);
  const second = delegation.wait(row, control, args);
  await p.waitFor(() => delegation.families.get(mother.id)?.waiting === 2, 5000, 'deux attentes');
  clock += 30000;
  writeFileSync(join(p.hold, 'a'), 'go');
  const [r1, r2] = await Promise.all([first, second]);
  assert.equal(r1.delaiAtteint, false);
  assert.equal(r2.delaiAtteint, false);
  // 30 s d'horloge, deux attentes : 60 s comptées (somme des attentes, pas le temps mur).
  assert.deepEqual(delegation.families.get(mother.id).attente, { appels: 2, ms: 60000 });
  writeFileSync(go, 'go');
  await p.ended(mother.id);
});

test('runtime : un tour en erreur n’est pas compté, le tour réussi reste', async () => {
  const runtime = new AcpRuntime({
    definition: {
      id: 'chef-fictif',
      name: 'Chef FICTIF',
      command: process.execPath,
      args: [CHEF],
      env: ['CHEF_AGENT'],
    },
    cwd: mkdtempSync(join(tmpdir(), 'swarm-14-rel-rt-FICTIF-')),
    timeouts: { initialize: 3000, session: 3000, request: 3000, prompt: 6000 },
    env: { ...process.env, CHEF_AGENT: JSON.stringify({ usage: { membre: { tour: TOUR } } }) },
  });
  try {
    await runtime.start();
    await runtime.session([]);
    await runtime.prompt(JSON.stringify({ objective: 'Tour FICTIF' }));
    runtime.continueSession();
    await assert.rejects(runtime.prompt(JSON.stringify({ objective: 'Tour FICTIF ECHEC' })));
    assert.deepEqual(runtime.usage(), {
      tours: 1,
      jetons: { entree: 10, sortie: 20, total: 30 },
      cout: null,
      contexte: null,
    });
  } finally {
    runtime.close();
  }
});

test('child_done.usage hostile relu après redémarrage : jamais d’exception, rien de faux au Bilan', () => {
  const children = [
    { id: 'a', titre: 'A', agent: 'codex', state: 'completed', durationMs: 60000, bilan: 'FICTIF' },
  ];
  const before = familySection({ children });
  const giant = Object.fromEntries(
    Array.from({ length: 5000 }, (_, i) => [`k${i}`, 'x'.repeat(50)]),
  );
  for (const usage of [
    'Texte privé FICTIF',
    [1, 2, 3],
    42,
    null,
    giant,
    { jetons: [96000], cout: 'beaucoup' },
    { jetons: { total: '96000' }, cout: { montant: 1, devise: 'Texte privé FICTIF' } },
  ]) {
    const fake = {
      finals: new Map(),
      engine: {},
      store: {
        events: () => [{ type: 'child_done', data: { childId: 'a', usage } }],
      },
    };
    let read;
    assert.doesNotThrow(() => {
      read = Delegation.prototype.doneOf.call(fake, { id: 'a', famille: { mere: 'm' } });
    });
    // Seul un objet (pas un tableau) est relu ; le Bilan n'en écrit rien qui ne soit un nombre annoncé.
    if (typeof usage !== 'object' || usage === null || Array.isArray(usage))
      assert.equal(read.usage, undefined);
    assert.equal(
      familySection({
        children: children.map((child) => ({ ...child, usage: read.usage })),
        chef: { agent: 'claude', usage: null, attente: { appels: 1, ms: 1000 } },
      }),
      before,
    );
  }
});
