// swarm-13 : tour de rattrapage sur un verdict négatif. Une mission « Équipe d'agents » ne se termine
// plus en silence sur un verdict « à corriger » : quand le chef conclut avec une telle dette et rien
// d'autre à lui remettre, la même session reçoit UN tour de plus (verdictsEnAttente) ; un tour de
// synthèse qui a lieu de toute façon les porte aussi ; le Bilan dit « Réponse finale donnée malgré… ».
// Traces ordonnées : faux agent ACP (tests/fixtures/chef-agent.js) derrière la vraie plateforme, ou
// faux moteur en mémoire autour de la vraie classe Delegation (session fermée, réglage, garde).
// Aucun modèle, aucun réseau, aucun CLI réel. Données FICTIVES.
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

const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-13-agents-FICTIF-')));
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
delete process.env.AGENT_PLATFORM_VERDICT_TURN;
test.after(() => rmSync(AGENTS_CONFIG_DIR, { recursive: true, force: true }));

const { createApp } = await import('../apps/api/server.js');
const { CareerWorkspace } = await import('../packages/career-ops/workspace.js');
const { terminal } = await import('../packages/storage/index.js');
const rule = await import('../packages/orchestrator/delegation-rule.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const ACCEPTED = { accepted: true, via: 'api', total: 10, parallel: 3 };
const A_CORRIGER = JSON.stringify({
  verdict: 'a_corriger',
  bloquants: [{ ou: 'rapport.md', pourquoi: 'Chiffre FICTIF non sourcé : citer la source.' }],
});
const APPROUVE = JSON.stringify({ verdict: 'approuve' });

async function platform(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-13-FICTIF-')));
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
  const waitFor = async (check, ms = 15000, what = '') => {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const value = await check();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('Attente dépassée ' + what);
  };
  const prompts = () =>
    readdirSync(logs)
      .filter((name) => name.startsWith('prompt-'))
      .map((name) => JSON.parse(readFileSync(join(logs, name), 'utf8')));
  return {
    app,
    hold,
    waitFor,
    touch: (name) => writeFileSync(join(hold, name), 'go'),
    ended: (id, ms) =>
      waitFor(() => terminal.has(app.store.get(id)?.state), ms ?? 15000, `fin de ${id}`),
    results: () => {
      const file = join(logs, 'chef-results.json');
      return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    },
    // The chief's turns given by the platform (turnKind 'family_results'), in order.
    familyTurns: () =>
      prompts()
        .filter((p) => p.servers.includes('relay-missions'))
        .map((p) => p.prompt)
        .filter((p) => p?.platform?.turnKind === 'family_results'),
    async mother(steps, extra = {}) {
      config = () => ({ steps, ...extra });
      return app.engine.create({
        prompt: 'Tâche FICTIVE en équipe.',
        agent: 'fixture',
        pack: 'core',
        multiAgent: true,
        delegation: ACCEPTED,
      });
    },
    types: (id) => app.store.events(id).map((e) => e.type),
  };
}

// The trace of the real case f419245a : the chief launches a work, waits for it, launches its
// verification, waits for the verdict « a_corriger », then concludes.
const reelSteps = (verdict = A_CORRIGER) => [
  {
    call: 'mission_lancer',
    args: { consigne: 'Écris FICTIF le rapport', titre: 'Rapport' },
    save: 't',
  },
  { call: 'mission_attendre', args: { ids: ['$t'], toutes: true, delaiSecondes: 30 } },
  {
    call: 'mission_lancer',
    args: {
      consigne: `Relis FICTIF\nVERDICT_JSON:${verdict}`,
      titre: 'Vérif',
      role: 'verificateur',
      relit: ['$t'],
    },
    save: 'v',
  },
  { call: 'mission_attendre', args: { ids: ['$v'], toutes: true, delaiSecondes: 30 } },
];

// ---- 1. cas réel f419245a (rouge d'abord)

test('swarm-13 (1, cas réel f419245a) : verdict a_corriger attendu puis conclusion → exactement un tour avec verdictsEnAttente, puis la fin', async (t) => {
  const p = await platform(t);
  const mother = await p.mother(reelSteps());
  await p.ended(mother.id, 40000);
  assert.equal(p.app.store.get(mother.id).state, 'completed');
  const [t1, v1] = p
    .results()
    .filter((r) => r.call === 'mission_lancer')
    .map((r) => r.result.id);
  const turns = p.familyTurns();
  assert.equal(turns.length, 1, 'un seul tour donné au chef');
  const [turn] = turns;
  assert.equal(turn.instructions, rule.VERDICT_TURN);
  assert.equal(turn.familyResults.terminees, undefined);
  assert.deepEqual(turn.familyResults.verdictsEnAttente, [
    {
      tache: t1,
      titre: 'Rapport',
      valeur: 'a_corriger',
      complet: true,
      bloquants: [{ ou: 'rapport.md', pourquoi: 'Chiffre FICTIF non sourcé : citer la source.' }],
      par: v1,
    },
  ]);
  // Ordered trace : the verification ended, then the turn was given, then the mission ended.
  const types = p.types(mother.id);
  const done = types.lastIndexOf('child_done');
  const given = types.indexOf('verdict_turn');
  assert.ok(done >= 0 && given > done, types.join(','));
  assert.deepEqual(p.app.store.events(mother.id)[given].data, { taches: [t1.slice(0, 8)] });
  // The answer of that turn replaces the final answer.
  assert.match(p.app.store.get(mother.id).result.summary, /Synthèse FICTIVE après rappel/);
});

const malgre = (titres, donne) =>
  `Réponse finale donnée malgré ${titres.length} travail(aux) dont le dernier verdict n’est pas « approuve » (${titres.map((x) => `« ${x} »`).join(', ')}) ; tour de rattrapage donné au chef : ${donne}.`;

// ---- 2. pas de second tour

test('swarm-13 (2) : après le tour, le chef conclut de nouveau sur la même dette → pas de second tour ; Bilan « tour donné : oui »', async (t) => {
  const p = await platform(t);
  const mother = await p.mother(reelSteps(), {
    reminderSteps: [{ call: 'mission_suivre', args: {} }],
  });
  await p.ended(mother.id, 40000);
  assert.equal(p.familyTurns().length, 1);
  assert.equal(p.types(mother.id).filter((type) => type === 'verdict_turn').length, 1);
  // The chief did call a tool in its catch-up turn, then concluded on the same debt.
  assert.equal(p.results().filter((r) => r.call === 'mission_suivre').length, 1);
  const summary = p.app.store.get(mother.id).result.summary;
  assert.ok(summary.includes(malgre(['Rapport'], 'oui')), summary);
  assert.equal(summary.split('Réponse finale donnée malgré').length, 2);
});

// ---- 3. verdict approuvé : rien ne change

test('swarm-13 (3) : dernier verdict approuve → aucun tour, aucune ligne ; a_corriger puis suite revérifiée approuve → aucun tour', async (t) => {
  const p = await platform(t);
  const mother = await p.mother(reelSteps(APPROUVE));
  await p.ended(mother.id, 40000);
  assert.equal(p.familyTurns().length, 0);
  assert.equal(p.types(mother.id).includes('verdict_turn'), false);
  assert.doesNotMatch(p.app.store.get(mother.id).result.summary, /Réponse finale donnée malgré/);

  const q = await platform(t);
  const corrigee = await q.mother([
    ...reelSteps(),
    {
      call: 'mission_continuer',
      args: { id: '$t', message: 'Corrige FICTIF le chiffre' },
      save: 's',
    },
    { call: 'mission_attendre', args: { ids: ['$s'], toutes: true, delaiSecondes: 30 } },
    {
      call: 'mission_lancer',
      args: {
        consigne: `Relis FICTIF la suite\nVERDICT_JSON:${APPROUVE}`,
        titre: 'Vérif 2',
        role: 'verificateur',
        relit: ['$s'],
      },
      save: 'v2',
    },
    { call: 'mission_attendre', args: { ids: ['$v2'], toutes: true, delaiSecondes: 30 } },
  ]);
  await q.ended(corrigee.id, 60000);
  const continued = q.results().find((r) => r.call === 'mission_continuer');
  assert.equal(continued.isError, false, JSON.stringify(continued.result));
  assert.equal(q.familyTurns().length, 0);
  assert.equal(q.types(corrigee.id).includes('verdict_turn'), false);
  const summary = q.app.store.get(corrigee.id).result.summary;
  assert.doesNotMatch(summary, /Réponse finale donnée malgré/);
  assert.doesNotMatch(summary, /non revérifié depuis/);
});

// ---- 4. tour de synthèse de toute façon : un seul tour, qui porte aussi les verdicts

test('swarm-13 (4) : sous-mission vivante à la fin du tour et dette de verdict → un seul tour de synthèse avec terminees et verdictsEnAttente', async (t) => {
  const p = await platform(t);
  const mother = await p.mother([
    ...reelSteps(),
    {
      call: 'mission_lancer',
      args: { consigne: 'Annexe FICTIVE ATTENDRE:annexe', titre: 'Annexe' },
      save: 'l',
    },
  ]);
  await p.waitFor(() => p.types(mother.id).includes('family_waiting'), 40000, 'attente');
  assert.equal(p.familyTurns().length, 0);
  p.touch('annexe');
  await p.ended(mother.id, 40000);
  const [t1, v1, l1] = p
    .results()
    .filter((r) => r.call === 'mission_lancer')
    .map((r) => r.result.id);
  const turns = p.familyTurns();
  assert.equal(turns.length, 1);
  const [turn] = turns;
  assert.equal(turn.instructions, rule.SYNTHESIS_TURN + ' ' + rule.VERDICT_NOTE);
  assert.deepEqual(
    turn.familyResults.terminees.map((x) => x.id),
    [l1],
  );
  assert.deepEqual(
    turn.familyResults.verdictsEnAttente.map(({ tache, par, valeur }) => ({ tache, par, valeur })),
    [{ tache: t1, par: v1, valeur: 'a_corriger' }],
  );
  // The joined keys come after those of today, in the same turn.
  assert.equal(Object.keys(turn.familyResults).at(-1), 'verdictsEnAttente');
  const types = p.types(mother.id);
  assert.equal(types.filter((type) => type === 'verdict_turn').length, 1);
  assert.ok(types.indexOf('family_waiting') < types.indexOf('verdict_turn'));
  assert.ok(p.app.store.get(mother.id).result.summary.includes(malgre(['Rapport'], 'oui')));
});

// ---- 7. sans vérification : aucun changement

test('swarm-13 (7) : mission multiAgent sans vérification → mêmes tours et mêmes événements qu’aujourd’hui', async (t) => {
  const p = await platform(t);
  const seule = await p.mother([
    { call: 'mission_lancer', args: { consigne: 'Écris FICTIF', titre: 'Rapport' }, save: 't' },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
  ]);
  await p.ended(seule.id, 40000);
  assert.equal(p.familyTurns().length, 0);
  assert.equal(p.types(seule.id).includes('verdict_turn'), false);
  assert.doesNotMatch(p.app.store.get(seule.id).result.summary, /Réponse finale donnée malgré/);

  const q = await platform(t);
  const vivante = await q.mother([
    { call: 'mission_lancer', args: { consigne: 'Écris FICTIF ATTENDRE:fin', titre: 'Rapport' } },
  ]);
  await q.waitFor(() => q.types(vivante.id).includes('family_waiting'), 40000, 'attente');
  q.touch('fin');
  await q.ended(vivante.id, 40000);
  const [turn] = q.familyTurns();
  assert.equal(q.familyTurns().length, 1);
  assert.equal(turn.instructions, rule.SYNTHESIS_TURN);
  assert.equal('verdictsEnAttente' in turn.familyResults, false);
  assert.equal(q.types(vivante.id).includes('verdict_turn'), false);
  assert.doesNotMatch(q.app.store.get(vivante.id).result.summary, /Réponse finale donnée malgré/);
});

// ---- faux moteur en mémoire autour de la vraie classe Delegation

const { Delegation } = await import('../packages/orchestrator/delegation.js');
const { packs } = await import('../packages/orchestrator/packs.js');
const { MAX_BLOQUANTS, dettes } = await import('../packages/orchestrator/taches.js');

const T0 = '2026-11-21T00:00:00.000Z';
const at = (s) => new Date(Date.parse(T0) + s * 1000).toISOString();
const FOLDER = 'relay/missions/FICTIF/verif';

function fake(t, { reglage } = {}) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-13-faux-FICTIF-')));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, FOLDER), { recursive: true });
  const rows = new Map();
  const events = [];
  const store = {
    get: (id) => rows.get(id),
    children: (id) => [...rows.values()].filter((r) => r.famille?.mere === id),
    update: (id, p) => rows.set(id, { ...rows.get(id), ...p }),
    on: () => {},
    off: () => {},
    event: (id, type, data) => events.push({ id, type, data }),
    events: (id) => events.filter((e) => e.id === id),
    usage: () => ({ entries: [] }),
  };
  const engine = {
    store,
    active: new Map(),
    approvalTokens: new Map(),
    ownerMode: false,
    pendingPermission: () => null,
    turnObjective: (run) => run.prompt ?? null,
    modelAnswerOf: (run) => run.answer ?? '',
    privateRunFile: () => null,
  };
  // The setting is read by the constructor, as the other AGENT_PLATFORM_* settings.
  if (reglage !== undefined) process.env.AGENT_PLATFORM_VERDICT_TURN = reglage;
  const delegation = new Delegation(engine);
  delete process.env.AGENT_PLATFORM_VERDICT_TURN;
  const mother = {
    id: 'mere-FICTIVE',
    state: 'running',
    agent: 'fictif',
    cwd,
    prompt: 'Demande FICTIVE.',
    multiAgent: true,
    estMere: true,
    delegation: { accepted: true, total: 10, parallel: 3 },
    pack: packs[0].id,
  };
  rows.set(mother.id, mother);
  const control = { abort: new AbortController(), mere: true };
  engine.active.set(mother.id, control);
  let n = 0;
  const child = (titre, state, famille = {}, more = {}) => {
    const id = `${String(++n).padStart(2, '0')}-${titre}-FICTIF`;
    rows.set(id, {
      id,
      title: titre,
      state,
      agent: 'fictif',
      cwd,
      startedAt: at(n),
      ...(['queued', 'running'].includes(state) ? {} : { finishedAt: at(n + 1) }),
      famille: { mere: mother.id, titre, ...famille },
      ...more,
    });
    return id;
  };
  const verif = (relit, answer, state = 'completed') =>
    child('Vérif', state, { relit, verdictAttendu: true, dossierResultats: FOLDER }, { answer });
  // The chief's session : how often continueSession() was asked, and its answer.
  const session = (open = true) => {
    const runtime = { calls: 0, continueSession: () => (runtime.calls++, open) };
    return runtime;
  };
  // Everything already given to the chief (as mission_attendre would have).
  const deliverAll = () => {
    const family = delegation.family(mother.id);
    for (const row of store.children(mother.id)) delegation.deliver(family, row);
    return family;
  };
  const bilan = () => delegation.familyBilan(mother, { chiefAnswer: 'Réponse FICTIVE du chef.' });
  return { rows, events, delegation, mother, control, child, verif, session, deliverAll, bilan };
}

