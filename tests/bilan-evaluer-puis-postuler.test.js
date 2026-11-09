// Audit EN du 10/11 (point 3) : « Évalue cette offre et postule si elle dépasse 4/5 » / « Evaluate and
// apply » ne suit que l'intention evaluate (une seule intention par mission). Le Bilan ne réclame pas
// la candidature (la condition peut ne pas être remplie) et ne la dit pas « non demandée » : il dit
// qu'elle est hors du suivi de l'intention et ce que les appels de formulaire montrent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSkillIntents } from '../packages/orchestrator/skill-router.js';
import { getPack } from '../packages/orchestrator/packs.js';
import { createTurnTruth, formatCareerBilan } from '../packages/career-ops/truth.js';

const manifest = getPack('career-ops').skillManifest;
const PROMPTS = [
  'Évalue cette offre https://acme.com/jobs/1 et postule si elle dépasse 4/5',
  'Evaluate this job https://acme.com/jobs/1 and apply if the score is above 4/5',
  'Evaluate this job https://acme.com/jobs/1 and apply',
];
const published = (prompt) => {
  const intent = selectSkillIntents(prompt, [manifest])[0].intent;
  assert.equal(intent.id, 'evaluate', prompt);
  return intent.steps.map((step) => ({
    title: step.title,
    state: 'pending',
    optional: step.optional,
    exempt: false,
    proves: step.proves ?? null,
  }));
};

for (const prompt of PROMPTS)
  test(`Bilan : ${prompt}`, () => {
    const bilan = formatCareerBilan(prompt, createTurnTruth(), undefined, published(prompt));
    assert.doesNotMatch(bilan, /Non exécuté :[^\n]*candidature/);
    assert.doesNotMatch(bilan, /non demandée/i);
    assert.match(
      bilan,
      /\n- Candidature : hors du suivi de l’intention choisie ; aucun appel de formulaire observé\./,
    );
    const truth = createTurnTruth();
    truth.recordGatewayTool('browser_fillForm', 'completed', {});
    assert.match(
      formatCareerBilan(prompt, truth, undefined, published(prompt)),
      /\n- Candidature : hors du suivi de l’intention choisie ; appel de formulaire observé \(browser_fillForm\)\./,
    );
  });

test('Bilan : une évaluation sans mot de candidature n’ajoute pas la ligne', () => {
  const prompt = 'Évalue cette offre https://acme.com/jobs/1';
  assert.doesNotMatch(
    formatCareerBilan(prompt, createTurnTruth(), undefined, published(prompt)),
    /Candidature :/,
  );
});

// Relecture du 10/11 (constat 7) : une question n'est pas une demande de candidature, et une frappe
// de recherche (browser_type) n'est pas un appel de formulaire de candidature.
for (const prompt of [
  'Should I apply? https://acme.com/jobs/1',
  'Is this a good fit? Tell me before I apply https://acme.com/jobs/1',
  'Dois-je postuler ? https://acme.com/jobs/1',
])
  test(`Bilan : sans ligne de candidature pour la question « ${prompt} »`, () => {
    const intent = selectSkillIntents(prompt, [manifest])[0].intent;
    const steps = intent.steps.map((step) => ({
      title: step.title,
      state: 'pending',
      optional: step.optional,
      exempt: false,
      proves: step.proves ?? null,
    }));
    const truth = createTurnTruth();
    truth.recordGatewayTool('browser_type', 'completed', {});
    assert.doesNotMatch(formatCareerBilan(prompt, truth, undefined, steps), /Candidature :/);
  });

test('Bilan : browser_type seul n’est pas cité comme appel de formulaire', () => {
  const prompt = 'Evaluate this job https://acme.com/jobs/1 and apply';
  const truth = createTurnTruth();
  truth.recordGatewayTool('browser_type', 'completed', {});
  const bilan = formatCareerBilan(prompt, truth, undefined, published(prompt));
  assert.doesNotMatch(bilan, /browser_type/);
  assert.match(bilan, /aucun appel de formulaire observé/);
});
