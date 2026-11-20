import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp, publicAgents } from '../apps/api/server.js';
import {
  listRuns,
  memberView,
  privateRun,
  teamSummary,
  withTeam,
} from '../packages/orchestrator/team-view.js';

// swarm-07 : vue d'équipe pour l'interface. Données fictives, aucun agent réel, horloge injectée.
const T0 = Date.parse('2026-11-21T10:00:00.000Z');
const iso = (ms) => new Date(T0 + ms).toISOString();
const LIMIT_ERROR = 'Limite d’usage atteinte (FICTIF) : réessayer à 23:27. Détail.';

async function platform(t, options = {}) {
  const app = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'relay-swarm-07-')), ...options });
  await new Promise((r) => app.server.listen(0, '127.0.0.1', r));
  t.after(() => app.close());
  const get = async (path) => {
    const r = await fetch(`http://127.0.0.1:${app.server.address().port}/api${path}`);
    return { status: r.status, data: await r.json() };
  };
  return { app, store: app.store, delegation: app.engine.delegation, get };
}
const row = (store, fields) =>
  store.create({
    id: randomUUID(),
    title: 'Mission FICTIVE',
    prompt: 'Prompt FICTIF',
    agent: 'fixture',
    createdAt: iso(0),
    ...fields,
  });
// Une mère et trois membres : un en cours, un fini, un en échec sur limite d'usage.
function family(store, { workspace } = {}) {
  const ws = workspace ? { workspace } : {};
  const mother = row(store, { state: 'running', estMere: true, ...ws });
  const famille = (titre, extra = {}) => ({ mere: mother.id, racine: mother.id, titre, ...extra });
  const running = row(store, {
    state: 'running',
    model: 'modele-fictif-a',
    startedAt: iso(1000),
    famille: famille('En cours FICTIVE', { pourquoi: 'parallele' }),
    ...ws,
  });
  store.event(running.id, 'agent', {
    sessionUpdate: 'tool_call',
    title: 'outil_fictif',
    rawInput: {},
  });
  store.charge(running.id, 'tool_observed', 1);
  const done = row(store, {
    state: 'completed',
    model: 'modele-fictif-b',
    startedAt: iso(2000),
    finishedAt: iso(2000 + 4 * 60000),
    famille: famille('Finie FICTIVE', { continue: 'tache-fictive' }),
    result: { answer: 'R'.repeat(700), summary: 'Bilan FICTIF' },
    ...ws,
  });
  const failed = row(store, {
    state: 'failed',
    model: 'modele-fictif-c',
    startedAt: iso(3000),
    finishedAt: iso(63000),
    error: LIMIT_ERROR + ' ' + 'x'.repeat(400),
    famille: famille('Échec FICTIF'),
    ...ws,
  });
  return { mother, running, done, failed };
}

test('memberView : en cours, fini, échec sur limite d’usage', async (t) => {
  const { store, delegation } = await platform(t);
  const f = family(store);
  const now = T0 + 10 * 60000;
  const running = memberView(delegation, store.get(f.running.id), { now });
  assert.equal(running.modele, 'modele-fictif-a');
  assert.equal(running.pourquoi, 'parallele');
  assert.equal(running.debut, iso(1000));
  assert.equal(running.fin, null);
  assert.equal('dureeMs' in running, false);
  assert.equal(running.depuis, 600);
  assert.equal(typeof running.inactiveDepuis, 'number');
  assert.equal(running.outils, 1);
  assert.equal(running.dernierOutil, 'outil_fictif');
  for (const key of ['resultat', 'cause', 'usage', 'continue'])
    assert.equal(key in running, false, key);

  const done = memberView(delegation, store.get(f.done.id), { now });
  assert.equal(done.dureeMs, 4 * 60000);
  assert.equal(done.dureeMs, Date.parse(done.fin) - Date.parse(done.debut));
  assert.equal(done.resultat, 'R'.repeat(600));
  assert.equal(done.continue, 'tache-fictive');
  assert.equal('cause' in done, false);

  const failed = memberView(delegation, store.get(f.failed.id), { now });
  assert.equal(failed.dureeMs, 60000);
  assert.equal('resultat' in failed, false);
  assert.equal(failed.cause.type, 'limite_usage');
  assert.equal(failed.cause.reprise, '23:27');
  assert.equal(failed.cause.message.length, 300);
  assert.ok(failed.cause.message.startsWith('Limite d’usage'));
  assert.deepEqual(Object.keys(failed.cause).sort(), ['message', 'reprise', 'type']);
});

