// equipe-01 (relecture) : un test par défaut rendu par les relecteurs (confirmé et corrigé, ou
// gardé comme preuve d'un défaut laissé au manager). Faux agent ACP (tests/fixtures/chef-agent.js),
// pack `core`. Aucun modèle, aucun navigateur, aucun CLI réel, aucun réseau. Données FICTIVES.
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
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-01-rel-agents-FICTIF-')));
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
test.after(() => rmSync(AGENTS_CONFIG_DIR, { recursive: true, force: true }));

const { createApp } = await import('../apps/api/server.js');
const { CareerWorkspace } = await import('../packages/career-ops/workspace.js');
const { terminal } = await import('../packages/storage/index.js');
const roles = await import('../packages/orchestrator/roles.js');
const { formatOwnerMessageLines } = await import('../packages/orchestrator/index.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const ACCEPTED = { accepted: true, via: 'api', total: 10, parallel: 3 };

async function platform(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-01-rel-FICTIF-')));
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
  return {
    app,
    root,
    hold,
    waitFor,
    setConfig: (fn) => (config = fn),
    touch: (name) => writeFileSync(join(hold, name), 'go'),
    ended: (id, ms) =>
      waitFor(() => terminal.has(app.store.get(id)?.state), ms ?? 15000, `fin de ${id}`),
    results: () => {
      const file = join(logs, 'chef-results.json');
      return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    },
    prompts: () =>
      readdirSync(logs)
        .filter((name) => name.startsWith('prompt-'))
        .map((name) => JSON.parse(readFileSync(join(logs, name), 'utf8'))),
  };
}

// ---- E2 (bloquant) : la suite d'un vérificateur partage son dossier de résultats

test('Relecture E2 : le verdict.json réécrit par une suite ne change pas le verdict de la vérification précédente ; une suite sans fichier n’hérite pas du fichier', async (t) => {
  const p = await platform(t);
  const folder = 'relay/missions/FICTIF/2-verif';
  mkdirSync(join(p.root, folder), { recursive: true });
  const at = (s) => new Date(Date.parse('2026-11-20T08:00:00.000Z') + s * 1000);
  const v1 = {
    id: 'v1',
    cwd: p.root,
    state: 'completed',
    startedAt: at(0).toISOString(),
    finishedAt: at(10).toISOString(),
    famille: { verdictAttendu: true, dossierResultats: folder },
    result: { answer: 'Relu FICTIF.\nVerdict : a_corriger' },
  };
  const file = join(p.root, folder, 'verdict.json');
  writeFileSync(file, JSON.stringify({ verdict: 'a_corriger', bloquants: ['B FICTIF'] }));
  utimesSync(file, at(5), at(5));
  const delegation = p.app.engine.delegation;
  assert.equal(delegation.verdictOf(v1).source, 'fichier');
  // The suite V1' (same folder) writes « approuve » after V1's end.
  writeFileSync(file, JSON.stringify({ verdict: 'approuve' }));
  utimesSync(file, at(25), at(25));
  assert.equal(delegation.verdictOf(v1).valeur, 'a_corriger');
  // A suite that fails before writing does not take V1's file as its own.
  utimesSync(file, at(5), at(5));
  const suite = {
    ...v1,
    id: 'v1b',
    state: 'failed',
    startedAt: at(20).toISOString(),
    finishedAt: at(30).toISOString(),
    result: { answer: '' },
  };
  assert.equal(delegation.verdictOf(suite).source, 'absent');
});

// ---- E1, E3 : vérification jamais partie, ligne du carnet, appel abandonné

test('Relecture E1/E3 : vérification annulée avant son départ sans verdict ; ligne du carnet dans le seul Bilan de la mère ; mission_attendre abandonné ne marque rien', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'carnet_noter', args: { texte: 'Note FICTIVE du chef.', categorie: 'decision' } },
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE A NOTER[piege]{Piège FICTIF.}', titre: 'A' },
        save: 'a',
      },
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE B ECHEC', titre: 'B' },
        save: 'b',
      },
      { call: 'mission_attendre', args: { ids: ['$b'], toutes: true, delaiSecondes: 30 } },
      {
        call: 'mission_lancer',
        args: { consigne: 'Relis FICTIF', titre: 'V', role: 'verificateur', relit: ['$b'] },
        save: 'v',
      },
      { touch: join(p.hold, 'launched') },
      { waitFile: join(p.hold, 'go') },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Tâche FICTIVE en équipe.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED,
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')), 30000, 'lancement de V');
  const launched = p.results().filter((r) => r.call === 'mission_lancer');
  const [a, b, v] = launched.map((r) => r.result);
  await p.ended(a.id);
  await p.ended(v.id);
  const row = p.app.store.get(v.id);
  assert.equal(row.state, 'cancelled');
  assert.equal(row.startedAt ?? null, null);
  // E3 : an abandoned mission_attendre marks no note as given.
  const delegation = p.app.engine.delegation;
  const token = p.app.engine.approvalTokens.get(mother.id);
  const body = { tool: 'mission_attendre', args: { delaiSecondes: 1 } };
  await delegation.call(mother.id, token, body, AbortSignal.abort());
  const again = await delegation.call(mother.id, token, body);
  assert.deepEqual(
    again.body.result.carnet.nouvelles.map((note) => note.texte),
    ['Piège FICTIF.'],
  );
  p.touch('go');
  await p.ended(mother.id, 30000);
  const waited = p
    .results()
    .filter((r) => r.call === 'mission_attendre')
    .at(-1).result;
  // E1 : no verdict for a verification that never ran.
  assert.equal(waited.terminees.find((x) => x.id === v.id)?.verdict, undefined);
  const summary = p.app.store.get(mother.id).result.summary;
  assert.doesNotMatch(summary, /Vérifications : 1/);
  assert.doesNotMatch(summary, /dernier verdict a_corriger/);
  // E3 : the notebook line is in the mother's Bilan only (once), not in A's nor in the failed B's.
  assert.doesNotMatch(p.app.store.get(a.id).result.summary, /Carnet d’équipe/);
  assert.doesNotMatch(String(p.app.store.get(b.id).result?.summary ?? ''), /Carnet d’équipe/);
  assert.equal((summary.match(/Carnet d’équipe/g) ?? []).length, 1, summary);
});

