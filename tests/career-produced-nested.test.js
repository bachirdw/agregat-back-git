import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { documentKind, listProducedDocuments } from '../packages/career-ops/produced-documents.js';

// Audit misc3 (constat career 10) : PDF en sous-dossier de output/, CV nommé sans séparateur.
test('documentKind : CV/Resume en préfixe sans séparateur, la lettre reste une lettre', () => {
  for (const name of [
    'CVAcme.pdf',
    'cv_acme.pdf',
    'cv-acme.pdf',
    'Resume-Acme.pdf',
    'ResumeAcme.pdf',
  ])
    assert.equal(documentKind(name), 'cv', name);
  for (const name of [
    'cover-acme.pdf',
    'CVAcme-lettre.pdf',
    'cv_cover_letter.pdf',
    'CoverAcme.pdf',
  ])
    assert.equal(documentKind(name), 'cover', name);
  for (const name of ['recv.pdf', 'facture.pdf', 'dossier-acme.pdf'])
    assert.equal(documentKind(name), 'other', name);
});

test('listProducedDocuments : parcours récursif borné, cachés et liens ignorés', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'produced-nested-FICTIF-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'output/acme/v2'), { recursive: true });
  mkdirSync(join(root, 'output/.cache'), { recursive: true });
  mkdirSync(join(root, 'output/a/b/c/d/e'), { recursive: true });
  mkdirSync(join(root, 'data'));
  writeFileSync(join(root, 'output/CVAcme.pdf'), 'x');
  writeFileSync(join(root, 'output/acme/cv_acme.pdf'), 'x');
  writeFileSync(join(root, 'output/acme/v2/Resume-Acme.pdf'), 'x');
  writeFileSync(join(root, 'output/.cache/cv.pdf'), 'x');
  writeFileSync(join(root, 'output/a/b/c/d/e/trop-profond.pdf'), 'x');
  writeFileSync(join(root, 'data/pdf-index.tsv'), '12\toutput/acme/cv_acme.pdf\n');
  const docs = listProducedDocuments(root);
  const paths = docs.map((d) => d.path).sort();
  assert.deepEqual(paths, [
    'output/CVAcme.pdf',
    'output/acme/cv_acme.pdf',
    'output/acme/v2/Resume-Acme.pdf',
  ]);
  const nested = docs.find((d) => d.path === 'output/acme/cv_acme.pdf');
  assert.equal(nested.name, 'cv_acme.pdf');
  assert.equal(nested.tailored, true);
  assert.equal(nested.kind, 'cv');
  assert.equal(docs.find((d) => d.path === 'output/CVAcme.pdf').kind, 'cv');
});
