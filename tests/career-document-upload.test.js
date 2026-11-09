import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerWorkspace } from '../packages/career-ops/workspace.js';
import { attachDocument } from '../packages/career-ops/documents.js';

// Audit 10/11, point 7 : pdftotext absent ou PDF sans texte après le rendu du PDF.
function workspace(t, converter) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'doc-upload-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'output'));
  mkdirSync(join(root, 'inputs'));
  writeFileSync(join(root, 'output/lettre-fictive.md'), '# Lettre FICTIVE\n\nBonjour.\n');
  return { root, career: new CareerWorkspace({ root, roots: [root], converter }) };
}
const render = async () => Buffer.from('%PDF-1.4 FICTIF');

test('career_document pdf : conversion texte impossible → chemin du PDF rendu, avertissement, pas d’orphelin', async (t) => {
  const { root, career } = workspace(t, async () => {
    throw new Error('pdftotext introuvable');
  });
  const answer = await attachDocument(
    career,
    { path: 'output/lettre-fictive.md', format: 'pdf', name: 'Lettre-FICTIVE' },
    { render },
  );
  assert.equal(answer.path, 'output/Lettre-FICTIVE.pdf');
  assert.equal(answer.tailored, false);
  assert.match(answer.uploadError, /Conversion locale impossible/);
  assert.ok(existsSync(join(root, answer.path)));
  assert.deepEqual(readdirSync(join(root, 'inputs')), []);
  // Un format md qui échoue reste une erreur.
  await assert.rejects(
    attachDocument(career, { path: 'output/lettre-fictive.md', format: 'md', name: 'x' }),
    /Conversion locale impossible|Type ou nom/,
  );
});
