// review-delegation-v2-01 : relecture indépendante du sprint delegation-v2-01 (plan v2 du 18/11).
// Angle principal : « rien d'existant ne change ». Une mission qui ne lance aucune sous-mission se
// comporte comme en 48a2f4e (hors la phrase ajoutée à la consigne et le second serveur d'outils), et
// le réglage AGENT_PLATFORM_DELEGATION=0 rend le comportement de la base. Faux agent ACP
// (tests/fixtures/chef-agent.js), pack `core` sans Skill. Aucun modèle, aucun navigateur, aucun
// relais, aucun CLI réel (la détection des agents pointe vers des chemins inexistants). FICTIF.
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
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'review-deleg-agents-FICTIF-')));
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

const { createApp } = await import(pathToFileURL(resolve('apps/api/server.js')).href);
const { CareerWorkspace } = await import(
  pathToFileURL(resolve('packages/career-ops/workspace.js')).href
);
const { terminal } = await import('../packages/storage/index.js');
const rule = await import('../packages/orchestrator/delegation-rule.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const BASE = '48a2f4e';
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
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'review-deleg-FICTIF-')));
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
  return {
    app,
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
  };
}

// The code of the base, extracted from git into a temporary folder of the test (its own
// node_modules are those of this tree : package.json and package-lock.json are unchanged).
function extractBase() {
  try {
    execFileSync('git', ['cat-file', '-e', `${BASE}^{commit}`], { stdio: 'ignore' });
  } catch {
    return null;
  }
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'review-deleg-base-FICTIF-')));
  const archive = execFileSync(
    'git',
    ['archive', BASE, 'apps', 'packages', 'domain-packs', 'package.json'],
    { maxBuffer: 256 * 1024 * 1024 },
  );
  execFileSync('tar', ['-x', '-C', dir], { input: archive });
  symlinkSync(resolve('node_modules'), join(dir, 'node_modules'));
  return dir;
}

// ---- R1. Une annulation qui arrive après le dernier tour d'une mission qui ne délègue pas

// The owner's cancel lands after the last turn was read and before the Bilan (in the real code, while
// the turn loop awaits a steering request still in flight). The base never looked at the abort there
// and wrote the mission `completed` with the agent's answer ; the abort check added after `settle`
// must only concern a mother that waited for its sub-missions.
async function cancelAfterLastTurn(p) {
  const engine = p.app.engine;
  const close = engine.closeOwnerMessages.bind(engine);
  let cancelled = false;
  engine.closeOwnerMessages = (id, control) => {
    close(id, control);
    if (cancelled) return;
    cancelled = true;
    engine.cancel(id);
  };
  const run = await engine.create({
    prompt: 'Résume ce texte FICTIF.',
    agent: 'fixture',
    pack: 'core',
  });
  await p.ended(run.id);
  await p.waitFor(() => !engine.active.has(run.id));
  const row = p.app.store.get(run.id);
  return {
    cancelled,
    state: row.state,
    answer: row.result?.answer ?? null,
    error: row.error ?? null,
  };
}

test('R1. annulation arrivée après le dernier tour d’une mission qui ne délègue pas : même issue qu’en 48a2f4e', async (t) => {
  const baseDir = extractBase();
  if (!baseDir) return t.skip(`commit ${BASE} absent de ce dépôt`);
  t.after(() => rmSync(baseDir, { recursive: true, force: true }));
  const base = await import(pathToFileURL(join(baseDir, 'apps/api/server.js')).href);
  const baseWorkspace = await import(
    pathToFileURL(join(baseDir, 'packages/career-ops/workspace.js')).href
  );
  const before = await cancelAfterLastTurn(
    await platform(t, { make: base.createApp, Workspace: baseWorkspace.CareerWorkspace }),
  );
  assert.equal(before.cancelled, true);
  for (const env of [{}, { AGENT_PLATFORM_DELEGATION: '0' }]) {
    const now = await cancelAfterLastTurn(await platform(t, { env }));
    assert.deepEqual(now, before, `réglage ${JSON.stringify(env)}`);
  }
});

// ---- R2. Réglage de retrait : le champ `delegation` de la requête n'a plus d'effet

