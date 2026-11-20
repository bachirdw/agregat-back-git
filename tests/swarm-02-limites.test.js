// swarm-02 : limites d'usage et état réel des agents. Module pur (horloge injectée), mémorisation
// dans le fichier des sondes, choix Auto. Aucun modèle, aucun réseau, données FICTIVES. Les heures
// attendues se calculent en heure locale de la machine (setHours), jamais par une chaîne ISO en dur.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

const { clampMs, classifyFailure, isRateLimitMessage, limitReason, parseResetTime, MAX_RESET_MS } =
  await import('../packages/agent-runtime/limits.js');
const { agentState, clearLimit, noteFailure } = await import(
  '../packages/agent-runtime/agent-state.js'
);
const { chooseAgent, requirementsFor } = await import('../packages/agent-runtime/router.js');
const { loadProbes, probesFile, saveProbe } = await import('../packages/agent-runtime/probes.js');

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// Le 20/11/2026 à h:m, heure locale de la machine.
const at = (h, m = 0) => {
  const d = new Date(2026, 10, 20);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};
// Même heure locale, le jour de `now` (+ `days` jours).
const localAt = (now, h, m, days = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const iso = (ms) => new Date(ms).toISOString();
const hhmm = (value) => {
  const d = new Date(value);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const tempDir = (t, prefix) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `swarm-02-${prefix}-FICTIF-`)));
  t.after(() => {
    try {
      chmodSync(join(dir, 'verrou'), 0o700);
    } catch {
      /* absent */
    }
    rmSync(dir, { recursive: true, force: true });
  });
  return dir;
};

test('cas 3 (rouge d’abord) : « rate limit » cité au milieu puis une erreur ordinaire → null', () => {
  const now = at(15);
  const announcement =
    'Analyse FICTIVE terminée.\n\nLe fournisseur applique un rate limit de 60 requêtes, cité ici comme contenu.\n\nJe passe à la suite.';
  // Le texte cite bien une forme de limite : seule la règle de lecture rend null.
  assert.equal(isRateLimitMessage(announcement), true);
  // Erreur ordinaire : l'annonce n'est pas lue.
  assert.equal(classifyFailure({ message: 'Réponse invalide FICTIVE', announcement, now }), null);
  // Erreur nue : seul le dernier paragraphe est lu, il ne dit aucune limite.
  assert.equal(classifyFailure({ message: 'Internal error', announcement, now }), null);
});

test('cas 1 : parseResetTime lit les heures de reprise, UTC et locales', () => {
  const now = at(15);
  const n = new Date(now);
  // « resets 3pm (UTC) » : aujourd'hui 15:00 UTC, ou demain si l'heure est passée.
  let utc3 = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 15, 0, 0);
  if (utc3 <= now) utc3 += 24 * HOUR;
  assert.equal(parseResetTime('Limit FICTIVE, resets 3pm (UTC).', now), iso(utc3));
  // « resets May 14, 5pm (UTC) » : mai est passé en novembre → l'année suivante.
  let may = Date.UTC(n.getUTCFullYear(), 4, 14, 17, 0, 0);
  if (may <= now) may = Date.UTC(n.getUTCFullYear() + 1, 4, 14, 17, 0, 0);
  assert.equal(parseResetTime('Limit FICTIVE, resets May 14, 5pm (UTC)', now), iso(may));
  assert.equal(parseResetTime('Please retry after 60 seconds', now), iso(now + 60 * 1000));
  assert.equal(parseResetTime('Please wait 2 minutes', now), iso(now + 2 * MIN));
  // Heure locale sans fuseau : à venir → aujourd'hui ; passée → le lendemain.
  assert.equal(parseResetTime('try again at 11:27 PM.', now), localAt(now, 23, 27));
  const late = at(23, 40);
  assert.equal(parseResetTime('try again at 11:27 PM.', late), localAt(late, 23, 27, 1));
  assert.equal(parseResetTime('Merci de réessayer à 23:27.', now), localAt(now, 23, 27));
  assert.equal(parseResetTime('réessayer à 23:27', late), localAt(late, 23, 27, 1));
  assert.equal(parseResetTime('Limite FICTIVE : réessayez à 9h05', now), localAt(now, 9, 5, 1));
  assert.equal(parseResetTime('Usage FICTIF, resets 4pm', now), localAt(now, 16, 0));
  assert.equal(parseResetTime('Try again at 22:00.', now), localAt(now, 22, 0));
  // Sans heure, ou heure absurde : null.
  assert.equal(parseResetTime('You have hit your usage limit FICTIVE.', now), null);
  assert.equal(parseResetTime('try again at 13:61 PM', now), null);
  assert.equal(parseResetTime('réessayer à 25:00', now), null);
  assert.equal(parseResetTime('', now), null);
  assert.equal(parseResetTime('wait 2 minutes', Number.NaN), null);
});

