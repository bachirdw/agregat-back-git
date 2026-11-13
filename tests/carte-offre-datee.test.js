import test from 'node:test';
import assert from 'node:assert/strict';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { BrowserGateway } from '../packages/browser-gateway/index.js';
import { CdpBrowser } from '../packages/browser-gateway/cdp.js';
import { capabilityIds } from '../packages/capability-registry/index.js';

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

// carte-r1-01 (E100, étude carte-envoi-etude-01, règle R1) : classification figée des libellés du
// corpus (registre E89, E93, E100, cas C1 à C25 qui ont un libellé), en français et en anglais.
// Avant R1, la table figeait le classement d'alors (commit 694e0a2) ; R1 retire les noms d'action
// des listes (« publication », « soumission », « envoi », « validation »…). review-carte-r1-01
// (décision du manager) : un bouton à menu ou une entrée de menu qui dit un VERBE d'envoi reste
// `candidate` comme avant R1 ; sans verbe d'envoi, c'est un widget. Chaque
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
  ['Date de publication', 'pwwwcs'],
  ['Toutes les publications', 'pwwwcs'],
  ['Soumission facile', 'pwwwcs'],
  ['Easy Apply', 'ccccss'],
  ['Candidature simplifiée', 'pwwwcs'],
  ['Date posted', 'pwwwcs'],
  ['All posts', 'pwwwcs'],
  ['Posts', 'pwwwcs'],
  // Noms d'action (ni verbe ni envoi).
  ['Publications', 'pwwwcs'],
  ['Publication', 'pwwwcs'],
  ['Published', 'pwwwcs'],
  ['Publié', 'pwwwcs'],
  ['Envoi', 'pwwwcs'],
  ['Envoi de CV', 'pwwwcs'],
  ['Validation', 'pwwwcs'],
  ['Confirmation', 'pwwwcs'],
  ['Finalisation', 'pwwwcs'],
  ['Submission', 'pwwwcs'],
  ['Sender', 'pwwwcs'],
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
  // Étape + nom d'action : jamais une étape (comme avant R1) ; hors formulaire, un clic ordinaire.
  ['Continuer vers la validation', 'pwwwcs'],
  ['Continuer la soumission', 'pwwwcs'],
  ['Suivant : confirmation', 'pwwwcs'],
  ['Continue to confirmation', 'pwwwcs'],
  ['Ajouter un envoi', 'pwwwcs'],
  ['Ajouter une publication', 'pwwwcs'],
  ['Next: submission', 'tttwts'],
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

test('carte-r1-01 FICTIF : le bouton de soumission d’un formulaire reste l’envoi, ARIA ou pas', () => {
  for (const extra of [
    {},
    { ariaHasPopup: 'dialog' },
    { ariaHasPopup: 'menu' },
    { ariaExpanded: 'false' },
    { role: 'menuitem' },
  ]) {
    for (const text of ['Envoyer', 'Date de publication', 'Soumission facile', 'OK', '']) {
      const d = { tag: 'button', buttonType: 'submit', inForm: true, text, ...extra };
      assert.equal(policy.ownerClickKind(d), 'submit', JSON.stringify(d));
      const input = { tag: 'input', inputType: 'submit', inForm: true, text, ...extra };
      assert.equal(policy.ownerClickKind(input), 'submit', JSON.stringify(input));
    }
  }
  // L'exception d'étape (libellé entier) reste.
  assert.equal(kind('Suivant', { buttonType: 'submit', inForm: true }), 'step');
  assert.equal(kind('Valider et continuer', { buttonType: 'submit', inForm: true }), 'step');
  // review-carte-r1-01 : un bouton à menu qui dit un verbe d'envoi garde sa carte ; un filtre à
  // nom d'action (E100) est un widget.
  assert.equal(kind('Envoyer', { ariaHasPopup: 'menu' }), 'candidate');
  assert.equal(kind('Date de publication', { ariaExpanded: 'false' }), 'widget');
  // « Easy Apply » à menu : `apply` est un verbe, carte de trop possible (comme avant R1).
  assert.equal(kind('Easy Apply', { ariaExpanded: 'true' }), 'candidate');
  assert.equal(kind('Candidature simplifiée', { ariaExpanded: 'false' }), 'widget');
  // « Easy Apply » sans attribut de menu : rien ne le distingue du bouton qui ouvre le formulaire.
  assert.equal(kind('Easy Apply'), 'candidate');
});

