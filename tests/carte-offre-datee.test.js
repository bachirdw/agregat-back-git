import test from 'node:test';
import assert from 'node:assert/strict';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';

// E93 (essais réels du 11/11, LinkedIn) : la carte d'une offre dans une liste de résultats est un
// bouton dont le libellé reprend toute la carte ; « Publication il y a 2 semaines » en faisait un
// bouton d'envoi, et chaque écriture de la page après le clic demandait une carte au propriétaire.
const policy = new RunPolicy({ ownerMode: true, capabilities: ['browser.click'] });
const kind = (text, more = {}) => policy.ownerClickKind({ tag: 'button', text, ...more });

test('E93 FICTIF : une carte d’offre datée ou longue n’est pas un bouton d’envoi', () => {
  for (const label of [
    'AI Developer (offre d’emploi vérifiée) Exemple FICTIF Sydney, NSW (Sur site) Ignorer l’offre d’emploi AI Developer Évaluation des candidatures en cours Publication il y a 2 semaines · Candidature simplifiée',
    'AI Engineer Exemple FICTIF Publication il y a 2 semaines',
    'Data Engineer · Posted 3 days ago',
    'Publié hier · Exemple FICTIF',
    'Republié il y a 3 jours',
    'Published on 3 November',
  ])
    assert.equal(kind(label), 'plain', label);
});

test('E93 FICTIF : un vrai libellé d’envoi garde sa carte', () => {
  for (const label of [
    'Publier',
    'Post',
    'Publier le commentaire',
    'Publish on LinkedIn',
    'Postuler',
    'Envoyer ma candidature',
    'Publication il y a 2 jours · Postuler',
  ])
    assert.equal(kind(label), 'candidate', label);
  assert.equal(kind('Publier', { inForm: true }), 'submit');
  // Le déclencheur de soumission d'un formulaire reste l'envoi, quel que soit son libellé.
  assert.equal(
    kind('x'.repeat(200), { buttonType: 'submit', inForm: true, formMethod: 'post' }),
    'submit',
  );
});
