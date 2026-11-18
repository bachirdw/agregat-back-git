// lecture-18-11 (E128, mission 751f33c8 du 18/11) : un agent a obtenu le texte de trois annonces par
// un script du Skill (career_script fetch-jd, URL de l'annonce en argument, code 0, 4 à 5 Ko de
// texte), puis les a notées ; la plateforme a déclaré la mission « failed » : « 3 offre(s) notée(s)
// sans lecture de leur page ». L'autre agent, même prompt, avait lu les pages au navigateur et fini
// « completed ». Désormais la sortie réussie d'un script du Skill qui rend le texte d'une annonce
// compte comme lecture de cette annonce, sur des faits que la plateforme possède (script, code de
// sortie, taille, URL donnée) ; une offre notée sans aucune lecture reste « notée sans lecture ».
// Données FICTIVES (example.test), aucun modèle, aucun réseau, aucun navigateur. Les formes des
// mises à jour sont celles des adaptateurs réels (tests/fixtures/acp-shapes), sans nom d'agent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../apps/api/server.js';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { reviewCareer } from '../packages/career-ops/integration.js';
import { getPack } from '../packages/orchestrator/packs.js';
import {
  READ_BEFORE_SCORE,
  SkillProgress,
  formatSkillOrder,
  selectSkillIntents,
  skillManifestSchema,
} from '../packages/orchestrator/skill-router.js';
import { terminal } from '../packages/storage/index.js';

const manifest = () => getPack('career-ops').skillManifest;
const OFFERS = [
  'https://ats.example.test/entreprise-fictive/jobs/1000000001',
  'https://ats.example.test/entreprise-fictive/jobs/1000000002',
  'https://ats.example.test/entreprise-fictive/jobs/1000000003',
];
const JD = (n = 3800) =>
  ('Poste FICTIF\n\nLocation: Remote (FICTIF)\nReq ID: 180\n\n' + 'Texte FICTIF. '.repeat(n)).slice(
    0,
    n,
  );
const answer = (text, exitCode = 0) => JSON.stringify({ text, exitCode, untrusted: true });
const pipelineProgress = () => {
  const selection = selectSkillIntents('Traite les offres en attente FICTIVES', [manifest()]);
  assert.deepEqual(
    selection.map(({ intent }) => intent.id),
    ['pipeline'],
  );
  const progress = new SkillProgress(selection);
  progress.start();
  return progress;
};
const stepOf = (progress, id) => progress.current().steps.find((step) => step.id === id);
const scored = (urls) => urls.map((url, index) => ({ url, toolCallId: `note-${index}` }));

// Forme de l'adaptateur qui nomme l'outil `mcp__platform__…` (rawInput d'abord vide).
function namedScript(id, input, text, exitCode = 0) {
  const title = 'mcp__platform__career_script';
  const meta = { claudeCode: { toolName: title } };
  return [
    {
      sessionUpdate: 'tool_call',
      toolCallId: id,
      title,
      name: title,
      kind: 'other',
      status: 'pending',
      rawInput: {},
      _meta: meta,
    },
    { sessionUpdate: 'tool_call_update', toolCallId: id, rawInput: input, _meta: meta },
    {
      sessionUpdate: 'tool_call_update',
      toolCallId: id,
      status: 'completed',
      content: [{ type: 'content', content: { type: 'text', text: answer(text, exitCode) } }],
      rawOutput: [{ type: 'text', text: answer(text, exitCode) }],
      _meta: meta,
    },
  ];
}
// Forme de l'adaptateur qui nomme l'outil `mcp.platform.…` (serveur, outil et arguments imbriqués).
function nestedScript(id, input, text, exitCode = 0) {
  return [
    {
      sessionUpdate: 'tool_call',
      toolCallId: id,
      title: 'mcp.platform.career_script',
      kind: 'execute',
      status: 'in_progress',
      rawInput: { server: 'platform', tool: 'career_script', arguments: input },
      _meta: { is_mcp_tool_call: true },
    },
    {
      sessionUpdate: 'tool_call_update',
      toolCallId: id,
      status: 'completed',
      rawOutput: {
        result: {
          content: [{ type: 'text', text: answer(text, exitCode) }],
          structuredContent: null,
          _meta: null,
        },
        error: null,
      },
    },
  ];
}
// Ce que la passerelle transmet du même appel (apps/api/server.js) : ni URL, ni sortie.
const gatewayScript = (id, command) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title: 'career_script',
  channel: 'gateway',
  rawInput: { command, path: command, args: [] },
  status: 'completed',
});

for (const [shape, script] of [
  ['noms préfixés mcp__', namedScript],
  ['noms mcp. imbriqués', nestedScript],
])
  test(`E128 FICTIF (${shape}) : trois annonces rendues par fetch-jd puis notées, mission complète`, () => {
    const progress = pipelineProgress();
    OFFERS.forEach((url, index) => {
      progress.observe(gatewayScript(`gw-${index}`, 'fetch-jd'));
      for (const update of script(`jd-${index}`, { command: 'fetch-jd', args: [url] }, JD()))
        progress.observe(update);
    });
    assert.equal(stepOf(progress, 'read-offer').state, 'done');
    assert.deepEqual(progress.incomplete([], false, scored(OFFERS)), []);
  });

