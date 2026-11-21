// swarm-16 (relecture indépendante) : ce que les tests du codeur ne prouvaient pas. (R1) niveauDe : le
// motif le plus long l'emporte, la casse est ignorée ; (R2) preuve par différence : sans `niveau`,
// avec un rôle sans niveau ou un profil sans `niveaux`, ou un agent qui n'annonce aucun modèle, le
// modèle, la ligne, le résultat et les événements sont ceux de la base e7f4964 (valeurs relevées en
// rejouant les mêmes scénarios sur la base) ; (R3) point 12 du manager : agent inconnu ou au nom piégé,
// sondes absentes, illisibles ou de forme inattendue, `previous` sans modèle : aucune exception, mêmes
// refus, même ordre ; (R4) `niveau` invalide refusé par call() comme les autres paramètres. Faux
// moteur, sondes FICTIVES dans un dossier temporaire, horloge injectée. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const AGENTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'swarm-16-relecture-FICTIF-'));
writeFileSync(
  join(AGENTS_CONFIG_DIR, 'agents.json'),
  JSON.stringify({
    cliDirs: [],
    paths: Object.fromEntries(
      ['codex', 'claude', 'gemini', 'opencode'].map((c) => [c, join(AGENTS_CONFIG_DIR, 'x', c)]),
    ),
  }),
);
process.env.AGENT_PLATFORM_AGENTS_CONFIG = join(AGENTS_CONFIG_DIR, 'agents.json');
test.after(() => rmSync(AGENTS_CONFIG_DIR, { recursive: true, force: true }));

const niveaux = await import('../packages/agent-runtime/niveaux.js');
const { Delegation } = await import('../packages/orchestrator/delegation.js');
const { continueChild } = await import('../packages/orchestrator/continuation.js');

const NOW = Date.parse('2026-11-21T09:00:00.000Z');
const LIMIT = new Date(NOW + 39 * 60 * 1000).toISOString();
const NOTE = (niveau) => `niveau ${niveau} non reconnu chez cet agent : modèle par défaut`;
const probeOf = (ids) => ({
  session: true,
  models: { current: ids[0], options: ids.map((id) => ({ id, name: id })) },
});
const PROBES = {
  claude: probeOf(['default', 'opus[1m]', 'sonnet', 'haiku']),
  codex: probeOf(['gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-luna']),
  gemini: probeOf(['g-a-FICTIF', 'g-b-FICTIF']),
};
const tick = () => new Promise((r) => setImmediate(r));

function fakeEngine(t, { motherAgent = 'claude', motherModel = 'opus[1m]', workspace } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'swarm-16-relecture-FICTIF-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const dataDir = join(cwd, 'platform');
  const rows = new Map();
  const listeners = new Map();
  const events = [];
  const store = {
    get: (id) => rows.get(id),
    children: (id) => [...rows.values()].filter((r) => r.famille?.mere === id),
    update: (id, p) => {
      rows.set(id, { ...rows.get(id), ...p });
      for (const l of [...(listeners.get(id) ?? [])])
        if (p.state) l({ type: 'state', data: { state: p.state }, at: new Date().toISOString() });
    },
    on: (id, l) => {
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id).add(l);
    },
    off: (id, l) => listeners.get(id)?.delete(l),
    event: (id, type, data, at = new Date().toISOString()) => events.push({ id, type, data, at }),
    events: (id) => events.filter((e) => e.id === id),
    usage: () => ({ entries: [] }),
  };
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
      await new Promise((r) => setTimeout(r, 2));
      const id = randomUUID();
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
  delegation.agentsCache = {
    at: Date.now(),
    list: [
      ...['claude', 'codex', 'gemini', 'opencode'].map((id) => ({
        id,
        installed: true,
        compatible: true,
        simulated: false,
      })),
      { id: 'fixture', installed: true, compatible: true, simulated: true },
    ],
  };
  const mother = {
    id: randomUUID(),
    state: 'running',
    agent: motherAgent,
    model: motherModel,
    cwd,
    ...(workspace ? { workspace } : {}),
    multiAgent: true,
    delegation: { accepted: true, total: 100, parallel: 50 },
  };
  rows.set(mother.id, mother);
  const control = { abort: new AbortController(), mere: false };
  engine.active.set(mother.id, control);
  engine.approvalTokens.set(mother.id, 'jeton-FICTIF');
  const probes = (value, raw) => {
    rmSync(dataDir, { recursive: true, force: true });
    if (value !== undefined || raw !== undefined) {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, 'agent-probes.json'), raw ?? JSON.stringify(value));
    }
  };
  // The launch's outcome : the result (or the refusal), the row's agent, model and famille keys.
  const run = async (fn) => {
    try {
      const result = await fn();
      const row = rows.get(result.id);
      return {
        agent: result.agent,
        modele: result.modele,
        note: result.note,
        cles: Object.keys(result).sort(),
        rowModel: row.model,
        famille: Object.keys(row.famille).sort(),
        niveauLigne: row.famille.niveau,
      };
    } catch (error) {
      return { erreur: error.erreur ?? 'EXCEPTION', message: String(error.message) };
    }
  };
  const launch = (args) => run(() => delegation.launch(rows.get(mother.id), control, args));
  const cont = (args) => run(() => continueChild(delegation, rows.get(mother.id), control, args));
  const lastId = () => [...rows.keys()].at(-1);
  return { rows, events, delegation, mother, probes, launch, cont, lastId, store };
}
const RESULT_KEYS = [
  'agent',
  'dossierResultats',
  'espace',
  'etat',
  'famille',
  'id',
  'modele',
  'titre',
];
const BASE_ROW = ['dossierResultats', 'mere', 'racine', 'titre'];
// The outcome the base gives : model, no tier, no note, the keys of before.
const same = (
  outcome,
  { agent = 'claude', modele, note, famille = BASE_ROW, cles = RESULT_KEYS },
) => {
  assert.equal(outcome.erreur, undefined, outcome.message);
  assert.equal(outcome.agent, agent);
  assert.equal(outcome.modele, modele);
  assert.equal(outcome.rowModel, modele);
  assert.equal(outcome.note, note);
  assert.equal(outcome.niveauLigne, undefined);
  assert.deepEqual(outcome.famille, [...famille].sort());
  assert.deepEqual(outcome.cles, [...cles].sort());
};

