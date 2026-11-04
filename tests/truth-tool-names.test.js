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
