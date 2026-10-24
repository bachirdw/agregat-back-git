import { existsSync, mkdtempSync, readFileSync, rmSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, isAbsolute, win32 } from 'node:path';
import { parseFrontMatter, scanSkillDir } from './scan.js';
export { scanSkillDir, parseFrontMatter, LIMITS } from './scan.js';
import { safeDirectory, writeConfined } from '../policy-engine/files.js';
const exec = promisify(execFile);

// Skill lifecycle: bundled (reviewed with their pack) or third-party (imported → quarantined →
// reviewed by a person for one exact content hash → installed → active). Any byte change sends a
// third-party skill back to quarantine. Scripts are never executed nor exported.
export const AGENT_SKILL_DIRS = {
  claude: ['.claude/skills'],
  codex: ['.agents/skills'],
  gemini: ['.agents/skills'],
  opencode: ['.agents/skills'],
  fixture: ['.agents/skills'],
};

export class SkillRegistry {
  constructor(store, definitions, { dataDir = null } = {}) {
    this.store = store;
    this.definitions = definitions;
    this.dataDir = dataDir;
  }
  // ---------- bundled skills (shipped and reviewed with their domain pack) ----------
  bundled(id) {
    return this.definitions.find((s) => s.id === id) ?? null;
  }
  source(id) {
    const def = this.bundled(id);
    if (def) {
      const content = readFileSync(def.path, 'utf8');
      if (content.length > 32768) throw new Error('Skill trop volumineux');
      const meta = parseFrontMatter(content);
      return {
        ...def,
        origin: 'bundled',
        name: meta.name,
        description: meta.description,
        content,
        hash: createHash('sha256').update(content).digest('hex'),
        dir: dirname(def.path),
      };
    }
    const record = this.store.skill(id);
    if (record?.origin !== 'third-party') throw new Error('Skill inconnu');
    const dir = this.versionDir(id, record.hash);
    const scan = scanSkillDir(dir);
    return {
      id,
      origin: 'third-party',
      version: record.version,
      name: scan.meta.name,
      description: scan.meta.description,
      content: scan.snapshot.get('SKILL.md').toString('utf8'),
      hash: scan.hash,
      reviewed: record.reviewedHash === scan.hash,
      dir,
      record,
    };
  }
  versionDir(id, hash) {
    if (!this.dataDir) throw new Error('Registre sans dossier de données');
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) || !/^[a-f0-9]{64}$/.test(hash))
      throw new Error('Identifiant ou empreinte de Skill invalide');
    return join(this.dataDir, 'skills', id, hash);
  }
  list() {
    const bundled = this.definitions.map((def) => {
      const s = this.source(def.id);
      const installed = this.store.skill(s.id);
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        version: s.version,
        hash: s.hash,
        origin: 'bundled',
        state: installed ? (installed.active ? 'active' : 'installed') : 'available',
        installed: !!installed,
        active: !!installed?.active,
        reviewed: s.reviewed,
        integrity: !installed || installed.hash === s.hash,
        findings: [],
      };
    });
    const third = this.store
      .skills()
      .filter((r) => r.data.origin === 'third-party')
      .map(({ id, data: r }) => {
        let integrity = true;
        try {
          integrity = scanSkillDir(this.versionDir(id, r.hash)).hash === r.hash;
        } catch {
          integrity = false;
        }
        return {
          id,
          name: r.name,
          description: r.description,
          version: r.version,
          hash: r.hash,
          origin: 'third-party',
          source: r.source,
          license: r.license,
          state: r.state,
          installed: ['installed', 'active'].includes(r.state),
          active: r.state === 'active',
          reviewed: r.reviewedHash === r.hash,
          integrity,
          findings: r.findings,
          files: r.files.length,
        };
      });
    return [...bundled, ...third];
  }
  // ---------- third-party import (never executes anything) ----------
  importLocal(dir, { source = { type: 'local', path: dir }, version = null } = {}) {
    const scan = scanSkillDir(dir);
    const id = scan.meta.name;
    if (this.bundled(id)) throw new Error(`Nom réservé par un Skill intégré : ${id}`);
    const target = this.versionDir(id, scan.hash);
    const parent = safeDirectory(this.dataDir, join('skills', id));
    if (!existsSync(target)) {
      const staging = mkdtempSync(join(parent, '.import-'));
      try {
        // Copy only the bounded bytes analysed above. Never reopen the untrusted source tree.
        for (const [path, bytes] of scan.snapshot) writeConfined(staging, path, bytes);
        if (scanSkillDir(staging).hash !== scan.hash)
          throw new Error('Copie altérée pendant l’import');
        renameSync(staging, target);
      } finally {
        rmSync(staging, { recursive: true, force: true });
      }
    }
    const copied = scanSkillDir(target);
    if (copied.hash !== scan.hash) throw new Error('Copie altérée pendant l’import');
    const previous = this.store.skill(id);
    const record = {
      origin: 'third-party',
      name: id,
      description: scan.meta.description,
      version:
        version ??
        String(scan.meta.version ?? scan.meta.metadata?.version ?? scan.hash.slice(0, 12)),
      hash: scan.hash,
      license: scan.license,
      source,
      files: scan.files,
      findings: scan.findings,
      importedAt: new Date().toISOString(),
      state: 'quarantined',
      reviewedHash: null,
      versions: [...new Set([...(previous?.versions ?? []), scan.hash])],
    };
    this.store.setSkill(id, record);
    return record;
  }
  // Only GitHub over HTTPS, shallow, no hooks or submodules; then the same local import path.
  async importGit(url, { ref = null, subdir = '.', git = 'git' } = {}) {
    const u = new URL(url);
    if (
      u.protocol !== 'https:' ||
      u.hostname !== 'github.com' ||
      u.username ||
      u.password ||
      u.port ||
      u.search ||
      u.hash ||
      !/^\/[\w.-]+\/[\w.-]+(\.git)?\/?$/.test(u.pathname)
    )
      throw new Error('Source Git refusée : https://github.com/<owner>/<repo> uniquement');
    if (ref && (!/^[\w./-]{1,100}$/.test(ref) || ref.startsWith('-')))
      throw new Error('Référence Git invalide');
    if (
      typeof subdir !== 'string' ||
      isAbsolute(subdir) ||
      win32.isAbsolute(subdir) ||
      subdir.includes('\\') ||
      subdir.split('/').includes('..')
    )
      throw new Error('Sous-dossier invalide');
    const tmp = mkdtempSync(join(tmpdir(), 'relay-skill-'));
    try {
      const env = {
        PATH: process.env.PATH,
        HOME: tmp,
        GIT_TERMINAL_PROMPT: '0',
        GIT_CONFIG_NOSYSTEM: '1',
      };
      await exec(
        git,
        [
          '-c',
          'core.hooksPath=/dev/null',
          'clone',
          '--depth',
          '1',
          '--no-recurse-submodules',
          ...(ref ? ['--branch', ref] : []),
          '--',
          u.href,
          join(tmp, 'repo'),
        ],
        { env, timeout: 120000 },
      );
      const { stdout: sha } = await exec(git, ['-C', join(tmp, 'repo'), 'rev-parse', 'HEAD'], {
        env,
      });
      return this.importLocal(resolve(tmp, 'repo', subdir), {
        source: { type: 'git', url: u.href, ref, subdir, sha: sha.trim() },
      });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  review(id, { approved, hash, reviewer = 'utilisateur local', note = '' }) {
    const r = this.store.skill(id);
    if (r?.origin !== 'third-party') throw new Error('Seuls les Skills tiers passent en revue');
    if (typeof approved !== 'boolean') throw new Error('approved doit être booléen');
    if (hash !== r.hash) throw new Error('Empreinte de la version présentée requise pour la revue');
    const current = scanSkillDir(this.versionDir(id, r.hash)).hash;
    if (current !== r.hash) throw new Error('Contenu modifié depuis l’import : réimporter');
    const next = approved
      ? {
          ...r,
          state: 'reviewed',
          reviewedHash: r.hash,
          review: { reviewer, note: String(note).slice(0, 500), at: new Date().toISOString() },
        }
      : {
          ...r,
          state: 'rejected',
          reviewedHash: null,
          review: { reviewer, note: String(note).slice(0, 500), at: new Date().toISOString() },
        };
    this.store.setSkill(id, next);
    return next;
  }
  // ---------- install / activate / resolve (common to both origins) ----------
  install(id) {
    const bundled = this.bundled(id);
    if (bundled) {
      const s = this.source(id);
      if (!s.reviewed) throw new Error('Revue nécessaire');
      const value = { version: s.version, hash: s.hash, active: true };
      this.store.setSkill(id, value);
      return value;
    }
    const s = this.source(id);
    if (!s.reviewed || !['reviewed', 'installed', 'active'].includes(s.record.state))
      throw new Error('Revue humaine nécessaire avant installation');
    const value = { ...s.record, state: 'active' };
    this.store.setSkill(id, value);
    return value;
  }
  activate(id, active) {
    if (this.bundled(id)) {
      this.source(id);
      const s = this.store.skill(id);
      if (!s) throw new Error('Installer le Skill avant activation');
      this.store.setSkill(id, { ...s, active });
      return;
    }
    const r = this.store.skill(id);
    if (!r || !['installed', 'active'].includes(r.state))
      throw new Error('Installer le Skill avant activation');
    this.store.setSkill(id, { ...r, state: active ? 'active' : 'installed' });
  }
  resolve(ids) {
    return ids.map((id) => {
      const s = this.source(id);
      if (s.origin === 'bundled') {
        const installed = this.store.skill(id);
        if (!installed?.active || installed.hash !== s.hash)
          throw new Error(`Skill désactivé ou modifié : ${id}`);
        return { id, version: s.version, hash: s.hash, content: s.content, origin: 'bundled' };
      }
      if (s.record.state !== 'active' || !s.reviewed)
        throw new Error(`Skill désactivé, non revu ou modifié : ${id}`);
      return {
        id,
        version: s.version,
        hash: s.hash,
        content: s.content,
        origin: 'third-party',
        dir: s.dir,
      };
    });
  }
  // Native discovery: write the resolved skills where each agent looks for project skills.
  // Only text files are exported; scripts and binaries never leave the registry.
  exportTo(workspace, agentId, ids) {
    const dirs = AGENT_SKILL_DIRS[agentId] ?? ['.agents/skills'];
    const written = [];
    for (const s of this.resolve(ids)) {
      const source = s.origin === 'bundled' ? dirname(this.bundled(s.id).path) : s.dir;
      const scan = scanSkillDir(source);
      // Bundled hashes cover SKILL.md only; third-party hashes cover the whole tree.
      if (s.origin === 'third-party' && scan.hash !== s.hash)
        throw new Error('Contenu modifié après résolution');
      const files = scan.files.filter((f) => f.kind === 'text');
      for (const base of dirs) {
        for (const f of files) {
          writeConfined(workspace, join(base, s.id, f.path), scan.snapshot.get(f.path));
        }
        written.push(join(base, s.id));
      }
    }
    return written;
  }
}
