// swarm-12 : suivi par tâche et retours au chef. `agregat` (compte par tâche, dernière tentative) dans
// mission_attendre et le tour de synthèse, `rappel` de la demande du propriétaire, `dependantesAnnulees`
// et `messagesDuChef` dans le résultat d'une sous-mission, `boucle` dans la ligne d'un membre.
// Fonctions pures de packages/orchestrator/taches.js, puis un faux moteur FICTIF (store en mémoire,
// horloge injectée par des dates fixes) autour de la vraie classe Delegation. Aucun modèle, aucun
// agent réel, aucun réseau. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Delegation } from '../packages/orchestrator/delegation.js';
import {
  MESSAGE_NON_REMIS,
  RAPPEL_MAX,
  agregat,
  demandeCourte,
  dependantesAnnulees,
  dernierVerdictParTache,
  messagesDuChef,
  parTache,
  tacheDe,
} from '../packages/orchestrator/taches.js';
import {
  MISSION_TOOLS,
  REFUSED_CHILD,
  prerequisiteFailed,
} from '../packages/orchestrator/delegation-rule.js';

const T0 = '2026-11-21T00:00:00.000Z';
const at = (s) => new Date(Date.parse(T0) + s * 1000).toISOString();

// ---- faux moteur

function fake(t, { prompt = 'Demande FICTIVE du propriétaire.', mother: extra = {} } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'swarm-12-FICTIF-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const rows = new Map();
  const events = [];
  const store = {
    get: (id) => rows.get(id),
    children: (id) => [...rows.values()].filter((r) => r.famille?.mere === id),
    update: (id, p) => rows.set(id, { ...rows.get(id), ...p }),
    on: () => {},
    off: () => {},
    event: (id, type, data, when = T0) => events.push({ id, type, data, at: when }),
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
  const mother = {
    id: 'mere-FICTIVE',
    state: 'running',
    agent: 'fictif',
    cwd,
    prompt,
    multiAgent: true,
    estMere: true,
    delegation: { accepted: true, total: 10, parallel: 3 },
    ...extra,
  };
  rows.set(mother.id, mother);
  const control = { abort: new AbortController(), mere: true };
  engine.active.set(mother.id, control);
  let n = 0;
  const child = (titre, state, famille = {}, more = {}) => {
    const id = `${String(++n).padStart(2, '0')}-${titre}`;
    rows.set(id, {
      id,
      title: titre,
      state,
      agent: 'fictif',
      cwd,
      createdAt: at(n),
      startedAt: at(n),
      ...(['queued', 'running'].includes(state) ? {} : { finishedAt: at(n + 1) }),
      famille: { mere: mother.id, titre, ...famille },
      ...more,
    });
    return id;
  };
  const wait = (args = {}) =>
    delegation.wait(rows.get(mother.id), control, { toutes: true, delaiSecondes: 1, ...args });
  return { rows, events, store, engine, delegation, mother, control, child, wait };
}

// Les nombres de la ligne « Par tâche (dernière tentative) » du Bilan de famille.
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

// ---- 1. fonctions pures

test('swarm-12 (1) : une tâche échouée puis reprise avec succès compte une fois, « aboutie »', () => {
  const rows = [
    { id: 'a1', state: 'failed', famille: { titre: 'Part A' } },
    { id: 'a2', state: 'completed', famille: { titre: 'Part A (reprise)', reprend: 'a1' } },
    { id: 'b1', state: 'completed', famille: { titre: 'Part B' } },
  ];
  const a = agregat(rows);
  assert.equal(a.taches, 2);
  assert.equal(a.abouties, 2);
  assert.equal(a.enEchec, 0);
  assert.deepEqual(a.parTache[0], {
    tache: 'a1',
    titre: 'Part A',
    etat: 'completed',
    tentatives: 2,
    derniere: 'a2',
  });
  assert.equal(tacheDe('a2', new Map(rows.map((r) => [r.id, r]))), 'a1');
  assert.equal(parTache(rows).get('a1').tentatives, 2);
});

test('swarm-12 (2) : une suite en cours compte « en cours », sa tâche une seule fois', () => {
  const rows = [
    { id: 'a1', state: 'completed', famille: { titre: 'Part A' } },
    { id: 'a2', state: 'running', famille: { titre: 'Part A (suite)', continue: 'a1' } },
  ];
  const a = agregat(rows);
  assert.equal(a.taches, 1);
  assert.equal(a.abouties, 0);
  assert.equal(a.enCours, 1);
  assert.equal(a.parTache[0].suites, 1);
  assert.equal(a.parTache[0].etat, 'running');
});

test('swarm-12 (3) : entrées vides, null, mal typées ou en boucle ne lèvent pas', () => {
  for (const bad of [null, undefined, 'x', 3, {}, [null, 1, 'x']]) {
    assert.equal(agregat(bad).taches, 0);
    assert.deepEqual(dependantesAnnulees(bad, bad), []);
    assert.deepEqual(messagesDuChef(bad), []);
    assert.equal(dernierVerdictParTache(bad).size, 0);
  }
  const boucle = [
    { id: 'x', state: 'failed', famille: { reprend: 'y' } },
    { id: 'y', state: 'failed', famille: { reprend: 'x' } },
  ];
  assert.ok(agregat(boucle).taches >= 1);
  assert.equal(demandeCourte(null), null);
  assert.equal(demandeCourte('  '), null);
  assert.equal(demandeCourte('x'.repeat(1000)).length, RAPPEL_MAX);
  assert.equal(demandeCourte('Demande', { prive: true }), null);
});

test('swarm-12 (4) : dernierVerdictParTache suit la règle de roles.js (verdict de la dernière tentative relue)', () => {
  const ok = { verdict: 'approuve' };
  const rows = [
    { id: 'a1', state: 'completed' },
    { id: 'v1', state: 'completed', relit: ['a1'], verdict: { verdict: 'a_corriger' } },
    { id: 'a2', state: 'completed', suiteDe: 'a1' },
    { id: 'v2', state: 'completed', relit: ['a2'], verdict: ok },
    // Relit une tentative qui n'est plus la dernière : ne compte pas.
    { id: 'v3', state: 'completed', relit: ['a1'], verdict: { verdict: 'rejete' } },
  ];
  assert.deepEqual(dernierVerdictParTache(rows).get('a1'), ok);
});

// ---- 2. mission_attendre : agregat et rappel

test('swarm-12 (5) : agregat dans mission_attendre quand toutes=true et plus rien ne tourne, mêmes nombres que le Bilan', async (t) => {
  const f = fake(t);
  const a1 = f.child('Part A', 'failed', {}, { error: 'Échec FICTIF' });
  f.child('Part A (reprise)', 'completed', { reprend: a1, reprise: 1 });
  const b1 = f.child('Part B', 'completed');
  f.child('Part B (suite)', 'failed', { continue: b1 }, { error: 'Échec FICTIF' });
  f.child('Part C', 'interrupted');
  f.child('Part D', 'cancelled', {}, { error: REFUSED_CHILD });
  const result = await f.wait();
  assert.ok(result.agregat, 'agregat présent');
  assert.equal(result.agregat.taches, 3);
  assert.equal(result.agregat.abouties, 1);
  assert.equal(result.agregat.enEchec, 1);
  assert.equal(result.agregat.interrompues, 1);
  // Les mêmes nombres que la ligne « Par tâche (dernière tentative) » du Bilan de famille.
  const bilan = f.delegation.familyBilan(f.rows.get(f.mother.id));
  assert.deepEqual(countsOf(result.agregat), bilanCounts(bilan));
  // rappel : la demande et le nombre de sous-missions vivantes ; la clé enCours (liste) inchangée.
  assert.deepEqual(result.rappel, { demande: 'Demande FICTIVE du propriétaire.', enCours: 0 });
  assert.deepEqual(result.enCours, []);
});

test('swarm-12 (6) : agregat absent tant qu’une sous-mission tourne, et sans toutes', async (t) => {
  const f = fake(t);
  const a = f.child('Part A', 'completed');
  f.child('Part B', 'running');
  // ids ne vise que la finie : l'agrégat porte sur toute la famille, B tourne encore.
  const result = await f.wait({ ids: [a] });
  assert.equal(result.agregat, undefined);
  assert.equal(result.rappel.enCours, 1);
  assert.equal(Array.isArray(result.enCours), true);
  const sans = await f.wait({ ids: [a], toutes: false });
  assert.equal(sans.agregat, undefined);
});

test('swarm-12 (7) : agregat absent sans toutes même quand tout est fini', async (t) => {
  const f = fake(t);
  f.child('Part A', 'completed');
  const result = await f.wait({ toutes: false });
  assert.equal(result.agregat, undefined);
});

test('swarm-12 (8) : rappel.demande coupée à 300 caractères, absente pour une mission privée', async (t) => {
  const longue = 'D'.repeat(1000);
  const f = fake(t, { prompt: longue });
  f.child('Part A', 'completed');
  const result = await f.wait();
  assert.equal(result.rappel.demande, 'D'.repeat(300));

  // Privée par la règle de launch() (espace de travail, hors mode propriétaire) : ni demande ni
  // rappel quand plus rien ne tourne.
  const p = fake(t, { prompt: longue, mother: { workspace: 'espace-FICTIF' } });
  p.child('Part A', 'completed');
  const prive = await p.wait();
  assert.equal(prive.rappel, undefined);
  assert.equal(JSON.stringify(prive).includes('DDDD'), false);
  // Il reste à dire le nombre de vivantes : rappel sans demande.
  p.child('Part B', 'running');
  const enCours = await p.wait({ toutes: false, ids: [p.rows.get('01-Part A').id] });
  assert.deepEqual(enCours.rappel, { enCours: 1 });

  // Privée par la règle des messages (pack privé), hors mode propriétaire.
  const q = fake(t, { prompt: longue, mother: { pack: 'career-ops' } });
  q.child('Part A', 'completed');
  assert.equal((await q.wait()).rappel, undefined);
  // En mode propriétaire, la demande est rendue.
  q.engine.ownerMode = true;
  assert.equal((await q.wait()).rappel.demande.length, 300);
});

// ---- 3. outcome : dependantesAnnulees, messagesDuChef, mêmes clés

const KEYS = ['id', 'titre', 'etat', 'reponse', 'bilan', 'fichiers', 'envois', 'cause'];

test('swarm-12 (9) : sans reprise, prérequis, message ni boucle : mêmes clés qu’aujourd’hui dans terminees[]', async (t) => {
  const f = fake(t);
  f.child('Part A', 'completed');
  f.child('Part B', 'failed', {}, { error: 'Échec FICTIF' });
  const result = await f.wait();
  for (const item of result.terminees) assert.deepEqual(Object.keys(item), KEYS);
  // Déjà remises : la ligne courte inchangée.
  const again = await f.wait();
  for (const item of again.terminees)
    assert.deepEqual(Object.keys(item), ['id', 'titre', 'etat', 'dejaRemise']);
});

test('swarm-12 (10) : prérequis en échec → le résultat de l’échec liste la dépendante annulée', async (t) => {
  const f = fake(t);
  const a = f.child('Collecte', 'failed', {}, { error: 'Échec FICTIF' });
  const b = f.child(
    'Synthèse',
    'cancelled',
    { apres: [a] },
    {
      error: prerequisiteFailed('Collecte', 'failed'),
    },
  );
  // Annulée pour une autre raison : pas une dépendante annulée par ce prérequis.
  f.child('Autre', 'cancelled', { apres: [a] }, { error: 'Annulée par le chef' });
  const result = await f.wait();
  const echec = result.terminees.find((item) => item.id === a);
  assert.deepEqual(echec.dependantesAnnulees, [{ id: b, titre: 'Synthèse' }]);
  // La dépendante elle-même n'en a pas.
  const dep = result.terminees.find((item) => item.id === b);
  assert.equal(dep.dependantesAnnulees, undefined);
  // Un prérequis abouti n'en a jamais.
  f.rows.set(a, { ...f.rows.get(a), state: 'completed' });
  assert.equal(f.delegation.outcome(f.rows.get(a)).dependantesAnnulees, undefined);
});

test('swarm-12 (11) : message du chef resté non remis à la fin d’une sous-mission → messagesDuChef', async (t) => {
  const f = fake(t);
  const a = f.child('Part A', 'completed');
  const b = f.child('Part B', 'completed');
  const id = 'abcdef12-0000-4000-8000-FICTIF000001';
  const base = { at: T0, via: null, deliveredAt: null, de: 'chef' };
  f.store.event(a, 'owner_message', { ...base, id, state: 'pending' });
  f.store.event(a, 'owner_message', { ...base, id, state: 'undelivered' });
  // Un message du propriétaire non remis et un message du chef remis : rien à dire.
  const owner = { ...base, id: 'owner-1', state: 'undelivered' };
  delete owner.de;
  f.store.event(b, 'owner_message', owner);
  f.store.event(b, 'owner_message', { ...base, id: 'chef-2', state: 'pending' });
  f.store.event(b, 'owner_message', { ...base, id: 'chef-2', state: 'delivered', via: 'turn_end' });
  const result = await f.wait();
  const ra = result.terminees.find((item) => item.id === a);
  assert.deepEqual(ra.messagesDuChef, [
    { id: 'abcdef12', etat: 'undelivered', via: null, note: MESSAGE_NON_REMIS },
  ]);
  assert.equal(MESSAGE_NON_REMIS, 'message non remis : mission_continuer pour une suite');
  const rb = result.terminees.find((item) => item.id === b);
  assert.equal(rb.messagesDuChef, undefined);
  assert.deepEqual(Object.keys(rb), KEYS);
});

// ---- 4. line() : boucle

test('swarm-12 (12) : boucle dans la ligne d’un membre seulement quand le garde-boucle a un dernier signalement', async (t) => {
  const f = fake(t);
  const a = f.child('Part A', 'running');
  const before = Object.keys(f.delegation.line(f.rows.get(a)));
  assert.equal(before.includes('boucle'), false);
  f.engine.active.set(a, { loop: { avertissements: 0, dernier: null } });
  assert.equal(f.delegation.line(f.rows.get(a)).boucle, undefined);
  const dernier = { outil: 'lire', fois: 3 };
  f.engine.active.set(a, { loop: { avertissements: 1, dernier } });
  const line = f.delegation.line(f.rows.get(a));
  assert.deepEqual(line.boucle, dernier);
  assert.deepEqual(Object.keys(line), [...before, 'boucle']);
});

// ---- 5. tour de synthèse

test('swarm-12 (13) : le tour de synthèse porte agregat et demande dans familyResults', async (t) => {
  const f = fake(t);
  const a1 = f.child('Part A', 'failed', {}, { error: 'Échec FICTIF' });
  f.child('Part A (reprise)', 'completed', { reprend: a1, reprise: 1 });
  const turn = await f.delegation.synthesis(f.mother.id, f.control, {
    continueSession: () => true,
  });
  assert.equal(turn.familyResults.agregat.taches, 1);
  assert.equal(turn.familyResults.agregat.abouties, 1);
  assert.equal(turn.familyResults.demande, 'Demande FICTIVE du propriétaire.');
  assert.equal(turn.familyResults.terminees.length, 2);

  const p = fake(t, { mother: { workspace: 'espace-FICTIF' } });
  p.child('Part A', 'completed');
  const prive = await p.delegation.synthesis(p.mother.id, p.control, {
    continueSession: () => true,
  });
  assert.equal(prive.familyResults.demande, undefined);
  assert.equal(prive.familyResults.agregat.taches, 1);
});

// ---- 6. rien ne lève (garde)

test('swarm-12 (14) : une erreur imprévue dans le calcul d’un champ neuf ne fait rien lever, le champ est absent', async (t) => {
  const f = fake(t);
  const a = f.child('Part A', 'failed', {}, { error: 'Échec FICTIF' });
  const b = f.child('Part B', 'completed');
  // Une ligne dont la remontée de chaîne et les prérequis lèvent.
  const piege = f.rows.get(b);
  Object.defineProperty(piege.famille, 'reprend', {
    get() {
      throw new Error('lecture FICTIVE en échec');
    },
  });
  Object.defineProperty(piege.famille, 'apres', {
    get() {
      throw new Error('lecture FICTIVE en échec');
    },
  });
  f.engine.active.set(a, {
    get loop() {
      throw new Error('lecture FICTIVE en échec');
    },
  });
  f.engine.turnObjective = () => {
    throw new Error('lecture FICTIVE en échec');
  };
  const turn = await f.delegation.synthesis(f.mother.id, f.control, {
    continueSession: () => true,
  });
  assert.equal(turn.familyResults.agregat, undefined);
  assert.equal(turn.familyResults.demande, undefined);
  assert.equal(turn.familyResults.terminees.length, 2);
  const result = await f.wait();
  assert.equal(result.agregat, undefined);
  assert.equal(result.rappel, undefined);
  assert.equal(result.terminees.length, 2);
  const echec = f.delegation.outcome(f.rows.get(a));
  assert.equal(echec.dependantesAnnulees, undefined);
  assert.deepEqual(Object.keys(echec), KEYS);
  assert.equal(f.delegation.line(f.rows.get(a)).boucle, undefined);
});

// ---- 7. textes

test('swarm-12 (15) : la description de mission_attendre dit agregat, rappel et dependantesAnnulees', () => {
  const d = MISSION_TOOLS.mission_attendre.description;
  for (const word of ['agregat', 'rappel', 'dependantesAnnulees'])
    assert.ok(d.includes(word), word);
  assert.ok(
    d.includes(
      'les sous-missions annulées par un prérequis sont à relancer avec apres vers la reprise',
    ),
  );
  assert.ok(
    d.endsWith(
      ' Un travail rendu ne se relance pas : pour le corriger ou le compléter, mission_continuer ; pour un échec, reprend.',
    ),
  );
  assert.doesNotMatch(d, /claude|codex|gemini|opencode|career-ops|sonnet|opus|gpt/i);
});
