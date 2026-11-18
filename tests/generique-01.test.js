// generique-01 : un pack qui n'est pas career-ops doit pouvoir marcher (G1, G2, G4), et rien ne
// change pour career-ops, najah, core et auto. Preuve par un pack FICTIF sans rapport avec l'emploi
// (tests/fixtures/packs-generique-01/montage-video-fictif : deux manifestes, aucun index.js), chargé
// par le réglage de test AGENT_PLATFORM_TEST_PACKS_DIR, jamais ajouté à domain-packs/.
// Navigateur simulé (fixture) partout, agents factices (tests/fixtures/agent.js, fake-acp.js),
// horloge simulée pour les délais : aucun navigateur, aucun agent réel, aucun réseau.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PACKS_DIR = resolve('tests/fixtures/packs-generique-01');
process.env.AGENT_PLATFORM_TEST_PACKS_DIR = PACKS_DIR;
// Après le réglage : les packs sont lus au chargement du module.
const { createApp } = await import('../apps/api/server.js');
const { CareerWorkspace } = await import('../packages/career-ops/workspace.js');
const { reviewCareer } = await import('../packages/career-ops/integration.js');
const { connectMcp } = await import('../packages/mcp-gateway/client.js');
const { packs, getPack, verifyPack } = await import('../packages/orchestrator/packs.js');
const { declaredToolDelay, careerScriptDelay } = await import(
  '../packages/orchestrator/tool-guard.js'
);

const FAKE = resolve('tests/fixtures/fake-acp.js');
const FICTIF = 'montage-video-fictif';
const sha = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex')
    .slice(0, 16);

// Horloge simulée des gardes du moteur (comme tests/tool-stall-delivery.test.js).
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

// Un monde FICTIF : espace career-ops de test revu, données de la plateforme dans un dossier jetable.
function world(ownerMode) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'generique-01-FICTIF-')));
  mkdirSync(join(root, 'espace/.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, 'espace/.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root: join(root, 'espace'), roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career, ownerMode });
  reviewCareer(career, app.skills);
  const close = async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  };
  return { root, app, close };
}
async function waitFor(check, ms = 20000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const value = check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('Attente dépassée');
}
const ended = (app, id) =>
  waitFor(() => {
    const run = app.store.get(id);
    return ['completed', 'failed', 'cancelled', 'interrupted'].includes(run?.state) && run;
  });
// Le plan suit son chemin réel (create → plan → execute) ; seul l'agent est remplacé par le faux
// agent ACP configuré (aucun modèle).
function withFakeAgent(app, config) {
  const original = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await original(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [FAKE],
      fixedEnv: { FAKE_ACP: JSON.stringify(config) },
    };
    return plan;
  };
  return () => (app.engine.plan = original);
}
// Les outils offerts par la passerelle MCP de la mission, lus comme l'agent les lit.
async function toolsOffered(app, plan, root) {
  const config = app.engine.mcpServerFor(
    { id: 'outils-FICTIF', cwd: root, browser: 'fixture', workspace: plan.input.workspace },
    plan.pack,
  );
  const mcp = await connectMcp(config);
  try {
    return (await mcp.listTools()).tools.map((tool) => tool.name).sort();
  } finally {
    await mcp.close();
  }
}

test('G1 : en mode propriétaire, un pack qui a un manifeste de Skill garde son pack et ses étapes', async () => {
  const { app, close } = world(true);
  try {
    const plan = await app.engine.plan({
      prompt: 'Monte la vidéo FICTIVE des vacances',
      pack: FICTIF,
      agent: 'fixture',
      browser: 'fixture',
    });
    assert.equal(plan.browserWorkflow, false);
    assert.equal(plan.pack.id, FICTIF);
    assert.equal(plan.input.pack, FICTIF);
    assert.equal(plan.input.mode, 'agent');
    assert.equal(plan.input.workflow, undefined);
    assert.deepEqual(
      plan.skillSelection.map(({ pack, intent }) => [pack, intent.id]),
      [[FICTIF, 'monter-video']],
    );
    assert.equal(plan.pack.skillManifest.intents.length, 2);
  } finally {
    await close();
  }
});

