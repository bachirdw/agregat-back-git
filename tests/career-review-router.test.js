import test from 'node:test';
import assert from 'node:assert/strict';
import { routerReviewVerdict } from '../packages/career-ops/integration.js';

const PINNED = '4380dfe082676fcfcc07882ba02c6623530525e2688275bba852426dde14e995';
const only = (hash, findings) => ({
  hash,
  files: [{ path: 'SKILL.md' }],
  findings,
});
const external = { level: 'warning', rule: 'dépendances externes' };
const credentialPaths = { level: 'danger', rule: 'chemins d’identifiants' };

test('routeur FICTIF : avertissement de dépendances seul → revue 01', () => {
  assert.equal(
    routerReviewVerdict(only('ffff', [external]))?.reviewer,
    'Revue technique career-ops-01',
  );
});
test('routeur 35b7c531 : la règle de chemin de données signalée est acceptée pour ce hash seul', () => {
  assert.equal(
    routerReviewVerdict(only(PINNED, [credentialPaths, external]))?.reviewer,
    'Revue technique career-ops-02',
  );
  assert.equal(routerReviewVerdict(only('autre-hash', [credentialPaths, external])), null);
});
test('routeur FICTIF : tout autre constat grave, ou un second fichier, exige une nouvelle revue', () => {
  assert.equal(
    routerReviewVerdict(only(PINNED, [{ level: 'danger', rule: 'injection de consignes' }])),
    null,
  );
  assert.equal(
    routerReviewVerdict({
      hash: PINNED,
      files: [{ path: 'SKILL.md' }, { path: 'x.sh' }],
      findings: [],
    }),
    null,
  );
});