test('swarm-16 relecture (R1) : niveauDe : le motif le plus long l’emporte, casse ignorée', () => {
  const profil = { niveaux: { leger: ['pro'], standard: ['pro-max'], fort: ['MAX'] } };
  assert.equal(niveaux.niveauDe('modele-pro-max-FICTIF', profil), 'standard');
  assert.equal(niveaux.niveauDe('MODELE-PRO-FICTIF', profil), 'leger');
  assert.equal(niveaux.niveauDe('modele-max-FICTIF', profil), 'fort');
  // At equal length, the first tier of NIVEAUX.
  assert.equal(niveaux.niveauDe('ab', { niveaux: { fort: ['b'], leger: ['a'] } }), 'leger');
  // modelePour agrees : the first announced model whose tier is that one.
  const announced = ['modele-pro-max-FICTIF', 'Modele-Pro-FICTIF'];
  assert.equal(niveaux.modelePour('leger', profil, announced), 'Modele-Pro-FICTIF');
  assert.equal(niveaux.modelePour('standard', profil, announced), 'modele-pro-max-FICTIF');
  // Hostile tables : never an exception.
  for (const bad of [{ niveaux: [] }, { niveaux: 'x' }, { niveaux: { leger: 'pro' } }, 5, null])
    assert.equal(niveaux.niveauDe('pro', bad), null);
  assert.equal(niveaux.niveauDe('pro', { niveaux: { leger: [null, 3, '', ' ', 'pro'] } }), 'leger');
  assert.equal(niveaux.niveauDe('x', { niveaux: Object.create({ leger: ['x'] }) }), null);
  assert.deepEqual(niveaux.choisirModele(null), { modele: '', source: 'defaut' });
  assert.deepEqual(niveaux.avecNiveaux(null, null), []);
});

