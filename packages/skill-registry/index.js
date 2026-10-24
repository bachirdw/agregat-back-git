import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';
export class SkillRegistry {
  constructor(store, definitions) {
    this.store = store;
    this.definitions = definitions;
  }
  source(id) {
    const def = this.definitions.find((s) => s.id === id);
    if (!def) throw new Error('Skill inconnu');
    const content = readFileSync(def.path, 'utf8');
    if (content.length > 32768) throw new Error('Skill trop volumineux');
    const match = content.match(/^---\n([\s\S]+?)\n---\n/);
    if (!match) throw new Error('Front matter SKILL.md requis');
    const meta = parse(match[1]);
    if (!meta.name || !meta.description) throw new Error('Skill incomplet');
    return {
      ...def,
      name: meta.name,
      description: meta.description,
      content,
      hash: createHash('sha256').update(content).digest('hex'),
    };
  }
  list() {
    return this.definitions.map((def) => {
      const s = this.source(def.id);
      const installed = this.store.skill(s.id);
      return {
        id: s.id,
        name: s.name,
        description: s.description,
        version: s.version,
        hash: s.hash,
        installed: !!installed,
        active: !!installed?.active,
        reviewed: s.reviewed,
        integrity: !installed || installed.hash === s.hash,
      };
    });
  }
  install(id) {
    const s = this.source(id);
    if (!s.reviewed) throw new Error('Revue nécessaire');
    const value = { version: s.version, hash: s.hash, active: true };
    this.store.setSkill(id, value);
    return value;
  }
  activate(id, active) {
    this.source(id);
    const s = this.store.skill(id);
    if (!s) throw new Error('Installer le Skill avant activation');
    this.store.setSkill(id, { ...s, active });
  }
  resolve(ids) {
    return ids.map((id) => {
      const s = this.source(id);
      const installed = this.store.skill(id);
      if (!installed?.active || installed.hash !== s.hash)
        throw new Error(`Skill désactivé ou modifié : ${id}`);
      return { id, version: s.version, hash: s.hash, content: s.content };
    });
  }
}
