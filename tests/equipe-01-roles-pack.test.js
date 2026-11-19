// equipe-01 (lot E5) : rôles déclarés par le pack de la mission (domain-packs/<pack>/roles/*.md),
// entre ceux de la plateforme et ceux de l'espace. Packs FICTIFS chargés par le réglage de test
// AGENT_PLATFORM_TEST_PACKS_DIR (tests/fixtures/packs-equipe-01), jamais ajoutés à domain-packs/.
// Faux agent ACP (tests/fixtures/chef-agent.js). Aucun modèle, aucun navigateur, aucun CLI réel,
// aucun réseau. Données FICTIVES.
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
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const AGENTS_CONFIG_DIR = realpathSync(
  mkdtempSync(join(tmpdir(), 'equipe-01-pack-agents-FICTIF-')),
);
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
process.env.AGENT_PLATFORM_TEST_PACKS_DIR = resolve('tests/fixtures/packs-equipe-01');
delete process.env.AGENT_PLATFORM_DELEGATION;
test.after(() => rmSync(AGENTS_CONFIG_DIR, { recursive: true, force: true }));

const { createApp } = await import('../apps/api/server.js');
const { CareerWorkspace } = await import('../packages/career-ops/workspace.js');
const { terminal } = await import('../packages/storage/index.js');
const roles = await import('../packages/orchestrator/roles.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const ACCEPTED = { accepted: true, via: 'api', total: 10, parallel: 3 };
const PLATFORM_NAMES = ['chercheur', 'developpeur', 'redacteur', 'verificateur'];

async function platform(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-01-pack-FICTIF-')));
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
      const value = check();
      if (value) return value;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error('Attente dépassée ' + what);
  };
  const p = {
    app,
    root,
    hold,
    waitFor,
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
  p.promptOf = (consigne) => p.prompts().find((entry) => entry.prompt?.objective === consigne);
  p.mother = (pack, steps) => {
    config = () => ({ steps });
    return app.engine.create({
      prompt: 'Mission FICTIVE en équipe.',
      agent: 'fixture',
      pack,
      multiAgent: true,
      delegation: ACCEPTED,
    });
  };
  return p;
}
const call = (p, name) => p.results().filter((r) => r.call === name);
const ignoredOf = (p, id) =>
  p.app.store
    .events(id)
    .filter((e) => e.type === 'role_ignore')
    .map((e) => e.data);

// ---- unit

test('E5 : loadRoles : plateforme, puis pack (remplace), fichier mal formé du pack ignoré ; autre pack : rien', () => {
  const { roles: found, ignored } = roles.loadRoles(null, { pack: 'roles-fictif' });
  assert.deepEqual([...found.keys()].sort(), [...PLATFORM_NAMES, 'monteur'].sort());
  assert.equal(found.get('chercheur').consigne, 'Consigne du chercheur du pack FICTIVE.');
  assert.equal(found.get('chercheur').verdict, true);
  assert.equal(found.get('monteur').description, 'Monte les séquences FICTIVES du pack.');
  assert.deepEqual(ignored, [{ fichier: 'casse.md', source: 'pack' }]);
  // A pack without roles/, an unknown pack, no pack : the platform's roles only, nothing ignored.
  for (const pack of ['sans-roles-fictif', 'core', 'inconnu-FICTIF', '../roles-fictif', null]) {
    const other = roles.loadRoles(null, { pack });
    assert.deepEqual([...other.roles.keys()].sort(), PLATFORM_NAMES, String(pack));
    assert.deepEqual(other.ignored, [], String(pack));
  }
  // Control : the platform's roles are unchanged without a pack (E1).
  assert.match(roles.loadRoles(null).roles.get('chercheur').consigne, /source précise/);
});

// Relecture du lot E5 : the guard « known pack » of roles.js proven : an id that is a path to a real
// folder of roles (the FICTIF pack of the tests, reached from domain-packs/) leads to nothing.
test('E5 (relecture) : un id de pack qui est un chemin vers un dossier de rôles réel ne mène à rien', () => {
  for (const pack of [
    '../tests/fixtures/packs-equipe-01/roles-fictif',
    'domain-packs/../tests/fixtures/packs-equipe-01/roles-fictif',
  ]) {
    const { roles: found, ignored } = roles.loadRoles(null, { pack });
    assert.deepEqual([...found.keys()].sort(), PLATFORM_NAMES, pack);
    assert.deepEqual(ignored, [], pack);
  }
});

// Relecture du lot E5 (décision du manager) : « collecteur » et « evaluateur » retirés ; trois rôles.
const STOP_LINE =
  'Si un site demande une vérification « humain » ou une connexion que tu n’as pas, arrête-toi sur ce site et dis-le dans ta réponse : ne le contourne pas.';
test('E5 : les trois rôles du pack career-ops se chargent (format valide, bornes), sans lancer de mission', () => {
  const folder = resolve('domain-packs/career-ops/roles');
  const names = readdirSync(folder).sort();
  assert.deepEqual(names, ['contacts.md', 'formulaire.md', 'redacteur-candidature.md']);
  for (const name of names) {
    const role = roles.parseRole(readFileSync(join(folder, name), 'utf8'), name);
    assert.ok(role, name);
    assert.equal(role.nom, name.replace(/\.md$/, ''));
    assert.ok(role.description.length > 20 && role.description.length <= 300, name);
    assert.ok(role.consigne.length > 100 && role.consigne.length <= 4000, name);
    assert.ok(Buffer.byteLength(readFileSync(join(folder, name))) <= roles.MAX_ROLE_BYTES, name);
    assert.equal(role.verdict, false, name);
    assert.equal(role.autreAgent, false, name);
  }
  const loaded = roles.loadRoles(null, { pack: 'career-ops' });
  assert.deepEqual(loaded.ignored, []);
  assert.equal(loaded.roles.size, 7);
  for (const name of ['collecteur', 'evaluateur']) assert.equal(loaded.roles.has(name), false);
  for (const name of ['contacts', 'formulaire'])
    assert.ok(loaded.roles.get(name).consigne.endsWith(STOP_LINE), name);
  assert.match(loaded.roles.get('formulaire').consigne, /attend toujours le clic du propriétaire/);
  assert.match(loaded.roles.get('contacts').consigne, /« déduite », jamais « trouvée »/);
});

// ---- integration

test('E5 : un rôle du pack est donné à la sous-mission et remplace celui de la plateforme ; role_ignore une fois', async (t) => {
  const p = await platform(t);
  const mother = await p.mother('roles-fictif', [
    { call: 'mission_suivre', args: {} },
    { call: 'mission_lancer', args: { consigne: 'Monte PACK FICTIF', role: 'Monteur' } },
    { call: 'mission_lancer', args: { consigne: 'Cherche PACK FICTIF', role: 'chercheur' } },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 20 } },
    { call: 'mission_suivre', args: {} },
  ]);
  await p.ended(mother.id, 30000);
  const monteur = p.promptOf('Monte PACK FICTIF').prompt.famille.role;
  assert.deepEqual(monteur, {
    nom: 'monteur',
    description: 'Monte les séquences FICTIVES du pack.',
    consigne: 'Consigne du monteur FICTIVE (rôle du pack).',
  });
  const chercheur = p.promptOf('Cherche PACK FICTIF').prompt;
  assert.equal(chercheur.famille.role.consigne, 'Consigne du chercheur du pack FICTIVE.');
  const listed = call(p, 'mission_suivre')[0].result.roles;
  assert.deepEqual(listed.map((r) => r.nom).sort(), [...PLATFORM_NAMES, 'monteur'].sort());
  assert.equal(listed.find((r) => r.nom === 'chercheur').verdict, true);
  // Read once per execution : two mission_suivre and two launches, one event.
  assert.deepEqual(ignoredOf(p, mother.id), [{ fichier: 'casse.md', source: 'pack' }]);
  const child = p.app.store.get(call(p, 'mission_lancer')[0].result.id);
  assert.equal(child.famille.role, 'monteur');
});

