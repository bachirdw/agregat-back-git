import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import { validateWorkflow } from '../workflow-engine/definition.js';
import { loadSkillManifest, selectSkillIntents } from './skill-router.js';
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const schema = z.object({
  dag: z.unknown().optional(),
  dags: z.array(z.unknown()).max(10).optional(),
  policies: z
    .object({
      network: z.object({ allowedHosts: z.array(z.string()).max(30).default([]) }).optional(),
      browser: z
        .object({
          allowedDomains: z.array(z.string()).max(50).default([]),
          capabilities: z.array(z.string()).max(20).optional(),
        })
        .optional(),
    })
    .optional(),
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  dataMode: z.enum(['fixture', 'live', 'user', 'unverified']).optional(),
  keywords: z.array(z.string()),
  skills: z.array(z.object({ id: z.string(), file: z.string() })),
  workflow: z.object({
    id: z.string(),
    title: z.string(),
    steps: z.array(
      z.object({
        tool: z.string(),
        title: z.string(),
        arguments: z.record(z.string(), z.unknown()).optional(),
      }),
    ),
  }),
});
export const packs = readdirSync(resolve(ROOT, 'domain-packs'), { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() && existsSync(resolve(ROOT, 'domain-packs', entry.name, 'manifest.yaml')),
  )
  .map((entry) => entry.name)
  .sort((a, b) => (a === 'core' ? -1 : b === 'core' ? 1 : a.localeCompare(b)))
  .map((id) => {
    const pack = schema.parse(
      parse(readFileSync(resolve(ROOT, 'domain-packs', id, 'manifest.yaml'), 'utf8')),
    );
    // `dags` lists every workflow of the pack; `dag` stays the default one.
    pack.dags = [...(pack.dag ? [pack.dag] : []), ...(pack.dags ?? [])];
    for (const d of pack.dags) validateWorkflow(d); // fail fast on an invalid pack DAG
    if (existsSync(resolve(ROOT, 'domain-packs', id, 'skill-manifest.yaml')))
      pack.skillManifest = loadSkillManifest(id);
    return pack;
  });
export const skillDefinitions = packs.flatMap((p) =>
  p.skills.map((s) => ({
    id: s.id,
    version: p.version,
    reviewed: true,
    path: resolve(ROOT, 'domain-packs', p.id, s.file),
  })),
);
// Deterministic workflow proposal: the declared DAG whose keywords best match the objective, among
// those whose requirements are met; ties keep the pack's declaration order. Explains its choice.
export function proposeDag(pack, objective, { network = true } = {}) {
  const words = new Set(objective.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  const candidates = pack.dags.filter((d) => !(d.requires ?? []).includes('network') || network);
  if (!candidates.length) return null;
  const scored = candidates.map((d, i) => ({
    dag: d,
    i,
    hits: (d.keywords ?? []).filter((k) => words.has(k.toLowerCase())),
  }));
  scored.sort((a, b) => b.hits.length - a.hits.length || a.i - b.i);
  const best = scored[0];
  return {
    dag: best.dag,
    reason: best.hits.length
      ? `Workflow proposé (mots-clés : ${best.hits.join(', ')})`
      : 'Workflow par défaut du pack (aucun mot-clé spécifique)',
  };
}
export function getDag(pack, id) {
  if (!id) return pack.dag ?? null;
  const dag = pack.dags.find((d) => d.id === id);
  if (!dag) throw new Error(`Workflow inconnu pour ${pack.name} : ${id}`);
  return dag;
}
export function getPack(id, objective = '', selectedSkills = []) {
  const skillPacks = packs.filter((pack) =>
    pack.skills.some((skill) => selectedSkills.includes(skill.id)),
  );
  if (id === 'auto' && skillPacks.length > 1)
    throw new Error('Skills de plusieurs Domain Packs : choisir un pack explicitement');
  const p =
    id === 'auto'
      ? (skillPacks[0] ??
        packs.find(
          (pack) =>
            pack.skillManifest && selectSkillIntents(objective, [pack.skillManifest]).length,
        ) ??
        packs.find((p) => p.keywords.some((k) => objective.toLowerCase().includes(k))) ??
        packs[0])
      : packs.find((p) => p.id === id);
  if (!p) throw new Error('Domain Pack inconnu');
  return p;
}
export async function verifyPack(id, result, objective, inputs = {}) {
  if (id === 'core') return result;
  const plugin = await import(new URL(`../../domain-packs/${id}/index.js`, import.meta.url));
  return plugin.verify(result, objective, inputs);
}