test('memberView : membre jamais démarré, ni début ni durée ; cause vide sans message', async (t) => {
  const { store, delegation } = await platform(t);
  const mother = row(store, { state: 'running', estMere: true });
  const queued = row(store, { state: 'queued', famille: { mere: mother.id, titre: 'Q' } });
  const view = memberView(delegation, queued, { now: T0 });
  assert.equal(view.debut, null);
  assert.equal(view.fin, null);
  assert.equal('dureeMs' in view, false);
  assert.equal(view.modele, '');
  const cancelled = row(store, {
    state: 'cancelled',
    finishedAt: iso(5000),
    famille: { mere: mother.id, titre: 'C' },
  });
  const ended = memberView(delegation, cancelled, { now: T0 });
  assert.equal(ended.debut, null);
  assert.equal('dureeMs' in ended, false);
  assert.deepEqual(ended.cause, { type: 'erreur', reprise: null });
});

test('mission privée : ni résultat ni message de cause, réponse jamais lue', async (t) => {
  const { app, store, delegation, get } = await platform(t);
  const f = family(store, { workspace: 'espace-fictif' });
  assert.equal(privateRun(f.mother, app.engine), true);
  assert.equal(privateRun(f.mother, { ownerMode: true }), false);
  assert.equal(privateRun({ id: 'x' }, app.engine), false);
  const read = [];
  const original = app.engine.modelAnswerOf.bind(app.engine);
  app.engine.modelAnswerOf = (run) => {
    read.push(run.id);
    return original(run);
  };
  const { data } = await get(`/runs/${f.mother.id}?equipe=1`);
  const byId = Object.fromEntries(data.family.map((e) => [e.id, e]));
  assert.equal('resultat' in byId[f.done.id], false);
  assert.deepEqual(byId[f.failed.id].cause, { type: 'limite_usage', reprise: '23:27' });
  assert.ok(!JSON.stringify(data.family).includes('RRRR'));
  assert.ok(!JSON.stringify(data.family).includes('FICTIF) :'));
  assert.deepEqual(read, []);
  // Même règle membre par membre : un membre privé sous une mère qui ne l'est pas.
  const view = withTeam(delegation.view(f.mother), delegation, {
    ...f.mother,
    workspace: undefined,
  });
  assert.equal('resultat' in view.family.find((e) => e.id === f.done.id), false);
  assert.deepEqual(read, []);
});

test('GET /api/runs/:id?equipe=1 : chaque membre porte sa vue ; sans le paramètre, clés d’avant', async (t) => {
  const { store, get } = await platform(t);
  const f = family(store);
  const plain = await get(`/runs/${f.mother.id}`);
  assert.deepEqual(Object.keys(plain.data.family[0]).sort(), [
    'agent',
    'attend',
    'id',
    'pendingPermission',
    'pendingQuestion',
    'state',
    'titre',
  ]);
  const { status, data } = await get(`/runs/${f.mother.id}?equipe=1`);
  assert.equal(status, 200);
  assert.deepEqual(
    data.family.map((e) => e.id),
    [f.running.id, f.done.id, f.failed.id],
  );
  const [running, done, failed] = data.family;
  assert.equal(running.state, 'running');
  assert.equal(running.modele, 'modele-fictif-a');
  assert.equal(done.resultat, 'R'.repeat(600));
  assert.equal(done.dureeMs, 240000);
  assert.equal(failed.cause.type, 'limite_usage');
  // Les clés d'avant restent, mêmes valeurs.
  for (let i = 0; i < 3; i++)
    for (const [key, value] of Object.entries(plain.data.family[i]))
      assert.deepEqual(data.family[i][key], value, key);
});