// carte-r1-01 : le même chemin que l'agent. La passerelle classe le clic (browser_click en mode
// propriétaire) et transmet `clickKind` au fournisseur ; la garde des écritures de CdpBrowser
// (contexte Playwright FICTIF, aucun Chrome) reçoit ensuite, 4 s après le clic, une écriture de
// télémétrie du site vers un chemin aléatoire, comme dans E100.
const ORIGIN = 'https://emplois.fictif.test';
const SEARCH = `${ORIGIN}/recherche`;
async function gatewayClick(element) {
  const performed = [];
  const approvals = [];
  const gateway = new BrowserGateway({
    provider: {
      name: 'fictif',
      currentUrl: async () => SEARCH,
      describe: async () => ({ ...element }),
      perform: async (id, args) => {
        performed.push({ id, args });
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
  const outcome = await gateway.call('browser.click', { ref: 'e1' }).then(
    () => 'fait',
    () => 'refusé',
  );
  return { outcome, approvals: approvals.length, args: performed[0]?.args ?? null };
}
async function guardAfterClick(args, url) {
  let pageUrl = 'about:blank';
  const page = {
    url: () => pageUrl,
    isClosed: () => false,
    opener: async () => null,
    on() {},
    goto: async () => {},
  };
  let handler;
  const context = {
    pages: () => [page],
    on() {},
    browser: () => ({}),
    route: async (_pattern, h) => {
      handler = h;
    },
    routeWebSocket: async () => {},
    close: async () => {},
  };
  const provider = new CdpBrowser({
    launch: {},
    chromium: { launchPersistentContext: async () => context },
  });
  const cards = [];
  try {
    const guardPolicy = new RunPolicy({ ownerMode: true });
    await provider.prepare(guardPolicy, async (request) => {
      cards.push(request.args?.url);
      return false;
    });
    await provider.ensure(guardPolicy);
    pageUrl = SEARCH;
    // État que browser.click pose à partir des arguments de la passerelle (cdp.js, browser.click).
    Object.assign(provider, {
      sendClick:
        args.sendApproved === true || args.formStep === true || args.clickKind === 'candidate',
      formStep: args.formStep === true,
      clickKind: args.clickKind ?? null,
      clickPage: SEARCH,
      writeInProgress: false,
      lastClickEnd: Date.now() - 4000,
      cover: null,
      sendDecision: null,
    });
    let outcome = 'en attente';
    await handler({
      request: () => ({
        frame: () => ({ page: () => page, url: () => pageUrl }),
        method: () => 'POST',
        postData: () => '{"fictif":1}',
        url: () => url,
        resourceType: () => 'fetch',
        isNavigationRequest: () => false,
      }),
      continue: async () => {
        outcome = 'partie';
      },
      abort: async () => {
        outcome = 'bloquée';
      },
      fallback: async () => {
        outcome = 'fallback';
      },
    });
    return { outcome, card: cards.length > 0 };
  } finally {
    await provider.close().catch(() => {});
  }
}
const TELEMETRY = `${ORIGIN}/aB3xQ9kLmZ7`;
const button = (text, extra = {}) => ({
  tag: 'button',
  buttonType: 'button',
  inForm: false,
  text,
  ...extra,
});

test('carte-r1-01 FICTIF, chemin de l’agent : les filtres E100 ne font plus de carte', async () => {
  for (const element of [
    button('Date de publication', { ariaExpanded: 'false' }),
    button('Date de publication'),
    button('Toutes les publications', { ariaExpanded: 'false' }),
    button('Soumission facile'),
    button('Soumission facile', { ariaExpanded: 'false' }),
    button('Toutes les publications', { role: 'tab' }),
    button('Candidature simplifiée', { role: 'radio' }),
  ]) {
    const click = await gatewayClick(element);
    // D'abord ce que voit le propriétaire : l'écriture de télémétrie part, sans carte.
    assert.deepEqual(
      await guardAfterClick(click.args, TELEMETRY),
      { outcome: 'partie', card: false },
      element.text,
    );
    assert.equal(click.outcome, 'fait', element.text);
    assert.equal(click.approvals, 0, element.text);
    assert.notEqual(click.args.clickKind, 'candidate', element.text);
  }
});

test('carte-r1-01 FICTIF, chemin de l’agent : les vrais envois gardent leur carte', async () => {
  // Hors formulaire : pas de carte avant le clic, mais l'écriture qu'il déclenche l'attend.
  for (const text of ['Postuler', 'Envoyer', 'Send', 'Publier', 'Apply now', 'Easy Apply']) {
    const click = await gatewayClick(button(text));
    assert.equal(click.args.clickKind, 'candidate', text);
    assert.deepEqual(await guardAfterClick(click.args, TELEMETRY), {
      outcome: 'bloquée',
      card: true,
    });
  }
  // Bouton de soumission d'un formulaire, quel que soit son libellé : carte avant le clic.
  for (const text of [
    'Envoyer la candidature',
    'Submit application',
    'Date de publication',
    'OK',
  ]) {
    const click = await gatewayClick({ tag: 'button', buttonType: 'submit', inForm: true, text });
    assert.equal(click.approvals, 1, text);
    assert.equal(click.outcome, 'refusé', text);
  }
  // review-carte-r1-01 : bouton à menu ou entrée de menu qui dit un verbe d'envoi : toute
  // écriture qu'il déclenche attend la carte, même vers un chemin sans mot d'envoi.
  for (const element of [
    button('Envoyer', { ariaHasPopup: 'menu' }),
    button('Envoyer', { ariaExpanded: 'false' }),
    { tag: 'div', role: 'menuitem', inForm: false, text: 'Envoyer maintenant' },
    { tag: 'div', role: 'menuitem', inForm: false, text: 'Send now' },
    { tag: 'div', role: 'menuitem', inForm: false, text: 'Programmer l’envoi' },
  ]) {
    const menu = await gatewayClick(element);
    assert.equal(menu.args.clickKind, 'candidate', element.text);
    assert.deepEqual(
      await guardAfterClick(menu.args, TELEMETRY),
      { outcome: 'bloquée', card: true },
      element.text,
    );
  }
  // Un widget (filtre à nom d'action) : une écriture vers un chemin de soumission du site attend
  // toujours la carte (filet de cdp.js).
  const filter = await gatewayClick(button('Date de publication', { ariaHasPopup: 'menu' }));
  assert.equal(filter.args.clickKind, 'widget');
  assert.deepEqual(await guardAfterClick(filter.args, `${ORIGIN}/api/messages/send`), {
    outcome: 'bloquée',
    card: true,
  });
});
