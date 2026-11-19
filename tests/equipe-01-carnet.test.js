// equipe-carnet (brief equipe-01, lot E3) : le carnet d'équipe d'une famille multi-agent. Faux agent
// ACP (tests/fixtures/chef-agent.js), pack `core`. Aucun modèle, aucun navigateur, aucun CLI réel,
// aucun port fixe. FICTIF.
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
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-carnet-agents-FICTIF-')));
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
const carnetModule = await import('../packages/orchestrator/carnet.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const ACCEPTED = (envelope = {}) => ({ accepted: true, via: 'api', ...envelope });
const AGENT_NAMES = /claude|codex|gemini|opencode|career|seek|linkedin|indeed/i;

async function platform(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-carnet-FICTIF-')));
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
  const readLogs = (prefix) =>
    readdirSync(logs)
      .filter((name) => name.startsWith(prefix))
      .sort()
      .map((name) => JSON.parse(readFileSync(join(logs, name), 'utf8')));
  return {
    app,
    hold,
    waitFor,
    setConfig: (fn) => (config = fn),
    touch: (name) => writeFileSync(join(hold, name), 'go'),
    ended: (id, ms) =>
      waitFor(() => terminal.has(app.store.get(id)?.state), ms ?? 20000, `fin de ${id}`),
    results: () => {
      const file = join(logs, 'chef-results.json');
      return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    },
    tools: () => JSON.parse(readFileSync(join(logs, 'tools.json'), 'utf8')),
    prompts: () => readLogs('prompt-'),
    equipe: () => readLogs('equipe-'),
    api: async (path, body, headers = {}) => {
      const res = await fetch(base + path, {
        method: body ? 'POST' : 'GET',
        headers: { 'content-type': 'application/json', 'x-platform-request': '1', ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, body: await res.json() };
    },
  };
}
const daughterPrompts = (p) =>
  p.prompts().filter((entry) => !entry.servers.includes('relay-missions') && entry.prompt?.famille);
const byConsigne = (p, text) =>
  daughterPrompts(p).find((entry) => String(entry.prompt.objective).includes(text));

test('E3. le chef note, une sous-mission lancée ensuite reçoit la note ; outils, phrases, miroir, Bilan, vue', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'carnet_noter',
        args: { texte: 'Méthode FICTIVE : un fichier CSV par part.', categorie: 'methode' },
      },
      { call: 'carnet_noter', args: { texte: 'Convention FICTIVE : dates ISO.' } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE A', titre: 'A' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Tâche FICTIVE en équipe.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  // The chief's tools : the mission tools (equipe-01 E2 : mission_continuer included) and the two
  // of the notebook.
  assert.deepEqual(
    p.tools().map((tool) => tool.name),
    [
      'mission_lancer',
      'mission_suivre',
      'mission_attendre',
      'mission_annuler',
      'mission_continuer',
      'carnet_noter',
      'carnet_lire',
    ],
  );
  const [first, second] = p.results();
  assert.deepEqual(first.result, { n: 1, total: 1 });
  assert.deepEqual(second.result, { n: 2, total: 2 });
  // The chief's sentence carries the notebook's text.
  const chiefPrompt = p.prompts().find((entry) => entry.servers.includes('relay-missions'));
  assert.ok(chiefPrompt.prompt.instructions.includes(rule.CHIEF_CARNET));
  assert.ok(chiefPrompt.prompt.instructions.endsWith('\n' + rule.chiefRule(ACCEPTED())));
  // The sub-mission : the notebook server only, the notes at its start, the sentence.
  const daughter = byConsigne(p, 'Tâche FICTIVE A');
  assert.deepEqual(daughter.servers, ['platform', rule.CARNET_SERVER]);
  assert.equal(daughter.prompt.famille.carnet.total, 2);
  assert.deepEqual(
    daughter.prompt.famille.carnet.notes.map((note) => [
      note.n,
      note.auteur,
      note.categorie,
      note.texte,
    ]),
    [
      [1, 'agent principal', 'methode', 'Méthode FICTIVE : un fichier CSV par part.'],
      [2, 'agent principal', 'decouverte', 'Convention FICTIVE : dates ISO.'],
    ],
  );
  assert.ok(daughter.prompt.instructions.includes(rule.DAUGHTER_CARNET));
  // The chief's own notes are never given back to it as new.
  const waited = p.results().find((r) => r.call === 'mission_attendre').result;
  assert.deepEqual(waited.carnet, { total: 2, nouvelles: [] });
  // Durable events (with the text : not a private mission), mirror, Bilan, view.
  const events = p.app.store.events(mother.id).filter((e) => e.type === 'carnet_note');
  assert.deepEqual(
    events.map((e) => [e.data.n, e.data.texte]),
    [
      [1, 'Méthode FICTIVE : un fichier CSV par part.'],
      [2, 'Convention FICTIVE : dates ISO.'],
    ],
  );
  const mirror = readFileSync(
    join(row.cwd, `relay/missions/${mother.id.slice(0, 8)}/0-carnet/carnet.md`),
    'utf8',
  );
  assert.match(mirror, /## 1\. agent principal — méthode — /);
  assert.match(mirror, /Convention FICTIVE : dates ISO\./);
  assert.match(
    row.result.summary,
    /\nCarnet d’équipe : 2 note\(s\) de 1 membre\(s\) \(1 méthode, 1 découverte\)\./,
  );
  const view = await p.api(`/api/runs/${mother.id}`);
  assert.equal(view.body.carnet.total, 2);
  assert.equal(view.body.carnet.notes.length, 2);
  // Texts : no agent, site nor Skill named.
  for (const text of [
    rule.CHIEF_CARNET,
    rule.DAUGHTER_CARNET,
    ...Object.values(rule.CARNET_TOOLS).map((tool) => tool.description),
  ])
    assert.doesNotMatch(text, AGENT_NAMES);
});

test('E3. une sous-mission note : le chef la reçoit une seule fois, une sœur lancée après la reçoit ; carnet_lire depuis ; mission_lancer refusé à une sous-mission', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'carnet_noter', args: { texte: 'Note FICTIVE du chef.', categorie: 'decision' } },
      {
        call: 'mission_lancer',
        args: {
          consigne:
            'Tâche FICTIVE A NOTER[piege]{Piège FICTIF : la page 2 est vide.} NOTER[question]{Question FICTIVE ?} LIRE:1 LANCER',
          titre: 'A',
        },
        save: 'a',
      },
      { call: 'mission_attendre', args: { ids: ['$a'], toutes: true, delaiSecondes: 30 } },
      { call: 'mission_attendre', args: { ids: ['$a'], toutes: true, delaiSecondes: 1 } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE B', titre: 'B' }, save: 'b' },
      { call: 'mission_attendre', args: { ids: ['$b'], toutes: true, delaiSecondes: 30 } },
      { call: 'mission_suivre', args: {} },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Tâche FICTIVE en équipe.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed', p.app.store.get(mother.id).error);
  // The sub-mission's server lends only the notebook tools : it cannot launch anything.
  const [log] = p.equipe();
  assert.deepEqual(log.tools, ['carnet_noter', 'carnet_lire']);
  assert.deepEqual(
    log.calls.slice(0, 2).map((c) => c.result),
    [
      { n: 2, total: 2 },
      { n: 3, total: 3 },
    ],
  );
  // carnet_lire { depuis: 1 } : the notes of rank > 1.
  const lu = log.calls[2].result;
  assert.equal(lu.total, 3);
  assert.deepEqual(
    lu.notes.map((note) => [note.n, note.auteur, note.categorie]),
    [
      [2, 'A', 'piege'],
      [3, 'A', 'question'],
    ],
  );
  assert.ok(log.calls[3].isError || log.calls[3].refus, 'mission_lancer refusé');
  // The chief : the members' notes once (mission_attendre), never again.
  const waits = p.results().filter((r) => r.call === 'mission_attendre');
  assert.deepEqual(
    waits[0].result.carnet.nouvelles.map((note) => [note.n, note.auteur, note.texte]),
    [
      [2, 'A', 'Piège FICTIF : la page 2 est vide.'],
      [3, 'A', 'Question FICTIVE ?'],
    ],
  );
  assert.deepEqual(waits[1].result.carnet, { total: 3, nouvelles: [] });
  assert.deepEqual(waits[2].result.carnet, { total: 3, nouvelles: [] });
  const suivre = p.results().find((r) => r.call === 'mission_suivre').result;
  assert.deepEqual(suivre.carnet, { total: 3, nouvelles: [] });
  // The sister launched afterwards gets the three notes at its start.
  const sister = byConsigne(p, 'Tâche FICTIVE B');
  assert.deepEqual(
    sister.prompt.famille.carnet.notes.map((note) => note.n),
    [1, 2, 3],
  );
  const row = p.app.store.get(mother.id);
  assert.match(
    row.result.summary,
    /Carnet d’équipe : 3 note\(s\) de 2 membre\(s\) \(1 décision, 1 piège, 1 question\)\./,
  );
});

// equipe-01 (intégration E1, E2, E3) : the three lots' sentences live together, and a note's
// author carries the role of lot E1.
test('Intégration : phrases ÉQUIPE, SUITE et CARNET du chef ; rôle, suite et CARNET de la sous-mission ; rôle de l’auteur d’une note', async (t) => {
  for (const accepted of [true, undefined]) {
    const chief = rule.chiefRule(accepted ? ACCEPTED() : {});
    const at = [rule.TEAM_RULE, rule.SUITE_RULE, rule.CHIEF_CARNET].map((x) => chief.indexOf(x));
    assert.ok(
      at.every((i) => i > 0),
      JSON.stringify(at),
    );
    assert.deepEqual(
      [...at].sort((a, b) => a - b),
      at,
      'ÉQUIPE, puis SUITE, puis CARNET',
    );
  }
  const role = { nom: 'verificateur', verdict: true };
  for (const folder of [null, 'relay/missions/x/1-a']) {
    const full = rule.daughterRule(folder, role, true);
    const at = [rule.DAUGHTER_CARNET, rule.ROLE_RULE, rule.VERDICT_RULE, rule.CONTINUE_RULE].map(
      (x) => full.indexOf(x),
    );
    assert.ok(
      at.every((i) => i > 0),
      JSON.stringify(at),
    );
    assert.ok(rule.daughterRule(folder).includes(rule.DAUGHTER_CARNET));
    assert.ok(!rule.daughterRule(folder).includes(rule.ROLE_RULE));
  }
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: {
          consigne: 'Tâche FICTIVE R NOTER[methode]{Méthode FICTIVE du chercheur.}',
          titre: 'R',
          role: 'chercheur',
        },
        save: 'r',
      },
      { call: 'mission_attendre', args: { ids: ['$r'], toutes: true, delaiSecondes: 30 } },
      {
        call: 'mission_continuer',
        args: { id: '$r', message: 'Suite FICTIVE NOTER[decision]{Décision FICTIVE de la suite.}' },
        save: 's',
      },
      { call: 'mission_attendre', args: { ids: ['$s'], toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Tâche FICTIVE en équipe.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed', p.app.store.get(mother.id).error);
  const first = byConsigne(p, 'Tâche FICTIVE R');
  assert.ok(first.prompt.instructions.includes(rule.DAUGHTER_CARNET));
  assert.ok(first.prompt.instructions.includes(rule.ROLE_RULE));
  assert.ok(!first.prompt.instructions.includes(rule.CONTINUE_RULE));
  const suite = byConsigne(p, 'Suite FICTIVE');
  assert.deepEqual(suite.servers, ['platform', rule.CARNET_SERVER]);
  for (const x of [rule.DAUGHTER_CARNET, rule.ROLE_RULE, rule.CONTINUE_RULE])
    assert.ok(suite.prompt.instructions.includes(x));
  assert.equal(suite.prompt.famille.role.nom, 'chercheur');
  // The suite gets the first attempt's note at its start, with its author's role.
  assert.deepEqual(
    suite.prompt.famille.carnet.notes.map((note) => [note.n, note.auteur, note.role]),
    [[1, 'R', 'chercheur']],
  );
  const waits = p.results().filter((r) => r.call === 'mission_attendre');
  assert.deepEqual(
    waits[1].result.carnet.nouvelles.map((note) => [note.n, note.auteur, note.role]),
    [[2, 'R (suite 1)', 'chercheur']],
  );
});

test('E3. tour de synthèse : les notes des membres non remises y sont jointes', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE A ATTENDRE:a NOTER[methode]{Méthode FICTIVE trouvée.}' },
      },
    ],
    reminderSteps: [],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Tâche FICTIVE en équipe.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.waitFor(() => daughterPrompts(p).length === 1);
  p.touch('a');
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed', p.app.store.get(mother.id).error);
  const synthesis = p.prompts().find((entry) => entry.prompt?.familyResults);
  assert.ok(synthesis, 'tour de synthèse');
  assert.deepEqual(
    synthesis.prompt.familyResults.carnet.nouvelles.map((note) => note.texte),
    ['Méthode FICTIVE trouvée.'],
  );
  assert.equal(synthesis.prompt.familyResults.carnet.total, 1);
});

