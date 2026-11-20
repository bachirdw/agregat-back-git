// swarm-12, relecture indépendante : la règle « mission privée » du rappel sans nom de pack écrit en
// dur, les nombres de l'agrégat égaux à ceux du Bilan sur des familles variées, la confidentialité,
// la robustesse des messages du chef. Faux moteur FICTIF en mémoire, dates fixes, aucun agent réel,
// aucun modèle, aucun réseau. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Delegation } from '../packages/orchestrator/delegation.js';
import { packs } from '../packages/orchestrator/packs.js';
import { agregat, messagesDuChef } from '../packages/orchestrator/taches.js';
import { REFUSED_CHILD, prerequisiteFailed } from '../packages/orchestrator/delegation-rule.js';

const T0 = '2026-11-21T00:00:00.000Z';
const at = (s) => new Date(Date.parse(T0) + s * 1000).toISOString();
const PACK_GENERAL = packs[0].id; // le pack de repli de getPack (packages/orchestrator/packs.js)
const DEMANDE = 'Demande FICTIVE et confidentielle du propriétaire.';

function fake(t, mother = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'swarm-12-relecture-FICTIF-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const rows = new Map();
  const events = [];
  const store = {
    get: (id) => rows.get(id),
    children: (id) => [...rows.values()].filter((r) => r.famille?.mere === id),
    update: (id, p) => rows.set(id, { ...rows.get(id), ...p }),
    on: () => {},
    off: () => {},
    event: (id, type, data) => events.push({ id, type, data, at: T0 }),
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
  const delegation = new Delegation(engine);
  delegation.now = () => Date.parse(T0);
  const m = {
    id: 'mere-FICTIVE',
    state: 'running',
    agent: 'fictif',
    cwd,
    prompt: DEMANDE,
    multiAgent: true,
    estMere: true,
    delegation: { accepted: true, total: 300, parallel: 3 },
    ...mother,
  };
  rows.set(m.id, m);
  const control = { abort: new AbortController(), mere: true };
  engine.active.set(m.id, control);
  let n = 0;
  const child = (titre, state, famille = {}, more = {}) => {
    const id = `${String(++n).padStart(3, '0')}-${titre}`;
    rows.set(id, {
      id,
      title: titre,
      state,
      agent: 'fictif',
      cwd,
      createdAt: at(n),
      startedAt: at(n),
      ...(['queued', 'running'].includes(state) ? {} : { finishedAt: at(n + 1) }),
      famille: { mere: m.id, titre, ...famille },
      ...more,
    });
    return id;
  };
  const wait = (args = {}) =>
    delegation.wait(rows.get(m.id), control, { toutes: true, delaiSecondes: 1, ...args });
  const synthesis = () => delegation.synthesis(m.id, control, { continueSession: () => true });
  return { rows, events, store, engine, delegation, mother: m, control, child, wait, synthesis };
}

// ---- 1. mission privée : aucun nom de pack dans le code neuf, règle prudente

test('swarm-12 relecture (1) : le code neuf ne nomme aucun pack ni Skill', () => {
  for (const file of ['packages/orchestrator/taches.js', 'packages/orchestrator/delegation.js']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /career-ops|najah/i, file);
  }
});

test('swarm-12 relecture (2) : la demande n’est donnée que sans espace privé et au pack général par défaut', async (t) => {
  // Le pack général, sans espace de travail : demande rendue (attente et synthèse).
  const g = fake(t, { pack: PACK_GENERAL });
  g.child('Part A', 'completed');
  // (la synthèse d'abord : après une attente, tout est déjà remis et elle ne rend plus de tour)
  assert.equal((await g.synthesis()).familyResults.demande, DEMANDE);
  assert.equal((await g.wait()).rappel.demande, DEMANDE);

  // Un autre pack, sans espace de travail, hors mode propriétaire : pas de demande.
  for (const mother of [
    { pack: 'pack-FICTIF' },
    {}, // pack inconnu : dans le doute, rien
    { pack: PACK_GENERAL, workspace: 'espace-FICTIF' },
  ]) {
    const p = fake(t, mother);
    p.child('Part A', 'completed');
    const tour = await p.synthesis();
    assert.equal(tour.familyResults.demande, undefined, JSON.stringify(mother));
    assert.equal(JSON.stringify(tour).includes('confidentielle'), false);
    const attente = await p.wait();
    assert.equal(attente.rappel, undefined, JSON.stringify(mother));
    assert.equal(JSON.stringify(attente).includes('confidentielle'), false);
  }

  // Règle prudente : le mode propriétaire ne rend pas la demande d'une mission à espace privé.
  const o = fake(t, { pack: 'pack-FICTIF', workspace: 'espace-FICTIF' });
  o.engine.ownerMode = true;
  o.child('Part A', 'completed');
  assert.equal((await o.wait()).rappel, undefined);
});

