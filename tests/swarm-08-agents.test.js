// swarm-08 (plan swarm du 20/11) : liste d'agents fidèle (état réel, agents prêts en tête), refus d'un
// agent nommé indisponible et repli sur un agent prêt quand le chef n'en nomme aucun, cause d'un échec
// avec sa classe et les agents prêts. Sans agent, sans API, sans navigateur, sans réseau : faux moteur
// FICTIF (comme swarm-05), détection des agents remplie à la main (aucun CLI lancé), sondes fictives
// dans un dossier temporaire, horloge injectée (delegation.now). Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// No real CLI is ever run by the detection of agents (`--version`) : every path is absent.
const AGENTS_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'swarm-08-agents-FICTIF-'));
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
const { continueChild } = await import('../packages/orchestrator/continuation.js');
const { otherAgent } = await import('../packages/orchestrator/roles.js');
const { limitReason } = await import('../packages/agent-runtime/limits.js');
const rule = await import('../packages/orchestrator/delegation-rule.js');

// The four identifiers of real agents ; the tests play them in every order (case 6).
const IDS = ['claude', 'codex', 'gemini', 'opencode'];
const NOW = Date.parse('2026-11-20T18:48:00.000Z');
const MIN = 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const LIMIT = iso(NOW + 39 * MIN);

// A = refused session 2 minutes ago, B = limit until an hour to come, C = proven session, D = never
// tested ; plus the simulated agent of the platform.
function probesFor([a, b, c]) {
  return {
    [a]: { session: false, error: 'auth FICTIVE', sessionAt: iso(NOW - 2 * MIN), at: iso(NOW) },
    [b]: { session: true, limite: { classe: 'limite', jusqua: LIMIT, at: iso(NOW - MIN) } },
    [c]: {
      session: true,
      models: {
        current: 'modele-fort-FICTIF',
        options: [
          { id: 'modele-fort-FICTIF', name: 'Fort FICTIF' },
          { id: 'modele-leger-FICTIF', name: 'Léger FICTIF' },
        ],
      },
      limitesModele: { 'modele-fort-FICTIF': { classe: 'limite_modele', jusqua: LIMIT } },
    },
  };
}
const detected = (ids) => [
  ...ids.map((id) => ({ id, installed: true, compatible: true, simulated: false })),
  { id: 'fixture', installed: true, compatible: true, simulated: true },
];

function fakeEngine(t, { ids = IDS, total = 10, live = true, cache = true, motherAgent } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'swarm-08-FICTIF-'));
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
  const questions = [];
  const created = [];
  const engine = {
    store,
    dataDir,
    live,
    active: new Map(),
    approvalTokens: new Map(),
    permissions: new Map(),
    ownerMode: false,
    pendingPermission: () => null,
    turnObjective: (run) => run.prompt ?? null,
    modelAnswerOf: () => '',
    enqueueQuestion: (id, question) => {
      questions.push(question);
      return new Promise(() => {});
    },
    async create(input, prev, link) {
      await new Promise((r) => setTimeout(r, 5));
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
  if (cache) delegation.agentsCache = { at: Date.now(), list: detected(ids) };
  const mother = {
    id: randomUUID(),
    state: 'running',
    agent: motherAgent ?? ids[3],
    cwd,
    multiAgent: true,
    delegation: { accepted: true, total, parallel: 5 },
  };
  rows.set(mother.id, mother);
  const control = { abort: new AbortController(), mere: false };
  engine.active.set(mother.id, control);
  const probes = (value) => {
    rmSync(dataDir, { recursive: true, force: true });
    if (value) {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, 'agent-probes.json'), JSON.stringify(value));
    }
  };
  const launch = (args) => delegation.launch(rows.get(mother.id), control, args);
  const cont = (args) => continueChild(delegation, rows.get(mother.id), control, args);
  const family = () => delegation.families.get(mother.id);
  return {
    rows,
    store,
    events,
    questions,
    created,
    engine,
    delegation,
    mother,
    control,
    probes,
    launch,
    cont,
    family,
  };
}
const tick = () => new Promise((r) => setImmediate(r));
const rejected = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  assert.fail('le lancement devait être refusé');
};
const hour = limitReason(LIMIT);
const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);

