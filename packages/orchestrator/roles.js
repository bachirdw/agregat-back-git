// equipe-01 (lot E1) : the roles of a team, described in text (method of Claude Code : agent types
// written as text). The platform's own roles are packages/orchestrator/roles/*.md (generic : no
// Skill, site nor agent named) ; a mission's workspace may add or replace some in
// <working folder>/relay/roles/*.md (read confined, no link followed, nothing created). Format : a
// header between two `---` lines made of `key: value` lines (nom, description, verdict, autreAgent),
// then the role's consigne. Also here : the verdict of a verification role read at its end, the
// choice of another agent for an independent look, and the Bilan lines of the verifications. Pure
// helpers : delegation.js gives the rows and records the events.
import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfined } from '../policy-engine/files.js';

export const PLATFORM_ROLES = join(dirname(fileURLToPath(import.meta.url)), 'roles');
export const WORKSPACE_ROLES = 'relay/roles';
export const MAX_ROLE_FILES = 20;
export const MAX_ROLE_BYTES = 8 * 1024;
export const MAX_DESCRIPTION = 300;
export const MAX_CONSIGNE = 4000;
export const MAX_VERDICT_BYTES = 20 * 1024;
export const VERDICTS = ['approuve', 'a_corriger', 'rejete'];
const MAX_ITEMS = 20;
const MAX_FIELD = 500;

// A role's name as compared : lower case, without accents.
export const roleKey = (name) =>
  String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

const flag = (value) => /^(true|oui|vrai)$/i.test(String(value ?? '').trim());

// One role file : null when it is malformed (no header, no consigne, too long).
export function parseRole(text, fileName) {
  const lines = String(text ?? '')
    .replace(/^﻿/, '')
    .split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return null;
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end < 0) return null;
  const header = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^\s*([A-Za-z]+)\s*:\s*(.*)$/);
    if (match) header[match[1]] = match[2].trim();
  }
  const consigne = lines
    .slice(end + 1)
    .join('\n')
    .trim();
  const nom = (header.nom || String(fileName ?? '').replace(/\.md$/i, '')).trim();
  const description = String(header.description ?? '').trim();
  if (!consigne || consigne.length > MAX_CONSIGNE) return null;
  if (!nom || nom.length > 40 || description.length > MAX_DESCRIPTION) return null;
  return {
    nom,
    description,
    verdict: flag(header.verdict),
    autreAgent: flag(header.autreAgent),
    consigne,
  };
}

// The `.md` files of a folder, sorted, 20 at most ; nothing when the folder is absent, a link or
// unreadable.
function roleFiles(folder) {
  try {
    if (!existsSync(folder) || !lstatSync(folder).isDirectory()) return [];
    return readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.md$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .slice(0, MAX_ROLE_FILES);
  } catch {
    return [];
  }
}

// The roles available to a mission whose working folder is `cwd` : the platform's, then those of
// the workspace (a role of the workspace replaces the platform's role of the same name). Returns
// { roles: Map(key -> role), ignored: [file names of the workspace not read as a role] }.
export function loadRoles(cwd, platformFolder = PLATFORM_ROLES) {
  const roles = new Map();
  const ignored = [];
  const add = (role) => roles.set(roleKey(role.nom), role);
  for (const name of roleFiles(platformFolder)) {
    try {
      const role = parseRole(
        readConfined(platformFolder, name, MAX_ROLE_BYTES).toString('utf8'),
        name,
      );
      if (role) add(role);
    } catch {
      /* A platform file unreadable : not a role. */
    }
  }
  if (!cwd) return { roles, ignored };
  // Each segment of relay/roles must be a real folder (no link) : nothing is created to know it.
  let folder = cwd;
  for (const part of WORKSPACE_ROLES.split('/')) {
    folder = join(folder, part);
    try {
      if (!existsSync(folder) || lstatSync(folder).isSymbolicLink()) return { roles, ignored };
    } catch {
      return { roles, ignored };
    }
  }
  for (const name of roleFiles(folder)) {
    let role = null;
    try {
      role = parseRole(
        readConfined(cwd, `${WORKSPACE_ROLES}/${name}`, MAX_ROLE_BYTES).toString('utf8'),
        name,
      );
    } catch {
      role = null;
    }
    if (role) add(role);
    else ignored.push(name);
  }
  return { roles, ignored };
}

