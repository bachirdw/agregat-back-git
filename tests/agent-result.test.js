import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentResult } from '../packages/orchestrator/index.js';

const valid = { simulated: true, summary: 's', evidence: [] };
test('résultat agent : JSON brut, clôturé, entouré de prose', () => {
  assert.deepEqual(parseAgentResult(JSON.stringify(valid)).value, valid);
  assert.deepEqual(parseAgentResult('```json\n' + JSON.stringify(valid) + '\n```').value, valid);
  assert.deepEqual(parseAgentResult('Voici :\n' + JSON.stringify(valid) + '\nFin.').value, valid);
});
test('résultat agent : refus en texte libre rapporté avec extrait', () => {
  const r = parseAgentResult('Free OpenCode models can’t be used as a backend for other services.');
  assert.equal(r.ok, false);
  assert.match(r.reason, /non structurée/);
  assert.match(r.excerpt, /Free OpenCode/);
});
test('résultat agent : vide, JSON invalide, hors contrat', () => {
  assert.equal(parseAgentResult('').excerpt, '(réponse vide)');
  assert.match(parseAgentResult('{ pas du json }').reason, /JSON invalide/);
  assert.match(parseAgentResult('{"summary":"x"}').reason, /hors contrat/);
  assert.match(parseAgentResult(JSON.stringify({ ...valid, summary: '' })).reason, /hors contrat/);
});
test('résultat agent : extrait borné à 300 caractères', () => {
  assert.ok(parseAgentResult('x'.repeat(5000)).excerpt.length <= 300);
});