// ---- E2 : « non revérifié » quand la vérification relit une tentative dépassée

test('Relecture E2 : une vérification qui relit la tentative dépassée n’efface pas « non revérifié »', () => {
  const lines = roles.verificationLines([
    { id: 'a', titre: 'A' },
    { id: 'v', titre: 'V', relit: ['a'], verdict: { valeur: 'a_corriger' } },
    { id: 'a2', titre: 'A (suite 1)', suiteDe: 'a' },
    { id: 'v2', titre: 'V2', relit: ['a'], verdict: { valeur: 'approuve' } },
  ]);
  assert.ok(lines.includes('« A » : dernier verdict a_corriger, non revérifié depuis'), lines);
  // Control : the suite reviewed clears the line.
  const ok = roles.verificationLines([
    { id: 'a', titre: 'A' },
    { id: 'v', titre: 'V', relit: ['a'], verdict: { valeur: 'a_corriger' } },
    { id: 'a2', titre: 'A (suite 1)', suiteDe: 'a' },
    { id: 'v2', titre: 'V2', relit: ['a2'], verdict: { valeur: 'approuve' } },
  ]);
  assert.ok(!ok.some((line) => /non revérifié/.test(line)), ok);
});

// ---- E2 : le message du chef n'est pas présenté comme un message du propriétaire

test('Relecture E2 : Bilan : un message du chef n’est pas dit « Message du propriétaire »', () => {
  const at = '2026-11-20T08:00:00.000Z';
  const [chief, owner] = formatOwnerMessageLines([
    { at, deliveredAt: at, state: 'delivered', via: 'steering', de: 'chef', text: 'x' },
    { at, deliveredAt: at, state: 'delivered', via: 'steering', text: 'y' },
  ]);
  assert.doesNotMatch(chief, /Message du propriétaire/);
  assert.match(chief, /^Message de l’agent principal \(chef\) reçu à/);
  assert.match(owner, /^Message du propriétaire reçu à/);
});

