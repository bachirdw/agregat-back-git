// delegation-v2-01, partie A (« contrat et résultats », plan v2 du 18/11, tableau 8.2) : résultats
// relisibles sans rien consommer, fichiers d'une sous-mission relus de la base, ligne d'envoi complète
// rendue au chef, attente bornée à 50 s par appel, délai du tour ACP suspendu, modèles annoncés,
// compteur d'agents, un seul niveau (ni profondeur, ni descendance, ni refus « boucle »), et une
// mission qui ne délègue pas ne voit rien changer. Faux agent ACP (tests/fixtures/chef-agent.js),
// pack `core` sans Skill sauf le test de l'espace privé. Aucun modèle, aucun navigateur, aucun
// relais, aucun CLI réel (la détection des agents pointe vers des chemins inexistants). FICTIF.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// No real CLI is ever run by the detection of agents (`--version`) : every path is absent.
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'deleg-a-agents-FICTIF-')));
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

const { createApp } = await import('../apps/api/server.js');
const { CareerWorkspace } = await import('../packages/career-ops/workspace.js');
const { reviewCareer } = await import('../packages/career-ops/integration.js');
const { terminal } = await import('../packages/storage/index.js');
const { saveProbe } = await import('../packages/agent-runtime/index.js');
const rule = await import('../packages/orchestrator/delegation-rule.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const AGENT_NAMES = /claude|codex|gemini|opencode|askuserquestion|request_user_input/i;
const ACCEPTED = (envelope = {}) => ({ accepted: true, via: 'api', ...envelope });
const FAMILY_EVENT = /^(delegation|child|family)_/;

// One platform whose agent is the fake chief/sub-mission agent ; `reopen()` starts a new platform
// on the same database and folders (a restart).
async function platform(t, { career = false } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'deleg-a-FICTIF-')));
  const logs = join(root, 'logs');
  const hold = join(root, 'hold');
  mkdirSync(logs);
  mkdirSync(hold);
  if (career) {
    mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
    writeFileSync(
      join(root, '.agents/skills/career-ops/SKILL.md'),
      '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
    );
  }
  let config = () => ({});
  const open = async () => {
    const workspace = new CareerWorkspace({ root, roots: [root] });
    const app = createApp({ dataDir: join(root, 'platform'), career: workspace });
    if (career) reviewCareer(workspace, app.skills);
    await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
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
    return app;
  };
  const p = {
    app: await open(),
    root,
    logs,
    hold,
    setConfig: (fn) => (config = fn),
    touch: (name) => writeFileSync(join(hold, name), 'go'),
    waitFor: async (check, ms = 15000, what = '') => {
      const until = Date.now() + ms;
      while (Date.now() < until) {
        const value = check();
        if (value) return value;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error('Attente dépassée ' + what);
    },
    ended: (id, ms) =>
      p.waitFor(() => terminal.has(p.app.store.get(id)?.state), ms ?? 15000, `fin de ${id}`),
    results: () => {
      const file = join(logs, 'chef-results.json');
      return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    },
    types: (id) => p.app.store.events(id).map((event) => event.type),
    api: async (path, body, headers = {}) => {
      const base = `http://127.0.0.1:${p.app.server.address().port}`;
      const res = await fetch(base + path, {
        method: body ? 'POST' : 'GET',
        headers: { 'content-type': 'application/json', 'x-platform-request': '1', ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, body: await res.json() };
    },
    reopen: async () => {
      await p.app.close();
      p.app = await open();
      return p.app;
    },
  };
  t.after(async () => {
    await p.app.close();
    rmSync(root, { recursive: true, force: true });
  });
  return p;
}

// Every read of the database made from the delegation's code (by the call stack).
function spyReads(store) {
  const reads = [];
  const children = [];
  for (const name of ['get', 'children', 'events', 'list']) {
    const original = store[name].bind(store);
    store[name] = (...args) => {
      if (name === 'children') children.push(args[0]);
      if (/orchestrator[\\/](delegation|family-bilan)\.js/.test(new Error().stack ?? ''))
        reads.push(name);
      return original(...args);
    };
  }
  return { reads, children };
}

test('une mission qui ne délègue pas : aucune lecture de la délégation, aucun événement de famille', async (t) => {
  const p = await platform(t);
  const spy = spyReads(p.app.store);
  const plain = await p.app.engine.create({
    prompt: 'Résume ce texte FICTIF.',
    agent: 'fixture',
    pack: 'core',
  });
  await p.ended(plain.id);
  assert.equal(p.app.store.get(plain.id).state, 'completed', p.app.store.get(plain.id).error);
  // A failed one and a cancelled one (cancel cascades only for a mother).
  const failed = await p.app.engine.create({
    prompt: 'Tâche FICTIVE ECHEC',
    agent: 'fixture',
    pack: 'core',
  });
  await p.ended(failed.id);
  assert.equal(p.app.store.get(failed.id).state, 'failed');
  const stopped = await p.app.engine.create({
    prompt: 'Tâche FICTIVE ATTENDRE:jamais',
    agent: 'fixture',
    pack: 'core',
  });
  await p.waitFor(() => p.app.store.get(stopped.id).state === 'running');
  p.app.engine.cancel(stopped.id);
  await p.ended(stopped.id);
  const view = await p.api(`/api/runs/${plain.id}`);
  assert.equal('family' in view.body, false);
  assert.equal('activity' in view.body, false);
  for (const id of [plain.id, failed.id, stopped.id]) {
    assert.ok(!p.types(id).some((type) => FAMILY_EVENT.test(type)), id);
    assert.equal('estMere' in p.app.store.get(id), false);
  }
  assert.deepEqual(spy.reads, [], 'lecture de la base par la délégation');
  assert.deepEqual(spy.children, []);

  // Tools lent but nothing launched : no family read, no family event of the mission tools.
  const lent = await p.app.engine.create({
    prompt: 'Résume ce texte FICTIF, seul.',
    agent: 'fixture',
    pack: 'core',
    delegation: ACCEPTED(),
  });
  await p.ended(lent.id);
  assert.equal(p.app.store.get(lent.id).state, 'completed');
  assert.deepEqual(spy.children, []);
  assert.ok(!p.types(lent.id).some((type) => /^(child|family)_/.test(type)));
  assert.doesNotMatch(p.app.store.get(lent.id).result.summary, /Sous-missions/);
});

test('mission_attendre ne consomme rien : une réponse perdue se relit à l’appel suivant', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE rapide' }, save: 'A' },
      { touch: join(p.hold, 'launched') },
      { waitFile: join(p.hold, 'go') },
      { call: 'mission_attendre', args: {} },
      { call: 'mission_attendre', args: { ids: ['$A'] } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Une tâche FICTIVE dont la réponse se perd.',
    agent: 'fixture',
    pack: 'core',
    delegation: ACCEPTED(),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')));
  const [launch] = p.results();
  await p.ended(launch.result.id);
  // The gateway gave up on this call (its answer never reached the agent) : nothing is consumed.
  const lost = new AbortController();
  lost.abort(new Error('Appel abandonné par la passerelle'));
  const token = p.app.engine.approvalTokens.get(mother.id);
  const out = await p.app.engine.delegation.call(
    mother.id,
    token,
    { tool: 'mission_attendre', args: {} },
    lost.signal,
  );
  assert.deepEqual(
    out.body.result.terminees.map((x) => x.id),
    [launch.result.id],
  );
  p.touch('go');
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed', p.app.store.get(mother.id).error);
  const [, again, byId] = p.results();
  for (const call of [again, byId]) {
    assert.equal(call.isError, false, JSON.stringify(call.result));
    assert.equal(call.result.delaiAtteint, false);
    assert.deepEqual(call.result.enCours, []);
    assert.deepEqual(
      call.result.terminees.map((x) => [x.id, x.etat, x.reponse]),
      [[launch.result.id, 'completed', 'Résumé FICTIF : Tâche FICTIVE rapide']],
    );
  }
});

test('attente bornée à 50 s par appel, quel que soit delaiSecondes ; description sans « rendue une fois »', async (t) => {
  assert.equal(rule.MAX_WAIT_SECONDS, 50);
  assert.equal(rule.waitSeconds(600), 50);
  assert.equal(rule.waitSeconds(5), 5);
  assert.equal(rule.waitSeconds(undefined), 50);
  const schema = rule.MISSION_TOOLS.mission_attendre.schema;
  assert.equal(schema.safeParse({ delaiSecondes: 600 }).success, true);
  assert.equal(schema.safeParse({ delaiSecondes: 0 }).success, false);
  const description = rule.MISSION_TOOLS.mission_attendre.description;
  assert.doesNotMatch(description, /rendue une fois/);
  assert.match(description, /50 secondes/);
  assert.doesNotMatch(rule.MISSION_TOOLS.mission_annuler.description, /descendance/);
  for (const tool of Object.values(rule.MISSION_TOOLS))
    assert.doesNotMatch(tool.description, AGENT_NAMES);

  const p = await platform(t);
  const delays = [];
  const delegation = p.app.engine.delegation;
  const untilOr = delegation.untilOr.bind(delegation);
  delegation.untilOr = (family, ready, ms, ...signals) => {
    delays.push(ms);
    return untilOr(family, ready, ms, ...signals);
  };
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE ATTENDRE:a' } },
      { call: 'mission_attendre', args: { delaiSecondes: 600 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Une attente FICTIVE trop longue.',
    agent: 'fixture',
    pack: 'core',
    delegation: ACCEPTED(),
  });
  await p.waitFor(() => delays.length === 1);
  assert.deepEqual(delays, [50000]);
  p.touch('a');
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed', p.app.store.get(mother.id).error);
});

// Simulated clock of the engine's guards that never moves : only the agent runtime's own turn
// deadline (real clock) can stop the chief here.
const frozenTimers = () => ({ setTimeout: () => 0, clearTimeout: () => {} });

test('délai du tour ACP du chef suspendu pendant mission_attendre', async (t) => {
  const p = await platform(t);
  const MOTHER = 'Une tâche FICTIVE plus longue que le tour du chef.';
  p.app.engine.timers = frozenTimers();
  const timeoutFor = p.app.engine.timeoutFor.bind(p.app.engine);
  // The chief's turn may last 2 s (its prompt deadline) ; its sub-mission, the usual time.
  p.app.engine.timeoutFor = (target) =>
    target?.input?.prompt === MOTHER ? 2000 : timeoutFor(target);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE ATTENDRE:a' } },
      { call: 'mission_attendre', args: { toutes: true } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: MOTHER,
    agent: 'fixture',
    pack: 'core',
    delegation: ACCEPTED(),
  });
  await p.waitFor(() => p.app.engine.delegation.families.get(mother.id)?.waiting === 1);
  await new Promise((r) => setTimeout(r, 3500));
  assert.equal(p.app.store.get(mother.id).state, 'running', p.app.store.get(mother.id).error);
  p.touch('a');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal(p.results()[1].result.terminees[0].etat, 'completed');
});

test('fichiers d’une sous-mission : dans l’événement child_done, relus après un redémarrage', async (t) => {
  const p = await platform(t);
  p.setConfig((input) =>
    input.prompt === 'Suite FICTIVE.'
      ? { steps: [{ call: 'mission_suivre', args: { details: true } }] }
      : {
          steps: [
            { call: 'mission_lancer', args: { consigne: 'Note FICTIVE ECRIRE:notes/a.md' } },
            { call: 'mission_attendre', args: { toutes: true } },
          ],
        },
  );
  const mother = await p.app.engine.create({
    prompt: 'Une note FICTIVE.',
    agent: 'fixture',
    pack: 'core',
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  await p.waitFor(() => !p.app.engine.active.has(mother.id));
  const [child] = p.app.store.children(mother.id);
  const done = p.app.store
    .events(mother.id)
    .find((event) => event.type === 'child_done' && event.data.childId === child.id);
  assert.deepEqual(done.data.fichiers, ['notes/a.md']);
  assert.equal(p.app.store.get(mother.id).estMere, true);
  // A restart : nothing is left in memory, the files are read from the database.
  const app = await p.reopen();
  assert.deepEqual(app.engine.delegation.outcome(app.store.get(child.id)).fichiers, ['notes/a.md']);
  const resumed = await p.api(`/api/runs/${mother.id}/resume`, { prompt: 'Suite FICTIVE.' });
  assert.equal(resumed.status, 201, JSON.stringify(resumed.body));
  await p.ended(resumed.body.id, 30000);
  // The resumed chief launched nothing : its Bilan and its view still show the earlier one.
  const resumedRow = app.store.get(resumed.body.id);
  assert.equal(resumedRow.state, 'completed', resumedRow.error);
  assert.equal(resumedRow.estMere, true);
  assert.match(resumedRow.result.summary, /Sous-missions \(1\) :/);
  const view = await p.api(`/api/runs/${resumed.body.id}`);
  assert.deepEqual(
    view.body.family.map((m) => m.id),
    [child.id],
  );
  const [followed] = p.results().at(-1).result.missions;
  assert.equal(followed.id, child.id);
  assert.deepEqual(followed.fichiers, ['notes/a.md']);
});

test('fichiers d’une sous-mission de l’espace privé : gardés dans l’espace, jamais dans la base', async (t) => {
  const p = await platform(t, { career: true });
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Note FICTIVE ECRIRE:output/n-FICTIF.md' } },
      { call: 'mission_attendre', args: { toutes: true } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Une note privée FICTIVE.',
    agent: 'fixture',
    pack: 'career-ops',
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed', p.app.store.get(mother.id).error);
  const [child] = p.app.store.children(mother.id);
  const done = p.app.store.events(mother.id).find((event) => event.type === 'child_done');
  assert.equal('fichiers' in done.data, false);
  assert.doesNotMatch(JSON.stringify(p.app.store.events(mother.id)), /n-FICTIF/);
  p.app.engine.delegation.finals.clear();
  assert.deepEqual(p.app.engine.delegation.outcome(p.app.store.get(child.id)).fichiers, [
    'output/n-FICTIF.md',
  ]);
});

test('envois rendus au chef : ligne complète du Bilan, compteurs avec incertains, événements non vérifiés', async (t) => {
  const p = await platform(t);
  const { store, engine } = p.app;
  const delegation = engine.delegation;
  const motherId = '11111111-1111-4111-8111-111111111111';
  const row = (id, fields) =>
    store.create({
      id,
      createdAt: new Date().toISOString(),
      agent: 'fixture',
      title: 'FICTIF',
      famille: { racine: motherId, mere: motherId, titre: `Fille ${id.slice(0, 4)}` },
      result: null,
      ...fields,
    });
  store.create({ id: motherId, createdAt: new Date().toISOString(), state: 'running' });
  // A completed sub-mission : the send line of its Bilan, word for word (uncertain ones included).
  const line =
    'Envoi par la plateforme : 2 approuvé(s) par le propriétaire, dont 1 à l’issue incertaine (échec après le début de l’action : vérifier sur le site).';
  const completed = row('22222222-2222-4222-8222-222222222222', {
    state: 'completed',
    result: {
      summary: 'Réponse FICTIVE\n' + line,
      answer: 'Réponse FICTIVE',
      platformNotes: ['Bilan FICTIF', line],
    },
  });
  engine.active.set(completed.id, {
    sendsApproved: 2,
    sendsGranted: 0,
    sendsAsked: 2,
    sendsUncertain: 1,
    sendCalls: new Set(['c1']),
  });
  delegation.ended(completed, 'completed');
  engine.active.delete(completed.id);
  const done = store.events(motherId).find((event) => event.type === 'child_done');
  assert.deepEqual(done.data.envois, { approuves: 2, parAccord: 0, refuses: 0, incertains: 2 });
  delegation.finals.clear();
  const given = delegation.outcome(store.get(completed.id)).envois;
  assert.deepEqual(given, {
    approuves: 2,
    parAccord: 0,
    refuses: 0,
    incertains: 2,
    ligne: line,
  });
  // An interrupted one (no Bilan) : its recorded send events, marked unverified.
  const interrupted = row('33333333-3333-4333-8333-333333333333', { state: 'interrupted' });
  const options = [
    { optionId: 'ok-FICTIF', kind: 'allow_once', name: 'Envoyer' },
    { optionId: 'non-FICTIF', kind: 'reject_once', name: 'Refuser' },
  ];
  store.event(
    interrupted.id,
    'permission',
    { id: 'p1', tool: { title: 'Envoi FICTIF' }, options },
    { privatePreview: true },
  );
  store.event(interrupted.id, 'permission_resolved', { id: 'p1', optionId: 'ok-FICTIF' });
  store.event(interrupted.id, 'permission', { id: 'p2', tool: { title: 'Lecture' }, options });
  store.event(interrupted.id, 'permission_resolved', { id: 'p2', optionId: 'ok-FICTIF' });
  store.event(
    interrupted.id,
    'permission',
    { id: 'p3', tool: { title: 'Envoi FICTIF' }, options },
    { privatePreview: true },
  );
  store.event(interrupted.id, 'send_auto', {
    capability: 'email.send',
    target: { host: 'exemple.invalid', path: '/FICTIF' },
    label: 'Envoyer FICTIF',
    grant: 'mission',
  });
  const unverified = delegation.outcome(store.get(interrupted.id)).envois;
  assert.equal(unverified.ligne, null);
  assert.equal(unverified.nonVerifies.note, 'non vérifié ; ne pas répéter avant vérification');
  assert.deepEqual(
    unverified.nonVerifies.evenements.map(({ at, ...event }) => event),
    [
      { type: 'carte', issue: 'approuvée' },
      { type: 'carte', issue: 'sans réponse' },
      {
        type: 'accord_de_mission',
        capacite: 'email.send',
        cible: { host: 'exemple.invalid', path: '/FICTIF' },
      },
    ],
  );
  // A sub-mission without any send : nothing more than the counters.
  const quiet = row('44444444-4444-4444-8444-444444444444', { state: 'failed' });
  assert.deepEqual(delegation.outcome(store.get(quiet.id)).envois, {
    approuves: 0,
    parAccord: 0,
    refuses: 0,
    incertains: 0,
    ligne: null,
  });
});

test('mission_suivre donne les modèles annoncés par chaque agent installé', async (t) => {
  const p = await platform(t);
  saveProbe(p.app.engine.dataDir, 'fixture', {
    models: {
      source: 'models',
      current: 'modele-fort-FICTIF',
      options: [
        { id: 'modele-fort-FICTIF', name: 'Fort FICTIF' },
        { id: 'modele-leger-FICTIF', name: 'Léger FICTIF' },
      ],
    },
  });
  const agents = await p.app.engine.delegation.agents();
  const fixture = agents.find((agent) => agent.id === 'fixture');
  assert.deepEqual(fixture.modeles, [
    { id: 'modele-fort-FICTIF', nom: 'Fort FICTIF' },
    { id: 'modele-leger-FICTIF', nom: 'Léger FICTIF' },
  ]);
  assert.equal(fixture.modeleParDefaut, 'modele-fort-FICTIF');
  // An agent never seen in a session : no model announced (its own default applies).
  for (const agent of agents.filter((a) => a.id !== 'fixture')) {
    assert.deepEqual(agent.modeles, [], agent.id);
    assert.equal(agent.modeleParDefaut, null, agent.id);
  }
  assert.match(rule.MISSION_TOOLS.mission_suivre.description, /modèles/);
});

test('compteur d’agents ; une sous-mission en attente du propriétaire laisse sa place', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE QUESTION' }, save: 'A' },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE rapide' }, save: 'B' },
      { call: 'mission_attendre', args: { ids: ['$B'] } },
      { call: 'mission_suivre', args: {} },
      { touch: join(p.hold, 'counted') },
      { waitFile: join(p.hold, 'answered') },
      { call: 'mission_attendre', args: { toutes: true } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Deux tâches FICTIVES, une place.',
    agent: 'fixture',
    pack: 'core',
    delegation: ACCEPTED({ parallel: 1 }),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'counted')), 30000);
  const [launchA, launchB, waitedB, followed] = p.results();
  assert.equal(launchA.result.etat, 'en_cours');
  // B waited for its place, then started while A waits for the owner.
  assert.equal(waitedB.result.terminees[0].id, launchB.result.id);
  assert.equal(p.app.store.get(launchA.result.id).state, 'awaiting_owner');
  const { activite } = followed.result;
  assert.equal(activite.enAttenteDuProprietaire, 1);
  assert.ok(activite.agents >= 2, JSON.stringify(activite));
  assert.equal(
    activite.texte,
    `${activite.agents} agent(s) en activité (missions et sous-agents), dont 1 en attente du propriétaire`,
  );
  const view = await p.api(`/api/runs/${mother.id}`);
  assert.equal(view.body.activity.awaitingOwner, 1);
  assert.ok(view.body.activity.agents >= 2);
  assert.equal(view.body.family.find((m) => m.id === launchA.result.id).attend, 'question');
  p.app.engine.answer(launchA.result.id, { action: 'accept', content: { reponse: 'FICTIVE' } });
  p.touch('answered');
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed', p.app.store.get(mother.id).error);
});

test('un seul niveau : ni profondeur, ni descendance, et une consigne identique à la mère n’est pas refusée', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Compare les rapports FICTIFS.' }, save: 'A' },
      { call: 'mission_attendre', args: { toutes: true } },
      { call: 'mission_annuler', args: { id: '$A' } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Compare les rapports FICTIFS.',
    agent: 'fixture',
    pack: 'core',
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  const [launch, waited, cancel] = p.results();
  assert.equal(launch.isError, false, JSON.stringify(launch.result));
  assert.equal(waited.result.terminees[0].etat, 'completed');
  assert.deepEqual(cancel.result, { id: launch.result.id, etat: 'completed' });
  const [child] = p.app.store.children(mother.id);
  assert.deepEqual(child.famille, {
    racine: mother.id,
    mere: mother.id,
    titre: 'Compare les rapports FICTIFS.',
  });
  const delegation = p.app.engine.delegation;
  for (const name of ['ancestors', 'descendants']) assert.equal(name in delegation, false, name);
});
