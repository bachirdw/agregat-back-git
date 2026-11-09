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