// ---- 5. session fermée

test('swarm-13 (5) : session de l’agent fermée → pas de tour, aucun événement ; Bilan « tour donné : non »', async (t) => {
  const f = fake(t);
  const a = f.child('Rapport', 'completed');
  f.verif([a], 'Relu FICTIF.\nVerdict : a_corriger');
  const family = f.deliverAll();
  const runtime = f.session(false);
  assert.equal(await f.delegation.synthesis(f.mother.id, f.control, runtime), null);
  assert.equal(runtime.calls, 1);
  assert.equal(family.verdictTurn, undefined);
  assert.equal(
    f.events.some((e) => e.type === 'verdict_turn'),
    false,
  );
  assert.ok(f.bilan().endsWith('\n' + malgre(['Rapport'], 'non')), f.bilan());
  // Without the chief's answer (a mother that fails), no « Réponse finale donnée » line.
  assert.doesNotMatch(f.delegation.familyBilan(f.mother), /Réponse finale donnée malgré/);
});

// ---- 6. réglage éteint

test('swarm-13 (6) : AGENT_PLATFORM_VERDICT_TURN=0 → pas de tour ni de verdicts joints ; la ligne de Bilan reste', async (t) => {
  const f = fake(t, { reglage: '0' });
  const a = f.child('Rapport', 'completed');
  f.verif([a], 'Verdict : a_corriger');
  f.deliverAll();
  const runtime = f.session();
  assert.equal(await f.delegation.synthesis(f.mother.id, f.control, runtime), null);
  assert.equal(runtime.calls, 0);
  assert.ok(f.bilan().includes(malgre(['Rapport'], 'non')));
  // A synthesis turn that takes place anyway stays the one of today.
  f.child('Annexe', 'completed');
  const turn = await f.delegation.synthesis(f.mother.id, f.control, f.session());
  assert.equal(turn.instructions, rule.SYNTHESIS_TURN);
  assert.equal('verdictsEnAttente' in turn.familyResults, false);
  assert.equal(
    f.events.some((e) => e.type === 'verdict_turn'),
    false,
  );
  // Any other value keeps it on.
  const g = fake(t, { reglage: '1' });
  const b = g.child('Rapport', 'completed');
  g.verif([b], 'Verdict : a_corriger');
  g.deliverAll();
  assert.equal(
    (await g.delegation.synthesis(g.mother.id, g.control, g.session())).instructions,
    rule.VERDICT_TURN,
  );
});

