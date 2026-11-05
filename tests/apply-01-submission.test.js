// apply-01, point 2 (E42, E26) : résumé d'une soumission de formulaire pour la carte d'accord, sans
// Chrome : libellé du bouton, action (hôte + chemin), multipart, champs remplis, pièce jointe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeSubmission } from '../packages/browser-gateway/submission.js';

const button = { tag: 'button', text: 'Envoyer', inForm: true };

test('résumé : libellé, hôte + chemin, méthode, champs remplis, aucun champ fichier', () => {
  const summary = summarizeSubmission(
    {
      page: 'http://127.0.0.1:4321/step3',
      title: 'Candidature FICTIVE — étape 3/3',
      action: 'http://127.0.0.1:4321/submit?x=1',
      method: 'post',
      enctype: 'application/x-www-form-urlencoded',
      fields: [
        {
          name: 'disponibilite',
          type: 'select-one',
          value: 'Sous un mois',
          checked: false,
          files: [],
        },
        { name: 'motivation', type: 'textarea', value: '', checked: false, files: [] },
        { name: 'accord', type: 'checkbox', value: 'on', checked: true, files: [] },
        { name: 'token', type: 'hidden', value: '[masqué]', checked: false, files: [] },
        { name: '', type: 'submit', value: 'Envoyer', checked: false, files: [] },
      ],
    },
    button,
  );
  assert.equal(summary.label, 'Envoyer');
  assert.deepEqual(summary.action, { host: '127.0.0.1:4321', path: '/submit' });
  assert.equal(summary.method, 'POST');
  assert.equal(summary.multipart, false);
  assert.deepEqual([summary.filled, summary.total], [2, 3], 'hidden et submit ne comptent pas');
  assert.equal(summary.attachment, null);
  assert.deepEqual(summary.fileFields, []);
  assert.equal(
    summary.text,
    'Soumettre « Envoyer » → 127.0.0.1:4321/submit · POST · 2 champs remplis sur 3',
  );
  // Jamais la valeur d'un champ ni le titre de la page dans le résumé.
  assert.doesNotMatch(JSON.stringify(summary), /Sous un mois|masqué|étape 3/);
});

test('résumé : multipart et champ fichier vide (clic avant upload), puis pièce jointe', () => {
  const step2 = {
    action: 'http://127.0.0.1:4321/step3',
    method: 'post',
    enctype: 'multipart/form-data',
    fields: [
      { name: 'cv', type: 'file', value: '', checked: false, files: [] },
      { name: '', type: 'submit', value: '', checked: false, files: [] },
    ],
  };
  const empty = summarizeSubmission(step2, { tag: 'button', text: 'Suivant →', inForm: true });
  assert.equal(empty.label, 'Suivant →');
  assert.equal(empty.multipart, true);
  assert.equal(empty.attachment, 'champ fichier vide');
  assert.deepEqual(empty.fileFields, [{ name: 'cv', files: [] }]);
  assert.equal(
    empty.text,
    'Soumettre « Suivant → » → 127.0.0.1:4321/step3 · POST multipart · champ fichier vide',
  );
  const attached = summarizeSubmission(
    {
      ...step2,
      fields: [
        {
          ...step2.fields[0],
          files: [{ name: 'cv-FICTIF.pdf', size: 12, type: 'application/pdf' }],
        },
        step2.fields[1],
      ],
    },
    { tag: 'button', text: '', ariaLabel: 'Continuer la candidature', inForm: true },
  );
  assert.equal(attached.label, 'Continuer la candidature', 'aria-label quand le texte manque');
  assert.equal(attached.attachment, 'cv-FICTIF.pdf');
  assert.match(attached.text, /pièce jointe : cv-FICTIF\.pdf$/);
});

test('résumé : bouton sans libellé, formulaire sans action, aperçu absent', () => {
  const summary = summarizeSubmission(
    { action: null, method: null, enctype: null, fields: [] },
    { tag: 'input', inputType: 'image', text: '', inForm: true },
  );
  assert.equal(summary.label, null);
  assert.equal(summary.action, null);
  assert.equal(summary.text, 'Soumettre (bouton sans libellé) · GET');
  assert.equal(summarizeSubmission(null, button), null);
  const long = summarizeSubmission(
    { action: 'https://x.example.test/a', method: 'post', fields: [] },
    {
      tag: 'button',
      text: 'x'.repeat(300),
    },
  );
  assert.equal(long.label.length, 80);
});