test('E3. route interne : une sous-mission n’obtient que les deux outils du carnet (mission_lancer → 403)', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE A ATTENDRE:a', titre: 'A' } },
      { touch: join(p.hold, 'launched') },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Tâche FICTIVE en équipe.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')));
  const childId = p.results()[0].result.id;
  // Its session is open (its prompt received) : its token is known.
  await p.waitFor(() => daughterPrompts(p).length === 1);
  const token = p.app.engine.approvalTokens.get(childId);
  const asChild = (tool, args) =>
    p.api(`/api/internal/missions/${childId}`, { tool, args }, { 'x-relay-token': token });
  for (const tool of ['mission_lancer', 'mission_suivre', 'mission_attendre', 'mission_annuler']) {
    const out = await asChild(tool, { consigne: 'x', id: childId });
    assert.equal(out.status, 403, tool);
    // Refused because it is a sub-mission, not because of its token.
    assert.equal(out.body.error, 'Outils de mission non prêtés à cette mission', tool);
  }
  const noted = await asChild('carnet_noter', { texte: 'Note FICTIVE par la route.' });
  assert.deepEqual(noted.body.result, { n: 1, total: 1 });
  const invalid = await asChild('carnet_noter', { texte: '', categorie: 'autre' });
  assert.equal(invalid.body.erreur, 'parametres_invalides');
  // A wrong token opens nothing.
  const wrong = await p.api(
    `/api/internal/missions/${childId}`,
    { tool: 'carnet_lire', args: {} },
    { 'x-relay-token': 'faux' },
  );
  assert.equal(wrong.status, 403);
  assert.equal(p.app.store.children(mother.id).length, 1, 'rien de lancé par la sous-mission');
  p.touch('a');
  await p.ended(mother.id, 30000);
});