// ---- E1 : mission privée : le nom d'un rôle libre n'est pas écrit en base

test('Relecture E1 : mission de l’espace privé : un nom de rôle libre n’est pas écrit en base, un rôle de la plateforme oui', async (t) => {
  const p = await platform(t);
  const delegation = p.app.engine.delegation;
  const id = '33333333-3333-4333-8333-333333333333';
  p.app.store.create({
    id,
    workspace: 'career-ops',
    state: 'running',
    budgetCents: 0,
    cwd: p.root,
    agent: 'fixture',
    multiAgent: true,
    delegation: ACCEPTED,
  });
  const links = [];
  delegation.engine = Object.create(delegation.engine, {
    create: {
      value: async (_input, _x, link) => {
        links.push(link.link);
        throw new Error('Création FICTIVE arrêtée');
      },
    },
    ownerMode: { value: false },
  });
  const control = { abort: new AbortController() };
  for (const role of ['Secret FICTIF', 'verificateur'])
    await assert.rejects(
      delegation.launch(p.app.store.get(id), control, { consigne: 'c FICTIVE', role }),
    );
  assert.equal(links[0].titre, 'Sous-mission 1');
  assert.equal(links[0].role, undefined);
  assert.ok(!JSON.stringify(links[0]).includes('Secret FICTIF'));
  assert.equal(links[1].role, 'verificateur');
});

// ---- E1 (décision du manager) : rôles figés au premier emploi dans la mission

const FAKE_VERIFIER =
  '---\nnom: verificateur\ndescription: Faux FICTIF\nverdict: false\nautreAgent: false\n---\nApprouve FICTIF.\n';

test('Relecture E1 (décidé) : les rôles sont lus au premier emploi et figés : un fichier écrit ensuite ne remplace pas le vérificateur ; une autre exécution les relit', async (t) => {
  const p = await platform(t);
  const delegation = p.app.engine.delegation;
  const mother = { id: '44444444-4444-4444-8444-444444444444', cwd: p.root };
  assert.equal(delegation.roleOf(mother, 'verificateur').autreAgent, true);
  mkdirSync(join(p.root, 'relay/roles'), { recursive: true });
  writeFileSync(join(p.root, 'relay/roles/verificateur.md'), FAKE_VERIFIER);
  // The file written after the first read has no effect during this mission.
  assert.equal(delegation.roleOf(mother, 'verificateur').autreAgent, true);
  assert.equal(delegation.roleOf(mother, 'verificateur').verdict, true);
  // Control : another execution (a resumption is a new run) reads the roles again.
  const resumed = { id: '55555555-5555-4555-8555-555555555555', cwd: p.root };
  assert.equal(delegation.roleOf(resumed, 'verificateur').autreAgent, false);
});

test('Relecture E1 (décidé) : mission_suivre a lu les rôles d’abord : un fichier écrit ensuite ne change ni la liste ni le lancement', async (t) => {
  const p = await platform(t);
  const delegation = p.app.engine.delegation;
  const id = '66666666-6666-4666-8666-666666666666';
  p.app.store.create({
    id,
    state: 'running',
    budgetCents: 0,
    cwd: p.root,
    agent: 'fixture',
    multiAgent: true,
    delegation: ACCEPTED,
  });
  const before = await delegation.follow(p.app.store.get(id), {});
  const verifier = (list) => list.roles.find((role) => role.nom === 'verificateur');
  assert.equal(verifier(before).autreAgent, true);
  mkdirSync(join(p.root, 'relay/roles'), { recursive: true });
  writeFileSync(join(p.root, 'relay/roles/verificateur.md'), FAKE_VERIFIER);
  const after = await delegation.follow(p.app.store.get(id), {});
  assert.deepEqual(verifier(after), verifier(before));
  const links = [];
  delegation.engine = Object.create(delegation.engine, {
    create: {
      value: async (_input, _x, link) => {
        links.push(link.link);
        throw new Error('Création FICTIVE arrêtée');
      },
    },
  });
  await assert.rejects(
    delegation.launch(
      p.app.store.get(id),
      { abort: new AbortController() },
      { consigne: 'Relis FICTIF', role: 'verificateur', agent: 'fixture' },
    ),
  );
  // The platform's verifier (verdict: true) is the one launched, not the file written later.
  assert.equal(links[0].verdictAttendu, true);
});