// ---- gardes de verdictTurn

test('swarm-13 : une erreur imprévue dans le calcul de la dette → pas de tour (null), rien ne lève', async (t) => {
  const f = fake(t);
  const a = f.child('Rapport', 'completed');
  f.verif([a], 'Verdict : a_corriger');
  f.deliverAll();
  f.delegation.verdictOf = () => {
    throw new Error('lecture FICTIVE en échec');
  };
  const runtime = f.session();
  assert.equal(await f.delegation.synthesis(f.mother.id, f.control, runtime), null);
  assert.equal(runtime.calls, 0);
  assert.equal(
    f.events.some((e) => e.type === 'verdict_turn'),
    false,
  );
});

test('swarm-13 : continueSession() appelée en dernier ; mission abandonnée, tour déjà donné, sans dette ou sans mère → null', async (t) => {
  const f = fake(t);
  const a = f.child('Rapport', 'completed');
  f.verif([a], 'Verdict : a_corriger');
  const family = f.deliverAll();
  // No family of its own (a resumed mother that launched nothing) : the first exit, unchanged.
  const none = f.session();
  assert.equal(
    await f.delegation.synthesis(f.mother.id, { ...f.control, mere: false }, none),
    null,
  );
  assert.equal(none.calls, 0);
  // Aborted : no turn, the session is not asked.
  const aborted = new AbortController();
  aborted.abort(new Error('arrêt FICTIF'));
  const r1 = f.session();
  assert.equal(
    await f.delegation.synthesis(f.mother.id, { ...f.control, abort: aborted }, r1),
    null,
  );
  assert.equal(r1.calls, 0);
  // Given once, then never again in the same execution.
  const r2 = f.session();
  const turn = await f.delegation.synthesis(f.mother.id, f.control, r2);
  assert.equal(r2.calls, 1);
  assert.equal(turn.instructions, rule.VERDICT_TURN);
  assert.equal(turn.familyResults.nature, 'données rapportées par les vérificateurs');
  assert.equal(family.verdictTurn, true);
  const r3 = f.session();
  assert.equal(await f.delegation.synthesis(f.mother.id, f.control, r3), null);
  assert.equal(r3.calls, 0);
  assert.equal(f.events.filter((e) => e.type === 'verdict_turn').length, 1);
  // Without debt : the session is not asked.
  const g = fake(t);
  const b = g.child('Rapport', 'completed');
  g.verif([b], 'Verdict : approuve');
  g.deliverAll();
  const r4 = g.session();
  assert.equal(await g.delegation.synthesis(g.mother.id, g.control, r4), null);
  assert.equal(r4.calls, 0);
});

