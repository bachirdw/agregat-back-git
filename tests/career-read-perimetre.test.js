import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CareerTools } from '../packages/career-ops/tools.js';

// E46 (constaté le 05/11, mission FICTIVE reconstituée) : career_read refusait batch/batch-prompt.md
// (schéma « Machine Summary », cité par modes/oferta.md) et config/cv-facts.json (faits du CV) alors
// que le Skill demande de les lire. La lecture admet désormais batch/*.md, config/*.{json,yml,yaml},
// docs/*.md, templates/** et references/** du clone revu ; l'écriture ne change pas. Données FICTIVES.
const workspace = (t) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'career-lecture-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of [
    'batch',
    'config',
    'docs',
    'templates/cv',
    'references',
    'node_modules/x',
    'scripts',
  ])
    mkdirSync(join(root, dir), { recursive: true });
  const files = {
    'batch/batch-prompt.md': '# Machine Summary FICTIF\n',
    'config/cv-facts.json': '{"facts":["FICTIF"]}',
    'config/plugins.yml': 'apify:\n  enabled: false\n',
    'docs/pipeline.md': 'Doc FICTIVE\n',
    'templates/cv/modern.html': '<html>FICTIF</html>',
    'references/scoring.md': 'Barème FICTIF\n',
    '.env': 'SECRET_FICTIF=1\n',
    'config/.secret.json': '{}',
    'node_modules/x/index.js': '',
    'scripts/x.mjs': '',
    'batch/batch-state.tsv': 'a\tb\n',
  };
  for (const [path, text] of Object.entries(files)) writeFileSync(join(root, path), text);
  return { root, tools: new CareerTools({ path: () => root }) };
};

test('E46 FICTIF : les fichiers que le Skill fait lire sont lisibles, marqués non fiables', (t) => {
  const { tools } = workspace(t);
  for (const path of [
    'batch/batch-prompt.md',
    'config/cv-facts.json',
    'config/plugins.yml',
    'docs/pipeline.md',
    'templates/cv/modern.html',
    'references/scoring.md',
  ]) {
    const read = tools.read(path);
    assert.equal(read.path, path);
    assert.ok(read.text.length > 0, path);
    assert.equal(read.untrusted, true, path);
    assert.equal(read.truncated, false, path);
  }
  // Mêmes bornes de pagination que les autres lectures.
  const page = tools.read('batch/batch-prompt.md', { maxChars: 5 });
  assert.equal(page.text, '# Mac');
  assert.equal(page.truncated, true);
  assert.equal(page.nextOffset, 5);
  assert.throws(() => tools.read('config/cv-facts.json', { maxChars: 48001 }), /Pagination/);
});

test('E46 FICTIF : l’écriture de ces chemins reste refusée, career_write inchangé', (t) => {
  const { tools } = workspace(t);
  for (const path of [
    'batch/batch-prompt.md',
    'config/cv-facts.json',
    'config/plugins.yml',
    'docs/pipeline.md',
    'templates/cv/modern.html',
    'references/scoring.md',
  ])
    assert.throws(() => tools.write(path, 'FICTIF'), /hors du périmètre/, path);
});

test('E46 FICTIF : secrets, dépendances, scripts et traversées restent hors lecture', (t) => {
  const { tools } = workspace(t);
  for (const path of [
    '.env',
    'config/.secret.json',
    'node_modules/x/index.js',
    'scripts/x.mjs',
    'batch/batch-state.tsv',
    'batch/sous/dossier.md',
    'config/sous/x.json',
    'config/../.env',
    'docs/../cv.md',
    'templates/../.env',
    '/etc/passwd',
    'references/x.mjs',
  ])
    assert.throws(() => tools.read(path), /hors du périmètre|traversée/, path);
});
