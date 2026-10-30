import test from 'node:test';
import assert from 'node:assert/strict';
import {
  browserObservationFailure,
  compactBrowserEvidence,
  readableBrowserObservation,
  verifiedBrowserVisit,
} from '../packages/orchestrator/browser-proof.js';

test('une page lue dans le tour est une preuve, avec ou sans navigate séparé', () => {
  assert.equal(
    readableBrowserObservation({
      capability: 'browser.snapshot',
      url: 'https://example.test/resultats',
      snapshot: '- heading "Résultat FICTIF"',
      loading: false,
    }),
    true,
  );
  assert.equal(
    readableBrowserObservation({
      capability: 'browser.extract',
      url: 'https://example.test/resultats',
      text: 'Résultat FICTIF',
    }),
    true,
  );
  assert.equal(
    readableBrowserObservation({ capability: 'browser.navigate', url: 'https://example.test' }),
    false,
  );
});

test('historique, onglet vide et chargement ne prouvent pas une lecture', () => {
  for (const evidence of [
    { capability: 'browser.snapshot', url: 'about:blank', snapshot: '' },
    { capability: 'browser.snapshot', url: 'https://example.test', snapshot: '' },
    { capability: 'browser.snapshot', url: 'https://example.test', snapshot: '...', loading: true },
    { capability: 'browser.extract', url: 'file:///tmp/test', text: 'FICTIF' },
    { capability: 'browser.extract', url: 'https://example.test', text: '  ' },
  ])
    assert.equal(readableBrowserObservation(evidence), false);
  assert.match(
    browserObservationFailure([{ capability: 'browser.snapshot', url: 'about:blank' }]),
    /about:blank/,
  );
  assert.match(
    browserObservationFailure([
      { capability: 'browser.snapshot', url: 'https://example.test', loading: true },
    ]),
    /chargement/,
  );
  assert.doesNotMatch(browserObservationFailure([]), /example\.test/);
});

test('preuve privée FICTIVE : URL nettoyée, contenu absent et visite liée à sa capture', () => {
  const navigate = compactBrowserEvidence({
    capability: 'browser.navigate',
    url: 'https://user:secret@example.test/job/123?token=SECRET#details',
    provider: 'playwriter-owner',
  });
  const snapshot = compactBrowserEvidence({
    capability: 'browser.snapshot',
    url: 'https://example.test/job/123?token=SECRET',
    snapshot: 'CV PRIVÉ FICTIF',
    provider: 'playwriter-owner',
    loading: false,
  });
  assert.equal(navigate.url, 'https://example.test/job/123');
  assert.equal(snapshot.url, navigate.url);
  assert.doesNotMatch(JSON.stringify([navigate, snapshot]), /SECRET|PRIVÉ|user/);
  assert.deepEqual(verifiedBrowserVisit([navigate, snapshot]), [navigate, snapshot]);
  assert.deepEqual(verifiedBrowserVisit([snapshot]), []);
  assert.deepEqual(
    verifiedBrowserVisit([navigate, { ...snapshot, loading: true, readable: false }]),
    [],
  );
});