// ---- 1. Cas rouge d'abord : le cas réel du 20/11 à 18:48

test('swarm-08 (1) : mission_suivre.agents : état réel (session refusée, limite), agents prêts en tête', async (t) => {
  const [a, b, c, d] = IDS;
  const f = fakeEngine(t);
  f.probes(probesFor(IDS));
  const list = await f.delegation.agents();
  const byId = Object.fromEntries(list.map((agent) => [agent.id, agent]));
  // Before this lot, both were `disponible: true`.
  assert.equal(byId[a].disponible, false);
  assert.equal(byId[a].etat, 'connexion_refusee');
  assert.equal(byId[a].raison, 'Session refusée (auth FICTIVE)');
  assert.equal('jusqua' in byId[a], false);
  assert.equal(byId[b].disponible, false);
  assert.equal(byId[b].etat, 'limite');
  assert.equal(byId[b].raison, hour);
  assert.equal(byId[b].jusqua, LIMIT);
  // Ready agents first (stable order), then the unavailable ones in the order of the detection.
  assert.deepEqual(
    list.map((agent) => agent.id),
    [c, d, a, b, 'fixture'],
  );
  assert.equal(byId[c].etat, 'pret');
  assert.equal(byId[c].disponible, true);
  assert.deepEqual(byId[c].modeles, [
    { id: 'modele-fort-FICTIF', nom: 'Fort FICTIF', limiteJusqua: LIMIT },
    { id: 'modele-leger-FICTIF', nom: 'Léger FICTIF' },
  ]);
  assert.equal(byId[c].modeleParDefaut, 'modele-fort-FICTIF');
  // A ready agent without anything new : the keys of before plus etat.
  assert.deepEqual(Object.keys(byId[d]).sort(), [
    'disponible',
    'etat',
    'id',
    'modeleParDefaut',
    'modeles',
  ]);
  // The simulated agent in real mode : said, never available.
  assert.deepEqual(
    { ...byId.fixture, modeles: undefined },
    {
      id: 'fixture',
      disponible: false,
      etat: 'simule',
      simule: true,
      modeles: undefined,
      modeleParDefaut: null,
    },
  );
  // The raw detection stays in the cache ; the state is computed at each call.
  assert.deepEqual(Object.keys(f.delegation.agentsCache.list[0]).sort(), [
    'compatible',
    'id',
    'installed',
    'simulated',
  ]);
  f.delegation.now = () => NOW + 40 * MIN;
  const later = await f.delegation.agents();
  assert.equal(later.find((agent) => agent.id === b).etat, 'pret');
});

// ---- 2. Agent nommé indisponible : refus immédiat, rien de créé

test('swarm-08 (2) : mission_lancer vers un agent nommé indisponible : agent_indisponible, rien de créé, enveloppe intacte', async (t) => {
  const [a, b, c, d] = IDS;
  const f = fakeEngine(t, { total: 1 });
  f.probes(probesFor(IDS));
  const error = await rejected(f.launch({ consigne: 'Partie FICTIVE', agent: b }));
  assert.equal(error.erreur, 'agent_indisponible');
  assert.equal(
    error.message,
    `${b} : ${hour} ; agents prêts : ${c}, ${d} ; choisis-en un, ou malgreIndisponible: true si tu sais qu’il est revenu`,
  );
  // A refused session : its reason, without an hour.
  const refused = await rejected(f.launch({ consigne: 'Partie FICTIVE', agent: a }));
  assert.equal(refused.erreur, 'agent_indisponible');
  assert.match(
    refused.message,
    new RegExp(`^${a} : Session refusée \\(auth FICTIVE\\) ; agents prêts`),
  );
  assert.match(refused.message, /malgreIndisponible: true/);
  // The model asked is under its limit.
  const model = await rejected(
    f.launch({ consigne: 'Partie FICTIVE', agent: c, modele: 'modele-fort-FICTIF' }),
  );
  assert.equal(model.erreur, 'agent_indisponible');
  assert.equal(
    model.message,
    `${c} : ${hour} pour le modèle modele-fort-FICTIF ; agents prêts : ${c}, ${d} ; choisis-en un, ou malgreIndisponible: true si tu sais qu’il est revenu`,
  );
  // Nothing created, no counter taken, no results folder, no card : the envelope (1) is intact.
  assert.equal(f.created.length, 0);
  assert.equal(f.questions.length, 0);
  assert.equal(f.family().pending, 0);
  assert.equal(f.family().pendingCounted ?? 0, 0);
  assert.equal(existsSync(join(f.mother.cwd, 'relay')), false);
  const launched = await f.launch({ consigne: 'Partie FICTIVE', agent: c });
  assert.equal(launched.agent, c);
  assert.equal(f.rows.get(launched.id).famille.agentImpose, true);
  assert.equal('agentPrevu' in f.rows.get(launched.id).famille, false);
});