test('cas 2 : bornes entre 1 minute et 7 jours', () => {
  const now = at(15);
  assert.equal(clampMs(now + 10 * 1000, now), now + MIN);
  assert.equal(clampMs(now + 30 * 24 * HOUR, now), now + 7 * 24 * HOUR);
  assert.equal(MAX_RESET_MS, 7 * 24 * HOUR);
  // Par classifyFailure : une reprise lue à 10 s est portée à 1 min.
  const short = classifyFailure({ message: 'Rate limit FICTIF, retry after 10 seconds', now });
  assert.equal(short.jusqua, iso(now + MIN));
  // Un événement de reprise à 30 jours est ramené à 7 jours.
  const far = classifyFailure({
    message: 'Internal error',
    rateLimit: { status: 'rejected', resetsAt: (now + 30 * 24 * HOUR) / 1000 },
    now,
  });
  assert.equal(far.jusqua, iso(now + 7 * 24 * HOUR));
});

test('cas 4 : erreur nue + dernier paragraphe de limite → limite avec l’heure', () => {
  const now = at(15);
  const announcement =
    'Travail FICTIF commencé.\n\nYou’ve hit your usage limit FICTIF · try again at 11:27 PM.';
  assert.deepEqual(classifyFailure({ message: 'Internal error', announcement, now }), {
    classe: 'limite',
    jusqua: localAt(now, 23, 27),
    source: 'annonce',
  });
  // Sans heure lue : 1 h.
  assert.equal(
    classifyFailure({
      message: 'Internal error',
      announcement: 'You’ve hit your usage limit FICTIF.',
      now,
    }).jusqua,
    iso(now + HOUR),
  );
  // Même règle que le message montré (failure.js) : « Agent arrêté : … » n'y est pas une erreur nue
  // (le \b qui suit « é » ne trouve pas de frontière), l'annonce n'est donc pas lue.
  assert.equal(
    classifyFailure({
      message: 'Agent arrêté : refusal',
      announcement: 'You’ve hit your usage limit FICTIF.',
      now,
    }),
    null,
  );
  // rateLimit.resetsAt passe avant l'heure du texte.
  const event = { status: 'rejected', resetsAt: (now + 3 * HOUR) / 1000 };
  assert.deepEqual(
    classifyFailure({ message: 'Internal error', announcement, rateLimit: event, now }),
    { classe: 'limite', jusqua: iso(now + 3 * HOUR), source: 'evenement' },
  );
  // Une erreur qui dit elle-même une limite : l'événement compte aussi.
  assert.equal(
    classifyFailure({ message: 'Usage limit reached FICTIF', rateLimit: event, now }).jusqua,
    iso(now + 3 * HOUR),
  );
  // Une erreur ordinaire : l'événement ne compte pas (règle du message montré, failure.js).
  assert.equal(
    classifyFailure({ message: 'Fichier FICTIF introuvable', rateLimit: event, now }),
    null,
  );
});

test('cas 5 : « reached your X limit » → limite du modèle annoncé, sinon limite de l’agent', () => {
  const now = at(15);
  const models = [
    { id: 'modele-alpha-2', name: 'Alpha 2' },
    { id: 'modele-beta', name: 'Beta' },
  ];
  assert.deepEqual(
    classifyFailure({
      message: 'You’ve reached your Alpha 2 limit. Switch to another model to continue.',
      models,
      now,
    }),
    {
      classe: 'limite_modele',
      modele: 'modele-alpha-2',
      jusqua: iso(now + 24 * HOUR),
      source: 'erreur',
    },
  );
  // Par l'identifiant, avec une heure lue.
  assert.deepEqual(
    classifyFailure({
      message: 'Internal error',
      announcement: 'You’ve reached your modele-beta limit · resets 4pm',
      models,
      now,
    }),
    {
      classe: 'limite_modele',
      modele: 'modele-beta',
      jusqua: localAt(now, 16, 0),
      source: 'annonce',
    },
  );
  // X inconnu : limite de l'agent entier (1 h).
  assert.deepEqual(classifyFailure({ message: 'You’ve reached your Gamma limit.', models, now }), {
    classe: 'limite',
    jusqua: iso(now + HOUR),
    source: 'erreur',
  });
  // Ambigu (deux modèles) : le modèle de l'essai départage, sinon l'agent entier.
  const twins = [
    { id: 'modele-delta-1', name: 'Delta 1' },
    { id: 'modele-delta-2', name: 'Delta 2' },
  ];
  const text = 'You’ve reached your Delta limit.';
  assert.equal(classifyFailure({ message: text, models: twins, now }).classe, 'limite');
  assert.equal(
    classifyFailure({ message: text, models: twins, model: 'modele-delta-2', now }).modele,
    'modele-delta-2',
  );
});

