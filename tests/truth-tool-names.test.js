import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTurnTruth,
  formatCareerBilan,
  gatewayProgress,
  trackerSummary,
} from '../packages/career-ops/truth.js';

// E22 : un outil seulement nommé dans le texte d'une question n'est pas un appel.
test('vérité du tour : un nom d’outil cité dans un titre libre n’est pas compté comme un appel', () => {
  const truth = createTurnTruth();
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'q1',
    title: 'Dois-je enregistrer cette offre FICTIVE (career_offer_save) ?',
    status: 'completed',
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'q1', status: 'completed' });
  assert.deepEqual(truth.toolOutcomes(), []);
});

test('vérité du tour : le nom exact, avec ou sans préfixe MCP, est compté', () => {
  const truth = createTurnTruth();
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'a',
    title: 'mcp__platform__career_read',
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'a', status: 'completed' });
  truth.observe({ sessionUpdate: 'tool_call', toolCallId: 'b', title: 'browser.snapshot' });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'b', status: 'completed' });
  assert.deepEqual(
    truth.toolOutcomes().map((o) => [o.name, o.status]),
    [
      ['career_read', 'completed'],
      ['browser_snapshot', 'completed'],
    ],
  );
});

// E25 : le même outil vu par ACP (`browser_fillform`, mis en minuscules) et par la passerelle
// (`browser_fillForm`, nom déclaré) compte une seule fois, sous le nom déclaré.
test('vérité du tour : la casse d’un nom d’outil ne crée pas un second outil', () => {
  const truth = createTurnTruth();
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'f1',
    title: 'mcp__platform__browser_fillForm',
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'f1', status: 'completed' });
  truth.recordGatewayTool('browser_fillForm', 'completed', { toolCallId: 'gw-1' });
  assert.deepEqual(
    truth.toolOutcomes().map((o) => [o.name, o.status]),
    [['browser_fillForm', 'completed']],
  );
  // A failure reported by both channels is one failed action, not two.
  truth.observe({ sessionUpdate: 'tool_call', toolCallId: 'f2', title: 'browser_fillform' });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'f2', status: 'failed' });
  truth.recordGatewayTool('browser_fillForm', 'failed', { toolCallId: 'gw-2' });
  assert.deepEqual(
    truth.failedActions().map((a) => a.name),
    ['browser_fillForm'],
  );
  assert.deepEqual(
    truth.toolOutcomes().map((o) => [o.name, o.status]),
    [
      ['browser_fillForm', 'completed'],
      ['browser_fillForm', 'failed'],
    ],
  );
  // Names outside the capability registry keep their lowercase form on both channels.
  const other = createTurnTruth();
  other.observe({ sessionUpdate: 'tool_call', toolCallId: 'c', title: 'Career_Offer_Save' });
  other.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'c', status: 'completed' });
  other.recordGatewayTool('career_offer_save', 'completed', { toolCallId: 'gw-3' });
  assert.deepEqual(
    other.toolOutcomes().map((o) => o.name),
    ['career_offer_save'],
  );
});

// bilan-05 (E36 reste, mission 05b34578) : merge-tracker a répondu « No applications.md found.
// Nothing to merge into. » avec code 0, et le Bilan disait « fusion réussie, nombre de lignes non
// lu ». Lecture fidèle de la sortie du script : rien fusionné, tableau de suivi absent. FICTIF.
const NOTHING_TO_MERGE = 'No applications.md found. Nothing to merge into.';
const NOTHING_SUMMARY = { added: 0, updated: 0, reason: 'tableau de suivi absent' };
const mergeScript = (truth, id, text) => {
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: 'mcp__platform__career_script',
    rawInput: { command: 'merge-tracker' },
  });
  truth.observe({
    sessionUpdate: 'tool_call_update',
    toolCallId: id,
    status: 'completed',
    rawOutput: { content: [{ type: 'text', text: JSON.stringify({ text, exitCode: 0 }) }] },
  });
};

test('E36 FICTIF : « Nothing to merge into » = rien fusionné, tableau de suivi absent (ACP)', () => {
  assert.deepEqual(trackerSummary(NOTHING_TO_MERGE), NOTHING_SUMMARY);
  const truth = createTurnTruth();
  mergeScript(truth, 'm1', NOTHING_TO_MERGE);
  assert.deepEqual(truth.trackerRows(), NOTHING_SUMMARY);
  const bilan = formatCareerBilan('Évalue cette offre FICTIVE', truth);
  assert.match(bilan, /\n- Suivi du Skill : rien fusionné \(tableau de suivi absent\)/);
  assert.doesNotMatch(bilan, /fusion réussie/);
});

test('E36 FICTIF : la passerelle transmet le motif, le Bilan le dit', () => {
  const progress = gatewayProgress(
    'career_script',
    'completed',
    { command: 'merge-tracker', args: [] },
    { content: [{ type: 'text', text: JSON.stringify({ text: NOTHING_TO_MERGE, exitCode: 0 }) }] },
  );
  assert.deepEqual(progress, { argument: 'merge-tracker', tracker: NOTHING_SUMMARY });
  const truth = createTurnTruth();
  truth.recordGatewayTool('career_script', 'completed', {
    toolCallId: '00000000-0000-4000-8000-0000000000e3',
    ...progress,
  });
  assert.deepEqual(truth.trackerRows(), NOTHING_SUMMARY);
  assert.match(
    formatCareerBilan('Évalue cette offre FICTIVE', truth),
    /Suivi du Skill : rien fusionné \(tableau de suivi absent\)/,
  );
  // Un motif libre venu du réseau ne passe pas tel quel dans le Bilan.
  const other = createTurnTruth();
  other.recordGatewayTool('career_script', 'completed', {
    toolCallId: '00000000-0000-4000-8000-0000000000e4',
    argument: 'merge-tracker',
    tracker: { added: 0, updated: 0, reason: 'x\n<script>' },
  });
  const unknown = formatCareerBilan('Évalue cette offre FICTIVE', other);
  assert.doesNotMatch(unknown, /<script>|rien fusionné/);
  assert.match(unknown, /Suivi du Skill : 0 ligne ajoutée, 0 mise à jour \(merge-tracker\)/);
});

test('E36 FICTIF : une fusion réelle après le tableau créé compte, le motif s’efface', () => {
  const truth = createTurnTruth();
  mergeScript(truth, 'm1', NOTHING_TO_MERGE);
  mergeScript(truth, 'm2', '📊 Summary: +2 added, 🔄0 updated, ⏭️0 skipped');
  assert.deepEqual(truth.trackerRows(), { added: 2, updated: 0 });
  assert.match(
    formatCareerBilan('Évalue cette offre FICTIVE', truth),
    /Suivi du Skill : 2 lignes ajoutées, 0 mise à jour \(merge-tracker\)/,
  );
});
