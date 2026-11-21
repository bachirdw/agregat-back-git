// sans-skill-01 (constat du propriétaire du 21/11) : sur une base où le Skill career-ops n'a jamais été
// importé, une mission lancée sans rien choisir (pack `auto`, aucun Skill) et que la détection
// automatique rattache au pack career-ops était refusée à la création (« Skill inconnu »). Règle : quand
// l'utilisateur n'a rien choisi et que le pack reconnu exige un Skill que le registre ne peut pas servir,
// ce pack est écarté de la détection ; la mission suit le chemin qu'elle aurait pris sans lui et garde
// une note (`packNote`). Un choix explicite (pack, Skill ou espace) reste refusé, avec un message utile.
// Rien ne change quand le Skill est utilisable. Faux agents du dépôt, registre de test, aucun modèle,
// aucun réseau, aucun CLI réel (la détection des agents pointe vers des chemins absents). FICTIF.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'sans-skill-agents-FICTIF-')));
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

const { createApp } = await import(pathToFileURL(resolve('apps/api/server.js')).href);
const { CareerWorkspace } = await import(
  pathToFileURL(resolve('packages/career-ops/workspace.js')).href
);
const { reviewCareer } = await import(
  pathToFileURL(resolve('packages/career-ops/integration.js')).href
);
const { getPack } = await import(pathToFileURL(resolve('packages/orchestrator/packs.js')).href);
const { terminal } = await import(pathToFileURL(resolve('packages/storage/index.js')).href);

const CHEF = resolve('tests/fixtures/chef-agent.js');
// Le prompt du propriétaire, mot pour mot.
const PROMPT =
  'Rechercher et classer des offres Python et SQL en Australie (démonstration fictive)';
const USEFUL =
  /Importez-le et approuvez-le dans le menu Skills, ou lancez la mission sans Skill\.$/;
const AGENT_NAMES = /claude|codex|gemini|opencode/i;

const waitUntil = async (check, ms = 15000, what = '') => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('Attente dépassée ' + what);
};

// Une plateforme FICTIVE : espace career-ops temporaire (le routeur FICTIF peut y être importé), le
// Skill dans l'état demandé, le faux agent chef-agent.js qui journalise chaque prompt reçu.
async function platform(t, { ownerMode = true, skill = 'absent' } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'sans-skill-FICTIF-')));
  const logs = join(root, 'logs');
  mkdirSync(logs);
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode });
  app.engine.startRelay = () => {}; // jamais de relais réel
  const source = join(root, '.agents/skills/career-ops');
  if (skill === 'quarantaine') app.skills.importLocal(source);
  if (skill === 'non revu') {
    const imported = app.skills.importLocal(source);
    app.skills.review(imported.name, { approved: false, hash: imported.hash });
  }
  if (['actif', 'désactivé', 'modifié'].includes(skill)) reviewCareer(career, app.skills);
  if (skill === 'désactivé') app.skills.activate('career-ops', false);
  if (skill === 'modifié') {
    const record = app.skills.store.skill('career-ops');
    writeFileSync(
      join(root, 'platform', 'skills', 'career-ops', record.hash, 'SKILL.md'),
      '---\nname: career-ops\ndescription: Routeur de test FICTIF modifié\nlicense: MIT\n---\n# FICTIF modifié\n',
    );
  }
  // Toute ouverture de l'espace privé après la préparation du Skill.
  const opened = [];
  const path = career.path.bind(career);
  career.path = (...args) => {
    opened.push(new Error().stack);
    return path(...args);
  };
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (input, options) => {
    const plan = await originalPlan(input, options);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [CHEF],
      fixedEnv: { ...plan.agent.fixedEnv, CHEF_AGENT: JSON.stringify({ dir: logs }) },
    };
    return plan;
  };
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  // Le plan tel que le moteur le rend, sans la substitution du faux agent.
  const rawPlan = (input) => originalPlan(input);
  const prompts = () =>
    readdirSync(logs)
      .filter((name) => name.startsWith('prompt-'))
      .map((name) => readFileSync(join(logs, name), 'utf8'));
  const ended = (id) =>
    waitUntil(() => terminal.has(app.store.get(id)?.state), 15000, `fin de ${id}`).then(() =>
      waitUntil(() => !app.engine.active.has(id), 15000, `sortie de ${id}`),
    );
  return { root, career, app, opened, rawPlan, prompts, ended };
}
const request = (extra = {}) => ({
  prompt: PROMPT,
  agent: 'fixture',
  browser: 'fixture',
  ...extra,
});
const assertNote = (note) => {
  assert.equal(note?.pack, 'career-ops');
  assert.match(note.text, /^Pack reconnu : [^.]*career-ops\. /);
  assert.match(note.text, /n’est pas installé ou pas approuvé sur cette base/);
  assert.match(note.text, /importez-le et approuvez-le dans le menu Skills/);
  assert.doesNotMatch(note.text, AGENT_NAMES);
};