test('swarm-08 (2) : aucun agent prêt : dit, avec le levier', async (t) => {
  const [a, b] = IDS;
  const f = fakeEngine(t, { ids: [a, b] });
  f.probes(probesFor(IDS));
  const error = await rejected(f.launch({ consigne: 'Partie FICTIVE', agent: b }));
  assert.equal(
    error.message,
    `${b} : ${hour} ; aucun agent prêt ; fais cette part toi-même, ou malgreIndisponible: true si tu sais qu’il est revenu`,
  );
  // Agent not named, none to take instead : the same refusal, nothing created.
  const f2 = fakeEngine(t, { ids: [a, b], motherAgent: b });
  f2.probes(probesFor(IDS));
  const unnamed = await rejected(f2.launch({ consigne: 'Partie FICTIVE' }));
  assert.equal(unnamed.erreur, 'agent_indisponible');
  assert.match(unnamed.message, /aucun agent prêt/);
  assert.equal(f2.created.length, 0);
});

// ---- 3. Agent non nommé : repli sur un agent prêt, dit

test('swarm-08 (3) : reprend d’une sous-mission tombée sur une limite, sans agent nommé : autre agent prêt, note et agentPrevu', async (t) => {
  const [a, , c, d] = IDS;
  const f = fakeEngine(t, { motherAgent: a });
  f.probes({});
  const first = await f.launch({ consigne: 'Partie FICTIVE', agent: c });
  // It falls on a limit : its agent is under limit until LIMIT.
  f.probes({ [c]: { limite: { classe: 'limite', jusqua: LIMIT } } });
  f.store.update(first.id, { state: 'failed', error: 'Limite d’usage FICTIVE' });
  await tick();
  const resumed = await f.launch({ consigne: 'Partie FICTIVE', reprend: first.id });
  // The first ready agent of the list other than the one planned (none has a proven session).
  assert.equal(resumed.agent, a);
  assert.notEqual(resumed.agent, c);
  const row = f.rows.get(resumed.id);
  assert.equal(row.famille.agentPrevu, c);
  assert.equal('agentImpose' in row.famille, false);
  assert.equal(resumed.note, `Agent prévu ${c} indisponible (${lower(hour)}) : lancé sur ${a}.`);
  assert.equal(resumed.modele, '');
  // The row says the agent launched and the one planned.
  assert.equal(row.agent, a);
});

test('swarm-08 (3) : agent par défaut (celui de la mère) sous limite : lancé sur le premier prêt, session prouvée d’abord', async (t) => {
  const [a, b, c, d] = IDS;
  const f = fakeEngine(t, { motherAgent: b });
  f.probes({ ...probesFor(IDS), [d]: { session: true } });
  const launched = await f.launch({ consigne: 'Partie FICTIVE' });
  assert.equal(launched.agent, c);
  assert.equal(launched.note, `Agent prévu ${b} indisponible (${lower(hour)}) : lancé sur ${c}.`);
  assert.equal(f.created[0].agent, c);
  assert.ok(![a, b, 'fixture'].includes(launched.agent));
});

