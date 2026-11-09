import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSkillIntents } from '../packages/orchestrator/skill-router.js';
import { getPack } from '../packages/orchestrator/packs.js';

// Audit du 10/11 (essai réel du soir) : « Postule à l'offre du rapport 005 … joins mon CV adapté à
// cette offre … puis clique sur Envoyer » suivait `documents` (70, phrase « cv adapté ») au lieu de
// `apply` (60) : la candidature est partie, puis la mission a fini `failed` (étapes payload/HTML/PDF
// du CV non exécutées). Un verbe de candidature fait désormais gagner `apply` ; un CV adapté « pour
// ma candidature » reste des documents. Constat 5 : « Candidate à cette offre » et l'anglais courant.
// Prompts FICTIFS.
const manifest = getPack('career-ops').skillManifest;
const intentOf = (prompt) => selectSkillIntents(prompt, [manifest])[0]?.intent.id;

test('audit 10/11 FICTIF : un verbe de candidature fait gagner apply devant un CV adapté', () => {
  assert.equal(
    intentOf(
      "Postule à l'offre du rapport 005 via le formulaire FICTIF http://127.0.0.1:4321/ : remplis les trois étapes avec mon profil, joins mon CV adapté à cette offre, réponds aux questions, puis clique sur Envoyer.",
    ),
    'apply',
  );
  assert.equal(intentOf('Postuler à cette offre FICTIVE avec un CV adapté'), 'apply');
  assert.equal(intentOf('Envoie ma candidature avec mon CV adapté'), 'apply');
  assert.equal(intentOf('Candidate à cette offre https://example.com/careers/123'), 'apply');
  assert.equal(intentOf('Candidater à cette offre FICTIVE avec une lettre de motivation'), 'apply');
  assert.equal(intentOf('Apply to this job with a tailored CV (cv adapté)'), 'apply');
  assert.equal(intentOf('Apply for this role, joins mon CV adapté'), 'apply');
  assert.equal(
    getPack('auto', 'Candidate à cette offre https://example.com/careers/123').id,
    'career-ops',
  );
});

test('audit 10/11 FICTIF : adapter un CV pour une candidature reste des documents', () => {
  assert.equal(intentOf('Adapte mon CV pour ma candidature'), 'documents');
  assert.equal(intentOf('Prépare-moi un CV adapté pour cette offre'), 'documents');
  assert.equal(intentOf('Adapte mon CV pour postuler à cette offre FICTIVE'), 'documents');
  assert.equal(intentOf('Ne postule pas, adapte mon CV'), 'documents');
});
