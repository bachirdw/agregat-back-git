import test from 'node:test';
import assert from 'node:assert/strict';
import { getPack } from '../packages/orchestrator/packs.js';
import {
  formatSkillBilan,
  selectSkillIntents,
  SkillProgress,
} from '../packages/orchestrator/skill-router.js';

const manifest = getPack('career-ops').skillManifest;
const call = (progress, id, title, rawInput = {}, output = {}) =>
  progress.observe({
    sessionUpdate: 'tool_call',
    toolCallId: id,
    title,
    rawInput,
    status: 'completed',
    rawOutput: { content: [{ type: 'text', text: JSON.stringify(output) }] },
  });
const URL_FORM = 'http://127.0.0.1:4321/apply';

test('Bilan FICTIF : l’écart d’ordre nomme les étapes faites hors ordre', () => {
  const progress = new SkillProgress(selectSkillIntents('Trouve des offres FICTIVES', [manifest]));
  progress.start();
  call(progress, 'a', 'career_offer_save', { url: 'https://offres.example.test/a', score: 4 });
  const result = progress.finish();
  assert.equal(result.orderDeviation, true);
  assert.ok(result.orderDetails.length >= 1);
  assert.match(result.orderDetails[0], / avant /);
  assert.match(formatSkillBilan(result), /Écart d’ordre : constaté \(.+ avant .+\)\./);
});

test('Bilan FICTIF : candidature multi-pages, relire avant téléverser n’est pas un écart', () => {
  const progress = new SkillProgress(
    selectSkillIntents('Postule à cette offre FICTIVE', [manifest]),
  );
  progress.start();
  call(progress, 'nav', 'browser_navigate', { url: URL_FORM }, { url: URL_FORM, title: 'F' });
  call(
    progress,
    'fill',
    'browser_fillForm',
    { fields: [{ ref: 'e1', value: 'F' }] },
    {
      url: URL_FORM,
      filled: 1,
      hidden: false,
    },
  );
  // Page 1 relue, puis le CV téléversé à la page 2.
  call(progress, 'verify', 'browser_verify', {}, { url: URL_FORM });
  call(
    progress,
    'up',
    'browser_upload',
    { path: 'output/cv.pdf' },
    { url: URL_FORM, uploaded: 'cv.pdf' },
  );
  call(progress, 'review', 'browser_snapshot');
  const states = Object.fromEntries(progress.current().steps.map((s) => [s.id, s.state]));
  assert.equal(states.verify, 'done');
  assert.equal(states.upload, 'done');
  const result = progress.finish();
  assert.equal(result.orderDeviation, false);
  assert.match(formatSkillBilan(result), /Écart d’ordre : aucun constaté/);
});