test('GET /api/runs/:id d’une mission sans famille et d’une sous-mission : identique à avant', async (t) => {
  const { store, delegation, get } = await platform(t);
  const alone = row(store, { state: 'completed', result: { answer: 'A', summary: 'S' } });
  const plain = await get(`/runs/${alone.id}`);
  const team = await get(`/runs/${alone.id}?equipe=1`);
  assert.deepEqual(Object.keys(team.data).sort(), Object.keys(plain.data).sort());
  assert.equal('family' in team.data || 'equipe' in team.data, false);
  assert.deepEqual(withTeam({}, delegation, alone), {});
  const f = family(store);
  const child = await get(`/runs/${f.done.id}?equipe=1`);
  assert.equal(child.status, 200);
  assert.equal(child.data.id, f.done.id);
  assert.equal('family' in child.data, false);
});

test('GET /api/runs : rien ne change sans paramètre, sauf `equipe` sur la mère', async (t) => {
  const { store, delegation, get } = await platform(t);
  const alone = row(store, { state: 'completed' });
  const f = family(store);
  const asking = row(store, {
    state: 'awaiting_owner',
    famille: { mere: f.mother.id, titre: 'Question FICTIVE' },
  });
  const { data } = await get('/runs');
  const before = store.list();
  assert.deepEqual(
    data.map((r) => r.id),
    before.map((r) => r.id),
  );
  const mother = data.find((r) => r.id === f.mother.id);
  assert.deepEqual(mother.equipe, {
    membres: 4,
    enCours: 2,
    finis: 1,
    echecs: 1,
    teDemande: 1,
  });
  for (const run of data) {
    const base = before.find((r) => r.id === run.id);
    const expected = Object.keys({ ...base, title: '' }).sort();
    const keys = Object.keys(run)
      .filter((k) => !(run.id === f.mother.id && k === 'equipe'))
      .sort();
    assert.deepEqual(keys, expected, run.id);
  }
  assert.equal('equipe' in data.find((r) => r.id === alone.id), false);
  assert.ok(data.some((r) => r.id === asking.id));
  assert.equal(teamSummary(delegation, alone), null);
});

test('GET /api/runs?racines=1 : sans les sous-missions, orpheline gardée', async (t) => {
  const { store, delegation, get } = await platform(t);
  const alone = row(store, { state: 'completed' });
  const f = family(store);
  const orphan = row(store, {
    state: 'completed',
    famille: { mere: randomUUID(), titre: 'Orpheline FICTIVE' },
  });
  const { data } = await get('/runs?racines=1');
  assert.deepEqual(data.map((r) => r.id).sort(), [alone.id, f.mother.id, orphan.id].sort());
  assert.deepEqual(data.find((r) => r.id === f.mother.id).equipe, {
    membres: 3,
    enCours: 1,
    finis: 1,
    echecs: 1,
    teDemande: 0,
  });
  assert.equal(data.find((r) => r.id === orphan.id).title, 'Mission FICTIVE');
  // Mère retirée de la base : ses sous-missions deviennent orphelines et restent listées.
  store.db.prepare('DELETE FROM events WHERE run_id=?').run(f.mother.id);
  store.db.prepare('DELETE FROM runs WHERE id=?').run(f.mother.id);
  const ids = listRuns(store, delegation, { racines: true }).map((r) => r.id);
  for (const id of [f.running.id, f.done.id, f.failed.id]) assert.ok(ids.includes(id), id);
  const child = await get(`/runs/${f.done.id}`);
  assert.equal(child.status, 200);
});

