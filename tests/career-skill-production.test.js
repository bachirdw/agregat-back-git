import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools } from '../packages/career-ops/tools.js';

// production-01 : chaîne CV/lettre du Skill (modes/pdf.md, modes/cover.md). Espace career-ops FICTIF,
// aucune donnée réelle (example.test).
function workspace(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'skill-production-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, tools: new CareerTools({ path: () => root }) };
}

// Point 2 : chemins écrivables de la chaîne (payload JSON, HTML construit, payload de lettre), interdits gardés.
test('career_write : payload JSON, HTML du CV et payload de lettre écrivables sous output/', (t) => {
  const { root, tools } = workspace(t);
  for (const [path, text] of [
    [
      'output/cv-candidat-fictif-042-entreprise-fictive.json',
      '{"candidate":{"name":"Candidat FICTIF"}}',
    ],
    [
      'output/cv-candidat-fictif-042-entreprise-fictive.html',
      '<p>CV FICTIF corrigé après verify-cv-facts</p>',
    ],
    [
      'output/applications/042/cv/tailored/v001/cv.html',
      '<p>CV FICTIF (dossier de candidature)</p>',
    ],
    ['output/cover-payload-entreprise-fictive.json', '{"letter":{"company":"Entreprise FICTIVE"}}'],
  ]) {
    assert.deepEqual(tools.write(path, text), { path, saved: true }, path);
    assert.equal(readFileSync(join(root, path), 'utf8'), text);
    assert.equal(tools.read(path).text, text);
  }
});

test('career_write : data/pdf-index.tsv et data/applications.md ne s’écrivent que par les scripts du Skill ; drafts/ et PDF refusés', (t) => {
  const { tools } = workspace(t);
  assert.throws(
    () => tools.write('data/pdf-index.tsv', 'report\tpdf\n042\toutput/cv.pdf\n'),
    /pdf-index\.tsv[^\n]*generate-pdf/,
  );
  assert.throws(() => tools.write('data/applications.md', '| # | FICTIF |'), /merge-tracker/);
  for (const path of [
    'drafts/lettre-fictive.md',
    'output/cv-fictif.pdf',
    'reports/042-entreprise-fictive-2026-11-05.html',
    'documents/cv-fictif.html',
    'templates/cv-template.html',
  ])
    assert.throws(() => tools.write(path, 'FICTIF'), /périmètre|reports\//, path);
  // Lecture de l'index PDF toujours possible (couche utilisateur du Skill).
  assert.throws(() => tools.read('data/pdf-index.tsv'), /ENOENT/);
});
