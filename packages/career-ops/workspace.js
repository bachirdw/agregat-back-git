import { homedir } from 'node:os';
import { resolve, relative, isAbsolute, extname } from 'node:path';
import { realpathSync, statSync, lstatSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import { parse, stringify } from 'yaml';
import { readConfined, writeConfined } from '../policy-engine/files.js';

const exec = promisify(execFile);
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const DEFAULT_WORKSPACE = resolve(homedir(), 'Downloads/agregat-career-ops');
const types = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
};
const idSchema = z.string().uuid();
const metadata = z
  .object({ id: idSchema, name: z.string(), size: z.number(), type: z.string() })
  .strict();
const within = (root, target) => {
  const rel = relative(root, target);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('../'));
};

// No shell, remote converter or model. Bounded local utilities; missing utilities fail explicitly.
export async function convertCv(file, extension) {
  const options = { timeout: 15000, maxBuffer: MAX_FILE_BYTES, encoding: 'utf8' };
  if (extension === '.pdf')
    return (await exec('pdftotext', ['-layout', file, '-'], options)).stdout;
  if (extension === '.docx')
    return (await exec('/usr/bin/textutil', ['-convert', 'txt', '-stdout', file], options)).stdout;
  return new TextDecoder('utf-8', { fatal: true }).decode(
    readConfined(resolve(file, '..'), file, MAX_FILE_BYTES),
  );
}

export class CareerWorkspace {
  constructor({
    root = process.env.AGENT_PLATFORM_CAREER_WORKSPACE || DEFAULT_WORKSPACE,
    roots = (process.env.AGENT_PLATFORM_WORKSPACE_ROOTS || DEFAULT_WORKSPACE)
      .split(':')
      .filter(Boolean),
    converter = convertCv,
  } = {}) {
    Object.assign(this, { root: resolve(root), roots: roots.map((p) => resolve(p)), converter });
  }
  path() {
    if (!this.roots.some((r) => within(r, this.root)))
      throw new Error('Espace hors des racines autorisées');
    let actual;
    try {
      actual = realpathSync(this.root);
    } catch {
      throw new Error('Espace career-ops introuvable : lancer son installation');
    }
    if (
      actual !== this.root ||
      lstatSync(this.root).isSymbolicLink() ||
      !statSync(actual).isDirectory()
    )
      throw new Error('Espace de travail symbolique ou invalide');
    if (!this.roots.some((r) => within(realpathSync(r), actual)))
      throw new Error('Espace hors périmètre');
    return actual;
  }
  async upload(bytes, rawName, type) {
    const root = this.path();
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_FILE_BYTES)
      throw new Error('Taille de fichier invalide (maximum 10 Mo)');
    let name;
    try {
      name = decodeURIComponent(rawName || '');
    } catch {
      throw new Error('Nom de fichier invalide');
    }
    name = name
      .split(/[\\/]/)
      .pop()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}._ -]/gu, '_')
      .slice(0, 160);
    const extension = extname(name).toLowerCase();
    if (!name || name.startsWith('.') || types[extension] !== type)
      throw new Error('Type ou nom de fichier refusé');
    if (extension === '.pdf' && bytes.subarray(0, 5).toString() !== '%PDF-')
      throw new Error('PDF invalide');
    if (extension === '.docx' && bytes.subarray(0, 2).toString() !== 'PK')
      throw new Error('DOCX invalide');
    const id = randomUUID();
    const file = `inputs/${id}${extension}`;
    writeConfined(root, file, bytes);
    let text;
    try {
      text = await this.converter(resolve(root, file), extension);
    } catch {
      throw new Error('Conversion locale impossible (PDF : pdftotext ; DOCX : textutil)');
    }
    if (typeof text !== 'string' || !text.trim() || Buffer.byteLength(text) > MAX_FILE_BYTES)
      throw new Error('CV vide ou conversion trop volumineuse');
    const item = { id, name, size: bytes.length, type };
    writeConfined(root, `inputs/${id}.md`, text);
    writeConfined(root, `inputs/${id}.json`, JSON.stringify(item));
    writeConfined(root, 'cv.md', text);
    return item;
  }
  attachments(ids) {
    const root = this.path();
    return ids.map((id) => {
      idSchema.parse(id);
      let item;
      try {
        item = metadata.parse(JSON.parse(readConfined(root, `inputs/${id}.json`, 2048)));
      } catch {
        throw new Error('Pièce jointe inconnue');
      }
      if (item.id !== id || types[extname(item.name).toLowerCase()] !== item.type)
        throw new Error('Pièce jointe invalide');
      const file = `inputs/${id}${extname(item.name).toLowerCase()}`;
      readConfined(root, file, MAX_FILE_BYTES);
      readConfined(root, `inputs/${id}.md`, MAX_FILE_BYTES);
      return { ...item, path: resolve(root, file), markdownPath: resolve(root, `inputs/${id}.md`) };
    });
  }
  profile(value) {
    const root = this.path();
    if (value !== undefined) {
      if (typeof value !== 'string' || Buffer.byteLength(value) > 24000)
        throw new Error('Profil trop volumineux ou invalide');
      const data = parse(value, { maxAliasCount: 0 });
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new Error('Profil YAML objet requis');
      writeConfined(root, 'config/profile.yml', stringify(data));
    }
    try {
      return readConfined(root, 'config/profile.yml', 24000).toString('utf8');
    } catch (e) {
      if (e.code === 'ENOENT') return '';
      throw e;
    }
  }
}
