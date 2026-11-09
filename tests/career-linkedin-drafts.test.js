import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools } from '../packages/career-ops/tools.js';

// Audit misc3 : un second brouillon LinkedIn n'écrase plus le premier (un brouillon par cible).
test('linkedin_draft : un brouillon par cible, le plus récent reste relay/linkedin.json', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'linkedin-drafts-FICTIF-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tools = new CareerTools({ path: () => root });
  tools.linkedIn({ url: 'https://www.linkedin.com/in/ada-fictive/', text: 'Premier FICTIF' });
  tools.linkedIn({ url: 'https://www.linkedin.com/in/bob-fictif/', text: 'Second FICTIF' });
  const all = tools.linkedInDrafts();
  assert.deepEqual(all.map((d) => d.text).sort(), ['Premier FICTIF', 'Second FICTIF']);
  assert.equal(tools.linkedInLatest().text, 'Second FICTIF');
  // Rétrocompatible : le fichier historique garde le dernier brouillon.
  assert.equal(
    JSON.parse(readFileSync(join(root, 'relay/linkedin.json'), 'utf8')).text,
    'Second FICTIF',
  );
  // Même cible : remplacée, pas dupliquée.
  tools.linkedIn({ url: 'https://www.linkedin.com/in/ada-fictive/', text: 'Premier corrigé' });
  assert.equal(tools.linkedInDrafts().length, 2);
  assert.equal(tools.linkedInLatest().text, 'Premier corrigé');
});

test('linkedin_draft : historique borné', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'linkedin-bound-FICTIF-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tools = new CareerTools({ path: () => root });
  for (let i = 0; i < 60; i++)
    tools.linkedIn({ url: `https://www.linkedin.com/in/fictif-${i}/`, text: `Message ${i}` });
  const all = tools.linkedInDrafts();
  assert.ok(all.length <= 50);
  assert.ok(all.some((d) => d.text === 'Message 59'));
});

test('linkedInLatest : ancien relay/linkedin.json seul toujours lu ; rien : null', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'linkedin-old-FICTIF-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const tools = new CareerTools({ path: () => root });
  assert.equal(tools.linkedInLatest(), null);
});
