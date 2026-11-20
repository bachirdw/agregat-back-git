// swarm-13 (relecture indépendante) : sans dette de verdict, synthesis() rend exactement ce que
// rendait la base (a8660a4) sur chaque chemin : même tour, mêmes événements, mêmes appels à
// continueSession(), même état de famille. La méthode de la base est recopiée ci-dessous MOT POUR MOT
// (git show a8660a4:packages/orchestrator/delegation.js, `async synthesis`) et jouée sur la même
// instance de Delegation que la méthode d'aujourd'hui, sur deux familles fictives identiques.
// Puis : tailles bornées de verdictsEnAttente, événement qui lève, Bilan après un redémarrage.
// Faux moteur en mémoire ; aucun modèle, aucun réseau. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

delete process.env.AGENT_PLATFORM_VERDICT_TURN;
const { Delegation } = await import('../packages/orchestrator/delegation.js');
const { packs } = await import('../packages/orchestrator/packs.js');
const { SYNTHESIS_TURN, VERDICT_TURN } = await import(
  '../packages/orchestrator/delegation-rule.js'
);
const { MAX_EN_ATTENTE } = await import('../packages/orchestrator/taches.js');

// ---- la méthode de la base, recopiée telle quelle (a8660a4)
async function baseSynthesis(motherId, control, runtime) {
  if (!control?.mere) return null;
  const mother = this.store.get(motherId);
  const living = this.living(mother);
  // multi-agent-v3-02 (D) : those already ended whose result never reached the chief are joined too.
  const family = this.family(motherId);
  const given = [...living, ...this.undelivered(mother, family)];
  if (!given.length) return null;
  if (runtime.continueSession()) {
    if (living.length) await this.waitLiving(motherId, mother, control, family);
    if (!control.abort.signal.aborted && runtime.continueSession())
      return {
        familyResults: {
          nature: 'données rapportées par les sous-missions',
          terminees: given.map((child) => this.deliver(family, this.store.get(child.id))),
          ...this.carnet.forChief(mother), // equipe-carnet
          // swarm-12 : the count per task and the owner's request (each absent when unknown).
          ...this.retoursSynthese(mother),
        },
        instructions: SYNTHESIS_TURN,
      };
  }
  this.missed(family, given);
  return null;
}

const T0 = '2026-11-21T00:00:00.000Z';
const at = (s) => new Date(Date.parse(T0) + s * 1000).toISOString();
const FOLDER = 'relay/missions/FICTIF/verif';

function fake(t, { reglage, eventThrows = false } = {}) {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-13-relecture-FICTIF-')));
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
    event: (id, type, data) => {
      if (eventThrows && type === 'verdict_turn') throw new Error('écriture FICTIVE en échec');
      events.push({ id, type, data });
    },
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
  const finish = (id) => {
    rows.set(id, { ...rows.get(id), state: 'completed', finishedAt: at(50) });
    delegation.wake(delegation.family(mother.id));
  };
  return { rows, events, delegation, mother, control, child, verif, finish, cwd, engine };
}

// The chief's session : answers in order (the last one repeats), calls counted.
const session = (...answers) => {
  const runtime = {
    calls: 0,
    continueSession: () => answers[Math.min(runtime.calls++, answers.length - 1)],
  };
  return runtime;
};

// Families : none (no verification), approuve (last verdict approved), dette (a_corriger : with the
// setting 0 only, where nothing must change either).
const FAMILLES = {
  sansVerification: (f) => [f.child('Rapport', 'completed')],
  approuve: (f) => {
    const a = f.child('Rapport', 'completed');
    return [a, f.verif([a], 'Relu FICTIF.\nVerdict : approuve')];
  },
  suiteApprouvee: (f) => {
    const a = f.child('Rapport', 'completed');
    const v = f.verif([a], 'Verdict : a_corriger');
    const s = f.child('Rapport (suite)', 'completed', { continue: a });
    return [a, v, s, f.verif([s], 'Verdict : approuve')];
  },
};

// The paths of synthesis() today. `prepare` sets the family up after the base rows (all delivered),
// returns { control?, runtime, during? } ; `during` runs while synthesis() waits.
const CHEMINS = {
  rienARemettre: () => ({ runtime: session(true) }),
  resultatsARemettre: (f) => {
    f.child('Annexe', 'completed');
    return { runtime: session(true) };
  },
  sousMissionVivante: (f) => {
    const l = f.child('Annexe', 'running');
    return { runtime: session(true), during: () => f.finish(l) };
  },
  pasUneMere: (f) => {
    f.child('Annexe', 'completed');
    return { control: { ...f.control, mere: false }, runtime: session(true) };
  },
  modeEteint: (f) => {
    f.child('Annexe', 'completed');
    return { control: { abort: f.control.abort }, runtime: session(true) };
  },
  abandon: (f) => {
    f.child('Annexe', 'completed');
    const abort = new AbortController();
    abort.abort(new Error('arrêt FICTIF'));
    return { control: { ...f.control, abort }, runtime: session(true) };
  },
  abandonPendantAttente: (f) => {
    f.child('Annexe', 'running');
    const abort = new AbortController();
    return {
      control: { ...f.control, abort },
      runtime: session(true),
      during: () => abort.abort(new Error('arrêt FICTIF')),
    };
  },
  sessionFermee: (f) => {
    f.child('Annexe', 'completed');
    return { runtime: session(false) };
  },
  sessionFermeeApresAttente: (f) => {
    const l = f.child('Annexe', 'running');
    return { runtime: session(true, false), during: () => f.finish(l) };
  },
  sessionFermeeRienARemettre: () => ({ runtime: session(false) }),
};

