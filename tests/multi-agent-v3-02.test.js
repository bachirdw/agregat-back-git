// multi-agent-v3-02 (A) : `mission_attendre` avec `toutes=true` rend aussi la main dès qu'une des
// sous-missions en cours au début de l'appel finit sans succès ; un second appel n'en revient pas
// aussitôt (pas de boucle serrée). Faux agent ACP (tests/fixtures/chef-agent.js), pack `core`.
// Aucun modèle, aucun navigateur, aucun CLI réel. FICTIF.
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
import { isAbsolute, join, resolve } from 'node:path';

// No real CLI is ever run by the detection of agents (`--version`) : every path is absent.
const AGENTS_CONFIG_DIR = realpathSync(mkdtempSync(join(tmpdir(), 'mav3-02-agents-FICTIF-')));
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

const CHEF = resolve('tests/fixtures/chef-agent.js');
const ACCEPTED = (envelope = {}) => ({ accepted: true, via: 'api', ...envelope });

async function platform(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'mav3-02-FICTIF-')));
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
  return {
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

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const waits = (p) => p.results().filter((r) => r.call === 'mission_attendre');

async function family(p, consigneA) {
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: consigneA, titre: 'A' } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE B ATTENDRE:b', titre: 'B' } },
      { touch: join(p.hold, 'launched') },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Deux tâches FICTIVES en parallèle.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED({ parallel: 2 }),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')), 15000, 'lancement');
  const [a, b] = p.results().map((r) => r.result.id);
  await p.waitFor(
    () => [a, b].every((id) => p.app.store.get(id)?.state === 'running'),
    15000,
    'A et B en cours',
  );
  // The chief is inside its first wait.
  await sleep(500);
  assert.equal(waits(p).length, 0);
  return { mother, a, b };
}

test('A. toutes=true : une sous-mission qui échoue tôt rend la main avant le délai ; le second appel attend la suivante', async (t) => {
  const p = await platform(t);
  const { mother, a, b } = await family(p, 'Tâche FICTIVE A ATTENDRE:a ECHEC');
  const touched = Date.now();
  p.touch('a');
  await p.waitFor(() => waits(p).length >= 1, 15000, 'retour du premier appel');
  assert.ok(Date.now() - touched < 10000, 'rendu bien avant les 30 s du délai');
  const [first] = waits(p);
  assert.equal(first.isError, false);
  assert.equal(first.result.delaiAtteint, false);
  assert.deepEqual(
    first.result.terminees.map((x) => [x.id, x.etat]),
    [[a, 'failed']],
  );
  assert.deepEqual(
    first.result.enCours.map((x) => x.id),
    [b],
  );
  // (3) The second call does not come back at once because of the failure already given.
  await sleep(1500);
  assert.equal(waits(p).length, 1, 'le second appel attend B');
  p.touch('b');
  await p.waitFor(() => waits(p).length === 2, 15000, 'retour du second appel');
  const second = waits(p)[1].result;
  assert.equal(second.delaiAtteint, false);
  assert.deepEqual(
    second.terminees.map((x) => [x.id, x.etat]).sort(),
    [
      [a, 'failed'],
      [b, 'completed'],
    ].sort(),
  );
  assert.deepEqual(second.enCours, []);
  await p.ended(mother.id, 30000);
});

test('A. contrôle : toutes=true, les deux réussissent : la main n’est rendue qu’à la fin des deux', async (t) => {
  const p = await platform(t);
  const { mother, a, b } = await family(p, 'Tâche FICTIVE A ATTENDRE:a');
  p.touch('a');
  await p.waitFor(() => p.app.store.get(a).state === 'completed', 15000, 'fin de A');
  await sleep(1500);
  assert.equal(waits(p).length, 0, 'A finie avec succès : l’appel attend encore B');
  p.touch('b');
  await p.waitFor(() => waits(p).length >= 1, 15000, 'retour du premier appel');
  const [first] = waits(p);
  assert.equal(first.result.delaiAtteint, false);
  assert.deepEqual(
    first.result.terminees.map((x) => [x.id, x.etat]).sort(),
    [
      [a, 'completed'],
      [b, 'completed'],
    ].sort(),
  );
  assert.deepEqual(first.result.enCours, []);
  await p.ended(mother.id, 30000);
});

