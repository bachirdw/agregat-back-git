import {
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  closeSync,
  writeFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { resolve, relative, isAbsolute, dirname, join, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

// Trusted root, untrusted descendants. Never traverse a symlink supplied by a run or a Skill.
// This is defence in depth for local files, not an OS sandbox against another process of the same UID.
export function safeDirectory(root, path = '.') {
  const base = resolve(root);
  const target = resolve(base, path);
  const rel = relative(base, target);
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep))
    throw new Error('Chemin hors du dossier autorisé');
  if (!existsSync(base)) mkdirSync(base, { recursive: true, mode: 0o700 });
  let current = base;
  for (const part of ['', ...rel.split(sep).filter(Boolean)]) {
    if (part) current = join(current, part);
    if (!existsSync(current)) mkdirSync(current, { mode: 0o700 });
    const st = lstatSync(current);
    if (st.isSymbolicLink()) throw new Error('Lien symbolique refusé dans le chemin');
    if (!st.isDirectory()) throw new Error('Dossier attendu');
  }
  return target;
}

// Write a new inode then replace the directory entry: an existing hard link is never truncated.
export function writeConfined(root, path, data) {
  const target = resolve(root, path);
  const dir = safeDirectory(root, relative(root, dirname(target)));
  if (existsSync(target) && lstatSync(target).isSymbolicLink())
    throw new Error('Lien symbolique refusé');
  const temporary = join(dir, '.relay-' + randomUUID());
  const fd = openSync(temporary, 'wx', 0o600);
  try {
    try {
      writeFileSync(fd, data);
    } finally {
      closeSync(fd);
    }
    safeDirectory(root, relative(root, dir));
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
}