test('swarm-08 (3) : cache vide : un agent sans sonde passe ; un agent constaté indisponible est refusé', async (t) => {
  const [, b, c] = IDS;
  const f = fakeEngine(t, { cache: false, motherAgent: c });
  f.probes(probesFor(IDS));
  // No detection read yet (no mission_suivre) : judged on its probes only.
  const named = await f.launch({ consigne: 'Partie FICTIVE une', agent: 'opencode-FICTIF' });
  assert.equal(named.agent, 'opencode-FICTIF');
  const error = await rejected(f.launch({ consigne: 'Partie FICTIVE deux', agent: b }));
  assert.equal(error.erreur, 'agent_indisponible');
  assert.match(error.message, /aucun agent prêt/);
  assert.equal(f.created.length, 1);
  assert.equal(f.delegation.agentsCache, null);
});

// ---- 4. Le levier ; une limite passée ; a_reessayer

test('swarm-08 (4) : malgreIndisponible passe ; limite passée : prêt de nouveau ; a_reessayer ne bloque pas', async (t) => {
  const [a, b] = IDS;
  const f = fakeEngine(t);
  f.probes(probesFor(IDS));
  const forced = await f.launch({
    consigne: 'Partie FICTIVE une',
    agent: b,
    malgreIndisponible: true,
  });
  assert.equal(forced.agent, b);
  assert.equal(forced.note, undefined);
  assert.equal(f.rows.get(forced.id).famille.agentImpose, true);
  // The limit's hour passed : ready again (nothing written).
  f.delegation.now = () => NOW + 40 * MIN;
  const again = await f.launch({ consigne: 'Partie FICTIVE deux', agent: b });
  assert.equal(again.agent, b);
  // A refusal older than 10 minutes : a_reessayer, available.
  f.delegation.now = () => NOW + 11 * MIN;
  const list = await f.delegation.agents();
  const retry = list.find((agent) => agent.id === a);
  assert.equal(retry.etat, 'a_reessayer');
  assert.equal(retry.disponible, true);
  const tried = await f.launch({ consigne: 'Partie FICTIVE trois', agent: a });
  assert.equal(tried.agent, a);
  assert.equal(f.created.length, 3);
});

// ---- 5. Le vérificateur

test('swarm-08 (5) : otherAgent sur la liste d’agents ne prend jamais un agent sous limite', async (t) => {
  const [a, b, c, d] = IDS;
  const f = fakeEngine(t);
  const probes = probesFor(IDS);
  f.probes(probes);
  const list = await f.delegation.agents();
  for (const authors of [[c], [d], [a], [c, d]]) {
    const chosen = otherAgent(list, authors, { live: true, probes });
    assert.notEqual(chosen, b, authors.join());
    assert.notEqual(chosen, a, authors.join());
  }
  assert.equal(otherAgent(list, [c, d], { live: true, probes }), null);
  // Out of real mode as well (same list shape).
  assert.notEqual(otherAgent(list, [c, d]), b);
});

// ---- 6. Les quatre identifiants

test('swarm-08 (6) : même résultat quel que soit l’agent (quatre identifiants, tous les rôles)', async (t) => {
  for (let shift = 0; shift < IDS.length; shift++) {
    const ids = [...IDS.slice(shift), ...IDS.slice(0, shift)];
    const [a, b, c, d] = ids;
    const f = fakeEngine(t, { ids, motherAgent: b });
    f.probes(probesFor(ids));
    const list = await f.delegation.agents();
    assert.deepEqual(
      list.map((agent) => [agent.id, agent.etat]),
      [
        [c, 'pret'],
        [d, 'pret'],
        [a, 'connexion_refusee'],
        [b, 'limite'],
        ['fixture', 'simule'],
      ],
      ids.join(),
    );
    const error = await rejected(f.launch({ consigne: 'Partie FICTIVE', agent: b }));
    assert.equal(
      error.message,
      `${b} : ${hour} ; agents prêts : ${c}, ${d} ; choisis-en un, ou malgreIndisponible: true si tu sais qu’il est revenu`,
    );
    const replaced = await f.launch({ consigne: 'Partie FICTIVE' });
    assert.equal(replaced.agent, c, ids.join());
    assert.equal(f.rows.get(replaced.id).famille.agentPrevu, b);
  }
});

