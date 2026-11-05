import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';
import {
  formatSkillBilan,
  formatSkillOrder,
  selectSkillIntents,
  SkillProgress,
  skillManifestSchema,
} from '../packages/orchestrator/skill-router.js';
import { CareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';
import { gatewayProgress, scriptTokens } from '../packages/career-ops/truth.js';

// E38 (constaté le 05/11) : 5 réservations consécutives de numéro de rapport sans `--release`.
// Le Skill le demande en prose (modes/oferta.md) ; l'intent `evaluate` du manifeste de Relay porte
// désormais une étape explicite, visible dans l'ordre envoyé à l'agent et dans le Bilan. Rien
// n'est automatisé : la plateforme constate seulement. Données FICTIVES.
const career = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const PROMPT = 'Évalue cette offre FICTIVE';
// Canal ACP : arguments imbriqués comme les envoie l'adaptateur.
const acp = (id, title, args) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title,
  status: 'completed',
  rawInput: { arguments: args },
});
// Canal passerelle (apps/api/server.js, route tool-outcome) : nouvel identifiant, argument seul.
const gateway = (id, name, argument) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title: name,
  rawInput: { command: argument, path: argument, url: undefined },
  status: 'completed',
});
// bilan-05 (point 1) : l'intent `pipeline` réserve aussi un numéro par entrée ; même étape `release`.
const PIPELINE_PROMPT = 'Traite la boîte d’entrée FICTIVE';
function mission({ release, prompt = PROMPT }) {
  const progress = new SkillProgress(selectSkillIntents(prompt, [career]));
  progress.start();
  const pipeline = prompt === PIPELINE_PROMPT;
  const calls = [
    ...(pipeline ? [acp('p0', 'career_read', { path: 'data/pipeline.md' })] : []),
    ...(pipeline
      ? [
          acp('p1', 'career_script', {
            command: 'check-liveness',
            args: ['https://jobs.example.test/o/1'],
          }),
        ]
      : []),
    acp('c0', 'career_read', { path: 'jds/offre-fictive.md' }),
    ...(pipeline
      ? []
      : [
          acp('c1', 'career_script', {
            command: 'check-liveness',
            args: ['https://jobs.example.test/o/1'],
          }),
        ]),
    acp('c2', 'career_script', { command: 'reserve-report-num', args: [] }),
    gateway('00000000-0000-4000-8000-000000000002', 'career_script', 'reserve-report-num'),
    acp('c3', 'career_write', { path: 'reports/003-entreprise-fictive-2026-11-05.md' }),
    ...(release
      ? [
          acp('c4', 'career_script', { command: 'reserve-report-num', args: ['--release', '003'] }),
          gateway('00000000-0000-4000-8000-000000000004', 'career_script', 'reserve-report-num'),
        ]
      : []),
    acp('c5', 'career_write', { path: 'batch/tracker-additions/003-entreprise-fictive.tsv' }),
    acp('c6', 'career_script', { command: 'merge-tracker', args: [] }),
    ...(pipeline ? [acp('p2', 'career_write', { path: 'data/pipeline.md' })] : []),
  ];
  for (const call of calls) progress.observe(call);
  return progress.finish();
}

test('E38 FICTIF : l’intent evaluate déclare la libération du numéro après le rapport', () => {
  const steps = career.intents.find((intent) => intent.id === 'evaluate').steps;
  const release = steps.find((step) => step.id === 'release');
  assert.ok(release, 'étape release absente');
  assert.deepEqual(
    {
      tool: release.tool,
      argument: release.argument,
      args: release.args,
      optional: release.optional,
      persists: release.persists,
    },
    {
      tool: 'career_script',
      argument: 'reserve-report-num',
      args: ['--release', '{###}'],
      optional: true,
      persists: true,
    },
  );
  const ids = steps.map((step) => step.id);
  assert.equal(ids.indexOf('release'), ids.indexOf('report') + 1);
  const order = formatSkillOrder(selectSkillIntents(PROMPT, [career]));
  assert.match(order, /Libérer le numéro du rapport avec career_script \(reserve-report-num\)/);
  assert.match(order, /--release/);
  // « N’enregistre rien » retire la réservation, donc aussi sa libération.
  const [readOnly] = selectSkillIntents(
    'Mode oferta. Lis cette annonce FICTIVE. N’enregistre rien.',
    [career],
  );
  assert.ok(!readOnly.intent.steps.some((step) => step.id === 'release'));
});

test('E38 FICTIF : réservé et rapport écrit sans libération → étape visible, non faite', () => {
  const result = mission({ release: false });
  const step = result.steps.find((item) => item.id === 'release');
  assert.notEqual(step.state, 'done');
  assert.equal(result.steps.find((item) => item.id === 'reserve').state, 'done');
  const bilan = formatSkillBilan(result);
  assert.match(bilan, /· Libérer le numéro du rapport \(ignorée\)/);
  assert.match(bilan, /Écart d’ordre : aucun constaté/);
});

test('E38 FICTIF : libération appelée avec --release → étape faite, sans écart d’ordre', () => {
  const result = mission({ release: true });
  const step = result.steps.find((item) => item.id === 'release');
  assert.equal(step.state, 'done');
  assert.equal(step.toolCallId, 'c4');
  const bilan = formatSkillBilan(result);
  assert.match(bilan, /✓ Libérer le numéro du rapport \(faite\)/);
  assert.match(bilan, /Écart d’ordre : aucun constaté/);
});