test('cas 6 : crédits, surcharge, serveur, fins propres à la tâche, annulation', () => {
  const now = at(15);
  assert.deepEqual(
    classifyFailure({
      message:
        'Your workspace is out of credits. Ask your workspace owner to refill in order to continue.',
      now,
    }),
    { classe: 'credits', jusqua: iso(now + 2 * HOUR), source: 'erreur' },
  );
  // Plafond de dépense : son « usage limit » ne fait pas une limite courte.
  assert.equal(
    classifyFailure({ message: 'Key limit exceeded (usage limit) FICTIF', now }).classe,
    'credits',
  );
  for (const message of ['API Error: 529', 'Overloaded FICTIF', 'Error: overloaded_error'])
    assert.equal(classifyFailure({ message, now })?.classe, 'surcharge', message);
  for (const message of ['HTTP 503 FICTIF', '503 Service Unavailable', 'Internal Server Error'])
    assert.deepEqual(classifyFailure({ message, now }), {
      classe: 'serveur',
      jusqua: null,
      source: 'erreur',
    });
  // Un « 503 » nu au milieu d'un texte ne classe rien.
  assert.equal(classifyFailure({ message: 'Ligne 503 du fichier FICTIF illisible', now }), null);
  assert.equal(classifyFailure({ message: 'context length exceeded', now }), null);
  assert.equal(
    classifyFailure({ message: 'Rate limit FICTIF: maximum context length reached', now }),
    null,
  );
  assert.equal(
    classifyFailure({ message: 'Usage limit reached FICTIF', cancelled: true, now }),
    null,
  );
  assert.deepEqual(classifyFailure({ message: 'Failed to authenticate. API Error: 401', now }), {
    classe: 'connexion',
    jusqua: null,
    source: 'erreur',
  });
  // Erreur ordinaire, ou sans horloge : null (comportement d'avant).
  assert.equal(classifyFailure({ message: 'Fichier FICTIF introuvable', now }), null);
  assert.equal(classifyFailure({ message: 'Usage limit reached FICTIF' }), null);
  assert.equal(classifyFailure(), null);
});

const real = (id, extra = {}) => ({
  id,
  name: `Agent ${id} FICTIF`,
  installed: true,
  compatible: true,
  ...extra,
});

test('cas 7 : agentState rend chaque état, dans l’ordre du plan', (t) => {
  const now = at(15);
  const live = { now, live: true };
  assert.deepEqual(agentState({ id: 'demo', simulated: true }, null, live), { etat: 'simule' });
  assert.deepEqual(agentState({ id: 'demo', simulated: true }, null, { now }), { etat: 'pret' });
  assert.equal(agentState(real('a', { installed: false }), null, live).etat, 'non_installe');
  assert.equal(agentState(real('a', { compatible: false }), null, live).etat, 'adaptateur_absent');
  assert.equal(agentState(real('a'), null, { now, live: false }).etat, 'mode_reel_eteint');
  const jusqua = localAt(now, 23, 27);
  assert.deepEqual(
    agentState(real('a'), { limite: { classe: 'limite', jusqua, source: 'annonce' } }, live),
    { etat: 'limite', raison: `Limite d’usage jusqu’à ${hhmm(jusqua)}`, jusqua },
  );
  // La limite passe avant un refus de connexion.
  assert.equal(
    agentState(
      real('a'),
      { limite: { jusqua }, session: false, sessionAt: iso(now - 5 * MIN) },
      live,
    ).etat,
    'limite',
  );
  assert.equal(
    agentState(real('a'), { session: false, sessionAt: iso(now - 5 * MIN), error: 'auth' }, live)
      .etat,
    'connexion_refusee',
  );
  assert.equal(
    agentState(real('a'), { session: false, sessionAt: iso(now - 20 * MIN) }, live).etat,
    'a_reessayer',
  );
  assert.equal(
    agentState(real('a'), { inference: false, inferenceAt: iso(now - 5 * MIN) }, live).etat,
    'connexion_refusee',
  );
  assert.equal(
    agentState(real('a'), { inference: false, inferenceAt: iso(now - 20 * MIN) }, live).etat,
    'a_reessayer',
  );
  assert.deepEqual(agentState(real('a'), null, live), { etat: 'pret' });
  // Limites par modèle : seulement celles à venir.
  assert.deepEqual(
    agentState(
      real('a'),
      {
        limitesModele: {
          'modele-alpha': { classe: 'limite_modele', jusqua },
          'modele-beta': { classe: 'limite_modele', jusqua: iso(now - MIN) },
        },
      },
      live,
    ),
    { etat: 'pret', modelesLimites: { 'modele-alpha': jusqua } },
  );
  // Une limite passée rend `pret`, sans rien écrire.
  const dir = tempDir(t, 'etat');
  saveProbe(dir, 'a', { limite: { classe: 'limite', jusqua: iso(now - MIN), source: 'erreur' } });
  const before = readFileSync(probesFile(dir), 'utf8');
  assert.deepEqual(agentState(real('a'), loadProbes(dir).a, live), { etat: 'pret' });
  assert.equal(readFileSync(probesFile(dir), 'utf8'), before);
});

