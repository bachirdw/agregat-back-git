import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

// ecrits-01 (constaté sur trois missions réelles du 13/11) : le Skill lit writing-samples/ pour
// calibrer le style (modes/_writing.md : tous les fichiers sauf README.md ; DATA_CONTRACT.md : couche
// utilisateur), mais career_read le refusait « hors du périmètre ». Les fichiers .md et .txt de ce
// dossier, un seul niveau, se lisent désormais ; jamais ils ne s'écrivent. Échantillon FICTIF.
const SAMPLE = 'Phrase inventée numéro un. Phrase inventée numéro deux.\n';
const samples = (t, ownerMode = false) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'ecrits-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'writing-samples'));
  writeFileSync(join(root, 'writing-samples/exemple-fictif.md'), SAMPLE);
  writeFileSync(join(root, 'writing-samples/note fictive_2.txt'), SAMPLE);
  writeFileSync(join(root, 'cv.md'), '# CV FICTIF\n');
  return { root, tools: new CareerTools({ path: () => root }, { ownerMode }) };
};

test('ecrits-01 FICTIF : un échantillon d’écriture se lit, marqué non fiable', (t) => {
  for (const ownerMode of [false, true]) {
    const { tools } = samples(t, ownerMode);
    for (const path of [
      'writing-samples/exemple-fictif.md',
      'writing-samples/note fictive_2.txt',
    ]) {
      const read = tools.read(path);
      assert.equal(read.text, SAMPLE, path);
      assert.equal(read.untrusted, true, path);
    }
  }
});

test('ecrits-01 FICTIF : un échantillon d’écriture ne s’écrit jamais', (t) => {
  for (const ownerMode of [false, true]) {
    const { root, tools } = samples(t, ownerMode);
    for (const path of [
      'writing-samples/exemple-fictif.md',
      'writing-samples/nouveau-fictif.md',
      'writing-samples/note fictive_2.txt',
    ])
      assert.throws(
        () => tools.write(path, 'réécrit'),
        /^Error: Fichier hors du périmètre career-ops$/,
        path,
      );
    assert.equal(readFileSync(join(root, 'writing-samples/exemple-fictif.md'), 'utf8'), SAMPLE);
  }
});

test('ecrits-01 FICTIF : les refus existants ne bougent pas', (t) => {
  const { tools } = samples(t);
  for (const path of [
    'writing-samples/x.mjs',
    'writing-samples/x.json',
    'writing-samples/sous/x.md',
    'writing-sample/x.md',
    'scripts/x.mjs',
    'voice-dna.txt',
  ])
    assert.throws(() => tools.read(path), /^Error: Fichier hors du périmètre career-ops$/, path);
  for (const path of ['writing-samples/../cv.md', 'writing-samples/.cache.md'])
    assert.throws(() => tools.read(path), /traversée/, path);
});

// review-ecrits-01 : un fichier absent de writing-samples/ répondait l'ENOENT brut de Node, chemin
// absolu de l'espace compris ; il répond désormais « absent » comme la couche utilisateur, sans créer
// le dossier quand il manque. Les formes de chemin piégées restent refusées. Données FICTIVES.
test('review-ecrits-01 FICTIF : échantillon absent, réponse propre et aucun dossier créé', (t) => {
  for (const ownerMode of [false, true]) {
    const { root, tools } = samples(t, ownerMode);
    const read = tools.read('writing-samples/absent-fictif.md');
    assert.equal(read.absent, true);
    assert.equal(read.text, '');
    assert.ok(!JSON.stringify(read).includes(root));
    rmSync(join(root, 'writing-samples'), { recursive: true });
    const none = tools.read('writing-samples/absent-fictif.txt');
    assert.equal(none.absent, true);
    assert.equal(existsSync(join(root, 'writing-samples')), false);
  }
  // Un fichier système absent garde son erreur d'avant.
  const { tools } = samples(t);
  assert.throws(
    () => tools.read('docs/absent-fictif.md'),
    (error) => error.code === 'ENOENT',
  );
});

test('review-ecrits-01 FICTIF : formes piégées refusées sous writing-samples/', (t) => {
  for (const ownerMode of [false, true]) {
    const { tools } = samples(t, ownerMode);
    for (const path of [
      'writing-samples//exemple-fictif.md',
      'writing-samples/exemple-fictif.md/',
      'writing-samples/a/b.md',
      'writing-samples/exemple-fictif.md ',
      ' writing-samples/exemple-fictif.md',
      'writing-samples/x\n.md',
      'writing-samples/exemple-fictif.md\n',
      'writing-samples/x\u0000.md',
      'Writing-Samples/exemple-fictif.md',
      'writing-samples/exemple-fictif.MD',
      'writing-samples/exemple-fictif.md.exe',
      'AGENTS.md|writing-samples/exemple-fictif.md',
    ])
      assert.throws(() => tools.read(path), /^Error: Fichier hors du périmètre career-ops$/, path);
    for (const path of [
      'writing-samples/./exemple-fictif.md',
      'writing-samples/..md',
      'writing-samples\\exemple-fictif.md',
    ])
      assert.throws(() => tools.read(path), /traversée/, path);
  }
});
