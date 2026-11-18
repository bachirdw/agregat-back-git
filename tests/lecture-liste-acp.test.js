// E120 (18/11) : par le canal ACP aussi, une réponse de career_read qui n'est qu'une liste
// (`listing: true`) ne prouve aucune lecture : ni « Lire le rapport », ni la lecture d'une annonce,
// ni un appel compté au Bilan. Une lecture réelle reste créditée. Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { createTurnTruth } from '../packages/career-ops/truth.js';
import {
  selectSkillIntents,
  skillManifestSchema,
  SkillProgress,
} from '../packages/orchestrator/skill-router.js';
import { answeredListing } from '../packages/orchestrator/exit-code.js';

const SKILL = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const EMAIL_PROMPT = "Rédige l'e-mail de candidature pour l'offre du rapport 005 (mode email).";
const answer = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value) }] });
const listing = (path) =>
  answer({
    path,
    listing: true,
    kind: 'folder',
    dir: path.replace(/\/$/, ''),
    files: [{ path: `${path}005-fictif.md`, size: 10, modified: '2026-11-18T10:00:00.000Z' }],
    total: 1,
    truncated: false,
  });
const calls = (observer, id, path, rawOutput) => {
  observer.observe({
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: 'mcp__platform__career_read',
    rawInput: { path },
    status: 'pending',
  });
  observer.observe({
    sessionUpdate: 'tool_call_update',
    toolCallId: id,
    title: 'mcp__platform__career_read',
    status: 'completed',
    rawOutput,
  });
};

test('E120 FICTIF : answeredListing lit la marque de la réponse, jamais un texte lu', () => {
  assert.equal(answeredListing(listing('reports/')), true);
  assert.equal(
    answeredListing(answer({ path: 'reports/005.md', text: '{"listing":true}' })),
    false,
  );
  assert.equal(answeredListing(answer({ path: 'reports/005.md', text: '# FICTIF' })), false);
  assert.equal(answeredListing(undefined), false);
});

test('E120 FICTIF : par ACP, une liste ne crédite ni lecture ni étape ; une lecture réelle oui', () => {
  const truth = createTurnTruth();
  const progress = new SkillProgress(selectSkillIntents(EMAIL_PROMPT, [SKILL]));
  progress.start();
  const report = () => progress.current().steps.find((step) => step.id === 'report').state;
  for (const observer of [truth, progress]) {
    calls(observer, 'call-1', 'reports/', listing('reports/'));
    calls(observer, 'call-2', 'jds/', listing('jds/'));
  }
  assert.notEqual(report(), 'done');
  assert.equal(truth.hasJdRead(), false);
  assert.deepEqual(truth.completedCalls(), []);
  for (const observer of [truth, progress]) {
    calls(
      observer,
      'call-3',
      'reports/005-fictif.md',
      answer({ path: 'reports/005-fictif.md', text: '# FICTIF' }),
    );
    calls(
      observer,
      'call-4',
      'jds/annonce-fictive.md',
      answer({ path: 'jds/annonce-fictive.md', text: 'FICTIF' }),
    );
  }
  assert.equal(report(), 'done');
  assert.equal(truth.hasJdRead(), true);
  assert.equal(truth.completedCalls().filter((call) => call.name === 'career_read').length, 2);
});
