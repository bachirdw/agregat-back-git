// audit-suite-02 (audit du 12/11, constat non contredit) : après un clic d'envoi sans carte
// (`candidate`), une écriture de la même page vers un chemin de soumission qui part plus de 8 s
// après la fin du clic attend la carte du propriétaire, comme dans la fenêtre du clic. La
// télémétrie (chemin sans mot de soumission) passe toujours sans carte. Contexte Playwright FICTIF
// (aucun Chrome lancé) : le gestionnaire de routes du mode propriétaire est appelé directement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CdpBrowser } from '../packages/browser-gateway/cdp.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';

const PAGE = 'https://emplois.fictif.test/offre/1';

async function ownerGuard() {
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
  const policy = new RunPolicy({ ownerMode: true });
  const cards = [];
  await provider.prepare(policy, async (request) => {
    cards.push(request.args?.url);
    return false; // refusée : la requête est bloquée, rien ne part
  });
  await provider.ensure(policy);
  pageUrl = PAGE;
  // Un clic `candidate` sur la page, terminé il y a `ageMs` (état posé comme browser.click le pose).
  const write = async (url, ageMs, { from = PAGE } = {}) => {
    pageUrl = from;
    provider.sendClick = true;
    provider.clickKind = 'candidate';
    provider.formStep = false;
    provider.clickPage = new URL(PAGE).origin + new URL(PAGE).pathname;
    provider.writeInProgress = false;
    provider.lastClickEnd = Date.now() - ageMs;
    provider.cover = null;
    provider.sendDecision = null;
    let outcome = 'en attente';
    const before = cards.length;
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
    return { outcome, card: cards.length > before };
  };
  return { provider, write };
}

test('clic candidate : écriture vers un chemin de soumission dans la fenêtre → carte (inchangé)', async () => {
  const { provider, write } = await ownerGuard();
  try {
    assert.deepEqual(await write('https://emplois.fictif.test/api/applications/submit', 2000), {
      outcome: 'bloquée',
      card: true,
    });
  } finally {
    await provider.close().catch(() => {});
  }
});

test('clic candidate : écriture vers un chemin de soumission 9 s après le clic → carte', async () => {
  const { provider, write } = await ownerGuard();
  try {
    assert.deepEqual(await write('https://emplois.fictif.test/api/applications/submit', 9000), {
      outcome: 'bloquée',
      card: true,
    });
  } finally {
    await provider.close().catch(() => {});
  }
});

test('après la fenêtre : télémétrie et chemin de soumission d’une autre page passent sans carte', async () => {
  const { provider, write } = await ownerGuard();
  try {
    assert.deepEqual(await write('https://emplois.fictif.test/api/stats', 9000), {
      outcome: 'partie',
      card: false,
    });
    assert.deepEqual(
      await write('https://emplois.fictif.test/api/applications/submit', 9000, {
        from: 'https://emplois.fictif.test/autre-page',
      }),
      { outcome: 'partie', card: false },
    );
  } finally {
    await provider.close().catch(() => {});
  }
});