test('noteFailure et clearLimit : mémorisent la classe, l’heure et la source, rien de privé', (t) => {
  const dir = tempDir(t, 'note');
  const now = at(15);
  const models = [
    { id: 'modele-alpha', name: 'Alpha' },
    { id: 'modele-beta', name: 'Beta' },
  ];
  const announcement =
    'Texte PRIVÉ FICTIF.\n\nYou’ve hit your usage limit FICTIF · try again at 11:27 PM.';
  const failure = noteFailure(dir, 'agent-a', { message: 'Internal error', announcement, now });
  assert.equal(failure.classe, 'limite');
  const probe = loadProbes(dir)['agent-a'];
  assert.deepEqual(probe.limite, {
    classe: 'limite',
    jusqua: localAt(now, 23, 27),
    source: 'annonce',
    at: iso(now),
  });
  assert.doesNotMatch(readFileSync(probesFile(dir), 'utf8'), /PRIVÉ|FICTIF|usage limit/);
  // Limite d'un modèle : fusionnée avec les autres modèles déjà notés.
  noteFailure(dir, 'agent-a', { message: 'You’ve reached your Alpha limit.', models, now });
  noteFailure(dir, 'agent-a', { message: 'You’ve reached your Beta limit.', models, now });
  assert.deepEqual(Object.keys(loadProbes(dir)['agent-a'].limitesModele), [
    'modele-alpha',
    'modele-beta',
  ]);
  // Surcharge : rendue, rien de plus écrit.
  const file = readFileSync(probesFile(dir), 'utf8');
  assert.equal(noteFailure(dir, 'agent-a', { message: 'Overloaded', now }).classe, 'surcharge');
  assert.equal(readFileSync(probesFile(dir), 'utf8'), file);
  // Agent simulé, mission annulée : sans effet.
  assert.equal(
    noteFailure(dir, 'agent-b', { message: 'Usage limit reached', simulated: true, now }),
    null,
  );
  assert.equal(
    noteFailure(dir, 'agent-b', { message: 'Usage limit reached', cancelled: true, now }),
    null,
  );
  assert.equal(loadProbes(dir)['agent-b'], undefined);
  // Une réponse réussie efface la limite de l'agent et celle de ce modèle seulement.
  clearLimit(dir, 'agent-a', 'modele-alpha');
  const cleared = loadProbes(dir)['agent-a'];
  assert.equal(cleared.limite, null);
  assert.deepEqual(Object.keys(cleared.limitesModele), ['modele-beta']);
  clearLimit(dir, 'agent-a', 'modele-beta');
  assert.equal(loadProbes(dir)['agent-a'].limitesModele, null);
  // Rien à effacer : aucune écriture.
  const quiet = readFileSync(probesFile(dir), 'utf8');
  clearLimit(dir, 'agent-a', 'modele-alpha');
  clearLimit(dir, 'inconnu', null);
  assert.equal(readFileSync(probesFile(dir), 'utf8'), quiet);
});

