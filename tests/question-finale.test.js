import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionRequest } from '../packages/orchestrator/questions.js';

// bilan-06 (E52) : un dernier paragraphe qui demande au propriétaire de décider, en prose, sans
// formulaire ni champ `question`, est une question. Textes FICTIFS ; le premier reprend la forme
// exacte du message réel du registre (E52), sans donnée personnelle.
const REAL =
  'J’ai lu la boîte d’entrée : 48 entrées en attente, dont 6 pistes repérées par le scan.\n\n' +
  'Dis-moi lesquelles t’intéressent en priorité : les 6 pistes repérées, les offres déjà dans le pipeline, ou une sélection que tu choisis toi-même.';

test('E52 : le dernier paragraphe du message réel est une question au propriétaire', () => {
  assert.deepEqual(decisionRequest(REAL), {
    message:
      'Dis-moi lesquelles t’intéressent en priorité : les 6 pistes repérées, les offres déjà dans le pipeline, ou une sélection que tu choisis toi-même.',
  });
});

test('E52 : formes qui demandent une décision, avec ou sans point d’interrogation', () => {
  for (const text of [
    'Trois offres lues.\n\nVeux-tu que je continue avec les 3 suivantes ?',
    'Voulez-vous que je poursuive avec le reste de la boîte.',
    'Préfères-tu la version courte ou la version longue',
    'Préférez-vous que je m’arrête ici',
    'Souhaites-tu que j’enregistre ces offres',
    'Souhaitez-vous un rapport par offre',
    'Dites-moi lesquels retenir.',
    'Rapport écrit.\n\nFaut-il continuer ?',
    'Faut-il continuer ?**',
    'Two offers read.\n\nDo you want me to continue with the rest',
    'Would you like a PDF for each one',
    'Let me know which ones to prioritise.',
    'Which one should I evaluate first?',
    'Dis‑moi laquelle traiter d’abord',
  ])
    assert.equal(
      decisionRequest(text)?.message,
      text
        .split(/\n[ \t]*\n/)
        .at(-1)
        .trim(),
      text,
    );
});

test('E52 : un message final sans demande, ou dont la demande n’est pas en dernier, reste une réponse', () => {
  for (const text of [
    'Boîte d’entrée FICTIVE traitée : 2 évaluées, 1 non confirmée.',
    'Rapport écrit. Le suivi est à jour.',
    'Le recruteur demande « Quel est votre préavis ? ». Rapport écrit, suivi à jour.',
    'Veux-tu continuer ?\n\nJ’ai traité 3 entrées ; rapport et suivi écrits.',
    'The report is written, which closes the evaluation.',
    '',
    '   \n\n  ',
  ])
    assert.equal(decisionRequest(text), null, JSON.stringify(text));
  assert.equal(decisionRequest(undefined), null);
  assert.equal(decisionRequest({ summary: 'Veux-tu ?' }), null);
});

test('E52 : le message est borné à la taille d’une question', () => {
  const long = 'Veux-tu que je continue ' + 'x'.repeat(9000) + ' ?';
  assert.equal(decisionRequest(long).message.length, 8000);
});
