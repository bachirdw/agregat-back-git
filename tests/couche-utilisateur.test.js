import test from 'node:test';
import assert from 'node:assert/strict';
import {
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
import { CareerTools, sourceSnapshot } from '../packages/career-ops/tools.js';

// E46, suite (constaté le 05/11, mission 5e67e25a à 18:55:37) : `article-digest.md` refusé
// « Fichier hors du périmètre career-ops » alors que DATA_CONTRACT.md du Skill le range dans la
// couche utilisateur, à côté de cv.md. Le périmètre utilisateur de Relay reprend désormais les
// fichiers personnels de cette couche : article-digest.md, voice-dna.md, interview-prep/**.md
// (lecture et écriture). En mode propriétaire (aucune restriction ajoutée à l'agent),
// config/benchmarks.yml s'écrit aussi ; hors de ce mode il reste en lecture seule
// (tests/career-read-perimetre.test.js). config/cv-facts.json reste en lecture seule partout
// (relecture de nuit) : il fait partie du clone revu, l'écrire bloquerait tous les scripts du Skill,
// et c'est la liste blanche à laquelle verify-cv-facts se fie. Données FICTIVES.
const workspace = (t, ownerMode) => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'couche-utilisateur-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'config'), { recursive: true });
  writeFileSync(join(root, 'article-digest.md'), '# Preuves FICTIVES\n');
  return { root, tools: new CareerTools({ path: () => root }, { ownerMode }) };
};
const PERSONAL = [
  'article-digest.md',
  'voice-dna.md',
  'interview-prep/story-bank.md',
  'interview-prep/entreprise-fictive-ingenieur-ia.md',
  'interview-prep/sessions/2026-11-05-entretien-fictif.md',
];

test('E46 FICTIF : les fichiers personnels de la couche utilisateur se lisent et s’écrivent', (t) => {
  for (const ownerMode of [false, true]) {
    const { root, tools } = workspace(t, ownerMode);
    assert.equal(tools.read('article-digest.md').text, '# Preuves FICTIVES\n');
    for (const path of PERSONAL) {
      assert.deepEqual(tools.write(path, `Texte FICTIF de ${path}\n`), { path, saved: true });
      assert.equal(readFileSync(join(root, path), 'utf8'), `Texte FICTIF de ${path}\n`);
      assert.equal(tools.read(path).text, `Texte FICTIF de ${path}\n`, path);
    }
  }
});

test('E46 FICTIF : en mode propriétaire, les repères de marché s’écrivent, jamais cv-facts.json', (t) => {
  const owner = workspace(t, true);
  assert.deepEqual(owner.tools.write('config/benchmarks.yml', 'FICTIF\n'), {
    path: 'config/benchmarks.yml',
    saved: true,
  });
  assert.throws(() => owner.tools.write('config/cv-facts.json', '{}'), /hors du périmètre/);
  const other = workspace(t, false);
  for (const path of ['config/cv-facts.json', 'config/benchmarks.yml'])
    assert.throws(() => other.tools.write(path, 'FICTIF\n'), /hors du périmètre/, path);
});

test('E46 FICTIF : écrire la couche utilisateur laisse la revue des sources valide', async (t) => {
  const { root, tools } = workspace(t, true);
  mkdirSync(join(root, 'relay'));
  writeFileSync(
    join(root, 'verify-portals.mjs'),
    'console.log(JSON.stringify({ script: "verify-portals" }))',
  );
  writeFileSync(join(root, 'config/cv-facts.json'), '{"facts":["FICTIF"]}');
  writeFileSync(join(root, 'relay/source-review.json'), JSON.stringify(sourceSnapshot(root)));
  for (const path of [...PERSONAL, 'config/benchmarks.yml']) tools.write(path, 'FICTIF\n');
  const answer = await tools.script({ command: 'verify-portals', args: [] });
  assert.deepEqual(JSON.parse(answer.text), { script: 'verify-portals' });
});

test('E46 FICTIF : traversées, scripts et autres configurations restent hors périmètre', (t) => {
  const { tools } = workspace(t, true);
  for (const path of [
    'interview-prep/../.env',
    'interview-prep/x.mjs',
    'article-digest.md.bak',
    'voice-dna.txt',
    'config/plugins.yml',
    'config/../.env',
  ])
    assert.throws(() => tools.write(path, 'FICTIF'), /hors du périmètre|traversée/, path);
});

// ecrits-01 (13/11) : writing-samples/ (couche utilisateur, DATA_CONTRACT.md) se lit sans jamais
// suivre un lien symbolique, ni vers l'extérieur de l'espace ni vers un fichier de l'espace.
test('ecrits-01 FICTIF : un lien symbolique dans writing-samples/ est refusé', (t) => {
  const { root, tools } = workspace(t, true);
  const outside = realpathSync(mkdtempSync(join(tmpdir(), 'ecrits-hors-FICTIF-')));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  writeFileSync(join(outside, 'hors.md'), 'FICTIF hors espace\n');
  mkdirSync(join(root, 'writing-samples'));
  writeFileSync(join(root, 'writing-samples/vrai-fictif.md'), 'Phrase inventée. Autre phrase.\n');
  symlinkSync(join(outside, 'hors.md'), join(root, 'writing-samples/lien-dehors.md'));
  symlinkSync(join(root, 'article-digest.md'), join(root, 'writing-samples/lien-dedans.md'));
  assert.equal(
    tools.read('writing-samples/vrai-fictif.md').text,
    'Phrase inventée. Autre phrase.\n',
  );
  for (const path of ['writing-samples/lien-dehors.md', 'writing-samples/lien-dedans.md'])
    assert.throws(
      () => tools.read(path),
      (error) => error.code === 'ELOOP',
      path,
    );
  // Un dossier writing-samples/ qui est lui-même un lien n'est ni lu ni listé : vers l'extérieur,
  // refus nu (comme reports/lien-hors-espace, E71) ; vers l'intérieur, refus qui nomme le lien.
  const other = workspace(t, true);
  mkdirSync(join(outside, 'ecrits'));
  writeFileSync(join(outside, 'ecrits/x.md'), 'FICTIF hors espace\n');
  symlinkSync(join(outside, 'ecrits'), join(other.root, 'writing-samples'));
  assert.throws(
    () => other.tools.read('writing-samples/x.md'),
    (error) => !String(error.message).includes('FICTIF hors espace'),
  );
  assert.throws(
    () => other.tools.read('writing-samples'),
    /^Error: Fichier hors du périmètre career-ops$/,
  );
  const inner = workspace(t, true);
  mkdirSync(join(inner.root, 'interview-prep'));
  writeFileSync(join(inner.root, 'interview-prep/y.md'), 'FICTIF\n');
  symlinkSync(join(inner.root, 'interview-prep'), join(inner.root, 'writing-samples'));
  assert.throws(() => inner.tools.read('writing-samples/y.md'));
  assert.throws(() => inner.tools.read('writing-samples'), /lien symbolique/);
});