test('G1 : un pack sans manifeste de Skill ni étape propre bascule vers core comme avant (règle lue sur le pack)', async () => {
  const { app, close } = world(true);
  try {
    const plan = await app.engine.plan({
      prompt: 'Ouvre la page FICTIVE http://127.0.0.1:9/',
      pack: 'sans-parcours-fictif',
      agent: 'fixture',
      browser: 'fixture',
    });
    assert.equal(plan.browserWorkflow, true);
    assert.equal(plan.pack.id, 'core');
    assert.equal(plan.workflow.id, 'browser-agent');
  } finally {
    await close();
  }
});

test('G2 : sans index.js, la passerelle démarre sans outil propre et verifyPack rend le résultat tel quel', async () => {
  const { root, app, close } = world(true);
  try {
    const plan = await app.engine.plan({
      prompt: 'Monte la vidéo FICTIVE des vacances',
      pack: FICTIF,
      agent: 'fixture',
      browser: 'fixture',
    });
    assert.deepEqual(await toolsOffered(app, plan, root), ['browser_snapshot', 'evidence_echo']);
    const result = { simulated: true, summary: 'Vidéo FICTIVE', evidence: [] };
    assert.equal(await verifyPack(FICTIF, result, 'Monte la vidéo FICTIVE'), result);
    assert.deepEqual(result, { simulated: true, summary: 'Vidéo FICTIVE', evidence: [] });
  } finally {
    await close();
  }
});

test('Preuve : mission du pack FICTIF en mode propriétaire, agent de démonstration → completed avec Bilan', async () => {
  const { app, close } = world(true);
  try {
    const run = await app.engine.create({
      prompt: 'Monte la vidéo FICTIVE des vacances',
      pack: FICTIF,
      agent: 'fixture',
      browser: 'fixture',
    });
    const done = await ended(app, run.id);
    assert.equal(done.state, 'completed', done.error);
    assert.equal(done.pack, FICTIF);
    const summary = done.result.summary;
    assert.match(summary, /\nBilan\n/);
    assert.match(summary, /Lire les rushes FICTIFS/);
    assert.doesNotMatch(summary, /Mission incomplète/);
    const lire = done.skillProgress.steps.find((step) => step.id === 'lire-rushes');
    assert.equal(lire.state, 'done', JSON.stringify(done.skillProgress));
    const types = app.store.events(run.id).map((event) => event.type);
    assert.ok(!types.includes('tool_stalled'));
  } finally {
    await close();
  }
});

test('G4 : un outil déclaré long par le pack (150 s) n’est pas coupé à 120 s, puis l’est à son délai', async () => {
  const { root, app, close } = world(true);
  const timers = fakeTimers();
  app.engine.timers = timers;
  const restore = withFakeAgent(app, {
    stallTool: true,
    stallToolTitle: 'mcp__platform__rendu_video_fictif',
    cancelFile: join(root, 'annulation-FICTIVE'),
  });
  try {
    const run = await app.engine.create({
      prompt: 'Monte la vidéo FICTIVE des vacances',
      pack: FICTIF,
      agent: 'fixture',
      browser: 'fixture',
    });
    const types = () => app.store.events(run.id).map((event) => event.type);
    await waitFor(() =>
      app.store
        .events(run.id)
        .some((event) => event.type === 'agent' && event.data?.toolCallId === 'FICTIF-stalled'),
    );
    timers.tick(120000);
    assert.ok(!types().includes('tool_stalled'), 'coupé au délai commun de 120 s');
    timers.tick(29999);
    assert.ok(!types().includes('tool_stalled'), 'coupé avant son délai déclaré');
    timers.tick(1);
    const done = await ended(app, run.id);
    assert.equal(done.state, 'failed');
    // Hors career-ops, le message d'échec reste le message brut d'aujourd'hui (failure.js ne
    // détaille le délai que pour career-ops) : non changé par ce sprint.
    assert.equal(done.error, 'Outil sans mise à jour');
    const stalled = app.store.events(run.id).find((event) => event.type === 'tool_stalled');
    assert.deepEqual(stalled.data, { toolCallId: 'FICTIF-stalled', afterMs: 150000 });
  } finally {
    restore();
    await close();
  }
});