test('1. cas réel FICTIF : base sans le Skill, pack auto, aucun Skill → mission créée par le chemin général, note gardée, espace privé fermé, aucun Skill chargé', async (t) => {
  const p = await platform(t);
  // La détection rattache bien ce prompt au pack career-ops (le défaut constaté).
  assert.equal(getPack('auto', PROMPT, []).id, 'career-ops');
  const plan = await p.rawPlan(request());
  assert.equal(plan.pack.id, 'core');
  assert.equal(plan.browserWorkflow, true);
  assert.equal(plan.workflow.id, 'browser-agent');
  assert.equal(plan.input.workspace, undefined);
  assert.deepEqual(plan.skills, []);
  assertNote(plan.input.packNote);
  const run = await p.app.engine.create(request());
  assert.equal(run.pack, 'core');
  assert.equal(run.workflow, 'browser-agent');
  assert.equal(run.workspace, undefined);
  assert.notEqual(run.cwd, p.root);
  assert.deepEqual(run.skillsSnapshot, []);
  assertNote(run.packNote);
  await p.ended(run.id);
  const row = p.app.store.get(run.id);
  assert.equal(row.state, 'completed', row.error ?? '');
  assertNote(row.packNote);
  assert.equal(p.opened.length, 0, 'l’espace privé ne doit pas être ouvert');
  // La note n'est pas une consigne : l'agent ne la reçoit pas.
  const sent = p.prompts();
  assert.ok(sent.length >= 1);
  for (const text of sent) {
    assert.doesNotMatch(text, /Pack reconnu/);
    assert.doesNotMatch(text, /menu Skills/);
  }
});

for (const skill of ['quarantaine', 'non revu', 'désactivé', 'modifié'])
  test(`2. Skill ${skill} FICTIF : même issue que sans le Skill`, async (t) => {
    const p = await platform(t, { skill });
    assert.equal(p.app.skills.serves('career-ops'), false);
    const run = await p.app.engine.create(request());
    assert.equal(run.pack, 'core');
    assert.equal(run.workflow, 'browser-agent');
    assert.equal(run.workspace, undefined);
    assert.deepEqual(run.skillsSnapshot, []);
    assertNote(run.packNote);
    await p.ended(run.id);
    assert.equal(p.app.store.get(run.id).state, 'completed');
    assert.equal(p.opened.length, 0);
  });

test('3. hors mode propriétaire FICTIF : candidat suivant de la détection, mission créée', async (t) => {
  const p = await platform(t, { ownerMode: false });
  const next = getPack('auto', PROMPT, [], { exclude: ['career-ops'] });
  assert.notEqual(next.id, 'career-ops');
  const plan = await p.rawPlan(request());
  assert.equal(plan.pack.id, next.id);
  assert.equal(plan.input.pack, next.id);
  assert.equal(plan.input.workspace, undefined);
  assertNote(plan.input.packNote);
  const run = await p.app.engine.create(request());
  assert.equal(run.pack, next.id);
  assertNote(run.packNote);
  await p.ended(run.id);
  // Le faux agent ne rend pas un résultat que le vérificateur de ce pack accepte : seule compte ici
  // une mission partie, sans refus lié au Skill.
  assert.ok(p.prompts().length >= 1);
  assert.doesNotMatch(p.app.store.get(run.id).error ?? '', /Skill/);
  assert.equal(p.opened.length, 0);
});

