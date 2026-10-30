import test from 'node:test';
import assert from 'node:assert/strict';
import {
  browserObservationFailure,
  readableBrowserObservation,
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