// multi-agent-v3-02 (D) : (1) et (2) — complet puis ligne courte, mission_suivre details toujours
// complet — sont dans tests/chef-01.test.js (« délai atteint… ») et tests/delegation-v2-01-a.test.js.
test('D. chef qui ne lit jamais : une sous-mission finie avant la fin de son tour est jointe au tour de synthèse avec celle encore en cours', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE A', titre: 'A' } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE B ATTENDRE:b', titre: 'B' } },
      { touch: join(p.hold, 'launched') },
      { waitFile: join(p.hold, 'a-finie') },
    ],
    reminderSteps: [],
    summary: 'Réponse FICTIVE sans lecture des résultats.',
    reminderSummary: 'Synthèse FICTIVE avec A et B.',
  }));
  const mother = await p.app.engine.create({
    prompt: 'Deux tâches FICTIVES jamais lues.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')), 15000, 'lancement');
  const [a, b] = p.results().map((r) => r.result.id);
  await p.ended(a);
  assert.equal(p.app.store.get(a).state, 'completed');
  p.touch('a-finie');
  await p.waitFor(() => p.types(mother.id).includes('family_waiting'), 15000, 'attente de B');
  p.touch('b');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal(row.result.answer, 'Synthèse FICTIVE avec A et B.');
  const synthesis = p.prompts().find((e) => e.prompt?.platform?.turnKind === 'family_results');
  assert.ok(synthesis, 'tour de synthèse');
  assert.deepEqual(
    synthesis.prompt.familyResults.terminees.map((r) => [r.id, r.etat]).sort(),
    [
      [a, 'completed'],
      [b, 'completed'],
    ].sort(),
  );
  assert.doesNotMatch(row.result.summary, /Synthèse finale non faite/);
});

// multi-agent-v3-02 (K) : `espace`, chemin absolu du dossier de travail auquel dossierResultats et
// fichiers[].chemin sont relatifs, à la racine des trois résultats ; absent sans dossier de résultats.
async function spaceRun(t, { noFolder = false } = {}) {
  const p = await platform(t);
  if (noFolder) p.app.engine.delegation.resultsFolder = () => null;
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE DEPOSER:fiche.json', titre: 'A' },
      },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      { call: 'mission_suivre', args: {} },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Une tâche FICTIVE avec un fichier.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  assert.equal(p.app.store.get(mother.id).state, 'completed', p.app.store.get(mother.id).error);
  const [launched, waited, followed] = p.results().map((r) => r.result);
  return { p, mother, launched, waited, followed };
}

test('K. espace absolu dans mission_lancer, mission_attendre et mission_suivre ; le fichier rendu existe sous espace', async (t) => {
  const { p, mother, launched, waited, followed } = await spaceRun(t);
  const cwd = p.app.store.get(mother.id).cwd;
  for (const result of [launched, waited, followed]) {
    assert.ok(isAbsolute(result.espace), JSON.stringify(result));
    assert.equal(result.espace, resolve(cwd));
  }
  assert.ok(existsSync(join(launched.espace, launched.dossierResultats)));
  const [done] = waited.terminees;
  assert.ok(done.fichiers.length >= 1, JSON.stringify(done.fichiers));
  assert.match(done.fichiers[0].chemin, /fiche\.json$/);
  assert.ok(existsSync(join(waited.espace, done.fichiers[0].chemin)));
});

test('K. contrôle : sans dossier de résultats, aucun champ espace', async (t) => {
  const { launched, waited, followed } = await spaceRun(t, { noFolder: true });
  assert.equal(launched.dossierResultats, undefined);
  for (const result of [launched, waited, followed])
    assert.ok(!Object.hasOwn(result, 'espace'), JSON.stringify(result));
});