async function jouer(t, famille, chemin, methode, options = {}) {
  const f = fake(t, options);
  FAMILLES[famille](f);
  const family = f.delegation.family(f.mother.id);
  for (const row of f.engine.store.children(f.mother.id)) f.delegation.deliver(family, row);
  const { control = f.control, runtime, during } = CHEMINS[chemin](f);
  const pending = methode.call(f.delegation, f.mother.id, control, runtime);
  if (during) setImmediate(during);
  const turn = await pending;
  const clean = (x) => JSON.parse(JSON.stringify(x ?? null).replaceAll(f.cwd, '<CWD>'));
  return {
    turn: clean(turn),
    events: clean(f.events),
    calls: runtime.calls,
    delivered: [...(family.delivered ?? [])],
    unsynthesized: [...(family.unsynthesized ?? [])],
    verdictTurn: family.verdictTurn,
    bilan: clean(f.delegation.familyBilan(f.mother, { chiefAnswer: 'Réponse FICTIVE.' })),
    f,
  };
}

const today = Delegation.prototype.synthesis;

for (const famille of Object.keys(FAMILLES))
  for (const chemin of Object.keys(CHEMINS))
    test(`swarm-13 (relecture, point 1) : sans dette, ${chemin} / ${famille} → identique à la base`, async (t) => {
      const base = await jouer(t, famille, chemin, baseSynthesis);
      const now = await jouer(t, famille, chemin, today);
      for (const key of ['turn', 'events', 'calls', 'delivered', 'unsynthesized', 'bilan'])
        assert.deepEqual(now[key], base[key], key);
      assert.equal(now.verdictTurn, undefined);
      assert.doesNotMatch(now.bilan, /Réponse finale donnée malgré/);
      if (now.turn) assert.equal(now.turn.instructions, SYNTHESIS_TURN);
    });

// The setting 0 with a real debt : every turn, event and call of today (only the Bilan line is new).
for (const chemin of Object.keys(CHEMINS))
  test(`swarm-13 (relecture, point 1) : réglage 0 et dette a_corriger, ${chemin} → tour identique à la base`, async (t) => {
    const dette = (f) => {
      const a = f.child('Rapport', 'completed');
      return [a, f.verif([a], 'Verdict : a_corriger')];
    };
    FAMILLES.dette = dette;
    try {
      const base = await jouer(t, 'dette', chemin, baseSynthesis, { reglage: '0' });
      const now = await jouer(t, 'dette', chemin, today, { reglage: '0' });
      for (const key of ['turn', 'events', 'calls', 'delivered', 'unsynthesized'])
        assert.deepEqual(now[key], base[key], key);
      assert.equal(now.verdictTurn, undefined);
    } finally {
      delete FAMILLES.dette;
    }
  });

// With a debt, every path where today gives no turn still gives none (no loop, no extra call).
test('swarm-13 (relecture, point 2) : dette a_corriger sur les chemins sans tour → toujours null, continueSession() comme la base', async (t) => {
  FAMILLES.dette = (f) => {
    const a = f.child('Rapport', 'completed');
    return [a, f.verif([a], 'Verdict : a_corriger')];
  };
  try {
    for (const chemin of [
      'pasUneMere',
      'modeEteint',
      'abandon',
      'abandonPendantAttente',
      'sessionFermee',
      'sessionFermeeApresAttente',
      'sessionFermeeRienARemettre',
    ]) {
      const base = await jouer(t, 'dette', chemin, baseSynthesis);
      const now = await jouer(t, 'dette', chemin, today);
      assert.equal(now.turn, null, chemin);
      // Nothing to give and a debt : the session is asked once (last), and closed means no turn ;
      // continueSession() answered false has no effect (agent-runtime : `ready` set on true only).
      assert.equal(now.calls, base.calls + (chemin === 'sessionFermeeRienARemettre'), chemin);
      assert.deepEqual(now.events, base.events, chemin);
      assert.equal(now.verdictTurn, undefined, chemin);
    }
    // Where today gives no turn but a debt exists : exactly one turn, then never again.
    const now = await jouer(t, 'dette', 'rienARemettre', today);
    assert.equal(now.turn.instructions, VERDICT_TURN);
    assert.equal(now.calls, 1);
    const again = session(true);
    assert.equal(await now.f.delegation.synthesis(now.f.mother.id, now.f.control, again), null);
    assert.equal(again.calls, 0);
  } finally {
    delete FAMILLES.dette;
  }
});

