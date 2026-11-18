// chef-01 : mode workflow, premier pas (conception du 18/11, sprint 1). Un agent chef reçoit les
// outils de mission (serveur MCP `relay-missions`) seulement quand le propriétaire a accepté le mode
// (`delegation` de POST /api/runs) ; ses sous-missions sont des missions ordinaires. Faux agent ACP
// (tests/fixtures/chef-agent.js) par le même chemin que l'agent réel : session ACP, serveurs MCP
// prêtés, pont interne de la plateforme. Aucun modèle, aucun navigateur, aucun relais, aucun CLI
// réel (la détection des agents pointe vers des chemins inexistants). Textes FICTIFS.
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
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'chef-01-agents-FICTIF-')));
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
const { Store, terminal } = await import('../packages/storage/index.js');
const { profiles } = await import('../packages/agent-runtime/profiles.js');
const rule = await import('../packages/orchestrator/delegation-rule.js');
const { familySection, announcedSends, quoteBilan, QUOTE_LIMIT } = await import(
  '../packages/orchestrator/family-bilan.js'
);

const CHEF = resolve('tests/fixtures/chef-agent.js');
const AGENT_NAMES = /claude|codex|gemini|opencode|askuserquestion|request_user_input/i;
const ACCEPTED = (envelope = {}) => ({ accepted: true, via: 'api', ...envelope });

