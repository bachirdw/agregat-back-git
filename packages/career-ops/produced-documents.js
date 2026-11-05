// apply-01 (E40, E43) : the documents a mission produced under output/, with paths the agent can
// pass to browser_upload as they are (relative to the mission folder). A CV is « adapté » (tailored)
// when the Skill's chain produced it: generate-pdf wrote it (this turn) or data/pdf-index.tsv lists
// it; a PDF rendered by career_document from a Markdown file is « brut » (raw). Read-only.
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { readConfined, writeConfined } from '../policy-engine/files.js';

const MAX_DOCUMENTS = 50;
export const UPLOAD_NOTE =
  'Chaque path est utilisable tel quel par browser_upload (chemin relatif au dossier de mission). tailored:true = CV adapté produit par la chaîne du Skill (generate-pdf, data/pdf-index.tsv) ; tailored:false = PDF rendu par Relay depuis un Markdown (cv.md), pas le CV adapté.';

export function documentKind(name) {
  const lower = String(name).toLowerCase();
  if (/cover|lettre|letter/.test(lower)) return 'cover';
  if (/(?:^|[^a-z])cv(?:[^a-z]|$)|resume|curriculum/.test(lower)) return 'cv';
  return 'other';
}

// data/pdf-index.tsv as the Skill's generate-pdf writes it: one row per PDF, a report number and the
// paths it links. Columns are not assumed: every output/….pdf cell is a tailored PDF, the first
// numeric cell its report number. Absent or unreadable index: nothing is tailored.
export function readPdfIndex(root) {
  let text;
  try {
    text = readConfined(root, 'data/pdf-index.tsv', 2 * 1024 * 1024).toString('utf8');
  } catch {
    return new Map();
  }
  const index = new Map();
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split('\t').map((cell) => cell.trim());
    const report = cells.find((cell) => /^\d{1,6}$/.test(cell)) ?? null;
    for (const cell of cells)
      if (/^output\/[^\0]+\.pdf$/i.test(cell)) index.set(cell.replace(/^\.\//, ''), { report });
  }
  return index;
}

// Relay's own record of the PDFs the Skill's chain produced in this workspace (generate-pdf,
// generate-cover-letter), so a PDF produced without --report stays « adapté » after the call.
const PRODUCED_RECORD = 'relay/produced-documents.json';
export function readProducedRecord(root) {
  try {
    const value = JSON.parse(readConfined(root, PRODUCED_RECORD, 200000).toString('utf8'));
    return Array.isArray(value) ? value.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
}
export function recordProduced(root, paths) {
  const next = [...new Set([...readProducedRecord(root), ...paths])].slice(-200);
  writeConfined(root, PRODUCED_RECORD, JSON.stringify(next));
  return next;
}

// PDFs under output/ (one level), newest first. Never lists inputs/ or relay/.
export function listProducedDocuments(root, { produced = [] } = {}) {
  let names;
  try {
    names = readdirSync(resolve(root, 'output'));
  } catch {
    return [];
  }
  const index = readPdfIndex(root);
  const fromChain = new Set([...readProducedRecord(root), ...produced]);
  const documents = [];
  for (const name of names) {
    if (!/\.pdf$/i.test(name) || name.startsWith('.')) continue;
    const path = `output/${name}`;
    let stat;
    try {
      stat = statSync(resolve(root, path));
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const row = index.get(path);
    documents.push({
      path,
      name,
      bytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
      kind: documentKind(name),
      tailored: !!row || fromChain.has(path),
      report: row?.report ?? null,
    });
  }
  return documents
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.path.localeCompare(b.path))
    .slice(0, MAX_DOCUMENTS);
}

// The tailored CV to attach: the newest PDF of kind « cv » the Skill's chain produced, else null.
export function tailoredCv(root, options) {
  return (
    listProducedDocuments(root, options).find((d) => d.tailored && d.kind === 'cv')?.path ?? null
  );
}

// What career_script adds to the answer of a document-producing step of the Skill's chain
// (cv-pdf, pdf-ready, cover) so the agent gets usable paths, not a guess under drafts/ or inputs/.
export const DOCUMENT_COMMANDS = new Set([
  'generate-pdf',
  'generate-cover-letter',
  'mark-pdf-ready',
]);
export function documentsAnswer(root, command, args = []) {
  if (!DOCUMENT_COMMANDS.has(command)) return {};
  let produced;
  if (command === 'generate-pdf') produced = args.filter((a) => !a.startsWith('-'))[1];
  if (command === 'generate-cover-letter') {
    const out = args.indexOf('--out');
    if (out >= 0) produced = args[out + 1];
  }
  const documents = listProducedDocuments(root, { produced: produced ? [produced] : [] });
  const exists = produced && documents.some((d) => d.path === produced);
  if (exists) recordProduced(root, [produced]);
  const cv = documents.find((d) => d.tailored && d.kind === 'cv')?.path ?? null;
  return {
    ...(exists ? { produced } : {}),
    ...(cv ? { cvTailored: cv } : {}),
    documents,
    note: UPLOAD_NOTE,
  };
}
