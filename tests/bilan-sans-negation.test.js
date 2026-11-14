// cartes-14-11 (D) : mission réelle du 14/11 (recherche d'offres) : le prompt disait « sans rien
// envoyer » et le Bilan écrivait « Non exécuté : … envoi de courriel », comme si l'envoi avait été
// demandé. « sans » nie sa proposition, comme « ne … pas » ; « sans oublier », « sans faute »,
// « sans attendre », « sans tarder » ne nient rien. Prompts FICTIFS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTurnTruth,
  formatCareerBilan,
  ordersAction,
  withoutNegations,
} from '../packages/career-ops/truth.js';

const MISSING = /Non exécuté :[^\n]*envoi de courriel/;

test('D : « sans rien envoyer », « sans envoyer de courriel » ne demandent aucun courriel', () => {
  const prompts = [
    'Cherche des offres FICTIVES et note-les, sans rien envoyer par e-mail.',
    'Trouve trois offres FICTIVES sans envoyer de courriel au recruteur.',
    'Sans envoyer aucun e-mail, liste les offres FICTIVES.',
  ];
  for (const prompt of prompts) {
    assert.doesNotMatch(formatCareerBilan(prompt, createTurnTruth()), MISSING, prompt);
    assert.equal(ordersAction(prompt), false, prompt);
  }
});

test('D : « sans » ne couvre que sa proposition', () => {
  const prompt = 'Lis l’offre FICTIVE sans la noter, puis envoie un courriel FICTIF au recruteur.';
  assert.match(withoutNegations(prompt), /envoie un courriel/);
  assert.match(formatCareerBilan(prompt, createTurnTruth()), MISSING);
  assert.equal(ordersAction(prompt), true);
});

test('D : « sans oublier », « sans faute », « sans attendre », « sans tarder » ne nient rien', () => {
  const prompts = [
    'Envoie le courriel FICTIF au recruteur sans oublier la pièce jointe.',
    'Envoie le courriel FICTIF au recruteur sans faute demain.',
    'Envoie le courriel FICTIF au recruteur sans attendre.',
    'Envoie un courriel FICTIF au recruteur sans tarder.',
  ];
  for (const prompt of prompts) {
    assert.match(formatCareerBilan(prompt, createTurnTruth()), MISSING, prompt);
    assert.equal(ordersAction(prompt), true, prompt);
  }
});

test('D : « sans » n’est lu que comme un mot entier', () => {
  const prompt = 'Envoie un courriel FICTIF aux paysans du village FICTIF.';
  assert.equal(withoutNegations(prompt), prompt);
  assert.match(formatCareerBilan(prompt, createTurnTruth()), MISSING);
});