// One platform (API listening on 127.0.0.1:0) whose agent is the fake chief/sub-mission agent.
// `config(input)` gives CHEF_AGENT for a mission (steps of the chief…), `identity` the profile the
// plan's agent takes (the process stays the fake agent).
async function platform(t, { career = false, ownerMode = false, identity } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'chef-01-FICTIF-')));
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
  const workspace = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career: workspace, ownerMode });
  if (career) reviewCareer(workspace, app.skills);
  await new Promise((done) => app.server.listen(0, '127.0.0.1', done));
  let config = () => ({});
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (input, options) => {
    const plan = await originalPlan(input, options);
    plan.agent = {
      ...plan.agent,
      ...(identity ? { id: identity.id, name: identity.name } : {}),
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
  return {
    app,
    root,
    logs,
    hold,
    base,
    waitFor,
    setConfig: (fn) => (config = fn),
    touch: (name) => writeFileSync(join(hold, name), 'go'),
    ended: (id, ms) => waitFor(() => terminal.has(app.store.get(id)?.state), ms, `fin de ${id}`),
    results: () => {
      const file = join(logs, 'chef-results.json');
      return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    },
    prompts: () =>
      readdirSync(logs)
        .filter((name) => name.startsWith('prompt-'))
        .map((name) => JSON.parse(readFileSync(join(logs, name), 'utf8'))),
    tools: () => JSON.parse(readFileSync(join(logs, 'tools.json'), 'utf8')),
    types: (id) => app.store.events(id).map((event) => event.type),
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

const chiefPrompt = (p) => p.prompts().find((entry) => entry.servers.includes('relay-missions'));
const daughterPrompts = (p) =>
  p.prompts().filter((entry) => !entry.servers.includes('relay-missions') && entry.prompt?.famille);

test('sans delegation : aucun outil mission_* prêté, prompt et mission inchangés', async (t) => {
  const p = await platform(t);
  const plain = await p.app.engine.create({
    prompt: 'Résume ce texte FICTIF.',
    agent: 'fixture',
    pack: 'core',
  });
  await p.ended(plain.id);
  const row = p.app.store.get(plain.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal('delegation' in row, false);
  assert.equal('famille' in row, false);
  const [entry] = p.prompts();
  assert.deepEqual(entry.servers, ['platform']);
  assert.deepEqual(Object.keys(entry.prompt), [
    'objective',
    'attachments',
    'skills',
    'browserWorkflow',
    'ownerMode',
    'workflow',
    'instructions',
  ]);
  assert.doesNotMatch(entry.prompt.instructions, /Mode workflow|sous-mission/);
  assert.ok(!p.types(plain.id).some((type) => /^(delegation|child|family)_/.test(type)));
  const view = await p.api(`/api/runs/${plain.id}`);
  assert.equal('family' in view.body, false);
  assert.doesNotMatch(row.result.summary, /Sous-missions/);
  // Its token does not open the mission tools.
  const refused = await p.api(
    `/api/internal/missions/${plain.id}`,
    { tool: 'mission_suivre', args: {} },
    { 'x-relay-token': 'jeton-FICTIF' },
  );
  assert.equal(refused.status, 403);

  // The same mission with the owner's acceptance : the same instructions, plus the chief's
  // sentence at the end ; a refusal lends nothing.
  const declined = await p.app.engine.create({
    prompt: 'Résume ce texte FICTIF.',
    agent: 'fixture',
    pack: 'core',
    delegation: { accepted: false, via: 'case' },
  });
  await p.ended(declined.id);
  assert.ok(p.types(declined.id).includes('delegation_declined'));
  const chief = await p.app.engine.create({
    prompt: 'Résume ce texte FICTIF.',
    agent: 'fixture',
    pack: 'core',
    delegation: ACCEPTED(),
  });
  await p.ended(chief.id);
  const sent = p.prompts();
  assert.equal(sent.length, 3);
  const declinedPrompt = sent.find(
    (e) => !e.servers.includes('relay-missions') && e !== entry && e.prompt.objective,
  );
  assert.deepEqual(declinedPrompt.servers, ['platform']);
  const withTools = chiefPrompt(p);
  assert.deepEqual(withTools.servers, ['platform', rule.MISSION_SERVER]);
  assert.equal(
    withTools.prompt.instructions,
    entry.prompt.instructions + '\n' + rule.chiefRule({ total: 10, parallel: 3 }),
  );
  assert.ok(p.types(chief.id).includes('delegation_accepted'));
  assert.deepEqual(
    p.tools().map((tool) => tool.name),
    ['mission_lancer', 'mission_suivre', 'mission_attendre', 'mission_annuler'],
  );
});

test('lancer deux sous-missions et les attendre : réponses, Bilans, lien mère-filles, famille dans GET', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Résume le rapport FICTIF A. ECRIRE:notes/a.md', titre: 'Rapport A' },
        save: 'A',
      },
      { call: 'mission_lancer', args: { consigne: 'Résume le rapport FICTIF B.' }, save: 'B' },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
    summary: 'Tableau comparatif FICTIF des deux rapports.',
  }));
  const mother = await p.app.engine.create({
    prompt: 'Compare deux rapports FICTIFS avec des sous-missions.',
    agent: 'fixture',
    pack: 'core',
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  const [launchA, launchB, waited] = p.results();
  assert.equal(launchA.isError, false, JSON.stringify(launchA.result));
  assert.equal(launchA.result.etat, 'en_cours');
  assert.equal(launchA.result.titre, 'Rapport A');
  assert.equal(launchB.result.titre, 'Résume le rapport FICTIF B.');
  assert.deepEqual(launchB.result.famille, { lancees: 2, enCours: 2, total: 10, parallel: 3 });
  assert.equal(waited.isError, false, JSON.stringify(waited.result));
  assert.equal(waited.result.delaiAtteint, false);
  assert.deepEqual(waited.result.enCours, []);
  assert.deepEqual(
    waited.result.terminees.map((x) => [x.id, x.etat, x.reponse]).sort(),
    [
      [
        launchA.result.id,
        'completed',
        'Résumé FICTIF : Résume le rapport FICTIF A. ECRIRE:notes/a.md',
      ],
      [launchB.result.id, 'completed', 'Résumé FICTIF : Résume le rapport FICTIF B.'],
    ].sort(),
  );
  for (const done of waited.result.terminees) {
    assert.equal(typeof done.bilan, 'string');
    assert.equal(done.cause, null);
    assert.deepEqual(done.envois, { approuves: 0, refuses: 0 });
  }
  // The files of a sub-mission are those its own calls named ; its Bilan is the platform's.
  const doneA = waited.result.terminees.find((x) => x.id === launchA.result.id);
  const doneB = waited.result.terminees.find((x) => x.id === launchB.result.id);
  assert.deepEqual(doneA.fichiers, ['notes/a.md']);
  assert.deepEqual(doneB.fichiers, []);
  assert.match(doneA.bilan, /Actions natives de l’agent/);
  assert.equal(doneA.bilan, p.app.store.get(launchA.result.id).result.platformNotes.join('\n'));
  const children = p.app.store.children(mother.id);
  assert.deepEqual(
    children.map((child) => [child.id, child.state, child.famille]),
    [
      [
        launchA.result.id,
        'completed',
        { racine: mother.id, mere: mother.id, profondeur: 1, titre: 'Rapport A' },
      ],
      [
        launchB.result.id,
        'completed',
        { racine: mother.id, mere: mother.id, profondeur: 1, titre: 'Résume le rapport FICTIF B.' },
      ],
    ],
  );
  // The sub-missions work in the mother's folder, have no mission tool and receive the family.
  for (const child of children) assert.equal(child.cwd, row.cwd);
  const daughters = daughterPrompts(p);
  assert.equal(daughters.length, 2);
  for (const entry of daughters) {
    assert.deepEqual(entry.servers, ['platform']);
    assert.equal(
      entry.prompt.famille.demandeDuProprietaire,
      'Compare deux rapports FICTIFS avec des sous-missions.',
    );
    assert.equal(entry.prompt.famille.mere, mother.id);
    assert.ok(entry.prompt.instructions.endsWith('\n' + rule.DAUGHTER_RULE));
    assert.doesNotMatch(entry.prompt.instructions, /Mode workflow accepté/);
  }
  const types = p.types(mother.id);
  assert.equal(types.filter((type) => type === 'child_launched').length, 2);
  assert.equal(types.filter((type) => type === 'child_done').length, 2);
  // GET /api/runs/:id : the family of the mother.
  const view = await p.api(`/api/runs/${mother.id}`);
  assert.deepEqual(
    view.body.family.map((child) => [child.id, child.state, child.attend]),
    [
      [launchA.result.id, 'completed', null],
      [launchB.result.id, 'completed', null],
    ],
  );
});

test('parallel = 2 avec trois sous-missions : la troisième attend sa place, puis démarre seule', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE 1 ATTENDRE:g1' }, save: 'A' },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE 2 ATTENDRE:g2' }, save: 'B' },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE 3 ATTENDRE:g3' }, save: 'C' },
      { call: 'mission_suivre', args: {} },
      { touch: join(p.hold, 'launched') },
      { call: 'mission_attendre', args: { ids: ['$A'], delaiSecondes: 30 } },
      { call: 'mission_suivre', args: { id: '$C' } },
      { touch: join(p.hold, 'g2') },
      { touch: join(p.hold, 'g3') },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Trois tâches FICTIVES en parallèle.',
    agent: 'fixture',
    pack: 'core',
    delegation: ACCEPTED({ total: 5, parallel: 2 }),
  });
  // Highest number of sub-missions running at the same time.
  let most = 0;
  const count = () => {
    const running = p.app.store
      .children(mother.id)
      .filter((child) => ['running', 'waiting_permission'].includes(child.state)).length;
    most = Math.max(most, running);
  };
  const timer = setInterval(count, 5);
  t.after(() => clearInterval(timer));
  await p.waitFor(() => existsSync(join(p.hold, 'launched')));
  const [, , third] = p.results();
  assert.equal(third.result.etat, 'en_file');
  assert.equal(p.app.store.get(third.result.id).state, 'queued');
  assert.equal(p.app.engine.active.has(third.result.id), false);
  // The family counts for one of the platform's three slots : its mother's.
  assert.equal(p.app.engine.activeSlots(), 1);
  const first = p.results()[3].result.missions;
  assert.deepEqual(
    first.map((m) => [m.etat === 'en_file' ? 'en_file' : 'lancée', m.attend]),
    [
      ['lancée', null],
      ['lancée', null],
      ['en_file', 'place'],
    ],
  );
  p.touch('g1');
  await p.ended(mother.id, 30000);
  clearInterval(timer);
  assert.equal(p.app.store.get(mother.id).state, 'completed', p.app.store.get(mother.id).error);
  const afterFirst = p.results()[5].result.missions[0];
  assert.notEqual(afterFirst.etat, 'en_file', 'la troisième a démarré quand la première a fini');
  const last = p.results()[6].result;
  assert.equal(last.delaiAtteint, false);
  assert.equal(last.terminees.length, 2, 'la première a déjà été rendue');
  assert.ok(most <= 2, `au plus deux en même temps (vu : ${most})`);
  assert.ok(p.app.store.children(mother.id).every((child) => child.state === 'completed'));
});