test('swarm-13 : verdict illisible (vérificateur parti puis en échec) → dette illisible: true dans le tour ; événement sans texte', async (t) => {
  const f = fake(t);
  const a = f.child('Rapport confidentiel FICTIF', 'completed');
  const v = f.verif([a], '', 'failed');
  f.deliverAll();
  const turn = await f.delegation.synthesis(f.mother.id, f.control, f.session());
  assert.deepEqual(turn.familyResults.verdictsEnAttente, [
    {
      tache: a,
      titre: 'Rapport confidentiel FICTIF',
      valeur: 'a_corriger',
      complet: false,
      illisible: true,
      bloquants: [],
      par: v,
    },
  ]);
  const event = f.events.find((e) => e.type === 'verdict_turn');
  assert.deepEqual(event.data, { taches: [a.slice(0, 8)] });
  assert.doesNotMatch(JSON.stringify(event.data), /confidentiel/);
});

// ---- dettes (fonction pure)

test('swarm-13 : dettes suit le dernier verdict valable par tâche ; ne lève pas sur une entrée mal typée', () => {
  const corriger = { valeur: 'a_corriger', bloquants: [], remarques: [], source: 'fichier' };
  const ok = { valeur: 'approuve', bloquants: [], remarques: [], source: 'fichier' };
  const T1 = { id: 't1', titre: 'T1', state: 'completed' };
  const V1 = { id: 'v1', state: 'completed', relit: ['t1'], verdict: corriger };
  const S1 = { id: 's1', titre: 'T1 (suite)', state: 'completed', suiteDe: 't1' };
  // Real case : one debt, by V1.
  assert.deepEqual(dettes({ children: [T1, V1] }), {
    vivantes: 0,
    nonRemises: 0,
    verdictsNegatifs: [
      { tache: 't1', titre: 'T1', valeur: 'a_corriger', complet: true, bloquants: [], par: 'v1' },
    ],
  });
  // The suite re-verified « approuve » : no debt.
  const V2 = { id: 'v2', state: 'completed', relit: ['s1'], verdict: ok };
  assert.deepEqual(dettes({ children: [T1, V1, S1, V2] }).verdictsNegatifs, []);
  // A verification of the outdated attempt does not clear it ; a suite not re-verified is a debt.
  const V2old = { ...V2, relit: ['t1'] };
  assert.equal(dettes({ children: [T1, V1, S1, V2old] }).verdictsNegatifs[0].par, 'v1');
  assert.equal(dettes({ children: [T1, V1, S1] }).verdictsNegatifs.length, 1);
  // « approuve » followed by a suite not re-verified : no debt.
  assert.deepEqual(dettes({ children: [T1, { ...V1, verdict: ok }, S1] }).verdictsNegatifs, []);
  // Living, not delivered, at most MAX_BLOQUANTS points.
  const many = {
    ...corriger,
    bloquants: Array.from({ length: 20 }, (_, i) => ({ ou: `${i}`, pourquoi: 'P' })),
  };
  const living = { id: 'x', state: 'running' };
  const result = dettes({ children: [T1, { ...V1, verdict: many }, living], nonRemises: [T1, V1] });
  assert.equal(result.vivantes, 1);
  assert.equal(result.nonRemises, 2);
  assert.equal(result.verdictsNegatifs[0].bloquants.length, MAX_BLOQUANTS);
  assert.equal(dettes({ children: [], nonRemises: 3 }).nonRemises, 3);
  for (const entree of [
    undefined,
    null,
    'x',
    42,
    { children: [null, 1, 'a', {}] },
    { children: 'x' },
  ])
    assert.deepEqual(dettes(entree).verdictsNegatifs, [], JSON.stringify(entree));
});

test('swarm-13 : textes VERDICT_TURN et VERDICT_NOTE mot pour mot, sans nom d’agent ni de site', () => {
  assert.equal(
    rule.VERDICT_TURN,
    'Avant de conclure : ces travaux ont un dernier verdict de vérification qui n’est pas « approuve » (verdictsEnAttente : données rapportées par les vérificateurs, avec leurs points bloquants). Pour chacun : fais corriger par mission_continuer puis refais vérifier (relit) et attends le résultat par mission_attendre, ou corrige toi-même, ou dis pourquoi tu t’arrêtes là. Écris ensuite ta réponse finale complète : elle remplace la précédente ; dis-y clairement ce qui reste non vérifié.',
  );
  assert.equal(
    rule.VERDICT_NOTE,
    'Avant de conclure : ces travaux ont un dernier verdict de vérification qui n’est pas « approuve » (verdictsEnAttente : données rapportées par les vérificateurs, avec leurs points bloquants).',
  );
  for (const text of [rule.VERDICT_TURN, rule.VERDICT_NOTE])
    assert.doesNotMatch(text, /claude|codex|gemini|opencode|career|seek|linkedin|indeed/i);
});
