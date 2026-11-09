import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTurnTruth } from '../packages/career-ops/truth.js';

// Audit 10/11, point 5 : un rapport déjà noté avant la mission, réécrit avec la même note
// (statut du suivi, note de candidature), n'est pas une offre « notée » pendant la mission.
const URL_A = 'https://offres.example.test/a';
const report = (score, url = URL_A) =>
  `# Rapport FICTIF\n\n**Score:** ${score}/5\n**URL:** ${url}\n\nCorps.\n`;
function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'rescore-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'reports'));
  writeFileSync(join(root, 'reports/005-fictive-2026-11-10.md'), report('4.2'));
  return root;
}
const writeReport = (truth, id, text) => {
  truth.observe({
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: 'career_write',
    rawInput: { path: 'reports/005-fictive-2026-11-10.md', text },
  });
  truth.observe({ sessionUpdate: 'tool_call_update', toolCallId: id, status: 'completed' });
};

test('Suivi du tour FICTIF : un rapport réécrit avec la même note n’est pas une offre notée de la mission', (t) => {
  const root = workspace(t);
  const truth = createTurnTruth({ root });
  writeReport(truth, 'w1', report('4.2'));
  assert.deepEqual(truth.scoredOffers(), []);
  // Même cas par le pont de la passerelle.
  truth.recordGatewayTool('career_write', 'completed', {
    toolCallId: '11111111-1111-1111-1111-111111111111',
    argument: 'reports/',
    scoredUrl: URL_A,
  });
  assert.deepEqual(truth.scoredOffers(), []);
});

test('Suivi du tour FICTIF : un rapport nouveau ou re-noté reste une offre notée', (t) => {
  const root = workspace(t);
  const truth = createTurnTruth({ root });
  writeFileSync(join(root, 'reports/005-fictive-2026-11-10.md'), report('3.0'));
  writeReport(truth, 'w1', report('3.0'));
  const other = 'https://offres.example.test/b';
  writeFileSync(join(root, 'reports/006-autre-2026-11-10.md'), report('2.5', other));
  writeReport(truth, 'w2', report('2.5', other));
  assert.deepEqual(
    truth
      .scoredOffers()
      .map((offer) => offer.url)
      .sort(),
    [URL_A, other],
  );
});
