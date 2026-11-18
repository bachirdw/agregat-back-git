// delegation-v2-01, partie B (« activation, accord, synthèse », plan v2 du 18/11, sections 2, 3, 4
// et 6, tableau 8.2) : outils et phrase prêtés à toute mission menée par un agent (jamais à une
// sous-mission), réglage de retrait AGENT_PLATFORM_DELEGATION=0 identique à la base 48a2f4e, accord
// par le bouton, par la demande écrite dans le prompt (sans carte, une ligne du fil) ou par la carte
// au premier lancement (accord, refus), question d'extension par choix, enveloppe 6 et 3, un seul tour
// de synthèse, et une mission qui ne délègue pas ne change pas. Faux agent ACP
// (tests/fixtures/chef-agent.js), pack `core` sans Skill. Aucun modèle, aucun navigateur, aucun
// relais, aucun CLI réel (la détection des agents pointe vers des chemins inexistants). FICTIF.
// multi-agent-v3-01 (D1) : outils et phrase prêtés seulement avec `multiAgent: true` ; sans lui, la
// mission de la base 48a2f4e (test 1).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// No real CLI is ever run by the detection of agents (`--version`) : every path is absent.
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'deleg-b-agents-FICTIF-')));
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

const SERVER = resolve('apps/api/server.js');
const WORKSPACE = resolve('packages/career-ops/workspace.js');
const { createApp } = await import(pathToFileURL(SERVER).href);
const { CareerWorkspace } = await import(pathToFileURL(WORKSPACE).href);
const { terminal } = await import('../packages/storage/index.js');
const rule = await import('../packages/orchestrator/delegation-rule.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const BASE = '48a2f4e';
const AGENT_NAMES = /claude|codex|gemini|opencode|askuserquestion|request_user_input/i;
const FAMILY_EVENT = /^(delegation|child|family)_/;
const waitUntil = async (check, ms = 15000, what = '') => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('Attente dépassée ' + what);
};

// One platform (API on 127.0.0.1:0) whose agent is the fake chief/sub-mission agent. `make` is the
// createApp of the code under test (or of the base) ; `env` is set while the platform is created.
async function platform(t, { make = createApp, Workspace = CareerWorkspace, env = {} } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'deleg-b-FICTIF-')));
  const logs = join(root, 'logs');
  const hold = join(root, 'hold');
  mkdirSync(logs);
  mkdirSync(hold);
  const saved = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  let app;
  try {
    app = make({
      dataDir: join(root, 'platform'),
      career: new Workspace({ root, roots: [root] }),
    });
  } finally {
    for (const [key, value] of Object.entries(saved))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
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
  const p = {
    app,
    logs,
    hold,
    setConfig: (fn) => (config = fn),
    touch: (name) => writeFileSync(join(hold, name), 'go'),
    waitFor: waitUntil,
    ended: (id, ms) =>
      waitUntil(() => terminal.has(app.store.get(id)?.state), ms ?? 15000, `fin de ${id}`),
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
    events: (id, type) => app.store.events(id).filter((event) => event.type === type),
  };
  return p;
}
const chiefPrompts = (p) => p.prompts().filter((entry) => !entry.prompt?.famille);
const daughterPrompts = (p) => p.prompts().filter((entry) => entry.prompt?.famille);

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

// ---- 1. Réglage de retrait : identique à la base 48a2f4e