test('E5 : un rôle de l’espace remplace celui du pack', async (t) => {
  const p = await platform(t);
  const mother = await p.mother('roles-fictif', [
    { waitFile: join(p.hold, 'go') },
    { call: 'mission_suivre', args: {} },
    { call: 'mission_lancer', args: { consigne: 'Monte ESPACE FICTIF', role: 'monteur' } },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 20 } },
  ]);
  const cwd = await p.waitFor(() => p.app.store.get(mother.id)?.cwd);
  mkdirSync(join(cwd, 'relay/roles'), { recursive: true });
  writeFileSync(
    join(cwd, 'relay/roles/monteur.md'),
    '---\ndescription: Monteur de l’espace FICTIF\n---\nConsigne de l’espace FICTIVE',
  );
  p.touch('go');
  await p.ended(mother.id, 30000);
  const role = p.promptOf('Monte ESPACE FICTIF').prompt.famille.role;
  assert.equal(role.consigne, 'Consigne de l’espace FICTIVE');
  assert.equal(role.description, 'Monteur de l’espace FICTIF');
  // The pack's other roles stay : its chercheur (which replaces the platform's) is still listed.
  const listed = call(p, 'mission_suivre')[0].result.roles;
  assert.equal(listed.find((r) => r.nom === 'monteur').description, 'Monteur de l’espace FICTIF');
  assert.equal(listed.find((r) => r.nom === 'chercheur').description, 'Chercheur du pack FICTIF');
});