test('G4 : délai déclaré lu quel que soit l’adaptateur ; rien sans déclaration ; career_script inchangé', () => {
  const delays = getPack(FICTIF).toolTimeouts;
  assert.deepEqual(delays, { rendu_video_fictif: 150000 });
  const claude = { sessionUpdate: 'tool_call', title: 'mcp__platform__rendu_video_fictif' };
  const codex = {
    sessionUpdate: 'tool_call',
    title: 'mcp.platform.rendu_video_fictif',
    rawInput: { server: 'platform', tool: 'rendu_video_fictif', arguments: {} },
  };
  assert.equal(declaredToolDelay(claude, delays), 150000);
  assert.equal(declaredToolDelay(codex, delays), 150000);
  assert.equal(declaredToolDelay({ title: 'mcp__platform__evidence_echo' }, delays), null);
  assert.equal(declaredToolDelay({ title: 'toString' }, delays), null);
  for (const id of ['core', 'najah', 'career-ops']) {
    assert.equal(getPack(id).toolTimeouts, undefined, id);
    assert.equal(declaredToolDelay(claude, getPack(id).toolTimeouts), null, id);
  }
  const script = {
    sessionUpdate: 'tool_call',
    title: 'mcp__platform__career_script',
    rawInput: { command: 'scan' },
  };
  assert.equal(
    careerScriptDelay(script, () => ({ timeout: 600000 })),
    615000,
  );
});

