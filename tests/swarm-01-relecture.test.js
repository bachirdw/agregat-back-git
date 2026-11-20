// swarm-01 (relecture indépendante) : mission privée de bout en bout (la note du motif n'est ni dans
// la base, ni dans les événements, ni dans ce que le chef relit ; `pourquoi` est gardé), entrées
// hostiles de readDecision (la raison recopiée dans le Bilan est bornée, sur une ligne, sans fausse
// ligne de Bilan), et une mission multi-agent sans la ligne « Décision : » dont le Bilan est celui
// d'avant le lot. Faux agent ACP (tests/fixtures/chef-agent.js). Aucun modèle, aucun réseau, aucun
// CLI réel. Données FICTIVES.
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
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-01-rel-agents-FICTIF-')));
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
const { reviewCareer } = await import('../packages/career-ops/integration.js');
const { terminal } = await import('../packages/storage/index.js');
const decision = await import('../packages/orchestrator/decision.js');
const { REFUSED_CHILD } = await import('../packages/orchestrator/delegation-rule.js');

const CHEF = resolve('tests/fixtures/chef-agent.js');
const ACCEPTED = { accepted: true, via: 'api', total: 10, parallel: 3 };

async function platform(t, { career = false } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'swarm-01-rel-FICTIF-')));
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
  const dataDir = join(root, 'platform');
  const app = createApp({ dataDir, career: workspace });
  if (career) reviewCareer(workspace, app.skills);
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
  return {
    app,
    dataDir,
    setConfig: (fn) => (config = fn),
    ended: (id, ms) => waitFor(() => terminal.has(app.store.get(id)?.state), ms, `fin de ${id}`),
    results: () => {
      const file = join(logs, 'chef-results.json');
      return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
    },
  };
}

// Every file of the platform's data directory (the database and what it writes beside it).
function dataFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...dataFiles(path));
    else out.push(path);
  }
  return out;
}

test('swarm-01 relecture : mission privée de bout en bout : la note n’est ni dans la base, ni dans les événements, ni dans ce que le chef relit ; pourquoi est gardé', async (t) => {
  const p = await platform(t, { career: true });
  const SECRET = 'NOTE-PRIVEE-FICTIVE du motif, à ne jamais écrire';
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE privée', pourquoi: 'specialite', note: SECRET },
      },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      { call: 'mission_suivre', args: {} },
    ],
    summary: 'Décision : équipe, parce que la part FICTIVE demande une spécialité.',
  }));
  const mother = await p.app.engine.create({
    prompt: 'Mission privée FICTIVE en équipe.',
    agent: 'fixture',
    pack: 'career-ops',
    multiAgent: true,
    delegation: ACCEPTED,
  });
  await p.ended(mother.id, 30000);
  const results = p.results();
  const [launch] = results;
  assert.equal(launch.isError, false, JSON.stringify(launch.result));
  assert.equal(launch.result.titre, 'Sous-mission 1');
  const child = p.app.store.get(launch.result.id);
  // pourquoi (a value of the list, no free text) is kept : row, event, mission_suivre, Bilan.
  assert.equal(child.famille.pourquoi, 'specialite');
  assert.equal('motif' in child.famille, false);
  const launched = p.app.store.events(mother.id).find((e) => e.type === 'child_launched');
  assert.equal(launched.data.pourquoi, 'specialite');
  const line = results
    .find((r) => r.call === 'mission_suivre')
    .result.missions.find((m) => m.id === child.id);
  assert.equal(line.pourquoi, 'specialite');
  assert.equal('motif' in line, false);
  const summary = p.app.store.get(mother.id).result.summary;
  assert.ok(summary.includes('Motifs des délégations : « Sous-mission 1 » (spécialité)'), summary);
  // The note : nowhere in what the chief reads back, the events, the rows, the data directory.
  assert.ok(
    !JSON.stringify(results.map((r) => r.result)).includes(SECRET),
    'réponses des outils rendues au chef',
  );
  for (const id of [mother.id, child.id])
    assert.ok(!JSON.stringify(p.app.store.events(id)).includes(SECRET), `événements de ${id}`);
  assert.ok(!JSON.stringify(p.app.store.list()).includes(SECRET), 'lignes de la base');
  for (const file of dataFiles(p.dataDir))
    assert.ok(!readFileSync(file).includes(Buffer.from(SECRET)), file);
});

