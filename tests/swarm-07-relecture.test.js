import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../apps/api/server.js';
import { memberView, teamSummary, withTeam } from '../packages/orchestrator/team-view.js';

// swarm-07 (relecture indépendante) : `teDemande` en nombre, routes qui ne lèvent pas pour un champ
// d'affichage, coupe propre d'un caractère sur deux unités, mémoire d'un membre repris. Données fictives.
const T0 = Date.parse('2026-11-21T10:00:00.000Z');
const iso = (ms) => new Date(T0 + ms).toISOString();

async function platform(t) {
  const app = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'relay-swarm-07-rel-')) });
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
const fakeDelegation = (answer, error = '') => ({
  line: () => ({ modele: 'm', outils: 0, dernierOutil: null }),
  outcome: () => ({ cause: { type: 'erreur', reprise: null, message: error } }),
  doneOf: () => ({}),
  store: { events: () => [] },
  engine: { modelAnswerOf: () => answer() },
});

test('teDemande : nombre de membres qui attendent le propriétaire, 0 sinon', async (t) => {
  const { store, delegation, get } = await platform(t);
  const mother = row(store, { state: 'running', estMere: true });
  const famille = { mere: mother.id, titre: 'M' };
  const a = row(store, { state: 'queued', famille });
  const b = row(store, { state: 'running', famille });
  const c = row(store, { state: 'queued', famille });
  row(store, { state: 'completed', famille });
  assert.equal(teamSummary(delegation, mother).teDemande, 0);
  store.update(a.id, { state: 'awaiting_owner' });
  store.update(b.id, { state: 'waiting_permission' });
  const original = delegation.heldState.bind(delegation);
  delegation.heldState = (id) => (id === c.id ? 'attend_accord' : original(id));
  assert.equal(teamSummary(delegation, mother).teDemande, 3);
  delegation.heldState = original;
  const { data } = await get('/runs');
  assert.deepEqual(data.find((r) => r.id === mother.id).equipe, {
    membres: 4,
    enCours: 3,
    finis: 1,
    echecs: 0,
    teDemande: 2,
  });
});

test('une erreur de lecture ne rend jamais une erreur 500 : au pire le champ manque', async (t) => {
  const { store, delegation, get } = await platform(t);
  const mother = row(store, { state: 'running', estMere: true });
  const child = row(store, {
    state: 'completed',
    famille: { mere: mother.id, titre: 'M' },
    result: { answer: 'A', summary: 'S' },
  });
  const plain = await get(`/runs/${mother.id}`);
  const line = delegation.line.bind(delegation);
  let calls = 0;
  // `view()` lit `line()` une fois par membre ; la vue d'équipe la relit : seule celle-ci lève.
  delegation.line = (run) => {
    if (++calls % 2 === 0) throw new Error('lecture impossible (FICTIF)');
    return line(run);
  };
  const team = await get(`/runs/${mother.id}?equipe=1`);
  delegation.line = line;
  assert.equal(team.status, 200);
  assert.deepEqual(team.data.family, plain.data.family);
  assert.equal(team.data.family[0].id, child.id);

  const childrenOf = delegation.childrenOf.bind(delegation);
  delegation.childrenOf = () => {
    throw new Error('base indisponible (FICTIF)');
  };
  const list = await get('/runs');
  delegation.childrenOf = childrenOf;
  assert.equal(list.status, 200);
  assert.equal('equipe' in list.data.find((r) => r.id === mother.id), false);
  assert.equal(teamSummary({ hasFamily: () => true, childrenOf: () => null }, mother), null);
});

test('memberView : une réponse illisible laisse le membre sans `resultat`', () => {
  const view = memberView(
    fakeDelegation(() => {
      throw new Error('fichier illisible (FICTIF)');
    }),
    { id: 'illisible', state: 'completed', createdAt: iso(0) },
    { now: T0 },
  );
  assert.equal('resultat' in view, false);
  assert.equal(view.modele, 'm');
});

test('resultat et cause.message ne coupent pas un caractère sur deux unités', () => {
  const emoji = '\u{1F600}';
  const done = memberView(
    fakeDelegation(() => 'R'.repeat(599) + emoji + 'fin'),
    { id: 'emoji-fini', state: 'completed', createdAt: iso(0) },
    { now: T0 },
  );
  assert.equal(done.resultat, 'R'.repeat(599));
  const failed = memberView(
    fakeDelegation(() => '', 'E'.repeat(299) + emoji + 'fin'),
    { id: 'emoji-echec', state: 'failed', createdAt: iso(0) },
    { now: T0 },
  );
  assert.equal(failed.cause.message, 'E'.repeat(299));
  const whole = memberView(
    fakeDelegation(() => 'R'.repeat(598) + emoji),
    { id: 'emoji-entier', state: 'completed', createdAt: iso(0) },
    { now: T0 },
  );
  assert.equal(whole.resultat, 'R'.repeat(598) + emoji);
});

test('mémoire : un membre fini, repris sur place puis fini de nouveau, est recalculé', () => {
  let answer = 'première réponse';
  const fake = fakeDelegation(() => answer);
  const first = { id: 'repris', state: 'completed', createdAt: iso(0), startedAt: iso(0) };
  const before = memberView(fake, { ...first, finishedAt: iso(1000) }, { now: T0 + 5000 });
  assert.equal(before.resultat, 'première réponse');
  assert.equal(before.dureeMs, 1000);
  answer = 'seconde réponse';
  const after = memberView(
    fake,
    { ...first, startedAt: iso(6000), finishedAt: iso(9000) },
    { now: T0 + 10000 },
  );
  assert.equal(after.resultat, 'seconde réponse');
  assert.equal(after.dureeMs, 3000);
});

test('membre privé sous une mère publique, et l’inverse : aucun texte par aucune route', async (t) => {
  const { store, delegation, get } = await platform(t);
  const secret = 'TEXTE-PRIVE-FICTIF';
  const make = (motherWs, childWs) => {
    const mother = row(store, { state: 'running', estMere: true, ...motherWs });
    const famille = { mere: mother.id, titre: 'Sous-mission 1', pourquoi: 'parallele' };
    const done = row(store, {
      state: 'completed',
      famille,
      title: 'Sous-mission 1',
      result: { answer: secret, summary: 'S' },
      ...childWs,
    });
    const failed = row(store, {
      state: 'failed',
      famille,
      title: 'Sous-mission 1',
      error: `Limite d’usage atteinte : réessayer à 23:27. ${secret}`,
      ...childWs,
    });
    return { mother, done, failed };
  };
  const ws = { workspace: 'espace-fictif' };
  const cases = [make({}, ws), make(ws, {})];
  for (const { mother, done, failed } of cases) {
    const detail = await get(`/runs/${mother.id}?equipe=1`);
    assert.equal(detail.status, 200);
    const text = JSON.stringify(detail.data.family);
    assert.ok(!text.includes(secret), text);
    const byId = Object.fromEntries(detail.data.family.map((e) => [e.id, e]));
    assert.equal('resultat' in byId[done.id], false);
    assert.deepEqual(byId[failed.id].cause, { type: 'limite_usage', reprise: '23:27' });
    assert.ok(
      !JSON.stringify((await get('/runs')).data.find((r) => r.id === mother.id)).includes(secret),
    );
  }
  // Mission publique : le texte sort (contrôle que le test sait le voir).
  const open = make({}, {});
  const view = withTeam(delegation.view(open.mother), delegation, open.mother);
  assert.ok(JSON.stringify(view.family).includes(secret));
});
