import {
  lstatSync,
  readdirSync,
  openSync,
  readSync,
  fstatSync,
  closeSync,
  constants,
} from 'node:fs';
import { join, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';

// Static analysis of a skill folder before anything else happens. Nothing is ever executed.
export const LIMITS = {
  files: 200,
  fileBytes: 262144,
  totalBytes: 2097152,
  skillBytes: 65536,
  entries: 400,
  depth: 16,
};
const TEXT = new Set(['.md', '.txt', '.yaml', '.yml', '.json', '.csv', '.html', '.tex', '']);
const SCRIPT = new Set([
  '.sh',
  '.bash',
  '.zsh',
  '.py',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.rb',
  '.pl',
  '.ps1',
  '.bat',
]);
const PATTERNS = [
  ['exécution distante', /\b(curl|wget)\b[^\n|]*\|\s*(ba|z)?sh\b/i],
  ['suppression récursive', /\brm\s+-rf?\s+[~/]/i],
  [
    'chemins d’identifiants',
    /(~|\$HOME)\/\.(ssh|aws|gnupg|codex|claude|config\/gcloud)|auth\.json|id_rsa/i,
  ],
  [
    'injection de consignes',
    /ignore (all )?(previous|prior) instructions|ignore les instructions/i,
  ],
  [
    'exfiltration potentielle',
    /\b(curl|wget|fetch)\b[^\n]*(\$\{?[A-Z_]*(KEY|TOKEN|SECRET)|env\b)/i,
  ],
  ['élévation de privilèges', /\bsudo\b|chmod\s+777/i],
  ['désactivation de garde-fous', /dangerously|--yolo|bypass(-| )?(approvals|sandbox)/i],
];

export function parseFrontMatter(content) {
  const m = content.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n/);
  if (!m) throw new Error('Front matter SKILL.md requis');
  let meta;
  try {
    meta = parse(m[1]);
  } catch {
    throw new Error('Front matter YAML invalide');
  }
  if (typeof meta?.name !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(meta.name))
    throw new Error('name invalide (minuscules, chiffres, tirets)');
  if (typeof meta.description !== 'string' || !meta.description.trim())
    throw new Error('description requise');
  return meta;
}

export function scanSkillDir(dir) {
  const files = [];
  const findings = [];
  let total = 0,
    entries = 0;
  const snapshot = new Map();
  const walk = (current, depth = 0) => {
    if (depth > LIMITS.depth) throw new Error('Skill trop profond');
    const directory = lstatSync(current);
    if (directory.isSymbolicLink())
      throw new Error('Lien symbolique refusé à la racine ou dans un dossier');
    if (!directory.isDirectory()) throw new Error('Dossier attendu');
    for (const name of readdirSync(current).sort()) {
      if (name === '.git') continue;
      if (++entries > LIMITS.entries) throw new Error('Trop d’entrées dans le Skill');
      const full = join(current, name);
      const rel = relative(dir, full);
      const st = lstatSync(full);
      if (st.isSymbolicLink()) throw new Error(`Lien symbolique refusé : ${rel}`);
      if (st.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!st.isFile()) throw new Error(`Type de fichier refusé : ${rel}`);
      if (files.length >= LIMITS.files) throw new Error('Trop de fichiers dans le Skill');
      if (st.size > LIMITS.fileBytes) throw new Error(`Fichier trop volumineux : ${rel}`);
      total += st.size;
      if (total > LIMITS.totalBytes) throw new Error('Skill trop volumineux');
      const fd = openSync(full, constants.O_RDONLY | constants.O_NOFOLLOW);
      let data;
      try {
        const opened = fstatSync(fd);
        if (
          !opened.isFile() ||
          opened.ino !== st.ino ||
          opened.dev !== st.dev ||
          opened.size !== st.size
        )
          throw new Error('Fichier modifié pendant l’analyse');
        const bounded = Buffer.alloc(LIMITS.fileBytes + 1);
        const bytes = readSync(fd, bounded, 0, bounded.length, 0);
        const after = fstatSync(fd);
        if (bytes !== st.size || after.size !== st.size || after.mtimeMs !== opened.mtimeMs)
          throw new Error('Fichier modifié pendant l’analyse');
        data = Buffer.from(bounded.subarray(0, bytes));
      } finally {
        closeSync(fd);
      }
      snapshot.set(rel, data);
      const ext = extname(name).toLowerCase();
      const kind = SCRIPT.has(ext) ? 'script' : TEXT.has(ext) ? 'text' : 'binary';
      files.push({
        path: rel,
        bytes: st.size,
        sha256: createHash('sha256').update(data).digest('hex'),
        kind,
      });
      if (kind === 'script')
        findings.push({
          level: 'warning',
          file: rel,
          rule: 'script',
          message: 'Script présent : jamais exécuté ni exporté par la plateforme',
        });
      if (kind === 'binary')
        findings.push({
          level: 'warning',
          file: rel,
          rule: 'binaire',
          message: 'Fichier binaire non analysé : non exporté',
        });
      if (kind !== 'binary') {
        const text = data.toString('utf8');
        for (const [rule, re] of PATTERNS)
          if (re.test(text))
            findings.push({ level: 'danger', file: rel, rule, message: `Motif détecté : ${rule}` });
      }
    }
    const after = lstatSync(current);
    if (after.isSymbolicLink() || after.ino !== directory.ino || after.dev !== directory.dev)
      throw new Error('Dossier modifié pendant l’analyse');
  };
  walk(dir);
  const skill = files.find((f) => f.path === 'SKILL.md');
  if (!skill) throw new Error('SKILL.md absent à la racine du Skill');
  if (skill.bytes > LIMITS.skillBytes) throw new Error('SKILL.md trop volumineux');
  const content = snapshot.get('SKILL.md').toString('utf8');
  const meta = parseFrontMatter(content);
  // Paths the method relies on but the skill does not ship (e.g. a router bound to a whole repo).
  const referenced = new Set(
    [
      ...content.matchAll(
        /(?:^|[\s`(])((?:[\w.-]+\/)*[\w.-]+\.(?:md|mjs|js|py|sh|yml|yaml|json))(?=[\s`),.:;]|$)/gm,
      ),
    ]
      .map((m) => m[1])
      .filter((ref) => !/^https?:/.test(ref) && ref !== 'SKILL.md'),
  );
  const missing = [...referenced].filter(
    (ref) => !files.some((f) => f.path === ref || f.path.endsWith('/' + ref)),
  );
  if (missing.length)
    findings.push({
      level: 'warning',
      file: 'SKILL.md',
      rule: 'dépendances externes',
      message: `Références absentes du Skill (non autonome) : ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`,
    });
  const licenseFile = files.find((f) => /^licen[cs]e(\.(md|txt))?$/i.test(f.path));
  const license = meta.license ?? (licenseFile ? 'fichier ' + licenseFile.path : null);
  if (!license)
    findings.push({
      level: 'warning',
      file: 'SKILL.md',
      rule: 'licence',
      message: 'Licence non déclarée : réutilisation à vérifier',
    });
  // A content hash over every file path and digest identifies one exact version.
  const hash = createHash('sha256')
    .update(files.map((f) => `${f.path}\0${f.sha256}`).join('\n'))
    .digest('hex');
  return { meta, files, findings, license, hash, bytes: total, snapshot };
}
