import test from 'node:test';
import assert from 'node:assert/strict';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';
import { BrowserGateway } from '../packages/browser-gateway/index.js';
import { capabilityIds } from '../packages/capability-registry/index.js';
import { isSubmitPath } from '../packages/browser-gateway/cdp.js';

// faux-blocage-02 (essais réels du 18/11, recherche d'offres sans candidature). Sans navigateur :
// fournisseur FICTIF dont `describe()` rend l'élément, mode propriétaire, `approve` qui refuse tout.
// Cas T : le lien « Next » d'une liste de résultats (hors formulaire, adresse réelle) est une étape
// par son seul libellé ; la passerelle le dit au fournisseur (`stepLink`) pour que le formulaire
// caché d'un traceur d'un autre site posté après lui soit traité comme après un clic ordinaire.
// Cas P : constat seulement (aucun changement, voir le rapport) : le classement est épinglé ici.
const PAGE = 'https://www.fictif.test/emplois/resultats';
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
  const args = performed[0]?.args ?? {};
  return { outcome, approvals: approvals.length, args };
}

// Description FICTIVE du lien « Next » d'une pagination, telle que describeElement la rend.
const NEXT = {
  tag: 'a',
  role: null,
  inForm: false,
  formAction: null,
  text: 'Next',
  ariaLabel: null,
  hint: null,
  ariaHasPopup: null,
  ariaExpanded: null,
  href: '/emplois/resultats?page=2',
  search: false,
};

test('faux-blocage-02 T FICTIF : lien « Next » hors formulaire → étape signalée comme lien', async () => {
  const r = await click(NEXT);
  assert.equal(r.outcome, 'fait');
  assert.equal(r.approvals, 0);
  assert.equal(r.args.clickKind, 'step');
  assert.equal(r.args.formStep, true);
  assert.equal(r.args.stepLink, true);
  // Une adresse absolue aussi.
  const abs = await click({ ...NEXT, href: 'https://www.fictif.test/emplois?page=3' });
  assert.equal(abs.args.stepLink, true);
});

test('faux-blocage-02 T FICTIF : contre-épreuves, jamais `stepLink`', async () => {
  for (const change of [
    // Un bouton « Suivant » (étape d'un formulaire en plusieurs pages ou d'une liste) : inchangé.
    { tag: 'button', buttonType: 'button', href: null, text: 'Suivant' },
    // Un lien dans un formulaire, un lien qui ne mène nulle part ou à un script : inchangé.
    { inForm: true, formAction: '/candidature' },
    { href: '#' },
    { href: '#etape-2' },
    { href: 'javascript:void(0)' },
    { href: ' javascript:void(0)' },
    { href: null },
    { href: '' },
  ]) {
    const r = await click({ ...NEXT, ...change });
    assert.notEqual(r.args.stepLink, true, JSON.stringify(change));
  }
  // Un lien qui n'est pas une étape (« Go to page 3 ») : plain, sans `stepLink` (inchangé).
  const page3 = await click({ ...NEXT, text: 'Go to page 3', href: '/emplois?page=3' });
  assert.equal(page3.args.clickKind, 'plain');
  assert.equal(page3.args.stepLink, undefined);
});

test('faux-blocage-02 P FICTIF : constat, classement inchangé (pas de changement pour ce cas)', async () => {
  // L'élément d'une liste de résultats (libellé de plus de 120 caractères) : plain.
  const item =
    'Société FICTIVE Ville FICTIVE (Sur site) Ignorer l’offre d’emploi Développeur FICTIF ' +
    'Publication il y a 2 semaines';
  assert.ok(item.length > 100);
  const r = await click({ tag: 'div', role: 'button', inForm: false, text: item });
  assert.equal(r.args.clickKind, 'plain');
  assert.equal(r.approvals, 0);
  // Le bouton d'un filtre de lieu : plain, ou widget s'il est déroulant.
  const lieu = { tag: 'button', buttonType: 'button', inForm: false, text: 'Lieu : Ville (80 km)' };
  assert.equal((await click(lieu)).args.clickKind, 'plain');
  assert.equal((await click({ ...lieu, ariaExpanded: 'false' })).args.clickKind, 'widget');
  // Le chemin de la lecture de présence nomme une messagerie : chemin de soumission (règle du
  // widget et du clic ordinaire : carte dans la fenêtre du clic, même page). Constat, pas un correctif.
  assert.equal(isSubmitPath('https://www.fictif.test/api/messaging/dash/presenceStatuses'), true);
  assert.equal(isSubmitPath('https://www.facebook-fictif.test/tr/'), false);
});