test('teDemande : carte en attente ou accord des sous-agents', async (t) => {
  const { store, delegation } = await platform(t);
  const mother = row(store, { state: 'running', estMere: true });
  const child = row(store, { state: 'queued', famille: { mere: mother.id, titre: 'R' } });
  assert.equal(teamSummary(delegation, mother).teDemande, 0);
  store.update(child.id, { state: 'waiting_permission' });
  assert.equal(teamSummary(delegation, mother).teDemande, 1);
  store.update(child.id, { state: 'queued' });
  const original = delegation.heldState.bind(delegation);
  delegation.heldState = (id) => (id === child.id ? 'attend_accord' : original(id));
  assert.equal(teamSummary(delegation, mother).teDemande, 1);
  assert.equal(teamSummary(delegation, mother).enCours, 1);
  delegation.heldState = original;
});

test('mémoire : un membre fini est calculé une fois, un membre en cours toutes les 2 s', () => {
  let lines = 0;
  const events = [{ at: iso(0) }];
  const fake = {
    line: () => {
      lines++;
      return { modele: 'm', outils: 0, dernierOutil: null };
    },
    outcome: () => ({ cause: null }),
    doneOf: () => ({}),
    store: { events: () => events },
    engine: { modelAnswerOf: () => 'réponse' },
  };
  const finished = {
    id: 'fini',
    state: 'completed',
    createdAt: iso(0),
    startedAt: iso(0),
    finishedAt: iso(1000),
  };
  const first = memberView(fake, finished, { now: T0 + 5000 });
  const later = memberView(fake, finished, { now: T0 + 3600000 });
  assert.equal(lines, 1);
  assert.equal(first.depuis, 5);
  assert.equal(later.depuis, 3600); // jamais figé dans la mémoire
  assert.equal(later.inactiveDepuis, 3600);
  const live = { id: 'vivant', state: 'running', createdAt: iso(0) };
  memberView(fake, live, { now: T0 });
  memberView(fake, live, { now: T0 + 1999 });
  assert.equal(lines, 2);
  memberView(fake, live, { now: T0 + 2000 });
  assert.equal(lines, 3);
  // Changement d'état : recalculé tout de suite.
  memberView(fake, { ...live, state: 'completed', finishedAt: iso(2500) }, { now: T0 + 2100 });
  assert.equal(lines, 4);
  // Mémoire bornée : après beaucoup de membres, le premier est oublié puis recalculé.
  for (let i = 0; i < 2100; i++) memberView(fake, { ...finished, id: `m${i}` }, { now: T0 });
  const count = lines;
  memberView(fake, finished, { now: T0 });
  assert.equal(lines, count + 1);
});

test('catalogue : état réel de chaque agent', async (t) => {
  const { get } = await platform(t);
  const { data } = await get('/catalog');
  assert.ok(data.agents.length > 0);
  for (const agent of data.agents) assert.equal(typeof agent.etat, 'string', agent.id);
  assert.equal(data.agents.find((a) => a.id === 'fixture').etat, 'pret');
  const jusqua = new Date(Date.now() + 3600000).toISOString();
  const later = new Date(Date.now() + 7200000).toISOString();
  const agents = [
    { id: 'a', installed: true, compatible: true },
    { id: 'b', installed: true, compatible: true },
    { id: 'c', installed: false },
  ];
  const probes = {
    a: { at: new Date().toISOString(), limite: { classe: 'limite', jusqua } },
    b: { at: new Date().toISOString(), limitesModele: { 'modele-fictif': { jusqua: later } } },
  };
  const [a, b, c] = publicAgents(agents, probes, true);
  assert.equal(a.etat, 'limite');
  assert.equal(a.jusqua, jusqua);
  assert.equal(typeof a.raison, 'string');
  assert.deepEqual(b.modelesLimites, { 'modele-fictif': later });
  assert.equal(b.etat, 'pret');
  assert.equal('raison' in b || 'jusqua' in b, false);
  assert.equal(c.etat, 'non_installe');
  assert.equal(publicAgents(agents, probes)[0].etat, 'mode_reel_eteint');
});
