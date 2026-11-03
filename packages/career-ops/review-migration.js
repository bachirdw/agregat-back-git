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
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';

import { readConfined } from '../policy-engine/files.js';
import { assertSourceReview, sourceSnapshot } from './tools.js';

export const REVIEWED_COMMIT = '2d6ed587e60cbb1aaaac7e3dd4a9f5b7b46a26af';
const RECEIPT = 'relay/source-review.json';
const MAX_RECEIPT = 200000; // The limit career_script reads the receipt with.
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
// A plain `git status` refreshes .git/index: a dry run must leave the library untouched.
const git = (root, ...args) =>
  execFileSync('git', ['--no-optional-locks', '-C', root, ...args], { encoding: 'utf8' });

function receiptProblem(root) {
  let st;
  try {
    st = lstatSync(resolve(root, 'relay'));
    if (st.isSymbolicLink()) return 'Dossier relay en lien symbolique';
    st = lstatSync(resolve(root, RECEIPT));
  } catch {
    return 'Reçu absent : nouvelle revue nécessaire';
  }
  // Opening a FIFO would hang the command.
  if (!st.isFile()) return 'Le reçu n’est pas un fichier ordinaire';
  if (st.size > MAX_RECEIPT) return 'Reçu trop volumineux';
  return null;
}

const versioned = (snapshot, files) => ({
  schemaVersion: snapshot.schemaVersion,
  algorithm: snapshot.algorithm,
  scope: snapshot.scope,
  files,
});

function measure(root, reviewedCommit) {
  const sourceCommit = git(root, 'rev-parse', 'HEAD').trim();
  const trackedChanges = git(root, 'status', '--porcelain', '--untracked-files=no')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3));
  const snapshot = sourceSnapshot(root);
  const problem = receiptProblem(root);
  const bytes = problem ? null : readFileSync(resolve(root, RECEIPT));
  const blockers = problem ? [problem] : [];
  let receipt = null;
  try {
    if (bytes) receipt = JSON.parse(bytes);
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
  if (!problem && !legacy)
    blockers.push(
      isObject && Object.hasOwn(receipt, 'schemaVersion')
        ? 'Reçu déjà versionné : rien à migrer'
        : 'Reçu illisible ou invalide : nouvelle revue nécessaire',
    );
  else if (legacy) {
    if (!Object.keys(files).length) blockers.push('Reçu vide : nouvelle revue nécessaire');
    if (added.length) blockers.push(`Fichiers non couverts par le reçu : ${added.length}`);
    if (removed.length) blockers.push(`Fichiers du reçu disparus : ${removed.length}`);
    if (changed.length) blockers.push(`Fichiers modifiés depuis le reçu : ${changed.length}`);
    // Reserves room for the review block, so an accepted plan cannot produce an unreadable receipt.
    if (JSON.stringify(versioned(snapshot, files)).length > MAX_RECEIPT - 2000)
      blockers.push('Reçu migré trop volumineux pour être relu par career_script');
  }
  if (sourceCommit !== reviewedCommit) blockers.push(`Révision non revue : ${sourceCommit}`);
  if (trackedChanges.length) blockers.push(`Fichiers suivis modifiés : ${trackedChanges.length}`);
  return {
    bytes,
    files,
    snapshot,
    plan: {
      sourceCommit,
      reviewedCommit,
      receiptSha256: bytes ? sha256(bytes) : null,
      entries: isObject ? Object.keys(legacy ? files : (receipt.files ?? {})).length : 0,
      measured: Object.keys(snapshot.files).length,
      trackedChanges,
      added,
      removed,
      changed,
      blockers,
      applicable: blockers.length === 0,
    },
  };
}

// Measures only. Migrating moves an unversioned receipt to the versioned format when the bytes it
// recorded are still exactly the bytes on disk: it is no review of the code, and any gap blocks.
export function planReviewMigration(root, { reviewedCommit = REVIEWED_COMMIT } = {}) {
  return measure(root, reviewedCommit).plan;
}

function createExclusive(path, bytes) {
  const fd = openSync(
    path,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    writeFileSync(fd, bytes);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function writeBackup(path, bytes) {
  try {
    createExclusive(path, bytes);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // An interrupted run left this same copy: its name holds the hash of these bytes.
    if (!lstatSync(path).isFile() || !readFileSync(path).equals(bytes))
      throw new Error('Copie de sauvegarde existante différente : migration refusée');
  }
}

export function applyReviewMigration(
  root,
  { reviewer, plan: expected, now = new Date(), reviewedCommit = REVIEWED_COMMIT } = {},
) {
  const name = typeof reviewer === 'string' ? reviewer.trim() : '';
  if (!name || name.length > 120) throw new Error('Auteur de la migration requis (--reviewer)');
  const { bytes, files, snapshot, plan } = measure(root, reviewedCommit);
  if (!plan.applicable) throw new Error(`Migration refusée : ${plan.blockers.join(' ; ')}`);
  // The owner agreed on one dry run: refuse anything but the receipt that run measured.
  if (expected !== plan.receiptSha256)
    throw new Error('Migration refusée : le reçu ne correspond pas à l’essai à sec (--plan)');
  const backup = `relay/source-review.legacy-${plan.receiptSha256.slice(0, 12)}.json`;
  const receipt = {
    ...versioned(snapshot, files),
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
  const target = resolve(root, RECEIPT);
  const temporary = `${target}.tmp-${process.pid}`;
  writeBackup(resolve(root, backup), bytes);
  try {
    createExclusive(temporary, JSON.stringify(receipt));
    // Last look before replacing: the code and the receipt are still what was compared.
    const last = measure(root, reviewedCommit);
    if (
      last.plan.receiptSha256 !== plan.receiptSha256 ||
      !isDeepStrictEqual(last.snapshot.files, files)
    )
      throw new Error('Migration refusée : le code ou le reçu a changé pendant la migration');
    renameSync(temporary, target);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
  // Read back as career_script does, with its size limit.
  assertSourceReview(JSON.parse(readConfined(root, RECEIPT, MAX_RECEIPT)), sourceSnapshot(root));
  return { ...plan, applied: true, backup, review: receipt.review };
}