// What mission_suivre lists : the roles without their consigne.
export const roleList = (roles) =>
  [...roles.values()].map(({ nom, description, verdict, autreAgent }) => ({
    nom,
    description,
    verdict,
    autreAgent,
  }));

// The agent of an independent look : the first installed and available agent (in the order of the
// list) that none of the authors uses ; null when there is none.
export function otherAgent(agents, authors) {
  const used = new Set(authors.filter(Boolean));
  return (agents ?? []).find((agent) => agent?.disponible && !used.has(agent.id))?.id ?? null;
}

const clip = (value) => String(value ?? '').slice(0, MAX_FIELD);
// A verdict as reported by the sub-mission (data, never instructions) : bounded, or null when its
// value is not one of the three.
export function normalizeVerdict(raw, source) {
  const valeur = roleKey(raw?.verdict);
  if (!VERDICTS.includes(valeur)) return null;
  const bloquants = (Array.isArray(raw.bloquants) ? raw.bloquants : [])
    .slice(0, MAX_ITEMS)
    .map((item) =>
      item && typeof item === 'object'
        ? { ou: clip(item.ou), pourquoi: clip(item.pourquoi) }
        : { ou: '', pourquoi: clip(item) },
    );
  const remarques = (Array.isArray(raw.remarques) ? raw.remarques : [])
    .slice(0, MAX_ITEMS)
    .map(clip);
  return { valeur, bloquants, remarques, source };
}

const ANSWER_LINE =
  /^\W*verdict\s*:\s*\**\s*(approuve|approuvé|a_corriger|à_corriger|rejete|rejeté)(?![\p{L}\p{N}_])/iu;
// The verdict of a verification sub-mission : its results folder's verdict.json (read confined,
// 20 Ko at most), else the last « Verdict : … » line of its answer, else « a_corriger » (absent).
export function readVerdict({ cwd, folder, answer }) {
  if (cwd && folder)
    try {
      const raw = JSON.parse(
        readConfined(cwd, `${folder.replace(/\/+$/, '')}/verdict.json`, MAX_VERDICT_BYTES).toString(
          'utf8',
        ),
      );
      const verdict = normalizeVerdict(raw, 'fichier');
      if (verdict) return verdict;
    } catch {
      /* Absent, too big, a link or not JSON : the answer is read. */
    }
  const lines = String(answer ?? '')
    .split(/\r?\n/)
    .map((line) => line.match(ANSWER_LINE)?.[1])
    .filter(Boolean);
  if (lines.length)
    return { valeur: roleKey(lines.at(-1)), bloquants: [], remarques: [], source: 'reponse' };
  return { valeur: 'a_corriger', bloquants: [], remarques: [], source: 'absent' };
}

const VERDICT_LABEL = { approuve: 'approuvée(s)', a_corriger: 'à corriger', rejete: 'rejetée(s)' };
// The Bilan lines of the verifications (`children` in launch order, each with `verdict` when it
// gave one and `relit` ids) : the total, and each reviewed work whose last verdict is not
// `approuve`. Empty without verdict.
export function verificationLines(children) {
  const judged = children.filter((child) => child.verdict);
  if (!judged.length) return [];
  const count = (value) => judged.filter((child) => child.verdict.valeur === value).length;
  const lines = [
    `Vérifications : ${judged.length} (${count('approuve')} ${VERDICT_LABEL.approuve}, ${count('a_corriger')} ${VERDICT_LABEL.a_corriger}, ${count('rejete')} ${VERDICT_LABEL.rejete})`,
  ];
  const byId = new Map(children.map((child) => [child.id, child]));
  const last = new Map();
  for (const child of judged)
    for (const id of child.relit ?? []) if (byId.has(id)) last.set(id, child.verdict.valeur);
  for (const [id, valeur] of last)
    if (valeur !== 'approuve')
      lines.push(`« ${byId.get(id).titre} » : dernier verdict ${valeur}, non revérifié depuis`);
  return lines;
}