test('E128 FICTIF : une offre notée que rien n’a lue reste « notée sans lecture »', () => {
  const progress = pipelineProgress();
  for (const update of namedScript('jd-0', { command: 'fetch-jd', args: [OFFERS[0]] }, JD()))
    progress.observe(update);
  assert.deepEqual(progress.incomplete([], false, scored(OFFERS)), [
    '2 offre(s) notée(s) sans lecture de leur page',
  ]);
  // Une page lue au navigateur et une annonce rendue par script s'additionnent.
  assert.deepEqual(progress.incomplete([OFFERS[1]], false, scored(OFFERS)), [
    '1 offre(s) notée(s) sans lecture de leur page',
  ]);
});

test('E128 FICTIF : script raté, texte trop court, mode liste, autre script, passerelle seule : aucune lecture', () => {
  const cases = [
    // fetch-jd sans réponse de l'ATS : code 1, sortie vide (le repli vers le navigateur est prévu).
    namedScript('a', { command: 'fetch-jd', args: [OFFERS[0]] }, '', 1),
    // Code 0 mais presque rien de rendu.
    namedScript('b', { command: 'fetch-jd', args: [OFFERS[0]] }, 'Poste FICTIF'),
    // Le même extracteur en mode liste rend une liste, pas une annonce.
    namedScript('c', { command: 'browser-extract', args: [OFFERS[0], '--mode', 'listing'] }, JD()),
    namedScript('c2', { command: 'browser-extract', args: [OFFERS[0], '--mode=listing'] }, JD()),
    // Un script qui ne rend pas d'annonce, même avec l'URL et un long texte.
    namedScript('d', { command: 'check-liveness', args: [OFFERS[0]] }, JD()),
    // Sans URL en premier argument : l'offre visée n'est pas connue.
    namedScript('e', { command: 'fetch-jd', args: [] }, JD()),
    namedScript('f', { command: 'fetch-jd', args: ['--help'] }, JD()),
    // Une page de résultats du portail n'est pas une annonce (E56).
    namedScript(
      'g',
      { command: 'browser-extract', args: ['https://ats.example.test/careers/jobs'] },
      JD(),
    ),
  ];
  for (const updates of cases) {
    const progress = pipelineProgress();
    for (const update of updates) progress.observe(update);
    progress.observe(gatewayScript('gw', 'fetch-jd'));
    const read = stepOf(progress, 'read-offer');
    assert.equal(read.state, 'pending', JSON.stringify(updates[1].rawInput));
    assert.deepEqual(progress.incomplete([], false, scored([OFFERS[0]])), [
      '1 offre(s) notée(s) sans lecture de leur page',
    ]);
  }
});

test('E128 FICTIF : un échec de fetch-jd ne marque pas la lecture en échec, la lecture suivante la fait', () => {
  const progress = pipelineProgress();
  for (const update of namedScript('a', { command: 'fetch-jd', args: [OFFERS[0]] }, '', 1))
    progress.observe(update);
  assert.equal(stepOf(progress, 'read-offer').state, 'pending');
  for (const update of namedScript(
    'b',
    { command: 'browser-extract', args: [OFFERS[0]] },
    JSON.stringify({ url: OFFERS[0], title: 'Poste FICTIF', text: JD() }),
  ))
    progress.observe(update);
  assert.equal(stepOf(progress, 'read-offer').state, 'done');
  assert.deepEqual(progress.incomplete([], false, scored([OFFERS[0]])), []);
});

test('E128 FICTIF : l’annonce rendue est reconnue par son identifiant sur le même hôte', () => {
  const progress = pipelineProgress();
  for (const update of namedScript('a', { command: 'fetch-jd', args: [OFFERS[0]] }, JD()))
    progress.observe(update);
  assert.deepEqual(
    progress.incomplete([], false, scored(['https://ats.example.test/embed/job?jk=1000000001'])),
    [],
  );
  assert.deepEqual(
    progress.incomplete([], false, scored(['https://autre.example.test/jobs/1000000001'])),
    ['1 offre(s) notée(s) sans lecture de leur page'],
  );
});

test('E128 FICTIF : l’intent evaluate reconnaît aussi la lecture par script', () => {
  const selection = selectSkillIntents(`Évalue cette offre FICTIVE ${OFFERS[2]}`, [manifest()]);
  assert.deepEqual(
    selection.map(({ intent }) => intent.id),
    ['evaluate'],
  );
  const progress = new SkillProgress(selection);
  progress.start();
  for (const update of nestedScript('a', { command: 'fetch-jd', args: [OFFERS[2]] }, JD()))
    progress.observe(update);
  assert.equal(stepOf(progress, 'read-offer').state, 'done');
  assert.deepEqual(progress.incomplete([], false, scored([OFFERS[2]])), []);
});

