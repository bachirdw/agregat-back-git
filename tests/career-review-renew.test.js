import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyRenewal, planRenewal } from '../packages/career-ops/review-migration.js';
import { assertSourceReview, sourceSnapshot } from '../packages/career-ops/tools.js';
import { readConfined } from '../packages/policy-engine/files.js';

const git = (root, ...args) =>
  execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
const commit = (root, msg) => {
  git(root, 'add', '.');
  git(root, '-c', 'user.name=F', '-c', 'user.email=f@example.invalid', 'commit', '-qm', msg);
  return git(root, 'rev-parse', 'HEAD');
};
// Fictitious library: commit 1 reviewed (versioned receipt), commit 2 = update to renew.
function library(t) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'renew-FICTIF-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'relay'));
  writeFileSync(join(root, 'scan.mjs'), '// FICTIF 1\n');
  writeFileSync(join(root, 'a.json'), '{}');
  writeFileSync(join(root, 'gone.js'), '// FICTIF\n');
  writeFileSync(join(root, '.gitignore'), 'relay/\n');
  git(root, 'init', '-q');
  const first = commit(root, 'FICTIF 1');
  const receipt = join(root, 'relay/source-review.json');
  writeFileSync(
    receipt,
    JSON.stringify({
      ...sourceSnapshot(root),
      review: { reviewer: 'FICTIF', reviewedAt: '2026-01-01T00:00:00.000Z', sourceCommit: first },
    }),
  );
  writeFileSync(join(root, 'scan.mjs'), '// FICTIF 2\n');
  writeFileSync(join(root, 'new.sh'), '# FICTIF\n');
  rmSync(join(root, 'gone.js'));
  const second = commit(root, 'FICTIF 2');
  return { root, receipt, first, second };
}
const options = (lib, plan, extra = {}) => ({
  reviewer: 'FICTIF',
  reviewedCommit: lib.second,
  plan: plan.planSha256,
  ...extra,
});

test('renouvellement à sec : écarts mesurés, aucune écriture', (t) => {
  const lib = library(t);
  const index = join(lib.root, '.git/index');
  const [ibytes, imtime] = [readFileSync(index), statSync(index).mtimeMs];
  const before = readFileSync(lib.receipt);
  const plan = planRenewal(lib.root, { reviewedCommit: lib.second });
  assert.equal(plan.applicable, true);
  assert.equal(plan.previousCommit, lib.first);
  assert.deepEqual(plan.added, ['new.sh']);
  assert.deepEqual(plan.removed, ['gone.js']);
  assert.deepEqual(plan.changed, ['scan.mjs']);
  assert.match(plan.planSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(readFileSync(lib.receipt), before);
  assert.deepEqual(readFileSync(index), ibytes);
  assert.equal(statSync(index).mtimeMs, imtime);
  assert.deepEqual(readdirSync(join(lib.root, 'relay')), ['source-review.json']);
});

test('refus si la révision diffère de la révision revue', (t) => {
  const lib = library(t);
  const plan = planRenewal(lib.root, { reviewedCommit: lib.first });
  assert.equal(plan.applicable, false);
  assert.match(plan.blockers.join(), /Révision non revue/);
  assert.throws(
    () => applyRenewal(lib.root, options(lib, plan, { reviewedCommit: lib.first })),
    /Révision non revue/,
  );
});

test('refus si un fichier suivi est modifié', (t) => {
  const lib = library(t);
  writeFileSync(join(lib.root, 'a.json'), '{"x":1}');
  const plan = planRenewal(lib.root, { reviewedCommit: lib.second });
  assert.equal(plan.applicable, false);
  assert.match(plan.blockers.join(), /Fichiers suivis modifiés : 1/);
  assert.throws(() => applyRenewal(lib.root, options(lib, plan)), /suivis modifiés/);
});

test('refus sans plan ou avec un faux plan, reçu intact', (t) => {
  const lib = library(t);
  const before = readFileSync(lib.receipt);
  for (const plan of [undefined, 'a'.repeat(64)])
    assert.throws(
      () => applyRenewal(lib.root, { reviewer: 'FICTIF', reviewedCommit: lib.second, plan }),
      /essai à sec/,
    );
  assert.throws(() => applyRenewal(lib.root, { reviewedCommit: lib.second, plan: 'x' }), /Auteur/);
  assert.deepEqual(readFileSync(lib.receipt), before);
  assert.deepEqual(readdirSync(join(lib.root, 'relay')), ['source-review.json']);
});

test('refus si le code change après l’essai à sec', (t) => {
  const lib = library(t);
  const plan = planRenewal(lib.root, { reviewedCommit: lib.second });
  const other = { ...plan, planSha256: 'b'.repeat(64) };
  assert.throws(() => applyRenewal(lib.root, options(lib, other)), /essai à sec/);
});

test('refus : relay en lien symbolique, reçu absent, reçu non versionné', (t) => {
  const lib = library(t);
  rmSync(lib.receipt);
  assert.match(
    planRenewal(lib.root, { reviewedCommit: lib.second }).blockers.join(),
    /Reçu absent/,
  );
  writeFileSync(lib.receipt, JSON.stringify(sourceSnapshot(lib.root).files));
  assert.match(
    planRenewal(lib.root, { reviewedCommit: lib.second }).blockers.join(),
    /non versionné/,
  );
  writeFileSync(lib.receipt, 'x'.repeat(200001));
  assert.match(
    planRenewal(lib.root, { reviewedCommit: lib.second }).blockers.join(),
    /trop volumineux/,
  );
  rmSync(lib.receipt);
  rmSync(join(lib.root, 'relay'), { recursive: true });
  const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), 'renew-ailleurs-')));
  t.after(() => rmSync(elsewhere, { recursive: true, force: true }));
  symlinkSync(elsewhere, join(lib.root, 'relay'));
  assert.match(
    planRenewal(lib.root, { reviewedCommit: lib.second }).blockers.join(),
    /lien symbolique/,
  );
});

