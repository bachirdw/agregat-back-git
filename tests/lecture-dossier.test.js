// E71 (essai V2, 06/11, mission f764e96b) : `career_read` sur un dossier du périmètre (« reports »)
// ou sur un motif (« reports/005-preacta-*.md ») répondait « Fichier hors du périmètre career-ops »,
// faux pour un dossier du périmètre, et l'agent ne trouvait pas son rapport. L'appel ne lit toujours
// qu'un fichier (une liste ne prouve aucune lecture : « Lire réellement l'annonce » se crédite sur
// un chemin jds/), mais le refus nomme désormais les fichiers lisibles du dossier ou du motif.
// Données FICTIVES.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools } from '../packages/career-ops/tools.js';

const workspace = (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lecture-dossier-FICTIF-')));
  const outside = realpathSync(mkdtempSync(join(tmpdir(), 'hors-espace-FICTIF-')));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });
  for (const dir of ['reports', 'output', 'scripts']) mkdirSync(join(root, dir));
  writeFileSync(join(root, 'reports/005-entreprise-fictive-2026-11-05.md'), '# Rapport FICTIF\n');
  writeFileSync(join(root, 'reports/006-autre-fictive-2026-11-05.md'), '# Rapport FICTIF\n');
  writeFileSync(join(root, 'output/cv-fictif-005.pdf'), '%PDF-1.4 FICTIF');
  writeFileSync(join(root, 'output/cv-fictif-005.html'), '<p>CV FICTIF</p>');
  writeFileSync(join(root, 'scripts/outil-fictif.mjs'), '');
  writeFileSync(join(outside, 'note-hors-espace.md'), 'FICTIF hors espace');
  symlinkSync(outside, join(root, 'reports/lien-hors-espace'));
  symlinkSync(join(outside, 'note-hors-espace.md'), join(root, 'reports/007-lien-fictif.md'));
  return new CareerTools({ path: () => root });
};
const R5 = 'reports/005-entreprise-fictive-2026-11-05.md';
const R6 = 'reports/006-autre-fictive-2026-11-05.md';

test('E71 FICTIF : un dossier du périmètre nomme ses fichiers lisibles', (t) => {
  const tools = workspace(t);
  for (const path of ['reports', 'reports/'])
    assert.throws(
      () => tools.read(path),
      (error) =>
        /Dossier « reports » : career_read lit un seul fichier/.test(error.message) &&
        error.message.includes(`(2) : ${R5}, ${R6}.`) &&
        !/lien|hors du périmètre/.test(error.message),
      path,
    );
  // Seuls les fichiers que career_read lit : le PDF se liste par career_documents.
  assert.throws(
    () => tools.read('output'),
    (error) =>
      error.message.includes('(1) : output/cv-fictif-005.html.') &&
      /career_documents/.test(error.message) &&
      !/\.pdf/.test(error.message),
  );
});

test('E71 FICTIF : un motif nomme les fichiers qui y répondent', (t) => {
  const tools = workspace(t);
  assert.throws(
    () => tools.read('reports/005-entreprise-*.md'),
    (error) =>
      /Motif « reports\/005-entreprise-\*\.md » : career_read lit un seul fichier/.test(
        error.message,
      ) && error.message.includes(`(1) : ${R5}.`),
  );
  assert.throws(
    () => tools.read('reports/00?-*.md'),
    (error) => error.message.includes('(2)'),
  );
  assert.throws(() => tools.read('reports/999-*.md'), /Aucun fichier lisible ne répond au motif/);
  assert.equal(tools.read(R5).text, '# Rapport FICTIF\n');
});

test('E71 FICTIF : hors du périmètre, rien n’est nommé', (t) => {
  const tools = workspace(t);
  for (const path of [
    'scripts',
    'scripts/*.mjs',
    'reports/lien-hors-espace',
    'reports/lien-hors-espace/*.md',
    '*.md',
  ])
    assert.throws(() => tools.read(path), /^Error: Fichier hors du périmètre career-ops$/, path);
});