// ---- point 4 : tailles bornées de ce qui part vers le chef

test('swarm-13 (relecture, point 4) : verdictsEnAttente borné à MAX_EN_ATTENTE tâches ; le Bilan compte toutes les dettes', async (t) => {
  assert.equal(MAX_EN_ATTENTE, 20);
  const f = fake(t);
  // 12 points of 2 × 600 characters : under the 20 Ko of verdict.json, over the 500 per field.
  const long = 'x'.repeat(600);
  const bloquants = Array.from({ length: 12 }, (_, i) => ({ ou: `${i}${long}`, pourquoi: long }));
  const { writeFileSync } = await import('node:fs');
  for (let i = 0; i < 25; i++) {
    const a = f.child(`Travail ${i}`, 'completed');
    const dossier = `${FOLDER}-${i}`;
    mkdirSync(join(f.cwd, dossier), { recursive: true });
    const v = f.child(
      'Vérif',
      'completed',
      { relit: [a], verdictAttendu: true, dossierResultats: dossier },
      { answer: '' },
    );
    writeFileSync(
      join(f.cwd, dossier, 'verdict.json'),
      JSON.stringify({ verdict: 'a_corriger', bloquants }),
    );
    // The file must be written while the verifier ran (read on the file's real date).
    const now = Date.now();
    f.rows.set(v, {
      ...f.rows.get(v),
      startedAt: new Date(now - 60000).toISOString(),
      finishedAt: new Date(now + 60000).toISOString(),
    });
  }
  const family = f.delegation.family(f.mother.id);
  for (const row of f.engine.store.children(f.mother.id)) f.delegation.deliver(family, row);
  const turn = await f.delegation.synthesis(f.mother.id, f.control, session(true));
  const enAttente = turn.familyResults.verdictsEnAttente;
  assert.equal(enAttente.length, MAX_EN_ATTENTE);
  for (const dette of enAttente) {
    assert.equal(dette.bloquants.length, 10);
    for (const b of dette.bloquants) assert.ok(b.ou.length <= 500 && b.pourquoi.length <= 500);
  }
  // Worst case : 20 tasks × 10 points × 1 000 characters, plus titles (80) and ids.
  assert.ok(JSON.stringify(enAttente).length < 20 * (10 * 1100 + 400));
  const event = f.events.find((e) => e.type === 'verdict_turn');
  assert.equal(event.data.taches.length, MAX_EN_ATTENTE);
  assert.match(
    f.delegation.familyBilan(f.mother, { chiefAnswer: 'Réponse FICTIVE.' }),
    /Réponse finale donnée malgré 25 travail\(aux\)/,
  );
});

// ---- point 2 / 3 : un événement qui ne s'écrit pas ne fait pas échouer la mission

test('swarm-13 (relecture, point 3) : l’écriture de verdict_turn qui lève → le tour est rendu, drapeau posé, rien ne lève', async (t) => {
  const f = fake(t, { eventThrows: true });
  const a = f.child('Rapport', 'completed');
  f.verif([a], 'Verdict : a_corriger');
  const family = f.delegation.family(f.mother.id);
  for (const row of f.engine.store.children(f.mother.id)) f.delegation.deliver(family, row);
  const runtime = session(true);
  const turn = await f.delegation.synthesis(f.mother.id, f.control, runtime);
  assert.equal(turn.instructions, VERDICT_TURN);
  assert.equal(family.verdictTurn, true);
  assert.equal(await f.delegation.synthesis(f.mother.id, f.control, session(true)), null);
});

// ---- point 6 : « oui » lu sur l'événement durable après un redémarrage simulé

test('swarm-13 (relecture, point 6) : redémarrage simulé (nouvelle instance, mémoire vide) → Bilan « oui » relu sur l’événement', async (t) => {
  const f = fake(t);
  const a = f.child('Rapport', 'completed');
  f.verif([a], 'Verdict : a_corriger');
  const family = f.delegation.family(f.mother.id);
  for (const row of f.engine.store.children(f.mother.id)) f.delegation.deliver(family, row);
  assert.ok(await f.delegation.synthesis(f.mother.id, f.control, session(true)));
  const after = new Delegation(f.engine);
  const bilan = after.familyBilan(f.mother, { chiefAnswer: 'Réponse FICTIVE.' });
  assert.ok(
    bilan.endsWith(
      '\nRéponse finale donnée malgré 1 travail(aux) dont le dernier verdict n’est pas « approuve » (« Rapport ») ; tour de rattrapage donné au chef : oui.',
    ),
    bilan,
  );
});
