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
  channel: 'gateway',
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
    // Repris sur l'issue sûre de la passerelle (revue Opus du 06/11) ; la mise à jour ACP sans
    // code de sortie du même appel n'y suffit pas.
    { state: 'done', toolCallId: '00000000-0000-4000-8000-000000000002', cause: null },
  );
  assert.equal(step('release').state, 'done');
  assert.equal(step('release').toolCallId, 'a3');
  // Le suivi en direct dit l'échec puis la reprise, dans cet ordre.
  assert.deepEqual(
    events.filter((event) => event.id === 'reserve').map((event) => event.state),
    ['pending', 'failed', 'done'],
  );
  // Relecture de nuit : l'échec qui a précédé reste dit au Bilan.
  const bilan = formatSkillBilan(result);
  assert.match(bilan, /✓ Réserver le numéro du rapport \(faite après un échec\)/);
  assert.doesNotMatch(bilan, /Réserver le numéro du rapport \(échec/);
  assert.equal(step('release').recovered, undefined);
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

// Relecture de nuit : un script tué (exitCode null) ou sorti sur un code nommé est un échec sur le
// canal ACP comme sur la passerelle ; un seul appel ne se lit plus « échec puis reprise ».
test('E57 FICTIF : un code de sortie nul ou nommé est un échec', () => {
  for (const exitCode of [null, 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', -1]) {
    const { step } = run([
      acp('p0', 'career_read', { path: 'data/pipeline.md' }),
      acp(
        's1',
        'career_script',
        { command: 'check-liveness', args: ['https://jobs.example.test/o/1'] },
        'completed',
        { exitCode },
      ),
    ]);
    assert.equal(step('sweep').state, 'failed', String(exitCode));
  }
});

// Revue Opus du 06/11 (constat 12) : un même appel arrive par deux canaux. La passerelle publie
// son échec d'abord (code 1) ; la mise à jour ACP du même appel peut arriver ensuite « completed »
// sans code de sortie lisible (sortie tronquée) et passait pour un succès ultérieur : « faite après
// un échec » pour un script qui avait échoué. Une étape échouée n'est reprise que sur une issue
// sûre : celle de la passerelle, ou une réponse dont le code de sortie a été lu.
test('E57 FICTIF : la mise à jour ACP sans code du même appel ne reprend pas l’échec', () => {
  const args = ['https://jobs.example.test/o/1'];
  const { step } = run([
    acp('p0', 'career_read', { path: 'data/pipeline.md' }),
    {
      ...gateway('00000000-0000-4000-8000-000000000101', 'career_script', 'check-liveness', args),
      status: 'failed',
    },
    acp('s1', 'career_script', { command: 'check-liveness', args }, 'completed', [
      { type: 'text', text: '{"text":"Checking 1 URL…' },
    ]),
  ]);
  assert.equal(step('sweep').state, 'failed');
  assert.equal(step('sweep').recovered, undefined);
  // Un appel ultérieur distinct, réussi selon la passerelle ou selon un code lu, la reprend.
  for (const later of [
    gateway('00000000-0000-4000-8000-000000000102', 'career_script', 'check-liveness', args),
    acp('s2', 'career_script', { command: 'check-liveness', args }, 'completed', { exitCode: 0 }),
  ]) {
    const again = run([
      acp('p0', 'career_read', { path: 'data/pipeline.md' }),
      {
        ...gateway('00000000-0000-4000-8000-000000000101', 'career_script', 'check-liveness', args),
        status: 'failed',
      },
      later,
    ]);
    assert.equal(again.step('sweep').state, 'done', later.toolCallId);
    assert.equal(again.step('sweep').recovered, true);
  }
});