test('swarm-16 relecture (R2) : sans niveau, rôle sans niveau ou profil sans niveaux : identique à la base', async (t) => {
  const f = fakeEngine(t);
  f.probes(PROBES);
  same(await f.launch({ consigne: 'Simple FICTIF' }), { modele: 'opus[1m]' });
  same(await f.launch({ consigne: 'Modele FICTIF', modele: 'sonnet' }), { modele: 'sonnet' });
  same(await f.launch({ consigne: 'Nomme FICTIF', agent: 'codex' }), {
    agent: 'codex',
    modele: '',
    famille: [...BASE_ROW, 'agentImpose'],
  });
  same(await f.launch({ consigne: 'G FICTIF', agent: 'gemini', role: 'chercheur' }), {
    agent: 'gemini',
    modele: '',
    famille: [...BASE_ROW, 'agentImpose', 'role'],
  });
  same(await f.launch({ consigne: 'Libre FICTIF', role: 'nom-libre-fictif' }), {
    modele: 'opus[1m]',
    famille: [...BASE_ROW, 'role'],
  });
  // The same events as the base (types and data without the tier).
  assert.deepEqual(
    f.events.map((e) => e.type),
    ['delegation_accepted', ...Array(5).fill('child_launched')],
  );
  for (const event of f.events) assert.equal('niveau' in (event.data ?? {}), false);

  // An agent with tiers that announces no model (no probes file) : a platform role is as before.
  const g = fakeEngine(t);
  g.probes(undefined);
  same(await g.launch({ consigne: 'C FICTIF', role: 'chercheur' }), {
    modele: 'opus[1m]',
    famille: [...BASE_ROW, 'role'],
  });
  await g.launch({ consigne: 'Auteur FICTIF', titre: 'Travail', agent: 'claude' });
  same(await g.launch({ consigne: 'Relis FICTIF', role: 'verificateur', relit: [g.lastId()] }), {
    agent: 'codex',
    modele: '',
    famille: [...BASE_ROW, 'apres', 'relit', 'role', 'verdictAttendu'],
  });

  // The replacement agent (swarm-08), no tier : the model given is left, as before.
  const r = fakeEngine(t);
  r.probes({
    ...PROBES,
    claude: { ...PROBES.claude, limite: { classe: 'limite', jusqua: LIMIT } },
  });
  for (const args of [{}, { modele: 'sonnet' }]) {
    const outcome = await r.launch({ consigne: `R ${Object.keys(args)} FICTIF`, ...args });
    assert.equal(outcome.agent, 'codex');
    assert.equal(outcome.modele, '');
    assert.match(outcome.note, /^Agent prévu claude indisponible .* lancé sur codex\.$/);
    assert.equal(outcome.niveauLigne, undefined);
  }

  // A suite (same agent : the previous model ; another agent named : '') and a resumption whose
  // previous attempt has no model ('').
  const s = fakeEngine(t);
  s.probes(PROBES);
  await s.launch({ consigne: 'Premier FICTIF' });
  s.store.update(s.lastId(), { state: 'completed' });
  await tick();
  same(await s.cont({ id: s.lastId(), message: 'Suite FICTIVE' }), {
    modele: 'opus[1m]',
    famille: [...BASE_ROW, 'continue', 'reprise'],
    cles: [...RESULT_KEYS, 'suiteDe'],
  });
  s.store.update(s.lastId(), { state: 'completed' });
  await tick();
  same(await s.cont({ id: s.lastId(), message: 'Suite codex FICTIVE', agent: 'codex' }), {
    agent: 'codex',
    modele: '',
    famille: [...BASE_ROW, 'continue', 'reprise', 'agentImpose'],
    cles: [...RESULT_KEYS, 'suiteDe'],
  });
  await s.launch({ consigne: 'Second FICTIF', modele: 'haiku' });
  s.store.update(s.lastId(), { state: 'failed', error: 'E FICTIVE', model: undefined });
  await tick();
  same(await s.launch({ consigne: 'Second FICTIF', reprend: s.lastId() }), {
    modele: '',
    famille: [...BASE_ROW, 'reprend', 'reprise'],
  });
  // previous without a model, platform role (tier standard) : the previous attempt's '' wins.
  await s.launch({ consigne: 'Cherche FICTIF', role: 'chercheur', modele: 'haiku' });
  s.store.update(s.lastId(), { state: 'failed', error: 'E FICTIVE', model: undefined });
  await tick();
  same(await s.launch({ consigne: 'Cherche FICTIF', role: 'chercheur', reprend: s.lastId() }), {
    modele: '',
    famille: [...BASE_ROW, 'reprend', 'reprise', 'role'],
  });

  // A private mission : the same.
  const p = fakeEngine(t, { workspace: 'espace-FICTIF' });
  p.probes(PROBES);
  same(await p.launch({ consigne: 'Privee FICTIF', role: 'nom-libre' }), { modele: 'opus[1m]' });
  same(await p.launch({ consigne: 'Privee2 FICTIF' }), { modele: 'opus[1m]' });
});

