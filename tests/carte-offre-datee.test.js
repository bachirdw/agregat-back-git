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

// Audit du 12/11 : « Je candidate » hors formulaire était un clic ordinaire ; « candidate » nom
// (« View candidate ») le reste.
test('Audit FICTIF : « Je candidate » est un libellé d’envoi, « View candidate » non', () => {
  assert.notEqual(kind('Je candidate'), 'plain');
  assert.notEqual(kind('Je candidate à cette offre'), 'plain');
  assert.equal(kind('View candidate'), 'plain');
  assert.equal(kind('Profil candidate'), 'plain');
});

// carte-r1-01 (E100, étude carte-envoi-etude-01) : classification figée des libellés du corpus
// (registre E89, E93, E100, cas C1 à C25 qui ont un libellé), en français et en anglais. Chaque
// ligne donne le classement de `ownerClickKind` pour six formes de contrôle, dans cet ordre :
// 1 bouton hors formulaire ; 2 le même avec aria-expanded="false" (filtre déroulant) ; 3 avec
// aria-haspopup="menu" ; 4 entrée de menu (role="menuitem") ; 5 bouton type=button dans un
// formulaire ; 6 bouton de soumission d'un formulaire POST du même site.
// c = candidate, s = submit, p = plain, w = widget, t = step. Libellés FICTIFS ou génériques.
const SHAPES = [
  { tag: 'button', buttonType: 'button', inForm: false },
  { tag: 'button', buttonType: 'button', inForm: false, ariaExpanded: 'false' },
  { tag: 'button', buttonType: 'button', inForm: false, ariaHasPopup: 'menu' },
  { tag: 'div', role: 'menuitem', inForm: false },
  { tag: 'button', buttonType: 'button', inForm: true },
  {
    tag: 'button',
    buttonType: 'submit',
    inForm: true,
    formMethod: 'post',
    formHasFile: false,
    formHasPassword: false,
    formCrossSite: false,
  },
];
const CODE = { candidate: 'c', submit: 's', plain: 'p', widget: 'w', step: 't' };
const codes = (text) =>
  SHAPES.map((shape) => CODE[policy.ownerClickKind({ ...shape, text })]).join('');
const TABLE = [
  // Vrais gestes d'envoi (C1, C12, C16, C19, C22, A7) : carte gardée.
  ['Envoyer la candidature', 'ccccss'],
  ['Soumettre la candidature', 'ccccss'],
  ['Submit application', 'ccccss'],
  ['Submit', 'ccccss'],
  ['Postuler', 'ccccss'],
  ['Publier', 'ccccss'],
  ['Envoyer', 'ccccss'],
  ['Send', 'ccccss'],
  ['Apply', 'ccccss'],
  ['Apply now', 'ccccss'],
  ['Envoyez ma candidature', 'ccccss'],
  ['Je postule', 'ccccss'],
  ['Je candidate', 'ccccss'],
  ['Terminer', 'ccccss'],
  ['Finish', 'ccccss'],
  ['Done', 'ccccss'],
  ['Valider', 'ccccss'],
  ['Validez', 'ccccss'],
  ['Confirmer', 'ccccss'],
  ['Je confirme', 'ccccss'],
  ['Déposer', 'ccccss'],
  ['Publish', 'ccccss'],
  ['Post', 'ccccss'],
  ['Reply', 'ccccss'],
  ['Répondre', 'ccccss'],
  ['Envoyer le message', 'ccccss'],
  ['Send message', 'ccccss'],
  // E100 (C9) : filtres d'une recherche en lecture seule.
  ['Date de publication', 'ccccss'],
  ['Toutes les publications', 'ccccss'],
  ['Soumission facile', 'ccccss'],
  ['Easy Apply', 'ccccss'],
  ['Candidature simplifiée', 'pwwwcs'],
  ['Date posted', 'pwwwcs'],
  ['All posts', 'pwwwcs'],
  ['Posts', 'pwwwcs'],
  // Noms d'action (ni verbe ni envoi).
  ['Publications', 'ccccss'],
  ['Publication', 'ccccss'],
  ['Published', 'ccccss'],
  ['Publié', 'ccccss'],
  ['Envoi', 'ccccss'],
  ['Envoi de CV', 'ccccss'],
  ['Validation', 'ccccss'],
  ['Confirmation', 'ccccss'],
  ['Finalisation', 'ccccss'],
  ['Submission', 'pwwwcs'],
  ['Sender', 'ccccss'],
  ['Dépôt', 'pwwwcs'],
  // Libellés inconnus (A7, C10), filtres et recherche (C20), étapes (C3, C11, C20).
  ['Oui', 'pwwwcs'],
  ['OK', 'pwwwcs'],
  ['Apply filters', 'pwwwcs'],
  ['Rechercher', 'pwwwcs'],
  ['Suivant', 'tttwtt'],
  ['Next', 'tttwtt'],
  ['Continue', 'tttwtt'],
  ['Ajouter une expérience', 'tttwts'],
  ['Add experience', 'tttwts'],
  ['Supprimer cette expérience', 'ccccst'],
  // E93 (C8) : carte d'offre datée, courte ou de plus de 120 caractères.
  ['Publication il y a 2 jours · Postuler', 'ccccss'],
  ['AI Engineer Exemple FICTIF Publication il y a 2 semaines · Candidature simplifiée', 'pwwwcs'],
  [
    'Offre FICTIVE Développeur Exemple FICTIF Sydney (Sur site) Évaluation des candidatures en cours Publication il y a 2 semaines · Candidature simplifiée · Postuler',
    'pwwwcs',
  ],
];

test('carte-r1-01 FICTIF : table des libellés du corpus, six formes de contrôle', () => {
  const wrong = TABLE.filter(([label, expected]) => codes(label) !== expected).map(
    ([label, expected]) => `${label} : attendu ${expected}, obtenu ${codes(label)}`,
  );
  assert.deepEqual(wrong, []);
});