// Intégration du 18/11 : pour career-ops, les empreintes du plan et de la consigne sont celles de
// c64c7b7 (la version unique juste avant generique-01, après lecture-18-11 qui change le manifeste
// et la consigne de career-ops), relevées par ce même fichier lancé sur ce commit.
// Inertie : empreintes relevées sur la base dad6c23 (avant generique-01) par la même sonde, pour
// career-ops, najah, core et auto, en mode propriétaire et hors mode propriétaire : plan, outils
// offerts, consigne envoyée à l'agent (instructions et workflow), fin de mission (faux agent ACP)
// et, hors career-ops, fin de mission de l'agent de démonstration.
const BASE = {
  'owner:core': {
    pack: 'core',
    browserWorkflow: true,
    plan: '3f7887ac8916dcdb',
    tools: 'browser_snapshot evidence_echo',
    consigne: '97a2836a007a3509 f072d588b92067b3',
    fin: 'completed 3f6771594fde5570',
    demo: 'failed 5ea908cf336e3828',
  },
  'owner:auto': {
    pack: 'core',
    browserWorkflow: true,
    plan: '3f7887ac8916dcdb',
    tools: 'browser_snapshot evidence_echo',
    consigne: '97a2836a007a3509 f072d588b92067b3',
    fin: 'completed 3f6771594fde5570',
    demo: 'failed 5ea908cf336e3828',
  },
  'owner:najah': {
    pack: 'najah',
    browserWorkflow: false,
    plan: 'b83ae5baa7f4bdb6',
    tools:
      'browser_snapshot evidence_echo jobs_search_live opportunities_rank opportunities_rank_live opportunities_search sponsor_check_uk',
    consigne: 'f68a0a7e23f2a707 fef35ae1109db186',
    fin: 'failed d7d65ba875f6fbfa',
    demo: 'completed 2d0b8aa9135cccef',
  },
  'owner:career-ops': {
    pack: 'career-ops',
    browserWorkflow: false,
    plan: '3604e299f9c46806',
    tools:
      'browser_snapshot career_document career_documents career_offer_save career_offers career_read career_script career_write email_send evidence_echo jobs_search_live linkedin_draft opportunities_rank_live sponsor_check_uk',
    consigne: '7810b28f8d124ca1 a124687289ffe553',
    fin: 'completed ad5c26450a4e0d05',
  },
  'api:core': {
    pack: 'core',
    browserWorkflow: false,
    plan: '28d6bcfeb008a237',
    tools: 'browser_snapshot evidence_echo',
    consigne: 'f68a0a7e23f2a707 1c5ea652601cf4aa',
    fin: 'completed d182776d3ad89da1',
    demo: 'completed b98c43e4c1884b02',
  },
  'api:auto': {
    pack: 'core',
    browserWorkflow: false,
    plan: '28d6bcfeb008a237',
    tools: 'browser_snapshot evidence_echo',
    consigne: 'f68a0a7e23f2a707 1c5ea652601cf4aa',
    fin: 'completed d182776d3ad89da1',
    demo: 'completed b98c43e4c1884b02',
  },
  'api:najah': {
    pack: 'najah',
    browserWorkflow: false,
    plan: 'af0ddda48fc991ff',
    tools:
      'browser_snapshot evidence_echo jobs_search_live opportunities_rank opportunities_rank_live opportunities_search sponsor_check_uk',
    consigne: 'f68a0a7e23f2a707 fef35ae1109db186',
    fin: 'failed d7d65ba875f6fbfa',
    demo: 'completed 2d0b8aa9135cccef',
  },
  'api:career-ops': {
    pack: 'career-ops',
    browserWorkflow: false,
    plan: '1383e5515324cbc2',
    tools:
      'browser_snapshot career_document career_documents career_offer_save career_offers career_read career_script career_write email_send evidence_echo jobs_search_live linkedin_draft opportunities_rank_live sponsor_check_uk',
    consigne: '7810b28f8d124ca1 a124687289ffe553',
    fin: 'completed 9cfa13691ac483f5',
  },
};
const CASES = [
  { pack: 'core', prompt: 'Ouvre la page FICTIVE http://127.0.0.1:9/ et résume-la.' },
  { pack: 'auto', prompt: 'Ouvre la page FICTIVE http://127.0.0.1:9/ et résume-la.' },
  { pack: 'najah', prompt: 'Classe les offres FICTIVES de démonstration' },
  { pack: 'career-ops', prompt: 'Lis un titre FICTIF' },
];
function planPrint(plan) {
  const { input, browserWorkflow, workflow, steps, permissions, dataMode, workflows, simulated } =
    plan;
  return {
    input,
    browserWorkflow,
    workflow,
    steps,
    permissions,
    dataMode,
    workflows,
    simulated,
    pack: plan.pack.id,
    packSha: sha(plan.pack),
    skills: plan.skills.map((skill) => skill.id ?? skill.name),
    intents: plan.skillSelection.map((selection) => selection.intent.id),
  };
}
for (const ownerMode of [true, false])
  for (const c of CASES) {
    const key = `${ownerMode ? 'owner' : 'api'}:${c.pack}`;
    test(`Inertie ${key} : plan, outils, consigne et fin de mission identiques à la base`, async () => {
      const { root, app, close } = world(ownerMode);
      try {
        const input = { prompt: c.prompt, pack: c.pack, agent: 'fixture', browser: 'fixture' };
        const plan = await app.engine.plan(input);
        const seen = {
          pack: plan.pack.id,
          browserWorkflow: plan.browserWorkflow,
          plan: sha(planPrint(plan)),
          tools: (await toolsOffered(app, plan, root)).join(' '),
        };
        const promptFile = join(root, 'consigne.json');
        const restore = withFakeAgent(app, {
          promptFile,
          result: { simulated: true, summary: 'Résultat FICTIF', evidence: [] },
        });
        const run = await app.engine.create(input);
        const end = await ended(app, run.id);
        restore();
        const sent = JSON.parse(readFileSync(promptFile, 'utf8'));
        seen.consigne = `${sha(sent.instructions)} ${sha(sent.workflow)}`;
        seen.fin = `${end.state} ${sha(end.result?.summary ?? null)}`;
        if (c.pack !== 'career-ops') {
          const demo = await app.engine.create(input);
          const done = await ended(app, demo.id);
          seen.demo = `${done.state} ${sha(done.result?.summary ?? null)}`;
        }
        assert.deepEqual(seen, BASE[key]);
      } finally {
        await close();
      }
    });
  }

test('Inertie : sans le réglage de test, les packs chargés sont ceux de domain-packs/, identiques', () => {
  const script = `const { packs } = await import(${JSON.stringify(resolve('packages/orchestrator/packs.js'))});
console.log(JSON.stringify(packs));`;
  const env = { ...process.env };
  delete env.AGENT_PLATFORM_TEST_PACKS_DIR;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env,
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
  const alone = JSON.parse(child.stdout);
  assert.deepEqual(
    alone.map((pack) => pack.id),
    ['core', 'career-ops', 'najah'],
  );
  assert.deepEqual(
    packs.map((pack) => pack.id),
    ['core', 'career-ops', 'najah', FICTIF, 'sans-parcours-fictif'],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(packs.slice(0, 3))), alone);
  for (const pack of alone) assert.equal('toolTimeouts' in pack, false, pack.id);
});
