import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import {
  formatSkillBilan,
  selectSkillIntents,
  SkillProgress,
  skillManifestSchema,
} from '../packages/orchestrator/skill-router.js';

// E41 (constaté le 05/11, 3/3 sur la page FICTIVE 127.0.0.1:4321/) : l'étape `open` de l'intent
// `apply` porte `urlPattern.words` ; une page de candidature à chemin opaque n'était jamais
// créditée et « Écart d'ordre : constaté » suivait alors que les champs y avaient été remplis.
// Règle : une navigation suivie d'un remplissage réussi sur la même page (hôte + chemin) prouve
// l'ouverture. Une annonce seule ne la prouve toujours pas. Données FICTIVES.
const career = skillManifestSchema.parse(
  parse(
    readFileSync(
      new URL('../domain-packs/career-ops/skill-manifest.yaml', import.meta.url),
      'utf8',
    ),
  ),
);
const PROMPT = 'Postule à cette offre FICTIVE';
const start = () => {
  const progress = new SkillProgress(selectSkillIntents(PROMPT, [career]));
  progress.start();
  return progress;
};
// Canal ACP : l'URL demandée en entrée, le résultat de la passerelle navigateur en sortie.
const navigate = (progress, id, url) =>
  progress.observe({
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: 'browser_navigate',
    rawInput: { url },
    status: 'completed',
    rawOutput: { content: [{ type: 'text', text: JSON.stringify({ url, title: 'FICTIF' }) }] },
  });
const fill = (progress, id, url) =>
  progress.observe({
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: 'browser_fillForm',
    rawInput: { fields: [{ ref: 'e1', value: 'FICTIF' }] },
    status: 'completed',
    rawOutput: {
      content: [{ type: 'text', text: JSON.stringify({ url, filled: 1, hidden: false }) }],
    },
  });
const snapshot = (progress, id) =>
  progress.observe({
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title: 'browser_snapshot',
    status: 'completed',
  });
const step = (result, id) => result.steps.find((item) => item.id === id);

test('E41 FICTIF : navigation sans mot-clé puis remplissage sur la même page → ouverture faite', () => {
  const progress = start();
  navigate(progress, 'nav', 'http://127.0.0.1:4321/');
  assert.equal(step(progress.current(), 'open').state, 'pending');
  fill(progress, 'fill', 'http://127.0.0.1:4321/');
  snapshot(progress, 'review');
  const result = progress.finish();
  assert.equal(step(result, 'open').state, 'done');
  assert.equal(step(result, 'open').toolCallId, 'nav');
  assert.equal(step(result, 'fill').state, 'done');
  assert.equal(result.orderDeviation, false);
  const bilan = formatSkillBilan(result);
  assert.match(bilan, /✓ Ouvrir le formulaire \(faite\)/);
  assert.match(bilan, /Écart d’ordre : aucun constaté/);
});

test('E41 FICTIF : ATS à chemin opaque, requête et ancre ignorées, dernière visite de la page', () => {
  const progress = start();
  navigate(progress, 'ad', 'https://ats.example.test/jobs/123');
  navigate(progress, 'form', 'https://ats.example.test/x/7f3a9c?ref=FICTIF');
  fill(progress, 'fill', 'https://ats.example.test/x/7f3a9c/#etape-1');
  const result = progress.finish();
  assert.equal(step(result, 'open').toolCallId, 'form');
  assert.equal(step(result, 'fill').state, 'done');
});

test('E41 FICTIF : remplissage sur une autre page que la navigation → ouverture non prouvée', () => {
  const progress = start();
  navigate(progress, 'ad', 'https://ats.example.test/jobs/123');
  fill(progress, 'fill', 'https://ats.example.test/x/7f3a9c');
  const other = progress.finish();
  assert.equal(step(other, 'open').state, 'pending');
  // Autre hôte, même chemin : pas la même page non plus.
  const host = start();
  navigate(host, 'ad', 'https://a.example.test/');
  fill(host, 'fill', 'https://b.example.test/');
  assert.equal(step(host.finish(), 'open').state, 'pending');
});

test('E41 FICTIF : une annonce seule ne prouve toujours pas l’ouverture du formulaire', () => {
  const progress = start();
  navigate(progress, 'ad', 'https://example.test/jobs/123');
  snapshot(progress, 'capture');
  const result = progress.finish();
  assert.equal(step(result, 'open').state, 'pending');
  assert.match(formatSkillBilan(result), /· Ouvrir le formulaire \(non exécutée\)/);
});

test('E41 FICTIF : remplissage échoué → ouverture non prouvée par lui', () => {
  const progress = start();
  navigate(progress, 'nav', 'http://127.0.0.1:4321/');
  progress.observe({
    sessionUpdate: 'tool_call',
    toolCallId: 'fill',
    title: 'browser_fillForm',
    status: 'failed',
    rawOutput: {
      content: [{ type: 'text', text: JSON.stringify({ url: 'http://127.0.0.1:4321/' }) }],
    },
  });
  assert.equal(step(progress.finish(), 'open').state, 'pending');
});

test('E41 FICTIF : canal passerelle (URL d’arrivée en entrée) crédite de même', () => {
  const progress = start();
  for (const [id, title] of [
    ['00000000-0000-4000-8000-0000000000a1', 'browser_navigate'],
    ['00000000-0000-4000-8000-0000000000a2', 'browser_fillForm'],
  ])
    progress.observe({
      sessionUpdate: 'tool_call',
      toolCallId: id,
      title,
      rawInput: { command: undefined, path: undefined, url: 'http://127.0.0.1:4321/' },
      status: 'completed',
    });
  const result = progress.finish();
  assert.equal(step(result, 'open').toolCallId, '00000000-0000-4000-8000-0000000000a1');
  assert.equal(step(result, 'fill').state, 'done');
  assert.equal(result.orderDeviation, false);
});