test('E128 FICTIF : la consigne et l’ordre du Skill disent la lecture par script, sans nom d’agent', () => {
  assert.match(READ_BEFORE_SCORE, /^Ne note une offre qu’après avoir lu sa page/);
  assert.match(READ_BEFORE_SCORE, /texte de son annonce rendu par un script du Skill/);
  const order = formatSkillOrder(
    selectSkillIntents('Traite les offres en attente FICTIVES', [manifest()]),
  );
  assert.match(
    order,
    /Lire réellement l'annonce de chaque entrée avec career_read ou browser_extract ou browser_snapshot \(jds\/\) ou career_script \(fetch-jd, browser-extract, texte de l’annonce rendu\)/,
  );
  assert.doesNotMatch(order + READ_BEFORE_SCORE, /claude|codex|gemini|opencode/i);
});

test('E128 FICTIF : le schéma du manifeste refuse une règle de lecture par script incomplète', () => {
  const base = structuredClone(manifest());
  const step = base.intents
    .find((intent) => intent.id === 'evaluate')
    .steps.find((item) => item.id === 'read-offer');
  assert.equal(skillManifestSchema.safeParse(base).success, true);
  delete step.scriptReads.minChars;
  assert.equal(skillManifestSchema.safeParse(base).success, false);
  step.scriptReads.minChars = 500;
  step.scriptReads.extra = true;
  assert.equal(skillManifestSchema.safeParse(base).success, false);
});

// Chaîne réelle : create() → plan() → consigne → agent ACP factice (tests/fixtures/fake-acp.js) qui
// émet les mises à jour d'un appel fetch-jd puis une offre notée ; la plateforme juge la mission.
async function mission(t, nativeTools) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lecture-18-11-FICTIF-')));
  mkdirSync(join(root, '.agents/skills/career-ops'), { recursive: true });
  writeFileSync(
    join(root, '.agents/skills/career-ops/SKILL.md'),
    '---\nname: career-ops\ndescription: Routeur de test FICTIF\nlicense: MIT\n---\n# FICTIF\n',
  );
  const career = new CareerWorkspace({ root, roots: [root] });
  const app = createApp({ dataDir: join(root, 'platform'), career });
  t.after(async () => {
    await app.close();
    rmSync(root, { recursive: true, force: true });
  });
  reviewCareer(career, app.skills);
  const promptFile = join(root, 'sent-prompt.json');
  const originalPlan = app.engine.plan.bind(app.engine);
  app.engine.plan = async (...args) => {
    const plan = await originalPlan(...args);
    plan.agent = {
      ...plan.agent,
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      fixedEnv: {
        FAKE_ACP: JSON.stringify({
          promptFile,
          nativeTools,
          result: { simulated: true, summary: 'Offre FICTIVE notée.', evidence: [] },
        }),
      },
    };
    return plan;
  };
  const run = await app.engine.create({
    agent: 'fixture',
    prompt: `Évalue cette offre FICTIVE ${OFFERS[0]}`,
    pack: 'career-ops',
  });
  for (let i = 0; i < 1500 && !terminal.has(app.store.get(run.id).state); i++)
    await new Promise((done) => setTimeout(done, 20));
  return {
    row: app.store.get(run.id),
    instructions: JSON.parse(readFileSync(promptFile, 'utf8')).instructions,
  };
}
const scoreUpdates = (id, url) => {
  const title = 'mcp__platform__career_offer_save';
  return [
    {
      sessionUpdate: 'tool_call',
      toolCallId: id,
      title,
      name: title,
      kind: 'other',
      status: 'pending',
      rawInput: { url, score: 2, title: 'Poste FICTIF', company: 'Entreprise FICTIVE' },
    },
    { sessionUpdate: 'tool_call_update', toolCallId: id, status: 'completed' },
  ];
};

test('E128 FICTIF, chaîne réelle : annonce rendue par script puis notée, la mission n’est pas déclarée sans lecture', async (t) => {
  const { row, instructions } = await mission(t, [
    ...namedScript('jd-0', { command: 'fetch-jd', args: [OFFERS[0]] }, JD()),
    ...scoreUpdates('note-0', OFFERS[0]),
  ]);
  assert.equal(instructions.split('Ne note une offre qu’après avoir lu sa page').length, 2);
  assert.match(instructions, /rendu par un script du Skill/);
  assert.doesNotMatch(row.error ?? '', /sans lecture/, JSON.stringify(row.error));
  assert.doesNotMatch(row.result?.summary ?? '', /notée\(s\) sans lecture/);
});

test('E128 FICTIF, chaîne réelle : la même note sans aucune lecture reste refusée', async (t) => {
  const { row } = await mission(t, scoreUpdates('note-0', OFFERS[0]));
  assert.equal(row.state, 'failed');
  assert.match(row.error, /1 offre\(s\) notée\(s\) sans lecture de leur page/);
});
