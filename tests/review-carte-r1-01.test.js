import test from 'node:test';
import assert from 'node:assert/strict';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { BrowserGateway } from '../packages/browser-gateway/index.js';
import { getCapability, capabilityIds } from '../packages/capability-registry/index.js';

// review-carte-r1-01 : relecture de carte-r1-01 (règle R1, E100). Libellés FICTIFS ou génériques,
// aucun site réel, aucun Chrome. `candidate` = l'écriture que le clic déclenche attend la carte ;
// `submit` = carte avant le clic ; `plain`, `widget`, `step` = pas de carte (sauf filet du chemin de
// soumission dans cdp.js).
const policy = new RunPolicy({ ownerMode: true, capabilities: ['browser.click'] });
const SHAPES = {
  hors: { tag: 'button', buttonType: 'button', inForm: false },
  deroulant: { tag: 'button', buttonType: 'button', inForm: false, ariaExpanded: 'false' },
  menu: { tag: 'button', buttonType: 'button', inForm: false, ariaHasPopup: 'menu' },
  entree: { tag: 'div', role: 'menuitem', inForm: false },
  roleButton: { tag: 'div', role: 'button', inForm: false },
  formulaire: { tag: 'button', buttonType: 'button', inForm: true },
  soumission: {
    tag: 'button',
    buttonType: 'submit',
    inForm: true,
    formMethod: 'post',
    formHasFile: false,
    formHasPassword: false,
    formCrossSite: false,
  },
};
const CARD = { hors: 'candidate', deroulant: 'candidate', menu: 'candidate', entree: 'candidate' };
CARD.roleButton = 'candidate';
CARD.formulaire = 'submit';
CARD.soumission = 'submit';
const kindsOf = (label, key = 'text') =>
  Object.fromEntries(
    Object.entries(SHAPES).map(([name, shape]) => [
      name,
      policy.ownerClickKind({ ...shape, [key]: label }),
    ]),
  );

// Point 1 : toutes les formes d'un vrai envoi gardent leur carte, dans toutes les formes de
// contrôle (comme avant R1, commit 694e0a2), menu compris (décision du manager).
const SEND_VERBS = [
  'Envoyer',
  'Envoyez',
  'Envoie',
  'Envoyé',
  'Envoyer la candidature',
  'Envoyer maintenant',
  'Envoyer le message',
  'Envoyer sans note',
  'Postuler',
  'Postulez',
  'Postuler maintenant',
  'Je postule',
  'Candidater',
  'Soumettre',
  'Soumettez',
  'Soumettre ma candidature',
  'Valider',
  'Validez',
  'Valider et envoyer',
  'Confirmer',
  'Confirmez',
  'Je confirme',
  'Confirmer l’envoi',
  "Confirmer l'envoi",
  'Finaliser',
  'Terminer',
  'Publier',
  'Publiez',
  'Répondre',
  'Déposer',
  'Transmettre',
  'Send',
  'Send now',
  'Send message',
  'Send without a note',
  'Sending',
  'Submit',
  'Submit application',
  'Apply',
  'Apply now',
  'Confirm',
  'Confirm and send',
  'Finish',
  'Publish',
  'Post',
  'Reply',
  'Done',
  'Validate',
  'Complete application',
  // Formes que R1 avait perdues (progressif) ou qui ne marchaient pas (« é » final, préfixe re-).
  'Confirming',
  'Publishing',
  'Validating',
  'Terminé',
  'Je termine',
  'Renvoyer',
  'Resend',
  'Republier',
  'Repost',
];

test('review-carte-r1-01 FICTIF : chaque forme d’un verbe d’envoi garde sa carte, menu compris', () => {
  const wrong = [];
  for (const label of SEND_VERBS) {
    const got = kindsOf(label);
    for (const [shape, expected] of Object.entries(CARD))
      if (got[shape] !== expected) wrong.push(`${label} / ${shape} : ${got[shape]}`);
  }
  assert.deepEqual(wrong, []);
});

// Point 2 : messagerie. Le libellé vient souvent de l'aria-label, avec un raccourci entre
// parenthèses (et parfois des marques de direction invisibles).
const MAIL_SENDS = [
  'Envoyer (⌘Entrée)',
  'Envoyer ‪(⌘Entrée)‬',
  'Send (Ctrl-Enter)',
  'Send ‪(Ctrl-Enter)‬',
  'Envoyer (Ctrl+Entrée)',
  'Programmer l’envoi',
  "Programmer l'envoi",
  'Planifier l’envoi',
  'Lancer l’envoi',
  'Schedule send',
  'Envoyer et archiver',
  'Send and archive',
  'Envoyer plus tard',
  'Send later',
];

