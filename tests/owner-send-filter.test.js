import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAuthRefresh,
  isGraphqlRead,
  previewBody,
  sameSite,
} from '../packages/browser-gateway/cdp.js';

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
test('Session : le renouvellement de connexion n’est pas un envoi', () => {
  assert.equal(isAuthRefresh('https://login.seek.com/oauth/token'), true);
  assert.equal(isAuthRefresh('https://www.example.test/api/oauth2/authorize'), true);
  assert.equal(isAuthRefresh('https://au.seek.com/graphql'), false);
  assert.equal(isAuthRefresh('https://lcto.aips-sol.com/v1/events'), false);
  assert.equal(isAuthRefresh('https://au.seek.com/apply/submit'), false);
});
test('Même site : API de la page oui, statistiques tierces non', () => {
  assert.equal(sameSite('https://au.seek.com/graphql', 'https://au.seek.com/job/1/apply'), true);
  assert.equal(sameSite('https://www.seek.com/x', 'https://au.seek.com/job/1'), true);
  assert.equal(sameSite('https://api.seek.com.au/x', 'https://www.seek.com.au/job/1'), true);
  assert.equal(sameSite('https://lcto.aips-sol.com/v1/events', 'https://au.seek.com/job/1'), false);
  assert.equal(sameSite('https://evil.com.au/x', 'https://www.seek.com.au/job/1'), false);
});
