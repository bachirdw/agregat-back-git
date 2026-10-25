import test from 'node:test';
import assert from 'node:assert/strict';
import { CdpBrowser } from '../packages/browser-gateway/cdp.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';

test('fermeture avant la microtâche de lancement : aucun processus même fictif démarré', async () => {
  let launches = 0;
  const provider = new CdpBrowser({
    launch: {},
    chromium: {
      launchPersistentContext: async () => {
        launches++;
        throw new Error('FICTIF : ne doit jamais démarrer');
      },
    },
  });
  const task = provider.ensure(new RunPolicy());
  const rejected = assert.rejects(task, /fermé/);
  await provider.close();
  await rejected;
  assert.equal(launches, 0);
});
