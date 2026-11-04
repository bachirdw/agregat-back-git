import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurnTruth } from '../packages/career-ops/truth.js';

test('Suivi du tour FICTIF : les offres enregistrées avec une note sont listées, sans note elles ne le sont pas', () => {
  const truth = createTurnTruth();
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'a',
    title: 'career_offer_save',
    rawInput: { url: 'https://offres.example.test/a', score: 2 },
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'a', status: 'completed' });
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'b',
    title: 'career_offer_save',
    rawInput: { arguments: { url: 'https://offres.example.test/b' } },
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'b', status: 'completed' });
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'c',
    title: 'career_offer_save',
    rawInput: { arguments: { url: 'https://offres.example.test/c', score: 5 } },
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'c', status: 'failed' });
  assert.deepEqual(truth.scoredOffers(), [
    { url: 'https://offres.example.test/a', toolCallId: 'a' },
  ]);
  assert.equal(truth.hasOfferSave(), true);
  assert.deepEqual(
    truth.toolOutcomes().map((item) => item.status),
    ['completed', 'completed', 'failed'],
  );
});

test('Suivi du tour FICTIF : le pont de la passerelle transmet l’URL notée, une fois par offre', () => {
  const truth = createTurnTruth();
  truth.recordGatewayTool('career_offer_save', 'completed', {
    toolCallId: '11111111-1111-1111-1111-111111111111',
    scoredUrl: 'https://offres.example.test/a',
  });
  truth.recordGatewayTool('career_offer_save', 'completed', {
    toolCallId: '22222222-2222-2222-2222-222222222222',
  });
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'acp-1',
    title: 'career_offer_save',
    rawInput: { url: 'https://offres.example.test/a', score: 3 },
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: 'acp-1', status: 'completed' });
  assert.equal(truth.scoredOffers().length, 1);
  assert.equal(truth.scoredOffers()[0].url, 'https://offres.example.test/a');
});
