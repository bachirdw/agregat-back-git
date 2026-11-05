import test from 'node:test';
import assert from 'node:assert/strict';
import { chargeUsage } from '../packages/mcp-gateway/meter.js';

// Quatrième relecture de nuit (E66) : la mesure précède toujours l'action (clic, envoi d'e-mail) ;
// seul son refus HTTP portait la marque « non effectuée ». Une panne du pont de mesure (réseau,
// délai) arrêtait aussi l'action avant qu'elle parte, mais le Bilan l'aurait dite « incertaine ».
const notDone = (pattern) => (error) => pattern.test(error.message) && error.actionDone === false;
const URL_FICTIVE = 'http://127.0.0.1:9/api/internal/usage/FICTIF';

test('Mesure FICTIVE : refus, panne et délai arrêtent l’action, marqués « non effectuée »', async () => {
  await assert.rejects(chargeUsage('', 'jeton', 'tool_call'), notDone(/Pont de mesure requis/));
  const refused = async () =>
    new Response(JSON.stringify({ error: 'Budget FICTIF dépassé' }), {
      status: 403,
    });
  await assert.rejects(
    chargeUsage(URL_FICTIVE, 'jeton', 'tool_call', 1, refused),
    notDone(/Budget FICTIF dépassé/),
  );
  const down = async () => {
    throw new TypeError('fetch failed');
  };
  await assert.rejects(
    chargeUsage(URL_FICTIVE, 'jeton', 'tool_call', 1, down),
    notDone(/Mesure indisponible \(pont injoignable\) : action non effectuée/),
  );
  const slow = async () => {
    throw Object.assign(new Error('délai FICTIF'), { name: 'TimeoutError' });
  };
  await assert.rejects(
    chargeUsage(URL_FICTIVE, 'jeton', 'tool_call', 1, slow),
    notDone(/sans réponse en 15 s/),
  );
});

test('Mesure FICTIVE : une mesure acceptée laisse l’action se faire', async () => {
  let sent;
  const ok = async (url, init) => {
    sent = { url, body: JSON.parse(init.body), token: init.headers['x-relay-token'] };
    return new Response(JSON.stringify({ cents: 0 }), { status: 200 });
  };
  await chargeUsage(URL_FICTIVE, 'jeton-FICTIF', 'browser_action', 1, ok);
  assert.deepEqual(sent, {
    url: URL_FICTIVE,
    body: { dimension: 'browser_action', units: 1 },
    token: 'jeton-FICTIF',
  });
});
