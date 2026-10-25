import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
// Node tient lieu de faux Chrome : ses arguments incompatibles font échouer launch sans navigateur.
test('E2E : échec de lancement ne laisse aucun serveur local empêchant la sortie', async () => {
  let failure;
  try {
    await exec(
      process.execPath,
      [
        '--test',
        '--test-isolation=none',
        '--test-name-pattern=saisie avant chargement',
        'tests/e2e-ui.test.js',
      ],
      {
        cwd: new URL('..', import.meta.url).pathname,
        env: {
          ...process.env,
          NODE_TEST_CONTEXT: undefined,
          CHROME_PATH: process.execPath,
          AGENT_PLATFORM_OWNER_MODE: '0',
          AGENT_PLATFORM_LIVE: '0',
        },
        timeout: 5000,
      },
    );
    assert.fail('Le faux Chrome doit échouer');
  } catch (e) {
    failure = e;
  }
  assert.equal(failure.killed, false, 'le fichier de test doit sortir seul, sans timeout ni kill');
  assert.equal(failure.code, 1);
  assert.match(failure.stdout, /saisie avant chargement/);
});

test('captures : échec de lancement ferme aussi l’API locale', async () => {
  let failure;
  try {
    await exec(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "try { await import('./scripts/screenshots.js'); } catch (e) { console.error(e.message); process.exitCode = 1; }",
      ],
      {
        cwd: new URL('..', import.meta.url).pathname,
        env: {
          ...process.env,
          NODE_TEST_CONTEXT: undefined,
          CHROME_PATH: process.execPath,
          AGENT_PLATFORM_OWNER_MODE: '0',
          AGENT_PLATFORM_LIVE: '0',
        },
        timeout: 5000,
      },
    );
    assert.fail('Le faux Chrome doit échouer');
  } catch (e) {
    failure = e;
  }
  assert.equal(failure.killed, false);
  assert.equal(failure.code, 1);
  assert.match(failure.stderr, /launch/);
});
