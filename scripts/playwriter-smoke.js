// Test réel optionnel, jamais l'outil Playwriter execute ni un appel modèle.
// Usage : PLAYWRITER_TELEMETRY=0 node scripts/playwriter-smoke.js
// Le succès signifie « incompatibilité détectée et refus sûr », pas navigation opérationnelle.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { BrowserGateway, CdpBrowser } from '../packages/browser-gateway/index.js';
import { RunPolicy } from '../packages/policy-engine/run-policy.js';

assert.equal(process.env.PLAYWRITER_TELEMETRY, '0', 'PLAYWRITER_TELEMETRY=0 requis');
assert.equal(
  process.platform,
  'darwin',
  'audit complet des identifiants Chrome implémenté sur macOS',
);
const endpoint = process.env.RELAY_CDP_ENDPOINT ?? 'http://127.0.0.1:19988';
const url = new URL(endpoint);
assert.equal(url.hostname, '127.0.0.1', 'relais local uniquement');
const tabs = () =>
  execFileSync(
    'osascript',
    ['-e', 'tell application "Google Chrome" to get id of every tab of every window'],
    {
      encoding: 'utf8',
      timeout: 10000,
    },
  ).trim();
const before = tabs();
console.log('ONGLETS AVANT (identifiants uniquement) :', before);
try {
  const response = await fetch(new URL('/json/version', endpoint), {
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.ok, true);
  const metadata = await response.json();
  assert.match(metadata.Browser, /^Playwriter\//, 'le test exige un vrai relais Playwriter');
  console.log('RELAIS RÉEL :', metadata.Browser);
  for (const allowSharedContext of [false, true]) {
    const provider = new CdpBrowser({ endpoint });
    const gateway = new BrowserGateway({
      provider,
      policy: new RunPolicy({
        runId: `SMOKE-playwriter-${allowSharedContext}`,
        allowedDomains: ['example.com'],
        capabilities: ['browser.navigate'],
        allowSharedContext,
      }),
      // Autorisation du brief : seul le partage du contexte est consenti.
      approve: async (request) => {
        console.log('CONSENTEMENT :', request.capability);
        return request.capability === 'browser.shareContext';
      },
    });
    try {
      await assert.rejects(
        gateway.call('browser.navigate', { url: 'https://example.com/' }),
        (error) => {
          console.log(`REFUS ATTENDU partagé=${allowSharedContext} :`, error.message);
          return allowSharedContext
            ? /Protection CDP par onglet indisponible.*navigation refusée/.test(error.message)
            : /contexte isolé.*consentement/.test(error.message);
        },
      );
      assert.equal(provider.browser, null, 'aucune connexion CDP aux onglets utilisateur');
      assert.equal(provider.page, null, 'aucun onglet créé');
    } finally {
      await provider.close();
    }
  }
  console.log('STATUT : INCOMPATIBLE, refus sûr vérifié ; aucune navigation exécutée');
} finally {
  const after = tabs();
  console.log('ONGLETS APRÈS (identifiants uniquement) :', after);
  assert.equal(after, before, 'liste complète des onglets Chrome inchangée');
  console.log('AUDIT ONGLETS : liste inchangée ; aucun contenu, cookie ou session lu');
}
