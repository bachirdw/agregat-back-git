// chef-01 : mode workflow, premier pas (conception du 18/11, sprint 1). Un agent chef reçoit les
// outils de mission (serveur MCP `relay-missions`) ; delegation-v2-01 (plan v2) : prêtés à toute
// mission menée par un agent, l'accord du propriétaire (`delegation` de POST /api/runs, demande dans
// le prompt ou carte) étant demandé au premier lancement ; ses sous-missions sont des missions
// ordinaires. Faux agent ACP
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

// delegation-v2-01 (plan v2, 8.2, `:138` adapté) : the tools and the chief's sentence are lent to
// every mission led by an agent ; nothing else changes while nothing is launched. multi-agent-v3-01
// (D1) : only with `multiAgent: true`. Without it, or with the withdrawal setting
// (AGENT_PLATFORM_DELEGATION=0), the prompt of the base : tests/delegation-v2-01-b.test.js.
test('sans delegation : outils et phrase prêtés, rien d’autre ne change tant que rien n’est lancé', async (t) => {
  const p = await platform(t);
  // The chief calls no tool (its steps : none).
  p.setConfig(() => ({ steps: [] }));
  const plain = await p.app.engine.create({
    prompt: 'Résume ce texte FICTIF.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
  });
  await p.ended(plain.id);
  const row = p.app.store.get(plain.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal('delegation' in row, false);
  assert.equal('famille' in row, false);
  assert.equal('estMere' in row, false);
  const [entry] = p.prompts();
  assert.deepEqual(entry.servers, ['platform', rule.MISSION_SERVER]);
  assert.deepEqual(Object.keys(entry.prompt), [
    'objective',
    'attachments',
    'skills',
    'browserWorkflow',
    'ownerMode',
    'workflow',
    'instructions',
  ]);
  assert.ok(entry.prompt.instructions.endsWith('\n' + rule.chiefRule(undefined)));
  const instructions = entry.prompt.instructions.slice(
    0,
    -('\n' + rule.chiefRule(undefined)).length,
  );
  assert.doesNotMatch(instructions, /Mode workflow|sous-mission/);
  assert.ok(!p.types(plain.id).some((type) => /^(delegation|child|family)_/.test(type)));
  const view = await p.api(`/api/runs/${plain.id}`);
  assert.equal('family' in view.body, false);
  assert.doesNotMatch(row.result.summary, /Sous-missions|Sous-agents/);
  // Another mission's token does not open its mission tools.
  const refused = await p.api(
    `/api/internal/missions/${plain.id}`,
    { tool: 'mission_suivre', args: {} },
    { 'x-relay-token': 'jeton-FICTIF' },
  );
  assert.equal(refused.status, 403);

  // The owner's refusal or acceptance given with the request : the same instructions, only the end
  // of the chief's sentence differs ; nothing is written while nothing is launched.
  const declined = await p.app.engine.create({
    prompt: 'Résume ce texte FICTIF.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: { accepted: false, via: 'carte' },
  });
  await p.ended(declined.id);
  const chief = await p.app.engine.create({
    prompt: 'Résume ce texte FICTIF.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.ended(chief.id);
  const sent = p.prompts();
  assert.equal(sent.length, 3);
  for (const [id, delegation] of [
    [declined.id, { accepted: false }],
    [chief.id, ACCEPTED()],
  ]) {
    assert.ok(!p.types(id).some((type) => /^(delegation|child|family)_/.test(type)), id);
    const own = sent.filter(
      (e) => e.prompt.instructions === instructions + '\n' + rule.chiefRule(delegation),
    );
    assert.equal(own.length, 1, id);
    assert.deepEqual(own[0].servers, ['platform', rule.MISSION_SERVER]);
  }
  assert.deepEqual(
    p.tools().map((tool) => tool.name),
    // equipe-01 (E2) : mission_continuer added.
    // equipe-carnet : the team notebook's two tools are lent with the mission tools.
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
    multiAgent: true,
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
  // multi-agent-v3-01 (D4) : tasks and resumptions apart.
  assert.deepEqual(launchB.result.famille, {
    lancees: 2,
    taches: 2,
    reprises: 0,
    dansEnveloppe: 2,
    enCours: 2,
    total: 6,
    parallel: 3,
  });
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
    // delegation-v2-01 : the counters, uncertain ones included, and the send line of its Bilan.
    assert.deepEqual(done.envois, {
      approuves: 0,
      parAccord: 0,
      refuses: 0,
      incertains: 0,
      ligne: null,
    });
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
      // delegation-v2-01 : one level, no depth ; multi-agent-v3-01 (D9) : the results folder.
      [
        launchA.result.id,
        'completed',
        {
          racine: mother.id,
          mere: mother.id,
          titre: 'Rapport A',
          dossierResultats: `relay/missions/${mother.id.slice(0, 8)}/1-rapport-a/`,
        },
      ],
      [
        launchB.result.id,
        'completed',
        {
          racine: mother.id,
          mere: mother.id,
          titre: 'Résume le rapport FICTIF B.',
          dossierResultats: `relay/missions/${mother.id.slice(0, 8)}/2-resume-le-rapport-fictif-b/`,
        },
      ],
    ],
  );
  // The sub-missions work in the mother's folder, have no mission tool and receive the family.
  for (const child of children) assert.equal(child.cwd, row.cwd);
  const daughters = daughterPrompts(p);
  assert.equal(daughters.length, 2);
  for (const entry of daughters) {
    // equipe-carnet : the notebook server only (no mission tool).
    assert.deepEqual(entry.servers, ['platform', rule.CARNET_SERVER]);
    assert.equal(
      entry.prompt.famille.demandeDuProprietaire,
      'Compare deux rapports FICTIFS avec des sous-missions.',
    );
    assert.equal(entry.prompt.famille.mere, mother.id);
    // multi-agent-v3-01 (D9) : the sub-mission's sentence names its results folder.
    assert.ok(entry.prompt.famille.dossierResultats);
    assert.ok(
      entry.prompt.instructions.endsWith(
        '\n' + rule.daughterRule(entry.prompt.famille.dossierResultats),
      ),
    );
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
    multiAgent: true,
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
  // delegation-v2-01 : the sub-missions hold none of the three slots ; only the mother counts.
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
  // The first one is still listed (as a short line since multi-agent-v3-02, D).
  assert.equal(last.terminees.length, 3);
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
      { call: 'mission_suivre', args: { id: '$A', details: true } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Une tâche FICTIVE lente.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  const [launch, timedOut, waited, followed, again, followedAgain] = p.results();
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
  // multi-agent-v3-02 (D) : once given, a wait gives a short line ; mission_suivre with details
  // still reads the full result, as many times as wanted.
  assert.deepEqual(again.result.terminees, [
    { id: done.id, titre: done.titre, etat: 'completed', dejaRemise: true },
  ]);
  assert.equal(again.result.delaiAtteint, false);
  const reread = followedAgain.result.missions[0];
  for (const key of ['reponse', 'bilan', 'etat', 'fichiers', 'envois', 'cause'])
    assert.deepEqual(reread[key], done[key], key);
});

// Simulated clock of the engine's guards : a delay elapses only when the test moves it.
function fakeTimers() {
  let now = 0;
  let seq = 0;
  const due = new Map();
  return {
    setTimeout(fn, ms) {
      const id = ++seq;
      due.set(id, { at: now + Math.max(0, Number(ms) || 0), fn });
      return id;
    },
    clearTimeout(id) {
      due.delete(id);
    },
    tick(ms) {
      const until = now + ms;
      for (;;) {
        const next = [...due.entries()]
          .filter(([, timer]) => timer.at <= until)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        due.delete(next[0]);
        next[1].fn();
      }
      now = until;
    },
  };
}

test('minuteurs du chef en pause pendant mission_attendre (horloge simulée)', async (t) => {
  const p = await platform(t);
  const timers = fakeTimers();
  p.app.engine.timers = timers;
  p.app.engine.silentMs = 1000;
  p.app.engine.toolIdleMs = 2000;
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE BATTEMENT ATTENDRE:a' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 120 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Une tâche FICTIVE attendue par le chef.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  const control = p.app.engine.active.get(mother.id);
  await p.waitFor(() => p.app.engine.delegation.families.get(mother.id)?.waiting === 1);
  // 4 s simulées : bien au-delà du silence (1 s) et de la garde d'outil (2 s) du chef. La
  // sous-mission montre qu'elle travaille (une pensée toutes les 30 ms) et garde sa mission.
  for (let i = 0; i < 8; i++) {
    timers.tick(500);
    await new Promise((r) => setTimeout(r, 120));
  }
  assert.equal(control.abort.signal.aborted, false, String(control.abort.signal.reason));
  assert.equal(p.app.store.get(mother.id).state, 'running');
  const stopped = p.app.store
    .events(mother.id)
    .filter(
      (e) => e.type === 'tool_stalled' || (e.type === 'agent_silent' && e.data.stopped === true),
    );
  assert.deepEqual(stopped, []);
  p.touch('a');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal(p.results()[1].result.terminees[0].etat, 'completed');
});

test('enveloppe atteinte : erreur au chef, question au propriétaire, puis l’appel suivant passe', async (t) => {
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
    delegation: ACCEPTED({ total: 1, parallel: 1 }),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'refused')));
  const refused = p.results()[1];
  assert.equal(refused.isError, true);
  assert.equal(refused.result.erreur, 'enveloppe_atteinte');
  const asked = await p.waitFor(() => p.app.store.get(mother.id).pendingQuestion);
  assert.equal(
    asked.message,
    'Le chef veut lancer une 2e sous-mission ; l’enveloppe acceptée est de 1. En autoriser 5 de plus ?',
  );
  // delegation-v2-01 : a choice, no free text read for « oui ».
  assert.equal(asked.kind, 'form');
  assert.deepEqual(asked.requestedSchema.properties.choix.oneOf, [...rule.EXTENSION_CHOICES]);
  p.app.engine.answer(mother.id, { action: 'accept', content: { choix: 'oui' } });
  p.touch('answered');
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal(row.delegation.total, 6);
  assert.equal(row.delegation.extensions.length, 1);
  assert.equal(p.results()[2].isError, false, JSON.stringify(p.results()[2].result));
  assert.equal(p.app.store.children(mother.id).length, 2);
  const types = p.types(mother.id);
  assert.ok(types.includes('delegation_envelope_reached'));
  assert.ok(types.includes('delegation_extended'));
});

// delegation-v2-01 : the « boucle » refusal is withdrawn (plan v2, 8.3) : one level only, and a
// consigne identical to the mother's is launched (tests/delegation-v2-01-a.test.js).

test('famille career-ops : les sous-missions partagent l’espace privé, une mission étrangère reste refusée', async (t) => {
  const p = await platform(t, { career: true });
  p.setConfig((input) =>
    input.prompt === 'Mission étrangère FICTIVE.'
      ? {}
      : {
          steps: [
            {
              call: 'mission_lancer',
              args: { consigne: 'Lis le rapport FICTIF 001 ATTENDRE:a', titre: 'Rapport 001' },
            },
            { touch: join(p.hold, 'launched') },
            { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
          ],
        },
  );
  const mother = await p.app.engine.create({
    prompt: 'Résume mes rapports FICTIFS avec des sous-missions.',
    agent: 'fixture',
    pack: 'career-ops',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')));
  const [launch] = p.results();
  assert.equal(launch.isError, false, JSON.stringify(launch.result));
  // Non-owner mode : a private mission's sub-mission gets a neutral title.
  assert.equal(launch.result.titre, 'Sous-mission 1');
  await assert.rejects(
    p.app.engine.create({
      prompt: 'Mission étrangère FICTIVE.',
      agent: 'fixture',
      pack: 'career-ops',
    }),
    /Une seule mission privée à la fois dans cet espace/,
  );
  p.touch('a');
  await p.ended(mother.id, 30000);
  const child = p.app.store.get(launch.result.id);
  assert.ok(terminal.has(child.state));
  assert.doesNotMatch(String(child.error ?? ''), /Une seule mission privée/);
  assert.equal(child.cwd, p.app.store.get(mother.id).cwd);
  // The consigne stays in the private space, as a mission's prompt does.
  assert.equal(child.prompt, 'Mission privée dans l’espace de candidature');
  assert.equal(
    JSON.parse(readFileSync(join(child.cwd, `relay/runs/${child.id}-input.json`), 'utf8')).prompt,
    'Lis le rapport FICTIF 001 ATTENDRE:a',
  );
  const daughter = daughterPrompts(p)[0];
  assert.equal(
    daughter.prompt.famille.demandeDuProprietaire,
    'Résume mes rapports FICTIFS avec des sous-missions.',
  );
  // Once the family has ended (its executions released), the space is free again.
  await p.waitFor(
    () => !p.app.engine.active.has(mother.id) && !p.app.engine.active.has(child.id),
    15000,
  );
  const next = await p.app.engine.create({
    prompt: 'Mission étrangère FICTIVE.',
    agent: 'fixture',
    pack: 'career-ops',
  });
  await p.ended(next.id);
});

test('annulation en cascade : annuler la mère annule ses sous-missions, en cours et en file', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE 1 ATTENDRE:jamais' } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE 2 ATTENDRE:jamais' } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE 3 ATTENDRE:jamais' } },
      { touch: join(p.hold, 'launched') },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 600 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Trois tâches FICTIVES sans fin.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED({ parallel: 2 }),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')));
  const ids = p.results().map((r) => r.result.id);
  await p.waitFor(() => ids.slice(0, 2).every((id) => p.app.store.get(id).state === 'running'));
  assert.equal(p.app.store.get(ids[2]).state, 'queued');
  // Both running sub-missions' agents are in their turn.
  await p.waitFor(() => daughterPrompts(p).length === 2);
  const cancelled = await p.api(`/api/runs/${mother.id}/cancel`, {});
  assert.equal(cancelled.status, 200);
  await p.ended(mother.id);
  for (const id of ids) await p.ended(id);
  assert.equal(p.app.store.get(mother.id).state, 'cancelled');
  for (const id of ids) assert.equal(p.app.store.get(id).state, 'cancelled', id);
  assert.equal(p.app.store.get(ids[2]).error, 'Annulée avec la mission mère');
  // The queued one never started : no agent was launched for it.
  assert.deepEqual(
    p.app.store
      .events(ids[2])
      .filter((e) => e.type === 'state')
      .map((e) => e.data.state),
    ['queued', 'cancelled'],
  );
  assert.equal(daughterPrompts(p).length, 2);
});

test('mission_annuler : une sous-mission arrêtée par le chef, rendue « cancelled », sans erreur ensuite', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE inutile ATTENDRE:jamais' },
        save: 'A',
      },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE utile' }, save: 'B' },
      { call: 'mission_annuler', args: { id: '$A', raison: 'plus utile (FICTIF)' } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      { call: 'mission_annuler', args: { id: '$A' } },
      { call: 'mission_suivre', args: { id: '00000000-0000-4000-8000-000000000000' } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Deux tâches FICTIVES dont une annulée.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  const [launchA, , cancel, waited, again, unknown] = p.results();
  // delegation-v2-01 : one level, no « descendants » any more.
  assert.deepEqual(cancel.result, { id: launchA.result.id, etat: 'cancelled' });
  const doneA = waited.result.terminees.find((x) => x.id === launchA.result.id);
  assert.equal(doneA.etat, 'cancelled');
  assert.equal(doneA.cause.type, 'erreur');
  assert.match(doneA.cause.message, /Annulée par la mission mère : plus utile \(FICTIF\)/);
  assert.equal(again.isError, false);
  assert.equal(again.result.etat, 'cancelled');
  assert.equal(unknown.isError, true);
  assert.equal(unknown.result.erreur, 'introuvable');
  assert.equal(p.app.store.get(mother.id).state, 'completed');
});

test('redémarrage : toute la famille passe interrupted (mère, sous-mission en cours, sous-mission en file)', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE 1 ATTENDRE:jamais' } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE 2 ATTENDRE:jamais' } },
      { touch: join(p.hold, 'launched') },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 600 } },
    ],
  }));
  const mother = await p.app.engine.create({
    prompt: 'Deux tâches FICTIVES coupées par un arrêt.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED({ parallel: 1 }),
  });
  await p.waitFor(() => existsSync(join(p.hold, 'launched')));
  const ids = [mother.id, ...p.results().map((r) => r.result.id)];
  await p.waitFor(() => p.app.store.get(ids[1]).state === 'running');
  // The process dies : the next start reads the same database.
  const restarted = new Store(join(p.root, 'platform', 'platform.sqlite'));
  try {
    for (const id of ids) assert.equal(restarted.get(id).state, 'interrupted', id);
  } finally {
    restarted.close();
  }
});