test('swarm-16 relecture (R3) : agent inconnu, sondes illisibles ou de forme inattendue : ni exception, ni refus neuf', async (t) => {
  const f = fakeEngine(t);
  f.probes(PROBES);
  for (const agent of [
    'inconnu-FICTIF',
    '__proto__',
    'constructor',
    'toString',
    'hasOwnProperty',
  ]) {
    same(await f.launch({ consigne: `A ${agent} FICTIF`, agent }), {
      agent,
      modele: '',
      famille: [...BASE_ROW, 'agentImpose'],
    });
    // With a tier asked : never an exception ; no profile, so the sentence and today's rule.
    const tiered = await f.launch({ consigne: `AN ${agent} FICTIF`, agent, niveau: 'fort' });
    assert.equal(tiered.erreur, undefined, tiered.message);
    assert.equal(tiered.modele, '');
    assert.equal(tiered.note, NOTE('fort'));
  }
  const shapes = {
    absent: [undefined],
    illisible: [undefined, '{pas du json'],
    tableau: [[1, 2]],
    nul: [null],
    chaine: ['texte'],
    sondeNulle: [{ claude: null }],
    modelsAbsent: [{ claude: { session: true } }],
    modelsChaine: [{ claude: { models: 'x' } }],
    optionsObjet: [{ claude: { models: { options: { id: 'opus' } } } }],
    protoPollue: [undefined, '{"__proto__":{"models":{"options":[{"id":"opus"}]}}}'],
  };
  for (const [name, [value, raw]] of Object.entries(shapes)) {
    f.probes(value, raw);
    same(await f.launch({ consigne: `S ${name} FICTIF` }), { modele: 'opus[1m]' });
    // A platform role on an agent that announces nothing readable : silent, as before.
    same(await f.launch({ consigne: `SR ${name} FICTIF`, role: 'chercheur' }), {
      modele: 'opus[1m]',
      famille: [...BASE_ROW, 'role'],
    });
    const tiered = await f.launch({ consigne: `SN ${name} FICTIF`, niveau: 'leger' });
    assert.equal(tiered.modele, 'opus[1m]', name);
    assert.equal(tiered.note, NOTE('leger'), name);
    const agents = await f.delegation.agents();
    for (const agent of agents) assert.deepEqual(agent.modeles, [], name);
  }
  // Malformed entries announced : listed as before, never a tier.
  f.probes({ claude: { models: { options: [null, 1, 'opus', {}, { id: 3 }, { id: null }] } } });
  const claude = (await f.delegation.agents()).find((a) => a.id === 'claude');
  assert.deepEqual(claude.modeles, [
    { id: undefined, nom: undefined },
    { id: 3, nom: 3 },
    { id: null, nom: null },
  ]);
  // The refusals keep their order and text : an agent named by the chief and under limit is
  // refused with the same message, a tier or a role changes nothing.
  f.probes({
    ...PROBES,
    claude: { ...PROBES.claude, limite: { classe: 'limite', jusqua: LIMIT } },
  });
  const plain = await f.launch({ consigne: 'RN FICTIF', agent: 'claude' });
  assert.equal(plain.erreur, 'agent_indisponible');
  for (const extra of [
    { role: 'chercheur' },
    { niveau: 'fort' },
    { role: 'developpeur', niveau: 'leger' },
  ])
    assert.deepEqual(await f.launch({ consigne: 'RN FICTIF', agent: 'claude', ...extra }), plain);
  const missing = await f.launch({
    consigne: 'RI FICTIF',
    niveau: 'fort',
    reprend: '00000000-0000-4000-8000-000000000000',
  });
  assert.deepEqual(missing, {
    erreur: 'introuvable',
    message: 'Aucune sous-mission de cette mission : 00000000-0000-4000-8000-000000000000',
  });
});

test('swarm-16 relecture (R4) : mission_lancer par call() : niveau valide transmis, invalide refusé', async (t) => {
  const f = fakeEngine(t, { motherModel: 'haiku' });
  f.probes(PROBES);
  const body = (args) => ({ tool: 'mission_lancer', args: { consigne: 'Part FICTIVE', ...args } });
  const bad = await f.delegation.call(f.mother.id, 'jeton-FICTIF', body({ niveau: 'ultra' }));
  assert.equal(bad.body.erreur, 'parametres_invalides');
  assert.match(bad.body.message, /^niveau — /);
  const typed = await f.delegation.call(f.mother.id, 'jeton-FICTIF', body({ niveau: 3 }));
  assert.equal(typed.body.erreur, 'parametres_invalides');
  const good = await f.delegation.call(f.mother.id, 'jeton-FICTIF', body({ niveau: 'fort' }));
  assert.equal(good.body.result.modele, 'opus[1m]');
  assert.equal(good.body.result.niveau, 'fort');
});
