// Audit orchestrateur du 10/11 (constat 7) : a mission without the career-ops Skill (pack core, free
// browsing) may carry the owner's files too. The files the owner uploaded (POST /api/files, kept in
// the career-ops space's inputs/, which is only read here) are copied into the mission's own folder,
// under pieces-jointes/, so that browser_upload can attach them by a relative, confined path. The
// owner's space is never written; the career-ops library is not involved.
import { basename, extname, relative } from 'node:path';
import { realpathSync } from 'node:fs';
import { readConfined, writeConfined } from '../policy-engine/files.js';

export const MISSION_FILES_DIR = 'pieces-jointes';
const MAX_BYTES = 10 * 1024 * 1024;

// Copies (writeConfined : inside the mission folder, never through a link) the attachments `ids` into `cwd/pieces-jointes/` and returns what the agent is told:
// { id, name, type, size, path } with `path` relative to the mission folder (and `textPath`, the
// local text conversion, for a PDF or DOCX). Same name twice : the later one is prefixed by its id.
export function copyMissionFiles(career, ids, cwd) {
  if (!ids?.length) return [];
  const root = career.path();
  const target = realpathSync(cwd);
  const used = new Set();
  return career.attachments(ids).map((item) => {
    let name = basename(item.name);
    if (used.has(name)) name = `${item.id.slice(0, 8)}-${name}`;
    used.add(name);
    const path = `${MISSION_FILES_DIR}/${name}`;
    writeConfined(target, path, readConfined(root, relative(root, item.path), MAX_BYTES));
    const file = { id: item.id, name: item.name, type: item.type, size: item.size, path };
    if (!/^text\//.test(item.type)) {
      const textPath = `${MISSION_FILES_DIR}/${basename(name, extname(name))}.texte.md`;
      writeConfined(
        target,
        textPath,
        readConfined(root, relative(root, item.markdownPath), MAX_BYTES),
      );
      file.textPath = textPath;
    }
    return file;
  });
}

export const MISSION_FILES_RULE =
  'Pièces jointes de la mission (champ attachments) : chaque fichier est dans le dossier de mission, à son chemin relatif `path` (texte extrait dans `textPath` pour un PDF ou un DOCX). Pour joindre un fichier à un formulaire, appelle browser_upload avec ce `path` tel quel.';

// Audit EN du 10/11 : l'agent avait écrit /tmp/apply-answers-005.json (nom, e-mail) par son outil
// natif. Une consigne seulement, aucune interdiction : le mode propriétaire n'ajoute pas de restriction.
export const WORK_FILES_RULE =
  'Fichiers de travail (brouillons, JSON intermédiaires) : dans le dossier de la mission ou sous `output/` de l’espace career-ops, jamais dans /tmp.';
