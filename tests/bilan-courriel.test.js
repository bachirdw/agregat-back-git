// E26 : le Bilan d'une candidature disait « Non exécuté : envoi de courriel » parce que le prompt
// citait le champ « e-mail » du profil et le bouton « Envoyer » du formulaire (essai V1, 06/11).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurnTruth, formatCareerBilan } from '../packages/career-ops/truth.js';

const MISSING = /Non exécuté :[^\n]*envoi de courriel/;

test('E26 : champ e-mail et bouton « Envoyer » ne demandent aucun courriel', () => {
  const prompts = [
    "Postule à l'offre FICTIVE sur le site de test local. Remplis chaque étape avec mon profil (nom, e-mail, téléphone), joins le PDF du CV, coche l'accord, puis clique sur Envoyer : la plateforme me demandera le clic final.",
    'Remplis le champ e-mail du formulaire FICTIF puis clique sur « Envoyer ».',
    'Clique sur Envoyer et vérifie ton e-mail de confirmation FICTIF.',
    "N'envoie aucun e-mail au recruteur FICTIF.",
    "Prépare un brouillon d'e-mail FICTIF, ne l'envoie pas.",
  ];
  for (const prompt of prompts)
    assert.doesNotMatch(formatCareerBilan(prompt, createTurnTruth()), MISSING, prompt);
});

test('E26 : un courriel demandé reste dit « non exécuté » sans envoi', () => {
  const prompts = [
    'Envoie un courriel FICTIF au recruteur.',
    'Envoie ma candidature FICTIVE par e-mail au recruteur.',
    'Écris un mail FICTIF au recruteur et envoie-le.',
    'Voici un courriel FICTIF à envoyer au recruteur.',
    'Send an email to the FICTIF recruiter.',
  ];
  for (const prompt of prompts)
    assert.match(formatCareerBilan(prompt, createTurnTruth()), MISSING, prompt);
  const sent = createTurnTruth();
  sent.recordGatewayTool('email_send', 'completed', { sent: true });
  assert.doesNotMatch(formatCareerBilan('Envoie un courriel FICTIF au recruteur.', sent), MISSING);
});
