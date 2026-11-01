import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  applyReviewMigration,
  planReviewMigration,
} from '../packages/career-ops/review-migration.js';
import { assertSourceReview, sourceSnapshot } from '../packages/career-ops/tools.js';

const NOW = new Date('2026-11-02T00:00:00.000Z');

function library(t) {
  const root = mkdtempSync(join(tmpdir(), 'career-review-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q');
  git('config', 'user.email', 'fictif@example.test');
  git('config', 'user.name', 'FICTIF');
  writeFileSync(join(root, 'a.mjs'), 'export const a = 1;\n');
  writeFileSync(join(root, 'b.json'), '{"fictif":true}\n');
  git('add', '.');
  git('commit', '-qm', 'FICTIF');
  mkdirSync(join(root, 'relay'));
  const receipt = join(root, 'relay/source-review.json');
  const legacy = JSON.stringify(sourceSnapshot(root).files);
  writeFileSync(receipt, legacy);
  return { root, receipt, legacy, reviewedCommit: git('rev-parse', 'HEAD'), git };
}

test('à sec : mesure sans écrire et dit que la migration est possible', (t) => {
  const { root, receipt, legacy, reviewedCommit } = library(t);
  const plan = planReviewMigration(root, { reviewedCommit });
  assert.equal(plan.applicable, true);
  assert.equal(plan.entries, 2);
  assert.deepEqual(plan.blockers, []);
  assert.equal(readFileSync(receipt, 'utf8'), legacy);
  assert.deepEqual(readdirSync(join(root, 'relay')), ['source-review.json']);
});

test('appliquer écrit un reçu accepté, tracé, et garde une copie de l’ancien', (t) => {
  const { root, receipt, legacy, reviewedCommit } = library(t);
  assert.throws(
    () => assertSourceReview(JSON.parse(legacy), sourceSnapshot(root)),
    /version ou périmètre/,
  );
  const result = applyReviewMigration(root, { reviewer: 'FICTIF', now: NOW, reviewedCommit });
  const written = JSON.parse(readFileSync(receipt, 'utf8'));
  assert.doesNotThrow(() => assertSourceReview(written, sourceSnapshot(root)));
  assert.equal(written.review.reviewer, 'FICTIF');
  assert.equal(written.review.reviewedAt, NOW.toISOString());
  assert.equal(written.review.sourceCommit, reviewedCommit);
  assert.equal(written.review.kind, 'migration-de-format');
  assert.equal(written.review.migratedFrom.entries, 2);
  assert.equal(readFileSync(join(root, result.backup), 'utf8'), legacy);
  assert.deepEqual(
    readdirSync(join(root, 'relay')).sort(),
    [result.backup.slice('relay/'.length), 'source-review.json'].sort(),
  );
});

test('une seconde application refuse : le reçu est déjà versionné', (t) => {
  const { root, receipt, reviewedCommit } = library(t);
  applyReviewMigration(root, { reviewer: 'FICTIF', now: NOW, reviewedCommit });
  const once = readFileSync(receipt, 'utf8');
  assert.throws(
    () => applyReviewMigration(root, { reviewer: 'FICTIF', reviewedCommit }),
    /déjà versionné/,
  );
  assert.equal(readFileSync(receipt, 'utf8'), once);
});

test('sans auteur explicite, rien n’est écrit', (t) => {
  const { root, receipt, legacy, reviewedCommit } = library(t);
  for (const reviewer of [undefined, '', '   ', 'x'.repeat(121)])
    assert.throws(() => applyReviewMigration(root, { reviewer, reviewedCommit }), /Auteur/);
  assert.equal(readFileSync(receipt, 'utf8'), legacy);
});

const blocked = [
  [
    'fichier modifié et non commité',
    ({ root }) => writeFileSync(join(root, 'a.mjs'), 'export const a = 2;\n'),
    /modifiés depuis le reçu : 1.*suivis modifiés : 1/,
  ],
  [
    'fichier ajouté, jamais couvert par le reçu',
    ({ root }) => writeFileSync(join(root, 'nouveau.js'), 'export {};\n'),
    /non couverts par le reçu : 1/,
  ],
  [
    'fichier du reçu disparu',
    ({ root, receipt }) => {
      const files = JSON.parse(readFileSync(receipt, 'utf8'));
      files['fantome.js'] = 'a'.repeat(64);
      writeFileSync(receipt, JSON.stringify(files));
    },
    /disparus : 1/,
  ],
  [
    'empreinte fausse dans le reçu',
    ({ root, receipt }) => {
      const files = JSON.parse(readFileSync(receipt, 'utf8'));
      files['a.mjs'] = 'f'.repeat(64);
      writeFileSync(receipt, JSON.stringify(files));
    },
    /modifiés depuis le reçu : 1/,
  ],
  ['reçu illisible', ({ receipt }) => writeFileSync(receipt, '{non-json'), /illisible ou invalide/],
  ['reçu vide', ({ receipt }) => writeFileSync(receipt, '{}'), /Reçu vide/],
  [
    'valeur qui n’est pas une empreinte',
    ({ receipt }) => writeFileSync(receipt, JSON.stringify({ 'a.mjs': 'approuvé' })),
    /illisible ou invalide/,
  ],
  [
    'nouvelle révision de la bibliothèque',
    ({ root, git }) => {
      writeFileSync(join(root, 'LIRE.txt'), 'FICTIF');
      git('add', 'LIRE.txt');
      git('commit', '-qm', 'FICTIF suite');
    },
    /Révision non revue/,
  ],
];
for (const [name, alter, expected] of blocked)
  test(`bloque sans rien écrire : ${name}`, (t) => {
    const context = library(t);
    alter(context);
    const before = readFileSync(context.receipt);
    const plan = planReviewMigration(context.root, { reviewedCommit: context.reviewedCommit });
    assert.equal(plan.applicable, false);
    assert.match(plan.blockers.join(' ; '), expected);
    assert.throws(
      () =>
        applyReviewMigration(context.root, {
          reviewer: 'FICTIF',
          reviewedCommit: context.reviewedCommit,
        }),
      /Migration refusée/,
    );
    assert.deepEqual(readFileSync(context.receipt), before);
    assert.deepEqual(readdirSync(join(context.root, 'relay')), ['source-review.json']);
  });

test('un reçu en lien symbolique est refusé', (t) => {
  const { root, receipt, reviewedCommit } = library(t);
  const outside = join(root, 'dehors.txt');
  writeFileSync(outside, '{}');
  rmSync(receipt);
  symlinkSync(outside, receipt);
  assert.throws(() => planReviewMigration(root, { reviewedCommit }), /Lien symbolique/);
});

test('commande : à sec par défaut, refus sur révision non revue, code de sortie 2', (t) => {
  const { root, receipt, legacy } = library(t);
  const run = (...args) =>
    spawnSync(process.execPath, ['scripts/career-review-migrate.js', '--root', root, ...args], {
      encoding: 'utf8',
    });
  const dry = run();
  assert.equal(dry.status, 2);
  const report = JSON.parse(dry.stdout);
  assert.equal(report.applied, false);
  assert.match(report.blockers.join(), /Révision non revue/);
  const refused = run('--apply', '--reviewer', 'FICTIF');
  assert.equal(refused.status, 2);
  assert.match(refused.stderr, /Migration refusée/);
  assert.equal(run('--apply').status, 2);
  assert.equal(readFileSync(receipt, 'utf8'), legacy);
  assert.deepEqual(readdirSync(join(root, 'relay')), ['source-review.json']);
});
