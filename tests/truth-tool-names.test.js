import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurnTruth } from '../packages/career-ops/truth.js';

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
