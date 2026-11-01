import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  constants,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

import { assertSourceReview, sourceSnapshot } from './tools.js';

export const REVIEWED_COMMIT = '2d6ed587e60cbb1aaaac7e3dd4a9f5b7b46a26af';
const RECEIPT = 'relay/source-review.json';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' });

function assertPlainPath(root, path) {
  if (lstatSync(resolve(root, path)).isSymbolicLink()) throw new Error(`Lien symbolique : ${path}`);
}

// Measures only. Migrating moves an unversioned receipt to the versioned format when the bytes it
// recorded are still exactly the bytes on disk: it is no review of the code, and any gap blocks.
export function planReviewMigration(root, { reviewedCommit = REVIEWED_COMMIT } = {}) {
  assertPlainPath(root, 'relay');
  assertPlainPath(root, RECEIPT);
  const bytes = readFileSync(resolve(root, RECEIPT));
  const sourceCommit = git(root, 'rev-parse', 'HEAD').trim();
  const trackedChanges = git(root, 'status', '--porcelain', '--untracked-files=no')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3));
  const snapshot = sourceSnapshot(root);
  const blockers = [];
  let receipt;
  try {
    receipt = JSON.parse(bytes);
  } catch {
    receipt = null;
  }
  const isObject = receipt && typeof receipt === 'object' && !Array.isArray(receipt);
  const legacy =
    isObject &&
    !Object.hasOwn(receipt, 'schemaVersion') &&
    Object.values(receipt).every((hash) => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash));
  const files = legacy ? receipt : {};
  const added = Object.keys(snapshot.files)
    .filter((path) => !Object.hasOwn(files, path))
    .sort();
  const removed = Object.keys(files)
    .filter((path) => !Object.hasOwn(snapshot.files, path))
    .sort();
  const changed = Object.keys(files)
    .filter((path) => Object.hasOwn(snapshot.files, path) && files[path] !== snapshot.files[path])
    .sort();
  if (!legacy)
    blockers.push(
      isObject && Object.hasOwn(receipt, 'schemaVersion')
        ? 'Reçu déjà versionné : rien à migrer'
        : 'Reçu illisible ou invalide : nouvelle revue nécessaire',
    );
  else {
    if (!Object.keys(files).length) blockers.push('Reçu vide : nouvelle revue nécessaire');
    if (added.length) blockers.push(`Fichiers non couverts par le reçu : ${added.length}`);
    if (removed.length) blockers.push(`Fichiers du reçu disparus : ${removed.length}`);
    if (changed.length) blockers.push(`Fichiers modifiés depuis le reçu : ${changed.length}`);
  }
  if (sourceCommit !== reviewedCommit) blockers.push(`Révision non revue : ${sourceCommit}`);
  if (trackedChanges.length) blockers.push(`Fichiers suivis modifiés : ${trackedChanges.length}`);
  return {
    sourceCommit,
    reviewedCommit,
    receiptSha256: sha256(bytes),
    entries: isObject ? Object.keys(legacy ? files : (receipt.files ?? {})).length : 0,
    measured: Object.keys(snapshot.files).length,
    trackedChanges,
    added,
    removed,
    changed,
    blockers,
    applicable: blockers.length === 0,
  };
}

function writeBackup(path, bytes) {
  let fd;
  try {
    fd = openSync(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
  } catch (error) {
    // An interrupted run left this same copy: its name holds the hash of these bytes.
    if (error.code === 'EEXIST' && readFileSync(path).equals(bytes)) return;
    throw error;
  }
  try {
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

export function applyReviewMigration(
  root,
  { reviewer, now = new Date(), reviewedCommit = REVIEWED_COMMIT } = {},
) {
  const name = typeof reviewer === 'string' ? reviewer.trim() : '';
  if (!name || name.length > 120) throw new Error('Auteur de la migration requis (--reviewer)');
  const plan = planReviewMigration(root, { reviewedCommit });
  if (!plan.applicable) throw new Error(`Migration refusée : ${plan.blockers.join(' ; ')}`);
  const target = resolve(root, RECEIPT);
  const before = readFileSync(target);
  const backup = `relay/source-review.legacy-${plan.receiptSha256.slice(0, 12)}.json`;
  writeBackup(resolve(root, backup), before);
  const snapshot = sourceSnapshot(root);
  const receipt = {
    ...snapshot,
    review: {
      reviewer: name,
      reviewedAt: now.toISOString(),
      sourceCommit: plan.sourceCommit,
      kind: 'migration-de-format',
      note: 'Empreintes identiques à l’ancien reçu ; aucune nouvelle lecture du code tiers.',
      migratedFrom: {
        format: 'sans-version',
        sha256: plan.receiptSha256,
        entries: plan.entries,
        copy: backup,
      },
    },
  };
  const temporary = `${target}.tmp-${process.pid}`;
  try {
    const fd = openSync(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      writeFileSync(fd, JSON.stringify(receipt));
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(temporary, target);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
  assertSourceReview(JSON.parse(readFileSync(target)), sourceSnapshot(root));
  return { ...plan, applied: true, backup, review: receipt.review };
}