test('E3. famille sans note : aucun champ, aucune ligne de Bilan, aucun événement de plus', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE A', titre: 'A' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      { call: 'mission_suivre', args: {} },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Tâche FICTIVE en équipe.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  for (const r of p.results()) assert.equal('carnet' in r.result, false, r.call);
  assert.equal('carnet' in byConsigne(p, 'Tâche FICTIVE A').prompt.famille, false);
  assert.doesNotMatch(row.result.summary, /Carnet d’équipe/);
  assert.equal(
    p.app.store.events(mother.id).some((e) => e.type === 'carnet_note'),
    false,
  );
  assert.equal(
    existsSync(join(row.cwd, `relay/missions/${mother.id.slice(0, 8)}/0-carnet`)),
    false,
  );
  const view = await p.api(`/api/runs/${mother.id}`);
  assert.equal('carnet' in view.body, false);
});

test('E3. mission sans multiAgent : aucun outil du carnet, aucune phrase', async (t) => {
  const p = await platform(t);
  const run = await p.app.engine.create({
    prompt: 'Tâche FICTIVE seule.',
    agent: 'fixture',
    pack: 'core',
  });
  await p.ended(run.id);
  const [sent] = p.prompts();
  assert.deepEqual(sent.servers, ['platform']);
  assert.ok(!sent.prompt.instructions.includes(rule.CHIEF_CARNET));
});

