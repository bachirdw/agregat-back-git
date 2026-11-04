import test from 'node:test';
import assert from 'node:assert/strict';
import { analyseRun } from '../.manager/outils/bilan-vs-events.mjs';

const call = (id, title, status, rawInput = {}) => ({
  type: 'agent',
  data: { sessionUpdate: 'tool_call', toolCallId: id, title, status, rawInput },
});
const bilan = (successes, missing = 'aucune action demandée identifiable comme manquante') =>
  `Bilan\n- Actions réussies : ${successes}.\n- Actions échouées : aucune observée.\n- Résultats mixtes : aucun.\n- Non exécuté : ${missing}.`;
const run = (state, summary) => ({ id: 'FICTIF', state, result: { summary } });

test('Bilan cohérent FICTIF : lecture, note enregistrée, 0 contradiction', () => {
  const events = [
    call('a', 'career_read', 'completed', { path: 'jds/offre-fictive.md' }),
    call('b', 'mcp__platform__career_offer_save', 'completed', {
      score: 4,
      url: 'https://x.test/1',
    }),
  ];
  const out = analyseRun(
    run('completed', 'Note 4/5.\n' + bilan('career_read, career_offer_save')),
    events,
  );
  assert.deepEqual(out.contradictions, []);
  assert.deepEqual(out.observations, []);
  assert.deepEqual(out.calls, ['career_read:completed', 'career_offer_save:completed']);
});

test('Contradictions FICTIVES : outil cité sans appel, appel absent du Bilan, incomplète mais completed', () => {
  const out = analyseRun(
    run(
      'completed',
      'Fait.\nMission incomplète : 1 offre(s) notée(s)\n' + bilan('career_offer_save'),
    ),
    [call('c', 'career_write', 'completed', { path: 'documents/cv-FICTIF.md' })],
  );
  assert.ok(out.contradictions.some((c) => c.includes('career_offer_save, aucun appel')));
  assert.ok(out.contradictions.some((c) => c.includes('career_write absent')));
  assert.ok(out.contradictions.some((c) => c.includes('« completed » alors que')));
  assert.ok(out.contradictions.some((c) => c.includes('aucune action demandée »')));
});

test('Observations FICTIVES : note sans lecture prouvée, question en prose terminée', () => {
  const out = analyseRun(
    run('completed', 'Je donne 3/5. Dois-je enregistrer ?\n' + bilan('aucune observée')),
    [],
  );
  assert.equal(out.contradictions.length, 0);
  assert.ok(out.observations.some((o) => o.includes('N/5')));
  assert.ok(out.observations.some((o) => o.includes('question en prose')));
  // A readable capture or a form question settles both observations.
  const settled = analyseRun(
    run('completed', 'Je donne 3/5. Dois-je enregistrer ?\n' + bilan('aucune observée')),
    [
      { type: 'browser_evidence', data: { readable: true, url: 'https://offres.example.test/a' } },
      { type: 'question', data: {} },
    ],
  );
  assert.deepEqual(settled.observations, []);
  assert.deepEqual(settled.readablePages, ['offres.example.test']);
});

test('Accords automatiques FICTIFS : un appel passerelle approuvé compte comme observé', () => {
  const out = analyseRun(run('completed', bilan('browser_navigate')), [
    {
      type: 'permission_auto',
      data: { toolCallId: 'x', capability: 'mcp__platform__browser_navigate' },
    },
  ]);
  assert.deepEqual(out.contradictions, []);
  assert.deepEqual(out.calls, ['browser_navigate:approved']);
});
