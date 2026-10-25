import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

// Opt-in explicite : utilise l'extension existante et l'audit des IDs Chrome, sans execute.
// Aucun modèle, aucune donnée de page ni cookie. Le refus sécurisé est le résultat attendu.
test(
  'Playwriter réel : incompatibilité sûre et onglets inchangés',
  {
    skip: process.env.PLAYWRITER_LIVE !== '1',
    timeout: 45000,
  },
  async () => {
    const { stdout, stderr } = await promisify(execFile)(
      process.execPath,
      ['scripts/playwriter-smoke.js'],
      {
        env: { ...process.env, PLAYWRITER_TELEMETRY: '0' },
        timeout: 40000,
      },
    );
    console.log(stdout);
    assert.equal(stderr, '');
    assert.match(stdout, /STATUT : INCOMPATIBLE/);
    assert.match(stdout, /AUDIT ONGLETS : liste inchangée/);
  },
);