test('Bilan de la mère : Bilans des sous-missions cités à l’identique, totaux et confrontation', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Note FICTIVE ECRIRE:notes/a.md', titre: 'Note A' },
      },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE ECHEC', titre: 'Échec B' } },
      { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE LIMITE', titre: 'Limite C' } },
      // multi-agent-v3-02 (A) : toutes=true also comes back as soon as one fails ; the chief
      // calls it again until all have ended (an extra call returns at once).
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
    ],
    summary: 'Tableau FICTIF. J’ai envoyé 3 e-mails.',
  }));
  const mother = await p.app.engine.create({
    prompt: 'Deux tâches FICTIVES et un tableau.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.ended(mother.id, 30000);
  const row = p.app.store.get(mother.id);
  assert.equal(row.state, 'completed', row.error);
  const summary = row.result.summary;
  const children = p.app.store.children(mother.id);
  assert.deepEqual(
    children.map((child) => child.state),
    ['completed', 'failed', 'failed'],
  );
  // multi-agent-v3-02 (D) : each full result is given once, by one of the waits.
  const given = p
    .results()
    .filter((r) => r.call === 'mission_attendre')
    .flatMap((r) => r.result.terminees)
    .filter((x) => !x.dejaRemise);
  assert.equal(given.length, 3);
  const failed = given.find((x) => x.titre === 'Échec B');
  assert.equal(failed.cause.type, 'erreur');
  // A provider's limit is said as such, with the time to retry, from the platform's own cause.
  const limited = given.find((x) => x.titre === 'Limite C');
  assert.equal(limited.cause.type, 'limite_usage');
  assert.equal(limited.cause.reprise, '22:00');
  assert.equal(limited.cause.agent, 'fixture');
  for (const child of children) {
    const bilan = p.app.engine.delegation.bilanOf(child);
    assert.ok(bilan.length > 0, child.id);
    // Quoted word for word, line by line.
    const quoted = bilan
      .split('\n')
      .map((line) => `> ${line}`.trimEnd())
      .join('\n');
    assert.ok(summary.includes(quoted), `Bilan de ${child.id} non cité à l’identique`);
  }
  assert.match(summary, /\nSous-missions \(3\) :\n1\. « Note A » — agent fixture, terminée, /);
  assert.match(summary, /\n2\. « Échec B » — agent fixture, en échec, /);
  assert.match(
    summary,
    /Totaux de la famille vus par la plateforme : 1 terminée\(s\), 2 en échec, 0 annulée\(s\), 0 interrompue\(s\) ; envois des sous-missions : 0 approuvé\(s\) \(dont 0 par accord de mission\), 0 refusé\(s\)\./,
  );
  assert.match(
    summary,
    /Confrontation : le chef annonce 3 envoi\(s\) ; la plateforme a vu 0 envoi\(s\) approuvé\(s\) dans la famille\./,
  );
  // multi-agent-v3-01 (D5) : the duration of the sub-missions Relay ran.
  assert.match(
    summary,
    /Consommation : 3 sous-mission\(s\), .* de durée des sous-missions Relay \(fixture /,
  );
  // The chief's answer stays his ; the section belongs to the platform's lines.
  assert.equal(row.result.answer, 'Tableau FICTIF. J’ai envoyé 3 e-mails.');
  assert.ok(row.result.platformNotes.includes('Sous-missions (3) :'));
});

test('consigne du chef et des sous-missions identique pour tous les profils d’agents, sans nom d’agent', async (t) => {
  const seen = [];
  for (const profile of profiles) {
    const p = await platform(t, { identity: profile });
    p.setConfig(() => ({
      steps: [
        { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE' } },
        { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
      ],
    }));
    const mother = await p.app.engine.create({
      prompt: 'Une tâche FICTIVE déléguée.',
      agent: 'fixture',
      pack: 'core',
      multiAgent: true,
      delegation: ACCEPTED({ total: 4, parallel: 2 }),
    });
    await p.ended(mother.id, 30000);
    const chief = chiefPrompt(p).prompt.instructions;
    const daughter = daughterPrompts(p)[0].prompt.instructions;
    seen.push({
      chief: chief.slice(chief.lastIndexOf('\n') + 1),
      // multi-agent-v3-01 (D9) : the folder names its mother ; the sentence is the same otherwise.
      daughter: daughter
        .slice(daughter.lastIndexOf('\n') + 1)
        .replace(`relay/missions/${mother.id.slice(0, 8)}/`, 'relay/missions/<mere>/'),
      tools: JSON.stringify(p.tools().map(({ name, description }) => [name, description])),
    });
  }
  for (const entry of seen) assert.deepEqual(entry, seen[0]);
  assert.equal(seen[0].chief, rule.chiefRule(ACCEPTED({ total: 4, parallel: 2 })));
  assert.equal(seen[0].daughter, rule.daughterRule('relay/missions/<mere>/1-tache-fictive/'));
  for (const text of [seen[0].chief, seen[0].daughter, seen[0].tools, rule.SYNTHESIS_TURN])
    assert.doesNotMatch(text, AGENT_NAMES, text);
});

test('une mère ne voit ni ne touche les sous-missions d’une autre mère ; le jeton d’une mission ne sert qu’à elle', async (t) => {
  const p = await platform(t);
  p.setConfig((input) => {
    const name = input.prompt.includes('mère A') ? 'a' : 'b';
    return {
      steps: [
        { call: 'mission_lancer', args: { consigne: `Tâche FICTIVE ${name} ATTENDRE:go-${name}` } },
        { touch: join(p.hold, `ready-${name}`) },
        { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 60 } },
      ],
    };
  });
  const motherA = await p.app.engine.create({
    prompt: 'Tâche de la mère A FICTIVE.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  const motherB = await p.app.engine.create({
    prompt: 'Tâche de la mère B FICTIVE.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.waitFor(() => ['a', 'b'].every((x) => existsSync(join(p.hold, `ready-${x}`))));
  const [childA] = p.app.store.children(motherA.id);
  const [childB] = p.app.store.children(motherB.id);
  const tokenA = p.app.engine.approvalTokens.get(motherA.id);
  const tokenB = p.app.engine.approvalTokens.get(motherB.id);
  const asA = (tool, args, token = tokenA) =>
    p.api(`/api/internal/missions/${motherA.id}`, { tool, args }, { 'x-relay-token': token });
  const all = await asA('mission_suivre', {});
  assert.deepEqual(
    all.body.result.missions.map((m) => m.id),
    [childA.id],
  );
  for (const [tool, args] of [
    ['mission_suivre', { id: childB.id }],
    ['mission_attendre', { ids: [childB.id], delaiSecondes: 1 }],
    ['mission_annuler', { id: childB.id }],
  ]) {
    const out = await asA(tool, args);
    assert.equal(out.body.erreur, 'introuvable', tool);
  }
  assert.equal(p.app.store.get(childB.id).state, 'running');
  // B's token does not open A's tools.
  assert.equal((await asA('mission_suivre', {}, tokenB)).status, 403);
  // A sub-mission has no mission tool of its own.
  // equipe-carnet : the notebook server only.
  for (const entry of daughterPrompts(p))
    assert.deepEqual(entry.servers, ['platform', rule.CARNET_SERVER]);
  p.touch('go-a');
  p.touch('go-b');
  await p.ended(motherA.id, 30000);
  await p.ended(motherB.id, 30000);
});

test('Bilan : texte long cité par ses lignes d’envoi et d’échec ; annonces d’envoi lues', () => {
  const long = [
    'Ligne FICTIVE '.repeat(300),
    'Envoi par la plateforme : 2 approuvé(s) par le propriétaire.',
    'Action(s) échouée(s) : browser_click — page changée',
  ].join('\n');
  assert.ok(long.length > QUOTE_LIMIT);
  assert.deepEqual(quoteBilan(long, 'id-FICTIF'), [
    '> Envoi par la plateforme : 2 approuvé(s) par le propriétaire.',
    '> Action(s) échouée(s) : browser_click — page changée',
    `> … Bilan de ${long.length} caractères : texte complet dans la sous-mission id-FICTIF.`,
  ]);
  assert.equal(announcedSends('J’ai envoyé 3 e-mails et 2 messages ont été envoyés.'), 5);
  assert.equal(announcedSends('Trois offres FICTIVES, note 4/5.'), null);
  assert.equal(familySection({ children: [] }), '');
  const section = familySection({
    children: [
      {
        id: 'c1',
        titre: 'T1',
        agent: 'a1',
        modele: '',
        state: 'completed',
        durationMs: 65000,
        bilan: 'Envoi par la plateforme : 1 approuvé(s) par le propriétaire.',
        envois: { approuves: 1, parAccord: 0, refuses: 1 },
      },
    ],
    chiefAnswer: 'J’ai envoyé 1 e-mail.',
    motherSends: 0,
  });
  assert.match(section, /1 min 05 s/);
  assert.match(section, /1 approuvé\(s\) \(dont 0 par accord de mission\), 1 refusé\(s\)/);
  assert.doesNotMatch(section, /Confrontation/);
});

test('reprise de la mère : le nouveau chef garde l’accord et voit les sous-missions précédentes', async (t) => {
  const p = await platform(t);
  p.setConfig((input) =>
    input.prompt === 'Suite FICTIVE de la mission.'
      ? {
          steps: [
            { call: 'mission_suivre', args: {} },
            { call: 'mission_lancer', args: { consigne: 'Tâche FICTIVE de la reprise' } },
            { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
          ],
        }
      : {
          steps: [
            {
              call: 'mission_lancer',
              args: { consigne: 'Tâche FICTIVE de la première exécution' },
            },
            { call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } },
          ],
        },
  );
  const first = await p.app.engine.create({
    prompt: 'Première exécution FICTIVE.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED({ total: 4, parallel: 2 }),
  });
  await p.ended(first.id, 30000);
  await p.waitFor(() => !p.app.engine.active.has(first.id));
  const [previousChild] = p.app.store.children(first.id);
  const resumed = await p.api(`/api/runs/${first.id}/resume`, {
    prompt: 'Suite FICTIVE de la mission.',
  });
  assert.equal(resumed.status, 201, JSON.stringify(resumed.body));
  await p.ended(resumed.body.id, 30000);
  const row = p.app.store.get(resumed.body.id);
  assert.equal(row.state, 'completed', row.error);
  assert.equal(row.resumedFrom, first.id);
  assert.deepEqual(
    {
      accepted: row.delegation.accepted,
      total: row.delegation.total,
      parallel: row.delegation.parallel,
    },
    { accepted: true, total: 4, parallel: 2 },
  );
  const results = p.results();
  const followed = results.at(-3).result.missions;
  assert.deepEqual(
    followed.map((m) => [m.id, m.etat]),
    [[previousChild.id, 'completed']],
  );
  assert.equal(results.at(-2).result.famille.lancees, 2);
  assert.match(row.result.summary, /Sous-missions \(2\) :/);
});

// delegation-v2-01 (plan v2, Codex 4, `:967` adapté) : no reminder any more ; the platform waits for
// the sub-missions still alive at the end of the chief's turn, then ONE synthesis turn gives the
// chief their results ; the mother stays running meanwhile and ends after the last one.
test('fin du tour du chef avec des sous-missions vivantes : attente, puis un seul tour de synthèse avec leurs résultats', async (t) => {
  const p = await platform(t);
  p.setConfig(() => ({
    steps: [
      {
        call: 'mission_lancer',
        args: { consigne: 'Tâche FICTIVE ATTENDRE:a', titre: 'Tâche A' },
      },
    ],
    // In the synthesis turn the results are joined ; read again, they are the same.
    reminderSteps: [{ call: 'mission_attendre', args: { toutes: true, delaiSecondes: 30 } }],
    reminderSummary: 'Synthèse FICTIVE après attente.',
  }));
  const mother = await p.app.engine.create({
    prompt: 'Mission FICTIVE, synthèse.',
    agent: 'fixture',
    pack: 'core',
    multiAgent: true,
    delegation: ACCEPTED(),
  });
  await p.waitFor(() => p.types(mother.id).includes('family_waiting'));
  assert.equal(p.app.store.get(mother.id).state, 'running');
  const [child] = p.app.store.children(mother.id);
  assert.equal(p.app.store.get(child.id).state, 'running');
  assert.equal(p.prompts().filter((e) => !e.prompt?.famille).length, 1, 'aucun rappel');
  p.touch('a');
  await p.ended(mother.id, 30000);
  const done = p.app.store.get(mother.id);
  assert.equal(done.state, 'completed', done.error);
  assert.equal(done.result.answer, 'Synthèse FICTIVE après attente.');
  const turns = p.prompts().filter((e) => !e.prompt?.famille);
  assert.equal(turns.length, 2);
  assert.equal(turns[1].prompt.platform.turnKind, 'family_results');
  assert.equal(turns[1].prompt.instructions, rule.SYNTHESIS_TURN);
  assert.deepEqual(
    turns[1].prompt.familyResults.terminees.map((r) => [r.id, r.etat]),
    [[child.id, 'completed']],
  );
  assert.equal(p.results().at(-1).result.terminees.length, 1);
  const childDone = p.app.store.get(child.id);
  assert.ok(Date.parse(done.finishedAt) >= Date.parse(childDone.finishedAt));
  assert.match(done.result.summary, /1\. « Tâche A » — agent fixture, terminée/);
  assert.doesNotMatch(done.result.summary, /Synthèse finale non faite/);
});
