// swarm-05 (plan swarm du 20/11) : doublons au lancement (seule la part identique est refusée, la
// part proche est lancée et signalée) et liste vivante des autres membres (famille.membres) donnée
// à une sous-mission à son vrai départ. Sans agent, sans API, sans navigateur, sans réseau : faux
// moteur FICTIF (création retardée de 20 ms, comme review-multi-agent-v3-01), horloge injectée dans
// les fonctions pures. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Delegation } from '../packages/orchestrator/delegation.js';
import {
  ETATS_IGNORES,
  empreinte,
  jaccard,
  mots,
  partDe,
  texteDePart,
  trouverDoublon,
} from '../packages/orchestrator/doublon.js';
import { aplatir, ilYA, membres } from '../packages/orchestrator/soeurs.js';
import { DAUGHTER_RULE, MISSION_TOOLS } from '../packages/orchestrator/delegation-rule.js';

function fakeEngine(t, { total = 10, parallel = 5, workspace = null, env } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'swarm-05-FICTIF-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const rows = new Map();
  const listeners = new Map();
  const events = [];
  const store = {
    get: (id) => rows.get(id),
    children: (id) => [...rows.values()].filter((r) => r.famille?.mere === id),
    update: (id, p) => {
      rows.set(id, { ...rows.get(id), ...p });
      for (const l of listeners.get(id) ?? [])
        if (p.state) l({ type: 'state', data: { state: p.state }, at: new Date().toISOString() });
    },
    on: (id, l) => {
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id).add(l);
    },
    off: (id, l) => listeners.get(id)?.delete(l),
    event: (id, type, data, at = new Date().toISOString()) => events.push({ id, type, data, at }),
    events: (id) => events.filter((e) => e.id === id),
  };
  const questions = [];
  const created = [];
  const engine = {
    store,
    active: new Map(),
    approvalTokens: new Map(),
    permissions: new Map(),
    ownerMode: false,
    pendingPermission: () => null,
    turnObjective: (run) => run.prompt ?? null,
    enqueueQuestion: (id, question) => {
      questions.push(question);
      return new Promise(() => {});
    },
    async create(input, prev, link) {
      await new Promise((r) => setTimeout(r, 20));
      const id = randomUUID();
      created.push(id);
      rows.set(id, {
        id,
        state: 'queued',
        agent: input.agent,
        prompt: input.prompt,
        ...(input.workspace ? { workspace: input.workspace } : {}),
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
  const saved = process.env.AGENT_PLATFORM_DOUBLON;
  if (env === undefined) delete process.env.AGENT_PLATFORM_DOUBLON;
  else process.env.AGENT_PLATFORM_DOUBLON = env;
  const delegation = new Delegation(engine);
  if (saved === undefined) delete process.env.AGENT_PLATFORM_DOUBLON;
  else process.env.AGENT_PLATFORM_DOUBLON = saved;
  const mother = {
    id: randomUUID(),
    state: 'running',
    agent: 'fictif',
    cwd,
    multiAgent: true,
    delegation: { accepted: true, total, parallel },
    ...(workspace ? { workspace } : {}),
  };
  rows.set(mother.id, mother);
  const control = { abort: new AbortController(), mere: false };
  engine.active.set(mother.id, control);
  const launch = (args) => delegation.launch(rows.get(mother.id), control, args);
  const signals = () =>
    events.filter((e) => e.id === mother.id && e.type === 'doublon_signale').map((e) => e.data);
  return { rows, store, events, questions, created, engine, delegation, mother, launch, signals };
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
const BASE_KEYS = [
  'agent',
  'dossierResultats',
  'espace',
  'etat',
  'famille',
  'id',
  'modele',
  'titre',
];

// ---- 1. jaccard

test('swarm-05 (1) : jaccard, valeurs connues ; « vérifié » et « vérifie » restent des mots entiers', () => {
  assert.equal(jaccard('a b c', 'a b d'), 0.5);
  assert.equal(jaccard('Bonjour, le monde !', 'bonjour le monde'), 1);
  assert.equal(jaccard('', ''), 1);
  assert.equal(jaccard('x', ''), 0);
  assert.equal(jaccard('un deux', 'trois quatre'), 0);
  assert.deepEqual(
    [...mots('Il a vérifié ; elle vérifie.')],
    ['il', 'a', 'vérifié', 'elle', 'vérifie'],
  );
  assert.equal(jaccard('vérifié', 'vérifie'), 0);
  // Un « é » écrit en deux signes (forme NFD) n'est pas coupé.
  assert.equal(jaccard('vérifié'.normalize('NFD'), 'vérifié'), 1);
  assert.deepEqual([...ETATS_IGNORES].sort(), ['cancelled', 'failed', 'interrupted']);
});

test('swarm-05 : empreinte et texte d’une part (ordre fixe, fichiers triés, rôle, champs à leur place)', () => {
  const a = { consigne: 'Lire  A', fichiers: ['b.md', 'a\\x.md'], role: 'Relecteur' };
  const b = { consigne: 'lire a', fichiers: ['a/x.md', 'b.md'], role: 'relecteur' };
  assert.equal(empreinte(a), empreinte(b));
  assert.notEqual(empreinte(a), empreinte({ ...a, role: 'Auteur' }));
  assert.notEqual(empreinte(a), empreinte({ ...a, informations: 'pays FR' }));
  // Le même texte rangé dans deux champs différents n'est pas la même part.
  assert.notEqual(empreinte({ consigne: 'a b' }), empreinte({ consigne: 'a', objectif: 'b' }));
  // Deux vérifications au même texte sur deux sœurs différentes : pas la même part.
  const s1 = randomUUID();
  const s2 = randomUUID();
  assert.notEqual(
    empreinte({ consigne: 'Relis', relit: [s1] }),
    empreinte({ consigne: 'Relis', relit: [s2] }),
  );
  assert.equal(texteDePart({ consigne: 'C', objectif: 'O', fichiers: ['z', 'a'] }), 'C\nO\na z');
  assert.doesNotThrow(() => empreinte(null));
  assert.equal(trouverDoublon(null, []), null);
  assert.equal(trouverDoublon(partDe({ consigne: 'x' }, 'fictif'), null), null);
});

test('swarm-05 : trouverDoublon, identique d’abord, proche aux deux seuils, sœurs en échec ignorées', () => {
  const part = partDe({ consigne: 'un deux trois quatre cinq six sept huit neuf dix' }, 'A');
  const meme = { id: 'm', titre: 'M', agent: 'B', role: null, etat: 'completed', ...part };
  assert.equal(trouverDoublon(part, [meme]).niveau, 'identique');
  assert.equal(trouverDoublon(part, [{ ...meme, etat: 'failed' }]), null);
  assert.equal(trouverDoublon(part, [{ ...meme, etat: 'cancelled' }]), null);
  assert.equal(trouverDoublon(part, [{ ...meme, etat: 'interrupted' }]), null);
  // 7 mots communs, 13 en tout : 0,54, jamais proche.
  const texte = 'un deux trois quatre cinq six sept onze douze treize';
  const voisine = { id: 'v', titre: 'V', agent: 'A', role: null, etat: 'running', texte };
  assert.ok(Math.abs(jaccard(texte, part.texte) - 7 / 13) < 1e-9);
  assert.equal(trouverDoublon(part, [voisine]), null);
  // 9 mots communs sur 11 : 0,82, proche quel que soit l'agent.
  const neuf = 'un deux trois quatre cinq six sept huit neuf onze';
  assert.equal(trouverDoublon(part, [{ ...voisine, texte: neuf, agent: 'B' }]).niveau, 'proche');
  // 8 mots communs sur 12 : 0,67 ; proche seulement avec le même agent et le même rôle.
  const sept = 'un deux trois quatre cinq six sept huit onze douze';
  assert.equal(trouverDoublon(part, [{ ...voisine, texte: sept }]).niveau, 'proche');
  assert.equal(trouverDoublon(part, [{ ...voisine, texte: sept, agent: 'B' }]), null);
  assert.equal(trouverDoublon(part, [{ ...voisine, texte: sept, role: 'Relecteur' }]), null);
});

test('swarm-05 : aplatir, ilYA et membres (deux horloges, vivantes d’abord, 20 au plus, privé sans part)', () => {
  assert.equal(aplatir('a\n  b'), 'a b');
  assert.equal(aplatir('x'.repeat(250)).length, 201);
  assert.ok(aplatir('x'.repeat(250)).endsWith('…'));
  const now = Date.parse('2026-11-21T10:00:00.000Z');
  assert.equal(ilYA('2026-11-21T09:59:18.000Z', now), '42 s');
  assert.equal(ilYA('pas une date', now), 'date inconnue');
  const rows = [
    {
      id: 'a',
      titre: 'A',
      agent: 'x',
      etat: 'completed',
      texte: 'part A',
      creeLe: '2026-11-21T09:00:00.000Z',
    },
    {
      id: 'b',
      titre: 'B',
      role: 'Relecteur',
      agent: 'y',
      etat: 'running',
      texte: 'part B',
      creeLe: '2026-11-21T09:50:00.000Z',
      dernierSigneLe: '2026-11-21T09:59:00.000Z',
    },
    {
      id: 'c',
      titre: 'C',
      agent: 'x',
      etat: 'failed',
      texte: 'part C',
      creeLe: '2026-11-21T09:55:00.000Z',
    },
  ];
  const liste = membres(rows, { now });
  assert.deepEqual(
    liste.map((m) => m.id),
    ['b', 'a'],
  );
  assert.deepEqual(liste[0], {
    id: 'b',
    titre: 'B',
    role: 'Relecteur',
    agent: 'y',
    etat: 'running',
    part: 'part B',
    depuis: 600,
    dernierSigne: 60,
  });
  assert.equal(liste[1].dernierSigne, 3600);
  assert.ok(membres(rows, { now, prive: true }).every((m) => !('part' in m)));
  const many = Array.from({ length: 30 }, (_, i) => ({ ...rows[0], id: `n${i}` }));
  assert.equal(membres(many, { now }).length, 20);
  assert.deepEqual(membres(null, { now }), []);
});

// ---- 2 à 7. Doublons au lancement

test('swarm-05 (2) : deux mission_lancer identiques : la seconde rend doublon, rien n’est créé, l’enveloppe n’est pas consommée', async (t) => {
  const f = fakeEngine(t, { total: 1 });
  const args = {
    consigne: 'Collecter les offres FICTIVES de la source A',
    informations: 'pays FR',
  };
  const first = await f.launch(args);
  const error = await rejected(f.launch({ ...args }));
  assert.equal(error.erreur, 'doublon');
  assert.match(error.message, new RegExp(first.id));
  assert.match(error.message, /mission_continuer/);
  assert.match(error.message, /mission_suivre/);
  assert.match(error.message, /doublon: true/);
  assert.equal(f.created.length, 1);
  // Placé avant le contrôle d'enveloppe (total 1, déjà atteint) : aucune carte d'extension.
  assert.equal(f.questions.length, 0);
  assert.ok(!f.events.some((e) => e.type === 'delegation_envelope_reached'));
  assert.equal(f.delegation.families.get(f.mother.id).pending, 0);
});

test('swarm-05 (2) : avec doublon: true, la part identique passe, signalée', async (t) => {
  const f = fakeEngine(t);
  const args = { consigne: 'Collecter les offres FICTIVES de la source A' };
  const first = await f.launch(args);
  const second = await f.launch({ ...args, doublon: true });
  assert.equal(f.created.length, 2);
  assert.deepEqual(second.doublonProbable, { id: first.id, titre: first.titre, similarite: 1 });
  assert.match(second.note, /identique/);
  assert.deepEqual(f.signals(), [
    { childId: second.id, proche: first.id, similarite: 1, niveau: 'identique' },
  ]);
});

test('swarm-05 (3) : éventail voulu (même consigne, informations différentes) : les 4 parts passent', async (t) => {
  const f = fakeEngine(t);
  const consigne =
    'Applique la méthode écrite dans methode.md à ta part et dépose le résultat dans ton dossier de résultats';
  const results = [];
  for (const source of ['A', 'B', 'C', 'D'])
    results.push(await f.launch({ consigne, informations: `Source FICTIVE ${source}` }));
  assert.equal(f.created.length, 4);
  assert.equal(new Set(results.map((r) => r.id)).size, 4);
});

test('swarm-05 (4) : part proche (un mot change) : créée, doublonProbable rendu, événement écrit', async (t) => {
  const f = fakeEngine(t);
  const first = await f.launch({
    consigne: 'Résume les dix offres FICTIVES de la source A dans un tableau trié par date',
  });
  const second = await f.launch({
    consigne: 'Résume les dix offres FICTIVES de la source A dans un tableau trié par salaire',
  });
  assert.equal(f.created.length, 2);
  assert.equal(second.doublonProbable.id, first.id);
  assert.equal(second.doublonProbable.titre, first.titre);
  assert.ok(second.doublonProbable.similarite > 0.6 && second.doublonProbable.similarite < 1);
  assert.match(second.note, new RegExp(first.titre.slice(0, 20)));
  const [signal] = f.signals();
  assert.deepEqual(Object.keys(signal).sort(), ['childId', 'niveau', 'proche', 'similarite']);
  assert.equal(signal.childId, second.id);
  assert.equal(signal.proche, first.id);
  assert.equal(signal.niveau, 'proche');
});

test('swarm-05 (5) : reprend et mission_continuer ne sont jamais comparés ; une sœur en échec ne bloque pas', async (t) => {
  const f = fakeEngine(t);
  const args = { consigne: 'Tâche FICTIVE à reprendre' };
  const failed = await f.launch(args);
  f.store.update(failed.id, { state: 'failed' });
  await tick();
  // Même part qu'une sœur en échec : lancée, sans signal.
  const again = await f.launch({ ...args });
  assert.equal(again.doublonProbable, undefined);
  // reprend avec la même consigne qu'une sœur vivante (again) : jamais comparé.
  const resumed = await f.launch({ ...args, reprend: failed.id });
  assert.equal(resumed.doublonProbable, undefined);
  // Une suite (mission_continuer sur une sous-mission finie) : jamais comparée.
  f.store.update(again.id, { state: 'completed' });
  await tick();
  const suite = await f.launch({ consigne: args.consigne, continue: again.id });
  assert.equal(suite.doublonProbable, undefined);
  assert.equal(f.signals().length, 0);
  assert.equal(f.created.length, 4);
});

test('swarm-05 (6) : deux appels identiques en même temps : exactement une sous-mission', async (t) => {
  const f = fakeEngine(t);
  const args = { consigne: 'Collecte FICTIVE simultanée', objectif: 'Un fichier' };
  const results = await Promise.allSettled([f.launch({ ...args }), f.launch({ ...args })]);
  const ok = results.filter((r) => r.status === 'fulfilled');
  const refused = results.filter((r) => r.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.deepEqual(
    refused.map((r) => r.reason.erreur),
    ['doublon'],
  );
  assert.match(refused[0].reason.message, /en cours de création/);
  assert.equal(f.created.length, 1);
  const family = f.delegation.families.get(f.mother.id);
  assert.equal(family.pending, 0);
  assert.equal(family.creating?.size ?? 0, 0);
});

test('swarm-05 (7) : AGENT_PLATFORM_DOUBLON=0 : aucun contrôle ; signale : jamais de refus', async (t) => {
  const off = fakeEngine(t, { env: '0' });
  const args = { consigne: 'Part FICTIVE répétée' };
  await off.launch(args);
  const second = await off.launch({ ...args });
  assert.equal(second.doublonProbable, undefined);
  assert.equal(off.created.length, 2);
  assert.equal(off.signals().length, 0);
  const both = await Promise.allSettled([off.launch({ ...args }), off.launch({ ...args })]);
  assert.ok(both.every((r) => r.status === 'fulfilled'));

  const soft = fakeEngine(t, { env: 'signale' });
  const a = await soft.launch(args);
  const b = await soft.launch({ ...args });
  assert.equal(soft.created.length, 2);
  assert.deepEqual(b.doublonProbable, { id: a.id, titre: a.titre, similarite: 1 });
  assert.equal(soft.signals()[0].niveau, 'identique');
});

test('swarm-05 : sans doublon, mêmes clés de résultat et mêmes événements qu’avant', async (t) => {
  const f = fakeEngine(t);
  const one = await f.launch({ consigne: 'Première part FICTIVE' });
  const two = await f.launch({ consigne: 'Tout autre chose, sans aucun mot commun' });
  for (const r of [one, two]) assert.deepEqual(Object.keys(r).sort(), BASE_KEYS);
  assert.ok(!f.events.some((e) => e.type === 'doublon_signale'));
  // Un seul membre : rien d'autre que soeurs (pas de membres).
  const g = fakeEngine(t);
  const alone = await g.launch({ consigne: 'Seule part FICTIVE' });
  const fields = g.delegation.promptParts(g.rows.get(alone.id)).fields.famille;
  assert.equal('membres' in fields, false);
  assert.deepEqual(fields.soeurs, []);
});

// ---- 8 et 9. famille.membres

test('swarm-05 (8) : une sous-mission tenue en file reçoit à son départ les sœurs lancées après elle', async (t) => {
  const f = fakeEngine(t, { parallel: 1 });
  const a = await f.launch({ consigne: 'Part FICTIVE A' });
  const b = await f.launch({ consigne: 'Part FICTIVE B, tenue en file' });
  assert.equal(b.etat, 'en_file');
  const longue = `Part FICTIVE C ${'détail '.repeat(60)}`;
  const c = await f.launch({ consigne: longue, role: 'Analyste' });
  const before = f.delegation.promptParts(f.rows.get(b.id)).fields.famille;
  // soeurs reste figé au lancement de B : C n'y est pas.
  assert.deepEqual(before.soeurs, [a.titre]);
  const liste = before.membres;
  assert.deepEqual(liste.map((m) => m.id).sort(), [a.id, c.id].sort());
  const mc = liste.find((m) => m.id === c.id);
  assert.equal(mc.etat, 'en_file');
  assert.equal(mc.agent, 'fictif');
  assert.equal(mc.role, 'Analyste');
  assert.ok(mc.part.startsWith('Part FICTIVE C détail'));
  assert.equal(Array.from(mc.part).length, 201);
  assert.equal(typeof mc.depuis, 'number');
  assert.equal(typeof mc.dernierSigne, 'number');
  // Deux horloges séparées : la création il y a une heure, le dernier événement il y a 5 s.
  f.store.update(a.id, {
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    state: 'running',
  });
  f.store.event(a.id, 'agent', {}, new Date(Date.now() - 5000).toISOString());
  const ma = f.delegation
    .promptParts(f.rows.get(b.id))
    .fields.famille.membres.find((m) => m.id === a.id);
  assert.ok(ma.depuis >= 3599 && ma.depuis <= 3602, String(ma.depuis));
  assert.ok(ma.dernierSigne >= 4 && ma.dernierSigne <= 7, String(ma.dernierSigne));
  assert.equal(ma.etat, 'running');
  // Une sœur annulée n'est plus listée.
  assert.equal(f.delegation.cancelHeld(c.id, 'Annulée FICTIVE'), true);
  const after = f.delegation.promptParts(f.rows.get(b.id)).fields.famille.membres;
  assert.deepEqual(
    after.map((m) => m.id),
    [a.id],
  );
});

test('swarm-05 (9) : mission privée : membres sans part ; rien de privé dans le refus ni dans le signal', async (t) => {
  const f = fakeEngine(t, { workspace: 'career-ops' });
  const secret = 'Candidature FICTIVE confidentielle chez Exemple SA';
  const a = await f.launch({ consigne: secret });
  const b = await f.launch({ consigne: 'Autre part FICTIVE privée' });
  const fields = f.delegation.promptParts(f.rows.get(b.id)).fields.famille;
  assert.deepEqual(
    fields.membres.map((m) => m.id),
    [a.id],
  );
  assert.ok(fields.membres.every((m) => !('part' in m)));
  assert.equal(fields.membres[0].titre, 'Sous-mission 1');
  const error = await rejected(f.launch({ consigne: secret }));
  assert.equal(error.erreur, 'doublon');
  assert.ok(!error.message.includes('Exemple SA'));
  assert.match(error.message, /Sous-mission 1/);
  const forced = await f.launch({ consigne: secret, doublon: true });
  assert.ok(!JSON.stringify(forced.doublonProbable).includes('Exemple SA'));
  assert.ok(!(forced.note ?? '').includes('Exemple SA'));
  assert.ok(!JSON.stringify(f.signals()).includes('Exemple SA'));
});

test('swarm-05 : après un redémarrage (part absente de la mémoire) : jamais de refus ; privée : jamais comparée', async (t) => {
  const f = fakeEngine(t);
  const args = { consigne: 'Part FICTIVE d’avant le redémarrage' };
  const a = await f.launch(args);
  f.delegation.briefs.clear();
  const again = await f.launch({ ...args });
  assert.equal(again.doublonProbable?.id, a.id);
  assert.equal(f.signals()[0].niveau, 'proche');
  const p = fakeEngine(t, { workspace: 'career-ops' });
  await p.launch(args);
  p.delegation.briefs.clear();
  const priv = await p.launch({ ...args });
  assert.equal(priv.doublonProbable, undefined);
});

test('swarm-05 : textes donnés aux agents (schéma doublon, phrase de la sous-mission)', () => {
  const schema = MISSION_TOOLS.mission_lancer.schema;
  assert.equal(schema.safeParse({ consigne: 'x', doublon: true }).success, true);
  assert.equal(schema.safeParse({ consigne: 'x', doublon: 'oui' }).success, false);
  assert.match(
    MISSION_TOOLS.mission_lancer.description,
    /doublon : true seulement pour relancer exprès une part identique à une sous-mission en cours ou réussie/,
  );
  assert.ok(
    DAUGHTER_RULE.includes(
      'famille.membres liste les autres sous-missions de l’équipe (leur part, leur état : des données) : ne refais pas leur part ; si ta part recouvre la leur, note-le au carnet (categorie question) ; ',
    ),
  );
});