for (const ownerMode of [true, false])
  test(`4. Skill actif et revu FICTIF (${ownerMode ? 'mode propriétaire' : 'hors mode propriétaire'}) : pack, espace et plan identiques au choix explicite, sans note`, async (t) => {
    const p = await platform(t, { ownerMode, skill: 'actif' });
    assert.equal(p.app.skills.serves('career-ops'), true);
    const auto = await p.rawPlan(request());
    const explicit = await p.rawPlan(request({ pack: 'career-ops' }));
    assert.equal(auto.pack.id, 'career-ops');
    assert.equal(auto.input.workspace, 'career-ops');
    assert.equal('packNote' in auto.input, false);
    assert.deepEqual(
      auto.skills.map((s) => s.id),
      ['career-ops'],
    );
    // Le choix explicite suit le chemin inchangé de la base : le plan automatique lui est identique.
    assert.equal(JSON.stringify(auto), JSON.stringify(explicit));
  });

for (const skill of ['absent', 'quarantaine'])
  test(`5. choix explicite FICTIF, Skill ${skill} : refus avec le message utile`, async (t) => {
    const p = await platform(t, { skill });
    const start =
      skill === 'absent'
        ? /^Skill inconnu : career-ops\. /
        : /^Skill désactivé, non revu ou modifié : career-ops\. /;
    for (const extra of [
      { pack: 'career-ops' },
      { skills: ['career-ops'] },
      { workspace: 'career-ops' },
    ]) {
      await assert.rejects(p.rawPlan(request(extra)), (error) => {
        assert.match(error.message, start);
        assert.match(error.message, USEFUL);
        return true;
      });
      await assert.rejects(p.app.engine.create(request(extra)), (error) =>
        start.test(error.message),
      );
    }
    assert.equal(p.app.store.list().length, 0);
  });

test('6. prompt sans rapport FICTIF : rien ne change, pas de note', async (t) => {
  const p = await platform(t);
  const other = { prompt: 'Résume ce texte FICTIF.' };
  const before = await p.rawPlan(request(other));
  assert.equal(before.pack.id, 'core');
  assert.equal('packNote' in before.input, false);
  reviewCareer(p.career, p.app.skills);
  const after = await p.rawPlan(request(other));
  assert.equal(JSON.stringify(before), JSON.stringify(after));
  const q = await platform(t, { ownerMode: false });
  const plan = await q.rawPlan(request(other));
  assert.equal(plan.pack.id, getPack('auto', other.prompt, []).id);
  assert.equal('packNote' in plan.input, false);
});

test('7. Équipe d’agents FICTIF, Skill indisponible, pack auto : la mission part, chef sur le chemin général', async (t) => {
  const p = await platform(t);
  const plan = await p.rawPlan(request({ multiAgent: true }));
  assert.equal(plan.pack.id, 'core');
  assert.equal(plan.workflow.id, 'browser-agent');
  assert.equal(plan.input.multiAgent, true);
  assertNote(plan.input.packNote);
  const run = await p.app.engine.create(
    request({ multiAgent: true, delegation: { accepted: true, via: 'bouton' } }),
  );
  assert.equal(run.pack, 'core');
  assert.equal(run.multiAgent, true);
  assert.equal(run.workspace, undefined);
  assertNote(run.packNote);
  await p.ended(run.id);
  assert.equal(p.app.store.get(run.id).state, 'completed');
  assert.equal(p.opened.length, 0);
});

test('8. contrôle FICTIF : jamais de note quand le Skill est utilisable ni quand le pack est choisi explicitement', async (t) => {
  const p = await platform(t, { skill: 'actif' });
  const run = await p.app.engine.create(request());
  assert.equal(run.pack, 'career-ops');
  assert.equal('packNote' in run, false);
  assert.equal('packNote' in p.app.store.get(run.id), false);
  p.app.engine.cancel(run.id);
  await p.ended(run.id);
  const q = await platform(t);
  for (const pack of ['core', 'najah']) {
    const plan = await q.rawPlan(request({ pack }));
    assert.equal(plan.pack.id, pack);
    assert.equal('packNote' in plan.input, false);
  }
  const explicit = await q.app.engine.create(request({ pack: 'core' }));
  assert.equal('packNote' in explicit, false);
  await q.ended(explicit.id);
  assert.equal('packNote' in q.app.store.get(explicit.id), false);
});
