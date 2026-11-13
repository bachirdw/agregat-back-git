import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
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

const TRAPS = [
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
];
test('review-ecrits-01 FICTIF : formes piégées refusées sous writing-samples/', (t) => {
  // freins-01 : hors mode propriétaire seulement (ancien attendu : refus aussi en mode
  // propriétaire) ; le mode propriétaire est vérifié par le test suivant.
  for (const ownerMode of [false]) {
    const { tools } = samples(t, ownerMode);
    for (const path of TRAPS)
      assert.throws(() => tools.read(path), /^Error: Fichier hors du périmètre career-ops$/, path);
    for (const path of [
      'writing-samples/./exemple-fictif.md',
      'writing-samples/..md',
      'writing-samples\\exemple-fictif.md',
    ])
      assert.throws(() => tools.read(path), /traversée/, path);
  }
});

// freins-01 : en mode propriétaire, tout fichier régulier de l'espace se lit. Les formes piégées
// ci-dessus lisent donc le même échantillon (le système de fichiers les résout ainsi) ou répondent
// « absent » ; aucune ne sort de l'espace, ne crée de dossier ni ne livre de chemin absolu, et un
// caractère de contrôle reste refusé.
test('freins-01 FICTIF : formes piégées en mode propriétaire, lecture confinée ou absence propre', (t) => {
  const { root, tools } = samples(t, true);
  for (const path of TRAPS) {
    if (/[\u0000-\u001f]/.test(path)) {
      assert.throws(() => tools.read(path), /^Error: Fichier hors du périmètre career-ops$/, path);
      continue;
    }
    try {
      assert.equal(tools.read(path).text, SAMPLE, path);
    } catch (error) {
      assert.ok(error.code === 'ENOENT' || /absent/.test(error.message), `${path} : ${error}`);
      assert.ok(!String(error.message).includes(root), path);
    }
  }
  assert.equal(existsSync(join(root, 'writing-samples/a')), false);
  for (const path of [
    'writing-samples/./exemple-fictif.md',
    'writing-samples/..md',
    'writing-samples\\exemple-fictif.md',
  ])
    assert.throws(() => tools.read(path), /traversée/, path);
});

// freins-01 (13/11, « enlève tout ce qui bride l'agent ») : en mode propriétaire, tout fichier
// régulier de l'espace se lit par career_read (sous-dossiers scripts/, lib/… compris), par la même
// lecture confinée. Aucun secret ne part : ni .env*, ni les domiciles isolés des agents. L'écriture
// ne change pas. Espace FICTIF.
const ownerSpace = (t) => {
  const { root } = workspace(t);
  for (const dir of ['lib/sous', 'relay/agent-homes/run-fictif/codex', 'data', 'reports'])
    mkdirSync(join(root, dir), { recursive: true });
  writeFileSync(join(root, 'lib/sous/outil.js'), '// lib FICTIVE\n');
  writeFileSync(join(root, 'relay/agent-homes/run-fictif/codex/auth.json'), '{"cle":"FICTIVE"}');
  writeFileSync(join(root, 'relay/notes.json'), '{"note":"FICTIVE"}');
  writeFileSync(join(root, 'env.local'), 'pas un secret FICTIF\n');
  writeFileSync(join(root, 'binaire.bin'), Buffer.from([0xff, 0xfe, 0x00, 0xc3]));
  symlinkSync(join(root, 'lib/sous/outil.js'), join(root, 'lib/lien.js'));
  return { root, owner: new CareerTools({ path: () => root }, { ownerMode: true }) };
};

test('freins-01 FICTIF : mode propriétaire, tout fichier régulier de l’espace se lit', (t) => {
  const { owner } = ownerSpace(t);
  for (const [path, text] of [
    ['scripts/x.mjs', ''],
    ['node_modules/x/index.js', ''],
    ['batch/batch-state.tsv', 'a\tb\n'],
    ['lib/sous/outil.js', '// lib FICTIVE\n'],
    ['relay/notes.json', '{"note":"FICTIVE"}'],
    ['env.local', 'pas un secret FICTIF\n'],
  ]) {
    const read = owner.read(path);
    assert.equal(read.path, path);
    assert.equal(read.text, text, path);
    assert.equal(read.untrusted, true, path);
  }
  // Un dossier se liste (refus qui nomme ses fichiers), un début de nom unique se lit.
  assert.throws(() => owner.read('lib/sous'), /\(1\) : lib\/sous\/outil\.js\./);
  assert.equal(owner.read('scripts/x').path, 'scripts/x.mjs');
  // L'écriture reste celle d'avant : seuls les scripts du Skill écrivent le suivi et les rapports.
  for (const path of [
    'scripts/x.mjs',
    'lib/sous/outil.js',
    'relay/notes.json',
    'config/cv-facts.json',
    'batch/batch-prompt.md',
  ])
    assert.throws(() => owner.write(path, 'FICTIF'), /hors du périmètre/, path);
  assert.throws(() => owner.write('data/pdf-index.tsv', 'x'), /ne s’écrit pas directement/);
  assert.throws(
    () => owner.write('data/applications.md', '| 1 | ligne FICTIVE |\n'),
    /ne s’écrit pas directement/,
  );
  assert.throws(() => owner.write('reports/nom-libre.md', 'FICTIF'), /Rapport : nommer/);
  assert.throws(() => owner.write('batch/autre.tsv', 'FICTIF'), /hors du périmètre/);
});

test('freins-01 FICTIF : mode propriétaire, secrets, liens et absences', (t) => {
  const { root, owner } = ownerSpace(t);
  for (const path of ['.env', 'config/.secret.json', 'config/../.env', 'lib/.env.local'])
    assert.throws(() => owner.read(path), /traversée/, path);
  for (const path of [
    'relay/agent-homes/run-fictif/codex/auth.json',
    'relay/agent-homes/run-fictif/codex',
    'relay/agent-homes',
    'lib/lien.js',
  ])
    assert.throws(
      () => owner.read(path),
      (error) => !String(error.message).includes('FICTIVE') && /hors du périmètre/.test(error),
      path,
    );
  // Un fichier absent : réponse propre, sans chemin absolu, aucun dossier créé.
  assert.throws(
    () => owner.read('nouveau/sous/absent.md'),
    (error) =>
      error.code === 'ENOENT' &&
      error.message === 'Fichier « nouveau/sous/absent.md » absent.' &&
      !error.message.includes(root),
  );
  assert.equal(existsSync(join(root, 'nouveau')), false);
  // Un fichier binaire : refus clair, pas d'erreur de décodage brute.
  assert.throws(() => owner.read('binaire.bin'), /n’est pas un fichier texte/);
  // Hors mode propriétaire : inchangé.
  const other = new CareerTools({ path: () => root });
  for (const path of ['lib/sous/outil.js', 'relay/notes.json', 'scripts/x.mjs'])
    assert.throws(() => other.read(path), /^Error: Fichier hors du périmètre career-ops$/, path);
});