test('E5 : une mission d’un autre pack ne voit pas ces rôles ; pack sans dossier roles : rien, sans erreur', async (t) => {
  const p = await platform(t);
  for (const pack of ['core', 'sans-roles-fictif']) {
    const consigne = `Monte ${pack} FICTIF`;
    const mother = await p.mother(pack, [
      { call: 'mission_suivre', args: {} },
      { call: 'mission_lancer', args: { consigne, role: 'monteur' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 20 } },
    ]);
    await p.ended(mother.id, 30000);
    assert.equal(p.app.store.get(mother.id).state, 'completed', pack);
    const listed = call(p, 'mission_suivre').at(-1).result.roles;
    assert.deepEqual(listed.map((r) => r.nom).sort(), PLATFORM_NAMES, pack);
    // « monteur » is a free name here : a mere label, no consigne.
    assert.deepEqual(p.promptOf(consigne).prompt.famille.role, { nom: 'monteur' }, pack);
    assert.deepEqual(ignoredOf(p, mother.id), [], pack);
  }
});

test('E5 : mission de l’espace privé : le nom d’un rôle du pack est écrit en base, un nom libre non', async (t) => {
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
    ownerMode: { value: false },
  });
  const make = (id, pack) =>
    p.app.store.create({
      id,
      workspace: 'career-ops',
      state: 'running',
      budgetCents: 0,
      cwd: p.root,
      agent: 'fixture',
      pack,
      multiAgent: true,
      delegation: ACCEPTED,
    });
  make('66666666-6666-4666-8666-666666666666', 'roles-fictif');
  make('77777777-7777-4777-8777-777777777777', 'core');
  const control = () => ({ abort: new AbortController() });
  for (const [id, role] of [
    ['66666666-6666-4666-8666-666666666666', 'monteur'],
    ['66666666-6666-4666-8666-666666666666', 'Secret FICTIF'],
    ['77777777-7777-4777-8777-777777777777', 'monteur'],
  ])
    await assert.rejects(
      delegation.launch(p.app.store.get(id), control(), { consigne: 'c FICTIVE', role }),
    );
  assert.equal(links[0].role, 'monteur');
  assert.equal(links[1].role, undefined);
  // Control : in a mission of another pack, « monteur » is a free name : not written.
  assert.equal(links[2].role, undefined);
});
