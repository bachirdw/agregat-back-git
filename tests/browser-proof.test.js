import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessBrowserClaims,
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
  // Same public path is insufficient when the full sources differ (credentials,
  // fragment or query). The compact proof never reveals those private parts.
  assert.deepEqual(verifiedBrowserVisit([navigate, snapshot]), []);
  const sameSource = compactBrowserEvidence({
    capability: 'browser.navigate',
    url: 'https://example.test/job/123?token=SECRET',
    provider: 'playwriter-owner',
  });
  assert.deepEqual(verifiedBrowserVisit([sameSource, snapshot]), [sameSource, snapshot]);
  assert.deepEqual(verifiedBrowserVisit([snapshot]), []);
  assert.deepEqual(
    verifiedBrowserVisit([navigate, { ...snapshot, loading: true, readable: false }]),
    [],
  );
});

test('waitedFor reste dans la preuve compacte : texte attendu non apparu, capture lisible', () => {
  const evidence = compactBrowserEvidence({
    capability: 'browser.snapshot',
    url: 'https://example.test/offre?token=FICTIF',
    snapshot: '- heading "Offre FICTIF"',
    provider: 'cdp',
    loading: false,
    waitedFor: { text: 'À propos de l’offre', found: false },
    scrolled: 'bottom',
  });
  assert.deepEqual(evidence.waitedFor, { text: 'À propos de l’offre', found: false });
  assert.equal(evidence.scrolled, 'bottom');
  // Tab facts are kept as numbers and booleans only; page text never is.
  const facts = compactBrowserEvidence({
    capability: 'browser.snapshot',
    url: 'https://offres.example.test/a?x=1',
    snapshot: 'FICTIF texte',
    hidden: true,
    textLength: 2500,
  });
  assert.equal(facts.hidden, true);
  assert.equal(facts.textLength, 2500);
  assert.equal(facts.snapshot, undefined);
  const noFacts = compactBrowserEvidence({
    capability: 'browser.snapshot',
    url: 'https://offres.example.test/a',
    snapshot: 'FICTIF',
    textLength: -1,
  });
  assert.equal(noFacts.hidden, undefined);
  assert.equal(noFacts.textLength, undefined);
  assert.equal(evidence.readable, true);
  assert.equal(
    compactBrowserEvidence({
      capability: 'browser.snapshot',
      url: 'https://example.test/',
      snapshot: 'x',
      waitedFor: { text: 'ok', found: true, extra: 'FICTIF page text' },
    }).waitedFor.extra,
    undefined,
  );
  assert.equal(
    compactBrowserEvidence({ capability: 'browser.snapshot', url: 'https://example.test/' })
      .waitedFor,
    undefined,
  );
});

// C5 c (E19) : le Bilan dit, à partir des seuls champs de preuve, qu'un texte attendu n'est pas
// apparu et si un défilement a été observé ; aucune règle sur un site ou un contenu.
test('C5 c FICTIF : « Capture : texte attendu non apparu » à partir de waitedFor, scrolled, hidden, textLength', () => {
  const capture = (extra) =>
    compactBrowserEvidence({
      capability: 'browser.snapshot',
      url: 'https://offres.example.test/offre/1',
      snapshot: '- heading "Offre FICTIVE"',
      provider: 'playwriter-owner',
      loading: false,
      ...extra,
    });
  const missing = assessBrowserClaims(
    'Description absente de https://offres.example.test/offre/1',
    [
      capture({
        waitedFor: { text: 'Responsabilités FICTIVES', found: false },
        hidden: true,
        textLength: 2506,
      }),
      capture({
        waitedFor: { text: 'Responsabilités FICTIVES', found: false },
        hidden: true,
        textLength: 2506,
      }),
    ],
  );
  assert.match(
    missing.notice,
    /\nCapture : texte attendu non apparu \(2\) ; défilement : non observé ; onglet caché ; texte de la page : 2506 caractères\.$/,
  );
  assert.deepEqual(missing.captures, {
    expectedTextMissing: 2,
    scrolled: false,
    hidden: true,
    textLength: 2506,
  });
  assert.doesNotMatch(missing.notice, /Responsabilités/);
  const scrolled = assessBrowserClaims('Rien.', [
    capture({ waitedFor: { text: 'Suite', found: false }, textLength: 900 }),
    capture({ scrolled: 'bottom', textLength: 1200 }),
  ]);
  assert.match(
    scrolled.notice,
    /\nCapture : texte attendu non apparu \(1\) ; défilement : observé ; texte de la page : 900 caractères\.$/,
  );
  assert.equal(scrolled.captures.hidden, false);
  // Expected text present, or no expectation: no line, counts stay available.
  for (const evidence of [
    [capture({ waitedFor: { text: 'Offre', found: true }, scrolled: 'page' })],
    [capture({})],
    [],
  ]) {
    const result = assessBrowserClaims('Rien.', evidence);
    assert.doesNotMatch(result.notice, /Capture :/);
    assert.equal(result.captures.expectedTextMissing, 0);
  }
});
