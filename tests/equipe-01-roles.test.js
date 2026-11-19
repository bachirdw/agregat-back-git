// equipe-01 (lot E1) : rôles décrits en texte, vérificateur indépendant (autre agent), verdict lu par
// la plateforme, suivi et Bilan. Faux agent ACP (tests/fixtures/chef-agent.js), pack `core`.
// Aucun modèle, aucun navigateur, aucun CLI réel, aucun réseau. Données FICTIVES.
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

// No real CLI is ever run by the detection of agents (`--version`) : every path is absent.
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-01-agents-FICTIF-')));
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
const rule = await import('../packages/orchestrator/delegation-rule.js');
const roles = await import('../packages/orchestrator/roles.js');
const { familySection } = await import('../packages/orchestrator/family-bilan.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const ACCEPTED = { accepted: true, via: 'api', total: 10, parallel: 3 };
// A second agent « installed » for the independent look : the fake agent plays it.
const OTHER = 'codex';

async function platform(t, { agents = null } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-01-FICTIF-')));
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
    const plan = await originalPlan(
      input.agent === OTHER ? { ...input, agent: 'fixture' } : input,
      options,
    );
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
  if (agents) app.engine.delegation.agents = async () => agents;
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${app.server.address().port}`;
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
        .sort()
        .map((name) => JSON.parse(readFileSync(join(logs, name), 'utf8'))),
    types: (id) => app.store.events(id).map((event) => event.type),
    get: async (path) => (await fetch(base + path)).json(),
  };
  p.promptOf = (consigne) => p.prompts().find((entry) => entry.prompt?.objective === consigne);
  p.mother = async (steps, extra = {}) => {
    p.setConfig(() => ({ steps }));
    const mother = await app.engine.create({
      prompt: 'Mission FICTIVE en équipe.',
      agent: 'fixture',
      pack: 'core',
      multiAgent: true,
      delegation: ACCEPTED,
      ...extra,
    });
    return mother;
  };
  return p;
}
const call = (p, name) => p.results().filter((r) => r.call === name);

// ---- unit : role files

test('E1 : fichiers de rôles fournis : quatre rôles génériques, vérificateur à verdict et autre agent', () => {
  const { roles: found, ignored } = roles.loadRoles(null);
  assert.deepEqual(ignored, []);
  assert.deepEqual([...found.keys()].sort(), [
    'chercheur',
    'developpeur',
    'redacteur',
    'verificateur',
  ]);
  const v = found.get('verificateur');
  assert.equal(v.verdict, true);
  assert.equal(v.autreAgent, true);
  assert.equal(
    v.description,
    'Vérifie le travail d’un autre membre d’un œil indépendant et rend un verdict.',
  );
  for (const role of found.values()) {
    assert.ok(role.consigne.length > 50 && role.consigne.length <= 4000);
    assert.doesNotMatch(
      role.consigne + role.description,
      /career|codex|claude|gemini|opencode|seek|indeed|linkedin/i,
    );
  }
  assert.equal(found.get('chercheur').verdict, false);
  assert.equal(found.get('chercheur').autreAgent, false);
});

test('E1 : analyse tolérante : clé inconnue ignorée, nom par défaut du fichier, fichiers mal formés refusés', () => {
  const ok = roles.parseRole(
    '---\ninconnue: x\ndescription: D FICTIVE\n---\nConsigne FICTIVE',
    'Été.md',
  );
  assert.deepEqual(ok, {
    nom: 'Été',
    description: 'D FICTIVE',
    verdict: false,
    autreAgent: false,
    consigne: 'Consigne FICTIVE',
  });
  assert.equal(roles.roleKey('Été'), 'ete');
  for (const bad of [
    'Pas d’en-tête FICTIF',
    '---\nnom: x\nConsigne sans fin d’en-tête',
    '---\nnom: x\n---\n',
    `---\nnom: x\n---\n${'c'.repeat(4001)}`,
    `---\nnom: x\ndescription: ${'d'.repeat(301)}\n---\nConsigne`,
  ])
    assert.equal(roles.parseRole(bad, 'x.md'), null, bad.slice(0, 30));
});

test('E1 : choix d’un autre agent : le premier disponible différent des auteurs, sinon null', () => {
  const list = [
    { id: 'fixture', disponible: true },
    { id: 'a', disponible: false },
    { id: 'b', disponible: true },
    { id: 'c', disponible: true },
  ];
  assert.equal(roles.otherAgent(list, ['fixture']), 'b');
  assert.equal(roles.otherAgent(list, ['fixture', 'b']), 'c');
  assert.equal(roles.otherAgent(list, ['fixture', 'b', 'c']), null);
  assert.equal(roles.otherAgent([], ['fixture']), null);
});

test('E1 : verdict lu : fichier, sinon dernière ligne de la réponse, sinon absent ; valeurs bornées', (t) => {
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-01-verdict-FICTIF-')));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const folder = 'relay/missions/abcd1234/2-verif/';
  mkdirSync(join(cwd, folder), { recursive: true });
  const answer = 'Relu FICTIF\nVerdict : approuve\nPuis\nVerdict : rejeté';
  assert.deepEqual(roles.readVerdict({ cwd, folder, answer }), {
    valeur: 'rejete',
    bloquants: [],
    remarques: [],
    source: 'reponse',
  });
  assert.deepEqual(roles.readVerdict({ cwd, folder, answer: 'rien FICTIF' }), {
    valeur: 'a_corriger',
    bloquants: [],
    remarques: [],
    source: 'absent',
  });
  writeFileSync(
    join(cwd, folder, 'verdict.json'),
    JSON.stringify({
      verdict: 'a_corriger',
      bloquants: Array.from({ length: 25 }, (_, i) => ({ ou: `f${i}`, pourquoi: 'x'.repeat(600) })),
      remarques: ['R FICTIVE'],
    }),
  );
  const read = roles.readVerdict({ cwd, folder, answer });
  assert.equal(read.valeur, 'a_corriger');
  assert.equal(read.source, 'fichier');
  assert.equal(read.bloquants.length, 20);
  assert.equal(read.bloquants[0].pourquoi.length, 500);
  // A value outside the three : the answer is read.
  writeFileSync(join(cwd, folder, 'verdict.json'), JSON.stringify({ verdict: 'parfait' }));
  assert.equal(roles.readVerdict({ cwd, folder, answer }).source, 'reponse');
  // Too big : the answer is read.
  writeFileSync(
    join(cwd, folder, 'verdict.json'),
    JSON.stringify({ verdict: 'approuve', remarques: ['x'.repeat(21000)] }),
  );
  assert.equal(roles.readVerdict({ cwd, folder, answer }).source, 'reponse');
});

test('E1 : Bilan (fonctions pures) : rôle, relit, verdict, totaux, « non revérifié » ; sans rôle identique', () => {
  const plain = [
    { id: 'a', titre: 'A', agent: 'fixture', state: 'completed', durationMs: 1000, bilan: 'B' },
  ];
  const before = familySection({ children: plain });
  assert.equal(familySection({ children: plain.map((c) => ({ ...c, role: undefined })) }), before);
  assert.doesNotMatch(before, /Vérifications|rôle|Verdict/);
  const v = (valeur, source = 'fichier') => ({ valeur, bloquants: [], remarques: [], source });
  const text = familySection({
    children: [
      { ...plain[0], role: 'redacteur' },
      { ...plain[0], id: 'b', titre: 'B FICTIVE' },
      {
        ...plain[0],
        id: 'v1',
        titre: 'V1',
        role: 'verificateur',
        relit: ['a', 'b'],
        verdict: v('a_corriger'),
      },
      {
        ...plain[0],
        id: 'v2',
        titre: 'V2',
        role: 'verificateur',
        relit: ['a'],
        verdict: v('approuve'),
      },
      { ...plain[0], id: 'v3', titre: 'V3', role: 'verificateur', verdict: v('rejete', 'absent') },
    ],
  });
  assert.match(text, /1\. « A » — rôle redacteur — agent fixture/);
  assert.match(text, /3\. « V1 » — rôle verificateur, relit « A », « B FICTIVE » — agent/);
  assert.match(text, /Verdict vu par la plateforme : a_corriger \(source : fichier\)/);
  assert.match(text, /Vérifications : 3 \(1 approuvée\(s\), 1 à corriger, 1 rejetée\(s\)\)/);
  assert.match(text, /« B FICTIVE » : dernier verdict a_corriger, non revérifié depuis/);
  assert.doesNotMatch(text, /« A » : dernier verdict/);
});

test('E1 : textes : phrase ÉQUIPE dans la phrase du chef avant la fin, description de mission_lancer', () => {
  for (const delegation of [undefined, ACCEPTED]) {
    const chief = rule.chiefRule(delegation);
    assert.ok(chief.includes(rule.TEAM_RULE));
    assert.ok(chief.indexOf(rule.TEAM_RULE) > 100);
    assert.doesNotMatch(
      chief.slice(chief.indexOf(rule.TEAM_RULE) + rule.TEAM_RULE.length),
      /compose une équipe/,
    );
  }
  assert.equal(rule.chiefRule({ accepted: false }), rule.CHIEF_REFUSED);
  assert.match(rule.MISSION_TOOLS.mission_lancer.description, /role : rôle de la sous-mission/);
  assert.match(rule.MISSION_TOOLS.mission_lancer.description, /lisible dans terminees\.$/);
  // Without a role, the sub-mission's sentence is the one before.
  assert.equal(rule.daughterRule('x/'), rule.daughterRule('x/', null));
  assert.equal(rule.daughterRule(undefined, null), rule.DAUGHTER_RULE);
  const verdictRole = { nom: 'v', consigne: 'c', verdict: true };
  assert.ok(rule.daughterRule('x/', verdictRole).includes(rule.ROLE_RULE + rule.VERDICT_RULE));
  assert.ok(
    !rule.daughterRule('x/', { ...verdictRole, verdict: false }).includes(rule.VERDICT_RULE),
  );
  const schema = rule.MISSION_TOOLS.mission_lancer.schema;
  assert.equal(schema.safeParse({ consigne: 'c', role: 'x'.repeat(41) }).success, false);
  assert.equal(schema.safeParse({ consigne: 'c', relit: [] }).success, false);
});

// ---- integration : the chief and its team

test('E1 : rôle défini → consigne reçue ; rôle libre → libellé seul ; suivi : roles, role sur la ligne et la vue', async (t) => {
  const p = await platform(t);
  const mother = await p.mother([
    {
      call: 'mission_lancer',
      args: { consigne: 'Cherche FICTIF', titre: 'Recherche', role: 'Chercheur' },
      save: 'a',
    },
    {
      call: 'mission_lancer',
      args: { consigne: 'Libre FICTIF', titre: 'Libre', role: 'Graphiste FICTIF' },
      save: 'b',
    },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 20 } },
    { call: 'mission_suivre', args: {} },
  ]);
  await p.ended(mother.id, 30000);
  const [a, b] = call(p, 'mission_lancer').map((r) => r.result);
  assert.equal(a.etat, 'en_cours');
  const promptA = p.promptOf('Cherche FICTIF').prompt;
  assert.deepEqual(Object.keys(promptA.famille.role), ['nom', 'description', 'consigne']);
  assert.equal(promptA.famille.role.nom, 'chercheur');
  assert.match(promptA.famille.role.consigne, /chaque fait porte sa source précise/);
  assert.equal(
    promptA.famille.role.description,
    'Trouve et rapporte des faits avec leur source, sans rédiger le livrable.',
  );
  assert.ok(promptA.instructions.includes(rule.ROLE_RULE));
  assert.ok(!promptA.instructions.includes(rule.VERDICT_RULE));
  const promptB = p.promptOf('Libre FICTIF').prompt;
  assert.deepEqual(promptB.famille.role, { nom: 'Graphiste FICTIF' });
  assert.ok(!promptB.instructions.includes(rule.ROLE_RULE));
  const follow = call(p, 'mission_suivre')[0].result;
  assert.deepEqual(follow.roles.map((r) => r.nom).sort(), [
    'chercheur',
    'developpeur',
    'redacteur',
    'verificateur',
  ]);
  assert.equal(follow.roles[0].consigne, undefined);
  assert.deepEqual(
    follow.missions.map((m) => m.role),
    ['chercheur', 'Graphiste FICTIF'],
  );
  // No verdict for a role without one ; the view of the mother carries the role.
  const done = call(p, 'mission_attendre')[0].result.terminees;
  assert.ok(done.every((x) => x.verdict === undefined));
  const view = await p.get(`/api/runs/${mother.id}`);
  assert.deepEqual(
    view.family.map((f) => [f.id, f.role, f.relit, f.verdict]),
    [
      [a.id, 'chercheur', undefined, undefined],
      [b.id, 'Graphiste FICTIF', undefined, undefined],
    ],
  );
  const bilan = p.app.store.get(mother.id).result.summary;
  assert.match(bilan, /« Recherche » — rôle chercheur — agent fixture/);
  assert.doesNotMatch(bilan, /Vérifications/);
  assert.ok(!p.types(mother.id).includes('role_ignore'));
});

test('E1 : rôle de l’espace qui remplace celui de la plateforme ; fichier mal formé : role_ignore une fois', async (t) => {
  const p = await platform(t);
  const mother = await p.mother([
    { waitFile: join(p.hold, 'go') },
    { call: 'mission_suivre', args: {} },
    { call: 'mission_lancer', args: { consigne: 'Cherche ESPACE FICTIF', role: 'chercheur' } },
    { call: 'mission_suivre', args: {} },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 20 } },
  ]);
  const cwd = await p.waitFor(() => p.app.store.get(mother.id)?.cwd);
  mkdirSync(join(cwd, 'relay/roles'), { recursive: true });
  writeFileSync(
    join(cwd, 'relay/roles/chercheur.md'),
    '---\ndescription: Chercheur de l’espace FICTIF\nverdict: true\n---\nConsigne de l’espace FICTIVE',
  );
  writeFileSync(join(cwd, 'relay/roles/casse.md'), 'sans en-tête FICTIF');
  p.touch('go');
  await p.ended(mother.id, 30000);
  const prompt = p.promptOf('Cherche ESPACE FICTIF').prompt;
  assert.equal(prompt.famille.role.consigne, 'Consigne de l’espace FICTIVE');
  assert.ok(prompt.instructions.includes(rule.VERDICT_RULE));
  const follows = call(p, 'mission_suivre').map((r) => r.result.roles);
  assert.equal(
    follows[0].find((r) => r.nom === 'chercheur').description,
    'Chercheur de l’espace FICTIF',
  );
  assert.equal(follows[0].length, 4);
  const ignored = p.app.store.events(mother.id).filter((e) => e.type === 'role_ignore');
  assert.deepEqual(
    ignored.map((e) => e.data),
    [{ fichier: 'casse.md' }],
  );
  // The role of the workspace has a verdict : absent here (the fake answer has no verdict line).
  const done = call(p, 'mission_attendre')[0].result.terminees[0];
  assert.deepEqual(done.verdict, {
    valeur: 'a_corriger',
    bloquants: [],
    remarques: [],
    source: 'absent',
  });
});

test('E1 : relit → attend, reçoit les résultats, autre agent choisi ; verdict par fichier ; Bilan non revérifié', async (t) => {
  const p = await platform(t, {
    agents: [
      { id: 'fixture', disponible: true },
      { id: 'gemini', disponible: false },
      { id: OTHER, disponible: true },
    ],
  });
  const verdict = JSON.stringify({
    verdict: 'a_corriger',
    bloquants: [{ ou: 'rapport.md', pourquoi: 'Chiffre FICTIF non sourcé' }],
    remarques: ['R FICTIVE'],
  });
  const mother = await p.mother([
    {
      call: 'mission_lancer',
      args: { consigne: 'Écris FICTIF ATTENDRE:a', titre: 'Rapport' },
      save: 'a',
    },
    {
      call: 'mission_lancer',
      args: {
        consigne: `Relis FICTIF\nVERDICT_JSON:${verdict}`,
        titre: 'Vérif',
        role: 'verificateur',
        relit: ['$a'],
      },
      save: 'v',
    },
    { touch: join(p.hold, 'launched') },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    { call: 'mission_suivre', args: { id: '$v', details: true } },
  ]);
  await p.waitFor(() => existsSync(join(p.hold, 'launched')));
  const [a, v] = call(p, 'mission_lancer').map((r) => r.result);
  assert.equal(v.agent, OTHER);
  assert.equal(v.etat, 'attend_prerequis');
  assert.equal(v.note, undefined);
  const row = p.app.store.get(v.id);
  assert.deepEqual(row.famille.relit, [a.id]);
  assert.deepEqual(row.famille.apres, [a.id]);
  assert.equal(row.famille.role, 'verificateur');
  // It waits for the work it checks.
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(p.promptOf(`Relis FICTIF\nVERDICT_JSON:${verdict}`), undefined);
  p.touch('a');
  await p.ended(mother.id, 30000);
  const prompt = p.promptOf(`Relis FICTIF\nVERDICT_JSON:${verdict}`).prompt;
  assert.deepEqual(prompt.famille.relit, [a.id]);
  assert.equal(prompt.famille.prerequis[0].id, a.id);
  assert.match(prompt.famille.prerequis[0].reponse, /Écris FICTIF/);
  assert.equal(prompt.famille.role.nom, 'verificateur');
  assert.ok(prompt.instructions.includes(rule.ROLE_RULE + rule.VERDICT_RULE));
  const done = call(p, 'mission_attendre')[0].result.terminees.find((x) => x.id === v.id);
  assert.deepEqual(done.verdict, {
    valeur: 'a_corriger',
    bloquants: [{ ou: 'rapport.md', pourquoi: 'Chiffre FICTIF non sourcé' }],
    remarques: ['R FICTIVE'],
    source: 'fichier',
  });
  const details = call(p, 'mission_suivre')[0].result.missions[0];
  assert.equal(details.verdict.source, 'fichier');
  assert.deepEqual(details.relit, [a.id]);
  assert.equal(details.role, 'verificateur');
  const view = await p.get(`/api/runs/${mother.id}`);
  assert.equal(view.family[1].verdict.valeur, 'a_corriger');
  const bilan = p.app.store.get(mother.id).result.summary;
  // The row's agent is the fake one that plays OTHER (plan() above) ; the launch names OTHER.
  assert.match(bilan, /« Vérif » — rôle verificateur, relit « Rapport » — agent fixture/);
  assert.equal(
    p.app.store
      .events(mother.id)
      .find((e) => e.type === 'child_launched' && e.data.childId === v.id).data.agent,
    OTHER,
  );
  assert.match(
    bilan,
    /Verdict vu par la plateforme : a_corriger \(source : fichier ; 1 point\(s\) bloquant\(s\)\)/,
  );
  assert.match(bilan, /Vérifications : 1 \(0 approuvée\(s\), 1 à corriger, 0 rejetée\(s\)\)/);
  assert.match(bilan, /« Rapport » : dernier verdict a_corriger, non revérifié depuis/);
});

test('E1 : aucun autre agent → agent par défaut et note ; agent donné par le chef respecté ; verdict par la réponse', async (t) => {
  const p = await platform(t, { agents: [{ id: 'fixture', disponible: true }] });
  const mother = await p.mother([
    { call: 'mission_lancer', args: { consigne: 'Travail FICTIF', titre: 'Travail' }, save: 'a' },
    {
      call: 'mission_lancer',
      args: {
        consigne: 'Relis seul FICTIF\nVerdict : approuve',
        role: 'vérificateur',
        relit: ['$a'],
      },
    },
    {
      call: 'mission_lancer',
      args: {
        consigne: 'Relis imposé FICTIF\nVerdict : rejete',
        role: 'verificateur',
        agent: 'fixture',
      },
    },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
  ]);
  await p.ended(mother.id, 30000);
  const [, alone, imposed] = call(p, 'mission_lancer').map((r) => r.result);
  assert.equal(alone.agent, 'fixture');
  assert.equal(alone.note, rule.SAME_AGENT_NOTE);
  assert.equal(imposed.agent, 'fixture');
  assert.equal(imposed.note, undefined);
  const done = call(p, 'mission_attendre')[0].result.terminees;
  assert.deepEqual(
    done.map((x) => x.verdict && [x.verdict.valeur, x.verdict.source]),
    [undefined, ['approuve', 'reponse'], ['rejete', 'reponse']],
  );
  const bilan = p.app.store.get(mother.id).result.summary;
  assert.match(bilan, /Vérifications : 2 \(1 approuvée\(s\), 0 à corriger, 1 rejetée\(s\)\)/);
  assert.doesNotMatch(bilan, /non revérifié/);
});

test('E1 : agent indiqué par le chef respecté même avec un autre agent installé', async (t) => {
  const p = await platform(t, {
    agents: [
      { id: 'fixture', disponible: true },
      { id: OTHER, disponible: true },
    ],
  });
  const mother = await p.mother([
    {
      call: 'mission_lancer',
      args: { consigne: 'Relis FICTIF', role: 'verificateur', agent: 'fixture' },
    },
    { call: 'mission_lancer', args: { consigne: 'Relis sans relit FICTIF', role: 'verificateur' } },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
  ]);
  await p.ended(mother.id, 30000);
  const [given, chosen] = call(p, 'mission_lancer').map((r) => r.result);
  assert.equal(given.agent, 'fixture');
  // Without relit, the author is the mother's agent.
  assert.equal(chosen.agent, OTHER);
});

test('E1 : mission multiAgent sans rôle : ni champ neuf, ni événement de plus, ni ligne de Bilan', async (t) => {
  const p = await platform(t);
  const mother = await p.mother([
    { call: 'mission_lancer', args: { consigne: 'Simple FICTIF', titre: 'Simple' } },
    { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 20 } },
    { call: 'mission_suivre', args: {} },
  ]);
  await p.ended(mother.id, 30000);
  const launched = call(p, 'mission_lancer')[0].result;
  assert.deepEqual(Object.keys(launched).sort(), [
    'agent',
    'dossierResultats',
    'espace',
    'etat',
    'famille',
    'id',
    'modele',
    'titre',
  ]);
  const prompt = p.promptOf('Simple FICTIF').prompt;
  assert.equal(prompt.famille.role, undefined);
  assert.equal(prompt.famille.relit, undefined);
  assert.ok(
    prompt.instructions.endsWith('\n' + rule.daughterRule(prompt.famille.dossierResultats)),
  );
  const row = p.app.store.get(launched.id);
  assert.deepEqual(Object.keys(row.famille).sort(), [
    'dossierResultats',
    'mere',
    'racine',
    'titre',
  ]);
  const done = call(p, 'mission_attendre')[0].result.terminees[0];
  assert.equal('verdict' in done, false);
  const line = call(p, 'mission_suivre')[0].result.missions[0];
  assert.equal('role' in line || 'relit' in line, false);
  const view = await p.get(`/api/runs/${mother.id}`);
  assert.deepEqual(Object.keys(view.family[0]).sort(), [
    'agent',
    'attend',
    'id',
    'pendingPermission',
    'pendingQuestion',
    'state',
    'titre',
  ]);
  assert.deepEqual(
    [...new Set(p.types(mother.id))].filter((type) => /role|verdict/.test(type)),
    [],
  );
  const bilan = p.app.store.get(mother.id).result.summary;
  assert.doesNotMatch(bilan, /Vérifications|rôle|Verdict vu/);
  assert.match(bilan, /1\. « Simple » — agent fixture/);
});

test('E1 : mission sans multiAgent : ni phrase ÉQUIPE ni outils', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({}));
  const run = await p.app.engine.create({
    prompt: 'Ordinaire FICTIVE',
    agent: 'fixture',
    pack: 'core',
  });
  await p.ended(run.id, 20000);
  const sent = p.promptOf('Ordinaire FICTIVE');
  assert.deepEqual(sent.servers, ['platform']);
  assert.ok(!sent.prompt.instructions.includes(rule.TEAM_RULE));
  assert.equal(sent.prompt.famille, undefined);
});