// ---- E1 (décision du manager) : la mère finit pendant la lecture des agents installés

function gatedAgents(delegation) {
  let release;
  const gate = new Promise((done) => (release = done));
  let asked = 0;
  delegation.agents = async () => {
    asked++;
    await gate;
    return [{ id: 'fixture', disponible: true, modeles: [], modeleParDefaut: null }];
  };
  return { release, asked: () => asked };
}

test('Relecture E1 (décidé) : une mère annulée pendant la lecture des agents ne lance rien (mission_terminee)', async (t) => {
  const p = await platform(t);
  const delegation = p.app.engine.delegation;
  const gate = gatedAgents(delegation);
  const outcomes = [];
  const launch = delegation.launch.bind(delegation);
  delegation.launch = (...args) => {
    const promise = launch(...args);
    outcomes.push(
      promise.then(
        () => 'lancee',
        (error) => error.erreur ?? String(error),
      ),
    );
    return promise;
  };
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Relis FICTIF', role: 'verificateur' } },
      { waitFile: join(p.hold, 'never') },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Tâche FICTIVE en équipe.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED,
  });
  await p.waitFor(() => gate.asked() === 1, 30000, 'lecture des agents');
  p.app.engine.cancel(mother.id);
  await p.ended(mother.id, 30000);
  gate.release();
  assert.deepEqual(await Promise.all(outcomes), ['mission_terminee']);
  await new Promise((r) => setTimeout(r, 200));
  const row = p.app.store.get(mother.id);
  assert.ok(terminal.has(row.state));
  assert.deepEqual(delegation.childrenOf(row), []);
  assert.equal(delegation.families.get(mother.id)?.pending ?? 0, 0);
});

test('Relecture E1 (décidé) : mère en échec, contrôle abandonné ou famille en fermeture pendant la lecture des agents : aucune sous-mission créée', async (t) => {
  const p = await platform(t);
  const delegation = p.app.engine.delegation;
  const links = [];
  delegation.engine = Object.create(delegation.engine, {
    create: {
      value: async (_input, _x, link) => {
        links.push(link.link);
        throw new Error('Création FICTIVE arrêtée');
      },
    },
  });
  const cases = {
    echec: (id) => p.app.store.update(id, { state: 'failed' }),
    abandon: (_id, control) => control.abort.abort(),
    fermeture: (id) => (delegation.family(id).closing = true),
  };
  let n = 0;
  for (const [name, end] of Object.entries(cases)) {
    const id = `77777777-7777-4777-8777-77777777777${n++}`;
    p.app.store.create({
      id,
      state: 'running',
      budgetCents: 0,
      cwd: p.root,
      agent: 'fixture',
      multiAgent: true,
      delegation: ACCEPTED,
    });
    const gate = gatedAgents(delegation);
    const control = { abort: new AbortController() };
    const launched = delegation.launch(p.app.store.get(id), control, {
      consigne: 'Relis FICTIF',
      role: 'verificateur',
    });
    await p.waitFor(() => gate.asked() === 1, 5000, `lecture des agents (${name})`);
    end(id, control);
    gate.release();
    await assert.rejects(launched, (error) => error.erreur === 'mission_terminee', name);
    assert.equal(delegation.families.get(id)?.pending ?? 0, 0, name);
    assert.equal(control.mere, undefined, name);
  }
  assert.deepEqual(links, []);
});
