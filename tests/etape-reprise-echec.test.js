import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  formatSkillBilan,
  selectSkillIntents,
  SkillProgress,
  skillManifestSchema,
} from '../packages/orchestrator/skill-router.js';
import { scriptTokens } from '../packages/career-ops/truth.js';

// E57 (constaté le 05/11, mission f336641e) : `reserve-report-num --count 5` refusé par Relay a
// figé l'étape « Réserver le numéro du rapport » en échec ; les cinq réservations réussies juste
// après n'y changeaient plus rien et le Bilan disait la réservation échouée. Une étape échouée est
// désormais reprise par un succès ultérieur du même appel, sauf si cet appel appartient à une étape
// sœur déclarée par ses arguments (« --release » n'est pas une réservation). Données FICTIVES.
const career = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const PROMPT = 'Traite la boîte d’entrée FICTIVE';
// Canal ACP : arguments imbriqués comme les envoie l'adaptateur Claude.
const acp = (id, title, args, status = 'completed', rawOutput) => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title,
  status,
  rawInput: { arguments: args },
  ...(rawOutput ? { rawOutput } : {}),
});
// Canal passerelle, tel que apps/api/server.js le rejoue (route tool-outcome) : nouvel identifiant,
// argument de progression et drapeaux de tête du script.
const gateway = (id, name, argument, args, status = 'completed') => ({
  sessionUpdate: 'tool_call',
  toolCallId: id,
  title: name,
  rawInput: { command: argument, path: argument, url: undefined, args: scriptTokens(args) },
  status,
});
const both = (n, args, status = 'completed') => [
  acp(`a${n}`, 'career_script', { command: 'reserve-report-num', args }, status),
  gateway(
    `00000000-0000-4000-8000-00000000000${n}`,
    'career_script',
    'reserve-report-num',
    args,
    status,
  ),
];
const opening = [
  acp('p0', 'career_read', { path: 'data/pipeline.md' }),
  acp('p1', 'career_script', {
    command: 'check-liveness',
    args: ['https://jobs.example.test/o/1'],
  }),
  acp('p2', 'career_read', { path: 'jds/offre-fictive.md' }),
];
function run(calls) {
  const events = [];
  const progress = new SkillProgress(selectSkillIntents(PROMPT, [career]), (step) =>
    events.push({ id: step.id, state: step.state, toolCallId: step.toolCallId }),
  );
  progress.start();
  for (const call of calls) progress.observe(call);
  const result = progress.finish();
  const step = (id) => result.steps.find((item) => item.id === id);
  return { result, step, events };
}

test('E57 FICTIF : réservation refusée puis réussie → étape faite, cause effacée', () => {
  const { result, step, events } = run([
    ...opening,
    ...both(1, ['--count', '5'], 'failed'),
    ...both(2, []),
    acp('w1', 'career_write', { path: 'reports/002-entreprise-fictive-2026-11-05.md' }),
    ...both(3, ['--release', '002']),
  ]);
  assert.deepEqual(
    {
      state: step('reserve').state,
      toolCallId: step('reserve').toolCallId,
      cause: step('reserve').cause,
    },
    { state: 'done', toolCallId: 'a2', cause: null },
  );
  assert.equal(step('release').state, 'done');
  assert.equal(step('release').toolCallId, 'a3');
  // Le suivi en direct dit l'échec puis la reprise, dans cet ordre.
  assert.deepEqual(
    events.filter((event) => event.id === 'reserve').map((event) => event.state),
    ['pending', 'failed', 'done'],
  );
  const bilan = formatSkillBilan(result);
  assert.match(bilan, /✓ Réserver le numéro du rapport \(faite\)/);
  assert.doesNotMatch(bilan, /Réserver le numéro du rapport \(échec/);
});

test('E57 FICTIF : un échec après une réservation faite ne la défait pas', () => {
  const { step } = run([...opening, ...both(1, []), ...both(2, [], 'failed')]);
  assert.equal(step('reserve').state, 'done');
  assert.equal(step('reserve').toolCallId, 'a1');
});

test('E57 FICTIF : une libération ne reprend jamais une réservation échouée', () => {
  const { result, step } = run([
    ...opening,
    ...both(1, ['--count', '5'], 'failed'),
    acp('w1', 'career_write', { path: 'reports/002-entreprise-fictive-2026-11-05.md' }),
    ...both(2, ['--release', '002']),
    // Une seconde libération, quand l'étape `release` est déjà faite : toujours pas une réservation.
    ...both(3, ['--release', '003']),
  ]);
  assert.equal(step('release').state, 'done');
  assert.equal(step('reserve').state, 'failed');
  assert.equal(step('reserve').cause, 'échec signalé par l’outil');
  assert.match(
    formatSkillBilan(result),
    /✗ Réserver le numéro du rapport \(échec signalé par l’outil\)/,
  );
});

test('E57 FICTIF : un script sorti en erreur puis relancé avec succès reprend son étape', () => {
  const sweep = (id, rawOutput) =>
    acp(
      id,
      'career_script',
      { command: 'check-liveness', args: ['https://jobs.example.test/o/1'] },
      'completed',
      rawOutput,
    );
  const { step } = run([
    acp('p0', 'career_read', { path: 'data/pipeline.md' }),
    sweep('s1', { exitCode: 1 }),
    sweep('s2', { exitCode: 0 }),
  ]);
  assert.equal(step('sweep').state, 'done');
  assert.equal(step('sweep').toolCallId, 's2');
  assert.equal(step('sweep').cause, null);
});