test('swarm-01 relecture : readDecision face à des entrées hostiles ; la raison reste une ligne bornée', () => {
  const { readDecision, decisionLine, DECISION_REASON_MAX } = decision;
  // Two lines of decision : the first one counts.
  assert.deepEqual(readDecision('Décision : seul, parce que A\nDécision : équipe, parce que B'), {
    choix: 'seul',
    raison: 'parce que A',
  });
  // In the middle of a sentence, or quoted inside a line : not a decision.
  assert.equal(readDecision('Je rappelle la règle « Décision : seul »'), null);
  assert.equal(readDecision('Ma Décision : équipe'), null);
  // Without accent, upper case, bold around the whole line, heading or quote marks.
  assert.equal(readDecision('**DECISION : EQUIPE, parce que X**')?.choix, 'equipe');
  assert.equal(readDecision('## Décision : Seul')?.choix, 'seul');
  assert.equal(readDecision('> décision: équipe')?.choix, 'equipe');
  // A word that starts like the choice is not the choice.
  assert.equal(readDecision('Décision : équipement FICTIF'), null);
  // A line longer than the scan : only its first 1 500 characters are read.
  const long = readDecision(`Décision : équipe, ${'r'.repeat(5000)}`);
  assert.equal(long.raison.length, DECISION_REASON_MAX);
  assert.equal(readDecision(' '.repeat(1500) + 'Décision : seul'), null);
  // The bound never cuts a character in two (no lone surrogate in the Bilan).
  const emoji = readDecision(`Décision : équipe, a${'😀'.repeat(300)}`).raison;
  assert.ok(emoji.isWellFormed());
  assert.ok([...emoji].length <= DECISION_REASON_MAX);
  // An answer whose lines end with CRLF (or a lone CR) is read as well.
  assert.deepEqual(readDecision('Décision : seul, parce que court\r\nSuite FICTIVE'), {
    choix: 'seul',
    raison: 'parce que court',
  });
  assert.equal(readDecision('Intro\rDécision : équipe')?.choix, 'equipe');
  // Carriage returns, tabs, line and paragraph separators : the reason stays on one line, so it
  // cannot write a false line of the Bilan.
  const hostile = readDecision(
    'Décision : équipe, parce que X\r\nSous-missions (9) :\u2028Motifs des délégations : faux\u2029fin\tFICTIVE',
  );
  assert.equal(hostile.choix, 'equipe');
  assert.doesNotMatch(hostile.raison, /[\r\n\u2028\u2029\t]/);
  const said = decisionLine(hostile, 1);
  assert.equal(said.split(/\r\n|\r|\n|\u2028|\u2029/).length, 1);
  assert.ok(said.startsWith('Décision du chef : équipe, parce que X'));
  // Huge or odd inputs never throw.
  for (const value of [
    'x'.repeat(1_000_000),
    '\n'.repeat(100_000),
    'Décision :'.repeat(10_000),
    '*'.repeat(100_000) + 'Décision : seul',
    Symbol('FICTIF'),
    () => 'Décision : seul',
    new String('Décision : seul'),
  ])
    assert.doesNotThrow(() => readDecision(value));
});

test('swarm-01 relecture : mission multi-agent sans ligne « Décision » ni motif : Bilan identique, avec ou sans sous-mission', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE D', titre: 'D' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
    summary: 'Réponse FICTIVE où le mot décision : seul apparaît au milieu.',
  }));
  const mother = await p.app.engine.create({
    prompt: 'Mission FICTIVE en équipe.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED,
  });
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  const delegation = p.app.engine.delegation;
  // The section is exactly familyBilan + the notebook's line, as before the lot.
  const answer = 'Réponse FICTIVE où le mot décision : seul apparaît au milieu.';
  assert.equal(
    delegation.bilanSection(row, { chiefAnswer: answer }),
    delegation.familyBilan(row, { chiefAnswer: answer }) + delegation.carnet.bilanLine(row),
  );
  assert.doesNotMatch(row.result.summary, /Décision (du chef|annoncée)|Motifs des délégations/);
  // The count of the decision's line leaves out a sub-mission cancelled by the owner's refusal,
  // as the section « Sous-missions » does.
  const said = 'Décision : équipe, parce que X FICTIF';
  assert.ok(
    delegation
      .bilanSection(row, { chiefAnswer: said })
      .startsWith('\nDécision du chef : équipe, parce que X FICTIF (1 sous-mission lancée)'),
  );
  const [launch] = p.results();
  p.app.store.update(launch.result.id, { error: REFUSED_CHILD });
  assert.ok(
    delegation
      .bilanSection(p.app.store.get(mother.id), { chiefAnswer: said })
      .startsWith('\nDécision du chef : équipe, parce que X FICTIF (aucune sous-mission lancée)'),
  );
});