// ---- 2. agrégat = ligne « Par tâche (dernière tentative) » du Bilan

function bilanCounts(bilan) {
  const m = bilan.match(
    /Par tâche \(dernière tentative\) : (\d+) tâche\(s\) : (\d+) aboutie\(s\), (\d+) en échec, (\d+) annulée\(s\), (\d+) interrompue\(s\)(?:, (\d+) encore en cours)?/,
  );
  assert.ok(m, `ligne « Par tâche » absente du Bilan :\n${bilan}`);
  const [taches, abouties, enEchec, annulees, interrompues, enCours = '0'] = m.slice(1);
  return { taches, abouties, enEchec, annulees, interrompues, enCours };
}
const countsOf = (a) =>
  Object.fromEntries(
    ['taches', 'abouties', 'enEchec', 'annulees', 'interrompues', 'enCours'].map((k) => [
      k,
      String(a[k]),
    ]),
  );
const sameAsBilan = (f) =>
  assert.deepEqual(
    countsOf(f.delegation.agregatOf(f.rows.get(f.mother.id))),
    bilanCounts(f.delegation.familyBilan(f.rows.get(f.mother.id))),
  );

test('swarm-12 relecture (3) : agrégat et Bilan comptent pareil (suite en cours, annulée, refusée, tenue en file)', async (t) => {
  const f = fake(t, { pack: PACK_GENERAL });
  const a = f.child('Part A', 'completed');
  f.child('Part A (suite)', 'running', { continue: a });
  const b = f.child('Part B', 'failed', {}, { error: 'Échec FICTIF' });
  f.child('Part B (reprise)', 'cancelled', { reprend: b }, { error: 'Annulée par le chef' });
  f.child('Part C', 'cancelled', {}, { error: REFUSED_CHILD });
  f.child('Part D', 'interrupted');
  const held = f.child('Part E', 'cancelled'); // en file : le Bilan la compte « queued »
  f.delegation.family(f.mother.id).held.set(held, { run: f.rows.get(held) });
  sameAsBilan(f);
  const a1 = f.delegation.agregatOf(f.rows.get(f.mother.id));
  assert.equal(a1.enCours, 2);
  assert.equal(a1.taches, 4);
  // Ni l'attente (une tourne, une en file) ni rien d'autre ne rend l'agrégat.
  assert.equal((await f.wait({ ids: [b] })).agregat, undefined);
});

test('swarm-12 relecture (4) : agrégat et Bilan comptent pareil sur une chaîne de 200 tentatives et une chaîne en boucle', (t) => {
  const f = fake(t, { pack: PACK_GENERAL });
  let prev = f.child('T0', 'failed', {}, { error: 'Échec FICTIF' });
  for (let i = 1; i < 200; i++)
    prev = f.child(`T${i}`, i === 199 ? 'completed' : 'failed', { reprend: prev }, { error: 'x' });
  f.child('Autre', 'failed', {}, { error: 'Échec FICTIF' });
  sameAsBilan(f);
  const a = f.delegation.agregatOf(f.rows.get(f.mother.id));
  assert.equal(a.taches, 2);
  assert.equal(a.parTache[0].tentatives, 200);

  // Chaîne en boucle (données abîmées) : rien ne bloque et les nombres restent ceux du Bilan.
  const g = fake(t, { pack: PACK_GENERAL });
  g.child('X', 'failed', { reprend: '002-Y' }, { error: 'x' });
  g.child('Y', 'completed', { reprend: '003-Z' });
  g.child('Z', 'cancelled', { continue: '001-X' }, { error: 'x' });
  g.child('W', 'interrupted', { reprend: '001-X' });
  sameAsBilan(g);
});

// ---- 3. confidentialité : titres d'une mission privée

