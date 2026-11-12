// audit-suite-02 (audit du 12/11, constat non contredit) : une négation du prompt ne couvre que sa
// proposition dans le choix de l'intention du Skill. Elle s'arrête à « et », « mais », « puis » et
// aux deux-points, comme dans truth.js ; la partie affirmative garde son intention.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSkillManifest, selectSkillIntents } from '../packages/orchestrator/skill-router.js';

const manifest = loadSkillManifest('career-ops');
const ids = (prompt) => selectSkillIntents(prompt, [manifest]).map((x) => x.intent.id);

test('négation suivie d’une proposition affirmative : l’intention affirmative est choisie', () => {
  for (const [prompt, intent] of [
    ['Ne clique pas sur Envoyer et prépare ma candidature pour l’offre du rapport 010.', 'apply'],
    [
      'N’envoie rien : prépare ma candidature pour l’offre du rapport 010 et joins mon CV adapté.',
      'apply',
    ],
    ['Ne lance pas le scan et cherche des offres data engineer sur SEEK.', 'search'],
    ['Ne clique pas sur Envoyer mais prépare ma candidature pour l’offre du rapport 010.', 'apply'],
    ['Ne lance pas le scan puis cherche des offres data engineer sur SEEK.', 'search'],
  ])
    assert.ok(ids(prompt).includes(intent), `${prompt} → ${JSON.stringify(ids(prompt))}`);
});

test('la négation garde sa propre proposition : rien n’est choisi pour une demande seulement niée', () => {
  for (const prompt of ['Ne lance pas le scan.', 'N’envoie pas la candidature.'])
    assert.deepEqual(ids(prompt), [], prompt);
});
