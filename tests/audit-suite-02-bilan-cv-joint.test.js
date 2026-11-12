// audit-suite-02 (audit du 12/11, constat non contredit) : avec l'intention `apply` choisie, joindre
// un CV déjà produit n'est pas une demande de document. Le Bilan ne dit plus « Non exécuté :
// rédaction de document » ; l'intention qui déclare la production du CV comme obligatoire la réclame
// toujours, et sans intention les mots du prompt décident comme avant. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSkillManifest, selectSkillIntents } from '../packages/orchestrator/skill-router.js';
import { createTurnTruth, formatCareerBilan } from '../packages/career-ops/truth.js';

const manifest = loadSkillManifest('career-ops');
const PROMPT =
  'Prépare ma candidature pour l’offre FICTIVE du rapport 010 et joins mon CV adapté, arrête-toi avant l’envoi.';
const stepsOf = (id, done = []) =>
  manifest.intents
    .find((intent) => intent.id === id)
    .steps.map((step) => ({ ...step, state: done.includes(step.id) ? 'done' : 'pending' }));
const applyTruth = () => {
  const truth = createTurnTruth();
  for (const name of ['browser_navigate', 'browser_fillForm', 'browser_upload'])
    truth.recordGatewayTool(name, 'completed', {});
  return truth;
};

test('intention apply, CV déjà produit joint : pas de « rédaction de document » non exécutée', () => {
  assert.deepEqual(
    selectSkillIntents(PROMPT, [manifest]).map((x) => x.intent.id),
    ['apply'],
  );
  const bilan = formatCareerBilan(
    PROMPT,
    applyTruth(),
    manifest,
    stepsOf('apply', ['fill', 'upload']),
  );
  assert.doesNotMatch(bilan, /Non exécuté :[^\n]*rédaction de document/);
});

test('sans intention choisie, les mots du prompt décident toujours (aucun changement)', () => {
  assert.match(
    formatCareerBilan(PROMPT, applyTruth(), manifest),
    /Non exécuté :[^\n]*rédaction de document/,
  );
});

test('intention documents (CV obligatoire) : la rédaction non faite reste dite', () => {
  const prompt = 'Prépare mon CV adapté pour l’offre FICTIVE du rapport 010.';
  assert.ok(selectSkillIntents(prompt, [manifest]).some((x) => x.intent.id === 'documents'));
  assert.match(
    formatCareerBilan(prompt, createTurnTruth(), manifest, stepsOf('documents')),
    /Non exécuté :[^\n]*rédaction de document/,
  );
});