// ---- 7. mission_continuer

test('swarm-08 (7) : mission_continuer vers un agent indisponible : même refus ; avec le levier : passe ; agent hérité : repli', async (t) => {
  const [, b, c, d] = IDS;
  const f = fakeEngine(t);
  f.probes({});
  const first = await f.launch({ consigne: 'Partie FICTIVE', agent: c });
  f.store.update(first.id, { state: 'completed' });
  await tick();
  f.probes(probesFor(IDS));
  const error = await rejected(f.cont({ id: first.id, message: 'Complète FICTIF', agent: b }));
  assert.equal(error.erreur, 'agent_indisponible');
  assert.equal(
    error.message,
    `${b} : ${hour} ; agents prêts : ${c}, ${d} ; choisis-en un, ou malgreIndisponible: true si tu sais qu’il est revenu`,
  );
  assert.equal(f.created.length, 1);
  const forced = await f.cont({
    id: first.id,
    message: 'Complète FICTIF',
    agent: b,
    malgreIndisponible: true,
  });
  assert.equal(forced.agent, b);
  assert.equal(forced.suiteDe, first.id);
  assert.equal(f.rows.get(forced.id).famille.agentImpose, true);
  f.store.update(forced.id, { state: 'completed' });
  await tick();
  // The suite of a sub-mission whose agent is now under limit, no agent named : a ready agent.
  f.probes({ ...probesFor(IDS), [b]: {}, [c]: { limite: { classe: 'limite', jusqua: LIMIT } } });
  const inherited = await f.cont({ id: first.id, message: 'Encore FICTIF' });
  assert.notEqual(inherited.agent, c);
  assert.equal(f.rows.get(inherited.id).famille.agentPrevu, c);
  assert.equal('agentImpose' in f.rows.get(inherited.id).famille, false);
  assert.match(inherited.note, new RegExp(`^Agent prévu ${c} indisponible`));
  // Inherited and ready : no change, no new field.
  f.store.update(inherited.id, { state: 'completed' });
  await tick();
  f.probes({});
  const same = await f.cont({ id: first.id, message: 'Fin FICTIVE' });
  assert.equal(same.agent, c);
  assert.equal('agentPrevu' in f.rows.get(same.id).famille, false);
  assert.equal('agentImpose' in f.rows.get(same.id).famille, false);
  assert.equal(same.note, undefined);
});

// ---- Cause d'un échec : classe, heure, agents prêts ; gardée après un redémarrage

test('swarm-08 (d) : échec classé : child_done.echec, cause avec classe, jusqua et agentsPrets ; relu après redémarrage', async (t) => {
  const [, b, c, d] = IDS;
  const f = fakeEngine(t);
  f.probes(probesFor(IDS));
  const launched = await f.launch({ consigne: 'Partie FICTIVE', agent: d });
  f.engine.active.set(launched.id, {
    echecAgent: { classe: 'limite', jusqua: LIMIT, source: 'texte' },
  });
  f.store.update(launched.id, { state: 'failed', error: 'Limite d’usage FICTIVE' });
  await tick();
  const done = f.events.find((e) => e.type === 'child_done' && e.data.childId === launched.id);
  assert.deepEqual(done.data.echec, { classe: 'limite', jusqua: LIMIT });
  const cause = f.delegation.outcome(f.rows.get(launched.id)).cause;
  assert.equal(cause.classe, 'limite');
  assert.equal(cause.jusqua, LIMIT);
  assert.deepEqual(cause.agentsPrets, [c, d]);
  assert.ok(!cause.agentsPrets.includes(b));
  // After a restart (memory gone) : read again from the event.
  f.delegation.finals.clear();
  assert.deepEqual(f.delegation.doneOf(f.rows.get(launched.id)).echec, {
    classe: 'limite',
    jusqua: LIMIT,
  });
  assert.equal(f.delegation.outcome(f.rows.get(launched.id)).cause.classe, 'limite');
  // A connection failure : no hour.
  const other = await f.launch({ consigne: 'Autre partie FICTIVE', agent: c });
  f.engine.active.set(other.id, { echecAgent: { classe: 'connexion', jusqua: null } });
  f.store.update(other.id, { state: 'failed', error: 'Erreur FICTIVE' });
  await tick();
  const second = f.delegation.outcome(f.rows.get(other.id)).cause;
  assert.equal(second.classe, 'connexion');
  assert.equal('jusqua' in second, false);
});