// The code of the base, extracted from git into a temporary folder of the test (its own
// node_modules are those of this tree : package.json and package-lock.json are unchanged).
function extractBase() {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE}^{commit}`], { stdio: 'ignore' });
  } catch {
    return null;
  }
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'deleg-b-base-FICTIF-')));
  const archive = execFileSync(
    'git',
    ['archive', BASE, 'apps', 'packages', 'domain-packs', 'package.json'],
    { maxBuffer: 256 * 1024 * 1024 },
  );
  execFileSync('tar', ['-x', '-C', dir], { input: archive });
  symlinkSync(resolve('node_modules'), join(dir, 'node_modules'));
  return dir;
}

// One ordinary mission (and one that asks the owner a question), from creation to its end : what the
// agent received (prompt and MCP servers), the events of the mission, its state and its answer.
// `extra` : fields added to the request (multi-agent-v3-01 : `multiAgent`), never for the base.
async function ordinaryMissions(p, extra = {}) {
  const out = [];
  for (const prompt of ['Résume ce texte FICTIF.', 'Tâche FICTIVE QUESTION']) {
    const before = p.prompts().length;
    const run = await p.app.engine.create({ prompt, agent: 'fixture', pack: 'core', ...extra });
    if (prompt.includes('QUESTION')) {
      await p.waitFor(() => p.app.store.get(run.id).pendingQuestion, 15000, 'question');
      p.app.engine.answer(run.id, { action: 'accept', content: { reponse: 'Variante FICTIVE' } });
    }
    await p.ended(run.id);
    await p.waitFor(() => !p.app.engine.active.has(run.id));
    const row = p.app.store.get(run.id);
    out.push({
      state: row.state,
      answer: row.result?.answer ?? null,
      types: p.types(run.id),
      sent: p.prompts().slice(before),
      keys: Object.keys(row).sort(),
    });
  }
  return out;
}

// multi-agent-v3-01 (D1) : a mission without `multiAgent`, with no environment variable at all, is
// the mission of the base ; with it, only the sentence and the second server ; the withdrawal
// setting (AGENT_PLATFORM_DELEGATION=0) still withdraws them even with `multiAgent`.
test('sans multiAgent et sans variable d’environnement : consigne, serveurs et déroulement identiques à la base 48a2f4e ; avec multiAgent, seuls la phrase et le second serveur changent ; AGENT_PLATFORM_DELEGATION=0 les retire', async (t) => {
  const baseDir = extractBase();
  if (!baseDir) return t.skip(`commit ${BASE} absent de ce dépôt`);
  t.after(() => rmSync(baseDir, { recursive: true, force: true }));
  const base = await import(pathToFileURL(join(baseDir, 'apps/api/server.js')).href);
  const baseWorkspace = await import(
    pathToFileURL(join(baseDir, 'packages/career-ops/workspace.js')).href
  );
  const before = await ordinaryMissions(
    await platform(t, { make: base.createApp, Workspace: baseWorkspace.CareerWorkspace }),
  );
  assert.equal(process.env.AGENT_PLATFORM_DELEGATION, undefined);
  const off = await ordinaryMissions(await platform(t));
  const withdrawn = await ordinaryMissions(
    await platform(t, { env: { AGENT_PLATFORM_DELEGATION: '0' } }),
    { multiAgent: true },
  );
  const lent = await ordinaryMissions(await platform(t), { multiAgent: true });
  // The switch itself is kept on the mission's row (and only then).
  const withoutSwitch = (mission) => {
    assert.ok(mission.keys.includes('multiAgent'));
    return { ...mission, keys: mission.keys.filter((key) => key !== 'multiAgent') };
  };
  for (const [index, mission] of before.entries()) {
    assert.equal(mission.state, 'completed');
    // Without the switch : the same prompt (every field, every word), the same servers, the same
    // events, the same row.
    assert.deepEqual(off[index], mission, `mission ${index + 1} sans multiAgent`);
    // Withdrawn : likewise, even with the switch.
    assert.deepEqual(withoutSwitch(withdrawn[index]), mission, `mission ${index + 1} retirée`);
    assert.deepEqual(mission.sent[0].servers, ['platform']);
    // Lent : only the sentence at the end of the instructions and the second server.
    const [baseSent, lentSent] = [mission.sent[0], lent[index].sent[0]];
    assert.deepEqual(lentSent.servers, ['platform', rule.MISSION_SERVER]);
    assert.deepEqual(
      { ...lentSent.prompt, instructions: null },
      { ...baseSent.prompt, instructions: null },
    );
    assert.equal(
      lentSent.prompt.instructions,
      baseSent.prompt.instructions + '\n' + rule.chiefRule(undefined),
    );
    assert.deepEqual(lent[index].sent.slice(1), mission.sent.slice(1));
    assert.deepEqual(
      { ...withoutSwitch(lent[index]), sent: null },
      { ...mission, sent: null },
      `déroulement de la mission ${index + 1}`,
    );
  }
});

// ---- 2. Règle d'or : une mission qui ne délègue pas ne change pas

test('outils prêtés mais rien lancé : aucune lecture, aucun événement, aucune ligne de Bilan, aucun tour de plus, aucune carte', async (t) => {
  const p = await platform(t);
  // The chief has the tools and calls none (steps : none).
  p.setConfig(() => ({ steps: [] }));
  const spy = spyReads(p.app.store);
  for (const delegation of [undefined, { accepted: true, via: 'bouton' }]) {
    const before = p.prompts().length;
    const run = await p.app.engine.create({
      prompt: 'Cherche des informations FICTIVES sur une personnalité.',
      agent: 'fixture',
      pack: 'core',
      multiAgent: true,
      ...(delegation ? { delegation } : {}),
    });
    await p.ended(run.id);
    const row = p.app.store.get(run.id);
    assert.equal(row.state, 'completed', row.error);
    assert.equal(row.result.answer, 'Synthèse FICTIVE du chef');
    const sent = p.prompts().slice(before);
    assert.equal(sent.length, 1, 'un seul tour');
    assert.deepEqual(sent[0].servers, ['platform', rule.MISSION_SERVER]);
    assert.ok(sent[0].prompt.instructions.endsWith('\n' + rule.chiefRule(delegation)));
    assert.ok(!p.types(run.id).some((type) => FAMILY_EVENT.test(type)), p.types(run.id).join());
    assert.ok(!p.types(run.id).includes('question'));
    assert.equal(row.pendingQuestion ?? null, null);
    assert.equal('estMere' in row, false);
    assert.doesNotMatch(
      row.result.summary,
      /Sous-missions|Sous-agents|sous-agents|Synthèse finale/,
    );
  }
  assert.deepEqual(spy.reads, [], 'lecture de la base par la délégation');
  assert.deepEqual(spy.children, []);
});

test('phrase du chef : une seule pour tous, informe sans prescrire, sans nom d’agent ; enveloppe 6 et 3 par défaut', () => {
  assert.deepEqual({ ...rule.DEFAULT_ENVELOPE }, { total: 6, parallel: 3 });
  const asked = rule.chiefRule(undefined);
  const given = rule.chiefRule({ accepted: true, via: 'bouton' });
  const refused = rule.chiefRule({ accepted: false, via: 'carte' });
  for (const text of [asked, given, refused]) {
    assert.match(text, /quand c’est vraiment utile/);
    assert.match(text, /plusieurs sources indépendantes/);
    assert.match(text, /pour une demande simple, ou une suite d’étapes qui dépendent/);
    assert.match(text, /rien ne t’oblige à déléguer/);
    assert.match(text, /choisis l’agent et le modèle selon la difficulté/);
    assert.doesNotMatch(text, AGENT_NAMES);
    assert.doesNotMatch(text, /Mode workflow|career/i);
  }
  assert.match(given, /jusqu’à 6 sous-missions, 3 à la fois\.$/);
  assert.match(
    asked,
    /demandeDuProprietaire.*la plateforme consultera le propriétaire avant la première sous-mission \(ne lui pose pas la question toi-même\)/,
  );
  assert.match(refused, /refusé les sous-agents pour cette mission : continue seul\.$/);
  for (const text of [
    rule.DAUGHTER_RULE,
    rule.SYNTHESIS_TURN,
    rule.consentMessage(undefined),
    rule.promptNotice(undefined),
  ])
    assert.doesNotMatch(text, AGENT_NAMES, text);
  assert.match(rule.DAUGHTER_RULE, /n’écris que dans des fichiers propres à ta part/);
  assert.doesNotMatch(rule.DAUGHTER_RULE, /career|pipeline|tracker/i);
  // multi-agent-v3-01 (D5) : the envelope bounds the sub-missions Relay runs, nothing more.
  assert.match(
    rule.consentMessage(undefined),
    /Au plus 6 sous-missions Relay pour cette mission, 3 en/,
  );
  assert.doesNotMatch(rule.consentMessage(undefined), /%|économi|précis/);
});

// ---- 3. Les trois voies d'accord

test('voie 1, bouton coché : aucune question, accord écrit au premier lancement, ligne du Bilan', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { waitFile: join(p.hold, 'go') },
      { call: 'mission_lancer', args: { consigne: 'Partie FICTIVE', titre: 'Partie' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Mission FICTIVE, bouton coché.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: { accepted: true, via: 'bouton' },
  });
  await p.waitFor(() => chiefPrompts(p).length === 1);
  assert.ok(!p.types(mother.id).some((type) => FAMILY_EVENT.test(type)));
  p.touch('go');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal(p.results()[0].result.etat, 'en_cours');
  assert.deepEqual(p.results()[0].result.famille, {
    lancees: 1,
    // multi-agent-v3-01 (D4) : tasks and resumptions apart.
    taches: 1,
    reprises: 0,
    dansEnveloppe: 1,
    enCours: 1,
    total: 6,
    parallel: 3,
  });
  const [accepted] = p.events(mother.id, 'delegation_accepted');
  assert.equal(accepted.data.via, 'bouton');
  assert.equal(p.events(mother.id, 'delegation_accepted').length, 1);
  assert.ok(!p.types(mother.id).includes('question'));
  assert.ok(row.result.summary.includes(rule.consentLine(row.delegation)));
  assert.match(row.result.summary, /case « Autoriser les sous-agents » cochée/);
});

test('voie 2, demande écrite dans le prompt : pas de carte, une ligne du fil, accord « prompt » au Bilan ; la sous-mission n’a ni outils ni phrase du chef', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Portail FICTIF A', titre: 'Portail A', demandeDuProprietaire: true },
      },
      { call: 'mission_lancer', args: { consigne: 'Portail FICTIF B', titre: 'Portail B' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Répartis le travail FICTIF entre plusieurs agents.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
  });
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  assert.deepEqual(
    p.results().map((r) => [r.call, r.isError, r.result.etat ?? null]),
    [
      ['mission_lancer', false, 'en_cours'],
      ['mission_lancer', false, 'en_cours'],
      ['mission_attendre', false, null],
    ],
  );
  assert.equal(p.results()[2].result.terminees.length, 2);
  assert.ok(!p.types(mother.id).includes('question'));
  const accepted = p.events(mother.id, 'delegation_accepted');
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].data.via, 'prompt');
  assert.equal(accepted[0].data.message, rule.promptNotice(undefined));
  assert.equal(
    accepted[0].data.message,
    'Sous-agents lancés à ta demande : chacun consomme ton abonnement comme une mission ordinaire ; enveloppe : 6 au plus, 3 en même temps.',
  );
  assert.deepEqual(
    { accepted: row.delegation.accepted, via: row.delegation.via, total: row.delegation.total },
    { accepted: true, via: 'prompt', total: 6 },
  );
  assert.match(row.result.summary, /Accord des sous-agents : demande écrite dans le prompt, selon/);
  // A sub-mission : never the mission tools, never the chief's sentence.
  const daughters = daughterPrompts(p);
  assert.equal(daughters.length, 2);
  for (const entry of daughters) {
    assert.deepEqual(entry.servers, ['platform']);
    // multi-agent-v3-01 (D9) : the sub-mission's sentence names its results folder.
    assert.ok(entry.prompt.famille.dossierResultats);
    assert.ok(
      entry.prompt.instructions.endsWith(
        '\n' + rule.daughterRule(entry.prompt.famille.dossierResultats),
      ),
    );
    assert.doesNotMatch(entry.prompt.instructions, /mission_lancer/);
  }
});

test('voie 3, carte au premier lancement : sous-missions en attente, une seule question à choix, accord, puis départ', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Partie FICTIVE 1', titre: 'Partie 1' } },
      { call: 'mission_lancer', args: { consigne: 'Partie FICTIVE 2', titre: 'Partie 2' } },
      { call: 'mission_suivre', args: {} },
      { touch: join(p.hold, 'asked') },
      { waitFile: join(p.hold, 'answered') },
      { call: 'mission_lancer', args: { consigne: 'Partie FICTIVE 3', titre: 'Partie 3' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Mission FICTIVE en trois parties indépendantes.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
  });
  await p.waitFor(() => existsSync(join(p.hold, 'asked')));
  const [first, second, followed] = p.results();
  assert.equal(first.result.etat, 'attend_accord');
  assert.equal(second.result.etat, 'attend_accord');
  assert.deepEqual(
    followed.result.missions.map((m) => [m.etat, m.attend]),
    [
      ['attend_accord', 'accord'],
      ['attend_accord', 'accord'],
    ],
  );
  const question = await p.waitFor(() => p.app.store.get(mother.id).pendingQuestion);
  assert.equal(question.kind, 'form');
  assert.equal(question.message, rule.consentMessage(undefined));
  assert.deepEqual(question.requestedSchema.properties.choix.oneOf, [...rule.CONSENT_CHOICES]);
  assert.equal(p.events(mother.id, 'question').length, 1);
  // Held : no sub-mission has started.
  assert.equal(daughterPrompts(p).length, 0);
  for (const child of p.app.store.children(mother.id)) assert.equal(child.state, 'queued');
  assert.ok(!p.types(mother.id).includes('delegation_accepted'));
  p.app.engine.answer(mother.id, { action: 'accept', content: { choix: 'autoriser' } });
  p.touch('answered');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal(row.delegation.accepted, true);
  assert.equal(row.delegation.via, 'carte');
  assert.equal(p.results()[3].result.etat, 'en_cours');
  assert.equal(p.results()[4].result.terminees.length, 3);
  assert.equal(p.events(mother.id, 'question').length, 1, 'aucune autre question');
  const accepted = p.events(mother.id, 'delegation_accepted');
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].data.via, 'carte');
  assert.equal(daughterPrompts(p).length, 3);
  assert.match(row.result.summary, /Accord des sous-agents : donné sur la carte/);
  assert.match(row.result.summary, /Sous-missions \(3\)/);
});

test('voie 3, refus (choix « continuer seul », ou carte refusée) : sous-mission annulée, refus_proprietaire ensuite, aucune autre question, une ligne au Bilan', async (t) => {
  const p = await platform(t);
  p.setConfig((input) => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Partie FICTIVE', titre: 'Partie' } },
      { touch: join(p.hold, `asked-${input.prompt.length}`) },
      { waitFile: join(p.hold, `answered-${input.prompt.length}`) },
      { call: 'mission_lancer', args: { consigne: 'Autre partie FICTIVE' } },
    ],
    summary: 'Réponse FICTIVE du chef, seul.',
  }));
  const answers = [
    { action: 'accept', content: { choix: 'continuer_seul' } },
    { action: 'decline' },
  ];
  for (const [index, answer] of answers.entries()) {
    const prompt = `Mission FICTIVE ${'x'.repeat(index + 1)}`;
    const mother = await p.app.engine.create({
      prompt,
      agent: 'fixture',
      pack: 'core',
      multiAgent: true,
    });
    await p.waitFor(() => existsSync(join(p.hold, `asked-${prompt.length}`)));
    await p.waitFor(() => p.app.store.get(mother.id).pendingQuestion);
    p.app.engine.answer(mother.id, answer);
    p.touch(`answered-${prompt.length}`);
    await p.ended(mother.id, 30000);
    const row = p.app.store.get(mother.id);
    assert.equal(row.state, 'completed', row.error);
    assert.equal(row.result.answer, 'Réponse FICTIVE du chef, seul.');
    const [child] = p.app.store.children(mother.id);
    assert.equal(child.state, 'cancelled');
    assert.equal(child.error, rule.REFUSED_CHILD);
    // Each chief writes its own list of calls.
    const later = p.results()[1];
    assert.equal(later.isError, true);
    assert.equal(later.result.erreur, 'refus_proprietaire');
    assert.equal(p.app.store.children(mother.id).length, 1, 'rien de créé après le refus');
    assert.equal(p.events(mother.id, 'question').length, 1);
    assert.deepEqual(
      p.events(mother.id, 'delegation_declined').map((e) => e.data.via),
      ['carte'],
    );
    assert.equal(row.delegation.accepted, false);
    assert.equal(row.delegation.via, 'carte');
    assert.match(
      row.result.summary,
      /Sous-agents proposés par l’agent, refusés : mission menée par un seul agent\./,
    );
    assert.doesNotMatch(row.result.summary, /Sous-missions \(/);
    // The chief ended alone : no synthesis turn.
    assert.equal(chiefPrompts(p).filter((e) => e.prompt.objective === prompt).length, 1);
  }
});

test('annuler la mère pendant la carte : la sous-mission en attente d’accord est annulée, la carte fermée', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Partie FICTIVE', titre: 'Partie' } },
      { waitFile: join(p.hold, 'jamais') },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Mission FICTIVE annulée.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
  });
  await p.waitFor(() => p.app.store.get(mother.id).pendingQuestion);
  const [child] = p.app.store.children(mother.id);
  assert.equal(child.state, 'queued');
  p.app.engine.cancel(mother.id);
  await p.ended(mother.id);
  await p.ended(child.id);
  assert.equal(p.app.store.get(mother.id).state, 'cancelled');
  assert.equal(p.app.store.get(child.id).state, 'cancelled');
  assert.equal(p.app.store.get(mother.id).pendingQuestion ?? null, null);
  assert.equal(daughterPrompts(p).length, 0, 'jamais démarrée');
  assert.ok(!p.types(mother.id).includes('delegation_declined'));
});

test('question d’extension : un choix (oui / non), pas un texte libre', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE 1' } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE 2' } },
      { touch: join(p.hold, 'refused') },
      { waitFile: join(p.hold, 'answered') },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE 2' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Deux tâches FICTIVES, enveloppe d’une seule.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: { accepted: true, via: 'api', total: 1, parallel: 1 },
  });
  await p.waitFor(() => existsSync(join(p.hold, 'refused')));
  assert.equal(p.results()[1].result.erreur, 'enveloppe_atteinte');
  const asked = await p.waitFor(() => p.app.store.get(mother.id).pendingQuestion);
  assert.equal(asked.kind, 'form');
  assert.equal(asked.message, rule.extensionMessage(2, 1));
  assert.deepEqual(asked.requestedSchema.properties.choix.oneOf, [...rule.EXTENSION_CHOICES]);
  // A free text is refused by the form : the answer is a choice.
  assert.throws(() =>
    p.app.engine.answer(mother.id, { action: 'accept', content: { reponse: 'oui' } }),
  );
  p.app.engine.answer(mother.id, { action: 'accept', content: { choix: 'oui' } });
  p.touch('answered');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal(row.delegation.total, 6);
  assert.equal(p.results()[2].isError, false);
});

// ---- 4. Un seul tour de synthèse

test('tour de synthèse : la plateforme attend les sous-missions vivantes, puis un seul tour avec leurs résultats joints', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Source FICTIVE ATTENDRE:a', titre: 'Source A' },
      },
      {
        call: 'mission_lancer',
        args: { consigne: 'Source FICTIVE ATTENDRE:b', titre: 'Source B' },
      },
    ],
    reminderSteps: [],
    summary: 'Réponse FICTIVE écrite avant les résultats.',
    reminderSummary: 'Synthèse FICTIVE avec les deux résultats.',
  }));
  const mother = await p.app.engine.create({
    prompt: 'Deux sources FICTIVES à comparer.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: { accepted: true, via: 'bouton' },
  });
  await p.waitFor(() => p.types(mother.id).includes('family_waiting'));
  assert.equal(p.app.store.get(mother.id).state, 'running');
  assert.equal(chiefPrompts(p).length, 1, 'aucun tour avant la fin des sous-missions');
  p.touch('a');
  p.touch('b');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal(row.result.answer, 'Synthèse FICTIVE avec les deux résultats.');
  const turns = chiefPrompts(p);
  assert.equal(turns.length, 2, 'un seul tour de synthèse');
  const synthesis = turns[1].prompt;
  assert.equal(synthesis.platform.turnKind, 'family_results');
  assert.equal(synthesis.instructions, rule.SYNTHESIS_TURN);
  assert.deepEqual(
    synthesis.familyResults.terminees.map((r) => [r.titre, r.etat, r.reponse]),
    [
      ['Source A', 'completed', 'Résumé FICTIF : Source FICTIVE ATTENDRE:a'],
      ['Source B', 'completed', 'Résumé FICTIF : Source FICTIVE ATTENDRE:b'],
    ],
  );
  assert.ok(!p.prompts().some((e) => e.prompt?.platform?.turnKind === 'family'));
  assert.doesNotMatch(row.result.summary, /Synthèse finale non faite/);
});

test('tour de synthèse impossible (session de l’agent fermée) : sortie actuelle et une ligne fidèle au Bilan', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Source FICTIVE ATTENDRE:c', titre: 'Source C' },
      },
    ],
    reminderSteps: [],
    summary: 'Réponse FICTIVE écrite avant le résultat.',
  }));
  const mother = await p.app.engine.create({
    prompt: 'Une source FICTIVE.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: { accepted: true, via: 'bouton' },
  });
  await p.waitFor(() => p.types(mother.id).includes('family_waiting'));
  await p.app.engine.active.get(mother.id).runtime.close();
  p.touch('c');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal(row.result.answer, 'Réponse FICTIVE écrite avant le résultat.');
  assert.equal(chiefPrompts(p).length, 1);
  assert.ok(row.result.summary.includes(rule.synthesisMissed(['Source C'])));
  assert.match(row.result.summary, /1\. « Source C » — agent fixture, terminée/);
});

// ---- 5. Schéma et mode forcé

test('via : bouton, prompt, carte ou api ; mode agent forcé seulement par le mode multi-agent de la requête', async (t) => {
  const p = await platform(t);
  for (const via of ['bouton', 'prompt', 'carte', 'api']) {
    const plan = await p.app.engine.plan({
      prompt: 'Mission FICTIVE.',
      agent: 'fixture',
      pack: 'core',
      multiAgent: true,
      delegation: { accepted: true, via },
    });
    assert.equal(plan.input.delegation.via, via);
    assert.deepEqual([plan.input.delegation.total, plan.input.delegation.parallel], [6, 3]);
  }
  for (const via of ['case', 'mot', 'proposition'])
    await assert.rejects(
      p.app.engine.plan({
        prompt: 'Mission FICTIVE.',
        agent: 'fixture',
        pack: 'core',
        multiAgent: true,
        delegation: { accepted: true, via },
      }),
    );
  // A DAG asked by default (front) : untouched without the multi-agent mode (multi-agent-v3-01 D1 :
  // the button alone changes nothing), an agent with it.
  for (const delegation of [
    undefined,
    { accepted: false, via: 'carte' },
    { accepted: true, via: 'bouton' },
  ]) {
    const plain = await p.app.engine.plan({
      prompt: 'Mission FICTIVE.',
      agent: 'fixture',
      pack: 'core',
      mode: 'workflow',
      ...(delegation ? { delegation } : {}),
    });
    assert.equal(plain.input.mode, 'workflow');
    assert.ok(plain.dag);
  }
  const forced = await p.app.engine.plan({
    prompt: 'Mission FICTIVE.',
    agent: 'fixture',
    pack: 'core',
    mode: 'workflow',
    multiAgent: true,
    delegation: { accepted: true, via: 'bouton' },
  });
  assert.equal(forced.input.mode, 'agent');
});
