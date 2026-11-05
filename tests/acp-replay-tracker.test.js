import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurnTruth, formatCareerBilan } from '../packages/career-ops/truth.js';

// E37 (constaté le 05/11) : l'ACP émet deux fois, à 2 ms d'écart, la même mise à jour terminale
// d'un appel `career_script merge-tracker` (même toolCallId, même sortie). Chaque appel d'outil
// compte une fois ; la dernière sortie terminale de l'appel fait foi. Sorties FICTIVES.
const MERGE = (added, updated) =>
  `📊 Existing: 3 entries, max #3\n\n📊 Summary: +${added} added, 🔄${updated} updated, ⏭️0 skipped`;
const script = (truth, id, command, text, sessionUpdate = 'tool_call_update') =>
  truth.observe({
    sessionUpdate,
    toolCallId: id,
    title: 'mcp__platform__career_script',
    rawInput: { command },
    status: 'completed',
    rawOutput: { content: [{ type: 'text', text: JSON.stringify({ text, exitCode: 0 }) }] },
  });
const PROMPT = 'Évalue cette offre FICTIVE et note-la.';

test('E37 FICTIF : la même mise à jour terminale reçue deux fois compte une fois', () => {
  const truth = createTurnTruth();
  script(truth, 'm1', 'merge-tracker', MERGE(1, 2), 'tool_call');
  script(truth, 'm1', 'merge-tracker', MERGE(1, 2));
  assert.deepEqual(truth.trackerRows(), { added: 1, updated: 2 });
  assert.match(
    formatCareerBilan(PROMPT, truth),
    /Suivi du Skill : 1 ligne ajoutée, 2 mises à jour \(merge-tracker\)/,
  );
});

test('E37 FICTIF : deux appels distincts s’additionnent, la dernière sortie d’un appel fait foi', () => {
  const truth = createTurnTruth();
  script(truth, 'm1', 'merge-tracker', MERGE(0, 0));
  script(truth, 'm1', 'merge-tracker', MERGE(1, 0));
  script(truth, 'm2', 'merge-tracker', MERGE(2, 1));
  script(truth, 'm2', 'merge-tracker', MERGE(2, 1));
  assert.deepEqual(truth.trackerRows(), { added: 3, updated: 1 });
});

test('E37 FICTIF : la passerelle rejouant le même appel ne double pas le suivi', () => {
  const truth = createTurnTruth();
  const id = '00000000-0000-4000-8000-0000000000aa';
  for (let i = 0; i < 2; i++)
    truth.recordGatewayTool('career_script', 'completed', {
      toolCallId: id,
      argument: 'merge-tracker',
      tracker: { added: 1, updated: 2 },
    });
  assert.deepEqual(truth.trackerRows(), { added: 1, updated: 2 });
});

test('E37 FICTIF : un scan ancien rejoué après un scan plus récent ne remplace pas son résultat', () => {
  const truth = createTurnTruth();
  script(truth, 's1', 'scan', '✗ a : ENOTFOUND\n✗ b : ETIMEDOUT');
  script(truth, 's2', 'scan', '✓ a : 2 offres\nSummary: 2 offers, 0 errors');
  // Rejeu ACP de la mise à jour terminale du premier scan.
  script(truth, 's1', 'scan', '✗ a : ENOTFOUND\n✗ b : ETIMEDOUT');
  assert.deepEqual(truth.scanResult(), { networkFailures: 0 });
  assert.match(formatCareerBilan('Cherche des offres FICTIVES.', truth), /Scan : aucun échec/);
});

// Le même appel vu par les deux canaux (identifiant ACP, identifiant UUID de la passerelle) :
// comme pour toolOutcomes(), le compte de la passerelle fait foi quand elle en donne un.
test('E37 FICTIF : un appel vu par l’ACP et par la passerelle compte une fois', () => {
  const truth = createTurnTruth();
  script(truth, 'm1', 'merge-tracker', MERGE(1, 2));
  truth.recordGatewayTool('career_script', 'completed', {
    toolCallId: '00000000-0000-4000-8000-0000000000bb',
    argument: 'merge-tracker',
    tracker: { added: 1, updated: 2 },
  });
  script(truth, 'm1', 'merge-tracker', MERGE(1, 2));
  assert.deepEqual(truth.trackerRows(), { added: 1, updated: 2 });
});