test('swarm-08 (d) : échec non classé ou réussite : mêmes clés qu’avant, aucun echec', async (t) => {
  const f = fakeEngine(t);
  f.probes({});
  const failed = await f.launch({ consigne: 'Partie FICTIVE une' });
  f.engine.active.set(failed.id, { echecAgent: null });
  f.store.update(failed.id, { state: 'failed', error: 'Erreur FICTIVE' });
  const ok = await f.launch({ consigne: 'Partie FICTIVE deux' });
  f.store.update(ok.id, { state: 'completed' });
  await tick();
  for (const id of [failed.id, ok.id]) {
    const done = f.events.find((e) => e.type === 'child_done' && e.data.childId === id);
    assert.equal('echec' in done.data, false);
    assert.equal('echec' in f.delegation.doneOf(f.rows.get(id)), false);
  }
  assert.deepEqual(Object.keys(f.delegation.outcome(f.rows.get(failed.id)).cause).sort(), [
    'agent',
    'message',
    'reprise',
    'type',
  ]);
  assert.equal(f.delegation.outcome(f.rows.get(ok.id)).cause, null);
  // Without any field of this lot, the result keys of a launch are those of before.
  assert.deepEqual(Object.keys(ok).sort(), [
    'agent',
    'dossierResultats',
    'espace',
    'etat',
    'famille',
    'id',
    'modele',
    'titre',
  ]);
  assert.equal('agentImpose' in f.rows.get(ok.id).famille, false);
});

// ---- Précision 7 : membersOf ne lève jamais

test('swarm-08 : membersOf ne lève jamais : en cas d’erreur, pas de membres', async (t) => {
  const f = fakeEngine(t);
  f.probes({});
  const one = await f.launch({ consigne: 'Partie FICTIVE une' });
  const two = await f.launch({ consigne: 'Partie FICTIVE deux' });
  f.engine.turnObjective = () => {
    throw new Error('lecture FICTIVE impossible');
  };
  f.delegation.briefs.get(one.id).part = undefined;
  assert.deepEqual(f.delegation.membersOf(f.rows.get(two.id), f.rows.get(f.mother.id)), []);
});

// ---- Textes et schémas

test('swarm-08 : phrase du chef, levier dans les deux schémas, aucun nom d’agent dans les textes', () => {
  assert.ok(
    rule.CHIEF_METHOD.includes(
      'mission_suivre donne l’état réel de chaque agent (etat, raison, jusqua) : ne choisis qu’un agent prêt',
    ),
  );
  for (const name of ['mission_lancer', 'mission_continuer']) {
    const schema = rule.MISSION_TOOLS[name].schema;
    const base = name === 'mission_lancer' ? { consigne: 'x' } : { id: randomUUID(), message: 'x' };
    assert.equal(schema.safeParse({ ...base, malgreIndisponible: true }).success, true, name);
    assert.equal(schema.safeParse({ ...base, malgreIndisponible: 'oui' }).success, false, name);
    assert.equal(schema.safeParse({ ...base, agentHerite: true }).success, false, name);
  }
  const texts = [
    rule.CHIEF_METHOD,
    rule.agentUnavailable('X', 'R', []),
    rule.agentUnavailable('X', 'R', ['Y']),
    rule.agentReplaced('X', 'R', 'Y'),
    rule.modelLimitReason('R', 'M'),
  ].join(' ');
  for (const word of [...IDS, 'fixture', 'career', 'gpt', 'opus', 'sonnet'])
    assert.equal(texts.toLowerCase().includes(word), false, word);
});