test('application : ancien reçu sauvegardé, nouveau estampillé et vérifié, idempotent', (t) => {
  const lib = library(t);
  const before = readFileSync(lib.receipt);
  const plan = planRenewal(lib.root, { reviewedCommit: lib.second });
  const now = new Date('2026-11-05T12:00:00.000Z');
  const done = applyRenewal(lib.root, options(lib, plan, { now }));
  assert.equal(done.applied, true);
  assert.deepEqual(readFileSync(join(lib.root, done.backup)), before);
  assert.match(done.backup, /^relay\/source-review\.legacy-[a-f0-9]{12}\.json$/);
  const receipt = JSON.parse(readConfined(lib.root, 'relay/source-review.json', 200000));
  assert.doesNotThrow(() => assertSourceReview(receipt, sourceSnapshot(lib.root)));
  assert.deepEqual(receipt.files, sourceSnapshot(lib.root).files);
  assert.equal(receipt.review.reviewer, 'FICTIF');
  assert.equal(receipt.review.reviewedAt, now.toISOString());
  assert.equal(receipt.review.sourceCommit, lib.second);
  assert.equal(receipt.review.renewedFrom.commit, lib.first);
  assert.deepEqual(
    [
      receipt.review.renewedFrom.added,
      receipt.review.renewedFrom.removed,
      receipt.review.renewedFrom.changed,
    ],
    [1, 1, 1],
  );
  assert.deepEqual(
    readdirSync(join(lib.root, 'relay')).sort(),
    [done.backup.split('/')[1], 'source-review.json'].sort(),
  );
  const again = planRenewal(lib.root, { reviewedCommit: lib.second });
  assert.equal(again.upToDate, true);
  assert.equal(again.applicable, false);
  assert.throws(() => applyRenewal(lib.root, options(lib, again)), /rien à faire/);
});

test('sauvegarde existante différente : renouvellement refusé, reçu intact', (t) => {
  const lib = library(t);
  const plan = planRenewal(lib.root, { reviewedCommit: lib.second });
  const before = readFileSync(lib.receipt);
  const name = `source-review.legacy-${plan.receiptSha256.slice(0, 12)}.json`;
  writeFileSync(join(lib.root, 'relay', name), 'autre');
  assert.throws(() => applyRenewal(lib.root, options(lib, plan)), /Copie de sauvegarde/);
  assert.deepEqual(readFileSync(lib.receipt), before);
});
