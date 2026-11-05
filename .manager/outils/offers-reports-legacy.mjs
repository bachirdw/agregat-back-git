#!/usr/bin/env node
// Liste, à sec, les restes des anciennes fiches Relay dans un espace career-ops (E31, E33) :
//  1. reports/<uuid>.md — écrits par l'ancien career_offer_save, ils faussent reserve-report-num
//     (le Skill lit les chiffres de tête du nom de fichier) ;
//  2. relay/offers/*.json à identifiant synthétique (groupes répétés ou en suite : 12345678,
//     22222222…), inventés par un agent de démonstration ou un test.
// Lecture seule par défaut. --apply DÉPLACE (jamais ne supprime) ; les données sont celles du
// propriétaire : lui seul décide de l'appliquer. Aucun contenu de fiche n'est affiché.
//
//   node .manager/outils/offers-reports-legacy.mjs [--root <espace>] [--apply]
//
// Sans --root : AGENT_PLATFORM_CAREER_WORKSPACE, sinon ~/Downloads/agregat-career-ops.
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ASCENDING = '0123456789abcdef';

// Un identifiant tiré au hasard n'a ni groupe d'un seul caractère répété, ni deux groupes égaux,
// ni suite de six chiffres hexadécimaux consécutifs ; ceux qu'un modèle invente en ont presque toujours.
export function syntheticReason(id) {
  if (!UUID.test(id)) return null;
  const groups = id.split('-');
  const repeated = groups.find((group) => group.length >= 4 && /^(.)\1+$/.test(group));
  if (repeated) return `groupe répété ${repeated}`;
  const same = groups.find((group, index) => group.length >= 4 && groups.indexOf(group) !== index);
  if (same) return `groupe identique ${same}`;
  const flat = groups.join('');
  for (let i = 0; i + 6 <= ASCENDING.length; i++)
    if (flat.includes(ASCENDING.slice(i, i + 6))) return `suite ${ASCENDING.slice(i, i + 6)}`;
  return null;
}

const names = (directory, extension) => {
  try {
    return readdirSync(directory).filter((name) => name.endsWith(extension));
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
};
const hasUuidName = (name, extension) => UUID.test(name.slice(0, -extension.length));

export function scan(root) {
  if (!existsSync(root) || lstatSync(root).isSymbolicLink() || !lstatSync(root).isDirectory())
    throw new Error('Espace career-ops introuvable ou symbolique');
  const offersDir = join(root, 'relay/offers');
  const synthetic = new Map();
  for (const name of names(offersDir, '.json').filter((n) => hasUuidName(n, '.json'))) {
    const id = name.slice(0, -5);
    let inside = id;
    try {
      inside = JSON.parse(readFileSync(join(offersDir, name), 'utf8')).id ?? id;
    } catch {
      // Fiche illisible : son nom de fichier seul est jugé.
    }
    const reason = syntheticReason(id) ?? syntheticReason(String(inside));
    if (reason) synthetic.set(id, reason);
  }
  const reports = names(join(root, 'reports'), '.md')
    .filter((n) => hasUuidName(n, '.md'))
    .map((name) => {
      const id = name.slice(0, -3);
      return { id, file: `reports/${name}`, synthetic: synthetic.get(id) ?? null };
    });
  const offers = [...synthetic].map(([id, reason]) => ({
    id,
    reason,
    files: ['json', 'md']
      .map((extension) => `relay/offers/${id}.${extension}`)
      .filter((file) => existsSync(join(root, file))),
  }));
  return { root, reports, offers };
}

// Destination de chaque déplacement : un rapport d'identifiant ordinaire rejoint la fiche Relay
// (relay/offers/<id>.md, là où l'écrit désormais career_offer_save) ; ce qui est synthétique va
// sous relay/legacy/, que Relay ne relit pas.
export function moves(found) {
  const list = [];
  for (const report of found.reports)
    list.push({
      from: report.file,
      to: report.synthetic
        ? `relay/legacy/reports/${report.id}.md`
        : `relay/offers/${report.id}.md`,
    });
  for (const offer of found.offers)
    for (const file of offer.files)
      list.push({ from: file, to: file.replace('relay/offers/', 'relay/legacy/offers/') });
  return list;
}

export function apply(found) {
  const list = moves(found);
  // Tout est vérifié avant le premier déplacement : une destination occupée annule l'ensemble.
  for (const { from, to } of list) {
    if (existsSync(join(found.root, to))) throw new Error(`Destination déjà occupée : ${to}`);
    if (list.filter((move) => move.to === to).length > 1) throw new Error(`Doublon : ${to}`);
    if (!existsSync(join(found.root, from))) throw new Error(`Source absente : ${from}`);
  }
  for (const { from, to } of list) {
    mkdirSync(resolve(found.root, to, '..'), { recursive: true });
    renameSync(join(found.root, from), join(found.root, to));
  }
  return list;
}

export function render(found, applied = false) {
  const lines = [`Espace : ${found.root}`, applied ? 'Mode : --apply (déplacé)' : 'Mode : à sec'];
  lines.push(`\nreports/<uuid>.md restants : ${found.reports.length}`);
  for (const report of found.reports)
    lines.push(`  ${report.file}${report.synthetic ? ` (synthétique : ${report.synthetic})` : ''}`);
  lines.push(`\nFiches relay/offers à identifiant synthétique : ${found.offers.length}`);
  for (const offer of found.offers) lines.push(`  ${offer.id} — ${offer.reason}`);
  const list = moves(found);
  lines.push(
    `\n${applied ? 'Déplacements faits' : 'Déplacements prévus par --apply'} : ${list.length}`,
  );
  for (const { from, to } of list) lines.push(`  ${from} → ${to}`);
  if (!applied && list.length)
    lines.push('\nRien n’a été modifié. --apply déplace ces fichiers (jamais ne supprime).');
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const known = new Set(['--root', '--apply']);
  const unknown = args.filter((arg, i) => arg.startsWith('-') && !known.has(arg));
  if (unknown.length) {
    console.error(`Option inconnue : ${unknown.join(' ')}`);
    process.exit(2);
  }
  const at = args.indexOf('--root');
  const root = resolve(
    at >= 0
      ? args[at + 1]
      : process.env.AGENT_PLATFORM_CAREER_WORKSPACE ||
          join(homedir(), 'Downloads/agregat-career-ops'),
  );
  try {
    const found = scan(root);
    const doApply = args.includes('--apply');
    if (doApply) apply(found);
    console.log(render(found, doApply));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