test('R2. réglage AGENT_PLATFORM_DELEGATION=0 : le bouton coché ne force plus le mode agent (un DAG reste un DAG)', async (t) => {
  const withdrawn = await platform(t, { env: { AGENT_PLATFORM_DELEGATION: '0' } });
  const plan = await withdrawn.app.engine.plan({
    prompt: 'Mission FICTIVE.',
    agent: 'fixture',
    pack: 'core',
    mode: 'workflow',
    delegation: { accepted: true, via: 'bouton' },
  });
  assert.equal(plan.input.mode, 'workflow');
  assert.ok(plan.dag);
  // Lent (no setting) : the button still makes the chief an agent.
  const lent = await platform(t);
  const forced = await lent.app.engine.plan({
    prompt: 'Mission FICTIVE.',
    agent: 'fixture',
    pack: 'core',
    mode: 'workflow',
    delegation: { accepted: true, via: 'bouton' },
  });
  assert.equal(forced.input.mode, 'agent');
});

// ---- R3. Mémoire : une famille finie n'est plus gardée

test('R3. une mère qui finit après sa dernière sous-mission ne laisse rien en mémoire ; une mission qui ne fait que suivre ne crée aucune famille', async (t) => {
  const p = await platform(t);
  const delegation = p.app.engine.delegation;
  p.setConfig((input) =>
    input.prompt.includes('SUIVRE')
      ? {
          steps: [
            { call: 'mission_suivre', args: {} },
            { call: 'mission_attendre', args: {} },
          ],
        }
      : {
          steps: [
            { call: 'mission_lancer', args: { consigne: 'Partie FICTIVE', titre: 'Partie' } },
            { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
          ],
        },
  );
  const mother = await p.app.engine.create({
    prompt: 'Mission FICTIVE avec une partie.',
    agent: 'fixture',
    pack: 'core',
    delegation: { accepted: true, via: 'bouton' },
  });
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed', p.app.store.get(mother.id).error);
  const [child] = p.app.store.children(mother.id);
  assert.equal(child.state, 'completed');
  await p.waitFor(() => !p.app.engine.active.has(mother.id));
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(delegation.families.size, 0, 'famille gardée après la fin de la mère');
  assert.equal(delegation.finals.size, 0, 'résultats gardés en mémoire');
  assert.equal(delegation.briefs.size, 0, 'consignes gardées en mémoire');
  // Still readable from the database once forgotten.
  assert.equal(delegation.outcome(p.app.store.get(child.id)).etat, 'completed');
  const reader = await p.app.engine.create({
    prompt: 'Mission FICTIVE SUIVRE.',
    agent: 'fixture',
    pack: 'core',
  });
  await p.ended(reader.id);
  assert.equal(p.app.store.get(reader.id).state, 'completed');
  assert.equal(p.results().at(-1).call, 'mission_attendre');
  await p.waitFor(() => !p.app.engine.active.has(reader.id));
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(delegation.families.size, 0, 'famille créée pour une simple lecture');
});

// ---- R4. Constat : la carte d'accord pendant que le chef travaille

test('R4. constat : pendant la carte d’accord, la mère est « attend le propriétaire » et le chef continue de travailler', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Partie FICTIVE', titre: 'Partie' } },
      { touch: join(p.hold, 'asked') },
      { waitFile: join(p.hold, 'seen') },
      { call: 'mission_suivre', args: {} },
      { touch: join(p.hold, 'followed') },
      { waitFile: join(p.hold, 'answered') },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Mission FICTIVE, accord à demander.',
    agent: 'fixture',
    pack: 'core',
  });
  await p.waitFor(() => existsSync(join(p.hold, 'asked')));
  await p.waitFor(() => p.app.store.get(mother.id).pendingQuestion);
  assert.equal(p.app.store.get(mother.id).state, 'awaiting_owner');
  // The chief is not blocked : its next call is served while the card is open.
  p.touch('seen');
  await p.waitFor(() => existsSync(join(p.hold, 'followed')));
  assert.equal(p.results()[1].isError, false);
  assert.equal(p.results()[1].result.missions[0].attend, 'accord');
  assert.equal(p.app.store.get(mother.id).state, 'awaiting_owner');
  p.app.engine.answer(mother.id, { action: 'accept', content: { choix: 'autoriser' } });
  assert.equal(p.app.store.get(mother.id).state, 'running');
  p.touch('answered');
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed', p.app.store.get(mother.id).error);
});

