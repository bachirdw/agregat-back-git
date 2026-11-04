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

test('résumé absent : prose récupérée, secret masqué et JSON seul toujours refusé', () => {
  const empty = { ...valid, summary: '' };
  const secret = 'AIza' + 'A'.repeat(25);
  const parsed = parseAgentResult(
    `Réponse FICTIVE ${secret}\n` + '```json\n' + JSON.stringify(empty) + '\n```',
  );
  assert.equal(parsed.ok, true);
  assert.match(parsed.value.summary, /Réponse FICTIVE/);
  assert.doesNotMatch(parsed.value.summary, /AIza/);
  assert.match(parsed.value.summary, /secret masqué/);
  assert.equal(parseAgentResult(JSON.stringify(empty)).ok, false);
});

test('provenance : runtime fait autorité et données Najah restent fictives', async () => {
  const { executionResult } = await import('../packages/orchestrator/result.js');
  for (const simulated of [true, false]) {
    const definition = { id: simulated ? 'fixture' : 'faux-reel', simulated };
    const value = executionResult(
      { ...valid, simulated: !simulated, provenance: { analysis: 'mensonge' } },
      definition,
    );
    assert.equal(value.simulated, simulated);
    assert.equal(value.provenance.analysis, simulated ? 'démonstrateur' : 'faux-reel');
  }
  const najah = executionResult(valid, { id: 'faux-reel' }, { fixtureData: true });
  assert.equal(najah.simulated, true);
  assert.deepEqual(najah.provenance, { data: 'fictives', analysis: 'faux-reel' });
});

test('mode agent core : exécution faux ACP sans modèle, provenance réelle imposée', async () => {
  const { createApp } = await import('../apps/api/server.js');
  const { mkdtempSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const app = createApp({ dataDir: mkdtempSync(join(tmpdir(), 'review-provenance-')) });
  const run = {
    id: crypto.randomUUID(),
    state: 'queued',
    cwd: app.engine.dataDir,
    prompt: 'FICTIF',
    model: '',
    mode: 'agent',
    budgetCents: 0,
  };
  app.store.create(run);
  const plan = {
    simulated: false,
    skills: [],
    agent: {
      id: 'faux-reel',
      command: process.execPath,
      args: [resolve('tests/fixtures/fake-acp.js')],
      env: [],
      safeModes: [],
      fixedEnv: { FAKE_ACP: JSON.stringify({ result: valid }) },
    },
    pack: { id: 'core', workflow: { steps: [] } },
  };
  const control = { abort: new AbortController(), runtime: null };
  app.engine.active.set(run.id, control);
  try {
    await app.engine.execute(run, plan, control, null);
    const done = app.store.get(run.id);
    assert.equal(done.state, 'completed', done.error);
    assert.equal(done.result.simulated, false);
    assert.equal(done.result.provenance.analysis, 'faux-reel');
  } finally {
    await app.close();
  }
});
test('résultat agent : après une reprise de session, le dernier bloc JSON est la réponse', () => {
  const old = '```json\n{"simulated":false,"summary":"ANCIEN tour FICTIF","evidence":[]}\n```';
  const fresh = '```json\n{"simulated":false,"summary":"NOUVEAU tour FICTIF","evidence":[]}\n```';
  const result = parseAgentResult(`${old}\n${fresh}`);
  assert.equal(result.ok, true);
  assert.equal(result.value.summary, 'NOUVEAU tour FICTIF');
});

test('résultat agent : deux objets JSON successifs gardent le dernier résultat vérifié', () => {
  const progress = { simulated: false, summary: 'Je vérifie.', evidence: [] };
  const final = {
    simulated: false,
    summary: 'Titre observé : Example Domain',
    evidence: [{ url: 'https://example.com/', title: 'Example Domain' }],
  };
  const parsed = parseAgentResult(JSON.stringify(progress) + JSON.stringify(final));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, final);
  assert.match(parseAgentResult(JSON.stringify(progress) + '{"summary":').reason, /JSON invalide/);
});

// c3-question-prose-01, point 2 : champ facultatif `question`, summary vide permis avec lui.
test('question structurée acceptée, summary vide permis, rendue telle quelle', () => {
  const question = { message: 'Dois-je continuer FICTIF ?', options: ['oui', 'non'] };
  const out = parseAgentResult(
    JSON.stringify({ simulated: false, summary: '', evidence: [], question }),
  );
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(out.value.question, question);
  assert.equal(out.value.summary, '');
  const bare = parseAgentResult(
    JSON.stringify({ simulated: false, summary: 'ok', evidence: [], question: { message: 'Q ?' } }),
  );
  assert.equal(bare.ok, true);
  assert.deepEqual(bare.value.question, { message: 'Q ?' });
});

test('question hors contrat refusée : 9 options, message vide, option trop longue', () => {
  const base = { simulated: false, summary: 'ok', evidence: [] };
  for (const question of [
    { message: 'Q ?', options: Array.from({ length: 9 }, (_, i) => `o${i}`) },
    { message: '' },
    { message: 'x'.repeat(4001) },
    { message: 'Q ?', options: [''] },
    { message: 'Q ?', options: ['x'.repeat(201)] },
  ]) {
    const out = parseAgentResult(JSON.stringify({ ...base, question }));
    assert.equal(out.ok, false, JSON.stringify(question).slice(0, 80));
  }
  // Sans question, un summary vide reste hors contrat.
  assert.equal(parseAgentResult(JSON.stringify({ ...base, summary: '' })).ok, false);
});
