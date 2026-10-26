import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAuthRefresh,
  isGraphqlRead,
  isSensitiveRequest,
  previewBody,
  registrableSite,
  sameSite,
} from '../packages/browser-gateway/cdp.js';

test('Envoi sensible : chemin et operationName, avec frontières de mots et lots GraphQL', () => {
  const url = 'https://submit.example.test/graphql?operationName=SubmitApplication';
  assert.equal(isSensitiveRequest(url, '{"operationName":"RequestResumeParsing"}'), false);
  for (const name of ['SubmitApplication', 'ApplyToJob', 'confirmOrder', 'applyFilters'])
    assert.equal(
      isSensitiveRequest('https://example.test/graphql', JSON.stringify({ operationName: name })),
      true,
      name,
    );
  assert.equal(
    isSensitiveRequest(
      'https://example.test/graphql',
      '[{"operationName":"ReadJob"},{"operationName":"SubmitApplication"}]',
    ),
    true,
  );
  assert.equal(isSensitiveRequest('https://example.test/job/1/apply', '{}'), true);
  assert.equal(
    isSensitiveRequest('https://example.test/graphql', '{"operationName":"Application"}'),
    false,
  );
  assert.equal(isSensitiveRequest(url, '{}'), false, 'hôte et query string ignorés');
  assert.equal(isSensitiveRequest('https://example.test/applyFilters', '{}'), true);
  assert.equal(isSensitiveRequest('https://example.test/job/application', '{}'), false);
  assert.equal(isSensitiveRequest('URL malformée', '{}'), false);
});

test('GraphQL : une lecture passe, une mutation ou un POST quelconque reste un envoi', () => {
  assert.equal(isGraphqlRead('{"query":"query Job { job(id: 1) { title } }"}'), true);
  assert.equal(isGraphqlRead('[{"query":"{ me { id } }"},{"query":"query A { a }"}]'), true);
  assert.equal(isGraphqlRead('{"query":"mutation Apply { apply(jobId: 1) }"}'), false);
  assert.equal(isGraphqlRead('[{"query":"query A { a }"},{"query":"mutation B { b }"}]'), false);
  assert.equal(isGraphqlRead('FICTIF scripted'), false);
  assert.equal(isGraphqlRead('[{"event":"component_displayed"}]'), false);
});
test('GraphQL : les noms sensibles de lectures ne réclament aucun accord', () => {
  const endpoint = 'https://www.seek.com.au/graphql';
  for (const name of ['GetApplyStatus', 'OrderSummary', 'SubmitApplication']) {
    const body = JSON.stringify({ operationName: name, query: `query ${name} { status }` });
    assert.equal(isGraphqlRead(body), true);
    assert.equal(isSensitiveRequest(endpoint, body), false, name);
  }
  const mixed = JSON.stringify([
    { operationName: 'GetApplyStatus', query: 'query GetApplyStatus { status }' },
    { operationName: 'SubmitApplication', query: 'mutation SubmitApplication { apply }' },
  ]);
  assert.equal(isSensitiveRequest(endpoint, mixed), true);
  assert.equal(
    isSensitiveRequest(
      endpoint,
      JSON.stringify({
        operationName: 'SubmitApplication',
        query: 'mutation SubmitApplication { apply }',
      }),
    ),
    true,
  );
  assert.equal(
    isSensitiveRequest(
      'https://example.test/api/apply',
      JSON.stringify({ operationName: 'GetApplyStatus' }),
    ),
    true,
  );
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
  assert.equal(registrableSite('au.seek.com'), 'seek.com');
  assert.equal(registrableSite('www.seek.com.au'), 'seek.com.au');
  assert.equal(sameSite('https://au.seek.com/graphql', 'https://au.seek.com/job/1/apply'), true);
  assert.equal(sameSite('https://www.seek.com/x', 'https://au.seek.com/job/1'), true);
  assert.equal(sameSite('https://api.seek.com.au/x', 'https://www.seek.com.au/job/1'), true);
  assert.equal(sameSite('https://lcto.aips-sol.com/v1/events', 'https://au.seek.com/job/1'), false);
  assert.equal(sameSite('https://evil.com.au/x', 'https://www.seek.com.au/job/1'), false);
  assert.equal(sameSite('https://api.example.co.uk/x', 'https://www.example.co.uk/y'), true);
  assert.equal(sameSite('http://127.0.0.1/x', 'http://192.0.0.1/y'), false);
  assert.equal(sameSite('http://[::1]/x', 'http://[::2]/y'), false);
});