test('swarm-12 relecture (5) : une mission privée ne sort ni sa demande ni d’autre titre que ceux déjà stockés', async (t) => {
  const f = fake(t, { pack: 'pack-FICTIF', workspace: 'espace-FICTIF' });
  // launch() écrit pour une mission privée un titre générique : c'est lui qui ressort.
  const a = f.child('Sous-mission 1', 'failed', {}, { error: 'Échec FICTIF' });
  f.child(
    'Sous-mission 2',
    'cancelled',
    { apres: [a] },
    { error: prerequisiteFailed('Sous-mission 1', 'failed') },
  );
  const result = await f.wait();
  const text = JSON.stringify(result);
  assert.equal(text.includes('confidentielle'), false);
  assert.deepEqual(
    result.agregat.parTache.map((p) => p.titre),
    ['Sous-mission 1', 'Sous-mission 2'],
  );
  const echec = result.terminees.find((item) => item.id === a);
  assert.deepEqual(
    echec.dependantesAnnulees.map((d) => d.titre),
    ['Sous-mission 2'],
  );
  // Mêmes titres que outcome() et line() donnent déjà.
  assert.equal(echec.titre, f.delegation.line(f.rows.get(a)).titre);
});

// ---- 4. robustesse

test('swarm-12 relecture (6) : événements mal typés et magasin qui échoue ne font rien lever', async (t) => {
  assert.deepEqual(
    messagesDuChef([
      { type: 'owner_message', data: 'x' },
      { type: 'owner_message', data: null },
      { type: 'owner_message', data: { id: 5, de: 'chef', state: 'undelivered', via: 7 } },
      null,
      'x',
    ]),
    [{ id: '5', etat: 'undelivered', via: 7 }],
  );
  assert.equal(agregat([{ id: {}, state: 3, famille: 'x' }, { state: null }]).taches, 2);

  const f = fake(t, { pack: PACK_GENERAL });
  f.child('Part A', 'completed');
  const children = f.store.children;
  f.delegation.childrenOf = () => children(f.mother.id); // wait() lit d'abord la famille
  const first = await f.wait();
  assert.ok(first.agregat);
  // Les lectures neuves échouent (après le début de l'attente) : champs neufs absents, rien ne lève.
  let calls = 0;
  f.delegation.childrenOf = () => {
    if (calls++ === 0) return children(f.mother.id);
    throw new Error('magasin FICTIF en échec');
  };
  const second = await f.wait();
  assert.equal(second.agregat, undefined);
  assert.deepEqual(second.rappel, { demande: DEMANDE, enCours: 0 });
});

// ---- 5. coût

test('swarm-12 relecture (7) : les sœurs ne sont pas relues pour chaque résultat d’une attente (pas de coût quadratique)', async (t) => {
  const f = fake(t, { pack: PACK_GENERAL });
  const premiere = f.child('Part 0', 'failed', {}, { error: 'Échec FICTIF' });
  for (let i = 1; i < 20; i++) f.child(`Part ${i}`, 'failed', {}, { error: 'Échec FICTIF' });
  const dep = f.child(
    'Synthèse',
    'cancelled',
    { apres: [premiere] },
    { error: prerequisiteFailed('Part 0', 'failed') },
  );
  const children = f.store.children;
  let lectures = 0;
  f.store.children = (id) => {
    lectures++;
    return children(id);
  };
  const result = await f.wait();
  // 21 résultats complets : une lecture au début de l'attente, quelques-unes pour agregat et
  // rappel, une seule pour toutes les dépendantes (et non une par sous-mission en échec).
  assert.ok(lectures <= 6, `lectures des sœurs : ${lectures}`);
  assert.equal(result.terminees.length, 21);
  assert.deepEqual(result.terminees.find((item) => item.id === premiere).dependantesAnnulees, [
    { id: dep, titre: 'Synthèse' },
  ]);
  // Une sœur annulée après coup est vue au prochain appel (la lecture n'est pas gardée).
  const tard = f.child(
    'Tardive',
    'cancelled',
    { apres: [premiere] },
    {
      error: prerequisiteFailed('Part 0', 'failed'),
    },
  );
  assert.deepEqual(
    f.delegation.outcome(f.rows.get(premiere)).dependantesAnnulees.map((d) => d.id),
    [dep, tard],
  );
});
