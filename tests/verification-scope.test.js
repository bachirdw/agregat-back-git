import test from 'node:test';
import assert from 'node:assert/strict';
import { verificationScope } from '../packages/orchestrator/index.js';

test('La provenance de vérification décrit honnêtement le type de mission', () => {
  assert.equal(verificationScope('core', false), 'Structure seulement ; faits non vérifiés');
  assert.equal(
    verificationScope('core', false, true),
    'Page naviguée et observée ; autres affirmations non vérifiées',
  );
  assert.match(verificationScope('career-ops', false), /non vérifi/);
  assert.doesNotMatch(verificationScope('career-ops', false), /fixture/i);
  assert.match(verificationScope('career-ops', true), /fictif|simul/i);
  assert.match(verificationScope('najah', true), /fixture/i);
});