test('noteFailure et clearLimit ne lèvent jamais et restent synchrones', (t) => {
  const now = at(15);
  const limit = { message: 'Usage limit reached FICTIF', now };
  // Dossier qui est un fichier : l'écriture échoue en silence, la classe est rendue.
  const dir = tempDir(t, 'robuste');
  const notADir = join(dir, 'fichier');
  writeFileSync(notADir, 'FICTIF');
  assert.equal(noteFailure(notADir, 'agent-a', limit).classe, 'limite');
  // Dossier illisible et non inscriptible.
  const locked = join(dir, 'verrou');
  mkdirSync(locked);
  writeFileSync(join(locked, 'agent-probes.json'), JSON.stringify({ 'agent-a': { limite: {} } }));
  chmodSync(locked, 0o000);
  assert.equal(noteFailure(locked, 'agent-a', limit).classe, 'limite');
  assert.equal(clearLimit(locked, 'agent-a', 'modele'), undefined);
  chmodSync(locked, 0o700);
  // Arguments absents ou mal typés.
  const throwing = {
    get message() {
      throw new Error('FICTIF');
    },
  };
  for (const args of [
    [],
    [undefined, undefined, undefined],
    [null, null, null],
    [dir, 42, limit],
    [42, 'agent-a', limit],
    [dir, 'agent-a', 'texte'],
    [dir, 'agent-a', { message: 42, announcement: {}, models: 'x', rateLimit: 'y', now: 'z' }],
    [dir, 'agent-a', throwing],
  ]) {
    const result = noteFailure(...args);
    assert.ok(result === null || (typeof result === 'object' && !(result instanceof Promise)));
  }
  assert.equal(noteFailure(dir, 'agent-a', throwing), null);
  for (const args of [[], [null, null, null], [42, {}, []], [dir, 'agent-a', 42]])
    assert.equal(clearLimit(...args), undefined);
  // Sans horloge fournie : l'heure réelle, et une limite tout de même.
  assert.equal(noteFailure(dir, 'agent-c', { message: 'Usage limit reached' }).classe, 'limite');
});

test('cas 9 : chooseAgent écarte l’agent sous limite et le dit dans rejected', () => {
  const now = at(15);
  const agents = [
    { id: 'demo', simulated: true },
    real('a', { preference: 10 }),
    real('b', { preference: 20 }),
  ];
  const requirements = requirementsFor();
  const jusqua = localAt(now, 23, 27);
  assert.equal(chooseAgent({ agents, requirements, live: true, probes: {}, now }).id, 'a');
  const chosen = chooseAgent({
    agents,
    requirements,
    live: true,
    probes: { a: { limite: { classe: 'limite', jusqua, source: 'annonce' } } },
    now,
  });
  assert.equal(chosen.id, 'b');
  assert.deepEqual(chosen.rejected, [
    { id: 'a', reason: `Limite d’usage jusqu’à ${hhmm(jusqua)}` },
  ]);
  assert.equal(limitReason(jusqua), `Limite d’usage jusqu’à ${hhmm(jusqua)}`);
  // Tous sous limite : aucun n'est « réessayé ».
  assert.throws(
    () =>
      chooseAgent({
        agents,
        requirements,
        live: true,
        probes: { a: { limite: { jusqua } }, b: { limite: { jusqua } } },
        now,
      }),
    (error) =>
      /Aucun agent réel compatible/.test(error.message) &&
      !/réessay/.test(error.message) &&
      error.rejected.every((r) => r.reason.startsWith('Limite d’usage jusqu’à')),
  );
  // Une limite passée, effacée ou absente : exactement le choix d'aujourd'hui.
  const refused = { session: false, sessionAt: iso(now - MIN), error: 'auth' };
  for (const probe of [{}, refused])
    for (const limite of [{ jusqua: iso(now - MIN) }, null, { jusqua: 'pas une date' }])
      assert.deepEqual(
        chooseAgent({ agents, requirements, live: true, probes: { a: { ...probe, limite } }, now }),
        chooseAgent({ agents, requirements, live: true, probes: { a: probe }, now }),
      );
});