test('bilan-05 FICTIF : l’intent pipeline déclare la même libération après le rapport', () => {
  const evaluate = career.intents.find((intent) => intent.id === 'evaluate').steps;
  const steps = career.intents.find((intent) => intent.id === 'pipeline').steps;
  const release = steps.find((step) => step.id === 'release');
  assert.ok(release, 'étape release absente de pipeline');
  const shape = ({ title, tool, argument, args, optional, persists }) => ({
    title,
    tool,
    argument,
    args,
    optional,
    persists,
  });
  assert.deepEqual(shape(release), shape(evaluate.find((step) => step.id === 'release')));
  const ids = steps.map((step) => step.id);
  assert.equal(ids.indexOf('release'), ids.indexOf('report') + 1);
  const order = formatSkillOrder(selectSkillIntents(PIPELINE_PROMPT, [career]));
  assert.match(order, /Libérer le numéro du rapport avec career_script \(reserve-report-num\)/);
  // Même sort que la réservation : dispensée « à sec », retirée par « n’enregistre rien ».
  const [dry] = selectSkillIntents('Traite la boîte d’entrée FICTIVE à sec', [career]);
  assert.equal(dry.intent.steps.find((step) => step.id === 'release').exempt, true);
  const [readOnly] = selectSkillIntents('Traite la boîte d’entrée FICTIVE, n’enregistre rien', [
    career,
  ]);
  assert.ok(!readOnly.intent.steps.some((step) => step.id === 'reserve'));
  assert.ok(!readOnly.intent.steps.some((step) => step.id === 'release'));
});

test('bilan-05 FICTIF : pipeline, entrée réservée puis rapport sans libération → ignorée', () => {
  const result = mission({ release: false, prompt: PIPELINE_PROMPT });
  assert.equal(result.steps.find((item) => item.id === 'reserve').state, 'done');
  assert.notEqual(result.steps.find((item) => item.id === 'release').state, 'done');
  const bilan = formatSkillBilan(result);
  assert.match(bilan, /Étapes du Skill[^\n]*· Libérer le numéro du rapport \(ignorée\)/);
  assert.match(bilan, /Écart d’ordre : aucun constaté/);
});

test('bilan-05 FICTIF : pipeline, libération appelée avec --release → faite', () => {
  const result = mission({ release: true, prompt: PIPELINE_PROMPT });
  const step = result.steps.find((item) => item.id === 'release');
  assert.equal(step.state, 'done');
  assert.equal(step.toolCallId, 'c4');
  const bilan = formatSkillBilan(result);
  assert.match(bilan, /Étapes du Skill[^\n]*✓ Libérer le numéro du rapport \(faite\)/);
  assert.match(bilan, /Écart d’ordre : aucun constaté/);
});

test('E38 FICTIF : args d’étape bornés (chaînes simples, {nom} pour une valeur libre)', () => {
  const evaluate = career.intents.find((intent) => intent.id === 'evaluate');
  const withArgs = (args) => ({
    ...career,
    intents: [
      {
        ...evaluate,
        steps: evaluate.steps.map((step) => (step.id === 'release' ? { ...step, args } : step)),
      },
    ],
  });
  for (const args of [[], [''], ['a\nb'], 'chaine', Array(11).fill('--x')])
    assert.throws(() => skillManifestSchema.parse(withArgs(args)), JSON.stringify(args));
});

test('E38 FICTIF : la grammaire de career_script accepte déjà ["--release","003"]', async (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'release-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  writeFileSync(
    join(root, 'reserve-report-num.mjs'),
    'console.log(JSON.stringify(process.argv.slice(2)))',
  );
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  const tools = new CareerTools({ path: () => root });
  const out = await tools.script({ command: 'reserve-report-num', args: ['--release', '003'] });
  assert.deepEqual(JSON.parse(out.text), ['--release', '003']);
});

test('E38 FICTIF : la passerelle transmet les seuls drapeaux et nombres de tête d’un script', () => {
  assert.deepEqual(
    gatewayProgress('career_script', 'completed', {
      command: 'reserve-report-num',
      args: ['--release', '003'],
    }),
    { argument: 'reserve-report-num', args: ['--release', '003'] },
  );
  assert.deepEqual(
    gatewayProgress('career_script', 'completed', { command: 'reserve-report-num', args: [] }),
    { argument: 'reserve-report-num' },
  );
  // Une URL, un nom ou un chemin arrêtent la liste : rien de tel ne sort de la passerelle.
  assert.deepEqual(scriptTokens(['https://jobs.example.test/o/1']), []);
  assert.deepEqual(scriptTokens(['--company', 'Entreprise FICTIVE', '--title', 'Poste FICTIF']), [
    '--company',
  ]);
  assert.deepEqual(scriptTokens(['output/cv-fictif.html', '--format=a4']), []);
  assert.deepEqual(scriptTokens('--release 003'), []);
  assert.deepEqual(scriptTokens(Array(20).fill('--x')).length, 10);
  assert.equal('args' in gatewayProgress('career_read', 'completed', { path: 'jds/a.md' }), false);
});

test('E38 FICTIF : canal passerelle seul — la réservation ne prouve pas la libération', () => {
  const progress = new SkillProgress(selectSkillIntents(PROMPT, [career]));
  progress.start();
  const viaGateway = (id, argument, args) => ({
    ...gateway(id, 'career_script', argument),
    rawInput: { command: argument, path: argument, args: scriptTokens(args) },
  });
  progress.observe(
    acp('c3', 'career_write', { path: 'reports/003-entreprise-fictive-2026-11-05.md' }),
  );
  progress.observe(viaGateway('g1', 'reserve-report-num', []));
  assert.equal(progress.current().steps.find((step) => step.id === 'release').state, 'pending');
  progress.observe(viaGateway('g2', 'reserve-report-num', ['--release', '003']));
  assert.equal(progress.current().steps.find((step) => step.id === 'release').state, 'done');
});
