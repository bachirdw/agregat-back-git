// review-lecture-18-11 (E128) : relecture indépendante de la lecture par script du Skill. Une annonce
// rendue par un script compte comme lue ; une autre annonce, notée sans lecture, ne doit pas passer
// pour lue parce que son adresse partage avec la première un segment qui n'est pas son identifiant
// (un nom de portail daté, une section de site). Données FICTIVES (example.test), aucun modèle, aucun
// réseau, aucun navigateur.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPack } from '../packages/orchestrator/packs.js';
import { SkillProgress, selectSkillIntents } from '../packages/orchestrator/skill-router.js';

const manifest = () => getPack('career-ops').skillManifest;
const JD = 'Poste FICTIF\n\n' + 'Texte FICTIF. '.repeat(300);
const answer = (text, exitCode = 0) => JSON.stringify({ text, exitCode, untrusted: true });
const pipelineProgress = () => {
  const selection = selectSkillIntents('Traite les offres en attente FICTIVES', [manifest()]);
  assert.deepEqual(
    selection.map(({ intent }) => intent.id),
    ['pipeline'],
  );
  const progress = new SkillProgress(selection);
  progress.start();
  return progress;
};
// Forme ACP d'un appel career_script (outil nommé `mcp__platform__…`).
function script(progress, id, input, text, exitCode = 0) {
  const title = 'mcp__platform__career_script';
  for (const update of [
    { sessionUpdate: 'tool_call', toolCallId: id, title, status: 'pending', rawInput: input },
    {
      sessionUpdate: 'tool_call_update',
      toolCallId: id,
      status: 'completed',
      rawOutput: [{ type: 'text', text: answer(text, exitCode) }],
    },
  ])
    progress.observe(update);
}
const scored = (urls) => urls.map((url, index) => ({ url, toolCallId: `note-${index}` }));

test('review E128 FICTIF : une annonce lue par script ne rend pas lue une autre annonce du même portail', () => {
  // Deux annonces d'un même portail dont le chemin porte un segment commun de 6 caractères ou plus
  // avec un chiffre (section datée) : seul le dernier identifiant nomme l'annonce.
  const read = 'https://portail.example.test/fr-FR/Carrieres_2026/job/Poste-Fictif_R-100001';
  const other = 'https://portail.example.test/fr-FR/Carrieres_2026/job/Autre-Poste_R-100002';
  const progress = pipelineProgress();
  script(progress, 'jd-0', { command: 'fetch-jd', args: [read] }, JD);
  assert.deepEqual(progress.incomplete([], false, scored([read])), []);
  assert.deepEqual(progress.incomplete([], false, scored([read, other])), [
    '1 offre(s) notée(s) sans lecture de leur page',
  ]);
});

test('review E128 FICTIF : l’identifiant de l’annonce lue par script la reconnaît sous une autre adresse du même hôte', () => {
  const progress = pipelineProgress();
  script(
    progress,
    'jd-0',
    { command: 'fetch-jd', args: ['https://ats.example.test/societe-fictive/jobs/4000000001'] },
    JD,
  );
  // L'annonce notée sous l'adresse d'intégration du même hôte, par son numéro.
  assert.deepEqual(
    progress.incomplete(
      [],
      false,
      scored(['https://ats.example.test/embed/job?gh_jid=4000000001']),
    ),
    [],
  );
  // Un numéro voisin n'est pas l'annonce lue.
  assert.deepEqual(
    progress.incomplete(
      [],
      false,
      scored(['https://ats.example.test/embed/job?gh_jid=4000000002']),
    ),
    ['1 offre(s) notée(s) sans lecture de leur page'],
  );
});

test('review E128 FICTIF : un script de lecture sans code de sortie lu ne prouve rien', () => {
  const progress = pipelineProgress();
  const title = 'mcp__platform__career_script';
  const url = 'https://ats.example.test/societe-fictive/jobs/4000000003';
  progress.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'x',
    title,
    status: 'pending',
    rawInput: { command: 'fetch-jd', args: [url] },
  });
  // Un texte long dont la réponse ne porte pas de code de sortie (sortie coupée, simple mention).
  progress.observe({
    sessionUpdate: 'tool_call_update',
    toolCallId: 'x',
    status: 'completed',
    rawOutput: [{ type: 'text', text: `${JD}\nexitCode: 0` }],
  });
  assert.equal(progress.current().steps.find((step) => step.id === 'read-offer').state, 'pending');
  assert.deepEqual(progress.incomplete([], false, scored([url])), [
    '1 offre(s) notée(s) sans lecture de leur page',
  ]);
});
