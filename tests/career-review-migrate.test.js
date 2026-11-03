import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { keepExistingReceipt } from '../packages/career-ops/integration.js';
import {
  applyReviewMigration,
  planReviewMigration,
} from '../packages/career-ops/review-migration.js';
import { assertSourceReview, sourceSnapshot } from '../packages/career-ops/tools.js';
import { readConfined } from '../packages/policy-engine/files.js';

const git = (root, ...args) =>
  execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
function library(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'recu-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  writeFileSync(join(root, 'scan.mjs'), '// FICTIF\n');
  writeFileSync(join(root, 'a.json'), '{}');
  writeFileSync(join(root, '.gitignore'), 'relay/\n');
  git(root, 'init', '-q');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=F', '-c', 'user.email=f@example.invalid', 'commit', '-qm', 'FICTIF');
  const receipt = join(root, 'relay/source-review.json');
  writeFileSync(receipt, JSON.stringify(sourceSnapshot(root).files));
  return { root, receipt, reviewedCommit: git(root, 'rev-parse', 'HEAD') };
}
const options = (lib, plan) => ({
  reviewer: 'FICTIF',
  reviewedCommit: lib.reviewedCommit,
  plan: plan.receiptSha256,
});

test('à sec : aucune écriture, ni dans relay ni dans .git/index', (t) => {
  const lib = library(t);
  const old = new Date(Date.now() - 60000);
  utimesSync(join(lib.root, 'scan.mjs'), old, old);
  const index = join(lib.root, '.git/index');
  const [bytes, mtime] = [readFileSync(index), statSync(index).mtimeMs];
  const receipt = readFileSync(lib.receipt);
  const plan = planReviewMigration(lib.root, { reviewedCommit: lib.reviewedCommit });
  assert.equal(plan.applicable, true);
  assert.equal(plan.entries, plan.measured);
  assert.deepEqual(readFileSync(index), bytes);
  assert.equal(statSync(index).mtimeMs, mtime);
  assert.deepEqual(readFileSync(lib.receipt), receipt);
  assert.deepEqual(readdirSync(join(lib.root, 'relay')), ['source-review.json']);
});

test('application : reçu versionné accepté comme par career_script, copie identique', (t) => {
  const lib = library(t);
  const before = readFileSync(lib.receipt);
  const plan = planReviewMigration(lib.root, { reviewedCommit: lib.reviewedCommit });
  const done = applyReviewMigration(lib.root, options(lib, plan));
  assert.equal(done.applied, true);
  const receipt = JSON.parse(readConfined(lib.root, 'relay/source-review.json', 200000));
  assert.doesNotThrow(() => assertSourceReview(receipt, sourceSnapshot(lib.root)));
  assert.deepEqual(receipt.files, JSON.parse(before));
  assert.equal(receipt.review.kind, 'migration-de-format');
  assert.deepEqual(readFileSync(join(lib.root, done.backup)), before);
  assert.throws(() => applyReviewMigration(lib.root, options(lib, plan)), /déjà versionné/);
});

test('application refusée sans le reçu de l’essai à sec', (t) => {
  const lib = library(t);
  const before = readFileSync(lib.receipt);
  for (const plan of [undefined, 'a'.repeat(64)])
    assert.throws(
      () =>
        applyReviewMigration(lib.root, {
          reviewer: 'FICTIF',
          reviewedCommit: lib.reviewedCommit,
          plan,
        }),
      /essai à sec/,
    );
  assert.deepEqual(readFileSync(lib.receipt), before);
});

test('code changé après l’essai à sec : refus, reçu intact, écart nommé', (t) => {
  const lib = library(t);
  const plan = planReviewMigration(lib.root, { reviewedCommit: lib.reviewedCommit });
  const before = readFileSync(lib.receipt);
  writeFileSync(join(lib.root, 'scan.mjs'), '// FICTIF modifié\n');
  assert.throws(() => applyReviewMigration(lib.root, options(lib, plan)), /Migration refusée/);
  assert.deepEqual(readFileSync(lib.receipt), before);
  const again = planReviewMigration(lib.root, { reviewedCommit: lib.reviewedCommit });
  assert.deepEqual(again.changed, ['scan.mjs']);
  assert.equal(again.applicable, false);
});

test('fichier non couvert, révision non revue : bloqués', (t) => {
  const lib = library(t);
  writeFileSync(join(lib.root, 'nouveau.mjs'), '// FICTIF\n');
  const plan = planReviewMigration(lib.root, { reviewedCommit: 'f'.repeat(40) });
  assert.deepEqual(plan.added, ['nouveau.mjs']);
  assert.match(plan.blockers.join(), /non couverts/);
  assert.match(plan.blockers.join(), /Révision non revue/);
});

test('reçu qui n’est pas un fichier ordinaire : bloqué sans attente', (t) => {
  const lib = library(t);
  rmSync(lib.receipt);
  execFileSync('mkfifo', [lib.receipt]);
  const plan = planReviewMigration(lib.root, { reviewedCommit: lib.reviewedCommit });
  assert.match(plan.blockers.join(), /fichier ordinaire/);
  rmSync(lib.receipt);
  symlinkSync(join(lib.root, 'a.json'), lib.receipt);
  assert.equal(
    planReviewMigration(lib.root, { reviewedCommit: lib.reviewedCommit }).applicable,
    false,
  );
});

test('reçu trop volumineux pour career_script : bloqué', (t) => {
  const lib = library(t);
  writeFileSync(lib.receipt, ' '.repeat(200001));
  assert.match(
    planReviewMigration(lib.root, { reviewedCommit: lib.reviewedCommit }).blockers.join(),
    /trop volumineux/,
  );
});

test('copie de sauvegarde en lien symbolique : refus, cible intacte', (t) => {
  const lib = library(t);
  const plan = planReviewMigration(lib.root, { reviewedCommit: lib.reviewedCommit });
  const outside = join(lib.root, 'dehors.txt');
  writeFileSync(outside, 'FICTIF');
  symlinkSync(
    outside,
    join(lib.root, `relay/source-review.legacy-${plan.receiptSha256.slice(0, 12)}.json`),
  );
  const before = readFileSync(lib.receipt);
  assert.throws(() => applyReviewMigration(lib.root, options(lib, plan)));
  assert.equal(readFileSync(outside, 'utf8'), 'FICTIF');
  assert.deepEqual(readFileSync(lib.receipt), before);
});

test('préparation : ne réécrit jamais un reçu existant', (t) => {
  const lib = library(t);
  const before = readFileSync(lib.receipt);
  assert.throws(() => keepExistingReceipt(lib.root), /incompatible/);
  assert.deepEqual(readFileSync(lib.receipt), before);
  const plan = planReviewMigration(lib.root, { reviewedCommit: lib.reviewedCommit });
  applyReviewMigration(lib.root, options(lib, plan));
  const migrated = readFileSync(lib.receipt);
  assert.equal(keepExistingReceipt(lib.root), true);
  assert.deepEqual(readFileSync(lib.receipt), migrated);
  writeFileSync(join(lib.root, 'scan.mjs'), '// FICTIF modifié\n');
  assert.throws(() => keepExistingReceipt(lib.root), /modifiés : scan\.mjs/);
  rmSync(lib.receipt);
  assert.equal(keepExistingReceipt(lib.root), false);
  assert.equal(existsSync(lib.receipt), false);
});
