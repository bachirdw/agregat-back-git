import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurnTruth, formatCareerBilan } from '../packages/career-ops/truth.js';

// Audit 10/11, point 4 : ce que le prompt demande, lu sans effacer trop (négation bornée à sa
// proposition), au pluriel et en anglais. Aucune action n'est observée : le Bilan dit ce qui manque.
const bilan = (prompt) => formatCareerBilan(prompt, createTurnTruth());

test('Bilan : « Ne fais pas de brouillon mais envoie l’email » garde la demande d’envoi', () => {
  assert.match(
    bilan('Ne fais pas de brouillon mais envoie l’email à fictif@example.test'),
    /envoi de courriel/,
  );
  assert.match(bilan('N’écris rien puis envoie le courriel de suivi'), /envoi de courriel/);
  // Une vraie négation de l’envoi n’exige pas d’envoi.
  assert.doesNotMatch(bilan('N’envoie pas l’email, prépare-le seulement'), /envoi de courriel/);
});

test('Bilan : « candidatures » au pluriel demande un formulaire', () => {
  assert.match(bilan('Prépare mes candidatures'), /candidature \(aucun appel de formulaire\)/);
});

test('Bilan : prompts anglais courants (apply, evaluate, send email)', () => {
  assert.match(bilan('Apply to this job'), /candidature \(aucun appel de formulaire\)/);
  assert.match(
    bilan('Evaluate this job offer and save the score'),
    /Non exécuté[^\n]*évaluation enregistrée/,
  );
  assert.match(bilan('Send an email to fictif@example.test'), /envoi de courriel/);
  assert.doesNotMatch(
    bilan('Evaluate this job offer but do not save anything'),
    /évaluation enregistrée/,
  );
});

test('progressArgument : seul « scan » vaut le scan des portails', async () => {
  const { progressArgument } = await import('../packages/career-ops/truth.js');
  assert.equal(progressArgument('career_script', { command: 'scan' }), 'scan');
  assert.equal(progressArgument('career_script', { command: 'rescan-x' }), 'rescan-x');
  assert.equal(progressArgument('career_script', { command: 'scripts/scan-foo.mjs' }), null);
});

test('failedActions : un succès ultérieur du même outil n’efface pas l’échec (relecture 10/11, constat 3)', () => {
  const truth = createTurnTruth();
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  truth.recordGatewayTool('browser_click', 'failed', { toolCallId: a });
  assert.deepEqual(
    truth.failedActions().map((item) => item.name),
    ['browser_click'],
  );
  truth.recordGatewayTool('browser_click', 'completed', { toolCallId: b });
  assert.deepEqual(truth.failedActions(), [
    { name: 'browser_click', cause: 'échec signalé par l’outil', failures: 1, recovered: true },
  ]);
  truth.recordGatewayTool('email_send', 'failed', { toolCallId: 'm1' });
  truth.recordGatewayTool('email_send', 'completed', { toolCallId: 'm2', sent: true });
  assert.equal(truth.failedActions().find((item) => item.name === 'email_send')?.recovered, true);
  // Le même appel qui finit par réussir (mise à jour rejouée) efface bien son échec.
  truth.recordGatewayTool('browser_type', 'failed', { toolCallId: 'same' });
  truth.recordGatewayTool('browser_type', 'completed', { toolCallId: 'same' });
  assert.equal(
    truth.failedActions().find((item) => item.name === 'browser_type'),
    undefined,
  );
  const acp = createTurnTruth();
  const call = (id, status) => {
    acp.observe({ sessionUpdate: 'tool_call', toolCallId: id, title: 'browser_click' });
    acp.observe({ sessionUpdate: 'tool_call_update', toolCallId: id, status });
  };
  call('x1', 'failed');
  assert.equal(acp.failedActions().length, 1);
  call('x2', 'completed');
  assert.deepEqual(acp.failedActions(), [
    { name: 'browser_click', cause: 'échec signalé par l’outil', failures: 1, recovered: true },
  ]);
  call('x3', 'failed');
  assert.deepEqual(acp.failedActions(), [
    { name: 'browser_click', cause: 'échec signalé par l’outil', failures: 2 },
  ]);
});

test('formatFailedActions : l’échec reste dit, même suivi d’un succès (constat 3)', async () => {
  const { formatFailedActions } = await import('../packages/career-ops/truth.js');
  const truth = createTurnTruth();
  truth.recordGatewayTool('browser_click', 'failed', { toolCallId: 'c1' });
  truth.recordGatewayTool('browser_click', 'completed', { toolCallId: 'c2' });
  truth.recordGatewayTool('email_send', 'failed', { toolCallId: 'm1' });
  truth.recordGatewayTool('email_send', 'failed', { toolCallId: 'm2' });
  assert.equal(
    formatFailedActions(truth.failedActions()),
    'Action(s) échouée(s) : browser_click — échec signalé par l’outil, 1 échoué puis réussi ; email_send — échec signalé par l’outil (2 échecs)',
  );
});
