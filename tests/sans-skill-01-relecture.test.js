// sans-skill-01, relecture indépendante : cas que les tests du codeur ne tenaient pas. La note du pack
// écarté visible du propriétaire (lignes de la plateforme du Bilan, lecture de la mission par l'API),
// un Skill choisi qui reste un choix explicite, un registre sans `serves`, `exclude` qui écarte tout,
// le message du refus (identifiant nommé, identifiant mal formé jamais recopié, Skill intégré) et la
// note juste pour chaque état du Skill. Faux agents du dépôt, registre réel, aucun modèle, aucun
// réseau hors 127.0.0.1, aucun CLI réel. FICTIF.
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

const AGENTS_CONFIG_DIR = realpathSync(
  mkdtempSync(join(tmpdir(), 'sans-skill-rel-agents-FICTIF-')),
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
test.after(() => rmSync(AGENTS_CONFIG_DIR, { recursive: true, force: true }));

const { createApp } = await import(pathToFileURL(resolve('apps/api/server.js')).href);
const { CareerWorkspace } = await import(
  pathToFileURL(resolve('packages/career-ops/workspace.js')).href
);
const { reviewCareer } = await import(
  pathToFileURL(resolve('packages/career-ops/integration.js')).href
);
const { getPack, packs } = await import(
  pathToFileURL(resolve('packages/orchestrator/packs.js')).href
);
const { terminal } = await import(pathToFileURL(resolve('packages/storage/index.js')).href);

const CHEF = resolve('tests/fixtures/chef-agent.js');
const PROMPT =
  'Rechercher et classer des offres Python et SQL en Australie (démonstration fictive)';
const ADVICE = 'Importez-le et approuvez-le dans le menu Skills, ou lancez la mission sans Skill.';

const waitUntil = async (check, ms = 15000, what = '') => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('Attente dépassée ' + what);
};

async function platform(t, { ownerMode = true, skill = 'absent' } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'sans-skill-rel-FICTIF-')));
  const logs = join(root, 'logs');
  mkdirSync(logs);
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode });
  app.engine.startRelay = () => {};
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
const refusal = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error.message;
  }
  assert.fail('refus attendu');
};