test('review-carte-r1-01 FICTIF : boutons d’envoi d’une messagerie (texte ou aria-label)', () => {
  const wrong = [];
  for (const label of MAIL_SENDS)
    for (const key of ['text', 'ariaLabel']) {
      const got = kindsOf(label, key);
      for (const [shape, expected] of Object.entries(CARD))
        if (got[shape] !== expected) wrong.push(`${label} (${key}) / ${shape} : ${got[shape]}`);
    }
  assert.deepEqual(wrong, []);
  // Une icône sans texte dont seul l'aria-label dit l'envoi : même classement.
  assert.equal(
    policy.ownerClickKind({ tag: 'div', role: 'button', ariaLabel: 'Envoyer (⌘Entrée)' }),
    'candidate',
  );
});

// Point 5 et E100 : libellés d'une recherche de personnes, d'un profil et d'une recherche d'offres,
// en lecture : aucune carte, quelle que soit la forme (onglet, filtre déroulant, menu, lien).
const READ_ONLY = [
  'Personnes',
  'Posts',
  'Publications',
  'Tous les filtres',
  'Relations',
  'Lieux',
  'Entreprise actuelle',
  'Afficher les résultats',
  'Suivre',
  'Message',
  'Plus',
  'Voir le profil complet',
  'Date de publication',
  'Toutes les publications',
  'Soumission facile',
  'Date posted',
  'All posts',
  'Candidature simplifiée',
];
const READ_SHAPES = [
  { tag: 'button', buttonType: 'button', inForm: false },
  { tag: 'button', buttonType: 'button', inForm: false, ariaExpanded: 'false' },
  { tag: 'button', buttonType: 'button', inForm: false, ariaHasPopup: 'menu' },
  { tag: 'button', buttonType: 'button', inForm: false, role: 'tab' },
  { tag: 'div', role: 'menuitem', inForm: false },
  { tag: 'div', role: 'button', inForm: false },
  { tag: 'a', inForm: false },
];

test('review-carte-r1-01 FICTIF : recherche de personnes, profil, filtres E100 : aucune carte', () => {
  const wrong = [];
  for (const label of READ_ONLY)
    for (const shape of READ_SHAPES) {
      const got = policy.ownerClickKind({ ...shape, text: label });
      if (!['plain', 'widget'].includes(got))
        wrong.push(`${label} ${JSON.stringify(shape)} : ${got}`);
    }
  assert.deepEqual(wrong, []);
});

// Point 4 : ACTION_NOUNS refuse seulement l'exception d'étape ; il ne peut jamais retirer une
// carte. Un nom d'action ajouté à un libellé ne fait jamais passer un classement à carte
// (`candidate`, `submit`) à un classement sans carte.
test('review-carte-r1-01 FICTIF : un nom d’action ne retire jamais une carte', () => {
  const hasCard = (k) => k === 'candidate' || k === 'submit';
  const wrong = [];
  for (const label of [...SEND_VERBS, 'Suivant', 'Continuer', 'Ajouter', 'Oui', 'OK'])
    for (const noun of ['confirmation', 'validation', 'soumission', 'envoi', 'publication'])
      for (const shape of Object.values(SHAPES)) {
        const before = policy.ownerClickKind({ ...shape, text: label });
        const after = policy.ownerClickKind({ ...shape, text: `${label} ${noun}` });
        if (hasCard(before) && !hasCard(after)) wrong.push(`${label} + ${noun} : ${after}`);
      }
  assert.deepEqual(wrong, []);
  // Faux positifs bornés : une case « Confirmation » ou un onglet « Validation » ne sont pas des
  // étapes ; la case d'un formulaire est `candidate` (avant R1 : `submit`, carte avant le clic ;
  // depuis R1, ses écritures attendent la carte), l'onglet un widget.
  const box = { tag: 'input', inputType: 'checkbox', inForm: true, text: 'Confirmation' };
  assert.equal(policy.isFormStep(box), false);
  assert.equal(policy.ownerClickKind(box), 'candidate');
  assert.equal(policy.ownerClickKind({ tag: 'button', role: 'tab', text: 'Validation' }), 'widget');
  // Étape + nom d'action dans un formulaire : carte gardée (pas une étape).
  for (const text of ['Continuer la soumission', 'Ajouter un envoi', 'Suivant : confirmation'])
    assert.equal(policy.ownerClickKind({ ...SHAPES.formulaire, text }), 'candidate', text);
});

