import test from 'node:test';
import assert from 'node:assert/strict';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { BrowserGateway } from '../packages/browser-gateway/index.js';
import { capabilityIds } from '../packages/capability-registry/index.js';
import { sameSite } from '../packages/browser-gateway/cdp.js';

// faux-blocage-01 (D7, sous-mission 7468032c du 18/11) : le bouton du formulaire d'une zone de
// recherche que la page déclare (role="search", <search>) est un widget, comme Entrée dans son champ
// (cartes-14-11 B). Sans navigateur : fournisseur FICTIF dont `describe()` rend l'élément, mode
// propriétaire, `approve` qui refuse tout. `candidate` = les écritures du clic attendent la carte ;
// `submit` = carte avant le clic ; `widget` = pas de carte (sauf filet du chemin de soumission).
const PAGE = 'https://au.fictif.test/';
async function click(element) {
  const performed = [];
  const approvals = [];
  const gateway = new BrowserGateway({
    provider: {
      name: 'fictif',
      currentUrl: async () => PAGE,
      describe: async () => ({ ...element }),
      perform: async (id, a) => {
        performed.push({ id, args: a });
        return { url: PAGE };
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
  return { outcome, approvals: approvals.length, clickKind: performed[0]?.args?.clickKind };
}

// Description FICTIVE du bouton « Find jobs » telle que describeElement la rend.
const FIND = {
  tag: 'button',
  role: null,
  buttonType: 'submit',
  inForm: true,
  formAction: '/jobs',
  formMethod: 'get',
  formHasFile: false,
  formHasPassword: false,
  formCrossSite: false,
  text: 'Find jobs',
  ariaLabel: null,
  hint: null,
  ariaHasPopup: null,
  ariaExpanded: null,
  search: true,
};

test('faux-blocage-01 FICTIF : bouton de formulaire dans une zone de recherche déclarée → widget', async () => {
  const r = await click(FIND);
  assert.equal(r.outcome, 'fait');
  assert.equal(r.approvals, 0);
  assert.equal(r.clickKind, 'widget');
});

test('faux-blocage-01 FICTIF : hors zone de recherche, le même bouton reste candidate', async () => {
  for (const search of [false, undefined]) {
    const r = await click({ ...FIND, search });
    assert.equal(r.approvals, 0, String(search));
    assert.equal(r.clickKind, 'candidate', String(search));
  }
});

test('faux-blocage-01 FICTIF : contre-épreuves dans la zone, la carte reste', async () => {
  // Libellé d'envoi : carte avant le clic (submit, inchangé).
  for (const text of ['Envoyer', 'Submit', 'Postuler']) {
    const r = await click({ ...FIND, text });
    assert.equal(r.outcome, 'refusé', text);
    assert.equal(r.approvals, 1, text);
    assert.equal(r.clickKind, undefined, text);
  }
  // Formulaire en POST : carte avant le clic (submit, inchangé).
  const post = await click({ ...FIND, formMethod: 'post' });
  assert.equal(post.approvals, 1);
  assert.equal(post.outcome, 'refusé');
  // Icône d'envoi, fichier joint, autre site, menu ou bouton déroulant : jamais widget par la zone.
  for (const change of [
    { buttonType: 'button', text: '', hint: 'send' },
    { formHasFile: true },
    { formCrossSite: true },
    { formCrossSite: null },
    { buttonType: 'button', ariaHasPopup: 'menu', text: 'Envoyer' },
    { buttonType: 'button', ariaExpanded: 'false', text: 'Envoyer' },
    { buttonType: 'button', tag: 'div', role: 'menuitem', text: 'Envoyer maintenant' },
  ]) {
    const r = await click({ ...FIND, ...change });
    assert.notEqual(r.clickKind, 'widget', JSON.stringify(change));
  }
  // Bouton hors formulaire dans la zone : inchangé (plain sans libellé d'envoi, candidate avec).
  assert.equal((await click({ ...FIND, inForm: false, buttonType: 'button' })).clickKind, 'plain');
  const outside = await click({ ...FIND, inForm: false, buttonType: 'button', text: 'Envoyer' });
  assert.equal(outside.clickKind, 'candidate');
  // Lien dans un formulaire de la zone : jamais widget.
  const link = await click({ ...FIND, tag: 'a', buttonType: null, text: 'Voir' });
  assert.notEqual(link.clickKind, 'widget');
});

test('faux-blocage-01 FICTIF : le journal d’un sous-domaine du même site est une écriture de la page', () => {
  // Comme la page de recherche et son journal le 18/11 (deux sous-domaines d'un même site) : le
  // test Chrome les sert sur une même origine, cette égalité est vérifiée ici.
  assert.equal(
    sameSite('https://au.fictif.test/jobs', 'https://autocomplete.fictif.test/api/v0/log'),
    true,
  );
  assert.equal(sameSite('https://au.fictif.test/jobs', 'https://autre.test/api/v0/log'), false);
});

// multi-agent-v3-02 (J) : un <input type="submit"> d'une zone de recherche déclarée joue le même rôle
// que le <button type=submit> : même règle étroite, rien d'autre.
const INPUT_FIND = {
  ...FIND,
  tag: 'input',
  buttonType: null,
  inputType: 'submit',
  text: 'Find jobs',
};

test('multi-agent-v3-02 J FICTIF : <input type=submit> d’un formulaire GET de la zone de recherche → widget', async () => {
  const r = await click(INPUT_FIND);
  assert.equal(r.outcome, 'fait');
  assert.equal(r.approvals, 0);
  assert.equal(r.clickKind, 'widget');
});

test('multi-agent-v3-02 J FICTIF : contre-épreuves de l’<input type=submit>, la règle reste étroite', async () => {
  // Hors zone de recherche : carte avant le clic, comme avant (un <input type=submit> reste un
  // déclencheur de soumission pour la garde de l'élément).
  const outside = await click({ ...INPUT_FIND, search: false });
  assert.equal(outside.approvals, 1);
  assert.equal(outside.outcome, 'refusé');
  // Formulaire en POST, libellé d'envoi : carte avant le clic.
  for (const change of [{ formMethod: 'post' }, { text: 'Envoyer' }, { text: 'Postuler' }]) {
    const r = await click({ ...INPUT_FIND, ...change });
    assert.equal(r.approvals, 1, JSON.stringify(change));
    assert.equal(r.outcome, 'refusé', JSON.stringify(change));
  }
  // Fichier joint, autre site, autre type d'input : jamais widget par la zone.
  for (const change of [
    { formHasFile: true },
    { formCrossSite: true },
    { formCrossSite: null },
    { inputType: 'image' },
    { inputType: 'button' },
    { inputType: 'text' },
    { inForm: false },
  ]) {
    const r = await click({ ...INPUT_FIND, ...change });
    assert.notEqual(r.clickKind, 'widget', JSON.stringify(change));
  }
});