test('R1. la note du pack écarté est une ligne de la plateforme du Bilan (jamais la réponse) et la lecture de la mission par l’API la rend', async (t) => {
  const p = await platform(t);
  const run = await p.app.engine.create(request());
  await p.ended(run.id);
  const row = p.app.store.get(run.id);
  assert.equal(row.state, 'completed', row.error ?? '');
  const text = row.packNote.text;
  assert.ok(row.result.platformNotes.includes(text), JSON.stringify(row.result.platformNotes));
  assert.ok(!row.result.answer.includes('Pack reconnu'));
  assert.ok(row.result.summary.includes(text));
  // Une seule fois.
  assert.equal(row.result.summary.split(text).length, 2);
  for (const sent of p.prompts()) assert.doesNotMatch(sent, /Pack reconnu/);
  await new Promise((r) => p.app.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${p.app.server.address().port}`;
  const read = await fetch(`${base}/api/runs/${run.id}`, {
    headers: { 'x-platform-request': '1' },
  });
  assert.equal(read.status, 200);
  const body = await read.json();
  assert.deepEqual(body.packNote, row.packNote);
  assert.ok(body.result.platformNotes.includes(text));
});

test('R1 bis. sans note, aucune ligne de note dans le Bilan', async (t) => {
  const p = await platform(t);
  const run = await p.app.engine.create(request({ pack: 'core' }));
  await p.ended(run.id);
  const row = p.app.store.get(run.id);
  assert.equal('packNote' in row, false);
  assert.ok(!row.result.summary.includes('Pack reconnu'));
  assert.ok(!row.result.platformNotes.some((line) => line.includes('Pack reconnu')));
});

test('R2. un Skill tiers choisi et servi, prompt rattaché au pack dont le Skill manque : refus de la base, pas de note', async (t) => {
  const p = await platform(t);
  const dir = join(p.root, 'tiers');
  mkdirSync(dir);
  writeFileSync(
    join(dir, 'SKILL.md'),
    '---\nname: tiers-fictif\ndescription: Skill tiers FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const imported = p.app.skills.importLocal(dir);
  p.app.skills.review(imported.name, { approved: true, hash: imported.hash });
  p.app.skills.install(imported.name);
  assert.equal(p.app.skills.serves(imported.name), true);
  const message = await refusal(p.rawPlan(request({ skills: [imported.name] })));
  assert.equal(message, 'L’espace privé charge uniquement le Skill career-ops revu');
  assert.equal(p.opened.length, 0);
});

test('R3. un registre sans `serves` garde la conduite de la base (refus brut)', async (t) => {
  const p = await platform(t);
  p.app.engine.skills.serves = undefined;
  const message = await refusal(p.rawPlan(request()));
  assert.equal(message, 'Skill inconnu');
});

test('R4. `exclude` qui écarte tous les packs : aucun pack exclu rendu', () => {
  assert.throws(
    () => getPack('auto', PROMPT, [], { exclude: packs.map((pack) => pack.id) }),
    /Domain Pack inconnu/,
  );
  // Sans option, la détection reste celle de la base.
  assert.equal(getPack('auto', '', []).id, packs[0].id);
});

test('R5. le refus nomme le Skill même quand son identifiant est un mot du message', async (t) => {
  const p = await platform(t);
  for (const id of ['inconnu', 'skill', 'k']) {
    const message = await refusal(p.rawPlan(request({ prompt: 'Résume ce texte', skills: [id] })));
    assert.equal(message, `Skill inconnu : ${id}. ${ADVICE}`);
  }
});

test('R6. un identifiant vide ou mal formé n’est jamais recopié ; le message reste borné et utile', async (t) => {
  const p = await platform(t);
  for (const skills of [
    [''],
    ['', 'autre'],
    ['abc\nSkill inconnu\nfoo'],
    ['z'.repeat(5000)],
    ['../../etc'],
  ]) {
    const message = await refusal(p.rawPlan(request({ prompt: 'Résume ce texte', skills })));
    assert.equal(message, `Skill inconnu. ${ADVICE}`, JSON.stringify(skills));
  }
});

test('R7. un Skill intégré non installé : la marche à suivre est de l’installer, pas de l’importer', async (t) => {
  const p = await platform(t);
  const bundled = p.app.skills.definitions.find((def) => !p.app.skills.serves(def.id));
  assert.ok(bundled, 'un Skill intégré non installé');
  const message = await refusal(
    p.rawPlan(request({ prompt: 'Résume ce texte', skills: [bundled.id] })),
  );
  assert.equal(
    message,
    `Skill désactivé ou modifié : ${bundled.id}. Installez-le ou réactivez-le dans le menu Skills, ou lancez la mission sans Skill.`,
  );
});

for (const skill of ['quarantaine', 'non revu', 'désactivé', 'modifié'])
  test(`R8. Skill ${skill} (registre réel) : chemin général, note juste pour cet état, refus explicite utile`, async (t) => {
    const p = await platform(t, { skill });
    assert.equal(p.app.skills.serves('career-ops'), false);
    const plan = await p.rawPlan(request());
    assert.equal(plan.pack.id, 'core');
    assert.equal(plan.workflow.id, 'browser-agent');
    assert.deepEqual(plan.skills, []);
    assert.equal(plan.input.workspace, undefined);
    assert.match(plan.input.packNote.text, /désactivé ou modifié/);
    assert.match(plan.input.packNote.text, /réactivez-le s’il est désactivé\.$/);
    assert.equal(p.opened.length, 0);
    // Le choix explicite ouvre l'espace avant de refuser, comme à la base.
    const message = await refusal(p.rawPlan(request({ pack: 'career-ops' })));
    assert.equal(
      message,
      `Skill désactivé, non revu ou modifié : career-ops. Réactivez-le s’il est désactivé. ${ADVICE}`,
    );
  });

test('R9. Skill servi, pack choisi, prompt sans rapport : aucun pack écarté, espace du pack choisi, pas de note', async (t) => {
  const p = await platform(t, { skill: 'actif' });
  const plan = await p.rawPlan(request({ pack: 'career-ops', prompt: 'Résume ce texte FICTIF.' }));
  assert.equal(plan.pack.id, 'career-ops');
  assert.equal(plan.input.workspace, 'career-ops');
  assert.equal('packNote' in plan.input, false);
});