// Point 3 et 5, par le même chemin que l'agent (passerelle, mode propriétaire, fournisseur FICTIF).
const SEARCH = 'https://reseau.fictif.test/recherche';
async function call(capability, args, element, enterContext) {
  const performed = [];
  const approvals = [];
  const gateway = new BrowserGateway({
    provider: {
      name: 'fictif',
      currentUrl: async () => SEARCH,
      describe: async () => ({ ...element }),
      enterContext: async () => enterContext,
      perform: async (id, a) => {
        performed.push({ id, args: a });
        return { url: SEARCH };
      },
    },
    policy: new RunPolicy({
      ownerMode: true,
      capabilities: capabilityIds,
      resolveHost: async () => ['1.1.1.1'],
    }),
    approve: async (request) => {
      approvals.push(request);
      return false;
    },
  });
  const outcome = await gateway.call(capability, args).then(
    () => 'fait',
    () => 'refusé',
  );
  return { outcome, approvals: approvals.length, args: performed[0]?.args ?? null };
}

test('review-carte-r1-01 FICTIF, chemin de l’agent : invitation et message gardent leur carte', async () => {
  // « Se connecter » / « Connect » ouvrent la fenêtre d'invitation : clic sans carte.
  for (const text of ['Se connecter', 'Connect', 'Message', 'Suivre', 'Posts', 'Personnes']) {
    const click = await call('browser.click', { ref: 'e1' }, { tag: 'button', text });
    assert.equal(click.outcome, 'fait', text);
    assert.equal(click.approvals, 0, text);
    assert.notEqual(click.args.clickKind, 'candidate', text);
  }
  // L'envoi de l'invitation ou du message : ses écritures attendent la carte (cdp.js).
  for (const element of [
    { tag: 'button', text: 'Envoyer sans note' },
    { tag: 'button', ariaLabel: 'Send without a note' },
    { tag: 'button', text: 'Envoyer' },
    { tag: 'div', role: 'button', ariaLabel: 'Envoyer (⌘Entrée)' },
    { tag: 'div', role: 'menuitem', text: 'Envoyer maintenant' },
  ]) {
    const click = await call('browser.click', { ref: 'e1' }, element);
    assert.equal(click.args.clickKind, 'candidate', JSON.stringify(element));
  }
  // Dans un formulaire : carte avant le clic.
  const inForm = await call(
    'browser.click',
    { ref: 'e1' },
    { tag: 'button', buttonType: 'submit', inForm: true, text: 'Envoyer' },
  );
  assert.deepEqual([inForm.outcome, inForm.approvals], ['refusé', 1]);
});

test('review-carte-r1-01 FICTIF, clavier : Entrée qui envoie attend la carte, aucune combinaison', async () => {
  // Zone de message hors formulaire (textarea, contenteditable) : carte avant la touche.
  const message = await call(
    'browser.press',
    { ref: 'e1', key: 'Enter' },
    { tag: 'div', role: 'textbox' },
    { kind: 'message', autocomplete: false },
  );
  assert.deepEqual([message.outcome, message.approvals], ['refusé', 1]);
  // Fournisseur qui ne sait pas dire : carte avant la touche.
  const unknown = await call(
    'browser.press',
    { ref: 'e1', key: 'Enter' },
    { tag: 'div' },
    { kind: 'unknown' },
  );
  assert.deepEqual([unknown.outcome, unknown.approvals], ['refusé', 1]);
  // Autre champ hors formulaire : pas de carte avant, ses écritures l'attendent.
  const field = await call(
    'browser.press',
    { ref: 'e1', key: 'Enter' },
    { tag: 'input', inputType: 'text' },
    { kind: 'field', autocomplete: false },
  );
  assert.equal(field.args.clickKind, 'candidate');
  // Entrée sur une entrée de menu « Envoyer maintenant » : comme son clic.
  const entry = await call(
    'browser.press',
    { ref: 'e1', key: 'Enter' },
    { tag: 'div', role: 'menuitem', text: 'Envoyer maintenant' },
    { kind: 'control' },
  );
  assert.equal(entry.args.clickKind, 'candidate');
  // Ctrl/Cmd+Entrée : l'outil n'accepte aucune combinaison de touches.
  const schema = getCapability('browser.press').schema;
  for (const key of ['Control+Enter', 'Meta+Enter', 'ControlOrMeta+Enter', 'Shift+Enter'])
    assert.equal(schema.safeParse({ ref: 'e1', key }).success, false, key);
  assert.equal(schema.safeParse({ ref: 'e1', key: 'Enter', modifiers: ['Meta'] }).success, false);
});
