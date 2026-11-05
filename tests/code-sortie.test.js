import test from 'node:test';
import assert from 'node:assert/strict';
import { answeredExitCode, exitFailedOf } from '../packages/orchestrator/exit-code.js';

// Seconde relecture de nuit (E57, suite) : le code de sortie était lu comme la première occurrence
// de « exitCode » dans la réponse sérialisée ; or la passerelle répond { text, exitCode } avec le
// texte imprimé par le script en premier : un « exitCode: 1 » cité dans ce texte l'emportait sur le
// vrai code, et un code « 0 » en chaîne passait pour un échec. Trois lecteurs différents existaient.
// Un seul lit désormais le champ de la réponse même, jamais le texte imprimé ni une page lue.
const mcp = (answer) => [{ type: 'text', text: JSON.stringify(answer) }];
const acpContent = (answer) => [
  { type: 'content', content: { type: 'text', text: JSON.stringify(answer) } },
];

test('Code de sortie FICTIF : le champ de la réponse, jamais le texte imprimé', () => {
  const quoted = {
    text: 'journal FICTIF : {"exitCode": 1} vu dans un sous-processus',
    exitCode: 0,
  };
  assert.equal(answeredExitCode(mcp(quoted)), 0);
  assert.equal(exitFailedOf(mcp(quoted)), false);
  const hidden = { text: 'résumé FICTIF {"exitCode": 0}', exitCode: 2 };
  assert.equal(exitFailedOf(mcp(hidden)), true);
  assert.equal(exitFailedOf(acpContent(hidden)), true);
  assert.equal(exitFailedOf(JSON.stringify(hidden)), true);
});

test('Code de sortie FICTIF : null, nom et chaîne « 0 »', () => {
  assert.equal(exitFailedOf(mcp({ text: '', exitCode: null })), true);
  assert.equal(
    exitFailedOf(mcp({ text: '', exitCode: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' })),
    true,
  );
  assert.equal(exitFailedOf(mcp({ text: '', exitCode: '0' })), false);
  assert.equal(exitFailedOf(mcp({ text: '', exitCode: -1 })), true);
});

test('Code de sortie FICTIF : une réponse sans code, ou une page qui en cite un, n’est pas un échec', () => {
  assert.equal(answeredExitCode(mcp({ path: 'data/pipeline.md', saved: true })), undefined);
  assert.equal(exitFailedOf(mcp({ path: 'data/pipeline.md', saved: true })), false);
  const page = {
    capability: 'browser.extract',
    url: 'https://example.test/',
    text: '{"exitCode": 1, "note": "page FICTIVE qui cite un code"}',
  };
  assert.equal(answeredExitCode(mcp(page)), undefined);
  assert.equal(exitFailedOf(mcp(page)), false);
  assert.equal(exitFailedOf(undefined), false);
});