// ---- unit : the Carnet class with a fake store (plafond, espace privé, reprise).

function fakeFamily(root, { workspace } = {}) {
  const rows = new Map();
  const events = new Map();
  const store = {
    get: (id) => rows.get(id),
    events: (id) => events.get(id) ?? [],
    update: (id, fields) => rows.set(id, { ...rows.get(id), ...fields }),
    event: (id, type, data) => {
      if (!events.has(id)) events.set(id, []);
      events.get(id).push({ type, data, at: new Date().toISOString() });
    },
  };
  const mother = {
    id: '11111111-1111-4111-8111-111111111111',
    multiAgent: true,
    cwd: root,
    ...(workspace ? { workspace } : {}),
  };
  const child = {
    id: '22222222-2222-4222-8222-222222222222',
    cwd: root,
    famille: { mere: mother.id, titre: 'Sous-mission 1', role: { nom: 'verificateur' } },
  };
  rows.set(mother.id, mother);
  rows.set(child.id, child);
  const delegation = {
    store,
    lent: true,
    engine: { approvalTokens: new Map(), approvalBase: null },
    chain: (run) => [run],
  };
  return { store, mother, child, delegation, events };
}

test('E3. plafond de 200 notes par famille : carnet_plein', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-carnet-u-FICTIF-')));
  try {
    const { mother, child, delegation } = fakeFamily(root);
    const carnet = new carnetModule.Carnet(delegation);
    for (let i = 0; i < carnetModule.CARNET_MAX_NOTES; i++)
      assert.equal(
        carnet.call(child, {}, { tool: 'carnet_noter', args: { texte: `Note ${i}` } }).body.result
          .n,
        i + 1,
      );
    const full = carnet.call(mother, {}, { tool: 'carnet_noter', args: { texte: 'Une de trop' } });
    assert.equal(full.body.erreur, 'carnet_plein');
    // Reading : 50 at most per call.
    const read = carnet.call(mother, {}, { tool: 'carnet_lire', args: { depuis: 10 } }).body.result;
    assert.equal(read.notes.length, 50);
    assert.equal(read.notes[0].n, 11);
    assert.equal(read.notes[0].role, 'verificateur');
    // At a sub-mission's start : 30 notes at most.
    assert.equal(carnet.forStart(child).carnet.notes.length, 30);
    assert.equal(carnet.forStart(child).carnet.total, 200);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('E3. espace privé : aucun texte en base, le texte dans un fichier de l’espace ; vue : total seul', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-carnet-u-FICTIF-')));
  try {
    const { mother, child, delegation, events } = fakeFamily(root, { workspace: 'career-ops' });
    const carnet = new carnetModule.Carnet(delegation);
    carnet.call(child, {}, { tool: 'carnet_noter', args: { texte: 'Texte PRIVÉ FICTIF' } });
    const stored = JSON.stringify([...events.values()]);
    assert.doesNotMatch(stored, /PRIVÉ/);
    assert.match(stored, /carnet_note/);
    const file = readFileSync(join(root, `relay/runs/${mother.id}-carnet.json`), 'utf8');
    assert.match(file, /Texte PRIVÉ FICTIF/);
    assert.deepEqual(carnet.view(mother), { carnet: { total: 1 } });
    // After a restart : the notes are read again from the file of the space.
    const again = new carnetModule.Carnet(delegation);
    assert.equal(again.forStart(child).carnet.notes[0].texte, 'Texte PRIVÉ FICTIF');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('E3. reprise de la mère / redémarrage : le carnet est relu depuis les événements de la chaîne', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-carnet-u-FICTIF-')));
  try {
    const { mother, child, delegation, store } = fakeFamily(root);
    const carnet = new carnetModule.Carnet(delegation);
    carnet.call(
      mother,
      {},
      { tool: 'carnet_noter', args: { texte: 'Note A', categorie: 'methode' } },
    );
    carnet.call(child, {}, { tool: 'carnet_noter', args: { texte: 'Note B' } });
    // A resumed mother : a new execution whose chain leads back to the first.
    // The first execution carries the mark written with its first note.
    const first = store.get(mother.id);
    assert.equal(first.carnet, true);
    const { carnet: _mark, ...unmarked } = first;
    const resumed = {
      ...unmarked,
      id: '33333333-3333-4333-8333-333333333333',
      resumedFrom: mother.id,
    };
    const restarted = new carnetModule.Carnet({
      ...delegation,
      store: { ...store, get: (id) => (id === resumed.id ? resumed : store.get(id)) },
      chain: (run) => (run.id === resumed.id ? [resumed, store.get(mother.id)] : [run]),
    });
    const given = restarted.forChief(resumed).carnet;
    assert.equal(given.total, 2);
    // The chief's own note is not new to it ; the member's is, once.
    assert.deepEqual(
      given.nouvelles.map((note) => note.texte),
      ['Note B'],
    );
    assert.deepEqual(restarted.forChief(resumed).carnet.nouvelles, []);
    const added = restarted.call(resumed, {}, { tool: 'carnet_noter', args: { texte: 'Note C' } });
    assert.deepEqual(added.body.result, { n: 3, total: 3 });
    assert.match(
      readFileSync(
        join(root, `relay/missions/${mother.id.slice(0, 8)}/0-carnet/carnet.md`),
        'utf8',
      ),
      /## 3\. agent principal/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('E3. contrôle : une famille sans marque de carnet ne lit aucun événement', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'equipe-carnet-u-FICTIF-')));
  try {
    const { mother, child, delegation, store } = fakeFamily(root);
    let reads = 0;
    const carnet = new carnetModule.Carnet({
      ...delegation,
      store: { ...store, events: (id) => (reads++, store.events(id)) },
    });
    assert.deepEqual(carnet.forChief(mother), {});
    assert.deepEqual(carnet.forStart(child), {});
    assert.equal(carnet.bilanLine(mother), '');
    assert.deepEqual(carnet.view(mother), {});
    assert.equal(reads, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('E3. Bilan : ligne seulement avec des notes ; fonctions pures', () => {
  assert.equal(carnetModule.carnetLine([]), '');
  assert.equal(
    carnetModule.carnetLine([
      { auteur: 'agent principal', categorie: 'methode' },
      { auteur: 'A', categorie: 'methode' },
      { auteur: 'A', categorie: 'piege' },
    ]),
    'Carnet d’équipe : 3 note(s) de 2 membre(s) (2 méthode, 1 piège).',
  );
  const long = Array.from({ length: 40 }, (_, i) => ({
    n: i + 1,
    auteur: 'A',
    categorie: 'decouverte',
    texte: 'x'.repeat(500),
    a: '',
  }));
  const start = carnetModule.startNotes(long);
  assert.ok(start.reduce((size, note) => size + note.texte.length, 0) <= 6000);
  assert.equal(start.at(-1).n, 40);
});
