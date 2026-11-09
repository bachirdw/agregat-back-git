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

// Audit du 10/11 (constat 4) : une formule de politesse (« Dis-moi si tu veux autre chose »,
// « Would you like me to also… ») ou un pronom relatif (« à laquelle », « pour lequel ») en fin de
// réponse passait pour une question : la mission restait en `awaiting_owner`, sans limite, et
// bloquait l'espace privé. Seule une vraie question finale adressée au propriétaire attend.
test('audit 10/11 FICTIF : politesse et pronoms relatifs ne sont pas des questions', () => {
  for (const text of [
    'Candidature FICTIVE préparée pour l’offre à laquelle tu voulais candidater.',
    'Le poste pour lequel tu postules est ouvert.',
    'Formulaire FICTIF rempli.\n\nDis-moi si tu veux autre chose.',
    'Formulaire FICTIF rempli. Dites-moi si vous avez besoin d’autre chose.',
    'Application FICTIVE submitted.\n\nWould you like me to also save the offer?',
    'Rapport écrit. Veux-tu que je l’enregistre aussi ?',
    'Done. Let me know if you need anything else.',
    'C’est fait. N’hésite pas si tu as besoin d’aide.',
  ])
    assert.equal(decisionRequest(text), null, JSON.stringify(text));
});

test('audit 10/11 FICTIF : une vraie question finale attend toujours', () => {
  for (const text of [
    'Formulaire FICTIF rempli. Dis-moi si je dois cliquer sur Envoyer.',
    'Deux offres FICTIVES. Laquelle veux-tu que je traite ?',
    'Deux offres FICTIVES. Lesquelles retenir',
    'Rapport écrit. Merci ! Veux-tu que je continue avec la suivante ?',
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
