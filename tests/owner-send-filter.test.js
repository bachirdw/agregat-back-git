import test from 'node:test';
import assert from 'node:assert/strict';
import { isGraphqlRead, previewBody } from '../packages/browser-gateway/cdp.js';

test('GraphQL : une lecture passe, une mutation ou un POST quelconque reste un envoi', () => {
  assert.equal(isGraphqlRead('{"query":"query Job { job(id: 1) { title } }"}'), true);
  assert.equal(isGraphqlRead('[{"query":"{ me { id } }"},{"query":"query A { a }"}]'), true);
  assert.equal(isGraphqlRead('{"query":"mutation Apply { apply(jobId: 1) }"}'), false);
  assert.equal(isGraphqlRead('[{"query":"query A { a }"},{"query":"mutation B { b }"}]'), false);
  assert.equal(isGraphqlRead('FICTIF scripted'), false);
  assert.equal(isGraphqlRead('[{"event":"component_displayed"}]'), false);
});
test('Aperçu d’envoi : jetons masqués et taille bornée', () => {
  const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJGSUNUSUYifQ.c2lnbmF0dXJlRklDVElG';
  const out = previewBody(`{"seekIdentityJwt":"${jwt}","sessionId":"abc","name":"FICTIF"}`);
  assert.doesNotMatch(out, /eyJ|abc/);
  assert.match(out, /"name":"FICTIF"/);
  assert.match(previewBody('x'.repeat(5000)), /… \[tronqué\]$/);
});
