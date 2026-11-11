// Essai réel du 11/11 (mission 8f365fd4) : la réponse finale de l'agent portait un tableau Markdown
// avec de vrais retours à la ligne dans une chaîne JSON ; elle était refusée (« JSON invalide ») et
// tout le texte du tour, bloc JSON compris, devenait le résumé montré au propriétaire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentResult, proseAnswer } from '../packages/orchestrator/result.js';

test('réponse structurée avec retours à la ligne bruts dans une chaîne : lue', () => {
  const text =
    'Je lis les pages.\n\nVoici la synthèse.\n```json\n{\n  "simulated": false,\n  "summary": "## Résultat\n\n| # | Offre |\n|---|---|\n| 1 | FICTIVE\tA |",\n  "evidence": []\n}\n```';
  const result = parseAgentResult(text);
  assert.equal(result.ok, true);
  assert.equal(result.value.summary, '## Résultat\n\n| # | Offre |\n|---|---|\n| 1 | FICTIVE\tA |');
});

test('réponse structurée valide : inchangée, guillemets et accolades de chaîne respectés', () => {
  const result = parseAgentResult(
    '{"simulated": false, "summary": "dit \\"oui\\" {ici}\\nligne", "evidence": []}',
  );
  assert.equal(result.value.summary, 'dit "oui" {ici}\nligne');
});

test('JSON réellement cassé : toujours refusé', () => {
  assert.equal(parseAgentResult('{"simulated": false, "summary": "coupé').ok, false);
  assert.equal(parseAgentResult('{"simulated": false, "summary": "a" "evidence": []}').ok, false);
});

test('réponse en prose : le dernier message quand il dit assez, sans bloc JSON illisible', () => {
  const first = 'Je charge les outils.\n\n';
  const last = `Voici les cinq offres FICTIVES retenues. ${'Détail. '.repeat(40)}`;
  const broken = '\n```json\n{"simulated": false, "summary": "coupé\n```';
  assert.equal(proseAnswer(first + last + broken, first.length), last.trim());
  // A short closing line keeps the whole turn (the answer was written earlier).
  const long = `Réponse complète FICTIVE. ${'Détail. '.repeat(40)}\n\n`;
  assert.equal(proseAnswer(`${long}Voilà.`, long.length), `${long}Voilà.`.trim());
  assert.equal(proseAnswer('Bonjour.', 0), 'Bonjour.');
});
