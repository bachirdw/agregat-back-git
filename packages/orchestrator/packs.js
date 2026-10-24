import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { z } from 'zod';
import { validateWorkflow } from '../workflow-engine/definition.js';
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
export const packs = ['core', 'najah'].map((id) => {
  const pack = schema.parse(
    parse(readFileSync(resolve(ROOT, 'domain-packs', id, 'manifest.yaml'), 'utf8')),
  );
  // `dags` lists every workflow of the pack; `dag` stays the default one.
  pack.dags = [...(pack.dag ? [pack.dag] : []), ...(pack.dags ?? [])];
  for (const d of pack.dags) validateWorkflow(d); // fail fast on an invalid pack DAG
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
export function getDag(pack, id) {
  if (!id) return pack.dag ?? null;
  const dag = pack.dags.find((d) => d.id === id);
  if (!dag) throw new Error(`Workflow inconnu pour ${pack.name} : ${id}`);
  return dag;
}
export function getPack(id, objective = '') {
  const p =
    id === 'auto'
      ? (packs.find((p) => p.keywords.some((k) => objective.toLowerCase().includes(k))) ?? packs[0])
      : packs.find((p) => p.id === id);
  if (!p) throw new Error('Domain Pack inconnu');
  return p;
}
export async function verifyPack(id, result, objective, inputs = {}) {
  if (id === 'core') return result;
  const plugin = await import(new URL(`../../domain-packs/${id}/index.js`, import.meta.url));
  return plugin.verify(result, objective, inputs);
}