// essai-delegation-01 (E139, essai réel du 19/11) : sans accord, `mission_lancer` rendait seulement
// `etat: "attend_accord"` ; le chef reposait lui-même la question au propriétaire et s'arrêtait. Le
// résultat dit maintenant que la plateforme consulte le propriétaire, de ne pas lui poser la question
// et de continuer sa part ; le refus et la phrase du chef le disent aussi. Rien n'est bloqué.
test('E139. carte d’accord : mission_lancer en attente porte une note (même texte au second lancement) ; refus et phrase du chef disent de ne pas reposer la question', async (t) => {
  const note = rule.CONSENT_PENDING_NOTE;
  assert.equal(typeof note, 'string');
  assert.match(note, /plateforme consulte le propriétaire/);
  assert.match(note, /ne lui pose pas la question toi-même/);
  assert.match(note, /continue ta part du travail sans attendre/);
  assert.match(note, /mission_suivre ou mission_attendre/);
  assert.match(note, /s’il accepte, la sous-mission démarre seule/);
  assert.match(note, /s’il refuse, elle est annulée : continue seul/);
  assert.match(rule.REFUSED_MESSAGE, /continue seul, sans lui reposer la question\.$/);
  const asked = rule.chiefRule(undefined);
  assert.match(
    asked,
    /sinon la plateforme consultera le propriétaire avant la première sous-mission \(ne lui pose pas la question toi-même\) ; s’il refuse, continue seul\.$/,
  );
  for (const text of [note, rule.REFUSED_MESSAGE, asked])
    assert.doesNotMatch(text, /claude|codex|gemini|opencode/i);

  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Partie FICTIVE 1', titre: 'Partie 1' } },
      { call: 'mission_lancer', args: { consigne: 'Partie FICTIVE 2', titre: 'Partie 2' } },
      { touch: join(p.hold, 'asked') },
      { waitFile: join(p.hold, 'answered') },
      { call: 'mission_lancer', args: { consigne: 'Partie FICTIVE 3', titre: 'Partie 3' } },
    ],
    summary: 'Réponse FICTIVE du chef, seul.',
  }));
  const mother = await p.app.engine.create({
    prompt: 'Mission FICTIVE, accord à demander.',
    agent: 'fixture',
    pack: 'core',
  });
  await p.waitFor(() => existsSync(join(p.hold, 'asked')));
  const [first, second] = p.results();
  for (const launched of [first, second]) {
    assert.equal(launched.isError, false);
    assert.equal(launched.result.etat, 'attend_accord');
    assert.equal(launched.result.note, note);
  }
  await p.waitFor(() => p.app.store.get(mother.id).pendingQuestion);
  p.app.engine.answer(mother.id, { action: 'accept', content: { choix: 'continuer_seul' } });
  p.touch('answered');
  await p.ended(mother.id, 30000);
  const refused = p.results()[2];
  assert.equal(refused.isError, true);
  assert.equal(refused.result.erreur, 'refus_proprietaire');
  assert.equal(refused.result.message, rule.REFUSED_MESSAGE);
  assert.equal(p.types(mother.id).filter((type) => type === 'question').length, 1);

  // Accord déjà donné (bouton) : le lancement démarre, sans note.
  const q = await platform(t);
  q.setConfig(() => ({
    steps: [{ call: 'mission_lancer', args: { consigne: 'Partie FICTIVE', titre: 'Partie' } }],
  }));
  const given = await q.app.engine.create({
    prompt: 'Mission FICTIVE, accord donné.',
    agent: 'fixture',
    pack: 'core',
    delegation: { accepted: true, via: 'bouton' },
  });
  await q.ended(given.id, 30000);
  const [started] = q.results();
  assert.equal(started.result.etat, 'en_cours');
  assert.equal('note' in started.result, false);
});