test('délai atteint : rien de perdu, résultat rendu ensuite et relu par mission_suivre', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE lente ATTENDRE:a' }, save: 'A' },
      { call: 'mission_attendre', args: { delaiSecondes: 1 } },
      { touch: join(p.hold, 'a') },
      { call: 'mission_attendre', args: { delaiSecondes: 30 } },
      { call: 'mission_suivre', args: { id: '$A', details: true } },
      { call: 'mission_attendre', args: {} },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Une tâche FICTIVE lente.',
    agent: 'fixture',
    pack: 'core',
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  const [launch, timedOut, waited, followed, again] = p.results();
  assert.equal(timedOut.result.delaiAtteint, true);
  assert.deepEqual(timedOut.result.terminees, []);
  assert.deepEqual(
    timedOut.result.enCours.map((x) => x.id),
    [launch.result.id],
  );
  assert.equal(waited.result.delaiAtteint, false);
  assert.equal(waited.result.terminees.length, 1);
  const done = waited.result.terminees[0];
  assert.equal(done.reponse, 'Résumé FICTIF : Tâche FICTIVE lente ATTENDRE:a');
  const read = followed.result.missions[0];
  for (const key of ['reponse', 'bilan', 'etat', 'fichiers', 'envois', 'cause'])
    assert.deepEqual(read[key], done[key], key);
  // Each finished one is given back once by a wait without ids.
  assert.deepEqual(again.result.terminees, []);
  assert.equal(again.result.delaiAtteint, false);
});