// Bout en bout : le moteur, le faux agent (consigne LIMITE de tests/fixtures/chef-agent.js) en agent
// non simulé, le fichier des sondes.
async function mission(dataDir, root, prompt) {
  const { createApp } = await import('../apps/api/server.js');
  const { CareerWorkspace } = await import('../packages/career-ops/workspace.js');
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir, career });
  const run = {
    id: randomUUID(),
    state: 'queued',
    cwd: root,
    prompt,
    model: '',
    mode: 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  const logs = join(root, 'logs');
  mkdirSync(logs, { recursive: true });
  const plan = {
    simulated: false,
    skills: [],
    agent: {
      id: 'agent-fictif',
      name: 'Agent FICTIF',
      command: process.execPath,
      args: [resolve('tests/fixtures/chef-agent.js')],
      env: [],
      safeModes: [],
      fixedEnv: { CHEF_AGENT: JSON.stringify({ dir: logs }) },
    },
    pack: { id: 'core', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  try {
    await app.engine.execute(run, plan, control, null);
    return { row: app.store.get(run.id), control };
  } finally {
    await app.close();
  }
}

test('cas 8 : une mission qui annonce une limite la note ; une réponse réussie ensuite l’efface', async (t) => {
  const root = tempDir(t, 'bout');
  const dataDir = join(root, 'platform');
  const before = Date.now();
  const limited = await mission(dataDir, root, 'Tâche FICTIVE LIMITE');
  assert.equal(limited.row.state, 'failed');
  // Le message montré ne change pas.
  assert.match(limited.row.error, /^Limite d’usage de Agent FICTIF atteinte : réessayer à 22:00\./);
  assert.equal(limited.control.echecAgent.classe, 'limite');
  const probe = loadProbes(dataDir)['agent-fictif'];
  assert.deepEqual(Object.keys(probe.limite).sort(), ['at', 'classe', 'jusqua', 'source']);
  assert.equal(probe.limite.classe, 'limite');
  assert.equal(probe.limite.source, 'annonce');
  const until = Date.parse(probe.limite.jusqua);
  assert.equal(hhmm(until), '22:00');
  assert.ok(until > before && until <= before + 24 * HOUR + MIN);
  assert.doesNotMatch(JSON.stringify(probe.limite), /FICTIF|usage limit/);
  assert.equal(agentState(real('agent-fictif'), probe, { now: before, live: true }).etat, 'limite');

  const done = await mission(dataDir, root, 'Tâche FICTIVE ordinaire');
  assert.equal(done.control.echecAgent, undefined);
  const after = loadProbes(dataDir)['agent-fictif'];
  assert.equal(after.inference, true);
  assert.equal(after.limite, null);
});

// Même branchement pour une étape de workflow (packages/orchestrator/workflow-run.js).
test('étape de workflow : la limite annoncée est notée, une étape réussie l’efface', async (t) => {
  const { createApp } = await import('../apps/api/server.js');
  const { terminal } = await import('../packages/storage/index.js');
  const root = tempDir(t, 'workflow');
  const logs = join(root, 'logs');
  mkdirSync(logs);
  const dataDir = join(root, 'platform');
  const app = createApp({ dataDir });
  t.after(() => app.close());
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (input, options) => {
    const plan = await originalPlan(input, options);
    plan.agent = {
      ...plan.agent,
      id: 'agent-fictif',
      name: 'Agent FICTIF',
      simulated: false,
      command: process.execPath,
      args: [resolve('tests/fixtures/chef-agent.js')],
      fixedEnv: { ...plan.agent.fixedEnv, CHEF_AGENT: JSON.stringify({ dir: logs }) },
    };
    return plan;
  };
  const waitFor = async (check, what) => {
    const until = Date.now() + 20000;
    while (!check()) {
      assert.ok(Date.now() < until, what);
      await new Promise((r) => setTimeout(r, 25));
    }
  };
  const start = (prompt) =>
    app.engine.create({ prompt, agent: 'fixture', pack: 'core', mode: 'workflow' });
  // L'étape en échec attend la décision du propriétaire (« uncertain ») : on lit la sonde, puis on annule.
  const limited = await start('Synthèse FICTIVE LIMITE');
  await waitFor(() => loadProbes(dataDir)['agent-fictif']?.limite, 'limite notée');
  const probe = loadProbes(dataDir)['agent-fictif'];
  assert.equal(probe.limite.classe, 'limite');
  assert.equal(probe.limite.source, 'annonce');
  assert.equal(hhmm(probe.limite.jusqua), '22:00');
  app.engine.cancel(limited.id);
  await waitFor(() => terminal.has(app.store.get(limited.id).state), 'annulation');
  const ok = await start('Synthèse FICTIVE ordinaire');
  await waitFor(() => loadProbes(dataDir)['agent-fictif'].limite === null, 'limite effacée');
  if (!terminal.has(app.store.get(ok.id).state)) app.engine.cancel(ok.id);
  await waitFor(() => terminal.has(app.store.get(ok.id).state), 'fin');
});
