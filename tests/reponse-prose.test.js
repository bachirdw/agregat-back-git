// Essai réel du 11/11 (mission 8f365fd4) : la réponse finale de l'agent portait un tableau Markdown
// avec de vrais retours à la ligne dans une chaîne JSON ; elle était refusée (« JSON invalide ») et
// tout le texte du tour, bloc JSON compris, devenait le résumé montré au propriétaire.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentResult, proseAnswer } from '../packages/orchestrator/result.js';
import { decisionRequest } from '../packages/orchestrator/questions.js';

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

test('réponse en prose : la narration courte du début est écartée, la réponse et sa clôture gardées', () => {
  const narration = 'Je charge les outils.\n\n';
  const table = `Voici les cinq offres FICTIVES retenues. ${'Détail. '.repeat(40)}\n\n`;
  const closing = `J’ai enregistré les trois rapports FICTIFS. ${'Suite. '.repeat(35)}`;
  const broken = '\n```json\n{"simulated": false, "summary": "coupé\n```';
  const starts = [narration.length, narration.length + table.length];
  const answer = proseAnswer(narration + table + closing + broken, starts);
  assert.ok(answer.startsWith('Voici les cinq offres FICTIVES'), 'narration écartée');
  assert.ok(
    answer.includes('J’ai enregistré les trois rapports'),
    'clôture gardée avec la réponse',
  );
  assert.doesNotMatch(answer, /```json|coupé/);
  // A readable JSON block the agent shows stays ; only short messages : the whole turn.
  const shown = `Voici les offres FICTIVES en JSON. ${'x'.repeat(200)}\n\`\`\`json\n[{"a": 1}]\n\`\`\`\nFin.`;
  assert.match(proseAnswer(shown), /\[\{"a": 1\}\]/);
  assert.equal(proseAnswer('Bonjour.\n\nVoilà.', [10]), 'Bonjour.\n\nVoilà.');
});

// Essai réel du 11/11 (Codex) : « question » donnée comme une simple chaîne.
test('question donnée comme chaîne dans la réponse structurée : c’est une question', () => {
  const result = parseAgentResult(
    '{"simulated": false, "summary": "Annonce lue.", "question": "Confirmez-vous l’agence FICTIVE ?", "evidence": []}',
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.question, { message: 'Confirmez-vous l’agence FICTIVE ?' });
  const alone = parseAgentResult('Voici où j’en suis.\n{"question": "Laquelle traiter ?"}');
  assert.equal(alone.ok, true);
  assert.deepEqual(alone.value.question, { message: 'Laquelle traiter ?' });
  // Relecture du 11/11 (constat 2) : a question copied from a form, with other keys, asks nothing.
  const quoted = parseAgentResult(
    'Le formulaire demande {"question": "Combien d’années en Python ?", "answer": "5"} et rien d’autre.',
  );
  assert.equal(quoted.ok, false);
  // questions-18-11 (E127) : a non-text question no longer refuses the answer (before : off
  // contract) ; it is taken out and reported as unread.
  const unread = parseAgentResult(
    '{"simulated": false, "summary": "x", "question": 3, "evidence": []}',
  );
  assert.equal(unread.ok, true);
  assert.equal(unread.value.question, undefined);
  assert.deepEqual(unread.unreadQuestion, { options: [] });
});

// Essais réels du 11/11 (SEEK, LinkedIn + Indeed) : la mission a rendu sa réponse et finit sur une
// offre de suite ; elle attendait le propriétaire et gardait l'espace privé.
test('offre de suite conditionnelle en fin de réponse : pas une question ; une action à conséquence ou un choix direct le restent', () => {
  for (const offer of [
    'Pas de scan, pas de candidature, pas d’envoi. Dis-moi si tu veux que j’ouvre un `oferta` complet sur l’une de ces quatre offres, ou que j’aille voir d’autres résultats plus loin dans les listes.',
    'Dites-moi si vous voulez que je pousse l’une de ces 3 offres vers une évaluation complète (mode `oferta`) ou que je prépare un CV adapté.',
    'Let me know if you want me to run a full evaluation on one of these, or look further down the lists.',
  ])
    assert.equal(decisionRequest(`Classement FICTIF.\n\n${offer}`), null, offer);
  for (const question of [
    'Dis-moi si tu veux que j’envoie la candidature ou que j’attende.',
    'Dis-moi si tu veux que je postule maintenant.',
    'Let me know if you want me to submit it.',
    'Veux-tu que je continue avec la lettre ou que je m’arrête ici ?',
    'Dis-moi si tu veux que je garde la version courte ou la longue ?',
    'Dis-moi lesquelles t’intéressent en priorité : les 6 pistes repérées, ou une sélection que tu choisis toi-même.',
  ])
    assert.ok(decisionRequest(`Point d’étape FICTIF.\n\n${question}`), question);
});
