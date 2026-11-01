// Sources et affirmations FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  verifiedBrowserVisit,
  compactBrowserEvidence,
} from '../packages/orchestrator/browser-proof.js';
const pair = (n) => [
  compactBrowserEvidence({
    capability: 'browser.navigate',
    url: `https://example.test/${n}`,
    provider: 'fixture',
  }),
  compactBrowserEvidence({
    capability: 'browser.snapshot',
    url: `https://example.test/${n}`,
    snapshot: 'FICTIF',
    provider: 'fixture',
  }),
];
test('preuves du tour : toutes les pages lues sont conservées, pas seulement la dernière', () => {
  const evidence = [...pair(1), ...pair(2), ...pair(3)];
  assert.deepEqual(verifiedBrowserVisit(evidence), evidence);
});

test('liens : lecture, simple navigation et citation sans visite restent distincts', async () => {
  const { assessBrowserClaims } = await import('../packages/orchestrator/browser-proof.js');
  const evidence = [...pair(1), pair(2)[0]];
  const result = assessBrowserClaims(
    'Chaque page ouverte : https://example.test/1 https://example.test/2 https://example.test/3',
    evidence,
  );
  assert.equal(result.claimsVerified, false);
  assert.deepEqual(
    result.citations.map((x) => x.status),
    ['read', 'visited', 'cited'],
  );
  assert.match(result.notice, /2 lien\(s\).*sans lecture prouvée/);
});
test('paramètres différents : pas de preuve transférée, aucun secret dans le diagnostic', async () => {
  const { assessBrowserClaims } = await import('../packages/orchestrator/browser-proof.js');
  const evidence = [
    compactBrowserEvidence({
      capability: 'browser.extract',
      url: 'https://example.test/job?id=1&token=FICTIF_SECRET',
      text: 'FICTIF',
    }),
  ];
  const result = assessBrowserClaims('https://example.test/job?id=2&token=FICTIF_SECRET', evidence);
  assert.equal(result.citations[0].status, 'cited');
  assert.doesNotMatch(JSON.stringify(result), /FICTIF_SECRET|token=|id=2/);
});
test('capture autonome prouve une lecture ; contenu et assertions restent non certifiés', async () => {
  const { assessBrowserClaims } = await import('../packages/orchestrator/browser-proof.js');
  const result = assessBrowserClaims('https://example.test/1', [pair(1)[1]]);
  assert.equal(result.citations[0].status, 'read');
  assert.equal(result.claimsVerified, false);
});
